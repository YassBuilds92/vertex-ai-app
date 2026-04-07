import { getCoworkRagConfig } from './config.js';
import { normalizeTextContent } from './chunking.js';
import { createGoogleAI, retryWithBackoff } from './google-genai.js';

export type MemoryMediaModality = 'image' | 'audio' | 'video';

export type MemoryMediaInput = {
  buffer?: Buffer;
  storageUri?: string;
  mimeType: string;
  fileName?: string;
  label: string;
  videoMetadata?: {
    fps?: number;
    startOffset?: string;
    endOffset?: string;
  };
};

export type MemoryMediaSummary = {
  text: string;
  kind: 'description' | 'transcript' | 'summary' | 'label_fallback';
};

function normalizeMimeType(value?: string) {
  return String(value || '').trim().toLowerCase();
}

export function detectMemoryMediaModality(mimeType?: string, fileName?: string): MemoryMediaModality | null {
  const normalizedMimeType = normalizeMimeType(mimeType);
  const lowerName = String(fileName || '').trim().toLowerCase();

  if (normalizedMimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp)$/i.test(lowerName)) {
    return 'image';
  }
  if (normalizedMimeType.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg)$/i.test(lowerName)) {
    return 'audio';
  }
  if (normalizedMimeType.startsWith('video/') || /\.(mp4|mov|webm|mkv|avi|wmv|mpeg|mpg|flv)$/i.test(lowerName)) {
    return 'video';
  }

  return null;
}

export function buildMemoryMediaPart(input: MemoryMediaInput) {
  const mimeType = normalizeMimeType(input.mimeType);

  if (input.buffer && input.buffer.byteLength > 0) {
    return {
      inlineData: {
        mimeType,
        data: input.buffer.toString('base64'),
      },
      ...(detectMemoryMediaModality(mimeType, input.fileName) === 'video' && input.videoMetadata
        ? { videoMetadata: input.videoMetadata }
        : {}),
    };
  }

  if (input.storageUri) {
    return {
      fileData: {
        mimeType,
        fileUri: input.storageUri,
      },
      ...(detectMemoryMediaModality(mimeType, input.fileName) === 'video' && input.videoMetadata
        ? { videoMetadata: input.videoMetadata }
        : {}),
    };
  }

  throw new Error(`Impossible de construire la part media pour ${input.fileName || input.label}: buffer et storageUri absents.`);
}

function clipSummaryText(value: string, max = 2400) {
  const normalized = normalizeTextContent(value);
  return normalized.length > max ? normalized.slice(0, max).trim() : normalized;
}

function buildSummaryPrompt(input: MemoryMediaInput, modality: MemoryMediaModality) {
  const label = String(input.label || input.fileName || modality).trim();

  if (modality === 'image') {
    return [
      `Tu prepares une memoire semantique pour un agent IA.`,
      `Donne une description courte et concrete de cette image en francais.`,
      `Mentionne les objets, le contexte, l'interface visible et le texte lisible s'il y en a.`,
      `Reste en texte brut, 2 a 4 phrases maximum.`,
      `Label local: ${label}`,
    ].join('\n');
  }

  if (modality === 'audio') {
    return [
      `Tu prepares une memoire semantique pour un agent IA.`,
      `Transcris le contenu parle de cet audio en francais si une voix est presente.`,
      `S'il n'y a pas de parole exploitable, decris brievement le contenu sonore.`,
      `Reste en texte brut, concis mais informatif.`,
      `Label local: ${label}`,
    ].join('\n');
  }

  return [
    `Tu prepares une memoire semantique pour un agent IA.`,
    `Resume cette video en francais de facon utile pour une future recherche semantique.`,
    `Mentionne ce qui est visible et, si tu l'entends, le contenu parle ou textuel le plus important.`,
    `Reste en texte brut, 3 a 6 phrases maximum.`,
    `Label local: ${label}`,
  ].join('\n');
}

function inferSummaryKind(modality: MemoryMediaModality): MemoryMediaSummary['kind'] {
  if (modality === 'image') return 'description';
  if (modality === 'audio') return 'transcript';
  return 'summary';
}

export async function summarizeMediaForMemory(input: MemoryMediaInput): Promise<MemoryMediaSummary> {
  const modality = detectMemoryMediaModality(input.mimeType, input.fileName);
  if (!modality) {
    const fallback = clipSummaryText(input.label);
    return {
      text: fallback,
      kind: 'label_fallback',
    };
  }

  const summaryModel = getCoworkRagConfig().summaryModel;
  const ai = createGoogleAI(summaryModel);
  const response = await retryWithBackoff(
    () => ai.models.generateContent({
      model: summaryModel,
      contents: [{
        role: 'user',
        parts: [
          { text: buildSummaryPrompt(input, modality) },
          buildMemoryMediaPart(input),
        ],
      }],
      config: {
        temperature: 0.1,
        responseMimeType: 'text/plain',
        maxOutputTokens: modality === 'video' ? 420 : 280,
      },
    }),
    {
      maxRetries: 2,
      exactDelaysMs: [1000, 2500],
      jitter: false,
    },
  );

  const text = clipSummaryText(response.text || '');
  if (!text) {
    return {
      text: clipSummaryText(input.label),
      kind: 'label_fallback',
    };
  }

  return {
    text,
    kind: inferSummaryKind(modality),
  };
}
