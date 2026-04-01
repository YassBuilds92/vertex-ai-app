import { createHash } from 'crypto';
import { fileURLToPath } from 'node:url';
import { build as buildEsbuild } from 'esbuild';
import * as generatedAppSdkRuntime from '../../src/generated-app-sdk.tsx';
import {
  isOptionalGeneratedAppBundleIssue,
  normalizeGeneratedAppBundleState,
} from '../../shared/generated-app-bundle.js';

import { DEFAULT_IMAGE_MODEL, DEFAULT_LYRIA_MODEL, DEFAULT_TTS_MODEL } from './media-generation.js';
import { createGoogleAI, parseApiError, retryWithBackoff } from './google-genai.js';
import { log } from './logger.js';
import { uploadToGCS } from './storage.js';

void generatedAppSdkRuntime;

export type GeneratedAppStatus = 'draft' | 'published' | 'failed';
export type GeneratedAppOutputKind = 'pdf' | 'html' | 'music' | 'podcast' | 'code' | 'research' | 'automation' | 'image';
export type GeneratedAppFieldType = 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'url';

export type GeneratedAppFieldSchema = {
  id: string;
  label: string;
  type: GeneratedAppFieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: string[];
};

export type GeneratedAppModelProfile = {
  textModel: string;
  reasoningLevel?: 'minimal' | 'low' | 'medium' | 'high';
  imageModel?: string;
  musicModel?: string;
  ttsModel?: string;
  videoModel?: string;
};

export type GeneratedAppVisualDirection = {
  thesis: string;
  mood: string;
  accentColor: string;
  surfaceTone: string;
  primaryFont: string;
  secondaryFont?: string;
};

export type GeneratedAppRuntimeDefinition = {
  primaryActionLabel: string;
  resultLabel: string;
  emptyStateLabel?: string;
  editHint?: string;
};

export type GeneratedAppBundleStatus = 'ready' | 'failed' | 'skipped';
export type GeneratedAppCreationPhase =
  | 'brief_validated'
  | 'spec_ready'
  | 'source_ready'
  | 'bundle_ready'
  | 'bundle_skipped'
  | 'bundle_failed'
  | 'manifest_ready';

export type GeneratedAppVersion = {
  id: string;
  createdAt: number;
  status: GeneratedAppStatus;
  bundleStatus: GeneratedAppBundleStatus;
  sourceCode: string;
  bundleCode?: string;
  sourceAssetPath?: string;
  bundleAssetPath?: string;
  sourceUrl?: string;
  bundleUrl?: string;
  bundleFormat: 'esm';
  sourceHash: string;
  bundleHash?: string;
  buildLog?: string;
};

export type GeneratedAppManifest = {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  summary: string;
  mission: string;
  whenToUse: string;
  outputKind: GeneratedAppOutputKind;
  starterPrompt: string;
  systemInstruction: string;
  uiSchema: GeneratedAppFieldSchema[];
  toolAllowList: string[];
  capabilities: string[];
  modelProfile: GeneratedAppModelProfile;
  visualDirection: GeneratedAppVisualDirection;
  runtime: GeneratedAppRuntimeDefinition;
  status: GeneratedAppStatus;
  createdBy: 'manual' | 'cowork';
  sourcePrompt?: string;
  sourceSessionId?: string;
  createdAt: number;
  updatedAt: number;
  draftVersion: GeneratedAppVersion;
  publishedVersion?: GeneratedAppVersion;
};

export type GeneratedAppManifestPreview = Pick<
  GeneratedAppManifest,
  | 'name'
  | 'slug'
  | 'tagline'
  | 'summary'
  | 'mission'
  | 'whenToUse'
  | 'outputKind'
  | 'uiSchema'
  | 'toolAllowList'
  | 'capabilities'
  | 'visualDirection'
  | 'runtime'
>;

export type GeneratedAppCreationProgressEvent = {
  phase: GeneratedAppCreationPhase;
  label: string;
  manifestPreview?: GeneratedAppManifestPreview;
  sourceCode?: string;
  buildLog?: string;
  timestamp: number;
};

type DraftDefinition = Omit<
  GeneratedAppManifest,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'draftVersion' | 'publishedVersion'
>;

