import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { Storage } from '@google-cloud/storage';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import PDFDocument from 'pdfkit';

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
    maxOutputTokens: z.number().optional().nullable(),
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
  info: (msg: string, meta?: any) => console.log(`[${new Date().toISOString()}] INFO  ${msg}`, meta ? JSON.stringify(meta) : ''),
  success: (msg: string) => console.log(`[${new Date().toISOString()}] OK ${msg}`),
  warn: (msg: string, meta?: any) => console.warn(`[${new Date().toISOString()}] WARN  ${msg}`, meta ? JSON.stringify(meta) : ''),
  debug: (msg: string, meta?: any) => console.debug(`[${new Date().toISOString()}] DEBUG ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg: string, err?: any) => console.error(`[${new Date().toISOString()}] ERROR ${msg}`, err instanceof Error ? err.message : err ?? ''),
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
    log.success(`GCP SDKs initialized (${serviceAccountEmail})`);
  }
} catch (error) {
  log.error('Failed to initialize GCP SDKs', error);
}

const BUCKET_NAME = 'videosss92';

async function uploadToGCS(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
  if (!storage) throw new Error("Storage non configuré");
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(`uploaded/${fileName}`);
  
  await file.save(buffer, {
    metadata: { contentType },
  });

  // Generate a signed URL that lasts for 7 days
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return url;
}

// ─── Path Helpers ──────────────────────────────────────────────
const ALLOWED_ROOTS = [
  path.normalize(process.cwd()),
  path.normalize('/tmp'),
  path.normalize(os.tmpdir())
];

function resolveAndValidatePath(filePath: string): string {
  // If path is absolute, check it against allowed roots
  if (path.isAbsolute(filePath)) {
    const absolute = path.normalize(filePath);
    if (ALLOWED_ROOTS.some(root => absolute.startsWith(root))) return absolute;
    throw new Error("Accès refusé : chemin en dehors des zones autorisées.");
  }

  // Fallback for Vercel: prioritize relative paths in /tmp if project is likely read-only
  if (process.env.VERCEL) {
    const tmpPath = path.resolve('/tmp', filePath);
    // Ensure we don't escape /tmp
    if (tmpPath.startsWith('/tmp') || tmpPath.startsWith(path.normalize('/tmp'))) return tmpPath;
  }

  // If path is relative, try resolving against process.cwd()
  const projectPath = path.resolve(process.cwd(), filePath);
  if (projectPath.startsWith(process.cwd())) return projectPath;

  throw new Error("Accès refusé hors du projet.");
}

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.csv': 'text/csv',
    '.json': 'application/json',
  };
  return mimes[ext] || 'application/octet-stream';
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
  const reqPath = req.path;
  const isApiRequest = reqPath.startsWith('/api') || reqPath.includes('/api/');
  const isPublicPath = isApiRequest || reqPath.includes('/login') || reqPath.includes('/status');

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

/**
 * Parses raw error messages from the Google GenAI SDK (often stringified JSON)
 * into a cleaner, human-readable format.
 */
function parseApiError(error: any): string {
  const errStr = String(error);
  if (errStr.includes('ApiError:')) {
    try {
      const jsonStart = errStr.indexOf('{');
      if (jsonStart !== -1) {
        const jsonPart = errStr.substring(jsonStart);
        const parsed = JSON.parse(jsonPart);
        if (parsed.error && parsed.error.message) {
          let msg = parsed.error.message;
          if (parsed.error.code === 429 || parsed.error.status === "RESOURCE_EXHAUSTED") {
            msg = "Quota dépassé (429). Trop de demandes simultanées ou limite quotidienne atteinte. Réessayez dans quelques minutes.";
          }
          return msg;
        }
      }
    } catch (e) {
      log.debug("Failed to parse ApiError JSON", e);
    }
  }
  return errStr;
}

/**
 * Standard retry with exponential backoff for 429 (Resource Exhausted) errors.
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const errStr = String(error);
      const isRetryable = errStr.includes('429') || errStr.includes('RESOURCE_EXHAUSTED') || errStr.includes('Too Many Requests');
      
      if (isRetryable && i < maxRetries) {
        const delay = baseDelay * Math.pow(2, i);
        log.warn(`Quota hit (429). Retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

function createGoogleAI(modelId?: string): GoogleGenAI {
  const { projectId, location: envLocation } = getVertexConfig();
  if (!projectId || !envLocation) throw new Error('Vertex AI non configuré');

  // Use 'global' for preview and 3.1 models
  let finalLocation = envLocation;
  if (modelId && (modelId.includes('preview') || modelId.includes('3.1') || modelId.includes('3-flash') || modelId.includes('image'))) {
    finalLocation = 'global';
  }

  const options: any = {
    vertexai: true,
    project: projectId,
    location: finalLocation,
  };
  if (gcpCredentials) {
    options.googleAuthOptions = { credentials: gcpCredentials };
  }
  return new GoogleGenAI(options);
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
    const ai = createGoogleAI(modelId);
    const systemPrompt = type === 'icon' ? ICON_PROMPT_SYSTEM_PROMPT : REFINER_SYSTEM_PROMPT;
    
    const result = await retryWithBackoff(() => ai.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.2,
      }
    }));
    
    res.json({ refinedInstruction: result.text || "" });
  } catch (error) {
    const cleanError = parseApiError(error);
    log.error("Refine error", cleanError);
    res.status(500).json({ error: "Refine failed", message: "Échec de l'optimisation", details: cleanError });
  }
});

