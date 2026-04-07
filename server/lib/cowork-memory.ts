import { randomUUID } from 'crypto';

import {
  chunkPdfBuffer,
  chunkText,
  estimateTokenCount,
  normalizeTextContent,
  type TextChunk,
} from './chunking.js';
import {
  embedMediaWithContext,
  embedText,
  type EmbeddingUsage,
} from './embeddings.js';
import { getCoworkRagConfig } from './config.js';
import { log } from './logger.js';
import {
  detectMemoryMediaModality,
  summarizeMediaForMemory,
  type MemoryMediaModality,
} from './media-understanding.js';
import {
  deleteCoworkMemoryByFile,
  queryCoworkMemoryByVector,
  scrollCoworkMemoryPoints,
  upsertCoworkMemoryPoints,
  type CoworkMemoryPayload,
  type CoworkMemoryPoint,
} from './qdrant.js';

export type CoworkMemoryUsageRecorder = {
  onEmbedding?: (usage: EmbeddingUsage) => void;
  onVectorSearch?: () => void;
};

export type IndexTextLikeFileInput = {
  buffer: Buffer;
  fileId: string;
  fileName: string;
  mimeType: string;
  attachmentType: string;
  storageUri: string;
  label: string;
  userId: string;
  sessionId?: string;
  createdAt?: number;
};

export type IndexMultimodalFileInput = {
  buffer?: Buffer;
  fileId: string;
  fileName: string;
  mimeType: string;
  attachmentType: string;
  storageUri: string;
  label: string;
  userId: string;
  sessionId?: string;
  createdAt?: number;
  videoMetadata?: {
    fps?: number;
    startOffset?: string;
    endOffset?: string;
  };
};

export type RelevantMemoryChunk = CoworkMemoryPayload & {
  id: string;
  score?: number;
};

const TEXT_MEMORY_MIME_TYPES = new Set([
  'application/json',
  'application/pdf',
  'application/rtf',
  'application/xml',
  'text/csv',
  'text/html',
  'text/markdown',
  'text/plain',
  'text/xml',
]);

const TEXT_MEMORY_EXTENSIONS = ['.csv', '.html', '.htm', '.json', '.md', '.pdf', '.rtf', '.txt', '.xml'];

function hasAllowedTextExtension(fileName?: string) {
  const lowerName = String(fileName || '').toLowerCase();
  return TEXT_MEMORY_EXTENSIONS.some(extension => lowerName.endsWith(extension));
}

export function supportsTextMemoryIndexing(mimeType?: string, fileName?: string) {
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();
  return TEXT_MEMORY_MIME_TYPES.has(normalizedMimeType)
    || normalizedMimeType.startsWith('text/')
    || hasAllowedTextExtension(fileName);
}

export function supportsMultimodalMemoryIndexing(mimeType?: string, fileName?: string) {
  return Boolean(detectMemoryMediaModality(mimeType, fileName));
}

export function supportsMemoryIndexing(mimeType?: string, fileName?: string) {
  return supportsTextMemoryIndexing(mimeType, fileName)
    || supportsMultimodalMemoryIndexing(mimeType, fileName);
}

function decodeTextBuffer(buffer: Buffer) {
  return normalizeTextContent(buffer.toString('utf8').replace(/^\uFEFF/, ''));
}

