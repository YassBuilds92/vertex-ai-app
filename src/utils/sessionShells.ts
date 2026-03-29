import { ChatSession } from '../types';

const SESSION_SHELLS_LOCAL_STORAGE_KEY = 'studio-pro-session-shells-v1';
const MAX_LOCAL_SESSION_SHELLS_PER_USER = 96;

type SessionShellRecord = {
  session: ChatSession;
  pendingRemote: boolean;
};

type SessionShellStore = Record<string, Record<string, SessionShellRecord>>;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readSessionShellStore(): SessionShellStore {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(SESSION_SHELLS_LOCAL_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as SessionShellStore;
  } catch {
    return {};
  }
}

function writeSessionShellStore(store: SessionShellStore) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(SESSION_SHELLS_LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore local cache failures. Firestore remains preferred when available.
  }
}

function normalizeSessionShell(session: ChatSession): ChatSession {
  return {
    ...session,
    title: typeof session.title === 'string' && session.title.trim().length > 0
      ? session.title
      : 'Nouvelle conversation',
    updatedAt: Number(session.updatedAt || Date.now()),
    mode: session.mode || 'chat',
    userId: session.userId || '',
    systemInstruction: typeof session.systemInstruction === 'string' ? session.systemInstruction : '',
    systemPromptHistory: Array.isArray(session.systemPromptHistory) ? session.systemPromptHistory : undefined,
    sessionKind: session.sessionKind === 'agent' ? 'agent' : 'standard',
    agentWorkspace: session.agentWorkspace,
    messages: [],
  };
}

function pruneSessionShellsByUser(recordsById: Record<string, SessionShellRecord>) {
  const normalizedEntries = Object.entries(recordsById)
    .map(([id, record]) => [
      id,
      {
        pendingRemote: Boolean(record?.pendingRemote),
        session: normalizeSessionShell(record?.session as ChatSession),
      },
    ] as const)
    .sort(([, left], [, right]) => right.session.updatedAt - left.session.updatedAt)
    .slice(0, MAX_LOCAL_SESSION_SHELLS_PER_USER);

  return Object.fromEntries(normalizedEntries) as Record<string, SessionShellRecord>;
}

function readUserSessionShellRecords(userId: string) {
  return readSessionShellStore()[userId] || {};
}

export function loadLocalSessionShells(userId: string): ChatSession[] {
  if (!userId) return [];

  return Object.values(readUserSessionShellRecords(userId))
    .map((record) => normalizeSessionShell(record.session))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function saveLocalSessionShell(
  userId: string,
  session: ChatSession,
  options?: { pendingRemote?: boolean }
) {
  if (!userId || !session?.id) return;

  const store = readSessionShellStore();
  const userRecords = store[userId] || {};
  userRecords[session.id] = {
    session: normalizeSessionShell(session),
    pendingRemote: options?.pendingRemote ?? userRecords[session.id]?.pendingRemote ?? false,
  };
  store[userId] = pruneSessionShellsByUser(userRecords);
  writeSessionShellStore(store);
}

export function removeLocalSessionShell(userId: string, sessionId: string) {
  if (!userId || !sessionId) return;

  const store = readSessionShellStore();
  const userRecords = store[userId];
  if (!userRecords || !userRecords[sessionId]) return;

  delete userRecords[sessionId];

  if (Object.keys(userRecords).length === 0) {
    delete store[userId];
  } else {
    store[userId] = userRecords;
  }

  writeSessionShellStore(store);
}

export function mergeSessionsWithLocal(userId: string, remoteSessions: ChatSession[]): ChatSession[] {
  const remoteById = new Map<string, ChatSession>();
  for (const session of remoteSessions) {
    remoteById.set(session.id, normalizeSessionShell(session));
  }

  const localRecords = readUserSessionShellRecords(userId);
  const merged = new Map<string, ChatSession>();

  for (const [sessionId, record] of Object.entries(localRecords)) {
    if (record?.pendingRemote && !remoteById.has(sessionId)) {
      merged.set(sessionId, normalizeSessionShell(record.session));
    }
  }

  for (const session of remoteById.values()) {
    merged.set(session.id, session);
    saveLocalSessionShell(userId, session, { pendingRemote: false });
  }

  return Array.from(merged.values()).sort((left, right) => right.updatedAt - left.updatedAt);
}
