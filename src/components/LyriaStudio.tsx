import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Loader2,
  Music,
  Pencil,
  Sparkles,
  Undo2,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import {
  getLyriaModelLabel,
  LYRIA_MODEL_OPTIONS,
} from '../../shared/lyria-models.js';
import { useStore } from '../store/useStore';
import { MediaGenerationRequest, Message } from '../types';
import { buildAudioHistory } from '../utils/media-gallery-history';
import { StudioAudioPlayer } from './StudioAudioPlayer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LyriaStudioProps {
  onGenerate: (prompt: string, request?: MediaGenerationRequest) => void;
  isLoading: boolean;
  messages: Message[];
  isRefinerEnabled: boolean;
  onToggleRefiner: () => void;
}

export const LyriaStudio: React.FC<LyriaStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
  isRefinerEnabled,
  onToggleRefiner,
}) => {
  const { configs, setConfig } = useStore();
  const config = configs.lyria;
  const [prompt, setPrompt] = useState('');
  const [isRefining, setIsRefining] = useState(false);
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState('');

  const allTracks = useMemo(() => buildAudioHistory(messages, { mode: 'lyria' }), [messages]);
  const canSubmit = Boolean(prompt.trim()) && !isLoading && !isRefining;

  const submitRawPrompt = (value: string, request?: MediaGenerationRequest) => {
    onGenerate(value, request);
    setPrompt('');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const cleanPrompt = prompt.trim();

    if (isRefinerEnabled) {
      setIsRefining(true);
      setOriginalPrompt(cleanPrompt);
      try {
        const res = await fetch('/api/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cleanPrompt,
            mode: 'lyria',
            profileId: config.refinerProfileId,
            customInstructions: config.refinerCustomInstructions,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setRefinedPrompt(data.refinedInstruction || cleanPrompt);
        } else {
          submitRawPrompt(cleanPrompt, { originalPrompt: cleanPrompt });
        }
      } catch {
        submitRawPrompt(cleanPrompt, { originalPrompt: cleanPrompt });
      } finally {
        setIsRefining(false);
      }
      return;
    }

    submitRawPrompt(cleanPrompt, { originalPrompt: cleanPrompt });
  };

  const handleApplyRefined = () => {
    if (!refinedPrompt) return;
    submitRawPrompt(refinedPrompt, { originalPrompt, refinedPrompt });
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleRevertOriginal = () => {
    if (!originalPrompt.trim()) return;
    submitRawPrompt(originalPrompt, { originalPrompt });
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleEditRefined = () => {
    if (!refinedPrompt) return;
    setPrompt(refinedPrompt);
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  return (
    <div className="h-full overflow-y-auto overscroll-y-contain">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(340px,1.08fr)]">
        <section className="space-y-4">
          <div className="rounded-[1.5rem] border border-[var(--app-border)] bg-[var(--app-surface)]/80 p-4 shadow-[0_24px_90px_-62px_rgba(0,0,0,0.8)] sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
                  Generation musique
                </div>
                <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--app-text)]">
                  Prompt
                </h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-emerald-300">
                <Music size={18} />
              </div>
            </div>

            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Decris le morceau: energie, instruments, tempo, ambiance, structure..."
              rows={8}
              className="min-h-[15rem] w-full resize-none rounded-[1.1rem] border border-white/8 bg-black/20 px-4 py-4 text-[15px] leading-relaxed text-[var(--app-text)] outline-none transition-colors placeholder:text-[var(--app-text-muted)]/50 focus:border-[var(--app-border-strong)]"
            />

            <div className="mt-4 grid gap-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_12rem_auto]">
                <label className="space-y-1.5">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Modele</span>
                  <select
                    value={config.model}
                    onChange={(event) => setConfig({ model: event.target.value })}
                    className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-3 text-[12px] font-semibold text-[var(--app-text)] outline-none focus:border-[var(--app-border-strong)]"
                  >
                    {LYRIA_MODEL_OPTIONS.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="space-y-1.5">
                  <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Variantes</span>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[1, 2, 3, 4].map((count) => (
                      <button
                        key={count}
                        type="button"
                        onClick={() => setConfig({ sampleCount: count })}
                        className={cn(
                          'h-10 rounded-xl text-[12px] font-bold transition-all',
                          (config.sampleCount || 1) === count
                            ? 'bg-emerald-500 text-[#0a0a14]'
                            : 'border border-[var(--app-border)] bg-white/[0.04] text-[var(--app-text-muted)] hover:bg-white/[0.07]',
                        )}
                      >
                        {count}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onToggleRefiner}
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 self-end rounded-xl border px-3 text-[12px] font-semibold transition-all',
                    isRefinerEnabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : 'border-[var(--app-border)] bg-white/[0.04] text-[var(--app-text-muted)] hover:bg-white/[0.07]',
                  )}
                >
                  <Sparkles size={13} fill={isRefinerEnabled ? 'currentColor' : 'none'} />
                  Raffineur
                </button>
              </div>

              <label className="space-y-1.5">
                <span className="ml-1 text-[11px] font-bold text-[var(--app-text-muted)]">Negative prompt</span>
                <input
                  value={config.negativePrompt || ''}
                  onChange={(event) => setConfig({ negativePrompt: event.target.value })}
                  placeholder="sons, styles ou ambiances a eviter"
                  className="h-10 w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] px-3 text-[12px] font-semibold text-[var(--app-text)] outline-none placeholder:text-[var(--app-text-muted)]/45 focus:border-[var(--app-border-strong)]"
                />
              </label>
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={cn(
                'mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-[13px] font-bold transition-all',
                canSubmit
                  ? 'bg-emerald-500 text-[#0a0a14] shadow-lg shadow-emerald-500/20 hover:brightness-110'
                  : 'cursor-not-allowed bg-white/[0.06] text-[var(--app-text-muted)]',
              )}
            >
              {(isLoading || isRefining) ? <Loader2 size={15} className="animate-spin" /> : <Music size={14} />}
              {isLoading ? 'Composition...' : isRefining ? 'Optimisation...' : 'Composer'}
            </button>
          </div>

          <AnimatePresence>
            {refinedPrompt && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="rounded-[1.3rem] border border-emerald-500/20 bg-emerald-500/10 p-4"
              >
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  <Sparkles size={11} />
                  Prompt optimise
                </div>
                <p className="mb-2 text-[13px] leading-relaxed text-[var(--app-text)]">{refinedPrompt}</p>
                <p className="mb-4 text-[11px] text-[var(--app-text-muted)]">Original: {originalPrompt}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleApplyRefined}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-[12px] font-bold text-[#0a0a14] transition-all hover:brightness-110"
                  >
                    <ArrowRight size={12} />
                    Composer
                  </button>
                  <button
                    type="button"
                    onClick={handleRevertOriginal}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Undo2 size={11} />
                    Original
                  </button>
                  <button
                    type="button"
                    onClick={handleEditRefined}
                    className="flex items-center gap-1.5 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Pencil size={11} />
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefinedPrompt(null)}
                    className="ml-auto text-[11px] text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    Annuler
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <section className="min-h-[32rem] rounded-[1.5rem] border border-[var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(8,8,12,0.72))] p-4 shadow-[0_24px_90px_-62px_rgba(0,0,0,0.86)] sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">
                Sortie musique
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--app-text)]">
                {getLyriaModelLabel(config.model)}
              </div>
            </div>
            <div className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-[var(--app-text-muted)]">
              {allTracks.length} piste{allTracks.length > 1 ? 's' : ''}
            </div>
          </div>

          {allTracks.length === 0 && !isLoading ? (
            <div className="flex min-h-[28rem] flex-col items-center justify-center rounded-[1.35rem] border border-dashed border-[var(--app-border)] bg-black/15 px-6 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-emerald-300">
                <Music size={22} />
              </div>
              <p className="text-sm font-semibold text-[var(--app-text)]">Le morceau apparait ici.</p>
              <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[var(--app-text-muted)]">
                Ecris le prompt, choisis le modele et le nombre de variantes, puis compose.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {isLoading && (
                <div className="rounded-[1.2rem] border border-emerald-500/20 bg-emerald-500/10 p-4">
                  <div className="flex items-center gap-3 text-sm text-emerald-200/75">
                    <Loader2 size={18} className="animate-spin text-emerald-300" />
                    Composition en cours...
                  </div>
                </div>
              )}

              {allTracks.map((track, index) => (
                <StudioAudioPlayer
                  key={track.id}
                  src={track.url}
                  title={track.name || `Piste ${allTracks.length - index}`}
                  subtitle={track.model || track.mimeType || config.model}
                  prompt={track.refinedPrompt || track.prompt}
                  downloadName={track.name || 'lyria-track.wav'}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
