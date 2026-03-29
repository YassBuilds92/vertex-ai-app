export const log = {
  info: (msg: string, meta?: unknown) => console.log(`[${new Date().toISOString()}] INFO  ${msg}`, meta ? JSON.stringify(meta) : ''),
  success: (msg: string) => console.log(`[${new Date().toISOString()}] OK ${msg}`),
  warn: (msg: string, meta?: unknown) => console.warn(`[${new Date().toISOString()}] WARN  ${msg}`, meta ? JSON.stringify(meta) : ''),
  debug: (msg: string, meta?: unknown) => console.debug(`[${new Date().toISOString()}] DEBUG ${msg}`, meta ? JSON.stringify(meta) : ''),
  error: (msg: string, err?: unknown) => console.error(
    `[${new Date().toISOString()}] ERROR ${msg}`,
    err instanceof Error ? err.message : err ?? ''
  ),
};