type GeneratedAppCreationProgressHandler = (event: GeneratedAppCreationProgressEvent) => void | Promise<void>;
type GeneratedAppDefinitionBuilder = (brief: string, source: 'manual' | 'cowork') => Promise<DraftDefinition>;
type GeneratedAppVersionBuilder = (sourceCode: string, slug: string) => Promise<GeneratedAppVersion>;

const GENERATED_APP_MODEL = 'gemini-3.1-flash-lite-preview';
const GENERATED_APP_BUILD_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TOOL_LIBRARY = [
  'web_search',
  'web_fetch',
  'music_catalog_lookup',
  'generate_image_asset',
  'generate_tts_audio',
  'generate_music_audio',
  'create_podcast_episode',
  'begin_pdf_draft',
  'append_to_draft',
  'revise_pdf_draft',
  'get_pdf_draft',
  'review_pdf_draft',
  'create_pdf',
  'release_file',
  'list_files',
  'list_recursive',
  'read_file',
  'write_file',
  'execute_script',
] as const;

const TEXT_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview'] as const;
const IMAGE_MODELS = [DEFAULT_IMAGE_MODEL] as const;
const MUSIC_MODELS = [DEFAULT_LYRIA_MODEL, 'lyria-3-pro-preview', 'lyria-3-clip-preview', 'lyria-002'] as const;
const TTS_MODELS = [DEFAULT_TTS_MODEL, 'gemini-2.5-pro-tts', 'gemini-2.5-flash-tts'] as const;

const SPEC_PROMPT = `Retourne UNIQUEMENT un JSON valide pour une app experte Cowork.
Champs obligatoires: name, slug, tagline, summary, mission, whenToUse, outputKind, starterPrompt, systemInstruction, toolAllowList, capabilities, uiSchema, modelProfile, visualDirection, runtime.
outputKind autorise: pdf | html | music | podcast | code | research | automation | image.
Outils autorises: ${TOOL_LIBRARY.join(', ')}.
Modeles texte: ${TEXT_MODELS.join(', ')}.
Modeles image: ${IMAGE_MODELS.join(', ')}.
Modeles musique: ${MUSIC_MODELS.join(', ')}.
Modeles TTS: ${TTS_MODELS.join(', ')}.
3 a 6 champs UI max. Ecris en francais. App deployable sans chatbox generique.`;

const REVISION_PROMPT = `Retourne UNIQUEMENT un JSON valide pour mettre a jour une app experte Cowork existante.
Conserve l'identite utile de l'app. Mets a jour interface, prompt, outils et modelProfile selon la demande.
3 a 6 champs UI max. Ecris en francais.`;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 52) || 'generated-app';
}

function clipText(value: unknown, max = 280): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function uniqueStrings(values: unknown, max = 8): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const text = clipText(value, 140);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= max) break;
  }
  return output;
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Aucun JSON exploitable retourne.');
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

function inferOutputKind(brief: string): GeneratedAppOutputKind {
  const lowered = brief.toLowerCase();
  if (/\b(pokemon|carte|card|collector|illustration|sprite|cover|visuel)\b/.test(lowered)) return 'image';
  if (/\b(nasheed|music|musique|lyria|song|beat|instrumental|refrain)\b/.test(lowered)) return 'music';
  if (/\b(podcast|narration|voice|voix|tts|interview)\b/.test(lowered)) return 'podcast';
  if (/\b(site|landing|web|html)\b/.test(lowered)) return 'html';
  if (/\b(code|prototype|plugin|script)\b/.test(lowered)) return 'code';
  if (/\b(pdf|rapport|memo|document)\b/.test(lowered)) return 'pdf';
  if (/\b(auto|automation|routine|workflow)\b/.test(lowered)) return 'automation';
  return 'research';
}

function normalizeFieldType(value: unknown): GeneratedAppFieldType {
  switch (typeof value === 'string' ? value.toLowerCase().trim() : '') {
    case 'textarea':
    case 'select':
    case 'number':
    case 'boolean':
    case 'url':
      return value as GeneratedAppFieldType;
    default:
      return 'text';
  }
}

