import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { openSse, sendSseEvent, attachSseHeartbeat } from '../lib/sse.js';
import {
  cleanupStaleSessions,
  diffWorkspaceSnapshots,
  ensureSession,
  getSessionPythonPath,
  saveSessionManifest,
  snapshotWorkspace,
} from './sessions.js';
import { persistSession, restorePersistedSession } from './persistence.js';
import { collectGeneratedFiles, materializeInputFiles } from './files.js';
import { runCommandStreaming } from './process.js';

const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_TIMEOUT_MS = 5 * 60 * 1000;
const DISALLOWED_PACKAGE_PATTERNS = [
  /(coin|crypto).*miner/i,
  /\bdeepspeed\b/i,
  /\bvllm\b/i,
  /\bunsloth\b/i,
  /\bauto-gptq\b/i,
];

function clampTimeout(value) {
  const parsed = Number(value || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.max(1_000, Math.min(MAX_TIMEOUT_MS, Math.round(parsed)));
}

function normalizePackageSpecs(packages) {
  const deduped = new Set();

  for (const entry of Array.isArray(packages) ? packages : []) {
    const spec = String(entry || '').trim();
    if (!spec) continue;
    if (!/^[A-Za-z0-9_.-]+([<>=!~]{1,2}[A-Za-z0-9*_.-]+)?$/.test(spec)) {
      throw new Error(`Package Python invalide: ${spec}`);
    }
    if (DISALLOWED_PACKAGE_PATTERNS.some((pattern) => pattern.test(spec))) {
      throw new Error(`Package Python refuse par la sandbox: ${spec}`);
    }
    deduped.add(spec);
  }

  return Array.from(deduped.values());
}

export async function ensureSessionVenv(session, timeoutMs, emitProgress) {
  const pythonPath = getSessionPythonPath(session);
  const bootstrapTimeoutMs = Math.max(timeoutMs, 30_000);
  const uvCacheDirectory = path.join(session.rootDirectory, '.uv-cache');

  try {
    await fs.access(pythonPath);
    return pythonPath;
  } catch {
    emitProgress?.('python_venv_create', "Creation d'un environnement Python isole.");
  }

  await fs.mkdir(uvCacheDirectory, { recursive: true });

  const result = await runCommandStreaming({
    command: 'uv',
    args: ['venv', session.venvDirectory, '--seed', '--allow-existing', '--system-site-packages'],
    cwd: session.rootDirectory,
    env: {
      ...process.env,
      UV_CACHE_DIR: uvCacheDirectory,
    },
    timeoutMs: bootstrapTimeoutMs,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Creation du venv Python impossible: ${result.stderr || result.stdout || 'echec uv venv'}`);
  }

  return pythonPath;
}

export async function installPackages(session, packageSpecs, timeoutMs, emitProgress) {
  const uvCacheDirectory = path.join(session.rootDirectory, '.uv-cache');
  const desiredPackages = Array.from(
    new Set([
      ...(Array.isArray(session.manifest.installedPackages) ? session.manifest.installedPackages : []),
      ...(Array.isArray(packageSpecs) ? packageSpecs : []),
    ]),
  );

  if (desiredPackages.length === 0) {
    return [];
  }

  emitProgress?.(
    'python_install',
    `Installation de ${desiredPackages.length} package(s): ${desiredPackages.join(', ')}`,
  );

  await fs.mkdir(uvCacheDirectory, { recursive: true });

  const result = await runCommandStreaming({
    command: 'uv',
    args: ['pip', 'install', '--python', getSessionPythonPath(session), ...desiredPackages],
    cwd: session.rootDirectory,
    env: {
      ...process.env,
      UV_CACHE_DIR: uvCacheDirectory,
    },
    timeoutMs,
  });

  if (result.exitCode !== 0) {
    throw new Error(`Installation Python echouee: ${result.stderr || result.stdout || 'uv pip install a echoue'}`);
  }

  session.manifest.installedPackages = desiredPackages.sort();
  await saveSessionManifest(session);

  return desiredPackages;
}

async function buildRuntimeEnvironment(session) {
  const tmpDirectory = path.join(session.rootDirectory, 'tmp');
  const matplotlibDirectory = path.join(session.rootDirectory, '.matplotlib');

  await fs.mkdir(tmpDirectory, { recursive: true });
  await fs.mkdir(matplotlibDirectory, { recursive: true });

  return {
    ...process.env,
    HOME: session.rootDirectory,
    MPLBACKEND: 'Agg',
    MPLCONFIGDIR: matplotlibDirectory,
    PYTHONUNBUFFERED: '1',
    TMPDIR: tmpDirectory,
  };
}

function sendProgress(res, message, meta = {}) {
  sendSseEvent(res, 'progress', {
    message,
    ...meta,
  });
}

function sendStreamEvent(res, eventName, text) {
  if (!String(text || '').trim()) return;
  sendSseEvent(res, eventName, { text });
}

function finalizeStream(res, payload) {
  sendSseEvent(res, 'done', payload);
  res.end();
}

export async function handlePythonRequest(_req, res, body) {
  openSse(res);
  const stopHeartbeat = attachSseHeartbeat(res);

  try {
    await cleanupStaleSessions();

    const timeoutMs = clampTimeout(body?.timeoutMs);
    const session = await ensureSession(body?.sessionId);
    const installOnly = Boolean(body?.installOnly);
    const packageSpecs = normalizePackageSpecs(body?.packages);
    const restoredState = await restorePersistedSession(session);
    const previouslyConfiguredPackages = Array.isArray(session.manifest.installedPackages)
      ? [...session.manifest.installedPackages]
      : [];

    sendProgress(res, 'Session Python ouverte.', { sessionId: session.sessionId });
    if (restoredState.enabled && restoredState.restored) {
      sendProgress(
        res,
        `Session restauree depuis GCS (${restoredState.workspaceFileCount} fichier(s), ${restoredState.packageCount} package(s)).`,
        { stage: 'session_restore' },
      );
    }
    await ensureSessionVenv(session, timeoutMs, (stage, message) => sendProgress(res, message, { stage }));
    await installPackages(session, packageSpecs, timeoutMs, (stage, message) => sendProgress(res, message, { stage }));
    const installedNow = packageSpecs.filter((spec) => !previouslyConfiguredPackages.includes(spec));

    const downloadedInputFiles = await materializeInputFiles(session, body?.inputFiles);
    if (downloadedInputFiles.length > 0) {
      sendProgress(res, `${downloadedInputFiles.length} fichier(s) du workspace importes dans la sandbox.`, {
        stage: 'input_files_ready',
      });
    }

    if (installOnly) {
      const persistedState = await persistSession(session);
      if (persistedState.enabled) {
        sendProgress(
          res,
          `Session persistee dans GCS (${persistedState.workspaceFileCount} fichier(s), ${persistedState.packageCount} package(s)).`,
          { stage: 'session_persist' },
        );
      }
      finalizeStream(res, {
        success: true,
        operation: 'install',
        sessionId: session.sessionId,
        installedPackages: installedNow,
        packageManifest: session.manifest.installedPackages,
        inputFiles: downloadedInputFiles,
      });
      return;
    }

    const code = String(body?.code || '');
    if (!code.trim()) {
      finalizeStream(res, {
        success: false,
        operation: 'run',
        sessionId: session.sessionId,
        exitCode: 1,
        stdout: '',
        stderr: 'Code Python vide.',
        timedOut: false,
        generatedFiles: [],
        installedPackages: session.manifest.installedPackages,
      });
      return;
    }

    const beforeSnapshot = await snapshotWorkspace(session);
    const scriptPath = path.join(session.metaDirectory, `run-${Date.now()}-${randomUUID()}.py`);
    await fs.writeFile(scriptPath, code, 'utf8');

    const env = await buildRuntimeEnvironment(session);
    const executionResult = await runCommandStreaming({
      command: getSessionPythonPath(session),
      args: [scriptPath],
      cwd: session.workspaceDirectory,
      env,
      timeoutMs,
      onStdout: (text) => sendStreamEvent(res, 'stdout', text),
      onStderr: (text) => sendStreamEvent(res, 'stderr', text),
    });

    const afterSnapshot = await snapshotWorkspace(session);
    const changedFiles = diffWorkspaceSnapshots(beforeSnapshot, afterSnapshot);
    const generatedFiles = await collectGeneratedFiles(session, changedFiles, {
      sessionId: session.sessionId,
      userId: body?.userId,
    });
    const persistedState = await persistSession(session);
    if (persistedState.enabled) {
      sendProgress(
        res,
        `Session persistee dans GCS (${persistedState.workspaceFileCount} fichier(s), ${persistedState.packageCount} package(s)).`,
        { stage: 'session_persist' },
      );
    }

    const success = executionResult.exitCode === 0 && !executionResult.timedOut;
    const stderr = executionResult.timedOut
      ? `${executionResult.stderr || ''}\nExecution Python interrompue apres timeout.`.trim()
      : executionResult.stderr;

    finalizeStream(res, {
      success,
      operation: 'run',
      sessionId: session.sessionId,
      exitCode: executionResult.exitCode,
      stdout: executionResult.stdout,
      stderr,
      timedOut: executionResult.timedOut,
      signal: executionResult.signal,
      inputFiles: downloadedInputFiles,
      generatedFiles,
      installedPackages: session.manifest.installedPackages,
      message: success ? 'Execution Python terminee.' : 'Execution Python terminee avec erreur.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendSseEvent(res, 'error', { message });
    finalizeStream(res, {
      success: false,
      operation: 'run',
      sessionId: String(body?.sessionId || ''),
      exitCode: 1,
      stdout: '',
      stderr: message,
      timedOut: false,
      generatedFiles: [],
      installedPackages: [],
      message,
    });
  } finally {
    stopHeartbeat();
  }
}
