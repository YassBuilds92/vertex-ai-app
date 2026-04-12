import type { Attachment, Message } from '../types';
import type {
  ApiAttachmentPayload,
  ApiHistoryMessagePayload,
  ApiMessagePartPayload,
} from '../../shared/chat-parts.js';

const COWORK_HISTORY_ATTACHMENT_LIMIT = 4;
const COWORK_HISTORY_ACTIVITY_LIMIT = 6;
const COWORK_HISTORY_MESSAGE_LIMIT = 8;

function stripDataUrlPrefix(value?: string) {
  if (!value) return undefined;
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

function extractDataUrlMimeType(value?: string) {
  const match = /^data:([^;,]+)(?:;[^,]*)?,/i.exec(String(value || ''));
  return match?.[1]?.trim().toLowerCase() || undefined;
}

export function buildApiAttachmentPayload(attachment: Attachment): ApiAttachmentPayload {
  const dataUrlValue = attachment.base64
    || (attachment.url.startsWith('data:') ? attachment.url : undefined);

  return {
    type: attachment.type,
    url: attachment.url,
    storageUri: attachment.storageUri,
    mimeType: attachment.mimeType
      || extractDataUrlMimeType(attachment.base64)
      || extractDataUrlMimeType(attachment.url),
    name: attachment.name,
    base64: stripDataUrlPrefix(dataUrlValue),
    thumbnail: attachment.thumbnail,
    videoMetadata: attachment.videoMetadata,
  };
}

export function buildApiAttachmentPayloads(attachments: Attachment[] = []): ApiAttachmentPayload[] {
  return attachments.map(buildApiAttachmentPayload);
}

function clipText(value?: string, max = 240) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > max ? `${trimmed.slice(0, max)}... [tronque]` : trimmed;
}

function clipHistoryText(value?: string, max = 900) {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;

  const headLength = Math.max(220, Math.floor(max * 0.62));
  const tailLength = Math.max(120, Math.floor(max * 0.22));
  const omitted = trimmed.length - headLength - tailLength;

  return [
    trimmed.slice(0, headLength),
    `... [${omitted} caracteres masques] ...`,
    trimmed.slice(-tailLength),
  ].join('\n');
}

function buildCoworkMemoryPart(message: Message): ApiMessagePartPayload | null {
  if (message.role !== 'model') return null;

  const lines: string[] = [];
  const phase = clipText(message.runMeta?.phase, 60);
  const artifactState = message.runMeta?.artifactState;
  const taskComplete = typeof message.runMeta?.taskComplete === 'boolean'
    ? (message.runMeta.taskComplete ? 'oui' : 'non')
    : null;

  if (message.runState || phase || artifactState || taskComplete !== null) {
    lines.push('[Memoire Cowork persistante]');
    if (message.runState) lines.push(`Run state: ${message.runState}`);
    if (phase) lines.push(`Phase: ${phase}`);
    if (artifactState) lines.push(`Etat artefact: ${artifactState}`);
    if (taskComplete !== null) lines.push(`Tache marquee complete: ${taskComplete}`);
  }

  const attachmentLines = (message.attachments || [])
    .filter((attachment) => attachment?.url)
    .slice(-COWORK_HISTORY_ATTACHMENT_LIMIT)
    .map((attachment) => {
      const segments = [
        attachment.type || 'document',
        clipText(attachment.name, 80),
        clipText(attachment.mimeType, 80),
        `URL: ${attachment.url}`,
      ].filter(Boolean);
      return `- ${segments.join(' | ')}`;
    });

  if (attachmentLines.length > 0) {
    if (lines.length === 0) lines.push('[Memoire Cowork persistante]');
    lines.push('Livrables et pieces jointes deja presents:');
    lines.push(...attachmentLines);
  }

  const activityLines = (message.activity || [])
    .filter((item) => item.kind === 'tool_result' || item.kind === 'warning' || item.kind === 'status')
    .slice(-COWORK_HISTORY_ACTIVITY_LIMIT)
    .map((item) => {
      const fragments = [
        item.kind,
        item.toolName ? `outil=${item.toolName}` : null,
        item.status ? `statut=${item.status}` : null,
        clipText(item.title, 100),
        clipText(item.resultPreview || item.message, 180),
      ].filter(Boolean);
      return fragments.length > 0 ? `- ${fragments.join(' | ')}` : null;
    })
    .filter((line): line is string => Boolean(line));

  if (activityLines.length > 0) {
    if (lines.length === 0) lines.push('[Memoire Cowork persistante]');
    lines.push('Dernieres etapes utiles du run precedent:');
    lines.push(...activityLines);
  }

  if (lines.length === 0) {
    return null;
  }

  return {
    text: lines.join('\n'),
  };
}

export function buildApiMessageParts(
  message: Message,
  options?: { includeCoworkMemory?: boolean; historyMode?: boolean; coworkCompact?: boolean }
): ApiMessagePartPayload[] {
  const historyText = options?.coworkCompact && options.historyMode
    ? clipHistoryText(message.content, message.role === 'model' ? 900 : 1400) || ' '
    : message.content || ' ';
  const parts: ApiMessagePartPayload[] = [{ text: historyText }];

  if (options?.includeCoworkMemory) {
    const coworkMemory = buildCoworkMemoryPart(message);
    if (coworkMemory) {
      parts.push(coworkMemory);
    }
  }

  for (const attachment of message.attachments || []) {
    if (options?.historyMode) {
      // In history mode, pass the attachment without base64 (URL/storageUri only) so the
      // backend can re-resolve it from storage. This preserves document content (e.g. PDFs)
      // across multiple conversation turns without bloating the payload with inline data.
      const payload = buildApiAttachmentPayload(attachment);
      if (payload.url || payload.storageUri) {
        parts.push({ attachment: { ...payload, base64: undefined } });
      } else {
        // No resolvable URL — fall back to a lightweight text reference.
        const label = [attachment.name, attachment.mimeType].filter(Boolean).join(' — ');
        parts.push({ text: `[Pièce jointe: ${label || attachment.type || 'fichier'}]` });
      }
    } else {
      parts.push({ attachment: buildApiAttachmentPayload(attachment) });
    }
  }

  return parts;
}

export function buildApiHistoryFromMessages(
  messages: Message[],
  options?: { includeCoworkMemory?: boolean; coworkCompact?: boolean; maxMessages?: number }
): ApiHistoryMessagePayload[] {
  const maxMessages = options?.maxMessages
    || (options?.coworkCompact ? COWORK_HISTORY_MESSAGE_LIMIT : undefined);
  const scopedMessages = maxMessages ? messages.slice(-maxMessages) : messages;

  return scopedMessages.map((message) => ({
    role: message.role,
    parts: buildApiMessageParts(message, { ...options, historyMode: true }),
  }));
}
