import type { AppMode, ModelConfig } from '../types';

export const GOOGLE_RECOMMENDED_SAMPLING_DEFAULTS = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
} as const satisfies Pick<ModelConfig, 'temperature' | 'topP' | 'topK'>;

const DEFAULT_MAX_OUTPUT_TOKENS: Record<AppMode, number> = {
  chat: 8192,
  image: 8192,
  video: 8192,
  audio: 8192,
  lyria: 8192,
  cowork: 65536,
};

export function getGoogleRecommendedGenerationDefaults(
  mode: AppMode,
): Pick<ModelConfig, 'temperature' | 'topP' | 'topK' | 'maxOutputTokens'> {
  return {
    ...GOOGLE_RECOMMENDED_SAMPLING_DEFAULTS,
    maxOutputTokens: DEFAULT_MAX_OUTPUT_TOKENS[mode],
  };
}

export function hasCustomGenerationDefaults(mode: AppMode, config: Partial<ModelConfig> | undefined) {
  const defaults = getGoogleRecommendedGenerationDefaults(mode);
  return (
    config?.temperature !== defaults.temperature
    || config?.topP !== defaults.topP
    || config?.topK !== defaults.topK
    || (config?.maxOutputTokens ?? defaults.maxOutputTokens) !== defaults.maxOutputTokens
  );
}
