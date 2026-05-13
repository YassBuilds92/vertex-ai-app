import assert from 'node:assert/strict';

import { AZURE_OPENAI_IMAGE_DEFAULT_API_VERSION, getAzureOpenAIImageConfig } from './server/lib/config.ts';
import { __imageMediaInternals, generateImageBinary } from './server/lib/media-generation.ts';

const trackedEnvKeys = [
  'AZURE_OPENAI_IMAGE_ENDPOINT',
  'AZURE_OPENAI_IMAGE_API_KEY',
  'AZURE_OPENAI_IMAGE_API_VERSION',
  'AZURE_OPENAI_IMAGE_DEPLOYMENT',
] as const;

const previousEnv = Object.fromEntries(
  trackedEnvKeys.map((key) => [key, process.env[key]]),
);
const previousFetch = globalThis.fetch;

function setAzureEnv(endpoint: string, apiVersion?: string) {
  process.env.AZURE_OPENAI_IMAGE_ENDPOINT = endpoint;
  process.env.AZURE_OPENAI_IMAGE_API_KEY = 'test-key';
  process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT = 'custom-gpt-image-2';
  if (apiVersion) {
    process.env.AZURE_OPENAI_IMAGE_API_VERSION = apiVersion;
  } else {
    delete process.env.AZURE_OPENAI_IMAGE_API_VERSION;
  }
}

try {
  setAzureEnv('https://example.openai.azure.com');
  assert.equal(getAzureOpenAIImageConfig().apiVersion, AZURE_OPENAI_IMAGE_DEFAULT_API_VERSION);

  const deploymentEditRoute = __imageMediaInternals.resolveAzureImageUrl('edits');
  assert.equal(deploymentEditRoute.style, 'deployment');
  assert.equal(
    deploymentEditRoute.url,
    'https://example.openai.azure.com/openai/deployments/custom-gpt-image-2/images/edits?api-version=2025-04-01-preview',
  );

  setAzureEnv('https://example.openai.azure.com/openai/v1');
  const v1GenerationRoute = __imageMediaInternals.resolveAzureImageUrl('generations');
  assert.equal(v1GenerationRoute.style, 'v1');
  assert.equal(
    v1GenerationRoute.url,
    'https://example.openai.azure.com/openai/v1/images/generations?api-version=preview',
  );
  const v1Payload = __imageMediaInternals.buildAzureOpenAIImagePayload({
    prompt: 'A minimal image',
    model: 'gpt-image-2',
  }, 'gpt-image-2');
  assert.equal(
    __imageMediaInternals.buildAzureOpenAIImageRequestBody(v1Payload, v1GenerationRoute).model,
    'custom-gpt-image-2',
  );

  setAzureEnv('https://example.openai.azure.com', '2025-04-01-preview');
  let capturedRequest: { url: string; body: FormData } | null = null;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    assert.ok(init?.body instanceof FormData);
    capturedRequest = {
      url: String(input),
      body: init.body,
    };
    return new Response(
      JSON.stringify({ data: [{ b64_json: Buffer.from('image-bytes').toString('base64') }] }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  const artifact = await generateImageBinary({
    prompt: 'Use this reference image and make a clean product shot.',
    model: 'gpt-image-2',
    imageDimensions: '1024x1024',
    imageQuality: 'low',
    imageOutputFormat: 'png',
    numberOfImages: 1,
    referenceImages: [
      {
        mimeType: 'image/png',
        data: Buffer.from('reference-image').toString('base64'),
      },
    ],
  });

  assert.equal(artifact.model, 'gpt-image-2');
  assert.ok(capturedRequest?.url.includes('/images/edits?api-version=2025-04-01-preview'));
  const formKeys = Array.from(capturedRequest!.body.keys());
  assert.ok(formKeys.includes('image[]'));
  assert.equal(formKeys.includes('image'), false);

  console.log('verify-azure-image-config: OK');
} finally {
  globalThis.fetch = previousFetch;
  for (const key of trackedEnvKeys) {
    const value = previousEnv[key];
    if (typeof value === 'string') {
      process.env[key] = value;
    } else {
      delete process.env[key];
    }
  }
}
