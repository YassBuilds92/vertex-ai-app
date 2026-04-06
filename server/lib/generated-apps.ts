import { createHash } from 'crypto';
import { fileURLToPath } from 'node:url';
import { build as buildEsbuild } from 'esbuild';
import {
  isOptionalGeneratedAppBundleIssue,
  normalizeGeneratedAppBundleState,
} from '../../shared/generated-app-bundle.js';

import { DEFAULT_IMAGE_MODEL, DEFAULT_LYRIA_MODEL, DEFAULT_TTS_MODEL } from './media-generation.js';
import { createGoogleAI, parseApiError, retryWithBackoff } from './google-genai.js';
import { log } from './logger.js';
import { uploadToGCS } from './storage.js';

export type GeneratedAppStatus = 'draft' | 'published' | 'failed';
export type GeneratedAppOutputKind = 'pdf' | 'html' | 'music' | 'podcast' | 'code' | 'research' | 'automation' | 'image';
export type GeneratedAppFieldType = 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'url';
export type GeneratedAppJsonPrimitive = string | number | boolean | null;
export type GeneratedAppJsonValue = GeneratedAppJsonPrimitive | GeneratedAppJsonValue[] | { [key: string]: GeneratedAppJsonValue };

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

export type GeneratedAppIdentity = {
  mission: string;
  posture: string;
  successCriteria: string[];
};

export type GeneratedAppRuntimeToolDefaults = Record<string, Record<string, GeneratedAppJsonValue>>;

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
  toolDefaults?: GeneratedAppRuntimeToolDefaults;
  renderMode?: 'bundle_primary' | 'manifest_fallback';
};

export type GeneratedAppBundleStatus = 'ready' | 'failed' | 'skipped';
export type GeneratedAppCreationPhase =
  | 'brief_validated'
  | 'clarification_requested'
  | 'clarification_resolved'
  | 'spec_ready'
  | 'source_ready'
  | 'bundle_ready'
  | 'bundle_skipped'
  | 'bundle_failed'
  | 'manifest_ready';

export type GeneratedAppCreationTranscriptTurn = {
  role: 'user' | 'assistant';
  content: string;
  kind?: 'brief' | 'clarification' | 'answer' | 'info';
};

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
  modalities: string[];
  identity: GeneratedAppIdentity;
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
  generationMode?: 'legacy_manifest' | 'autonomous_component';
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
  | 'modalities'
  | 'identity'
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
  transcript?: GeneratedAppCreationTranscriptTurn[];
  clarificationQuestion?: string;
  timestamp: number;
};

type DraftDefinition = Omit<
  GeneratedAppManifest,
  'id' | 'status' | 'createdAt' | 'updatedAt' | 'draftVersion' | 'publishedVersion'
>;

type GeneratedAppCreationProgressHandler = (event: GeneratedAppCreationProgressEvent) => void | Promise<void>;
type GeneratedAppPlannerBuilder = (
  transcript: GeneratedAppCreationTranscriptTurn[],
  source: 'manual' | 'cowork'
) => Promise<GeneratedAppPlannerDecision>;
type GeneratedAppVersionBuilder = (sourceCode: string, slug: string) => Promise<GeneratedAppVersion>;
type GeneratedAppSourceBuilder = (definition: DraftDefinition) => Promise<string>;
type GeneratedAppPlannerDecision =
  | {
      status: 'needs_clarification';
      question: string;
      transcript: GeneratedAppCreationTranscriptTurn[];
    }
  | {
      status: 'ready';
      definition: DraftDefinition;
      transcript: GeneratedAppCreationTranscriptTurn[];
      clarificationResolved: boolean;
    };
type GeneratedAppCreationResult =
  | {
      status: 'clarification_requested';
      transcript: GeneratedAppCreationTranscriptTurn[];
      question: string;
    }
  | {
      status: 'completed';
      transcript: GeneratedAppCreationTranscriptTurn[];
      manifest: GeneratedAppManifest;
    };

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
type GeneratedAppToolName = typeof TOOL_LIBRARY[number];

const TEXT_MODELS = ['gemini-3.1-pro-preview', 'gemini-3.1-flash-lite-preview'] as const;
const IMAGE_MODELS = [DEFAULT_IMAGE_MODEL] as const;
const MUSIC_MODELS = [DEFAULT_LYRIA_MODEL, 'lyria-3-pro-preview', 'lyria-3-clip-preview', 'lyria-002'] as const;
const TTS_MODELS = [DEFAULT_TTS_MODEL, 'gemini-2.5-pro-tts', 'gemini-2.5-flash-tts'] as const;

