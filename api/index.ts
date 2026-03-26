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

const LEGACY_COWORK_SYSTEM_INSTRUCTION = "Tu es un agent autonome en mode Cowork. Tu as acces a des outils pour accomplir des taches complexes. Analyse, propose et execute.";
const MAX_PREVIEW_CHARS = 420;
const MAX_ACTIVITY_ITEMS = 80;
const MAX_WEB_FETCH_CHARS = 7000;

function buildCoworkSystemInstruction(
  userInstruction?: string,
  capabilities: { webSearch: boolean; executeScript: boolean } = { webSearch: true, executeScript: true }
): string {
  const baseInstruction = `Tu es un agent autonome expert en mode Cowork.
Ton objectif est d'aider l'utilisateur a realiser des taches concretes avec une execution visible, progressive et honnete.

### ENVIRONNEMENT TECHNIQUE :
- Node.js UNIQUEMENT : cet environnement ne dispose QUE de Node.js. Python n'est PAS installe et ne sera jamais disponible.
- Ta sortie finale doit rester propre. Pour parler de ce que tu fais pendant l'execution, utilise l'outil 'report_progress' au lieu de polluer la reponse finale.
- Outils locaux toujours disponibles :
  - 'report_progress' : annonce ce que tu fais, ce que tu as appris, ou ce que tu vas faire ensuite.
  - 'list_files', 'list_recursive', 'read_file', 'write_file'
  - 'create_pdf' : a utiliser pour tout besoin de PDF
  - 'release_file' : publie un fichier apres creation
${capabilities.executeScript ? "- 'execute_script' : execute un script Node.js si c'est vraiment necessaire.\n" : ""}${capabilities.webSearch ? `- 'web_search' : effectue des recherches web visibles et repetables
- 'web_fetch' : ouvre une URL pour lire une source precise\n` : ""}
### COMPORTEMENT ATTENDU :
1. Commence les taches non triviales par 'report_progress' pour annoncer ton plan immediat.
2. Si la demande concerne des informations fraiches, ouvertes, comparatives, de la documentation, une version, une actualite, un briefing ou des recommandations, tu dois effectuer plusieurs recherches ciblees AVANT de conclure.${capabilities.webSearch ? "\n3. Pour ces demandes web, fais plusieurs 'web_search' avec des angles differents puis au moins un 'web_fetch' sur une source pertinente avant la synthese finale." : ""}
4. Quand tu pivotes, bloques, ou changes de strategie, annonce-le via 'report_progress'.
5. N'utilise pas la reponse finale pour raconter ce que tu es en train de faire. La reponse finale sert a livrer le resultat.

### REGLES CRITIQUES :
1. Pour creer un PDF : utilise TOUJOURS 'create_pdf'. N'essaie JAMAIS d'ecrire un script Python avec reportlab/fpdf.
2. Chemins : tous les fichiers generes doivent etre crees dans '/tmp/'.
3. Livraison : apres avoir cree un fichier, utilise TOUJOURS 'release_file' puis donne le lien Markdown final.
4. Anti-boucle : si un outil echoue, ne retente pas la meme chose en boucle. Analyse l'erreur et change d'approche.
5. Honnetete : ne pretends jamais avoir fait quelque chose que tu n'as pas fait.`;

  const trimmedInstruction = userInstruction?.trim();
  if (!trimmedInstruction || trimmedInstruction === LEGACY_COWORK_SYSTEM_INSTRUCTION) {
    return baseInstruction;
  }

  return `${baseInstruction}

### CONSIGNES SUPPLEMENTAIRES :
${trimmedInstruction}`;
}

function buildCoworkFallbackMessage(releasedFile: { url: string; path?: string } | null): string | null {
  if (!releasedFile?.url) return null;
  const fileName = releasedFile.path ? path.basename(releasedFile.path) : 'le-fichier';
  return `Voici votre fichier : [Telecharger ${fileName}](${releasedFile.url})`;
}

function normalizeCoworkText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function requestNeedsDownloadableArtifact(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  if (/\b(pdf|document|rapport|attestation|presentation|telecharger|telecharge)\b/.test(normalized)) {
    return true;
  }

  const artifactVerb = /\b(cree|creer|genere|generer|fabrique|fabriquer|produis|produire|fournis|fournir|exporte|exporter|prepare|preparer)\b/;
  const genericArtifactNoun = /\b(fichier|document)\b/;
  return artifactVerb.test(normalized) && genericArtifactNoun.test(normalized);
}