async function extractTextChunks(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<{
  extractedText: string;
  chunks: TextChunk[];
  totalPages?: number;
}> {
  const ragConfig = getCoworkRagConfig();
  if (String(mimeType || '').toLowerCase() === 'application/pdf' || String(fileName || '').toLowerCase().endsWith('.pdf')) {
    const pdf = await chunkPdfBuffer(buffer, {
      maxTokens: ragConfig.chunkMaxTokens,
      overlapTokens: ragConfig.chunkOverlapTokens,
    });
    return {
      extractedText: pdf.text,
      chunks: pdf.chunks,
      totalPages: pdf.totalPages,
    };
  }

  const extractedText = decodeTextBuffer(buffer);
  return {
    extractedText,
    chunks: chunkText(extractedText, {
      maxTokens: ragConfig.chunkMaxTokens,
      overlapTokens: ragConfig.chunkOverlapTokens,
    }),
  };
}

function buildPointId(fileId: string, chunkIndex: number, storageUri: string) {
  void fileId;
  void chunkIndex;
  void storageUri;
  return randomUUID();
}

function mapPointToRelevantChunk(point: CoworkMemoryPoint): RelevantMemoryChunk | null {
  const payload = point.payload;
  if (!payload?.userId || !payload.fileId || !payload.storageUri) return null;

  return {
    ...payload,
    id: String(point.id),
    score: Number(point.score || 0) || undefined,
  };
}

export async function indexTextLikeFileToMemory(
  input: IndexTextLikeFileInput,
  recorder: CoworkMemoryUsageRecorder = {},
): Promise<{
  chunkCount: number;
  totalPages?: number;
  extractedCharacters: number;
  modality: 'text';
  embeddingStrategy: 'text_chunks';
}> {
  if (!supportsTextMemoryIndexing(input.mimeType, input.fileName)) {
    throw new Error(`Type de fichier non pris en charge pour l'indexation texte: ${input.mimeType || input.fileName}`);
  }

  const extracted = await extractTextChunks(input.buffer, input.mimeType, input.fileName);
  if (!extracted.extractedText || extracted.chunks.length === 0) {
    throw new Error(`Aucun texte exploitable n'a pu etre extrait de '${input.fileName}'.`);
  }

  await deleteCoworkMemoryByFile({ userId: input.userId, fileId: input.fileId }).catch((error) => {
    log.warn(`Unable to clear prior memory points for ${input.fileId}`, error);
  });

  const points = [];
  for (const chunk of extracted.chunks) {
    const embedded = await embedText(chunk.text, {
      taskType: 'RETRIEVAL_DOCUMENT',
      title: input.label,
      mimeType: 'text/plain',
    });
    recorder.onEmbedding?.(embedded.usage);

    points.push({
      id: buildPointId(input.fileId, chunk.chunkIndex, input.storageUri),
      vector: embedded.vector,
      payload: {
        userId: input.userId,
        fileId: input.fileId,
        fileName: input.fileName,
        sessionId: input.sessionId,
        mimeType: input.mimeType,
        attachmentType: input.attachmentType,
        label: input.label,
        sourceText: chunk.text,
        storageUri: input.storageUri,
        createdAt: Number(input.createdAt || Date.now()),
        chunkIndex: chunk.chunkIndex,
        chunkCount: chunk.chunkCount,
        estimatedTokens: chunk.estimatedTokens,
        modality: 'text',
        embeddingStrategy: 'text_chunks',
      } satisfies CoworkMemoryPayload,
    });
  }

  await upsertCoworkMemoryPoints(points);

  return {
    chunkCount: extracted.chunks.length,
    totalPages: extracted.totalPages,
    extractedCharacters: extracted.extractedText.length,
    modality: 'text',
    embeddingStrategy: 'text_chunks',
  };
}

function buildMultimodalContextText(label: string, summaryText: string) {
  return normalizeTextContent([label, summaryText].filter(Boolean).join('\n\n'));
}

export async function indexMultimodalFileToMemory(
  input: IndexMultimodalFileInput,
  recorder: CoworkMemoryUsageRecorder = {},
): Promise<{
  chunkCount: number;
  extractedCharacters: number;
  modality: MemoryMediaModality;
  summaryKind: CoworkMemoryPayload['summaryKind'];
  embeddingStrategy: CoworkMemoryPayload['embeddingStrategy'];
}> {
  const modality = detectMemoryMediaModality(input.mimeType, input.fileName);
  if (!modality) {
    throw new Error(`Type de fichier non pris en charge pour l'indexation multimodale: ${input.mimeType || input.fileName}`);
  }

  await deleteCoworkMemoryByFile({ userId: input.userId, fileId: input.fileId }).catch((error) => {
    log.warn(`Unable to clear prior multimodal memory points for ${input.fileId}`, error);
  });

  const mediaInputForModel = modality === 'video' && input.storageUri
    ? { ...input, buffer: undefined }
    : input;

  const summary = await summarizeMediaForMemory({
    buffer: mediaInputForModel.buffer,
    storageUri: input.storageUri,
    mimeType: input.mimeType,
    fileName: input.fileName,
    label: input.label,
    videoMetadata: input.videoMetadata,
  });
  const contextText = buildMultimodalContextText(input.label, summary.text);

  let embeddingStrategy: CoworkMemoryPayload['embeddingStrategy'] = 'multimodal';
  let embedded;
  try {
    embedded = await embedMediaWithContext({
      buffer: mediaInputForModel.buffer,
      storageUri: input.storageUri,
      mimeType: input.mimeType,
      fileName: input.fileName,
      label: input.label,
      contextText,
      videoMetadata: input.videoMetadata,
    });
  } catch (error) {
    if (!contextText) {
      throw error;
    }
    embedded = await embedText(contextText, {
      taskType: 'RETRIEVAL_DOCUMENT',
      title: input.label,
      mimeType: 'text/plain',
    });
    embeddingStrategy = 'transcript_fallback';
  }

  recorder.onEmbedding?.(embedded.usage);

  await upsertCoworkMemoryPoints([{
    id: buildPointId(input.fileId, 0, input.storageUri),
    vector: embedded.vector,
    payload: {
      userId: input.userId,
      fileId: input.fileId,
      fileName: input.fileName,
      sessionId: input.sessionId,
      mimeType: input.mimeType,
      attachmentType: input.attachmentType,
      label: input.label,
      sourceText: summary.text,
      storageUri: input.storageUri,
      createdAt: Number(input.createdAt || Date.now()),
      chunkIndex: 0,
      chunkCount: 1,
      estimatedTokens: estimateTokenCount(contextText),
      modality,
      summaryKind: summary.kind,
      embeddingStrategy,
    } satisfies CoworkMemoryPayload,
  }]);

  return {
    chunkCount: 1,
    extractedCharacters: summary.text.length,
    modality,
    summaryKind: summary.kind,
    embeddingStrategy,
  };
}

export async function indexFileToMemory(
  input: IndexTextLikeFileInput | IndexMultimodalFileInput,
  recorder: CoworkMemoryUsageRecorder = {},
) {
  if (supportsTextMemoryIndexing(input.mimeType, input.fileName)) {
    if (!('buffer' in input) || !input.buffer) {
      throw new Error(`Le fichier ${input.fileName} exige un buffer local pour l'indexation texte.`);
    }
    return indexTextLikeFileToMemory({
      ...input,
      buffer: input.buffer,
    }, recorder);
  }

  if (supportsMultimodalMemoryIndexing(input.mimeType, input.fileName)) {
    return indexMultimodalFileToMemory(input, recorder);
  }

  throw new Error(`Type de fichier non pris en charge pour l'indexation memoire: ${input.mimeType || input.fileName}`);
}

export async function searchRelevantMemory(
  options: {
    userId: string;
    query: string;
    topK?: number;
    mimeTypes?: string[];
    scoreThreshold?: number;
  },
  recorder: CoworkMemoryUsageRecorder = {},
): Promise<RelevantMemoryChunk[]> {
  const embedded = await embedText(options.query, {
    taskType: 'RETRIEVAL_QUERY',
    mimeType: 'text/plain',
  });
  recorder.onEmbedding?.(embedded.usage);
  recorder.onVectorSearch?.();

  const points = await queryCoworkMemoryByVector({
    vector: embedded.vector,
    userId: options.userId,
    limit: options.topK,
    scoreThreshold: options.scoreThreshold,
    mimeTypes: options.mimeTypes,
  });

  return points
    .map(mapPointToRelevantChunk)
    .filter((chunk): chunk is RelevantMemoryChunk => Boolean(chunk))
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0));
}