const PLANNER_PROMPT = `Retourne UNIQUEMENT un JSON valide pour la prochaine etape de creation d'une app experte Cowork.
Deux sorties possibles:
1. {"status":"needs_clarification","question":"..."}
2. {"status":"ready","definition":{...}}
REGLE CRITIQUE : Si c'est le PREMIER message de l'utilisateur (transcript vide ou un seul message), tu DOIS TOUJOURS retourner needs_clarification. Ne retourne JAMAIS status:ready au premier message, meme si le brief semble complet. Pose UNE question qui creuse les besoins reels : style visuel souhaite, public cible, modeles IA preferes, experience attendue, cas d'usage concret. La question doit etre precise, naturelle, et doit vraiment affiner la vision.
Quand le transcript contient deja au moins une reponse de clarification, tu peux retourner status:ready avec la definition complete.
Champs obligatoires dans definition: name, slug, tagline, summary, mission, whenToUse, outputKind, modalities, identity, starterPrompt, systemInstruction, toolAllowList, capabilities, uiSchema, modelProfile, visualDirection, runtime.
outputKind autorise pour compatibilite store: pdf | html | music | podcast | code | research | automation | image.
Outils autorises: ${TOOL_LIBRARY.join(', ')}.
Modeles texte: ${TEXT_MODELS.join(', ')}.
Modeles image: ${IMAGE_MODELS.join(', ')}.
Modeles musique: ${MUSIC_MODELS.join(', ')}.
Modeles TTS: ${TTS_MODELS.join(', ')}.
3 a 8 champs UI max. Ecris en francais. L'app peut etre hybride. outputKind est seulement un tag legacy pour le store, pas une contrainte de conception.
runtime.toolDefaults doit encoder les defaults utiles par outil quand l'app en a besoin.
visualDirection OBLIGATOIRE: choisis une accentColor unique et specifique au domaine (ex: pour un generateur de sprites : #a855f7, pour un generateur de cartes : #f59e0b, pour un studio musical : #10b981). mood, thesis et surfaceTone doivent etre coherents avec l'app et pas generiques.`;

const REVISION_PROMPT = `Retourne UNIQUEMENT un JSON valide pour mettre a jour une app experte Cowork existante.
Conserve l'identite utile de l'app. Mets a jour interface, prompt, outils, modalities, identity, runtime.toolDefaults et modelProfile selon la demande.
3 a 8 champs UI max. Ecris en francais.`;

const SOURCE_GENERATOR_PROMPT = `Retourne UNIQUEMENT du code TSX valide. Aucun markdown, aucune explication, aucune fence.
Tu codes une vraie application avec une interface COMPLETEMENT sur mesure pour cette app specifique.
REGLES ABSOLUES:
- import React from 'react' uniquement, aucun autre import
- styles uniquement inline (objets JS) ou template literals dans style={{}}
- le composant est export default, self-contained
- props disponibles: manifest, featureDeck, formValues, isRunning, messages, onFieldChange, onRun, onPublish, canPublish, onAskCowork

DESIGN SYSTEM OBLIGATOIRE:
- fond principal: #050810 ou #060b12
- utilise manifest.visualDirection.accentColor comme couleur dominante PARTOUT (titres, bordures actives, boutons, glows, gradients)
- typographie: font-size grand pour le titre principal (28-40px), sous-titres mediums, labels en uppercase tracking-widest
- espacements genereux, layout qui respire
- bordures: 1px solid avec rgba de l'accentColor a 0.18-0.25
- glows subtils: box-shadow avec l'accentColor a faible opacite (0.08-0.15)
- coins arrondis: 12-16px pour les cards, 8-10px pour les inputs, 999px pour les badges

INTERFACE SUR MESURE - TU DOIS:
- creer un layout UNIQUE adapte a ce que fait l'app. Exemples:
  * generateur de sprite → zone de preview en grille avec cellules animees, controles de vitesse FPS, palette de couleurs
  * generateur de carte Pokemon → apercu de la carte en temps reel avec le fond themed, champs de stats integres visuellement
  * studio musical → visualiseur de forme d'onde, lecteur audio custom, knobs de parametres
  * studio podcast → transcripteur, frise chronologique des tours de parole, player
  * generateur de recherche → cartes de sources, timeline de gathering, synthese progressive
- chaque section a un titre contextuel (pas "ATELIER", pas "RESULTATS" generiques — utilise les vrais mots du domaine)
- les boutons d'action sont des elements visuellement distincts et clairement clickables avec l'accentColor
- affiche les resultats deja presents dans messages de facon pertinente (images en grid, audio avec player, texte structure)
- si isRunning=true, montre un indicateur d'activite thematique (pas juste un spinner — adapte a l'app)

ABSOLUMENT INTERDIT:
- copier le layout du GeneratedAppCanvas generique (deux colonnes ATELIER/RESULTATS avec grid xl:grid-cols-2)
- utiliser des classes Tailwind (pas de className avec strings Tailwind)
- utiliser bg-[#...], text-[...] ou autres utilities Tailwind dans className
- aucun composant externe (lucide, etc.)
- aucun formValues[field.id] generique itere en boucle sans mise en scene — chaque champ doit avoir sa propre presentation visuelle contextualisee`;

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