app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio, numberOfImages, imageSize, personGeneration, safetySetting, thinkingLevel } = ImageGenSchema.extend({
      model: z.string().optional(),
      thinkingLevel: z.string().optional()
    }).parse(req.body);

    const modelId = req.body.model || "gemini-2.5-flash-image";
    log.info(`Generating image for: ${prompt.substring(0, 100)}...`, { modelId, aspectRatio, numberOfImages });
    
    const ai = createGoogleAI(modelId);
    
    const config: any = {
      ...(aspectRatio ? { aspectRatio } : {}),
      ...(numberOfImages ? { candidateCount: numberOfImages } : {}),
    };

    // If it's a Gemini 3.x model, we can pass thinkingLevel
    if (modelId.includes('gemini-3') || modelId.includes('nano-banana')) {
      if (thinkingLevel) config.thinkingLevel = thinkingLevel;
    }

    // Handle specific parameters for Imagen and new Gemini Image models
    if (modelId.includes('imagen') || modelId.includes('image-preview') || modelId.includes('gemini-2.5-flash-image')) {
      if (personGeneration) config.personGeneration = personGeneration;
      if (safetySetting) config.safetyFilterLevel = safetySetting;
      if (imageSize) config.imageSize = imageSize;
    }

    const result = await retryWithBackoff(() => ai.models.generateContent({
      model: modelId,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config
    }));

    if (!result.candidates || result.candidates.length === 0) {
      log.error("Image generation failed - no candidates", result);
      throw new Error("Le modèle n'a pas généré d'image (possible blocage de sécurité ou quota).");
    }

    const part = result.candidates[0].content?.parts?.find((p: any) => p.inlineData);
    const base64 = (part as any)?.inlineData?.data;

    if (!base64) {
      log.error("No base64 data found in candidates", result.candidates[0]);
      throw new Error("Aucune donnée d'image (base64) n'a été trouvée dans la réponse.");
    }

    const buffer = Buffer.from(base64, 'base64');
    const fileName = `generated-${Date.now()}-${Math.random().toString(36).substring(7)}.png`;
    const url = await uploadToGCS(buffer, fileName, 'image/png');

    res.json({ url, base64: `data:image/png;base64,${base64}` });
  } catch (error) {
    const cleanError = parseApiError(error);
    log.error("Image gen error", cleanError);
    res.status(500).json({ 
      error: "Image failed", 
      message: "Échec de la génération d'image",
      details: cleanError 
    });
  }
});

app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, videoResolution, videoAspectRatio, videoDurationSeconds } = VideoGenSchema.parse(req.body);
    res.status(501).json({ error: "Non implémenté", message: "La génération vidéo Veo nécessite une configuration GCS spécifique." });
  } catch (error) {
    res.status(500).json({ error: "Video failed", message: String(error) });
  }
});

