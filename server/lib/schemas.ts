import { z } from 'zod';

export const ChatRefineSchema = z.object({
  prompt: z.string(),
  type: z.enum(['system', 'icon']).optional(),
});

export const AgentCreateSchema = z.object({
  brief: z.string(),
  source: z.enum(['manual', 'cowork']).optional(),
});

export const GeneratedAppCreateSchema = z.object({
  brief: z.string().optional(),
  transcript: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    kind: z.enum(['brief', 'clarification', 'answer', 'info']).optional(),
  })).optional(),
  source: z.enum(['manual', 'cowork']).optional(),
}).refine((value) => {
  const brief = typeof value.brief === 'string' ? value.brief.trim() : '';
  const transcriptHasUserTurn = Array.isArray(value.transcript)
    && value.transcript.some((turn) => turn.role === 'user' && turn.content.trim().length > 0);
  return brief.length > 0 || transcriptHasUserTurn;
}, {
  message: "Le flux de creation d'app attend au moins un brief ou un transcript utilisateur.",
});

const AgentFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['text', 'textarea', 'select', 'number', 'boolean', 'url']),
  placeholder: z.string().optional(),
  helpText: z.string().optional(),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

const GeneratedAppModelProfileSchema = z.object({
  textModel: z.string(),
  reasoningLevel: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
  imageModel: z.string().optional(),
  musicModel: z.string().optional(),
  ttsModel: z.string().optional(),
  videoModel: z.string().optional(),
});

const GeneratedAppVisualDirectionSchema = z.object({
  thesis: z.string(),
  mood: z.string(),
  accentColor: z.string(),
  surfaceTone: z.string(),
  primaryFont: z.string(),
  secondaryFont: z.string().optional(),
});

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ])
);

const GeneratedAppIdentitySchema = z.object({
  mission: z.string(),
  posture: z.string(),
  successCriteria: z.array(z.string()),
});

const GeneratedAppRuntimeDefinitionSchema = z.object({
  primaryActionLabel: z.string(),
  resultLabel: z.string(),
  emptyStateLabel: z.string().optional(),
  editHint: z.string().optional(),
  toolDefaults: z.record(z.string(), z.record(z.string(), JsonValueSchema)).optional(),
  renderMode: z.enum(['bundle_primary', 'manifest_fallback']).optional(),
});

const GeneratedAppVersionSchema = z.object({
  id: z.string(),
  createdAt: z.number(),
  status: z.enum(['draft', 'published', 'failed']),
  bundleStatus: z.enum(['ready', 'failed', 'skipped']),
  sourceCode: z.string(),
  bundleCode: z.string().optional(),
  sourceAssetPath: z.string().optional(),
  bundleAssetPath: z.string().optional(),
  sourceUrl: z.string().optional(),
  bundleUrl: z.string().optional(),
  bundleFormat: z.enum(['esm']),
  sourceHash: z.string(),
  bundleHash: z.string().optional(),
  buildLog: z.string().optional(),
});

export const GeneratedAppManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  tagline: z.string(),
  summary: z.string(),
  mission: z.string(),
  whenToUse: z.string(),
  outputKind: z.enum(['pdf', 'html', 'music', 'podcast', 'code', 'research', 'automation', 'image']),
  modalities: z.array(z.string()).optional(),
  identity: GeneratedAppIdentitySchema.optional(),
  starterPrompt: z.string(),
  systemInstruction: z.string(),
  uiSchema: z.array(AgentFieldSchema),
  toolAllowList: z.array(z.string()),
  capabilities: z.array(z.string()),
  modelProfile: GeneratedAppModelProfileSchema,
  visualDirection: GeneratedAppVisualDirectionSchema,
  runtime: GeneratedAppRuntimeDefinitionSchema,
  status: z.enum(['draft', 'published', 'failed']),
  createdBy: z.enum(['manual', 'cowork']),
  sourcePrompt: z.string().optional(),
  sourceSessionId: z.string().optional(),
  createdAt: z.number(),
  updatedAt: z.number(),
  draftVersion: GeneratedAppVersionSchema,
  publishedVersion: GeneratedAppVersionSchema.optional(),
  generationMode: z.enum(['legacy_manifest', 'autonomous_component']).optional(),
});

const HubAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  tagline: z.string(),
  summary: z.string(),
  mission: z.string(),
  whenToUse: z.string(),
  outputKind: z.enum(['pdf', 'html', 'music', 'podcast', 'code', 'research', 'automation']),
  starterPrompt: z.string(),
  systemInstruction: z.string(),
  uiSchema: z.array(AgentFieldSchema),
  tools: z.array(z.string()),
  capabilities: z.array(z.string()),
  status: z.enum(['ready', 'draft']).optional(),
  createdBy: z.enum(['manual', 'cowork']).optional(),
  sourcePrompt: z.string().optional(),
  sourceSessionId: z.string().optional(),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
});