function defaultFields(outputKind: GeneratedAppOutputKind): GeneratedAppFieldSchema[] {
  if (outputKind === 'music') {
    return [
      { id: 'theme', label: 'Theme', type: 'textarea', placeholder: 'Message central du nasheed', helpText: 'La mission poetique et spirituelle.', required: true },
      { id: 'mood', label: 'Ambiance', type: 'select', helpText: 'Couleur emotionnelle.', options: ['Apaisant', 'Solennel', 'Ascendant', 'Meditatif'] },
      { id: 'structure', label: 'Structure', type: 'select', helpText: 'Architecture du morceau.', options: ['Intro + couplet + refrain', 'Hook court', 'Nasheed complet'] },
    ];
  }

  if (outputKind === 'image') {
    return [
      { id: 'subject', label: 'Sujet', type: 'text', placeholder: 'Creature ou carte', helpText: 'Element central du visuel.', required: true },
      { id: 'artDirection', label: 'Direction artistique', type: 'textarea', placeholder: 'Palette, style, energie...', helpText: 'Look final attendu.', required: true },
      { id: 'rarity', label: 'Rarete', type: 'select', helpText: 'Prestige du rendu.', options: ['Common', 'Rare', 'Epic', 'Legendary'] },
    ];
  }

  if (outputKind === 'podcast') {
    return [
      { id: 'topic', label: 'Sujet', type: 'textarea', placeholder: 'Angle editorial ou histoire', helpText: 'Le coeur de l episode.', required: true },
      { id: 'tone', label: 'Ton', type: 'select', helpText: 'Style narratif.', options: ['Calme', 'Editorial', 'Dramatique', 'Conversationnel'] },
      { id: 'duration', label: 'Duree', type: 'number', placeholder: '8', helpText: 'Minutes approximatives.' },
    ];
  }

  return [
    { id: 'brief', label: 'Mission', type: 'textarea', placeholder: 'Decris la demande', helpText: 'Le besoin central a executer.', required: true },
    { id: 'tone', label: 'Ton', type: 'text', placeholder: 'Direct, premium, pedagogique...', helpText: 'Regle le style du rendu.' },
    { id: 'format', label: 'Format', type: 'text', placeholder: 'Rapport, page, prototype...', helpText: 'Type de livrable vise.' },
  ];
}

function sanitizeFields(input: unknown, outputKind: GeneratedAppOutputKind): GeneratedAppFieldSchema[] {
  if (!Array.isArray(input)) return defaultFields(outputKind);

  const fields: GeneratedAppFieldSchema[] = [];
  for (const rawField of input) {
    const field = rawField && typeof rawField === 'object' ? rawField as Record<string, unknown> : null;
    if (!field) continue;

    const label = clipText(field.label || field.id, 42);
    if (!label) continue;

    const id = slugify(String(field.id || label)).replace(/-/g, '_').slice(0, 36) || `field_${fields.length + 1}`;
    const type = normalizeFieldType(field.type);
    const options = type === 'select' ? uniqueStrings(field.options, 6) : undefined;

    fields.push({
      id,
      label,
      type,
      placeholder: clipText(field.placeholder, 96) || undefined,
      helpText: clipText(field.helpText, 140) || undefined,
      required: Boolean(field.required),
      options: Array.isArray(options) && options.length > 0 ? options : undefined,
    });

    if (fields.length >= 6) break;
  }

  return fields.length > 0 ? fields : defaultFields(outputKind);
}

function sanitizeToolAllowList(input: unknown, outputKind: GeneratedAppOutputKind): string[] {
  const allowed = uniqueStrings(input, 12)
    .filter((tool): tool is typeof TOOL_LIBRARY[number] => TOOL_LIBRARY.includes(tool as typeof TOOL_LIBRARY[number]));

  if (allowed.length > 0) return allowed;
  if (outputKind === 'music') return ['generate_music_audio', 'generate_image_asset', 'release_file'];
  if (outputKind === 'podcast') return ['web_search', 'web_fetch', 'create_podcast_episode', 'release_file'];
  if (outputKind === 'image') return ['generate_image_asset', 'release_file'];
  if (outputKind === 'pdf') return ['web_search', 'web_fetch', 'begin_pdf_draft', 'append_to_draft', 'review_pdf_draft', 'create_pdf', 'release_file'];
  return ['web_search', 'web_fetch'];
}

