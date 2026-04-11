import { Storage } from '@google-cloud/storage';

function parseGcsUri(storageUri) {
  const normalized = String(storageUri || '').trim();
  const match = normalized.match(/^gs:\/\/([^/]+)(?:\/(.*))?$/i);
  if (!match) return null;

  return {
    bucketName: String(match[1] || '').trim(),
    objectPath: String(match[2] || '').replace(/^\/+/, ''),
  };
}

const DEFAULT_BUCKET_NAME = String(
  process.env.COWORK_WORKSPACE_BUCKET
  || process.env.WORKSPACE_GCS_BUCKET
  || parseGcsUri(process.env.VERTEX_GCS_OUTPUT_URI)?.bucketName
  || ''
).trim();

let storageClient = null;
let parsedCredentials = null;

function getStorageClient() {
  if (storageClient) return storageClient;

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    if (!parsedCredentials) {
      parsedCredentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    }
    storageClient = new Storage({ credentials: parsedCredentials });
    return storageClient;
  }

  storageClient = new Storage();
  return storageClient;
}

function getBucketFile(bucketName, objectPath) {
  const normalizedBucketName = String(bucketName || DEFAULT_BUCKET_NAME || '').trim();
  const normalizedObjectPath = String(objectPath || '').replace(/^\/+/, '');

  if (!normalizedBucketName) {
    throw new Error('Bucket GCS manquant.');
  }
  if (!normalizedObjectPath) {
    throw new Error('Object path GCS manquant.');
  }

  return getStorageClient().bucket(normalizedBucketName).file(normalizedObjectPath);
}

export function getDefaultWorkspaceBucket() {
  return DEFAULT_BUCKET_NAME;
}

export function buildGcsUri(objectPath, bucketName = DEFAULT_BUCKET_NAME) {
  const normalizedPath = String(objectPath || '').replace(/^\/+/, '');
  return normalizedPath ? `gs://${bucketName}/${normalizedPath}` : `gs://${bucketName}`;
}

export async function downloadFromGcs(storageUri) {
  const location = parseGcsUri(storageUri);
  if (!location?.bucketName || !location.objectPath) {
    throw new Error(`Storage URI invalide: ${storageUri}`);
  }

  const [buffer] = await getStorageClient()
    .bucket(location.bucketName)
    .file(location.objectPath)
    .download();

  return buffer;
}

export async function downloadObjectFromBucket(bucketName, objectPath) {
  const [buffer] = await getBucketFile(bucketName, objectPath).download();
  return buffer;
}

export async function tryDownloadObjectFromBucket(bucketName, objectPath) {
  try {
    return await downloadObjectFromBucket(bucketName, objectPath);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && Number(error.code) === 404) {
      return null;
    }
    throw error;
  }
}

export async function listObjectPaths(bucketName, prefix = '') {
  const normalizedBucketName = String(bucketName || DEFAULT_BUCKET_NAME || '').trim();
  if (!normalizedBucketName) {
    throw new Error('Bucket GCS manquant.');
  }

  const [files] = await getStorageClient()
    .bucket(normalizedBucketName)
    .getFiles({
      prefix: String(prefix || '').replace(/^\/+/, ''),
      autoPaginate: true,
    });

  return files.map((file) => file.name).sort();
}

export async function deleteObjectPrefix(bucketName, prefix = '') {
  const objectPaths = await listObjectPaths(bucketName, prefix);
  if (objectPaths.length === 0) {
    return 0;
  }

  await Promise.all(
    objectPaths.map(async (objectPath) => {
      try {
        await getBucketFile(bucketName, objectPath).delete();
      } catch (error) {
        if (!(error && typeof error === 'object' && 'code' in error && Number(error.code) === 404)) {
          throw error;
        }
      }
    }),
  );

  return objectPaths.length;
}

export async function uploadBufferToWorkspace(buffer, options) {
  const bucketName = String(options?.bucketName || DEFAULT_BUCKET_NAME || '').trim();
  const objectPath = String(options?.objectPath || '').replace(/^\/+/, '');
  const contentType = String(options?.contentType || 'application/octet-stream');

  if (!bucketName) {
    throw new Error('Bucket GCS workspace manquant.');
  }
  if (!objectPath) {
    throw new Error('Object path GCS manquant.');
  }

  const file = getBucketFile(bucketName, objectPath);
  await file.save(buffer, {
    metadata: {
      contentType,
    },
  });

  let url = null;
  try {
    const [signedUrl] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 60 * 60 * 1000,
    });
    url = signedUrl;
  } catch {
    url = null;
  }

  return {
    bucketName,
    objectPath,
    storageUri: buildGcsUri(objectPath, bucketName),
    url,
  };
}
