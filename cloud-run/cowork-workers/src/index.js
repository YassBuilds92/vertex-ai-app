import http from 'node:http';
import { pathToFileURL } from 'node:url';

import { ensureAuthorized } from './auth.js';

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

function getPathname(req) {
  return new URL(req.url || '/', 'http://127.0.0.1').pathname;
}

function matchesFutureWorkerRoute(method, pathname) {
  if (method === 'POST' && ['/sandbox/python', '/sandbox/shell', '/browser/session', '/healing/run'].includes(pathname)) {
    return true;
  }
  if (method === 'DELETE' && /^\/sandbox\/[^/]+$/.test(pathname)) {
    return true;
  }
  if (method === 'DELETE' && /^\/browser\/[^/]+$/.test(pathname)) {
    return true;
  }
  if (method === 'POST' && /^\/browser\/[^/]+\/(screenshot|click|fill|extract|get_dom|wait|close)$/.test(pathname)) {
    return true;
  }
  return false;
}

async function handleRequest(req, res) {
  const method = String(req.method || 'GET').toUpperCase();
  const pathname = getPathname(req);

  if (method === 'GET' && pathname === '/health') {
    return json(res, 200, {
      ok: true,
      service: 'cowork-workers',
      time: new Date().toISOString(),
      runtime: process.version,
    });
  }

  if (matchesFutureWorkerRoute(method, pathname)) {
    const auth = ensureAuthorized(req);
    if (!auth.ok) {
      return json(res, auth.status, auth.body);
    }

    let requestBody = {};
    try {
      requestBody = await readJsonBody(req);
    } catch (error) {
      return json(res, 400, {
        ok: false,
        error: 'invalid_json',
        message: error instanceof Error ? error.message : 'JSON invalide.',
      });
    }

    return json(res, 501, {
      ok: false,
      error: 'not_implemented',
      message: `La route ${method} ${pathname} est prete mais pas encore implemente.`,
      requestBody,
    });
  }

  return json(res, 404, {
    ok: false,
    error: 'not_found',
    message: `Route inconnue: ${method} ${pathname}`,
  });
}

export function createCoworkWorkersServer() {
  return http.createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      json(res, 500, {
        ok: false,
        error: 'internal_error',
        message: error instanceof Error ? error.message : 'Erreur interne inconnue.',
      });
    });
  });
}

export function startCoworkWorkersServer(options = {}) {
  const port = Number(options.port || process.env.PORT || 8080);
  const host = options.host || '0.0.0.0';
  const server = createCoworkWorkersServer();
  server.listen(port, host, () => {
    console.log(`cowork-workers listening on http://${host}:${port}`);
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startCoworkWorkersServer();
}