function sanitizeModelProfile(input: unknown, outputKind: GeneratedAppOutputKind): GeneratedAppModelProfile {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const pickModel = (value: unknown, library: readonly string[], fallback: string) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return library.includes(text) ? text : fallback;
  };
  const reasoningLevel = ['minimal', 'low', 'medium', 'high'].includes(String(source.reasoningLevel || ''))
    ? String(source.reasoningLevel) as GeneratedAppModelProfile['reasoningLevel']
    : outputKind === 'code' || outputKind === 'research' ? 'high' : 'medium';

  return {
    textModel: pickModel(source.textModel, TEXT_MODELS, outputKind === 'code' || outputKind === 'research' ? 'gemini-3.1-pro-preview' : 'gemini-3.1-flash-lite-preview'),
    reasoningLevel,
    imageModel: outputKind === 'image' || outputKind === 'music' || outputKind === 'html'
      ? pickModel(source.imageModel, IMAGE_MODELS, DEFAULT_IMAGE_MODEL)
      : undefined,
    musicModel: outputKind === 'music'
      ? pickModel(source.musicModel, MUSIC_MODELS, 'lyria-3-pro-preview')
      : undefined,
    ttsModel: outputKind === 'podcast'
      ? pickModel(source.ttsModel, TTS_MODELS, DEFAULT_TTS_MODEL)
      : undefined,
    videoModel: undefined,
  };
}

function sanitizeVisualDirection(input: unknown, outputKind: GeneratedAppOutputKind): GeneratedAppVisualDirection {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const accents: Record<GeneratedAppOutputKind, string> = {
    image: '#ff7a18',
    music: '#d9ff74',
    podcast: '#ffd166',
    html: '#5bd6ff',
    code: '#7df9c1',
    pdf: '#ff8a6d',
    automation: '#89f0d0',
    research: '#8bb8ff',
  };

  return {
    thesis: clipText(source.thesis, 180) || 'Une interface forte, frontale et concentree sur un geste principal.',
    mood: clipText(source.mood, 60) || 'premium concentre',
    accentColor: /^#([0-9a-f]{6})$/i.test(String(source.accentColor || '').trim()) ? String(source.accentColor).trim() : accents[outputKind],
    surfaceTone: clipText(source.surfaceTone, 120) || 'surfaces denses, halo controle, contraste net',
    primaryFont: clipText(source.primaryFont, 80) || 'Sora',
    secondaryFont: clipText(source.secondaryFont, 80) || 'IBM Plex Sans',
  };
}

function sanitizeRuntime(input: unknown, outputKind: GeneratedAppOutputKind): GeneratedAppRuntimeDefinition {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const actionByKind: Record<GeneratedAppOutputKind, string> = {
    image: 'Generer maintenant',
    music: 'Composer maintenant',
    podcast: 'Produire maintenant',
    html: 'Construire maintenant',
    code: 'Builder maintenant',
    pdf: 'Rediger maintenant',
    automation: 'Lancer le flow',
    research: 'Analyser maintenant',
  };
  const resultByKind: Record<GeneratedAppOutputKind, string> = {
    image: 'Sorties visuelles',
    music: 'Sorties recentes',
    podcast: 'Master final',
    html: 'Preview live',
    code: 'Builds et versions',
    pdf: 'Livrables',
    automation: 'Executions recentes',
    research: 'Resultats',
  };

  return {
    primaryActionLabel: clipText(source.primaryActionLabel, 52) || actionByKind[outputKind],
    resultLabel: clipText(source.resultLabel, 60) || resultByKind[outputKind],
    emptyStateLabel: clipText(source.emptyStateLabel, 180) || 'Le prochain run doit sortir ici avec son artefact principal et ses variantes utiles.',
    editHint: clipText(source.editHint, 220) || "Decris ici l'evolution voulue. Cowork regenerera une nouvelle draft sans casser la version publiee.",
  };
}

