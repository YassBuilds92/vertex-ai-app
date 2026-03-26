declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export type AppMode = 'chat' | 'image' | 'video' | 'audio' | 'cowork';

export type AttachmentType = 'image' | 'video' | 'audio' | 'document' | 'youtube';

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string; // base64 data URL, blob URL, or youtube URL
  file?: File; // Native file object for cleaner uploads
  mimeType?: string;
  name?: string;
  base64?: string;
  thumbnail?: string;
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

export type RunState = 'running' | 'completed' | 'failed' | 'aborted';

export interface RunMeta {
  iterations: number;
  modelCalls: number;
  toolCalls: number;
  webSearches: number;
  webFetches: number;
  retryCount: number;
  queueWaitMs: number;
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
  status?: 'info' | 'success' | 'error';
  toolName?: string;
  argsPreview?: string;
  resultPreview?: string;
  meta?: Record<string, string | number | boolean | null | undefined>;
}

export interface SystemPromptVersion {
  version: number;
  prompt: string;
  timestamp: number;
  rationale?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  mode: AppMode;
  userId: string;
  systemInstruction?: string;
  systemPromptHistory?: SystemPromptVersion[];
}

export interface ModelConfig {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  systemInstruction: string;
  googleSearch?: boolean;
  googleMaps?: boolean;
  codeExecution?: boolean;
  urlContext?: boolean;
  structuredOutputs?: boolean;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
  seed?: number;
  negativePrompt?: string;
  numberOfImages?: number;
  aspectRatio?: '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '5:4' | '4:5' | '16:9' | '9:16' | '21:9' | '4:1' | '1:4' | '8:1' | '1:8';
  imageSize?: '512' | '1K' | '2K' | '4K';
  maxOutputTokens?: number;
  stopSequences?: string[];
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseMimeType?: 'text/plain' | 'application/json';
  maxThoughtTokens?: number;
  ttsVoice?: string;
  videoResolution?: '720p' | '1080p';
  videoAspectRatio?: '16:9' | '9:16';
  autoSystemInstruction?: boolean;
  personGeneration?: string;
  safetySetting?: string;
  videoDurationSeconds?: number;
}

export interface CustomPrompt {
  id: string;
  title: string;
  prompt: string;
  iconUrl?: string; // Base64 image
  createdAt: number;
  userId: string;
}