function defaultFields(): GeneratedAppFieldSchema[] {
  return [
    { id: 'brief', label: 'Brief', type: 'textarea', placeholder: 'Decris ici la mission exacte.', helpText: "Le coeur de la demande transmis a l'app.", required: true },
    { id: 'goal', label: 'Resultat vise', type: 'text', placeholder: 'Le rendu ideal a produire', helpText: 'Le resultat attendu quand il faut le preciser.' },
    { id: 'constraints', label: 'Contraintes', type: 'textarea', placeholder: 'Ton, format, limites, angle, style...', helpText: 'Les limites ou preferences a respecter.' },
  ];
}

function sanitizeLegacyOutputKind(rawOutputKind: unknown): GeneratedAppOutputKind {
  const explicit = typeof rawOutputKind === 'string' ? rawOutputKind.trim() : '';
  return ['pdf', 'html', 'music', 'podcast', 'code', 'research', 'automation', 'image'].includes(explicit)
    ? explicit as GeneratedAppOutputKind
    : 'research';
}

function sanitizeJsonValue(value: unknown, depth = 0): GeneratedAppJsonValue | undefined {
  if (depth > 4) return undefined;
  if (value === null) return null;
  if (typeof value === 'string') {
    const clipped = clipText(value, 220);
    return clipped.length > 0 ? clipped : undefined;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const next = value
      .slice(0, 8)
      .map((item) => sanitizeJsonValue(item, depth + 1))
      .filter((item): item is GeneratedAppJsonValue => item !== undefined);
    return next;
  }
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, 16)
      .map(([key, nested]) => {
        const normalized = sanitizeJsonValue(nested, depth + 1);
        return normalized === undefined ? null : [clipText(key, 80), normalized] as const;
      })
      .filter((entry): entry is readonly [string, GeneratedAppJsonValue] => Boolean(entry?.[0]));
    return Object.fromEntries(entries);
  }
  return undefined;
}

function sanitizeModalities(input: unknown): string[] {
  const explicit = uniqueStrings(input, 8);
  if (explicit.length > 0) return explicit;
  return ['text'];
}

function sanitizeIdentity(input: unknown, fallbackMission: string): GeneratedAppIdentity {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const successCriteria = uniqueStrings(source.successCriteria, 5);
  return {
    mission: clipText(source.mission, 220) || fallbackMission,
    posture: clipText(source.posture, 180) || 'Expert autonome, net, honnête et orienté résultat.',
    successCriteria: successCriteria.length > 0
      ? successCriteria
      : [
          'Comprend vite le besoin réel',
          'Choisit une stratégie adaptée sans wizard imposé',
          'Livre un résultat exploitable et assumé',
        ],
  };
}

function sanitizeToolDefaults(input: unknown): GeneratedAppRuntimeToolDefaults {
  if (!input || typeof input !== 'object') return {};
  const entries = Object.entries(input as Record<string, unknown>)
    .map(([toolName, rawDefaults]) => {
      const normalizedToolName = clipText(toolName, 80);
      if (!TOOL_LIBRARY.includes(normalizedToolName as GeneratedAppToolName)) return null;
      if (!rawDefaults || typeof rawDefaults !== 'object' || Array.isArray(rawDefaults)) return null;
      const sanitizedEntries = Object.entries(rawDefaults as Record<string, unknown>)
        .slice(0, 24)
        .map(([key, value]) => {
          const normalizedValue = sanitizeJsonValue(value);
          if (normalizedValue === undefined) return null;
          return [clipText(key, 80), normalizedValue] as const;
        })
        .filter((entry): entry is readonly [string, GeneratedAppJsonValue] => Boolean(entry?.[0]));
      if (sanitizedEntries.length === 0) return null;
      return [normalizedToolName, Object.fromEntries(sanitizedEntries)] as const;
    })
    .filter((entry): entry is readonly [string, Record<string, GeneratedAppJsonValue>] => Boolean(entry));
  return Object.fromEntries(entries);
}

function sanitizeFields(input: unknown): GeneratedAppFieldSchema[] {
  if (!Array.isArray(input)) return defaultFields();

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

  return fields.length > 0 ? fields : defaultFields();
}

