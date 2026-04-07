import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  FileAudio,
  Loader2,
  Pencil,
  Sparkles,
  Undo2,
  ArrowRight,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  findGeminiTtsVoice,
  GEMINI_TTS_VOICES,
} from '../../shared/gemini-tts.js';
import { getPromptRefinerProfile } from '../../shared/prompt-refiners.js';
import { useStore } from '../store/useStore';
import { MediaGenerationRequest, Message } from '../types';
import { buildAudioHistory } from '../utils/media-gallery-history';
import { StudioAudioPlayer } from './StudioAudioPlayer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ttsModels = [
  { id: 'gemini-2.5-flash-tts', label: 'Flash TTS', info: 'Rapide et naturel' },
  { id: 'gemini-2.5-flash-lite-preview-tts', label: 'Flash Lite TTS', info: 'Eco et leger' },
  { id: 'gemini-2.5-pro-tts', label: 'Pro TTS', info: 'Voix premium' },
];

interface AudioStudioProps {
  onGenerate: (prompt: string, request?: MediaGenerationRequest) => void;
  isLoading: boolean;
  messages: Message[];
  isRefinerEnabled: boolean;
  onToggleRefiner: () => void;
}

export const AudioStudio: React.FC<AudioStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
  isRefinerEnabled,
  onToggleRefiner,
}) => {
  const { configs, setConfig } = useStore();
  const config = configs.audio;
  const activeRefinerProfile = getPromptRefinerProfile('audio', config.refinerProfileId);

  const [text, setText] = useState('');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const [isRefining, setIsRefining] = useState(false);
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState('');

  const selectedVoice = findGeminiTtsVoice(config.ttsVoice || 'Kore');
  const allAudio = useMemo(() => buildAudioHistory(messages, { mode: 'audio' }), [messages]);

  const handleSubmit = async () => {
    if (!text.trim() || isLoading || isRefining) return;

    if (isRefinerEnabled) {
      setIsRefining(true);
      setOriginalPrompt(text.trim());
      try {
        const res = await fetch('/api/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: text.trim(),
            mode: 'audio',
            profileId: config.refinerProfileId,
            customInstructions: config.refinerCustomInstructions,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setRefinedPrompt(data.refinedInstruction || text.trim());
        } else {
          onGenerate(text.trim(), { originalPrompt: text.trim() });
          setText('');
        }
      } catch {
        onGenerate(text.trim(), { originalPrompt: text.trim() });
        setText('');
      } finally {
        setIsRefining(false);
      }
    } else {
      onGenerate(text.trim(), { originalPrompt: text.trim() });
      setText('');
    }
  };

  const handleApplyRefined = () => {
    if (!refinedPrompt) return;
    onGenerate(refinedPrompt, { originalPrompt, refinedPrompt });
    setText('');
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleRevertOriginal = () => {
    if (!originalPrompt.trim()) return;
    onGenerate(originalPrompt, { originalPrompt });
    setText('');
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleEditRefined = () => {
    if (!refinedPrompt) return;
    setText(refinedPrompt);
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleDismissPreview = () => {
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-6xl flex-shrink-0 px-4 pt-6 pb-4 sm:px-6">
        <div className="relative mb-4 flex flex-wrap items-center gap-2">
          <div className="relative">
            <button
              onClick={() => {
                setShowModelPicker((current) => !current);
                setShowVoicePicker(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-border-strong)]"
            >
              <FileAudio size={13} className="text-[var(--app-accent)]" />
              {ttsModels.find((model) => model.id === config.model)?.label || config.model}
              <ChevronDown size={12} className={cn('text-[var(--app-text-muted)] transition-transform', showModelPicker && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showModelPicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 top-full z-20 mt-1.5 w-56 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-strong)] p-2 shadow-xl backdrop-blur-xl"
                >
                  {ttsModels.map((model) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setConfig({ model: model.id });
                        setShowModelPicker(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[12px] transition-colors',
                        config.model === model.id
                          ? 'bg-[var(--app-accent-soft)] font-bold text-[var(--app-accent)]'
                          : 'text-[var(--app-text)] hover:bg-white/[0.05]',
                      )}
                    >
                      <div>
                        <div className="font-semibold">{model.label}</div>
                        <div className="text-[10px] text-[var(--app-text-muted)]">{model.info}</div>
                      </div>
                      {config.model === model.id && <Check size={13} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="relative">
            <button
              onClick={() => {
                setShowVoicePicker((current) => !current);
                setShowModelPicker(false);
              }}
              className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-border-strong)]"
            >
              {selectedVoice?.name || 'Kore'} - {selectedVoice?.style || ''}
              <ChevronDown size={12} className={cn('text-[var(--app-text-muted)] transition-transform', showVoicePicker && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {showVoicePicker && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 top-full z-20 mt-1.5 max-h-64 w-72 overflow-y-auto rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-strong)] p-2 shadow-xl backdrop-blur-xl"
                >
                  {GEMINI_TTS_VOICES.map((voice) => (
                    <button
                      key={voice.name}
                      onClick={() => {
                        setConfig({ ttsVoice: voice.name });
                        setShowVoicePicker(false);
                      }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] transition-colors',
                        config.ttsVoice === voice.name
                          ? 'bg-[var(--app-accent-soft)] font-bold text-[var(--app-accent)]'
                          : 'text-[var(--app-text)] hover:bg-white/[0.05]',
                      )}
                    >
                      <div>
                        <span className="font-semibold">{voice.name}</span>
                        <span className="ml-1.5 text-[10px] text-[var(--app-text-muted)]">{voice.style}</span>
                      </div>
                      {config.ttsVoice === voice.name && <Check size={13} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={onToggleRefiner}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all',
              isRefinerEnabled
                ? 'border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)]',
            )}
          >
            <Sparkles size={12} fill={isRefinerEnabled ? 'currentColor' : 'none'} />
            Raffineur IA
          </button>

          {activeRefinerProfile && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-white/[0.03] px-3 py-2 text-[11px] text-[var(--app-text-muted)]">
              <span className="font-bold text-[var(--app-text)]">{activeRefinerProfile.title}</span>
              <span className="hidden sm:inline">{activeRefinerProfile.summary}</span>
            </div>
          )}

          <input
            value={config.ttsLanguageCode || 'fr-FR'}
            onChange={(event) => setConfig({ ttsLanguageCode: event.target.value })}
            className="w-20 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
          />
        </div>

        <AnimatePresence>
          {refinedPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-[1.8rem] border border-[var(--app-accent)]/20 bg-[var(--app-accent-soft)] p-5">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--app-accent)]">
                  <Sparkles size={11} />
                  Texte optimise
                </div>
                <p className="mb-1 text-[13px] leading-relaxed text-[var(--app-text)]">{refinedPrompt}</p>
                <p className="mb-4 text-[11px] text-[var(--app-text-muted)]">Original : {originalPrompt}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleApplyRefined}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-[var(--app-accent)] px-4 py-2 text-[12px] font-bold text-[#0a0a14] transition-all hover:brightness-110"
                  >
                    <ArrowRight size={12} />
                    Synthetiser avec ce texte
                  </button>
                  <button
                    onClick={handleRevertOriginal}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Undo2 size={11} />
                    Garder l'original
                  </button>
                  <button
                    onClick={handleEditRefined}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Pencil size={11} />
                    Modifier
                  </button>
                  <button
                    onClick={handleDismissPreview}
                    className="ml-auto text-[11px] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="rounded-[2rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(8,8,12,0.6))] p-4 shadow-[0_30px_90px_-56px_rgba(0,0,0,0.85)] transition-colors focus-within:border-[var(--app-border-strong)]">
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Colle ton texte ici. Ctrl+Enter pour synthetiser."
            rows={6}
            className="w-full resize-none bg-transparent px-2 pt-2 pb-16 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none"
          />
          <div className="flex flex-col gap-3 border-t border-white/6 pt-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[32rem] rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-[var(--app-text-muted)]">
              {config.refinerCustomInstructions?.trim()
                ? `Consigne perso: ${config.refinerCustomInstructions}`
                : activeRefinerProfile?.summary || 'Raffinage vocal standard.'}
            </div>
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isLoading || isRefining}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold transition-all',
                text.trim() && !isLoading && !isRefining
                  ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-lg shadow-[var(--app-accent)]/20 hover:brightness-110'
                  : 'cursor-not-allowed bg-white/[0.06] text-[var(--app-text-muted)]',
              )}
            >
              {(isLoading || isRefining) ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={14} />}
              {isLoading ? 'Synthese...' : isRefining ? 'Optimisation...' : 'Synthetiser'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-4">
          {allAudio.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.6rem] border border-[var(--app-border)] bg-[var(--app-accent-soft)]">
                <FileAudio size={24} className="text-[var(--app-accent)]" />
              </div>
              <p className="text-sm text-[var(--app-text-muted)]">Tes voix apparaitront ici.</p>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="rounded-[1.8rem] border border-[var(--app-border)] bg-white/[0.03] p-4">
                  <div className="flex items-center gap-3 text-sm text-[var(--app-text-muted)]">
                    <Loader2 size={18} className="animate-spin text-[var(--app-accent)]" />
                    Synthese en cours...
                  </div>
                </div>
              )}

              <div className="grid gap-4 xl:grid-cols-2">
                {allAudio.map((item, index) => (
                  <StudioAudioPlayer
                    key={item.id}
                    src={item.url}
                    title={item.name || `Audio ${allAudio.length - index}`}
                    subtitle={item.model || item.mimeType || `${selectedVoice?.name || 'Gemini TTS'} - ${config.ttsLanguageCode || 'fr-FR'}`}
                    prompt={item.refinedPrompt || item.prompt}
                    downloadName={item.name || 'audio-genere.wav'}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
