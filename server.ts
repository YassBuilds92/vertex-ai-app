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
import cookieParser from 'cookie-parser';

// ─── Constants & Setup ──────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);
const MAX_PAYLOAD = '50mb';
const SSE_HEARTBEAT_INTERVAL = 15_000;

const app = express();

export default app; // For Vercel

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
  info: (msg: string, meta?: Record<string, unknown>) =>
    console.log(`[${new Date().toISOString()}] ℹ️  ${msg}`, meta ? JSON.stringify(meta) : ''),
  success: (msg: string) =>
    console.log(`[${new Date().toISOString()}] ✅ ${msg}`),
  warn: (msg: string, meta?: Record<string, unknown>) =>
    console.warn(`[${new Date().toISOString()}] ⚠️  ${msg}`, meta ? JSON.stringify(meta) : ''),
  debug: (msg: string, meta?: Record<string, unknown>) =>
    console.debug(`[${new Date().toISOString()}] 🔍 ${msg}`, meta ? JSON.stringify(meta) : ''),
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

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  
  // Debug logging for Vercel routing
  if (req.path.startsWith('/api/') || req.url.startsWith('/api/')) {
    log.debug(`Incoming API Request: ${req.method} ${req.url} (path: ${req.path})`);
  }
  
  next();
});

// ─── Authentication Middleware ────────────────────────────────────
const COOKIE_NAME = 'site_access_token';

function getAuthCookie(req: Request) {
  const cookies = req.headers.cookie || '';
  const match = cookies.match(new RegExp(`(^| )${COOKIE_NAME}=([^;]+)`));
  return match ? match[2] : null;
}

const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const SITE_PASSWORD = process.env.SITE_PASSWORD;
  
  // Skip auth if password is not set (locally) or for the login API
  if (!SITE_PASSWORD || req.path === '/api/login' || req.path.startsWith('/api/status')) {
    return next();
  }

  // Check for the cookie
  const token = getAuthCookie(req);
  if (token === SITE_PASSWORD) {
    return next();
  }

  // Serve login page if not authenticated
  if (!req.path.startsWith('/api/')) {
    return res.status(401).send(`
      <!DOCTYPE html>
      <html lang="fr">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Accès Privé | AI Studio</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0a0a0a; color: white; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #1a1a1a; padding: 2rem; border-radius: 12px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); border: 1px solid #333; max-width: 320px; width: 100%; text-align: center; }
          h1 { margin-bottom: 1.5rem; font-size: 1.5rem; color: #fff; }
          input { width: 100%; padding: 0.75rem; margin-bottom: 1rem; border-radius: 6px; border: 1px solid #444; background: #222; color: white; box-sizing: border-box; }
          button { width: 100%; padding: 0.75rem; border-radius: 6px; border: none; background: #3b82f6; color: white; font-weight: bold; cursor: pointer; transition: background 0.2s; }
          button:hover { background: #2563eb; }
          #error { color: #ef4444; margin-top: 1rem; font-size: 0.875rem; display: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>🔒 Accès Privé</h1>
          <form id="loginForm">
            <input type="password" id="password" placeholder="Code d'accès" required autoFocus>
            <button type="submit">Entrer</button>
          </form>
          <div id="error">Code incorrect</div>
        </div>
        <script>
          document.getElementById('loginForm').onsubmit = async (e) => {
            e.preventDefault();
            const password = document.getElementById('password').value;
            const res = await fetch('/api/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ password })
            });
            if (res.ok) {
              window.location.reload();
            } else {
              document.getElementById('error').style.display = 'block';
            }
          };
        </script>
      </body>
      </html>
    `);
  }

  res.status(401).json({ error: 'Non autorisé' });
};

app.use(authMiddleware);