export async function recallMemoryFiles(options: {
  userId: string;
  fileIds: string[];
}): Promise<RelevantMemoryChunk[]> {
  const results: RelevantMemoryChunk[] = [];

  for (const fileId of options.fileIds.map(value => String(value || '').trim()).filter(Boolean)) {
    const points = await scrollCoworkMemoryPoints({
      userId: options.userId,
      fileIds: [fileId],
      limit: 96,
    });

    results.push(
      ...points
        .map(mapPointToRelevantChunk)
        .filter((chunk): chunk is RelevantMemoryChunk => Boolean(chunk)),
    );
  }

  return results.sort((left, right) => {
    if (left.fileId !== right.fileId) return left.fileId.localeCompare(right.fileId);
    return Number(left.chunkIndex || 0) - Number(right.chunkIndex || 0);
  });
}

export async function forgetMemoryFile(options: {
  userId: string;
  fileId: string;
}) {
  await deleteCoworkMemoryByFile(options);
}

export function groupRelevantMemoryByFile(chunks: RelevantMemoryChunk[]) {
  const groups = new Map<string, RelevantMemoryChunk[]>();

  for (const chunk of chunks) {
    const key = chunk.fileId;
    const current = groups.get(key) || [];
    current.push(chunk);
    groups.set(key, current);
  }

  return [...groups.entries()]
    .map(([fileId, fileChunks]) => ({
      fileId,
      label: fileChunks[0]?.label || fileId,
      fileName: fileChunks[0]?.fileName || '',
      mimeType: fileChunks[0]?.mimeType || '',
      attachmentType: fileChunks[0]?.attachmentType || '',
      storageUri: fileChunks[0]?.storageUri || '',
      createdAt: fileChunks[0]?.createdAt || 0,
      modality: fileChunks[0]?.modality || 'text',
      embeddingStrategy: fileChunks[0]?.embeddingStrategy,
      chunks: fileChunks.sort((left, right) => Number(left.chunkIndex || 0) - Number(right.chunkIndex || 0)),
      text: fileChunks
        .sort((left, right) => Number(left.chunkIndex || 0) - Number(right.chunkIndex || 0))
        .map(chunk => String(chunk.sourceText || '').trim())
        .filter(Boolean)
        .join('\n\n'),
    }))
    .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0));
}

