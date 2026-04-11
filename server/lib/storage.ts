import { Storage } from '@google-cloud/storage';

import { log } from './logger.js';

export type UploadedGcsObject = {
  url: string;
  storageUri: string;
  bucketName: string;
  objectPath: string;
};

export type DownloadedGcsObject = {
  buffer: Buffer;
  contentType: string | null;
  size: number | null;
  bucketName: string;
  objectPath: string;
  storageUri: string;
};

let gcpCredentials: any = null;
let storage: Storage | null = null;
let serviceAccountEmail: string | null = null;
let googleAuthMode: 'service-account-json' | 'authorized-user-json' | 'application-default' | null = null;

type GcsLocation = {
  bucketName: string;
  objectPath: string;
};

try {
  const rawCredentials = String(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON || '').trim();

  if (rawCredentials) {
    try {
      gcpCredentials = JSON.parse(rawCredentials);
      storage = new Storage({ credentials: gcpCredentials });
      const credentialType = String(gcpCredentials?.type || '').trim().toLowerCase();
      serviceAccountEmail = credentialType === 'service_account' ? (gcpCredentials.client_email || null) : null;
      googleAuthMode = credentialType === 'authorized_user' ? 'authorized-user-json' : 'service-account-json';
      log.success(
        `GCP SDKs initialized (${googleAuthMode}${serviceAccountEmail ? `, ${serviceAccountEmail}` : ''})`,
      );
    } catch (error) {
      log.error(
        'Failed to parse GOOGLE_APPLICATION_CREDENTIALS_JSON. Falling back to application-default credentials.',
        error,
      );
    }
  }

  if (!storage) {
    storage = new Storage();
    googleAuthMode = 'application-default';
    log.success('GCP SDKs initialized (application-default credentials via gcloud auth)');
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

export function getGoogleAuthMode() {
  return googleAuthMode;
}

function normalizeObjectPath(objectPath: string) {
  return String(objectPath || '').replace(/^\/+/, '');
}

function joinObjectPath(...segments: Array<string | null | undefined>) {
  return segments
    .map(segment => normalizeObjectPath(String(segment || '').trim()))
    .filter(Boolean)
    .join('/');
}

function buildStorageProxyPath(storageUri: string) {
  return `/api/storage/object?uri=${encodeURIComponent(storageUri)}`;
}

function buildAppUrl(pathname: string) {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const baseUrl = String(process.env.APP_URL || '').trim().replace(/\/+$/, '');
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export function isStorageConfigured() {
  return Boolean(storage);
}

export function buildGcsUri(objectPath: string, bucketName?: string | null) {
  const resolvedBucketName = String(bucketName || '').trim();
  if (!resolvedBucketName) {
    throw new Error('Bucket GCS manquant.');
  }
  const normalizedPath = normalizeObjectPath(objectPath);
  return normalizedPath ? `gs://${resolvedBucketName}/${normalizedPath}` : `gs://${resolvedBucketName}`;
}

export function parseGcsUri(storageUri?: string | null): GcsLocation | null {
  const normalized = String(storageUri || '').trim();
  const match = normalized.match(/^gs:\/\/([^/]+)(?:\/(.*))?$/i);
  if (!match) return null;

  return {
    bucketName: match[1],
    objectPath: normalizeObjectPath(match[2] || ''),
  };
}

function getConfiguredOutputLocation(): GcsLocation {
  const configured = parseGcsUri(process.env.VERTEX_GCS_OUTPUT_URI);

  if (!configured?.bucketName) {
    throw new Error(
      'VERTEX_GCS_OUTPUT_URI manquant ou invalide. Exemple attendu: gs://mon-bucket/output',
    );
  }

  return configured;
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
  const target = getConfiguredOutputLocation();
  const bucket = storage.bucket(target.bucketName);
  const objectPath = joinObjectPath(target.objectPath, 'uploaded', fileName);
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    metadata: { contentType },
  });

  const storageUri = buildGcsUri(objectPath, target.bucketName);

  let url: string;
  try {
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    url = signedUrl;
  } catch (error) {
    log.warn(
      `Signed URL indisponible pour ${storageUri}. Fallback sur proxy applicatif.`,
      error,
    );
    url = buildAppUrl(buildStorageProxyPath(storageUri));
  }

  return {
    url,
    storageUri,
    bucketName: target.bucketName,
    objectPath,
  };
}

export async function uploadToGCS(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
  const uploaded = await uploadToGCSWithMetadata(buffer, fileName, contentType);
  return uploaded.url;
}

export async function downloadFromGCS(storageUri: string): Promise<Buffer> {
  const downloaded = await downloadFromGCSWithMetadata(storageUri);
  return downloaded.buffer;
}

export async function downloadFromGCSWithMetadata(storageUri: string): Promise<DownloadedGcsObject> {
  if (!storage) throw new Error('Storage non configure');

  const location = parseGcsUri(storageUri);
  if (!location?.bucketName || !location.objectPath) {
    throw new Error(`Storage URI invalide: ${storageUri}`);
  }

  const file = storage.bucket(location.bucketName).file(location.objectPath);
  const [metadata] = await file.getMetadata();
  const [buffer] = await file.download();
  const size = Number(metadata.size);

  return {
    buffer,
    contentType: metadata.contentType || null,
    size: Number.isFinite(size) ? size : null,
    bucketName: location.bucketName,
    objectPath: location.objectPath,
    storageUri,
  };
}
