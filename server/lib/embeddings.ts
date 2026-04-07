import { createGoogleAI, retryWithBackoff } from './google-genai.js';
import { getCoworkRagConfig } from './config.js';

export type CoworkEmbeddingTaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY';

export type EmbeddingUsage = {
  tokenCount: number;
  billableCharacterCount: number;
  truncated: boolean;
  dimensions: number;
  model: string;
};

export type EmbeddedText = {
  vector: number[];
  usage: EmbeddingUsage;
};

function estimateTokensFromCharacters(text: string): number {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

export async function embedText(
  text: string,
  options: {
    taskType: CoworkEmbeddingTaskType;
    title?: string;
    mimeType?: string;
  },
): Promise<EmbeddedText> {
  const ragConfig = getCoworkRagConfig();
  const normalizedText = String(text || '').trim();

  if (!normalizedText) {
    throw new Error('Impossible de calculer un embedding sur un texte vide.');
  }

  const ai = createGoogleAI(ragConfig.embeddingModel);
  const response = await retryWithBackoff(
    () =>
      ai.models.embedContent({
        model: ragConfig.embeddingModel,
        contents: [{ role: 'user', parts: [{ text: normalizedText }] }],
        config: {
          taskType: options.taskType,
          title: options.title,
          mimeType: options.mimeType || 'text/plain',
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
  const vector = Array.isArray(embedding?.values) ? embedding.values.filter((value): value is number => Number.isFinite(value)) : [];

  if (vector.length === 0) {
    throw new Error(`Le modele d'embedding '${ragConfig.embeddingModel}' n'a retourne aucun vecteur exploitable.`);
  }

  return {
    vector,
    usage: {
      tokenCount: Number(embedding?.statistics?.tokenCount || 0) || estimateTokensFromCharacters(normalizedText),
      billableCharacterCount: Number(response.metadata?.billableCharacterCount || 0) || normalizedText.length,
      truncated: Boolean(embedding?.statistics?.truncated),
      dimensions: vector.length,
      model: ragConfig.embeddingModel,
    },
  };
}