const AgentRuntimeSchema = HubAgentSchema.extend({
  formValues: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
});

const GeneratedAppRuntimeSchema = GeneratedAppManifestSchema.extend({
  formValues: z.record(z.string(), z.union([z.string(), z.boolean()])).optional(),
});

const AttachmentPayloadSchema = z.object({
  type: z.enum(['image', 'video', 'audio', 'document', 'youtube']),
  url: z.string().optional(),
  storageUri: z.string().optional(),
  mimeType: z.string().optional(),
  name: z.string().optional(),
  base64: z.string().optional(),
  thumbnail: z.string().optional(),
  videoMetadata: z.object({
    startOffsetSeconds: z.number().min(0).optional(),
    endOffsetSeconds: z.number().min(0).optional(),
    fps: z.number().gt(0).max(24).optional(),
  }).optional(),
});

const ChatPartSchema = z.object({
  text: z.string().optional(),
  inlineData: z.object({
    mimeType: z.string(),
    data: z.string(),
  }).optional(),
  fileData: z.object({
    mimeType: z.string(),
    fileUri: z.string(),
  }).optional(),
  videoMetadata: z.object({
    startOffset: z.string().optional(),
    endOffset: z.string().optional(),
    fps: z.number().gt(0).max(24).optional(),
  }).optional(),
  attachment: AttachmentPayloadSchema.optional(),
});

export const ImageGenSchema = z.object({
  prompt: z.string(),
  aspectRatio: z.string().optional(),
  imageSize: z.string().optional(),
  numberOfImages: z.number().optional(),
  personGeneration: z.string().optional(),
  safetySetting: z.string().optional(),
});

export const ImageGenRequestSchema = ImageGenSchema.extend({
  model: z.string().optional(),
  thinkingLevel: z.string().optional(),
});

export const AudioGenRequestSchema = z.object({
  prompt: z.string(),
  model: z.string().optional(),
  ttsVoice: z.string().optional(),
  ttsLanguageCode: z.string().optional(),
  ttsStyleInstructions: z.string().optional(),
  temperature: z.number().optional(),
});

export const MusicGenRequestSchema = z.object({
  prompt: z.string(),
  model: z.string().optional(),
  negativePrompt: z.string().optional(),
  seed: z.number().int().optional(),
  sampleCount: z.number().int().min(1).max(4).optional(),
  location: z.string().optional(),
});

export const VideoGenSchema = z.object({
  prompt: z.string(),
  videoResolution: z.string().optional(),
  videoAspectRatio: z.string().optional(),
  videoDurationSeconds: z.number().optional(),
});

export const ChatSchema = z.object({
  message: z.string(),
  sessionId: z.string().optional(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    parts: z.array(ChatPartSchema),
  })),
  config: z.object({
    model: z.string(),
    temperature: z.number(),
    topP: z.number(),
    topK: z.number(),
    maxOutputTokens: z.number().optional().nullable(),
    systemInstruction: z.string().optional(),
    googleSearch: z.boolean().optional(),
    googleMaps: z.boolean().optional(),
    codeExecution: z.boolean().optional(),
    urlContext: z.boolean().optional(),
    structuredOutputs: z.boolean().optional(),
    thinkingLevel: z.enum(['minimal', 'low', 'medium', 'high']).optional(),
    maxThoughtTokens: z.number().optional(),
    presencePenalty: z.number().optional(),
    frequencyPenalty: z.number().optional(),
    responseMimeType: z.enum(['text/plain', 'application/json']).optional(),
    stopSequences: z.array(z.string()).optional(),
  }),
  attachments: z.array(AttachmentPayloadSchema).optional(),
  refinedSystemInstruction: z.string().nullable().optional(),
  clientContext: z.object({
    locale: z.string().optional(),
    timeZone: z.string().optional(),
    nowIso: z.string().optional().nullable(),
  }).optional(),
  hubAgents: z.array(HubAgentSchema).optional(),
  generatedApps: z.array(GeneratedAppManifestSchema).optional(),
  agentRuntime: AgentRuntimeSchema.optional(),
  appRuntime: GeneratedAppRuntimeSchema.optional(),
});

export const GeneratedAppPublishSchema = z.object({
  manifest: GeneratedAppManifestSchema,
});

export const UploadSchema = z.object({
  base64: z.string(),
  fileName: z.string(),
  mimeType: z.string()
});
