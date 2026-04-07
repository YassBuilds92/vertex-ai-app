import path from 'node:path';

const MIME_BY_EXTENSION = {
  '.aac': 'audio/aac',
  '.csv': 'text/csv',
  '.flac': 'audio/flac',
  '.gif': 'image/gif',
  '.html': 'text/html',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
  '.m4a': 'audio/mp4',
  '.md': 'text/markdown',
  '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.py': 'text/x-python',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.wav': 'audio/wav',
  '.webm': 'video/webm',
  '.webp': 'image/webp',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export function getMimeTypeForPath(filePath) {
  const extension = path.extname(String(filePath || '')).toLowerCase();
  return MIME_BY_EXTENSION[extension] || 'application/octet-stream';
}

export function guessAttachmentType(mimeType) {
  const normalized = String(mimeType || '').toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.startsWith('video/')) return 'video';
  return 'document';
}

export function sanitizeFileName(fileName, fallback = 'file.bin') {
  const normalized = String(fileName || '').trim().replace(/[<>:"/\\|?*\x00-\x1F]+/g, '-');
  return normalized || fallback;
}
