import type { MediaGenerationMode, Message } from '../types';
import {
  buildAudioHistory,
  buildImageHistory,
  buildVideoHistory,
  type MediaHistoryEntry,
} from './media-gallery-history';

export type InstructionGalleryEntry = MediaHistoryEntry & {
  sourceKind: 'generated-media';
};

function dedupeInstructionEntries(entries: MediaHistoryEntry[]) {
  const seen = new Set<string>();

  return entries.filter((entry) => {
    const signature = [
      entry.mode || 'unknown',
      String(entry.prompt || '').trim().toLowerCase(),
      String(entry.refinedPrompt || '').trim().toLowerCase(),
    ].join('::');

    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

export function buildInstructionGallery(
  messages: Message[],
  mode?: MediaGenerationMode,
): InstructionGalleryEntry[] {
  const collected = [
    ...buildImageHistory(messages),
    ...buildVideoHistory(messages),
    ...buildAudioHistory(messages, { mode: 'audio' }),
    ...buildAudioHistory(messages, { mode: 'lyria' }),
  ];

  return dedupeInstructionEntries(
    collected.filter((entry) => !mode || entry.mode === mode),
  )
    .sort((left, right) => right.createdAt - left.createdAt)
    .map((entry) => ({
      ...entry,
      sourceKind: 'generated-media',
    }));
}
