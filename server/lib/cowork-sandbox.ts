import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { callCoworkWorker, type CoworkWorkerSseEvent } from './cowork-workers.js';
import { getMimeType } from './path-utils.js';
import { downloadFromGCS, isStorageConfigured } from './storage.js';

export type CoworkWorkspaceFileEntry = {
  fileId: string;
  fileName: string;
  mimeType: string;
  attachmentType: string;
  storageUri: string;
  fileSizeBytes: number;
  sessionId?: string;
  label: string;
  createdAt: number;
};

export type CoworkSandboxGeneratedFile = {
  path: string;
  fileName?: string;
  mimeType?: string;
  attachmentType?: string;
  sizeBytes?: number;
  storageUri?: string;
  url?: string;
  uploadError?: string;
  localPath?: string;
  localPathError?: string;
};

export type CoworkSandboxExecutionResult = {
  success: boolean;
  operation?: string;
  sessionId: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  signal?: string | null;
  cwd?: string;
  inputFiles: Array<Record<string, unknown>>;
  generatedFiles: CoworkSandboxGeneratedFile[];
  installedPackages: string[];
  packageManifest: string[];
  workerDurationMs: number;
  warnings: string[];
  message?: string;
};

type CoworkSandboxWorkerInputFile = {
  fileId: string;
  path: string;
  storageUri: string;
  fileName: string;
  mimeType: string;
};

type CoworkSandboxStreamOptions = {
  timeoutMs?: number;
  onWorkerEvent?: (event: CoworkWorkerSseEvent) => void | Promise<void>;
};

type RunPythonOptions = CoworkSandboxStreamOptions & {
  sessionId: string;
  userId?: string;
  code: string;
  packages?: string[];
  inputFiles?: Array<{ fileId: string; path: string }>;
  workspaceFiles?: CoworkWorkspaceFileEntry[];
};

type RunShellOptions = CoworkSandboxStreamOptions & {
  sessionId: string;
  userId?: string;
  command: string;
  workdir?: string;
};

type InstallPackageOptions = CoworkSandboxStreamOptions & {
  sessionId: string;
  userId?: string;
  name: string;
  version?: string;
};

function sanitizeRelativeWorkspacePath(filePath: string, fallback = 'file.bin') {
  const requested = String(filePath || '').trim();
  if (!requested) return fallback;
  if (path.isAbsolute(requested)) {
    throw new Error(`Chemin sandbox absolu interdit: ${requested}`);
  }

  const normalized = path.normalize(requested).replace(/^(\.\.(\/|\\|$))+/, '').replace(/^([/\\]+)/, '');
  if (!normalized || normalized === '.' || normalized.startsWith('..')) {
    throw new Error(`Chemin sandbox invalide: ${requested}`);
  }

  return normalized.replace(/\\/g, '/');
}

function resolveWorkspaceInputFiles(
  requestedFiles: Array<{ fileId: string; path: string }> | undefined,
  workspaceFiles: CoworkWorkspaceFileEntry[] | undefined,
): CoworkSandboxWorkerInputFile[] {
  const availableById = new Map(
    (Array.isArray(workspaceFiles) ? workspaceFiles : [])
      .filter((file) => file?.fileId)
      .map((file) => [String(file.fileId), file]),
  );

  return (Array.isArray(requestedFiles) ? requestedFiles : []).map((requestedFile) => {
    const fileId = String(requestedFile?.fileId || '').trim();
    if (!fileId) {
      throw new Error("Chaque input sandbox doit contenir un 'fileId'.");
    }

    const workspaceFile = availableById.get(fileId);
    if (!workspaceFile) {
      throw new Error(`Le fichier workspace '${fileId}' est introuvable pour la sandbox.`);
    }
    if (!workspaceFile.storageUri) {
      throw new Error(`Le fichier workspace '${fileId}' n'a pas de storageUri exploitable.`);
    }

    return {
      fileId,
      path: sanitizeRelativeWorkspacePath(requestedFile?.path, workspaceFile.fileName || fileId),
      storageUri: workspaceFile.storageUri,
      fileName: workspaceFile.fileName,
      mimeType: workspaceFile.mimeType,
    };
  });
}

function extractDonePayload(events: CoworkWorkerSseEvent[]) {
  const doneEvent = [...events].reverse().find((event) => event.event === 'done');
  if (!doneEvent || typeof doneEvent.data !== 'object' || !doneEvent.data) {
    throw new Error("Le worker sandbox n'a pas renvoye d'evenement 'done' exploitable.");
  }
  return doneEvent.data as Record<string, unknown>;
}

