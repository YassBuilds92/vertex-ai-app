declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export type AppMode = 'chat' | 'image' | 'video' | 'audio';

export type AttachmentType = 'image' | 'video' | 'audio' | 'document' | 'youtube';

export interface Attachment {
  id: string;
  type: AttachmentType;
  url: string; // base64 data URL, blob URL, or youtube URL
  file?: File; // Native file object for cleaner uploads
  mimeType?: string;
  name?: string;
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
  createdAt: number;
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
  thinkingLevel?: 'low' | 'medium' | 'high';
  seed?: number;
  negativePrompt?: string;
  numberOfImages?: number;
  aspectRatio?: '1:1' | '3:2' | '2:3' | '4:3' | '3:4' | '5:4' | '4:5' | '16:9' | '9:16' | '21:9' | '4:1' | '1:4' | '8:1' | '1:8';
  imageSize?: '512' | '1K' | '2K' | '4K';
  maxOutputTokens?: number;
  stopSequences?: string[];
  ttsVoice?: string;
  videoResolution?: '720p' | '1080p';
  videoAspectRatio?: '16:9' | '9:16';
  autoSystemInstruction?: boolean;
}
