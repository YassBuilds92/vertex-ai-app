export type PlainTextBlockKind = 'srt';

const SRT_INDEX_LINE = /^\d+$/;
const SRT_TIMESTAMP_LINE = /^\d{2}:\d{2}:\d{2},\d{3}\s+-->\s+\d{2}:\d{2}:\d{2},\d{3}(?:\s+.*)?$/;

export function normalizeTextLineEndings(value: string) {
  return String(value || '').replace(/\r\n?/g, '\n');
}

export function detectPlainTextBlockKind(value: string): PlainTextBlockKind | null {
  const text = normalizeTextLineEndings(value).trim();
  if (!text || text.includes('```')) return null;

  const lines = text.split('\n').map(line => line.trim());
  let cueCount = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const nextLine = lines[index + 1] || '';

    if (SRT_INDEX_LINE.test(line) && SRT_TIMESTAMP_LINE.test(nextLine)) {
      cueCount += 1;
      index += 1;
      continue;
    }
  }

  return cueCount > 0 ? 'srt' : null;
}

export function getPlainTextBlockLabel(kind: PlainTextBlockKind) {
  if (kind === 'srt') return 'SRT';
  return 'Texte';
}
