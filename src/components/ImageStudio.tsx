import React, { useState } from 'react';
import {
  Image as ImageIcon, Sparkles, ChevronDown, Check, Loader2, Download, Maximize2,
  Undo2, Pencil, ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { Message } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const modelNameMap: Record<string, string> = {
  'gemini-3.1-flash-image-preview': 'Nano Banana 2',
  'gemini-3-pro-image-preview': 'Nano Banana Pro',
  'gemini-2.5-flash-image': 'Nano Banana',
};

const imageModels = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2', info: 'Rapide et scalable' },
  { id: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro', info: 'Image premium' },
  { id: 'gemini-2.5-flash-image', label: 'Nano Banana', info: 'Polyvalent et stable' },
];

const aspectRatios = [
  { value: '', label: 'Auto' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '3:2', label: '3:2' },
  { value: '2:3', label: '2:3' },
  { value: '21:9', label: '21:9' },
];

function RatioShape({ ratio }: { ratio: string }) {
  if (!ratio) return <span className="text-[9px] font-black opacity-60">A</span>;
  const [w, h] = ratio.split(':').map(Number);
  const maxDim = 12;
  const scale = Math.min(maxDim / w, maxDim / h);
  return (
    <span
      className="inline-block rounded-[1.5px] border-[1.5px] border-current"
      style={{ width: Math.max(4, w * scale), height: Math.max(4, h * scale) }}
    />
  );
}

interface ImageStudioProps {
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
  messages: Message[];
  onImageClick: (url: string) => void;
  isRefinerEnabled: boolean;
  onToggleRefiner: () => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
  onImageClick,
  isRefinerEnabled,
  onToggleRefiner,
}) => {
  const { configs, setConfig } = useStore();
  const config = configs.image;
  const [prompt, setPrompt] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);

  // Refiner preview state
  const [isRefining, setIsRefining] = useState(false);
  const [refinedPrompt, setRefinedPrompt] = useState<string | null>(null);
  const [originalPrompt, setOriginalPrompt] = useState('');

  const allImages = messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => {
      const imgs: { url: string; prompt: string; refined?: string }[] = [];
      if (m.attachments) {
        for (const a of m.attachments) {
          if (a.type === 'image' && a.url) {
            const userMsg = messages.find(
              (u) => u.role === 'user' && u.createdAt <= m.createdAt && u.createdAt > m.createdAt - 60000,
            );
            imgs.push({ url: a.url, prompt: userMsg?.content || '', refined: userMsg?.refinedInstruction });
          }
        }
      }
      if (m.images) {
        for (const url of m.images) imgs.push({ url, prompt: '' });
      }
      return imgs;
    });

  const handleSubmit = async () => {
    if (!prompt.trim() || isLoading || isRefining) return;

    if (isRefinerEnabled) {
      // Call refiner API and show preview
      setIsRefining(true);
      setOriginalPrompt(prompt.trim());
      try {
        const res = await fetch('/api/refine', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: prompt.trim(), mode: 'image' }),
        });
        if (res.ok) {
          const data = await res.json();
          setRefinedPrompt(data.refinedInstruction || prompt.trim());
        } else {
          // Refine failed, send original
          onGenerate(prompt.trim());
          setPrompt('');
        }
      } catch {
        onGenerate(prompt.trim());
        setPrompt('');
      } finally {
        setIsRefining(false);
      }
    } else {
      onGenerate(prompt.trim());
      setPrompt('');
    }
  };

  const handleApplyRefined = () => {
    if (refinedPrompt) {
      onGenerate(refinedPrompt);
      setPrompt('');
      setRefinedPrompt(null);
      setOriginalPrompt('');
    }
  };

  const handleRevertOriginal = () => {
    onGenerate(originalPrompt);
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
      {/* Top: Prompt + Settings */}
      <div className="mx-auto w-full max-w-4xl flex-shrink-0 px-4 pt-6 pb-4 sm:px-6">
        {/* Model pill + Refiner toggle */}
        <div className="relative mb-4 flex items-center gap-2">
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-border-strong)]"
          >
            <ImageIcon size={13} className="text-[var(--app-accent)]" />
            {modelNameMap[config.model] || config.model}
            <ChevronDown size={12} className={cn('text-[var(--app-text-muted)] transition-transform', showModelPicker && 'rotate-180')} />
          </button>

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

          <AnimatePresence>
            {showModelPicker && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-20 mt-1.5 w-64 rounded-xl border border-[var(--app-border-strong)] bg-[var(--app-surface-strong)] p-2 shadow-xl backdrop-blur-xl"
              >
                {imageModels.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => { setConfig({ model: m.id }); setShowModelPicker(false); }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-[12px] transition-colors',
                      config.model === m.id
                        ? 'bg-[var(--app-accent-soft)] font-bold text-[var(--app-accent)]'
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

        {/* Refiner preview panel */}
        <AnimatePresence>
          {refinedPrompt && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 overflow-hidden"
            >
              <div className="rounded-2xl border border-[var(--app-accent)]/20 bg-[var(--app-accent-soft)] p-4">
                <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--app-accent)]">
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
                    className="flex items-center gap-1.5 rounded-lg bg-[var(--app-accent)] px-4 py-1.5 text-[12px] font-bold text-[#0a0a14] transition-all hover:brightness-110"
                  >
                    <ArrowRight size={12} />
                    Generer avec ce prompt
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

        {/* Prompt area */}
        <div className="relative rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] transition-colors focus-within:border-[var(--app-border-strong)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="Decris ton image — cadre, lumiere, style, ambiance..."
            rows={3}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-16 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none"
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1">
              {aspectRatios.map((ar) => (
                <button
                  key={ar.value}
                  onClick={() => setConfig({ aspectRatio: ar.value as any })}
                  title={ar.label || 'Auto'}
                  className={cn(
                    'flex flex-col items-center gap-0.5 rounded-lg px-2 py-1 transition-all min-w-[34px]',
                    (config.aspectRatio || '') === ar.value
                      ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-sm'
                      : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                  )}
                >
                  <RatioShape ratio={ar.value} />
                  <span className="text-[9px] font-bold leading-none">{ar.label}</span>
                </button>
              ))}
              <span className="mx-0.5 h-4 w-px bg-[var(--app-border)]" />
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => setConfig({ numberOfImages: n })}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold transition-all',
                    (config.numberOfImages || 1) === n
                      ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                      : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                  )}
                >
                  {n}
                </button>
              ))}
            </div>

            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading || isRefining}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold transition-all',
                prompt.trim() && !isLoading && !isRefining
                  ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-lg shadow-[var(--app-accent)]/20 hover:brightness-110'
                  : 'bg-white/[0.06] text-[var(--app-text-muted)] cursor-not-allowed',
              )}
            >
              {isRefining ? (
                <Loader2 size={15} className="animate-spin" />
              ) : isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {isRefining ? 'Optimisation...' : isLoading ? 'Generation...' : 'Generer'}
            </button>
          </div>
        </div>
      </div>

      {/* Gallery */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {allImages.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-accent-soft)]">
                <ImageIcon size={24} className="text-[var(--app-accent)]" />
              </div>
              <p className="text-sm text-[var(--app-text-muted)]">
                Tes images apparaitront ici
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {isLoading && (
                <div className="aspect-square animate-pulse rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-[var(--app-accent)]" />
                </div>
              )}
              {[...allImages].reverse().map((img, i) => (
                <div
                  key={i}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] transition-all hover:border-[var(--app-border-strong)] hover:shadow-lg"
                  onClick={() => onImageClick(img.url)}
                >
                  <img
                    src={img.url}
                    alt={img.prompt || 'Image generee'}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <div className="flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        {img.refined && (
                          <div className="mb-1 flex items-center gap-1 text-[9px] font-semibold text-indigo-300">
                            <Sparkles size={8} />
                            Prompt optimise
                          </div>
                        )}
                        {img.prompt && (
                          <span className="block truncate text-[10px] text-white/80">{img.prompt}</span>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <a
                          href={img.url}
                          download="image.png"
                          onClick={(e) => e.stopPropagation()}
                          className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
                        >
                          <Download size={12} />
                        </a>
                        <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20 text-white backdrop-blur-sm transition-colors hover:bg-white/30">
                          <Maximize2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
