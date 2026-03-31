export type ReleasedArtifactAttachmentType = 'image' | 'video' | 'audio' | 'document';

type ReleasedArtifactDescriptor = {
  mimeType?: string | null;
  fileName?: string | null;
  path?: string | null;
  url?: string | null;
};

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.webm', '.mov', '.m4v']);
const AUDIO_EXTENSIONS = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac']);

function getExtension(value?: string | null) {
  if (!value) return '';
  const sanitized = String(value).split(/[?#]/)[0];
  const lastDotIndex = sanitized.lastIndexOf('.');
  return lastDotIndex >= 0 ? sanitized.slice(lastDotIndex).toLowerCase() : '';
}

function extractNameCandidate(value?: string | null) {
  if (!value) return '';
  const sanitized = String(value).split(/[?#]/)[0].replace(/\\/g, '/');
  const lastSlashIndex = sanitized.lastIndexOf('/');
  return lastSlashIndex >= 0 ? sanitized.slice(lastSlashIndex + 1) : sanitized;
}

export function inferReleasedArtifactAttachmentType(
  descriptor: ReleasedArtifactDescriptor,
): ReleasedArtifactAttachmentType {
  const mimeType = String(descriptor.mimeType || '').toLowerCase();
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';

  const extension = getExtension(descriptor.fileName)
    || getExtension(descriptor.path)
    || getExtension(descriptor.url);

  if (IMAGE_EXTENSIONS.has(extension)) return 'image';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  return 'document';
}

export function getReleasedArtifactName(descriptor: ReleasedArtifactDescriptor) {
  const rawName = extractNameCandidate(descriptor.fileName)
    || extractNameCandidate(descriptor.path)
    || extractNameCandidate(descriptor.url);

  if (!rawName) return 'Livrable genere';

  try {
    return decodeURIComponent(rawName);
  } catch {
    return rawName;
  }
}
