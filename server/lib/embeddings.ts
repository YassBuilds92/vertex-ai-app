import { getCoworkRagConfig } from './config.js';
import { normalizeTextContent } from './chunking.js';
import { createGoogleAI, retryWithBackoff } from './google-genai.js';
import { buildMemoryMediaPart, type MemoryMediaInput } from './media-understanding.js';

export type CoworkEmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export type EmbeddingUsage = {
  tokenCount: number;
  billableCharacterCount: number;
  truncated: boolean;
  dimensions: number;
  model: string;
};

export type EmbeddedContent = {
  vector: number[];
  usage: EmbeddingUsage;
};

type EmbedPartsOptions = {
  taskType?: CoworkEmbeddingTaskType;
  title?: string;
  mimeType?: string;
};

function estimateTokensFromCharacters(text: string): number {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

function createEmbeddingUsage(
  response: any,
  vector: number[],
  model: string,
  fallbackText = '',
): EmbeddingUsage {
  const embedding = response.embeddings?.[0];

  return {
    tokenCount: Number(embedding?.statistics?.tokenCount || 0) || estimateTokensFromCharacters(fallbackText),
    billableCharacterCount: Number(response.metadata?.billableCharacterCount || 0) || fallbackText.length,
    truncated: Boolean(embedding?.statistics?.truncated),
    dimensions: vector.length,
    model,
  };
}

export async function embedContentParts(
  parts: Array<Record<string, unknown>>,
  options: EmbedPartsOptions = {},
): Promise<EmbeddedContent> {
  const ragConfig = getCoworkRagConfig();
  if (!Array.isArray(parts) || parts.length === 0) {
    throw new Error("Impossible de calculer un embedding sans contenu.");
  }

  const ai = createGoogleAI(ragConfig.embeddingModel);
  const response = await retryWithBackoff(
    () =>
      ai.models.embedContent({
        model: ragConfig.embeddingModel,
        contents: [{ role: 'user', parts }],
        config: {
          ...(options.taskType ? { taskType: options.taskType } : {}),
          ...(options.title ? { title: options.title } : {}),
          ...(options.mimeType ? { mimeType: options.mimeType } : {}),
          ...(ragConfig.vectorSize > 0 ? { outputDimensionality: ragConfig.vectorSize } : {}),
          autoTruncate: false,
        },
      }),
    {
      maxRetries: 3,
      exactDelaysMs: [1000, 2000, 4000],
      jitter: false,
    },
  );

  const embedding = response.embeddings?.[0];
  const vector = Array.isArray(embedding?.values)
    ? embedding.values.filter((value): value is number => Number.isFinite(value))
    : [];

  if (vector.length === 0) {
    throw new Error(`Le modele d'embedding '${ragConfig.embeddingModel}' n'a retourne aucun vecteur exploitable.`);
  }

  const fallbackText = parts
    .map((part) => normalizeTextContent(String((part as any)?.text || '')))
    .filter(Boolean)
    .join('\n');

  return {
    vector,
    usage: createEmbeddingUsage(response, vector, ragConfig.embeddingModel, fallbackText),
  };
}

export async function embedText(
  text: string,
  options: {
    taskType: CoworkEmbeddingTaskType;
    title?: string;
    mimeType?: string;
  },
): Promise<EmbeddedContent> {
  const normalizedText = normalizeTextContent(text);

  if (!normalizedText) {
    throw new Error('Impossible de calculer un embedding sur un texte vide.');
  }

  return embedContentParts(
    [{ text: normalizedText }],
    {
      taskType: options.taskType,
      title: options.title,
      mimeType: options.mimeType || 'text/plain',
    },
  );
}

export async function embedMediaWithContext(
  input: MemoryMediaInput & {
    contextText?: string;
  },
): Promise<EmbeddedContent> {
  const normalizedContext = normalizeTextContent(input.contextText || '');
  const parts: Array<Record<string, unknown>> = [];

  if (normalizedContext) {
    parts.push({ text: normalizedContext });
  }

  parts.push(buildMemoryMediaPart(input) as Record<string, unknown>);

  return embedContentParts(parts, {
    taskType: 'RETRIEVAL_DOCUMENT',
    title: input.label,
    mimeType: input.mimeType,
  });
}
