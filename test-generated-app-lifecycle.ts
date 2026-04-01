import assert from 'node:assert/strict';

import { publishGeneratedApp, sanitizeGeneratedAppManifest } from './server/lib/generated-apps.ts';

const rawManifest = {
  id: 'duel-audio',
  name: 'DuelAudio',
  slug: 'duel-audio',
  tagline: 'Une app de duel audio.',
  summary: 'Validation du fallback natif quand le bundle casse.',
  mission: 'Verifier qu une draft avec source exploitable reste ouvrable et publiable.',
  whenToUse: 'Quand il faut tester le lifecycle des generated apps.',
  outputKind: 'podcast',
  starterPrompt: 'Monte un duel audio.',
  systemInstruction: 'Tu es DuelAudio.',
  uiSchema: [
    {
      id: 'sujet',
      label: 'Sujet',
      type: 'textarea',
      required: true,
    },
  ],
  toolAllowList: ['create_podcast_episode', 'release_file'],
  capabilities: ['Monte un duel audio'],
  modelProfile: {
    textModel: 'gemini-3.1-pro-preview',
    ttsModel: 'gemini-2.5-pro-tts',
  },
  visualDirection: {
    thesis: 'Atelier audio dense.',
    mood: 'precis',
    accentColor: '#7dd3fc',
    surfaceTone: 'dense',
    primaryFont: 'Sora',
    secondaryFont: 'IBM Plex Sans',
  },
  runtime: {
    primaryActionLabel: 'Lancer',
    resultLabel: 'Sorties',
    emptyStateLabel: 'Le duel apparait ici.',
    editHint: 'Decris l evolution voulue.',
  },
  status: 'failed',
  createdBy: 'manual',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  draftVersion: {
    id: 'duel-audio-v1',
    createdAt: Date.now(),
    status: 'failed',
    bundleStatus: 'failed',
    sourceCode: 'export default function DuelAudio() { return null; }',
    bundleFormat: 'esm',
    sourceHash: 'duel-audio-hash',
    buildLog: 'Unexpected token "<"',
  },
};

const manifest = sanitizeGeneratedAppManifest(rawManifest);

assert(manifest, 'Le manifest doit etre sanitise.');
assert.equal(manifest.status, 'draft');
assert.equal(manifest.draftVersion.status, 'draft');
assert.equal(manifest.draftVersion.bundleStatus, 'failed');

const published = publishGeneratedApp(manifest);

assert.equal(published.status, 'published');
assert(published.publishedVersion, 'La version publiee doit exister.');
assert.equal(published.publishedVersion?.status, 'published');
assert.equal(published.publishedVersion?.bundleStatus, 'failed');
assert.equal(published.publishedVersion?.sourceCode, manifest.draftVersion.sourceCode);

console.log('test-generated-app-lifecycle: OK');
