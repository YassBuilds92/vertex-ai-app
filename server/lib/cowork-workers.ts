import { COWORK_WORKERS_DEFAULT_TIMEOUT_MS, getCoworkWorkersConfig } from './config.js';
import { retryWithBackoff } from './google-genai.js';

export type CoworkWorkerAuthMode = 'auto' | 'required' | 'disabled';

export type CoworkWorkerCallOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  auth?: CoworkWorkerAuthMode;
  headers?: Record<string, string>;
  timeoutMs?: number;
  stream?: boolean;
  onSseEvent?: (event: CoworkWorkerSseEvent) => void | Promise<void>;
  signal?: AbortSignal;
};

export type CoworkWorkerSseEvent = {
  event: string;
  data: unknown;
  id?: string;
  raw: string;
};

export type CoworkWorkerCallResult<T = unknown> = {
  ok: true;
  status: number;
  durationMs: number;
  data?: T;
  events?: CoworkWorkerSseEvent[];
};

function clipText(value: string, max = 320): string {
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function normalizeWorkerPath(workerPath: string): string {
  const clean = String(workerPath || '').trim();
  if (!clean) return '/';
  return clean.startsWith('/') ? clean : `/${clean}`;
}

function buildWorkerUrl(workerPath: string): string {
  const { url } = getCoworkWorkersConfig();
  if (!url) {
    throw new Error('COWORK_WORKERS_URL est manquante.');
  }

  return `${url}${normalizeWorkerPath(workerPath)}`;
}

function createAuthHeader(auth: CoworkWorkerAuthMode): string | null {
  if (auth === 'disabled') return null;
  const { token } = getCoworkWorkersConfig();
  if (!token) {
    if (auth === 'required') {
      throw new Error('COWORK_WORKERS_TOKEN est manquant.');
    }
    return null;
  }

  return `Bearer ${token}`;
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  signal?: AbortSignal,
) {
  const controller = new AbortController();
  const timeoutHandle = setTimeout(
    () => controller.abort(new Error(`Cowork worker timeout (${timeoutMs}ms)`)),
    timeoutMs,
  );
  const abortListener = () => controller.abort(signal?.reason);

  signal?.addEventListener('abort', abortListener);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
    signal?.removeEventListener('abort', abortListener);
  }
}

function parseSseBlock(block: string): CoworkWorkerSseEvent | null {
  const trimmed = block.trim();
  if (!trimmed) return null;

  let event = 'message';
  let id: string | undefined;
  const dataLines: string[] = [];

  for (const line of trimmed.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim() || 'message';
      continue;
    }
    if (line.startsWith('id:')) {
      id = line.slice('id:'.length).trim() || undefined;
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  const rawData = dataLines.join('\n');
  let data: unknown = rawData;
  if (rawData) {
    try {
      data = JSON.parse(rawData);
    } catch {
      data = rawData;
    }
  }

  return {
    event,
    data,
    id,
    raw: trimmed,
  };
}

async function readSseStream(
  response: Response,
  onEvent?: (event: CoworkWorkerSseEvent) => void | Promise<void>,
) {
  if (!response.body) {
    throw new Error("Le worker n'a retourne aucun body SSE.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const events: CoworkWorkerSseEvent[] = [];
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

    let separatorIndex = buffer.search(/\r?\n\r?\n/);
    while (separatorIndex !== -1) {
      const separatorLength = buffer.slice(separatorIndex, separatorIndex + 4).startsWith('\r\n\r\n') ? 4 : 2;
      const block = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + separatorLength);
      const parsed = parseSseBlock(block);
      if (parsed) {
        events.push(parsed);
        if (onEvent) {
          await onEvent(parsed);
        }
      }
      separatorIndex = buffer.search(/\r?\n\r?\n/);
    }

    if (done) break;
  }

  const lastBlock = parseSseBlock(buffer);
  if (lastBlock) {
    events.push(lastBlock);
    if (onEvent) {
      await onEvent(lastBlock);
    }
  }

  return events;
}

export async function callCoworkWorker<T = unknown>(
  workerPath: string,
  body?: unknown,
  options: CoworkWorkerCallOptions = {},
): Promise<CoworkWorkerCallResult<T>> {
  const url = buildWorkerUrl(workerPath);
  const method = options.method || (body === undefined ? 'GET' : 'POST');
  const authHeader = createAuthHeader(options.auth || 'auto');
  const timeoutMs = Math.max(
    1_000,
    options.timeoutMs || getCoworkWorkersConfig().timeoutMs || COWORK_WORKERS_DEFAULT_TIMEOUT_MS,
  );
  const headers: Record<string, string> = {
    Accept: options.stream ? 'text/event-stream' : 'application/json',
    ...(method !== 'GET' && method !== 'DELETE' ? { 'Content-Type': 'application/json' } : {}),
    ...(authHeader ? { Authorization: authHeader } : {}),
    ...(options.headers || {}),
  };
  const startedAt = Date.now();

  const response = await retryWithBackoff(
    async () => {
      const candidate = await fetchWithTimeout(
        url,
        {
          method,
          headers,
          ...(body !== undefined && method !== 'GET' && method !== 'DELETE'
            ? { body: JSON.stringify(body) }
            : {}),
        },
        timeoutMs,
        options.signal,
      );

      if (!candidate.ok) {
        const errorText = clipText(await candidate.text(), 500);
        throw new Error(
          `Cowork worker ${method} ${normalizeWorkerPath(workerPath)} a repondu ${candidate.status}: ${errorText}`,
        );
      }

      return candidate;
    },
    {
      maxRetries: 2,
      baseDelayMs: 800,
      jitter: false,
    },
  );

  const durationMs = Date.now() - startedAt;

  if (options.stream) {
    const events = await readSseStream(response, options.onSseEvent);
    return {
      ok: true,
      status: response.status,
      durationMs,
      events,
    };
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T) : undefined;

  return {
    ok: true,
    status: response.status,
    durationMs,
    data,
  };
}