function sanitizeDefinition(raw: unknown, brief: string, source: 'manual' | 'cowork'): DraftDefinition {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const outputKind = (typeof input.outputKind === 'string' && ['pdf', 'html', 'music', 'podcast', 'code', 'research', 'automation', 'image'].includes(input.outputKind))
    ? input.outputKind as GeneratedAppOutputKind
    : inferOutputKind(brief);
  const name = clipText(input.name, 52) || 'Cowork Expert App';
  const slug = slugify(String(input.slug || name));

  return {
    name,
    slug,
    tagline: clipText(input.tagline, 92) || 'App experte generee par Cowork',
    summary: clipText(input.summary, 220) || clipText(brief, 220) || 'App experte prete a lancer.',
    mission: clipText(input.mission, 320) || clipText(brief, 320) || `Accomplir la mission: ${name}.`,
    whenToUse: clipText(input.whenToUse, 220) || `Utilise cette app quand le besoin principal tourne autour de ${name.toLowerCase()}.`,
    outputKind,
    starterPrompt: clipText(input.starterPrompt, 420) || `Prends en charge cette mission dans ${name}.`,
    systemInstruction: clipText(input.systemInstruction, 5000) || `Tu es ${name}, une app experte concue par Cowork. Tu livres un resultat net, specialise et honnete.`,
    uiSchema: sanitizeFields(input.uiSchema, outputKind),
    toolAllowList: sanitizeToolAllowList(input.toolAllowList, outputKind),
    capabilities: uniqueStrings(input.capabilities, 6).length > 0 ? uniqueStrings(input.capabilities, 6) : ['Cadre vite la mission', 'Lance une action experte', 'Expose un resultat publiable'],
    modelProfile: sanitizeModelProfile(input.modelProfile, outputKind),
    visualDirection: sanitizeVisualDirection(input.visualDirection, outputKind),
    runtime: sanitizeRuntime(input.runtime, outputKind),
    createdBy: source,
    sourcePrompt: clipText(input.sourcePrompt || brief, 1500) || undefined,
    sourceSessionId: clipText(input.sourceSessionId, 120) || undefined,
  };
}

