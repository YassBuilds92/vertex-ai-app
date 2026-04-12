const LEGACY_STORAGE_RESET_MARKER_KEY = 'studio-pro-storage-reset-applied-v1';
const STORAGE_RESET_MARKER_KEY = 'studio-pro-storage-reset-applied-v2';

type IndexedDbFactoryWithDatabases = IDBFactory & {
  databases?: () => Promise<Array<{ name?: string | null }>>;
};

export interface StorageResetSummary {
  hadStoredState: boolean;
  localStorageKeysCleared: number;
  sessionStorageKeysCleared: number;
  indexedDbDatabasesDeleted: number;
  cacheBucketsDeleted: number;
  cookiesCleared: number;
}

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

function getStorageKeys(storage: Storage | undefined) {
  if (!storage) return [] as string[];

  const keys: string[] = [];
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (typeof key === 'string' && key.length > 0) {
      keys.push(key);
    }
  }
  return keys;
}

function clearAccessibleCookies() {
  if (typeof document === 'undefined') return 0;

  const rawCookies = document.cookie
    .split(';')
    .map((cookie) => cookie.trim())
    .filter(Boolean);

  if (rawCookies.length === 0) return 0;

  for (const rawCookie of rawCookies) {
    const separatorIndex = rawCookie.indexOf('=');
    const cookieName = separatorIndex >= 0 ? rawCookie.slice(0, separatorIndex) : rawCookie;
    if (!cookieName) continue;

    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  }

  return rawCookies.length;
}

async function listIndexedDbNames() {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') {
    return [] as string[];
  }

  const indexedDb = window.indexedDB as IndexedDbFactoryWithDatabases;
  if (typeof indexedDb.databases !== 'function') {
    return [] as string[];
  }

  try {
    const databases = await indexedDb.databases();
    return databases
      .map((database) => database?.name)
      .filter((name): name is string => typeof name === 'string' && name.length > 0);
  } catch {
    return [] as string[];
  }
}

async function deleteIndexedDb(name: string) {
  if (typeof window === 'undefined' || typeof window.indexedDB === 'undefined') return false;

  return new Promise<boolean>((resolve) => {
    try {
      const request = window.indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve(true);
      request.onerror = () => resolve(false);
      request.onblocked = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function clearCacheStorage() {
  if (typeof window === 'undefined' || typeof window.caches === 'undefined') {
    return 0;
  }

  try {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    return cacheNames.length;
  } catch {
    return 0;
  }
}

export async function clearAllStudioBrowserStorage(): Promise<StorageResetSummary> {
  const localStorageKeys = canUseLocalStorage() ? getStorageKeys(window.localStorage) : [];
  const sessionStorageKeys = canUseSessionStorage() ? getStorageKeys(window.sessionStorage) : [];
  const indexedDbNames = await listIndexedDbNames();
  const cacheBucketNames =
    typeof window !== 'undefined' && typeof window.caches !== 'undefined'
      ? await window.caches.keys().catch(() => [] as string[])
      : [];

  let localStorageKeysCleared = 0;
  let sessionStorageKeysCleared = 0;

  if (canUseLocalStorage()) {
    localStorageKeysCleared = localStorageKeys.length;
    window.localStorage.clear();
  }

  if (canUseSessionStorage()) {
    sessionStorageKeysCleared = sessionStorageKeys.length;
    window.sessionStorage.clear();
  }

  const indexedDbResults = await Promise.all(indexedDbNames.map((name) => deleteIndexedDb(name)));
  const cacheBucketsDeleted = await clearCacheStorage();
  const cookiesCleared = clearAccessibleCookies();

  return {
    hadStoredState:
      localStorageKeysCleared > 0 ||
      sessionStorageKeysCleared > 0 ||
      indexedDbNames.length > 0 ||
      cacheBucketNames.length > 0 ||
      cookiesCleared > 0,
    localStorageKeysCleared,
    sessionStorageKeysCleared,
    indexedDbDatabasesDeleted: indexedDbResults.filter(Boolean).length,
    cacheBucketsDeleted,
    cookiesCleared,
  };
}

export function getAppliedStorageResetVersion() {
  if (!canUseLocalStorage()) return null;
  return window.localStorage.getItem(STORAGE_RESET_MARKER_KEY);
}

export function setAppliedStorageResetVersion(version: string) {
  if (!canUseLocalStorage()) return;
  window.localStorage.setItem(LEGACY_STORAGE_RESET_MARKER_KEY, version);
  window.localStorage.setItem(STORAGE_RESET_MARKER_KEY, version);
}
