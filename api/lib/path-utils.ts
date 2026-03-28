import os from 'os';
import path from 'path';

const ALLOWED_ROOTS = [
  path.normalize(process.cwd()),
  path.normalize('/tmp'),
  path.normalize(os.tmpdir())
];

export function resolveAndValidatePath(filePath: string): string {
  if (path.isAbsolute(filePath)) {
    const absolute = path.normalize(filePath);
    if (ALLOWED_ROOTS.some(root => absolute.startsWith(root))) return absolute;
    throw new Error("Accès refusé : chemin en dehors des zones autorisées.");
  }

  if (process.env.VERCEL) {
    const tmpPath = path.resolve('/tmp', filePath);
    if (tmpPath.startsWith('/tmp') || tmpPath.startsWith(path.normalize('/tmp'))) return tmpPath;
  }

  const projectPath = path.resolve(process.cwd(), filePath);
  if (projectPath.startsWith(process.cwd())) return projectPath;

  throw new Error("Accès refusé hors du projet.");
}

export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const mimes: Record<string, string> = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.csv': 'text/csv',
    '.json': 'application/json',
  };
  return mimes[ext] || 'application/octet-stream';
}

export function estimatePdfPageCount(buffer: Buffer): number {
  const matches = buffer.toString('latin1').match(/\/Type\s*\/Page\b/g);
  return Math.max(1, matches?.length || 0);
}