function hashText(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function buildVersionId(slug: string, createdAt: number) {
  return `${slug}-v${createdAt.toString(36)}`;
}

function buildManifestPreview(definition: DraftDefinition): GeneratedAppManifestPreview {
  return {
    name: definition.name,
    slug: definition.slug,
    tagline: definition.tagline,
    summary: definition.summary,
    mission: definition.mission,
    whenToUse: definition.whenToUse,
    outputKind: definition.outputKind,
    uiSchema: definition.uiSchema,
    toolAllowList: definition.toolAllowList,
    capabilities: definition.capabilities,
    visualDirection: definition.visualDirection,
    runtime: definition.runtime,
  };
}

function validateGeneratedAppBrief(brief: string) {
  const cleanedBrief = clipText(brief, 2200);
  if (!cleanedBrief) throw new Error("Le brief de generation d'app est vide.");
  return cleanedBrief;
}

async function emitGeneratedAppProgress(
  onProgress: GeneratedAppCreationProgressHandler | undefined,
  event: Omit<GeneratedAppCreationProgressEvent, 'timestamp'>
) {
  if (!onProgress) return;
  await onProgress({
    ...event,
    timestamp: Date.now(),
  });
}

export function renderGeneratedAppSource(definition: DraftDefinition): string {
  const embeddedManifest = JSON.stringify(definition, null, 2);
  const featureDeck = JSON.stringify(definition.capabilities.slice(0, 4), null, 2);

  return `import React from 'react';
import { GeneratedAppCanvas, type GeneratedAppComponentProps } from './src/generated-app-sdk.tsx';

const embeddedManifest = ${embeddedManifest};
const featureDeck = ${featureDeck};

export default function GeneratedCoworkApp(props: GeneratedAppComponentProps) {
  return (
    <GeneratedAppCanvas
      manifest={props.manifest || embeddedManifest}
      featureDeck={featureDeck}
      formValues={props.formValues}
      isRunning={props.isRunning}
      messages={props.messages}
      onFieldChange={props.onFieldChange}
      onRun={props.onRun}
      onPublish={props.onPublish}
      canPublish={props.canPublish}
      onAskCowork={props.onAskCowork}
    />
  );
}

`;
}

async function uploadVersionAssets(slug: string, version: GeneratedAppVersion): Promise<GeneratedAppVersion> {
  const sourceAssetPath = `generated-apps/${slug}/${version.id}/source.tsx`;
  const bundleAssetPath = `generated-apps/${slug}/${version.id}/bundle.js`;
  const [sourceUrl, bundleUrl] = await Promise.all([
    uploadToGCS(Buffer.from(version.sourceCode, 'utf8'), sourceAssetPath, 'text/plain; charset=utf-8'),
    version.bundleCode
      ? uploadToGCS(Buffer.from(version.bundleCode, 'utf8'), bundleAssetPath, 'text/javascript; charset=utf-8')
      : Promise.resolve(undefined),
  ]);

  return {
    ...version,
    sourceAssetPath,
    bundleAssetPath: version.bundleCode ? bundleAssetPath : undefined,
    sourceUrl,
    bundleUrl,
  };
}

export async function buildGeneratedAppVersion(sourceCode: string, slug: string): Promise<GeneratedAppVersion> {
  const createdAt = Date.now();
  const sourceHash = hashText(sourceCode);
  const versionId = buildVersionId(slug, createdAt);

  try {
    const buildResult = await buildEsbuild({
      absWorkingDir: GENERATED_APP_BUILD_ROOT,
      stdin: {
        contents: sourceCode,
        loader: 'tsx',
        resolveDir: GENERATED_APP_BUILD_ROOT,
        sourcefile: `${slug}.generated.tsx`,
      },
      bundle: true,
      write: false,
      format: 'esm',
      platform: 'browser',
      jsx: 'automatic',
      target: ['es2020'],
      sourcemap: false,
      minify: false,
    });

    let version: GeneratedAppVersion = {
      id: versionId,
      createdAt,
      status: 'draft',
      bundleStatus: 'ready',
      sourceCode,
      bundleCode: buildResult.outputFiles?.[0]?.text || '',
      bundleFormat: 'esm',
      sourceHash,
      bundleHash: buildResult.outputFiles?.[0]?.text ? hashText(buildResult.outputFiles[0].text) : undefined,
    };

    try {
      version = await uploadVersionAssets(slug, version);
    } catch (storageError) {
      version = {
        ...version,
        buildLog: `Stockage distant indisponible: ${parseApiError(storageError)}`,
      };
    }

    return version;
  } catch (error) {
    const cleanError = parseApiError(error);

    if (isOptionalGeneratedAppBundleIssue(cleanError)) {
      log.warn('Generated app preview bundle skipped', { slug, reason: cleanError });
      return {
        id: versionId,
        createdAt,
        status: 'draft',
        bundleStatus: 'skipped',
        sourceCode,
        bundleFormat: 'esm',
        sourceHash,
      };
    }

    return {
      id: versionId,
      createdAt,
      status: 'draft',
      bundleStatus: 'failed',
      sourceCode,
      bundleFormat: 'esm',
      sourceHash,
      buildLog: cleanError,
    };
  }
}

async function generateDefinitionFromBrief(brief: string, source: 'manual' | 'cowork'): Promise<DraftDefinition> {
  const cleanedBrief = validateGeneratedAppBrief(brief);

  const ai = createGoogleAI(GENERATED_APP_MODEL);
  const result = await retryWithBackoff(() => ai.models.generateContent({
    model: GENERATED_APP_MODEL,
    contents: [{ role: 'user', parts: [{ text: cleanedBrief }] }],
    config: {
      systemInstruction: SPEC_PROMPT,
      temperature: 0.3,
      topP: 0.95,
      maxOutputTokens: 4096,
      responseMimeType: 'text/plain',
    },
  }));

  return sanitizeDefinition(extractJsonObject(result.text || ''), cleanedBrief, source);
}

async function generateRevision(existing: GeneratedAppManifest, changeRequest: string): Promise<DraftDefinition> {
  const cleanedRequest = clipText(changeRequest, 2200);
  if (!cleanedRequest) throw new Error("La demande de modification d'app est vide.");

  const ai = createGoogleAI(GENERATED_APP_MODEL);
  const prompt = [
    'App existante:',
    JSON.stringify({
      name: existing.name,
      slug: existing.slug,
      tagline: existing.tagline,
      summary: existing.summary,
      mission: existing.mission,
      whenToUse: existing.whenToUse,
      outputKind: existing.outputKind,
      starterPrompt: existing.starterPrompt,
      systemInstruction: existing.systemInstruction,
      toolAllowList: existing.toolAllowList,
      capabilities: existing.capabilities,
      uiSchema: existing.uiSchema,
      modelProfile: existing.modelProfile,
      visualDirection: existing.visualDirection,
      runtime: existing.runtime,
    }, null, 2),
    '',
    'Demande utilisateur:',
    cleanedRequest,
    '',
    "Retourne l'app complete mise a jour.",
  ].join('\n');

  const result = await retryWithBackoff(() => ai.models.generateContent({
    model: GENERATED_APP_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: REVISION_PROMPT,
      temperature: 0.28,
      topP: 0.95,
      maxOutputTokens: 4096,
      responseMimeType: 'text/plain',
    },
  }));

  return sanitizeDefinition(extractJsonObject(result.text || ''), cleanedRequest, existing.createdBy);
}

