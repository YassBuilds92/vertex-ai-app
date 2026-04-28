import type {
  ListingPackProductType,
  ListingPackShot,
  ListingPackStyleId,
} from '../shared/listing-pack.js';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export type AppMode = 'chat' | 'image' | 'video' | 'audio' | 'lyria' | 'cowork';

export interface WorkspaceFile {
  fileId: string;
  fileName: string;
  mimeType: string;
  attachmentType: string;
  storageUri: string;
  fileSizeBytes: number;
  sessionId?: string;
  label: string;
  createdAt: number;
}

export type AttachmentType = 'image' | 'video' | 'audio' | 'document' | 'youtube';

export interface AttachmentVideoMetadata {
  startOffsetSeconds?: number;
  endOffsetSeconds?: number;
  fps?: number;
}

export type MediaGenerationMode = Extract<AppMode, 'image' | 'video' | 'audio' | 'lyria'>;

export interface AttachmentGenerationMeta {
  mode: MediaGenerationMode;
  prompt?: string;
  refinedPrompt?: string;
  model?: string;
  refinerProfileId?: string;
  refinerCustomInstructions?: string;
  shotId?: string;
  shotLabel?: string;
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string; // base64 data URL, blob URL, or youtube URL
  file?: File; // Native file object for cleaner uploads
  storageUri?: string;
  mimeType?: string;
  name?: string;
  base64?: string;
  thumbnail?: string;
  videoMetadata?: AttachmentVideoMetadata;
  generationMeta?: AttachmentGenerationMeta;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  images?: string[];
  thoughtImages?: string[];
  audio?: string;
  video?: string;
  attachments?: Attachment[];
  thoughts?: string;
  activity?: ActivityItem[];
  runState?: RunState;
  runMeta?: RunMeta;
  refinedInstruction?: string;
  createdAt: number;
}

export type RunState = 'running' | 'paused' | 'completed' | 'failed' | 'aborted';

export interface RunMeta {
  iterations: number;
  modelCalls: number;
  toolCalls: number;
  workerCallsCount: number;
  workerMsTotal: number;
  searchCount: number;
  fetchCount: number;
  sourcesOpened: number;
  domainsOpened: number;
  embeddingCount: number;
  embeddingTokens: number;
  vectorSearches: number;
  pythonExecutions: number;
  gitOps: number;
  browserOps: number;
  artifactState: 'none' | 'drafting' | 'created' | 'released';
  stalledTurns: number;
  retryCount: number;
  queueWaitMs: number;
  mode: 'autonomous';
  phase: string;
  taskComplete: boolean;
  inputTokens: number;
  outputTokens: number;
  thoughtTokens: number;
  toolUseTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  estimatedCostEur: number;
}

export type ActivityKind =
  | 'status'
  | 'reasoning'
  | 'narration'
  | 'tool_call'
  | 'tool_result'
  | 'warning';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  timestamp: number;
  iteration: number;
  title?: string;
  message?: string;
  status?: 'info' | 'success' | 'warning' | 'error';
  toolName?: string;
  argsPreview?: string;
  resultPreview?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}

export type AgentOutputKind = 'pdf' | 'html' | 'music' | 'podcast' | 'code' | 'research' | 'automation' | 'image';

export type AgentFieldType = 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'url';

export interface AgentFieldSchema {
  id: string;
  label: string;
  type: AgentFieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: string[];
}

export interface AgentBlueprint {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  summary: string;
  mission: string;
  whenToUse: string;
  outputKind: AgentOutputKind;
  starterPrompt: string;
  systemInstruction: string;
  uiSchema: AgentFieldSchema[];
  tools: string[];
  capabilities: string[];
  status?: 'ready' | 'draft';
  createdBy?: 'manual' | 'cowork';
  sourcePrompt?: string;
  sourceSessionId?: string;
}

export interface StudioAgent extends AgentBlueprint {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: 'ready' | 'draft';
  createdBy: 'manual' | 'cowork';
}

export type AgentFormValues = Record<string, string | boolean>;

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export interface AgentWorkspaceState {
  agent: StudioAgent;
  formValues: AgentFormValues;
  lastLaunchPrompt?: string;
}

export type GeneratedAppStatus = 'draft' | 'published' | 'failed';
export type GeneratedAppOutputKind = AgentOutputKind;

export interface GeneratedAppIdentity {
  mission: string;
  posture: string;
  successCriteria: string[];
}

export type GeneratedAppRuntimeToolDefaults = Record<string, Record<string, JsonValue>>;

