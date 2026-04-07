import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const SESSION_ROOT = path.join(os.tmpdir(), 'cowork-workers-sessions');
const SESSION_TTL_MS = 60 * 60 * 1000;

function isSubPath(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function sanitizeSessionId(value) {
  const clean = String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96);

  return clean || `session-${randomUUID()}`;
}

export function getSessionRootDirectory(sessionId) {
  return path.join(SESSION_ROOT, sanitizeSessionId(sessionId));
}

function getSessionMetaDirectory(sessionId) {
  return path.join(getSessionRootDirectory(sessionId), '.meta');
}

function getSessionWorkspaceDirectory(sessionId) {
  return path.join(getSessionRootDirectory(sessionId), 'workspace');
}

function getSessionVenvDirectory(sessionId) {
  return path.join(getSessionRootDirectory(sessionId), 'venv');
}

function getSessionManifestPath(sessionId) {
  return path.join(getSessionMetaDirectory(sessionId), 'session.json');
}

async function ensureDirectory(directoryPath) {
  await fs.mkdir(directoryPath, { recursive: true });
}

async function loadSessionManifest(sessionId) {
  const manifestPath = getSessionManifestPath(sessionId);

  try {
    const raw = await fs.readFile(manifestPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Manifest sandbox invalide.');
    }
    return parsed;
  } catch {
    return {
      sessionId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      installedPackages: [],
    };
  }
}

export async function saveSessionManifest(session) {
  session.manifest.updatedAt = Date.now();
  await ensureDirectory(session.metaDirectory);
  await fs.writeFile(
    getSessionManifestPath(session.sessionId),
    JSON.stringify(session.manifest, null, 2),
    'utf8',
  );
}

export function getSessionPythonPath(session) {
  return process.platform === 'win32'
    ? path.join(session.venvDirectory, 'Scripts', 'python.exe')
    : path.join(session.venvDirectory, 'bin', 'python');
}

export async function ensureSession(sessionId) {
  const normalizedSessionId = sanitizeSessionId(sessionId);
  const rootDirectory = getSessionRootDirectory(normalizedSessionId);
  const metaDirectory = getSessionMetaDirectory(normalizedSessionId);
  const workspaceDirectory = getSessionWorkspaceDirectory(normalizedSessionId);
  const venvDirectory = getSessionVenvDirectory(normalizedSessionId);
  const manifest = await loadSessionManifest(normalizedSessionId);

  await ensureDirectory(metaDirectory);
  await ensureDirectory(workspaceDirectory);
  await ensureDirectory(path.join(rootDirectory, 'tmp'));

  const session = {
    sessionId: normalizedSessionId,
    rootDirectory,
    metaDirectory,
    workspaceDirectory,
    venvDirectory,
    manifest,
  };

  await saveSessionManifest(session);
  return session;
}

export function resolveWorkspacePath(session, relativePath = '.') {
  const requested = String(relativePath || '.').trim();
  if (!requested || requested === '.') {
    return session.workspaceDirectory;
  }
  if (path.isAbsolute(requested)) {
    throw new Error(`Chemin sandbox absolu interdit: ${requested}`);
  }

  const absolutePath = path.resolve(session.workspaceDirectory, requested);
  if (!isSubPath(session.workspaceDirectory, absolutePath)) {
    throw new Error(`Chemin sandbox invalide: ${requested}`);
  }

  return absolutePath;
}

async function walkWorkspace(directoryPath, rootDirectory, output) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    const relativePath = path.relative(rootDirectory, absolutePath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      await walkWorkspace(absolutePath, rootDirectory, output);
      continue;
    }

    const stats = await fs.stat(absolutePath);
    output.set(relativePath, {
      sizeBytes: stats.size,
      mtimeMs: stats.mtimeMs,
    });
  }
}

export async function snapshotWorkspace(session) {
  const snapshot = new Map();
  await walkWorkspace(session.workspaceDirectory, session.workspaceDirectory, snapshot);
  return snapshot;
}

export function diffWorkspaceSnapshots(beforeSnapshot, afterSnapshot) {
  const changedFiles = [];

  for (const [relativePath, metadata] of afterSnapshot.entries()) {
    const previous = beforeSnapshot.get(relativePath);
    if (!previous) {
      changedFiles.push(relativePath);
      continue;
    }

    if (previous.sizeBytes !== metadata.sizeBytes || previous.mtimeMs !== metadata.mtimeMs) {
      changedFiles.push(relativePath);
    }
  }

  return changedFiles.sort();
}

export async function cleanupSession(sessionId) {
  const rootDirectory = getSessionRootDirectory(sessionId);
  await fs.rm(rootDirectory, { recursive: true, force: true });
}

export async function cleanupStaleSessions(options = {}) {
  const ttlMs = Number(options.ttlMs || SESSION_TTL_MS);
  await ensureDirectory(SESSION_ROOT);
  const entries = await fs.readdir(SESSION_ROOT, { withFileTypes: true });
  const now = Date.now();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const absolutePath = path.join(SESSION_ROOT, entry.name);
    try {
      const stats = await fs.stat(absolutePath);
      if (now - stats.mtimeMs > ttlMs) {
        await fs.rm(absolutePath, { recursive: true, force: true });
      }
    } catch {
      // Ignore best-effort cleanup failures.
    }
  }
}

export const __sandboxSessionInternals = {
  SESSION_ROOT,
  getSessionRootDirectory,
  sanitizeSessionId,
};
