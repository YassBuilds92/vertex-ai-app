export const DEFAULT_LYRIA_MODEL = 'lyria-002' as const;

export const LYRIA_MODEL_OPTIONS = [
  {
    id: DEFAULT_LYRIA_MODEL,
    label: 'Lyria 2',
    info: 'Stable et robuste',
  },
  {
    id: 'lyria-3-pro-preview',
    label: 'Lyria 3 Pro',
    info: 'Preview ambitieuse',
  },
  {
    id: 'lyria-3-clip-preview',
    label: 'Lyria 3 Clip',
    info: 'Preview courte',
  },
] as const;

export type SupportedLyriaModelId = typeof LYRIA_MODEL_OPTIONS[number]['id'];

export const LYRIA_MODEL_LABELS: Record<string, string> = Object.fromEntries(
  LYRIA_MODEL_OPTIONS.map((model) => [model.id, model.label]),
);

export function getLyriaModelLabel(model: string | null | undefined): string {
  const raw = String(model || '').trim();
  if (!raw) return LYRIA_MODEL_LABELS[DEFAULT_LYRIA_MODEL];
  return LYRIA_MODEL_LABELS[raw] || raw;
}
