import 'dotenv/config';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';

process.env.VERCEL = '1';
process.env.COWORK_ENABLE_RAG ||= '1';
process.env.COWORK_RAG_AUTOINJECT ||= '1';
process.env.COWORK_RAG_EMBEDDING_MODEL ||= 'gemini-embedding-2-preview';

const missing = [
  process.env.COWORK_TEST_RAG === '1' ? null : 'COWORK_TEST_RAG=1',
  process.env.QDRANT_URL ? null : 'QDRANT_URL',
  process.env.VERTEX_PROJECT_ID ? null : 'VERTEX_PROJECT_ID',
  process.env.VERTEX_LOCATION ? null : 'VERTEX_LOCATION',
  process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON ? null : 'GOOGLE_APPLICATION_CREDENTIALS_JSON',
].filter(Boolean) as string[];

if (missing.length > 0) {
  console.log(`verify-cowork-rag-e2e: skipped (${missing.join(', ')})`);
  process.exit(0);
}

const { default: app } = await import('./api/index.ts');
const { forgetMemoryFile } = await import('./server/lib/cowork-memory.ts');

type CoworkSseEvent = {
  type: string;
  text?: string;
  title?: string;
  message?: string;
  toolName?: string;
  fileId?: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function collectQuotaSignals(events: CoworkSseEvent[]) {
  return events
    .map((event) => [event.title, event.message, event.text].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(' | ');
}

function isQuotaExhausted(text: string) {
  return /429|resource exhausted|quota depasse|quota exceeded/i.test(text);
}

function assertReadableMemoryFailures(events: CoworkSseEvent[]) {
  for (const event of events) {
    if (event.type !== 'memory_index_failed') continue;
    assert.ok(
      !/Unexpected token '<'|is not valid JSON/i.test(String(event.message || '')),
      `memory_index_failed doit remonter un message lisible, pas un parse JSON brut: ${event.message}`,
    );
  }
}

async function runCowork(baseUrl: string, bodyBase: Record<string, unknown>, message: string) {
  const response = await fetch(`${baseUrl}/api/cowork`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...bodyBase,
      message,
    }),
  });

  if (!response.ok) {
    throw new Error(`cowork http ${response.status}: ${await response.text()}`);
  }

  const rawSse = await response.text();
  return rawSse
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)) as CoworkSseEvent);
}

const sessionId = `cowork-rag-e2e-${randomUUID()}`;
const userIdHint = `cowork-rag-e2e-user-${randomUUID()}`;
let indexedFileId: string | null = null;

const server = http.createServer(app);
await new Promise<void>((resolve) => {
  server.listen(0, '127.0.0.1', () => resolve());
});

try {
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Adresse du serveur ephemere indisponible.');
  }

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const bodyBase = {
    sessionId,
    userIdHint,
    history: [],
    config: {
      model: 'gemini-3.1-flash-lite-preview',
      temperature: 0.2,
      topP: 0.95,
      topK: 32,
      maxOutputTokens: 2048,
      googleSearch: false,
      thinkingLevel: 'low',
      agentDelegationEnabled: false,
    },
    clientContext: {
      locale: 'fr-FR',
      timeZone: 'Europe/Paris',
      nowIso: '2026-04-07T12:00:00.000Z',
    },
    memorySearchEnabled: true,
    workspaceFiles: [],
  };

  let firstEvents: CoworkSseEvent[] = [];
  let firstQuotaSignals = '';
  let released: CoworkSseEvent | undefined;
  let memoryIndexed: CoworkSseEvent | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    firstEvents = await runCowork(
      baseUrl,
      bodyBase,
      "Cree un PDF tres court en francais intitule Memoire Alpha Reel. Le document doit contenir exactement la phrase suivante dans le corps: 'Le chiffre cle de la note Alpha Reel est 8472.' Puis publie-le avec release_file et termine par le lien final.",
    );
    released = firstEvents.find((event) => event.type === 'tool_result' && event.toolName === 'release_file');
    memoryIndexed = firstEvents.find((event) => event.type === 'memory_indexed');
    firstQuotaSignals = collectQuotaSignals(firstEvents);
    assertReadableMemoryFailures(firstEvents);

    if (released && memoryIndexed) {
      break;
    }

    if (isQuotaExhausted(firstQuotaSignals)) {
      await sleep(6000);
      continue;
    }

    break;
  }

  if (!released || !memoryIndexed) {
    if (isQuotaExhausted(firstQuotaSignals)) {
      console.log(`verify-cowork-rag-e2e: skipped (${firstQuotaSignals})`);
      process.exit(0);
    }
    throw new Error(`Le premier run n'a pas produit la sequence attendue. Events=${firstEvents.map((event) => event.type).join(', ')}`);
  }

  indexedFileId = memoryIndexed.fileId || null;
  assert.ok(indexedFileId, 'memory_indexed doit fournir un fileId');

  let secondEvents: CoworkSseEvent[] = [];
  let secondText = '';
  let secondSignals = '';

  for (let attempt = 1; attempt <= 4; attempt += 1) {
    secondEvents = await runCowork(
      baseUrl,
      bodyBase,
      "Quel est le chiffre cle de la note Alpha Reel que tu as publiee tout a l'heure ? Reponds uniquement par la valeur.",
    );
    secondText = secondEvents
      .filter((event) => event.type === 'text_delta')
      .map((event) => event.text || '')
      .join('')
      .trim();
    secondSignals = collectQuotaSignals(secondEvents);
    assertReadableMemoryFailures(secondEvents);

    if (/8472/.test(secondText)) {
      break;
    }

    if (isQuotaExhausted(secondSignals)) {
      await sleep(6000);
      continue;
    }

    await sleep(2000);
  }

  const recalled = secondEvents.find((event) => event.type === 'memory_recalled');
  assert.ok(recalled, 'Le second run doit emettre memory_recalled');

  if (!/8472/.test(secondText) && isQuotaExhausted(secondSignals)) {
    console.log(`verify-cowork-rag-e2e: skipped (${secondSignals})`);
    process.exit(0);
  }

  assert.match(secondText, /8472/, 'Le second run doit rappeler 8472');

  console.log('verify-cowork-rag-e2e: ok');
} finally {
  server.close();
  if (indexedFileId) {
    await Promise.allSettled([
      forgetMemoryFile({
        userId: userIdHint,
        fileId: indexedFileId,
      }),
    ]);
  }
}
