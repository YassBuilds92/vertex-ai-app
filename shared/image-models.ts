export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image-preview' as const;

export const IMAGE_MODEL_OPTIONS = [
  {
    id: DEFAULT_IMAGE_MODEL,
    label: 'Nano Banana 2',
    info: 'Gemini 3.1 Flash Image',
    supportsAutoAspectRatio: true,
    supportsImageSize: true,
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    info: 'Gemini 3 Pro Image',
    supportsAutoAspectRatio: true,
    supportsImageSize: true,
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana',
    info: 'Gemini 2.5 Flash Image',
    supportsAutoAspectRatio: true,
    supportsImageSize: false,
  },
] as const;

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

export function normalizeImageModelId(
  model: string | null | undefined,
  fallback: string = DEFAULT_IMAGE_MODEL,
): string {
  const raw = String(model || '').trim();
  if (!raw) return fallback;

  const aliasMatch = IMAGE_MODEL_ALIASES[normalizeAliasKey(raw)];
  if (aliasMatch) return aliasMatch;

  // Keep explicit model IDs pass-through friendly for future official image models.
  if (/^(gemini|imagen)-/i.test(raw)) {
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
  return IMAGE_MODEL_OPTIONS.find((option) => option.id === normalized) || null;
}

export function imageModelSupportsAutoAspectRatio(model: string | null | undefined): boolean {
  return getImageModelOption(model)?.supportsAutoAspectRatio ?? true;
}

export function imageModelSupportsImageSize(model: string | null | undefined): boolean {
  return Boolean(getImageModelOption(model)?.supportsImageSize);
}
