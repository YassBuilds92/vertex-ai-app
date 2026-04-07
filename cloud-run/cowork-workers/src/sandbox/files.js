import fs from 'node:fs/promises';
import path from 'node:path';

import { downloadFromGcs, getDefaultWorkspaceBucket, uploadBufferToWorkspace } from '../lib/gcs.js';
import { getMimeTypeForPath, guessAttachmentType, sanitizeFileName } from '../lib/mime.js';
import { resolveWorkspacePath } from './sessions.js';

function sanitizePathSegment(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function normalizeRelativeWorkspacePath(filePath, fallbackFileName = 'input.bin') {
  const requested = String(filePath || '').trim();

  if (!requested) {
    return sanitizeFileName(fallbackFileName);
  }
  if (path.isAbsolute(requested)) {
    throw new Error(`Chemin sandbox absolu interdit: ${requested}`);
  }

  const normalized = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^([/\\]+)/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('..')) {
    throw new Error(`Chemin sandbox invalide: ${requested}`);
  }

  return normalized.replace(/\\/g, '/');
}

export async function materializeInputFiles(session, inputFiles) {
  const downloadedFiles = [];

  for (const inputFile of Array.isArray(inputFiles) ? inputFiles : []) {
    const storageUri = String(inputFile?.storageUri || '').trim();
    if (!storageUri) {
      throw new Error(`Input sandbox sans storageUri pour ${inputFile?.fileId || 'fichier inconnu'}.`);
    }

    const relativePath = normalizeRelativeWorkspacePath(
      inputFile?.path,
      inputFile?.fileName || inputFile?.fileId || 'input.bin',
    );
    const absolutePath = resolveWorkspacePath(session, relativePath);
    const buffer = await downloadFromGcs(storageUri);

    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);

    downloadedFiles.push({
      fileId: String(inputFile?.fileId || '').trim() || undefined,
      storageUri,
      path: relativePath,
      localPath: absolutePath,
      mimeType: String(inputFile?.mimeType || getMimeTypeForPath(absolutePath)),
      sizeBytes: buffer.byteLength,
    });
  }

  return downloadedFiles;
}

function buildGeneratedObjectPath(options) {
  const sessionId = sanitizePathSegment(options?.sessionId) || 'session';
  const userId = sanitizePathSegment(options?.userId) || 'anonymous';
  const relativePath = String(options?.relativePath || 'artifact.bin').replace(/\\/g, '/');
  const safeRelativePath = relativePath
    .split('/')
    .filter(Boolean)
    .map((segment) => sanitizePathSegment(segment) || 'file')
    .join('/');

  return `sandbox/${userId}/${sessionId}/${Date.now()}-${safeRelativePath}`;
}

export async function collectGeneratedFiles(session, relativePaths, options = {}) {
  const generatedFiles = [];

  for (const relativePath of Array.isArray(relativePaths) ? relativePaths : []) {
    const absolutePath = resolveWorkspacePath(session, relativePath);
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) continue;

    const buffer = await fs.readFile(absolutePath);
    const mimeType = getMimeTypeForPath(absolutePath);

    let storageUri = null;
    let url = null;
    let uploadError = null;

    try {
      const uploaded = await uploadBufferToWorkspace(buffer, {
        bucketName: options.bucketName || getDefaultWorkspaceBucket(),
        objectPath: buildGeneratedObjectPath({
          relativePath,
          sessionId: options.sessionId || session.sessionId,
          userId: options.userId,
        }),
        contentType: mimeType,
      });
      storageUri = uploaded.storageUri;
      url = uploaded.url;
    } catch (error) {
      uploadError = error instanceof Error ? error.message : String(error);
    }

    generatedFiles.push({
      path: String(relativePath || '').replace(/\\/g, '/'),
      fileName: path.basename(relativePath),
      mimeType,
      attachmentType: guessAttachmentType(mimeType),
      sizeBytes: stats.size,
      storageUri: storageUri || undefined,
      url: url || undefined,
      uploadError: uploadError || undefined,
    });
  }

  return generatedFiles;
}