app.post('/api/upload', async (req, res) => {
  try {
    const { base64, fileName, mimeType } = z.object({
      base64: z.string(),
      fileName: z.string(),
      mimeType: z.string()
    }).parse(req.body);

    const pureBase64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(pureBase64, 'base64');
    const url = await uploadToGCS(buffer, fileName, mimeType);

    res.json({ url });
  } catch (error) {
    log.error("Upload error", error);
    res.status(500).json({ error: "Upload failed", message: String(error) });
  }
});

app.post('/api/chat', async (req, res) => {
  let headersSent = false;
  try {
    const { message, history, config, refinedSystemInstruction } = ChatSchema.parse(req.body);

    // Model ID mapping
    let modelId = config.model;
    if (modelId.includes('gemini-1.5')) modelId = modelId.replace('1.5', '3.1');
    if (modelId === 'gemini-3.1-pro') modelId = 'gemini-3.1-pro-preview';
    if (modelId === 'gemini-3.1-flash') modelId = 'gemini-3.1-flash-lite-preview';

    const ai = createGoogleAI(modelId);
    const systemPromptText = refinedSystemInstruction || config.systemInstruction || "";

    const contents = [...history, { role: 'user' as const, parts: [{ text: message }] }].map((m: any) => ({
      role: m.role,
      parts: (m.parts || []).map((p: any) => {
        const part: any = {};
        if (p.text) part.text = p.text;
        if (p.inlineData) part.inlineData = p.inlineData;
        if (p.fileData) part.fileData = p.fileData;
        return part;
      })
    }));

    // Build tools array for new SDK
    const tools: any[] = [];
    if (config.googleSearch) tools.push({ googleSearch: {} });
    if (config.codeExecution) tools.push({ codeExecution: {} });

    // Build config for new SDK
    const genConfig: any = {
      temperature: config.temperature,
      topP: config.topP,
      topK: config.topK,
      maxOutputTokens: config.maxOutputTokens || 65536,
    };
    if (systemPromptText) genConfig.systemInstruction = systemPromptText;
    if (tools.length > 0) genConfig.tools = tools;

    // Set SSE headers AFTER model setup succeeds (before streaming)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    headersSent = true;

    const response = await ai.models.generateContentStream({
      model: modelId,
      contents,
      config: genConfig,
    });

    for await (const chunk of response) {
      // Check for finish reason in candidates
      const candidates = (chunk as any).candidates;
      if (candidates?.[0]?.finishReason && candidates[0].finishReason !== 'STOP' && candidates[0].finishReason !== 'FINISH_REASON_UNSPECIFIED') {
        log.warn(`Stream finished with reason: ${candidates[0].finishReason}`, { model: modelId });
        if (candidates[0].finishReason === 'MAX_TOKENS') {
          res.write(`data: ${JSON.stringify({ error: "Limite de tokens atteinte. La réponse est peut-être incomplète." })}\n\n`);
        }
      }

      // Check for thought parts via candidates
      if (candidates?.[0]?.content?.parts) {
        for (const part of candidates[0].content.parts) {
          if (part.thought) {
            const thoughtText = (part as any).text || part.text || '';
            if (thoughtText) {
              res.write(`data: ${JSON.stringify({ thoughts: thoughtText })}\n\n`);
            }
          } else if (part.text) {
            res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
          }
        }
      } else if (chunk.text) {
        // Fallback: use chunk.text directly
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    res.end();
  } catch (error) {
    log.error("Chat error", error);
    if (!headersSent) {
      // Headers not sent yet -> return clean JSON error
      res.status(500).json({ error: "Chat failed", message: String(error) });
    } else {
      // SSE already started -> send error as SSE event then close
      res.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
      res.end();
    }
  }
});

app.post('/api/cowork', async (req, res) => {
  let headersSent = false;
  try {
    const { message, history, config } = ChatSchema.parse(req.body);
    
    // Model ID mapping
    let modelId = config.model;
    if (modelId.includes('gemini-1.5')) modelId = modelId.replace('1.5', '3.1');
    if (modelId === 'gemini-3.1-pro') modelId = 'gemini-3.1-pro-preview';
    if (modelId === 'gemini-3.1-flash') modelId = 'gemini-3.1-flash-lite-preview';
    if (!modelId) modelId = "gemini-3.1-pro-preview";

    const ai = createGoogleAI(modelId);
    
    // Tools definition
    const tools: any[] = [];
    if (config.googleSearch) tools.push({ googleSearch: {} });
    if (config.codeExecution) tools.push({ codeExecution: {} });
    
    // Local tools
    const localTools = [
      {
        name: "list_files",
        description: "Liste les fichiers et dossiers dans un répertoire spécifique (par défaut la racine).",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin relatif ou absolu du dossier à lister (ex: /tmp/)." }
          }
        },
        execute: ({ path: folderPath }: { path?: string }) => {
          const targetDir = folderPath ? resolveAndValidatePath(folderPath) : process.cwd();
          if (!fs.existsSync(targetDir)) throw new Error(`Le dossier ${folderPath} n'existe pas.`);
          if (!fs.statSync(targetDir).isDirectory()) throw new Error(`${folderPath} n'est pas un dossier.`);
          const files = fs.readdirSync(targetDir);
          return { files: files.filter(f => !f.startsWith('.')) };
        }
      },
      {
        name: "read_file",
        description: "Lit le contenu d'un fichier texte spécifique du projet.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin relatif du fichier à lire." }
          },
          required: ["path"]
        },
        execute: ({ path: filePath }: { path: string }) => {
          const absolutePath = resolveAndValidatePath(filePath);
          if (!fs.existsSync(absolutePath)) throw new Error(`Le fichier ${filePath} n'existe pas.`);
          const content = fs.readFileSync(absolutePath, 'utf-8');
          // Limit content if too large
          return { content: content.length > 20000 ? content.slice(0, 20000) + "... [tronqué]" : content };
        }
      },
      {
        name: "write_file",
        description: "Crée ou modifie un fichier avec le contenu spécifié.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin relatif du fichier à écrire." },
            content: { type: "string", description: "Contenu à écrire dans le fichier." }
          },
          required: ["path", "content"]
        },
        execute: ({ path: filePath, content }: { path: string, content: string }) => {
          const absolutePath = resolveAndValidatePath(filePath);
          const dir = path.dirname(absolutePath);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(absolutePath, content, 'utf-8');
          return { success: true, message: `Fichier ${filePath} écrit avec succès à l'emplacement : ${absolutePath}` };
        }
      },
      {
        name: "list_recursive",
        description: "Liste récursivement tous les fichiers à partir d'un dossier spécifique.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Dossier de départ (ex: /tmp/)." }
          }
        },
        execute: ({ path: folderPath }: { path?: string }) => {
          const rootDir = folderPath ? resolveAndValidatePath(folderPath) : process.cwd();
          const getAllFiles = (dir: string, fileList: string[] = [], depth = 0): string[] => {
            if (depth > 2) return fileList; // Limit depth
            if (!fs.existsSync(dir)) return fileList;
            const files = fs.readdirSync(dir);
            files.forEach(file => {
              if (file.startsWith('.') || file === 'node_modules' || file === 'dist') return;
              const name = path.join(dir, file);
              if (fs.statSync(name).isDirectory()) {
                getAllFiles(name, fileList, depth + 1);
              } else {
                fileList.push(path.relative(rootDir, name));
              }
            });
            return fileList;
          };
          const allFiles = getAllFiles(rootDir);
          return { files: allFiles.slice(0, 100) }; // Limit result count
        }
      },
      {
        name: "release_file",
        description: "Upload de façon sécurisée un fichier vers le cloud et génère un lien de téléchargement public (valable 7 jours). À utiliser après avoir créé un fichier (ex: PDF, rapport) que l'utilisateur doit uvoir télécharger.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin relatif du fichier local à uploader." }
          },
          required: ["path"]
        },
        execute: async ({ path: filePath }: { path: string }) => {
          const absolutePath = resolveAndValidatePath(filePath);
          if (!fs.existsSync(absolutePath)) throw new Error(`Le fichier ${filePath} n'existe pas.`);
          const buffer = fs.readFileSync(absolutePath);
          const fileName = path.basename(filePath);
          const mimeType = getMimeType(filePath);
          log.info(`Releasing file: ${filePath} (${mimeType})`);
          const url = await uploadToGCS(buffer, fileName, mimeType);
          return { success: true, url, message: `Fichier ${filePath} uploadé avec succès. Voici le lien de téléchargement.` };
        }
      },
      {
        name: "create_pdf",
        description: "Crée un fichier PDF directement. Utilise cet outil pour générer des PDFs au lieu d'écrire un script Python. Supporte : titre, sous-titres, paragraphes, listes à puces. Le fichier est créé dans /tmp/.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Nom du fichier PDF (ex: rapport.pdf). Sera créé dans /tmp/." },
            title: { type: "string", description: "Titre principal du document." },
            sections: {
              type: "array",
              description: "Liste de sections du document. Chaque section a un 'heading' optionnel et un 'body' (texte ou liste à puces séparées par \\n).",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Titre de la section (optionnel)." },
                  body: { type: "string", description: "Contenu texte de la section. Utiliser \\n pour les sauts de ligne. Préfixer avec '• ' pour les listes à puces." }
                }
              }
            }
          },
          required: ["filename", "title", "sections"]
        },
        execute: async ({ filename, title, sections }: { filename: string, title: string, sections: Array<{ heading?: string, body: string }> }) => {
          const outputPath = path.join('/tmp', filename.endsWith('.pdf') ? filename : `${filename}.pdf`);

          return new Promise<any>((resolve, reject) => {
            try {
              const doc = new PDFDocument({ size: 'A4', margin: 50 });
              const stream = fs.createWriteStream(outputPath);
              doc.pipe(stream);

              // Title
              doc.fontSize(22).font('Helvetica-Bold').text(title, { align: 'center' });
              doc.moveDown(1.5);

              // Sections
              for (const section of sections) {
                if (section.heading) {
                  doc.fontSize(16).font('Helvetica-Bold').text(section.heading);
                  doc.moveDown(0.5);
                }
                if (section.body) {
                  const lines = section.body.split('\n');
                  for (const line of lines) {
                    if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
                      doc.fontSize(11).font('Helvetica').text(line.trim(), { indent: 20 });
                    } else {
                      doc.fontSize(11).font('Helvetica').text(line.trim());
                    }
                  }
                }
                doc.moveDown(1);
              }

              // Footer
              doc.fontSize(8).font('Helvetica-Oblique').text(`Généré par Studio Pro Agent — ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });

              doc.end();

              stream.on('finish', () => {
                resolve({ success: true, path: outputPath, message: `PDF '${filename}' créé avec succès à ${outputPath}. Utilise maintenant 'release_file' pour obtenir le lien de téléchargement.` });
              });
              stream.on('error', (err) => {
                reject(err);
              });
            } catch (err) {
              reject(err);
            }
          });
        }
      },
      {
        name: "execute_script",
        description: "Exécute un script Node.js préalablement écrit sur le disque. ATTENTION : Seul Node.js est disponible dans cet environnement. Python N'EST PAS installé.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin du script à exécuter (ex: /tmp/script.js)." },
            language: { type: "string", enum: ["node"], description: "Le langage du script (seul 'node' est supporté)." }
          },
          required: ["path", "language"]
        },
        execute: async ({ path: filePath, language }: { path: string, language: string }) => {
          if (language === 'python') {
            return { success: false, error: "Python n'est PAS disponible dans cet environnement serveur. Utilise les outils natifs comme 'create_pdf' pour générer des PDFs, ou 'execute_script' avec language='node' pour du JavaScript." };
          }
          const absolutePath = resolveAndValidatePath(filePath);
          if (!fs.existsSync(absolutePath)) throw new Error(`Le script ${filePath} n'existe pas.`);

          const { exec } = await import('child_process');

          return new Promise<any>((resolve) => {
            exec(`node "${absolutePath}"`, { cwd: path.dirname(absolutePath), timeout: 30000 }, (error, stdout, stderr) => {
              if (error) {
                resolve({ success: false, error: error.message, stderr, code: error.code });
              } else {
                resolve({ success: true, stdout, stderr });
              }
            });
          });
        }
      }
    ];

    if (localTools.length > 0) {
      tools.push({
        functionDeclarations: localTools.map(t => ({
          name: t.name,
          description: t.description,
          parameters: t.parameters
        }))
      });
    }

    const genConfig: any = {
      temperature: config.temperature || 0.2, // Use user config or default
      topP: config.topP || 1.0,
      topK: config.topK || 1,
      maxOutputTokens: config.maxOutputTokens || 65536,
      thinkingLevel: config.thinkingLevel || 'high', // ENABLE THINKING
      maxThoughtTokens: config.maxThoughtTokens || 4096,
      systemInstruction: config.systemInstruction || `Tu es un agent autonome expert en mode Cowork.
Ton objectif est d'aider l'utilisateur à réaliser des tâches concrètes.

### ENVIRONNEMENT TECHNIQUE :
- **Node.js UNIQUEMENT** : Cet environnement ne dispose QUE de Node.js. Python N'EST PAS installé et ne sera JAMAIS disponible.
- **Outils natifs** : Tu disposes d'outils intégrés puissants. Utilise-les au lieu d'écrire des scripts :
  - 'create_pdf' : Génère directement un PDF structuré (titre, sections, listes). C'est l'outil à utiliser pour TOUT besoin de PDF.
  - 'write_file' : Crée des fichiers texte, JSON, HTML, CSV, etc.
  - 'release_file' : Upload un fichier et génère un lien de téléchargement public.
  - 'execute_script' : Exécute un script Node.js (PAS Python).

### RÈGLES CRITIQUES :
1. **POUR CRÉER UN PDF** : Utilise TOUJOURS l'outil 'create_pdf'. N'essaie JAMAIS d'écrire un script Python avec reportlab/fpdf. Ça ne marchera pas.
2. **CHEMINS** : Tous les fichiers doivent être créés dans '/tmp/' (ex: '/tmp/rapport.pdf').
3. **LIVRAISON** : Après avoir créé un fichier, utilise TOUJOURS 'release_file' pour obtenir un lien de téléchargement et donne-le à l'utilisateur en Markdown : [Télécharger le fichier](url).
4. **ANTI-BOUCLE** : Si un outil échoue, NE retente PAS la même chose. Analyse l'erreur et change d'approche.
5. **HONNÊTETÉ** : Ne prétends JAMAIS avoir fait quelque chose que tu n'as pas fait. Si un outil échoue, dis-le clairement.`,
      tools
    };

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    headersSent = true;

    let contents = [...history, { role: 'user' as const, parts: [{ text: message }] }];
    let iterations = 0;
    const MAX_ITERATIONS = 15;

    // Anti-loop detection: track consecutive failures per tool
    const toolFailures: Record<string, number> = {};
    const MAX_TOOL_FAILURES = 2; // If same tool fails 2x, inject a warning to force different approach

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      log.info(`Cowork iteration ${iterations} for model ${modelId}`);

      const responseStream = await ai.models.generateContentStream({
        model: modelId,
        contents,
        config: genConfig
      });

      let turnContent = '';
      let turnThoughts = '';
      let functionCalls: any[] = [];
      let turnParts: any[] = [];

      for await (const chunk of responseStream) {
        const candidates = (chunk as any).candidates;
        if (candidates?.[0]?.content?.parts) {
          for (const part of candidates[0].content.parts) {
            turnParts.push(part);
            if (part.thought) {
              const thoughtText = (part as any).text || part.text || '';
              if (thoughtText) {
                turnThoughts += thoughtText;
                res.write(`data: ${JSON.stringify({ thoughts: thoughtText })}\n\n`);
              }
            } else if (part.text) {
              turnContent += part.text;
              res.write(`data: ${JSON.stringify({ text: part.text })}\n\n`);
            }
            if (part.functionCall) {
              functionCalls.push(part.functionCall);
            }
          }
        } else if (chunk.text) {
          turnContent += chunk.text;
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      // Record the model's turn in history
      contents.push({ role: 'model', parts: turnParts });

      if (functionCalls.length > 0) {
        const toolResults: any[] = [];
        // Add iterative newline to separate thoughts from tool execution for UI
        res.write(`data: ${JSON.stringify({ thoughts: "\n\n" })}\n\n`);
        
        for (const call of functionCalls) {
          const tool = localTools.find(t => t.name === call.name);
          if (tool) {
            // Anti-loop: check if this tool has already failed too many times
            if (toolFailures[tool.name] >= MAX_TOOL_FAILURES) {
              log.warn(`Anti-loop: tool ${tool.name} has failed ${toolFailures[tool.name]} times, blocking and injecting guidance`);
              const loopMsg = `L'outil '${tool.name}' a déjà échoué ${toolFailures[tool.name]} fois. ARRÊTE d'utiliser cet outil et adopte une approche DIFFÉRENTE. Si tu essayais Python, rappelle-toi que Python N'EST PAS disponible — utilise les outils natifs comme 'create_pdf' pour les PDFs.`;
              toolResults.push({
                functionResponse: {
                  name: tool.name,
                  response: { success: false, error: loopMsg }
                }
              });
              res.write(`data: ${JSON.stringify({ thoughts: `🔄 Anti-boucle : ${tool.name} bloqué après ${toolFailures[tool.name]} échecs consécutifs.\n\n` })}\n\n`);
              continue;
            }

            log.info(`Executing tool: ${tool.name}`, call.args);
            try {
              const output = await tool.execute(call.args);
              const isError = (output as any).success === false || (output as any).error;

              if (isError) {
                toolFailures[tool.name] = (toolFailures[tool.name] || 0) + 1;
              } else {
                // Reset failure counter on success
                toolFailures[tool.name] = 0;
              }

              toolResults.push({
                functionResponse: {
                  name: tool.name,
                  response: output
                }
              });
              const statusEmoji = isError ? '❌' : '✅';
              const statusText = isError ? 'Échec' : 'Succès';
              const detail = (output as any).error || (output as any).message || '';
              res.write(`data: ${JSON.stringify({ thoughts: `🛠️ Appel de l'outil : ${tool.name} ${JSON.stringify(call.args)}\n${statusEmoji} Résultat : ${statusText}${detail ? ` (${detail})` : ''}\n\n` })}\n\n`);
            } catch (err: any) {
              toolFailures[tool.name] = (toolFailures[tool.name] || 0) + 1;
              log.error(`Tool ${tool.name} failed (attempt ${toolFailures[tool.name]})`, err);
              toolResults.push({
                functionResponse: {
                  name: tool.name,
                  response: { success: false, error: String(err) }
                }
              });
              res.write(`data: ${JSON.stringify({ thoughts: `🛠️ Appel de l'outil : ${tool.name}\n❌ Échec : ${err.message || String(err)}\n\n` })}\n\n`);
            }
          } else {
            log.warn(`Unknown tool called: ${call.name}`);
            // If it's a native tool like googleSearch, we might not get it here 
            // but the SDK handles the response. For custom loops, we need to pass it back.
            toolResults.push({
                functionResponse: {
                  name: call.name,
                  response: { error: "Outil non supporté dans la boucle locale." }
                }
            });
          }
        }
        
        if (toolResults.length > 0) {
          contents.push({ role: 'user', parts: toolResults });
          // If we are at the last iteration and tools were called, we give one MORE turn 
          // to let the model summarize the results, otherwise it stops abruptly.
          if (iterations >= MAX_ITERATIONS) {
             log.warn("MAX_ITERATIONS reached but tools were called. Allowing one final summary turn.");
             // We don't increment iterations here, just let it run one more time
             // but we must break AFTER this next turn to avoid infinite loops
             const finalResponse = await ai.models.generateContent({
                model: modelId,
                contents,
                config: { ...genConfig, tools: [] } // Disable tools for the very last turn
             });
             const summaryText = finalResponse.text || "Tâche terminée (limite d'itérations reached).";
             res.write(`data: ${JSON.stringify({ text: summaryText })}\n\n`);
             break;
          }
          continue; // Next iteration with tool results
        }
      }

      break;
    }

    res.end();
  } catch (error) {
    log.error("Cowork error", error);
    if (!headersSent) {
      res.status(500).json({ error: "Cowork failed", message: String(error) });
    } else {
      res.write(`data: ${JSON.stringify({ error: String(error) })}\n\n`);
      res.end();
    }
  }
});

// SPA Fallback
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
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
  // Always return JSON for API routes
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
