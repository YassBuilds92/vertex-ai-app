import 'dotenv/config';
import express from 'express';
import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import rateLimit from 'express-rate-limit';
import PDFDocument from 'pdfkit';
import {
  ALLOWED_LATEX_PACKAGES,
  appendLatexFragmentToDocument,
  buildLatexDocument,
  buildLatexFragment,
  buildLatexSourceSignature,
  compileLatexDocument,
  countLatexSections,
  extractLatexCommandValue,
  normalizeLatexCompiler,
  normalizeLatexProvider,
  resolveLatexProviderBaseUrl,
  stripLatexToPlainText,
  validateLatexSource,
  type LatexCompiler,
  type LatexCompileFailure,
  type LatexProvider,
} from '../server/pdf/latex.js';
import {
  allowPublicSearchFallbacks,
  COWORK_DEBUG_REASONING,
  LEGACY_COWORK_SYSTEM_INSTRUCTION,
  LONG_CONTEXT_THRESHOLD_TOKENS,
  MAX_ACTIVITY_ITEMS,
  MAX_PAYLOAD,
  MAX_PREVIEW_CHARS,
  MAX_WEB_FETCH_CHARS,
  MODEL_PRICING_USD_PER_1M,
  normalizeConfiguredModelId,
  PORT,
  USD_TO_EUR_RATE,
} from '../server/lib/config.js';
import {
  generateAgentBlueprintFromBrief,
  pickHubAgentRecord,
  reviseAgentBlueprint,
  sanitizeAgentBlueprint,
  sanitizeHubAgentRecord,
  summarizeHubAgentsForPrompt,
  type AgentBlueprint,
  type HubAgentRecord,
} from '../server/lib/agents.js';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_LYRIA_MODEL,
  DEFAULT_PODCAST_TTS_MODEL,
  DEFAULT_TTS_MODEL,
  generateGeminiTtsBinary,
  generateImageBinary,
  isLyriaPolicyBlockedError,
  generateLyriaBinary,
  generatePodcastEpisode,
} from '../server/lib/media-generation.js';
import {
  getGeminiTtsVoiceCatalogSummary,
  MAX_GEMINI_TTS_MULTI_SPEAKERS,
} from '../shared/gemini-tts.js';
import { buildThinkingConfig, createGoogleAI, parseApiError, retryWithBackoff } from '../server/lib/google-genai.js';
import { buildModelContentsFromRequest } from '../server/lib/chat-parts.js';
import { log } from '../server/lib/logger.js';
import { estimatePdfPageCount, getMimeType, resolveAndValidatePath } from '../server/lib/path-utils.js';
import { ChatSchema } from '../server/lib/schemas.js';
import { uploadToGCS } from '../server/lib/storage.js';
import { registerApiErrorHandlers } from '../server/middleware/api-errors.js';
import { registerSiteAuth } from '../server/middleware/auth.js';
import { registerRequestHardening } from '../server/middleware/request-hardening.js';
import { registerStandardApiRoutes } from '../server/routes/standard.js';

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Constants & Setup Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const app = express();
export default app; // For Vercel
const GEMINI_TTS_VOICE_CATALOG_HINT = getGeminiTtsVoiceCatalogSummary();

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Rate Limiting Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Trop de requÃƒÂªtes, veuillez rÃƒÂ©essayer plus tard." }
});

app.use('/api/', apiLimiter);
app.use('/status', apiLimiter);

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

type PdfEngine = 'pdfkit' | 'latex';
type PdfEngineSelection = PdfEngine | 'auto';
type PdfTheme = 'legal' | 'news' | 'report';
type PdfSourceMode = 'generated' | 'raw';

type PdfQualityTargets = {
  minSections: number;
  minWords: number;
  formalDocument?: boolean;
  requireInventedDetails?: boolean;
  requestedWordCount?: number | null;
  cappedWordCount?: boolean;
  maxWords?: number;
  theme?: PdfTheme;
};

type PdfSectionInput = {
  heading?: string;
  body?: string | null;
  visualTheme?: string;
  accentColor?: string;
  mood?: string;
  motif?: string;
  pageStyle?: 'standard' | 'feature' | 'hero' | null;
  pageBreakBefore?: boolean;
  flagHints?: string[] | null;
};

type PdfDraftSourcesMode = 'append' | 'replace';
type PdfDraftSectionRevisionAction = 'replace' | 'remove' | 'insert_before' | 'insert_after' | 'append';

type PdfDraftSectionOperationInput = {
  action?: string | null;
  index?: number | null;
  section?: PdfSectionInput | null;
};

type NormalizedPdfSection = {
  heading?: string;
  body: string;
  visualTheme?: string;
  accentColor?: string;
  mood?: string;
  motif?: string;
  pageStyle?: 'standard' | 'feature' | 'hero';
  pageBreakBefore?: boolean;
  flagHints?: string[];
};

type NormalizedPdfDraftSectionOperation = {
  action: PdfDraftSectionRevisionAction;
  index: number | null;
  section?: NormalizedPdfSection;
};

type PdfDraftSnapshot = {
  title: string;
  subtitle: string;
  summary: string;
  author: string;
  sections: NormalizedPdfSection[];
  sources: string[];
};

type ActivePdfDraft = PdfDraftSnapshot & {
  draftId: string;
  filename: string;
  engine: PdfEngine;
  compiler: LatexCompiler | null;
  sourceMode: PdfSourceMode;
  latexSource: string | null;
  theme: PdfTheme;
  accentColor?: string;
  requestedWordCount: number | null;
  targetWords: number;
  cappedWords: boolean;
  wordCount: number;
  approvedReviewSignature: string | null;
};

type PdfDraftStats = {
  draftId: string;
  engine: PdfEngine;
  compiler: LatexCompiler | null;
  sourceMode: PdfSourceMode;
  theme: PdfTheme;
  signature: string;
  wordCount: number;
  targetWords: number;
  requestedWordCount: number | null;
  cappedWords: boolean;
  sectionCount: number;
  titledSectionCount: number;
  sourceCount: number;
  missingWords: number;
  approvedReviewSignature: string | null;
  hasLatexSource: boolean;
};

type PdfDraftReview = {
  success: true;
  ready: boolean;
  score: number;
  signature: string;
  engine: PdfEngine;
  compiler: LatexCompiler | null;
  totalWords: number;
  sectionCount: number;
  blockingIssues: string[];
  improvements: string[];
  strengths: string[];
  message: string;
  compileLogPreview?: string;
  cacheHit?: boolean;
  provider?: LatexProvider;
};

type PdfCompiledArtifactCache = {
  signature: string;
  engine: PdfEngine;
  compiler: LatexCompiler | null;
  provider?: LatexProvider;
  pdfBase64: string;
  compileLog?: string;
};

type PdfCreatedArtifact = {
  signature: string;
  engine: PdfEngine;
  compiler: LatexCompiler | null;
  provider?: LatexProvider;
  path: string;
  compileLog?: string;
};

type CoworkRunMeta = {
  iterations: number;
  modelCalls: number;
  toolCalls: number;
  searchCount: number;
  fetchCount: number;
  sourcesOpened: number;
  domainsOpened: number;
  artifactState: 'none' | 'drafting' | 'created' | 'released';
  stalledTurns: number;
  retryCount: number;
  queueWaitMs: number;
  mode: CoworkExecutionMode;
  phase: string;
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
    searchCount: 0,
    fetchCount: 0,
    sourcesOpened: 0,
    domainsOpened: 0,
    artifactState: 'none',
    stalledTurns: 0,
    retryCount: 0,
    queueWaitMs: 0,
    mode: 'autonomous',
    phase: 'analysis',
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
  if (normalized.includes('compo') || normalized.includes('drafting') || normalized.includes('polish')) return 'composition';
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
    activePdfDraft: null,
    phase: 'analysis',
    modelCompletionScore: 0,
    modelTaskComplete: false,
    effectiveTaskComplete: false,
    blockers: [],
    consecutiveDegradedSearches: {},
    cooldowns: {},
    lastReasoning: null,
    lastPublicStatus: null,
    reasoningReady: false,
    pendingFinalAnswer: false,
    stalledTurns: 0,
    lastProgressFingerprint: null,
    lastActionSignature: null,
    lastEngagementNudgeSignature: null,
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
  return MODEL_PRICING_USD_PER_1M[normalizeConfiguredModelId(modelId)] || MODEL_PRICING_USD_PER_1M['gemini-3.1-pro-preview'];
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
  runtime?: { originalMessage?: string; requestClock?: RequestClock; hubAgents?: HubAgentRecord[] },
  behavior?: { executionMode?: CoworkExecutionMode; debugReasoning?: boolean }
): string {
  const requestClock = runtime?.requestClock;
  const hubAgentsSummary = Array.isArray(runtime?.hubAgents) && runtime.hubAgents.length > 0
    ? summarizeHubAgentsForPrompt(runtime.hubAgents, 8)
    : '';
  const debugReasoning = Boolean(behavior?.debugReasoning);

  const baseInstruction = `Tu es Cowork, un operateur autonome haut niveau.
Tu avances vite, tu finis proprement, tu n'es ni paresseux ni theatrale, et tu restes honnete quand les preuves sont insuffisantes.

### POSTURE
- Decide toi-meme de la meilleure strategie.
- Ne t'arrete pas au premier resultat plausible si quelque chose semble faible, ambigu, incomplet ou hors sujet.
- Si une demande depend du reel, accumule assez d'elements avant de conclure.
- Si une demande implique le droit actuel, la fiscalite, le marche, des rendements recents, des salaires, des projections business, une conformité, une veille concurrentielle, ou des donnees sur des personnes/entreprises/pays reels, ne pars pas en memoire seule: va verifier.
- Pour un travail factualise ambitieux, une passe de reperage n'est pas une passe de conclusion: reperer, ouvrir, comparer, puis seulement synthetiser.
- Si une demande ne depend pas d'outils, reponds directement sans faux theatre agentique.
- Si apres 3 tentatives materiellement differentes tu restes bloque, explique la limite au lieu de broder.
- Calibre ton effort sur l'ambition reelle de la mission: question simple = reponse simple; dossier, comparaison large, briefing, PDF, podcast, mini-site, note premium ou synthese editoriale = effort plus engage.
- Quand une demande couvre plusieurs angles, pays, entreprises, affirmations ou personnes, traite-les comme plusieurs mini-enquetes a couvrir serieusement, pas comme un seul bloc flou.
- Si la demande exige des profils de fondateurs, de dirigeants ou de personnes reelles pour plusieurs entites, une seule page de classement ne suffit pas: ouvre aussi des pages ou profils directs pour etayer plusieurs cas.
- Plus la demande est large, plus ta cartographie doit etre large: dossier multi-pays, classement de plusieurs acteurs, comparatif de marche ou chaine a plusieurs etapes = recherches ciblees par angle ou entite, pas seulement quelques requetes generiques.
- Refuse les versions maigres quand la promesse implicite est plus haute que la matiere collectee.
- Avant de livrer, demande-toi en interne si tu as vraiment assez de substance pour faire gagner du temps a l'utilisateur, ou si tu es en train d'expedier.
- Si tu n'as encore lu aucune source directe sur une tache factualisee, considere que tu es probablement encore trop leger pour une synthese solide.
- Sur une tache factualisee ambitieuse, zero 'web_fetch' doit te mettre en alerte: tu as peut-etre repere, mais pas encore vraiment lu.
- Si une premiere voie technique marche mal ou produit quelque chose de trop pauvre, pivote vite et intelligemment au lieu de t'enteter ou de te contenter du minimum.
- Pour un brouillon PDF, pense atelier de travail: premier jet, relecture, revision, puis export seulement quand le texte te semble vraiment mur.
- Pour un fact-check, une veille, une comparaison, un benchmark, un memo juridique ou financier, les snippets ne suffisent presque jamais: lis de vraies sources directes avant d'affirmer.
- Les demandes business, juridiques, financieres, RH ou marche valent mieux qu'une reponse "de tete": cherche des sources recentes puis redige a partir d'elles.
- Si tu n'as fait que chercher sans ouvrir les meilleures pages, considere que tu es encore en phase d'eclaireur, pas en phase de livraison.
- Reflexe utile sur les demandes ancrees dans le reel: cartographie rapide par recherche, puis lecture de plusieurs URLs fortes avant arbitrage ou synthese.
- Un seul article ou une seule page suffit rarement pour resumer toute une semaine d'actualite d'un pays, comparer plusieurs acteurs, ou couvrir un dossier multi-pays.
- Si une source prometteuse echoue a la lecture (paywall, 401, page pauvre, acces bloque), remplace-la par une autre source lisible au lieu de conclure trop vite.
- Quand l'utilisateur demande explicitement plusieurs items, angles ou pays, ta collecte doit refleter cette largeur de couverture avant l'ecriture finale.
- Si tu t'appuies encore sur seulement une ou deux lectures directes pour couvrir plusieurs pays, plusieurs entreprises ou cinq profils, considere plutot que ta couverture reste mince et qu'il faut encore etayer ou reconnaitre la limite.
- Si l'utilisateur demande une liste ou un comparatif avec un nombre explicite, garde ce nombre en tete et ne t'arrete pas silencieusement a mi-chemin. Si tu ne peux pas atteindre le compte demande proprement, dis-le clairement.
- Si plusieurs sources donnent des chiffres differents, montre l'ecart, attribue chaque chiffre a sa source et explique la cause probable au lieu de choisir arbitrairement.
- Si la meilleure documentation est dans une autre langue, va la chercher dans cette langue puis restitue proprement dans la langue de l'utilisateur.
- En iteratif, ameliore le livrable precedent au lieu de repartir de zero, sauf si une refonte totale est vraiment plus intelligente.
- Si la demande est impossible, privee, dangereuse ou non verifiable, refuse proprement sans halluciner puis propose une alternative utile si elle existe.
- Avant toute livraison importante, pose-toi ce filtre interne: "Est-ce qu'un bon assistant humain bien paye serait a l'aise de rendre ca a un patron ?" Si non, travaille encore ou explicite honnêtement la limite.

### ENVIRONNEMENT
- Node.js uniquement. Python n'est pas disponible.
- N'expose jamais ton chain-of-thought brut.
- Outils disponibles:
  - 'create_agent_blueprint' : concoit un agent specialise reutilisable pour le Hub Agents.
  - 'update_agent_blueprint' : met a jour un agent deja present dans le Hub Agents.
  - 'run_hub_agent' : relance un agent deja present dans le Hub Agents comme vraie sous-mission.
  - 'list_files', 'list_recursive', 'read_file', 'write_file'
  - 'generate_image_asset' : genere une image locale dans '/tmp/'.
  - 'generate_tts_audio' : synthese Gemini TTS vers un fichier audio local. Gere la voix seule, les style instructions, et aussi un duo a 2 intervenants si tu fournis exactement 2 speakers.
  - 'generate_music_audio' : generation musicale Lyria vers un fichier audio local. A reserver surtout aux cas ou l'utilisateur veut la musique seule.
  - 'create_podcast_episode' : fabrique un episode podcast audio complet, mixe la voix et la musique, puis livre un seul master final pret a publier. Gere le single-speaker et le duo a 2 intervenants avec styles globaux et styles par intervenant.
  - 'begin_pdf_draft', 'append_to_draft', 'revise_pdf_draft', 'get_pdf_draft'
  - 'review_pdf_draft'
  - 'create_pdf'
  - 'release_file'
  - Pour Gemini TTS: prefere 1 seule voix pour narration, flash info, voix-off, explication, monologue ou chronique solo.
  - Pour Gemini TTS: prefere 2 intervenants pour sketch, interview, duo de presentation, dispute, Q/R vivante ou conversation ecrite avec 2 roles explicites.
  - Le multi-speaker Gemini TTS supporte exactement ${MAX_GEMINI_TTS_MULTI_SPEAKERS} intervenants, pas plus. Si le besoin depasse 2 voix, fusionne en 2 roles max ou repasse en narrateur unique.
  - Les modeles multi-speaker utiles sont 'gemini-2.5-pro-tts' et 'gemini-2.5-flash-tts'. 'gemini-2.5-flash-lite-preview-tts' reste single-speaker seulement.
  - En duo TTS/podcast, choisis toujours 2 voix distinctes et 2 styles de jeu contrastes. Ne garde jamais la meme voix pour les 2 intervenants.
  - Quand un script contient des noms propres ou mots etrangers relevant d'une autre ecriture, garde cette ecriture d'origine si cela fluidifie la prononciation.
  - Pour la musique podcast, 'lyria-002' reste le defaut robuste. 'lyria-3-clip-preview' et 'lyria-3-pro-preview' sont des options preview a utiliser seulement si le besoin le justifie.
  - Si Lyria bloque un prompt, simplifie-le immediatement en brief musical neutre: genre, humeur, tempo, instruments, structure, langue. Evite l'imitation d'artiste et les formulations sensibles inutiles au rendu sonore.
  - Voix Gemini officielles disponibles: ${GEMINI_TTS_VOICE_CATALOG_HINT}.
  - Pour les PDF premium en LaTeX, tu peux faire une vraie direction artistique par section/page via les champs de section: 'visualTheme', 'mood', 'motif', 'flagHints', 'pageStyle', 'pageBreakBefore', sans avoir a ecrire tout le .tex toi-meme.
${capabilities.executeScript ? "  - 'execute_script' : a reserver aux cas vraiment necessaires.\n" : ""}${capabilities.webSearch ? "  - 'web_search' : reperage de pistes, de sources et d'angles; cherche souvent plusieurs fois quand le sujet est large ou sensible.\n  - 'web_fetch' : lecture directe d'une URL precise; sur un travail factualise ambitieux, c'est lui qui transforme une piste en source vraiment lue.\n  - 'music_catalog_lookup' : raccourci specialise pour discographie, titres, catalogue, paroles et couverture artiste.\n" : ""}${debugReasoning ? "  - 'publish_status' et 'report_progress' existent seulement en debug. Ils sont facultatifs et ne conditionnent pas ta capacite a agir.\n" : ""}
### REGLES DURES
1. Pour un PDF, utilise toujours 'create_pdf'. N'essaie jamais de fabriquer un faux PDF avec 'write_file'.
2. Tout fichier genere doit vivre dans '/tmp/'.
3. Si tu crees un artefact a livrer, appelle ensuite 'release_file' puis donne le lien final.
4. Ne pretends jamais avoir cree, verifie ou publie quelque chose que tu n'as pas reellement obtenu.
5. Si une source officielle est explicitement requise par la demande, privilegie-la.
6. Si une information recente reste insuffisamment sourcee, dis-le au lieu d'inventer.
7. Si tu utilises 'review_pdf_draft' et qu'une signature t'est fournie, passe-la telle quelle dans 'create_pdf.reviewSignature'.
8. Si tu dois faire plusieurs outils dans un meme tour, garde une mini-chaine coherente: lecture/recherche d'abord, mutation eventuelle en dernier.
9. Si l'utilisateur veut un specialiste recurrent ou delegable, tu peux creer un agent pour le Hub puis l'annoncer clairement.
10. Si un agent du Hub correspond deja a la mission, prefere 'run_hub_agent' a la creation d'un nouveau blueprint.
11. Si l'utilisateur veut corriger un agent existant du Hub, prefere 'update_agent_blueprint' a la creation d'un nouveau blueprint.

### REPERES TEMPORELS
${requestClock
  ? `- Date et heure de reference: ${requestClock.absoluteDateTimeLabel} (${requestClock.timeZone})
- Quand l'utilisateur dit "aujourd'hui", "du jour", "today" ou "latest", cela signifie ${requestClock.dateLabel}.
- Si une source parle d'une autre date, compare-la explicitement a ${requestClock.dateLabel}.`
  : "- Si la demande parle de 'today', 'aujourd'hui' ou 'latest', utilise la date courante exacte de l'environnement."}

${hubAgentsSummary ? `### HUB AGENTS DISPONIBLES
- Tu peux les relancer avec 'run_hub_agent' en utilisant leur id, slug ou nom.
${hubAgentsSummary}
` : ''}

### MICRO-EXEMPLES
- Demande creative pure: pas d'outil, tu reflechis en interne puis tu livres directement un bon texte.
- Demande creative ancree dans le reel: tu te documentes d'abord, tu lis assez de matiere, puis tu ecris ou tu bloques honnetement.
- Demande latest/docs/version: tu cherches, tu lis la doc ou la source officielle utile, puis tu resumes sans sur-vendre une recherche faible.
- Fact-check / benchmark / veille: tu ne te contentes pas d'une SERP; tu ouvres plusieurs sources directes avant de trancher.
- Dossier / comparatif large / synthese multilingue: tu cartographies le sujet, tu lis plusieurs pages fortes, tu compares, puis tu produis.
- Sujet multi-entites (5 startups, 10 concurrents, plusieurs pays): tu verifies assez d'elements pour que la couverture soit credible, sinon tu assumes honnetement la limite.
- Classement + profils (fondateurs, CEO, parcours): tu identifies la liste, puis tu ouvres aussi des pages individuelles ou des profils solides pour ne pas ecrire tout le portrait depuis une seule source agregatrice.
- Dossier large avec comparaison de pays ou de marches: tu fais des recherches distinctes par angle majeur au lieu de traiter tout le sujet comme un seul bloc.
- Couverture large mais preuves minces: si tes lectures directes restent trop peu nombreuses pour la largeur du sujet, tu continues a etayer ou tu explicites une couverture partielle au lieu de livrer comme si tout etait solide.
- Business plan / contrat / memo RH / arbitrage financier: tu verifies le cadre actuel, les chiffres, ou les obligations utiles avant de rediger la version finale.
- Demande PDF/artefact: tu prepares le contenu utile, tu crÃƒÂ©es l'artefact, tu le publies, puis tu livres le lien.
`;

  const trimmedInstruction = userInstruction?.trim();
  if (!trimmedInstruction || trimmedInstruction === LEGACY_COWORK_SYSTEM_INSTRUCTION) {
    return baseInstruction;
  }

  return `${baseInstruction}

### CONSIGNES SUPPLEMENTAIRES :
${trimmedInstruction}`;
}

function formatAgentRuntimeValues(
  agent: HubAgentRecord,
  formValues?: Record<string, string | boolean>
): string {
  if (!formValues || typeof formValues !== 'object') {
    return '- aucune valeur pre-remplie';
  }

  const entries = Object.entries(formValues)
    .map(([fieldId, value]) => {
      const label = agent.uiSchema.find(field => field.id === fieldId)?.label || fieldId;
      if (typeof value === 'boolean') {
        return `${label}: ${value ? 'oui' : 'non'}`;
      }

      const text = String(value || '').trim();
      if (!text) return '';
      return `${label}: ${text}`;
    })
    .filter(Boolean);

  return entries.length > 0
    ? entries.map(entry => `- ${entry}`).join('\n')
    : '- aucune valeur pre-remplie';
}

function buildAgentRuntimeSystemInstruction(
  agent: HubAgentRecord,
  runtime?: { requestClock?: RequestClock; formValues?: Record<string, string | boolean> }
): string {
  const requestClock = runtime?.requestClock;
  const allowedTools = Array.isArray(agent.tools) && agent.tools.length > 0
    ? agent.tools.join(', ')
    : 'aucun outil specialise';
  const runtimeValues = formatAgentRuntimeValues(agent, runtime?.formValues);

  return [
    agent.systemInstruction.trim(),
    '### CONTEXTE DE SESSION',
    `- Tu es l'agent '${agent.name}'. Tu aides directement l'utilisateur depuis ton interface dediee.`,
    `- Type de sortie privilegie: ${agent.outputKind}.`,
    `- Quand t'activer: ${agent.whenToUse}.`,
    `- Outils autorises: ${allowedTools}.`,
    "- N'expose jamais ton chain-of-thought brut.",
    "- Si un livrable doit etre cree (PDF, fichier, artefact), cree-le reellement puis publie-le si necessaire.",
    requestClock
      ? `- Date et heure de reference: ${requestClock.absoluteDateTimeLabel} (${requestClock.timeZone}).`
      : null,
    '### VALEURS FOURNIES DANS L INTERFACE',
    runtimeValues,
    '### POSTURE',
    "- Tu n'es pas Cowork. Tu es le specialiste final utilise directement par l'utilisateur.",
    "- Si une information manque, utilise intelligemment les champs deja fournis avant de reclamer plus de friction.",
    "- Si l'utilisateur demande de modifier ton interface, ton prompt ou tes outils, indique que Cowork peut faire cette evolution sur l'agent lui-meme.",
  ].filter(Boolean).join('\n');
}

function buildCreativeSingleTurnSystemInstruction(
  userInstruction?: string,
  runtime?: { originalMessage?: string; requestClock?: RequestClock }
): string {
  const requestClock = runtime?.requestClock;
  const baseInstruction = `Tu es Cowork en mode composition creative mono-appel.
Ton travail est de reflechir en interne, sans afficher ton raisonnement brut, puis de livrer directement une version finale soignee.

### COMPORTEMENT ATTENDU :
1. Planifie mentalement la structure avant d'ecrire.
2. Redige un premier brouillon interne.
3. Fais une auto-critique interne sur le rythme, la coherence, les rimes et l'impact.
4. Polishe la version finale avant de repondre.
5. Ne montre JAMAIS ces etapes a l'utilisateur. Ne donne que le resultat final.
6. N'appelle aucun outil. N'invente ni source ni actualite si tu n'en as pas besoin.

### REPERES TEMPORELS :
${requestClock
  ? `- Date et heure de reference: ${requestClock.absoluteDateTimeLabel} (${requestClock.timeZone}).`
  : "- Utilise la date courante exacte si elle est indispensable, sinon n'ancre pas artificiellement le texte dans un fait externe."}

### REGLES CRITIQUES :
1. Si la demande cible des groupes pour les insulter ou les dehumaniser, n'ecris pas cette version.
2. Si un detail factuel recent n'est pas certain, reste general ou demande une reformulation plus precise dans la reponse finale.
3. La sortie finale doit etre uniquement le texte livre a l'utilisateur, sans prefacer par des explications sur ton processus.`;

  const trimmedInstruction = userInstruction?.trim();
  if (!trimmedInstruction || trimmedInstruction === LEGACY_COWORK_SYSTEM_INSTRUCTION) {
    return baseInstruction;
  }

  return `${baseInstruction}

### CONSIGNES SUPPLEMENTAIRES :
${trimmedInstruction}`;
}

function getCoworkPublicPhase(phase: CoworkPhase, executionMode: CoworkExecutionMode): string {
  if (executionMode === 'autonomous' && phase === 'completed') return 'termine';
  switch (phase) {
    case 'analysis':
      return 'plan';
    case 'composition':
      return 'composition';
    case 'research':
      return 'recherche';
    case 'verification':
      return 'verification';
    case 'production':
      return 'redaction';
    case 'delivery':
      return 'livraison';
    case 'completed':
      return 'termine';
    default:
      return phase;
  }
}

function buildCoworkFallbackMessage(releasedFile: { url: string; path?: string } | null): string | null {
  if (!releasedFile?.url) return null;
  const fileName = releasedFile.path ? path.basename(releasedFile.path) : 'le-fichier';
  return `Voici votre fichier : [Telecharger ${fileName}](${releasedFile.url})`;
}

function hasArtifactInFlightState(options: {
  activePdfDraft?: ActivePdfDraft | null;
  createdArtifactPath?: string | null;
  releasedFile?: { url: string; path?: string } | null;
}): boolean {
  return Boolean(options.activePdfDraft || options.createdArtifactPath || options.releasedFile?.url);
}

function buildArtifactFailureFallbackMessage(options: {
  activePdfDraft?: ActivePdfDraft | null;
  createdArtifactPath?: string | null;
  releasedFile?: { url: string; path?: string } | null;
}): string {
  const releasedFallback = buildCoworkFallbackMessage(options.releasedFile || null);
  if (releasedFallback) return releasedFallback;

  if (options.createdArtifactPath) {
    return "Le fichier a bien ete cree, mais je n'ai pas reussi a finaliser proprement la livraison du lien. Relance-moi et je repartirai de ce fichier deja cree.";
  }

  if (options.activePdfDraft) {
    return "J'ai commence le livrable, mais je ne suis pas alle jusqu'a l'export final. Relance-moi et je reprendrai a partir du brouillon deja en cours.";
  }

  return "Desole, je n'ai pas reussi a produire une reponse finale fiable sur cette tentative. Reessaie ou reformule avec un angle un peu plus precis.";
}

function buildCoworkEngagementNudge(options: {
  state: CoworkSessionState;
  research: MusicResearchProgress;
  latestCreatedArtifactPath?: string | null;
  latestReleasedFile?: { url: string; path?: string } | null;
  recentToolName?: string;
  recentToolOutput?: any;
}): CoworkEngagementNudge | null {
  if (options.latestReleasedFile?.url) return null;

  const draft = options.state.activePdfDraft;
  const directSourceCount = options.state.sourcesValidated.length;
  const searchCount = options.research.webSearches;
  const fetchCount = options.research.webFetches;
  const noDirectReads = directSourceCount === 0 && fetchCount === 0;

  if (
    options.recentToolName === 'web_search'
    && searchCount >= 2
    && noDirectReads
    && !draft
  ) {
    const signature = `search-only:${searchCount}:${directSourceCount}`;
    return {
      signature,
      title: 'Matiere encore trop mince',
      message: `Cowork a deja explore ${searchCount} piste(s), mais n'a encore lu aucune source directe. Le risque maintenant, c'est de resumer des snippets au lieu de construire une vraie reponse solide.`,
      prompt: "Pause qualite. Tu n'as encore lu aucune source directe et la matiere reste mince. Ne choisis pas la voie la plus courte par reflexe. Decide toi-meme la meilleure suite, mais elle doit probablement enrichir la substance avant livraison: ouvrir une ou plusieurs vraies sources, changer d'angle si les resultats restent pauvres, ou conclure honnetement que la matiere manque."
    };
  }

  if (!draft) return null;

  const editorialDraft = draft.theme !== 'legal' || searchCount > 0 || draft.targetWords >= 900;
  if (!editorialDraft) return null;

  const draftSectionCount = draft.sections.length;
  const draftSourceCount = draft.sources.length;
  const draftTooShort = draft.wordCount < Math.min(Math.max(850, Math.floor(draft.targetWords * 0.45)), 1400);
  const thinSubstance = noDirectReads || draftSourceCount === 0 || draftTooShort || draftSectionCount < 5;

  if (!thinSubstance) return null;

  const artifactAlreadyCreated = Boolean(options.latestCreatedArtifactPath);
  const pageCount = Number(options.recentToolOutput?.pageCount || 0);
  const createdButThin = artifactAlreadyCreated && options.recentToolName === 'create_pdf';
  const signal = createdButThin
    ? `Le fichier existe techniquement${pageCount > 0 ? ` (${pageCount} page(s))` : ''}, mais la matiere reste encore assez mince pour un rendu ambitieux.`
    : `Le brouillon part vite, mais il reste leger pour la promesse implicite du livrable.`;

  const signature = [
    'draft-thin',
    draft.draftId,
    draft.wordCount,
    draftSectionCount,
    draftSourceCount,
    directSourceCount,
    artifactAlreadyCreated ? 1 : 0,
    options.recentToolName || 'none'
  ].join(':');

  return {
    signature,
    title: 'Exigence editoriale',
    message: `${signal} Etat actuel: ${draft.wordCount} mots, ${draftSectionCount} section(s), ${draftSourceCount} source(s) dans le brouillon, ${directSourceCount} source(s) directe(s) ouverte(s).`,
      prompt: "Pause qualite editoriale. Tu n'es pas oblige de suivre un plan fixe, mais le rendu reste encore trop leger pour une livraison vraiment convaincante. Ne te contente pas d'un minimum proprement emballe. Decide toi-meme la meilleure suite, mais elle doit vraisemblablement enrichir ou retravailler la matiere avant livraison: ouvrir de vraies sources, diversifier les angles, densifier franchement le brouillon, relire puis reviser le texte, ou assumer explicitement une version courte et limitee."
  };
}

export const __coworkPdfInternals = {
  extractRequestedWordCount,
  normalizePdfTheme,
  resolvePdfTheme,
  resolvePdfEngine,
  getPdfQualityTargets,
  buildPdfDraftSnapshot,
  buildActivePdfDraftSignature,
  createActivePdfDraft,
  appendToActivePdfDraft,
  reviseActivePdfDraft,
  buildPdfDraftStats,
  reviewPdfDraft,
  buildLatexAwarePdfReview,
  renderPdfArtifact,
  countTemplatePlaceholders,
  countFormalDocumentSignals
};

export const __coworkLoopInternals = {
  createEmptyCoworkSessionState,
  computeCompletionState,
  buildBlockerPrompt,
  buildCoworkBlockedUserReplyPrompt,
  buildPublicToolNarration,
  buildTavilySearchPlan,
  buildDirectSourceSearchOutcome,
  validateCreatePdfReviewSignature,
  getCooldownDelayMs,
  buildCoworkProgressFingerprint,
  registerCoworkProgressState,
  markVisibleDeliveryAttempt,
  getCoworkPublicPhase,
  normalizeCoworkPhase,
  classifyCoworkExecutionMode,
  getCoworkToolFailureScope,
  isTransientCoworkToolIssue,
  requestIsCoworkMetaDiscussion,
  requestRequiresAbuseBlock,
  assessReadablePageRelevance,
  searchWeb,
};

