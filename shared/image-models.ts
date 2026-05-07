export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview' as const;

export type ImageProvider = 'google-gemini' | 'azure-openai';

export type ImageOptionChoice = {
  value: string;
  label: string;
  detail?: string;
};

export type ImageModelOption = {
  id: string;
  label: string;
  info: string;
  provider: ImageProvider;
  aspectRatioOptions: readonly ImageOptionChoice[];
  imageSizeOptions?: readonly ImageOptionChoice[];
  imageQualityOptions?: readonly ImageOptionChoice[];
  imageDimensionOptions?: readonly ImageOptionChoice[];
  outputFormatOptions?: readonly ImageOptionChoice[];
  backgroundOptions?: readonly ImageOptionChoice[];
  moderationOptions?: readonly ImageOptionChoice[];
  thinkingLevelOptions?: readonly ImageOptionChoice[];
  safetySettingOptions?: readonly ImageOptionChoice[];
  supportsAutoAspectRatio: boolean;
  supportsImageSize: boolean;
  supportsGoogleSearch?: boolean;
  supportsIncludeThoughts?: boolean;
  supportsOutputCompression?: boolean;
  supportsCustomDimensions?: boolean;
  maxReferenceImages: number;
  maxOutputImages: number;
  defaultAspectRatio?: string;
  defaultImageSize?: string;
  defaultImageQuality?: string;
  defaultImageDimensions?: string;
  defaultOutputFormat?: string;
  defaultOutputCompression?: number;
  defaultBackground?: string;
  defaultModeration?: string;
  defaultSafetySetting?: string;
  defaultThinkingLevel?: string;
};

const AUTO_OPTION = { value: '', label: 'Auto' } as const;

const GEMINI_CORE_ASPECT_RATIOS = [
  AUTO_OPTION,
  { value: '1:1', label: '1:1' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '5:4', label: '5:4' },
  { value: '4:5', label: '4:5' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '21:9', label: '21:9' },
] as const satisfies readonly ImageOptionChoice[];

const GEMINI_31_ASPECT_RATIOS = [
  ...GEMINI_CORE_ASPECT_RATIOS,
  { value: '4:1', label: '4:1' },
  { value: '1:4', label: '1:4' },
  { value: '8:1', label: '8:1' },
  { value: '1:8', label: '1:8' },
] as const satisfies readonly ImageOptionChoice[];

const GPT_IMAGE_ASPECT_RATIOS = [
  AUTO_OPTION,
  { value: '1:1', label: '1:1' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
] as const satisfies readonly ImageOptionChoice[];

const GEMINI_31_IMAGE_SIZES = [
  { value: '512', label: '512' },
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const satisfies readonly ImageOptionChoice[];

const GEMINI_PRO_IMAGE_SIZES = [
  { value: '1K', label: '1K' },
  { value: '2K', label: '2K' },
  { value: '4K', label: '4K' },
] as const satisfies readonly ImageOptionChoice[];

const GPT_IMAGE_QUALITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const satisfies readonly ImageOptionChoice[];

const GPT_IMAGE_DIMENSION_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: '1024x1024', label: '1024 x 1024' },
  { value: '1536x1024', label: '1536 x 1024' },
  { value: '1024x1536', label: '1024 x 1536' },
  { value: '3840x2160', label: '3840 x 2160' },
  { value: '2160x3840', label: '2160 x 3840' },
] as const satisfies readonly ImageOptionChoice[];

const GPT_IMAGE_OUTPUT_FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
] as const satisfies readonly ImageOptionChoice[];

const GPT_IMAGE_BACKGROUND_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'opaque', label: 'Opaque' },
  { value: 'transparent', label: 'Transparent' },
] as const satisfies readonly ImageOptionChoice[];

const GPT_IMAGE_MODERATION_OPTIONS = [
  { value: 'auto', label: 'Auto' },
  { value: 'low', label: 'Low' },
] as const satisfies readonly ImageOptionChoice[];

