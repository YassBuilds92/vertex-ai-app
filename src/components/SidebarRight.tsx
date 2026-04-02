import React, { Suspense, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Code2,
  Film,
  Globe,
  Brain,
  Bot,
  Image as ImageIcon,
  LayoutDashboard,
  Link2,
  Mic,
  Moon,
  Music,
  Palette,
  RotateCcw,
  Settings2,
  Sparkles,
  Sun,
  X,
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  findGeminiTtsVoice,
  GEMINI_TTS_VOICES,
  modelSupportsGeminiTtsMultiSpeaker,
} from '../../shared/gemini-tts.js';
import { db, auth } from '../firebase';
import { useStore } from '../store/useStore';
import { ChatSession } from '../types';

const SystemInstructionGallery = React.lazy(async () => {
  const module = await import('./SystemInstructionGallery');
  return { default: module.SystemInstructionGallery };
});

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const isGroundingSupported = (model: string) => [
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
].includes(model);

const modelNameMap: Record<string, string> = {
  'gemini-3.1-pro-preview': 'Gemini 3.1 Pro',
  'gemini-3.1-flash-lite-preview': 'Gemini 3.1 Flash Lite',
  'gemini-3-flash-preview': 'Gemini 3 Flash',
  'gemini-3.1-flash-image-preview': 'Nano Banana 2',
  'gemini-3-pro-image-preview': 'Nano Banana Pro',
  'gemini-2.5-flash-image': 'Nano Banana',
  'veo-3.1-generate-001': 'Veo 3.1 Video',
  'gemini-2.5-flash-tts': 'Gemini Flash TTS',
  'gemini-2.5-flash-lite-preview-tts': 'Gemini Flash Lite TTS',
  'gemini-2.5-pro-tts': 'Gemini Pro TTS',
  'lyria-002': 'Lyria 2',
  'lyria-3-clip-preview': 'Lyria 3 Clip',
  'lyria-3-pro-preview': 'Lyria 3 Pro',
};

const modelSubtitleByMode = {
  chat: 'Raisonnement et conversation',
  cowork: 'Runtime autonome',
  image: 'Generation d images',
  video: 'Generation video',
  audio: 'Synthese vocale',
  lyria: 'Generation musicale',
} as const;

const modeStudioCards = {
  image: {
    eyebrow: 'Image direction',
    title: 'Cadre, lumiere, variantes.',
    body: 'Le reste doit se taire.',
    chips: ['Ratios', 'Variantes', 'Securite'],
    accentClassName: 'from-cyan-400/18 via-sky-400/10 to-transparent',
    icon: ImageIcon,
  },
  video: {
    eyebrow: 'Video lab',
    title: 'Format, duree, mouvement.',
    body: 'Un depart plus cine, moins formulaire.',
    chips: ['Formats', 'Duree', 'Cadence'],
    accentClassName: 'from-orange-300/18 via-amber-300/10 to-transparent',
    icon: Film,
  },
  audio: {
    eyebrow: 'Voice studio',
    title: 'Voix, langue, intention.',
    body: 'Moins de chrome, plus de studio.',
    chips: ['Voix', 'Locale', 'Style'],
    accentClassName: 'from-rose-300/18 via-pink-300/10 to-transparent',
    icon: Mic,
  },
  lyria: {
    eyebrow: 'Lyria mode',
    title: 'Texture, energie, variantes.',
    body: 'Une entree musique plus nette.',
    chips: ['Lyria 2', 'Negative', 'Seed'],
    accentClassName: 'from-emerald-300/18 via-teal-300/10 to-transparent',
    icon: Music,
  },
} as const;

interface SidebarRightProps {
  activeSession: ChatSession;
}

