import { Storage } from '@google-cloud/storage';

import { log } from './logger.js';

const BUCKET_NAME = 'videosss92';

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

export async function uploadToGCS(buffer: Buffer, fileName: string, contentType: string): Promise<string> {
  if (!storage) throw new Error("Storage non configuré");
  const bucket = storage.bucket(BUCKET_NAME);
  const file = bucket.file(`uploaded/${fileName}`);

  await file.save(buffer, {
    metadata: { contentType },
  });

  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
  });

  return url;
}