export const GEMINI_SAFETY_SETTING_OPTIONS = [
  { value: 'BLOCK_NONE', label: 'Off' },
  { value: 'BLOCK_ONLY_HIGH', label: 'High only' },
  { value: 'BLOCK_MEDIUM_AND_ABOVE', label: 'Medium+' },
  { value: 'BLOCK_LOW_AND_ABOVE', label: 'Low+' },
] as const satisfies readonly ImageOptionChoice[];

export const GEMINI_THINKING_LEVEL_OPTIONS = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
] as const satisfies readonly ImageOptionChoice[];

export const IMAGE_MODEL_OPTIONS = [
  {
    id: DEFAULT_IMAGE_MODEL,
    label: 'Nano Banana 2',
    info: 'Gemini 3.1 Flash Image',
    provider: 'google-gemini',
    aspectRatioOptions: GEMINI_31_ASPECT_RATIOS,
    imageSizeOptions: GEMINI_31_IMAGE_SIZES,
    thinkingLevelOptions: GEMINI_THINKING_LEVEL_OPTIONS,
    safetySettingOptions: GEMINI_SAFETY_SETTING_OPTIONS,
    supportsAutoAspectRatio: true,
    supportsImageSize: true,
    supportsGoogleSearch: true,
    supportsIncludeThoughts: true,
    maxReferenceImages: 14,
    maxOutputImages: 10,
    defaultAspectRatio: '',
    defaultImageSize: '1K',
    defaultSafetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    defaultThinkingLevel: 'high',
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    info: 'Gemini 3 Pro Image',
    provider: 'google-gemini',
    aspectRatioOptions: GEMINI_CORE_ASPECT_RATIOS,
    imageSizeOptions: GEMINI_PRO_IMAGE_SIZES,
    thinkingLevelOptions: GEMINI_THINKING_LEVEL_OPTIONS,
    safetySettingOptions: GEMINI_SAFETY_SETTING_OPTIONS,
    supportsAutoAspectRatio: true,
    supportsImageSize: true,
    supportsGoogleSearch: true,
    supportsIncludeThoughts: true,
    maxReferenceImages: 14,
    maxOutputImages: 10,
    defaultAspectRatio: '',
    defaultImageSize: '1K',
    defaultSafetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    defaultThinkingLevel: 'high',
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    info: 'Gemini 2.5 Flash Image',
    provider: 'google-gemini',
    aspectRatioOptions: GEMINI_CORE_ASPECT_RATIOS,
    safetySettingOptions: GEMINI_SAFETY_SETTING_OPTIONS,
    supportsAutoAspectRatio: true,
    supportsImageSize: false,
    maxReferenceImages: 3,
    maxOutputImages: 10,
    defaultAspectRatio: '',
    defaultSafetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
  },
  {
    id: 'gpt-image-2',
    label: 'GPT Image 2',
    info: 'Azure OpenAI GPT Image 2',
    provider: 'azure-openai',
    aspectRatioOptions: GPT_IMAGE_ASPECT_RATIOS,
    imageQualityOptions: GPT_IMAGE_QUALITY_OPTIONS,
    imageDimensionOptions: GPT_IMAGE_DIMENSION_OPTIONS,
    outputFormatOptions: GPT_IMAGE_OUTPUT_FORMAT_OPTIONS,
    backgroundOptions: GPT_IMAGE_BACKGROUND_OPTIONS,
    moderationOptions: GPT_IMAGE_MODERATION_OPTIONS,
    supportsAutoAspectRatio: true,
    supportsImageSize: false,
    supportsOutputCompression: true,
    supportsCustomDimensions: true,
    maxReferenceImages: 16,
    maxOutputImages: 10,
    defaultAspectRatio: '',
    defaultImageQuality: 'high',
    defaultImageDimensions: 'auto',
    defaultOutputFormat: 'png',
    defaultOutputCompression: 100,
    defaultBackground: 'auto',
    defaultModeration: 'auto',
  },
] as const satisfies readonly ImageModelOption[];

export type SupportedImageModelId = typeof IMAGE_MODEL_OPTIONS[number]['id'];

export const SUPPORTED_IMAGE_MODEL_IDS = IMAGE_MODEL_OPTIONS.map((model) => model.id) as SupportedImageModelId[];