async function hydrateGeneratedFiles(
  generatedFiles: CoworkSandboxGeneratedFile[],
): Promise<CoworkSandboxGeneratedFile[]> {
  if (!Array.isArray(generatedFiles) || generatedFiles.length === 0) {
    return [];
  }

  return await Promise.all(
    generatedFiles.map(async (generatedFile) => {
      const storageUri = String(generatedFile?.storageUri || '').trim();
      if (!storageUri) {
        return generatedFile;
      }
      if (!isStorageConfigured()) {
        return {
          ...generatedFile,
          localPathError: 'Storage backend non configure cote Vercel pour recuperer ce fichier automatiquement.',
        };
      }

      try {
        const buffer = await downloadFromGCS(storageUri);
        const fileName = String(generatedFile.fileName || path.basename(generatedFile.path || 'artifact.bin') || 'artifact.bin');
        const extension = path.extname(fileName) || path.extname(generatedFile.path || '') || '';
        const localPath = path.join(os.tmpdir(), `cowork-sandbox-${randomUUID()}${extension}`);
        await fs.writeFile(localPath, buffer);

        return {
          ...generatedFile,
          mimeType: generatedFile.mimeType || getMimeType(localPath),
          localPath,
        };
      } catch (error) {
        return {
          ...generatedFile,
          localPathError: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );
}

function coerceExecutionResult(
  payload: Record<string, unknown>,
  workerDurationMs: number,
): CoworkSandboxExecutionResult {
  return {
    success: Boolean(payload.success),
    operation: typeof payload.operation === 'string' ? payload.operation : undefined,
    sessionId: String(payload.sessionId || ''),
    exitCode: Number(payload.exitCode || 0),
    stdout: String(payload.stdout || ''),
    stderr: String(payload.stderr || ''),
    timedOut: Boolean(payload.timedOut),
    signal: typeof payload.signal === 'string' ? payload.signal : null,
    cwd: typeof payload.cwd === 'string' ? payload.cwd : undefined,
    inputFiles: Array.isArray(payload.inputFiles) ? (payload.inputFiles as Array<Record<string, unknown>>) : [],
    generatedFiles: Array.isArray(payload.generatedFiles) ? (payload.generatedFiles as CoworkSandboxGeneratedFile[]) : [],
    installedPackages: Array.isArray(payload.installedPackages) ? payload.installedPackages.map((value) => String(value)) : [],
    packageManifest: Array.isArray(payload.packageManifest)
      ? payload.packageManifest.map((value) => String(value))
      : Array.isArray(payload.installedPackages)
        ? payload.installedPackages.map((value) => String(value))
        : [],
    workerDurationMs,
    warnings: [],
    message: typeof payload.message === 'string' ? payload.message : undefined,
  };
}

async function invokeSandboxWorker(
  workerPath: string,
  body: Record<string, unknown>,
  options: CoworkSandboxStreamOptions = {},
): Promise<CoworkSandboxExecutionResult> {
  const streamedEvents: CoworkWorkerSseEvent[] = [];
  const response = await callCoworkWorker(workerPath, body, {
    stream: true,
    timeoutMs: options.timeoutMs,
    onSseEvent: async (event) => {
      streamedEvents.push(event);
      if (options.onWorkerEvent) {
        await options.onWorkerEvent(event);
      }
    },
  });

  const payload = extractDonePayload(response.events || streamedEvents);
  const executionResult = coerceExecutionResult(payload, response.durationMs);
  executionResult.generatedFiles = await hydrateGeneratedFiles(executionResult.generatedFiles);
  executionResult.warnings = executionResult.generatedFiles
    .flatMap((generatedFile) => [generatedFile.uploadError, generatedFile.localPathError])
    .filter((value): value is string => Boolean(value));

  return executionResult;
}

export async function runPythonInCoworkSandbox(options: RunPythonOptions) {
  return await invokeSandboxWorker(
    '/sandbox/python',
    {
      sessionId: options.sessionId,
      userId: options.userId,
      code: options.code,
      packages: Array.isArray(options.packages) ? options.packages : [],
      inputFiles: resolveWorkspaceInputFiles(options.inputFiles, options.workspaceFiles),
      timeoutMs: options.timeoutMs,
    },
    options,
  );
}

export async function runShellInCoworkSandbox(options: RunShellOptions) {
  return await invokeSandboxWorker(
    '/sandbox/shell',
    {
      sessionId: options.sessionId,
      userId: options.userId,
      command: options.command,
      workdir: options.workdir
        ? (String(options.workdir).trim() === '.'
          ? '.'
          : sanitizeRelativeWorkspacePath(options.workdir, '.'))
        : undefined,
      timeoutMs: options.timeoutMs,
    },
    options,
  );
}

export async function installPythonPackageInCoworkSandbox(options: InstallPackageOptions) {
  const packageSpec = String(options.version || '').trim()
    ? `${String(options.name || '').trim()}==${String(options.version || '').trim()}`
    : String(options.name || '').trim();

  if (!packageSpec) {
    throw new Error("Le nom du package Python est vide.");
  }

  return await invokeSandboxWorker(
    '/sandbox/python',
    {
      sessionId: options.sessionId,
      userId: options.userId,
      packages: [packageSpec],
      installOnly: true,
      timeoutMs: options.timeoutMs,
    },
    options,
  );
}

export const __coworkSandboxInternals = {
  extractDonePayload,
  hydrateGeneratedFiles,
  resolveWorkspaceInputFiles,
};
