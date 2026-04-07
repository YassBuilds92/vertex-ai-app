import http from 'node:http';
import { pathToFileURL } from 'node:url';

import { ensureAuthorized } from './auth.js';
import { json, readJsonBody, getPathname } from './lib/http.js';
import { handlePythonRequest } from './sandbox/python.js';
import { handleShellRequest } from './sandbox/shell.js';
import { cleanupSession } from './sandbox/sessions.js';
import { clearPersistedSession } from './sandbox/persistence.js';

function matchesFutureWorkerRoute(method, pathname) {
  if (method === 'POST' && ['/browser/session', '/healing/run'].includes(pathname)) {
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
      sandbox: {
        python: true,
        shell: true,
      },
    });
  }

  if (method === 'POST' && pathname === '/sandbox/python') {
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

    return handlePythonRequest(req, res, requestBody);
  }

  if (method === 'POST' && pathname === '/sandbox/shell') {
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

    return handleShellRequest(req, res, requestBody);
  }

  if (method === 'DELETE' && /^\/sandbox\/[^/]+$/.test(pathname)) {
    const auth = ensureAuthorized(req);
    if (!auth.ok) {
      return json(res, auth.status, auth.body);
    }

    const sessionId = pathname.split('/').pop();
    await cleanupSession(sessionId);
    await clearPersistedSession(sessionId);
    return json(res, 200, {
      ok: true,
      sessionId,
      message: `Sandbox ${sessionId} nettoyee.`,
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
