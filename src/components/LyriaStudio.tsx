import React, { useMemo, useState } from 'react';
import {
  Music, Sparkles, Loader2, ChevronDown, Check,
  Undo2, Pencil, ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { MediaGenerationRequest, Message } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { buildAudioHistory } from '../utils/media-gallery-history';
import { StudioAudioPlayer } from './StudioAudioPlayer';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const lyriaModels = [
  { id: 'lyria-002', label: 'Lyria 2', info: 'Stable et robuste' },
  { id: 'lyria-3-clip-preview', label: 'Lyria 3 Clip', info: 'Preview courte' },
  { id: 'lyria-3-pro-preview', label: 'Lyria 3 Pro', info: 'Preview ambitieuse' },
];

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
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Refiner preview state
  const [isRefining, setIsRefining] = useState(false);
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState('');

  const allTracks = useMemo(() => buildAudioHistory(messages, { mode: 'lyria' }), [messages]);

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading || isRefining) return;

    if (isRefinerEnabled) {
      setIsRefining(true);
      setOriginalPrompt(prompt.trim());
      try {
        const res = await fetch('/api/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt.trim(),
            mode: 'lyria',
            profileId: config.refinerProfileId,
            customInstructions: config.refinerCustomInstructions,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setRefinedPrompt(data.refinedInstruction || prompt.trim());
        } else {
          onGenerate(prompt.trim(), { originalPrompt: prompt.trim() });
          setPrompt('');
        }
      } catch {
        onGenerate(prompt.trim(), { originalPrompt: prompt.trim() });
        setPrompt('');
      } finally {
        setIsRefining(false);
      }
    } else {
      onGenerate(prompt.trim(), { originalPrompt: prompt.trim() });
      setPrompt('');
    }
  };

  const handleApplyRefined = () => {
    if (refinedPrompt) {
      onGenerate(refinedPrompt, { originalPrompt, refinedPrompt });
      setPrompt('');
      setRefinedPrompt(null);
      setOriginalPrompt('');
    }
  };

  const handleRevertOriginal = () => {
    onGenerate(originalPrompt, { originalPrompt });
    setPrompt('');
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  const handleEditRefined = () => {
    if (refinedPrompt) {
      setPrompt(refinedPrompt);
      setRefinedPrompt(null);
      setOriginalPrompt('');
    }
  };

  const handleDismissPreview = () => {
    setRefinedPrompt(null);
    setOriginalPrompt('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-3xl flex-shrink-0 px-4 pt-6 pb-4 sm:px-6">
        {/* Controls */}
        <div className="relative mb-4 flex flex-wrap items-center gap-2">
          {/* Model picker */}
          <div className="relative">
            <button
              onClick={() => setShowModelPicker(!showModelPicker)}
              className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-border-strong)]"
            >
              <Music size={13} className="text-emerald-400" />
              {lyriaModels.find((m) => m.id === config.model)?.label || config.model}
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
                  {lyriaModels.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { setConfig({ model: m.id }); setShowModelPicker(false); }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[12px] transition-colors',
                        config.model === m.id
                          ? 'bg-emerald-500/15 font-bold text-emerald-300'
                          : 'text-[var(--app-text)] hover:bg-white/[0.05]',
                      )}
                    >
                      <div>
                        <div className="font-semibold">{m.label}</div>
                        <div className="text-[10px] text-[var(--app-text-muted)]">{m.info}</div>
                      </div>
                      {config.model === m.id && <Check size={13} />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Refiner toggle */}
          <button
            onClick={onToggleRefiner}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition-all',
              isRefinerEnabled
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)]',
            )}
          >
            <Sparkles size={12} fill={isRefinerEnabled ? 'currentColor' : 'none'} />
            Raffineur IA
          </button>

          {/* Variants */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-text-muted)] mr-1">Variantes</span>
            {[1, 2, 3, 4].map((n) => (
              <button
                key={n}
                onClick={() => setConfig({ sampleCount: n })}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold transition-all',
                  (config.sampleCount || 1) === n
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Refiner preview panel */}
        <AnimatePresence>
          {refinedPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300">
                  <Sparkles size={11} />
                  Prompt optimise
                </div>
                <p className="mb-1 text-[13px] leading-relaxed text-[var(--app-text)]">
                  {refinedPrompt}
                </p>
                <p className="mb-4 text-[11px] text-[var(--app-text-muted)]">
                  Original : {originalPrompt}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleApplyRefined}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-1.5 text-[12px] font-bold text-[#0a0a14] transition-all hover:brightness-110"
                  >
                    <ArrowRight size={12} />
                    Composer avec ce prompt
                  </button>
                  <button
                    onClick={handleRevertOriginal}
                    disabled={isLoading}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Undo2 size={11} />
                    Garder l'original
                  </button>
                  <button
                    onClick={handleEditRefined}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--app-text-muted)] transition-colors hover:text-[var(--app-text)]"
                  >
                    <Pencil size={11} />
                    Modifier
                  </button>
                  <button
                    onClick={handleDismissPreview}
                    className="ml-auto text-[11px] text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Prompt */}
        <div className="relative rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] transition-colors focus-within:border-[var(--app-border-strong)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="Decris ton morceau — texture, energie, instruments, ambiance..."
            rows={3}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none"
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            {/* Negative prompt inline */}
            <input
              value={config.negativePrompt || ''}
              onChange={(e) => setConfig({ negativePrompt: e.target.value })}
              placeholder="Negative prompt (optionnel)"
              className="max-w-xs rounded-lg bg-white/[0.04] px-3 py-1.5 text-[11px] text-[var(--app-text-muted)] outline-none placeholder:text-[var(--app-text-muted)]/40 transition-colors focus:bg-white/[0.07]"
            />

            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading || isRefining}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold transition-all',
                prompt.trim() && !isLoading && !isRefining
                  ? 'bg-emerald-500 text-[#0a0a14] shadow-lg shadow-emerald-500/20 hover:brightness-110'
                  : 'bg-white/[0.06] text-[var(--app-text-muted)] cursor-not-allowed',
              )}
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : isRefining ? <Loader2 size={15} className="animate-spin" /> : <Music size={14} />}
              {isLoading ? 'Composition...' : isRefining ? 'Optimisation...' : 'Composer'}
            </button>
          </div>
        </div>
      </div>

      {/* Track list */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {allTracks.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-emerald-500/10">
                <Music size={24} className="text-emerald-400" />
              </div>
              <p className="text-sm text-[var(--app-text-muted)]">Tes morceaux apparaitront ici</p>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-5 py-4">
                  <Loader2 size={18} className="animate-spin text-emerald-400" />
                  <span className="text-sm text-emerald-300/70">Composition en cours...</span>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
};
