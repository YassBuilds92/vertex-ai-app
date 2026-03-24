import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { Storage } from '@google-cloud/storage';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

// ─── Constants & Setup ──────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_PAYLOAD = '50mb';
const SSE_HEARTBEAT_INTERVAL = 15_000;

const app = express();

// ─── Rate Limiting ──────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limite chaque IP à 100 requêtes par fenêtre
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, veuillez réessayer plus tard." }
});

app.use('/api/', apiLimiter);

// ─── Validation Schemas ─────────────────────────────────────────
const ChatSchema = z.object({
  model: z.string(),
  messages: z.array(z.any()),
  config: z.object({
    temperature: z.number().optional(),
    topP: z.number().optional(),
    topK: z.number().optional(),
    systemInstruction: z.string().optional(),
    googleSearch: z.boolean().optional(),
    thinkingConfig: z.object({
      thinkingLevel: z.string().optional()
    }).optional()
  }).optional()
});

// ─── Logging Helper ─────────────────────────────────────────────
const log = {
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`, meta ? JSON.stringify(meta) : ''),
  success: (msg: string) =>
    console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  error: (msg: string, err?: unknown) =>
    console.error(`[${new Date().toISOString()}] ❌ ${msg}`, err instanceof Error ? err.message : err ?? ''),
};

// ─── Google Cloud Storage Init ──────────────────────────────────
let storage: Storage | null = null;
let serviceAccountEmail: string | null = null;

if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  try {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    storage = new Storage({ credentials });
    serviceAccountEmail = credentials.client_email || null;
    log.success(`Storage SDK initialized (${serviceAccountEmail})`);
    const keyPath = path.join(process.cwd(), 'gcp-key.json');
    fs.writeFileSync(keyPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, { mode: 0o600 });
    process.env.GOOGLE_APPLICATION_CREDENTIALS = keyPath;
  } catch (error) {
    log.error('Failed to initialize Storage SDK', error);
  }
}

// ─── Middleware ──────────────────────────────────────────────────
app.use(express.json({ limit: MAX_PAYLOAD }));
app.use(express.urlencoded({ limit: MAX_PAYLOAD, extended: true }));

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// ─── Helpers ────────────────────────────────────────────────────
function getVertexConfig() {
  const projectId = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION;
  return { isConfigured: !!(projectId && location), projectId, location };
}

function createGoogleAI(model: string) {
  const { projectId, location } = getVertexConfig();
  if (!projectId || !location) throw new Error('Vertex AI non configuré (VERTEX_PROJECT_ID / VERTEX_LOCATION manquants)');
  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: model.includes('preview') ? 'global' : location,
  });
}

// ─── API Routes ─────────────────────────────────────────────────

app.get('/api/status', (_req, res) => {
  res.json({
    isVertexConfigured: getVertexConfig().isConfigured,
    isGcsConfigured: !!process.env.VERTEX_GCS_OUTPUT_URI,
    serviceAccount: serviceAccountEmail,
  });
});

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const validated = ChatSchema.parse(req.body);
    const { model, messages, config } = validated;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const ai = createGoogleAI(model);

    // Convert messages from { role, content } to { role, parts: [{ text }] }
    const contents = messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      parts: [{ text: m.content }]
    }));

    // --- NOUVELLE SYNTAXE SDK @google/genai ---
    const aiConfig: Record<string, any> = {};
    
    if (config?.temperature !== undefined) aiConfig.temperature = config.temperature;
    if (config?.topP !== undefined) aiConfig.topP = config.topP;
    if (config?.topK !== undefined) aiConfig.topK = config.topK;
    
    // On force l'activation de la réflexion
    aiConfig.thinkingConfig = {
      includeThoughts: true
    };
    if (config?.thinkingConfig?.thinkingLevel) {
      aiConfig.thinkingConfig.thinkingLevel = config.thinkingConfig.thinkingLevel;
    }

    if (config?.systemInstruction) {
      aiConfig.systemInstruction = config.systemInstruction;
    }
    
    if (config?.googleSearch) {
      aiConfig.tools = [{ googleSearch: {} }];
    }

    log.info('Chat request', { model, messageCount: messages.length, hasConfig: !!config });

    try {
      const response = await ai.models.generateContentStream({
        model: model,
        contents: contents,
        config: aiConfig
      });

      let chunkCount = 0;
      for await (const chunk of response) {
        chunkCount++;
        // Extraire les thoughts (parts avec thought: true) et le texte normal
        let thoughtText = '';
        let normalText = '';
        if (chunk.candidates?.[0]?.content?.parts) {
          for (const part of chunk.candidates[0].content.parts as any[]) {
            // Support both standard 'thought' boolean and potential string extraction
            if (part.thought === true || part.thought) {
              thoughtText += part.text || '';
            } else if (part.text) {
              normalText += part.text;
            }
          }
        }
        if (normalText) res.write(`data: ${JSON.stringify({ text: normalText })}\n\n`);
        if (thoughtText) res.write(`data: ${JSON.stringify({ thoughts: thoughtText })}\n\n`);
      }

      log.info(`Streaming complete for model ${model}`, { chunkCount });
      res.end();
    } catch (streamError) {
      log.error('Streaming error', streamError);
      res.write(`data: ${JSON.stringify({ error: "Erreur lors du streaming" })}\n\n`);
      res.end();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Payload invalide", details: error.issues });
    }
    log.error("Chat error", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ... autres routes (tts, image, etc) ...

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }
  app.listen(PORT, () => log.success(`Server running on http://localhost:${PORT}`));
}

startServer();
