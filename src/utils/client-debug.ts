import type { CoworkStreamEvent } from './cowork';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

declare global {
  interface Window {
    __studioDebugFetchInstalled?: boolean;
    __studioDebugFetchSeq?: number;
  }
}

const MAX_STRING_LENGTH = 260;
const MAX_OBJECT_KEYS = 14;
const MAX_ARRAY_ITEMS = 8;

function clipString(value: string, max = MAX_STRING_LENGTH): string {
  return value.length > max ? `${value.slice(0, max)}... [${value.length} chars]` : value;
}

function summarizeValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;

  if (typeof value === 'string') {
    return clipString(value);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: clipString(value.stack || '', 600),
    };
  }

  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return {
      type: value.type,
      size: value.size,
    };
  }

  if (typeof FormData !== 'undefined' && value instanceof FormData) {
    return Array.from(value.entries()).slice(0, MAX_ARRAY_ITEMS).map(([key, entryValue]) => ({
      key,
      value:
        typeof entryValue === 'string'
          ? clipString(entryValue)
          : {
              name: entryValue.name,
              type: entryValue.type,
              size: entryValue.size,
            },
    }));
  }

  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
    return clipString(value.toString());
  }

  if (Array.isArray(value)) {
    if (depth >= 2) return `[array:${value.length}]`;
    return value.slice(0, MAX_ARRAY_ITEMS).map((entry) => summarizeValue(entry, depth + 1));
  }

  if (typeof value === 'object') {
    if (depth >= 2) return '[object]';

    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);
    return Object.fromEntries(entries.map(([key, entryValue]) => [key, summarizeValue(entryValue, depth + 1)]));
  }

  return String(value);
}

function getConsoleMethod(level: LogLevel) {
  switch (level) {
    case 'debug':
      return console.debug.bind(console);
    case 'warn':
      return console.warn.bind(console);
    case 'error':
      return console.error.bind(console);
    case 'info':
    default:
      return console.info.bind(console);
  }
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function shouldTraceUrl(url: string): boolean {
  return url.includes('/api/') || url.includes('firestore.googleapis.com');
}

function summarizeRequestBody(body: BodyInit | null | undefined): unknown {
  if (!body) return undefined;

  if (typeof body === 'string') {
    try {
      return summarizeValue(JSON.parse(body));
    } catch {
      return clipString(body);
    }
  }

  return summarizeValue(body);
}

export function studioDebug(
  scope: string,
  message: string,
  details?: unknown,
  level: LogLevel = 'info'
) {
  const log = getConsoleMethod(level);
  const prefix = `[StudioDebug][${scope}] ${message}`;

  if (details === undefined) {
    log(prefix);
    return;
  }

  log(prefix, summarizeValue(details));
}

export function installStudioDebugInstrumentation() {
  if (typeof window === 'undefined' || window.__studioDebugFetchInstalled) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.__studioDebugFetchSeq = 0;

  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = resolveRequestUrl(input);
    const traced = shouldTraceUrl(url);
    const method = (init?.method || (typeof input !== 'string' && !(input instanceof URL) ? input.method : 'GET') || 'GET').toUpperCase();
    const requestId = (window.__studioDebugFetchSeq = (window.__studioDebugFetchSeq || 0) + 1);
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (traced) {
      studioDebug(
        'fetch',
        `#${requestId} ${method} ${url} -> start`,
        {
          body: summarizeRequestBody(init?.body),
          hasSignal: Boolean(init?.signal),
          keepalive: init?.keepalive,
        },
        'info'
      );
    }

    try {
      const response = await originalFetch(input, init);

      if (traced) {
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        studioDebug(
          'fetch',
          `#${requestId} ${method} ${url} -> ${response.status} ${response.statusText || ''}`.trim(),
          {
            ok: response.ok,
            durationMs: Math.round(finishedAt - startedAt),
            contentType: response.headers.get('content-type'),
            traceId: response.headers.get('x-studio-trace-id') || undefined,
          },
          response.ok ? 'info' : 'warn'
        );
      }

      return response;
    } catch (error) {
      if (traced) {
        const finishedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        studioDebug(
          'fetch',
          `#${requestId} ${method} ${url} -> failed`,
          {
            durationMs: Math.round(finishedAt - startedAt),
            error,
          },
          'error'
        );
      }
      throw error;
    }
  }) as typeof fetch;

  window.__studioDebugFetchInstalled = true;
  studioDebug('boot', 'Client fetch instrumentation installed.', { href: window.location.href }, 'info');
}

export function logFirestoreOperation(scope: string, details?: unknown, level: LogLevel = 'info') {
  studioDebug(`firestore:${scope}`, scope, details, level);
}

export function logCoworkStreamEventDebug(event: CoworkStreamEvent) {
  const details = {
    type: event.type,
    iteration: 'iteration' in event ? event.iteration : undefined,
    title: 'title' in event ? event.title : undefined,
    toolName: 'toolName' in event ? event.toolName : undefined,
    status: 'status' in event ? event.status : undefined,
    runState: 'runState' in event ? event.runState : undefined,
    chunkCount: 'chunkCount' in event ? event.chunkCount : undefined,
    filesCount: 'filesCount' in event ? event.filesCount : undefined,
    auto: 'auto' in event ? event.auto : undefined,
    traceId: 'traceId' in event ? (event as { traceId?: string }).traceId : undefined,
    textPreview:
      'text' in event && typeof event.text === 'string'
        ? clipString(event.text, 120)
        : undefined,
    messagePreview:
      'message' in event && typeof event.message === 'string'
        ? clipString(event.message, 180)
        : undefined,
    argsPreview:
      'argsPreview' in event && typeof event.argsPreview === 'string'
        ? clipString(event.argsPreview, 180)
        : undefined,
    resultPreview:
      'resultPreview' in event && typeof event.resultPreview === 'string'
        ? clipString(event.resultPreview, 180)
        : undefined,
    runMeta: 'runMeta' in event ? summarizeValue(event.runMeta) : undefined,
  };

  const level: LogLevel =
    event.type === 'error'
      ? 'error'
      : event.type === 'warning' || ('status' in event && event.status === 'error')
        ? 'warn'
        : 'info';

  studioDebug('cowork:event', `${event.type}`, details, level);
}