export interface GeneratedAppModelProfile {
  textModel: string;
  reasoningLevel?: 'minimal' | 'low' | 'medium' | 'high';
  imageModel?: string;
  musicModel?: string;
  ttsModel?: string;
  videoModel?: string;
}

export interface GeneratedAppVisualDirection {
  thesis: string;
  mood: string;
  accentColor: string;
  surfaceTone: string;
  primaryFont: string;
  secondaryFont?: string;
}

export interface GeneratedAppRuntimeDefinition {
  primaryActionLabel: string;
  resultLabel: string;
  emptyStateLabel?: string;
  editHint?: string;
  toolDefaults?: GeneratedAppRuntimeToolDefaults;
  renderMode?: 'bundle_primary' | 'manifest_fallback';
}

export interface GeneratedAppVersion {
  id: string;
  createdAt: number;
  status: GeneratedAppStatus;
  bundleStatus: 'ready' | 'failed' | 'skipped';
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
}

export interface GeneratedAppManifest {
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
  uiSchema: AgentFieldSchema[];
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
}

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

export interface GeneratedAppCreationTranscriptTurn {
  role: 'user' | 'assistant';
  content: string;
  kind?: 'brief' | 'clarification' | 'answer' | 'info';
}

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

export interface GeneratedAppCreationEvent {
  phase: GeneratedAppCreationPhase;
  label: string;
  manifestPreview?: GeneratedAppManifestPreview;
  sourceCode?: string;
  buildLog?: string;
  transcript?: GeneratedAppCreationTranscriptTurn[];
  clarificationQuestion?: string;
  timestamp?: number;
}

export interface GeneratedAppCreationRun {
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  completedAt?: number;
  phases: GeneratedAppCreationEvent[];
  manifestPreview?: GeneratedAppManifestPreview;
  sourceCode?: string;
  buildLog?: string;
  manifest?: GeneratedAppManifest;
  error?: string;
  transcript?: GeneratedAppCreationTranscriptTurn[];
  awaitingClarification?: boolean;
  clarificationQuestion?: string;
}

export interface GeneratedAppWorkspaceState {
  app: GeneratedAppManifest;
  formValues: AgentFormValues;
  lastLaunchPrompt?: string;
}

export interface SystemPromptVersion {
  version: number;
  prompt: string;
  timestamp: number;
  rationale?: string;
}

export interface SelectedCustomPromptRef {
  id: string;
  title: string;
  prompt: string;
  iconUrl?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  mode: AppMode;
  userId: string;
  systemInstruction?: string;
  selectedCustomPrompt?: SelectedCustomPromptRef;
  systemPromptHistory?: SystemPromptVersion[];
  sessionKind?: 'standard' | 'agent' | 'generated_app';
  agentWorkspace?: AgentWorkspaceState;
  generatedAppWorkspace?: GeneratedAppWorkspaceState;
}

export interface ModelConfig {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  systemInstruction: string;
  refinerEnabled?: boolean;
  refinerProfileId?: string;
  refinerCustomInstructions?: string;
  googleSearch?: boolean;
  googleMaps?: boolean;
  codeExecution?: boolean;
  urlContext?: boolean;
  structuredOutputs?: boolean;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  seed?: number;
  negativePrompt?: string;
  sampleCount?: number;
  numberOfImages?: number;
  aspectRatio?: '' | '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '5:4' | '4:5' | '16:9' | '9:16' | '21:9' | '4:1' | '1:4' | '8:1' | '1:8';
  imageSize?: '512' | '1K' | '2K' | '4K';
  maxOutputTokens?: number;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseMimeType?: 'text/plain' | 'application/json';
  maxThoughtTokens?: number;
  ttsVoice?: string;
  ttsLanguageCode?: string;
  ttsStyleInstructions?: string;
  videoResolution?: '720p' | '1080p' | '4k';
  videoAspectRatio?: '16:9' | '9:16';
  autoSystemInstruction?: boolean;
  personGeneration?: string;
  safetySetting?: string;
  videoDurationSeconds?: number;
  agentDelegationEnabled?: boolean;
}

export interface MediaGenerationRequest {
  originalPrompt?: string;
  refinedPrompt?: string;
  listingPack?: {
    workflow: 'vinted_pack';
    productType: ListingPackProductType;
    styleId: ListingPackStyleId;
    shotCount: number;
    shots: ListingPackShot[];
  };
}

export interface CustomPrompt {
  id: string;
  title: string;
  prompt: string;
  iconUrl?: string; // Base64 image
  createdAt: number;
  userId: string;
}
