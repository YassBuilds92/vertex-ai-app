import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { VertexAI } from '@google-cloud/vertexai';
import { Storage } from '@google-cloud/storage';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';

// ─── Constants & Setup ──────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_PAYLOAD = '50mb';

const app = express();
export default app; // For Vercel

// ─── Rate Limiting ──────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requêtes, veuillez réessayer plus tard." }
});

app.use('/api/', apiLimiter);
app.use('/status', apiLimiter);

// ─── Validation Schemas ─────────────────────────────────────────
const ChatRefineSchema = z.object({
  prompt: z.string(),
  type: z.enum(['system', 'icon']).optional(),
});

const ImageGenSchema = z.object({
  prompt: z.string(),
  aspectRatio: z.string().optional(),
  imageSize: z.string().optional(),
  numberOfImages: z.number().optional(),
  personGeneration: z.string().optional(),
  safetySetting: z.string().optional(),
});

const VideoGenSchema = z.object({
  prompt: z.string(),
  videoResolution: z.enum(['720p', '1080p', '4k']).optional(),
  videoAspectRatio: z.enum(['16:9', '9:16']).optional(),
  videoDurationSeconds: z.number().optional(),
});

const ChatSchema = z.object({
  message: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    parts: z.array(z.object({
      text: z.string().optional(),
      inlineData: z.object({
        mimeType: z.string(),
        data: z.string(),
      }).optional(),
      fileData: z.object({
        mimeType: z.string(),
        fileUri: z.string(),
      }).optional(),
    })),
  })),
  config: z.object({
    model: z.string(),
    temperature: z.number(),
    topP: z.number(),
    topK: z.number(),
    maxOutputTokens: z.number(),
    systemInstruction: z.string().optional(),
    googleSearch: z.boolean().optional(),
    googleMaps: z.boolean().optional(),
    codeExecution: z.boolean().optional(),
    urlContext: z.boolean().optional(),
    structuredOutputs: z.boolean().optional(),
    thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
    maxThoughtTokens: z.number().optional(),
    presencePenalty: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    responseMimeType: z.enum(['text/plain', 'application/json']).optional(),
    stopSequences: z.array(z.string()).optional(),
  }),
  attachments: z.array(z.any()).optional(),
  refinedSystemInstruction: z.string().nullable().optional(),
});

