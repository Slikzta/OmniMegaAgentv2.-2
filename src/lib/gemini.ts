import { GoogleGenAI, Modality, Type } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

export const getGeminiAI = () => {
  if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
  return new GoogleGenAI({ apiKey });
};

export const MODELS = {
  CHAT_PRO: 'gemini-3.1-pro-preview',
  CHAT_FLASH: 'gemini-3-flash-preview',
  CHAT_LITE: 'gemini-3.1-flash-lite-preview',
  IMAGE_FLASH: 'gemini-3.1-flash-image-preview',
  IMAGE_PRO: 'gemini-3-pro-image-preview',
  VIDEO: 'veo-3.1-lite-generate-preview',
  VIDEO_PRO: 'veo-3.1-generate-preview',
  LIVE: 'gemini-3.1-flash-live-preview',
};

export const ASPECT_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"] as const;
export const IMAGE_SIZES = ["512px", "1K", "2K", "4K"] as const;
export const VIDEO_RESOLUTIONS = ["720p", "1080p", "4k"] as const;
export const VIDEO_FPS = [24, 30, 60] as const;
export const VIDEO_MODELS = [
  { id: MODELS.VIDEO, name: "Veo Fast (Preview)" },
  { id: MODELS.VIDEO_PRO, name: "Veo Pro (Preview)" },
] as const;

export { SIERRA_SAFETY_SETTINGS, SIERRA_CORE_PERSONA, SIERRA_PERSONAS } from './persona';

export const CHAT_MODELS = [
  { id: MODELS.CHAT_FLASH, name: "Gemini 3 Flash", badge: "Fast & Natural" },
  { id: MODELS.CHAT_LITE, name: "Gemini 3.1 Lite", badge: "Ultra Fast" },
  { id: MODELS.CHAT_PRO, name: "Gemini 3.1 Pro", badge: "Deep Reasoner" },
] as const;
