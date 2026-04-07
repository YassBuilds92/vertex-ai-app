import { Storage } from '@google-cloud/storage';

import { log } from './logger.js';

const BUCKET_NAME = 'videosss92';

export type UploadedGcsObject = {
  url: string;
  storageUri: string;
  bucketName: string;
  objectPath: string;
};

let gcpCredentials: any = null;
let storage: Storage | null = null;
let serviceAccountEmail: string | null = null;

try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    gcpCredentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    storage = new Storage({ credentials: gcpCredentials });
    serviceAccountEmail = gcpCredentials.client_email || null;
    log.success(`GCP SDKs initialized (${serviceAccountEmail})`);
  }
} catch (error) {
  log.error('Failed to initialize GCP SDKs', error);
}

export function getGcpCredentials() {
  return gcpCredentials;
}

export function getServiceAccountEmail() {
  return serviceAccountEmail;
}

function normalizeObjectPath(objectPath: string) {
  return String(objectPath || '').replace(/^\/+/, '');
}

export function isStorageConfigured() {
  return Boolean(storage);
}

export function buildGcsUri(objectPath: string, bucketName = BUCKET_NAME) {
  const normalizedPath = normalizeObjectPath(objectPath);
  return normalizedPath ? `gs://${bucketName}/${normalizedPath}` : `gs://${bucketName}`;
}

export function parseGcsUri(storageUri?: string | null): { bucketName: string; objectPath: string } | null {
  const normalized = String(storageUri || '').trim();
  const match = normalized.match(/^gs:\/\/([^/]+)\/(.+)$/i);
  if (!match) return null;

  return {
    bucketName: match[1],
    objectPath: normalizeObjectPath(match[2]),
  };
}

export function tryExtractGcsUriFromUrl(url?: string | null): string | null {
  if (!url) return null;

  try {
    const parsed = new URL(String(url));
    const host = parsed.hostname.toLowerCase();
    const pathname = decodeURIComponent(parsed.pathname || '');

    if (host === 'storage.googleapis.com') {
      const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
      if (segments.length >= 2) {
        const [bucketName, ...objectPathSegments] = segments;
        return buildGcsUri(objectPathSegments.join('/'), bucketName);
      }
    }

    if (host.endsWith('.storage.googleapis.com')) {
      const bucketName = host.slice(0, -'.storage.googleapis.com'.length);
      const objectPath = pathname.replace(/^\/+/, '');
      if (bucketName && objectPath) {
        return buildGcsUri(objectPath, bucketName);
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function uploadToGCSWithMetadata(buffer: Buffer, fileName: string, contentType: string): Promise<UploadedGcsObject> {
  if (!storage) throw new Error('Storage non configure');
  const bucket = storage.bucket(BUCKET_NAME);
  const objectPath = normalizeObjectPath(`uploaded/${fileName}`);
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    metadata: { contentType },
  });

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return {
    url,
    storageUri: buildGcsUri(objectPath, BUCKET_NAME),
    bucketName: BUCKET_NAME,
    objectPath,
  };
}

export async function uploadToGCS(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
  const uploaded = await uploadToGCSWithMetadata(buffer, fileName, contentType);
  return uploaded.url;
}

export async function downloadFromGCS(storageUri: string): Promise<Buffer> {
  if (!storage) throw new Error('Storage non configure');

  const location = parseGcsUri(storageUri);
  if (!location) {
    throw new Error(`Storage URI invalide: ${storageUri}`);
  }

  const file = storage.bucket(location.bucketName).file(location.objectPath);
  const [buffer] = await file.download();
  return buffer;
}
