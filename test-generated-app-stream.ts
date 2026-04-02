import assert from 'node:assert/strict';
import type { Response } from 'express';

import { sanitizeGeneratedAppManifest, type GeneratedAppCreationTranscriptTurn } from './server/lib/generated-apps.ts';
import { streamGeneratedAppCreation } from './server/routes/standard.ts';

class FakeSseResponse {
  headers = new Map<string, string>();
  body = '';
  ended = false;
  listeners = new Map<string, Array<() => void>>();

  setHeader(name: string, value: string) {
    this.headers.set(name, value);
    return this;
  }

  flushHeaders() {
    return this;
  }

  write(chunk: string) {
    this.body += chunk;
    return true;
  }

  end() {
    this.ended = true;
    return this;
  }

  on(event: string, handler: () => void) {
    const current = this.listeners.get(event) || [];
    current.push(handler);
    this.listeners.set(event, current);
    return this;
  }
}

function parseEvents(raw: string) {
  return raw
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .filter((block) => !block.startsWith(':'))
    .map((block) => {
      let event = 'message';
      const dataLines: string[] = [];

      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
          event = line.slice(6).trim();
        }
        if (line.startsWith('data:')) {
          dataLines.push(line.slice(5).trimStart());
        }
      }

      return {
        event,
        data: dataLines.length > 0 ? JSON.parse(dataLines.join('\n')) : null,
      };
    });
}

const manifest = sanitizeGeneratedAppManifest({
  id: 'streamed-app',
  name: 'Streamed App',
  slug: 'streamed-app',
  tagline: 'Une app stream test.',
  summary: 'Validation du flux SSE de creation.',
  mission: 'Verifier l ordre des phases et le manifest final.',
  whenToUse: 'Quand il faut tester le flux stream.',
  outputKind: 'research',
  starterPrompt: 'Lance le stream.',
  systemInstruction: 'Tu es Streamed App.',
  uiSchema: [
    {
      id: 'brief',
      label: 'Brief',
      type: 'textarea',
      required: true,
    },
  ],
  toolAllowList: ['web_search'],
  capabilities: ['Observe le flux'],
  modelProfile: {
    textModel: 'gemini-3.1-pro-preview',
  },
  visualDirection: {
    thesis: 'Atelier de validation.',
    mood: 'calme',
    accentColor: '#7dd3fc',
    surfaceTone: 'dense',
    primaryFont: 'Sora',
    secondaryFont: 'IBM Plex Sans',
  },
  runtime: {
    primaryActionLabel: 'Lancer',
    resultLabel: 'Sorties',
    emptyStateLabel: 'Le resultat apparait ici.',
    editHint: 'Decris l evolution voulue.',
  },
  status: 'draft',
  createdBy: 'manual',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  draftVersion: {
    id: 'streamed-app-v1',
    createdAt: Date.now(),
    status: 'draft',
    bundleStatus: 'skipped',
    sourceCode: 'export default function StreamedApp() { return null; }',
    bundleFormat: 'esm',
    sourceHash: 'streamed-source',
  },
});

assert(manifest, 'Le manifest stream de test doit etre sanitise.');

const response = new FakeSseResponse();

await streamGeneratedAppCreation({
  res: response as unknown as Response,
  brief: 'Construis une app stream test.',
  source: 'manual',
  createManifest: async (_brief, _source, options) => {
    await options?.onProgress?.({
      phase: 'brief_validated',
      label: 'Brief verrouille et pret pour la spec.',
      timestamp: 1,
    });
    await options?.onProgress?.({
      phase: 'spec_ready',
      label: 'Spec experte prete pour Streamed App.',
      timestamp: 2,
    });
    await options?.onProgress?.({
      phase: 'source_ready',
      label: 'Source TSX generee pour la draft.',
      timestamp: 3,
      sourceCode: manifest.draftVersion.sourceCode,
    });
    await options?.onProgress?.({
      phase: 'bundle_skipped',
      label: 'Bundle de preview saute sur cet environnement, preview native maintenu.',
      timestamp: 4,
    });
    await options?.onProgress?.({
      phase: 'manifest_ready',
      label: 'App Streamed App prete pour le store.',
      timestamp: 5,
    });

    return {
      status: 'completed',
      transcript: [{ role: 'user', content: 'Construis une app stream test.', kind: 'brief' }],
      manifest,
    };
  },
});

assert.equal(response.headers.get('Content-Type'), 'text/event-stream');
assert.equal(response.ended, true);

const events = parseEvents(response.body);
const creationEvents = events.filter((event) => event.event === 'generated_app_creation');

assert.deepEqual(
  creationEvents.map((event) => event.data.phase),
  ['brief_validated', 'spec_ready', 'source_ready', 'bundle_skipped', 'manifest_ready']
);

const manifestEvent = events.find((event) => event.event === 'generated_app_manifest');
assert(manifestEvent, 'Le flux doit emettre un evenement generated_app_manifest final.');
assert.equal(manifestEvent?.data.manifest.id, manifest.id);

const doneEvent = events.find((event) => event.event === 'done');
assert(doneEvent, 'Le flux doit se terminer par done.');
assert.equal(doneEvent?.data.manifestId, manifest.id);

const clarificationResponse = new FakeSseResponse();

await streamGeneratedAppCreation({
  res: clarificationResponse as unknown as Response,
  brief: 'Fais-moi une app tres libre.',
  source: 'manual',
  createManifest: async (_brief, _source, options) => {
    const transcript: GeneratedAppCreationTranscriptTurn[] = [{ role: 'user', content: 'Fais-moi une app tres libre.', kind: 'brief' }];
    await options?.onProgress?.({
      phase: 'brief_validated',
      label: 'Brief verrouille et pret pour la spec.',
      timestamp: 10,
      transcript,
    });
    await options?.onProgress?.({
      phase: 'clarification_requested',
      label: 'Quel resultat principal veux-tu voir apparaitre dans l app ?',
      timestamp: 11,
      transcript: [
        ...transcript,
        { role: 'assistant', content: 'Quel resultat principal veux-tu voir apparaitre dans l app ?', kind: 'clarification' },
      ],
      clarificationQuestion: 'Quel resultat principal veux-tu voir apparaitre dans l app ?',
    });

    return {
      status: 'clarification_requested',
      question: 'Quel resultat principal veux-tu voir apparaitre dans l app ?',
      transcript: [
        ...transcript,
        { role: 'assistant', content: 'Quel resultat principal veux-tu voir apparaitre dans l app ?', kind: 'clarification' },
      ],
    };
  },
});

const clarificationEvents = parseEvents(clarificationResponse.body);
const clarificationEvent = clarificationEvents.find((event) => event.event === 'generated_app_clarification');
assert(clarificationEvent, 'Le flux doit exposer une clarification conversationnelle quand le planner en demande une.');
assert.equal(clarificationEvent?.data.question, 'Quel resultat principal veux-tu voir apparaitre dans l app ?');

const clarificationDoneEvent = clarificationEvents.find((event) => event.event === 'done');
assert(clarificationDoneEvent, 'Le flux de clarification doit aussi se terminer proprement.');
assert.equal(clarificationDoneEvent?.data.status, 'clarification_requested');

console.log('test-generated-app-stream: OK');
