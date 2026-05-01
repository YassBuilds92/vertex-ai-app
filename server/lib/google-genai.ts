import { GoogleGenAI } from '@google/genai';

import { log } from './logger.js';
import { getGcpCredentials } from './storage.js';

export type RetryKind = 'quota' | 'concurrency' | 'server';
export type GeminiThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export type RetryOptions = {
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

let loggedLegacyAuthWarning = false;

export function getVertexConfig() {
  const projectId = String(process.env.VERTEX_PROJECT_ID || '').trim();
  const location = String(process.env.VERTEX_LOCATION || '').trim();
  return { isConfigured: !!(projectId && location), projectId, location };
}

export function parseApiError(error: any): string {
  const errStr = String(error);
  if (errStr.includes('ApiError:')) {
    try {
      const jsonStart = errStr.indexOf('{');
      if (jsonStart !== -1) {
        const jsonPart = errStr.substring(jsonStart);
        const parsed = JSON.parse(jsonPart);
        if (parsed.error && parsed.error.message) {
          let msg = parsed.error.message;
          if (parsed.error.code === 429 || parsed.error.status === 'RESOURCE_EXHAUSTED') {
            msg = 'Quota depasse (429). Trop de demandes simultanees ou limite quotidienne atteinte. Reessayez dans quelques minutes.';
          }
          return msg;
        }
      }
    } catch (e) {
      log.debug('Failed to parse ApiError JSON', e);
    }
  }
  return errStr;
}

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
    normalized.includes('500')
    || normalized.includes('502')
    || normalized.includes('503')
    || normalized.includes('internal server error')
    || normalized.includes('server error')
    || normalized.includes('unavailable')
    || normalized.includes('temporarily')
    || normalized.includes('deadline exceeded')
    || normalized.includes('timeout')
    || normalized.includes('timed out');

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

export async function retryWithBackoff<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
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
          message: classified.message,
        });

        await options.onRetry?.({
          attempt: i + 1,
          maxRetries,
          delayMs,
          kind: classified.kind,
          message: classified.message,
        });

        await new Promise(resolve => setTimeout(resolve, delayMs));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

export function createGoogleAI(modelId?: string): GoogleGenAI {
  const { projectId, location: envLocation } = getVertexConfig();

  if (!loggedLegacyAuthWarning) {
    loggedLegacyAuthWarning = true;

    if (/^(1|true|yes|on)$/i.test(String(process.env.VERTEX_EXPRESS || '').trim())) {
      log.warn('VERTEX_EXPRESS est ignore. Ce backend utilise uniquement Vertex AI via gcloud auth / ADC.');
    }

    if (String(process.env.GEMINI_API_KEY || '').trim()) {
      log.warn('GEMINI_API_KEY est ignore cote backend. Ce projet utilise uniquement Vertex AI via gcloud auth / ADC.');
    }
  }

  if (!projectId || !envLocation) {
    throw new Error(
      "Vertex AI non configure. Renseigne VERTEX_PROJECT_ID / VERTEX_LOCATION puis connecte-toi avec 'gcloud auth application-default login'.",
    );
  }

  let finalLocation = envLocation;
  const normalizedModelId = String(modelId || '').trim().toLowerCase();
  const isEmbeddingModel =
    normalizedModelId.includes('embedding')
    || normalizedModelId.includes('multimodalembedding');

  if (
    normalizedModelId
    && !isEmbeddingModel
    && (
      normalizedModelId.includes('preview')
      || normalizedModelId.includes('3.1')
      || normalizedModelId.includes('3-flash')
      || normalizedModelId.includes('image')
      || normalizedModelId.includes('tts')
    )
  ) {
    finalLocation = 'global';
  }

  const options: any = {
    vertexai: true,
    project: projectId,
    location: finalLocation,
  };
  const gcpCredentials = getGcpCredentials();
  if (gcpCredentials) {
    options.googleAuthOptions = { credentials: gcpCredentials };
  }
  return new GoogleGenAI(options);
}

export function buildThinkingConfig(
  modelId: string,
  options: {
    thinkingLevel?: GeminiThinkingLevel;
    maxThoughtTokens?: number;
    includeThoughts?: boolean;
  } = {},
) {
  const normalizedModel = String(modelId || '').toLowerCase();
  const isGemini3Series = /gemini-3(\.1)?-/.test(normalizedModel);
  const isGemini25Series = /gemini-2\.5-/.test(normalizedModel);
  const thinkingConfig: Record<string, unknown> = {};
  const requestedThinkingLevel = options.thinkingLevel === 'minimal'
    ? 'low'
    : options.thinkingLevel;

  if (typeof options.includeThoughts === 'boolean') {
    thinkingConfig.includeThoughts = options.includeThoughts;
  }

  if (isGemini3Series) {
    if (requestedThinkingLevel) {
      thinkingConfig.thinkingLevel = requestedThinkingLevel;
    }
  } else if (isGemini25Series && Number.isFinite(options.maxThoughtTokens)) {
    thinkingConfig.thinkingBudget = Math.max(0, Math.round(options.maxThoughtTokens || 0));
  }

  return Object.keys(thinkingConfig).length > 0 ? thinkingConfig : undefined;
}
