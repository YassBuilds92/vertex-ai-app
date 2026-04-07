export function getExpectedBearerToken() {
  return String(process.env.COWORK_WORKERS_TOKEN || '').trim();
}

export function readBearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : '';
}

export function ensureAuthorized(req) {
  const expectedToken = getExpectedBearerToken();
  if (!expectedToken) {
    return {
      ok: false,
      status: 503,
      body: {
        ok: false,
        error: 'worker_token_missing',
        message: "COWORK_WORKERS_TOKEN n'est pas configure sur le worker.",
      },
    };
  }

  const receivedToken = readBearerToken(req);
  if (receivedToken !== expectedToken) {
    return {
      ok: false,
      status: 401,
      body: {
        ok: false,
        error: 'unauthorized',
        message: 'Bearer token invalide ou absent.',
      },
    };
  }

  return { ok: true };
}