function materializeManifest(
  definition: DraftDefinition,
  draftVersion: GeneratedAppVersion,
  options: {
    id?: string;
    createdAt?: number;
    createdBy: 'manual' | 'cowork';
    sourcePrompt?: string;
    sourceSessionId?: string;
    publishedVersion?: GeneratedAppVersion;
  }
): GeneratedAppManifest {
  const now = Date.now();

  return {
    ...definition,
    id: options.id || `${definition.slug}-${now.toString(36)}`,
    status: options.publishedVersion && options.publishedVersion.id === draftVersion.id
      ? 'published'
      : 'draft',
    createdBy: options.createdBy,
    sourcePrompt: options.sourcePrompt || definition.sourcePrompt,
    sourceSessionId: options.sourceSessionId || definition.sourceSessionId,
    createdAt: options.createdAt || now,
    updatedAt: now,
    draftVersion,
    publishedVersion: options.publishedVersion,
  };
}

function sanitizeVersion(raw: unknown, slug: string): GeneratedAppVersion {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const sourceCode = typeof input.sourceCode === 'string' ? input.sourceCode : '';
  const sourceUrl = clipText(input.sourceUrl, 700) || undefined;
  const bundleCode = typeof input.bundleCode === 'string' ? input.bundleCode : undefined;
  const bundleUrl = clipText(input.bundleUrl, 700) || undefined;
  const normalizedBundleState = normalizeGeneratedAppBundleState({
    bundleStatus: typeof input.bundleStatus === 'string' ? input.bundleStatus : '',
    bundleCode,
    bundleUrl,
    buildLog: clipText(input.buildLog, 4000) || undefined,
  });
  const hasUsableSource = sourceCode.trim().length > 0 || Boolean(sourceUrl);
  const status: GeneratedAppStatus =
    input.status === 'published'
      ? 'published'
      : input.status === 'failed' && !hasUsableSource
        ? 'failed'
        : 'draft';
  return {
    id: clipText(input.id, 160) || buildVersionId(slug, Date.now()),
    createdAt: Number(input.createdAt || Date.now()),
    status,
    bundleStatus: normalizedBundleState.bundleStatus,
    sourceCode,
    bundleCode,
    sourceAssetPath: clipText(input.sourceAssetPath, 320) || undefined,
    bundleAssetPath: clipText(input.bundleAssetPath, 320) || undefined,
    sourceUrl,
    bundleUrl,
    bundleFormat: 'esm',
    sourceHash: clipText(input.sourceHash, 128) || hashText(sourceCode),
    bundleHash: clipText(input.bundleHash, 128) || undefined,
    buildLog: normalizedBundleState.buildLog,
  };
}

export function sanitizeGeneratedAppManifest(raw: unknown): GeneratedAppManifest | null {
  if (!raw || typeof raw !== 'object') return null;
  const input = raw as Record<string, unknown>;
  const definition = sanitizeDefinition(input, clipText(input.sourcePrompt || input.mission || input.summary, 1500), input.createdBy === 'manual' ? 'manual' : 'cowork');
  const draftVersion = sanitizeVersion(input.draftVersion, definition.slug);
  const publishedVersion = input.publishedVersion ? sanitizeVersion(input.publishedVersion, definition.slug) : undefined;
  return {
    ...definition,
    id: clipText(input.id, 160) || `${definition.slug}-${Date.now().toString(36)}`,
    status: publishedVersion && publishedVersion.id === draftVersion.id ? 'published' : 'draft',
    createdBy: input.createdBy === 'manual' ? 'manual' : 'cowork',
    sourcePrompt: clipText(input.sourcePrompt, 1500) || definition.sourcePrompt,
    sourceSessionId: clipText(input.sourceSessionId, 120) || definition.sourceSessionId,
    createdAt: Number(input.createdAt || Date.now()),
    updatedAt: Number(input.updatedAt || Date.now()),
    draftVersion,
    publishedVersion,
  };
}

