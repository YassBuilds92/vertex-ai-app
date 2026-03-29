import type { Attachment, Message } from '../types';
import type {
  ApiAttachmentPayload,
  ApiHistoryMessagePayload,
  ApiMessagePartPayload,
} from '../../shared/chat-parts.js';

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

export function buildApiMessageParts(message: Pick<Message, 'content' | 'attachments'>): ApiMessagePartPayload[] {
  const parts: ApiMessagePartPayload[] = [{ text: message.content || ' ' }];

  for (const attachment of message.attachments || []) {
    parts.push({ attachment: buildApiAttachmentPayload(attachment) });
  }

  return parts;
}

export function buildApiHistoryFromMessages(messages: Message[]): ApiHistoryMessagePayload[] {
  return messages.map((message) => ({
    role: message.role,
    parts: buildApiMessageParts(message),
  }));
}
