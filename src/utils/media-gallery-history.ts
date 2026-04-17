import type {
  Attachment,
  MediaGenerationMode,
  Message,
} from '../types';

export type MediaHistoryEntry = {
  id: string;
  url: string;
  prompt: string;
  refinedPrompt?: string;
  mode?: MediaGenerationMode;
  model?: string;
  refinerProfileId?: string;
  refinerCustomInstructions?: string;
  shotId?: string;
  shotLabel?: string;
  mimeType?: string;
  name?: string;
  createdAt: number;
  messageId: string;
};

type MediaHistoryOptions = {
  attachmentType: Attachment['type'];
  fallbackMode?: MediaGenerationMode;
  includeLegacyField?: 'images' | 'audio' | 'video';
  modeFilter?: MediaGenerationMode;
};

function sortMessagesChronologically(messages: Message[]) {
  return [...messages].sort((left, right) => left.createdAt - right.createdAt);
}

function sanitizePrompt(value?: string) {
  return String(value || '').trim();
}

function buildEntryId(message: Message, attachment?: Attachment, index = 0) {
  if (attachment?.id) return `${message.id}:${attachment.id}`;
  if (attachment?.url) return `${message.id}:${attachment.url}:${index}`;
  return `${message.id}:${index}`;
}

function getCurrentPromptContext(message: Message | null) {
  if (!message) {
    return {
      prompt: '',
      refinedPrompt: undefined,
    };
  }

  const prompt = sanitizePrompt(message.content);
  const refinedPrompt = sanitizePrompt(message.refinedInstruction);

  return {
    prompt,
    refinedPrompt: refinedPrompt || undefined,
  };
}

function resolveEntryFromAttachment(
  message: Message,
  attachment: Attachment | undefined,
  index: number,
  promptContext: ReturnType<typeof getCurrentPromptContext>,
  fallbackMode?: MediaGenerationMode,
): MediaHistoryEntry | null {
  if (!attachment?.url) return null;

  const generationMeta = attachment.generationMeta;
  const prompt = sanitizePrompt(generationMeta?.prompt) || promptContext.prompt;
  const refinedPrompt = sanitizePrompt(generationMeta?.refinedPrompt) || promptContext.refinedPrompt;

  return {
    id: buildEntryId(message, attachment, index),
    url: attachment.url,
    prompt,
    refinedPrompt: refinedPrompt || undefined,
    mode: generationMeta?.mode || fallbackMode,
    model: generationMeta?.model,
    refinerProfileId: generationMeta?.refinerProfileId,
    refinerCustomInstructions: sanitizePrompt(generationMeta?.refinerCustomInstructions) || undefined,
    shotId: generationMeta?.shotId,
    shotLabel: generationMeta?.shotLabel,
    mimeType: attachment.mimeType,
    name: attachment.name,
    createdAt: message.createdAt,
    messageId: message.id,
  };
}

function buildMediaHistory(messages: Message[], options: MediaHistoryOptions): MediaHistoryEntry[] {
  const ordered = sortMessagesChronologically(messages);
  const results: MediaHistoryEntry[] = [];
  let lastUserMessage: Message | null = null;

  for (const message of ordered) {
    if (message.role === 'user') {
      lastUserMessage = message;
      continue;
    }

    const promptContext = getCurrentPromptContext(lastUserMessage);

    for (const [index, attachment] of (message.attachments || []).entries()) {
      if (attachment.type !== options.attachmentType || !attachment.url) continue;

      const entry = resolveEntryFromAttachment(
        message,
        attachment,
        index,
        promptContext,
        options.fallbackMode,
      );
      if (!entry) continue;
      if (options.modeFilter && entry.mode && entry.mode !== options.modeFilter) continue;
      results.push(entry);
    }

    if (options.includeLegacyField === 'images') {
      for (const [index, url] of (message.images || []).entries()) {
        if (!url) continue;
        results.push({
          id: buildEntryId(message, undefined, index),
          url,
          prompt: promptContext.prompt,
          refinedPrompt: promptContext.refinedPrompt,
          mode: options.fallbackMode,
          createdAt: message.createdAt,
          messageId: message.id,
        });
      }
    }

    if (options.includeLegacyField === 'audio' && message.audio) {
      results.push({
        id: buildEntryId(message),
        url: message.audio,
        prompt: promptContext.prompt,
        refinedPrompt: promptContext.refinedPrompt,
        mode: options.fallbackMode,
        createdAt: message.createdAt,
        messageId: message.id,
      });
    }

    if (options.includeLegacyField === 'video' && message.video) {
      results.push({
        id: buildEntryId(message),
        url: message.video,
        prompt: promptContext.prompt,
        refinedPrompt: promptContext.refinedPrompt,
        mode: options.fallbackMode,
        createdAt: message.createdAt,
        messageId: message.id,
      });
    }
  }

  return results.sort((left, right) => right.createdAt - left.createdAt);
}

export function buildImageHistory(messages: Message[]) {
  return buildMediaHistory(messages, {
    attachmentType: 'image',
    fallbackMode: 'image',
    modeFilter: 'image',
  });
}

export function buildVideoHistory(messages: Message[]) {
  return buildMediaHistory(messages, {
    attachmentType: 'video',
    fallbackMode: 'video',
    includeLegacyField: 'video',
    modeFilter: 'video',
  });
}

export function buildAudioHistory(
  messages: Message[],
  options?: { mode?: Extract<MediaGenerationMode, 'audio' | 'lyria'> },
) {
  return buildMediaHistory(messages, {
    attachmentType: 'audio',
    fallbackMode: options?.mode,
    includeLegacyField: 'audio',
    modeFilter: options?.mode,
  });
}