// ─── Logging Helper ─────────────────────────────────────────────
const log = {
  info: (msg: string, meta?: any) => console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`, meta ? JSON.stringify(meta) : ''),
  success: (msg: string) => console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  warn: (msg: string, meta?: any) => console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`, meta ? JSON.stringify(meta) : ''),
  debug: (msg: string, meta?: any) => console.debug(`[${new Date().toISOString()}] 🔍 ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg: string, err?: any) => console.error(`[${new Date().toISOString()}] ❌ ${msg}`, err instanceof Error ? err.message : err ?? ''),
};

// ─── State ──────────────────────────────────────────────────────
let gcpCredentials: any = null;
let storage: Storage | null = null;
let serviceAccountEmail: string | null = null;

try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    gcpCredentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    storage = new Storage({ credentials: gcpCredentials });
    serviceAccountEmail = gcpCredentials.client_email || null;
    log.success(`SDKs initialized (${serviceAccountEmail})`);
  }
} catch (error) {
  log.error('Failed to initialize GCP SDKs', error);
}

// ─── Middleware ──────────────────────────────────────────────────
app.use(express.json({ limit: MAX_PAYLOAD }));
app.use(express.urlencoded({ limit: MAX_PAYLOAD, extended: true }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

// ─── Authentication ──────────────────────────────────────────────
const COOKIE_NAME = 'site_access_token';
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const SITE_PASSWORD = process.env.SITE_PASSWORD;
  const isPublicPath = req.path.startsWith('/api/') || req.path.includes('/login') || req.path.includes('/status');
  if (!SITE_PASSWORD || isPublicPath) return next();

  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
  const token = match ? match[2] : null;

  if (token === SITE_PASSWORD) return next();

  if (!req.path.startsWith('/api/')) {
    return res.status(401).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <title>Accès Privé</title>
        <style>body { background: #0a0a0a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; }</style>
      </head>
      <body>
        <form onsubmit="event.preventDefault(); fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:this.pw.value})}).then(r => r.ok ? window.location.reload() : alert('Nop'))">
          <input type="password" name="pw" placeholder="Code" required autoFocus>
          <button type="submit">Entrer</button>
        </form>
      </body>
      </html>
    `);
  }
  res.status(401).json({ error: 'Unauthenticated' });
};
app.use(authMiddleware);

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.SITE_PASSWORD) {
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${password}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`);
    return res.json({ success: true });
  }
  res.status(401).json({ error: 'Refusé' });
});

// ─── Helpers ────────────────────────────────────────────────────
function getVertexConfig() {
  const projectId = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION;
  return { isConfigured: !!(projectId && location), projectId, location };
}

function createGoogleAI() {
  const { projectId, location: envLocation } = getVertexConfig();
  if (!projectId || !envLocation) throw new Error('Vertex AI non configuré');
  const options: any = { project: projectId, location: envLocation };
  if (gcpCredentials) options.googleAuthOptions = { credentials: gcpCredentials };
  return new VertexAI(options);
}

// ─── Routes ─────────────────────────────────────────────────────
app.get('/api/status', (_req, res) => {
  const config = getVertexConfig();
  res.json({
    isVertexConfigured: config.isConfigured,
    isGcsConfigured: !!process.env.VERTEX_GCS_OUTPUT_URI,
    serviceAccount: serviceAccountEmail,
    envKeys: Object.keys(process.env).filter(k => ['VERTEX_PROJECT_ID', 'VERTEX_LOCATION', 'GOOGLE_APPLICATION_CREDENTIALS_JSON'].includes(k))
  });
});

const REFINER_SYSTEM_PROMPT = `Optimise l'instruction système suivante pour un modèle IA puissant. Sois concis.`;
const ICON_PROMPT_SYSTEM_PROMPT = `Génère un prompt d'image pour un logo minimaliste représentant ce rôle IA.`;

app.post('/api/refine', async (req, res) => {
  try {
    const { prompt, type } = ChatRefineSchema.parse(req.body);
    const client = createGoogleAI();
    const model = client.getGenerativeModel({ 
      model: "gemini-1.5-flash-002",
      systemInstruction: { role: 'system', parts: [{ text: type === 'icon' ? ICON_PROMPT_SYSTEM_PROMPT : REFINER_SYSTEM_PROMPT }] }
    });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2
      }
    });
    res.json({ refinedInstruction: result.response.candidates?.[0]?.content?.parts?.[0]?.text || "" });
  } catch (error) {
    res.status(500).json({ error: "Refine failed", message: String(error) });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio, imageSize, numberOfImages } = ImageGenSchema.parse(req.body);
    const client = createGoogleAI();
    const model = client.getGenerativeModel({ model: "imagen-3.0-generate-001" });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { aspectRatio, candidateCount: numberOfImages } as any
    });
    const base64 = result.response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
    if (!base64) throw new Error("No image data");
    res.json({ base64: `data:image/png;base64,${base64}` });
  } catch (error) {
    res.status(500).json({ error: "Image failed", message: String(error) });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, config, refinedSystemInstruction } = ChatSchema.parse(req.body);
    const client = createGoogleAI();
    
    // Model ID mapping for Vertex AI (mapping Studio names to Vertex names)
    let modelId = config.model;
    if (modelId.includes('gemini-3.1-pro')) modelId = 'gemini-1.5-pro';
    if (modelId.includes('gemini-3.x-pro')) modelId = 'gemini-1.5-pro';
    if (modelId.includes('gemini-3.1-flash')) modelId = 'gemini-1.5-flash';
    if (modelId.includes('gemini-3.x-flash')) modelId = 'gemini-1.5-flash';
    if (modelId.includes('gemini-3')) modelId = 'gemini-1.5-pro';
    if (modelId.includes('gemini-2.0')) modelId = 'gemini-1.5-pro'; // Fallback if 2.0 is not available

    const model = client.getGenerativeModel({ model: modelId });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const contents = [...history, { role: 'user', parts: [{ text: message }] }].map((m: any) => ({
      role: m.role,
      parts: m.parts.map((p: any) => ({ text: p.text, inlineData: p.inlineData, fileData: p.fileData }))
    }));

    const tools: any[] = [];
    if (config.googleSearch) tools.push({ google_search_retrieval: {} });
    if (config.codeExecution) tools.push({ code_execution: {} });

    const request: any = {
      contents,
      generationConfig: { temperature: config.temperature, topP: config.topP, topK: config.topK, maxOutputTokens: config.maxOutputTokens || 2048 },
      tools: tools.length > 0 ? tools : undefined,
    };

    if (refinedSystemInstruction || config.systemInstruction) {
        request.systemInstruction = { role: 'system', parts: [{ text: refinedSystemInstruction || config.systemInstruction || "" }] };
    }

    const response = await model.generateContentStream(request);
    for await (const chunk of response.stream) {
      const parts = chunk.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if ((part as any).thought) res.write(`data: ${JSON.stringify({ thoughts: (part as any).text })}\n\n`);
        else if (part.text) res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
      }
    }
    res.end();
  } catch (error) {
    log.error("Chat error", error);
    res.status(500).json({ error: "Chat failed", message: String(error) });
  }
});

// SPA Fallback
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/api/status') return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Server (Local only)
if (!process.env.VERCEL) {
  app.listen(PORT, () => log.success(`Server running on port ${PORT}`));
}