export function summarizeMemorySearchResults(chunks: RelevantMemoryChunk[]) {
  if (chunks.length === 0) {
    return 'Aucun souvenir pertinent trouve.';
  }

  return chunks
    .map((chunk, index) => {
      const snippet = normalizeTextContent(String(chunk.sourceText || '')).slice(0, 220);
      const score = typeof chunk.score === 'number' ? `score ${chunk.score.toFixed(2)}` : null;
      const modality = chunk.modality ? `modality ${chunk.modality}` : null;
      return [
        `[${index + 1}]`,
        chunk.label,
        chunk.mimeType,
        modality,
        score,
        snippet,
      ].filter(Boolean).join(' | ');
    })
    .join('\n');
}

export function buildRelevantMemorySection(chunks: RelevantMemoryChunk[], maxTokens = 2000) {
  if (chunks.length === 0) return '';

  const lines: string[] = [];
  let usedTokens = 0;

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const snippet = normalizeTextContent(String(chunk.sourceText || '')).slice(0, 420);
    const line = `[${index + 1}] ${chunk.label} (${chunk.mimeType}${chunk.modality ? `, ${chunk.modality}` : ''}${typeof chunk.score === 'number' ? `, score ${chunk.score.toFixed(2)}` : ''}) - ${snippet} - storageUri: ${chunk.storageUri} - fileId: ${chunk.fileId}`;
    const estimatedTokens = estimateTokenCount(line);

    if (lines.length > 0 && (usedTokens + estimatedTokens) > maxTokens) {
      break;
    }

    lines.push(line);
    usedTokens += estimatedTokens;
  }

  if (lines.length === 0) return '';

  return [
    '### MEMOIRE PERTINENTE',
    ...lines,
    "Utilise cette memoire seulement si elle eclaire reellement la demande courante. Cite le fichier utile quand tu t'appuies dessus.",
  ].join('\n');
}
