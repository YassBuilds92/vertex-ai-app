import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AppMode, ModelConfig, ChatSession } from '../types';

interface AppState {
  activeMode: AppMode;
  setActiveMode: (mode: AppMode) => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  configs: Record<AppMode, ModelConfig>;
  setConfig: (config: Partial<ModelConfig>) => void;
  isLeftSidebarVisible: boolean;
  setLeftSidebarVisible: (visible: boolean) => void;
  isRightSidebarVisible: boolean;
  setRightSidebarVisible: (visible: boolean) => void;
  isPromptRefinerEnabled: boolean;
  setPromptRefinerEnabled: (enabled: boolean) => void;
  resetConfig: () => void;
  theme: 'dark' | 'light' | 'oled';
  setTheme: (theme: 'dark' | 'light' | 'oled') => void;
}

const initialConfigs: Record<AppMode, ModelConfig> = {
  chat: {
    model: 'gemini-3.1-pro-preview',
    temperature: 0.7,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: 'text/plain',
    systemInstruction: '',
    googleSearch: false,
    googleMaps: false,
    codeExecution: false,
    urlContext: false,
    structuredOutputs: false,
    thinkingLevel: 'high',
    maxThoughtTokens: 4096,
  },
  image: {
    model: 'gemini-2.5-flash-image',
    temperature: 1.0,
    topP: 1.0,
    topK: 40,
    systemInstruction: '',
    aspectRatio: '1:1',
    imageSize: '1K',
    numberOfImages: 1,
    safetySetting: 'BLOCK_MEDIUM_AND_ABOVE',
    personGeneration: 'allow_adult',
  },
  video: {
    model: 'veo-3.1-generate-001',
    temperature: 1.0,
    topP: 1.0,
    topK: 40,
    systemInstruction: '',
    videoResolution: '720p',
    videoAspectRatio: '16:9',
    videoDurationSeconds: 6,
  },
  audio: {
    model: 'gemini-2.5-flash-preview-tts',
    temperature: 1.0,
    topP: 1.0,
    topK: 40,
    systemInstruction: '',
    ttsVoice: 'Kore',
  },
  cowork: {
    model: 'gemini-3.1-pro-preview',
    temperature: 0.1,
    topP: 1.0,
    topK: 1,
    maxOutputTokens: 65536,
    systemInstruction: '',
    googleSearch: true,
    codeExecution: true,
    thinkingLevel: 'high',
  }
};

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      activeMode: 'chat',
      setActiveMode: (mode) => set({ activeMode: mode }),
      activeSessionId: null,
      setActiveSessionId: (id) => set({ activeSessionId: id }),
      configs: initialConfigs,
      setConfig: (newConfig) => set((state) => ({ 
        configs: { 
          ...state.configs, 
          [state.activeMode]: { ...state.configs[state.activeMode], ...newConfig } 
        } 
      })),
      isLeftSidebarVisible: true,
      setLeftSidebarVisible: (visible) => set({ isLeftSidebarVisible: visible }),
      isRightSidebarVisible: true,
      setRightSidebarVisible: (visible) => set({ isRightSidebarVisible: visible }),
      isPromptRefinerEnabled: false,
      setPromptRefinerEnabled: (enabled) => set({ isPromptRefinerEnabled: enabled }),
      resetConfig: () => set((state) => ({
        configs: {
          ...state.configs,
          [state.activeMode]: initialConfigs[state.activeMode]
        }
      })),
      theme: 'dark',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'studio-pro-storage',
      partialize: (state) => ({ 
        activeMode: state.activeMode, 
        activeSessionId: state.activeSessionId,
        configs: state.configs,
        theme: state.theme 
      }),
      merge: (persistedState: any, currentState) => {
        const persistedConfigs = (persistedState as any)?.configs || {};
        
        // Deep merge each mode's config to ensure no missing fields
        const mergedConfigs = { ...currentState.configs };
        for (const mode in currentState.configs) {
          const m = mode as AppMode;
          mergedConfigs[m] = {
            ...currentState.configs[m],
            ...(persistedConfigs[m] || {})
          };
        }

        return {
          ...currentState,
          ...(persistedState as any),
          configs: mergedConfigs,
        };
      },
    }
  )
);
