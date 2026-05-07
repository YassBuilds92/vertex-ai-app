import type {
  ApiAttachmentPayload,
  ApiHistoryMessagePayload,
  ApiMessagePartPayload,
} from '../../shared/chat-parts.js';
import { extractTextFromPdfBuffer } from './chunking.js';
import { tryExtractGcsUriFromUrl } from './storage.js';
import { log } from './logger.js';

type ModelPart =
  {
    text?: string;
    inlineData?: { mimeType: string; data: string };
    fileData?: { mimeType: string; fileUri: string };
    videoMetadata?: {
      startOffset?: string;
      endOffset?: string;
      fps?: number;
    };
  };

type ModelContent = {
  role: ApiHistoryMessagePayload['role'];
  parts: ModelPart[];
};

export type ModelContentsBuildDebug = {
  youtubeNativeCount: number;
  youtubeDemotedCount: number;
  youtubeCanonicalizedUrls: string[];
  youtubeDemotedUrls: string[];
  youtubeNativeHasVideoMetadata: boolean;
};

type YouTubeNativeState = ModelContentsBuildDebug & {
  nativeBudget: number;
};

const MAX_REMOTE_BINARY_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_REMOTE_TEXT_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_TEXT_ATTACHMENT_CHARS = 120_000;
const MIN_PDF_EXTRACTED_TEXT_CHARS = 120;
const YOUTUBE_PLACEHOLDERS = new Set([
  'Chargement du titre...',
  'Video YouTube',
  'VidÃ©o YouTube',
]);
const TEXT_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/ecmascript',
  'application/x-sh',
  'application/yaml',
  'application/x-yaml',
  'application/toml',
]);