app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const SITE_PASSWORD = process.env.SITE_PASSWORD;
  
  if (SITE_PASSWORD && password === SITE_PASSWORD) {
    // Set cookie that expires in 30 days
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${password}; Path=/; HttpOnly; SameSite=Strict; Max-Age=2592000`);
    return res.json({ success: true });
  }
  
  res.status(401).json({ error: 'Code incorrect' });
});

// ─── Helpers ────────────────────────────────────────────────────
function getVertexConfig() {
  const projectId = process.env.VERTEX_PROJECT_ID;
  const location = process.env.VERTEX_LOCATION;
  return { isConfigured: !!(projectId && location), projectId, location };
}

function createGoogleAI(modelId: string) {
  const { projectId, location: envLocation } = getVertexConfig();
  if (!projectId || !envLocation) throw new Error('Vertex AI non configuré (VERTEX_PROJECT_ID / VERTEX_LOCATION manquants)');
  
  // Use 'global' for ALL Gemini-branded models (gemini-*) to ensure availability and proper routing.
  // Legacy Imagen models (imagen-*) still require regional endpoints (e.g., us-central1).
  const isGemini = modelId.toLowerCase().includes('gemini');
  const finalLocation = isGemini ? 'global' : envLocation;
  
  log.debug('Creating GoogleGenAI client', { modelId, isGemini, location: finalLocation });

  return new GoogleGenAI({
    vertexai: true,
    project: projectId,
    location: finalLocation,
  });
}


// ─── API Routes ─────────────────────────────────────────────────

app.get('/api/status', (_req, res) => {
  const config = getVertexConfig();
  res.json({
    isVertexConfigured: config.isConfigured,
    isGcsConfigured: !!process.env.VERTEX_GCS_OUTPUT_URI,
    serviceAccount: serviceAccountEmail,
    debug: {
        projectId: config.projectId ? (config.projectId.substring(0, 5) + '...') : null,
        location: config.location,
        envKeys: Object.keys(process.env).filter(key => key.includes('VERTEX') || key.includes('GOOGLE')),
        path: _req.path,
        url: _req.url
    }
  });
});

app.get('/api/debug-path', (req, res) => {
    res.json({
        path: req.path,
        url: req.url,
        originalUrl: req.originalUrl,
        headers: req.headers
    });
});

const REFINER_SYSTEM_PROMPT = `You are a master of prompt engineering. Your role is to act as a 'Prompt Refiner'. 
Analyze the user's input and generate an optimized 'System Instruction' for a more powerful AI model.
The goal is to provide the model with the best possible context, role, and constraints to answer the user perfectly.
BE CONCISE. Output ONLY the refined system instruction. Do not include any meta-talk or markdown backticks unless strictly necessary for the prompt.`;

const ICON_PROMPT_SYSTEM_PROMPT = `You are a visual design expert. Given a system instruction for an AI, generate a single, highly descriptive prompt (max 15 words) for an image generator (like Imagen) to create a minimalistic square icon/logo representing this AI's role. 
Style: Modern, simplistic, vibrant colors, professional 3D or flat design. 
DO NOT USE TEXT IN THE IMAGE. Output ONLY the image prompt.`;

app.post('/api/refine', async (req, res) => {
  try {
    const { prompt, type } = ChatRefineSchema.parse(req.body);
    const client = createGoogleAI("gemini-3.1-flash-lite-preview");
    
    const systemInstruction = type === 'icon' ? ICON_PROMPT_SYSTEM_PROMPT : REFINER_SYSTEM_PROMPT;

    const result = await client.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.2,
      }
    });

    const refinedText = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!refinedText) {
      log.error('Refine returned empty text or no candidate');
      throw new Error("L'IA n'a pas pu analyser le prompt (résultat vide ou erreur de quota)");
    }
    
    res.json({ refinedInstruction: refinedText });
  } catch (error) {
    log.error('Refine error:', error);
    res.status(500).json({ error: 'Failed to refine prompt', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio, imageSize, numberOfImages, personGeneration, safetySetting } = ImageGenSchema.parse(req.body);
    const modelId = "gemini-2.5-flash-image"; 
    const client = createGoogleAI(modelId);
    
    log.info('Image generation request', { prompt, modelId, aspectRatio });

    const config: any = {};
    if (aspectRatio) config.aspectRatio = aspectRatio;
    if (imageSize) config.imageSize = imageSize;
    if (numberOfImages) config.numberOfImages = numberOfImages;
    if (personGeneration) config.personGeneration = personGeneration;
    if (safetySetting) config.safetyFilterLevel = safetySetting;

    const result = await client.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: config
    });

    const candidate = result.candidates?.[0];
    let imageBase64 = "";

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts as any[]) {
        if (part.inlineData) {
          imageBase64 = part.inlineData.data;
          break;
        }
      }
    }
    
    if (!imageBase64) {
      log.error("Image content missing in response", { result: JSON.stringify(result).substring(0, 500) });
      throw new Error("L'IA n'a pas pu générer l'image");
    }
    
    res.json({ base64: `data:image/png;base64,${imageBase64}` });
  } catch (error) {
    log.error('Image Gen error:', error);
    res.status(500).json({ error: 'Failed to generate image', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, videoResolution, videoAspectRatio, videoDurationSeconds } = VideoGenSchema.parse(req.body);
    const modelId = "veo-3.1-generate-001";
    const client = createGoogleAI(modelId);

    log.info('Video generation request', { prompt, modelId, videoResolution, videoAspectRatio });

    // Veo returns a long-running operation
    const op = await client.models.generateVideos({
      model: modelId,
      prompt: prompt,
      config: {
        resolution: videoResolution || '720p',
        aspectRatio: videoAspectRatio || '16:9',
        durationSeconds: videoDurationSeconds || 6,
      }
    });

    log.info('Video generation operation started', { operationId: op.name });

    // In a serverless environment, we might timeout if we wait too long.
    // However, for now, we wait for the result to fix the TS error.
    const result = await op.result();
    const video = result.generatedVideos?.[0];

    if (video?.videoAttributes?.uri) {
        res.json({ url: video.videoAttributes.uri });
    } else if (video?.inlineData) {
        res.json({ url: `data:video/mp4;base64,${video.inlineData.data}` });
    } else {
        log.error("Video content missing in response", { result: JSON.stringify(result).substring(0, 500) });
        throw new Error("L'IA n'a pas pu générer la vidéo");
    }

  } catch (error) {
    log.error('Video Gen error:', error);
    res.status(500).json({ error: 'Failed to generate video', details: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/chat', async (req: Request, res: Response) => {
  try {
    const { message, history, config, attachments, refinedSystemInstruction } = ChatSchema.parse(req.body);
    
    // Choose the final system instruction (prefer refined one)
    const finalSystemInstruction = refinedSystemInstruction || config.systemInstruction;
    
    const client = createGoogleAI(config.model);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Combine history and current message
    const fullHistory = [
      ...history,
      { role: 'user', parts: [{ text: message }], attachments: attachments }
    ];

    // Convert history format to Gemini parts
    const contents = fullHistory.map((m: any) => {
      const parts: any[] = m.parts ? [...m.parts] : [];
      
      // Extract text content from parts for regex check and processing
      const textFromParts = parts.find((p: any) => p.text)?.text || "";
      
      // Auto-detect YouTube links in text content for enhanced processing
      const ytRegex = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/g;
      const foundYtUrls = new Set<string>();
      let ytMatch;
      while ((ytMatch = ytRegex.exec(textFromParts)) !== null) {
        foundYtUrls.add(ytMatch[0]);
      }

      if (m.attachments && m.attachments.length > 0) {
        m.attachments.forEach((att: any) => {
          if (att.type === 'youtube') {
            parts.push({
              fileData: {
                fileUri: att.url,
                mimeType: "video/mp4"
              }
            });
            foundYtUrls.delete(att.url); // Avoid duplicates if already in attachments
          } else if (att.base64) {
            const base64Data = att.base64.split(',')[1] || att.base64;
            parts.push({
              inlineData: {
                mimeType: att.mimeType || "application/octet-stream",
                data: base64Data
              }
            });
          }
        });
      }

      // Add auto-detected YouTube links that weren't in attachments
      foundYtUrls.forEach(url => {
        parts.push({
          fileData: {
            fileUri: url.startsWith('http') ? url : `https://${url}`,
            mimeType: "video/mp4"
          }
        });
      });
      
      return {
        role: m.role,
        parts: parts
      };
    });

    // --- NOUVELLE SYNTAXE SDK @google/genai ---
    const aiConfig: Record<string, any> = {};
    
    if (config?.temperature !== undefined) aiConfig.temperature = config.temperature;
    if (config?.topP !== undefined) aiConfig.topP = config.topP;
    if (config?.topK !== undefined) aiConfig.topK = config.topK;

    // --- Gestion des Outils (Grounding, Code Execution, etc.) ---
    const tools: any[] = [];
    if (config.googleSearch) tools.push({ googleSearch: {} });
    if (config.codeExecution) tools.push({ codeExecution: {} });
    if (config.googleMaps) tools.push({ googleMaps: {} });
    if (config.urlContext) tools.push({ urlContext: {} });
    
    if (tools.length > 0) {
      aiConfig.tools = tools;
    }
    
    // On force l'activation de la réflexion si le modèle est compatible (3.1 Pro, 3.1 Flash Lite, 3.0 Flash)
    if (config.model.includes('gemini-3')) {
      (aiConfig as any).thinkingConfig = {
        includeThoughts: true
      };
      
      if (config.thinkingLevel) {
        let level = config.thinkingLevel.toUpperCase();
        
        // Sécurité : Pro ne supporte pas MINIMAL, on replie vers LOW
        if (config.model.includes('pro') && level === 'MINIMAL') {
          level = 'LOW';
        }
        
        (aiConfig as any).thinkingConfig.thinkingLevel = level;
      }
    }

    if (config.presencePenalty !== undefined) aiConfig.presencePenalty = config.presencePenalty;
    if (config.frequencyPenalty !== undefined) aiConfig.frequencyPenalty = config.frequencyPenalty;
    if (config.responseMimeType) aiConfig.responseMimeType = config.responseMimeType;
    if (config.stopSequences && config.stopSequences.length > 0) aiConfig.stopSequences = config.stopSequences;
    if (config.maxOutputTokens) aiConfig.maxOutputTokens = config.maxOutputTokens;

    if (finalSystemInstruction) {
      (aiConfig as any).systemInstruction = finalSystemInstruction;
    }

    log.info('Chat request', { model: config.model, historyCount: fullHistory.length });

    try {
      const response = await client.models.generateContentStream({
        model: config.model,
        contents: contents,
        config: aiConfig as any
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

      log.info(`Streaming complete for model ${config.model}`, { chunkCount });
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

// --- ENDPOINT METADATA ---
app.get('/api/metadata', async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: "URL manquante" });
  }

  try {
    // Utilisation de l'oEmbed de YouTube pour récupérer le titre sans clé API
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
    if (!response.ok) {
      return res.status(404).json({ error: "Vidéo non trouvée" });
    }
    const data: any = await response.json();
    res.json({ title: data.title, thumbnail: data.thumbnail_url });
  } catch (error) {
    log.error("Metadata error", error);
    res.status(500).json({ error: "Erreur lors de la récupération des métadonnées" });
  }
});

// ─── Static Files & SPA Fallback ──────────────────────────────────
// On Vercel, the 'dist' folder is at the root after build.
const distPath = path.join(process.cwd(), 'dist');

if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
  // Check if dist exists to avoid errors on the first build
  if (fs.existsSync(distPath)) {
    log.info(`Serving static files from ${distPath}`);
    app.use(express.static(distPath));
    // The fallback MUST be after all API routes
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    log.warn('dist directory not found. Static files will not be served.');
  }
}

async function startServer() {
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  
  app.listen(PORT, () => log.success(`Server running on http://localhost:${PORT}`));
}

if (process.env.VERCEL) {
  // On Vercel, we don't start the server manually
  log.info("Running on Vercel (serverless mode)");
} else {
  startServer();
}
