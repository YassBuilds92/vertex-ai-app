import type {
  ApiAttachmentPayload,
  ApiHistoryMessagePayload,
  ApiMessagePartPayload,
} from '../../shared/chat-parts.js';
import { log } from './logger.js';

type ModelPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { fileData: { mimeType: string; fileUri: string } };

const MAX_REMOTE_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const YOUTUBE_PLACEHOLDERS = new Set([
  'Chargement du titre...',
  'Video YouTube',
  'Vidéo YouTube',
]);

function stripDataUrlPrefix(value?: string) {
  if (!value) return undefined;
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function normalizeMimeType(value?: string) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function looksLikeHttpUrl(value?: string) {
  return Boolean(value && /^https?:\/\//i.test(value));
}

function looksLikeYouTubeUrl(value?: string) {
  return Boolean(
    value
      && /^(https?:\/\/)?((www|m)\.)?(youtube\.com|youtu\.be)\//i.test(value)
  );
}

function guessMimeTypeFromUrl(url?: string) {
  if (!url) return '';

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.pdf')) return 'application/pdf';
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg)$/.test(pathname)) {
      const extension = pathname.split('.').pop();
      return extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;
    }
    if (/\.(mp3|wav|ogg|m4a|aac|flac)$/.test(pathname)) {
      const extension = pathname.split('.').pop();
      return extension === 'mp3' ? 'audio/mpeg' : `audio/${extension}`;
    }
    if (/\.(mp4|webm|mov|m4v)$/.test(pathname)) {
      return pathname.endsWith('.mov') ? 'video/quicktime' : `video/${pathname.split('.').pop()}`;
    }
  } catch {
    return '';
  }

  return '';
}

function isInlineFriendlyMimeType(mimeType: string) {
  return mimeType.startsWith('image/')
    || mimeType.startsWith('audio/')
    || mimeType.startsWith('video/')
    || mimeType === 'application/pdf';
}

function buildFallbackAttachmentText(attachment: ApiAttachmentPayload) {
  const labelByType: Record<ApiAttachmentPayload['type'], string> = {
    image: 'Image jointe',
    video: 'Video jointe',
    audio: 'Audio joint',
    document: 'Document joint',
    youtube: 'Lien YouTube partage',
  };

  return [
    labelByType[attachment.type] || 'Piece jointe',
    attachment.name ? `Nom: ${attachment.name}` : null,
    attachment.mimeType ? `Type: ${attachment.mimeType}` : null,
    attachment.url ? `URL: ${attachment.url}` : null,
  ].filter(Boolean).join('\n');
}

async function fetchRemoteInlineData(url: string, fallbackMimeType?: string) {
  const response = await fetch(url, {
    redirect: 'follow',
    headers: {
      Accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentLengthHeader = response.headers.get('content-length');
  const contentLength = Number(contentLengthHeader || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_REMOTE_ATTACHMENT_BYTES) {
    throw new Error(`Attachment too large (${contentLength} bytes)`);
  }

  const contentType = normalizeMimeType(response.headers.get('content-type') || fallbackMimeType || guessMimeTypeFromUrl(url));
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_REMOTE_ATTACHMENT_BYTES) {
    throw new Error(`Attachment too large (${buffer.byteLength} bytes)`);
  }

  return {
    mimeType: contentType || normalizeMimeType(fallbackMimeType) || 'application/octet-stream',
    data: buffer.toString('base64'),
  };
}

async function resolveYoutubeTitle(attachment: ApiAttachmentPayload) {
  if (attachment.name && !YOUTUBE_PLACEHOLDERS.has(attachment.name)) {
    return attachment.name;
  }

  if (!attachment.url || !looksLikeHttpUrl(attachment.url)) {
    return attachment.name || null;
  }

  try {
    const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(attachment.url)}&format=json`;
    const response = await fetch(oembedUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return attachment.name || null;
    }

    const payload = await response.json().catch(() => null);
    if (payload && typeof payload.title === 'string' && payload.title.trim()) {
      return payload.title.trim();
    }
  } catch (error) {
    log.warn('YouTube oEmbed lookup failed', {
      url: attachment.url,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return attachment.name || null;
}

export async function resolveAttachmentToModelParts(attachment: ApiAttachmentPayload): Promise<ModelPart[]> {
  const mimeType = normalizeMimeType(attachment.mimeType || guessMimeTypeFromUrl(attachment.url));
  const base64 = stripDataUrlPrefix(attachment.base64);

  if (attachment.type === 'youtube' || looksLikeYouTubeUrl(attachment.url)) {
    const title = await resolveYoutubeTitle(attachment);
    return [{
      text: [
        'Lien YouTube partage.',
        title ? `Titre: ${title}` : null,
        attachment.url ? `URL: ${attachment.url}` : null,
      ].filter(Boolean).join('\n'),
    }];
  }

  if (base64 && mimeType && isInlineFriendlyMimeType(mimeType)) {
    return [{ inlineData: { mimeType, data: base64 } }];
  }

  if (attachment.url && looksLikeHttpUrl(attachment.url) && mimeType && isInlineFriendlyMimeType(mimeType)) {
    try {
      return [{ inlineData: await fetchRemoteInlineData(attachment.url, mimeType) }];
    } catch (error) {
      log.warn('Attachment inline fetch failed, falling back to text context', {
        url: attachment.url,
        mimeType,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return [{ text: buildFallbackAttachmentText(attachment) }];
}

export async function resolveApiPartsToModelParts(parts: ApiMessagePartPayload[]): Promise<ModelPart[]> {
  const modelParts: ModelPart[] = [];

  for (const part of parts) {
    if (part.text) {
      modelParts.push({ text: part.text });
    }

    if (part.inlineData) {
      modelParts.push({ inlineData: part.inlineData });
    }

    if (part.fileData) {
      if (looksLikeHttpUrl(part.fileData.fileUri)) {
        modelParts.push(...await resolveAttachmentToModelParts({
          type: looksLikeYouTubeUrl(part.fileData.fileUri) ? 'youtube' : 'document',
          url: part.fileData.fileUri,
          mimeType: part.fileData.mimeType,
        }));
      } else {
        modelParts.push({ fileData: part.fileData });
      }
    }

    if (part.attachment) {
      modelParts.push(...await resolveAttachmentToModelParts(part.attachment));
    }
  }

  return modelParts.length > 0 ? modelParts : [{ text: ' ' }];
}

export async function buildModelContentsFromRequest(input: {
  history: ApiHistoryMessagePayload[];
  message: string;
  attachments?: ApiAttachmentPayload[];
}) {
  const history = await Promise.all(
    input.history.map(async (messageItem) => ({
      role: messageItem.role,
      parts: await resolveApiPartsToModelParts(messageItem.parts),
    })),
  );

  const currentParts: ModelPart[] = [{ text: input.message || ' ' }];

  for (const attachment of input.attachments || []) {
    currentParts.push(...await resolveAttachmentToModelParts(attachment));
  }

  return [...history, { role: 'user' as const, parts: currentParts }];
}
