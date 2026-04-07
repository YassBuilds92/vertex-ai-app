import { getCoworkRagConfig, getQdrantConfig } from './config.js';
import { retryWithBackoff } from './google-genai.js';

export type CoworkMemoryPayload = {
  userId: string;
  fileId: string;
  fileName: string;
  sessionId?: string;
  mimeType: string;
  attachmentType: string;
  label: string;
  sourceText?: string;
  storageUri: string;
  createdAt: number;
  chunkIndex?: number;
  chunkCount?: number;
  estimatedTokens?: number;
  modality: 'text';
};

export type UpsertCoworkMemoryPoint = {
  id: string;
  vector: number[];
  payload: CoworkMemoryPayload;
};

export type CoworkMemoryPoint = {
  id: string | number;
  score?: number;
  payload?: CoworkMemoryPayload;
};

type QdrantEnvelope<T> = {
  status?: string;
  result?: T;
};

let ensuredCollectionKey: string | null = null;

function getCollectionName() {
  return getCoworkRagConfig().collectionName;
}

function getQdrantHeaders() {
  const config = getQdrantConfig();
  if (!config.url) {
    throw new Error("Qdrant n'est pas configure: QDRANT_URL manquant.");
  }

  return {
    url: config.url,
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { 'api-key': config.apiKey } : {}),
    },
  };
}

async function qdrantRequest<T>(
  path: string,
  init: RequestInit,
  options: {
    allow404?: boolean;
  } = {},
): Promise<{ status: number; data: QdrantEnvelope<T> | null }> {
  return retryWithBackoff(async () => {
    const { url, headers } = getQdrantHeaders();
    const response = await fetch(`${url}${path}`, {
      ...init,
      headers: {
        ...headers,
        ...(init.headers || {}),
      },
    });

    if (response.status === 404 && options.allow404) {
      return { status: response.status, data: null };
    }

    const text = await response.text();
    const data = text ? (JSON.parse(text) as QdrantEnvelope<T>) : null;

    if (!response.ok) {
      const message =
        (data as any)?.status?.error
        || (data as any)?.result?.status
        || text
        || `Qdrant a repondu ${response.status}`;
      throw new Error(`Qdrant error (${response.status}) sur ${path}: ${message}`);
    }

    return { status: response.status, data };
  }, {
    maxRetries: 3,
    exactDelaysMs: [1000, 2000, 4000],
    jitter: false,
  });
}

async function createPayloadIndex(fieldName: string, fieldSchema: string) {
  const collectionName = getCollectionName();

  try {
    await qdrantRequest(
      `/collections/${encodeURIComponent(collectionName)}/index?wait=true`,
      {
        method: 'PUT',
        body: JSON.stringify({
          field_name: fieldName,
          field_schema: fieldSchema,
        }),
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes('already exists')) return;
    throw error;
  }
}

export async function ensureCoworkMemoryCollection() {
  const ragConfig = getCoworkRagConfig();
  const collectionKey = `${getQdrantConfig().url}::${ragConfig.collectionName}::${ragConfig.vectorSize}`;

  if (ensuredCollectionKey === collectionKey) return;

  const collectionName = getCollectionName();
  const existing = await qdrantRequest(
    `/collections/${encodeURIComponent(collectionName)}`,
    { method: 'GET' },
    { allow404: true },
  );

  if (existing.status === 404) {
    await qdrantRequest(
      `/collections/${encodeURIComponent(collectionName)}`,
      {
        method: 'PUT',
        body: JSON.stringify({
          vectors: {
            size: ragConfig.vectorSize,
            distance: 'Cosine',
          },
          on_disk_payload: true,
          metadata: {
            managedBy: 'cowork',
            phase: '1A',
            embeddingModel: ragConfig.embeddingModel,
          },
        }),
      },
    );
  }

  await createPayloadIndex('userId', 'keyword');
  await createPayloadIndex('fileId', 'keyword');
  await createPayloadIndex('mimeType', 'keyword');

  ensuredCollectionKey = collectionKey;
}

function buildSingleMatchFilter(key: string, value: string) {
  return {
    key,
    match: {
      value,
    },
  };
}

function buildAnyOfFilter(key: string, values?: string[]) {
  const normalizedValues = Array.isArray(values)
    ? values.map(value => String(value || '').trim()).filter(Boolean)
    : [];

  if (normalizedValues.length === 0) return null;
  if (normalizedValues.length === 1) return buildSingleMatchFilter(key, normalizedValues[0]);

  return {
    should: normalizedValues.map(value => buildSingleMatchFilter(key, value)),
  };
}

function buildPayloadFilter(options: {
  userId: string;
  fileIds?: string[];
  mimeTypes?: string[];
}) {
  const must: Array<Record<string, unknown>> = [buildSingleMatchFilter('userId', options.userId)];

  const fileFilter = buildAnyOfFilter('fileId', options.fileIds);
  if (fileFilter) must.push(fileFilter);

  const mimeFilter = buildAnyOfFilter('mimeType', options.mimeTypes);
  if (mimeFilter) must.push(mimeFilter);

  return { must };
}

export async function upsertCoworkMemoryPoints(points: UpsertCoworkMemoryPoint[]) {
  if (points.length === 0) return;
  await ensureCoworkMemoryCollection();

  await qdrantRequest(
    `/collections/${encodeURIComponent(getCollectionName())}/points?wait=true`,
    {
      method: 'PUT',
      body: JSON.stringify({
        points,
      }),
    },
  );
}

export async function queryCoworkMemoryByVector(options: {
  vector: number[];
  userId: string;
  limit?: number;
  scoreThreshold?: number;
  mimeTypes?: string[];
}): Promise<CoworkMemoryPoint[]> {
  await ensureCoworkMemoryCollection();

  const response = await qdrantRequest<{ points?: CoworkMemoryPoint[] }>(
    `/collections/${encodeURIComponent(getCollectionName())}/points/query`,
    {
      method: 'POST',
      body: JSON.stringify({
        query: options.vector,
        limit: options.limit || 5,
        score_threshold: options.scoreThreshold,
        filter: buildPayloadFilter({
          userId: options.userId,
          mimeTypes: options.mimeTypes,
        }),
        with_payload: true,
        with_vector: false,
      }),
    },
  );

  return Array.isArray(response.data?.result?.points) ? response.data?.result?.points || [] : [];
}

export async function scrollCoworkMemoryPoints(options: {
  userId: string;
  fileIds?: string[];
  mimeTypes?: string[];
  limit?: number;
}): Promise<CoworkMemoryPoint[]> {
  await ensureCoworkMemoryCollection();

  const response = await qdrantRequest<{ points?: CoworkMemoryPoint[] }>(
    `/collections/${encodeURIComponent(getCollectionName())}/points/scroll`,
    {
      method: 'POST',
      body: JSON.stringify({
        limit: options.limit || 64,
        filter: buildPayloadFilter({
          userId: options.userId,
          fileIds: options.fileIds,
          mimeTypes: options.mimeTypes,
        }),
        with_payload: true,
        with_vector: false,
      }),
    },
  );

  return Array.isArray(response.data?.result?.points) ? response.data?.result?.points || [] : [];
}

export async function deleteCoworkMemoryByFile(options: {
  userId: string;
  fileId: string;
}) {
  await ensureCoworkMemoryCollection();

  await qdrantRequest(
    `/collections/${encodeURIComponent(getCollectionName())}/points/delete?wait=true`,
    {
      method: 'POST',
      body: JSON.stringify({
        filter: buildPayloadFilter({
          userId: options.userId,
          fileIds: [options.fileId],
        }),
      }),
    },
  );
}
