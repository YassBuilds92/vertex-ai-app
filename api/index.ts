import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
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
  sessionId: z.string().optional(),
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
  clientContext: z.object({
    locale: z.string().optional(),
    timeZone: z.string().optional(),
    nowIso: z.string().optional().nullable(),
  }).optional(),
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
const LONG_CONTEXT_THRESHOLD_TOKENS = 200_000;
const USD_TO_EUR_RATE = 0.866626; // ECB reference rate on 2026-03-26: 1 EUR = 1.1539 USD.

const MODEL_PRICING_USD_PER_1M: Record<string, {
  input: { standard: number; longContext: number };
  output: { standard: number; longContext: number };
}> = {
  'gemini-3.1-pro-preview': {
    input: { standard: 2, longContext: 4 },
    output: { standard: 12, longContext: 18 }
  },
  'gemini-3.1-flash-lite-preview': {
    input: { standard: 0.25, longContext: 0.25 },
    output: { standard: 1.5, longContext: 1.5 }
  },
  'gemini-3-flash-preview': {
    input: { standard: 0.5, longContext: 0.5 },
    output: { standard: 3, longContext: 3 }
  },
  'gemini-3-pro-preview': {
    input: { standard: 2, longContext: 4 },
    output: { standard: 12, longContext: 18 }
  }
};

type ClientContext = {
  locale?: string;
  timeZone?: string;
  nowIso?: string | null;
};

type RequestClock = {
  now: Date;
  locale: string;
  timeZone: string;
  absoluteDateTimeLabel: string;
  dateLabel: string;
  footerDateLabel: string;
  searchDateLabel: string;
  yearLabel: string;
};

type ResearchTargets = {
  webSearches: number;
  webFetches: number;
};

type PdfQualityTargets = {
  minSections: number;
  minWords: number;
  formalDocument?: boolean;
  requireInventedDetails?: boolean;
};

type PdfSectionInput = {
  heading?: string;
  body?: string | null;
};

type NormalizedPdfSection = {
  heading?: string;
  body: string;
};

type PdfDraftSnapshot = {
  title: string;
  subtitle: string;
  summary: string;
  author: string;
  sections: NormalizedPdfSection[];
  sources: string[];
};

type PdfDraftReview = {
  success: true;
  ready: boolean;
  score: number;
  signature: string;
  totalWords: number;
  sectionCount: number;
  blockingIssues: string[];
  improvements: string[];
  strengths: string[];
  message: string;
};

type CoworkRunMeta = {
  iterations: number;
  modelCalls: number;
  toolCalls: number;
  webSearches: number;
  webFetches: number;
  validatedSearches: number;
  degradedSearches: number;
  blockedQueryFamilies: number;
  validatedSources: number;
  blockerCount: number;
  retryCount: number;
  queueWaitMs: number;
  phase: string;
  completionScore: number;
  modelCompletionScore: number;
  taskComplete: boolean;
  inputTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  toolUseTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  estimatedCostEur: number;
};

type UsageTotals = {
  promptTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  toolUseTokens: number;
  totalTokens: number;
};

type RetryKind = 'quota' | 'concurrency' | 'server';

type RetryOptions = {
  maxRetries?: number;
  baseDelayMs?: number;
  exactDelaysMs?: number[];
  jitter?: boolean;
  onRetry?: (context: {
    attempt: number;
    maxRetries: number;
    delayMs: number;
    kind: RetryKind;
    message: string;
  }) => void | Promise<void>;
};

type CoworkRunGate = {
  active: boolean;
  queue: Array<() => void>;
};

const coworkRunGates = new Map<string, CoworkRunGate>();

function createEmptyCoworkRunMeta(): CoworkRunMeta {
  return {
    iterations: 0,
    modelCalls: 0,
    toolCalls: 0,
    webSearches: 0,
    webFetches: 0,
    validatedSearches: 0,
    degradedSearches: 0,
    blockedQueryFamilies: 0,
    validatedSources: 0,
    blockerCount: 0,
    retryCount: 0,
    queueWaitMs: 0,
    phase: 'analysis',
    completionScore: 0,
    modelCompletionScore: 0,
    taskComplete: false,
    inputTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    toolUseTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    estimatedCostEur: 0
  };
}

function clampPercentage(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalizeCoworkPhase(value?: string | null): CoworkPhase {
  const normalized = normalizeCoworkText(value || '');
  if (normalized.includes('research') || normalized.includes('recherche')) return 'research';
  if (normalized.includes('verif')) return 'verification';
  if (normalized.includes('prod') || normalized.includes('redaction') || normalized.includes('draft')) return 'production';
  if (normalized.includes('livr') || normalized.includes('deliv')) return 'delivery';
  if (normalized.includes('complete') || normalized.includes('termine')) return 'completed';
  return 'analysis';
}

function createEmptyCoworkSessionState(): CoworkSessionState {
  return {
    factsCollected: [],
    sourcesValidated: [],
    searchesFailed: [],
    toolsBlocked: [],
    phase: 'analysis',
    modelCompletionScore: 0,
    completionScore: 0,
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    blockers: [],
    consecutiveDegradedSearches: {},
    cooldowns: {},
    lastReasoning: null,
    reasoningReady: false,
    pendingFinalAnswer: false,
  };
}

function getCooldownDelayMs(attempts: number): number {
  const ladder = [2000, 4000, 8000, 16000];
  return ladder[Math.max(0, Math.min(ladder.length - 1, attempts - 1))];
}

function dedupeStrings(values: string[], max = 8): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = clipText(value, 220)?.trim();
    if (!trimmed) continue;
    const key = normalizeCoworkText(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
    if (result.length >= max) break;
  }
  return result;
}