function mergeCapabilityDeck(primary: string[], secondary: string[], max = 6): string[] {
  const seen = new Set<string>();
  const merged: string[] = [];

  for (const value of [...primary, ...secondary]) {
    const text = clipText(value, 140);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(text);
    if (merged.length >= max) break;
  }

  return merged;
}

function sanitizeToolAllowList(
  input: unknown,
  runtimeToolDefaults: GeneratedAppRuntimeToolDefaults = {}
): string[] {
  const requested = uniqueStrings(input, 18)
    .filter((tool): tool is GeneratedAppToolName => TOOL_LIBRARY.includes(tool as GeneratedAppToolName));
  const hintedTools = Object.keys(runtimeToolDefaults)
    .filter((tool): tool is GeneratedAppToolName => TOOL_LIBRARY.includes(tool as GeneratedAppToolName));
  const curated = Array.from(new Set<GeneratedAppToolName>([...requested, ...hintedTools]));
  if (curated.length > 0) return curated;
  return ['web_search', 'web_fetch', 'release_file'];
}

function sanitizeModelProfile(
  input: unknown
): GeneratedAppModelProfile {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const pickModel = (value: unknown, library: readonly string[], fallback: string) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return library.includes(text) ? text : fallback;
  };
  const pickOptionalModel = (value: unknown, library: readonly string[]) => {
    const text = typeof value === 'string' ? value.trim() : '';
    return library.includes(text) ? text : undefined;
  };
  const reasoningLevel = ['minimal', 'low', 'medium', 'high'].includes(String(source.reasoningLevel || ''))
    ? String(source.reasoningLevel) as GeneratedAppModelProfile['reasoningLevel']
    : 'medium';

  return {
    textModel: pickModel(source.textModel, TEXT_MODELS, 'gemini-3.1-flash-lite-preview'),
    reasoningLevel,
    imageModel: pickOptionalModel(source.imageModel, IMAGE_MODELS),
    musicModel: pickOptionalModel(source.musicModel, MUSIC_MODELS),
    ttsModel: pickOptionalModel(source.ttsModel, TTS_MODELS),
    videoModel: undefined,
  };
}

function sanitizeVisualDirection(input: unknown): GeneratedAppVisualDirection {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    thesis: clipText(source.thesis, 180) || 'Une interface forte, frontale et concentree sur un geste principal.',
    mood: clipText(source.mood, 60) || 'premium concentre',
    accentColor: /^#([0-9a-f]{6})$/i.test(String(source.accentColor || '').trim()) ? String(source.accentColor).trim() : '#7dd3fc',
    surfaceTone: clipText(source.surfaceTone, 120) || 'surfaces denses, halo controle, contraste net',
    primaryFont: clipText(source.primaryFont, 80) || 'Sora',
    secondaryFont: clipText(source.secondaryFont, 80) || 'IBM Plex Sans',
  };
}

function sanitizeRuntime(input: unknown): GeneratedAppRuntimeDefinition {
  const source = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  return {
    primaryActionLabel: clipText(source.primaryActionLabel, 52) || 'Lancer maintenant',
    resultLabel: clipText(source.resultLabel, 60) || 'Resultats',
    emptyStateLabel: clipText(source.emptyStateLabel, 180) || 'Le prochain run doit sortir ici avec son artefact principal et ses variantes utiles.',
    editHint: clipText(source.editHint, 220) || "Decris ici l'evolution voulue. Cowork regenerera une nouvelle draft sans casser la version publiee.",
    toolDefaults: sanitizeToolDefaults(source.toolDefaults),
    renderMode: source.renderMode === 'manifest_fallback' ? 'manifest_fallback' : 'bundle_primary',
  };
}

