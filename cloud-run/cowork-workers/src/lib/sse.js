function serializeSseData(data) {
  if (typeof data === 'string') {
    return data;
  }

  return JSON.stringify(data);
}

export function openSse(res, status = 200) {
  if (res.headersSent) return;

  res.writeHead(status, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write(': connected\n\n');
}

export function sendSseEvent(res, event, data, options = {}) {
  if (res.writableEnded) return;

  const chunks = [];
  if (options.id) {
    chunks.push(`id: ${options.id}`);
  }
  if (event) {
    chunks.push(`event: ${event}`);
  }

  const serialized = serializeSseData(data);
  for (const line of String(serialized).split(/\r?\n/)) {
    chunks.push(`data: ${line}`);
  }

  res.write(`${chunks.join('\n')}\n\n`);
}

export function attachSseHeartbeat(res, intervalMs = 15_000) {
  const timer = setInterval(() => {
    if (!res.writableEnded) {
      res.write(': keep-alive\n\n');
    }
  }, intervalMs);

  const cleanup = () => clearInterval(timer);
  res.on('close', cleanup);
  res.on('finish', cleanup);

  return cleanup;
}
