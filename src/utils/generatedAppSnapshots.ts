import { GeneratedAppManifest } from '../types';

const GENERATED_APP_LOCAL_STORAGE_KEY = 'studio-pro-generated-apps-v1';
const MAX_LOCAL_APPS_PER_USER = 32;

type GeneratedAppSnapshotStore = Record<string, Record<string, GeneratedAppManifest>>;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readStore(): GeneratedAppSnapshotStore {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(GENERATED_APP_LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as GeneratedAppSnapshotStore : {};
  } catch {
    return {};
  }
}

function writeStore(store: GeneratedAppSnapshotStore) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(GENERATED_APP_LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore local quota failures.
  }
}

export function normalizeGeneratedApp(manifest: GeneratedAppManifest): GeneratedAppManifest {
  return {
    ...manifest,
    createdAt: Number(manifest.createdAt || Date.now()),
    updatedAt: Number(manifest.updatedAt || Date.now()),
    uiSchema: Array.isArray(manifest.uiSchema) ? manifest.uiSchema : [],
    toolAllowList: Array.isArray(manifest.toolAllowList) ? manifest.toolAllowList : [],
    capabilities: Array.isArray(manifest.capabilities) ? manifest.capabilities : [],
  };
}

function pruneApps(appsById: Record<string, GeneratedAppManifest>) {
  return Object.fromEntries(
    Object.entries(appsById)
      .map(([id, app]) => [id, normalizeGeneratedApp(app)] as const)
      .sort(([, left], [, right]) => (right.updatedAt || 0) - (left.updatedAt || 0))
      .slice(0, MAX_LOCAL_APPS_PER_USER)
  ) as Record<string, GeneratedAppManifest>;
}

export function loadLocalGeneratedApps(userId: string): GeneratedAppManifest[] {
  if (!userId) return [];

  return Object.values(readStore()[userId] || {})
    .map(normalizeGeneratedApp)
    .sort((left, right) => right.updatedAt - left.updatedAt);
}

export function saveLocalGeneratedApp(userId: string, manifest: GeneratedAppManifest) {
  if (!userId || !manifest?.id) return;

  const store = readStore();
  const userApps = store[userId] || {};
  userApps[manifest.id] = normalizeGeneratedApp(manifest);
  store[userId] = pruneApps(userApps);
  writeStore(store);
}

export function mergeGeneratedAppsWithLocal(userId: string, remoteApps: GeneratedAppManifest[]): GeneratedAppManifest[] {
  const merged = new Map<string, GeneratedAppManifest>();

  for (const app of loadLocalGeneratedApps(userId)) {
    merged.set(app.id, app);
  }

  for (const app of remoteApps) {
    const normalized = normalizeGeneratedApp(app);
    merged.set(normalized.id, normalized);
    saveLocalGeneratedApp(userId, normalized);
  }

  return Array.from(merged.values()).sort((left, right) => right.updatedAt - left.updatedAt);
}