export const SidebarRight: React.FC<SidebarRightProps> = ({ activeSession }) => {
  const {
    activeMode,
    configs,
    setConfig,
    isRightSidebarVisible,
    setRightSidebarVisible,
    theme,
    setTheme,
    isPromptRefinerEnabled,
    setPromptRefinerEnabled,
    resetConfig,
  } = useStore();

  const config = configs[activeMode];
  const user = auth.currentUser;

  const [isModelListOpen, setIsModelListOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showGallery, setShowGallery] = useState(false);

  const availableModels = useMemo(() => ([
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro', info: 'Intelligence avancee', modes: ['chat', 'cowork'] },
    { id: 'gemini-3.1-flash-lite-preview', label: 'Gemini 3.1 Flash Lite', info: 'Ultra rapide et econome', modes: ['chat', 'cowork'] },
    { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash', info: 'Rapide avec vrai raisonnement', modes: ['chat', 'cowork'] },
    { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', info: 'Image rapide et scalable', modes: ['image'] },
    { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', info: 'Image premium', modes: ['image'] },
    { id: 'gemini-2.5-flash-image', label: 'Nano Banana', info: 'Polyvalent et stable', modes: ['image'] },
    { id: 'veo-3.1-generate-001', label: 'Veo 3.1 Video', info: 'Video cine', modes: ['video'] },
    { id: 'lyria-002', label: 'Lyria 2', info: 'Mode stable et robuste', modes: ['lyria'] },
    { id: 'lyria-3-clip-preview', label: 'Lyria 3 Clip', info: 'Preview courte et nerveuse', modes: ['lyria'] },
    { id: 'lyria-3-pro-preview', label: 'Lyria 3 Pro', info: 'Preview plus ambitieuse', modes: ['lyria'] },
    { id: 'gemini-2.5-flash-tts', label: 'Gemini Flash TTS', info: 'Rapide et naturel', modes: ['audio'] },
    { id: 'gemini-2.5-flash-lite-preview-tts', label: 'Gemini Flash Lite TTS', info: 'Eco et leger', modes: ['audio'] },
    { id: 'gemini-2.5-pro-tts', label: 'Gemini Pro TTS', info: 'Voix premium', modes: ['audio'] },
  ].filter((model) => model.modes.includes(activeMode))), [activeMode]);

  const isTextMode = activeMode === 'chat' || activeMode === 'cowork';
  const selectedModelLabel = modelNameMap[config?.model || ''] || config?.model || 'Modele';
  const selectedAudioVoice = activeMode === 'audio' ? findGeminiTtsVoice(config?.ttsVoice || 'Kore') : null;
  const audioSupportsMultiSpeaker = activeMode === 'audio'
    ? modelSupportsGeminiTtsMultiSpeaker(config?.model || '')
    : false;
  const activeStudioCard = activeMode === 'image' || activeMode === 'video' || activeMode === 'audio' || activeMode === 'lyria'
    ? modeStudioCards[activeMode]
    : null;
  const ActiveStudioCardIcon = activeStudioCard?.icon;
  const thinkingLevels = useMemo(() => {
    const levels = [
      { id: 'minimal', label: 'Eco' },
      { id: 'low', label: 'Flash' },
      { id: 'medium', label: 'Pro' },
      { id: 'high', label: 'High' },
    ];

    return /pro-preview/i.test(config?.model || '')
      ? levels.filter((level) => level.id !== 'minimal')
      : levels;
  }, [config?.model]);

  const updateSessionInstruction = (instruction: string) => {
    if (!user || !activeSession.id || activeSession.id === 'local-new') return;
    updateDoc(doc(db, 'users', user.uid, 'sessions', activeSession.id), {
      systemInstruction: instruction,
    }).catch(console.error);
  };

  const renderSectionTitle = (label: string) => (
    <label className="ml-1 text-[10px] font-black uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
      {label}
    </label>
  );

  const renderSlider = (
    key: 'temperature' | 'topP' | 'topK' | 'maxOutputTokens',
    label: string,
    min: number,
    max: number,
    step: number,
  ) => (
    <div className="space-y-4" key={key}>
      <div className="flex items-end justify-between">
        <label className="text-[11px] font-bold tracking-wide text-[var(--app-text-muted)]">{label}</label>
        <span className="font-mono text-[12px] font-bold text-[var(--app-accent)]">
          {(config as any)[key]}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={(config as any)[key] || (key === 'maxOutputTokens' ? 8192 : 1)}
        onChange={(event) => setConfig({ [key]: parseFloat(event.target.value) } as any)}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--app-accent)]"
      />
    </div>
  );

  return (
    <div
      className={cn(
        'fixed inset-y-0 right-0 z-50 flex h-full flex-col overflow-hidden border-l border-[var(--app-border)] bg-[rgba(var(--app-bg-rgb),0.94)] shadow-[0_20px_48px_-30px_rgba(0,0,0,0.62)] backdrop-blur-lg transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] md:relative md:inset-auto',
        isRightSidebarVisible
          ? 'w-[min(100vw,392px)] translate-x-0 opacity-100'
          : 'pointer-events-none w-0 translate-x-full opacity-0',
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,236,255,0.1),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%)]" />

      <div className="relative z-10 flex items-center justify-between border-b border-[var(--app-border)] px-5 py-4">
        <div className="flex items-center gap-3 text-[15px] font-semibold tracking-tight text-[var(--app-text)]">
          <Settings2 size={17} className="text-[var(--app-accent)]" />
          Parametres
        </div>
        <button
          onClick={() => setRightSidebarVisible(false)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-white/[0.04] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)] md:hidden"
        >
          <X size={16} />
        </button>
      </div>

      <div className="relative z-10 flex-1 overflow-x-visible overflow-y-auto px-4 py-5 sm:px-5">
        <div className="space-y-6">
          <div className="studio-panel rounded-[1.75rem] p-4">
            <div className="space-y-3">
              {renderSectionTitle('Theme')}
              <div className="grid grid-cols-3 gap-1.5 rounded-[1.35rem] border border-[var(--app-border)] bg-black/20 p-1.5">
                {[
                  { id: 'dark', icon: Moon, label: 'Sombre' },
                  { id: 'light', icon: Sun, label: 'Clair' },
                  { id: 'oled', icon: Palette, label: 'OLED' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setTheme(item.id as any)}
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 rounded-[1rem] py-3 text-[11px] font-bold transition-colors',
                      theme === item.id ? 'text-[var(--app-text)]' : 'text-[var(--app-text-muted)] hover:text-[var(--app-text)]',
                    )}
                  >
                    {theme === item.id && (
                      <motion.div
                        layoutId="activeTheme"
                        className="absolute inset-0 rounded-[1rem] border border-[var(--app-border-strong)] bg-white/[0.08]"
                        transition={{ type: 'spring', damping: 20, stiffness: 200 } as const}
                      />
                    )}
                    <item.icon size={13} className="relative z-10" />
                    <span className="relative z-10">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="group">
            <button
              onClick={() => setPromptRefinerEnabled(!isPromptRefinerEnabled)}
              className={cn(
                'studio-panel relative flex w-full items-center justify-between overflow-hidden rounded-[1.75rem] border px-5 py-4 text-left transition-colors',
                isPromptRefinerEnabled
                  ? 'border-[var(--app-border-strong)] bg-[rgba(129,236,255,0.08)]'
                  : 'hover:border-[var(--app-border-strong)]',
              )}
            >
              <div className="relative z-10 flex items-center gap-3.5">
                <div
                  className={cn(
                    'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
                    isPromptRefinerEnabled
                      ? 'border border-[var(--app-border-strong)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                      : 'bg-white/5 text-[var(--app-text-muted)]',
                  )}
                >
                  <Sparkles size={18} fill={isPromptRefinerEnabled ? 'currentColor' : 'none'} />
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className={cn('text-[14px] font-bold tracking-tight', isPromptRefinerEnabled ? 'text-[var(--app-accent)]' : 'text-[var(--app-text)]')}>
                    Raffineur IA
                  </span>
                  <span className="text-[10px] font-medium text-[var(--app-text-muted)]">Optimisation auto</span>
                </div>
              </div>
              <div className={cn('relative h-5 w-10 rounded-full transition-colors', isPromptRefinerEnabled ? 'bg-[var(--app-accent-soft)]' : 'bg-white/10')}>
                <motion.div
                  animate={{ x: isPromptRefinerEnabled ? 22 : 2 }}
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm"
                  transition={{ type: 'spring', damping: 20, stiffness: 300 } as const}
                />
              </div>
            </button>
          </div>

          {activeStudioCard && (
            <div className="studio-panel overflow-hidden rounded-[1.8rem] p-0">
              <div className={cn('relative border-b border-[var(--app-border)] p-4', `bg-[linear-gradient(135deg,rgba(255,255,255,0.04),transparent),radial-gradient(circle_at_top_left,var(--tw-gradient-stops))]`, activeStudioCard.accentClassName)}>
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_55%)]" />
                <div className="relative z-10 flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.08] text-[var(--app-text)] shadow-[0_20px_44px_-28px_rgba(0,0,0,0.75)]">
                    {ActiveStudioCardIcon && <ActiveStudioCardIcon size={18} />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--app-text-muted)]">{activeStudioCard.eyebrow}</div>
                    <div className="mt-2 text-[1.05rem] font-semibold leading-6 tracking-[-0.03em] text-[var(--app-text)]">
                      {activeStudioCard.title}
                    </div>
                    <p className="mt-2 text-[12px] leading-6 text-[var(--app-text)]/64">
                      {activeStudioCard.body}
                    </p>
                  </div>
                </div>
              </div>
              <div className="grid gap-2 px-4 py-4">
                {activeStudioCard.chips.map((chip) => (
                  <div key={chip} className="rounded-[1.1rem] border border-[var(--app-border)] bg-white/[0.03] px-3.5 py-2.5 text-[12px] text-[var(--app-text)]/78">
                    {chip}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="studio-panel rounded-[1.75rem] p-4">
            <div className="space-y-3">
              {renderSectionTitle('Modele de langage')}
              <div className="space-y-3">
                <button
                  onClick={() => setIsModelListOpen((current) => !current)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-[1.35rem] border border-[var(--app-border)] bg-white/[0.03] px-5 py-4 text-left transition-colors hover:border-[var(--app-border-strong)] hover:bg-white/[0.05]',
                    isModelListOpen && 'border-[var(--app-border-strong)] bg-white/[0.05] ring-4 ring-[rgba(129,236,255,0.08)]',
                  )}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-[var(--app-accent)]">
                      <Brain size={20} />
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-bold tracking-tight text-[var(--app-text)]">{selectedModelLabel}</span>
                      <span className="text-[10px] text-[var(--app-text-muted)] opacity-70">{modelSubtitleByMode[activeMode]}</span>
                    </div>
                  </div>
                  <ChevronDown size={14} className={cn('text-[var(--app-text-muted)] transition-transform duration-300', isModelListOpen && 'rotate-180')} />
                </button>

                <AnimatePresence initial={false}>
                  {isModelListOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0, transition: { duration: 0.16 } }}
                      className="overflow-hidden"
                    >
                      <div className="rounded-[1.35rem] border border-[var(--app-border-strong)] bg-[var(--app-surface)]/92 p-3 shadow-[0_18px_44px_-28px_rgba(0,0,0,0.7)]">
                        <div className="max-h-[320px] space-y-1 overflow-y-auto pr-1">
                          {availableModels.map((model) => (
                            <button
                              key={model.id}
                              onClick={() => {
                                setConfig({ model: model.id });
                                setIsModelListOpen(false);
                              }}
                              className={cn(
                                'flex w-full items-center justify-between rounded-[1.1rem] border p-3.5 text-left text-[13px] transition-colors',
                                config?.model === model.id
                                  ? 'border-[var(--app-border-strong)] bg-[rgba(129,236,255,0.08)] font-bold text-[var(--app-accent)]'
                                  : 'border-transparent font-medium text-[var(--app-text)] hover:border-[var(--app-border)] hover:bg-white/[0.05]',
                              )}
                            >
                              <div className="flex flex-col">
                                <span>{model.label}</span>
                                <span className="text-[10px] font-normal text-[var(--app-text-muted)] opacity-60">{model.info}</span>
                              </div>
                              {config?.model === model.id && <Check size={14} className="text-[var(--app-accent)]" />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {activeMode === 'cowork' && (
            <div className="studio-panel rounded-[1.75rem] p-4 space-y-4">
              {renderSectionTitle('Options Cowork')}
              <button
                onClick={() => setConfig({ agentDelegationEnabled: !Boolean(config.agentDelegationEnabled) })}
                className={cn(
                  'flex w-full items-start justify-between gap-4 rounded-[1.35rem] border px-4 py-4 text-left transition-colors',
                  config.agentDelegationEnabled
                    ? 'border-[var(--app-border-strong)] bg-[rgba(129,236,255,0.08)]'
                    : 'border-[var(--app-border)] bg-white/[0.03] hover:border-[var(--app-border-strong)]',
                )}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[13px] font-bold tracking-tight text-[var(--app-text)]">
                    <Bot size={15} className={config.agentDelegationEnabled ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'} />
                    Utiliser les agents du Hub
                  </div>
                  <p className="mt-2 text-[11px] leading-6 text-[var(--app-text-muted)]">
                    Laisse Cowork deleguer au Hub, creer un specialiste ou en relancer un existant. Par defaut cette option reste coupee.
                  </p>
                </div>
                <div className={cn('relative mt-0.5 h-6 w-11 rounded-full transition-colors', config.agentDelegationEnabled ? 'bg-[var(--app-accent-soft)]' : 'bg-white/10')}>
                  <motion.div
                    animate={{ x: config.agentDelegationEnabled ? 23 : 2 }}
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm"
                    transition={{ type: 'spring', damping: 20, stiffness: 300 } as const}
                  />
                </div>
              </button>
            </div>
          )}

          {activeMode === 'image' && (
            <div className="studio-panel rounded-[1.75rem] p-4 space-y-5">
              {renderSectionTitle('Parametres image')}
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Format</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['1:1', '4:3', '3:4', '16:9', '9:16', '21:9', '3:2', '2:3'].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setConfig({ aspectRatio: ratio as any })}
                        className={cn(
                          'rounded-xl border py-2 text-[11px] font-bold transition-colors',
                          config.aspectRatio === ratio
                            ? 'border-[var(--app-border-strong)] bg-[rgba(129,236,255,0.1)] text-[var(--app-accent)]'
                            : 'border-white/5 bg-white/5 text-[var(--app-text-muted)] hover:bg-white/10',
                        )}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Generation de personnes</span>
                  <select
                    value={config.personGeneration || 'allow_adult'}
                    onChange={(event) => setConfig({ personGeneration: event.target.value })}
                    className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-[12px] text-[var(--app-text)] outline-none focus:border-[var(--app-border-strong)]"
                  >
                    <option value="allow_all" className="bg-[#111]">Autoriser tout</option>
                    <option value="allow_adult" className="bg-[#111]">Adultes uniquement</option>
                    <option value="dont_allow" className="bg-[#111]">Interdire</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="font-mono text-[11px] font-bold text-[var(--app-text-muted)]">Nombre d images</span>
                    <span className="text-xs font-bold text-[var(--app-accent)]">{config.numberOfImages || 1}</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="4"
                    step="1"
                    value={config.numberOfImages || 1}
                    onChange={(event) => setConfig({ numberOfImages: parseInt(event.target.value, 10) })}
                    className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10 accent-[var(--app-accent)]"
                  />
                </div>
              </div>
            </div>
          )}

          {activeMode === 'video' && (
            <div className="studio-panel rounded-[1.75rem] p-4 space-y-5">
              {renderSectionTitle('Parametres video')}
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Resolution</span>
                  <div className="grid grid-cols-3 gap-2">
                    {['720p', '1080p', '4k'].map((resolution) => (
                      <button
                        key={resolution}
                        onClick={() => setConfig({ videoResolution: resolution as any })}
                        className={cn(
                          'rounded-xl border py-2 text-[11px] font-bold transition-colors',
                          config.videoResolution === resolution
                            ? 'border-[var(--app-border-strong)] bg-[rgba(129,236,255,0.1)] text-[var(--app-accent)]'
                            : 'border-white/5 bg-white/5 text-[var(--app-text-muted)] hover:bg-white/10',
                        )}
                      >
                        {resolution}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Format</span>
                  <div className="flex gap-2">
                    {['16:9', '9:16'].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setConfig({ videoAspectRatio: ratio as any })}
                        className={cn(
                          'flex-1 rounded-xl border py-2 text-[11px] font-bold transition-colors',
                          config.videoAspectRatio === ratio
                            ? 'border-[var(--app-border-strong)] bg-[rgba(129,236,255,0.1)] text-[var(--app-accent)]'
                            : 'border-white/5 bg-white/5 text-[var(--app-text-muted)] hover:bg-white/10',
                        )}
                      >
                        {ratio === '16:9' ? 'Paysage' : 'Portrait'} ({ratio})
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-bold text-[var(--app-text-muted)]">Duree</span>
                    <span className="text-xs font-bold text-[var(--app-accent)]">{config.videoDurationSeconds || 6}s</span>
                  </div>
                  <div className="flex gap-2">
                    {[4, 6, 8].map((seconds) => (
                      <button
                        key={seconds}
                        onClick={() => setConfig({ videoDurationSeconds: seconds })}
                        className={cn(
                          'flex-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors',
                          config.videoDurationSeconds === seconds
                            ? 'bg-[var(--app-accent)] text-[#041018]'
                            : 'bg-white/5 text-[var(--app-text-muted)] hover:bg-white/10',
                        )}
                      >
                        {seconds}s
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeMode === 'audio' && (
            <div className="studio-panel rounded-[1.75rem] p-4 space-y-5">
              {renderSectionTitle('Parametres audio')}
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Voix Gemini</span>
                  <select
                    value={config.ttsVoice || 'Kore'}
                    onChange={(event) => setConfig({ ttsVoice: event.target.value })}
                    className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-[12px] text-[var(--app-text)] outline-none focus:border-[var(--app-border-strong)]"
                  >
                    {GEMINI_TTS_VOICES.map((voice) => (
                      <option key={voice.name} value={voice.name} className="bg-[#111]">
                        {voice.name} - {voice.style}
                      </option>
                    ))}
                  </select>
                  <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-[11px] text-[var(--app-text-muted)]">
                    {selectedAudioVoice
                      ? `${selectedAudioVoice.name} - ${selectedAudioVoice.style} - ${selectedAudioVoice.gender === 'female' ? 'voix feminine' : 'voix masculine'}`
                      : 'Catalogue officiel Gemini TTS charge.'}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Langue / locale</span>
                  <input
                    value={config.ttsLanguageCode || 'fr-FR'}
                    onChange={(event) => setConfig({ ttsLanguageCode: event.target.value })}
                    placeholder="fr-FR"
                    className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-[12px] text-[var(--app-text)] outline-none focus:border-[var(--app-border-strong)]"
                  />
                </div>

                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Style instructions</span>
                  <textarea
                    value={config.ttsStyleInstructions || ''}
                    onChange={(event) => setConfig({ ttsStyleInstructions: event.target.value })}
                    placeholder="Ex: parle comme un animateur radio chaleureux, rythme pose, sourire dans la voix."
                    className="w-full min-h-24 resize-none rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-[12px] text-[var(--app-text)] outline-none focus:border-[var(--app-border-strong)]"
                  />
                </div>

                <div className="rounded-[1.15rem] border border-white/5 bg-white/[0.03] px-3 py-3 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                  {audioSupportsMultiSpeaker
                    ? 'Le modele audio choisi supporte le multi-speaker Gemini TTS a 2 intervenants.'
                    : 'Le modele audio choisi reste single-speaker. Pour un duo, bascule sur Gemini Flash TTS ou Gemini Pro TTS.'}
                </div>
              </div>
            </div>
          )}

          {activeMode === 'lyria' && (
            <div className="studio-panel rounded-[1.75rem] p-4 space-y-5">
              {renderSectionTitle('Parametres Lyria')}
              <div className="space-y-4">
                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Variantes</span>
                  <div className="grid grid-cols-4 gap-2">
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        onClick={() => setConfig({ sampleCount: count })}
                        className={cn(
                          'rounded-xl border py-2 text-[11px] font-bold transition-colors',
                          (config.sampleCount || 1) === count
                            ? 'border-[var(--app-border-strong)] bg-[rgba(46,204,113,0.12)] text-emerald-200'
                            : 'border-white/5 bg-white/5 text-[var(--app-text-muted)] hover:bg-white/10',
                        )}
                      >
                        x{count}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-[1.1rem] border border-white/5 bg-white/[0.03] px-3 py-2.5 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                    `lyria-002` reste le choix robuste. Les variantes preview Lyria 3 restent utiles pour tester des rendus plus ambitieux.
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Negative prompt</span>
                  <textarea
                    value={config.negativePrompt || ''}
                    onChange={(event) => setConfig({ negativePrompt: event.target.value })}
                    placeholder="Ex: pas de voix, pas de batterie agressive, pas de rupture brutale."
                    className="w-full min-h-24 resize-none rounded-xl border border-white/5 bg-white/5 px-4 py-3 text-[12px] text-[var(--app-text)] outline-none focus:border-[var(--app-border-strong)]"
                  />
                </div>

                <div className="space-y-2">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Seed</span>
                  <input
                    type="number"
                    value={typeof config.seed === 'number' ? config.seed : ''}
                    onChange={(event) => setConfig({ seed: event.target.value ? parseInt(event.target.value, 10) : undefined })}
                    placeholder="Optionnel pour figer une direction"
                    className="w-full rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-[12px] text-[var(--app-text)] outline-none focus:border-[var(--app-border-strong)]"
                  />
                </div>
              </div>
            </div>
          )}

          {config && isGroundingSupported(config.model) && (
            <div className="studio-panel rounded-[1.75rem] p-4 space-y-4">
              {renderSectionTitle('Capacites & outils')}
              <div className="grid grid-cols-1 gap-2.5">
                {[
                  { id: 'googleSearch', label: activeMode === 'cowork' ? 'Web Search' : 'Google Search', icon: Globe, color: 'text-blue-400', activeBg: 'bg-blue-500/20 border-blue-500/30' },
                  { id: 'codeExecution', label: 'Code Execution', icon: Code2, color: 'text-emerald-400', activeBg: 'bg-emerald-500/20 border-emerald-500/30' },
                  { id: 'urlContext', label: 'URL Reader', icon: Link2, color: 'text-purple-400', activeBg: 'bg-purple-500/20 border-purple-500/30' },
                ].map((tool) => (
                  <button
                    key={tool.id}
                    onClick={() => setConfig({ [tool.id]: !Boolean((config as any)[tool.id]) } as any)}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border p-4 transition-colors',
                      (config as any)[tool.id]
                        ? tool.activeBg
                        : 'border-[var(--app-border)] bg-white/[0.02] hover:border-[var(--app-border-strong)]',
                    )}
                  >
                    <div className={cn('flex items-center gap-3.5', (config as any)[tool.id] ? tool.color : 'text-[var(--app-text-muted)]')}>
                      <tool.icon size={16} />
                      <span className="text-[13px] font-bold tracking-tight">{tool.label}</span>
                    </div>
                    {(config as any)[tool.id] && (
                      <div className="h-1.5 w-1.5 rounded-full bg-current shadow-[0_0_10px_currentColor]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isTextMode && (
            <div className="studio-panel rounded-[1.75rem] p-4 space-y-4">
              <div className="mb-1 flex items-center justify-between px-1">
                {renderSectionTitle('Instructions systeme')}
                <button
                  onClick={() => setShowGallery(true)}
                  className="flex items-center gap-1.5 rounded-full border border-[var(--app-border)] bg-white/[0.04] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--app-accent)] transition-colors hover:border-[var(--app-border-strong)]"
                >
                  <LayoutDashboard size={12} />
                  Galerie
                </button>
              </div>

              <textarea
                value={config.systemInstruction || ''}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setConfig({ systemInstruction: nextValue });
                  updateSessionInstruction(nextValue);
                }}
                placeholder="Definis la personnalite et les regles..."
                className="studio-input h-32 resize-none rounded-[1.35rem] p-4 text-[13px] leading-relaxed placeholder:text-white/10"
              />

              <div className="space-y-3">
                {renderSectionTitle('Reflexion interne')}
                <div className="flex gap-2">
                  {thinkingLevels.map((level) => (
                    <button
                      key={level.id}
                      onClick={() => setConfig({ thinkingLevel: level.id as any })}
                      className={cn(
                        'flex-1 rounded-[1rem] border px-1 py-2 text-[11px] font-bold transition-colors',
                        config.thinkingLevel === level.id
                          ? 'border-[var(--app-border-strong)] bg-[rgba(129,236,255,0.08)] text-[var(--app-accent)]'
                          : 'border-[var(--app-border)] bg-white/[0.02] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)]',
                      )}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <button
              onClick={() => setShowAdvanced((current) => !current)}
              className="studio-panel flex w-full items-center justify-between rounded-[1.75rem] border px-5 py-4 transition-colors hover:bg-white/[0.04]"
            >
              <div className="flex items-center gap-3">
                <Settings2 size={14} className={cn(showAdvanced ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]')} />
                <span className="text-[12px] font-bold tracking-tight">Parametres avances</span>
              </div>
              <ChevronDown size={14} className={cn('text-[var(--app-text-muted)] transition-transform duration-300', showAdvanced && 'rotate-180')} />
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden px-1"
                >
                  <div className="space-y-7 py-6">
                    {renderSlider('temperature', 'Temperature', 0, 2, 0.1)}
                    {renderSlider('topP', 'Top P', 0, 1, 0.01)}
                    {renderSlider('topK', 'Top K', 1, 100, 1)}
                    {renderSlider('maxOutputTokens', 'Max Output', 1, 65536, 1024)}

                    <button
                      onClick={() => resetConfig()}
                      className="flex w-full items-center justify-center gap-2 rounded-full border border-[var(--app-border)] py-3 text-[11px] font-bold text-[var(--app-text-muted)] transition-colors hover:border-[var(--app-border-strong)] hover:bg-white/[0.05] hover:text-[var(--app-text)]"
                    >
                      <RotateCcw size={12} />
                      Reinitialiser les parametres
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-20 h-10 bg-gradient-to-t from-[var(--app-bg)]/80 to-transparent" />

      <AnimatePresence>
        {showGallery && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 } as const}
            className="absolute inset-0 z-[80] border-l border-white/10 bg-[var(--app-bg)]/95 shadow-2xl backdrop-blur-3xl"
          >
            <Suspense fallback={
              <div className="flex h-full items-center justify-center px-6">
                <div className="studio-panel flex w-full max-w-sm flex-col items-center gap-3 rounded-[2rem] px-6 py-8 text-center">
                  <RotateCcw size={18} className="animate-spin text-[var(--app-accent)]" />
                  <div className="text-sm font-medium text-[var(--app-text)]">Chargement de la galerie...</div>
                  <div className="text-xs uppercase tracking-[0.22em] text-[var(--app-text-muted)]">prompts systeme</div>
                </div>
              </div>
            }>
              <SystemInstructionGallery
                onClose={() => setShowGallery(false)}
                onSelect={(prompt) => {
                  setConfig({ systemInstruction: prompt });
                  updateSessionInstruction(prompt);
                }}
              />
            </Suspense>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