function requestNeedsPdf(message: string): boolean {
  return /\bpdf\b/.test(normalizeCoworkText(message));
}

function buildArtifactCompletionPrompt(
  originalMessage: string,
  createdArtifactPath: string | null,
  releasedFile: { url: string; path?: string } | null
): string | null {
  if (!requestNeedsDownloadableArtifact(originalMessage) || releasedFile?.url) {
    return null;
  }

  const nextStep = createdArtifactPath
    ? `Le fichier semble deja etre cree ici: '${createdArtifactPath}'. Utilise maintenant 'release_file' avec ce chemin, puis reponds uniquement avec le lien Markdown final.`
    : requestNeedsPdf(originalMessage)
      ? "Tu n'as pas encore cree ni livre le PDF demande. Utilise maintenant 'create_pdf', puis 'release_file', puis reponds uniquement avec le lien Markdown final."
      : "Tu n'as pas encore livre le fichier demande. Cree-le si necessaire, utilise 'release_file', puis reponds uniquement avec le lien Markdown final.";

  return `La tache n'est PAS terminee.
L'utilisateur a explicitement demande un fichier telechargeable.
Demande originale: "${originalMessage}"
${nextStep}
Ne refais pas tout le resume si tu l'as deja donne. Termine la livraison du fichier.`;
}

function clipText(value: unknown, max = MAX_PREVIEW_CHARS): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}... [tronque]` : text;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHtmlTitle(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return stripHtml(match?.[1] || '');
}

function normalizeSearchResultUrl(rawUrl: string): string {
  try {
    const expanded = rawUrl.startsWith('//') ? `https:${rawUrl}` : rawUrl;
    const url = new URL(expanded);
    const redirected = url.searchParams.get('uddg');
    return redirected ? decodeURIComponent(redirected) : expanded;
  } catch {
    return rawUrl;
  }
}

function requestNeedsDeepResearch(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(latest|recent|today|aujourd'hui|actu|actualite|news|briefing|rapport|compar|compare|comparatif|documentation|docs?|version|release|sortie|mise a jour|update|benchmark|sota|state of the art|qui est devant|rumeur|roadmap|guide)\b/.test(normalized);
}

function buildResearchCompletionPrompt(
  originalMessage: string,
  stats: { webSearches: number; webFetches: number }
): string | null {
  if (!requestNeedsDeepResearch(originalMessage)) return null;
  if (stats.webSearches >= 2 && stats.webFetches >= 1) return null;

  const remainingSearches = Math.max(0, 2 - stats.webSearches);
  const needsFetch = stats.webFetches < 1;
  const instructions: string[] = [];

  if (remainingSearches > 0) {
    instructions.push(`Fais encore ${remainingSearches} recherche(s) 'web_search' avec des angles differents.`);
  }
  if (needsFetch) {
    instructions.push("Ouvre ensuite au moins une source pertinente via 'web_fetch'.");
  }

  return `La recherche visible est encore insuffisante pour repondre proprement.
Demande originale: "${originalMessage}"
Tu n'as pas encore assez explore le sujet. ${instructions.join(' ')}
Utilise aussi 'report_progress' pour annoncer ce que tu verifies, puis seulement ensuite redige la synthese finale.`;
}

async function searchWeb(query: string, maxResults = 5) {
  if (process.env.TAVILY_API_KEY) {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`
      },
      body: JSON.stringify({
        query,
        max_results: Math.min(maxResults, 8),
        search_depth: 'advanced',
        include_answer: false,
        include_raw_content: false
      })
    });
    if (!response.ok) {
      throw new Error(`Tavily a renvoye ${response.status}`);
    }
    const data: any = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];
    return results.slice(0, maxResults).map((result: any) => ({
      title: clipText(result.title || result.url || 'Sans titre', 140),
      url: result.url,
      snippet: clipText(result.content || result.snippet || '', 240),
      source: 'tavily'
    }));
  }

  const response = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`DuckDuckGo a renvoye ${response.status}`);
  }

  const html = await response.text();
  const anchorRegex = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const results: Array<{ title: string; url: string; snippet: string; source: string }> = [];
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) && results.length < maxResults) {
    const url = normalizeSearchResultUrl(match[1]);
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);

    const windowHtml = html.slice(match.index, match.index + 2000);
    const snippetMatch = windowHtml.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/i);
    const title = stripHtml(match[2]);
    const snippet = stripHtml(snippetMatch?.[1] || '');

    results.push({
      title: clipText(title || url, 140),
      url,
      snippet: clipText(snippet, 240),
      source: 'duckduckgo'
    });
  }

  if (results.length === 0) {
    throw new Error("Aucun resultat exploitable trouve via le fallback public.");
  }

  return results;
}

