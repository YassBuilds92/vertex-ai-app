import fs from 'node:fs/promises';
import path from 'node:path';

import {
  deleteObjectPrefix,
  downloadObjectFromBucket,
  getDefaultWorkspaceBucket,
  listObjectPaths,
  tryDownloadObjectFromBucket,
  uploadBufferToWorkspace,
} from '../lib/gcs.js';
import { resolveWorkspacePath, saveSessionManifest } from './sessions.js';

const SESSION_PERSISTENCE_PREFIX = 'sandbox-sessions';

function isSessionPersistenceEnabled() {
  return String(process.env.COWORK_SANDBOX_PERSIST_SESSIONS || '').trim() === '1';
}

function getPersistenceBucketName() {
  return String(process.env.COWORK_SANDBOX_PERSIST_BUCKET || getDefaultWorkspaceBucket() || '').trim();
}

function getSessionPrefix(session) {
  return `${SESSION_PERSISTENCE_PREFIX}/${session.sessionId}`;
}

function getManifestObjectPath(session) {
  return `${getSessionPrefix(session)}/manifest.json`;
}

function getWorkspacePrefix(session) {
  return `${getSessionPrefix(session)}/workspace`;
}

async function removeDirectoryContents(directoryPath) {
  let entries = [];
  try {
    entries = await fs.readdir(directoryPath, { withFileTypes: true });
  } catch {
    return;
  }

  await Promise.all(
    entries.map((entry) =>
      fs.rm(path.join(directoryPath, entry.name), {
        recursive: true,
        force: true,
      })),
  );
}

async function listLocalWorkspaceFiles(rootDirectory, directoryPath = rootDirectory, output = []) {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  for (const entry of entries) {
    const absolutePath = path.join(directoryPath, entry.name);
    if (entry.isDirectory()) {
      await listLocalWorkspaceFiles(rootDirectory, absolutePath, output);
      continue;
    }

    output.push({
      absolutePath,
      relativePath: path.relative(rootDirectory, absolutePath).replace(/\\/g, '/'),
    });
  }

  return output;
}

export async function restorePersistedSession(session) {
  if (!isSessionPersistenceEnabled()) {
    return {
      enabled: false,
      restored: false,
      packageCount: Array.isArray(session.manifest.installedPackages) ? session.manifest.installedPackages.length : 0,
      workspaceFileCount: 0,
    };
  }

  const bucketName = getPersistenceBucketName();
  if (!bucketName) {
    throw new Error('Persistance sandbox activee sans bucket GCS valide.');
  }

  const manifestBuffer = await tryDownloadObjectFromBucket(bucketName, getManifestObjectPath(session));
  const workspacePrefix = `${getWorkspacePrefix(session)}/`;
  const objectPaths = await listObjectPaths(bucketName, workspacePrefix);

  await removeDirectoryContents(session.workspaceDirectory);
  await fs.mkdir(session.workspaceDirectory, { recursive: true });
  await fs.rm(session.venvDirectory, { recursive: true, force: true });

  if (manifestBuffer) {
    const parsedManifest = JSON.parse(manifestBuffer.toString('utf8'));
    session.manifest = {
      ...session.manifest,
      ...(parsedManifest && typeof parsedManifest === 'object' ? parsedManifest : {}),
      sessionId: session.sessionId,
      installedPackages: Array.isArray(parsedManifest?.installedPackages)
        ? parsedManifest.installedPackages.map((value) => String(value)).filter(Boolean)
        : [],
    };
    await saveSessionManifest(session);
  }

  for (const objectPath of objectPaths) {
    const relativePath = objectPath.slice(workspacePrefix.length);
    if (!relativePath) continue;

    const buffer = await downloadObjectFromBucket(bucketName, objectPath);
    const absolutePath = resolveWorkspacePath(session, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
  }

  return {
    enabled: true,
    restored: Boolean(manifestBuffer || objectPaths.length > 0),
    packageCount: Array.isArray(session.manifest.installedPackages) ? session.manifest.installedPackages.length : 0,
    workspaceFileCount: objectPaths.length,
  };
}

export async function persistSession(session) {
  if (!isSessionPersistenceEnabled()) {
    return {
      enabled: false,
      packageCount: Array.isArray(session.manifest.installedPackages) ? session.manifest.installedPackages.length : 0,
      workspaceFileCount: 0,
    };
  }

  const bucketName = getPersistenceBucketName();
  if (!bucketName) {
    throw new Error('Persistance sandbox activee sans bucket GCS valide.');
  }

  await saveSessionManifest(session);

  await uploadBufferToWorkspace(Buffer.from(JSON.stringify(session.manifest, null, 2), 'utf8'), {
    bucketName,
    objectPath: getManifestObjectPath(session),
    contentType: 'application/json',
  });

  const workspacePrefix = `${getWorkspacePrefix(session)}/`;
  await deleteObjectPrefix(bucketName, workspacePrefix);

  const localFiles = await listLocalWorkspaceFiles(session.workspaceDirectory);
  for (const localFile of localFiles) {
    const buffer = await fs.readFile(localFile.absolutePath);
    await uploadBufferToWorkspace(buffer, {
      bucketName,
      objectPath: `${workspacePrefix}${localFile.relativePath}`,
      contentType: 'application/octet-stream',
    });
  }

  return {
    enabled: true,
    packageCount: Array.isArray(session.manifest.installedPackages) ? session.manifest.installedPackages.length : 0,
    workspaceFileCount: localFiles.length,
  };
}

export async function clearPersistedSession(sessionId) {
  if (!isSessionPersistenceEnabled()) {
    return {
      enabled: false,
      deletedObjects: 0,
    };
  }

  const bucketName = getPersistenceBucketName();
  if (!bucketName) {
    throw new Error('Persistance sandbox activee sans bucket GCS valide.');
  }

  const deletedObjects = await deleteObjectPrefix(bucketName, `${SESSION_PERSISTENCE_PREFIX}/${sessionId}/`);
  return {
    enabled: true,
    deletedObjects,
  };
}

export const __sandboxPersistenceInternals = {
  getManifestObjectPath,
  getSessionPrefix,
  getWorkspacePrefix,
  isSessionPersistenceEnabled,
  getPersistenceBucketName,
};