export const IMAGE_MODEL_LABELS: Record<string, string> = Object.fromEntries(
  IMAGE_MODEL_OPTIONS.map((model) => [model.id, model.label]),
);

function normalizeAliasKey(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const IMAGE_MODEL_ALIASES: Record<string, SupportedImageModelId> = Object.create(null);

function registerAlias(alias: string, target: SupportedImageModelId) {
  IMAGE_MODEL_ALIASES[normalizeAliasKey(alias)] = target;
}

for (const model of IMAGE_MODEL_OPTIONS) {
  registerAlias(model.id, model.id);
  registerAlias(model.label, model.id);
}

registerAlias('nanobanana', 'gemini-2.5-flash-image');
registerAlias('nanobanana 2', 'gemini-3.1-flash-image-preview');
registerAlias('nanobanana pro', 'gemini-3-pro-image-preview');
registerAlias('gemini 2.5 flash image', 'gemini-2.5-flash-image');
registerAlias('gemini 3.1 flash image', 'gemini-3.1-flash-image-preview');
registerAlias('gemini 3.1 flash image preview', 'gemini-3.1-flash-image-preview');
registerAlias('gemini 3 pro image', 'gemini-3-pro-image-preview');
registerAlias('gemini 3 pro image preview', 'gemini-3-pro-image-preview');
registerAlias('gpt image 2', 'gpt-image-2');
registerAlias('gpt-image-2', 'gpt-image-2');
registerAlias('azure gpt image 2', 'gpt-image-2');

export function normalizeImageModelId(
  model: string | null | undefined,
  fallback: string = DEFAULT_IMAGE_MODEL,
): string {
  const raw = String(model || '').trim();
  if (!raw) return fallback;

  const aliasMatch = IMAGE_MODEL_ALIASES[normalizeAliasKey(raw)];
  if (aliasMatch) return aliasMatch;

  // Keep explicit model IDs pass-through friendly for future official image models.
  if (/^(gemini|imagen|gpt-image)-/i.test(raw)) {
    return raw;
  }

  return fallback;
}

export function isSupportedImageModelId(model: string | null | undefined): model is SupportedImageModelId {
  return SUPPORTED_IMAGE_MODEL_IDS.includes(String(model || '').trim() as SupportedImageModelId);
}

export function getImageModelLabel(model: string | null | undefined): string {
  const raw = String(model || '').trim();
  if (!raw) return IMAGE_MODEL_LABELS[DEFAULT_IMAGE_MODEL];
  const normalized = normalizeImageModelId(raw, '');
  return IMAGE_MODEL_LABELS[normalized] || raw;
}

export function getImageModelOption(model: string | null | undefined) {
  const normalized = normalizeImageModelId(model, DEFAULT_IMAGE_MODEL);
  return (IMAGE_MODEL_OPTIONS as readonly ImageModelOption[]).find((option) => option.id === normalized) || null;
}

function getOptionsValues(options: readonly ImageOptionChoice[] | undefined): string[] {
  return (options || []).map((option) => option.value);
}

function includesOption(options: readonly ImageOptionChoice[] | undefined, value: string | null | undefined): boolean {
  return getOptionsValues(options).includes(String(value || '').trim());
}

export function getImageModelAspectRatioOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.aspectRatioOptions || GEMINI_CORE_ASPECT_RATIOS;
}

export function getImageModelImageSizeOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.imageSizeOptions || [];
}

export function getImageModelQualityOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.imageQualityOptions || [];
}

export function getImageModelDimensionOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.imageDimensionOptions || [];
}

export function getImageModelOutputFormatOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.outputFormatOptions || [];
}

export function getImageModelBackgroundOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.backgroundOptions || [];
}

export function getImageModelModerationOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.moderationOptions || [];
}

export function getImageModelThinkingLevelOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.thinkingLevelOptions || [];
}

export function getImageModelSafetySettingOptions(model: string | null | undefined): readonly ImageOptionChoice[] {
  return getImageModelOption(model)?.safetySettingOptions || [];
}

export function getImageModelMaxOutputImages(model: string | null | undefined): number {
  return getImageModelOption(model)?.maxOutputImages || 4;
}