async function fetchReadableUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL invalide: ${url}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`Schema non supporte: ${parsed.protocol}`);
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5'
  };

  const direct = await fetch(parsed.toString(), { headers, redirect: 'follow' });
  if (!direct.ok) {
    throw new Error(`Impossible de lire ${parsed.toString()} (${direct.status})`);
  }

  const contentType = direct.headers.get('content-type') || '';
  const rawText = await direct.text();
  let title = '';
  let content = '';

  if (contentType.includes('text/html')) {
    title = extractHtmlTitle(rawText);
    content = stripHtml(rawText);
  } else {
    title = parsed.hostname;
    content = rawText.replace(/\s+/g, ' ').trim();
  }

  if (content.length < 240) {
    try {
      const fallbackUrl = `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
      const fallback = await fetch(fallbackUrl, { headers });
      if (fallback.ok) {
        const fallbackText = (await fallback.text()).replace(/\s+/g, ' ').trim();
        if (fallbackText.length > content.length) {
          content = fallbackText;
        }
      }
    } catch (error) {
      log.debug('Jina fallback fetch skipped', error);
    }
  }

  return {
    url: parsed.toString(),
    title: clipText(title || parsed.hostname, 160),
    content: clipText(content, MAX_WEB_FETCH_CHARS),
    excerpt: clipText(content, 320),
    source: contentType.includes('text/html') ? 'direct-html' : 'direct-text'
  };
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
  const emitEvent = (type: string, payload: Record<string, unknown> = {}) => {
    if (!headersSent) return;
    res.write(`data: ${JSON.stringify({ type, timestamp: Date.now(), ...payload })}\n\n`);
  };
  try {
    const { message, history, config } = ChatSchema.parse(req.body);

    // Model ID mapping
    let modelId = config.model;
    if (modelId.includes('gemini-1.5')) modelId = modelId.replace('1.5', '3.1');
    if (modelId === 'gemini-3.1-pro') modelId = 'gemini-3.1-pro-preview';
    if (modelId === 'gemini-3.1-flash') modelId = 'gemini-3.1-flash-lite-preview';
    if (!modelId) modelId = "gemini-3.1-pro-preview";

    const ai = createGoogleAI(modelId);

    const webSearchEnabled = config.googleSearch !== false;
    const executeScriptEnabled = config.codeExecution !== false;

    const formatToolArgsPreview = (args: unknown) => clipText(args, 260);
    const formatToolMeta = (toolName: string, args: any) => {
      if (toolName === 'web_search') {
        return { query: clipText(args?.query || '', 140), maxResults: Number(args?.maxResults || 5) };
      }
      if (toolName === 'web_fetch') {
        return { url: clipText(args?.url || '', 180) };
      }
      if (toolName === 'report_progress') {
        return {
          stage: clipText(args?.stage || '', 80),
          nextAction: clipText(args?.nextAction || '', 120)
        };
      }
      return undefined;
    };
    const formatToolResultPreview = (toolName: string, output: any) => {
      if (toolName === 'web_search') {
        const results = Array.isArray(output?.results) ? output.results : [];
        const summary = results
          .slice(0, 3)
          .map((result: any, index: number) => `${index + 1}. ${clipText(result.title || result.url || 'Sans titre', 80)}`)
          .join(' | ');
        return summary || clipText(output?.message || output?.error || '', 220);
      }
      if (toolName === 'web_fetch') {
        return clipText(output?.excerpt || output?.content || output?.message || output?.error || '', 240);
      }
      return clipText(output?.message || output?.error || output, 240);
    };

    const localTools = [
      {
        name: "report_progress",
        description: "Annonce l'etape courante, ce qui a ete compris, ou ce qui va etre fait ensuite. Utilise cet outil pour parler pendant l'execution sans polluer la reponse finale.",
        parameters: {
          type: "object",
          properties: {
            stage: { type: "string", description: "Nom court de l'etape (ex: Recherche, Analyse, Livraison)." },
            message: { type: "string", description: "Ce que tu es en train de faire ou ce que tu viens d'apprendre." },
            nextAction: { type: "string", description: "Prochaine action prevue." }
          },
          required: ["message"]
        },
        execute: ({ stage, message, nextAction }: { stage?: string; message: string; nextAction?: string }) => ({
          success: true,
          stage: stage || 'Progression',
          message,
          nextAction: nextAction || null
        })
      },
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
      ...(webSearchEnabled ? [{
        name: "web_search",
        description: "Recherche le web et renvoie une liste concise de resultats (titre, URL, extrait). Utilise cet outil plusieurs fois avec des angles differents si le sujet est ouvert ou d'actualite.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Requete de recherche precise." },
            maxResults: { type: "number", description: "Nombre maximum de resultats a renvoyer (1-8)." }
          },
          required: ["query"]
        },
        execute: async ({ query, maxResults }: { query: string; maxResults?: number }) => {
          const results = await searchWeb(query, Math.max(1, Math.min(maxResults || 5, 8)));
          return {
            success: true,
            query,
            results,
            message: `${results.length} resultat(s) trouves pour "${query}".`
          };
        }
      }, {
        name: "web_fetch",
        description: "Ouvre une URL et renvoie son titre et son contenu nettoye. A utiliser apres 'web_search' pour lire une source precise.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL complete a ouvrir." }
          },
          required: ["url"]
        },
        execute: async ({ url }: { url: string }) => {
          const page = await fetchReadableUrl(url);
          return {
            success: true,
            ...page,
            message: `Source lue avec succes: ${page.title}`
          };
        }
      }] : []),
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
      ...(executeScriptEnabled ? [{
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
      }] : [])
    ];

    const tools = localTools.length > 0 ? [{
      functionDeclarations: localTools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters
      }))
    }] : undefined;

    const genConfig: any = {
      temperature: config.temperature || 0.2, // Use user config or default
      topP: config.topP || 1.0,
      topK: config.topK || 1,
      maxOutputTokens: config.maxOutputTokens || 65536,
      thinkingLevel: config.thinkingLevel || 'high', // ENABLE THINKING
      maxThoughtTokens: config.maxThoughtTokens || 4096,
      systemInstruction: buildCoworkSystemInstruction(config.systemInstruction, {
        webSearch: webSearchEnabled,
        executeScript: executeScriptEnabled
      })
    };
    if (tools) genConfig.tools = tools;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    headersSent = true;

    let contents = [...history, { role: 'user' as const, parts: [{ text: message }] }];
    let iterations = 0;
    const MAX_ITERATIONS = 15;
    let finalVisibleText = '';
    let latestReleasedFile: { url: string; path?: string } | null = null;
    let latestCreatedArtifactPath: string | null = null;
    let artifactCompletionNudges = 0;
    const MAX_ARTIFACT_COMPLETION_NUDGES = 2;
    let researchCompletionNudges = 0;
    const MAX_RESEARCH_COMPLETION_NUDGES = 2;

    // Anti-loop detection: track consecutive failures per tool
    const toolFailures: Record<string, number> = {};
    const MAX_TOOL_FAILURES = 2; // If same tool fails 2x, inject a warning to force different approach
    const runMeta = {
      iterations: 0,
      toolCalls: 0,
      webSearches: 0,
      webFetches: 0
    };

    emitEvent('status', {
      iteration: 0,
      title: 'Initialisation',
      message: 'Cowork prepare la tache et attend le premier tour du modele.',
      runState: 'running',
      runMeta
    });

    while (iterations < MAX_ITERATIONS) {
      iterations++;
      log.info(`Cowork iteration ${iterations} for model ${modelId}`);
      runMeta.iterations = Math.max(runMeta.iterations, iterations);
      emitEvent('status', {
        iteration: iterations,
        title: `Iteration ${iterations}`,
        message: iterations === 1 ? "Analyse initiale de la demande." : "Cowork poursuit l'execution.",
        runState: 'running',
        runMeta
      });

      const response = await retryWithBackoff(() => ai.models.generateContent({
        model: modelId,
        contents,
        config: genConfig
      }));

      const modelTurn = (response as any)?.candidates?.[0]?.content;
      const turnParts: any[] = modelTurn?.parts
        ? [...modelTurn.parts]
        : response.text
          ? [{ text: response.text }]
          : [];
      const functionCalls: any[] = [];
      for (const part of turnParts) {
        if (part.functionCall) {
          functionCalls.push(part.functionCall);
        }
      }
      const hasFunctionCalls = functionCalls.length > 0;
      let iterationVisibleText = '';

      for (const part of turnParts) {
        if (part.thought) {
          const thoughtText = (part as any).text || part.text || '';
          if (thoughtText) {
            emitEvent('thought', { iteration: iterations, text: thoughtText });
          }
          continue;
        }

        if (part.text) {
          if (hasFunctionCalls) {
            emitEvent('narration', {
              iteration: iterations,
              message: clipText(part.text, 900)
            });
          } else {
            iterationVisibleText += part.text;
          }
        }
      }

      // Record the exact model turn so Vertex keeps the original thoughtSignature.
      contents.push({
        role: modelTurn?.role || 'model',
        parts: turnParts
      });

      if (functionCalls.length > 0) {
        const toolResults: any[] = [];

        for (const call of functionCalls) {
          const tool = localTools.find(t => t.name === call.name);
          if (tool) {
            if (tool.name === 'report_progress') {
              const output = await tool.execute(call.args);
              toolResults.push({
                functionResponse: {
                  ...(call.id ? { id: call.id } : {}),
                  name: tool.name,
                  response: output
                }
              });
              toolFailures[tool.name] = 0;
              emitEvent('narration', {
                iteration: iterations,
                title: clipText(output.stage || 'Progression', 80),
                message: clipText(
                  [output.message, output.nextAction ? `Ensuite: ${output.nextAction}` : '']
                    .filter(Boolean)
                    .join(' '),
                  900
                )
              });
              continue;
            }

            runMeta.toolCalls += 1;
            if (tool.name === 'web_search') runMeta.webSearches += 1;
            if (tool.name === 'web_fetch') runMeta.webFetches += 1;

            // Anti-loop: check if this tool has already failed too many times
            if (toolFailures[tool.name] >= MAX_TOOL_FAILURES) {
              log.warn(`Anti-loop: tool ${tool.name} has failed ${toolFailures[tool.name]} times, blocking and injecting guidance`);
              const loopMsg = `L'outil '${tool.name}' a deja echoue ${toolFailures[tool.name]} fois. Arrete de l'utiliser et adopte une approche differente. Si tu essayais Python, rappelle-toi que Python n'est pas disponible.`;
              toolResults.push({
                functionResponse: {
                  ...(call.id ? { id: call.id } : {}),
                  name: tool.name,
                  response: { success: false, error: loopMsg }
                }
              });
              emitEvent('warning', {
                iteration: iterations,
                title: 'Anti-boucle',
                message: `L'outil ${tool.name} est bloque apres ${toolFailures[tool.name]} echecs consecutifs.`,
                toolName: tool.name,
                runMeta
              });
              continue;
            }

            log.info(`Executing tool: ${tool.name}`, call.args);
            emitEvent('tool_call', {
              iteration: iterations,
              toolName: tool.name,
              argsPreview: formatToolArgsPreview(call.args),
              meta: formatToolMeta(tool.name, call.args),
              runMeta
            });
            try {
              const output = await tool.execute(call.args);
              const isError = (output as any).success === false || (output as any).error;
              if (!isError && tool.name === 'release_file' && typeof (output as any).url === 'string') {
                latestReleasedFile = {
                  url: (output as any).url,
                  path: typeof (call.args as any)?.path === 'string' ? (call.args as any).path : undefined
                };
              }
              if (!isError) {
                if (tool.name === 'create_pdf' && typeof (output as any).path === 'string') {
                  latestCreatedArtifactPath = (output as any).path;
                } else if (tool.name === 'write_file' && typeof (call.args as any)?.path === 'string') {
                  latestCreatedArtifactPath = (call.args as any).path;
                }
              }

              if (isError) {
                toolFailures[tool.name] = (toolFailures[tool.name] || 0) + 1;
              } else {
                // Reset failure counter on success
                toolFailures[tool.name] = 0;
              }

              toolResults.push({
                functionResponse: {
                  ...(call.id ? { id: call.id } : {}),
                  name: tool.name,
                  response: output
                }
              });
              emitEvent('tool_result', {
                iteration: iterations,
                toolName: tool.name,
                status: isError ? 'error' : 'success',
                resultPreview: formatToolResultPreview(tool.name, output),
                meta: formatToolMeta(tool.name, call.args),
                runMeta
              });
            } catch (err: any) {
              toolFailures[tool.name] = (toolFailures[tool.name] || 0) + 1;
              log.error(`Tool ${tool.name} failed (attempt ${toolFailures[tool.name]})`, err);
              toolResults.push({
                functionResponse: {
                  ...(call.id ? { id: call.id } : {}),
                  name: tool.name,
                  response: { success: false, error: String(err) }
                }
              });
              emitEvent('tool_result', {
                iteration: iterations,
                toolName: tool.name,
                status: 'error',
                resultPreview: clipText(err.message || String(err), 240),
                meta: formatToolMeta(tool.name, call.args),
                runMeta
              });
            }
          } else {
            log.warn(`Unknown tool called: ${call.name}`);
            toolResults.push({
              functionResponse: {
                ...(call.id ? { id: call.id } : {}),
                name: call.name,
                response: { error: "Outil non supporte dans la boucle locale." }
              }
            });
            emitEvent('warning', {
              iteration: iterations,
              title: 'Outil inconnu',
              message: `Le modele a demande l'outil ${call.name}, qui n'est pas supporte dans la boucle locale.`,
              toolName: call.name
            });
          }
        }

        if (toolResults.length > 0) {
          contents.push({ role: 'user', parts: toolResults });
          // If we are at the last iteration and tools were called, we give one MORE turn 
          // to let the model summarize the results, otherwise it stops abruptly.
          if (iterations >= MAX_ITERATIONS) {
            log.warn("MAX_ITERATIONS reached but tools were called. Allowing one final summary turn.");
            emitEvent('warning', {
              iteration: iterations,
              title: 'Limite d iterations',
              message: "Cowork atteint sa limite d'iterations et force un dernier tour de synthese."
            });
            const finalResponse = await retryWithBackoff(() => ai.models.generateContent({
              model: modelId,
              contents,
              config: { ...genConfig, tools: [] }
            }));
            const summaryText = finalResponse.text || "Tache terminee (limite d'iterations atteinte).";
            finalVisibleText += summaryText;
            emitEvent('text_delta', { iteration: iterations, text: summaryText });
            break;
          }
          continue; // Next iteration with tool results
        }
      }

      const researchCompletionPrompt =
        webSearchEnabled && researchCompletionNudges < MAX_RESEARCH_COMPLETION_NUDGES
          ? buildResearchCompletionPrompt(message, runMeta)
          : null;
      if (researchCompletionPrompt) {
        researchCompletionNudges++;
        log.warn(`Cowork research follow-up ${researchCompletionNudges}: more visible research required.`);
        emitEvent('warning', {
          iteration: iterations,
          title: 'Recherche insuffisante',
          message: "Cowork doit encore effectuer des recherches visibles avant de conclure.",
          runMeta
        });
        contents.push({
          role: 'user',
          parts: [{ text: researchCompletionPrompt }]
        });
        continue;
      }

      const artifactCompletionPrompt = buildArtifactCompletionPrompt(
        message,
        latestCreatedArtifactPath,
        latestReleasedFile
      );
      if (artifactCompletionPrompt && artifactCompletionNudges < MAX_ARTIFACT_COMPLETION_NUDGES) {
        artifactCompletionNudges++;
        log.warn(`Cowork artifact follow-up ${artifactCompletionNudges}: file requested but not yet delivered.`);
        emitEvent('warning', {
          iteration: iterations,
          title: 'Livraison incomplete',
          message: "Le fichier demande n'a pas encore ete livre. Relance guidee de l'agent...",
          runMeta
        });
        contents.push({
          role: 'user',
          parts: [{ text: artifactCompletionPrompt }]
        });
        continue;
      }

      if (iterationVisibleText) {
        finalVisibleText += iterationVisibleText;
        emitEvent('text_delta', { iteration: iterations, text: iterationVisibleText });
      }
      break;
    }

    if (!finalVisibleText.trim()) {
      const fallbackMessage = buildCoworkFallbackMessage(latestReleasedFile);
      if (fallbackMessage) {
        finalVisibleText = fallbackMessage;
        emitEvent('text_delta', { iteration: iterations, text: fallbackMessage });
      }
    }

    emitEvent('done', {
      iteration: iterations,
      runState: 'completed',
      runMeta
    });
    res.end();
  } catch (error) {
    log.error("Cowork error", error);
    const cleanError = parseApiError(error);
    if (!headersSent) {
      res.status(500).json({ error: "Cowork failed", message: cleanError });
    } else {
      emitEvent('error', { message: cleanError, runState: 'failed' });
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
