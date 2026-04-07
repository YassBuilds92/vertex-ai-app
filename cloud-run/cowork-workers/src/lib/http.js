const DEFAULT_MAX_BODY_BYTES = 2 * 1024 * 1024;

export function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

export async function readJsonBody(req, options = {}) {
  const maxBytes = Number(options.maxBytes || DEFAULT_MAX_BODY_BYTES);
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw new Error(`Body JSON trop volumineux (${totalBytes} octets, max ${maxBytes}).`);
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export function getPathname(req) {
  return new URL(req.url || '/', 'http://127.0.0.1').pathname;
}