export async function createGeneratedAppFromBriefWithProgress(
  brief: string,
  source: 'manual' | 'cowork' = 'manual',
  options?: {
    onProgress?: GeneratedAppCreationProgressHandler;
    generateDefinition?: GeneratedAppDefinitionBuilder;
    buildVersion?: GeneratedAppVersionBuilder;
  }
): Promise<GeneratedAppManifest> {
  const cleanedBrief = validateGeneratedAppBrief(brief);
  const onProgress = options?.onProgress;
  const generateDefinition = options?.generateDefinition || generateDefinitionFromBrief;
  const buildVersion = options?.buildVersion || buildGeneratedAppVersion;

  await emitGeneratedAppProgress(onProgress, {
    phase: 'brief_validated',
    label: 'Brief verrouille et pret pour la spec.',
  });

  const definition = await generateDefinition(cleanedBrief, source);
  const manifestPreview = buildManifestPreview(definition);
  await emitGeneratedAppProgress(onProgress, {
    phase: 'spec_ready',
    label: `Spec experte prete pour ${definition.name}.`,
    manifestPreview,
  });

  const sourceCode = renderGeneratedAppSource(definition);
  await emitGeneratedAppProgress(onProgress, {
    phase: 'source_ready',
    label: 'Source TSX generee pour la draft.',
    manifestPreview,
    sourceCode,
  });

  const draftVersion = await buildVersion(sourceCode, definition.slug);
  const bundleProgress =
    draftVersion.bundleStatus === 'ready'
      ? {
          phase: 'bundle_ready' as const,
          label: 'Preview bundle prete pour le host.',
        }
      : draftVersion.bundleStatus === 'skipped'
        ? {
            phase: 'bundle_skipped' as const,
            label: 'Bundle de preview saute sur cet environnement, preview native maintenu.',
          }
        : {
            phase: 'bundle_failed' as const,
            label: 'Le bundle de preview a rate, bascule native active.',
          };
  await emitGeneratedAppProgress(onProgress, {
    phase: bundleProgress.phase,
    label: bundleProgress.label,
    manifestPreview,
    sourceCode,
    buildLog: draftVersion.buildLog,
  });

  const manifest = materializeManifest(definition, draftVersion, {
    createdBy: source,
    sourcePrompt: clipText(cleanedBrief, 1500),
  });

  await emitGeneratedAppProgress(onProgress, {
    phase: 'manifest_ready',
    label: `App ${manifest.name} prete pour le store.`,
    manifestPreview,
    sourceCode,
    buildLog: draftVersion.buildLog,
  });

  return manifest;
}

export async function createGeneratedAppFromBrief(brief: string, source: 'manual' | 'cowork' = 'manual'): Promise<GeneratedAppManifest> {
  try {
    return await createGeneratedAppFromBriefWithProgress(brief, source);
  } catch (error) {
    const cleanError = parseApiError(error);
    log.error('Generated app creation failed', cleanError);
    throw new Error(cleanError);
  }
}

export async function reviseGeneratedApp(existing: GeneratedAppManifest, changeRequest: string): Promise<GeneratedAppManifest> {
  try {
    const definition = await generateRevision(existing, changeRequest);
    const draftVersion = await buildGeneratedAppVersion(
      renderGeneratedAppSource({
        ...definition,
        createdBy: existing.createdBy,
        sourcePrompt: clipText(changeRequest, 1500) || existing.sourcePrompt,
        sourceSessionId: existing.sourceSessionId,
      }),
      existing.slug || definition.slug
    );

    return materializeManifest({
      ...definition,
      createdBy: existing.createdBy,
    }, draftVersion, {
      id: existing.id,
      createdAt: existing.createdAt,
      createdBy: existing.createdBy,
      sourcePrompt: clipText(changeRequest, 1500) || existing.sourcePrompt,
      sourceSessionId: existing.sourceSessionId,
      publishedVersion: existing.publishedVersion,
    });
  } catch (error) {
    const cleanError = parseApiError(error);
    log.error('Generated app revision failed', cleanError);
    throw new Error(cleanError);
  }
}

export function publishGeneratedApp(existing: GeneratedAppManifest): GeneratedAppManifest {
  const manifest = sanitizeGeneratedAppManifest(existing);
  if (!manifest) throw new Error("Manifest d'app invalide.");
  if (!manifest.draftVersion.sourceCode && !manifest.draftVersion.sourceUrl) {
    throw new Error("Impossible de publier une app sans source exploitable.");
  }

  const publishedVersion: GeneratedAppVersion = {
    ...manifest.draftVersion,
    status: 'published',
  };

  return {
    ...manifest,
    status: 'published',
    updatedAt: Date.now(),
    draftVersion: publishedVersion,
    publishedVersion,
  };
}
