export const PORT = parseInt(process.env.PORT || '3000', 10);
export const MAX_PAYLOAD = '50mb';
export const COWORK_WORKERS_DEFAULT_TIMEOUT_MS = 30_000;

export function envFlagEnabled(value?: string): boolean {
  return /^(1|true|yes|on)$/i.test(String(value || '').trim());
}

export function allowPublicSearchFallbacks(): boolean {
  return envFlagEnabled(process.env.ALLOW_PUBLIC_SEARCH_FALLBACKS);
}

function trimTrailingSlash(value?: string | null): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

export function getCoworkFeatureFlags() {
  return {
    rag: envFlagEnabled(process.env.COWORK_ENABLE_RAG),
    sandbox: envFlagEnabled(process.env.COWORK_ENABLE_SANDBOX),
    git: envFlagEnabled(process.env.COWORK_ENABLE_GIT),
    browser: envFlagEnabled(process.env.COWORK_ENABLE_BROWSER),
    consciousLoop: envFlagEnabled(process.env.COWORK_ENABLE_CONSCIOUS_LOOP),
  };
}

export function getCoworkWorkersConfig() {
  return {
    url: trimTrailingSlash(process.env.COWORK_WORKERS_URL),
    token: String(process.env.COWORK_WORKERS_TOKEN || '').trim(),
    timeoutMs: Number.parseInt(process.env.COWORK_WORKERS_TIMEOUT_MS || '', 10) || COWORK_WORKERS_DEFAULT_TIMEOUT_MS,
  };
}

export function getQdrantConfig() {
  return {
    url: trimTrailingSlash(process.env.QDRANT_URL),
    apiKey: String(process.env.QDRANT_API_KEY || '').trim(),
  };
}

export function getAzureOpenAIImageConfig() {
  return {
    endpoint: String(process.env.AZURE_OPENAI_IMAGE_ENDPOINT || '').trim(),
    apiKey: String(process.env.AZURE_OPENAI_IMAGE_API_KEY || process.env.AZURE_API_KEY || '').trim(),
    apiVersion: String(process.env.AZURE_OPENAI_IMAGE_API_VERSION || '2024-02-01').trim() || '2024-02-01',
    deployment: String(process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || 'gpt-image-2').trim() || 'gpt-image-2',
  };
}

export function getCoworkRagConfig() {
  const requestedVectorSize = Number.parseInt(process.env.COWORK_RAG_VECTOR_SIZE || '', 10);
  const requestedTopK = Number.parseInt(process.env.COWORK_RAG_TOP_K || '', 10);
  const requestedChunkMaxTokens = Number.parseInt(process.env.COWORK_RAG_CHUNK_MAX_TOKENS || '', 10);
  const requestedChunkOverlapTokens = Number.parseInt(process.env.COWORK_RAG_CHUNK_OVERLAP_TOKENS || '', 10);
  const requestedPromptBudget = Number.parseInt(process.env.COWORK_RAG_MAX_PROMPT_TOKENS || '', 10);
  const requestedScoreThreshold = Number.parseFloat(process.env.COWORK_RAG_SCORE_THRESHOLD || '');

  return {
    autoInject: envFlagEnabled(process.env.COWORK_RAG_AUTOINJECT),
    collectionName: String(process.env.COWORK_RAG_COLLECTION || 'cowork_memory').trim() || 'cowork_memory',
    embeddingModel: String(process.env.COWORK_RAG_EMBEDDING_MODEL || 'gemini-embedding-2-preview').trim() || 'gemini-embedding-2-preview',
    summaryModel: String(process.env.COWORK_RAG_SUMMARY_MODEL || 'gemini-3.1-flash-lite-preview').trim() || 'gemini-3.1-flash-lite-preview',
    vectorSize: Number.isFinite(requestedVectorSize) && requestedVectorSize > 0 ? requestedVectorSize : 1536,
    topK: Number.isFinite(requestedTopK) && requestedTopK > 0 ? requestedTopK : 5,
    scoreThreshold: Number.isFinite(requestedScoreThreshold) ? requestedScoreThreshold : 0.65,
    chunkMaxTokens: Number.isFinite(requestedChunkMaxTokens) && requestedChunkMaxTokens > 0 ? requestedChunkMaxTokens : 800,
    chunkOverlapTokens: Number.isFinite(requestedChunkOverlapTokens) && requestedChunkOverlapTokens >= 0 ? requestedChunkOverlapTokens : 80,
    maxPromptTokens: Number.isFinite(requestedPromptBudget) && requestedPromptBudget > 0 ? requestedPromptBudget : 2000,
  };
}

export const COWORK_ENABLE_RAG = getCoworkFeatureFlags().rag;
export const COWORK_ENABLE_SANDBOX = getCoworkFeatureFlags().sandbox;
export const COWORK_ENABLE_GIT = getCoworkFeatureFlags().git;
export const COWORK_ENABLE_BROWSER = getCoworkFeatureFlags().browser;
export const COWORK_ENABLE_CONSCIOUS_LOOP = getCoworkFeatureFlags().consciousLoop;
export const COWORK_RAG_AUTOINJECT = getCoworkRagConfig().autoInject;

export const LEGACY_COWORK_SYSTEM_INSTRUCTION = "Tu es un agent autonome en mode Cowork. Tu as acces a des outils pour accomplir des taches complexes. Analyse, propose et execute.";
export const MAX_PREVIEW_CHARS = 420;
export const MAX_ACTIVITY_ITEMS = 80;
export const MAX_WEB_FETCH_CHARS = 7000;
export const LONG_CONTEXT_THRESHOLD_TOKENS = 200_000;
export const USD_TO_EUR_RATE = 0.866626; // ECB reference rate on 2026-03-26: 1 EUR = 1.1539 USD.
export const COWORK_DEBUG_REASONING = process.env.COWORK_DEBUG_REASONING === '1';

export const MODEL_PRICING_USD_PER_1M: Record<string, {
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

export const GEMINI_MODEL_ALIASES: Record<string, string> = {
  'gemini-3.1-pro': 'gemini-3.1-pro-preview',
  'gemini-3.1-flash': 'gemini-3.1-flash-lite-preview',
  'gemini-3-pro': 'gemini-3-pro-preview',
  'gemini-3-flash': 'gemini-3-flash-preview',
  'gemini-2.5-flash-preview-tts': 'gemini-2.5-flash-tts',
};

export function normalizeConfiguredModelId(modelId?: string | null, fallback = 'gemini-3.1-pro-preview'): string {
  const raw = String(modelId || '').trim();
  if (!raw) return fallback;
  const upgradedLegacy = raw.includes('gemini-1.5') ? raw.replace('1.5', '3.1') : raw;
  return GEMINI_MODEL_ALIASES[upgradedLegacy] || upgradedLegacy;
}