function roundMetric(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

function extractUsageTotals(response: any): UsageTotals {
  const usage = response?.usageMetadata;
  const promptTokens = Number(usage?.promptTokenCount || 0);
  const outputTokens = Number(usage?.candidatesTokenCount || 0);
  const thoughtTokens = Number(usage?.thoughtsTokenCount || 0);
  const toolUseTokens = Number(usage?.toolUsePromptTokenCount || 0);
  const totalTokens = Number(
    usage?.totalTokenCount
      || promptTokens + outputTokens + thoughtTokens + toolUseTokens
  );

  return {
    promptTokens,
    outputTokens,
    thoughtTokens,
    toolUseTokens,
    totalTokens
  };
}

function getModelPricing(modelId: string) {
  return MODEL_PRICING_USD_PER_1M[modelId] || MODEL_PRICING_USD_PER_1M['gemini-3.1-pro-preview'];
}

function estimateUsageCost(modelId: string, usage: UsageTotals) {
  const pricing = getModelPricing(modelId);
  const longContext = usage.promptTokens > LONG_CONTEXT_THRESHOLD_TOKENS;
  const inputRate = longContext ? pricing.input.longContext : pricing.input.standard;
  const outputRate = longContext ? pricing.output.longContext : pricing.output.standard;
  const billableInputTokens = usage.promptTokens + usage.toolUseTokens;
  const billableOutputTokens = usage.outputTokens + usage.thoughtTokens;
  const usd =
    (billableInputTokens / 1_000_000) * inputRate
    + (billableOutputTokens / 1_000_000) * outputRate;
  const eur = usd * USD_TO_EUR_RATE;

  return {
    usd: roundMetric(usd),
    eur: roundMetric(eur)
  };
}

function accumulateUsageTotals(runMeta: CoworkRunMeta, modelId: string, response: any) {
  const usage = extractUsageTotals(response);
  const cost = estimateUsageCost(modelId, usage);

  runMeta.modelCalls += 1;
  runMeta.inputTokens += usage.promptTokens;
  runMeta.outputTokens += usage.outputTokens;
  runMeta.thoughtTokens += usage.thoughtTokens;
  runMeta.toolUseTokens += usage.toolUseTokens;
  runMeta.totalTokens += usage.totalTokens;
  runMeta.estimatedCostUsd = roundMetric(runMeta.estimatedCostUsd + cost.usd);
  runMeta.estimatedCostEur = roundMetric(runMeta.estimatedCostEur + cost.eur);
}

async function acquireCoworkRunGate(key: string): Promise<{ waitMs: number; release: () => void }> {
  let gate = coworkRunGates.get(key);
  if (!gate) {
    gate = { active: false, queue: [] };
    coworkRunGates.set(key, gate);
  }

  const waitStartedAt = Date.now();
  if (gate.active) {
    await new Promise<void>((resolve) => {
      gate!.queue.push(resolve);
    });
  }

  gate.active = true;

  return {
    waitMs: Date.now() - waitStartedAt,
    release: () => {
      const current = coworkRunGates.get(key);
      if (!current) return;
      const next = current.queue.shift();
      if (next) {
        next();
        return;
      }
      current.active = false;
      coworkRunGates.delete(key);
    }
  };
}

function formatWaitDuration(delayMs: number): string {
  if (delayMs >= 60_000) return `${(delayMs / 60_000).toFixed(1)} min`;
  return `${(delayMs / 1000).toFixed(delayMs >= 10_000 ? 0 : 1)} s`;
}

function sanitizeLocale(value?: string): string {
  if (!value) return 'fr-FR';
  try {
    new Intl.DateTimeFormat(value).format(new Date());
    return value;
  } catch {
    return 'fr-FR';
  }
}

function sanitizeTimeZone(value?: string): string {
  if (!value) return 'Europe/Paris';
  try {
    new Intl.DateTimeFormat('fr-FR', { timeZone: value }).format(new Date());
    return value;
  } catch {
    return 'Europe/Paris';
  }
}

function formatInTimeZone(
  now: Date,
  locale: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions
): string {
  try {
    return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(now);
  } catch {
    return new Intl.DateTimeFormat('fr-FR', { ...options, timeZone: 'Europe/Paris' }).format(now);
  }
}

function resolveRequestClock(clientContext?: ClientContext): RequestClock {
  const locale = sanitizeLocale(clientContext?.locale);
  const timeZone = sanitizeTimeZone(clientContext?.timeZone);
  const parsedNow = clientContext?.nowIso ? new Date(clientContext.nowIso) : null;
  const now = parsedNow && !Number.isNaN(parsedNow.getTime()) ? parsedNow : new Date();

  return {
    now,
    locale,
    timeZone,
    absoluteDateTimeLabel: formatInTimeZone(now, 'fr-FR', timeZone, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    dateLabel: formatInTimeZone(now, 'fr-FR', timeZone, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    footerDateLabel: formatInTimeZone(now, 'fr-FR', timeZone, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    searchDateLabel: formatInTimeZone(now, 'fr-FR', timeZone, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    yearLabel: formatInTimeZone(now, 'en-US', timeZone, {
      year: 'numeric',
    }),
  };
}

function buildCoworkSystemInstruction(
  userInstruction?: string,
  capabilities: { webSearch: boolean; executeScript: boolean } = { webSearch: true, executeScript: true },
  runtime?: { originalMessage?: string; requestClock?: RequestClock }
): string {
  const originalMessage = runtime?.originalMessage || '';
  const requestClock = runtime?.requestClock;
  const researchTargets = originalMessage ? getResearchTargets(originalMessage) : null;
  const pdfTargets = originalMessage ? getPdfQualityTargets(originalMessage) : null;
  const requestSpecificDirectives: string[] = [];

  if (originalMessage && requestNeedsDeepResearch(originalMessage) && researchTargets) {
    requestSpecificDirectives.push(
      `Pour CETTE demande, vise au minimum ${researchTargets.webSearches} recherche(s) web visibles et ${researchTargets.webFetches} lecture(s) de source avant de conclure, sauf blocage web total.`
    );
  }
  if (originalMessage && requestNeedsGroundedWriting(originalMessage)) {
    requestSpecificDirectives.push(
      "Avant toute production creative finale, suis explicitement ce schema: hypotheses -> recherches -> verification -> redaction. Ne saute jamais directement de la premiere recherche a l'ecriture finale."
    );
    requestSpecificDirectives.push(
      "Si le sujet porte sur un terme court, ambigu, un mot d'argot ou une reference culturelle, ne cherche jamais le mot seul. Contextualise la requete (langue, pays, domaine, usage) puis ouvre au moins une source avec 'web_fetch' avant d'ecrire."
    );
    requestSpecificDirectives.push(
      "Tant que la recherche visible n'est pas suffisante, n'ecris pas de paroles finales, meme partielles. Utilise d'abord 'report_progress', puis accumule des recherches et des sources."
    );
  }
  if (originalMessage && requestNeedsStrictFactualSearch(originalMessage)) {
    requestSpecificDirectives.push(
      "Pour cette demande factuelle sensible, une recherche degradee, hors sujet ou transitoirement indisponible ne compte pas comme preuve. Ne la presente jamais comme un succes net."
    );
    requestSpecificDirectives.push(
      "Il est interdit de conclure sur ce sujet sans au moins une source lue via 'web_fetch', sauf si tu expliques explicitement que la recherche est restee insuffisante."
    );
    requestSpecificDirectives.push(
      "Repeter une requete quasi identique n'est pas un progres. Si un angle est faible, pivote vraiment: autre formulation, source directe, outil specialise, ou constat d'insuffisance."
    );
  }
  if (originalMessage && requestNeedsTopicalCreativeResearch(originalMessage)) {
    requestSpecificDirectives.push(
      "Comme cette demande creative vise une personne, une affaire ou un sujet possiblement lie a l'actu, commence par cartographier le contexte recent: faits, dates, reactions, accusations/defenses et points de desaccord, avant d'ecrire."
    );
  }
  if (originalMessage && requestNeedsMusicCatalogResearch(originalMessage)) {
    requestSpecificDirectives.push(
      "Pour un artiste, une discographie ou des titres manquants, appelle d'abord l'outil 'music_catalog_lookup' avec le pseudo exact tel qu'ecrit par l'utilisateur, y compris chiffres et variantes de casse."
    );
    requestSpecificDirectives.push(
      "Ne conclus jamais qu'un artiste est introuvable apres une seule requete generique. Si 'music_catalog_lookup' revient partiel ou incertain, relance immediatement avec l'alias exact puis avec des angles plateformes/sources (YouTube, Spotify, Deezer, Genius, Apple Music, TrackMusik, etc.), puis ouvre au moins une page artiste via 'web_fetch'."
    );
    requestSpecificDirectives.push(
      "Tu n'as le droit d'affirmer 'voila tout ce qu'il te manque' que si la couverture est suffisante. Sinon, dis explicitement que la liste est partielle et separe bien: deja possedes, manquants confirmes, titres d'album, feats/freestyles optionnels, points incertains."
    );
  }
  if (originalMessage && requestNeedsFormalDocument(originalMessage)) {
    requestSpecificDirectives.push(
      "Pour ce document formel, ne livre jamais un seul pave de texte. Structure le contenu en plusieurs blocs distincts et lisibles: identification/en-tete, corps redige, puis validation finale (date, lieu, signature, cachet ou mentions equivalentes)."
    );
    requestSpecificDirectives.push(
      requestNeedsFictionalDetails(originalMessage)
        ? "Comme le document est demande comme fictif, invente des noms, dates, entreprise, contexte et signataire credibles. N'utilise pas de placeholders entre crochets sauf si l'utilisateur demande explicitement un modele vierge."
        : "Si des informations manquent, isole-les proprement dans une mention finale ou une courte liste de champs a completer, sans laisser tout le document sous forme de gabarit brut."
    );
  }
  if (pdfTargets) {
    requestSpecificDirectives.push(
      pdfTargets.formalDocument
        ? `Pour CETTE demande documentaire, vise au minimum ${pdfTargets.minSections} blocs utiles et environ ${pdfTargets.minWords} mots de contenu reel avant 'create_pdf'. Le rendu doit ressembler a un vrai document officiel, pas a un rapport generique.`
        : `Pour CETTE demande PDF, le livrable doit etre dense et soigne: couverture, resume executif, developpement structure, conclusion et sources. Vise au moins ${pdfTargets.minSections} sections utiles et environ ${pdfTargets.minWords} mots de contenu reel avant 'create_pdf'.`
    );
    requestSpecificDirectives.push(
      "Avant tout export PDF final sur cette demande, fais une passe explicite de self-review avec 'review_pdf_draft', corrige ses points bloquants, puis seulement apres appelle 'create_pdf'."
    );
    requestSpecificDirectives.push(
      pdfTargets.formalDocument
        ? "Quand tu appelles 'create_pdf' pour ce document formel, utilise plusieurs sections courtes et propres (en-tete, objet ou attestation, details, signatures/mentions finales) et garde un ton administratif."
        : "Quand tu appelles 'create_pdf', renseigne aussi 'subtitle', 'summary', 'accentColor', 'author' et 'sources' quand c'est pertinent."
    );
  }

  const baseInstruction = `Tu es un agent autonome expert en mode Cowork.
Ton objectif est d'aider l'utilisateur a realiser des taches concretes avec une execution visible, progressive et honnete.

### ENVIRONNEMENT TECHNIQUE :
- Node.js UNIQUEMENT : cet environnement ne dispose QUE de Node.js. Python n'est PAS installe et ne sera jamais disponible.
- Ta sortie finale doit rester propre. Pour parler de ce que tu fais pendant l'execution, utilise l'outil 'report_progress' au lieu de polluer la reponse finale.
- Outils locaux toujours disponibles :
  - 'report_progress' : ETAPE OBLIGATOIRE avant tout outil actionnable. Tu dois y fournir exactement: 'what_i_know', 'what_i_need', 'why_this_tool', 'expected_result', 'fallback_plan', puis 'completion.score', 'completion.taskComplete' et 'completion.phase'.
  - 'list_files', 'list_recursive', 'read_file', 'write_file'
  - 'review_pdf_draft' : critique un brouillon PDF avant export et dit s'il est pret
  - 'create_pdf' : a utiliser pour tout besoin de PDF
  - 'release_file' : publie un fichier apres creation
${capabilities.executeScript ? "- 'execute_script' : execute un script Node.js si c'est vraiment necessaire.\n" : ""}${capabilities.webSearch ? `- 'web_search' : effectue des recherches web visibles et repetables
- 'web_fetch' : ouvre une URL pour lire une source precise\n` : ""}
### COMPORTEMENT ATTENDU :
1. Commence chaque tour utile par 'report_progress'. Le backend refuse les tours sans raisonnement structure quand une action reste necessaire.
2. Si l'utilisateur te demande de te documenter, de verifier, de prendre ton temps, ou de produire un contenu creatif base sur un terme, un contexte culturel ou de l'argot, tu dois suivre: plan -> recherche -> verification -> production.
3. Tu n'as droit qu'a UN SEUL outil actionnable par tour modele. Si tu dois agir, fais d'abord 'report_progress', puis choisis un seul outil parmi 'web_search', 'web_fetch', 'music_catalog_lookup', 'review_pdf_draft', 'create_pdf', 'release_file', etc.
4. Si la demande concerne des informations fraiches, ouvertes, comparatives, de la documentation, une version, une actualite, un briefing ou des recommandations, tu dois effectuer plusieurs recherches ciblees AVANT de conclure.${capabilities.webSearch ? "\n5. Pour ces demandes web, fais plusieurs 'web_search' avec des angles differents puis au moins un 'web_fetch' de qualite 'full' sur une source pertinente avant la synthese finale.\n   Si tu dois comprendre un terme ambigu, ajoute du contexte dans la requete (langue, pays, domaine, usage) au lieu de chercher le mot brut seul.\n   Si 'web_search' echoue ou reste faible, bascule immediatement vers plusieurs 'web_fetch' sur des pages fiables (page d'accueil, live, RSS, documentation officielle)." : ""}
6. Quand tu pivotes, bloques, ou changes de strategie, annonce-le via 'report_progress'.
7. Dans 'completion.score', indique ton estimation de completude en pourcentage. Mets 'completion.taskComplete' a true uniquement si tu penses pouvoir livrer MAINTENANT sans autre outil.
8. N'utilise pas la reponse finale pour raconter ce que tu es en train de faire. La reponse finale sert a livrer le resultat.

### REPERES TEMPORELS :
${requestClock
  ? `- Date et heure de reference: ${requestClock.absoluteDateTimeLabel} (${requestClock.timeZone})
- Quand l'utilisateur dit "aujourd'hui", "du jour", "today" ou "latest", cela signifie: ${requestClock.dateLabel}.
- N'invente jamais une date ancienne par defaut. Si une source ou une requete mentionne une autre date, compare-la explicitement a ${requestClock.dateLabel}.`
  : "- Si la demande parle de 'today', 'aujourd'hui' ou 'latest', utilise la date courante exacte de l'environnement et dis-la explicitement."}

### REGLES CRITIQUES :
1. Pour creer un PDF : utilise TOUJOURS 'create_pdf'. N'essaie JAMAIS d'ecrire un script Python avec reportlab/fpdf.
2. Chemins : tous les fichiers generes doivent etre crees dans '/tmp/'.
3. Livraison : apres avoir cree un fichier, utilise TOUJOURS 'release_file' puis donne le lien Markdown final.
4. Anti-boucle : si un outil echoue, ne retente pas la meme chose en boucle. Analyse l'erreur et change d'approche.
5. N'utilise JAMAIS 'write_file' pour fabriquer un faux fichier '.pdf'. Pour un PDF, utilise uniquement 'create_pdf'.
6. Honnetete : ne pretends jamais avoir fait quelque chose que tu n'as pas fait.
7. Pour un PDF presentable, soigne la structure et la mise en page. Un PDF "beau" ou "long" ne doit jamais etre une simple page brute.
8. Pour un PDF exigeant, un document formel, une demande "soignee" ou "parfaite", tu dois passer par 'review_pdf_draft' AVANT 'create_pdf'. Si la review dit que le brouillon n'est pas pret, corrige-le puis relance la review.
9. Pour une attestation, un certificat ou une lettre, vise un rendu de document officiel: sobre, coherent et complet. Si le document est demande comme fictif ou complet, n'utilise pas de placeholders entre crochets.${requestSpecificDirectives.length > 0 ? `\n\n### DIRECTIVES POUR CETTE DEMANDE :\n- ${requestSpecificDirectives.join('\n- ')}` : ''}`;

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

export const __coworkPdfInternals = {
  requestNeedsFormalDocument,
  requestNeedsFictionalDetails,
  requestNeedsPdfArtifact,
  requestNeedsPdfSelfReview,
  getPdfQualityTargets,
  buildPdfDraftSnapshot,
  reviewPdfDraft,
  countTemplatePlaceholders,
  countFormalDocumentSignals
};

export const __coworkLoopInternals = {
  createEmptyCoworkSessionState,
  computeCompletionState,
  buildBlockerPrompt,
  getDirectSourceFallbacks,
  getCooldownDelayMs,
  normalizeCoworkPhase,
};

function normalizeCoworkText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function requestAsksForWriting(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(punchline|punchlines|rap|texte|paroles|lyrics|son|couplet|refrain|ecris|ecrire|redige|rediger|genere|generer|compose|composer|freestyle|topline)\b/.test(normalized);
}

function requestMentionsResearchIntent(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(documente(?:\s|-)?toi|documente|renseigne(?:\s|-)?toi|renseigne|verifie|verification|verifier|cherche|chercher|recherche|rechercher|creuse|creuser|fouille|fouiller|investigue|investiguer|analyse|analyser|etudie|etudier|apprends?(?:\s+sur)?|informe(?:\s|-)?toi|informe|sources?|references?|contexte|signification|definition|veut dire|argot|slang|terme|expression|autour de lui|autour d'elle|autour d'eux|ce qui se dit|tout ce qu(?:['\u2019])il y a autour|tout ce qu(?:['\u2019])il y a sur lui|tout ce qu(?:['\u2019])il y a sur elle)\b/.test(normalized);
}

function requestNeedsTopicalCreativeResearch(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  const asksForWriting = requestAsksForWriting(message);
  if (!asksForWriting) return false;

  const recentContextSignals =
    requestIsCurrentAffairs(message)
    || requestNeedsCurrentDateGrounding(message)
    || /\b(affaire|dossier|proces|tribunal|justice|plainte|accusation|accuse|polemique|controverse|buzz|reaction|reactions|suite a|en ce moment|du moment)\b/.test(normalized);
  const stanceVerbPattern = /\b(defendre|defense|soutenir|soutien|plaider|plaidoyer|repondre a|reponds a|reponds|clasher|clashe|attaque|attaquer|denoncer|denonce|charger|charge)\b/;
  const looksLikeConcreteExternalSubject =
    /\b(?:defendre|soutenir|plaider(?:\s+pour)?|repondre a|reponds a|clasher|clashe|attaquer|attaque|denoncer|denonce|charger|charge)\s+(?!mon\b|ma\b|mes\b|ton\b|ta\b|tes\b|notre\b|nos\b|votre\b|vos\b|leur\b|leurs\b|le\b|la\b|les\b|un\b|une\b|des\b|du\b|de la\b|de l(?:['\u2019])|ce\b|cet\b|cette\b|ces\b|moi\b|toi\b|nous\b|vous\b)[a-z0-9'.\u2019-][a-z0-9'.\u2019-]*(?:\s+[a-z0-9'.\u2019-][a-z0-9'.\u2019-]*){0,5}\b/.test(normalized);

  return recentContextSignals || (stanceVerbPattern.test(normalized) && looksLikeConcreteExternalSubject);
}

function requestNeedsGroundedWriting(message: string): boolean {
  return requestAsksForWriting(message)
    && (
      requestMentionsResearchIntent(message)
      || requestNeedsTopicalCreativeResearch(message)
    );
}

function requestNeedsMusicCatalogResearch(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  const mentionsMusicEntity =
    /\b(artiste|artist|rappeur|rapper|chanteur|chanteuse|groupe|musique|music|rap|album|albums|ep|mixtape|single|singles|titre|titres|track|tracks|son|sons|morceau|morceaux|chanson|chansons|discographie|discography|freestyle|planete rap|spotify|deezer|apple music|youtube|genius)\b/.test(normalized);
  const wantsCatalog =
    /\b(discographie|discography|catalogue|catalog|liste|listing|complet|complete|complets|completes|tous|toutes|manque|manquent|manquants|sorties|repertoire|discog)\b/.test(normalized)
    || normalized.includes("ceux qu'il me manque")
    || normalized.includes("tout ce qu'il me manque")
    || normalized.includes("je les veux tous");
  return mentionsMusicEntity && wantsCatalog;
}

function requestNeedsStrictFactualSearch(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return requestNeedsCurrentDateGrounding(message)
    || requestNeedsGroundedWriting(message)
    || /\b(proces|tribunal|justice|plainte|plaignant|plaignante|accusation|accuse|accusee|condamn|verdict|jugement|cour|mandat|arret|prison|viol|agression|police|avocat|extrad|detention)\b/.test(normalized)
    || /\b(documentation|docs?|version|release|sortie|mise a jour|update|benchmark|compar|compare|comparatif|roadmap|api|sdk|modele|model)\b/.test(normalized);
}

function requestIsCurrentAffairs(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(actualite|actu|news|briefing|headline|presse|monde|international|france|breaking)\b/.test(normalized);
}

function requestNeedsCurrentDateGrounding(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(today|aujourd'hui|du jour|ce jour|latest|recent|recente|recentes|dernier|derniere|dernieres|maintenant|en ce moment)\b/.test(normalized)
    || requestIsCurrentAffairs(message);
}

function extractRequestedSearchCount(message: string): number | null {
  const normalized = normalizeCoworkText(message);
  const match = normalized.match(/\b(\d{1,2})\s+(?:recherche|recherches|search|searches)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.max(1, Math.min(value, 12));
}

function requestNeedsLongFormPdf(message: string): boolean {
  if (!requestNeedsPdf(message)) return false;
  const normalized = normalizeCoworkText(message);
  if (/\b(attestation|certificat)\b/.test(normalized)) return false;
  return /\b(tres long|tres longue|long|longue|detaille|detaillee|complet|complete|magnifique|beau|soigne|rapport|briefing|analyse|dossier|actu|actualite|news)\b/.test(normalized);
}

function requestNeedsFormalDocument(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(attestation|certificat|lettre|courrier|declaration|convention|contrat|devis|facture)\b/.test(normalized);
}

function requestNeedsFictionalDetails(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(fictif|fictive|fictionnel|fictionnelle|imaginaire|invente|inventee|simule|simulee|faux|fausse)\b/.test(normalized);
}

function requestNeedsPdfArtifact(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  if (requestNeedsPdf(message) || requestNeedsFormalDocument(message)) return true;
  return /\b(presentation|brochure|plaquette|cv)\b/.test(normalized);
}

function getResearchTargets(message: string): ResearchTargets {
  const normalized = normalizeCoworkText(message);
  const targets: ResearchTargets = { webSearches: 2, webFetches: 1 };

  if (!requestNeedsDeepResearch(message)) {
    const explicitSearchCount = extractRequestedSearchCount(message);
    if (explicitSearchCount) {
      targets.webSearches = explicitSearchCount;
      targets.webFetches = explicitSearchCount >= 6 ? 2 : 1;
    }
    return targets;
  }

  if (requestIsCurrentAffairs(message) || requestNeedsCurrentDateGrounding(message)) {
    targets.webSearches = Math.max(targets.webSearches, 4);
    targets.webFetches = Math.max(targets.webFetches, 2);
  }

  if (requestNeedsStrictFactualSearch(message)) {
    targets.webSearches = Math.max(targets.webSearches, 3);
    targets.webFetches = Math.max(targets.webFetches, 1);
  }

  if (requestNeedsGroundedWriting(message)) {
    targets.webSearches = Math.max(targets.webSearches, 3);
    targets.webFetches = Math.max(targets.webFetches, 2);
  }

  if (requestNeedsTopicalCreativeResearch(message)) {
    targets.webSearches = Math.max(targets.webSearches, 4);
    targets.webFetches = Math.max(targets.webFetches, 2);
  }

  if (requestNeedsMusicCatalogResearch(message)) {
    targets.webSearches = Math.max(targets.webSearches, 3);
    targets.webFetches = Math.max(targets.webFetches, 2);
  }

  if (requestNeedsLongFormPdf(message)) {
    targets.webSearches = Math.max(targets.webSearches, 5);
    targets.webFetches = Math.max(targets.webFetches, 2);
  }

  if (/\b(tres long|tres longue|ultra long|ultra longue|exhaustif|exhaustive|detaille|detaillee|complet|complete|magnifique|soigne|style)\b/.test(normalized) && requestNeedsPdf(message)) {
    targets.webSearches = Math.max(targets.webSearches, 6);
    targets.webFetches = Math.max(targets.webFetches, 3);
  }

  const explicitSearchCount = extractRequestedSearchCount(message);
  if (explicitSearchCount) {
    targets.webSearches = Math.max(targets.webSearches, explicitSearchCount);
    if (explicitSearchCount >= 6) {
      targets.webFetches = Math.max(targets.webFetches, 3);
    }
  }

  return targets;
}

function getPdfQualityTargets(message: string): PdfQualityTargets | null {
  if (!requestNeedsPdfArtifact(message)) return null;
  const normalized = normalizeCoworkText(message);
  const formalDocument = requestNeedsFormalDocument(message);
  const requireInventedDetails = requestNeedsFictionalDetails(message);
  if (/\btest\b/.test(normalized) && !requestNeedsLongFormPdf(message) && !requestIsCurrentAffairs(message) && !formalDocument) {
    return null;
  }

  let minSections = 0;
  let minWords = 0;

  if (formalDocument) {
    minSections = Math.max(minSections, 3);
    minWords = Math.max(minWords, requireInventedDetails ? 200 : 140);
  }

  if (requestIsCurrentAffairs(message) || /\b(rapport|briefing|analyse|dossier|synthese|compte rendu)\b/.test(normalized)) {
    minSections = Math.max(minSections, 6);
    minWords = Math.max(minWords, 900);
  }

  if (requestNeedsLongFormPdf(message)) {
    minSections = Math.max(minSections, 6);
    minWords = Math.max(minWords, 900);
  }

  if (/\b(tres long|tres longue|ultra long|ultra longue|exhaustif|exhaustive|detaille|detaillee|complet|complete|magnifique|soigne|style)\b/.test(normalized) && !/\btest\b/.test(normalized)) {
    minSections = Math.max(minSections, 8);
    minWords = Math.max(minWords, 1400);
  }

  return minSections > 0
    ? {
        minSections,
        minWords,
        formalDocument,
        requireInventedDetails
      }
    : null;
}

function requestNeedsPdfSelfReview(message: string): boolean {
  return Boolean(getPdfQualityTargets(message));
}

function normalizePdfSections(sections: PdfSectionInput[] | null | undefined): NormalizedPdfSection[] {
  return (Array.isArray(sections) ? sections : [])
    .filter(section => Boolean(section?.heading?.trim() || section?.body?.trim()))
    .map(section => ({
      heading: section.heading?.trim() || undefined,
      body: section.body?.trim() || ''
    }));
}

function normalizePdfSources(sources: string[] | null | undefined): string[] {
  return (Array.isArray(sources) ? sources : [])
    .map(source => source.trim())
    .filter(Boolean);
}

function buildPdfDraftSnapshot(input: {
  title?: string;
  subtitle?: string;
  summary?: string;
  author?: string;
  sections?: PdfSectionInput[] | null;
  sources?: string[] | null;
}): PdfDraftSnapshot {
  return {
    title: input.title?.trim() || '',
    subtitle: input.subtitle?.trim() || '',
    summary: input.summary?.trim() || '',
    author: input.author?.trim() || '',
    sections: normalizePdfSections(input.sections),
    sources: normalizePdfSources(input.sources)
  };
}

function buildPdfDraftCombinedContent(draft: PdfDraftSnapshot): string {
  return [
    draft.title,
    draft.subtitle,
    draft.summary,
    draft.author,
    ...draft.sections.flatMap(section => [section.heading || '', section.body]),
    ...draft.sources
  ].join(' ');
}

function buildPdfDraftSignature(draft: PdfDraftSnapshot): string {
  const payload = {
    title: draft.title,
    subtitle: draft.subtitle,
    summary: draft.summary,
    author: draft.author,
    sections: draft.sections.map(section => ({
      heading: section.heading || '',
      body: section.body
    })),
    sources: draft.sources
  };
  return createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

function reviewPdfDraft(
  message: string,
  draft: PdfDraftSnapshot,
  pdfQualityTargets: PdfQualityTargets | null
): PdfDraftReview {
  const combinedContent = buildPdfDraftCombinedContent(draft);
  const totalWords = countWords(combinedContent);
  const sectionCount = draft.sections.length;
  const blockingIssues: string[] = [];
  const improvements: string[] = [];
  const strengths: string[] = [];
  const formalDocument = Boolean(pdfQualityTargets?.formalDocument || requestNeedsFormalDocument(message));
  const requireInventedDetails = Boolean(pdfQualityTargets?.requireInventedDetails || requestNeedsFictionalDetails(message));

  if (!draft.title) {
    blockingIssues.push("ajoute un titre explicite et finalise");
  } else {
    strengths.push("titre principal defini");
  }

  if (sectionCount === 0) {
    blockingIssues.push("ajoute au moins une section utile");
  } else {
    strengths.push(`${sectionCount} bloc(s) present(s)`);
  }

  if (pdfQualityTargets && sectionCount < pdfQualityTargets.minSections) {
    blockingIssues.push(`passe de ${sectionCount} a au moins ${pdfQualityTargets.minSections} sections utiles`);
  }

  if (pdfQualityTargets && totalWords < pdfQualityTargets.minWords) {
    blockingIssues.push(`developpe le contenu jusqu'a environ ${pdfQualityTargets.minWords} mots (actuel: ${totalWords})`);
  } else if (totalWords > 0) {
    strengths.push(`${totalWords} mots de contenu reel`);
  }

  if (formalDocument) {
    const formalSignalCount = countFormalDocumentSignals(combinedContent);
    if (formalSignalCount < 4) {
      blockingIssues.push("renforce le caractere officiel avec emetteur, beneficiaire/sujet, periode/contexte et validation finale date/lieu/signature");
    } else {
      strengths.push("structure de document officiel detectee");
    }
  }

  if (requireInventedDetails) {
    const placeholderCount = countTemplatePlaceholders(combinedContent);
    if (placeholderCount > 0) {
      blockingIssues.push("remplace tous les placeholders par des details fictifs credibles");
    } else {
      strengths.push("aucun placeholder restant");
    }
  }

  if (!formalDocument && (requestNeedsLongFormPdf(message) || requestNeedsDeepResearch(message)) && !draft.summary) {
    blockingIssues.push("ajoute un resume executif clair avant le corps du PDF");
  } else if (!formalDocument && draft.summary) {
    strengths.push("resume executif present");
  }

  if (!formalDocument && (requestIsCurrentAffairs(message) || requestNeedsDeepResearch(message) || requestNeedsStrictFactualSearch(message)) && draft.sources.length === 0) {
    blockingIssues.push("ajoute au moins une source explicite pour soutenir le PDF");
  } else if (draft.sources.length > 0) {
    strengths.push(`${draft.sources.length} source(s) mentionnee(s)`);
  }

  const sectionWordCounts = draft.sections.map(section => countWords([section.heading || '', section.body].join(' ')));
  const largestSectionWords = sectionWordCounts.length > 0 ? Math.max(...sectionWordCounts) : 0;
  if (totalWords >= 300 && sectionCount > 1 && largestSectionWords / Math.max(totalWords, 1) > 0.72) {
    blockingIssues.push("reequilibre le document: un seul bloc porte encore presque tout le contenu");
  }

  const largeUntitledSections = draft.sections.filter(section => !section.heading && countWords(section.body) >= (formalDocument ? 32 : 80)).length;
  if (largeUntitledSections > 0) {
    improvements.push("ajoute des intertitres aux blocs encore trop massifs");
  }

  if (formalDocument && !draft.author) {
    improvements.push("precise un signataire ou une mention de signature si c'est coherent");
  }

  let score = 100;
  score -= Math.min(72, blockingIssues.length * 18);
  score -= Math.min(20, improvements.length * 5);
  score = Math.max(0, Math.min(100, score));

  const ready = blockingIssues.length === 0;
  const messageParts = ready
    ? [
        `Review PDF prete (${score}/100).`,
        strengths.length > 0 ? `Points forts: ${strengths.join(', ')}.` : '',
        improvements.length > 0 ? `Derniers plus possibles: ${improvements.join(', ')}.` : ''
      ]
    : [
        `Review PDF non prete (${score}/100).`,
        `Bloquants: ${blockingIssues.join('; ')}.`,
        improvements.length > 0 ? `Ameliorations secondaires: ${improvements.join(', ')}.` : ''
      ];

  return {
    success: true,
    ready,
    score,
    signature: buildPdfDraftSignature(draft),
    totalWords,
    sectionCount,
    blockingIssues,
    improvements,
    strengths,
    message: messageParts.filter(Boolean).join(' ')
  };
}

function countWords(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function normalizeHexColor(value: string | undefined, fallback = '#0f766e'): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return fallback;
}

const MONTH_NAME_PATTERN = '(?:janvier|fevrier|février|mars|avril|mai|juin|juillet|aout|août|septembre|octobre|novembre|decembre|décembre|january|february|march|april|may|june|july|august|september|october|november|december)';

function queryContainsExplicitDate(query: string): boolean {
  return new RegExp(`\\b\\d{1,2}\\s+${MONTH_NAME_PATTERN}\\s+\\d{4}\\b`, 'i').test(query)
    || new RegExp(`\\b${MONTH_NAME_PATTERN}\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'i').test(query)
    || /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(query)
    || /\b20\d{2}\b/.test(query);
}

function stripDateReferencesFromQuery(query: string): string {
  return query
    .replace(new RegExp(`\\b\\d{1,2}\\s+${MONTH_NAME_PATTERN}\\s+\\d{4}\\b`, 'gi'), ' ')
    .replace(new RegExp(`\\b${MONTH_NAME_PATTERN}\\s+\\d{1,2},?\\s+\\d{4}\\b`, 'gi'), ' ')
    .replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/g, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function alignSearchQueryWithRequest(query: string, originalMessage: string, requestClock: RequestClock): string {
  const baseQuery = query.trim();
  if (!baseQuery) return requestClock.searchDateLabel;
  if (!requestNeedsCurrentDateGrounding(originalMessage)) return baseQuery;

  let adjusted = baseQuery;
  const hadExplicitDate = queryContainsExplicitDate(adjusted);
  if (hadExplicitDate) {
    adjusted = stripDateReferencesFromQuery(adjusted);
  }

  const normalizedAdjusted = normalizeCoworkText(adjusted);
  const normalizedDate = normalizeCoworkText(requestClock.searchDateLabel);
  const alreadyAnchoredToToday =
    normalizedAdjusted.includes(normalizedDate)
    || normalizedAdjusted.includes(requestClock.yearLabel)
    || /\b(today|aujourd'hui|du jour|latest|recent|dernier|derniere|dernieres)\b/.test(normalizedAdjusted);

  if (hadExplicitDate || !alreadyAnchoredToToday) {
    adjusted = `${adjusted} ${requestClock.searchDateLabel}`.trim();
  }

  return adjusted.replace(/\s+/g, ' ').trim();
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

function countTemplatePlaceholders(value: string): number {
  return value.match(/\[[^\]\n]{2,80}\]|<[^>\n]{2,80}>|_{4,}/g)?.length || 0;
}

function countFormalDocumentSignals(value: string): number {
  const normalized = normalizeCoworkText(value);
  const signals = [
    /\b(soussigne|certifie|atteste|declare|nous certifions|nous attestons)\b/,
    /\b(entreprise|societe|etablissement|organisme|employeur|tuteur|service)\b/,
    /\b(stage|stagiaire|etudiant|etudiante|beneficiaire|formation|mission|poste|bts)\b/,
    /\b(periode|du\s+\d{1,2}|debut|fin|au sein de|depuis le|jusqu'au|jusqu au)\b/,
    /\b(fait a|fait au|signature|cachet|responsable|directeur|gerant|gerante|rh)\b/
  ];
  return signals.reduce((count, pattern) => count + (pattern.test(normalized) ? 1 : 0), 0);
}

function buildArtifactCompletionPrompt(
  originalMessage: string,
  createdArtifactPath: string | null,
  releasedFile: { url: string; path?: string } | null
): string | null {
  if (!requestNeedsDownloadableArtifact(originalMessage) || releasedFile?.url) {
    return null;
  }

  const needsPdfArtifact = requestNeedsPdfArtifact(originalMessage);
  const requiresPdfSelfReview = requestNeedsPdfSelfReview(originalMessage);
  const nextStep = createdArtifactPath
    ? `Le fichier semble deja etre cree ici: '${createdArtifactPath}'. Utilise maintenant 'release_file' avec ce chemin, puis reponds uniquement avec le lien Markdown final.`
    : needsPdfArtifact
      ? (
          requiresPdfSelfReview
            ? "Tu n'as pas encore cree ni livre le document PDF demande. Fais d'abord 'review_pdf_draft' sur ton brouillon, corrige les points bloquants, puis utilise 'create_pdf', ensuite 'release_file', puis reponds uniquement avec le lien Markdown final."
            : "Tu n'as pas encore cree ni livre le document PDF demande. Utilise maintenant 'create_pdf', puis 'release_file', puis reponds uniquement avec le lien Markdown final."
        )
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
  return requestNeedsStrictFactualSearch(message)
    || requestNeedsGroundedWriting(message)
    || requestNeedsMusicCatalogResearch(message)
    || /\b(latest|recent|today|aujourd'hui|du jour|actu|actualite|news|briefing|rapport|compar|compare|comparatif|documentation|docs?|version|release|sortie|mise a jour|update|benchmark|sota|state of the art|qui est devant|rumeur|roadmap|guide|recherche|recherches|search|searches)\b/.test(normalized);
}

function hasSatisfiedResearchRequirements(
  originalMessage: string,
  stats: MusicResearchProgress
): boolean {
  if (!requestNeedsDeepResearch(originalMessage)) return true;
  if (
    requestNeedsMusicCatalogResearch(originalMessage)
    && stats.musicCatalogCoverage
    && stats.musicCatalogCoverage.distinctDomains >= 2
    && stats.musicCatalogCoverage.hasCatalogPage
    && stats.musicCatalogCoverage.hasAlbumTracklist
  ) {
    return true;
  }

  const targets = getResearchTargets(originalMessage);
  const explicitSearchCount = extractRequestedSearchCount(originalMessage);
  const enoughViaSearchAndRead =
    stats.webSearches >= targets.webSearches && stats.webFetches >= targets.webFetches;
  const enoughViaDirectSources =
    !explicitSearchCount && stats.webSearches === 0 && stats.webFetches >= Math.max(2, targets.webFetches);
  if (requestNeedsStrictFactualSearch(originalMessage) && stats.webFetches < 1) {
    return false;
  }
  return enoughViaSearchAndRead || enoughViaDirectSources;
}

function buildStrictResearchFailureMessage(
  originalMessage: string,
  stats: MusicResearchProgress,
  requestClock: RequestClock
): string | null {
  if (!requestNeedsStrictFactualSearch(originalMessage)) return null;
  if (hasSatisfiedResearchRequirements(originalMessage, stats)) return null;

  return `Je m'arrete proprement: la recherche reste insuffisamment fiable pour repondre a cette demande sensible.
Repere temporel: "aujourd'hui" = ${requestClock.dateLabel} (${requestClock.timeZone}).
Etat obtenu: ${stats.webSearches} recherche(s) validee(s), ${stats.webFetches} source(s) lisible(s), ${stats.degradedSearches} recherche(s) degradee(s), ${stats.blockedQueryFamilies} famille(s) de requetes bloquees.
Je prefere ne pas broder sans source lue suffisamment fiable.`;
}

function buildResearchCompletionPrompt(
  originalMessage: string,
  stats: MusicResearchProgress,
  requestClock: RequestClock
): string | null {
  if (!requestNeedsDeepResearch(originalMessage)) return null;
  if (hasSatisfiedResearchRequirements(originalMessage, stats)) return null;

  const targets = getResearchTargets(originalMessage);
  const remainingSearches = Math.max(0, targets.webSearches - stats.webSearches);
  const remainingFetches = Math.max(0, targets.webFetches - stats.webFetches);
  const instructions: string[] = [];

  if (requestNeedsMusicCatalogResearch(originalMessage) && !stats.musicCatalogCompleted) {
    instructions.push("Commence par 'music_catalog_lookup' pour resoudre l'artiste, les titres officiels, l'album et les feats eventuels.");
  }
  if (stats.webSearches === 0) {
    instructions.push("Si 'web_search' reste bloque, lis directement 2 sources pertinentes via 'web_fetch' (page d'accueil, live, flux RSS, documentation officielle).");
  } else if (remainingSearches > 0) {
    instructions.push(`Fais encore ${remainingSearches} recherche(s) 'web_search' avec des angles differents.`);
  }
  if (remainingFetches > 0) {
    instructions.push(`Lis encore ${remainingFetches} source(s) pertinente(s) via 'web_fetch'.`);
  } else if (stats.webSearches === 0 && stats.webFetches < 2) {
    instructions.push("Comme la recherche moteur est bloquee, ouvre encore une deuxieme source pertinente via 'web_fetch'.");
  }
  if (requestNeedsStrictFactualSearch(originalMessage) && stats.webFetches < 1) {
    instructions.push("Pour cette demande factuelle sensible, au moins une source lue via 'web_fetch' est obligatoire avant toute conclusion.");
  }
  if (requestNeedsGroundedWriting(originalMessage)) {
    instructions.push("Ne livre pas encore les paroles ou le texte final: termine d'abord la recherche visible puis seulement ensuite redige.");
  }
  instructions.push("Une recherche degradee, hors sujet ou transitoirement indisponible ne compte pas comme preuve.");
  instructions.push("Repeter une requete quasi identique n'est pas un progres: pivote vraiment d'angle, ouvre une source directe, ou admets que la recherche reste insuffisante.");

  return `La recherche visible est encore insuffisante pour repondre proprement.
Demande originale: "${originalMessage}"
Repere temporel: "aujourd'hui" = ${requestClock.dateLabel} (${requestClock.timeZone}).
Minimum attendu pour cette demande: ${targets.webSearches} recherche(s) visibles et ${targets.webFetches} lecture(s) de source.
Etat actuel: ${stats.webSearches} recherche(s) validee(s), ${stats.webFetches} lecture(s) fiable(s), ${stats.degradedSearches} recherche(s) degradee(s), ${stats.blockedQueryFamilies} famille(s) bloquee(s).
${stats.musicCatalogCoverage ? `Couverture musique actuelle: ${stats.musicCatalogCoverage.distinctDomains} domaine(s), page catalogue=${stats.musicCatalogCoverage.hasCatalogPage ? 'oui' : 'non'}, tracklist album=${stats.musicCatalogCoverage.hasAlbumTracklist ? 'oui' : 'non'}.` : ''}
Tu n'as pas encore assez explore le sujet. ${instructions.join(' ')}
Utilise aussi 'report_progress' pour annoncer ce que tu verifies, puis seulement ensuite redige la synthese finale.`;
}

function detectDirectSourceCategory(message: string): DirectSourceCategory {
  const normalized = normalizeCoworkText(message);
  if (/\b(sport|match|football|foot|ligue|ligue 1|champions league|nba|nfl|tennis|rugby|mercato)\b/.test(normalized)) {
    return 'sport';
  }
  if (/\b(economie|economique|marche|marches|bourse|finance|financier|business|inflation|taux|petrole|entreprise)\b/.test(normalized)) {
    return 'economy';
  }
  if (/\b(api|sdk|documentation|docs?|version|release|modele|model|vertex|gemini|google ai|developpeur|developer|tech|technologie)\b/.test(normalized)) {
    return 'tech_docs';
  }
  if (/\b(france|francais|francaise|paris|elysee|assemblee|matignon|municipales)\b/.test(normalized)) {
    return 'fr_news';
  }
  if (/\b(monde|international|iran|ukraine|israel|liban|g7|onu|europe|usa|etats unis)\b/.test(normalized)) {
    return 'intl_news';
  }
  return requestIsCurrentAffairs(message) ? 'fr_news' : 'general';
}

function getDirectSourceFallbacks(message: string): string[] {
  const category = detectDirectSourceCategory(message);
  return DIRECT_SOURCE_FALLBACKS[category] || DIRECT_SOURCE_FALLBACKS.general;
}

function parseReasoningPayload(args: any): CoworkReasoning | null {
  if (!args || typeof args !== 'object') return null;
  const completion = args.completion;
  if (!completion || typeof completion !== 'object') return null;
  const requiredFields = [
    'what_i_know',
    'what_i_need',
    'why_this_tool',
    'expected_result',
    'fallback_plan'
  ];
  const hasAll = requiredFields.every((field) => typeof args[field] === 'string' && args[field].trim().length > 0);
  if (!hasAll) return null;
  if (typeof completion.score !== 'number' || typeof completion.taskComplete !== 'boolean') return null;
  return {
    what_i_know: clipText(args.what_i_know, 500),
    what_i_need: clipText(args.what_i_need, 500),
    why_this_tool: clipText(args.why_this_tool, 500),
    expected_result: clipText(args.expected_result, 500),
    fallback_plan: clipText(args.fallback_plan, 500),
    completion: {
      score: clampPercentage(Number(completion.score || 0)),
      taskComplete: Boolean(completion.taskComplete),
      phase: normalizeCoworkPhase(String(completion.phase || 'analysis'))
    }
  };
}

function summarizeReasoning(reasoning: CoworkReasoning): string {
  return [
    `Je sais: ${reasoning.what_i_know}`,
    `Il manque: ${reasoning.what_i_need}`,
    `Pourquoi cet outil: ${reasoning.why_this_tool}`,
    `Attendu: ${reasoning.expected_result}`,
    `Plan B: ${reasoning.fallback_plan}`
  ].join('\n');
}

function computeCompletionState(options: CompletionComputationOptions): CoworkSessionState {
  const {
    originalMessage,
    state,
    research,
    latestCreatedArtifactPath,
    latestReleasedFile,
    latestApprovedPdfReviewSignature
  } = options;

  const nextState: CoworkSessionState = {
    ...state,
    factsCollected: [...state.factsCollected],
    sourcesValidated: [...state.sourcesValidated],
    searchesFailed: [...state.searchesFailed],
    toolsBlocked: [...state.toolsBlocked],
    blockers: [],
  };

  const blockers: CoworkBlocker[] = [];
  const targets = getResearchTargets(originalMessage);
  const fallbackUrls = getDirectSourceFallbacks(originalMessage);
  const explicitSearchCount = extractRequestedSearchCount(originalMessage);
  const hasValidatedSource = nextState.sourcesValidated.length > 0;
  const enoughResearchViaSearches =
    research.webSearches >= targets.webSearches && research.webFetches >= targets.webFetches;
  const enoughResearchViaDirectSources =
    !explicitSearchCount && research.webSearches === 0 && research.webFetches >= Math.max(2, targets.webFetches);

  if (!nextState.lastReasoning) {
    blockers.push({
      code: 'missing_reasoning',
      message: "Commence par 'report_progress' avec le raisonnement structure obligatoire avant d'agir.",
      hard: true,
    });
  }

  if (requestNeedsDeepResearch(originalMessage) && !(enoughResearchViaSearches || enoughResearchViaDirectSources)) {
    blockers.push({
      code: 'research_incomplete',
      message: `La recherche reste insuffisante: ${research.webSearches}/${targets.webSearches} recherche(s) validee(s), ${research.webFetches}/${targets.webFetches} source(s) validante(s).`,
      hard: true,
      fallbackUrls,
    });
  }

  if (requestNeedsStrictFactualSearch(originalMessage) && !hasValidatedSource) {
    blockers.push({
      code: 'strict_source_missing',
      message: "Au moins une source lue via 'web_fetch' avec qualite 'full' est obligatoire avant de conclure.",
      hard: true,
      fallbackUrls,
    });
  }

  if (requestNeedsPdfArtifact(originalMessage)) {
    if (requestNeedsPdfSelfReview(originalMessage) && !latestApprovedPdfReviewSignature) {
      blockers.push({
        code: 'pdf_review_required',
        message: "Le brouillon PDF n'a pas encore ete valide par 'review_pdf_draft'.",
        hard: true,
      });
    }
    if (!latestCreatedArtifactPath) {
      blockers.push({
        code: 'artifact_not_created',
        message: "Le fichier demande n'a pas encore ete cree.",
        hard: true,
      });
    }
    if (!latestReleasedFile?.url) {
      blockers.push({
        code: 'artifact_not_released',
        message: "Le fichier existe peut-etre, mais il n'a pas encore ete publie via 'release_file'.",
        hard: true,
      });
    }
  }

  const baseScore = requestNeedsDeepResearch(originalMessage)
    ? (
        Math.min(1, research.webSearches / Math.max(1, targets.webSearches)) * 30
        + Math.min(1, research.webFetches / Math.max(1, targets.webFetches)) * 30
        + Math.min(1, nextState.sourcesValidated.length / Math.max(1, requestNeedsStrictFactualSearch(originalMessage) ? 1 : 2)) * 15
      )
    : 55;
  const artifactScore = requestNeedsPdfArtifact(originalMessage)
    ? (latestApprovedPdfReviewSignature ? 10 : 0) + (latestCreatedArtifactPath ? 7 : 0) + (latestReleasedFile?.url ? 8 : 0)
    : 15;
  const blockerPenalty = blockers.reduce((sum, blocker) => sum + (blocker.hard ? 10 : 5), 0);
  nextState.completionScore = clampPercentage(Math.max(
    nextState.modelCompletionScore,
    baseScore + artifactScore - blockerPenalty
  ));
  nextState.blockers = blockers;
  nextState.effectiveTaskComplete = nextState.modelTaskComplete && blockers.length === 0;
  nextState.pendingFinalAnswer = nextState.effectiveTaskComplete;
  nextState.phase = nextState.effectiveTaskComplete ? 'completed' : nextState.phase;

  return nextState;
}

function buildBlockerPrompt(
  originalMessage: string,
  requestClock: RequestClock,
  state: CoworkSessionState
): string | null {
  if (state.blockers.length === 0) {
    if (state.pendingFinalAnswer) {
      return `La tache est maintenant consideree comme complete par le backend.
Demande originale: "${originalMessage}"
Tu as assez d'informations. Reponds maintenant proprement a l'utilisateur, sans appeler d'outil supplementaire.`;
    }
    return null;
  }

  const blockerLines = state.blockers.map((blocker, index) => {
    const fallback = blocker.fallbackUrls?.length
      ? ` Sources directes a privilegier: ${blocker.fallbackUrls.slice(0, 3).join(' | ')}.`
      : '';
    const wait = blocker.waitMs ? ` Attends encore ${formatWaitDuration(blocker.waitMs)} sur ce scope avant de retenter.` : '';
    return `${index + 1}. ${blocker.message}${fallback}${wait}`;
  }).join('\n');

  return `La tache n'est pas encore complete.
Demande originale: "${originalMessage}"
Repere temporel: "aujourd'hui" = ${requestClock.dateLabel} (${requestClock.timeZone}).
Etat backend: phase=${state.phase}, completion=${state.completionScore}%, modele=${state.modelCompletionScore}%, source(s) validee(s)=${state.sourcesValidated.length}.
Bloquants a lever:
${blockerLines}

Consigne obligatoire:
- Commence par 'report_progress' avec le schema structure complet.
- Si tu dois agir ensuite, choisis UN SEUL outil actionnable.
- Si la recherche moteur est bloquee, pivote vers 'web_fetch' sur une source directe au lieu de reformuler la meme requete.`;
}

function unwrapXmlValue(value: string): string {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function extractXmlTagValue(block: string, tagName: string): string {
  const match = block.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'));
  return stripHtml(unwrapXmlValue(match?.[1] || ''));
}

type SearchResultItem = {
  title: string;
  url: string;
  snippet: string;
  source: string;
};

type SearchQuality = 'relevant' | 'degraded' | 'off_topic' | 'transient_error';

type SearchOptions = {
  strictMusic?: boolean;
  strictFactual?: boolean;
};

type SearchAssessment = {
  quality: Exclude<SearchQuality, 'transient_error'>;
  bestScore: number;
  matchedAnchors: string[];
  matchedResults: number;
};

type SearchOutcome = {
  success: boolean;
  quality: SearchQuality;
  provider: string;
  results: SearchResultItem[];
  relevanceScore: number;
  matchedAnchors: string[];
  fallbackUsed: boolean;
  warnings: string[];
  error?: string;
  transient?: boolean;
};

type ReadableFetchQuality = 'full' | 'partial' | 'shell' | 'serp';

type ReadablePage = {
  url: string;
  title: string;
  content: string;
  rawContent: string;
  excerpt: string;
  source: string;
  quality: ReadableFetchQuality;
  domain: string;
  isSearchPage: boolean;
  isCatalogEvidence: boolean;
};

type MusicCatalogSourceKind = 'artist' | 'album' | 'tracklist' | 'video';

type MusicCatalogSource = {
  domain: string;
  url: string;
  kind: MusicCatalogSourceKind;
};

type MusicCatalogCoverage = {
  distinctDomains: number;
  hasCatalogPage: boolean;
  hasAlbumTracklist: boolean;
};

type MusicCatalogLookupResult = {
  success: boolean;
  recoverable?: boolean;
  artistQuery: string;
  resolvedArtist: string;
  ownedConfirmed: string[];
  missingConfirmed: string[];
  albumOnly: string[];
  optionalFeatures: string[];
  uncertain: string[];
  sources: MusicCatalogSource[];
  coverage: MusicCatalogCoverage;
  partial: boolean;
  message: string;
};

type MusicResearchProgress = {
  webSearches: number;
  webFetches: number;
  degradedSearches: number;
  blockedQueryFamilies: number;
  musicCatalogCompleted?: boolean;
  musicCatalogCoverage?: MusicCatalogCoverage | null;
};

type CoworkPhase =
  | 'analysis'
  | 'research'
  | 'verification'
  | 'production'
  | 'delivery'
  | 'completed';

type CoworkReasoning = {
  what_i_know: string;
  what_i_need: string;
  why_this_tool: string;
  expected_result: string;
  fallback_plan: string;
  completion: {
    score: number;
    taskComplete: boolean;
    phase: CoworkPhase;
  };
};

type CoworkValidatedSource = {
  url: string;
  domain: string;
  kind: 'web_fetch' | 'music_catalog_lookup';
};

type CoworkSearchFailure = {
  query: string;
  family: string;
  provider?: string;
  quality?: SearchQuality;
  transient?: boolean;
  reason: string;
};

type CoworkBlockedTool = {
  toolName: string;
  scope: string;
  reason: string;
  until?: number;
};

type CoworkBlocker = {
  code: string;
  message: string;
  hard?: boolean;
  fallbackUrls?: string[];
  waitMs?: number;
  scope?: string;
};

type ToolCooldownState = {
  attempts: number;
  until: number;
  reason: string;
};

type CoworkSessionState = {
  factsCollected: string[];
  sourcesValidated: CoworkValidatedSource[];
  searchesFailed: CoworkSearchFailure[];
  toolsBlocked: CoworkBlockedTool[];
  phase: CoworkPhase;
  modelCompletionScore: number;
  completionScore: number;
  modelTaskComplete: boolean;
  effectiveTaskComplete: boolean;
  blockers: CoworkBlocker[];
  consecutiveDegradedSearches: Record<string, number>;
  cooldowns: Record<string, ToolCooldownState>;
  lastReasoning: CoworkReasoning | null;
  reasoningReady: boolean;
  pendingFinalAnswer: boolean;
};

type CompletionComputationOptions = {
  originalMessage: string;
  requestClock: RequestClock;
  state: CoworkSessionState;
  research: MusicResearchProgress;
  latestCreatedArtifactPath: string | null;
  latestReleasedFile: { url: string; path?: string } | null;
  latestApprovedPdfReviewSignature: string | null;
};

type DirectSourceCategory =
  | 'fr_news'
  | 'intl_news'
  | 'economy'
  | 'tech_docs'
  | 'sport'
  | 'general';

const DIRECT_SOURCE_FALLBACKS: Record<DirectSourceCategory, string[]> = {
  fr_news: [
    'https://www.franceinfo.fr/',
    'https://www.lemonde.fr/',
    'https://www.france24.com/fr/'
  ],
  intl_news: [
    'https://www.reuters.com/world/',
    'https://www.bbc.com/news',
    'https://www.france24.com/en/'
  ],
  economy: [
    'https://www.reuters.com/business/',
    'https://www.lesechos.fr/',
    'https://www.boursorama.com/actualite-economique/'
  ],
  tech_docs: [
    'https://ai.google.dev/gemini-api/docs',
    'https://cloud.google.com/vertex-ai/generative-ai/docs',
    'https://developers.googleblog.com/'
  ],
  sport: [
    'https://www.lequipe.fr/',
    'https://www.bbc.com/sport',
    'https://www.eurosport.fr/'
  ],
  general: [
    'https://www.franceinfo.fr/',
    'https://www.reuters.com/',
    'https://www.bbc.com/news'
  ]
};

const MUSIC_PLATFORM_DOMAINS = [
  'music.apple.com',
  'youtube.com',
  'deezer.com',
  'qobuz.com',
  'spotify.com',
  'open.spotify.com',
  'trackmusik.fr',
  'genius.com',
  'nouvomonde.fr',
  'skyrock.fm',
  'facebook.com',
];

const MUSIC_JINA_DOMAINS = [
  'music.apple.com',
  'youtube.com',
  'deezer.com',
  'qobuz.com',
  'spotify.com',
  'open.spotify.com',
  'trackmusik.fr',
];

function stripWww(hostname: string): string {
  return hostname.replace(/^www\./i, '').toLowerCase();
}

function safeParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function getUrlDomain(value: string): string {
  return stripWww(safeParseUrl(value)?.hostname || '');
}

function domainMatches(domain: string, candidate: string): boolean {
  return domain === candidate || domain.endsWith(`.${candidate}`);
}

function isMusicPlatformDomain(domain: string): boolean {
  return MUSIC_PLATFORM_DOMAINS.some(candidate => domainMatches(domain, candidate));
}

function shouldPreferJinaForUrl(value: string): boolean {
  const domain = getUrlDomain(value);
  return MUSIC_JINA_DOMAINS.some(candidate => domainMatches(domain, candidate));
}

function isLikelySearchEngineUrl(value: string): boolean {
  const parsed = safeParseUrl(value);
  if (!parsed) return false;
  const domain = stripWww(parsed.hostname);
  const pathname = parsed.pathname.toLowerCase();

  return (
    (domainMatches(domain, 'bing.com') && pathname.startsWith('/search'))
    || (domainMatches(domain, 'duckduckgo.com') && pathname.startsWith('/html'))
    || (domainMatches(domain, 'google.com') && pathname.startsWith('/search'))
    || (domainMatches(domain, 'news.google.com') && pathname.startsWith('/search'))
    || (domainMatches(domain, 'youtube.com') && pathname.startsWith('/results'))
  );
}

function normalizeReadableExcerpt(value: string, max = 320): string {
  return clipText(value.replace(/\s+/g, ' ').trim(), max);
}

function parseJinaTitle(rawText: string): string {
  const titleMatch = rawText.match(/^Title:\s*(.+)$/mi);
  return clipText((titleMatch?.[1] || '').trim(), 160);
}

function getReadablePageQuality(url: string, content: string): ReadableFetchQuality {
  if (isLikelySearchEngineUrl(url)) return 'serp';

  const normalized = normalizeCoworkText(content);
  if (!normalized || normalized.length < 180) return 'shell';

  const looksYoutubeShell =
    domainMatches(getUrlDomain(url), 'youtube.com')
    && normalized.includes('skip navigation')
    && normalized.includes('search with your voice')
    && normalized.length < 1200;
  if (looksYoutubeShell) return 'shell';

  const looksMusicShell =
    /(ouvrir dans musique|lire lire lire|se connecter se connecter)/.test(normalized)
    && normalized.length < 900;
  if (looksMusicShell) return 'partial';

  if (normalized.length < 500) return 'partial';
  return 'full';
}

function readableQualityScore(value: ReadableFetchQuality): number {
  switch (value) {
    case 'full':
      return 3;
    case 'partial':
      return 2;
    case 'shell':
      return 1;
    case 'serp':
    default:
      return 0;
  }
}

const SEARCH_RESULT_GENERIC_TOKENS = new Set([
  'artiste',
  'artist',
  'artists',
  'musique',
  'music',
  'musical',
  'musicale',
  'rap',
  'rappeur',
  'rapper',
  'album',
  'albums',
  'single',
  'singles',
  'titre',
  'titres',
  'title',
  'titles',
  'track',
  'tracks',
  'song',
  'songs',
  'chanson',
  'chansons',
  'morceau',
  'morceaux',
  'discographie',
  'discography',
  'paroles',
  'lyrics',
  'official',
  'officiel',
  'principaux',
  'principal',
  'principales',
  'principale',
  'top',
  'liste',
  'listing',
  'complet',
  'complete',
  'complets',
  'completes',
  'latest',
  'recent',
  'recente',
  'recentes',
  'today',
  'aujourdhui',
  'jour',
]);

function extractSearchAnchorTokens(query: string): string[] {
  const tokens = normalizeCoworkText(query).match(/[a-z0-9]+/g) || [];
  const uniqueTokens = [...new Set(tokens.filter(token => token.length > 1 || /\d/.test(token)))];
  const anchors = uniqueTokens.filter(token => !SEARCH_RESULT_GENERIC_TOKENS.has(token));
  return anchors.length > 0 ? anchors : uniqueTokens;
}

function searchResultHaystack(result: SearchResultItem): { title: string; url: string; snippet: string; all: string } {
  const title = normalizeCoworkText(result.title || '');
  const url = normalizeCoworkText(result.url || '');
  const snippet = normalizeCoworkText(result.snippet || '');
  return {
    title,
    url,
    snippet,
    all: `${title} ${url} ${snippet}`.trim(),
  };
}

function searchQueryLooksMusicLookup(query: string): boolean {
  const normalized = normalizeCoworkText(query);
  return /\b(artiste|artist|rappeur|rapper|chanteur|chanteuse|groupe|musique|music|album|albums|single|singles|titre|titres|track|tracks|song|songs|son|sons|morceau|morceaux|chanson|chansons|discographie|discography|spotify|deezer|apple music|youtube|genius|freestyle|planete rap)\b/.test(normalized);
}

function scoreSearchResultRelevance(query: string, result: SearchResultItem): number {
  const anchors = extractSearchAnchorTokens(query);
  if (anchors.length === 0) return 1;

  const normalizedQuery = normalizeCoworkText(query).replace(/\s+/g, ' ').trim();
  const haystack = searchResultHaystack(result);
  let score = 0;

  if (normalizedQuery && haystack.all.includes(normalizedQuery)) {
    score += 8;
  }

  for (const token of anchors) {
    const tokenWeight = /\d/.test(token) ? 6 : token.length >= 7 ? 4 : token.length >= 4 ? 3 : 2;
    if (haystack.title.includes(token)) score += tokenWeight + 2;
    else if (haystack.all.includes(token)) score += tokenWeight;
    if (haystack.url.includes(token)) score += 1.5;
    if (haystack.snippet.includes(token)) score += 0.75;
  }

  if (
    searchQueryLooksMusicLookup(query)
    && /(spotify|deezer|music\.apple|genius|youtube|trackmusik|chartsinfrance|qobuz|parolesmusik|infoconcert|instagram)/i.test(result.url)
  ) {
    score += 2;
  }

  return score;
}

function rankSearchResults(query: string, results: SearchResultItem[]): SearchResultItem[] {
  return [...results]
    .map((result, index) => ({ result, index, score: scoreSearchResultRelevance(query, result) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ result }) => result);
}

function getMatchedAnchors(query: string, results: SearchResultItem[]): string[] {
  const topResults = results.slice(0, Math.min(3, results.length));
  const anchorTokens = extractSearchAnchorTokens(query);
  return anchorTokens.filter((token, index) => {
    if (anchorTokens.indexOf(token) !== index) return false;
    return topResults.some((result) => searchResultHaystack(result).all.includes(token));
  });
}

function assessSearchResults(
  query: string,
  results: SearchResultItem[],
  options: { strict?: boolean } = {}
): SearchAssessment {
  if (results.length === 0) {
    return {
      quality: 'off_topic',
      bestScore: 0,
      matchedAnchors: [],
      matchedResults: 0,
    };
  }

  const topResults = results.slice(0, Math.min(3, results.length));
  const anchorTokens = extractSearchAnchorTokens(query);
  if (anchorTokens.length === 0) {
    return {
      quality: 'relevant',
      bestScore: 1,
      matchedAnchors: [],
      matchedResults: Math.min(1, topResults.length),
    };
  }

  const bestScore = Math.max(...topResults.map(result => scoreSearchResultRelevance(query, result)));
  const matchedAnchors = getMatchedAnchors(query, topResults);
  const matchedResults = topResults.filter(result => {
    const haystack = searchResultHaystack(result).all;
    return anchorTokens.some(token => haystack.includes(token));
  }).length;
  const matchedAnchorRatio = matchedAnchors.length / anchorTokens.length;

  const needsStrictMatch =
    anchorTokens.length === 1
    || anchorTokens.some(token => /\d/.test(token))
    || searchQueryLooksMusicLookup(query);

  const isRelevant = options.strict
    ? (
        bestScore >= 6
        && matchedResults >= 1
        && matchedAnchors.length >= Math.min(2, anchorTokens.length)
        && matchedAnchorRatio >= (anchorTokens.length >= 4 ? 0.34 : 0.5)
      )
    : (
        needsStrictMatch
          ? bestScore >= 6 && matchedResults >= 1
          : bestScore >= 4 && matchedResults >= Math.min(2, topResults.length)
      );

  return {
    quality: isRelevant ? 'relevant' : (bestScore > 0 || matchedAnchors.length > 0 ? 'degraded' : 'off_topic'),
    bestScore,
    matchedAnchors,
    matchedResults,
  };
}

function resultsLookRelevant(query: string, results: SearchResultItem[], options: { strict?: boolean } = {}): boolean {
  return assessSearchResults(query, results, options).quality === 'relevant';
}

function parseRssResults(
  xml: string,
  source: string,
  maxResults: number
): SearchResultItem[] {
  const items = [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)];
  const seen = new Set<string>();
  const results: SearchResultItem[] = [];

  for (const match of items) {
    if (results.length >= maxResults) break;
    const block = match[0];
    const url = extractXmlTagValue(block, 'link');
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);

    const title = extractXmlTagValue(block, 'title') || url;
    const snippet =
      extractXmlTagValue(block, 'description') ||
      extractXmlTagValue(block, 'content:encoded') ||
      extractXmlTagValue(block, 'content');

    results.push({
      title: clipText(title, 140),
      url,
      snippet: clipText(snippet, 240),
      source
    });
  }

  return results;
}

async function searchViaBingRss(query: string, maxResults = 5) {
  const response = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
    }
  });
  if (!response.ok) {
    throw new Error(`Bing RSS a renvoye ${response.status}`);
  }

  const xml = await response.text();
  const results = parseRssResults(xml, 'bing', maxResults);
  if (results.length === 0) {
    throw new Error('Aucun resultat exploitable trouve via Bing RSS.');
  }
  return results;
}

async function searchViaDuckDuckGo(query: string, maxResults = 5) {
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
  const results: SearchResultItem[] = [];
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
    throw new Error('Aucun resultat exploitable trouve via DuckDuckGo.');
  }

  return results;
}

function searchQueryLooksNewsy(query: string): boolean {
  const normalized = normalizeCoworkText(query);
  return /\b(actualite|actu|news|aujourd'hui|du jour|today|breaking|headline|briefing|rss|presse|latest|recent|dernieres)\b/.test(normalized);
}

async function searchViaGoogleNewsRss(query: string, maxResults = 5) {
  const response = await fetch(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`,
    {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    }
  );
  if (!response.ok) {
    throw new Error(`Google News RSS a renvoye ${response.status}`);
  }

  const xml = await response.text();
  const results = parseRssResults(xml, 'google-news', maxResults);
  if (results.length === 0) {
    throw new Error('Aucun resultat exploitable trouve via Google News RSS.');
  }
  return results;
}

function looksLikeTransientSearchIssue(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(403|429|quota|temporar|unavailable|too many requests|saturation|deadline exceeded|forbidden)\b/.test(normalized);
}

async function searchViaTavily(query: string, maxResults = 5): Promise<SearchResultItem[]> {
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

async function searchWeb(query: string, maxResults = 5, options: SearchOptions = {}): Promise<SearchOutcome> {
  const strictMode = Boolean(options.strictMusic || options.strictFactual || searchQueryLooksMusicLookup(query));
  const newsy = searchQueryLooksNewsy(query);
  const attempts: Array<{ label: string; run: () => Promise<SearchResultItem[]> }> = [];

  if (process.env.TAVILY_API_KEY) {
    attempts.push({ label: 'tavily', run: () => searchViaTavily(query, maxResults) });
  }

  if (newsy) {
    attempts.push(
      { label: 'bing-rss', run: () => searchViaBingRss(query, maxResults) },
      { label: 'duckduckgo', run: () => searchViaDuckDuckGo(query, maxResults) },
      { label: 'google-news-rss', run: () => searchViaGoogleNewsRss(query, maxResults) }
    );
  } else {
    attempts.push(
      { label: 'duckduckgo', run: () => searchViaDuckDuckGo(query, maxResults) },
      { label: 'bing-rss', run: () => searchViaBingRss(query, maxResults) }
    );
  }

  const primaryProvider = attempts[0]?.label || 'fallback-public';
  const warnings: string[] = [];
  let sawTransientIssue = false;
  let bestDegraded: (SearchOutcome & { quality: 'degraded' | 'off_topic' }) | null = null;

  for (const attempt of attempts) {
    try {
      const rankedResults = rankSearchResults(query, await attempt.run());
      if (rankedResults.length === 0) continue;

      const assessment = assessSearchResults(query, rankedResults, { strict: strictMode });
      const outcome: SearchOutcome = {
        success: assessment.quality === 'relevant' || (!strictMode && assessment.quality === 'degraded'),
        quality: assessment.quality,
        provider: attempt.label,
        results: rankedResults,
        relevanceScore: assessment.bestScore,
        matchedAnchors: assessment.matchedAnchors,
        fallbackUsed: attempt.label !== primaryProvider,
        warnings: [...warnings],
      };

      if (assessment.quality === 'relevant') {
        return outcome;
      }

      if (
        !bestDegraded
        || assessment.bestScore > bestDegraded.relevanceScore
        || (
          assessment.bestScore === bestDegraded.relevanceScore
          && assessment.matchedAnchors.length > bestDegraded.matchedAnchors.length
        )
      ) {
        bestDegraded = {
          ...outcome,
          success: !strictMode && assessment.quality === 'degraded',
          quality: assessment.quality,
        };
      }

      warnings.push(`${attempt.label}: resultats ${assessment.quality === 'degraded' ? 'insuffisants' : 'hors sujet'} pour "${query}"`);
    } catch (error) {
      const message = parseApiError(error);
      warnings.push(`${attempt.label}: ${message}`);
      if (looksLikeTransientSearchIssue(message)) {
        sawTransientIssue = true;
      }
    }
  }

  if (bestDegraded) {
    return {
      ...bestDegraded,
      success: bestDegraded.success,
      quality: strictMode && bestDegraded.quality === 'degraded' ? 'degraded' : bestDegraded.quality,
      warnings,
      error: strictMode
        ? `La recherche n'a pas valide suffisamment la requete "${query}".`
        : undefined,
    };
  }

  const errorMessage = `Aucun resultat exploitable trouve via les moteurs disponibles.${warnings.length > 0 ? ` Dernieres erreurs: ${warnings.join(' | ')}` : ''}`.trim();
  return {
    success: false,
    quality: sawTransientIssue ? 'transient_error' : 'off_topic',
    provider: primaryProvider,
    results: [],
    relevanceScore: 0,
    matchedAnchors: [],
    fallbackUsed: false,
    warnings,
    error: errorMessage,
    transient: sawTransientIssue,
  };
}

async function fetchDirectReadablePage(parsed: URL, headers: Record<string, string>): Promise<ReadablePage> {
  const direct = await fetch(parsed.toString(), { headers, redirect: 'follow' });
  if (!direct.ok) {
    throw new Error(`Impossible de lire ${parsed.toString()} (${direct.status})`);
  }

  const contentType = direct.headers.get('content-type') || '';
  const rawText = await direct.text();
  const title = contentType.includes('text/html')
    ? extractHtmlTitle(rawText)
    : parsed.hostname;
  const content = contentType.includes('text/html')
    ? stripHtml(rawText)
    : rawText.replace(/\s+/g, ' ').trim();
  const quality = getReadablePageQuality(parsed.toString(), content);

  return {
    url: parsed.toString(),
    title: clipText(title || parsed.hostname, 160),
    content: clipText(content, MAX_WEB_FETCH_CHARS),
    rawContent: rawText,
    excerpt: normalizeReadableExcerpt(content),
    source: contentType.includes('text/html') ? 'direct-html' : 'direct-text',
    quality,
    domain: stripWww(parsed.hostname),
    isSearchPage: quality === 'serp',
    isCatalogEvidence: quality === 'full' && !isLikelySearchEngineUrl(parsed.toString())
  };
}

async function fetchJinaReadablePage(parsed: URL, headers: Record<string, string>): Promise<ReadablePage> {
  const jinaUrl = `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
  const response = await fetch(jinaUrl, { headers, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Jina a renvoye ${response.status} pour ${parsed.toString()}`);
  }

  const rawText = await response.text();
  const title = parseJinaTitle(rawText) || parsed.hostname;
  const content = rawText.replace(/\r/g, '').trim();
  const quality = getReadablePageQuality(parsed.toString(), content);

  return {
    url: parsed.toString(),
    title: clipText(title, 160),
    content: clipText(content, MAX_WEB_FETCH_CHARS),
    rawContent: rawText,
    excerpt: normalizeReadableExcerpt(content),
    source: 'jina-ai',
    quality,
    domain: stripWww(parsed.hostname),
    isSearchPage: quality === 'serp',
    isCatalogEvidence: quality === 'full' && !isLikelySearchEngineUrl(parsed.toString())
  };
}

async function fetchReadableUrlDetailed(url: string): Promise<ReadablePage> {
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

  const preferJina = shouldPreferJinaForUrl(parsed.toString());
  let directPage: ReadablePage | null = null;
  let jinaPage: ReadablePage | null = null;
  const errors: string[] = [];

  if (!preferJina) {
    try {
      directPage = await fetchDirectReadablePage(parsed, headers);
    } catch (error) {
      errors.push(parseApiError(error));
    }
  }

  if (
    preferJina
    || !directPage
    || readableQualityScore(directPage.quality) < 3
    || (isMusicPlatformDomain(stripWww(parsed.hostname)) && readableQualityScore(directPage.quality) < 3)
  ) {
    try {
      jinaPage = await fetchJinaReadablePage(parsed, headers);
    } catch (error) {
      errors.push(parseApiError(error));
    }
  }

  if (!directPage && !preferJina) {
    try {
      directPage = await fetchDirectReadablePage(parsed, headers);
    } catch (error) {
      errors.push(parseApiError(error));
    }
  }

  const bestPage = [directPage, jinaPage]
    .filter((page): page is ReadablePage => Boolean(page))
    .sort((left, right) => readableQualityScore(right.quality) - readableQualityScore(left.quality))[0];

  if (!bestPage) {
    throw new Error(`Impossible de lire ${parsed.toString()}. ${errors.join(' | ')}`.trim());
  }

  return bestPage;
}

async function fetchReadableUrl(url: string) {
  const page = await fetchReadableUrlDetailed(url);
  return {
    url: page.url,
    title: page.title,
    content: page.content,
    excerpt: page.excerpt,
    source: page.source,
    quality: page.quality,
    domain: page.domain,
    isCatalogEvidence: page.isCatalogEvidence
  };
}

// ─── Middleware ──────────────────────────────────────────────────
type MusicLookupOptions = {
  artistQuery: string;
  ownedTracks?: string[];
  includeFeatures?: boolean;
  includeUnofficial?: boolean;
  originalMessage?: string;
};

type MusicCatalogAccumulator = {
  resolvedArtist: string;
  officialTracks: Map<string, string>;
  singleTracks: Map<string, string>;
  albumTracks: Map<string, string>;
  optionalFeatures: Map<string, string>;
  uncertain: Map<string, string>;
  sources: MusicCatalogSource[];
  coverage: MusicCatalogCoverage;
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractMarkdownLinks(markdown: string): Array<{ text: string; url: string }> {
  const links: Array<{ text: string; url: string }> = [];
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(markdown))) {
    const cleanedText = decodeHtmlEntities(match[1])
      .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
      .replace(/^#+\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();
    links.push({
      text: cleanedText,
      url: match[2].trim()
    });
  }

  return links;
}

function extractMarkdownSection(markdown: string, headings: string[]): string {
  const wanted = headings.map(heading => normalizeCoworkText(heading));
  const lines = markdown.replace(/\r/g, '').split('\n');
  const collected: string[] = [];
  let capture = false;

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      const normalizedHeading = normalizeCoworkText(line.replace(/^##\s+/, '').trim());
      if (capture) break;
      capture = wanted.some(heading => normalizedHeading.includes(heading));
    }
    if (capture) {
      collected.push(line);
    }
  }

  return collected.join('\n').trim();
}

function choosePreferredMusicLabel(current: string | undefined, next: string): string {
  if (!current) return next;
  const score = (value: string) => {
    const normalized = normalizeCoworkText(value);
    let total = value.length;
    if (/\b(feat|ft|single|album|official|video|clip)\b/.test(normalized)) total += 18;
    if (/[()[\]]/.test(value)) total += 8;
    return total;
  };
  return score(next) < score(current) ? next : current;
}

function cleanMusicTitleCandidate(value: string, aliases: string[] = []): string {
  let cleaned = decodeHtmlEntities(value || '')
    .replace(/[\u200e\u200f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  for (const alias of aliases.map(alias => alias.trim()).filter(Boolean)) {
    cleaned = cleaned.replace(new RegExp(`^${escapeRegExp(alias)}\\s*[-:|]\\s*`, 'i'), '').trim();
  }

  cleaned = cleaned
    .replace(/\s*[-–]\s*(single|ep|album)\s*$/i, '')
    .replace(/\s*\((official|clip officiel|audio officiel|visualizer)[^)]+\)\s*$/i, '')
    .replace(/\s*\[(official|clip officiel|audio officiel|visualizer)[^\]]+\]\s*$/i, '')
    .replace(/\s*\|\s*(official|clip officiel|audio officiel|visualizer).*/i, '')
    .replace(/^[`"'“”]+|[`"'“”]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned.replace(/^[\-:|]\s*|\s*[\-:|]$/g, '').trim();
}

function normalizeTrackKey(value: string, aliases: string[] = []): string {
  let normalized = normalizeCoworkText(cleanMusicTitleCandidate(value, aliases));
  for (const alias of aliases.map(alias => normalizeCoworkText(alias)).filter(Boolean)) {
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'g'), ' ');
  }

  return normalized
    .replace(/\((feat|ft|featuring|avec)[^)]+\)/g, ' ')
    .replace(/\b(feat|ft|featuring|avec)\.?\s+[a-z0-9\s&'.,-]+$/g, ' ')
    .replace(/\s*[-–]\s*(single|ep|album)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function setMusicEntry(map: Map<string, string>, rawTitle: string, aliases: string[] = []) {
  const cleaned = cleanMusicTitleCandidate(rawTitle, aliases);
  const key = normalizeTrackKey(cleaned, aliases);
  if (!cleaned || !key) return;
  map.set(key, choosePreferredMusicLabel(map.get(key), cleaned));
}

function toSortedValues(map: Map<string, string>): string[] {
  return [...map.values()].sort((left, right) => left.localeCompare(right, 'fr', { sensitivity: 'base' }));
}

function inferMusicSourceKind(url: string): MusicCatalogSourceKind {
  const parsed = safeParseUrl(url);
  if (!parsed) return 'artist';
  const domain = stripWww(parsed.hostname);
  const pathname = parsed.pathname.toLowerCase();

  if (domainMatches(domain, 'youtube.com')) {
    return pathname.includes('/watch') ? 'video' : 'artist';
  }
  if (pathname.includes('/song/')) return 'tracklist';
  if (pathname.includes('/album/')) return 'album';
  return 'artist';
}

function pushMusicSource(sources: MusicCatalogSource[], url: string, kind?: MusicCatalogSourceKind) {
  const parsed = safeParseUrl(url);
  if (!parsed) return;
  const normalizedUrl = parsed.toString().split('#')[0];
  if (sources.some(source => source.url === normalizedUrl)) return;
  sources.push({
    domain: stripWww(parsed.hostname),
    url: normalizedUrl,
    kind: kind || inferMusicSourceKind(normalizedUrl)
  });
}

function parseAppleMusicArtistPage(page: ReadablePage, aliases: string[]) {
  const raw = page.rawContent.replace(/\r/g, '');
  const headerMatch = raw.match(/^#\s*[^\S\r\n]*[^\p{L}\p{N}]*(.+?)\s+[–-]\s+Apple Music/mu);
  const resolvedArtist = cleanMusicTitleCandidate(headerMatch?.[1] || '', aliases);

  const topTracks = new Map<string, string>();
  for (const link of extractMarkdownLinks(extractMarkdownSection(raw, ['classement des morceaux', 'top songs']))) {
    if (link.url.includes('/artist/') || link.url.includes('#')) {
      setMusicEntry(topTracks, link.text, aliases);
    }
  }

  const singleTracks = new Map<string, string>();
  for (const link of extractMarkdownLinks(extractMarkdownSection(raw, ['singles et ep', 'ep et singles', 'singles', 'singles & eps', 'singles and eps']))) {
    if (link.url.includes('/album/')) {
      setMusicEntry(singleTracks, link.text, aliases);
    }
  }

  const albumUrls = [...new Set(
    extractMarkdownLinks(extractMarkdownSection(raw, ['albums']))
      .filter(link => link.url.includes('/album/'))
      .map(link => link.url)
  )];

  const featureTracks = new Map<string, string>();
  for (const link of extractMarkdownLinks(extractMarkdownSection(raw, ['apparait sur', 'appears on']))) {
    if (link.url.includes('/album/')) {
      setMusicEntry(featureTracks, link.text, aliases);
    }
  }

  return {
    resolvedArtist,
    topTracks,
    singleTracks,
    albumUrls,
    featureTracks
  };
}

function parseAppleMusicSearchPage(page: ReadablePage, artistQuery: string) {
  const raw = page.rawContent.replace(/\r/g, '');
  const normalizedArtist = normalizeTrackKey(artistQuery);
  const artistCandidates = [
    ...[...raw.matchAll(/###\s+([^\]\n]+)\]\((https?:\/\/music\.apple\.com\/[^)]+\/artist\/[^)]+)\)/g)].map(match => ({
      text: cleanMusicTitleCandidate(match[1]),
      url: match[2]
    })),
    ...[...raw.matchAll(/\[\]\((https?:\/\/music\.apple\.com\/[^)]+\/artist\/[^)]+)\)[\s\S]{0,260}?\*\s+([^\n]+)\s*\n\s*\*\s+Artist/gi)].map(match => ({
      text: cleanMusicTitleCandidate(match[2]),
      url: match[1]
    }))
  ];
  const albumCandidates = extractMarkdownLinks(extractMarkdownSection(raw, ['albums']))
    .filter(link => link.url.includes('/album/'));
  const singleTracks = new Map<string, string>();
  for (const link of albumCandidates) {
    if (/\b(single|ep)\b/i.test(link.text)) {
      setMusicEntry(singleTracks, link.text, [artistQuery]);
    }
  }

  const artistUrl = artistCandidates.find(link => normalizeTrackKey(link.text) === normalizedArtist)?.url
    || artistCandidates.find(link => normalizeTrackKey(link.text).includes(normalizedArtist))?.url
    || null;

  return {
    artistUrl,
    albumUrls: [...new Set(albumCandidates.map(link => link.url))],
    singleTracks
  };
}

function parseAppleMusicAlbumPage(page: ReadablePage, aliases: string[]) {
  const raw = page.rawContent.replace(/\r/g, '');
  const headerMatch = raw.match(/^#\s*[^\S\r\n]*[^\p{L}\p{N}]*(.+?)\s+[–-]\s+Album\b/mu);
  const albumTitle = cleanMusicTitleCandidate(headerMatch?.[1] || '', aliases);
  const tracks = new Map<string, string>();

  for (const link of extractMarkdownLinks(raw)) {
    if (link.url.includes('/song/')) {
      setMusicEntry(tracks, link.text, aliases);
    }
  }

  return { albumTitle, tracks };
}

function parseYouTubeVideosPage(page: ReadablePage, aliases: string[]) {
  const raw = page.rawContent.replace(/\r/g, '');
  const officialTracks = new Map<string, string>();
  const unofficialTracks = new Map<string, string>();
  const regex = /^###\s+\[(.+?)\]\((https?:\/\/www\.youtube\.com\/watch\?v=[^) ]+)(?:\s+"[^"]*")?\)/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(raw))) {
    const title = cleanMusicTitleCandidate(match[1], aliases);
    const normalized = normalizeCoworkText(title);
    if (!title || title.length < 2) continue;

    if (/\b(freestyle|planete rap|planet rap|live|session|interview|shorts?|teaser|preview|making of)\b/.test(normalized)) {
      setMusicEntry(unofficialTracks, title, aliases);
    } else {
      setMusicEntry(officialTracks, title, aliases);
    }
  }

  return { officialTracks, unofficialTracks };
}

function extractOwnedTracksFromMessage(message: string, artistQuery: string): string[] {
  if (!message.trim()) return [];

  const candidates: string[] = [];
  const quotedRegex = /["“”'`](.{2,80}?)["“”'`]/g;
  let quotedMatch: RegExpExecArray | null;
  while ((quotedMatch = quotedRegex.exec(message))) {
    candidates.push(quotedMatch[1]);
  }

  const aliasRegex = artistQuery ? new RegExp(`\\b${escapeRegExp(artistQuery)}\\b`, 'ig') : null;
  const splitPieces = message
    .replace(/\bet\s+/gi, ', ')
    .split(/[,;\n]/)
    .map(piece => piece.trim())
    .filter(Boolean);

  for (const piece of splitPieces) {
    let candidate = piece
      .replace(/^.*?\b(j['’ ]?ai|je possede|je possede deja|je l'ai|je l ai)\b/i, '')
      .replace(/\b(le|les|son|sons|titre|titres|track|tracks|morceau|morceaux|chanson|chansons)\b/gi, ' ')
      .replace(/\b(dis moi|dis-moi|je les veux tous|je veux tous|tout ce qu[ei]'?l me manque|ceux qu[ei]'?l me manque)\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (aliasRegex) {
      candidate = candidate.replace(aliasRegex, ' ').replace(/\s+/g, ' ').trim();
    }

    if (!candidate) continue;
    if (candidate.split(/\s+/).length > 8) continue;
    candidates.push(candidate);
  }

  const unique = new Map<string, string>();
  for (const candidate of candidates) {
    const cleaned = cleanMusicTitleCandidate(candidate, [artistQuery]);
    const key = normalizeTrackKey(cleaned, [artistQuery]);
    if (!cleaned || !key) continue;
    unique.set(key, choosePreferredMusicLabel(unique.get(key), cleaned));
  }

  return [...unique.values()];
}

function buildMusicSeedQueries(
  artistQuery: string,
  ownedTracks: string[],
  includeFeatures: boolean,
  includeUnofficial: boolean
) {
  const wantsFreestyleLookup = includeUnofficial || ownedTracks.some(track => /\b(planete rap|planet rap|freestyle)\b/i.test(track));
  const queries = [
    { query: `${artistQuery} Apple Music`, priority: 0 },
    { query: `${artistQuery} YouTube`, priority: 1 },
    { query: `${artistQuery} TrackMusik`, priority: 2 },
  ];

  if (includeFeatures) {
    queries.push({ query: `${artistQuery} feat Apple Music`, priority: 3 });
  }
  if (wantsFreestyleLookup) {
    queries.push({ query: `${artistQuery} Planete Rap YouTube`, priority: 4 });
  }

  return queries;
}

export async function musicCatalogLookup(options: MusicLookupOptions): Promise<MusicCatalogLookupResult> {
  const artistQuery = options.artistQuery.trim();
  const includeFeatures = options.includeFeatures !== false;
  const includeUnofficial = options.includeUnofficial === true;
  const ownedTracks = (options.ownedTracks && options.ownedTracks.length > 0
    ? options.ownedTracks
    : extractOwnedTracksFromMessage(options.originalMessage || '', artistQuery)
  )
    .map(track => track.trim())
    .filter(Boolean);

  const aliases = [artistQuery];
  const accumulator: MusicCatalogAccumulator = {
    resolvedArtist: artistQuery,
    officialTracks: new Map<string, string>(),
    singleTracks: new Map<string, string>(),
    albumTracks: new Map<string, string>(),
    optionalFeatures: new Map<string, string>(),
    uncertain: new Map<string, string>(),
    sources: [],
    coverage: {
      distinctDomains: 0,
      hasCatalogPage: false,
      hasAlbumTracklist: false
    }
  };

  const searchErrors: string[] = [];
  const candidateUrls = new Map<string, { url: string; domain: string; priority: number }>();

  for (const seed of buildMusicSeedQueries(artistQuery, ownedTracks, includeFeatures, includeUnofficial)) {
    const search = await searchWeb(seed.query, 5, { strictMusic: true });
    if (!search.success || search.quality !== 'relevant') {
      searchErrors.push(search.error || search.warnings[0] || `Recherche insuffisante pour "${seed.query}".`);
      continue;
    }

    for (const result of search.results) {
      const parsed = safeParseUrl(result.url);
      if (!parsed) continue;
      const normalizedUrl = parsed.toString().split('#')[0];
      const domain = stripWww(parsed.hostname);
      if (isLikelySearchEngineUrl(normalizedUrl) || !isMusicPlatformDomain(domain)) continue;
      const current = candidateUrls.get(normalizedUrl);
      if (!current || seed.priority < current.priority) {
        candidateUrls.set(normalizedUrl, { url: normalizedUrl, domain, priority: seed.priority });
      }
    }
  }

  const sortedCandidates = [...candidateUrls.values()].sort((left, right) => left.priority - right.priority);
  let appleArtistUrl = sortedCandidates.find(candidate => domainMatches(candidate.domain, 'music.apple.com') && candidate.url.includes('/artist/'))?.url;
  let appleAlbumUrl = sortedCandidates.find(candidate => domainMatches(candidate.domain, 'music.apple.com') && candidate.url.includes('/album/'))?.url;
  const youtubeArtistUrl = sortedCandidates.find(candidate => domainMatches(candidate.domain, 'youtube.com') && !candidate.url.includes('/watch') && !candidate.url.includes('/results'))?.url;
  const trackmusikUrl = sortedCandidates.find(candidate => domainMatches(candidate.domain, 'trackmusik.fr'))?.url;

  if (!appleArtistUrl || !appleAlbumUrl) {
    try {
      const appleSearchPage = await fetchReadableUrlDetailed(`https://music.apple.com/us/search?term=${encodeURIComponent(artistQuery)}`);
      const appleSearch = parseAppleMusicSearchPage(appleSearchPage, artistQuery);
      appleArtistUrl = appleArtistUrl || appleSearch.artistUrl || undefined;
      appleAlbumUrl = appleAlbumUrl || appleSearch.albumUrls[0] || undefined;
      for (const [key, title] of appleSearch.singleTracks) {
        accumulator.singleTracks.set(key, choosePreferredMusicLabel(accumulator.singleTracks.get(key), title));
        accumulator.officialTracks.set(key, choosePreferredMusicLabel(accumulator.officialTracks.get(key), title));
      }
    } catch (error) {
      searchErrors.push(parseApiError(error));
    }
  }

  const initialUrls = [appleArtistUrl, youtubeArtistUrl, trackmusikUrl, appleAlbumUrl].filter((value): value is string => Boolean(value));
  const visitedUrls = new Set<string>();

  for (const url of initialUrls) {
    visitedUrls.add(url);
    try {
      const page = await fetchReadableUrlDetailed(url);
      if (domainMatches(page.domain, 'music.apple.com') && url.includes('/artist/')) {
        const parsed = parseAppleMusicArtistPage(page, aliases);
        if (parsed.resolvedArtist) {
          accumulator.resolvedArtist = parsed.resolvedArtist;
          aliases.push(parsed.resolvedArtist);
        }
        if (parsed.topTracks.size > 0 || parsed.singleTracks.size > 0 || parsed.albumUrls.length > 0) {
          accumulator.coverage.hasCatalogPage = true;
        }
        for (const [key, title] of parsed.topTracks) {
          accumulator.officialTracks.set(key, choosePreferredMusicLabel(accumulator.officialTracks.get(key), title));
        }
        for (const [key, title] of parsed.singleTracks) {
          accumulator.singleTracks.set(key, choosePreferredMusicLabel(accumulator.singleTracks.get(key), title));
          accumulator.officialTracks.set(key, choosePreferredMusicLabel(accumulator.officialTracks.get(key), title));
        }
        if (includeFeatures) {
          for (const [key, title] of parsed.featureTracks) {
            accumulator.optionalFeatures.set(key, choosePreferredMusicLabel(accumulator.optionalFeatures.get(key), title));
          }
        }
        pushMusicSource(accumulator.sources, url, 'artist');

        for (const albumUrl of parsed.albumUrls.slice(0, 3)) {
          if (visitedUrls.has(albumUrl)) continue;
          visitedUrls.add(albumUrl);
          try {
            const albumPage = await fetchReadableUrlDetailed(albumUrl);
            const albumData = parseAppleMusicAlbumPage(albumPage, aliases);
            if (albumData.tracks.size > 0) {
              accumulator.coverage.hasAlbumTracklist = true;
              for (const [key, title] of albumData.tracks) {
                accumulator.albumTracks.set(key, choosePreferredMusicLabel(accumulator.albumTracks.get(key), title));
                accumulator.officialTracks.set(key, choosePreferredMusicLabel(accumulator.officialTracks.get(key), title));
              }
              pushMusicSource(accumulator.sources, albumUrl, 'tracklist');
            }
          } catch (error) {
            searchErrors.push(parseApiError(error));
          }
        }
      } else if (domainMatches(page.domain, 'music.apple.com') && url.includes('/album/')) {
        const albumData = parseAppleMusicAlbumPage(page, aliases);
        if (albumData.tracks.size > 0) {
          accumulator.coverage.hasAlbumTracklist = true;
          for (const [key, title] of albumData.tracks) {
            accumulator.albumTracks.set(key, choosePreferredMusicLabel(accumulator.albumTracks.get(key), title));
            accumulator.officialTracks.set(key, choosePreferredMusicLabel(accumulator.officialTracks.get(key), title));
          }
          pushMusicSource(accumulator.sources, url, 'tracklist');
        }
      } else if (domainMatches(page.domain, 'youtube.com')) {
        const youtubeData = parseYouTubeVideosPage(page, aliases);
        for (const [key, title] of youtubeData.officialTracks) {
          accumulator.officialTracks.set(key, choosePreferredMusicLabel(accumulator.officialTracks.get(key), title));
        }
        if (includeUnofficial) {
          for (const [key, title] of youtubeData.unofficialTracks) {
            accumulator.uncertain.set(key, choosePreferredMusicLabel(accumulator.uncertain.get(key), title));
          }
        }
        pushMusicSource(accumulator.sources, url, 'artist');
      } else if (domainMatches(page.domain, 'trackmusik.fr')) {
        if (normalizeCoworkText(page.rawContent).includes('toute la discographie')) {
          accumulator.coverage.hasCatalogPage = true;
        }
        pushMusicSource(accumulator.sources, url, 'artist');
      }
    } catch (error) {
      searchErrors.push(parseApiError(error));
    }
  }

  accumulator.coverage.distinctDomains = new Set(accumulator.sources.map(source => source.domain)).size;

  const ownedMap = new Map<string, string>();
  for (const track of ownedTracks) {
    const cleaned = cleanMusicTitleCandidate(track, aliases);
    const key = normalizeTrackKey(cleaned, aliases);
    if (!cleaned || !key) continue;
    ownedMap.set(key, choosePreferredMusicLabel(ownedMap.get(key), cleaned));
  }

  const ownedConfirmed = new Map<string, string>();
  const allKnownTracks = new Map<string, string>();
  for (const collection of [accumulator.officialTracks, accumulator.optionalFeatures, accumulator.uncertain]) {
    for (const [key, title] of collection) {
      allKnownTracks.set(key, choosePreferredMusicLabel(allKnownTracks.get(key), title));
    }
  }
  for (const [key, title] of ownedMap) {
    const confirmed = allKnownTracks.get(key);
    if (confirmed) {
      ownedConfirmed.set(key, choosePreferredMusicLabel(title, confirmed));
    }
  }

  const missingConfirmed = new Map<string, string>();
  for (const [key, title] of accumulator.officialTracks) {
    if (!ownedMap.has(key) && !accumulator.optionalFeatures.has(key)) {
      missingConfirmed.set(key, title);
    }
  }

  const albumOnly = new Map<string, string>();
  for (const [key, title] of accumulator.albumTracks) {
    if (!accumulator.singleTracks.has(key) && !ownedMap.has(key)) {
      albumOnly.set(key, title);
    }
  }

  const optionalFeatures = new Map<string, string>();
  if (includeFeatures) {
    for (const [key, title] of accumulator.optionalFeatures) {
      if (!ownedMap.has(key)) {
        optionalFeatures.set(key, title);
      }
    }
  }

  const partial =
    accumulator.coverage.distinctDomains < 2
    || !accumulator.coverage.hasCatalogPage
    || !accumulator.coverage.hasAlbumTracklist;

  const messageParts = [
    `Couverture: ${accumulator.coverage.distinctDomains} domaine(s) distinct(s).`,
    accumulator.coverage.hasCatalogPage ? 'Catalogue artiste confirme.' : 'Catalogue artiste incomplet.',
    accumulator.coverage.hasAlbumTracklist ? 'Tracklist album confirmee.' : 'Tracklist album manquante.'
  ];
  if (searchErrors.length > 0) {
    messageParts.push(`Incidents sources: ${clipText(searchErrors.join(' | '), 220)}.`);
  }

  return {
    success: true,
    artistQuery,
    resolvedArtist: accumulator.resolvedArtist,
    ownedConfirmed: toSortedValues(ownedConfirmed),
    missingConfirmed: toSortedValues(missingConfirmed),
    albumOnly: toSortedValues(albumOnly),
    optionalFeatures: toSortedValues(optionalFeatures),
    uncertain: toSortedValues(accumulator.uncertain),
    sources: accumulator.sources,
    coverage: accumulator.coverage,
    partial,
    message: messageParts.join(' ')
  };
}

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
 * Classifies transient API failures so the retry policy can react differently to
 * quota saturation, simultaneous requests, and generic upstream hiccups.
 */
function classifyRetryableError(error: any): { retryable: boolean; kind: RetryKind; message: string } {
  const cleanMessage = parseApiError(error);
  const normalized = `${String(error)} ${cleanMessage}`.toLowerCase();

  const isQuotaLike =
    normalized.includes('429')
    || normalized.includes('resource_exhausted')
    || normalized.includes('too many requests');
  const isConcurrencyLike =
    normalized.includes('simultan')
    || normalized.includes('concurrent')
    || normalized.includes('parallel')
    || normalized.includes('too many simultaneous');
  const isServerLike =
    normalized.includes('503')
    || normalized.includes('unavailable')
    || normalized.includes('temporarily')
    || normalized.includes('deadline exceeded');

  if (!(isQuotaLike || isConcurrencyLike || isServerLike)) {
    return { retryable: false, kind: 'server', message: cleanMessage };
  }

  if (isConcurrencyLike) {
    return { retryable: true, kind: 'concurrency', message: cleanMessage };
  }
  if (isServerLike && !isQuotaLike) {
    return { retryable: true, kind: 'server', message: cleanMessage };
  }
  return { retryable: true, kind: 'quota', message: cleanMessage };
}

/**
 * Intelligent retry with exponential backoff + jitter for transient quota,
 * concurrency, and upstream availability failures.
 */
async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 1000;
  const exactDelaysMs = options.exactDelaysMs;
  const useJitter = options.jitter !== false;
  let lastError: any;

  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const classified = classifyRetryableError(error);

      if (classified.retryable && i < maxRetries) {
        const multiplier = classified.kind === 'concurrency' ? 2.5 : classified.kind === 'server' ? 1.5 : 1;
        const exponentialDelay = exactDelaysMs?.[i] ?? (baseDelayMs * multiplier * Math.pow(2, i));
        const jitter = useJitter
          ? Math.floor(Math.random() * Math.min(1200, exponentialDelay * 0.35))
          : 0;
        const delayMs = Math.min(16_000, Math.round(exponentialDelay + jitter));

        log.warn(`Transient ${classified.kind} failure. Retrying in ${delayMs}ms... (Attempt ${i + 1}/${maxRetries})`, {
          message: classified.message
        });

        await options.onRetry?.({
          attempt: i + 1,
          maxRetries,
          delayMs,
          kind: classified.kind,
          message: classified.message
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
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
  let releaseCoworkRunGate: (() => void) | null = null;
  const emitEvent = (type: string, payload: Record<string, unknown> = {}) => {
    if (!headersSent) return;
    res.write(`data: ${JSON.stringify({ type, timestamp: Date.now(), ...payload })}\n\n`);
  };
  try {
    const { message, sessionId, history, config, clientContext } = ChatSchema.parse(req.body);
    const requestClock = resolveRequestClock(clientContext);
    const researchTargets = getResearchTargets(message);
    const pdfQualityTargets = getPdfQualityTargets(message);

    // Model ID mapping
    let modelId = config.model;
    if (modelId.includes('gemini-1.5')) modelId = modelId.replace('1.5', '3.1');
    if (modelId === 'gemini-3.1-pro') modelId = 'gemini-3.1-pro-preview';
    if (modelId === 'gemini-3.1-flash') modelId = 'gemini-3.1-flash-lite-preview';
    if (!modelId) modelId = "gemini-3.1-pro-preview";

    const ai = createGoogleAI(modelId);

    const webSearchEnabled = config.googleSearch !== false;
    const executeScriptEnabled = config.codeExecution !== false;
    const strictFactualSearch = requestNeedsStrictFactualSearch(message);

    const formatToolArgsPreview = (args: unknown) => clipText(args, 260);
    const formatToolMeta = (toolName: string, args: any) => {
      if (toolName === 'music_catalog_lookup') {
        return {
          artist: clipText(args?.artistQuery || '', 80),
          owned: Array.isArray(args?.ownedTracks) ? args.ownedTracks.length : 0
        };
      }
      if (toolName === 'web_search') {
        return { query: clipText(args?.query || '', 140), maxResults: Number(args?.maxResults || 5) };
      }
      if (toolName === 'web_fetch') {
        return { url: clipText(args?.url || '', 180) };
      }
      if (toolName === 'review_pdf_draft') {
        return {
          title: clipText(args?.title || '', 120),
          sections: Array.isArray(args?.sections) ? args.sections.length : 0
        };
      }
      if (toolName === 'report_progress') {
        const completion = args?.completion || {};
        return {
          phase: clipText(completion?.phase || '', 40),
          score: clampPercentage(Number(completion?.score || 0)),
          taskComplete: Boolean(completion?.taskComplete)
        };
      }
      return undefined;
    };
    const formatToolResultMeta = (toolName: string, args: any, output: any) => {
      if (toolName === 'web_search') {
        return {
          query: clipText(output?.query || args?.query || '', 140),
          provider: clipText(output?.provider || '', 32),
          quality: clipText(output?.quality || '', 20),
          score: Number(output?.relevanceScore || 0),
          anchors: Array.isArray(output?.matchedAnchors) ? output.matchedAnchors.length : 0,
          fallback: Boolean(output?.fallbackUsed),
        };
      }
      if (toolName === 'web_fetch') {
        return {
          domain: clipText(output?.domain || '', 40),
          quality: clipText(output?.quality || '', 20),
          searchPage: Boolean(output?.isSearchPage),
        };
      }
      if (toolName === 'review_pdf_draft') {
        return {
          ready: Boolean(output?.ready),
          score: Number(output?.score || 0),
          signature: clipText(output?.signature || '', 24)
        };
      }
      return formatToolMeta(toolName, args);
    };
    const formatToolResultPreview = (toolName: string, output: any) => {
      if (toolName === 'music_catalog_lookup') {
        const coverage = output?.coverage;
        const sources = Array.isArray(output?.sources) ? output.sources.length : 0;
        return [
          output?.resolvedArtist ? `Artiste: ${output.resolvedArtist}` : null,
          Array.isArray(output?.missingConfirmed) ? `${output.missingConfirmed.length} titre(s) confirmes manquants` : null,
          coverage ? `${coverage.distinctDomains} domaine(s), catalogue=${coverage.hasCatalogPage ? 'oui' : 'non'}, album=${coverage.hasAlbumTracklist ? 'oui' : 'non'}` : null,
          sources > 0 ? `${sources} source(s)` : null,
          output?.partial ? 'Couverture partielle' : 'Couverture confirmee'
        ].filter(Boolean).join(' | ');
      }
      if (toolName === 'web_search') {
        const results = Array.isArray(output?.results) ? output.results : [];
        const queryPrefix = output?.originalQuery
          ? `Requete ajustee au ${requestClock.dateLabel}: ${clipText(output?.query || '', 90)}. `
          : '';
        const qualityPrefix = output?.quality ? `[${String(output.quality)}${output?.provider ? ` via ${output.provider}` : ''}] ` : '';
        const summary = results
          .slice(0, 3)
          .map((result: any, index: number) => `${index + 1}. ${clipText(result.title || result.url || 'Sans titre', 80)}`)
          .join(' | ');
        const warnings = Array.isArray(output?.warnings) && output.warnings.length > 0
          ? ` ${clipText(output.warnings[0], 180)}`
          : '';
        return `${qualityPrefix}${queryPrefix}${summary || clipText(output?.message || output?.error || '', 220)}${warnings}`.trim();
      }
      if (toolName === 'web_fetch') {
        const qualityPrefix = output?.quality ? `[${String(output.quality)}${output?.domain ? ` ${output.domain}` : ''}] ` : '';
        return `${qualityPrefix}${clipText(output?.excerpt || output?.content || output?.message || output?.error || '', 220)}`.trim();
      }
      if (toolName === 'review_pdf_draft') {
        const blocking = Array.isArray(output?.blockingIssues) ? output.blockingIssues.length : 0;
        const improvements = Array.isArray(output?.improvements) ? output.improvements.length : 0;
        const readiness = output?.ready ? 'Pret' : 'A corriger';
        return `${readiness} | score ${Number(output?.score || 0)}/100 | ${blocking} bloquant(s) | ${improvements} amelioration(s)`;
      }
      return clipText(output?.message || output?.error || output, 240);
    };

    let latestApprovedPdfReviewSignature: string | null = null;

    const localTools = [
      {
        name: "report_progress",
        description: "Raisonnement structure obligatoire avant tout outil actionnable. Fournit l'etat des connaissances, le manque precise, le pourquoi du prochain outil, le resultat attendu, le plan B, et un score de completude.",
        parameters: {
          type: "object",
          properties: {
            what_i_know: { type: "string", description: "Ce que tu sais deja de maniere concise." },
            what_i_need: { type: "string", description: "Ce qu'il manque precisement avant de conclure." },
            why_this_tool: { type: "string", description: "Pourquoi le prochain outil aidera concretement." },
            expected_result: { type: "string", description: "Ce que tu esperes obtenir de ce prochain outil." },
            fallback_plan: { type: "string", description: "Que faire si le prochain outil echoue ou revient degrade." },
            completion: {
              type: "object",
              properties: {
                score: { type: "number", description: "Estimation de completude en pourcentage, de 0 a 100." },
                taskComplete: { type: "boolean", description: "true uniquement si tu estimes pouvoir livrer sans autre outil." },
                phase: { type: "string", description: "Une des phases: analysis, research, verification, production, delivery, completed." }
              },
              required: ["score", "taskComplete", "phase"]
            }
          },
          required: [
            "what_i_know",
            "what_i_need",
            "why_this_tool",
            "expected_result",
            "fallback_plan",
            "completion"
          ]
        },
        execute: (args: {
          what_i_know: string;
          what_i_need: string;
          why_this_tool: string;
          expected_result: string;
          fallback_plan: string;
          completion: {
            score: number;
            taskComplete: boolean;
            phase: string;
          };
        }) => ({
          success: true,
          reasoning: parseReasoningPayload(args)
        })
      },
      {
        name: "music_catalog_lookup",
        description: "Resout un artiste musical et compare les titres deja possedes avec les sorties officielles confirmees (singles, album, feats optionnels). A utiliser en premier pour les demandes du type 'qu'est-ce qu'il me manque ?'.",
        parameters: {
          type: "object",
          properties: {
            artistQuery: { type: "string", description: "Pseudo exact de l'artiste a verifier." },
            ownedTracks: {
              type: "array",
              description: "Titres que l'utilisateur dit deja posseder.",
              items: { type: "string" }
            },
            includeFeatures: { type: "boolean", description: "Inclure les feats et apparitions." },
            includeUnofficial: { type: "boolean", description: "Inclure les freestyles, videos ou sorties non strictement catalogue." }
          },
          required: ["artistQuery"]
        },
        execute: async ({
          artistQuery,
          ownedTracks,
          includeFeatures,
          includeUnofficial
        }: {
          artistQuery: string;
          ownedTracks?: string[];
          includeFeatures?: boolean;
          includeUnofficial?: boolean;
        }) => {
          return musicCatalogLookup({
            artistQuery,
            ownedTracks,
            includeFeatures,
            includeUnofficial,
            originalMessage: message
          });
        }
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
          if (path.extname(filePath).toLowerCase() === '.pdf') {
            return {
              success: false,
              error: "N'ecris jamais un PDF brut via 'write_file'. Utilise l'outil 'create_pdf' pour generer un vrai PDF."
            };
          }
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
          const effectiveQuery = alignSearchQueryWithRequest(query, message, requestClock);
          const outcome = await searchWeb(
            effectiveQuery,
            Math.max(1, Math.min(maxResults || 5, 8)),
            { strictFactual: strictFactualSearch }
          );
          const resultCount = outcome.results.length;
          return {
            success: outcome.success,
            query: effectiveQuery,
            ...(effectiveQuery !== query ? { originalQuery: query } : {}),
            provider: outcome.provider,
            quality: outcome.quality,
            relevanceScore: outcome.relevanceScore,
            matchedAnchors: outcome.matchedAnchors,
            fallbackUsed: outcome.fallbackUsed,
            warnings: outcome.warnings,
            results: outcome.results,
            ...(outcome.error ? { error: outcome.error } : {}),
            message:
              effectiveQuery !== query
                ? `${resultCount} resultat(s) pour "${effectiveQuery}" via ${outcome.provider}. Qualite: ${outcome.quality}. Requete re-alignee sur la date du jour (${requestClock.dateLabel}).`
                : `${resultCount} resultat(s) pour "${effectiveQuery}" via ${outcome.provider}. Qualite: ${outcome.quality}.`
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
            message: `Source lue avec succes: ${page.title} (${page.quality}).`
          };
        }
      }] : []),
      {
        name: "review_pdf_draft",
        description: "Relit un brouillon de PDF avant export. A utiliser avant 'create_pdf' pour les PDF exigeants, longs, soignes ou les documents formels. Retourne un score, des points forts et les points bloquants a corriger.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Titre principal du document." },
            subtitle: { type: "string", description: "Sous-titre ou chapo du document (optionnel)." },
            summary: { type: "string", description: "Resume executif ou introduction mise en avant (optionnel)." },
            author: { type: "string", description: "Auteur ou signataire pressenti (optionnel)." },
            sources: {
              type: "array",
              description: "Liste optionnelle de sources ou liens a afficher en fin de document.",
              items: { type: "string" }
            },
            sections: {
              type: "array",
              description: "Liste de sections du document. Chaque section a un 'heading' optionnel et un 'body'.",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Titre de la section (optionnel)." },
                  body: { type: "string", description: "Contenu texte de la section." }
                }
              }
            }
          },
          required: ["title", "sections"]
        },
        execute: async ({
          title,
          subtitle,
          summary,
          author,
          sources,
          sections
        }: {
          title: string;
          subtitle?: string;
          summary?: string;
          author?: string;
          sources?: string[];
          sections: PdfSectionInput[];
        }) => {
          const draft = buildPdfDraftSnapshot({
            title,
            subtitle,
            summary,
            author,
            sources,
            sections
          });
          const review = reviewPdfDraft(message, draft, pdfQualityTargets);
          if (review.ready) {
            latestApprovedPdfReviewSignature = review.signature;
          }
          return review;
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
        description: "Crée un fichier PDF directement. Utilise cet outil pour générer des PDFs au lieu d'écrire un script Python. Pour les PDF exigeants ou documents formels, passe d'abord par 'review_pdf_draft'. Le fichier est créé dans /tmp/.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Nom du fichier PDF (ex: rapport.pdf). Sera créé dans /tmp/." },
            title: { type: "string", description: "Titre principal du document." },
            subtitle: { type: "string", description: "Sous-titre ou chapo du document (optionnel)." },
            summary: { type: "string", description: "Resume executif ou introduction mise en avant (optionnel)." },
            accentColor: { type: "string", description: "Couleur d'accent HEX (ex: #0f766e)." },
            author: { type: "string", description: "Nom de l'auteur ou de la signature (optionnel)." },
            sources: {
              type: "array",
              description: "Liste optionnelle de sources ou liens a afficher en fin de document.",
              items: { type: "string" }
            },
            showPageNumbers: { type: "boolean", description: "Afficher les numeros de page dans le pied de page." },
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
        execute: async ({
          filename,
          title,
          subtitle,
          summary,
          accentColor,
          author,
          sources,
          showPageNumbers,
          sections
        }: {
          filename: string;
          title: string;
          subtitle?: string;
          summary?: string;
          accentColor?: string;
          author?: string;
          sources?: string[];
          showPageNumbers?: boolean;
          sections: Array<{ heading?: string, body: string }>;
        }) => {
          const outputPath = path.join('/tmp', filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
          const draft = buildPdfDraftSnapshot({
            title,
            subtitle,
            summary,
            author,
            sections,
            sources
          });
          const effectiveSections = draft.sections;
          const effectiveSources = draft.sources;
          const formalDocumentLayout = Boolean(pdfQualityTargets?.formalDocument || requestNeedsFormalDocument(message));
          const requireInventedDetails = Boolean(pdfQualityTargets?.requireInventedDetails || requestNeedsFictionalDetails(message));
          const combinedContent = buildPdfDraftCombinedContent(draft);
          const draftReview = reviewPdfDraft(message, draft, pdfQualityTargets);
          const reviewRequired = requestNeedsPdfSelfReview(message);

          if (effectiveSections.length === 0) {
            return {
              success: false,
              recoverable: true,
              error: "Le PDF doit contenir au moins une section non vide."
            };
          }

          if (reviewRequired && latestApprovedPdfReviewSignature !== draftReview.signature) {
            return {
              success: false,
              recoverable: true,
              reviewRequired: true,
              signature: draftReview.signature,
              review: {
                ready: draftReview.ready,
                score: draftReview.score,
                blockingIssues: draftReview.blockingIssues,
                improvements: draftReview.improvements
              },
              error: draftReview.ready
                ? "Avant l'export PDF final, fais une passe visible avec 'review_pdf_draft' sur ce brouillon exact, puis relance 'create_pdf'."
                : `Le brouillon n'est pas encore pret pour l'export. Passe par 'review_pdf_draft', corrige les points bloquants (${draftReview.blockingIssues.join('; ')}), puis relance 'create_pdf'.`
            };
          }

          const totalWords = countWords(combinedContent);

          if (formalDocumentLayout) {
            const formalSignalCount = countFormalDocumentSignals(combinedContent);
            if (formalSignalCount < 4) {
              return {
                success: false,
                recoverable: true,
                error: "Document formel trop pauvre ou trop generique. Ajoute des blocs distincts pour l'emetteur, le beneficiaire ou sujet, la periode ou le contexte, puis une validation finale avec date/lieu/signature avant de relancer 'create_pdf'."
              };
            }
          }

          if (requireInventedDetails) {
            const placeholderCount = countTemplatePlaceholders(combinedContent);
            if (placeholderCount > 0) {
              return {
                success: false,
                recoverable: true,
                error: "L'utilisateur a demande un document fictif complet, mais le brouillon contient encore des placeholders ([...], <...> ou lignes a remplir). Remplace-les par des details credibles avant de relancer 'create_pdf'."
              };
            }
          }

          if (pdfQualityTargets) {
            const tooFewSections = effectiveSections.length < pdfQualityTargets.minSections;
            const tooFewWords = totalWords < pdfQualityTargets.minWords;
            if (tooFewSections || tooFewWords) {
              return {
                success: false,
                recoverable: true,
                error: `PDF trop court pour la demande. Minimum attendu: ${pdfQualityTargets.minSections} sections utiles et environ ${pdfQualityTargets.minWords} mots. Actuel: ${effectiveSections.length} section(s) et ${totalWords} mots. Elargis le plan, ajoute plus de developpement, de contexte, de synthese et de sources avant de relancer 'create_pdf'.`
              };
            }
          }

          return new Promise<any>((resolve, reject) => {
            try {
              const doc = new PDFDocument({
                size: 'A4',
                margins: { top: 72, right: 64, bottom: 64, left: 64 },
                bufferPages: true,
                autoFirstPage: false,
                info: {
                  Title: title,
                  Author: author || 'Studio Pro Agent',
                  Subject: subtitle || title,
                  Creator: 'Studio Pro Agent'
                }
              });
              const stream = fs.createWriteStream(outputPath);
              const palette = {
                accent: normalizeHexColor(accentColor, formalDocumentLayout ? '#334155' : requestNeedsLongFormPdf(message) ? '#0f766e' : '#1d4ed8'),
                ink: '#0f172a',
                muted: '#475569',
                line: '#dbe4ee',
                panel: formalDocumentLayout ? '#ffffff' : '#f8fafc',
                white: '#ffffff'
              };
              const summaryText = formalDocumentLayout
                ? clipText(summary || '', 420)
                : clipText(summary || effectiveSections[0]?.body || '', 900);
              const tocHeadings = effectiveSections
                .map(section => section.heading)
                .filter((heading): heading is string => Boolean(heading))
                .slice(0, 8);
              const useCoverPage =
                !formalDocumentLayout
                && (
                  Boolean(summaryText)
                  || Boolean(subtitle)
                  || Boolean(author)
                  || Boolean(pdfQualityTargets)
                  || effectiveSections.length >= 4
                );
              const bodyWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
              const pageBottom = () => doc.page.height - doc.page.margins.bottom - 24;

              const drawBodyHeader = () => {
                if (formalDocumentLayout) {
                  doc.y = 72;
                  return;
                }
                doc.save();
                doc.fillColor(palette.white).rect(0, 0, doc.page.width, 58).fill();
                doc.fillColor(palette.accent).rect(doc.page.margins.left, 30, 50, 4).fill();
                doc
                  .fillColor(palette.ink)
                  .font('Helvetica-Bold')
                  .fontSize(9.5)
                  .text('Studio Pro / Cowork Report', doc.page.margins.left + 60, 24);
                doc
                  .fillColor(palette.muted)
                  .font('Helvetica')
                  .fontSize(8.5)
                  .text(requestClock.dateLabel, doc.page.margins.left + 60, 36);
                doc.restore();
                doc.y = 86;
              };

              const ensureSpace = (minHeight = 120) => {
                if (doc.y + minHeight > pageBottom()) {
                  doc.addPage();
                  drawBodyHeader();
                }
              };

              const renderParagraph = (text: string) => {
                const cleaned = text.replace(/\s+/g, ' ').trim();
                if (!cleaned) return;
                ensureSpace(72);
                doc
                  .fillColor(palette.ink)
                  .font('Helvetica')
                  .fontSize(formalDocumentLayout ? 11.2 : 11.5)
                  .text(cleaned, {
                    width: bodyWidth(),
                    align: formalDocumentLayout ? 'left' : 'justify',
                    lineGap: formalDocumentLayout ? 4 : 3
                  });
                doc.moveDown(formalDocumentLayout ? 0.95 : 0.75);
              };

              const renderBullet = (text: string) => {
                const cleaned = text.replace(/\s+/g, ' ').trim();
                if (!cleaned) return;
                ensureSpace(40);
                const bulletX = doc.page.margins.left + 6;
                const textX = doc.page.margins.left + 18;
                const startY = doc.y;

                doc.save();
                doc.fillColor(palette.accent).circle(bulletX, startY + 7, 2.5).fill();
                doc.restore();

                doc
                  .fillColor(palette.ink)
                  .font('Helvetica')
                  .fontSize(formalDocumentLayout ? 11 : 11.2)
                  .text(cleaned, textX, startY, {
                    width: bodyWidth() - 18,
                    lineGap: formalDocumentLayout ? 4 : 3
                  });
                doc.moveDown(0.35);
              };

              const renderRichText = (body: string) => {
                let paragraphBuffer: string[] = [];
                const flushParagraph = () => {
                  if (paragraphBuffer.length === 0) return;
                  renderParagraph(paragraphBuffer.join(' '));
                  paragraphBuffer = [];
                };

                for (const rawLine of body.split('\n')) {
                  const line = rawLine.trim();
                  if (!line) {
                    flushParagraph();
                    continue;
                  }
                  if (/^(?:[-*]\s+|•\s+)/.test(line)) {
                    flushParagraph();
                    renderBullet(line.replace(/^(?:[-*]\s+|•\s+)/, ''));
                    continue;
                  }
                  paragraphBuffer.push(line);
                }

                flushParagraph();
              };

              const renderCallout = (heading: string, body: string) => {
                const cleaned = body.trim();
                if (!cleaned) return;
                if (formalDocumentLayout) {
                  renderParagraph(cleaned);
                  return;
                }
                doc.font('Helvetica').fontSize(11.5);
                const boxHeight = Math.min(
                  210,
                  Math.max(92, doc.heightOfString(cleaned, { width: bodyWidth() - 36, lineGap: 3 }) + 34)
                );
                ensureSpace(boxHeight + 20);
                const startY = doc.y;

                doc.save();
                doc.lineWidth(1).fillColor(palette.panel).strokeColor(palette.line);
                doc.roundedRect(doc.page.margins.left, startY, bodyWidth(), boxHeight, 14).fillAndStroke();
                doc.fillColor(palette.accent).rect(doc.page.margins.left + 18, startY + 18, 42, 4).fill();
                doc
                  .fillColor(palette.muted)
                  .font('Helvetica-Bold')
                  .fontSize(10)
                  .text(heading.toUpperCase(), doc.page.margins.left + 18, startY + 28, {
                    width: bodyWidth() - 36
                  });
                doc
                  .fillColor(palette.ink)
                  .font('Helvetica')
                  .fontSize(11.5)
                  .text(cleaned, doc.page.margins.left + 18, startY + 48, {
                    width: bodyWidth() - 36,
                    lineGap: 3,
                    align: 'justify'
                  });
                doc.restore();
                doc.y = startY + boxHeight + 16;
              };

              const renderSection = (heading: string | undefined, body: string) => {
                if (heading) {
                  ensureSpace(formalDocumentLayout ? 74 : 96);
                  if (formalDocumentLayout) {
                    doc
                      .fillColor(palette.ink)
                      .font('Helvetica-Bold')
                      .fontSize(12.5)
                      .text(heading.toUpperCase(), {
                        width: bodyWidth()
                      });
                    doc.moveDown(0.15);
                    const dividerY = doc.y + 1;
                    doc.save();
                    doc.strokeColor(palette.line).lineWidth(1);
                    doc.moveTo(doc.page.margins.left, dividerY).lineTo(doc.page.width - doc.page.margins.right, dividerY).stroke();
                    doc.restore();
                    doc.moveDown(0.55);
                  } else {
                    doc.fillColor(palette.accent).rect(doc.page.margins.left, doc.y + 9, 10, 10).fill();
                    doc
                      .fillColor(palette.ink)
                      .font('Helvetica-Bold')
                      .fontSize(18)
                      .text(heading, doc.page.margins.left + 20, doc.y, {
                        width: bodyWidth() - 20
                      });
                    doc.moveDown(0.2);
                    const dividerY = doc.y + 2;
                    doc.save();
                    doc.strokeColor(palette.line).lineWidth(1);
                    doc.moveTo(doc.page.margins.left, dividerY).lineTo(doc.page.width - doc.page.margins.right, dividerY).stroke();
                    doc.restore();
                    doc.moveDown(0.7);
                  }
                }
                renderRichText(body);
              };

              doc.pipe(stream);
              if (true) {
                if (useCoverPage) {
                  doc.addPage();
                  const coverWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
                  const coverHeight = doc.page.height;

                  doc.save();
                  doc.fillColor(palette.panel).rect(0, 0, doc.page.width, coverHeight).fill();
                  doc.fillColor(palette.accent).rect(0, 0, doc.page.width, 152).fill();
                  doc
                    .fillColor(palette.white)
                    .font('Helvetica-Bold')
                    .fontSize(11)
                    .text('STUDIO PRO / COWORK', doc.page.margins.left, 54);
                  doc
                    .fillColor(palette.white)
                    .font('Helvetica')
                    .fontSize(10.5)
                    .text(requestClock.absoluteDateTimeLabel, doc.page.margins.left, 76);
                  doc.restore();

                  doc.y = 184;
                  doc
                    .fillColor(palette.ink)
                    .font('Helvetica-Bold')
                    .fontSize(29)
                    .text(title, doc.page.margins.left, doc.y, {
                      width: coverWidth
                    });
                  if (subtitle) {
                    doc.moveDown(0.35);
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica')
                      .fontSize(14)
                      .text(subtitle, {
                        width: coverWidth
                      });
                  }
                  if (author) {
                    doc.moveDown(0.45);
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica-Bold')
                      .fontSize(10)
                      .text(`Par ${author}`, {
                        width: coverWidth
                      });
                  }

                  let nextBoxY = Math.max(doc.y + 26, 336);
                  if (summaryText) {
                    doc.font('Helvetica').fontSize(11.5);
                    const summaryBoxHeight = Math.min(
                      185,
                      Math.max(106, doc.heightOfString(summaryText, { width: coverWidth - 40, lineGap: 3 }) + 44)
                    );
                    doc.save();
                    doc.lineWidth(1).fillColor(palette.white).strokeColor(palette.line);
                    doc.roundedRect(doc.page.margins.left, nextBoxY, coverWidth, summaryBoxHeight, 16).fillAndStroke();
                    doc.fillColor(palette.accent).rect(doc.page.margins.left + 20, nextBoxY + 18, 46, 4).fill();
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica-Bold')
                      .fontSize(10)
                      .text('RESUME EXECUTIF', doc.page.margins.left + 20, nextBoxY + 30, {
                        width: coverWidth - 40
                      });
                    doc
                      .fillColor(palette.ink)
                      .font('Helvetica')
                      .fontSize(11.5)
                      .text(summaryText, doc.page.margins.left + 20, nextBoxY + 52, {
                        width: coverWidth - 40,
                        lineGap: 3,
                        align: 'justify'
                      });
                    doc.restore();
                    nextBoxY += summaryBoxHeight + 18;
                  }

                  if (tocHeadings.length > 0 && nextBoxY < doc.page.height - 110) {
                    const tocHeight = Math.max(112, 42 + tocHeadings.length * 18);
                    doc.save();
                    doc.lineWidth(1).fillColor(palette.white).strokeColor(palette.line);
                    doc.roundedRect(doc.page.margins.left, nextBoxY, coverWidth, tocHeight, 16).fillAndStroke();
                    doc.fillColor(palette.accent).rect(doc.page.margins.left + 20, nextBoxY + 18, 46, 4).fill();
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica-Bold')
                      .fontSize(10)
                      .text('PLAN DU DOCUMENT', doc.page.margins.left + 20, nextBoxY + 30, {
                        width: coverWidth - 40
                      });

                    let tocY = nextBoxY + 56;
                    tocHeadings.forEach((heading, index) => {
                      doc.fillColor(palette.accent).circle(doc.page.margins.left + 24, tocY + 6, 2.5).fill();
                      doc
                        .fillColor(palette.ink)
                        .font('Helvetica')
                        .fontSize(11)
                        .text(`${index + 1}. ${heading}`, doc.page.margins.left + 36, tocY, {
                          width: coverWidth - 56
                        });
                      tocY += 18;
                    });
                    doc.restore();
                  }
                }

                doc.addPage();
                if (formalDocumentLayout) {
                  doc.y = 62;
                  doc
                    .fillColor(palette.muted)
                    .font('Helvetica')
                    .fontSize(10)
                    .text(requestClock.dateLabel, {
                      width: bodyWidth(),
                      align: 'right'
                    });
                  if (author) {
                    doc.moveDown(0.2);
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica')
                      .fontSize(10)
                      .text(author, {
                        width: bodyWidth(),
                        align: 'right'
                      });
                  }
                  doc.moveDown(1.1);
                  doc
                    .fillColor(palette.ink)
                    .font('Helvetica-Bold')
                    .fontSize(20)
                    .text(title, {
                      width: bodyWidth(),
                      align: 'center'
                    });
                  if (subtitle) {
                    doc.moveDown(0.35);
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica')
                      .fontSize(11.5)
                      .text(subtitle, {
                        width: bodyWidth(),
                        align: 'center'
                      });
                  }
                  doc.moveDown(1.1);
                } else {
                  drawBodyHeader();
                }

                if (!useCoverPage && !formalDocumentLayout) {
                  doc
                    .fillColor(palette.ink)
                    .font('Helvetica-Bold')
                    .fontSize(24)
                    .text(title, {
                      width: bodyWidth()
                    });
                  if (subtitle) {
                    doc.moveDown(0.35);
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica')
                      .fontSize(13)
                      .text(subtitle, {
                        width: bodyWidth()
                      });
                  }
                  doc.moveDown(0.6);
                }

                if (summaryText) {
                  renderCallout(formalDocumentLayout ? 'Introduction' : 'Resume executif', summaryText);
                }

                for (const section of effectiveSections) {
                  renderSection(section.heading, section.body);
                }

                if (effectiveSources.length > 0) {
                  renderSection(
                    'Sources et liens',
                    effectiveSources.map(source => `- ${source}`).join('\n')
                  );
                }

                const bufferedPages = doc.bufferedPageRange();
                const pageCount = bufferedPages.count;

                for (let pageIndex = 0; pageIndex < bufferedPages.count; pageIndex++) {
                  doc.switchToPage(bufferedPages.start + pageIndex);
                  const pageNumber = pageIndex + 1;
                  const shouldDrawHeader = !formalDocumentLayout && (!useCoverPage || pageNumber > 1);

                  if (shouldDrawHeader) {
                    doc.save();
                    doc.strokeColor(palette.line).lineWidth(1);
                    doc.moveTo(doc.page.margins.left, 60).lineTo(doc.page.width - doc.page.margins.right, 60).stroke();
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica')
                      .fontSize(8.5)
                      .text(title, doc.page.margins.left, 42, {
                        width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 70
                      });
                    doc.fillColor(palette.accent).rect(doc.page.width - doc.page.margins.right - 46, 44, 46, 4).fill();
                    doc.restore();
                  }

                  if (showPageNumbers !== false && (!formalDocumentLayout || pageCount > 1)) {
                    doc.save();
                    doc.strokeColor(palette.line).lineWidth(1);
                    doc.moveTo(doc.page.margins.left, doc.page.height - 48).lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 48).stroke();
                    doc
                      .fillColor(palette.muted)
                      .font('Helvetica')
                      .fontSize(8)
                      .text(
                        formalDocumentLayout
                          ? `Page ${pageNumber}/${pageCount}`
                          : `Studio Pro Agent | ${requestClock.footerDateLabel} | Page ${pageNumber}/${pageCount}`,
                        doc.page.margins.left,
                        doc.page.height - 36,
                        {
                          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                          align: 'center'
                        }
                      );
                    doc.restore();
                  }
                }

                doc.end();
              } else {

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

              }

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
      }, {
        originalMessage: message,
        requestClock
      })
    };
    if (tools) genConfig.tools = tools;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    headersSent = true;

    let contents = [...history, { role: 'user' as const, parts: [{ text: message }] }];
    let iterations = 0;
    const FAILSAFE_MAX_ITERATIONS = 50;
    let finalVisibleText = '';
    let latestReleasedFile: { url: string; path?: string } | null = null;
    let latestCreatedArtifactPath: string | null = null;
    const runMeta = createEmptyCoworkRunMeta();
    let sessionState = createEmptyCoworkSessionState();

    const toolFailureScopes = new Map<string, number>();
    const MAX_TOOL_FAILURES = 2;
    const successfulResearchMeta: MusicResearchProgress = {
      webSearches: 0,
      webFetches: 0,
      degradedSearches: 0,
      blockedQueryFamilies: 0,
      musicCatalogCompleted: false,
      musicCatalogCoverage: null
    };
    const blockedSearchFamilies = new Set<string>();
    const weakSearchFamilies = new Map<string, number>();
    let lastSearchExactKey: string | null = null;

    const syncRunMeta = () => {
      runMeta.phase = sessionState.phase;
      runMeta.completionScore = sessionState.completionScore;
      runMeta.modelCompletionScore = sessionState.modelCompletionScore;
      runMeta.taskComplete = sessionState.effectiveTaskComplete;
      runMeta.blockerCount = sessionState.blockers.length;
      runMeta.validatedSources = sessionState.sourcesValidated.length;
      runMeta.blockedQueryFamilies = blockedSearchFamilies.size;
    };

    const refreshSessionState = () => {
      sessionState = computeCompletionState({
        originalMessage: message,
        requestClock,
        state: sessionState,
        research: successfulResearchMeta,
        latestCreatedArtifactPath,
        latestReleasedFile,
        latestApprovedPdfReviewSignature
      });
      syncRunMeta();
    };

    const recordBlockedTool = (toolName: string, scope: string, reason: string, until?: number) => {
      sessionState.toolsBlocked = [
        ...sessionState.toolsBlocked.filter(item => !(item.toolName === toolName && item.scope === scope)),
        { toolName, scope, reason, until }
      ].slice(-12);
    };

    const addValidatedSource = (source: CoworkValidatedSource) => {
      if (sessionState.sourcesValidated.some(item => item.url === source.url)) return;
      sessionState.sourcesValidated = [...sessionState.sourcesValidated, source].slice(-12);
    };

    const addFacts = (...values: string[]) => {
      sessionState.factsCollected = dedupeStrings([...sessionState.factsCollected, ...values], 10);
    };

    const recordSearchFailure = (failure: CoworkSearchFailure) => {
      sessionState.searchesFailed = [...sessionState.searchesFailed, failure].slice(-16);
    };

    const getToolFailureScope = (toolName: string, args: any) => {
      if (toolName === 'web_search') {
        const query = String(args?.query || '').trim();
        const normalizedQuery = normalizeCoworkText(query).replace(/\s+/g, ' ').trim() || 'vide';
        const family = extractSearchAnchorTokens(query).slice(0, 3).join(' ') || normalizedQuery;
        return {
          exactKey: `${toolName}:query:${normalizedQuery}`,
          familyKey: `${toolName}:family:${family}`,
          label: query || '(requete vide)'
        };
      }

      if (toolName === 'web_fetch') {
        const url = String(args?.url || '').trim();
        const parsed = safeParseUrl(url);
        const normalizedUrl = parsed ? parsed.toString().split('#')[0] : normalizeCoworkText(url);
        const hostname = parsed ? stripWww(parsed.hostname) : normalizeCoworkText(url);
        return {
          exactKey: `${toolName}:url:${normalizedUrl || 'vide'}`,
          familyKey: `${toolName}:host:${hostname || 'vide'}`,
          label: url || '(url vide)'
        };
      }

      return {
        exactKey: `${toolName}:global`,
        familyKey: `${toolName}:global`,
        label: toolName
      };
    };

    const getToolFailureCount = (scope: { exactKey: string; familyKey: string }) => {
      return Math.max(
        toolFailureScopes.get(scope.exactKey) || 0,
        toolFailureScopes.get(scope.familyKey) || 0
      );
    };

    const clearToolFailures = (scope: { exactKey: string; familyKey: string }) => {
      toolFailureScopes.delete(scope.exactKey);
      toolFailureScopes.delete(scope.familyKey);
    };

    const recordToolFailure = (
      scope: { exactKey: string; familyKey: string },
      transient: boolean
    ) => {
      if (transient) return 0;
      const nextExact = (toolFailureScopes.get(scope.exactKey) || 0) + 1;
      const nextFamily = (toolFailureScopes.get(scope.familyKey) || 0) + 1;
      toolFailureScopes.set(scope.exactKey, nextExact);
      toolFailureScopes.set(scope.familyKey, nextFamily);
      return Math.max(nextExact, nextFamily);
    };

    const recordWeakSearch = (scope: { exactKey: string; familyKey: string }) => {
      const nextWeakCount = (weakSearchFamilies.get(scope.familyKey) || 0) + 1;
      weakSearchFamilies.set(scope.familyKey, nextWeakCount);
      sessionState.consecutiveDegradedSearches[scope.familyKey] = nextWeakCount;
      if (nextWeakCount >= 2) {
        blockedSearchFamilies.add(scope.familyKey);
        recordBlockedTool('web_search', scope.familyKey, 'weak_search_family');
      }
      runMeta.blockedQueryFamilies = blockedSearchFamilies.size;
      successfulResearchMeta.blockedQueryFamilies = blockedSearchFamilies.size;
      return nextWeakCount;
    };

    const clearWeakSearch = (scope: { exactKey: string; familyKey: string }) => {
      weakSearchFamilies.delete(scope.familyKey);
      blockedSearchFamilies.delete(scope.familyKey);
      delete sessionState.consecutiveDegradedSearches[scope.familyKey];
      runMeta.blockedQueryFamilies = blockedSearchFamilies.size;
      successfulResearchMeta.blockedQueryFamilies = blockedSearchFamilies.size;
    };

    const isTransientToolIssue = (toolName: string, errorLike: unknown) => {
      if (toolName !== 'web_search' && toolName !== 'web_fetch') return false;
      const normalized = normalizeCoworkText(parseApiError(errorLike));
      return /\b(403|429|quota|simultan|concurrent|temporar|indisponible|unavailable|deadline exceeded|too many requests|saturation)\b/.test(normalized);
    };

    const getActiveCooldown = (scopeKey: string): ToolCooldownState | null => {
      const cooldown = sessionState.cooldowns[scopeKey];
      if (!cooldown) return null;
      if (cooldown.until <= Date.now()) {
        delete sessionState.cooldowns[scopeKey];
        return null;
      }
      return cooldown;
    };

    const registerTransientCooldown = (scopeKey: string, reason: string) => {
      const current = sessionState.cooldowns[scopeKey];
      const attempts = Math.min(4, (current?.attempts || 0) + 1);
      const delayMs = getCooldownDelayMs(attempts);
      sessionState.cooldowns[scopeKey] = {
        attempts,
        until: Date.now() + delayMs,
        reason
      };
      return delayMs;
    };

    const clearTransientCooldown = (scopeKey: string) => {
      delete sessionState.cooldowns[scopeKey];
    };

    refreshSessionState();

    const gateKey = sessionId ? `session:${sessionId}` : `ip:${req.ip || 'unknown'}`;
    const gate = await acquireCoworkRunGate(gateKey);
    releaseCoworkRunGate = gate.release;
    if (gate.waitMs > 0) {
      runMeta.queueWaitMs += gate.waitMs;
      emitEvent('status', {
        iteration: 0,
        title: 'File d attente',
        message: `Un autre run Cowork etait deja actif sur cette conversation. Demarrage apres ${formatWaitDuration(gate.waitMs)} d'attente.`,
        runState: 'running',
        runMeta
      });
    }

    emitEvent('status', {
      iteration: 0,
      title: 'Initialisation',
      message: 'Cowork prepare la tache.',
      runState: 'running',
      runMeta
    });

    while (iterations < FAILSAFE_MAX_ITERATIONS) {
      iterations++;
      log.info(`Cowork iteration ${iterations} for model ${modelId}`);
      runMeta.iterations = Math.max(runMeta.iterations, iterations);

      const response = await retryWithBackoff(() => ai.models.generateContent({
        model: modelId,
        contents,
        config: genConfig
      }), {
        maxRetries: 3,
        exactDelaysMs: [2000, 4000, 8000],
        jitter: false,
        onRetry: async ({ delayMs, kind, message: retryMessage }) => {
          runMeta.retryCount += 1;
          emitEvent('warning', {
            iteration: iterations,
            title: 'Attente modele',
            message:
              kind === 'concurrency'
                ? `Saturation simultanee detectee. Nouvelle tentative dans ${formatWaitDuration(delayMs)}. ${retryMessage}`
                : kind === 'server'
                  ? `Le modele est temporairement indisponible. Nouvelle tentative dans ${formatWaitDuration(delayMs)}. ${retryMessage}`
                  : `Quota ou limite temporaire detecte. Nouvelle tentative dans ${formatWaitDuration(delayMs)}. ${retryMessage}`,
            runMeta
          });
        }
      });
      accumulateUsageTotals(runMeta, modelId, response);

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
        const reportCalls = functionCalls.filter(call => call.name === 'report_progress');
        const actionableCalls = functionCalls.filter(call => call.name !== 'report_progress');
        const reportIndex = functionCalls.findIndex(call => call.name === 'report_progress');
        const firstActionableIndex = functionCalls.findIndex(call => call.name !== 'report_progress');
        let turnViolation: string | null = null;

        if (reportCalls.length > 1) {
          turnViolation = "N'envoie qu'un seul 'report_progress' par tour.";
        } else if (actionableCalls.length > 1) {
          turnViolation = "N'appelle qu'un seul outil actionnable par tour.";
        } else if (actionableCalls.length === 1 && reportCalls.length !== 1) {
          turnViolation = "Tu dois appeler 'report_progress' juste avant l'outil actionnable.";
        } else if (reportCalls.length === 1 && actionableCalls.length === 1 && reportIndex > firstActionableIndex) {
          turnViolation = "'report_progress' doit venir avant l'outil actionnable, jamais apres.";
        }

        if (turnViolation) {
          sessionState.lastReasoning = null;
          sessionState.reasoningReady = false;
          refreshSessionState();
          emitEvent('warning', {
            iteration: iterations,
            title: 'Tour refuse',
            message: turnViolation,
            runMeta
          });
          contents.push({
            role: 'user',
            parts: [{ text: `${turnViolation}\nReprends proprement avec un seul 'report_progress' structure, puis au besoin un seul outil actionnable.` }]
          });
          continue;
        }

        const toolResults: any[] = [];
        let abortToolTurn = false;

        for (const call of functionCalls) {
          const tool = localTools.find(t => t.name === call.name);
          if (tool) {
            if (tool.name === 'report_progress') {
              const output = await tool.execute(call.args);
              const reasoning = (output as any)?.reasoning as CoworkReasoning | null;
              toolResults.push({
                functionResponse: {
                  ...(call.id ? { id: call.id } : {}),
                  name: tool.name,
                  response: output
                }
              });
              clearToolFailures(getToolFailureScope(tool.name, call.args));
              if (!reasoning) {
                sessionState.lastReasoning = null;
                sessionState.reasoningReady = false;
                refreshSessionState();
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Raisonnement invalide',
                  message: "Le 'report_progress' ne respecte pas le schema obligatoire.",
                  runMeta
                });
                contents.push({
                  role: 'user',
                  parts: [{ text: "Le 'report_progress' est invalide. Renvoye-le avec: what_i_know, what_i_need, why_this_tool, expected_result, fallback_plan, completion.score, completion.taskComplete, completion.phase." }]
                });
                abortToolTurn = true;
                break;
              }

              sessionState.lastReasoning = reasoning;
              sessionState.reasoningReady = true;
              sessionState.phase = reasoning.completion.phase;
              sessionState.modelCompletionScore = reasoning.completion.score;
              sessionState.modelTaskComplete = reasoning.completion.taskComplete;
              addFacts(reasoning.what_i_know);
              refreshSessionState();
              emitEvent('reasoning', {
                iteration: iterations,
                title: `Phase ${reasoning.completion.phase}`,
                message: summarizeReasoning(reasoning),
                meta: {
                  phase: reasoning.completion.phase,
                  completion: `${reasoning.completion.score}%`,
                  taskComplete: reasoning.completion.taskComplete,
                  blockers: sessionState.blockers.length
                },
                runMeta
              });
              continue;
            }

            const toolScope = getToolFailureScope(tool.name, call.args);
            const activeCooldown = getActiveCooldown(toolScope.familyKey);
            if (activeCooldown) {
              const waitMs = Math.max(0, activeCooldown.until - Date.now());
              recordBlockedTool(tool.name, toolScope.familyKey, 'cooldown_active', activeCooldown.until);
              refreshSessionState();
              toolResults.push({
                functionResponse: {
                  ...(call.id ? { id: call.id } : {}),
                  name: tool.name,
                  response: {
                    success: false,
                    transient: true,
                    error: `Le scope '${toolScope.label}' est temporairement en cooldown.`,
                    waitMs
                  }
                }
              });
              emitEvent('warning', {
                iteration: iterations,
                title: 'Cooldown actif',
                message: `Attends encore ${formatWaitDuration(waitMs)} avant de retenter '${clipText(toolScope.label, 120)}'. Pivote sur une autre source ou un autre scope.`,
                toolName: tool.name,
                meta: { scope: clipText(toolScope.label, 120), waitMs },
                runMeta
              });
              continue;
            }

            const currentFailureCount = getToolFailureCount(toolScope);
            if (currentFailureCount >= MAX_TOOL_FAILURES) {
              log.warn(`Anti-loop: tool ${tool.name} scope ${toolScope.label} has failed ${currentFailureCount} times, blocking and injecting guidance`);
              const loopMsg = `L'outil '${tool.name}' est actuellement bloque pour '${toolScope.label}' apres ${currentFailureCount} echecs proches. Change d'angle, de requete ou de source au lieu d'insister.`;
              recordBlockedTool(tool.name, toolScope.familyKey, 'echecs_proches');
              refreshSessionState();
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
                message: `L'outil ${tool.name} est bloque pour '${clipText(toolScope.label, 120)}' apres ${currentFailureCount} echecs proches.`,
                toolName: tool.name,
                meta: { scope: clipText(toolScope.label, 120), reason: 'echecs_proches' },
                runMeta
              });
              continue;
            }

            if (tool.name === 'web_search') {
              if (lastSearchExactKey && toolScope.exactKey === lastSearchExactKey) {
                const loopMsg = `La requete '${toolScope.label}' est identique a la recherche precedente. Change reellement d'angle, ouvre une source directe via 'web_fetch', ou admets que la recherche reste insuffisante.`;
                recordSearchFailure({
                  query: toolScope.label,
                  family: toolScope.familyKey,
                  quality: 'degraded',
                  reason: 'duplicate_query'
                });
                refreshSessionState();
                toolResults.push({
                  functionResponse: {
                    ...(call.id ? { id: call.id } : {}),
                    name: tool.name,
                    response: { success: false, quality: 'degraded', error: loopMsg, warnings: [loopMsg] }
                  }
                });
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Requete repetee',
                  message: loopMsg,
                  toolName: tool.name,
                  meta: { query: clipText(toolScope.label, 120), reason: 'duplicate_query' },
                  runMeta
                });
                continue;
              }

              if (blockedSearchFamilies.has(toolScope.familyKey)) {
                const loopMsg = `La famille de requetes '${toolScope.label}' est bloquee apres plusieurs recherches faibles. Pivote: autre angle, 'web_fetch' direct, outil specialise, ou conclusion honnete d'insuffisance.`;
                recordBlockedTool(tool.name, toolScope.familyKey, 'weak_search_family');
                refreshSessionState();
                toolResults.push({
                  functionResponse: {
                    ...(call.id ? { id: call.id } : {}),
                    name: tool.name,
                    response: { success: false, quality: 'degraded', error: loopMsg, warnings: [loopMsg] }
                  }
                });
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Famille bloquee',
                  message: loopMsg,
                  toolName: tool.name,
                  meta: { family: clipText(toolScope.label, 120), reason: 'weak_family_blocked' },
                  runMeta
                });
                continue;
              }
            }

            runMeta.toolCalls += 1;
            if (tool.name === 'web_search') runMeta.webSearches += 1;
            if (tool.name === 'web_fetch') runMeta.webFetches += 1;

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
              const transientIssue = isError && isTransientToolIssue(tool.name, (output as any).error || (output as any).message || output);
              const recoverableIssue = isError && Boolean((output as any).recoverable);
              const searchQuality = tool.name === 'web_search'
                ? ((output as any).quality as SearchQuality | undefined) || (isError ? 'off_topic' : 'relevant')
                : null;
              const fetchQuality = tool.name === 'web_fetch'
                ? ((output as any).quality as ReadableFetchQuality | undefined) || 'serp'
                : null;
              const hasValidatingFetch = tool.name === 'web_fetch' && fetchQuality === 'full';
              const reviewNotReady = tool.name === 'review_pdf_draft' && (output as any).ready === false;
              const warningResult =
                recoverableIssue
                || transientIssue
                || reviewNotReady
                || (tool.name === 'web_search' && searchQuality !== 'relevant')
                || (tool.name === 'web_fetch' && !hasValidatingFetch);

              if (tool.name === 'web_search') {
                lastSearchExactKey = toolScope.exactKey;
              }

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
                if (!recoverableIssue) {
                  recordToolFailure(toolScope, transientIssue);
                }
                if (transientIssue) {
                  const delayMs = registerTransientCooldown(toolScope.familyKey, parseApiError((output as any).error || output));
                  recordBlockedTool(tool.name, toolScope.familyKey, 'cooldown_active', Date.now() + delayMs);
                }
                if (tool.name === 'web_search') {
                  runMeta.degradedSearches += 1;
                  successfulResearchMeta.degradedSearches += 1;
                  recordSearchFailure({
                    query: String((output as any).query || toolScope.label),
                    family: toolScope.familyKey,
                    provider: (output as any).provider,
                    quality: searchQuality || 'off_topic',
                    transient: transientIssue,
                    reason: String((output as any).error || (output as any).message || 'search_failed')
                  });
                  if (!transientIssue) {
                    const weakCount = recordWeakSearch(toolScope);
                    if (weakCount >= 2) {
                      emitEvent('warning', {
                        iteration: iterations,
                        title: 'Pivot requis',
                        message: `Deux recherches faibles ou plus sur la famille '${clipText(toolScope.label, 120)}'. Change d'angle ou ouvre une source directe.`,
                        toolName: tool.name,
                        meta: { family: clipText(toolScope.label, 120), reason: 'weak_search_family' },
                        runMeta
                      });
                    }
                  }
                }
              } else {
                clearToolFailures(toolScope);
                clearTransientCooldown(toolScope.familyKey);
                if (tool.name === 'web_search') {
                  if (searchQuality === 'relevant') {
                    successfulResearchMeta.webSearches += 1;
                    runMeta.validatedSearches += 1;
                    clearWeakSearch(toolScope);
                  } else {
                    runMeta.degradedSearches += 1;
                    successfulResearchMeta.degradedSearches += 1;
                    recordSearchFailure({
                      query: String((output as any).query || toolScope.label),
                      family: toolScope.familyKey,
                      provider: (output as any).provider,
                      quality: searchQuality || 'degraded',
                      reason: 'degraded_result'
                    });
                    const weakCount = recordWeakSearch(toolScope);
                    if (weakCount >= 2) {
                      emitEvent('warning', {
                        iteration: iterations,
                        title: 'Pivot requis',
                        message: `Les recherches sur '${clipText(toolScope.label, 120)}' restent trop faibles. Ne repete pas la meme famille de requetes.`,
                        toolName: tool.name,
                        meta: { family: clipText(toolScope.label, 120), reason: 'weak_search_family' },
                        runMeta
                      });
                    }
                  }
                }
                if (tool.name === 'web_fetch' && hasValidatingFetch) {
                  successfulResearchMeta.webFetches += 1;
                  addValidatedSource({
                    url: String((output as any).url || (call.args as any)?.url || ''),
                    domain: String((output as any).domain || ''),
                    kind: 'web_fetch'
                  });
                  addFacts(String((output as any).title || ''), String((output as any).excerpt || ''));
                }
                if (tool.name === 'music_catalog_lookup') {
                  successfulResearchMeta.musicCatalogCoverage = (output as any).coverage || null;
                  successfulResearchMeta.musicCatalogCompleted = !(output as any).partial;
                  addFacts(String((output as any).message || ''));
                }
              }

              refreshSessionState();
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
                status: isError
                  ? ((transientIssue || recoverableIssue) ? 'warning' : 'error')
                  : (warningResult ? 'warning' : 'success'),
                resultPreview: formatToolResultPreview(tool.name, output),
                meta: formatToolResultMeta(tool.name, call.args, output),
                runMeta
              });
              if (isError && transientIssue) {
                const waitMs = Math.max(0, (sessionState.cooldowns[toolScope.familyKey]?.until || 0) - Date.now());
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Source degradee',
                  message: `L'outil ${tool.name} a rencontre un incident transitoire sur '${clipText(toolScope.label, 120)}'. Cooldown ${formatWaitDuration(waitMs)} avant retentative sur ce scope.`,
                  toolName: tool.name,
                  meta: { scope: clipText(toolScope.label, 120), waitMs },
                  runMeta
                });
              } else if (isError && recoverableIssue) {
                emitEvent('warning', {
                  iteration: iterations,
                  title: tool.name === 'create_pdf' ? 'PDF a retravailler' : 'Correction requise',
                  message: clipText((output as any).error || (output as any).message || 'Le brouillon doit encore etre ameliore.', 320),
                  toolName: tool.name,
                  meta: formatToolResultMeta(tool.name, call.args, output),
                  runMeta
                });
              } else if (reviewNotReady) {
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Self-review negative',
                  message: clipText((output as any).message || 'Le brouillon PDF doit etre corrige avant export.', 320),
                  toolName: tool.name,
                  meta: formatToolResultMeta(tool.name, call.args, output),
                  runMeta
                });
              } else if (tool.name === 'web_search' && searchQuality && searchQuality !== 'relevant') {
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Recherche degradee',
                  message: `La requete '${clipText((output as any).query || toolScope.label, 120)}' n'a pas valide suffisamment le sujet. Ce resultat ne compte pas comme preuve.`,
                  toolName: tool.name,
                  meta: formatToolResultMeta(tool.name, call.args, output),
                  runMeta
                });
              } else if (tool.name === 'web_fetch' && !hasValidatingFetch) {
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Source non validante',
                  message: `La lecture de '${clipText((output as any).url || toolScope.label, 120)}' est ${fetchQuality || 'partielle'} et ne valide pas encore la recherche.`,
                  toolName: tool.name,
                  meta: formatToolResultMeta(tool.name, call.args, output),
                  runMeta
                });
              }
            } catch (err: any) {
              const transientIssue = isTransientToolIssue(tool.name, err);
              const failureCount = recordToolFailure(toolScope, transientIssue);
              if (transientIssue) {
                const delayMs = registerTransientCooldown(toolScope.familyKey, parseApiError(err));
                recordBlockedTool(tool.name, toolScope.familyKey, 'cooldown_active', Date.now() + delayMs);
              }
              if (tool.name === 'web_search') {
                runMeta.degradedSearches += 1;
                successfulResearchMeta.degradedSearches += 1;
                recordSearchFailure({
                  query: toolScope.label,
                  family: toolScope.familyKey,
                  transient: transientIssue,
                  reason: parseApiError(err)
                });
                if (!transientIssue) {
                  const weakCount = recordWeakSearch(toolScope);
                  if (weakCount >= 2) {
                    emitEvent('warning', {
                      iteration: iterations,
                      title: 'Pivot requis',
                      message: `Les recherches sur '${clipText(toolScope.label, 120)}' restent improductives. Pivote ou conclue proprement.`,
                      toolName: tool.name,
                      meta: { family: clipText(toolScope.label, 120), reason: 'weak_search_family' },
                      runMeta
                    });
                  }
                }
              }
              refreshSessionState();
              log.error(`Tool ${tool.name} failed${transientIssue ? ' transiently' : ` (attempt ${failureCount})`}`, err);
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
                status: transientIssue ? 'warning' : 'error',
                resultPreview: clipText(err.message || String(err), 240),
                meta: formatToolMeta(tool.name, call.args),
                runMeta
              });
              if (transientIssue) {
                const waitMs = Math.max(0, (sessionState.cooldowns[toolScope.familyKey]?.until || 0) - Date.now());
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Cooldown active',
                  message: `L'outil ${tool.name} a rencontre un incident transitoire sur '${clipText(toolScope.label, 120)}'. Cooldown ${formatWaitDuration(waitMs)} avant retentative sur ce scope.`,
                  toolName: tool.name,
                  meta: { scope: clipText(toolScope.label, 120), waitMs },
                  runMeta
                });
              }
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

        if (abortToolTurn) {
          continue;
        }

        if (toolResults.length > 0) {
          contents.push({ role: 'user', parts: toolResults });
          refreshSessionState();
          const blockerPrompt = buildBlockerPrompt(message, requestClock, sessionState);
          if (blockerPrompt) {
            if (sessionState.blockers.length > 0) {
              emitEvent('warning', {
                iteration: iterations,
                title: 'Blocage restant',
                message: sessionState.blockers[0]?.message || 'Un blocage doit encore etre leve avant la livraison finale.',
                meta: {
                  blockers: sessionState.blockers.length,
                  completion: sessionState.completionScore
                },
                runMeta
              });
            }
            contents.push({ role: 'user', parts: [{ text: blockerPrompt }] });
          }
          continue;
        }
      }

      refreshSessionState();

      if (!iterationVisibleText.trim()) {
        const blockerPrompt = buildBlockerPrompt(message, requestClock, sessionState);
        if (blockerPrompt) {
          contents.push({ role: 'user', parts: [{ text: blockerPrompt }] });
          continue;
        }
      }

      if (iterationVisibleText.trim()) {
        if (!sessionState.effectiveTaskComplete) {
          const blockerPrompt = buildBlockerPrompt(message, requestClock, sessionState);
          emitEvent('warning', {
            iteration: iterations,
            title: 'Finalisation refusee',
            message: sessionState.blockers[0]?.message || "La tache n'est pas encore complete.",
            runMeta
          });
          contents.push({
            role: 'user',
            parts: [{ text: blockerPrompt || "La tache n'est pas encore complete. Reprends avec un 'report_progress' structure." }]
          });
          continue;
        }

        finalVisibleText += iterationVisibleText;
        sessionState.pendingFinalAnswer = false;
        sessionState.phase = 'completed';
        refreshSessionState();
        emitEvent('text_delta', { iteration: iterations, text: iterationVisibleText, runMeta });
        break;
      }
    }

    if (!finalVisibleText.trim() && iterations >= FAILSAFE_MAX_ITERATIONS) {
      refreshSessionState();
      const blockerSummary = sessionState.blockers.map((blocker) => blocker.message).join(' ');
      finalVisibleText = blockerSummary
        ? `Je m'arrete proprement: Cowork a atteint son garde-fou de ${FAILSAFE_MAX_ITERATIONS} tours sans lever tous les blocages. ${blockerSummary}`
        : `Je m'arrete proprement: Cowork a atteint son garde-fou de ${FAILSAFE_MAX_ITERATIONS} tours sans produire de livraison finale exploitable.`;
      emitEvent('warning', {
        iteration: iterations,
        title: 'Failsafe',
        message: `Garde-fou atteint apres ${FAILSAFE_MAX_ITERATIONS} tours internes.`,
        runMeta
      });
      emitEvent('text_delta', { iteration: iterations, text: finalVisibleText, runMeta });
    }

    if (!finalVisibleText.trim()) {
      const fallbackMessage = buildCoworkFallbackMessage(latestReleasedFile);
      if (fallbackMessage) {
        finalVisibleText = fallbackMessage;
        emitEvent('text_delta', { iteration: iterations, text: fallbackMessage, runMeta });
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
  } finally {
    releaseCoworkRunGate?.();
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
