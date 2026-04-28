import { StudioAgent } from '../types';

const AGENT_LOCAL_STORAGE_KEY = 'studio-pro-agents-v1';
const AGENT_PENDING_REMOTE_STORAGE_KEY = 'studio-pro-agents-pending-v1';
const MAX_LOCAL_AGENTS_PER_USER = 48;
const MAX_PENDING_AGENT_IDS_PER_USER = 96;

type AgentSnapshotStore = Record<string, Record<string, StudioAgent>>;
type PendingAgentStore = Record<string, Record<string, number>>;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readAgentSnapshotStore(): AgentSnapshotStore {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(AGENT_LOCAL_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as AgentSnapshotStore;
  } catch {
    return {};
  }
}

function writeAgentSnapshotStore(store: AgentSnapshotStore) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(AGENT_LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore localStorage quota failures. Firestore remains preferred when available.
  }
}

function readPendingAgentStore(): PendingAgentStore {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(AGENT_PENDING_REMOTE_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as PendingAgentStore;
  } catch {
    return {};
  }
}

function writePendingAgentStore(store: PendingAgentStore) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(AGENT_PENDING_REMOTE_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore local queue failures. Firestore writes still run directly.
  }
}

function prunePendingAgentIdsByUser(recordsById: Record<string, number>) {
  return Object.fromEntries(
    Object.entries(recordsById)
      .sort(([, leftUpdatedAt], [, rightUpdatedAt]) => rightUpdatedAt - leftUpdatedAt)
      .slice(0, MAX_PENDING_AGENT_IDS_PER_USER)
  ) as Record<string, number>;
}

function setAgentPendingRemote(userId: string, agentId: string, pendingRemote: boolean) {
  if (!userId || !agentId) return;

  const store = readPendingAgentStore();
  const userRecords = store[userId] || {};

  if (pendingRemote) {
    userRecords[agentId] = Date.now();
  } else {
    delete userRecords[agentId];
  }

  if (Object.keys(userRecords).length === 0) {
    delete store[userId];
  } else {
    store[userId] = prunePendingAgentIdsByUser(userRecords);
  }

  writePendingAgentStore(store);
}

export function normalizeAgent(agent: StudioAgent): StudioAgent {
  return {
    ...agent,
    createdAt: Number(agent.createdAt || Date.now()),
    updatedAt: Number(agent.updatedAt || Date.now()),
    uiSchema: Array.isArray(agent.uiSchema) ? agent.uiSchema : [],
    tools: Array.isArray(agent.tools) ? agent.tools : [],
    capabilities: Array.isArray(agent.capabilities) ? agent.capabilities : [],
    status: agent.status || 'ready',
    createdBy: agent.createdBy || 'manual',
  };
}

function pruneAgentsByUser(agentsById: Record<string, StudioAgent>) {
  const normalizedEntries = Object.entries(agentsById)
    .map(([id, agent]) => [id, normalizeAgent(agent)] as const)
    .sort(([, left], [, right]) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .slice(0, MAX_LOCAL_AGENTS_PER_USER);

  return Object.fromEntries(normalizedEntries) as Record<string, StudioAgent>;
}

export function loadLocalAgents(userId: string): StudioAgent[] {
  if (!userId) return [];

  const userAgents = readAgentSnapshotStore()[userId] || {};
  return Object.values(userAgents)
    .map(normalizeAgent)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function saveLocalAgent(
  userId: string,
  agent: StudioAgent,
  options?: { pendingRemote?: boolean }
) {
  return saveLocalAgentSnapshot(userId, agent, options);
}

export function saveLocalAgentSnapshot(
  userId: string,
  agent: StudioAgent,
  options?: { pendingRemote?: boolean }
) {
  if (!userId || !agent?.id) return;

  const store = readAgentSnapshotStore();
  const userAgents = store[userId] || {};
  userAgents[agent.id] = normalizeAgent(agent);
  store[userId] = pruneAgentsByUser(userAgents);
  writeAgentSnapshotStore(store);

  if (options?.pendingRemote !== undefined) {
    setAgentPendingRemote(userId, agent.id, options.pendingRemote);
  }
}

export function loadPendingLocalAgents(userId: string): StudioAgent[] {
  if (!userId) return [];

  const pendingIds = readPendingAgentStore()[userId] || {};
  const pendingIdSet = new Set(Object.keys(pendingIds));
  if (pendingIdSet.size === 0) return [];

  return loadLocalAgents(userId)
    .filter((agent) => pendingIdSet.has(agent.id))
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function markLocalAgentSynced(userId: string, agentId: string) {
  setAgentPendingRemote(userId, agentId, false);
}

export function mergeAgentsWithLocal(userId: string, remoteAgents: StudioAgent[]): StudioAgent[] {
  const merged = new Map<string, StudioAgent>();

  for (const agent of loadLocalAgents(userId)) {
    merged.set(agent.id, agent);
  }

  for (const agent of remoteAgents) {
    const normalized = normalizeAgent(agent);
    merged.set(normalized.id, normalized);
    saveLocalAgentSnapshot(userId, normalized, { pendingRemote: false });
  }

  return Array.from(merged.values()).sort((left, right) => right.updatedAt - left.updatedAt);
}
