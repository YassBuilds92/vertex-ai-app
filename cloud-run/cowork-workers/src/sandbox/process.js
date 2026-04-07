import { spawn } from 'node:child_process';

const MAX_CAPTURED_OUTPUT_CHARS = 200_000;

function createCaptureState() {
  return {
    text: '',
    truncated: false,
  };
}

function appendCapturedText(state, chunk) {
  if (state.truncated) return;

  const nextLength = state.text.length + chunk.length;
  if (nextLength <= MAX_CAPTURED_OUTPUT_CHARS) {
    state.text += chunk;
    return;
  }

  const remaining = Math.max(0, MAX_CAPTURED_OUTPUT_CHARS - state.text.length);
  state.text += chunk.slice(0, remaining);
  state.truncated = true;
}

function finalizeCapturedText(state) {
  return state.truncated ? `${state.text}\n...[tronque]` : state.text;
}

export async function runCommandStreaming(options) {
  const timeoutMs = Math.max(1_000, Number(options?.timeoutMs || 30_000));
  const stdoutCapture = createCaptureState();
  const stderrCapture = createCaptureState();

  return await new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args || [], {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    });

    let timedOut = false;
    const timeoutHandle = setTimeout(() => {
      timedOut = true;
      child.kill('SIGKILL');
    }, timeoutMs);

    child.on('error', (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });

    child.stdout?.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      appendCapturedText(stdoutCapture, text);
      options.onStdout?.(text);
    });

    child.stderr?.on('data', (chunk) => {
      const text = chunk.toString('utf8');
      appendCapturedText(stderrCapture, text);
      options.onStderr?.(text);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeoutHandle);
      resolve({
        exitCode: typeof code === 'number' ? code : timedOut ? 124 : 1,
        signal: signal || null,
        timedOut,
        stdout: finalizeCapturedText(stdoutCapture),
        stderr: finalizeCapturedText(stderrCapture),
      });
    });
  });
}

export function tokenizeCommand(commandText) {
  const command = String(commandText || '').trim();
  if (!command) return [];

  const tokens = [];
  let current = '';
  let quote = null;

  for (let index = 0; index < command.length; index += 1) {
    const character = command[index];

    if (quote) {
      if (character === quote) {
        quote = null;
        continue;
      }
      if (character === '\\' && quote === '"' && index + 1 < command.length) {
        current += command[index + 1];
        index += 1;
        continue;
      }
      current += character;
      continue;
    }

    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += character;
  }

  if (quote) {
    throw new Error('Commande shell invalide: guillemet non referme.');
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}
