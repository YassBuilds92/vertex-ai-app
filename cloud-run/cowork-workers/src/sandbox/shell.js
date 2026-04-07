import fs from 'node:fs/promises';
import path from 'node:path';

import { openSse, sendSseEvent, attachSseHeartbeat } from '../lib/sse.js';
import {
  cleanupStaleSessions,
  diffWorkspaceSnapshots,
  ensureSession,
  getSessionPythonPath,
  resolveWorkspacePath,
  snapshotWorkspace,
} from './sessions.js';
import { persistSession, restorePersistedSession } from './persistence.js';
import { collectGeneratedFiles } from './files.js';
import { runCommandStreaming, tokenizeCommand } from './process.js';
import { ensureSessionVenv, installPackages } from './python.js';

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_TIMEOUT_MS = 5 * 60 * 1000;
const ALLOWED_COMMANDS = new Set([
  'cat',
  'echo',
  'find',
  'git',
  'grep',
  'head',
  'ls',
  'pwd',
  'py',
  'python',
  'python3',
  'tail',
  'wc',
]);

function clampTimeout(value) {
  const parsed = Number(value || DEFAULT_TIMEOUT_MS);
  if (!Number.isFinite(parsed)) return DEFAULT_TIMEOUT_MS;
  return Math.max(1_000, Math.min(MAX_TIMEOUT_MS, Math.round(parsed)));
}

function finalizeStream(res, payload) {
  sendSseEvent(res, 'done', payload);
  res.end();
}

export async function handleShellRequest(_req, res, body) {
  openSse(res);
  const stopHeartbeat = attachSseHeartbeat(res);

  try {
    await cleanupStaleSessions();

    const timeoutMs = clampTimeout(body?.timeoutMs);
    const session = await ensureSession(body?.sessionId);
    const restoredState = await restorePersistedSession(session);
    const commandText = String(body?.command || '').trim();
    const tokens = tokenizeCommand(commandText);

    if (restoredState.enabled && restoredState.restored) {
      sendSseEvent(res, 'progress', {
        stage: 'session_restore',
        message: `Session restauree depuis GCS (${restoredState.workspaceFileCount} fichier(s), ${restoredState.packageCount} package(s)).`,
        sessionId: session.sessionId,
      });
    }

    if (tokens.length === 0) {
      finalizeStream(res, {
        success: false,
        sessionId: session.sessionId,
        exitCode: 1,
        stdout: '',
        stderr: 'Commande shell vide.',
        timedOut: false,
        generatedFiles: [],
      });
      return;
    }

    const commandName = String(tokens[0] || '').trim();
    if (!ALLOWED_COMMANDS.has(commandName)) {
      finalizeStream(res, {
        success: false,
        sessionId: session.sessionId,
        exitCode: 1,
        stdout: '',
        stderr: `Commande shell refusee par la sandbox: ${commandName}`,
        timedOut: false,
        generatedFiles: [],
      });
      return;
    }

    let resolvedCommand = commandName;
    if (['python', 'python3', 'py'].includes(commandName)) {
      const sessionPythonPath = getSessionPythonPath(session);
      const configuredPackages = Array.isArray(session.manifest.installedPackages)
        ? session.manifest.installedPackages
        : [];

      if (configuredPackages.length > 0) {
        await ensureSessionVenv(session, timeoutMs, (stage, message) => {
          sendSseEvent(res, 'progress', {
            stage,
            message,
            sessionId: session.sessionId,
          });
        });
        await installPackages(session, [], timeoutMs, (stage, message) => {
          sendSseEvent(res, 'progress', {
            stage,
            message,
            sessionId: session.sessionId,
          });
        });
        resolvedCommand = sessionPythonPath;
      } else {
        try {
          await fs.access(sessionPythonPath);
          resolvedCommand = sessionPythonPath;
        } catch {
          resolvedCommand = commandName === 'py' ? 'python3' : commandName;
        }
      }
    }

    const cwd = body?.workdir
      ? resolveWorkspacePath(session, body.workdir)
      : session.workspaceDirectory;
    await fs.mkdir(path.join(session.rootDirectory, 'tmp'), { recursive: true });

    sendSseEvent(res, 'progress', {
      stage: 'shell_start',
      message: `Execution shell autorisee: ${commandText}`,
      sessionId: session.sessionId,
    });

    const beforeSnapshot = await snapshotWorkspace(session);
    const executionResult = await runCommandStreaming({
      command: resolvedCommand,
      args: tokens.slice(1),
      cwd,
      env: {
        ...process.env,
        HOME: session.rootDirectory,
        TMPDIR: path.join(session.rootDirectory, 'tmp'),
      },
      timeoutMs,
      onStdout: (text) => {
        sendSseEvent(res, 'stdout', { text });
      },
      onStderr: (text) => {
        sendSseEvent(res, 'stderr', { text });
      },
    });

    const afterSnapshot = await snapshotWorkspace(session);
    const changedFiles = diffWorkspaceSnapshots(beforeSnapshot, afterSnapshot);
    const generatedFiles = await collectGeneratedFiles(session, changedFiles, {
      sessionId: session.sessionId,
      userId: body?.userId,
    });
    const persistedState = await persistSession(session);
    if (persistedState.enabled) {
      sendSseEvent(res, 'progress', {
        stage: 'session_persist',
        message: `Session persistee dans GCS (${persistedState.workspaceFileCount} fichier(s), ${persistedState.packageCount} package(s)).`,
        sessionId: session.sessionId,
      });
    }
    const success = executionResult.exitCode === 0 && !executionResult.timedOut;
    const stderr = executionResult.timedOut
      ? `${executionResult.stderr || ''}\nExecution shell interrompue apres timeout.`.trim()
      : executionResult.stderr;

    finalizeStream(res, {
      success,
      sessionId: session.sessionId,
      exitCode: executionResult.exitCode,
      stdout: executionResult.stdout,
      stderr,
      timedOut: executionResult.timedOut,
      signal: executionResult.signal,
      cwd: cwd.replace(/\\/g, '/'),
      generatedFiles,
      message: success ? 'Commande shell terminee.' : 'Commande shell terminee avec erreur.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    sendSseEvent(res, 'error', { message });
    finalizeStream(res, {
      success: false,
      sessionId: String(body?.sessionId || ''),
      exitCode: 1,
      stdout: '',
      stderr: message,
      timedOut: false,
      generatedFiles: [],
      message,
    });
  } finally {
    stopHeartbeat();
  }
}
