import { StudioAgent } from '../types';

const AGENT_LOCAL_STORAGE_KEY = 'studio-pro-agents-v1';
const MAX_LOCAL_AGENTS_PER_USER = 48;

type AgentSnapshotStore = Record<string, Record<string, StudioAgent>>;

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

function normalizeAgent(agent: StudioAgent): StudioAgent {
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

export function saveLocalAgent(userId: string, agent: StudioAgent) {
  if (!userId || !agent?.id) return;

  const store = readAgentSnapshotStore();
  const userAgents = store[userId] || {};
  userAgents[agent.id] = normalizeAgent(agent);
  store[userId] = pruneAgentsByUser(userAgents);
  writeAgentSnapshotStore(store);
}

export function mergeAgentsWithLocal(userId: string, remoteAgents: StudioAgent[]): StudioAgent[] {
  const merged = new Map<string, StudioAgent>();

  for (const agent of loadLocalAgents(userId)) {
    merged.set(agent.id, agent);
  }

  for (const agent of remoteAgents) {
    const normalized = normalizeAgent(agent);
    merged.set(normalized.id, normalized);
    saveLocalAgent(userId, normalized);
  }

  return Array.from(merged.values()).sort((left, right) => right.updatedAt - left.updatedAt);
}
