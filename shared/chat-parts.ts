export type ApiAttachmentType = 'image' | 'video' | 'audio' | 'document' | 'youtube';

export interface ApiAttachmentPayload {
  type: ApiAttachmentType;
  url?: string;
  storageUri?: string;
  mimeType?: string;
  name?: string;
  base64?: string;
  thumbnail?: string;
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
  attachment?: ApiAttachmentPayload;
}

export interface ApiHistoryMessagePayload {
  role: 'user' | 'model';
  parts: ApiMessagePartPayload[];
}
