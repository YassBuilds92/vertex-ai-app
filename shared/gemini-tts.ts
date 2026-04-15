export type GeminiTtsVoiceGender = 'female' | 'male';

export type GeminiTtsVoiceOption = {
  name: string;
  gender: GeminiTtsVoiceGender;
  style: string;
};

export const DEFAULT_GEMINI_TTS_MODEL = 'gemini-3.1-flash-tts-preview' as const;

export const GEMINI_TTS_MODEL_OPTIONS = [
  {
    id: DEFAULT_GEMINI_TTS_MODEL,
    label: 'Gemini 3.1 Flash TTS',
    info: 'Nouveau, expressif, faible latence',
  },
  {
    id: 'gemini-2.5-flash-tts',
    label: 'Gemini 2.5 Flash TTS',
    info: 'Rapide et stable',
  },
  {
    id: 'gemini-2.5-flash-lite-preview-tts',
    label: 'Gemini 2.5 Flash Lite TTS',
    info: 'Eco et mono',
  },
  {
    id: 'gemini-2.5-pro-tts',
    label: 'Gemini 2.5 Pro TTS',
    info: 'Voix premium',
  },
] as const;

export type SupportedGeminiTtsModelId = typeof GEMINI_TTS_MODEL_OPTIONS[number]['id'];

export const GEMINI_TTS_VOICES: readonly GeminiTtsVoiceOption[] = [
  { name: 'Achernar', gender: 'female', style: 'Soft' },
  { name: 'Achird', gender: 'male', style: 'Friendly' },
  { name: 'Algenib', gender: 'male', style: 'Gravelly' },
  { name: 'Algieba', gender: 'male', style: 'Smooth' },
  { name: 'Alnilam', gender: 'male', style: 'Firm' },
  { name: 'Aoede', gender: 'female', style: 'Breezy' },
  { name: 'Autonoe', gender: 'female', style: 'Bright' },
  { name: 'Callirrhoe', gender: 'female', style: 'Easy-going' },
  { name: 'Charon', gender: 'male', style: 'Informative' },
  { name: 'Despina', gender: 'female', style: 'Smooth' },
  { name: 'Enceladus', gender: 'male', style: 'Breathy' },
  { name: 'Erinome', gender: 'female', style: 'Clear' },
  { name: 'Fenrir', gender: 'male', style: 'Excitable' },
  { name: 'Gacrux', gender: 'female', style: 'Mature' },
  { name: 'Iapetus', gender: 'male', style: 'Clear' },
  { name: 'Kore', gender: 'female', style: 'Firm' },
  { name: 'Laomedeia', gender: 'female', style: 'Upbeat' },
  { name: 'Leda', gender: 'female', style: 'Youthful' },
  { name: 'Orus', gender: 'male', style: 'Firm' },
  { name: 'Pulcherrima', gender: 'female', style: 'Forward' },
  { name: 'Puck', gender: 'male', style: 'Upbeat' },
  { name: 'Rasalgethi', gender: 'male', style: 'Informative' },
  { name: 'Sadachbia', gender: 'male', style: 'Lively' },
  { name: 'Sadaltager', gender: 'male', style: 'Knowledgeable' },
  { name: 'Schedar', gender: 'male', style: 'Even' },
  { name: 'Sulafat', gender: 'female', style: 'Warm' },
  { name: 'Umbriel', gender: 'male', style: 'Easy-going' },
  { name: 'Vindemiatrix', gender: 'female', style: 'Gentle' },
  { name: 'Zephyr', gender: 'female', style: 'Bright' },
  { name: 'Zubenelgenubi', gender: 'male', style: 'Casual' },
] as const;

export const GEMINI_TTS_MULTI_SPEAKER_MODELS = [
  DEFAULT_GEMINI_TTS_MODEL,
  'gemini-2.5-flash-tts',
  'gemini-2.5-pro-tts',
] as const;

export const GEMINI_TTS_SINGLE_SPEAKER_ONLY_MODELS = [
  'gemini-2.5-flash-lite-preview-tts',
] as const;

export const SUPPORTED_GEMINI_TTS_MODEL_IDS = GEMINI_TTS_MODEL_OPTIONS.map((model) => model.id) as SupportedGeminiTtsModelId[];

export const GEMINI_TTS_MODEL_LABELS: Record<string, string> = Object.fromEntries(
  GEMINI_TTS_MODEL_OPTIONS.map((model) => [model.id, model.label]),
);

function normalizeModelAliasKey(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

const GEMINI_TTS_MODEL_ALIASES: Record<string, SupportedGeminiTtsModelId> = {
  'gemini-3.1-flash-tts': DEFAULT_GEMINI_TTS_MODEL,
  'gemini 3.1 flash tts': DEFAULT_GEMINI_TTS_MODEL,
  'gemini-2.5-flash-preview-tts': 'gemini-2.5-flash-tts',
  'gemini 2.5 flash preview tts': 'gemini-2.5-flash-tts',
  'gemini-2.5-pro-preview-tts': 'gemini-2.5-pro-tts',
  'gemini 2.5 pro preview tts': 'gemini-2.5-pro-tts',
};

export const MAX_GEMINI_TTS_MULTI_SPEAKERS = 2;

export const DEFAULT_GEMINI_TTS_DUO_VOICES = ['Kore', 'Puck'] as const;

export function normalizeGeminiTtsModelId(model: string | null | undefined): string {
  const raw = String(model || '').trim();
  if (!raw) return '';
  const aliasMatch = GEMINI_TTS_MODEL_ALIASES[normalizeModelAliasKey(raw)];
  if (aliasMatch) return aliasMatch;
  return raw;
}

export function modelSupportsGeminiTtsMultiSpeaker(model: string | null | undefined): boolean {
  const normalized = normalizeGeminiTtsModelId(model);
  return GEMINI_TTS_MULTI_SPEAKER_MODELS.includes(normalized as (typeof GEMINI_TTS_MULTI_SPEAKER_MODELS)[number]);
}

export function getGeminiTtsModelLabel(model: string | null | undefined): string {
  const raw = String(model || '').trim();
  if (!raw) return GEMINI_TTS_MODEL_LABELS[DEFAULT_GEMINI_TTS_MODEL];
  const normalized = normalizeGeminiTtsModelId(raw);
  return GEMINI_TTS_MODEL_LABELS[normalized] || raw;
}

export function findGeminiTtsVoice(name: string | null | undefined): GeminiTtsVoiceOption | null {
  const normalized = String(name || '').trim().toLowerCase();
  if (!normalized) return null;
  return GEMINI_TTS_VOICES.find((voice) => voice.name.toLowerCase() === normalized) || null;
}

export function normalizeGeminiTtsVoiceName(name: string | null | undefined, fallback = 'Kore'): string {
  const exact = findGeminiTtsVoice(name);
  if (exact) return exact.name;
  const fallbackVoice = findGeminiTtsVoice(fallback);
  return fallbackVoice?.name || 'Kore';
}

export function getGeminiTtsVoiceCatalogSummary(): string {
  return GEMINI_TTS_VOICES
    .map((voice) => `${voice.name} (${voice.style})`)
    .join(', ');
}
