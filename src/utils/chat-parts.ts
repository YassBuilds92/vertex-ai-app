import type { Attachment, Message } from '../types';
import type {
  ApiAttachmentPayload,
  ApiHistoryMessagePayload,
  ApiMessagePartPayload,
} from '../../shared/chat-parts.js';

const COWORK_HISTORY_ATTACHMENT_LIMIT = 4;
const COWORK_HISTORY_ACTIVITY_LIMIT = 6;

function stripDataUrlPrefix(value?: string) {
  if (!value) return undefined;
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

export function buildApiAttachmentPayload(attachment: Attachment): ApiAttachmentPayload {
  return {
    type: attachment.type,
    url: attachment.url,
    mimeType: attachment.mimeType,
    name: attachment.name,
    base64: stripDataUrlPrefix(attachment.base64),
    thumbnail: attachment.thumbnail,
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
  options?: { includeCoworkMemory?: boolean }
): ApiMessagePartPayload[] {
  const parts: ApiMessagePartPayload[] = [{ text: message.content || ' ' }];

  if (options?.includeCoworkMemory) {
    const coworkMemory = buildCoworkMemoryPart(message);
    if (coworkMemory) {
      parts.push(coworkMemory);
    }
  }

  for (const attachment of message.attachments || []) {
    parts.push({ attachment: buildApiAttachmentPayload(attachment) });
  }

  return parts;
}

export function buildApiHistoryFromMessages(
  messages: Message[],
  options?: { includeCoworkMemory?: boolean }
): ApiHistoryMessagePayload[] {
  return messages.map((message) => ({
    role: message.role,
    parts: buildApiMessageParts(message, options),
  }));
}