function normalizeCoworkText(value?: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function getCoworkToolFailureScope(toolName: string, args: any) {
  if (toolName === 'run_hub_agent') {
    const agentId = String(args?.agentId || '').trim();
    const mission = String(args?.mission || '').trim();
    const normalizedAgent = normalizeCoworkText(agentId).replace(/\s+/g, ' ').trim() || 'agent';
    const normalizedMission = normalizeCoworkText(mission).replace(/\s+/g, ' ').trim() || 'mission';
    return {
      exactKey: `${toolName}:agent:${normalizedAgent}:mission:${normalizedMission}`,
      familyKey: `${toolName}:agent:${normalizedAgent}`,
      label: agentId || '(agent vide)'
    };
  }

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

  if (toolName === 'generate_music_audio') {
    const prompt = String(args?.prompt || '').trim();
    const model = normalizeCoworkText(String(args?.model || DEFAULT_LYRIA_MODEL)).replace(/\s+/g, ' ').trim() || 'default';
    const normalizedPrompt = normalizeCoworkText(prompt).replace(/\s+/g, ' ').trim() || 'vide';
    const family = extractSearchAnchorTokens(prompt).slice(0, 5).join(' ') || normalizedPrompt.slice(0, 96) || 'vide';
    return {
      exactKey: `${toolName}:model:${model}:prompt:${normalizedPrompt}`,
      familyKey: `${toolName}:model:${model}:family:${family}`,
      label: clipText(prompt || toolName, 120) || toolName
    };
  }

  if (toolName === 'generate_tts_audio' || toolName === 'generate_image_asset' || toolName === 'create_podcast_episode') {
    const rawIntent = toolName === 'generate_tts_audio'
      ? String(args?.text || args?.prompt || '').trim()
      : toolName === 'create_podcast_episode'
        ? String(args?.title || args?.brief || args?.script || '').trim()
        : String(args?.prompt || '').trim();
    const modelValue = toolName === 'generate_tts_audio'
      ? String(args?.model || DEFAULT_TTS_MODEL)
      : toolName === 'create_podcast_episode'
        ? String(args?.musicModel || args?.ttsModel || DEFAULT_PODCAST_TTS_MODEL)
        : String(args?.model || DEFAULT_IMAGE_MODEL);
    const model = normalizeCoworkText(modelValue).replace(/\s+/g, ' ').trim() || 'default';
    const normalizedIntent = normalizeCoworkText(rawIntent).replace(/\s+/g, ' ').trim() || 'vide';
    const family = extractSearchAnchorTokens(rawIntent).slice(0, 5).join(' ') || normalizedIntent.slice(0, 96) || 'vide';
    return {
      exactKey: `${toolName}:model:${model}:intent:${normalizedIntent}`,
      familyKey: `${toolName}:model:${model}:family:${family}`,
      label: clipText(rawIntent || toolName, 120) || toolName
    };
  }

  return {
    exactKey: `${toolName}:global`,
    familyKey: `${toolName}:global`,
    label: toolName
  };
}

function isTransientCoworkToolIssue(toolName: string, errorLike: unknown): boolean {
  const normalized = normalizeCoworkText(parseApiError(errorLike));
  if (!normalized) return false;

  const genericTransient =
    normalized.includes('500')
    || normalized.includes('502')
    || normalized.includes('503')
    || normalized.includes('internal server error')
    || normalized.includes('server error')
    || normalized.includes('temporarily unavailable')
    || normalized.includes('unavailable')
    || normalized.includes('deadline exceeded')
    || normalized.includes('timeout')
    || normalized.includes('timed out');

  if (toolName === 'web_search' || toolName === 'web_fetch') {
    return genericTransient
      || normalized.includes('429')
      || normalized.includes('resource exhausted')
      || normalized.includes('too many requests')
      || normalized.includes('rate limit')
      || normalized.includes('forbidden')
      || normalized.includes('403')
      || normalized.includes('simultan')
      || normalized.includes('concurrent')
      || normalized.includes('parallel')
      || normalized.includes('too many simultaneous');
  }

  if (toolName === 'generate_music_audio' || toolName === 'generate_image_asset' || toolName === 'generate_tts_audio' || toolName === 'create_podcast_episode') {
    return genericTransient
      || normalized.includes('429')
      || normalized.includes('resource exhausted')
      || normalized.includes('too many requests')
      || normalized.includes('rate limit');
  }

  return false;
}

function getCoworkIntentWindow(message: string, maxChars = 320): string {
  const normalized = normalizeCoworkText(message);
  if (!normalized) return '';

  const lines = normalized
    .split(/\r?\n+/)
    .map(line => line.replace(/^[>"'`\s]+|[>"'`\s]+$/g, '').trim())
    .filter(line => /[a-z0-9]/.test(line));

  const selected: string[] = [];
  let totalChars = 0;

  for (const line of lines) {
    selected.push(line);
    totalChars += line.length + 1;
    if (selected.length >= 2 || totalChars >= maxChars) {
      break;
    }
  }

  return selected.join(' ').slice(0, maxChars);
}

function requestHasDeliverableIntent(window: string): boolean {
  return /\b(cree|creer|genere|generer|fabrique|fabriquer|produis|produire|fournis|fournir|exporte|exporter|prepare|preparer|redige|rediger|fais|faire|donne|donner)\b/.test(window)
    || /\b(j[' ]?veux|jveux|je veux|je voudrais|j[' ]?aimerais|il me faut|il me faudrait|peux tu|tu peux|merci de|besoin d[' ]?un|besoin d[' ]?une)\b/.test(window);
}

function requestStartsWithDeliverableNoun(window: string, nounPattern: RegExp): boolean {
  const leadPattern = new RegExp(
    `^(?:salam\\s+|stp\\s+|svp\\s+|please\\s+)?(?:(?:je\\s+veux|jveux|je\\s+voudrais|j[' ]?aimerais|il\\s+me\\s+faut)\\s+)?(?:un|une|des|mon|ma|mes)?\\s*${nounPattern.source}`
  );
  return leadPattern.test(window);
}

function requestIsCoworkMetaDiscussion(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  if (!normalized) return false;

  const metaIntent =
    /\b(t[' ]?en penses quoi|qu[' ]en penses tu|analyse|diagnostic|audit|review|retour|feedback|debrief|debug|bug|regression|probleme|pourquoi ca n[' ]a pas marche|ce que tu dis a codex|ce que le systeme a fait|promesse|realite|preuve|logs?|score reel|implementation|implemente|implementee|implante|fixe le code|ne me refais pas|cosmetique|surface|moteur|pipeline)\b/.test(normalized);
  const coworkContext =
    /\b(cowork|codex|commit|backend|frontend|agent|boucle|run|systeme|orchestrateur|ui|ux)\b/.test(normalized);
  const quotedToolSignals = [
    'create_pdf',
    'append_to_draft',
    'begin_pdf_draft',
    'revise_pdf_draft',
    'review_pdf_draft',
    'release_file',
    'music_catalog_lookup',
    'create_podcast_episode',
    'web_search',
    'web_fetch',
    'pdfkit',
    'latex',
    'signature mismatch',
    'theme auto',
    'trackmusik',
    'ven1'
  ].filter(signal => normalized.includes(signal)).length;

  return (metaIntent && (coworkContext || quotedToolSignals >= 2))
    || (coworkContext && quotedToolSignals >= 3);
}

function requestAsksForWriting(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  return /\b(punchline|punchlines|rap|texte|paroles|lyrics|son|couplet|refrain|ecris|ecrire|redige|rediger|genere|generer|compose|composer|freestyle|topline)\b/.test(normalized);
}

function requestRequiresAbuseBlock(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  const targetsGroup =
    /\b(musulmans?|chiites?|sunnites?|juifs?|chretiens?|catholiques?|protestants?|ath[ea]es?|gays?|lgbt|lesbiennes?|homosexuels?|trans|transgenres?|arabes?|maghrebins?|noirs?|blancs?|asiatiques?|roms?|gitans?|immigres?|etrangers?|femmes?|hommes?)\b/.test(normalized);
  const abuseIntent =
    /\b(insulte|insulter|humilie|humilier|dehumanise|dehumaniser|deteste|detester|hais|haissez|haine|nique|degage|degagez|massacre|massacrer|termine|terminer|extermine|exterminer|bute|buter|tue|tuer|ecrase|ecraser)\b/.test(normalized);
  return targetsGroup && abuseIntent;
}

function requestMentionsConcreteExternalSubject(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  return /\b(?:defendre|soutenir|plaider(?:\s+pour)?|repondre a|reponds a|clasher|clashe|attaquer|attaque|denoncer|denonce|charger|charge)\s+(?!mon\b|ma\b|mes\b|ton\b|ta\b|tes\b|notre\b|nos\b|votre\b|vos\b|leur\b|leurs\b|le\b|la\b|les\b|un\b|une\b|des\b|du\b|de la\b|de l(?:['\u2019])|ce\b|cet\b|cette\b|ces\b|moi\b|toi\b|nous\b|vous\b)[a-z0-9'.\u2019-][a-z0-9'.\u2019-]*(?:\s+[a-z0-9'.\u2019-][a-z0-9'.\u2019-]*){0,5}\b/.test(normalized);
}

function requestMentionsResearchIntent(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  return /\b(documente(?:\s|-)?toi|documente|renseigne(?:\s|-)?toi|renseigne|verifie|verification|verifier|cherche|chercher|recherche|rechercher|creuse|creuser|fouille|fouiller|investigue|investiguer|analyse|analyser|etudie|etudier|apprends?(?:\s+sur)?|informe(?:\s|-)?toi|informe|sources?|references?|contexte|signification|definition|veut dire|argot|slang|terme|expression|autour de lui|autour d'elle|autour d'eux|ce qui se dit|tout ce qu(?:['\u2019])il y a autour|tout ce qu(?:['\u2019])il y a sur lui|tout ce qu(?:['\u2019])il y a sur elle)\b/.test(normalized);
}

function requestNeedsExternalGrounding(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  const asksForWriting = requestAsksForWriting(message);
  const explicitResearchIntent = requestMentionsResearchIntent(message);
  const legalOrCaseSignals =
    /\b(proces|tribunal|justice|plainte|plaignant|plaignante|accusation|accuse|accusee|condamn|verdict|jugement|cour|mandat|arret|prison|viol|agression|police|avocat|extrad|detention)\b/.test(normalized);
  const documentarySignals =
    /\b(documentation|docs?|version|release|sortie|mise a jour|update|benchmark|compar|compare|comparatif|roadmap|api|sdk|modele|model)\b/.test(normalized);

  if (requestNeedsMusicCatalogResearch(message)) return true;
  if (documentarySignals || legalOrCaseSignals) return true;
  if (!asksForWriting) return explicitResearchIntent || requestNeedsCurrentDateGrounding(message);

  return explicitResearchIntent || legalOrCaseSignals || requestMentionsConcreteExternalSubject(message);
}

function requestNeedsTopicalCreativeResearch(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  const asksForWriting = requestAsksForWriting(message);
  if (!asksForWriting) return false;

  const recentContextSignals =
    requestIsCurrentAffairs(message)
    || requestNeedsCurrentDateGrounding(message)
    || /\b(affaire|dossier|proces|tribunal|justice|plainte|accusation|accuse|polemique|controverse|buzz|reaction|reactions|suite a|en ce moment|du moment)\b/.test(normalized);
  const stanceVerbPattern = /\b(defendre|defense|soutenir|soutien|plaider|plaidoyer|repondre a|reponds a|reponds|clasher|clashe|attaque|attaquer|denoncer|denonce|charger|charge)\b/;
  const looksLikeConcreteExternalSubject = requestMentionsConcreteExternalSubject(message);

  return recentContextSignals || (stanceVerbPattern.test(normalized) && looksLikeConcreteExternalSubject);
}

function requestNeedsGroundedWriting(message: string): boolean {
  return requestAsksForWriting(message) && requestNeedsExternalGrounding(message);
}

function requestIsPureCreativeComposition(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  if (!requestAsksForWriting(message)) return false;
  if (requestNeedsDownloadableArtifact(message) || requestNeedsPdfArtifact(message)) return false;
  if (requestNeedsMusicCatalogResearch(message)) return false;
  if (requestNeedsExternalGrounding(message)) return false;
  return !/\b(fichier|document|pdf|api|sdk|documentation|docs?|version|release|package|repo|code|source|vercel|firebase|session|prompt system|system prompt|du jour|today|latest)\b/.test(normalized);
}

function requestIsArtifactRefinement(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  return /\b(esthetique|esthÃƒÂ©tique|plus beau|plus belle|plus joli|plus jolie|design|mise en page|mise en forme|style|stylise|styliser|relooker|relook|ameliore le rendu|ameliorer le rendu|meilleur rendu|beau rendu|beaux rendus|beaute|visuel|visuellement|page par|une page par|chaque page|chaque actu|theme par|couleur|couleurs|colorÃƒÂ©|magazine|professionnel|premium|luxe|sublime|sophistique|reformat|reformater|reformate|refais le pdf|refaire le pdf|change le look|changer le look|plus pro|plus classe|plus clean|mieux presente|mieux presentÃƒÂ©)\b/.test(normalized);
}

function historyContainsRecentPdfDelivery(history: Array<{ role: string; parts: Array<{ text?: string }> }>): { found: boolean; lastModelText: string | null } {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'model') continue;
    const text = msg.parts?.map(p => p.text || '').join('') || '';
    if (/storage\.googleapis\.com.*\.pdf|\.pdf.*[Tt]elecharger|[Tt]ÃƒÂ©lÃƒÂ©charger.*\.pdf|release_file|Rapport.*Actualit/i.test(text)) {
      return { found: true, lastModelText: text };
    }
    if (i < history.length - 4) break;
  }
  return { found: false, lastModelText: null };
}

function classifyCoworkExecutionMode(_message: string, _history?: Array<{ role: string; parts: Array<{ text?: string }> }>): CoworkExecutionMode {
  return 'autonomous';
}

function requestNeedsMusicCatalogResearch(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
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
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  return (!requestAsksForWriting(message) && requestNeedsCurrentDateGrounding(message))
    || requestNeedsExternalGrounding(message)
    || /\b(proces|tribunal|justice|plainte|plaignant|plaignante|accusation|accuse|accusee|condamn|verdict|jugement|cour|mandat|arret|prison|viol|agression|police|avocat|extrad|detention)\b/.test(normalized)
    || /\b(documentation|docs?|version|release|sortie|mise a jour|update|benchmark|compar|compare|comparatif|roadmap|api|sdk|modele|model)\b/.test(normalized);
}

function requestIsCurrentAffairs(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  return /\b(actualite|actu|news|briefing|headline|presse|monde|international|france|breaking)\b/.test(normalized);
}

function requestNeedsCurrentDateGrounding(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  return /\b(today|aujourd'hui|du jour|ce jour|latest|recent|recente|recentes|dernier|derniere|dernieres|maintenant|en ce moment)\b/.test(normalized)
    || requestIsCurrentAffairs(message);
}

function requestNeedsLongFormPdf(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  if (!requestNeedsPdf(message)) return false;
  const normalized = normalizeCoworkText(message);
  if (/\b(attestation|certificat)\b/.test(normalized)) return false;
  return /\b(tres long|tres longue|long|longue|detaille|detaillee|complet|complete|magnifique|beau|soigne|rapport|briefing|analyse|dossier|actu|actualite|news)\b/.test(normalized);
}

function requestNeedsFormalDocument(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const intentWindow = getCoworkIntentWindow(message);
  const formalDocumentNoun = /\b(attestation|certificat|lettre|courrier|declaration|convention|contrat|devis|facture)\b/;
  if (!formalDocumentNoun.test(intentWindow)) return false;
  return requestHasDeliverableIntent(intentWindow)
    || requestStartsWithDeliverableNoun(intentWindow, formalDocumentNoun);
}

function requestNeedsFictionalDetails(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const normalized = normalizeCoworkText(message);
  return /\b(fictif|fictive|fictionnel|fictionnelle|imaginaire|invente|inventee|simule|simulee|faux|fausse)\b/.test(normalized);
}

function requestNeedsPdfArtifact(message: string): boolean {
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const intentWindow = getCoworkIntentWindow(message);
  const presentationArtifactNoun = /\b(presentation|brochure|plaquette|cv|diaporama|slides?|powerpoint|pptx?)\b/;
  if (/\bpdf\b/.test(intentWindow) || requestNeedsFormalDocument(message)) return true;
  if (!presentationArtifactNoun.test(intentWindow)) return false;
  return requestHasDeliverableIntent(intentWindow)
    || requestStartsWithDeliverableNoun(intentWindow, presentationArtifactNoun);
}

const PDF_SESSION_WORD_CAP = 3000;
const PDF_APPEND_WORD_MIN = 300;
const PDF_APPEND_WORD_MAX = 600;

function extractRequestedWordCount(message: string): number | null {
  const normalized = normalizeCoworkText(message);
  const match = normalized.match(/\b(\d{2,5})\s*(?:mots?|words?)\b/);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return Math.max(100, Math.min(value, 12000));
}

function normalizePdfTheme(value: string | undefined, fallback: PdfTheme = 'report'): PdfTheme {
  const normalized = normalizeCoworkText(value || '');
  if (normalized.includes('legal') || normalized.includes('jurid') || normalized.includes('officiel') || normalized.includes('formal')) {
    return 'legal';
  }
  if (normalized.includes('news') || normalized.includes('magazine') || normalized.includes('presse') || normalized.includes('editorial')) {
    return 'news';
  }
  if (normalized.includes('report') || normalized.includes('corporate') || normalized.includes('rapport')) {
    return 'report';
  }
  return fallback;
}

function resolvePdfTheme(
  _message: string,
  options: { formalDocument?: boolean; explicitTheme?: string } = {}
): PdfTheme {
  if (options.explicitTheme) {
    return normalizePdfTheme(options.explicitTheme, 'report');
  }
  if (options.formalDocument) {
    return 'legal';
  }
  return 'report';
}

function resolvePdfLengthPolicy(message: string, baselineWords: number) {
  const requestedWordCount = extractRequestedWordCount(message);
  const clampedRequested = requestedWordCount ? Math.min(requestedWordCount, PDF_SESSION_WORD_CAP) : null;
  const targetWords = Math.max(baselineWords, clampedRequested || 0);
  return {
    requestedWordCount,
    targetWords,
    cappedWords: Boolean(requestedWordCount && requestedWordCount > PDF_SESSION_WORD_CAP),
  };
}

function getPdfQualityTargets(_message: string): PdfQualityTargets | null {
  return null;
}

function requestNeedsPdfSelfReview(_message: string): boolean {
  return false;
}

function normalizePdfSourcesMode(value?: string | null): PdfDraftSourcesMode {
  return String(value || '').trim().toLowerCase() === 'replace'
    ? 'replace'
    : 'append';
}

function normalizePdfSections(sections: PdfSectionInput[] | null | undefined): NormalizedPdfSection[] {
  return (Array.isArray(sections) ? sections : [])
    .filter(section => Boolean(section?.heading?.trim() || section?.body?.trim()))
    .map(section => ({
      heading: section.heading?.trim() || undefined,
      body: section.body?.trim() || '',
      visualTheme: section.visualTheme?.trim() || undefined,
      accentColor: section.accentColor?.trim() || undefined,
      mood: section.mood?.trim() || undefined,
      motif: section.motif?.trim() || undefined,
      pageStyle: section.pageStyle === 'hero' || section.pageStyle === 'feature' || section.pageStyle === 'standard'
        ? section.pageStyle
        : undefined,
      pageBreakBefore: typeof section.pageBreakBefore === 'boolean' ? section.pageBreakBefore : undefined,
      flagHints: Array.isArray(section.flagHints)
        ? Array.from(new Set(section.flagHints.map(flag => flag.trim()).filter(Boolean))).slice(0, 6)
        : undefined
    }));
}

function normalizePdfSectionOperations(
  operations: PdfDraftSectionOperationInput[] | null | undefined
): NormalizedPdfDraftSectionOperation[] {
  return (Array.isArray(operations) ? operations : [])
    .map(operation => {
      const action = String(operation?.action || '').trim().toLowerCase();
      if (
        action !== 'replace'
        && action !== 'remove'
        && action !== 'insert_before'
        && action !== 'insert_after'
        && action !== 'append'
      ) {
        return null;
      }

      const numericIndex = Number(operation?.index);
      const normalizedIndex = Number.isFinite(numericIndex) && numericIndex >= 1
        ? Math.floor(numericIndex)
        : null;
      const normalizedSection = operation?.section
        ? normalizePdfSections([operation.section])[0]
        : undefined;

      return {
        action: action as PdfDraftSectionRevisionAction,
        index: normalizedIndex,
        section: normalizedSection,
      };
    })
    .filter(Boolean) as NormalizedPdfDraftSectionOperation[];
}

function normalizePdfSources(sources: string[] | null | undefined): string[] {
  return (Array.isArray(sources) ? sources : [])
    .map(source => source.trim())
    .filter(Boolean);
}

function normalizePdfEngine(value?: string | null, fallback: PdfEngineSelection = 'auto'): PdfEngineSelection {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'latex' || normalized === 'pdfkit' || normalized === 'auto') return normalized;
  return fallback;
}

function requestNeedsPremiumLatexPdf(_message: string, _pdfQualityTargets: PdfQualityTargets | null, _theme?: string): boolean {
  const normalized = '';
  return false;
  return /\b(pdf|rapport|magazine|news|journal|mise en page|beau|belle|premium|editorial|sublime|soigne|creatif|crÃƒÂ©atif|theme|th[eÃƒÂ¨]me|latex)\b/.test(normalized);
}

function resolvePdfEngine(
  _message: string,
  options: {
    explicitEngine?: string | null;
    pdfQualityTargets: PdfQualityTargets | null;
    theme?: string;
  }
): PdfEngine {
  const normalized = normalizePdfEngine(options.explicitEngine, 'auto');
  if (normalized === 'latex' || normalized === 'pdfkit') return normalized;
  return 'pdfkit';
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
    ...draft.sections.flatMap(section => [
      section.heading || '',
      section.body,
      section.visualTheme || '',
      section.mood || '',
      section.motif || '',
      ...(section.flagHints || [])
    ]),
    ...draft.sources
  ].join(' ');
}

function buildPdfDraftLatexSource(draft: PdfDraftSnapshot, options: {
  compiler: LatexCompiler | null;
  theme: PdfTheme;
  accentColor?: string;
  requestClock?: RequestClock;
}): string {
  return buildLatexDocument({
    compiler: options.compiler,
    theme: options.theme,
    title: draft.title || 'Document Cowork',
    subtitle: draft.subtitle || undefined,
    summary: draft.summary || undefined,
    author: draft.author || undefined,
    accentColor: options.accentColor,
    sections: draft.sections,
    sources: draft.sources,
    absoluteDateTimeLabel: options.requestClock?.absoluteDateTimeLabel,
    dateLabel: options.requestClock?.dateLabel,
  });
}

function buildPdfDraftContentForMetrics(options: {
  draft: PdfDraftSnapshot;
  engine: PdfEngine;
  latexSource?: string | null;
}): string {
  if (options.engine === 'latex' && options.latexSource?.trim()) {
    return stripLatexToPlainText(options.latexSource);
  }
  return buildPdfDraftCombinedContent(options.draft);
}

function buildPdfDraftSignature(draft: PdfDraftSnapshot): string {
  const payload = {
    title: draft.title,
    subtitle: draft.subtitle,
    summary: draft.summary,
    author: draft.author,
    sections: draft.sections.map(section => ({
      heading: section.heading || '',
      body: section.body,
      visualTheme: section.visualTheme || '',
      accentColor: section.accentColor || '',
      mood: section.mood || '',
      motif: section.motif || '',
      pageStyle: section.pageStyle || '',
      pageBreakBefore: Boolean(section.pageBreakBefore),
      flagHints: section.flagHints || []
    })),
    sources: draft.sources
  };
  return createHash('sha1').update(JSON.stringify(payload)).digest('hex').slice(0, 16);
}

function createRecoverablePdfDraftError(message: string): Error {
  const error = new Error(message);
  (error as any).recoverable = true;
  return error;
}

function applyPdfSectionOperations(
  baseSections: NormalizedPdfSection[],
  operations: NormalizedPdfDraftSectionOperation[]
): NormalizedPdfSection[] {
  const nextSections = [...baseSections];

  for (let operationIndex = 0; operationIndex < operations.length; operationIndex += 1) {
    const operation = operations[operationIndex];
    const label = `operation ${operationIndex + 1}`;

    if (operation.action === 'append') {
      if (!operation.section) {
        throw createRecoverablePdfDraftError(`Revision invalide: ${label} doit fournir une section a ajouter.`);
      }
      nextSections.push(operation.section);
      continue;
    }

    if (nextSections.length === 0) {
      if ((operation.action === 'insert_before' || operation.action === 'insert_after') && operation.index === 1 && operation.section) {
        nextSections.push(operation.section);
        continue;
      }
      throw createRecoverablePdfDraftError(`Revision invalide: ${label} vise un index alors que le brouillon n'a encore aucune section.`);
    }

    if (!operation.index || operation.index < 1 || operation.index > nextSections.length) {
      throw createRecoverablePdfDraftError(`Revision invalide: ${label} doit viser un index compris entre 1 et ${nextSections.length}.`);
    }

    const resolvedIndex = operation.index - 1;
    if (operation.action === 'remove') {
      nextSections.splice(resolvedIndex, 1);
      continue;
    }

    if (!operation.section) {
      throw createRecoverablePdfDraftError(`Revision invalide: ${label} doit fournir une section complete pour l'action '${operation.action}'.`);
    }

    if (operation.action === 'replace') {
      nextSections.splice(resolvedIndex, 1, operation.section);
      continue;
    }

    if (operation.action === 'insert_before') {
      nextSections.splice(resolvedIndex, 0, operation.section);
      continue;
    }

    if (operation.action === 'insert_after') {
      nextSections.splice(resolvedIndex + 1, 0, operation.section);
      continue;
    }
  }

  return nextSections;
}

function activePdfDraftToSnapshot(draft: ActivePdfDraft): PdfDraftSnapshot {
  return {
    title: draft.title,
    subtitle: draft.subtitle,
    summary: draft.summary,
    author: draft.author,
    sections: draft.sections,
    sources: draft.sources
  };
}

function buildActivePdfDraftSignature(draft: ActivePdfDraft): string {
  if (draft.engine === 'latex' && draft.latexSource?.trim()) {
    return buildLatexSourceSignature(draft.latexSource, draft.compiler);
  }
  return buildPdfDraftSignature(activePdfDraftToSnapshot(draft));
}

function buildPdfDraftStats(draft: ActivePdfDraft): PdfDraftStats {
  const sectionCount = draft.sections.length;
  return {
    draftId: draft.draftId,
    engine: draft.engine,
    compiler: draft.compiler,
    sourceMode: draft.sourceMode,
    theme: draft.theme,
    signature: buildActivePdfDraftSignature(draft),
    wordCount: draft.wordCount,
    targetWords: draft.targetWords,
    requestedWordCount: draft.requestedWordCount,
    cappedWords: draft.cappedWords,
    sectionCount,
    titledSectionCount: draft.sections.filter(section => Boolean(section.heading)).length,
    sourceCount: draft.sources.length,
    missingWords: Math.max(0, draft.targetWords - draft.wordCount),
    approvedReviewSignature: draft.approvedReviewSignature,
    hasLatexSource: Boolean(draft.latexSource?.trim())
  };
}

function buildPdfLengthCapMessage(targetWords: number, requestedWordCount: number | null, cappedWords: boolean): string | undefined {
  if (!cappedWords || !requestedWordCount) return undefined;
  return `La demande visait ${requestedWordCount} mots, mais Cowork est plafonne a environ ${targetWords} mots par session PDF. Construis un document dense dans cette limite et annonce-la honnetement.`;
}

function humanizePdfTitle(value: string | undefined, fallback = 'Document Cowork'): string {
  const cleaned = String(value || '')
    .replace(/\.pdf$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildFallbackPdfSections(draft: PdfDraftSnapshot): NormalizedPdfSection[] {
  const fallbackBody = [draft.summary, draft.subtitle]
    .map(value => value.trim())
    .filter(Boolean)
    .join('\n\n')
    .trim();
  if (!fallbackBody) return [];
  return [{
    heading: draft.sections.length === 0 ? 'Contenu' : undefined,
    body: fallbackBody
  }];
}

function sanitizePdfFilenameBase(value: string | undefined, fallback = 'document-cowork'): string {
  const normalized = (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || fallback;
}

function refreshActivePdfDraft(draft: ActivePdfDraft): ActivePdfDraft {
  return {
    ...draft,
    wordCount: countWords(buildPdfDraftContentForMetrics({
      draft: activePdfDraftToSnapshot(draft),
      engine: draft.engine,
      latexSource: draft.latexSource
    }))
  };
}

function createActivePdfDraft(
  message: string,
  input: {
    filename?: string;
    title: string;
    subtitle?: string;
    summary?: string;
    author?: string;
    engine?: string;
    compiler?: string;
    latexSource?: string;
    theme?: string;
    accentColor?: string;
    sources?: string[] | null;
    sections?: PdfSectionInput[] | null;
  },
  pdfQualityTargets: PdfQualityTargets | null,
  requestClock?: RequestClock
): ActivePdfDraft {
  const snapshot = buildPdfDraftSnapshot(input);
  const theme = normalizePdfTheme(input.theme, resolvePdfTheme(message, {
    formalDocument: pdfQualityTargets?.formalDocument,
    explicitTheme: input.theme
  }));
  const engine = resolvePdfEngine(message, {
    explicitEngine: input.engine,
    pdfQualityTargets,
    theme
  });
  const compiler = engine === 'latex' ? normalizeLatexCompiler(input.compiler) : null;
  const sourceMode: PdfSourceMode = engine === 'latex' && input.latexSource?.trim() ? 'raw' : 'generated';
  const nextDraft = refreshActivePdfDraft({
    draftId: randomUUID(),
    filename: sanitizePdfFilenameBase(input.filename || input.title || 'document-cowork'),
    engine,
    compiler,
    sourceMode,
    latexSource: null,
    theme,
    accentColor: input.accentColor?.trim() || undefined,
    requestedWordCount: pdfQualityTargets?.requestedWordCount ?? null,
    targetWords: 0,
    cappedWords: Boolean(pdfQualityTargets?.cappedWordCount),
    approvedReviewSignature: null,
    wordCount: 0,
    ...snapshot
  });
  const latexSource = engine === 'latex'
    ? (input.latexSource?.trim() || buildPdfDraftLatexSource(snapshot, {
        compiler,
        theme,
        accentColor: nextDraft.accentColor,
        requestClock
      }))
    : null;
  const withSource = refreshActivePdfDraft({
    ...nextDraft,
    latexSource
  });
  return {
    ...withSource,
    targetWords: Math.max(pdfQualityTargets?.minWords || 0, withSource.wordCount)
  };
}

function appendToActivePdfDraft(
  message: string,
  draft: ActivePdfDraft,
  input: {
    subtitle?: string;
    summary?: string;
    author?: string;
    engine?: string;
    compiler?: string;
    latexSource?: string;
    theme?: string;
    accentColor?: string;
    filename?: string;
    sources?: string[] | null;
    sections?: PdfSectionInput[] | null;
  },
  requestClock?: RequestClock
): ActivePdfDraft {
  const normalizedSections = normalizePdfSections(input.sections);
  const normalizedSources = normalizePdfSources(input.sources);
  const theme = input.theme
    ? normalizePdfTheme(input.theme, draft.theme)
    : draft.theme || 'report';
  const engine = resolvePdfEngine(message, {
    explicitEngine: input.engine || draft.engine,
    pdfQualityTargets: null,
    theme
  });
  const compiler = engine === 'latex'
    ? normalizeLatexCompiler(input.compiler || draft.compiler || 'xelatex')
    : null;
  const snapshot = buildPdfDraftSnapshot({
    title: draft.title,
    subtitle: input.subtitle ?? draft.subtitle,
    summary: input.summary ?? draft.summary,
    author: input.author ?? draft.author,
    sections: [...draft.sections, ...normalizedSections],
    sources: Array.from(new Set([...draft.sources, ...normalizedSources]))
  });

  let latexSource = engine === 'latex' ? draft.latexSource : null;
  let sourceMode: PdfSourceMode = draft.sourceMode;
  if (engine === 'latex') {
    if (input.latexSource?.trim()) {
      latexSource = input.latexSource.trim();
      sourceMode = 'raw';
    } else if (draft.sourceMode === 'raw' && draft.latexSource) {
      const fragment = buildLatexFragment({
        sections: normalizedSections,
        sources: normalizedSources
      });
      latexSource = appendLatexFragmentToDocument(draft.latexSource, fragment);
      sourceMode = 'raw';
    } else {
      latexSource = buildPdfDraftLatexSource(snapshot, {
        compiler,
        theme,
        accentColor: input.accentColor?.trim() || draft.accentColor,
        requestClock
      });
      sourceMode = input.latexSource?.trim() ? 'raw' : 'generated';
    }
  } else {
    latexSource = null;
    sourceMode = 'generated';
  }

  return refreshActivePdfDraft({
    ...draft,
    ...snapshot,
    engine,
    compiler,
    sourceMode,
    latexSource,
    filename: sanitizePdfFilenameBase(input.filename || draft.filename || draft.title),
    theme,
    accentColor: input.accentColor?.trim() || draft.accentColor,
    approvedReviewSignature: null
  });
}

function reviseActivePdfDraft(
  message: string,
  draft: ActivePdfDraft,
  input: {
    title?: string;
    subtitle?: string;
    summary?: string;
    author?: string;
    engine?: string;
    compiler?: string;
    latexSource?: string;
    theme?: string;
    accentColor?: string;
    filename?: string;
    sourcesMode?: string;
    sources?: string[] | null;
    sections?: PdfSectionInput[] | null;
    sectionOperations?: PdfDraftSectionOperationInput[] | null;
  },
  requestClock?: RequestClock
): ActivePdfDraft {
  const normalizedReplacementSections = Array.isArray(input.sections)
    ? normalizePdfSections(input.sections)
    : null;
  const normalizedOperations = normalizePdfSectionOperations(input.sectionOperations);
  const normalizedSources = normalizePdfSources(input.sources);
  if (Array.isArray(input.sections) && input.sections.length > 0 && normalizedReplacementSections.length === 0) {
    throw createRecoverablePdfDraftError("Revision invalide: la liste `sections` doit contenir au moins une section exploitable ou etre explicitement vide pour repartir de zero.");
  }
  if (Array.isArray(input.sectionOperations) && input.sectionOperations.length > 0 && normalizedOperations.length === 0) {
    throw createRecoverablePdfDraftError("Revision invalide: `sectionOperations` ne contient aucune operation reconnue.");
  }
  const sourcesMode = normalizePdfSourcesMode(input.sourcesMode);
  const theme = input.theme
    ? normalizePdfTheme(input.theme, draft.theme)
    : draft.theme || 'report';
  const engine = resolvePdfEngine(message, {
    explicitEngine: input.engine || draft.engine,
    pdfQualityTargets: null,
    theme
  });
  const compiler = engine === 'latex'
    ? normalizeLatexCompiler(input.compiler || draft.compiler || 'xelatex')
    : null;

  const hasRawLatexDependentChange = engine === 'latex'
    && draft.engine === 'latex'
    && draft.sourceMode === 'raw'
    && !input.latexSource?.trim()
    && (
      input.title !== undefined
      || input.subtitle !== undefined
      || input.summary !== undefined
      || input.author !== undefined
      || input.theme !== undefined
      || input.accentColor !== undefined
      || Array.isArray(input.sources)
      || Array.isArray(input.sections)
      || normalizedOperations.length > 0
    );
  if (hasRawLatexDependentChange) {
    throw createRecoverablePdfDraftError(
      "Ce brouillon LaTeX est en mode source libre. Pour le reviser vraiment, renvoie un 'latexSource' complet mis a jour ou bascule explicitement vers 'engine=\"pdfkit\"'."
    );
  }

  const baseSections = normalizedReplacementSections ?? [...draft.sections];
  const sections = normalizedOperations.length > 0
    ? applyPdfSectionOperations(baseSections, normalizedOperations)
    : baseSections;
  const sources = Array.isArray(input.sources)
    ? (
        sourcesMode === 'replace'
          ? normalizedSources
          : Array.from(new Set([...draft.sources, ...normalizedSources]))
      )
    : [...draft.sources];
  const snapshot = buildPdfDraftSnapshot({
    title: input.title ?? draft.title,
    subtitle: input.subtitle ?? draft.subtitle,
    summary: input.summary ?? draft.summary,
    author: input.author ?? draft.author,
    sections,
    sources
  });

  let latexSource = engine === 'latex' ? draft.latexSource : null;
  let sourceMode: PdfSourceMode = draft.sourceMode;
  if (engine === 'latex') {
    if (input.latexSource?.trim()) {
      latexSource = input.latexSource.trim();
      sourceMode = 'raw';
    } else {
      latexSource = buildPdfDraftLatexSource(snapshot, {
        compiler,
        theme,
        accentColor: input.accentColor?.trim() || draft.accentColor,
        requestClock
      });
      sourceMode = 'generated';
    }
  } else {
    latexSource = null;
    sourceMode = 'generated';
  }

  return refreshActivePdfDraft({
    ...draft,
    ...snapshot,
    engine,
    compiler,
    sourceMode,
    latexSource,
    filename: sanitizePdfFilenameBase(input.filename || draft.filename || snapshot.title || draft.title),
    theme,
    accentColor: input.accentColor?.trim() || draft.accentColor,
    approvedReviewSignature: null
  });
}

function reviewPdfDraft(
  message: string,
  draft: PdfDraftSnapshot,
  pdfQualityTargets: PdfQualityTargets | null,
  overrides?: {
    combinedContent?: string;
    sectionCount?: number;
    title?: string;
    engine?: PdfEngine;
    compiler?: LatexCompiler | null;
  }
): PdfDraftReview {
  const effectiveTitle = overrides?.title ?? draft.title;
  const combinedContent = overrides?.combinedContent ?? buildPdfDraftCombinedContent(draft);
  const totalWords = countWords(combinedContent);
  const sectionCount = overrides?.sectionCount ?? draft.sections.length;
  const blockingIssues: string[] = [];
  const improvements: string[] = [];
  const strengths: string[] = [];
  const formalDocument = Boolean(pdfQualityTargets?.formalDocument);
  const requireInventedDetails = Boolean(pdfQualityTargets?.requireInventedDetails);

  if (!effectiveTitle) {
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

  if (!formalDocument && !draft.summary && totalWords >= 700) {
    improvements.push("ajoute un resume executif clair pour mieux cadrer le document");
  } else if (!formalDocument && draft.summary) {
    strengths.push("resume executif present");
  }

  if (!formalDocument && draft.sources.length === 0 && totalWords >= 500) {
    improvements.push("ajoute des sources explicites si tu veux renforcer la credibilite du PDF");
  } else if (draft.sources.length > 0) {
    strengths.push(`${draft.sources.length} source(s) mentionnee(s)`);
  }

  if (draft.sections.length > 0) {
    const sectionWordCounts = draft.sections.map(section => countWords([section.heading || '', section.body].join(' ')));
    const largestSectionWords = sectionWordCounts.length > 0 ? Math.max(...sectionWordCounts) : 0;
    if (totalWords >= 300 && sectionCount > 1 && largestSectionWords / Math.max(totalWords, 1) > 0.72) {
      blockingIssues.push("reequilibre le document: un seul bloc porte encore presque tout le contenu");
    }

    const largeUntitledSections = draft.sections.filter(section => !section.heading && countWords(section.body) >= (formalDocument ? 32 : 80)).length;
    if (largeUntitledSections > 0) {
      improvements.push("ajoute des intertitres aux blocs encore trop massifs");
    }
  }

  if (formalDocument && !draft.author) {
    improvements.push("precise un signataire ou une mention de signature si c'est coherent");
  }

  return finalizePdfDraftReview({
    signature: buildPdfDraftSignature(draft),
    engine: overrides?.engine || 'pdfkit',
    compiler: overrides?.compiler || null,
    totalWords,
    sectionCount,
    blockingIssues,
    improvements,
    strengths,
  });
}

function finalizePdfDraftReview(input: {
  signature: string;
  engine?: PdfEngine;
  compiler?: LatexCompiler | null;
  totalWords: number;
  sectionCount: number;
  blockingIssues: string[];
  improvements: string[];
  strengths: string[];
  compileLogPreview?: string;
  cacheHit?: boolean;
  provider?: LatexProvider;
}): PdfDraftReview {
  // LIBERATION: la review retourne toujours ready=true. Les issues deviennent des suggestions.
  let score = 100;
  score -= Math.min(40, input.blockingIssues.length * 10);
  score -= Math.min(20, input.improvements.length * 5);
  score = Math.max(20, Math.min(100, score));

  const allSuggestions = [...input.blockingIssues, ...input.improvements];
  const messageParts = [
    `Review PDF (${score}/100).`,
    input.strengths.length > 0 ? `Points forts: ${input.strengths.join(', ')}.` : '',
    allSuggestions.length > 0 ? `Suggestions d'amelioration: ${allSuggestions.join('; ')}.` : 'Aucune suggestion particuliere.'
  ];

  return {
    success: true,
    ready: true, // Toujours pret Ã¢â‚¬â€ le modele decide s'il veut ameliorer
    score,
    signature: input.signature,
    engine: input.engine || 'pdfkit',
    compiler: input.compiler || null,
    totalWords: input.totalWords,
    sectionCount: input.sectionCount,
    blockingIssues: input.blockingIssues,
    improvements: input.improvements,
    strengths: input.strengths,
    message: messageParts.filter(Boolean).join(' '),
    ...(input.compileLogPreview ? { compileLogPreview: input.compileLogPreview } : {}),
    ...(typeof input.cacheHit === 'boolean' ? { cacheHit: input.cacheHit } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
  };
}

function buildLatexAwarePdfReview(input: {
  message: string;
  draft: PdfDraftSnapshot;
  pdfQualityTargets: PdfQualityTargets | null;
  latexSource: string;
  compiler: LatexCompiler | null;
}): PdfDraftReview {
  const extractedTitle = extractLatexCommandValue(input.latexSource, 'title');
  const plainText = stripLatexToPlainText(input.latexSource);
  const semanticReview = reviewPdfDraft(
    input.message,
    input.draft,
    input.pdfQualityTargets,
    {
      combinedContent: plainText || buildPdfDraftCombinedContent(input.draft),
      sectionCount: Math.max(input.draft.sections.length, countLatexSections(input.latexSource)),
      title: input.draft.title || extractedTitle || undefined,
      engine: 'latex',
      compiler: input.compiler || null,
    }
  );
  const validation = validateLatexSource(input.latexSource);
  const blockingIssues = [...semanticReview.blockingIssues];
  const improvements = [...semanticReview.improvements];
  const strengths = [...semanticReview.strengths];

  if (validation.unsupportedPackages.length > 0) {
    blockingIssues.push(`packages LaTeX non autorises: ${validation.unsupportedPackages.join(', ')}`);
  } else if (validation.usedPackages.length > 0) {
    strengths.push(`${validation.usedPackages.length} package(s) autorise(s) detecte(s)`);
  }
  if (validation.dangerousCommands.length > 0) {
    blockingIssues.push(`commandes LaTeX interdites detectees: ${validation.dangerousCommands.join(', ')}`);
  }
  if (validation.missingDocumentStructure.length > 0) {
    blockingIssues.push(`structure LaTeX incomplete: ${validation.missingDocumentStructure.join(', ')}`);
  }

  return finalizePdfDraftReview({
    signature: buildLatexSourceSignature(input.latexSource, input.compiler),
    engine: 'latex',
    compiler: input.compiler || null,
    totalWords: semanticReview.totalWords,
    sectionCount: semanticReview.sectionCount,
    blockingIssues,
    improvements,
    strengths,
  });
}

function validateCreatePdfReviewSignature(options: {
  reviewSignature?: string;
  latestApprovedPdfReviewSignature: string | null;
  draftReview: PdfDraftReview;
}): { ok: true; warning?: string; reviewSignatureIgnored?: boolean } {
  const { reviewSignature, latestApprovedPdfReviewSignature, draftReview } = options;
  const normalizedReviewSignature = typeof reviewSignature === 'string' ? reviewSignature.trim() : '';
  if (!normalizedReviewSignature) {
    return { ok: true };
  }

  if (normalizedReviewSignature === draftReview.signature) {
    return { ok: true };
  }

  if (latestApprovedPdfReviewSignature && latestApprovedPdfReviewSignature === normalizedReviewSignature) {
    return {
      ok: true,
      warning: "La signature fournie correspond a une review precedente, mais le brouillon a change depuis. L'export continue sans bloquer, mais cette review sera consideree comme informative et non comme cache reutilisable.",
      reviewSignatureIgnored: true
    };
  }

  return {
    ok: true,
    warning: "La signature de review fournie ne correspond pas a cette version du brouillon. L'export continue sans bloquer; si tu veux reutiliser une review exacte ou un cache de compilation, relance d'abord 'review_pdf_draft' sur cette version precise.",
    reviewSignatureIgnored: true
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

const MONTH_NAME_PATTERN = '(?:janvier|fevrier|fÃƒÂ©vrier|mars|avril|mai|juin|juillet|aout|aoÃƒÂ»t|septembre|octobre|novembre|decembre|dÃƒÂ©cembre|january|february|march|april|may|june|july|august|september|october|november|december)';

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
  if (requestIsCoworkMetaDiscussion(message)) return false;
  const intentWindow = getCoworkIntentWindow(message);
  if (/\b(pdf|telecharger|telecharge|telechargement|download)\b/.test(intentWindow)
    || /\.(pdf|docx?|pptx?)\b/.test(intentWindow)) {
    return true;
  }

  const artifactNoun = /\b(fichier|document|rapport|attestation|presentation|brochure|plaquette|cv|certificat|lettre|courrier|declaration|convention|contrat|devis|facture|diaporama|slides?|powerpoint|pptx?)\b/;
  if (!artifactNoun.test(intentWindow)) return false;

  return requestHasDeliverableIntent(intentWindow)
    || requestStartsWithDeliverableNoun(intentWindow, artifactNoun);
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

type RenderedPdfArtifactResult = {
  path: string;
  pageCount: number;
  blankBodyPageCount: number;
  usedCoverPage: boolean;
  theme: PdfTheme;
};

async function renderPdfArtifact(options: {
  outputPath: string;
  title: string;
  subtitle?: string;
  summary?: string;
  author?: string;
  accentColor?: string;
  showPageNumbers?: boolean;
  sections: NormalizedPdfSection[];
  sources: string[];
  requestClock: RequestClock;
  message: string;
  pdfQualityTargets: PdfQualityTargets | null;
  theme?: PdfTheme;
}): Promise<RenderedPdfArtifactResult> {
  const theme = normalizePdfTheme(
    options.theme,
    resolvePdfTheme(options.message, {
      formalDocument: Boolean(options.pdfQualityTargets?.formalDocument)
    })
  );
  const formalDocumentLayout = theme === 'legal' || Boolean(options.pdfQualityTargets?.formalDocument);
  const totalWords = countWords([
    options.title,
    options.subtitle || '',
    options.summary || '',
    ...options.sections.flatMap(section => [section.heading || '', section.body]),
    ...options.sources
  ].join(' '));
  const canUseCoverPage =
    !formalDocumentLayout
    && (
      (theme === 'news' && totalWords >= 800 && options.sections.length >= 4)
      || (theme === 'report' && totalWords >= 900 && options.sections.length >= 4)
    );

  const renderOnce = (useCoverPage: boolean) => new Promise<RenderedPdfArtifactResult>((resolve, reject) => {
    try {
      fs.rmSync(options.outputPath, { force: true });
    } catch {}

    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 72, right: 64, bottom: 64, left: 64 },
      bufferPages: true,
      autoFirstPage: false,
      info: {
        Title: options.title,
        Author: options.author || 'Studio Pro Agent',
        Subject: options.subtitle || options.title,
        Creator: 'Studio Pro Agent'
      }
    });
    const stream = fs.createWriteStream(options.outputPath);

    const themeConfig = theme === 'legal'
      ? {
          accent: normalizeHexColor(options.accentColor, '#1e3a8a'),
          ink: '#0f172a',
          muted: '#334155',
          line: '#cbd5e1',
          panel: '#ffffff',
          white: '#ffffff',
          titleFont: 'Times-Bold',
          headingFont: 'Times-Bold',
          bodyFont: 'Times-Roman',
          masthead: 'DOCUMENT OFFICIEL',
          summaryLabel: 'Introduction',
          bodyAlign: 'left' as const,
        }
      : theme === 'news'
        ? {
            accent: normalizeHexColor(options.accentColor, '#b91c1c'),
            ink: '#111827',
            muted: '#4b5563',
            line: '#d1d5db',
            panel: '#f9fafb',
            white: '#ffffff',
            titleFont: 'Helvetica-Bold',
            headingFont: 'Helvetica-Bold',
            bodyFont: 'Helvetica',
            masthead: 'COWORK NEWS DESK',
            summaryLabel: 'Chapo',
            bodyAlign: 'justify' as const,
          }
        : {
            accent: normalizeHexColor(options.accentColor, '#1d4ed8'),
            ink: '#0f172a',
            muted: '#475569',
            line: '#dbe4ee',
            panel: '#f8fafc',
            white: '#ffffff',
            titleFont: 'Helvetica-Bold',
            headingFont: 'Helvetica-Bold',
            bodyFont: 'Helvetica',
            masthead: 'STUDIO PRO / COWORK REPORT',
            summaryLabel: 'Resume executif',
            bodyAlign: 'justify' as const,
          };

    const summaryText = formalDocumentLayout
      ? clipText(options.summary || '', 420)
      : clipText(options.summary || options.sections[0]?.body || '', theme === 'news' ? 640 : 900);
    const tocHeadings = options.sections
      .map(section => section.heading)
      .filter((heading): heading is string => Boolean(heading))
      .slice(0, 8);
    const useToc = useCoverPage && tocHeadings.length >= 5 && totalWords >= 1200;
    const pageMetrics: Array<{ kind: 'cover' | 'body'; bodyBlocks: number }> = [];

    const bodyWidth = () => doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const pageBottom = () => doc.page.height - doc.page.margins.bottom - 24;
    const markPage = (kind: 'cover' | 'body') => {
      pageMetrics.push({ kind, bodyBlocks: 0 });
    };
    const markBodyContent = () => {
      if (pageMetrics.length === 0) markPage('body');
      const current = pageMetrics[pageMetrics.length - 1];
      current.bodyBlocks += 1;
    };
    const drawBodyHeader = () => {
      if (formalDocumentLayout) {
        doc.y = 72;
        return;
      }

      doc.save();
      doc.fillColor(themeConfig.white).rect(0, 0, doc.page.width, theme === 'news' ? 68 : 58).fill();
      if (theme === 'news') {
        doc.fillColor(themeConfig.accent).rect(0, 0, doc.page.width, 10).fill();
        doc
          .fillColor(themeConfig.ink)
          .font(themeConfig.headingFont)
          .fontSize(11.5)
          .text(themeConfig.masthead, doc.page.margins.left, 22);
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.bodyFont)
          .fontSize(9)
          .text(options.requestClock.dateLabel, doc.page.margins.left, 38);
      } else {
        doc.fillColor(themeConfig.accent).rect(doc.page.margins.left, 30, 50, 4).fill();
        doc
          .fillColor(themeConfig.ink)
          .font(themeConfig.headingFont)
          .fontSize(9.5)
          .text(themeConfig.masthead, doc.page.margins.left + 60, 24);
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.bodyFont)
          .fontSize(8.5)
          .text(options.requestClock.dateLabel, doc.page.margins.left + 60, 36);
      }
      doc.restore();
      doc.y = theme === 'news' ? 92 : 86;
    };
    const addBodyPage = () => {
      doc.addPage();
      markPage('body');
      drawBodyHeader();
    };
    const ensureSpace = (minHeight = 120) => {
      if (doc.y + minHeight > pageBottom()) {
        addBodyPage();
      }
    };
    const renderParagraph = (text: string) => {
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (!cleaned) return;
      ensureSpace(theme === 'legal' ? 72 : 60);
      markBodyContent();
      doc
        .fillColor(themeConfig.ink)
        .font(themeConfig.bodyFont)
        .fontSize(formalDocumentLayout ? 11.2 : 11.4)
        .text(cleaned, {
          width: bodyWidth(),
          align: themeConfig.bodyAlign,
          lineGap: formalDocumentLayout ? 4 : 3
        });
      doc.moveDown(formalDocumentLayout ? 0.95 : 0.72);
    };
    const renderBullet = (text: string) => {
      const cleaned = text.replace(/\s+/g, ' ').trim();
      if (!cleaned) return;
      ensureSpace(40);
      markBodyContent();
      const bulletX = doc.page.margins.left + 6;
      const textX = doc.page.margins.left + 18;
      const startY = doc.y;

      doc.save();
      doc.fillColor(themeConfig.accent).circle(bulletX, startY + 7, 2.5).fill();
      doc.restore();

      doc
        .fillColor(themeConfig.ink)
        .font(themeConfig.bodyFont)
        .fontSize(formalDocumentLayout ? 11 : 11.1)
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
        if (/^(?:[-*]\s+|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢\s+)/.test(line)) {
          flushParagraph();
          renderBullet(line.replace(/^(?:[-*]\s+|ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â¢\s+)/, ''));
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

      doc.font(themeConfig.bodyFont).fontSize(11.4);
      const computedHeight = doc.heightOfString(cleaned, {
        width: bodyWidth() - 36,
        lineGap: 3
      });
      const boxHeight = Math.min(180, Math.max(72, computedHeight + 34));
      ensureSpace(boxHeight + 18);
      markBodyContent();
      const startY = doc.y;

      doc.save();
      if (theme === 'news') {
        doc.fillColor(themeConfig.panel).rect(doc.page.margins.left, startY, bodyWidth(), boxHeight).fill();
        doc.fillColor(themeConfig.accent).rect(doc.page.margins.left, startY, 8, boxHeight).fill();
      } else {
        doc.lineWidth(1).fillColor(themeConfig.panel).strokeColor(themeConfig.line);
        doc.roundedRect(doc.page.margins.left, startY, bodyWidth(), boxHeight, 14).fillAndStroke();
        doc.fillColor(themeConfig.accent).rect(doc.page.margins.left + 18, startY + 18, 42, 4).fill();
      }
      doc
        .fillColor(themeConfig.muted)
        .font(themeConfig.headingFont)
        .fontSize(10)
        .text(heading.toUpperCase(), doc.page.margins.left + 20, startY + 18, {
          width: bodyWidth() - 40
        });
      doc
        .fillColor(themeConfig.ink)
        .font(themeConfig.bodyFont)
        .fontSize(11.4)
        .text(cleaned, doc.page.margins.left + 20, startY + 40, {
          width: bodyWidth() - 40,
          lineGap: 3,
          align: themeConfig.bodyAlign
        });
      doc.restore();
      doc.y = startY + boxHeight + 16;
    };
    const renderSection = (heading: string | undefined, body: string) => {
      if (heading) {
        ensureSpace(formalDocumentLayout ? 74 : 78);
        if (formalDocumentLayout) {
          markBodyContent();
          doc
            .fillColor(themeConfig.ink)
            .font(themeConfig.headingFont)
            .fontSize(12.5)
            .text(heading.toUpperCase(), {
              width: bodyWidth()
            });
          doc.moveDown(0.15);
          const dividerY = doc.y + 1;
          doc.save();
          doc.strokeColor(themeConfig.line).lineWidth(1);
          doc.moveTo(doc.page.margins.left, dividerY).lineTo(doc.page.width - doc.page.margins.right, dividerY).stroke();
          doc.restore();
          doc.moveDown(0.55);
        } else if (theme === 'news') {
          markBodyContent();
          doc.fillColor(themeConfig.accent).rect(doc.page.margins.left, doc.y + 8, 24, 3).fill();
          doc
            .fillColor(themeConfig.ink)
            .font(themeConfig.headingFont)
            .fontSize(17)
            .text(heading.toUpperCase(), doc.page.margins.left, doc.y + 12, {
              width: bodyWidth()
            });
          doc.moveDown(0.55);
        } else {
          markBodyContent();
          doc.fillColor(themeConfig.accent).rect(doc.page.margins.left, doc.y + 9, 10, 10).fill();
          doc
            .fillColor(themeConfig.ink)
            .font(themeConfig.headingFont)
            .fontSize(18)
            .text(heading, doc.page.margins.left + 20, doc.y, {
              width: bodyWidth() - 20
            });
          doc.moveDown(0.2);
          const dividerY = doc.y + 2;
          doc.save();
          doc.strokeColor(themeConfig.line).lineWidth(1);
          doc.moveTo(doc.page.margins.left, dividerY).lineTo(doc.page.width - doc.page.margins.right, dividerY).stroke();
          doc.restore();
          doc.moveDown(0.7);
        }
      }
      renderRichText(body);
    };

    doc.pipe(stream);

    if (useCoverPage) {
      doc.addPage();
      markPage('cover');
      const coverWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      doc.save();
      if (theme === 'news') {
        doc.fillColor(themeConfig.white).rect(0, 0, doc.page.width, doc.page.height).fill();
        doc.fillColor(themeConfig.accent).rect(0, 0, doc.page.width, 22).fill();
      } else {
        doc.fillColor(themeConfig.panel).rect(0, 0, doc.page.width, doc.page.height).fill();
        doc.fillColor(themeConfig.accent).rect(0, 0, doc.page.width, 152).fill();
      }
      doc.restore();

      doc
        .fillColor(theme === 'news' ? themeConfig.ink : themeConfig.white)
        .font(themeConfig.headingFont)
        .fontSize(theme === 'news' ? 12 : 11)
        .text(themeConfig.masthead, doc.page.margins.left, theme === 'news' ? 50 : 54);
      doc
        .fillColor(themeConfig.muted)
        .font(themeConfig.bodyFont)
        .fontSize(10.5)
        .text(options.requestClock.absoluteDateTimeLabel, doc.page.margins.left, theme === 'news' ? 70 : 76);

      doc.y = theme === 'news' ? 140 : 184;
      doc
        .fillColor(themeConfig.ink)
        .font(themeConfig.titleFont)
        .fontSize(theme === 'news' ? 30 : 29)
        .text(options.title, doc.page.margins.left, doc.y, { width: coverWidth });
      if (options.subtitle) {
        doc.moveDown(0.35);
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.bodyFont)
          .fontSize(theme === 'news' ? 14.5 : 14)
          .text(options.subtitle, { width: coverWidth });
      }
      if (options.author) {
        doc.moveDown(0.45);
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.headingFont)
          .fontSize(10)
          .text(`Par ${options.author}`, { width: coverWidth });
      }

      let nextBoxY = Math.max(doc.y + 26, theme === 'news' ? 300 : 336);
      if (summaryText) {
        const summaryBoxHeight = Math.min(
          170,
          Math.max(92, doc.heightOfString(summaryText, { width: coverWidth - 40, lineGap: 3 }) + 42)
        );
        doc.save();
        doc.lineWidth(1).fillColor(themeConfig.white).strokeColor(themeConfig.line);
        if (theme === 'news') {
          doc.rect(doc.page.margins.left, nextBoxY, coverWidth, summaryBoxHeight).fillAndStroke();
        } else {
          doc.roundedRect(doc.page.margins.left, nextBoxY, coverWidth, summaryBoxHeight, 16).fillAndStroke();
        }
        doc.fillColor(themeConfig.accent).rect(doc.page.margins.left + 20, nextBoxY + 18, 46, 4).fill();
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.headingFont)
          .fontSize(10)
          .text(themeConfig.summaryLabel.toUpperCase(), doc.page.margins.left + 20, nextBoxY + 30, {
            width: coverWidth - 40
          });
        doc
          .fillColor(themeConfig.ink)
          .font(themeConfig.bodyFont)
          .fontSize(11.4)
          .text(summaryText, doc.page.margins.left + 20, nextBoxY + 52, {
            width: coverWidth - 40,
            lineGap: 3,
            align: themeConfig.bodyAlign
          });
        doc.restore();
        nextBoxY += summaryBoxHeight + 18;
      }

      if (useToc && nextBoxY < doc.page.height - 120) {
        const tocHeight = Math.max(112, 42 + tocHeadings.length * 18);
        doc.save();
        doc.lineWidth(1).fillColor(themeConfig.white).strokeColor(themeConfig.line);
        if (theme === 'news') {
          doc.rect(doc.page.margins.left, nextBoxY, coverWidth, tocHeight).fillAndStroke();
        } else {
          doc.roundedRect(doc.page.margins.left, nextBoxY, coverWidth, tocHeight, 16).fillAndStroke();
        }
        doc.fillColor(themeConfig.accent).rect(doc.page.margins.left + 20, nextBoxY + 18, 46, 4).fill();
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.headingFont)
          .fontSize(10)
          .text('PLAN DU DOCUMENT', doc.page.margins.left + 20, nextBoxY + 30, {
            width: coverWidth - 40
          });
        let tocY = nextBoxY + 56;
        tocHeadings.forEach((heading, index) => {
          doc.fillColor(themeConfig.accent).circle(doc.page.margins.left + 24, tocY + 6, 2.5).fill();
          doc
            .fillColor(themeConfig.ink)
            .font(themeConfig.bodyFont)
            .fontSize(11)
            .text(`${index + 1}. ${heading}`, doc.page.margins.left + 36, tocY, {
              width: coverWidth - 56
            });
          tocY += 18;
        });
        doc.restore();
      }
    }

    addBodyPage();
    if (formalDocumentLayout) {
      doc.y = 62;
      doc
        .fillColor(themeConfig.muted)
        .font(themeConfig.bodyFont)
        .fontSize(10)
        .text(options.requestClock.dateLabel, {
          width: bodyWidth(),
          align: 'right'
        });
      if (options.author) {
        doc.moveDown(0.2);
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.bodyFont)
          .fontSize(10)
          .text(options.author, {
            width: bodyWidth(),
            align: 'right'
          });
      }
      doc.moveDown(1.1);
      markBodyContent();
      doc
        .fillColor(themeConfig.ink)
        .font(themeConfig.titleFont)
        .fontSize(20)
        .text(options.title, {
          width: bodyWidth(),
          align: 'center'
        });
      if (options.subtitle) {
        doc.moveDown(0.35);
        markBodyContent();
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.bodyFont)
          .fontSize(11.5)
          .text(options.subtitle, {
            width: bodyWidth(),
            align: 'center'
          });
      }
      doc.moveDown(1.1);
    } else if (!useCoverPage) {
      markBodyContent();
      doc
        .fillColor(themeConfig.ink)
        .font(themeConfig.titleFont)
        .fontSize(theme === 'news' ? 26 : 24)
        .text(options.title, { width: bodyWidth() });
      if (options.subtitle) {
        doc.moveDown(0.35);
        markBodyContent();
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.bodyFont)
          .fontSize(13)
          .text(options.subtitle, { width: bodyWidth() });
      }
      doc.moveDown(0.6);
    }

    if (summaryText) {
      renderCallout(formalDocumentLayout ? 'Introduction' : themeConfig.summaryLabel, summaryText);
    }

    for (const section of options.sections) {
      renderSection(section.heading, section.body);
    }

    if (options.sources.length > 0) {
      renderSection('Sources et liens', options.sources.map(source => `- ${source}`).join('\n'));
    }

    const bufferedPages = doc.bufferedPageRange();
    const pageCount = bufferedPages.count;
    const blankBodyPageCount = pageMetrics.filter(page => page.kind === 'body' && page.bodyBlocks === 0).length;

    for (let pageIndex = 0; pageIndex < bufferedPages.count; pageIndex++) {
      doc.switchToPage(bufferedPages.start + pageIndex);
      const pageNumber = pageIndex + 1;
      const shouldDrawHeader = !formalDocumentLayout && (!useCoverPage || pageNumber > 1);

      if (shouldDrawHeader) {
        doc.save();
        doc.strokeColor(themeConfig.line).lineWidth(1);
        doc.moveTo(doc.page.margins.left, theme === 'news' ? 70 : 60).lineTo(doc.page.width - doc.page.margins.right, theme === 'news' ? 70 : 60).stroke();
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.bodyFont)
          .fontSize(8.5)
          .text(options.title, doc.page.margins.left, theme === 'news' ? 48 : 42, {
            width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 70
          });
        doc.fillColor(themeConfig.accent).rect(doc.page.width - doc.page.margins.right - 46, theme === 'news' ? 50 : 44, 46, 4).fill();
        doc.restore();
      }

      if (options.showPageNumbers !== false && (!formalDocumentLayout || pageCount > 1)) {
        doc.save();
        doc.strokeColor(themeConfig.line).lineWidth(1);
        doc.moveTo(doc.page.margins.left, doc.page.height - 48).lineTo(doc.page.width - doc.page.margins.right, doc.page.height - 48).stroke();
        doc
          .fillColor(themeConfig.muted)
          .font(themeConfig.bodyFont)
          .fontSize(8)
          .text(
            formalDocumentLayout
              ? `Page ${pageNumber}/${pageCount}`
              : `${themeConfig.masthead} | ${options.requestClock.footerDateLabel} | Page ${pageNumber}/${pageCount}`,
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

    stream.on('finish', () => {
      if (blankBodyPageCount > 0) {
        try {
          fs.rmSync(options.outputPath, { force: true });
        } catch {}
        const error = new Error(`Le rendu PDF a produit ${blankBodyPageCount} page(s) vide(s).`);
        (error as any).recoverable = true;
        (error as any).blankBodyPageCount = blankBodyPageCount;
        reject(error);
        return;
      }

      resolve({
        path: options.outputPath,
        pageCount,
        blankBodyPageCount,
        usedCoverPage: useCoverPage,
        theme
      });
    });
    stream.on('error', reject);
  });

  try {
    return await renderOnce(canUseCoverPage);
  } catch (error: any) {
    if (canUseCoverPage && Number(error?.blankBodyPageCount || 0) > 0) {
      return renderOnce(false);
    }
    throw error;
  }
}

function buildArtifactCompletionPrompt(
  activePdfDraft: ActivePdfDraft | null,
  createdArtifactPath: string | null,
  releasedFile: { url: string; path?: string } | null
): string | null {
  if (!hasArtifactInFlightState({ activePdfDraft, createdArtifactPath, releasedFile }) || releasedFile?.url) {
    return null;
  }

  const nextStep = createdArtifactPath
    ? `Le fichier semble deja etre cree ici: '${createdArtifactPath}'. Utilise maintenant 'release_file' avec ce chemin, puis reponds uniquement avec le lien Markdown final.`
    : activePdfDraft
      ? "Un livrable est deja en cours sous forme de brouillon. Relis-le et retravaille-le si necessaire avec 'get_pdf_draft', 'revise_pdf_draft' ou 'review_pdf_draft', puis seulement quand il est mur fais 'create_pdf', puis 'release_file', puis reponds uniquement avec le lien Markdown final."
      : "Un livrable semble en cours. Termine la creation du fichier si necessaire, utilise 'release_file', puis reponds uniquement avec le lien Markdown final.";

  return `La tache n'est PAS terminee.
${nextStep}
Ne refais pas tout le resume si tu l'as deja donne. Termine la livraison du fichier.`;
}

function clipText(value: unknown, max = MAX_PREVIEW_CHARS): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}... [tronque]` : text;
}

function sanitizeGeneratedArtifactBasename(value: unknown, fallback: string): string {
  const text = typeof value === 'string' ? value.trim() : '';
  const normalized = text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return normalized || fallback;
}

function buildGeneratedArtifactPath(prefix: string, extension: string, requestedFilename?: string) {
  const baseName = sanitizeGeneratedArtifactBasename(
    requestedFilename,
    `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`
  );
  const cleanExtension = extension.startsWith('.') ? extension : `.${extension}`;
  return path.join('/tmp', baseName.endsWith(cleanExtension) ? baseName : `${baseName}${cleanExtension}`);
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

function requestNeedsBroadNewsRoundup(message: string): boolean {
  const normalized = normalizeCoworkText(message);
  if (!requestIsCurrentAffairs(message) && !requestNeedsCurrentDateGrounding(message)) return false;

  const sportSignals =
    /\b(sport|match|football|foot|ligue|ligue 1|champions league|nba|nfl|tennis|rugby|mercato)\b/.test(normalized);
  if (sportSignals) return false;

  const economySignals =
    /\b(economie|economique|marche|marches|bourse|finance|financier|business|inflation|taux|petrole|entreprise)\b/.test(normalized);
  const techDocsSignals =
    /\b(api|sdk|documentation|docs?|version|release|modele|model|vertex|gemini|google ai|developpeur|developer)\b/.test(normalized);
  const specificTopicSignals =
    /\b(election|elections|municipale|municipales|presidentielle|presidentielles|legislative|legislatives|parlement|assemblee|senat|justice|judiciaire|tribunal|proces|guerre|attaque|attaques|frappe|frappes|iran|israel|gaza|ukraine|russie|trump|biden|rubio|mercosur|canada|meta|youtube|gims|sarkozy|houthi|houthis)\b/.test(normalized);
  const broadSignals =
    /\b(mondiale|mondiales|mondial|monde|internationale|internationales|internationaux|international|panorama|tour d horizon|tour dhorizon|briefing|revue de presse|journaux?|headline|headlines|une)\b/.test(normalized);
  const multiAngleCount = [
    /\b(iran|ukraine|israel|gaza|liban|syrie|g7|onu|europe|usa|etats unis|trump|biden|guerre|diplomatie)\b/,
    /\b(economie|economique|marche|marches|bourse|finance|financier|business|inflation|taux|petrole|entreprise)\b/,
    /\b(tech|technologie|technologies|ia|ai|startup|start-up|cloud|cyber|semi[- ]?conducteurs?)\b/,
    /\b(climat|environnement|cop\d+|energie|emissions|temperature)\b/
  ].filter(pattern => pattern.test(normalized)).length;

  if (broadSignals) return true;
  if (multiAngleCount >= 2) return true;
  if (techDocsSignals) return false;
  if (specificTopicSignals) return false;
  if (economySignals) return /\b(monde|mondiale|mondiales|international|internationale|internationales)\b/.test(normalized);
  return /\b(actu|actualite|actualites|news|briefing|headline|headlines|revue de presse|presse)\b/.test(normalized);
}

function detectDirectSourceCategory(message: string): DirectSourceCategory {
  const normalized = normalizeCoworkText(message);
  if (searchQueryLooksMusicLookup(message)) {
    return 'music';
  }
  if (/\b(sport|match|football|foot|ligue|ligue 1|champions league|nba|nfl|tennis|rugby|mercato)\b/.test(normalized)) {
    return 'sport';
  }
  if (requestNeedsBroadNewsRoundup(message)) {
    return 'broad_news';
  }
  if (/\b(economie|economique|marche|marches|bourse|finance|financier|business|inflation|taux|petrole|entreprise)\b/.test(normalized)) {
    return 'economy';
  }
  if (/\b(api|sdk|documentation|docs?|version|release|modele|model|vertex|gemini|google ai|developpeur|developer)\b/.test(normalized)) {
    return 'tech_docs';
  }
  if (/\b(france|francais|francaise|paris|elysee|assemblee|matignon|municipales)\b/.test(normalized)) {
    return 'fr_news';
  }
  if (/\b(monde|international|iran|ukraine|israel|liban|g7|onu|europe|usa|etats unis)\b/.test(normalized)) {
    return 'intl_news';
  }
  return requestIsCurrentAffairs(message) ? 'broad_news' : 'general';
}

function getDirectSourceFallbacks(message: string): string[] {
  const category = detectDirectSourceCategory(message);
  return DIRECT_SOURCE_FALLBACKS[category] || DIRECT_SOURCE_FALLBACKS.general;
}

function getTrustedDirectSourceDomains(message: string): string[] {
  return [...new Set(
    getDirectSourceFallbacks(message)
      .map((value) => getUrlDomain(value))
      .filter(Boolean)
  )];
}

function formatDirectSourceHint(message: string, max = 3): string {
  const urls = getDirectSourceFallbacks(message).slice(0, max);
  return urls.length > 0 ? ` Sources directes a ouvrir via 'web_fetch': ${urls.join(' | ')}.` : '';
}

function buildTavilySearchPlan(
  query: string,
  maxResults = 5,
  options: SearchOptions = {}
): TavilySearchPlan {
  const directSourceUrls = dedupeStrings(options.directSourceUrls || [], 8);
  const topic: TavilyTopic = options.topic || 'general';
  const searchDepth: TavilySearchDepth =
    options.searchDepth
    || (options.strict || options.strictFactual || options.strictMusic ? 'advanced' : 'basic');
  const includeDomains = dedupeStrings((options.includeDomains || []).map(domain => stripWww(domain)).filter(Boolean), 8);
  const requestBody: Record<string, unknown> = {
    query,
    max_results: Math.max(1, Math.min(maxResults, 8)),
    topic,
    search_depth: searchDepth,
    include_answer: false,
    include_raw_content: false,
  };

  if (searchDepth === 'advanced') {
    requestBody.chunks_per_source = 3;
  }
  if (includeDomains.length > 0) {
    requestBody.include_domains = includeDomains;
  }
  if (topic === 'news' && options.timeRange) {
    requestBody.time_range = options.timeRange;
  }

  return {
    enabled: Boolean(process.env.TAVILY_API_KEY),
    requestBody,
    searchMode: `tavily:${topic}:${searchDepth}`,
    topic,
    searchDepth,
    directSourceUrls,
    includeDomains,
  };
}

function buildDirectSourceSearchOutcome(
  query: string,
  options: {
    quality: SearchQuality;
    provider: string;
    searchMode: string;
    warnings?: string[];
    error?: string;
    transient?: boolean;
    results?: SearchResultItem[];
    relevanceScore?: number;
    matchedAnchors?: string[];
    fallbackUsed?: boolean;
    searchDisabledReason: string;
    directSourceUrls?: string[];
  }
): SearchOutcome {
  return {
    success: options.quality !== 'off_topic' && options.quality !== 'transient_error',
    quality: options.quality,
    provider: options.provider,
    searchMode: options.searchMode,
    results: options.results || [],
    relevanceScore: Number(options.relevanceScore || 0),
    matchedAnchors: options.matchedAnchors || [],
    fallbackUsed: Boolean(options.fallbackUsed),
    directSourceUrls: options.directSourceUrls || [],
    warnings: options.warnings || [],
    error: options.error,
    transient: options.transient,
    searchDisabledReason: options.searchDisabledReason,
  };
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

function parsePublicStatusPayload(args: any): CoworkPublicStatus | null {
  if (!args || typeof args !== 'object') return null;
  const focus = typeof args.focus === 'string' ? clipText(args.focus, 240).trim() : '';
  const nextActionRaw =
    typeof args.next_action === 'string'
      ? args.next_action
      : typeof args.nextAction === 'string'
        ? args.nextAction
        : '';
  const nextAction = clipText(nextActionRaw, 240).trim();
  const whyNowRaw =
    typeof args.why_now === 'string'
      ? args.why_now
      : typeof args.whyNow === 'string'
        ? args.whyNow
        : '';
  const doneWhenRaw =
    typeof args.done_when === 'string'
      ? args.done_when
      : typeof args.doneWhen === 'string'
        ? args.doneWhen
        : '';
  const blockerRaw =
    typeof args.blocker === 'string'
      ? args.blocker
      : typeof args.current_blocker === 'string'
        ? args.current_blocker
        : '';

  if (!focus || !nextAction) return null;

  return {
    phase: normalizeCoworkPhase(String(args.phase || 'analysis')),
    focus,
    nextAction,
    whyNow: clipText(whyNowRaw, 260).trim() || undefined,
    doneWhen: clipText(doneWhenRaw, 260).trim() || undefined,
    blocker: clipText(blockerRaw, 260).trim() || undefined,
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

function summarizePublicStatus(status: CoworkPublicStatus): string {
  return [
    `Focus: ${status.focus}`,
    `Prochaine action: ${status.nextAction}`,
    status.whyNow ? `Pourquoi maintenant: ${status.whyNow}` : null,
    status.doneWhen ? `Critere de fin: ${status.doneWhen}` : null,
    status.blocker ? `Blocage courant: ${status.blocker}` : null,
  ].filter(Boolean).join('\n');
}

function getHardCoworkBlockers(blockers: CoworkBlocker[]): CoworkBlocker[] {
  return blockers.filter(blocker => blocker.hard);
}

function buildCoworkProgressFingerprint(input: {
  executionMode: CoworkExecutionMode;
  webSearchCount: number;
  webFetchCount: number;
  openedSourceCount: number;
  openedDomainCount: number;
  activePdfDraft: ActivePdfDraft | null;
  latestApprovedPdfReviewSignature: string | null;
  latestCreatedArtifactPath: string | null;
  latestReleasedFileUrl: string | null;
  phase: CoworkPhase;
  modelTaskComplete: boolean;
  effectiveTaskComplete: boolean;
  pendingFinalAnswer: boolean;
  blockers: CoworkBlocker[];
}): string {
  const artifactAlreadyReleased = Boolean(input.latestReleasedFileUrl);
  return JSON.stringify({
    executionMode: input.executionMode,
    webSearchCount: input.webSearchCount,
    webFetchCount: input.webFetchCount,
    sourcesOpened: input.openedSourceCount,
    domainsOpened: input.openedDomainCount,
    activePdfDraftId: input.activePdfDraft?.draftId || null,
    activePdfDraftWords: artifactAlreadyReleased ? 'frozen' : (input.activePdfDraft?.wordCount || 0),
    activePdfDraftSections: artifactAlreadyReleased ? 'frozen' : (input.activePdfDraft?.sections.length || 0),
    activePdfDraftSignature: artifactAlreadyReleased ? 'frozen' : (input.activePdfDraft ? buildActivePdfDraftSignature(input.activePdfDraft) : null),
    activePdfDraftApprovedSignature: artifactAlreadyReleased ? 'frozen' : (input.activePdfDraft?.approvedReviewSignature || null),
    latestApprovedPdfReviewSignature: input.latestApprovedPdfReviewSignature,
    latestCreatedArtifactPath: input.latestCreatedArtifactPath,
    latestReleasedFileUrl: input.latestReleasedFileUrl,
    phase: input.phase,
    modelTaskComplete: input.modelTaskComplete,
    effectiveTaskComplete: input.effectiveTaskComplete,
    pendingFinalAnswer: input.pendingFinalAnswer,
    blockers: getHardCoworkBlockers(input.blockers).map(blocker => blocker.code).sort(),
  });
}

function registerCoworkProgressState(
  state: CoworkSessionState,
  fingerprint: string,
  actionSignature: string
): number {
  const sameProgress = state.lastProgressFingerprint === fingerprint;
  if (sameProgress) {
    state.stalledTurns += 1;
  } else {
    state.stalledTurns = 0;
  }
  state.lastProgressFingerprint = fingerprint;
  state.lastActionSignature = actionSignature;
  return state.stalledTurns;
}

function computeCompletionState(options: CompletionComputationOptions): CoworkSessionState {
  const {
    originalMessage,
    state,
    latestCreatedArtifactPath,
    latestReleasedFile
  } = options;

  const nextState: CoworkSessionState = {
    ...state,
    factsCollected: [...state.factsCollected],
    sourcesValidated: [...state.sourcesValidated],
    searchesFailed: [...state.searchesFailed],
    toolsBlocked: [...state.toolsBlocked],
    activePdfDraft: state.activePdfDraft ? { ...state.activePdfDraft, sections: [...state.activePdfDraft.sections], sources: [...state.activePdfDraft.sources] } : null,
    blockers: [],
  };

  const blockers: CoworkBlocker[] = [];
  const artifactInFlight = hasArtifactInFlightState({
    activePdfDraft: nextState.activePdfDraft,
    createdArtifactPath: latestCreatedArtifactPath,
    releasedFile: latestReleasedFile,
  });

  if (artifactInFlight) {
    if (nextState.activePdfDraft && !latestCreatedArtifactPath && !latestReleasedFile?.url && nextState.modelTaskComplete) {
      blockers.push({
        code: 'artifact_not_created',
        message: "Le livrable a ete amorce, mais aucun fichier final n'a encore ete cree.",
        hard: true,
      });
    }
    if (latestCreatedArtifactPath && !latestReleasedFile?.url) {
      blockers.push({
        code: 'artifact_not_released',
        message: "Le fichier existe deja, mais il n'a pas encore ete publie via 'release_file'.",
        hard: true,
      });
    }
  }
  const hardBlockers = getHardCoworkBlockers(blockers);
  nextState.blockers = blockers;
  nextState.effectiveTaskComplete = nextState.modelTaskComplete && hardBlockers.length === 0;
  nextState.pendingFinalAnswer = !nextState.modelTaskComplete && hardBlockers.length === 0 && Boolean(latestReleasedFile?.url);
  nextState.phase = nextState.effectiveTaskComplete ? 'completed' : nextState.phase;

  return nextState;
}

function buildBlockerPrompt(
  _originalMessage: string,
  _requestClock: RequestClock,
  _state: CoworkSessionState
): string | null {
  // LIBERATION: plus d'injection de messages user avec des ordres.
  // Le modele decide seul de sa strategie. Aucun blocker n'est injecte.
  return null;
}

function buildCoworkBlockedUserReplyPrompt(options: {
  originalMessage: string;
  requestClock: RequestClock;
  state: CoworkSessionState;
  research: MusicResearchProgress;
  latestCreatedArtifactPath?: string | null;
  latestReleasedFile?: { url: string; path?: string } | null;
  stopReason: string;
}): string {
  const attemptedHosts = dedupeStrings(options.state.sourcesValidated.map(source => source.domain).filter(Boolean), 6);
  const hardBlocker = options.stopReason || "je n'ai pas pu produire une reponse satisfaisante";
  const triedSourcesSummary = attemptedHosts.length > 0
    ? attemptedHosts.join(', ')
    : 'aucune source exploitable n a pu etre ouverte';
  const artifactNeed = hasArtifactInFlightState({
    activePdfDraft: options.state.activePdfDraft,
    createdArtifactPath: options.latestCreatedArtifactPath,
    releasedFile: options.latestReleasedFile,
  })
    ? "Si c'est pertinent, dis clairement que tu n'as pas encore pu aller jusqu'au livrable final ou a sa publication."
    : "Ne promets pas un livrable que tu n'as pas pu finaliser.";

  return `Tu rediges UNIQUEMENT la reponse finale visible a l'utilisateur pour un run Cowork bloque.

Rappels absolus:
- Ecris en francais naturel, ton humain, honnete, calme.
- 2 a 5 phrases maximum.
- N'utilise jamais les mots backend, phase, blocker, completion, pourcentage, iteration, tool, web_search, web_fetch, function, scope, degraded.
- N'affiche jamais de dump technique ou de liste d'outils.
- Si le blocage principal concerne un podcast, un audio, un mix, un PDF ou un media, explique cette limite reelle et n'accuse pas la recherche web a la place.
- ${artifactNeed}
- Propose si utile de reessayer dans quelques minutes ou de demander un angle plus precis.

Contexte utile:
- Demande utilisateur: "${options.originalMessage}"
- Date de reference: ${options.requestClock.dateLabel} (${options.requestClock.timeZone})
- Ce qui a bloque: ${options.stopReason}
 - Etat utile: ${options.research.webSearches} recherche(s), ${options.research.webFetches} lecture(s) web utiles.
 - Sources ou domaines deja ouverts: ${triedSourcesSummary}
- Limite principale restante: ${hardBlocker}

Reponds maintenant directement a l'utilisateur, sans jargon interne ni liste technique.`;
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
  strict?: boolean;
  strictMusic?: boolean;
  strictFactual?: boolean;
  topic?: TavilyTopic;
  searchDepth?: TavilySearchDepth;
  includeDomains?: string[];
  directSourceUrls?: string[];
  timeRange?: 'day' | 'week';
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
  searchMode: string;
  results: SearchResultItem[];
  relevanceScore: number;
  matchedAnchors: string[];
  fallbackUsed: boolean;
  directSourceUrls: string[];
  warnings: string[];
  error?: string;
  transient?: boolean;
  searchDisabledReason?: string;
};

type TavilyTopic = 'general' | 'news';
type TavilySearchDepth = 'basic' | 'advanced';

type TavilySearchPlan = {
  enabled: boolean;
  requestBody: Record<string, unknown> | null;
  searchMode: string;
  topic: TavilyTopic | null;
  searchDepth: TavilySearchDepth | null;
  directSourceUrls: string[];
  includeDomains: string[];
};

type ReadableFetchQuality = 'full' | 'partial' | 'shell' | 'serp';
type FetchRelevance = 'relevant' | 'degraded' | 'off_topic';

type ReadablePage = {
  url: string;
  title: string;
  content: string;
  rawContent: string;
  excerpt: string;
  source: string;
  quality: ReadableFetchQuality;
  relevance: FetchRelevance;
  relevanceScore: number;
  matchedAnchors: string[];
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
  musicCatalogCompleted?: boolean;
  musicCatalogCoverage?: MusicCatalogCoverage | null;
};

type CoworkExecutionMode = 'autonomous';

type CoworkPhase =
  | 'analysis'
  | 'composition'
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

type CoworkPublicStatus = {
  phase: CoworkPhase;
  focus: string;
  nextAction: string;
  whyNow?: string;
  doneWhen?: string;
  blocker?: string;
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

type CoworkEngagementNudge = {
  signature: string;
  title: string;
  message: string;
  prompt: string;
};

type CoworkSessionState = {
  factsCollected: string[];
  sourcesValidated: CoworkValidatedSource[];
  searchesFailed: CoworkSearchFailure[];
  toolsBlocked: CoworkBlockedTool[];
  activePdfDraft: ActivePdfDraft | null;
  phase: CoworkPhase;
  modelCompletionScore: number;
  modelTaskComplete: boolean;
  effectiveTaskComplete: boolean;
  blockers: CoworkBlocker[];
  consecutiveDegradedSearches: Record<string, number>;
  cooldowns: Record<string, ToolCooldownState>;
  lastReasoning: CoworkReasoning | null;
  lastPublicStatus: CoworkPublicStatus | null;
  reasoningReady: boolean;
  pendingFinalAnswer: boolean;
  stalledTurns: number;
  lastProgressFingerprint: string | null;
  lastActionSignature: string | null;
  lastEngagementNudgeSignature: string | null;
};

type LocalToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (args: any) => Promise<any> | any;
};

type CompletionComputationOptions = {
  originalMessage: string;
  requestClock: RequestClock;
  state: CoworkSessionState;
  research: MusicResearchProgress;
  latestCreatedArtifactPath: string | null;
  latestReleasedFile: { url: string; path?: string } | null;
  latestApprovedPdfReviewSignature: string | null;
  executionMode?: CoworkExecutionMode;
};

type DirectSourceCategory =
  | 'broad_news'
  | 'fr_news'
  | 'intl_news'
  | 'economy'
  | 'tech_docs'
  | 'music'
  | 'sport'
  | 'general';

function getPublicToolNarrationTarget(toolName: string, args: any): string | null {
  let rawTarget: unknown = null;
  switch (toolName) {
    case 'create_agent_blueprint':
      rawTarget = args?.brief ?? args?.name ?? args?.title;
      break;
    case 'update_agent_blueprint':
      rawTarget = args?.agentId ?? args?.changeRequest ?? args?.brief;
      break;
    case 'run_hub_agent':
      rawTarget = args?.agentId ?? args?.name ?? args?.mission;
      break;
    case 'web_search':
      rawTarget = args?.query ?? args?.q;
      break;
    case 'web_fetch':
      rawTarget = args?.url;
      break;
    case 'music_catalog_lookup':
      rawTarget = args?.artist ?? args?.name ?? args?.query;
      break;
    case 'generate_image_asset':
      rawTarget = args?.filename ?? args?.prompt;
      break;
    case 'generate_tts_audio':
      rawTarget = args?.filename ?? args?.text ?? args?.prompt;
      break;
    case 'generate_music_audio':
      rawTarget = args?.filename ?? args?.prompt;
      break;
    case 'create_podcast_episode':
      rawTarget = args?.title ?? args?.filename ?? args?.brief ?? args?.script;
      break;
    case 'begin_pdf_draft':
      rawTarget = args?.title ?? args?.filename;
      break;
    case 'append_to_draft':
      rawTarget = args?.sections?.[0]?.heading ?? args?.title ?? args?.filename;
      break;
    case 'revise_pdf_draft':
      rawTarget = args?.title ?? args?.sectionOperations?.[0]?.section?.heading ?? args?.sections?.[0]?.heading ?? args?.filename;
      break;
    case 'get_pdf_draft':
      rawTarget = args?.draftId ?? args?.title;
      break;
    case 'review_pdf_draft':
      rawTarget = args?.title ?? args?.subtitle;
      break;
    case 'create_pdf':
      rawTarget = args?.title ?? args?.filename ?? args?.path;
      break;
    case 'release_file':
    case 'write_file':
      rawTarget = args?.path ?? args?.filename;
      break;
    default:
      rawTarget = args?.path ?? args?.url ?? args?.query ?? args?.title ?? args?.filename ?? args?.name;
      break;
  }

  if (typeof rawTarget !== 'string') return null;
  const clipped = clipText(rawTarget.trim(), 120)?.trim();
  return clipped || null;
}

function buildPublicToolNarration(
  toolName: string,
  args: any
): { title: string; message: string } | null {
  const target = getPublicToolNarrationTarget(toolName, args);

  switch (toolName) {
    case 'create_agent_blueprint':
      return {
        title: 'Delegation',
        message: target
          ? `Je dessine maintenant un agent specialise pour '${target}'.`
          : "Je prepare un agent specialise pour le Hub Agents."
      };
    case 'update_agent_blueprint':
      return {
        title: 'Evolution agent',
        message: target
          ? `Je retravaille maintenant l'agent '${target}'.`
          : "Je mets a jour un agent existant du Hub Agents."
      };
    case 'run_hub_agent':
      return {
        title: 'Sous-mission',
        message: target
          ? `Je relance maintenant l'agent '${target}' comme specialiste.`
          : "Je relance maintenant un specialiste du Hub Agents."
      };
    case 'web_search':
      return {
        title: 'Recherche',
        message: target
          ? `Je lance une recherche ciblee sur '${target}'.`
          : "Je lance une recherche ciblee pour cadrer le sujet."
      };
    case 'web_fetch':
      return {
        title: 'Verification',
        message: target
          ? `J'ouvre une source pour verifier: ${target}.`
          : "J'ouvre une source pour verifier le point cle."
      };
    case 'music_catalog_lookup':
      return {
        title: 'Catalogue',
        message: target
          ? `Je recoupe maintenant le catalogue de '${target}'.`
          : "Je recoupe maintenant le catalogue musical demande."
      };
    case 'generate_image_asset':
      return {
        title: 'Image',
        message: target
          ? `Je genere maintenant l'image '${target}'.`
          : "Je genere maintenant une image."
      };
    case 'generate_tts_audio':
      return {
        title: 'Voix',
        message: target
          ? `Je synthétise maintenant une voix pour '${target}'.`
          : "Je synthétise maintenant une voix."
      };
    case 'generate_music_audio':
      return {
        title: 'Musique',
        message: target
          ? `Je génère maintenant une ambiance musicale pour '${target}'.`
          : "Je génère maintenant une ambiance musicale."
      };
    case 'begin_pdf_draft':
      return {
        title: 'Brouillon',
        message: target
          ? `J'initialise le brouillon PDF '${target}'.`
          : "J'initialise maintenant le brouillon PDF."
      };
    case 'append_to_draft':
      return {
        title: 'Construction',
        message: target
          ? `J'ajoute une nouvelle partie au brouillon: '${target}'.`
          : "J'ajoute une nouvelle partie au brouillon PDF."
      };
    case 'revise_pdf_draft':
      return {
        title: 'Revision',
        message: target
          ? `Je retravaille maintenant le brouillon PDF autour de '${target}'.`
          : "Je retravaille maintenant le brouillon PDF."
      };
    case 'get_pdf_draft':
      return {
        title: 'Brouillon',
        message: "Je relis l'etat courant du brouillon PDF avant la suite."
      };
    case 'review_pdf_draft':
      return {
        title: 'Relecture',
        message: target
          ? `Je relis le brouillon PDF '${target}' avant export.`
          : "Je relis le brouillon PDF avant export."
      };
    case 'create_pdf':
      return {
        title: 'Mise en page',
        message: target
          ? `Je passe maintenant le contenu en PDF: '${target}'.`
          : "Je passe maintenant le contenu en PDF."
      };
    case 'release_file':
      return {
        title: 'Livraison',
        message: target
          ? `Je publie '${target}' pour generer le lien de telechargement.`
          : "Je publie le fichier pour generer le lien de telechargement."
      };
    case 'read_file':
      return {
        title: 'Lecture',
        message: target
          ? `Je lis '${target}' pour recuperer le contexte utile.`
          : "Je lis le fichier utile avant de continuer."
      };
    case 'list_files':
    case 'list_recursive':
      return {
        title: 'Exploration',
        message: "J'explore les fichiers utiles avant de continuer."
      };
    case 'write_file':
      return {
        title: 'Preparation',
        message: target
          ? `Je prepare maintenant le fichier '${target}'.`
          : "Je prepare maintenant le fichier demande."
      };
    default:
      return null;
  }
}

function markVisibleDeliveryAttempt(
  state: CoworkSessionState,
  _executionMode: CoworkExecutionMode,
  visibleText: string
): boolean {
  if (!visibleText.trim()) return false;

  let changed = false;
  if (!state.modelTaskComplete) {
    state.modelTaskComplete = true;
    changed = true;
  }
  if (state.phase !== 'delivery' && state.phase !== 'completed') {
    state.phase = 'delivery';
    changed = true;
  }
  return changed;
}

const BROAD_NEWS_TRUSTED_DOMAINS = [
  'franceinfo.fr',
  'lemonde.fr',
  'france24.com',
  'reuters.com',
  'bbc.com',
  'aljazeera.com'
];

const DIRECT_SOURCE_FALLBACKS: Record<DirectSourceCategory, string[]> = {
  broad_news: [
    'https://www.franceinfo.fr/',
    'https://www.reuters.com/world/',
    'https://www.bbc.com/news',
    'https://www.lemonde.fr/',
    'https://www.france24.com/fr/',
    'https://www.aljazeera.com/news/'
  ],
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
  music: [
    'https://genius.com/',
    'https://music.apple.com/',
    'https://www.youtube.com/',
    'https://www.trackmusik.fr/'
  ],
  sport: [
    'https://www.lequipe.fr/',
    'https://www.bbc.com/sport',
    'https://www.eurosport.fr/'
  ],
  general: []
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
  'actu',
  'actus',
  'actualite',
  'actualites',
  'artiste',
  'artist',
  'artists',
  'headline',
  'headlines',
  'international',
  'internationale',
  'internationales',
  'musique',
  'music',
  'musical',
  'musicale',
  'monde',
  'news',
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
  'world',
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

function isBroadNewsTrustedDomain(domain: string): boolean {
  return BROAD_NEWS_TRUSTED_DOMAINS.some(candidate => domainMatches(domain, candidate));
}

function isLikelyBroadNewsArticleResult(result: SearchResultItem): boolean {
  const domain = getUrlDomain(result.url);
  if (!isBroadNewsTrustedDomain(domain)) return false;

  const haystack = searchResultHaystack(result).all;
  if (/\b(sport|football|nba|nfl|tennis|rugby|mercato|people|celebrity|celebrities)\b/.test(haystack)) {
    return false;
  }

  const parsed = safeParseUrl(result.url);
  const pathSegments = (parsed?.pathname || '').split('/').filter(Boolean);
  const normalizedPath = normalizeCoworkText(parsed?.pathname || '');
  return (
    pathSegments.length >= 2
    || /\b20\d{2}\b/.test(normalizedPath)
    || normalizedPath.includes('/news/')
    || normalizedPath.includes('/world/')
    || normalizedPath.includes('/business/')
  );
}

function hasBroadNewsFreshnessSignal(result: SearchResultItem): boolean {
  const haystack = searchResultHaystack(result).all;
  return /\b20\d{2}\b/.test(haystack)
    || /\b(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre|january|february|march|april|may|june|july|august|september|october|november|december|today|aujourd hui)\b/.test(haystack);
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
    || anchorTokens.some(token => /\d/.test(token));

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

function assessReadablePageRelevance(
  query: string | undefined,
  page: Pick<ReadablePage, 'title' | 'url' | 'excerpt' | 'source'>,
  options: { strict?: boolean } = {}
): SearchAssessment {
  const normalizedQuery = query?.trim();
  if (!normalizedQuery) {
    return {
      quality: 'relevant',
      bestScore: 1,
      matchedAnchors: [],
      matchedResults: 1,
    };
  }

  return assessSearchResults(normalizedQuery, [{
    title: page.title,
    url: page.url,
    snippet: `${page.excerpt}`,
    source: page.source,
  }], options);
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

async function searchViaTavily(plan: TavilySearchPlan): Promise<SearchResultItem[]> {
  if (!plan.requestBody) {
    throw new Error('Tavily n est pas configure pour cette recherche.');
  }
  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.TAVILY_API_KEY}`
    },
    body: JSON.stringify(plan.requestBody)
  });
  if (!response.ok) {
    throw new Error(`Tavily a renvoye ${response.status}`);
  }
  const data: any = await response.json();
  const results = Array.isArray(data.results) ? data.results : [];
  const maxResults = Number(plan.requestBody.max_results || 5);
  return results.slice(0, maxResults).map((result: any) => ({
    title: clipText(result.title || result.url || 'Sans titre', 140),
    url: result.url,
    snippet: clipText(result.content || result.snippet || '', 240),
    source: 'tavily'
  }));
}

async function searchWeb(query: string, maxResults = 5, options: SearchOptions = {}): Promise<SearchOutcome> {
  const strictMode = Boolean(options.strict || options.strictMusic || options.strictFactual);
  const newsy = options.topic === 'news';
  const tavilyPlan = buildTavilySearchPlan(query, maxResults, options);
  const publicFallbacksEnabled = allowPublicSearchFallbacks();
  const attempts: Array<{ label: string; run: () => Promise<SearchResultItem[]> }> = [];
  const warnings: string[] = [];

  if (tavilyPlan.enabled) {
    attempts.push({ label: 'tavily', run: () => searchViaTavily(tavilyPlan) });
  }

  if (publicFallbacksEnabled) {
    warnings.push("Fallback public actif: les resultats moteur restants ne comptent jamais comme preuve sans lecture directe via 'web_fetch'.");
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
  } else if (!tavilyPlan.enabled) {
    warnings.push("TAVILY_API_KEY absente: je ne lance pas de moteurs publics par defaut et je te renvoie des sources directes fiables a ouvrir via 'web_fetch'.");
    return buildDirectSourceSearchOutcome(query, {
      quality: 'degraded',
      provider: 'direct-sources',
      searchMode: 'direct-sources',
      warnings,
      error: `Tavily n'est pas configure pour cette recherche. Ouvre directement une source fiable via 'web_fetch'.${formatDirectSourceHint(query)}`,
      searchDisabledReason: 'missing_tavily_key',
      directSourceUrls: tavilyPlan.directSourceUrls,
    });
  }

  const primaryProvider = attempts[0]?.label || (tavilyPlan.enabled ? 'tavily' : 'direct-sources');
  let sawTransientIssue = false;
  let bestDegraded: (SearchOutcome & { quality: 'degraded' | 'off_topic' }) | null = null;

  for (const attempt of attempts) {
    try {
      const rankedResults = rankSearchResults(query, await attempt.run());
      if (rankedResults.length === 0) continue;

      const assessment = assessSearchResults(query, rankedResults, { strict: strictMode });
      const outcome: SearchOutcome = {
        success: assessment.quality !== 'off_topic',
        quality: assessment.quality,
        provider: attempt.label,
        searchMode: attempt.label === 'tavily'
          ? tavilyPlan.searchMode
          : `public-fallback:${newsy ? 'news' : 'general'}`,
        results: rankedResults,
        relevanceScore: assessment.bestScore,
        matchedAnchors: assessment.matchedAnchors,
        fallbackUsed: attempt.label !== primaryProvider,
        directSourceUrls: tavilyPlan.directSourceUrls,
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

      warnings.push(`${attempt.label}: resultats ${assessment.quality === 'degraded' ? 'faibles' : 'hors sujet'} pour "${query}".`);
    } catch (error) {
      const message = parseApiError(error);
      warnings.push(`${attempt.label}: ${message}`);
      if (looksLikeTransientSearchIssue(message)) {
        sawTransientIssue = true;
      }
    }
  }

  if (bestDegraded) {
    if (!publicFallbacksEnabled && bestDegraded.provider === 'tavily') {
      return buildDirectSourceSearchOutcome(query, {
        quality: bestDegraded.quality,
        provider: 'tavily',
        searchMode: tavilyPlan.searchMode,
        results: bestDegraded.results,
        warnings,
        transient: false,
        relevanceScore: bestDegraded.relevanceScore,
        matchedAnchors: bestDegraded.matchedAnchors,
        fallbackUsed: false,
        searchDisabledReason: 'tavily_low_relevance',
        directSourceUrls: tavilyPlan.directSourceUrls,
      });
    }
    return {
      ...bestDegraded,
      success: true,
      quality: bestDegraded.quality,
      warnings,
    };
  }

  const errorMessage = `Aucun resultat exploitable trouve via les moteurs disponibles.${warnings.length > 0 ? ` Dernieres erreurs: ${warnings.join(' | ')}` : ''}`.trim();
  if (!publicFallbacksEnabled) {
    return buildDirectSourceSearchOutcome(query, {
      quality: sawTransientIssue ? 'transient_error' : 'off_topic',
      provider: tavilyPlan.enabled ? 'tavily' : 'direct-sources',
      searchMode: tavilyPlan.enabled ? tavilyPlan.searchMode : 'direct-sources',
      warnings,
      error: tavilyPlan.enabled
        ? `${errorMessage}${formatDirectSourceHint(query)}`
        : `La recherche n'est pas disponible sans Tavily.${formatDirectSourceHint(query)}`,
      transient: sawTransientIssue,
      searchDisabledReason: tavilyPlan.enabled
        ? (sawTransientIssue ? 'tavily_transient_error' : 'tavily_no_relevant_results')
        : 'missing_tavily_key',
      directSourceUrls: tavilyPlan.directSourceUrls,
    });
  }
  return {
    success: false,
    quality: sawTransientIssue ? 'transient_error' : 'off_topic',
    provider: primaryProvider,
    searchMode: `public-fallback:${newsy ? 'news' : 'general'}`,
    results: [],
    relevanceScore: 0,
    matchedAnchors: [],
    fallbackUsed: false,
    directSourceUrls: tavilyPlan.directSourceUrls,
    warnings,
    error: errorMessage,
    transient: sawTransientIssue,
  };
}

async function fetchDirectReadablePage(
  parsed: URL,
  headers: Record<string, string>,
  contextQuery?: string,
  strict = false
): Promise<ReadablePage> {
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
  const relevance = assessReadablePageRelevance(contextQuery, {
    title: clipText(title || parsed.hostname, 160),
    url: parsed.toString(),
    excerpt: normalizeReadableExcerpt(content),
    source: contentType.includes('text/html') ? 'direct-html' : 'direct-text',
  }, { strict: Boolean(contextQuery && strict) });

  return {
    url: parsed.toString(),
    title: clipText(title || parsed.hostname, 160),
    content: clipText(content, MAX_WEB_FETCH_CHARS),
    rawContent: rawText,
    excerpt: normalizeReadableExcerpt(content),
    source: contentType.includes('text/html') ? 'direct-html' : 'direct-text',
    quality,
    relevance: relevance.quality,
    relevanceScore: relevance.bestScore,
    matchedAnchors: relevance.matchedAnchors,
    domain: stripWww(parsed.hostname),
    isSearchPage: quality === 'serp',
    isCatalogEvidence: quality === 'full' && !isLikelySearchEngineUrl(parsed.toString())
  };
}

async function fetchJinaReadablePage(
  parsed: URL,
  headers: Record<string, string>,
  contextQuery?: string,
  strict = false
): Promise<ReadablePage> {
  const jinaUrl = `https://r.jina.ai/http://${parsed.host}${parsed.pathname}${parsed.search}`;
  const response = await fetch(jinaUrl, { headers, redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Jina a renvoye ${response.status} pour ${parsed.toString()}`);
  }

  const rawText = await response.text();
  const title = parseJinaTitle(rawText) || parsed.hostname;
  const content = rawText.replace(/\r/g, '').trim();
  const quality = getReadablePageQuality(parsed.toString(), content);
  const relevance = assessReadablePageRelevance(contextQuery, {
    title: clipText(title, 160),
    url: parsed.toString(),
    excerpt: normalizeReadableExcerpt(content),
    source: 'jina-ai',
  }, { strict: Boolean(contextQuery && strict) });

  return {
    url: parsed.toString(),
    title: clipText(title, 160),
    content: clipText(content, MAX_WEB_FETCH_CHARS),
    rawContent: rawText,
    excerpt: normalizeReadableExcerpt(content),
    source: 'jina-ai',
    quality,
    relevance: relevance.quality,
    relevanceScore: relevance.bestScore,
    matchedAnchors: relevance.matchedAnchors,
    domain: stripWww(parsed.hostname),
    isSearchPage: quality === 'serp',
    isCatalogEvidence: quality === 'full' && !isLikelySearchEngineUrl(parsed.toString())
  };
}

async function fetchReadableUrlDetailed(url: string, contextQuery?: string, strict = false): Promise<ReadablePage> {
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
      directPage = await fetchDirectReadablePage(parsed, headers, contextQuery, strict);
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
      jinaPage = await fetchJinaReadablePage(parsed, headers, contextQuery, strict);
    } catch (error) {
      errors.push(parseApiError(error));
    }
  }

  if (!directPage && !preferJina) {
    try {
      directPage = await fetchDirectReadablePage(parsed, headers, contextQuery, strict);
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

async function fetchReadableUrl(url: string, contextQuery?: string, options: { strict?: boolean } = {}) {
  const page = await fetchReadableUrlDetailed(url, contextQuery, Boolean(options.strict));
  return {
    url: page.url,
    title: page.title,
    content: page.content,
    excerpt: page.excerpt,
    source: page.source,
    quality: page.quality,
    relevance: page.relevance,
    relevanceScore: page.relevanceScore,
    matchedAnchors: page.matchedAnchors,
    domain: page.domain,
    isCatalogEvidence: page.isCatalogEvidence
  };
}

// Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬ Middleware Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬
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
    .replace(/\s*[-Ã¢â‚¬â€œ]\s*(single|ep|album)\s*$/i, '')
    .replace(/\s*\((official|clip officiel|audio officiel|visualizer)[^)]+\)\s*$/i, '')
    .replace(/\s*\[(official|clip officiel|audio officiel|visualizer)[^\]]+\]\s*$/i, '')
    .replace(/\s*\|\s*(official|clip officiel|audio officiel|visualizer).*/i, '')
    .replace(/^[`"'Ã¢â‚¬Å“Ã¢â‚¬Â]+|[`"'Ã¢â‚¬Å“Ã¢â‚¬Â]+$/g, '')
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
    .replace(/\s*[-Ã¢â‚¬â€œ]\s*(single|ep|album)\b/g, ' ')
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
  const headerMatch = raw.match(/^#\s*[^\S\r\n]*[^\p{L}\p{N}]*(.+?)\s+[Ã¢â‚¬â€œ-]\s+Apple Music/mu);
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
  const headerMatch = raw.match(/^#\s*[^\S\r\n]*[^\p{L}\p{N}]*(.+?)\s+[Ã¢â‚¬â€œ-]\s+Album\b/mu);
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
  const quotedRegex = /["Ã¢â‚¬Å“Ã¢â‚¬Â'`](.{2,80}?)["Ã¢â‚¬Å“Ã¢â‚¬Â'`]/g;
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
      .replace(/^.*?\b(j['Ã¢â‚¬â„¢ ]?ai|je possede|je possede deja|je l'ai|je l ai)\b/i, '')
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

registerRequestHardening(app);
registerSiteAuth(app);
registerStandardApiRoutes(app);

app.post('/api/cowork', async (req, res) => {
  let headersSent = false;
  let releaseCoworkRunGate: (() => void) | null = null;
  const emitEvent = (type: string, payload: Record<string, unknown> = {}) => {
    if (!headersSent) return;
    res.write(`data: ${JSON.stringify({ type, timestamp: Date.now(), ...payload })}\n\n`);
  };
  try {
    const { message, sessionId, history, attachments, config, clientContext, hubAgents, agentRuntime } = ChatSchema.parse(req.body);
    const requestClock = resolveRequestClock(clientContext);
    const availableHubAgents = Array.isArray(hubAgents)
      ? hubAgents
          .map(sanitizeHubAgentRecord)
          .filter((agent): agent is HubAgentRecord => Boolean(agent))
          .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
          .slice(0, 16)
      : [];
    const runtimeAgent = agentRuntime ? sanitizeHubAgentRecord(agentRuntime) : null;
    const runtimeAgentFormValues = agentRuntime?.formValues
      ? Object.fromEntries(
          Object.entries(agentRuntime.formValues).map(([fieldId, value]) => [
            fieldId,
            typeof value === 'boolean' ? value : String(value ?? ''),
          ])
        ) as Record<string, string | boolean>
      : undefined;
    const executionMode = classifyCoworkExecutionMode(message, history);

    if (requestRequiresAbuseBlock(message)) {
      const runMeta = createEmptyCoworkRunMeta();
      runMeta.mode = executionMode;
      runMeta.phase = 'completed';
      runMeta.taskComplete = true;

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      headersSent = true;

      emitEvent('status', {
        iteration: 0,
        title: 'Recadrage',
        message: "Cowork refuse la version qui vise a humilier ou dehumaniser un groupe.",
        runState: 'running',
        runMeta
      });
      emitEvent('text_delta', {
        iteration: 0,
        text: "Je ne vais pas ecrire un texte contre un groupe de personnes. Si tu veux, je peux te faire un texte nerveux contre un comportement, une hypocrisie, une ideologie ou un systeme sans viser une population.",
        runMeta
      });
      emitEvent('done', {
        iteration: 0,
        runState: 'completed',
        runMeta
      });
      res.end();
      return;
    }

    // Model ID mapping
    let modelId = normalizeConfiguredModelId(config.model, 'gemini-3.1-pro-preview');

    const ai = createGoogleAI(modelId);

    const runtimeToolAllowList = runtimeAgent
      ? new Set(
          (Array.isArray(runtimeAgent.tools) ? runtimeAgent.tools : [])
            .filter(Boolean)
            .filter(name => !['create_agent_blueprint', 'update_agent_blueprint', 'run_hub_agent', 'publish_status', 'report_progress'].includes(name))
        )
      : null;
    const webSearchEnabled = runtimeToolAllowList
      ? ['web_search', 'web_fetch', 'music_catalog_lookup'].some(toolName => runtimeToolAllowList.has(toolName))
      : config.googleSearch !== false;
    const executeScriptEnabled = runtimeToolAllowList
      ? runtimeToolAllowList.has('execute_script')
      : config.codeExecution !== false;
    let lastSuccessfulSearchQuery: string | null = null;

    const formatToolArgsPreview = (args: unknown) => clipText(args, 260);
    const formatToolMeta = (toolName: string, args: any) => {
      if (toolName === 'create_agent_blueprint') {
        return {
          brief: clipText(args?.brief || '', 140),
          outputKind: clipText(args?.outputKindHint || '', 24),
        };
      }
      if (toolName === 'update_agent_blueprint') {
        return {
          agent: clipText(args?.agentId || '', 80),
          request: clipText(args?.changeRequest || '', 140),
        };
      }
      if (toolName === 'run_hub_agent') {
        return {
          agent: clipText(args?.agentId || '', 80),
          mission: clipText(args?.mission || '', 140),
        };
      }
      if (toolName === 'music_catalog_lookup') {
        return {
          artist: clipText(args?.artistQuery || '', 80),
          owned: Array.isArray(args?.ownedTracks) ? args.ownedTracks.length : 0
        };
      }
      if (toolName === 'generate_image_asset') {
        return {
          prompt: clipText(args?.prompt || '', 140),
          model: clipText(args?.model || DEFAULT_IMAGE_MODEL, 48),
          filename: clipText(args?.filename || '', 80),
        };
      }
      if (toolName === 'generate_tts_audio') {
        return {
          text: clipText(args?.text || args?.prompt || '', 140),
          model: clipText(args?.model || DEFAULT_TTS_MODEL, 48),
          voice: clipText(args?.voice || '', 32),
          filename: clipText(args?.filename || '', 80),
        };
      }
      if (toolName === 'generate_music_audio') {
        return {
          prompt: clipText(args?.prompt || '', 140),
          model: clipText(args?.model || DEFAULT_LYRIA_MODEL, 48),
          filename: clipText(args?.filename || '', 80),
          sampleCount: Number(args?.sampleCount || 0),
        };
      }
      if (toolName === 'create_podcast_episode') {
        return {
          title: clipText(args?.title || '', 120),
          brief: clipText(args?.brief || args?.script || '', 140),
          ttsModel: clipText(args?.ttsModel || DEFAULT_PODCAST_TTS_MODEL, 48),
          musicModel: clipText(args?.musicModel || DEFAULT_LYRIA_MODEL, 48),
          voice: clipText(args?.voice || '', 32),
          outputExtension: clipText(args?.outputExtension || 'mp3', 8),
          filename: clipText(args?.filename || '', 80),
        };
      }
      if (toolName === 'begin_pdf_draft') {
        return {
          title: clipText(args?.title || '', 120),
          engine: clipText(args?.engine || 'auto', 16),
          compiler: clipText(args?.compiler || '', 16),
          theme: clipText(args?.theme || '', 24),
          filename: clipText(args?.filename || '', 80),
        };
      }
      if (toolName === 'append_to_draft') {
        return {
          engine: clipText(args?.engine || '', 16),
          compiler: clipText(args?.compiler || '', 16),
          sections: Array.isArray(args?.sections) ? args.sections.length : 0,
          sources: Array.isArray(args?.sources) ? args.sources.length : 0,
          theme: clipText(args?.theme || '', 24),
          hasLatexSource: Boolean(args?.latexSource),
        };
      }
      if (toolName === 'revise_pdf_draft') {
        return {
          title: clipText(args?.title || '', 120),
          engine: clipText(args?.engine || '', 16),
          compiler: clipText(args?.compiler || '', 16),
          sections: Array.isArray(args?.sections) ? args.sections.length : 0,
          operations: Array.isArray(args?.sectionOperations) ? args.sectionOperations.length : 0,
          sources: Array.isArray(args?.sources) ? args.sources.length : 0,
          sourcesMode: clipText(args?.sourcesMode || 'append', 16),
          theme: clipText(args?.theme || '', 24),
          hasLatexSource: Boolean(args?.latexSource),
        };
      }
      if (toolName === 'get_pdf_draft') {
        return {
          includeBodies: Boolean(args?.includeBodies),
        };
      }
      if (toolName === 'web_search') {
        return { query: clipText(args?.query || '', 140), maxResults: Number(args?.maxResults || 5) };
      }
      if (toolName === 'web_fetch') {
        return { url: clipText(args?.url || '', 180) };
      }
      if (toolName === 'create_pdf') {
        return {
          title: clipText(args?.title || '', 120),
          filename: clipText(args?.filename || '', 80),
          engine: clipText(args?.engine || 'auto', 16),
          compiler: clipText(args?.compiler || '', 16),
          theme: clipText(args?.theme || '', 24),
          useActiveDraft: Boolean(args?.useActiveDraft),
          sections: Array.isArray(args?.sections) ? args.sections.length : 0,
          hasLatexSource: Boolean(args?.latexSource),
        };
      }
      if (toolName === 'review_pdf_draft') {
        return {
          title: clipText(args?.title || '', 120),
          sections: Array.isArray(args?.sections) ? args.sections.length : 0,
          useActiveDraft: Boolean(args?.useActiveDraft),
          engine: clipText(args?.engine || 'auto', 16),
          compiler: clipText(args?.compiler || '', 16),
          hasLatexSource: Boolean(args?.latexSource),
        };
      }
      if (toolName === 'publish_status') {
        return {
          phase: clipText(args?.phase || '', 40),
          focus: clipText(args?.focus || '', 120),
          nextAction: clipText(args?.next_action || args?.nextAction || '', 120),
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
      if (toolName === 'create_agent_blueprint') {
        const blueprint = (output?.blueprint || output) as AgentBlueprint;
        return {
          name: clipText(blueprint?.name || '', 64),
          slug: clipText(blueprint?.slug || '', 48),
          outputKind: clipText(blueprint?.outputKind || '', 24),
          fields: Array.isArray(blueprint?.uiSchema) ? blueprint.uiSchema.length : 0,
          tools: Array.isArray(blueprint?.tools) ? blueprint.tools.length : 0,
        };
      }
      if (toolName === 'update_agent_blueprint') {
        const blueprint = (output?.blueprint || output) as AgentBlueprint;
        return {
          agent: clipText(args?.agentId || blueprint?.name || '', 80),
          name: clipText(blueprint?.name || '', 64),
          slug: clipText(blueprint?.slug || '', 48),
          outputKind: clipText(blueprint?.outputKind || '', 24),
          fields: Array.isArray(blueprint?.uiSchema) ? blueprint.uiSchema.length : 0,
          tools: Array.isArray(blueprint?.tools) ? blueprint.tools.length : 0,
        };
      }
      if (toolName === 'run_hub_agent') {
        return {
          agent: clipText(output?.agent?.name || args?.agentId || '', 80),
          slug: clipText(output?.agent?.slug || '', 48),
          outputKind: clipText(output?.agent?.outputKind || '', 24),
          iterations: Number(output?.iterations || 0),
          toolCalls: Number(output?.toolCalls || 0),
          released: Boolean(output?.releasedFile?.url),
        };
      }
      if (toolName === 'create_podcast_episode') {
        return {
          path: clipText(output?.path || '', 120),
          mimeType: clipText(output?.mimeType || '', 32),
          fileSizeBytes: Number(output?.fileSizeBytes || 0),
          ttsModel: clipText(output?.ttsModel || '', 48),
          musicModel: clipText(output?.musicModel || '', 48),
          voice: clipText(output?.voice || '', 32),
          mixStrategy: clipText(output?.mixStrategy || '', 24),
          durationSeconds: Number(output?.durationSeconds || 0),
          warning: clipText(output?.warning || '', 140),
        };
      }
      if (toolName === 'web_search') {
        return {
          query: clipText(output?.query || args?.query || '', 140),
          provider: clipText(output?.provider || '', 32),
          mode: clipText(output?.searchMode || '', 32),
          quality: clipText(output?.quality || '', 20),
          score: Number(output?.relevanceScore || 0),
          anchors: Array.isArray(output?.matchedAnchors) ? output.matchedAnchors.length : 0,
          fallback: Boolean(output?.fallbackUsed),
          directSources: Array.isArray(output?.directSourceUrls) ? output.directSourceUrls.length : 0,
          disabledReason: clipText(output?.searchDisabledReason || '', 40),
        };
      }
      if (toolName === 'web_fetch') {
        return {
          domain: clipText(output?.domain || '', 40),
          quality: clipText(output?.quality || '', 20),
          relevance: clipText(output?.relevance || '', 20),
          score: Number(output?.relevanceScore || 0),
          anchors: Array.isArray(output?.matchedAnchors) ? output.matchedAnchors.length : 0,
          searchPage: Boolean(output?.isSearchPage),
        };
      }
      if (toolName === 'generate_image_asset' || toolName === 'generate_tts_audio' || toolName === 'generate_music_audio') {
        return {
          path: clipText(output?.path || '', 120),
          model: clipText(output?.model || '', 48),
          mimeType: clipText(output?.mimeType || '', 32),
          fileSizeBytes: Number(output?.fileSizeBytes || 0),
          voice: clipText(output?.voice || '', 32),
          location: clipText(output?.location || '', 24),
        };
      }
      if (toolName === 'create_podcast_episode') {
        return {
          path: clipText(output?.path || '', 120),
          mimeType: clipText(output?.mimeType || '', 32),
          fileSizeBytes: Number(output?.fileSizeBytes || 0),
          ttsModel: clipText(output?.ttsModel || '', 48),
          musicModel: clipText(output?.musicModel || '', 48),
          voice: clipText(output?.voice || '', 32),
          durationSeconds: Number(output?.durationSeconds || 0),
        };
      }
      if (toolName === 'begin_pdf_draft' || toolName === 'append_to_draft' || toolName === 'revise_pdf_draft' || toolName === 'get_pdf_draft') {
        return {
          draftId: clipText(output?.draft?.draftId || output?.draftId || '', 24),
          engine: clipText(output?.draft?.engine || output?.engine || '', 12),
          compiler: clipText(output?.draft?.compiler || output?.compiler || '', 16),
          signature: clipText(output?.draft?.signature || output?.signature || '', 24),
          theme: clipText(output?.draft?.theme || output?.theme || '', 24),
          words: Number(output?.draft?.wordCount || output?.wordCount || 0),
          sections: Number(output?.draft?.sectionCount || output?.sectionCount || 0),
          cappedWords: Boolean(output?.draft?.cappedWords || output?.cappedWords),
        };
      }
      if (toolName === 'review_pdf_draft') {
        return {
          engine: clipText(output?.engine || '', 12),
          compiler: clipText(output?.compiler || '', 16),
          ready: Boolean(output?.ready),
          score: Number(output?.score || 0),
          signature: clipText(output?.signature || '', 24),
          cacheHit: Boolean(output?.cacheHit),
        };
      }
      if (toolName === 'create_pdf') {
        return {
          path: clipText(output?.path || '', 120),
          engine: clipText(output?.engine || '', 12),
          compiler: clipText(output?.compiler || '', 16),
          signature: clipText(output?.signature || '', 24),
          theme: clipText(output?.theme || '', 24),
          pageCount: Number(output?.pageCount || 0),
          blankBodyPageCount: Number(output?.blankBodyPageCount || 0),
          cacheHit: Boolean(output?.cacheHit),
          alreadyCreated: Boolean(output?.alreadyCreated),
        };
      }
      return formatToolMeta(toolName, args);
    };
    const formatToolResultPreview = (toolName: string, output: any) => {
      if (toolName === 'create_agent_blueprint') {
        const blueprint = output?.blueprint || output;
        return [
          blueprint?.name ? `Agent: ${blueprint.name}` : null,
          blueprint?.outputKind ? `sortie ${blueprint.outputKind}` : null,
          Array.isArray(blueprint?.uiSchema) ? `${blueprint.uiSchema.length} champ(s)` : null,
          Array.isArray(blueprint?.tools) ? `${blueprint.tools.length} outil(s)` : null,
          blueprint?.tagline ? clipText(blueprint.tagline, 90) : null,
        ].filter(Boolean).join(' | ');
      }
      if (toolName === 'update_agent_blueprint') {
        const blueprint = output?.blueprint || output;
        return [
          blueprint?.name ? `Agent mis a jour: ${blueprint.name}` : null,
          blueprint?.outputKind ? `sortie ${blueprint.outputKind}` : null,
          Array.isArray(blueprint?.uiSchema) ? `${blueprint.uiSchema.length} champ(s)` : null,
          Array.isArray(blueprint?.tools) ? `${blueprint.tools.length} outil(s)` : null,
          output?.message ? clipText(output.message, 120) : blueprint?.tagline ? clipText(blueprint.tagline, 90) : null,
        ].filter(Boolean).join(' | ');
      }
      if (toolName === 'run_hub_agent') {
        return [
          output?.agent?.name ? `Sous-mission: ${output.agent.name}` : null,
          output?.agent?.outputKind ? `sortie ${output.agent.outputKind}` : null,
          Number(output?.iterations || 0) > 0 ? `${Number(output.iterations)} tour(s)` : null,
          Number(output?.toolCalls || 0) > 0 ? `${Number(output.toolCalls)} outil(s)` : null,
          output?.releasedFile?.url ? 'livrable publie' : null,
          output?.message ? clipText(output.message, 120) : null,
        ].filter(Boolean).join(' | ');
      }
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
      if (toolName === 'generate_image_asset') {
        return [
          output?.model ? `modèle ${output.model}` : null,
          output?.mimeType ? output.mimeType : null,
          output?.path ? clipText(output.path, 120) : null,
          output?.message ? clipText(output.message, 140) : null,
        ].filter(Boolean).join(' | ');
      }
      if (toolName === 'generate_tts_audio') {
        return [
          output?.model ? `modèle ${output.model}` : null,
          output?.voice ? `voix ${output.voice}` : null,
          output?.mimeType ? output.mimeType : null,
          output?.path ? clipText(output.path, 120) : null,
          output?.message ? clipText(output.message, 140) : null,
        ].filter(Boolean).join(' | ');
      }
      if (toolName === 'generate_music_audio') {
        return [
          output?.model ? `modèle ${output.model}` : null,
          output?.location ? `loc ${output.location}` : null,
          output?.mimeType ? output.mimeType : null,
          output?.path ? clipText(output.path, 120) : null,
          output?.message ? clipText(output.message, 140) : null,
        ].filter(Boolean).join(' | ');
      }
      if (toolName === 'create_podcast_episode') {
        return [
          output?.ttsModel ? `voix ${output.ttsModel}` : null,
          output?.musicModel ? `musique ${output.musicModel}` : null,
          output?.voice ? `voix ${output.voice}` : null,
          output?.mixStrategy ? `mix ${output.mixStrategy}` : null,
          Number(output?.durationSeconds || 0) > 0 ? `${Number(output.durationSeconds).toFixed(1)}s` : null,
          output?.warning ? clipText(output.warning, 120) : null,
          output?.path ? clipText(output.path, 120) : null,
          output?.message ? clipText(output.message, 140) : null,
        ].filter(Boolean).join(' | ');
      }
      if (toolName === 'web_search') {
        const results = Array.isArray(output?.results) ? output.results : [];
        const directSources = Array.isArray(output?.directSourceUrls) ? output.directSourceUrls : [];
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
        const directHint = directSources.length > 0
          ? ` Sources directes: ${directSources.slice(0, 3).join(' | ')}`
          : '';
        return `${qualityPrefix}${queryPrefix}${summary || clipText(output?.message || output?.error || '', 220)}${warnings}${directHint}`.trim();
      }
      if (toolName === 'web_fetch') {
        const qualityPrefix = output?.quality ? `[${String(output.quality)}${output?.relevance ? `/${String(output.relevance)}` : ''}${output?.domain ? ` ${output.domain}` : ''}] ` : '';
        return `${qualityPrefix}${clipText(output?.excerpt || output?.content || output?.message || output?.error || '', 220)}`.trim();
      }
      if (toolName === 'begin_pdf_draft' || toolName === 'append_to_draft' || toolName === 'revise_pdf_draft' || toolName === 'get_pdf_draft') {
        const draft = output?.draft || output;
        const capNote = draft?.cappedWords && draft?.requestedWordCount
          ? ` | cap ${draft.targetWords}/${draft.requestedWordCount} mots`
          : '';
        const engineNote = draft?.engine ? ` ${draft.engine}` : '';
        const compilerNote = draft?.compiler ? `/${draft.compiler}` : '';
        return `Brouillon${engineNote}${compilerNote} ${clipText(draft?.theme || 'report', 16)} | ${Number(draft?.wordCount || 0)} mots | ${Number(draft?.sectionCount || 0)} section(s)${capNote}`;
      }
      if (toolName === 'review_pdf_draft') {
        const blocking = Array.isArray(output?.blockingIssues) ? output.blockingIssues.length : 0;
        const improvements = Array.isArray(output?.improvements) ? output.improvements.length : 0;
        const readiness = output?.ready ? 'Pret' : 'A corriger';
        const compileNote = output?.compileLogPreview ? ' | log compile dispo' : '';
        return `${readiness} | ${output?.engine || 'pdfkit'}${output?.compiler ? `/${output.compiler}` : ''} | score ${Number(output?.score || 0)}/100 | ${blocking + improvements} suggestion(s)${compileNote}`;
      }
      if (toolName === 'create_pdf') {
        const themeLabel = output?.theme ? `theme ${output.theme}` : 'theme auto';
        const engineLabel = output?.engine ? `${output.engine}${output?.compiler ? `/${output.compiler}` : ''}` : 'pdfkit';
        const cacheNote = output?.alreadyCreated ? ' | deja cree' : output?.cacheHit ? ' | cache review' : '';
        return `${engineLabel} | ${themeLabel} | ${Number(output?.pageCount || 0)} page(s) | ${output?.usedCoverPage ? 'cover' : 'sans cover'}${cacheNote} | ${clipText(output?.message || output?.error || '', 140)}`;
      }
      return clipText(output?.message || output?.error || output, 240);
    };

    let latestApprovedPdfReviewSignature: string | null = null;
    let latestApprovedPdfRenderCache: PdfCompiledArtifactCache | null = null;
    let latestCreatedPdfArtifact: PdfCreatedArtifact | null = null;
    const pdfCreateFailureCounts = new Map<string, number>();

    function invalidatePdfArtifactState(clearReleasedState = false) {
      latestApprovedPdfReviewSignature = null;
      latestApprovedPdfRenderCache = null;
      latestCreatedPdfArtifact = null;
      if (clearReleasedState) {
        latestCreatedArtifactPath = null;
        latestReleasedFile = null;
      }
    }

    function applyActivePdfDraft(draft: ActivePdfDraft | null, options?: { invalidateArtifacts?: boolean }) {
      sessionState.activePdfDraft = draft ? refreshActivePdfDraft(draft) : null;
      latestApprovedPdfReviewSignature = sessionState.activePdfDraft?.approvedReviewSignature || null;
      if (options?.invalidateArtifacts) {
        invalidatePdfArtifactState(true);
      } else if (!latestApprovedPdfReviewSignature) {
        latestApprovedPdfRenderCache = null;
      }
      return sessionState.activePdfDraft;
    }

    function incrementPdfCreateFailure(signature: string): number {
      const next = (pdfCreateFailureCounts.get(signature) || 0) + 1;
      pdfCreateFailureCounts.set(signature, next);
      return next;
    }

    function clearPdfCreateFailure(signature: string) {
      pdfCreateFailureCounts.delete(signature);
    }

    function getPdfCreateFailureCount(signature: string): number {
      return pdfCreateFailureCounts.get(signature) || 0;
    }

    function requireActivePdfDraft() {
      return sessionState.activePdfDraft;
    }

    const pdfQualityTargets: PdfQualityTargets | null = null;

    const localTools: LocalToolDefinition[] = [
      ...(COWORK_DEBUG_REASONING ? [{
        name: "publish_status",
        description: "Outil debug: annonce publiquement une mise a jour courte et utile sans exposer le chain-of-thought brut.",
        parameters: {
          type: "object",
          properties: {
            phase: { type: "string", description: "Une des phases: analysis, composition, research, verification, production, delivery, completed." },
            focus: { type: "string", description: "Le sujet precis sur lequel tu te concentres maintenant." },
            next_action: { type: "string", description: "La prochaine action concrete que tu vas faire." },
            why_now: { type: "string", description: "Pourquoi cette action vient maintenant." },
            done_when: { type: "string", description: "Comment tu sauras que cette etape est suffisante." },
            blocker: { type: "string", description: "Le blocage principal eventuel du moment." }
          },
          required: ["phase", "focus", "next_action"]
        },
        execute: (args: {
          phase: string;
          focus: string;
          next_action: string;
          why_now?: string;
          done_when?: string;
          blocker?: string;
        }) => ({
          success: true,
          status: parsePublicStatusPayload(args)
        })
      }] : []),
      ...(COWORK_DEBUG_REASONING ? [{
        name: "report_progress",
        description: "Outil debug de raisonnement structure. Fournit l'etat des connaissances, le manque precise, le pourquoi du prochain outil, le resultat attendu, le plan B, et un score de completude.",
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
                phase: { type: "string", description: "Une des phases: analysis, composition, research, verification, production, delivery, completed." }
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
      }
      ] : []),
      {
        name: "create_agent_blueprint",
        description: "Concoit un agent specialise reutilisable pour le Hub Agents quand la meilleure reponse est de deleguer a un specialiste recurrent. Retourne un blueprint complet avec prompt systeme, prompt de depart, champs UI et outils conseilles.",
        parameters: {
          type: "object",
          properties: {
            brief: { type: "string", description: "Mission exacte du futur agent specialise." },
            outputKindHint: { type: "string", description: "Type de livrable prefere si connu: pdf, html, podcast, code, research, automation." }
          },
          required: ["brief"]
        },
        execute: async ({
          brief,
          outputKindHint
        }: {
          brief: string;
          outputKindHint?: string;
        }) => {
          const effectiveBrief = [brief, outputKindHint ? `Format prefere: ${outputKindHint}.` : null]
            .filter(Boolean)
            .join('\n');
          const blueprint = sanitizeAgentBlueprint(
            await generateAgentBlueprintFromBrief(effectiveBrief, 'cowork'),
            effectiveBrief
          );

          return {
            success: true,
            message: `Agent '${blueprint.name}' pret pour le Hub Agents.`,
            blueprint,
          };
        }
      },
      {
        name: "update_agent_blueprint",
        description: "Met a jour un agent existant du Hub Agents. Utilise-le quand l'utilisateur veut corriger, enrichir ou refaire le prompt, les tools ou l'interface d'un agent deja cree.",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "ID, slug ou nom de l'agent du hub a modifier." },
            changeRequest: { type: "string", description: "Ce qui doit etre corrige, ajoute, retire ou ameliorer sur cet agent." }
          },
          required: ["agentId", "changeRequest"]
        },
        execute: async ({
          agentId,
          changeRequest
        }: {
          agentId: string;
          changeRequest: string;
        }) => {
          const agentSelector = clipText(agentId, 120);
          const effectiveRequest = clipText(changeRequest, 1600);

          if (!availableHubAgents.length) {
            return {
              success: false,
              recoverable: true,
              error: "Aucun agent n'est disponible dans le Hub pour cette modification."
            };
          }

          if (!agentSelector) {
            return {
              success: false,
              recoverable: true,
              error: "Precise l'agent du Hub a modifier via son id, son slug ou son nom."
            };
          }

          const selectedAgent = pickHubAgentRecord(availableHubAgents, agentSelector);
          if (!selectedAgent) {
            return {
              success: false,
              recoverable: true,
              error: `Aucun agent du Hub ne correspond a '${agentSelector}'.`,
              availableAgents: availableHubAgents.slice(0, 8).map(agent => ({
                id: agent.id,
                slug: agent.slug,
                name: agent.name,
                outputKind: agent.outputKind,
              }))
            };
          }

          if (!effectiveRequest) {
            return {
              success: false,
              recoverable: true,
              error: "La demande de modification est vide. Explique ce qu'il faut changer."
            };
          }

          const blueprint = sanitizeAgentBlueprint(
            await reviseAgentBlueprint(selectedAgent, effectiveRequest),
            effectiveRequest
          );

          return {
            success: true,
            message: `Agent '${selectedAgent.name}' mis a jour pour le Hub Agents.`,
            blueprint: {
              ...blueprint,
              id: selectedAgent.id,
              createdBy: selectedAgent.createdBy,
            },
          };
        }
      },
      {
        name: "run_hub_agent",
        description: "Relance un agent deja present dans le Hub Agents comme vraie sous-mission. Utilise-le quand un specialiste existant correspond deja a la demande, au lieu de recreer un blueprint.",
        parameters: {
          type: "object",
          properties: {
            agentId: { type: "string", description: "ID, slug ou nom de l'agent du hub a relancer." },
            mission: { type: "string", description: "Sous-mission concrete a confier a cet agent." }
          },
          required: ["agentId", "mission"]
        },
        execute: async ({
          agentId,
          mission
        }: {
          agentId: string;
          mission: string;
        }) => {
          const agentSelector = clipText(agentId, 120);
          const effectiveMission = clipText(mission, 1600);

          if (!availableHubAgents.length) {
            return {
              success: false,
              recoverable: true,
              error: "Aucun agent n'est disponible dans le Hub pour cette conversation."
            };
          }

          if (!agentSelector) {
            return {
              success: false,
              recoverable: true,
              error: "Precise l'agent du Hub a relancer via son id, son slug ou son nom."
            };
          }

          const selectedAgent = pickHubAgentRecord(availableHubAgents, agentSelector);
          if (!selectedAgent) {
            return {
              success: false,
              recoverable: true,
              error: `Aucun agent du Hub ne correspond a '${agentSelector}'.`,
              availableAgents: availableHubAgents.slice(0, 8).map(agent => ({
                id: agent.id,
                slug: agent.slug,
                name: agent.name,
                outputKind: agent.outputKind,
              }))
            };
          }

          if (!effectiveMission) {
            return {
              success: false,
              recoverable: true,
              error: "La sous-mission est vide. Fournis un objectif concret a traiter."
            };
          }

          const delegatedToolNames = new Set(
            (Array.isArray(selectedAgent.tools) ? selectedAgent.tools : [])
              .filter(Boolean)
              .filter(name => !['create_agent_blueprint', 'update_agent_blueprint', 'run_hub_agent', 'publish_status', 'report_progress'].includes(name))
          );
          const delegatedTools = localTools.filter(tool => delegatedToolNames.has(tool.name));
          const delegatedToolDeclarations = delegatedTools.length > 0
            ? [{
                functionDeclarations: delegatedTools.map(tool => ({
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters
                }))
              }]
            : undefined;
          const delegatedSystemInstruction = [
            selectedAgent.systemInstruction.trim(),
            "### CONTEXTE D'EXECUTION",
            `- Tu operes comme sous-mission de Cowork avec l'agent '${selectedAgent.name}'.`,
            "- Tu peux utiliser uniquement les outils exposes a cet agent.",
            "- Si tu livres un artefact, publie-le puis rends le lien final.",
            "- N'invente jamais une verification, un fichier ou une publication.",
            requestClock
              ? `- Date de reference: ${requestClock.absoluteDateTimeLabel} (${requestClock.timeZone}).`
              : null,
          ].filter(Boolean).join('\n');
          const delegatedPrompt = [
            `Agent du hub: ${selectedAgent.name} (${selectedAgent.outputKind})`,
            `Mission du blueprint: ${selectedAgent.mission}`,
            `Quand l'utiliser: ${selectedAgent.whenToUse}`,
            selectedAgent.starterPrompt ? `Starter prompt: ${selectedAgent.starterPrompt}` : null,
            selectedAgent.uiSchema.length > 0
              ? `Champs UI disponibles: ${selectedAgent.uiSchema.map(field => `${field.label}${field.required ? '*' : ''}`).join(', ')}`
              : null,
            `Sous-mission immediate: ${effectiveMission}`,
            "Si certains champs UI sont implicites dans la mission, deduis-les et avance sans demander de formulaire."
          ].filter(Boolean).join('\n');

          let delegatedContents = [{ role: 'user' as const, parts: [{ text: delegatedPrompt }] }];
          let delegatedIterations = 0;
          let delegatedToolCalls = 0;
          let delegatedFinalText = '';
          let delegatedCreatedArtifactPath: string | null = null;
          let delegatedReleasedFile: { url: string; path?: string } | null = null;
          let delegatedLastError: string | null = null;
          const delegatedModelId = modelId;
          const delegatedMaxIterations = 8;

          emitEvent('status', {
            iteration: iterations,
            title: 'Sous-mission',
            message: `Cowork relance maintenant '${selectedAgent.name}' comme specialiste.`,
            runState: 'running',
            runMeta
          });

          while (delegatedIterations < delegatedMaxIterations) {
            delegatedIterations += 1;
            const delegatedGenConfig: any = {
              temperature: Math.min(Math.max(config.temperature || 0.2, 0.05), 0.45),
              topP: config.topP || 1.0,
              topK: config.topK || 1,
              maxOutputTokens: Math.min(config.maxOutputTokens || 24576, 24576),
              systemInstruction: delegatedSystemInstruction,
              ...(delegatedToolDeclarations ? { tools: delegatedToolDeclarations } : {})
            };
            const delegatedThinkingConfig = buildThinkingConfig(delegatedModelId, {
              thinkingLevel: config.thinkingLevel || 'high',
              maxThoughtTokens: Math.min(config.maxThoughtTokens || 2048, 2048),
              includeThoughts: COWORK_DEBUG_REASONING,
            });
            if (delegatedThinkingConfig) {
              delegatedGenConfig.thinkingConfig = delegatedThinkingConfig;
            }

            const delegatedResponse = await retryWithBackoff(() => ai.models.generateContent({
              model: delegatedModelId,
              contents: delegatedContents,
              config: delegatedGenConfig
            }), {
              maxRetries: 2,
              exactDelaysMs: [2000, 4000],
              jitter: false,
              onRetry: async ({ delayMs, kind, message: retryMessage }) => {
                runMeta.retryCount += 1;
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Sous-mission en attente',
                  message:
                    kind === 'concurrency'
                      ? `L'agent ${selectedAgent.name} attend une nouvelle tentative dans ${formatWaitDuration(delayMs)}. ${retryMessage}`
                      : kind === 'server'
                        ? `Le modele est temporairement indisponible pour ${selectedAgent.name}. Nouvelle tentative dans ${formatWaitDuration(delayMs)}. ${retryMessage}`
                        : `Quota ou limite temporaire pour ${selectedAgent.name}. Nouvelle tentative dans ${formatWaitDuration(delayMs)}. ${retryMessage}`,
                  runMeta
                });
              }
            });

            accumulateUsageTotals(runMeta, delegatedModelId, delegatedResponse);

            const delegatedTurn = (delegatedResponse as any)?.candidates?.[0]?.content;
            const delegatedParts: any[] = delegatedTurn?.parts
              ? [...delegatedTurn.parts]
              : delegatedResponse.text
                ? [{ text: delegatedResponse.text }]
                : [];
            const delegatedFunctionCalls = delegatedParts
              .filter(part => part.functionCall)
              .map(part => part.functionCall);
            let delegatedTurnText = '';

            for (const part of delegatedParts) {
              if (part.thought) continue;
              if (part.text && delegatedFunctionCalls.length === 0) {
                delegatedTurnText += part.text;
              }
            }

            delegatedContents.push({
              role: delegatedTurn?.role || 'model',
              parts: delegatedParts
            });

            if (delegatedFunctionCalls.length === 0) {
              const cleanedTurnText = delegatedTurnText.trim();
              if (cleanedTurnText) {
                delegatedFinalText = cleanedTurnText;
                break;
              }

              delegatedLastError = "La sous-mission n'a rien livre de visible sur ce tour.";
              delegatedContents.push({
                role: 'user',
                parts: [{ text: "Ta reponse est vide. Livre maintenant un resultat concret ou une limite honnete." }]
              });
              continue;
            }

            if (delegatedFunctionCalls.length > 3) {
              delegatedLastError = "La sous-mission a tente trop d'outils dans un meme tour.";
              delegatedContents.push({
                role: 'user',
                parts: [{ text: "Limite de sous-mission: au plus 3 outils par tour. Reprends avec une chaine plus courte." }]
              });
              continue;
            }

            const delegatedToolResults: any[] = [];
            for (const delegatedCall of delegatedFunctionCalls) {
              const delegatedTool = delegatedTools.find(tool => tool.name === delegatedCall.name);
              if (!delegatedTool) {
                const unauthorizedError = `L'outil '${delegatedCall.name}' n'est pas autorise pour l'agent '${selectedAgent.name}'.`;
                delegatedLastError = unauthorizedError;
                delegatedToolResults.push({
                  functionResponse: {
                    ...(delegatedCall.id ? { id: delegatedCall.id } : {}),
                    name: delegatedCall.name,
                    response: { success: false, error: unauthorizedError }
                  }
                });
                continue;
              }

              runMeta.toolCalls += 1;
              delegatedToolCalls += 1;

              try {
                const delegatedOutput = await delegatedTool.execute(delegatedCall.args);
                const delegatedError = (delegatedOutput as any)?.error || (delegatedOutput as any)?.success === false;

                if (delegatedError) {
                  delegatedLastError = String((delegatedOutput as any)?.error || (delegatedOutput as any)?.message || `Echec ${delegatedTool.name}`);
                } else {
                  if (delegatedTool.name === 'web_search') {
                    successfulResearchMeta.webSearches += 1;
                  }
                  if (delegatedTool.name === 'web_fetch') {
                    successfulResearchMeta.webFetches += 1;
                    addValidatedSource({
                      url: String((delegatedOutput as any).url || (delegatedCall.args as any)?.url || ''),
                      domain: String((delegatedOutput as any).domain || ''),
                      kind: 'web_fetch'
                    });
                    addFacts(String((delegatedOutput as any).title || ''), String((delegatedOutput as any).excerpt || ''));
                  }
                  if (delegatedTool.name === 'music_catalog_lookup') {
                    successfulResearchMeta.musicCatalogCoverage = (delegatedOutput as any).coverage || null;
                    successfulResearchMeta.musicCatalogCompleted = !(delegatedOutput as any).partial;
                    for (const source of Array.isArray((delegatedOutput as any).sources) ? (delegatedOutput as any).sources : []) {
                      addValidatedSource({
                        url: String(source?.url || ''),
                        domain: String(source?.domain || ''),
                        kind: 'music_catalog_lookup'
                      });
                    }
                    addFacts(String((delegatedOutput as any).message || ''));
                  }
                  if (delegatedTool.name === 'create_pdf' && typeof (delegatedOutput as any).path === 'string') {
                    delegatedCreatedArtifactPath = (delegatedOutput as any).path;
                    latestCreatedArtifactPath = delegatedCreatedArtifactPath;
                  } else if (['generate_image_asset', 'generate_tts_audio', 'generate_music_audio', 'create_podcast_episode'].includes(delegatedTool.name) && typeof (delegatedOutput as any).path === 'string') {
                    delegatedCreatedArtifactPath = (delegatedOutput as any).path;
                    latestCreatedArtifactPath = delegatedCreatedArtifactPath;
                  } else if (delegatedTool.name === 'write_file' && typeof (delegatedCall.args as any)?.path === 'string') {
                    delegatedCreatedArtifactPath = (delegatedCall.args as any).path;
                    latestCreatedArtifactPath = delegatedCreatedArtifactPath;
                  }
                  if (delegatedTool.name === 'release_file' && typeof (delegatedOutput as any).url === 'string') {
                    delegatedReleasedFile = {
                      url: (delegatedOutput as any).url,
                      path: typeof (delegatedCall.args as any)?.path === 'string' ? (delegatedCall.args as any).path : undefined
                    };
                    latestReleasedFile = delegatedReleasedFile;
                  }
                }

                refreshSessionState();
                delegatedToolResults.push({
                  functionResponse: {
                    ...(delegatedCall.id ? { id: delegatedCall.id } : {}),
                    name: delegatedTool.name,
                    response: delegatedOutput
                  }
                });
              } catch (error) {
                delegatedLastError = parseApiError(error);
                delegatedToolResults.push({
                  functionResponse: {
                    ...(delegatedCall.id ? { id: delegatedCall.id } : {}),
                    name: delegatedTool.name,
                    response: {
                      success: false,
                      error: delegatedLastError
                    }
                  }
                });
              }
            }

            delegatedContents.push(...delegatedToolResults);
          }

          const deliveredText = delegatedFinalText.trim()
            || (delegatedReleasedFile?.url ? `Livrable publie: ${delegatedReleasedFile.url}` : '');
          const delegatedSuccess = Boolean(deliveredText || delegatedReleasedFile?.url);

          if (delegatedSuccess) {
            emitEvent('status', {
              iteration: iterations,
              title: 'Sous-mission terminee',
              message: delegatedReleasedFile?.url
                ? `L'agent '${selectedAgent.name}' a publie un livrable reutilisable.`
                : `L'agent '${selectedAgent.name}' a livre un resultat exploitable.`,
              runState: 'running',
              runMeta
            });
          } else {
            emitEvent('warning', {
              iteration: iterations,
              title: 'Sous-mission incomplete',
              message: delegatedLastError
                ? `L'agent '${selectedAgent.name}' n'a pas livre de resultat exploitable: ${clipText(delegatedLastError, 220)}`
                : `L'agent '${selectedAgent.name}' n'a pas livre de resultat exploitable.`,
              runMeta
            });
          }

          return {
            success: delegatedSuccess,
            agent: {
              id: selectedAgent.id,
              slug: selectedAgent.slug,
              name: selectedAgent.name,
              outputKind: selectedAgent.outputKind,
            },
            mission: effectiveMission,
            finalText: deliveredText || undefined,
            releasedFile: delegatedReleasedFile || undefined,
            createdArtifactPath: delegatedCreatedArtifactPath || undefined,
            iterations: delegatedIterations,
            toolCalls: delegatedToolCalls,
            allowedTools: delegatedTools.map(tool => tool.name),
            message: delegatedSuccess
              ? `Sous-mission '${selectedAgent.name}' executee.`
              : `Sous-mission '${selectedAgent.name}' sans livraison exploitable.`,
            ...(delegatedLastError ? { warning: clipText(delegatedLastError, 220) } : {}),
          };
        }
      },
      {
        name: "music_catalog_lookup",
        description: "Raccourci specialise pour explorer un artiste musical: discographie, sorties, titres manquants, couverture catalogue, pages artiste et pistes de paroles. Utile des qu'une demande touche a un rappeur, un chanteur, une discographie ou un catalogue.",
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
        name: "generate_image_asset",
        description: "Genere une image locale avec le modele image de ton choix, l'ecrit dans '/tmp/' et renvoie le chemin du fichier. Utile pour une cover, une illustration, un visuel ou une vignette avant publication via 'release_file'.",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Prompt image exact." },
            model: { type: "string", description: "Modele image explicite, ex: gemini-2.5-flash-image." },
            filename: { type: "string", description: "Nom de fichier optionnel dans /tmp/." },
            aspectRatio: { type: "string", description: "Format optionnel, ex: 1:1, 16:9, 9:16." },
            imageSize: { type: "string", description: "Taille optionnelle, ex: 1K." },
            numberOfImages: { type: "number", description: "Nombre d'images demande au modele. Le premier rendu sera conserve localement." },
            personGeneration: { type: "string", description: "Reglage optionnel de generation de personnes." },
            safetySetting: { type: "string", description: "Reglage optionnel de filtre de securite." },
            thinkingLevel: { type: "string", description: "Thinking optionnel pour certains modeles image Gemini." }
          },
          required: ["prompt"]
        },
        execute: async ({
          prompt,
          model,
          filename,
          aspectRatio,
          imageSize,
          numberOfImages,
          personGeneration,
          safetySetting,
          thinkingLevel
        }: {
          prompt: string;
          model?: string;
          filename?: string;
          aspectRatio?: string;
          imageSize?: string;
          numberOfImages?: number;
          personGeneration?: string;
          safetySetting?: string;
          thinkingLevel?: string;
        }) => {
          const artifact = await generateImageBinary({
            prompt,
            model,
            aspectRatio,
            imageSize,
            numberOfImages,
            personGeneration,
            safetySetting,
            thinkingLevel
          });
          const outputPath = buildGeneratedArtifactPath('cowork-image', artifact.fileExtension, filename);
          fs.writeFileSync(outputPath, artifact.buffer);
          return {
            success: true,
            path: outputPath,
            mimeType: artifact.mimeType,
            model: artifact.model,
            fileSizeBytes: artifact.buffer.length,
            message: `Image creee avec succes a ${outputPath}. Utilise maintenant 'release_file' pour obtenir un lien.`
          };
        }
      },
      {
        name: "generate_tts_audio",
        description: "Synthese un audio via Gemini TTS, l'ecrit dans '/tmp/' au format WAV et renvoie le chemin du fichier. Gere les style instructions et peut aussi faire un vrai duo a 2 intervenants si tu fournis exactement 2 `speakers` et un texte avec labels `Nom:` correspondants. En duo, choisis toujours 2 voix distinctes et 2 intentions de jeu clairement contrastees. Utile pour une voix-off, un jingle parle, une narration, une capsule audio ou un mini-dialogue quand l'utilisateur veut la voix seule. Pour un podcast pret a publier avec musique + mix final, prefere `create_podcast_episode`.",
        parameters: {
          type: "object",
          properties: {
            text: { type: "string", description: "Texte exact a dire. En duo, chaque ligne doit utiliser un label `Nom:` qui correspond aux speakers. Pour les noms propres et mots etrangers, garde l'ecriture du pays d'origine quand cela fluidifie la prononciation." },
            model: { type: "string", description: "Modele TTS explicite, ex: gemini-2.5-flash-tts ou gemini-2.5-pro-tts. Pour 2 intervenants, n'utilise pas gemini-2.5-flash-lite-preview-tts." },
            voice: { type: "string", description: "Nom de voix prebuilt Gemini pour le mode single-speaker, ex: Kore." },
            styleInstructions: { type: "string", description: "Consignes de jeu globales: ton, rythme, accent, energie, emotion, etc." },
            speakers: {
              type: "array",
              description: "Configuration exacte des 2 intervenants Gemini TTS. Maximum 2. Si tu fournis ce champ, utilise exactement 2 objets, 2 voix differentes, et des labels de script identiques.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Nom du speaker tel qu'il apparait dans le texte, ex: Yemma." },
                  voice: { type: "string", description: "Voix Gemini de cet intervenant, ex: Kore, Puck, Charon." },
                  styleInstructions: { type: "string", description: "Consignes de jeu propres a cet intervenant." }
                },
                required: ["name"]
              }
            },
            languageCode: { type: "string", description: "Locale optionnelle, ex: fr-FR." },
            filename: { type: "string", description: "Nom de fichier optionnel dans /tmp/." }
          },
          required: ["text"]
        },
        execute: async ({
          text,
          model,
          voice,
          styleInstructions,
          speakers,
          languageCode,
          filename
        }: {
          text: string;
          model?: string;
          voice?: string;
          styleInstructions?: string;
          speakers?: Array<{ name: string; voice?: string; styleInstructions?: string }>;
          languageCode?: string;
          filename?: string;
        }) => {
          const hasDuo = Array.isArray(speakers) && speakers.length > 0;
          const directedPrompt = hasDuo
            ? [
                styleInstructions ? `Global style instructions: ${styleInstructions}.` : null,
                "Narrate the following two-speaker script exactly as written.",
                "Make the two speakers clearly different in cadence, energy, and emotional contour.",
                "Whenever a proper name or foreign-language term belongs to another writing system, keep it in that original script when it improves pronunciation.",
                "Use exactly the provided speaker labels and do not add extra narration.",
                "Script:",
                text,
              ].filter(Boolean).join('\n')
            : [
                styleInstructions ? `Style instructions: ${styleInstructions}.` : null,
                "Whenever a proper name or foreign-language term belongs to another writing system, keep it in that original script when it improves pronunciation.",
                text,
              ].filter(Boolean).join('\n\n');
          const artifact = await generateGeminiTtsBinary({
            prompt: directedPrompt,
            model,
            voice,
            speakers,
            languageCode
          });
          const outputPath = buildGeneratedArtifactPath('cowork-tts', artifact.fileExtension, filename);
          fs.writeFileSync(outputPath, artifact.buffer);
          return {
            success: true,
            path: outputPath,
            mimeType: artifact.mimeType,
            model: artifact.model,
            voice: artifact.metadata?.voice,
            speakerMode: artifact.metadata?.speakerMode,
            speakerNames: artifact.metadata?.speakerNames,
            speakerVoices: artifact.metadata?.speakerVoices,
            languageCode: artifact.metadata?.languageCode,
            fileSizeBytes: artifact.buffer.length,
            message: `Audio TTS cree avec succes a ${outputPath}. Utilise maintenant 'release_file' pour obtenir un lien.`
          };
        }
      },
      {
        name: "generate_music_audio",
        description: "Genere une boucle ou un clip musical via Lyria, l'ecrit dans '/tmp/' et renvoie le chemin du fichier. `lyria-002` reste le choix le plus robuste pour un bed podcast. `lyria-3-clip-preview` et `lyria-3-pro-preview` existent en preview pour des essais plus ambitieux, mais ne doivent pas remplacer le defaut robuste sans raison. Utile pour une ambiance, un bed musical ou une texture sonore quand l'utilisateur veut la musique seule. Pour un podcast pret a publier avec voix + musique + mix final, prefere 'create_podcast_episode'. Si un filtre Lyria bloque un prompt, reformule-le de facon plus neutre et musicale (genre, humeur, tempo, instruments, structure) en evitant les formulations sensibles ou d'imitation.",
        parameters: {
          type: "object",
          properties: {
            prompt: { type: "string", description: "Prompt musical exact." },
            model: { type: "string", description: "Modele Lyria explicite, ex: lyria-002, lyria-3-clip-preview, lyria-3-pro-preview." },
            negativePrompt: { type: "string", description: "Prompt negatif optionnel." },
            seed: { type: "number", description: "Seed optionnel pour une sortie deterministe Lyria 2." },
            sampleCount: { type: "number", description: "Nombre de samples Lyria 2 (1-4). Ne pas combiner avec seed." },
            location: { type: "string", description: "Region Vertex explicite pour Lyria 2 si besoin." },
            filename: { type: "string", description: "Nom de fichier optionnel dans /tmp/." }
          },
          required: ["prompt"]
        },
        execute: async ({
          prompt,
          model,
          negativePrompt,
          seed,
          sampleCount,
          location,
          filename
        }: {
          prompt: string;
          model?: string;
          negativePrompt?: string;
          seed?: number;
          sampleCount?: number;
          location?: string;
          filename?: string;
        }) => {
          let artifact: Awaited<ReturnType<typeof generateLyriaBinary>>;
          try {
            artifact = await generateLyriaBinary({
              prompt,
              model,
              negativePrompt,
              seed,
              sampleCount,
              location
            });
          } catch (error) {
            if (isLyriaPolicyBlockedError(error)) {
              return {
                success: false,
                recoverable: true,
                policyBlocked: true,
                error: "Le prompt Lyria a ete bloque par le filtre de securite.",
                message: "Reformule en brief plus neutre: style, humeur, BPM, instruments, structure, langue. Evite les formulations sensibles, les details trop personnels et toute imitation d'artiste."
              };
            }
            throw error;
          }
          const outputPath = buildGeneratedArtifactPath('cowork-music', artifact.fileExtension, filename);
          fs.writeFileSync(outputPath, artifact.buffer);
          return {
            success: true,
            path: outputPath,
            mimeType: artifact.mimeType,
            model: artifact.model,
            location: artifact.metadata?.location,
            fileSizeBytes: artifact.buffer.length,
            message: `Audio musical cree avec succes a ${outputPath}. Utilise maintenant 'release_file' pour obtenir un lien.`
          };
        }
      },
      {
        name: "create_podcast_episode",
        description: "Fabrique un episode podcast audio complet dans '/tmp/': un script original est prepare, narre via Gemini 2.5 Pro TTS par defaut, puis melange a un fond sonore Lyria quand il est disponible. Le resultat reste un seul master final pret a publier, avec fallback voix seule si le bed ou le mix local sont indisponibles. Gere le single-speaker et le duo a 2 intervenants. Choisis 1 voix pour narration, chronique, flash info, explication ou voix-off. Choisis 2 intervenants pour sketch, interview, duo de presentation, dispute ou conversation, avec 2 voix clairement distinctes et 2 styles de jeu contrastes. Plus de 2 intervenants n'est pas supporte par Gemini TTS multi-speaker. `lyria-002` reste le defaut robuste; les variantes Lyria 3 restent des previews optionnelles. Si tu fournis `script`, il sera narre tel quel.",
        parameters: {
          type: "object",
          properties: {
            brief: { type: "string", description: "Brief haut niveau du podcast si tu veux que Gemini 2.5 Pro TTS cree aussi le texte parle." },
            script: { type: "string", description: "Script exact a narrer si tu veux garder le controle total sur le texte. En duo, utilise des lignes `Nom:` conformes aux `speakers`. Pour les noms propres et mots etrangers, garde l'ecriture du pays d'origine quand cela fluidifie la prononciation." },
            title: { type: "string", description: "Titre de l'episode ou angle editorial." },
            hostStyle: { type: "string", description: "Style de l'animateur ou ton editorial souhaite." },
            styleInstructions: { type: "string", description: "Consignes globales de jeu: ton, rythme, accent, energie, humeur, etc." },
            voice: { type: "string", description: "Voix Gemini TTS pour le mode single-speaker, ex: Kore." },
            speakers: {
              type: "array",
              description: "Configuration exacte des 2 intervenants Gemini TTS. Maximum 2, et le multi-speaker exige exactement 2 objets. Chaque nom doit matcher le script/les labels, avec 2 voix differentes et 2 notes de jeu distinctes.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Nom de l'intervenant tel qu'il apparait dans le script, ex: Simohamed." },
                  voice: { type: "string", description: "Voix Gemini pour cet intervenant, ex: Kore, Puck, Charon." },
                  styleInstructions: { type: "string", description: "Consignes de jeu propres a cet intervenant." }
                },
                required: ["name"]
              }
            },
            languageCode: { type: "string", description: "Locale de narration, ex: fr-FR." },
            ttsModel: { type: "string", description: "Modele TTS explicite, ex: gemini-2.5-pro-tts. Pour 2 intervenants, utilise gemini-2.5-pro-tts ou gemini-2.5-flash-tts; gemini-2.5-flash-lite-preview-tts reste mono." },
            musicPrompt: { type: "string", description: "Prompt musical explicite pour Lyria. Recommande en anglais pour maximiser la qualite." },
            musicModel: { type: "string", description: "Modele Lyria explicite, ex: lyria-002, lyria-3-clip-preview, lyria-3-pro-preview. Garde `lyria-002` comme choix robuste par defaut; utilise Lyria 3 seulement si le besoin le justifie." },
            negativeMusicPrompt: { type: "string", description: "Prompt negatif Lyria optionnel." },
            musicSeed: { type: "number", description: "Seed optionnel Lyria 2." },
            musicSampleCount: { type: "number", description: "Nombre de samples Lyria 2. Le premier sera utilise pour le mix final." },
            musicLocation: { type: "string", description: "Region Vertex explicite pour Lyria 2 si besoin." },
            introSeconds: { type: "number", description: "Intro musicale avant la voix. Defaut: environ 1.2s." },
            outroSeconds: { type: "number", description: "Outro musicale apres la voix. Defaut: environ 1.6s." },
            musicVolume: { type: "number", description: "Volume relatif du fond musical entre 0.02 et 0.6. Defaut renforce pour un vrai bed audible sous la voix." },
            approxDurationSeconds: { type: "number", description: "Cible indicative de duree si le texte doit etre cree a partir du brief." },
            outputExtension: { type: "string", enum: ["mp3", "wav"], description: "Format prefere pour le master final. MP3 par defaut si le moteur de mix/encodage local le permet." },
            filename: { type: "string", description: "Nom de fichier optionnel dans /tmp/ pour le mix final." }
          }
        },
        execute: async ({
          brief,
          script,
          title,
          hostStyle,
          styleInstructions,
          voice,
          speakers,
          languageCode,
          ttsModel,
          musicPrompt,
          musicModel,
          negativeMusicPrompt,
          musicSeed,
          musicSampleCount,
          musicLocation,
          introSeconds,
          outroSeconds,
          musicVolume,
          approxDurationSeconds,
          outputExtension,
          filename
        }: {
          brief?: string;
          script?: string;
          title?: string;
          hostStyle?: string;
          styleInstructions?: string;
          voice?: string;
          speakers?: Array<{ name: string; voice?: string; styleInstructions?: string }>;
          languageCode?: string;
          ttsModel?: string;
          musicPrompt?: string;
          musicModel?: string;
          negativeMusicPrompt?: string;
          musicSeed?: number;
          musicSampleCount?: number;
          musicLocation?: string;
          introSeconds?: number;
          outroSeconds?: number;
          musicVolume?: number;
          approxDurationSeconds?: number;
          outputExtension?: 'mp3' | 'wav';
          filename?: string;
        }) => {
          if (!String(brief || '').trim() && !String(script || '').trim()) {
            return {
              success: false,
              recoverable: true,
              error: "Fournis au moins un `brief` ou un `script` pour creer le podcast."
            };
          }
          if (Array.isArray(speakers) && speakers.length > 0 && speakers.length !== MAX_GEMINI_TTS_MULTI_SPEAKERS) {
            return {
              success: false,
              recoverable: true,
              error: `Le mode podcast multi-speaker Gemini exige exactement ${MAX_GEMINI_TTS_MULTI_SPEAKERS} intervenants. Utilise soit 1 narrateur, soit 2 speakers exacts.`
            };
          }

          const episode = await generatePodcastEpisode({
            brief,
            script,
            title,
            hostStyle,
            styleInstructions,
            voice,
            speakers,
            languageCode,
            ttsModel,
            musicPrompt,
            musicModel,
            negativeMusicPrompt,
            musicSeed,
            musicSampleCount,
            musicLocation,
            introSeconds,
            outroSeconds,
            musicVolume,
            approxDurationSeconds,
            outputExtension,
          });

          const outputPath = buildGeneratedArtifactPath('cowork-podcast', episode.finalArtifact.fileExtension, filename);
          fs.writeFileSync(outputPath, episode.finalArtifact.buffer);
          return {
            success: true,
            path: outputPath,
            mimeType: episode.finalArtifact.mimeType,
            ttsModel: ttsModel || DEFAULT_PODCAST_TTS_MODEL,
            musicModel: musicModel || DEFAULT_LYRIA_MODEL,
            voice: episode.voiceArtifact.metadata?.voice,
            speakerMode: episode.voiceArtifact.metadata?.speakerMode,
            speakerNames: episode.voiceArtifact.metadata?.speakerNames,
            speakerVoices: episode.voiceArtifact.metadata?.speakerVoices,
            languageCode: episode.voiceArtifact.metadata?.languageCode,
            durationSeconds: Number(episode.finalDurationSeconds.toFixed(3)),
            mixStrategy: episode.mixStrategy,
            fileSizeBytes: episode.finalArtifact.buffer.length,
            narrationPromptPreview: clipText(episode.narrationPrompt, 240),
            narrationScriptPreview: clipText(episode.narrationScript, 180),
            musicPromptPreview: clipText(episode.musicPrompt, 200),
            ...(episode.warning ? { warning: episode.warning } : {}),
            message: episode.mixStrategy === 'voice-only'
              ? `Podcast vocal cree a ${outputPath} (fallback voix seule). Utilise maintenant 'release_file' pour obtenir un lien.`
              : `Podcast cree avec succes a ${outputPath} (${episode.mixStrategy}). Utilise maintenant 'release_file' pour obtenir un lien.`
          };
        }
      },
      {
        name: "list_files",
        description: "Liste les fichiers et dossiers dans un rÃƒÂ©pertoire spÃƒÂ©cifique (par dÃƒÂ©faut la racine).",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin relatif ou absolu du dossier ÃƒÂ  lister (ex: /tmp/)." }
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
        description: "Lit le contenu d'un fichier texte spÃƒÂ©cifique du projet.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin relatif du fichier ÃƒÂ  lire." }
          },
          required: ["path"]
        },
        execute: ({ path: filePath }: { path: string }) => {
          const absolutePath = resolveAndValidatePath(filePath);
          if (!fs.existsSync(absolutePath)) throw new Error(`Le fichier ${filePath} n'existe pas.`);
          const content = fs.readFileSync(absolutePath, 'utf-8');
          // Limit content if too large
          return { content: content.length > 20000 ? content.slice(0, 20000) + "... [tronquÃƒÂ©]" : content };
        }
      },
      {
        name: "write_file",
        description: "CrÃƒÂ©e ou modifie un fichier avec le contenu spÃƒÂ©cifiÃƒÂ©.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin relatif du fichier ÃƒÂ  ÃƒÂ©crire." },
            content: { type: "string", description: "Contenu ÃƒÂ  ÃƒÂ©crire dans le fichier." }
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
          return { success: true, message: `Fichier ${filePath} ÃƒÂ©crit avec succÃƒÂ¨s ÃƒÂ  l'emplacement : ${absolutePath}` };
        }
      },
      {
        name: "list_recursive",
        description: "Liste rÃƒÂ©cursivement tous les fichiers ÃƒÂ  partir d'un dossier spÃƒÂ©cifique.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Dossier de dÃƒÂ©part (ex: /tmp/)." }
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
        description: "Recherche le web et renvoie une liste concise de resultats (titre, URL, extrait). Utilise-le pour reperer des pistes, pas pour faire semblant d'avoir lu. Sur un fact-check, un benchmark, une veille, une analyse commerciale/juridique/financiere, une actu multilingue ou un dossier ambitieux, fais souvent plusieurs recherches ciblees puis ouvre les meilleures URLs avec 'web_fetch' avant de conclure. La qualite retournee est un signal informatif pour t'aider a juger si tu dois approfondir, changer d'angle ou lire directement une source.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Requete de recherche precise." },
            maxResults: { type: "number", description: "Nombre maximum de resultats a renvoyer (1-8)." },
            strict: { type: "boolean", description: "Active un matching plus strict si tu veux verifier un sujet sensible ou tres precis." },
            topic: { type: "string", description: "Topic Tavily optionnel: general ou news." },
            searchDepth: { type: "string", description: "Profondeur optionnelle: basic ou advanced." },
            timeRange: { type: "string", description: "Fenetre news optionnelle: day ou week." },
            includeDomains: {
              type: "array",
              description: "Liste optionnelle de domaines fiables a privilegier.",
              items: { type: "string" }
            },
            directSourceUrls: {
              type: "array",
              description: "URLs directes optionnelles a remonter comme pistes de lecture.",
              items: { type: "string" }
            }
          },
          required: ["query"]
        },
        execute: async ({
          query,
          maxResults,
          strict,
          topic,
          searchDepth,
          timeRange,
          includeDomains,
          directSourceUrls
        }: {
          query: string;
          maxResults?: number;
          strict?: boolean;
          topic?: TavilyTopic;
          searchDepth?: TavilySearchDepth;
          timeRange?: 'day' | 'week';
          includeDomains?: string[];
          directSourceUrls?: string[];
        }) => {
          const outcome = await searchWeb(
            query,
            Math.max(1, Math.min(maxResults || 5, 8)),
            {
              strict,
              topic,
              searchDepth,
              timeRange,
              includeDomains,
              directSourceUrls
            }
          );
          const resultCount = outcome.results.length;
          return {
            success: outcome.success,
            query,
            provider: outcome.provider,
            searchMode: outcome.searchMode,
            quality: outcome.quality,
            relevanceScore: outcome.relevanceScore,
            matchedAnchors: outcome.matchedAnchors,
            fallbackUsed: outcome.fallbackUsed,
            directSourceUrls: outcome.directSourceUrls,
            ...(outcome.searchDisabledReason ? { searchDisabledReason: outcome.searchDisabledReason } : {}),
            warnings: outcome.warnings,
            results: outcome.results,
            ...(outcome.error ? { error: outcome.error } : {}),
            message: `${resultCount} piste(s) reperee(s) pour "${query}" via ${outcome.provider}. Ce ne sont pas encore des sources lues. Qualite: ${outcome.quality}. Mode: ${outcome.searchMode}.${outcome.directSourceUrls.length > 0 ? ` Sources directes a ouvrir: ${outcome.directSourceUrls.slice(0, 3).join(' | ')}.` : ''}`
          };
        }
      }, {
        name: "web_fetch",
        description: "Ouvre une URL et renvoie son titre et son contenu nettoye. C'est l'outil de lecture et de verification directe: utilise-le apres 'web_search' pour lire les pages les plus solides, confirmer des chiffres, comparer plusieurs sources, ou exploiter une source dans une autre langue avant restitution.",
        parameters: {
          type: "object",
          properties: {
            url: { type: "string", description: "URL complete a ouvrir." },
            contextQuery: { type: "string", description: "Contexte explicite optionnel pour evaluer la pertinence de la page." },
            strict: { type: "boolean", description: "Active un matching plus strict sur la pertinence de la page." }
          },
          required: ["url"]
        },
        execute: async ({ url, contextQuery, strict }: { url: string; contextQuery?: string; strict?: boolean }) => {
          const page = await fetchReadableUrl(url, contextQuery || lastSuccessfulSearchQuery || undefined, { strict });
          return {
            success: true,
            ...page,
            message: `Source lue avec succes: ${page.title} (${page.quality}/${page.relevance}).`
          };
        }
      }] : []),
      {
        name: "begin_pdf_draft",
        description: "Initialise ou reinitialise un brouillon PDF persistant pour cette session Cowork. Pour un PDF premium, editorial ou tres thematique, prefere `engine='latex'`. Chaque section peut porter `visualTheme`, `mood`, `motif`, `flagHints`, `pageStyle` et `pageBreakBefore`. Si tu fournis `latexSource`, le brouillon devient le vrai source .tex compile.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Nom de base du futur fichier PDF (sans chemin). Optionnel." },
            title: { type: "string", description: "Titre principal du document." },
            subtitle: { type: "string", description: "Sous-titre ou chapo initial (optionnel)." },
            summary: { type: "string", description: "Resume executif initial (optionnel)." },
            author: { type: "string", description: "Auteur ou signataire (optionnel)." },
            engine: { type: "string", description: "Moteur PDF: auto, pdfkit ou latex." },
            compiler: { type: "string", description: "Compilateur LaTeX: xelatex, pdflatex ou lualatex. Utilise xelatex par defaut." },
            latexSource: { type: "string", description: "Source .tex complete si tu veux piloter toi-meme le document LaTeX." },
            theme: { type: "string", description: "Theme de mise en page: legal, news ou report." },
            accentColor: { type: "string", description: "Couleur d'accent optionnelle HEX." },
            sources: {
              type: "array",
              description: "Sources initiales a associer au brouillon.",
              items: { type: "string" }
            },
            sections: {
              type: "array",
              description: "Sections initiales optionnelles du brouillon. En LaTeX premium, tu peux donner une vraie direction artistique par section.",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Titre de la section." },
                  body: { type: "string", description: "Contenu de la section." },
                  visualTheme: { type: "string", description: "Theme visuel libre pour cette section/page: ex. arbres, guerre, football, world cup, finance, climat." },
                  accentColor: { type: "string", description: "Couleur d'accent HEX optionnelle propre a cette section." },
                  mood: { type: "string", description: "Ambiance editoriale: ex. dramatique, serein, stade en feu, contemplatif." },
                  motif: { type: "string", description: "Motif ou dessin a evoquer: ex. canopee, ballon, trophee, lignes de front, feuilles, chandeliers boursiers." },
                  pageStyle: { type: "string", description: "Style de page: standard, feature ou hero." },
                  pageBreakBefore: { type: "boolean", description: "Force un saut de page avant cette section." },
                  flagHints: {
                    type: "array",
                    description: "Pays ou drapeaux a afficher si pertinents pour cette section.",
                    items: { type: "string" }
                  }
                }
              }
            }
          },
          required: ["title"]
        },
        execute: async ({
          filename,
          title,
          subtitle,
          summary,
          author,
          engine,
          compiler,
          latexSource,
          theme,
          accentColor,
          sources,
          sections
        }: {
          filename?: string;
          title: string;
          subtitle?: string;
          summary?: string;
          author?: string;
          engine?: string;
          compiler?: string;
          latexSource?: string;
          theme?: string;
          accentColor?: string;
          sources?: string[];
          sections?: PdfSectionInput[];
        }) => {
          const nextDraft = createActivePdfDraft(message, {
            filename,
            title,
            subtitle,
            summary,
            author,
            engine,
            compiler,
            latexSource,
            theme,
            accentColor,
            sources,
            sections
          }, pdfQualityTargets, requestClock);
          applyActivePdfDraft(nextDraft, { invalidateArtifacts: true });
          const draft = buildPdfDraftStats(nextDraft);
          const capMessage = buildPdfLengthCapMessage(draft.targetWords, draft.requestedWordCount, draft.cappedWords);
          return {
            success: true,
            draft,
            engine: draft.engine,
            compiler: draft.compiler,
            theme: draft.theme,
            signature: draft.signature,
            wordCount: draft.wordCount,
            sectionCount: draft.sectionCount,
            sourceMode: draft.sourceMode,
            message: [
              `Brouillon PDF initialise avec le moteur '${draft.engine}'${draft.compiler ? `/${draft.compiler}` : ''} et le theme '${nextDraft.theme}'.`,
              capMessage
            ].filter(Boolean).join(' ')
          };
        }
      },
      {
        name: "append_to_draft",
        description: "Ajoute du contenu au brouillon PDF persistant. En mode LaTeX, tu peux soit fournir un `latexSource` complet, soit enrichir le document courant avec des sections visuellement dirigees (`visualTheme`, `mood`, `motif`, `flagHints`, `pageStyle`, `pageBreakBefore`).",
        parameters: {
          type: "object",
          properties: {
            subtitle: { type: "string", description: "Met a jour le sous-titre du brouillon (optionnel)." },
            summary: { type: "string", description: "Met a jour le resume executif du brouillon (optionnel)." },
            author: { type: "string", description: "Met a jour l'auteur/signataire (optionnel)." },
            engine: { type: "string", description: "Moteur PDF: auto, pdfkit ou latex." },
            compiler: { type: "string", description: "Compilateur LaTeX a utiliser si le moteur vaut 'latex'." },
            latexSource: { type: "string", description: "Source .tex complete remplaÃƒÂ§ant le document courant." },
            theme: { type: "string", description: "Theme de mise en page: legal, news ou report." },
            accentColor: { type: "string", description: "Couleur d'accent optionnelle HEX." },
            filename: { type: "string", description: "Nom de base du futur fichier PDF (optionnel)." },
            sources: {
              type: "array",
              description: "Sources supplementaires a ajouter au brouillon.",
              items: { type: "string" }
            },
            sections: {
              type: "array",
              description: "1 a 2 nouvelles sections a ajouter au brouillon avec, si besoin, leur propre ambiance visuelle.",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Titre de la section." },
                  body: { type: "string", description: "Contenu de la section." },
                  visualTheme: { type: "string", description: "Theme visuel libre pour cette section/page." },
                  accentColor: { type: "string", description: "Couleur d'accent HEX optionnelle propre a cette section." },
                  mood: { type: "string", description: "Ambiance editoriale de la section." },
                  motif: { type: "string", description: "Motif graphique a evoquer dans le rendu." },
                  pageStyle: { type: "string", description: "Style de page: standard, feature ou hero." },
                  pageBreakBefore: { type: "boolean", description: "Force un saut de page avant cette section." },
                  flagHints: {
                    type: "array",
                    description: "Pays ou drapeaux a afficher si pertinents pour cette section.",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        },
        execute: async ({
          subtitle,
          summary,
          author,
          engine,
          compiler,
          latexSource,
          theme,
          accentColor,
          filename,
          sources,
          sections
        }: {
          subtitle?: string;
          summary?: string;
          author?: string;
          engine?: string;
          compiler?: string;
          latexSource?: string;
          theme?: string;
          accentColor?: string;
          filename?: string;
          sources?: string[];
          sections?: PdfSectionInput[];
        }) => {
          const currentDraft = requireActivePdfDraft();
          if (!currentDraft) {
            return {
              success: false,
              recoverable: true,
              error: "Aucun brouillon PDF actif. Commence d'abord par 'begin_pdf_draft'."
            };
          }
          if ((!Array.isArray(sections) || sections.length === 0) && !summary && !subtitle && !author && !theme && !accentColor && !filename && (!Array.isArray(sources) || sources.length === 0)) {
            return {
              success: false,
              recoverable: true,
              error: "Ajoute au moins une section, une source ou une mise a jour de meta avec 'append_to_draft'."
            };
          }
          if (
            currentDraft.engine === 'latex'
            && currentDraft.sourceMode === 'raw'
            && !latexSource?.trim()
            && (summary || subtitle || author || theme || accentColor)
          ) {
            return {
              success: false,
              recoverable: true,
              error: "Ce brouillon LaTeX est en mode source libre. Pour changer summary/subtitle/author/theme/accentColor, renvoie un 'latexSource' complet mis a jour."
            };
          }

          const nextDraft = appendToActivePdfDraft(message, currentDraft, {
            subtitle,
            summary,
            author,
            engine,
            compiler,
            latexSource,
            theme,
            accentColor,
            filename,
            sources,
            sections
          }, requestClock);
          applyActivePdfDraft(nextDraft, { invalidateArtifacts: true });
          const draft = buildPdfDraftStats(nextDraft);
          const capMessage = buildPdfLengthCapMessage(draft.targetWords, draft.requestedWordCount, draft.cappedWords);
          return {
            success: true,
            draft,
            engine: draft.engine,
            compiler: draft.compiler,
            theme: draft.theme,
            signature: draft.signature,
            wordCount: draft.wordCount,
            sectionCount: draft.sectionCount,
            sourceMode: draft.sourceMode,
            message: [
              `${Array.isArray(sections) ? sections.length : 0} section(s) ajoutee(s). Le brouillon contient maintenant ${draft.wordCount} mots et ${draft.sectionCount} section(s).`,
              capMessage
            ].filter(Boolean).join(' ')
          };
        }
      },
      {
        name: "revise_pdf_draft",
        description: "Retravaille le brouillon PDF persistant sans te limiter a l'append. Utilise-le pour reecrire, remplacer des sections, restructurer le plan, changer le titre ou remplacer toute l'ossature avant export. Si tu fournis `sections`, elles remplacent la structure courante; si tu fournis `sectionOperations`, elles s'appliquent dans l'ordre avec des index 1-based. En mode LaTeX source libre, fournis un `latexSource` complet mis a jour pour toute vraie revision.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Remplace le titre principal du brouillon." },
            subtitle: { type: "string", description: "Remplace le sous-titre ou chapo du brouillon." },
            summary: { type: "string", description: "Remplace le resume executif du brouillon." },
            author: { type: "string", description: "Remplace l'auteur/signataire du brouillon." },
            engine: { type: "string", description: "Moteur PDF: auto, pdfkit ou latex." },
            compiler: { type: "string", description: "Compilateur LaTeX a utiliser si le moteur vaut 'latex'." },
            latexSource: { type: "string", description: "Source .tex complete remplacant le document courant." },
            theme: { type: "string", description: "Theme de mise en page: legal, news ou report." },
            accentColor: { type: "string", description: "Couleur d'accent optionnelle HEX." },
            filename: { type: "string", description: "Nom de base du futur fichier PDF (optionnel)." },
            sourcesMode: { type: "string", description: "Gestion des sources fournies: append ou replace." },
            sources: {
              type: "array",
              description: "Sources mises a jour pour le brouillon. Avec `sourcesMode='replace'`, cette liste remplace les sources courantes.",
              items: { type: "string" }
            },
            sections: {
              type: "array",
              description: "Nouvelle liste complete de sections si tu veux remplacer toute l'ossature actuelle.",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Titre de la section." },
                  body: { type: "string", description: "Contenu de la section." },
                  visualTheme: { type: "string", description: "Theme visuel libre pour cette section/page." },
                  accentColor: { type: "string", description: "Couleur d'accent HEX optionnelle propre a cette section." },
                  mood: { type: "string", description: "Ambiance editoriale de la section." },
                  motif: { type: "string", description: "Motif graphique a evoquer dans le rendu." },
                  pageStyle: { type: "string", description: "Style de page: standard, feature ou hero." },
                  pageBreakBefore: { type: "boolean", description: "Force un saut de page avant cette section." },
                  flagHints: {
                    type: "array",
                    description: "Pays ou drapeaux a afficher si pertinents pour cette section.",
                    items: { type: "string" }
                  }
                }
              }
            },
            sectionOperations: {
              type: "array",
              description: "Operations de revision appliquees dans l'ordre. Les index sont 1-based.",
              items: {
                type: "object",
                properties: {
                  action: { type: "string", description: "Action: replace, remove, insert_before, insert_after, append." },
                  index: { type: "number", description: "Index 1-based de la section cible si l'action en a besoin." },
                  section: {
                    type: "object",
                    description: "Section complete a inserer ou utiliser pour un remplacement.",
                    properties: {
                      heading: { type: "string", description: "Titre de la section." },
                      body: { type: "string", description: "Contenu de la section." },
                      visualTheme: { type: "string", description: "Theme visuel libre pour cette section/page." },
                      accentColor: { type: "string", description: "Couleur d'accent HEX optionnelle propre a cette section." },
                      mood: { type: "string", description: "Ambiance editoriale de la section." },
                      motif: { type: "string", description: "Motif graphique a evoquer dans le rendu." },
                      pageStyle: { type: "string", description: "Style de page: standard, feature ou hero." },
                      pageBreakBefore: { type: "boolean", description: "Force un saut de page avant cette section." },
                      flagHints: {
                        type: "array",
                        description: "Pays ou drapeaux a afficher si pertinents pour cette section.",
                        items: { type: "string" }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        execute: async ({
          title,
          subtitle,
          summary,
          author,
          engine,
          compiler,
          latexSource,
          theme,
          accentColor,
          filename,
          sourcesMode,
          sources,
          sections,
          sectionOperations
        }: {
          title?: string;
          subtitle?: string;
          summary?: string;
          author?: string;
          engine?: string;
          compiler?: string;
          latexSource?: string;
          theme?: string;
          accentColor?: string;
          filename?: string;
          sourcesMode?: string;
          sources?: string[];
          sections?: PdfSectionInput[];
          sectionOperations?: PdfDraftSectionOperationInput[];
        }) => {
          const currentDraft = requireActivePdfDraft();
          if (!currentDraft) {
            return {
              success: false,
              recoverable: true,
              error: "Aucun brouillon PDF actif. Commence d'abord par 'begin_pdf_draft'."
            };
          }

          const hasChanges =
            title !== undefined
            || subtitle !== undefined
            || summary !== undefined
            || author !== undefined
            || engine !== undefined
            || compiler !== undefined
            || Boolean(latexSource?.trim())
            || theme !== undefined
            || accentColor !== undefined
            || filename !== undefined
            || sourcesMode !== undefined
            || Array.isArray(sources)
            || Array.isArray(sections)
            || (Array.isArray(sectionOperations) && sectionOperations.length > 0);
          if (!hasChanges) {
            return {
              success: false,
              recoverable: true,
              error: "Donne au moins une vraie revision: meta, sections completes, operations de section, sources ou un latexSource mis a jour."
            };
          }

          try {
            const nextDraft = reviseActivePdfDraft(message, currentDraft, {
              title,
              subtitle,
              summary,
              author,
              engine,
              compiler,
              latexSource,
              theme,
              accentColor,
              filename,
              sourcesMode,
              sources,
              sections,
              sectionOperations
            }, requestClock);
            applyActivePdfDraft(nextDraft, { invalidateArtifacts: true });
            const draft = buildPdfDraftStats(nextDraft);
            const capMessage = buildPdfLengthCapMessage(draft.targetWords, draft.requestedWordCount, draft.cappedWords);
            return {
              success: true,
              draft,
              engine: draft.engine,
              compiler: draft.compiler,
              theme: draft.theme,
              signature: draft.signature,
              wordCount: draft.wordCount,
              sectionCount: draft.sectionCount,
              sourceMode: draft.sourceMode,
              message: [
                `Brouillon revise. Il contient maintenant ${draft.wordCount} mots et ${draft.sectionCount} section(s).`,
                capMessage
              ].filter(Boolean).join(' ')
            };
          } catch (error: any) {
            return {
              success: false,
              recoverable: Boolean(error?.recoverable),
              error: error?.message || "Revision du brouillon impossible."
            };
          }
        }
      },
      {
        name: "get_pdf_draft",
        description: "Relit l'etat courant du brouillon PDF persistant: moteur, compilateur, signature, statut de review, apercu de sections et, en mode LaTeX, preview du source .tex.",
        parameters: {
          type: "object",
          properties: {
            includeBodies: { type: "boolean", description: "Inclure un apercu textuel court des sections." }
          }
        },
        execute: async ({ includeBodies }: { includeBodies?: boolean }) => {
          const currentDraft = requireActivePdfDraft();
          if (!currentDraft) {
            return {
              success: false,
              recoverable: true,
              error: "Aucun brouillon PDF actif a relire."
            };
          }
          const draft = buildPdfDraftStats(currentDraft);
          return {
            success: true,
            draft,
            engine: draft.engine,
            compiler: draft.compiler,
            signature: draft.signature,
            theme: draft.theme,
            wordCount: draft.wordCount,
            sectionCount: draft.sectionCount,
            sourceMode: draft.sourceMode,
            title: currentDraft.title,
            subtitle: currentDraft.subtitle,
            summary: clipText(currentDraft.summary || '', 220),
            sectionsPreview: currentDraft.sections.slice(0, 8).map((section, index) => ({
              index: index + 1,
              heading: section.heading || null,
              visualTheme: section.visualTheme || null,
              motif: section.motif || null,
              mood: section.mood || null,
              pageStyle: section.pageStyle || null,
              flagHints: section.flagHints || [],
              preview: includeBodies ? clipText(section.body, 220) : undefined
            })),
            sourcePreview: currentDraft.engine === 'latex'
              ? clipText(currentDraft.latexSource || '', includeBodies ? 2400 : 900)
              : undefined,
            cacheHit: Boolean(latestApprovedPdfRenderCache && latestApprovedPdfRenderCache.signature === draft.signature),
            alreadyCreated: Boolean(latestCreatedPdfArtifact && latestCreatedPdfArtifact.signature === draft.signature),
            message: `Brouillon courant: ${draft.wordCount} mots, ${draft.sectionCount} section(s), moteur '${draft.engine}'${draft.compiler ? `/${draft.compiler}` : ''}, theme '${draft.theme}'.`
          };
        }
      },
      {
        name: "review_pdf_draft",
        description: "Relit un brouillon de PDF avant export. En mode LaTeX, tente une vraie compilation externe du source .tex exact, remonte le log utile et met en cache le PDF si la review est approuvee.",
        parameters: {
          type: "object",
          properties: {
            useActiveDraft: { type: "boolean", description: "Utiliser le brouillon PDF persistant courant. Recommande pour les PDF longs." },
            title: { type: "string", description: "Titre principal du document." },
            subtitle: { type: "string", description: "Sous-titre ou chapo du document (optionnel)." },
            summary: { type: "string", description: "Resume executif ou introduction mise en avant (optionnel)." },
            author: { type: "string", description: "Auteur ou signataire pressenti (optionnel)." },
            engine: { type: "string", description: "Moteur PDF: auto, pdfkit ou latex." },
            compiler: { type: "string", description: "Compilateur LaTeX a utiliser si le moteur vaut 'latex'." },
            latexSource: { type: "string", description: "Source .tex complete a reviewer/compiler." },
            sources: {
              type: "array",
              description: "Liste optionnelle de sources ou liens a afficher en fin de document.",
              items: { type: "string" }
            },
            sections: {
              type: "array",
              description: "Liste de sections du document. Chaque section peut aussi porter une DA locale pour le rendu LaTeX premium.",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Titre de la section (optionnel)." },
                  body: { type: "string", description: "Contenu texte de la section." },
                  visualTheme: { type: "string", description: "Theme visuel libre pour cette section/page." },
                  accentColor: { type: "string", description: "Couleur d'accent HEX optionnelle propre a cette section." },
                  mood: { type: "string", description: "Ambiance editoriale de la section." },
                  motif: { type: "string", description: "Motif graphique a evoquer dans le rendu." },
                  pageStyle: { type: "string", description: "Style de page: standard, feature ou hero." },
                  pageBreakBefore: { type: "boolean", description: "Force un saut de page avant cette section." },
                  flagHints: {
                    type: "array",
                    description: "Pays ou drapeaux a afficher si pertinents pour cette section.",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        },
        execute: async ({
          useActiveDraft,
          title,
          subtitle,
          summary,
          author,
          engine,
          compiler,
          latexSource,
          sources,
          sections
        }: {
          useActiveDraft?: boolean;
          title?: string;
          subtitle?: string;
          summary?: string;
          author?: string;
          engine?: string;
          compiler?: string;
          latexSource?: string;
          sources?: string[];
          sections?: PdfSectionInput[];
        }) => {
          const shouldUseActiveDraft = useActiveDraft !== false && (!title || !Array.isArray(sections) || sections.length === 0);
          const currentDraft = shouldUseActiveDraft ? requireActivePdfDraft() : null;
          if (shouldUseActiveDraft && !currentDraft) {
            return {
              success: false,
              recoverable: true,
              error: "Aucun brouillon PDF actif. Commence par 'begin_pdf_draft' ou fournis un brouillon inline a 'review_pdf_draft'."
            };
          }

          const effectiveEngine = resolvePdfEngine(message, {
            explicitEngine: engine || currentDraft?.engine,
            pdfQualityTargets,
            theme: currentDraft?.theme
          });
          const effectiveCompiler = effectiveEngine === 'latex'
            ? normalizeLatexCompiler(compiler || currentDraft?.compiler || 'xelatex')
            : null;
          const effectiveLatexSource = effectiveEngine === 'latex'
            ? (
                latexSource?.trim()
                || currentDraft?.latexSource
                || buildPdfDraftLatexSource(buildPdfDraftSnapshot({
                  title,
                  subtitle,
                  summary,
                  author,
                  sources,
                  sections
                }), {
                  compiler: effectiveCompiler,
                  theme: currentDraft?.theme || normalizePdfTheme(undefined, pdfQualityTargets?.theme || 'report'),
                  accentColor: currentDraft?.accentColor,
                  requestClock
                })
              )
            : null;
          const effectiveDraft = currentDraft
            ? buildPdfDraftSnapshot({
                title: title || currentDraft.title || (effectiveLatexSource ? extractLatexCommandValue(effectiveLatexSource, 'title') : ''),
                subtitle: subtitle ?? currentDraft.subtitle,
                summary: summary ?? currentDraft.summary,
                author: (author ?? currentDraft.author) || (effectiveLatexSource ? extractLatexCommandValue(effectiveLatexSource, 'author') : ''),
                sources: sources ?? currentDraft.sources,
                sections: Array.isArray(sections) && sections.length > 0 ? sections : currentDraft.sections
              })
            : buildPdfDraftSnapshot({
                title: title || (effectiveLatexSource ? extractLatexCommandValue(effectiveLatexSource, 'title') : ''),
                subtitle,
                summary,
                author: author || (effectiveLatexSource ? extractLatexCommandValue(effectiveLatexSource, 'author') : ''),
                sources,
                sections
              });

          if (!effectiveDraft.title || (effectiveEngine !== 'latex' && effectiveDraft.sections.length === 0)) {
            return {
              success: false,
              recoverable: true,
              error: "La review PDF a besoin d'un titre et d'au moins une section utile."
            };
          }

          let review = effectiveEngine === 'latex' && effectiveLatexSource
            ? buildLatexAwarePdfReview({
                message,
                draft: effectiveDraft,
                pdfQualityTargets,
                latexSource: effectiveLatexSource,
                compiler: effectiveCompiler
              })
            : reviewPdfDraft(message, effectiveDraft, pdfQualityTargets, {
                engine: effectiveEngine,
                compiler: effectiveCompiler
              });

          if (effectiveEngine === 'latex' && effectiveLatexSource && review.ready) {
            const compileResult = await compileLatexDocument({
              source: effectiveLatexSource,
              compiler: effectiveCompiler,
              provider: process.env.LATEX_RENDER_PROVIDER,
              baseUrl: process.env.LATEX_RENDER_BASE_URL,
              timeoutMs: Number(process.env.LATEX_RENDER_TIMEOUT_MS || 30000),
            });
            if (!compileResult.success) {
              const compileFailure = compileResult as LatexCompileFailure;
              review = finalizePdfDraftReview({
                signature: review.signature,
                engine: 'latex',
                compiler: effectiveCompiler,
                totalWords: review.totalWords,
                sectionCount: review.sectionCount,
                blockingIssues: [...review.blockingIssues, `la compilation LaTeX echoue: ${clipText(compileFailure.error, 220)}`],
                improvements: review.improvements,
                strengths: review.strengths,
                compileLogPreview: clipText(compileFailure.compileLog || compileFailure.error, 700),
                provider: compileFailure.provider,
              });
            } else {
              latestApprovedPdfRenderCache = {
                signature: review.signature,
                engine: 'latex',
                compiler: effectiveCompiler,
                provider: compileResult.provider,
                pdfBase64: compileResult.pdfBuffer.toString('base64'),
                compileLog: compileResult.compileLog,
              };
              review = {
                ...review,
                compileLogPreview: clipText(compileResult.compileLog || 'Compilation LaTeX reussie.', 700),
                cacheHit: true,
                provider: compileResult.provider,
              };
            }
          } else if (effectiveEngine !== 'latex') {
            latestApprovedPdfRenderCache = null;
          }

          if (currentDraft) {
            applyActivePdfDraft({
              ...currentDraft,
              compiler: effectiveCompiler,
              latexSource: effectiveLatexSource ?? currentDraft.latexSource,
              approvedReviewSignature: review.ready ? review.signature : null
            });
          } else if (review.ready) {
            latestApprovedPdfReviewSignature = review.signature;
          } else {
            latestApprovedPdfReviewSignature = null;
            latestApprovedPdfRenderCache = null;
          }
          const capMessage = currentDraft
            ? buildPdfLengthCapMessage(currentDraft.targetWords, currentDraft.requestedWordCount, currentDraft.cappedWords)
            : buildPdfLengthCapMessage(pdfQualityTargets?.minWords || 0, pdfQualityTargets?.requestedWordCount ?? null, Boolean(pdfQualityTargets?.cappedWordCount));
          return {
            ...review,
            engine: review.engine,
            compiler: review.compiler,
            ...(currentDraft ? { draft: buildPdfDraftStats(requireActivePdfDraft() as ActivePdfDraft) } : {}),
            ...(capMessage ? { note: capMessage } : {})
          };
        }
      },
      {
        name: "release_file",
        description: "Upload de faÃƒÂ§on sÃƒÂ©curisÃƒÂ©e un fichier vers le cloud et gÃƒÂ©nÃƒÂ¨re un lien de tÃƒÂ©lÃƒÂ©chargement public (valable 7 jours). Ãƒâ‚¬ utiliser aprÃƒÂ¨s avoir crÃƒÂ©ÃƒÂ© un fichier (ex: PDF, rapport) que l'utilisateur doit uvoir tÃƒÂ©lÃƒÂ©charger.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin relatif du fichier local ÃƒÂ  uploader." }
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
          return { success: true, url, message: `Fichier ${filePath} uploadÃƒÂ© avec succÃƒÂ¨s. Voici le lien de tÃƒÂ©lÃƒÂ©chargement.` };
        }
      },
      {
        name: "create_pdf",
        description: "Cree un fichier PDF directement. Pour un rendu premium, editorial ou tres thematique, prefere `engine='latex'`. En mode 'latex', l'outil compile un vrai source .tex via un provider HTTP externe compatible YtoTech et peut reutiliser le PDF deja compile pendant 'review_pdf_draft'. Le rendu premium supporte une direction artistique par section/page: `visualTheme`, `mood`, `motif`, `flagHints`, `pageStyle`, `pageBreakBefore`.",
        parameters: {
          type: "object",
          properties: {
            useActiveDraft: { type: "boolean", description: "Exporter le brouillon PDF persistant courant." },
            filename: { type: "string", description: "Nom de base du fichier PDF final (sans chemin)." },
            title: { type: "string", description: "Titre principal du document." },
            subtitle: { type: "string", description: "Sous-titre ou chapo du document (optionnel)." },
            summary: { type: "string", description: "Resume executif ou introduction mise en avant (optionnel)." },
            engine: { type: "string", description: "Moteur PDF: auto, pdfkit ou latex." },
            compiler: { type: "string", description: "Compilateur LaTeX si engine=latex (xelatex par defaut)." },
            latexSource: { type: "string", description: "Source .tex complete a compiler si tu ne veux pas exporter le brouillon actif tel quel." },
            theme: { type: "string", description: "Theme de mise en page: legal, news ou report." },
            accentColor: { type: "string", description: "Couleur d'accent HEX (ex: #0f766e)." },
            author: { type: "string", description: "Nom de l'auteur ou de la signature (optionnel)." },
            reviewSignature: { type: "string", description: "Signature exacte retournee par 'review_pdf_draft' pour ce brouillon. Optionnelle; si tu la fournis, elle doit correspondre a la derniere self-review approuvee." },
            sources: {
              type: "array",
              description: "Liste optionnelle de sources ou liens a afficher en fin de document.",
              items: { type: "string" }
            },
            showPageNumbers: { type: "boolean", description: "Afficher les numeros de page dans le pied de page." },
            sections: {
              type: "array",
              description: "Liste de sections inline. Si absente, le brouillon actif est exporte. En LaTeX premium, chaque section peut avoir sa propre ambiance visuelle.",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Titre de la section (optionnel)." },
                  body: { type: "string", description: "Contenu texte de la section." },
                  visualTheme: { type: "string", description: "Theme visuel libre pour cette section/page." },
                  accentColor: { type: "string", description: "Couleur d'accent HEX optionnelle propre a cette section." },
                  mood: { type: "string", description: "Ambiance editoriale de la section." },
                  motif: { type: "string", description: "Motif graphique a evoquer dans le rendu." },
                  pageStyle: { type: "string", description: "Style de page: standard, feature ou hero." },
                  pageBreakBefore: { type: "boolean", description: "Force un saut de page avant cette section." },
                  flagHints: {
                    type: "array",
                    description: "Pays ou drapeaux a afficher si pertinents pour cette section.",
                    items: { type: "string" }
                  }
                }
              }
            }
          }
        },
        execute: async ({
          useActiveDraft,
          filename,
          title,
          subtitle,
          summary,
          engine,
          compiler,
          latexSource,
          theme,
          accentColor,
          author,
          reviewSignature,
          sources,
          showPageNumbers,
          sections
        }: {
          useActiveDraft?: boolean;
          filename?: string;
          title?: string;
          subtitle?: string;
          summary?: string;
          engine?: string;
          compiler?: string;
          latexSource?: string;
          theme?: string;
          accentColor?: string;
          author?: string;
          reviewSignature?: string;
          sources?: string[];
          showPageNumbers?: boolean;
          sections?: PdfSectionInput[];
        }) => {
          const currentDraft = requireActivePdfDraft();
          const shouldUseActiveDraft = useActiveDraft !== false && Boolean(currentDraft) && (!Array.isArray(sections) || sections.length === 0);
          if (useActiveDraft && !currentDraft) {
            return {
              success: false,
              recoverable: true,
              error: "Aucun brouillon PDF actif a exporter. Commence d'abord par 'begin_pdf_draft'."
            };
          }

          const effectiveEngine = resolvePdfEngine(message, {
            explicitEngine: engine || currentDraft?.engine,
            pdfQualityTargets,
            theme: theme || currentDraft?.theme
          });
          const effectiveCompiler = effectiveEngine === 'latex'
            ? normalizeLatexCompiler(compiler || currentDraft?.compiler || 'xelatex')
            : null;
          const rawDraft = shouldUseActiveDraft && currentDraft
            ? buildPdfDraftSnapshot({
                title: title || currentDraft.title,
                subtitle: subtitle ?? currentDraft.subtitle,
                summary: summary ?? currentDraft.summary,
                author: author ?? currentDraft.author,
                sources: sources ?? currentDraft.sources,
                sections: Array.isArray(sections) && sections.length > 0 ? sections : currentDraft.sections
              })
            : buildPdfDraftSnapshot({
                title,
                subtitle,
                summary,
                author,
                sections,
                sources
              });
          const effectiveLatexSource = effectiveEngine === 'latex'
            ? (
                latexSource?.trim()
                || (shouldUseActiveDraft ? currentDraft?.latexSource : null)
                || buildPdfDraftLatexSource(rawDraft, {
                    compiler: effectiveCompiler,
                    theme: normalizePdfTheme(theme, currentDraft?.theme || pdfQualityTargets?.theme || 'report'),
                    accentColor: accentColor || currentDraft?.accentColor,
                    requestClock
                  })
              )
            : null;
          if (effectiveEngine === 'latex' && !effectiveLatexSource) {
            return {
              success: false,
              recoverable: true,
              engine: effectiveEngine,
              compiler: effectiveCompiler,
              error: "Aucun source LaTeX compilable n'a ete fourni."
            };
          }
          const draftForValidation = effectiveEngine === 'latex' && effectiveLatexSource
            ? buildPdfDraftSnapshot({
                title: rawDraft.title || extractLatexCommandValue(effectiveLatexSource, 'title'),
                subtitle: rawDraft.subtitle,
                summary: rawDraft.summary,
                author: rawDraft.author || extractLatexCommandValue(effectiveLatexSource, 'author'),
                sources: rawDraft.sources,
                sections: rawDraft.sections
              })
            : rawDraft;

          const effectiveFilename = sanitizePdfFilenameBase(
            filename
            || currentDraft?.filename
            || draftForValidation.title
            || title
            || 'document-cowork'
          );
          const outputPath = path.join('/tmp', `${effectiveFilename}.pdf`);
          const effectiveTheme = normalizePdfTheme(
            theme,
            currentDraft?.theme || pdfQualityTargets?.theme || 'report'
          );
          const draftForExport = buildPdfDraftSnapshot({
            title: draftForValidation.title || humanizePdfTitle(filename || currentDraft?.filename || effectiveFilename),
            subtitle: draftForValidation.subtitle,
            summary: draftForValidation.summary,
            author: draftForValidation.author,
            sources: draftForValidation.sources,
            sections: draftForValidation.sections.length > 0
              ? draftForValidation.sections
              : buildFallbackPdfSections(draftForValidation)
          });
          const effectiveSections = draftForExport.sections;
          const effectiveSources = draftForExport.sources;
          const draftReview = effectiveEngine === 'latex' && effectiveLatexSource
            ? buildLatexAwarePdfReview({
                message,
                draft: draftForExport,
                pdfQualityTargets,
                latexSource: effectiveLatexSource,
                compiler: effectiveCompiler
              })
            : reviewPdfDraft(message, draftForExport, pdfQualityTargets, {
                engine: effectiveEngine,
                compiler: effectiveCompiler
              });
          const effectiveSignature = draftReview.signature;
          if (effectiveEngine !== 'latex' && effectiveSections.length === 0) {
            return {
              success: false,
              recoverable: true,
              theme: effectiveTheme,
              engine: effectiveEngine,
              compiler: effectiveCompiler,
              error: "Le PDF doit contenir au moins une section non vide."
            };
          }

          const reviewSignatureGate = validateCreatePdfReviewSignature({
            reviewSignature,
            latestApprovedPdfReviewSignature,
            draftReview
          });
          const reviewSignatureWarning = reviewSignatureGate.warning;

          if (
            latestCreatedPdfArtifact
            && latestCreatedPdfArtifact.signature === effectiveSignature
            && fs.existsSync(resolveAndValidatePath(latestCreatedPdfArtifact.path))
          ) {
            if (latestReleasedFile?.path === latestCreatedPdfArtifact.path) {
              return {
                success: false,
                recoverable: true,
                alreadyCreated: true,
                path: latestCreatedPdfArtifact.path,
                engine: latestCreatedPdfArtifact.engine,
                compiler: latestCreatedPdfArtifact.compiler,
                signature: effectiveSignature,
                error: "Ce PDF a deja ete cree et publie. Ne relance pas 'create_pdf': passe directement a la reponse finale avec le lien deja livre."
              };
            }
            latestCreatedArtifactPath = latestCreatedPdfArtifact.path;
            return {
              success: true,
              alreadyCreated: true,
              cacheHit: true,
              path: latestCreatedPdfArtifact.path,
              engine: latestCreatedPdfArtifact.engine,
              compiler: latestCreatedPdfArtifact.compiler,
              signature: effectiveSignature,
              theme: effectiveTheme,
              pageCount: estimatePdfPageCount(fs.readFileSync(resolveAndValidatePath(latestCreatedPdfArtifact.path))),
              blankBodyPageCount: 0,
              usedCoverPage: false,
              message: `Le PDF '${effectiveFilename}.pdf' existe deja a ${latestCreatedPdfArtifact.path}. Utilise maintenant 'release_file' sans relancer la creation.`
            };
          }

          if (effectiveEngine === 'latex' && getPdfCreateFailureCount(effectiveSignature) >= 2) {
            return {
              success: false,
              recoverable: true,
              engine: 'latex',
              compiler: effectiveCompiler,
              signature: effectiveSignature,
              error: "Deux echec(s) consecutifs ont deja eu lieu pour cette meme signature LaTeX. Modifie materiellement le source .tex ou reinitialise avec 'begin_pdf_draft' avant de retenter 'create_pdf'."
            };
          }

          if (effectiveEngine === 'latex' && effectiveLatexSource) {
            const reusedReviewCache = latestApprovedPdfRenderCache?.signature === effectiveSignature;
            let pdfBase64 = reusedReviewCache
              ? latestApprovedPdfRenderCache.pdfBase64
              : null;
            let compileProvider: LatexProvider | undefined = reusedReviewCache
              ? latestApprovedPdfRenderCache.provider
              : undefined;
            let compileLog = reusedReviewCache
              ? latestApprovedPdfRenderCache.compileLog
              : undefined;

            if (!pdfBase64) {
              const compileResult = await compileLatexDocument({
                source: effectiveLatexSource,
                compiler: effectiveCompiler,
                provider: process.env.LATEX_RENDER_PROVIDER,
                baseUrl: process.env.LATEX_RENDER_BASE_URL,
                timeoutMs: Number(process.env.LATEX_RENDER_TIMEOUT_MS || 30000),
              });
              if (!compileResult.success) {
                const compileFailure = compileResult as LatexCompileFailure;
                const failureCount = incrementPdfCreateFailure(effectiveSignature);
                return {
                  success: false,
                  recoverable: true,
                  engine: 'latex',
                  compiler: effectiveCompiler,
                  signature: effectiveSignature,
                  compileLogPreview: clipText(compileFailure.compileLog || compileFailure.error, 700),
                  error: `Compilation LaTeX externe echouee (${failureCount}/2): ${clipText(compileFailure.error, 220)}`
                };
              }
              pdfBase64 = compileResult.pdfBuffer.toString('base64');
              compileProvider = compileResult.provider;
              compileLog = compileResult.compileLog;
              latestApprovedPdfRenderCache = {
                signature: effectiveSignature,
                engine: 'latex',
                compiler: effectiveCompiler,
                provider: compileProvider,
                pdfBase64,
                compileLog,
              };
            }

            clearPdfCreateFailure(effectiveSignature);
            const pdfBuffer = Buffer.from(pdfBase64, 'base64');
            fs.writeFileSync(outputPath, pdfBuffer);
            latestCreatedArtifactPath = outputPath;
            latestCreatedPdfArtifact = {
              signature: effectiveSignature,
              engine: 'latex',
              compiler: effectiveCompiler,
              provider: compileProvider,
              path: outputPath,
              compileLog,
            };
            return {
              success: true,
              path: outputPath,
              pageCount: estimatePdfPageCount(pdfBuffer),
              blankBodyPageCount: 0,
              usedCoverPage: false,
              theme: effectiveTheme,
              engine: 'latex',
              compiler: effectiveCompiler,
              signature: effectiveSignature,
              cacheHit: reusedReviewCache,
              ...(reviewSignatureWarning ? { reviewSignatureWarning } : {}),
              compileLogPreview: clipText(compileLog || 'Compilation LaTeX reussie.', 700),
              message: `PDF '${effectiveFilename}.pdf' cree avec succes a ${outputPath}. Utilise maintenant 'release_file' pour obtenir le lien de telechargement.`
            };
          }

          try {
            const rendered = await renderPdfArtifact({
              outputPath,
              title: draftForExport.title,
              subtitle: draftForExport.subtitle || undefined,
              summary: draftForExport.summary || undefined,
              author: draftForExport.author || undefined,
              accentColor: accentColor || currentDraft?.accentColor,
              showPageNumbers,
              sections: effectiveSections,
              sources: effectiveSources,
              requestClock,
              message,
              pdfQualityTargets,
              theme: effectiveTheme
            });
            const capMessage = currentDraft
              ? buildPdfLengthCapMessage(currentDraft.targetWords, currentDraft.requestedWordCount, currentDraft.cappedWords)
              : buildPdfLengthCapMessage(pdfQualityTargets?.minWords || 0, pdfQualityTargets?.requestedWordCount ?? null, Boolean(pdfQualityTargets?.cappedWordCount));
            latestCreatedArtifactPath = rendered.path;
            latestCreatedPdfArtifact = {
              signature: effectiveSignature,
              engine: 'pdfkit',
              compiler: null,
              path: rendered.path,
            };
            return {
              success: true,
              path: rendered.path,
              pageCount: rendered.pageCount,
              blankBodyPageCount: rendered.blankBodyPageCount,
              usedCoverPage: rendered.usedCoverPage,
              theme: rendered.theme,
              engine: 'pdfkit',
              compiler: null,
              signature: effectiveSignature,
              ...(reviewSignatureWarning ? { reviewSignatureWarning } : {}),
              message: [
                `PDF '${effectiveFilename}.pdf' cree avec succes a ${rendered.path}. Utilise maintenant 'release_file' pour obtenir le lien de telechargement.`,
                capMessage
              ].filter(Boolean).join(' ')
            };
          } catch (error: any) {
            return {
              success: false,
              recoverable: Boolean(error?.recoverable),
              theme: effectiveTheme,
              engine: effectiveEngine,
              compiler: effectiveCompiler,
              error: parseApiError(error)
            };
          }
        }
      },
      {
        name: "create_pdf_legacy_unused",
        description: "CrÃƒÂ©e un fichier PDF directement. Utilise cet outil pour gÃƒÂ©nÃƒÂ©rer des PDFs au lieu d'ÃƒÂ©crire un script Python. 'review_pdf_draft' peut servir de passe qualitÃƒÂ© avant export, mais n'est plus bloquant. Le fichier est crÃƒÂ©ÃƒÂ© dans /tmp/.",
        parameters: {
          type: "object",
          properties: {
            filename: { type: "string", description: "Nom du fichier PDF (ex: rapport.pdf). Sera crÃƒÂ©ÃƒÂ© dans /tmp/." },
            title: { type: "string", description: "Titre principal du document." },
            subtitle: { type: "string", description: "Sous-titre ou chapo du document (optionnel)." },
            summary: { type: "string", description: "Resume executif ou introduction mise en avant (optionnel)." },
            accentColor: { type: "string", description: "Couleur d'accent HEX (ex: #0f766e)." },
            author: { type: "string", description: "Nom de l'auteur ou de la signature (optionnel)." },
            reviewSignature: { type: "string", description: "Signature exacte retournee par 'review_pdf_draft' pour ce brouillon. Optionnelle; si tu la fournis, elle doit correspondre a la derniere self-review approuvee." },
            sources: {
              type: "array",
              description: "Liste optionnelle de sources ou liens a afficher en fin de document.",
              items: { type: "string" }
            },
            showPageNumbers: { type: "boolean", description: "Afficher les numeros de page dans le pied de page." },
            sections: {
              type: "array",
              description: "Liste de sections du document. Chaque section a un 'heading' optionnel et un 'body' (texte ou liste ÃƒÂ  puces sÃƒÂ©parÃƒÂ©es par \\n).",
              items: {
                type: "object",
                properties: {
                  heading: { type: "string", description: "Titre de la section (optionnel)." },
                  body: { type: "string", description: "Contenu texte de la section. Utiliser \\n pour les sauts de ligne. PrÃƒÂ©fixer avec 'Ã¢â‚¬Â¢ ' pour les listes ÃƒÂ  puces." }
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
          reviewSignature,
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
          reviewSignature?: string;
          sources?: string[];
          showPageNumbers?: boolean;
          sections: Array<{ heading?: string, body: string }>;
        }) => {
          return {
            success: false,
            recoverable: true,
            error: "Cet outil legacy est retire. Utilise 'begin_pdf_draft' puis 'create_pdf'."
          };
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
          if (effectiveSections.length === 0) {
            return {
              success: false,
              recoverable: true,
              error: "Le PDF doit contenir au moins une section non vide."
            };
          }

          const reviewSignatureGate = validateCreatePdfReviewSignature({
            reviewSignature,
            latestApprovedPdfReviewSignature,
            draftReview
          });
          const reviewSignatureWarning = reviewSignatureGate.warning;

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
                  if (/^(?:[-*]\s+|Ã¢â‚¬Â¢\s+)/.test(line)) {
                    flushParagraph();
                    renderBullet(line.replace(/^(?:[-*]\s+|Ã¢â‚¬Â¢\s+)/, ''));
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
                    if (line.trim().startsWith('Ã¢â‚¬Â¢') || line.trim().startsWith('-')) {
                      doc.fontSize(11).font('Helvetica').text(line.trim(), { indent: 20 });
                    } else {
                      doc.fontSize(11).font('Helvetica').text(line.trim());
                    }
                  }
                }
                doc.moveDown(1);
              }

              // Footer
              doc.fontSize(8).font('Helvetica-Oblique').text(`GÃƒÂ©nÃƒÂ©rÃƒÂ© par Studio Pro Agent Ã¢â‚¬â€ ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });

              doc.end();

              }

              stream.on('finish', () => {
                resolve({
                  success: true,
                  path: outputPath,
                  ...(reviewSignatureWarning ? { reviewSignatureWarning } : {}),
                  message: `PDF '${filename}' crÃƒÂ©ÃƒÂ© avec succÃƒÂ¨s ÃƒÂ  ${outputPath}. Utilise maintenant 'release_file' pour obtenir le lien de tÃƒÂ©lÃƒÂ©chargement.`
                });
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
        description: "ExÃƒÂ©cute un script Node.js prÃƒÂ©alablement ÃƒÂ©crit sur le disque. ATTENTION : Seul Node.js est disponible dans cet environnement. Python N'EST PAS installÃƒÂ©.",
        parameters: {
          type: "object",
          properties: {
            path: { type: "string", description: "Chemin du script ÃƒÂ  exÃƒÂ©cuter (ex: /tmp/script.js)." },
            language: { type: "string", enum: ["node"], description: "Le langage du script (seul 'node' est supportÃƒÂ©)." }
          },
          required: ["path", "language"]
        },
        execute: async ({ path: filePath, language }: { path: string, language: string }) => {
          if (language === 'python') {
            return { success: false, error: "Python n'est PAS disponible dans cet environnement serveur. Utilise les outils natifs comme 'create_pdf' pour gÃƒÂ©nÃƒÂ©rer des PDFs, ou 'execute_script' avec language='node' pour du JavaScript." };
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

    const visibleLocalTools = localTools.filter(tool => {
      if (tool.name.endsWith('_legacy_unused')) return false;
      if (!runtimeToolAllowList) return true;
      return runtimeToolAllowList.has(tool.name);
    });
    const tools = visibleLocalTools.length > 0 ? [{
      functionDeclarations: visibleLocalTools.map(t => ({
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
      systemInstruction: runtimeAgent
        ? buildAgentRuntimeSystemInstruction(runtimeAgent, {
            requestClock,
            formValues: runtimeAgentFormValues,
          })
        : buildCoworkSystemInstruction(config.systemInstruction, {
            webSearch: webSearchEnabled,
            executeScript: executeScriptEnabled
          }, {
            originalMessage: message,
            requestClock,
            hubAgents: availableHubAgents,
          }, {
            executionMode,
            debugReasoning: COWORK_DEBUG_REASONING
          })
    };
    const thinkingConfig = buildThinkingConfig(modelId, {
      thinkingLevel: config.thinkingLevel || 'high',
      maxThoughtTokens: config.maxThoughtTokens || 4096,
      includeThoughts: Boolean(runtimeAgent) || COWORK_DEBUG_REASONING,
    });
    if (thinkingConfig) {
      genConfig.thinkingConfig = thinkingConfig;
    }
    if (tools) genConfig.tools = tools;

    let contents = await buildModelContentsFromRequest({
      history,
      message,
      attachments,
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    headersSent = true;
    let iterations = 0;
    const FAILSAFE_MAX_ITERATIONS = 50;
    let finalVisibleText = '';
    let finalTextEmitted = false;
    let finalRunState: 'running' | 'completed' | 'failed' | 'aborted' = 'completed';
    let blockedFinalReplyContext: { stopReason: string } | null = null;
    let latestFailureContext: { toolName: string; message: string; iteration: number } | null = null;
    let latestReleasedFile: { url: string; path?: string } | null = null;
    let latestCreatedArtifactPath: string | null = null;
    const runMeta = createEmptyCoworkRunMeta();
    runMeta.mode = executionMode;
    let sessionState = createEmptyCoworkSessionState();

    // LIBERATION: plus de branchement creative_single_turn.
    // Toutes les requetes passent par la boucle universelle avec tous les outils.
    // Le modele decidera seul s'il veut utiliser des outils ou repondre directement.

    const toolFailureScopes = new Map<string, number>();
    const MAX_TOOL_FAILURES = 2;
    const successfulResearchMeta: MusicResearchProgress = {
      webSearches: 0,
      webFetches: 0,
      musicCatalogCompleted: false,
      musicCatalogCoverage: null
    };
    const weakSearchFamilies = new Map<string, number>();
    let lastSearchExactKey: string | null = null;

    const syncRunMeta = () => {
      runMeta.mode = executionMode;
      runMeta.phase = sessionState.phase;
      runMeta.taskComplete = sessionState.effectiveTaskComplete;
      runMeta.searchCount = successfulResearchMeta.webSearches;
      runMeta.fetchCount = successfulResearchMeta.webFetches;
      runMeta.sourcesOpened = sessionState.sourcesValidated.length;
      runMeta.domainsOpened = new Set(sessionState.sourcesValidated.map(source => source.domain).filter(Boolean)).size;
      runMeta.stalledTurns = sessionState.stalledTurns;
      runMeta.artifactState = latestReleasedFile?.url
        ? 'released'
        : latestCreatedArtifactPath
          ? 'created'
          : sessionState.activePdfDraft
            ? 'drafting'
            : 'none';
    };

    const refreshSessionState = () => {
      sessionState = computeCompletionState({
        originalMessage: message,
        requestClock,
        state: sessionState,
        research: successfulResearchMeta,
        latestCreatedArtifactPath,
        latestReleasedFile,
        latestApprovedPdfReviewSignature,
        executionMode
      });
      syncRunMeta();
    };

    const buildProgressFingerprint = () => buildCoworkProgressFingerprint({
      executionMode,
      webSearchCount: successfulResearchMeta.webSearches,
      webFetchCount: successfulResearchMeta.webFetches,
      openedSourceCount: sessionState.sourcesValidated.length,
      openedDomainCount: new Set(sessionState.sourcesValidated.map(source => source.domain).filter(Boolean)).size,
      activePdfDraft: sessionState.activePdfDraft,
      latestApprovedPdfReviewSignature,
      latestCreatedArtifactPath: latestCreatedArtifactPath || null,
      latestReleasedFileUrl: latestReleasedFile?.url || null,
      phase: sessionState.phase,
      modelTaskComplete: sessionState.modelTaskComplete,
      effectiveTaskComplete: sessionState.effectiveTaskComplete,
      pendingFinalAnswer: sessionState.pendingFinalAnswer,
      blockers: sessionState.blockers,
    });

    const registerProgressState = (actionSignature: string) => {
      const fingerprint = buildProgressFingerprint();
      return registerCoworkProgressState(sessionState, fingerprint, actionSignature);
    };

    const handleNoProgress = (actionSignature: string, blockerPrompt?: string | null) => {
      const stalledTurns = registerProgressState(actionSignature);
      if (stalledTurns <= 0) return false;

      const message =
        stalledTurns === 1
          ? "Aucun progres concret sur ce tour. Passe a une vraie action utile ou change d'angle."
          : stalledTurns === 2
            ? "Toujours aucun progres concret. La prochaine repetition similaire arretera proprement la boucle."
            : "Je m'arrete proprement: Cowork tourne sans progres concret. Je coupe la boucle au lieu de consommer d'autres appels modele.";

      emitEvent('warning', {
        iteration: iterations,
        title: 'Aucun progres',
        message,
        meta: { stalledTurns, action: clipText(actionSignature, 120) },
        runMeta
      });

      if (stalledTurns >= 3) {
        const enrichedStopReason = latestFailureContext && (iterations - latestFailureContext.iteration) <= 2
          ? `Echec repete de ${latestFailureContext.toolName}: ${latestFailureContext.message}`
          : message;
        blockedFinalReplyContext = {
          stopReason: enrichedStopReason
        };
        finalRunState = 'failed';
        return true;
      }

      return false;
    };

    const emitBlockedFinalModelReply = async (stopReason: string) => {
      finalRunState = 'failed';
      emitEvent('status', {
        iteration: iterations,
        title: 'Cloture',
        message: "Cowork formule une reponse finale honnete pour l'utilisateur.",
        runState: 'running',
        runMeta
      });

      const prompt = buildCoworkBlockedUserReplyPrompt({
        originalMessage: message,
        requestClock,
        state: sessionState,
        research: successfulResearchMeta,
        latestCreatedArtifactPath,
        latestReleasedFile,
        stopReason
      });

      try {
        const finalReplyConfig: any = {
          temperature: 0.3,
          topP: config.topP || 1.0,
          topK: config.topK || 1,
          maxOutputTokens: Math.min(config.maxOutputTokens || 1024, 1024),
          systemInstruction: "Tu es Cowork. Tu rediges uniquement la reponse finale visible a l'utilisateur quand l'execution est bloquee. Tu dois etre honnete, humain, concis, et ne jamais exposer de jargon backend, de dump technique ou de liste d'outils."
        };
        const finalReplyThinkingConfig = buildThinkingConfig(modelId, {
          thinkingLevel: 'medium',
          maxThoughtTokens: Math.min(config.maxThoughtTokens || 512, 512),
          includeThoughts: false,
        });
        if (finalReplyThinkingConfig) {
          finalReplyConfig.thinkingConfig = finalReplyThinkingConfig;
        }
        const finalReply = await retryWithBackoff(() => ai.models.generateContent({
          model: modelId,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: finalReplyConfig
        }), {
          maxRetries: 2,
          exactDelaysMs: [2000, 4000],
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
        accumulateUsageTotals(runMeta, modelId, finalReply);
        finalVisibleText = String(finalReply.text || '').trim();
        if (!finalVisibleText) {
          finalVisibleText = buildArtifactFailureFallbackMessage({
            activePdfDraft: sessionState.activePdfDraft,
            createdArtifactPath: latestCreatedArtifactPath,
            releasedFile: latestReleasedFile,
          });
        }
      } catch (error) {
        const cleanError = parseApiError(error);
        emitEvent('warning', {
          iteration: iterations,
          title: 'Cloture degradee',
          message: `Le tour final de reformulation a echoue. Je bascule vers un message de secours humain. ${clipText(cleanError, 180)}`,
          runMeta
        });
        finalVisibleText = buildArtifactFailureFallbackMessage({
          activePdfDraft: sessionState.activePdfDraft,
          createdArtifactPath: latestCreatedArtifactPath,
          releasedFile: latestReleasedFile,
        });
      }
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

    const getToolFailureScope = (toolName: string, args: any) => getCoworkToolFailureScope(toolName, args);

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
      return nextWeakCount;
    };

    const clearWeakSearch = (scope: { exactKey: string; familyKey: string }) => {
      weakSearchFamilies.delete(scope.familyKey);
      delete sessionState.consecutiveDegradedSearches[scope.familyKey];
    };

    const isTransientToolIssue = (toolName: string, errorLike: unknown) => isTransientCoworkToolIssue(toolName, errorLike);

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
      message: runtimeAgent
        ? `${runtimeAgent.name} prepare la mission.`
        : 'Cowork prepare la tache.',
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
      let iterationNarrationEmitted = false;

      for (const part of turnParts) {
        if (part.thought) {
          const thoughtText = (part as any).text || part.text || '';
          if (thoughtText && COWORK_DEBUG_REASONING) {
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
            iterationNarrationEmitted = true;
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
        const debugOnlyToolNames = new Set(['report_progress', 'publish_status']);
        const debugCalls = functionCalls.filter(call => debugOnlyToolNames.has(call.name));
        let turnViolation: string | null = null;

        if (!COWORK_DEBUG_REASONING && debugCalls.length > 0) {
          turnViolation = "Les outils de statut/debug ne sont pas disponibles en mode normal. Agis directement avec des outils utiles ou reponds.";
        } else if (debugCalls.length > 2) {
          turnViolation = "N'abuse pas des outils de debug dans un meme tour.";
        } else if (functionCalls.length > 12) {
          turnViolation = "Tour refuse: trop d'outils demandes d'un coup. Regroupe mieux et reste sous 12 appels dans un meme tour.";
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
            parts: [{ text: `${turnViolation}\nReprends sans theatre, en choisissant toi-meme une meilleure repartition des appels.` }]
          });
          continue;
        }

        const toolResults: any[] = [];
        let abortToolTurn = false;

        for (const call of functionCalls) {
          const tool = localTools.find(t => t.name === call.name);
          if (tool) {
            if (tool.name === 'publish_status') {
              const output = await tool.execute(call.args);
              const publicStatus = (output as any)?.status as CoworkPublicStatus | null;
              toolResults.push({
                functionResponse: {
                  ...(call.id ? { id: call.id } : {}),
                  name: tool.name,
                  response: output
                }
              });
              if (!publicStatus) {
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Plan public invalide',
                  message: "Le 'publish_status' doit au minimum contenir: phase, focus et next_action.",
                  runMeta
                });
                contents.push({
                  role: 'user',
                  parts: [{ text: "Ton 'publish_status' est invalide. Renvoye-le avec au minimum: phase, focus, next_action." }]
                });
                abortToolTurn = true;
                break;
              }

              sessionState.lastPublicStatus = publicStatus;
              sessionState.phase = publicStatus.phase;
              refreshSessionState();
              emitEvent('status', {
                iteration: iterations,
                title: `Plan ${getCoworkPublicPhase(publicStatus.phase, executionMode)}`,
                message: summarizePublicStatus(publicStatus),
                runMeta
              });
              continue;
            }

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
              if (COWORK_DEBUG_REASONING) {
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
              }
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

            if (tool.name === 'web_search' && lastSearchExactKey && toolScope.exactKey === lastSearchExactKey) {
              const loopMsg = `La requete '${toolScope.label}' repete exactement la recherche precedente sans angle nouveau. Change reellement de formulation, de source ou d'outil avant d'insister.`;
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
                  response: { success: false, recoverable: true, quality: 'degraded', error: loopMsg, warnings: [loopMsg] }
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

            runMeta.toolCalls += 1;
            if (tool.name === 'web_search') runMeta.searchCount += 1;
            if (tool.name === 'web_fetch') runMeta.fetchCount += 1;

            log.info(`Executing tool: ${tool.name}`, call.args);
            if (!iterationNarrationEmitted) {
              const narration = buildPublicToolNarration(tool.name, call.args);
              if (narration) {
                emitEvent('narration', {
                  iteration: iterations,
                  title: narration.title,
                  message: narration.message
                });
                iterationNarrationEmitted = true;
              }
            }
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
              const fetchRelevance = tool.name === 'web_fetch'
                ? ((output as any).relevance as FetchRelevance | undefined) || 'off_topic'
                : null;
              const hasValidatingFetch = tool.name === 'web_fetch' && fetchQuality === 'full' && fetchRelevance === 'relevant';
              const reviewNotReady = tool.name === 'review_pdf_draft' && (output as any).ready === false;
              const warningResult =
                recoverableIssue
                || transientIssue
                || reviewNotReady
                || (tool.name === 'web_search' && searchQuality !== 'relevant')
                || (tool.name === 'web_fetch' && !hasValidatingFetch);

              if (tool.name === 'web_search') {
                lastSearchExactKey = toolScope.exactKey;
                if (!isError && typeof (output as any).query === 'string') {
                  lastSuccessfulSearchQuery = String((output as any).query);
                }
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
                } else if (['generate_image_asset', 'generate_tts_audio', 'generate_music_audio', 'create_podcast_episode'].includes(tool.name) && typeof (output as any).path === 'string') {
                  latestCreatedArtifactPath = (output as any).path;
                } else if (tool.name === 'write_file' && typeof (call.args as any)?.path === 'string') {
                  latestCreatedArtifactPath = (call.args as any).path;
                }
              }

              if (isError) {
                latestFailureContext = {
                  toolName: tool.name,
                  message: clipText(parseApiError((output as any).error || (output as any).message || output), 280),
                  iteration: iterations,
                };
                if (!recoverableIssue) {
                  recordToolFailure(toolScope, transientIssue);
                }
                if (transientIssue) {
                  const delayMs = registerTransientCooldown(toolScope.familyKey, parseApiError((output as any).error || output));
                  recordBlockedTool(tool.name, toolScope.familyKey, 'cooldown_active', Date.now() + delayMs);
                }
                if (tool.name === 'web_search') {
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
                        title: 'Piste faible',
                        message: `Cette piste de recherche reste faible apres plusieurs essais. Change vraiment d'angle ou approfondis une source plus prometteuse.`,
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
                  successfulResearchMeta.webSearches += 1;
                  if (searchQuality === 'relevant') {
                    clearWeakSearch(toolScope);
                  } else {
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
                        title: 'Piste faible',
                        message: `Les recherches sur '${clipText(toolScope.label, 120)}' restent faibles. Si cette piste n'apporte rien, change d'angle au lieu d'insister.`,
                        toolName: tool.name,
                        meta: { family: clipText(toolScope.label, 120), reason: 'weak_search_family' },
                        runMeta
                      });
                    }
                  }
                }
                if (tool.name === 'web_fetch') {
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
                  for (const source of Array.isArray((output as any).sources) ? (output as any).sources : []) {
                    addValidatedSource({
                      url: String(source?.url || ''),
                      domain: String(source?.domain || ''),
                      kind: 'music_catalog_lookup'
                    });
                  }
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
              if (!isError && ['create_agent_blueprint', 'update_agent_blueprint'].includes(tool.name) && (output as any).blueprint) {
                emitEvent('agent_blueprint', {
                  iteration: iterations,
                  operation: tool.name === 'update_agent_blueprint' ? 'update' : 'create',
                  blueprint: (output as any).blueprint,
                  runMeta
                });
              }
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
                  message: `La requete '${clipText((output as any).query || toolScope.label, 120)}' renvoie une piste encore faible ou partielle. Utilise-la comme signal pour approfondir, recouper ou changer d'angle si besoin.${Array.isArray((output as any).directSourceUrls) && (output as any).directSourceUrls.length > 0 ? ` Pistes directes utiles: ${(output as any).directSourceUrls.slice(0, 3).join(' | ')}.` : ''}`,
                  toolName: tool.name,
                  meta: formatToolResultMeta(tool.name, call.args, output),
                  runMeta
                });
              } else if (tool.name === 'web_fetch' && !hasValidatingFetch) {
                emitEvent('warning', {
                  iteration: iterations,
                  title: 'Source a confirmer',
                  message: `La lecture de '${clipText((output as any).url || toolScope.label, 120)}' reste ${fetchQuality || 'partielle'} avec pertinence ${fetchRelevance || 'off_topic'}. Utilise-la comme signal, pas comme preuve definitive si le sujet reste sensible.`,
                  toolName: tool.name,
                  meta: formatToolResultMeta(tool.name, call.args, output),
                  runMeta
                });
              }
            } catch (err: any) {
              latestFailureContext = {
                toolName: tool.name,
                message: clipText(parseApiError(err), 280),
                iteration: iterations,
              };
              const transientIssue = isTransientToolIssue(tool.name, err);
              const failureCount = recordToolFailure(toolScope, transientIssue);
              if (transientIssue) {
                const delayMs = registerTransientCooldown(toolScope.familyKey, parseApiError(err));
                recordBlockedTool(tool.name, toolScope.familyKey, 'cooldown_active', Date.now() + delayMs);
              }
              if (tool.name === 'web_search') {
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
                      title: 'Piste faible',
                      message: `Les recherches sur '${clipText(toolScope.label, 120)}' restent improductives. Pivote, ouvre une meilleure source, ou conclus honnetement si la matiere manque.`,
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
          if (handleNoProgress(functionCalls.map(call => call.name).join('+') || 'tool_turn')) {
            break;
          }
          continue;
        }
      }

      refreshSessionState();

      if (!iterationVisibleText.trim()) {
        // LIBERATION: on garde uniquement la detection de stagnation (handleNoProgress).
        // Plus d'injection de blocker prompt comme message user.
        if (handleNoProgress('empty_turn')) {
          break;
        }
      }

      if (iterationVisibleText.trim()) {
        if (markVisibleDeliveryAttempt(sessionState, executionMode, iterationVisibleText)) {
          refreshSessionState();
        }
        const hardBlockers = getHardCoworkBlockers(sessionState.blockers);
        if (hardBlockers.length > 0) {
          emitEvent('warning', {
            iteration: iterations,
            title: 'Livraison incomplete',
            message: hardBlockers.map(blocker => blocker.message).join(' '),
            runMeta
          });
          blockedFinalReplyContext = {
            stopReason: hardBlockers.map(blocker => blocker.message).join(' ')
          };
          finalRunState = 'failed';
          break;
        }

        finalVisibleText += iterationVisibleText;
        sessionState.pendingFinalAnswer = false;
        sessionState.phase = 'completed';
        refreshSessionState();
        emitEvent('text_delta', { iteration: iterations, text: iterationVisibleText, runMeta });
        finalTextEmitted = true;
        break;
      }
    }

    if (!finalVisibleText.trim() && iterations >= FAILSAFE_MAX_ITERATIONS) {
      refreshSessionState();
      const hardBlockerSummary = getHardCoworkBlockers(sessionState.blockers).map((blocker) => blocker.message).join(' ');
      blockedFinalReplyContext = {
        stopReason: hardBlockerSummary
          ? `Cowork a atteint son garde-fou de ${FAILSAFE_MAX_ITERATIONS} tours sans lever tous les blocages restants. ${hardBlockerSummary}`
          : `Cowork a atteint son garde-fou de ${FAILSAFE_MAX_ITERATIONS} tours sans produire de livraison finale exploitable.`
      };
      finalRunState = 'failed';
      emitEvent('warning', {
        iteration: iterations,
        title: 'Failsafe',
        message: `Garde-fou atteint apres ${FAILSAFE_MAX_ITERATIONS} tours internes.`,
        runMeta
      });
    }

    if (!finalVisibleText.trim()) {
      const fallbackMessage = buildCoworkFallbackMessage(latestReleasedFile);
      if (fallbackMessage) {
        finalVisibleText = fallbackMessage;
        finalRunState = 'completed';
        emitEvent('text_delta', { iteration: iterations, text: fallbackMessage, runMeta });
        finalTextEmitted = true;
      }
    }

    // LIBERATION: plus de blocage de la reponse finale par des hard blockers.
    // On garde uniquement le fallback pour les cas ou le modele n'a rien dit du tout.
    if (!finalVisibleText.trim() && blockedFinalReplyContext && !latestReleasedFile?.url) {
      await emitBlockedFinalModelReply(blockedFinalReplyContext.stopReason);
    }

    if (finalVisibleText.trim() && !finalTextEmitted) {
      emitEvent('text_delta', { iteration: iterations, text: finalVisibleText, runMeta });
      finalTextEmitted = true;
    }

    emitEvent('done', {
      iteration: iterations,
      runState: finalRunState,
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

registerApiErrorHandlers(app);

// Server (Local only)
if (!process.env.VERCEL) {
  app.listen(PORT, () => log.success(`Server running on port ${PORT}`));
}
