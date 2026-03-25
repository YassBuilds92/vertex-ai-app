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
  videoResolution: z.string().optional(),
  videoAspectRatio: z.string().optional(),
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
  const path = req.path;
  const isApiRequest = path.startsWith('/api') || path.includes('/api/');
  const isPublicPath = isApiRequest || path.includes('/login') || path.includes('/status');
  
  if (!SITE_PASSWORD || isPublicPath) return next();

  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
  const token = match ? match[2] : null;
  if (token === SITE_PASSWORD) return next();

  if (!isApiRequest) {
    return res.status(401).send(`<!DOCTYPE html><html><body><form onsubmit="event.preventDefault(); fetch('/api/login', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({password:this.pw.value})}).then(r => r.ok ? window.location.reload() : alert('Nop'))"><input type="password" name="pw" placeholder="Code" required autoFocus><button type="submit">Entrer</button></form></body></html>`);
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

function createGoogleAI(modelId?: string) {
  const { projectId, location: envLocation } = getVertexConfig();
  if (!projectId || !envLocation) throw new Error('Vertex AI non configuré');
  
  // Use 'global' for preview and 3.1 models as per AI_LEARNINGS.md and user feedback
  // Vertex AI 3.1 models and preview models often require 'global' to be found
  let finalLocation = envLocation;
  if (modelId && (modelId.includes('preview') || modelId.includes('3.1') || modelId.includes('3-flash'))) {
    finalLocation = 'global';
  }
  
  const options: any = { project: projectId, location: finalLocation };
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
    const modelId = "gemini-3.1-flash-lite-preview";
    const client = createGoogleAI(modelId);
    const systemPrompt = type === 'icon' ? ICON_PROMPT_SYSTEM_PROMPT : REFINER_SYSTEM_PROMPT;
    const model = client.getGenerativeModel({ model: modelId });
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: { role: 'system', parts: [{ text: systemPrompt }] },
      generationConfig: { temperature: 0.2 }
    });
    res.json({ refinedInstruction: result.response.candidates?.[0]?.content?.parts?.[0]?.text || "" });
  } catch (error) {
    res.status(500).json({ error: "Refine failed", message: String(error) });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio, numberOfImages } = ImageGenSchema.parse(req.body);
    const modelId = "imagen-3.0-generate-001";
    const client = createGoogleAI(modelId);
    const model = client.getGenerativeModel({ model: modelId });
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

app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, videoResolution, videoAspectRatio, videoDurationSeconds } = VideoGenSchema.parse(req.body);
    const modelId = "veo-3.1-generate-001";
    // Veo implementation usually involves GCS output, but for now we return an error or handle it if SDK supports inline
    // According to AI_LEARNINGS, it might need @google/genai, but we try with VertexAI first or return JSON error.
    res.status(501).json({ error: "Non implémenté", message: "La génération vidéo Veo nécessite une configuration GCS spécifique." });
  } catch (error) {
    res.status(500).json({ error: "Video failed", message: String(error) });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message, history, config, refinedSystemInstruction } = ChatSchema.parse(req.body);
    // Model ID mapping for Vertex AI (using stable aliases to avoid 404s)
    let modelId = config.model;
    // Ensure we use the latest models as per user rules (AI_LEARNINGS.md)
    if (modelId.includes('gemini-1.5')) modelId = modelId.replace('1.5', '3.1');
    if (modelId === 'gemini-3.1-pro') modelId = 'gemini-3.1-pro-preview';
    if (modelId === 'gemini-3.1-flash') modelId = 'gemini-3.1-flash-lite-preview';

    const client = createGoogleAI(modelId);
    const systemPromptText = refinedSystemInstruction || config.systemInstruction || "";
    const model = client.getGenerativeModel({ 
        model: modelId,
        systemInstruction: systemPromptText ? { role: 'system', parts: [{ text: systemPromptText }] } : undefined
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const contents = [...history, { role: 'user', parts: [{ text: message }] }].map((m: any) => ({
      role: m.role,
      parts: (m.parts || []).map((p: any) => {
          const part: any = {};
          if (p.text) part.text = p.text;
          if (p.inlineData) part.inlineData = p.inlineData;
          if (p.fileData) part.fileData = p.fileData;
          return part;
      })
    }));

    const tools: any[] = [];
    if (config.googleSearch) tools.push({ google_search_retrieval: {} });
    if (config.codeExecution) tools.push({ code_execution: {} });

    const request: any = {
      contents,
      generationConfig: { 
          temperature: config.temperature, 
          topP: config.topP, 
          topK: config.topK, 
          maxOutputTokens: config.maxOutputTokens || 2048 
      },
      tools: tools.length > 0 ? tools : undefined,
    };

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
    // Only serve index.html for non-API GET requests
    if (req.path.startsWith('/api') || req.method !== 'GET') return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// 404 for API routes
app.use('/api/*', (req, res) => {
  log.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({ error: "Not Found", message: `La route ${req.path} n'existe pas.` });
});

// Global Error Handler (Must be last)
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  log.error(`Global error caught for ${req.method} ${req.path}`, err);
  const status = err.status || err.statusCode || 500;
  
  if (req.path.startsWith('/api')) {
    return res.status(status).json({
      error: "Internal Server Error",
      message: err.message || String(err),
      path: req.path
    });
  }
  res.status(status).send(`Something went wrong: ${err.message || String(err)}`);
});

// Server (Local only)
if (!process.env.VERCEL) {
  app.listen(PORT, () => log.success(`Server running on port ${PORT}`));
}
