import { Message } from '../types';

const MAX_LOCAL_SNAPSHOTS_PER_SESSION = 48;
const MAX_CONTENT_CHARS = 24000;
const MAX_THOUGHT_CHARS = 16000;
const SESSION_LOCAL_STORAGE_KEY = 'studio-pro-session-snapshots-v1';

type SessionLocalSnapshots = Record<string, Record<string, Record<string, Message>>>;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function clipText(value?: string, max = MAX_CONTENT_CHARS): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}... [tronque]` : value;
}

function readSessionLocalSnapshots(): SessionLocalSnapshots {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(SESSION_LOCAL_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as SessionLocalSnapshots;
  } catch {
    return {};
  }
}

function writeSessionLocalSnapshots(store: SessionLocalSnapshots) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(SESSION_LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota or serialization failures. Firestore remains the source of truth.
  }
}

function pruneSessionSnapshots(messagesById: Record<string, Message>) {
  const entries = Object.entries(messagesById)
    .sort(([, left], [, right]) => right.createdAt - left.createdAt)
    .slice(0, MAX_LOCAL_SNAPSHOTS_PER_SESSION);

  return Object.fromEntries(entries);
}

function pickLongerText(current?: string, fallback?: string) {
  if (!current) return fallback;
  if (!fallback) return current;
  return fallback.length > current.length ? fallback : current;
}

function sanitizeMessageForSnapshot(message: Message): Message {
  return {
    ...message,
    content: clipText(message.content, MAX_CONTENT_CHARS) || '',
    thoughts: clipText(message.thoughts, MAX_THOUGHT_CHARS),
  };
}

function mergeMessage(current: Message, snapshot: Message): Message {
  return {
    ...snapshot,
    ...current,
    content: pickLongerText(current.content, snapshot.content) || '',
    thoughts: pickLongerText(current.thoughts, snapshot.thoughts),
    attachments: (current.attachments?.length ?? 0) > 0 ? current.attachments : snapshot.attachments,
    images: (current.images?.length ?? 0) > 0 ? current.images : snapshot.images,
    thoughtImages: (current.thoughtImages?.length ?? 0) > 0 ? current.thoughtImages : snapshot.thoughtImages,
    audio: current.audio || snapshot.audio,
    video: current.video || snapshot.video,
    refinedInstruction: current.refinedInstruction || snapshot.refinedInstruction,
  };
}

export function saveSessionSnapshot(userId: string, sessionId: string, message: Message) {
  if (!userId || !sessionId || !message.id) return;

  const store = readSessionLocalSnapshots();
  const userSnapshots = store[userId] || {};
  const sessionSnapshots = userSnapshots[sessionId] || {};

  sessionSnapshots[message.id] = sanitizeMessageForSnapshot(message);
  userSnapshots[sessionId] = pruneSessionSnapshots(sessionSnapshots);
  store[userId] = userSnapshots;

  writeSessionLocalSnapshots(store);
}

export function clearSessionSnapshots(userId: string, sessionId: string, messageIds?: string[]) {
  if (!userId || !sessionId) return;

  const store = readSessionLocalSnapshots();
  const userSnapshots = store[userId];
  if (!userSnapshots || !userSnapshots[sessionId]) return;

  if (!messageIds || messageIds.length === 0) {
    delete userSnapshots[sessionId];
  } else {
    for (const messageId of messageIds) {
      delete userSnapshots[sessionId][messageId];
    }

    if (Object.keys(userSnapshots[sessionId]).length === 0) {
      delete userSnapshots[sessionId];
    }
  }

  if (Object.keys(userSnapshots).length === 0) {
    delete store[userId];
  } else {
    store[userId] = userSnapshots;
  }

  writeSessionLocalSnapshots(store);
}

export function hydrateSessionMessages(messages: Message[], userId: string, sessionId: string): Message[] {
  if (!userId || !sessionId) return messages;

  const store = readSessionLocalSnapshots();
  const sessionSnapshots = store[userId]?.[sessionId];
  if (!sessionSnapshots) return messages;

  const merged = new Map<string, Message>();

  for (const message of messages) {
    const snapshot = sessionSnapshots[message.id];
    merged.set(message.id, snapshot ? mergeMessage(message, snapshot) : message);
  }

  for (const [messageId, snapshot] of Object.entries(sessionSnapshots)) {
    if (!merged.has(messageId)) {
      merged.set(messageId, snapshot);
    }
  }

  return Array.from(merged.values()).sort((left, right) => left.createdAt - right.createdAt);
}

export function loadLocalSessionSnapshotEntries(userId: string): Array<{ sessionId: string; messages: Message[] }> {
  if (!userId) return [];

  const store = readSessionLocalSnapshots();
  const userSnapshots = store[userId];
  if (!userSnapshots) return [];

  return Object.entries(userSnapshots)
    .map(([sessionId, messagesById]) => ({
      sessionId,
      messages: Object.values(messagesById).sort((left, right) => left.createdAt - right.createdAt),
    }))
    .filter((entry) => entry.messages.length > 0)
    .sort((left, right) => {
      const leftUpdatedAt = left.messages[left.messages.length - 1]?.createdAt || 0;
      const rightUpdatedAt = right.messages[right.messages.length - 1]?.createdAt || 0;
      return rightUpdatedAt - leftUpdatedAt;
    });
}