export function getImageModelMaxReferenceImages(model: string | null | undefined): number {
  return getImageModelOption(model)?.maxReferenceImages || 3;
}

export function imageModelSupportsGoogleSearch(model: string | null | undefined): boolean {
  return Boolean(getImageModelOption(model)?.supportsGoogleSearch);
}

export function imageModelSupportsIncludeThoughts(model: string | null | undefined): boolean {
  return Boolean(getImageModelOption(model)?.supportsIncludeThoughts);
}

export function imageModelSupportsOutputCompression(model: string | null | undefined): boolean {
  return Boolean(getImageModelOption(model)?.supportsOutputCompression);
}

export function imageModelSupportsCustomDimensions(model: string | null | undefined): boolean {
  return Boolean(getImageModelOption(model)?.supportsCustomDimensions);
}

export function imageModelSupportsAutoAspectRatio(model: string | null | undefined): boolean {
  return getImageModelOption(model)?.supportsAutoAspectRatio ?? true;
}

export function imageModelSupportsImageSize(model: string | null | undefined): boolean {
  return Boolean(getImageModelOption(model)?.supportsImageSize);
}

export function isAzureOpenAIImageModel(model: string | null | undefined): boolean {
  return normalizeImageModelId(model, '') === 'gpt-image-2';
}

export function isGoogleGeminiImageModel(model: string | null | undefined): boolean {
  return getImageModelOption(model)?.provider === 'google-gemini';
}

export function getImageModelSizeControlLabel(model: string | null | undefined): string {
  return isAzureOpenAIImageModel(model) ? 'Resolution' : 'Taille';
}

export function getImageModelDefaultAspectRatio(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultAspectRatio ?? '';
}

export function getImageModelDefaultImageSize(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultImageSize ?? '';
}

export function getImageModelDefaultImageQuality(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultImageQuality ?? 'high';
}

export function getImageModelDefaultImageDimensions(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultImageDimensions ?? 'auto';
}

export function getImageModelDefaultOutputFormat(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultOutputFormat ?? 'png';
}

export function getImageModelDefaultOutputCompression(model: string | null | undefined): number {
  return getImageModelOption(model)?.defaultOutputCompression ?? 100;
}

export function getImageModelDefaultBackground(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultBackground ?? 'auto';
}

export function getImageModelDefaultModeration(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultModeration ?? 'auto';
}

export function getImageModelDefaultSafetySetting(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultSafetySetting ?? 'BLOCK_MEDIUM_AND_ABOVE';
}

export function getImageModelDefaultThinkingLevel(model: string | null | undefined): string {
  return getImageModelOption(model)?.defaultThinkingLevel ?? 'high';
}

export function isImageModelAspectRatioSupported(model: string | null | undefined, value: string | null | undefined): boolean {
  return includesOption(getImageModelAspectRatioOptions(model), value);
}

export function isImageModelImageSizeSupported(model: string | null | undefined, value: string | null | undefined): boolean {
  return includesOption(getImageModelImageSizeOptions(model), value);
}

export function isImageModelQualitySupported(model: string | null | undefined, value: string | null | undefined): boolean {
  return includesOption(getImageModelQualityOptions(model), value);
}

export function isImageModelOutputFormatSupported(model: string | null | undefined, value: string | null | undefined): boolean {
  return includesOption(getImageModelOutputFormatOptions(model), value);
}

export function isImageModelBackgroundSupported(model: string | null | undefined, value: string | null | undefined): boolean {
  return includesOption(getImageModelBackgroundOptions(model), value);
}

export function isImageModelModerationSupported(model: string | null | undefined, value: string | null | undefined): boolean {
  return includesOption(getImageModelModerationOptions(model), value);
}

export function isImageModelSafetySettingSupported(model: string | null | undefined, value: string | null | undefined): boolean {
  return includesOption(getImageModelSafetySettingOptions(model), value);
}

export function isImageModelThinkingLevelSupported(model: string | null | undefined, value: string | null | undefined): boolean {
  return includesOption(getImageModelThinkingLevelOptions(model), value);
}
