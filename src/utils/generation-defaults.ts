import type { AppMode, ModelConfig } from '../types';

export const GOOGLE_RECOMMENDED_SAMPLING_DEFAULTS = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
} as const satisfies Pick<ModelConfig, 'temperature' | 'topP' | 'topK'>;

export function getGoogleRecommendedGenerationDefaults(
  mode: AppMode,
): Pick<ModelConfig, 'temperature' | 'topP' | 'topK'> {
  void mode;
  return {
    ...GOOGLE_RECOMMENDED_SAMPLING_DEFAULTS,
  };
}

export function hasCustomGenerationDefaults(mode: AppMode, config: Partial<ModelConfig> | undefined) {
  const defaults = getGoogleRecommendedGenerationDefaults(mode);
  return (
    config?.temperature !== defaults.temperature
    || config?.topP !== defaults.topP
    || config?.topK !== defaults.topK
  );
}