function sanitizeDefinition(raw: unknown, brief: string, source: 'manual' | 'cowork'): DraftDefinition {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const fallbackMission = clipText(input.mission, 320) || clipText(brief, 320) || 'Accomplir une mission experte avec une interface nette.';
  const name = clipText(input.name, 52) || 'Cowork Expert App';
  const slug = slugify(String(input.slug || name));
  const runtime = sanitizeRuntime(input.runtime);
  const toolAllowList = sanitizeToolAllowList(input.toolAllowList, runtime.toolDefaults);
  const modalities = sanitizeModalities(input.modalities);
  const outputKind = sanitizeLegacyOutputKind(input.outputKind);
  const uiSchema = sanitizeFields(input.uiSchema);
  const requestedCapabilities = uniqueStrings(input.capabilities, 6);
  const fallbackCapabilities = ['Cadre vite la mission', 'Agit avec une vraie autonomie', 'Expose un resultat publiable'];
  const capabilities = requestedCapabilities.length > 0
    ? mergeCapabilityDeck(requestedCapabilities, fallbackCapabilities)
    : fallbackCapabilities;
  const identity = sanitizeIdentity(input.identity, fallbackMission);
  const systemInstruction = clipText(input.systemInstruction, 5000)
    || `Tu es ${name}, une app experte concue par Cowork. Mission: ${identity.mission} Posture: ${identity.posture}`;

  return {
    name,
    slug,
    tagline: clipText(input.tagline, 92) || 'App experte generee par Cowork',
    summary: clipText(input.summary, 220) || clipText(brief, 220) || 'App experte prete a lancer.',
    mission: fallbackMission,
    whenToUse: clipText(input.whenToUse, 220) || `Utilise cette app quand le besoin principal tourne autour de ${name.toLowerCase()}.`,
    outputKind,
    modalities,
    identity,
    starterPrompt: clipText(input.starterPrompt, 420) || `Prends en charge cette mission dans ${name}.`,
    systemInstruction,
    uiSchema,
    toolAllowList,
    capabilities,
    modelProfile: sanitizeModelProfile(input.modelProfile),
    visualDirection: sanitizeVisualDirection(input.visualDirection),
    runtime,
    createdBy: source,
    sourcePrompt: clipText(input.sourcePrompt || brief, 1500) || undefined,
    sourceSessionId: clipText(input.sourceSessionId, 120) || undefined,
    generationMode: input.generationMode === 'legacy_manifest' ? 'legacy_manifest' : 'autonomous_component',
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
    modalities: definition.modalities,
    identity: definition.identity,
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

function normalizeCreationTranscript(
  transcript?: GeneratedAppCreationTranscriptTurn[],
  brief?: string
): GeneratedAppCreationTranscriptTurn[] {
  const normalizedTranscript = Array.isArray(transcript)
    ? transcript
        .map((turn): GeneratedAppCreationTranscriptTurn => ({
          role: turn.role === 'assistant' ? 'assistant' : 'user',
          content: clipText(turn.content, 2200),
          kind: turn.kind,
        }))
        .filter((turn) => turn.content.length > 0)
        .slice(-12)
    : [];

  if (normalizedTranscript.some((turn) => turn.role === 'user' && turn.content.trim().length > 0)) {
    return normalizedTranscript;
  }

  if (typeof brief === 'string' && brief.trim().length > 0) {
    return [{
      role: 'user',
      content: validateGeneratedAppBrief(brief),
      kind: 'brief',
    }];
  }

  throw new Error("Le flux de creation d'app attend au moins un brief ou un transcript utilisateur.");
}

function transcriptToPrompt(transcript: GeneratedAppCreationTranscriptTurn[]): string {
  return transcript
    .map((turn, index) => `${index + 1}. ${turn.role === 'assistant' ? 'Cowork' : 'Utilisateur'}: ${turn.content}`)
    .join('\n');
}

function extractTsxSource(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('Aucun code TSX exploitable retourne.');
  }
  const fenced = trimmed.match(/```(?:tsx|ts|jsx|js)?\s*([\s\S]*?)```/i);
  return (fenced?.[1] || trimmed).trim();
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

const embeddedManifest = ${embeddedManifest};
const featureDeck = ${featureDeck};

function collectArtifacts(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && message.role === 'model')
    .flatMap((message) => Array.isArray(message.attachments) ? message.attachments : [])
    .slice()
    .reverse()
    .slice(0, 6);
}

function collectToolDefaults(manifest) {
  const runtime = manifest?.runtime && typeof manifest.runtime === 'object' ? manifest.runtime : {};
  const defaults = runtime?.toolDefaults && typeof runtime.toolDefaults === 'object' ? runtime.toolDefaults : {};
  return Object.entries(defaults).slice(0, 4);
}

export default function GeneratedCoworkApp(props) {
  const manifest = props?.manifest || embeddedManifest;
  const accentColor = manifest?.visualDirection?.accentColor || '#7dd3fc';
  const fields = Array.isArray(manifest?.uiSchema) ? manifest.uiSchema : [];
  const artifacts = collectArtifacts(props?.messages);
  const toolDefaults = collectToolDefaults(manifest);
  const identity = manifest?.identity || embeddedManifest.identity;
  const modalities = Array.isArray(manifest?.modalities) ? manifest.modalities : embeddedManifest.modalities;
  const headline = identity?.mission || manifest?.mission || embeddedManifest.mission;

  return (
    <div
      style={{
        minHeight: '100%',
        padding: '28px',
        borderRadius: '32px',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'radial-gradient(circle at 12% 12%, rgba(125,211,252,0.16), transparent 28%), radial-gradient(circle at 82% 14%, rgba(255,255,255,0.08), transparent 18%), linear-gradient(180deg, rgba(8,12,20,0.98), rgba(6,11,18,0.98))',
        color: 'white',
        fontFamily: manifest?.visualDirection?.primaryFont || 'Sora, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.24em', textTransform: 'uppercase', opacity: 0.42 }}>
            {(manifest?.outputKind || 'app')} · composant autonome
          </div>
          <h1 style={{ margin: '12px 0 0', fontSize: '32px', lineHeight: 1, letterSpacing: '-0.04em' }}>
            {manifest?.name || embeddedManifest.name}
          </h1>
          <p style={{ marginTop: '12px', maxWidth: '720px', fontSize: '14px', lineHeight: 1.7, opacity: 0.7 }}>
            {manifest?.tagline || embeddedManifest.tagline}
          </p>
        </div>
        <div
          style={{
            alignSelf: 'flex-start',
            padding: '10px 14px',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.04)',
            fontSize: '11px',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            opacity: 0.8,
          }}
        >
          bundle primary
        </div>
      </div>

      <div style={{ marginTop: '26px', display: 'grid', gap: '18px', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)' }}>
        <section
          style={{
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.04)',
            padding: '22px',
          }}
        >
          <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.42 }}>
            Identité
          </div>
          <div style={{ marginTop: '12px', fontSize: '22px', fontWeight: 700, lineHeight: 1.12, letterSpacing: '-0.04em' }}>
            {headline}
          </div>
          <p style={{ marginTop: '12px', fontSize: '14px', lineHeight: 1.8, opacity: 0.78 }}>
            {identity?.posture || manifest?.summary || embeddedManifest.summary}
          </p>
          <div style={{ marginTop: '18px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {featureDeck.map((item) => (
              <span
                key={item}
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '8px 12px',
                  fontSize: '12px',
                  opacity: 0.8,
                }}
              >
                {item}
              </span>
            ))}
            {Array.isArray(modalities) ? modalities.slice(0, 4).map((item) => (
              <span
                key={item}
                style={{
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '8px 12px',
                  fontSize: '12px',
                  opacity: 0.7,
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                {item}
              </span>
            )) : null}
          </div>

          <div style={{ marginTop: '24px', display: 'grid', gap: '14px', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
            <div style={{ borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '16px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.42 }}>
                Critères de réussite
              </div>
              <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
                {(Array.isArray(identity?.successCriteria) ? identity.successCriteria : []).slice(0, 4).map((item) => (
                  <div key={item} style={{ fontSize: '13px', lineHeight: 1.6, opacity: 0.82 }}>
                    • {item}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ borderRadius: '18px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)', padding: '16px' }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.42 }}>
                Defaults outils
              </div>
              <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
                {toolDefaults.length > 0 ? toolDefaults.map(([toolName, args]) => (
                  <div key={toolName} style={{ fontSize: '13px', lineHeight: 1.6, opacity: 0.78 }}>
                    <div style={{ fontWeight: 700 }}>{toolName}</div>
                    <div style={{ opacity: 0.62 }}>{Object.keys(args).join(', ') || 'aucun argument par défaut'}</div>
                  </div>
                )) : (
                  <div style={{ fontSize: '13px', opacity: 0.58 }}>
                    Aucun default outil explicite.
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{ marginTop: '24px' }}>
            <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.42 }}>
              Interface opérable
            </div>
            <div style={{ marginTop: '12px', display: 'grid', gap: '10px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {fields.length > 0 ? fields.map((field) => (
                <div
                  key={field.id}
                  style={{
                    borderRadius: '16px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    padding: '12px 14px',
                    background: 'rgba(255,255,255,0.03)',
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{field.label}</div>
                  <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.6 }}>
                    {field.type}{field.required ? ' - requis' : ''}
                  </div>
                  {field.helpText ? (
                    <div style={{ marginTop: '8px', fontSize: '12px', lineHeight: 1.6, opacity: 0.52 }}>
                      {field.helpText}
                    </div>
                  ) : null}
                </div>
              )) : (
                <div style={{ fontSize: '13px', opacity: 0.58 }}>
                  Aucun champ configuré pour cette app.
                </div>
              )}
            </div>
          </div>
        </section>

        <aside
          style={{
            borderRadius: '22px',
            border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(255,255,255,0.03)',
            padding: '18px',
          }}
        >
          <div style={{ fontSize: '11px', letterSpacing: '0.2em', textTransform: 'uppercase', opacity: 0.42 }}>
            Résultats
          </div>
          <div style={{ marginTop: '12px', display: 'grid', gap: '10px' }}>
            {artifacts.length > 0 ? artifacts.map((artifact, index) => (
              <div
                key={artifact?.url || artifact?.name || index}
                style={{
                  borderRadius: '16px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  padding: '12px 14px',
                  background: 'rgba(255,255,255,0.03)',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                  {artifact?.name || artifact?.type || 'Artefact'}
                </div>
                <div style={{ marginTop: '6px', fontSize: '12px', opacity: 0.6 }}>
                  {artifact?.type || 'fichier'}
                </div>
              </div>
            )) : (
              <div
                style={{
                  borderRadius: '16px',
                  border: '1px dashed rgba(255,255,255,0.14)',
                  padding: '16px',
                  fontSize: '13px',
                  lineHeight: 1.7,
                  opacity: 0.58,
                }}
              >
                {manifest?.runtime?.emptyStateLabel || 'Le prochain run affichera ses artefacts ici.'}
              </div>
            )}
          </div>

          <div
            style={{
              marginTop: '18px',
              borderRadius: '18px',
              padding: '14px 16px',
              background: accentColor,
              color: '#04111d',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            {manifest?.runtime?.primaryActionLabel || 'Lancer'}
          </div>
        </aside>
      </div>
    </div>
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
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
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

async function generateDefinitionPlanFromTranscript(
  transcript: GeneratedAppCreationTranscriptTurn[],
  source: 'manual' | 'cowork'
): Promise<GeneratedAppPlannerDecision> {
  const ai = createGoogleAI(GENERATED_APP_MODEL);
  const result = await retryWithBackoff(() => ai.models.generateContent({
    model: GENERATED_APP_MODEL,
    contents: [{ role: 'user', parts: [{ text: transcriptToPrompt(transcript) }] }],
    config: {
      systemInstruction: PLANNER_PROMPT,
      temperature: 0.28,
      topP: 0.95,
      maxOutputTokens: 4096,
      responseMimeType: 'text/plain',
    },
  }));

  const parsed = extractJsonObject(result.text || '');
  const status = typeof parsed.status === 'string' ? parsed.status.trim().toLowerCase() : '';
  if (status === 'needs_clarification') {
    const question = clipText(parsed.question, 420);
    if (!question) {
      throw new Error("Le planner de generated app a retourne une clarification vide.");
    }
    return {
      status: 'needs_clarification',
      question,
      transcript: [...transcript, { role: 'assistant', content: question, kind: 'clarification' }],
    };
  }

  const definition = sanitizeDefinition(parsed.definition || parsed, transcriptToPrompt(transcript), source);
  const clarificationResolved = transcript.some((turn) => turn.role === 'assistant' && turn.kind === 'clarification');
  return {
    status: 'ready',
    definition: {
      ...definition,
      generationMode: 'autonomous_component',
    },
    transcript,
    clarificationResolved,
  };
}

async function generateSourceFromDefinition(definition: DraftDefinition): Promise<string> {
  const ai = createGoogleAI(GENERATED_APP_MODEL);
  const prompt = [
    'Manifest de l app a rendre en TSX:',
    JSON.stringify({
      name: definition.name,
      tagline: definition.tagline,
      summary: definition.summary,
      mission: definition.mission,
      whenToUse: definition.whenToUse,
      outputKind: definition.outputKind,
      modalities: definition.modalities,
      identity: definition.identity,
      starterPrompt: definition.starterPrompt,
      systemInstruction: definition.systemInstruction,
      uiSchema: definition.uiSchema,
      toolAllowList: definition.toolAllowList,
      capabilities: definition.capabilities,
      modelProfile: definition.modelProfile,
      visualDirection: definition.visualDirection,
      runtime: definition.runtime,
    }, null, 2),
    '',
    "Retourne uniquement le composant TSX final.",
  ].join('\n');

  const result = await retryWithBackoff(() => ai.models.generateContent({
    model: GENERATED_APP_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      systemInstruction: SOURCE_GENERATOR_PROMPT,
      temperature: 0.32,
      topP: 0.95,
      maxOutputTokens: 8192,
      responseMimeType: 'text/plain',
    },
  }));

  return extractTsxSource(result.text || '');
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

function detectManifestGenerationMode(input: Record<string, unknown>): 'legacy_manifest' | 'autonomous_component' {
  if (input.generationMode === 'legacy_manifest') return 'legacy_manifest';
  if (input.generationMode === 'autonomous_component') return 'autonomous_component';

  const hasAutonomousContract = Array.isArray(input.modalities)
    || Boolean(input.identity && typeof input.identity === 'object')
    || Boolean(
      input.runtime
      && typeof input.runtime === 'object'
      && !Array.isArray(input.runtime)
      && 'toolDefaults' in input.runtime
    );

  return hasAutonomousContract ? 'autonomous_component' : 'legacy_manifest';
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
  const generationMode = detectManifestGenerationMode(input);
  const draftVersion = sanitizeVersion(input.draftVersion, definition.slug);
  const publishedVersion = input.publishedVersion ? sanitizeVersion(input.publishedVersion, definition.slug) : undefined;
  return {
    ...definition,
    generationMode,
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
    transcript?: GeneratedAppCreationTranscriptTurn[];
    planDefinition?: GeneratedAppPlannerBuilder;
    buildVersion?: GeneratedAppVersionBuilder;
    generateSource?: GeneratedAppSourceBuilder;
  }
): Promise<GeneratedAppCreationResult> {
  const cleanedBrief = brief.trim();
  const transcript = normalizeCreationTranscript(options?.transcript, cleanedBrief);
  const onProgress = options?.onProgress;
  const planDefinition = options?.planDefinition || generateDefinitionPlanFromTranscript;
  const buildVersion = options?.buildVersion || buildGeneratedAppVersion;
  const generateSource = options?.generateSource || generateSourceFromDefinition;
  const sourcePrompt = clipText(transcriptToPrompt(transcript), 1500);

  await emitGeneratedAppProgress(onProgress, {
    phase: 'brief_validated',
    label: 'Brief verrouille et pret pour la spec.',
    transcript,
  });

  const planningDecision = await planDefinition(transcript, source);
  if (planningDecision.status === 'needs_clarification') {
    await emitGeneratedAppProgress(onProgress, {
      phase: 'clarification_requested',
      label: planningDecision.question,
      transcript: planningDecision.transcript,
      clarificationQuestion: planningDecision.question,
    });
    return {
      status: 'clarification_requested',
      transcript: planningDecision.transcript,
      question: planningDecision.question,
    };
  }

  const definition = planningDecision.definition;
  const manifestPreview = buildManifestPreview(definition);

  if (planningDecision.clarificationResolved) {
    await emitGeneratedAppProgress(onProgress, {
      phase: 'clarification_resolved',
      label: 'Clarification integree, Cowork repart sur la generation complete.',
      manifestPreview,
      transcript: planningDecision.transcript,
    });
  }

  await emitGeneratedAppProgress(onProgress, {
    phase: 'spec_ready',
    label: `Spec experte prete pour ${definition.name}.`,
    manifestPreview,
    transcript: planningDecision.transcript,
  });

  let sourceCode: string;
  try {
    sourceCode = await generateSource(definition);
  } catch (error) {
    const cleanError = parseApiError(error);
    log.warn('Generated app source generation fallback active', { slug: definition.slug, error: cleanError });
    sourceCode = renderGeneratedAppSource(definition);
  }
  await emitGeneratedAppProgress(onProgress, {
    phase: 'source_ready',
    label: 'Source TSX generee pour la draft.',
    manifestPreview,
    sourceCode,
    transcript: planningDecision.transcript,
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
    transcript: planningDecision.transcript,
  });

  const manifest = materializeManifest(definition, draftVersion, {
    createdBy: source,
    sourcePrompt,
  });

  await emitGeneratedAppProgress(onProgress, {
    phase: 'manifest_ready',
    label: `App ${manifest.name} prete pour le store.`,
    manifestPreview,
    sourceCode,
    buildLog: draftVersion.buildLog,
    transcript: planningDecision.transcript,
  });

  return {
    status: 'completed',
    transcript: planningDecision.transcript,
    manifest,
  };
}

export async function createGeneratedAppFromBrief(brief: string, source: 'manual' | 'cowork' = 'manual'): Promise<GeneratedAppManifest> {
  try {
    const result = await createGeneratedAppFromBriefWithProgress(brief, source);
    if (result.status !== 'completed') {
      throw new Error(`La creation d'app demande encore une clarification: ${result.question}`);
    }
    return result.manifest;
  } catch (error) {
    const cleanError = parseApiError(error);
    log.error('Generated app creation failed', cleanError);
    throw new Error(cleanError);
  }
}

export async function reviseGeneratedApp(existing: GeneratedAppManifest, changeRequest: string): Promise<GeneratedAppManifest> {
  try {
    const definition = await generateRevision(existing, changeRequest);
    let sourceCode: string;
    try {
      sourceCode = await generateSourceFromDefinition(definition);
    } catch (error) {
      const cleanError = parseApiError(error);
      log.warn('Generated app revision source fallback active', { slug: existing.slug || definition.slug, error: cleanError });
      sourceCode = renderGeneratedAppSource(definition);
    }
    const draftVersion = await buildGeneratedAppVersion(sourceCode, existing.slug || definition.slug);

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
