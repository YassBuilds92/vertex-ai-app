export type ApiAttachmentType = 'image' | 'video' | 'audio' | 'document' | 'youtube';

export interface ApiAttachmentVideoMetadata {
  startOffsetSeconds?: number;
  endOffsetSeconds?: number;
  fps?: number;
}

export interface ApiAttachmentPayload {
  type: ApiAttachmentType;
  url?: string;
  storageUri?: string;
  mimeType?: string;
  name?: string;
  base64?: string;
  thumbnail?: string;
  videoMetadata?: ApiAttachmentVideoMetadata;
}

export interface ApiMessagePartPayload {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  fileData?: {
    mimeType: string;
    fileUri: string;
  };
  videoMetadata?: {
    startOffset?: string;
    endOffset?: string;
    fps?: number;
  };
  attachment?: ApiAttachmentPayload;
}

export interface ApiHistoryMessagePayload {
  role: 'user' | 'model';
  parts: ApiMessagePartPayload[];
}
