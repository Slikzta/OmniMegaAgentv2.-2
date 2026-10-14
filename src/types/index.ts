export type MessageRole = 'user' | 'model' | 'system';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  attachments?: string[]; // base64 or URLs
  groundingMetadata?: any;
  modelName?: string;
  videoUrl?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
}

export interface GenerationSettings {
  model: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: any;
}

export interface ImageGenerationSettings {
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" | "1:4" | "1:8" | "4:1" | "8:1";
  imageSize: "512px" | "1K" | "2K" | "4K";
  model: string;
}

export interface VideoGenerationSettings {
  aspectRatio: '16:9' | '9:16';
  resolution: '720p' | '1080p' | '4k';
  model: string;
}
