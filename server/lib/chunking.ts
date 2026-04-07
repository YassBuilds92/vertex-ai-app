import { PDFParse } from 'pdf-parse';

export type TextChunk = {
  text: string;
  chunkIndex: number;
  chunkCount: number;
  estimatedTokens: number;
};

export type ChunkTextOptions = {
  maxTokens?: number;
  overlapTokens?: number;
  minChunkTokens?: number;
};

export type ExtractedPdfText = {
  text: string;
  totalPages: number;
};

const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_OVERLAP_TOKENS = 80;
const DEFAULT_MIN_CHUNK_TOKENS = 120;

export function normalizeTextContent(text: string): string {
  return String(text || '')
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function estimateTokenCount(text: string): number {
  const normalized = normalizeTextContent(text);
  if (!normalized) return 0;
  return Math.max(
    Math.ceil(normalized.length / 4),
    normalized.split(/\s+/).filter(Boolean).length,
  );
}

function getTailByApproxTokens(text: string, targetTokens: number): string {
  if (targetTokens <= 0) return '';
  const words = normalizeTextContent(text).split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const tailWordCount = Math.max(12, targetTokens);
  return words.slice(-tailWordCount).join(' ').trim();
}

function splitOversizedText(text: string, maxTokens: number, overlapTokens: number): string[] {
  const normalized = normalizeTextContent(text);
  if (!normalized) return [];
  if (estimateTokenCount(normalized) <= maxTokens) return [normalized];

  const words = normalized.split(/\s+/).filter(Boolean);
  const windowSize = Math.max(60, maxTokens);
  const step = Math.max(20, windowSize - Math.max(0, overlapTokens));
  const slices: string[] = [];

  for (let start = 0; start < words.length; start += step) {
    const slice = words.slice(start, start + windowSize).join(' ').trim();
    if (!slice) continue;
    slices.push(slice);
    if (start + windowSize >= words.length) break;
  }

  return slices;
}

function splitIntoSegments(text: string, maxTokens: number, overlapTokens: number): string[] {
  const normalized = normalizeTextContent(text);
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n{2,}/).map(part => part.trim()).filter(Boolean);
  const segments: string[] = [];

  for (const paragraph of paragraphs) {
    if (estimateTokenCount(paragraph) <= maxTokens) {
      segments.push(paragraph);
      continue;
    }

    const sentences = paragraph
      .split(/(?<=[.!?])\s+(?=[A-Z0-9"([À-ÿ])/)
      .map(part => part.trim())
      .filter(Boolean);

    if (sentences.length > 1) {
      for (const sentence of sentences) {
        if (estimateTokenCount(sentence) <= maxTokens) {
          segments.push(sentence);
        } else {
          segments.push(...splitOversizedText(sentence, maxTokens, overlapTokens));
        }
      }
      continue;
    }

    segments.push(...splitOversizedText(paragraph, maxTokens, overlapTokens));
  }

  return segments;
}

export function chunkText(text: string, options: ChunkTextOptions = {}): TextChunk[] {
  const maxTokens = Math.max(120, Number(options.maxTokens || DEFAULT_MAX_TOKENS));
  const overlapTokens = Math.max(0, Number(options.overlapTokens || DEFAULT_OVERLAP_TOKENS));
  const minChunkTokens = Math.max(40, Number(options.minChunkTokens || DEFAULT_MIN_CHUNK_TOKENS));
  const segments = splitIntoSegments(text, maxTokens, overlapTokens);

  if (segments.length === 0) return [];

  const chunks: string[] = [];
  let currentParts: string[] = [];

  const flushCurrent = () => {
    const chunkTextValue = normalizeTextContent(currentParts.join('\n\n'));
    if (!chunkTextValue) {
      currentParts = [];
      return;
    }

    const estimatedTokens = estimateTokenCount(chunkTextValue);
    if (chunks.length > 0 && estimatedTokens < minChunkTokens) {
      chunks[chunks.length - 1] = normalizeTextContent(`${chunks[chunks.length - 1]}\n\n${chunkTextValue}`);
    } else {
      chunks.push(chunkTextValue);
    }

    const overlapSeed = getTailByApproxTokens(chunkTextValue, overlapTokens);
    currentParts = overlapSeed ? [overlapSeed] : [];
  };

  for (const segment of segments) {
    const candidate = normalizeTextContent([...currentParts, segment].join('\n\n'));
    if (!candidate) continue;

    if (estimateTokenCount(candidate) <= maxTokens) {
      currentParts = [...currentParts, segment];
      continue;
    }

    if (currentParts.length > 0) {
      flushCurrent();
    }

    const retryCandidate = normalizeTextContent([...currentParts, segment].join('\n\n'));
    if (retryCandidate && estimateTokenCount(retryCandidate) <= maxTokens) {
      currentParts = [...currentParts, segment];
      continue;
    }

    currentParts = [segment];
    if (estimateTokenCount(segment) > maxTokens) {
      flushCurrent();
    }
  }

  if (currentParts.length > 0) {
    const currentText = normalizeTextContent(currentParts.join('\n\n'));
    if (currentText) {
      if (chunks.length > 0 && estimateTokenCount(currentText) < minChunkTokens) {
        chunks[chunks.length - 1] = normalizeTextContent(`${chunks[chunks.length - 1]}\n\n${currentText}`);
      } else {
        chunks.push(currentText);
      }
    }
  }

  return chunks.map((chunk, index, allChunks) => ({
    text: chunk,
    chunkIndex: index,
    chunkCount: allChunks.length,
    estimatedTokens: estimateTokenCount(chunk),
  }));
}

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<ExtractedPdfText> {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return {
      text: normalizeTextContent(result.text || ''),
      totalPages: Number(result.total || result.pages?.length || 0),
    };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
}

export async function chunkPdfBuffer(buffer: Buffer, options: ChunkTextOptions = {}): Promise<{
  text: string;
  totalPages: number;
  chunks: TextChunk[];
}> {
  const extracted = await extractTextFromPdfBuffer(buffer);
  return {
    ...extracted,
    chunks: chunkText(extracted.text, options),
  };
}