function stripDataUrlPrefix(value?: string) {
  if (!value) return undefined;
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function normalizeMimeType(value?: string) {
  return String(value || '').split(';')[0].trim().toLowerCase();
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
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

function createYouTubeNativeState(nativeBudget = 1): YouTubeNativeState {
  return {
    nativeBudget,
    youtubeNativeCount: 0,
    youtubeDemotedCount: 0,
    youtubeCanonicalizedUrls: [],
    youtubeDemotedUrls: [],
    youtubeNativeHasVideoMetadata: false,
  };
}

function getYouTubeVideoId(value?: string) {
  if (!value) return null;

  try {
    const parsed = new URL(value.startsWith('http') ? value : `https://${value}`);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.replace(/\/+$/, '');

    if (hostname === 'youtu.be' || hostname.endsWith('.youtu.be')) {
      return pathname.split('/').filter(Boolean)[0] || null;
    }

    if (hostname === 'youtube.com' || hostname.endsWith('.youtube.com')) {
      const watchId = parsed.searchParams.get('v');
      if (watchId) return watchId;

      const segments = pathname.split('/').filter(Boolean);
      const index = segments.findIndex((segment) => ['shorts', 'live', 'embed'].includes(segment));
      if (index >= 0 && segments[index + 1]) return segments[index + 1];
    }
  } catch {
    return null;
  }

  return null;
}

function canonicalizeYouTubeUrl(value?: string) {
  const videoId = getYouTubeVideoId(value);
  if (!videoId || !/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return null;
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
}

function guessMimeTypeFromUrl(url?: string) {
  if (!url) return '';

  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (pathname.endsWith('.pdf')) return 'application/pdf';
    if (/\.(png|jpg|jpeg|gif|webp|bmp|svg|avif)$/.test(pathname)) {
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
    if (pathname.endsWith('.txt')) return 'text/plain';
    if (pathname.endsWith('.md') || pathname.endsWith('.markdown')) return 'text/markdown';
    if (pathname.endsWith('.csv')) return 'text/csv';
    if (pathname.endsWith('.tsv')) return 'text/tab-separated-values';
    if (pathname.endsWith('.json') || pathname.endsWith('.ndjson')) return 'application/json';
    if (pathname.endsWith('.xml')) return 'application/xml';
    if (pathname.endsWith('.html') || pathname.endsWith('.htm')) return 'text/html';
    if (/\.(js|jsx|ts|tsx|css|py|java|c|cpp|h|hpp|go|rs|sh|sql|log|ini|cfg|conf|toml|yaml|yml)$/.test(pathname)) {
      return 'text/plain';
    }
  } catch {
    return '';
  }

  return '';
}

function resolveStorageUri(attachment: ApiAttachmentPayload) {
  const storageUri = String(attachment.storageUri || '').trim();
  if (/^gs:\/\/[^/]+\/.+$/i.test(storageUri)) {
    return storageUri;
  }
  return tryExtractGcsUriFromUrl(attachment.url) || '';
}

function formatDurationSeconds(value: number) {
  const rounded = Math.round(value * 1000) / 1000;
  return `${rounded.toFixed(3).replace(/\.?0+$/, '')}s`;
}

function buildVideoMetadataFromAttachment(attachment: ApiAttachmentPayload) {
  const raw = attachment.videoMetadata;
  if (!raw) return undefined;

  const startOffsetSeconds = isFiniteNumber(raw.startOffsetSeconds) && raw.startOffsetSeconds >= 0
    ? raw.startOffsetSeconds
    : undefined;
  const endOffsetSeconds = isFiniteNumber(raw.endOffsetSeconds) && raw.endOffsetSeconds >= 0
    ? raw.endOffsetSeconds
    : undefined;
  const fps = isFiniteNumber(raw.fps) && raw.fps > 0 && raw.fps <= 24
    ? Math.round(raw.fps * 1000) / 1000
    : undefined;

  if (
    startOffsetSeconds !== undefined
    && endOffsetSeconds !== undefined
    && endOffsetSeconds <= startOffsetSeconds
  ) {
    log.warn('Ignoring invalid videoMetadata endOffset <= startOffset', {
      attachmentName: attachment.name,
      startOffsetSeconds,
      endOffsetSeconds,
    });
  }

  const videoMetadata = {
    startOffset: startOffsetSeconds !== undefined ? formatDurationSeconds(startOffsetSeconds) : undefined,
    endOffset: (
      endOffsetSeconds !== undefined
      && (startOffsetSeconds === undefined || endOffsetSeconds > startOffsetSeconds)
    )
      ? formatDurationSeconds(endOffsetSeconds)
      : undefined,
    fps,
  };

  return Object.values(videoMetadata).some((value) => value !== undefined)
    ? videoMetadata
    : undefined;
}

function attachVideoMetadata(part: ModelPart, attachment: ApiAttachmentPayload): ModelPart {
  const videoMetadata = buildVideoMetadataFromAttachment(attachment);
  if (!videoMetadata) return part;
  if (!part.fileData && !part.inlineData) return part;
  return {
    ...part,
    videoMetadata,
  };
}

function isNativeVideoPart(part: ModelPart) {
  const mimeType = normalizeMimeType(part.fileData?.mimeType || part.inlineData?.mimeType);
  return mimeType.startsWith('video/');
}

function orderModelPartsForMultimodalPrompt(parts: ModelPart[]) {
  const videoParts = parts.filter(isNativeVideoPart);
  const otherParts = parts.filter((part) => !isNativeVideoPart(part));
  return [...videoParts, ...otherParts];
}

function isInlineFriendlyMimeType(mimeType: string) {
  return mimeType.startsWith('image/')
    || mimeType.startsWith('audio/')
    || mimeType.startsWith('video/')
    || mimeType === 'application/pdf';
}

function isCloudFileDataMimeType(mimeType: string) {
  return mimeType.startsWith('image/')
    || mimeType.startsWith('audio/')
    || mimeType.startsWith('video/')
    || mimeType === 'application/pdf';
}

function isTextMimeType(mimeType: string) {
  return mimeType.startsWith('text/') || TEXT_MIME_TYPES.has(mimeType);
}

function clipText(value: string, max = MAX_TEXT_ATTACHMENT_CHARS) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...[tronque]`;
}

function buildFallbackAttachmentText(attachment: ApiAttachmentPayload) {
  const videoMetadata = buildVideoMetadataFromAttachment(attachment);
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
    attachment.storageUri ? `Storage: ${attachment.storageUri}` : null,
    attachment.url ? `URL: ${attachment.url}` : null,
    videoMetadata?.startOffset ? `Debut video: ${videoMetadata.startOffset}` : null,
    videoMetadata?.endOffset ? `Fin video: ${videoMetadata.endOffset}` : null,
    typeof videoMetadata?.fps === 'number' ? `FPS: ${videoMetadata.fps}` : null,
  ].filter(Boolean).join('\n');
}

async function fetchRemoteAttachment(url: string, fallbackMimeType: string | undefined, maxBytes: number) {
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
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new Error(`Attachment too large (${contentLength} bytes)`);
  }

  const mimeType = normalizeMimeType(
    response.headers.get('content-type') || fallbackMimeType || guessMimeTypeFromUrl(url),
  );
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > maxBytes) {
    throw new Error(`Attachment too large (${buffer.byteLength} bytes)`);
  }

  return { mimeType, buffer };
}

async function fetchRemoteInlineData(url: string, fallbackMimeType?: string) {
  const remote = await fetchRemoteAttachment(url, fallbackMimeType, MAX_REMOTE_BINARY_ATTACHMENT_BYTES);
  return {
    mimeType: remote.mimeType || normalizeMimeType(fallbackMimeType) || 'application/octet-stream',
    data: remote.buffer.toString('base64'),
  };
}

function decodeBase64Attachment(base64?: string) {
  const stripped = stripDataUrlPrefix(base64);
  if (!stripped) return null;

  try {
    return Buffer.from(stripped, 'base64');
  } catch {
    return null;
  }
}

function buildTextAttachmentPart(attachment: ApiAttachmentPayload, mimeType: string, text: string): ModelPart {
  const normalizedText = text.replace(/\u0000/g, '').trim();
  if (!normalizedText) {
    return { text: buildFallbackAttachmentText(attachment) };
  }

  return {
    text: [
      'Document texte joint.',
      attachment.name ? `Nom: ${attachment.name}` : null,
      mimeType ? `Type: ${mimeType}` : null,
      'Contenu:',
      clipText(normalizedText),
    ].filter(Boolean).join('\n'),
  };
}

function buildPdfAttachmentTextPart(
  attachment: ApiAttachmentPayload,
  text: string,
  totalPages?: number,
): ModelPart {
  const normalizedText = text.replace(/\u0000/g, '').trim();
  if (!normalizedText) {
    return { text: buildFallbackAttachmentText(attachment) };
  }

  return {
    text: [
      'Document PDF joint.',
      attachment.name ? `Nom: ${attachment.name}` : null,
      totalPages && totalPages > 0 ? `Pages: ${totalPages}` : null,
      'Texte extrait du PDF:',
      clipText(normalizedText),
    ].filter(Boolean).join('\n'),
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

async function buildDemotedYouTubeTextPart(attachment: ApiAttachmentPayload, fallbackUrl?: string): Promise<ModelPart> {
  const title = await resolveYoutubeTitle(attachment);
  return {
    text: [
      'Lien YouTube supplementaire.',
      'Note: une seule URL YouTube est envoyee comme entree video native dans cette requete; ce lien reste disponible comme contexte texte.',
      title ? `Titre: ${title}` : null,
      fallbackUrl || attachment.url ? `URL: ${fallbackUrl || attachment.url}` : null,
    ].filter(Boolean).join('\n'),
  };
}

function recordNativeYouTubePart(state: YouTubeNativeState | undefined, part: ModelPart) {
  if (!state) return;
  state.nativeBudget = Math.max(0, state.nativeBudget - 1);
  state.youtubeNativeCount += 1;
  if (part.fileData?.fileUri) {
    state.youtubeCanonicalizedUrls.push(part.fileData.fileUri);
  }
  if (part.videoMetadata) {
    state.youtubeNativeHasVideoMetadata = true;
  }
}

function recordDemotedYouTubePart(state: YouTubeNativeState | undefined, url?: string) {
  if (!state) return;
  state.youtubeDemotedCount += 1;
  if (url) state.youtubeDemotedUrls.push(url);
}

export async function resolveAttachmentToModelParts(
  attachment: ApiAttachmentPayload,
  youtubeState?: YouTubeNativeState,
): Promise<ModelPart[]> {
  const mimeType = normalizeMimeType(attachment.mimeType || guessMimeTypeFromUrl(attachment.url));
  const base64 = stripDataUrlPrefix(attachment.base64);
  const storageUri = resolveStorageUri(attachment);

  if (attachment.type === 'youtube' || looksLikeYouTubeUrl(attachment.url)) {
    const canonicalUrl = canonicalizeYouTubeUrl(attachment.url);
    if (canonicalUrl) {
      if (youtubeState && youtubeState.nativeBudget <= 0) {
        recordDemotedYouTubePart(youtubeState, canonicalUrl);
        return [await buildDemotedYouTubeTextPart(attachment, canonicalUrl)];
      }

      const nativePart = attachVideoMetadata({
        fileData: {
          mimeType: mimeType.startsWith('video/') ? mimeType : 'video/mp4',
          fileUri: canonicalUrl,
        },
      }, attachment);
      recordNativeYouTubePart(youtubeState, nativePart);
      return [nativePart];
    }

    const title = await resolveYoutubeTitle(attachment);
    return [{ text: [
      'Lien YouTube partage.',
      title ? `Titre: ${title}` : null,
      attachment.url ? `URL: ${attachment.url}` : null,
    ].filter(Boolean).join('\n') }];
  }

  if (mimeType === 'application/pdf') {
    const localBuffer = decodeBase64Attachment(base64);
    let pdfBuffer = localBuffer;

    if (!pdfBuffer && attachment.url && looksLikeHttpUrl(attachment.url)) {
      try {
        const remote = await fetchRemoteAttachment(
          attachment.url,
          mimeType,
          MAX_REMOTE_BINARY_ATTACHMENT_BYTES,
        );
        pdfBuffer = remote.buffer;
      } catch (error) {
        log.warn('PDF attachment fetch failed, falling back to native file reference', {
          url: attachment.url,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (pdfBuffer) {
      try {
        const extracted = await extractTextFromPdfBuffer(pdfBuffer);
        if (extracted.text.trim().length >= MIN_PDF_EXTRACTED_TEXT_CHARS) {
          return [buildPdfAttachmentTextPart(attachment, extracted.text, extracted.totalPages)];
        }

        log.warn('PDF text extraction returned too little text, keeping native PDF fallback', {
          name: attachment.name,
          totalPages: extracted.totalPages,
          extractedChars: extracted.text.trim().length,
        });
      } catch (error) {
        log.warn('PDF text extraction failed, keeping native PDF fallback', {
          name: attachment.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (mimeType && isTextMimeType(mimeType)) {
    const localBuffer = decodeBase64Attachment(base64);
    if (localBuffer) {
      return [buildTextAttachmentPart(attachment, mimeType, localBuffer.toString('utf8'))];
    }

    if (attachment.url && looksLikeHttpUrl(attachment.url)) {
      try {
        const remote = await fetchRemoteAttachment(attachment.url, mimeType, MAX_REMOTE_TEXT_ATTACHMENT_BYTES);
        return [buildTextAttachmentPart(attachment, remote.mimeType || mimeType, remote.buffer.toString('utf8'))];
      } catch (error) {
        log.warn('Text attachment fetch failed, falling back to text context', {
          url: attachment.url,
          mimeType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (storageUri && mimeType && isCloudFileDataMimeType(mimeType)) {
    return [attachVideoMetadata({ fileData: { mimeType, fileUri: storageUri } }, attachment)];
  }

  if (base64 && mimeType && isInlineFriendlyMimeType(mimeType)) {
    return [attachVideoMetadata({ inlineData: { mimeType, data: base64 } }, attachment)];
  }

  if (attachment.url && looksLikeHttpUrl(attachment.url) && mimeType && isInlineFriendlyMimeType(mimeType)) {
    try {
      return [attachVideoMetadata({
        inlineData: await fetchRemoteInlineData(attachment.url, mimeType),
      }, attachment)];
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

export async function resolveApiPartsToModelParts(
  parts: ApiMessagePartPayload[],
  youtubeState?: YouTubeNativeState,
): Promise<ModelPart[]> {
  const modelParts: ModelPart[] = [];

  for (const part of parts) {
    if (part.text) {
      modelParts.push({ text: part.text });
    }

    if (part.inlineData) {
      modelParts.push({ inlineData: part.inlineData });
    }

    if (part.fileData) {
      if (looksLikeHttpUrl(part.fileData.fileUri) && looksLikeYouTubeUrl(part.fileData.fileUri)) {
        const canonicalUrl = canonicalizeYouTubeUrl(part.fileData.fileUri);
        if (canonicalUrl && youtubeState && youtubeState.nativeBudget <= 0) {
          recordDemotedYouTubePart(youtubeState, canonicalUrl);
          modelParts.push(await buildDemotedYouTubeTextPart({
            type: 'youtube',
            url: canonicalUrl,
            mimeType: part.fileData.mimeType,
          }, canonicalUrl));
          continue;
        }

        const nativePart = {
          fileData: {
            mimeType: part.fileData.mimeType || 'video/mp4',
            fileUri: canonicalUrl || part.fileData.fileUri,
          },
          ...(part.videoMetadata ? { videoMetadata: part.videoMetadata } : {}),
        };
        recordNativeYouTubePart(youtubeState, nativePart);
        modelParts.push(nativePart);
      } else if (looksLikeHttpUrl(part.fileData.fileUri)) {
        modelParts.push(...await resolveAttachmentToModelParts({
          type: looksLikeYouTubeUrl(part.fileData.fileUri) ? 'youtube' : 'document',
          url: part.fileData.fileUri,
          mimeType: part.fileData.mimeType,
        }, youtubeState));
      } else {
        modelParts.push({
          fileData: part.fileData,
          ...(part.videoMetadata ? { videoMetadata: part.videoMetadata } : {}),
        });
      }
    }

    if (part.attachment) {
      modelParts.push(...await resolveAttachmentToModelParts(part.attachment, youtubeState));
    }
  }

  return modelParts.length > 0 ? orderModelPartsForMultimodalPrompt(modelParts) : [{ text: ' ' }];
}

export async function buildModelContentsFromRequestWithDebug(input: {
  history: ApiHistoryMessagePayload[];
  message: string;
  attachments?: ApiAttachmentPayload[];
}): Promise<{ contents: ModelContent[]; debug: ModelContentsBuildDebug }> {
  const youtubeState = createYouTubeNativeState(1);
  const currentAttachmentParts: ModelPart[] = [];

  for (const attachment of input.attachments || []) {
    currentAttachmentParts.push(...await resolveAttachmentToModelParts(attachment, youtubeState));
  }

  const history = await Promise.all(
    input.history.map(async (messageItem) => ({
      role: messageItem.role,
      parts: await resolveApiPartsToModelParts(messageItem.parts, youtubeState),
    })),
  );

  const currentParts = orderModelPartsForMultimodalPrompt([
    { text: input.message || ' ' },
    ...currentAttachmentParts,
  ]);

  return {
    contents: [...history, { role: 'user' as const, parts: currentParts }],
    debug: {
      youtubeNativeCount: youtubeState.youtubeNativeCount,
      youtubeDemotedCount: youtubeState.youtubeDemotedCount,
      youtubeCanonicalizedUrls: youtubeState.youtubeCanonicalizedUrls,
      youtubeDemotedUrls: youtubeState.youtubeDemotedUrls,
      youtubeNativeHasVideoMetadata: youtubeState.youtubeNativeHasVideoMetadata,
    },
  };
}

export async function buildModelContentsFromRequest(input: {
  history: ApiHistoryMessagePayload[];
  message: string;
  attachments?: ApiAttachmentPayload[];
}) {
  return (await buildModelContentsFromRequestWithDebug(input)).contents;
}
