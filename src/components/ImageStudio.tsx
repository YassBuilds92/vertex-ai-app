import React, { useState } from 'react';
import {
  Image as ImageIcon, Sparkles, ChevronDown, Check, Loader2, Download, Maximize2,
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
  { value: '1:1', label: '1:1', icon: '⬜' },
  { value: '4:3', label: '4:3', icon: '▬' },
  { value: '3:4', label: '3:4', icon: '▮' },
  { value: '16:9', label: '16:9', icon: '▬▬' },
  { value: '9:16', label: '9:16', icon: '▮▮' },
  { value: '3:2', label: '3:2', icon: '▭' },
];

interface ImageStudioProps {
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
  messages: Message[];
  onImageClick: (url: string) => void;
}

export const ImageStudio: React.FC<ImageStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
  onImageClick,
}) => {
  const { configs, setConfig } = useStore();
  const config = configs.image;
  const [prompt, setPrompt] = useState('');
  const [showModelPicker, setShowModelPicker] = useState(false);

  const allImages = messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => {
      const imgs: { url: string; prompt: string }[] = [];
      if (m.attachments) {
        for (const a of m.attachments) {
          if (a.type === 'image' && a.url) {
            const userMsg = messages.find(
              (u) => u.role === 'user' && u.createdAt <= m.createdAt && u.createdAt > m.createdAt - 60000,
            );
            imgs.push({ url: a.url, prompt: userMsg?.content || '' });
          }
        }
      }
      if (m.images) {
        for (const url of m.images) {
          imgs.push({ url, prompt: '' });
        }
      }
      return imgs;
    });

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    onGenerate(prompt.trim());
    setPrompt('');
  };

  return (
    <div className="flex h-full flex-col">
      {/* Top: Prompt + Settings */}
      <div className="mx-auto w-full max-w-4xl flex-shrink-0 px-4 pt-6 pb-4 sm:px-6">
        {/* Model pill */}
        <div className="relative mb-4 flex items-center gap-2">
          <button
            onClick={() => setShowModelPicker(!showModelPicker)}
            className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-border-strong)]"
          >
            <ImageIcon size={13} className="text-[var(--app-accent)]" />
            {modelNameMap[config.model] || config.model}
            <ChevronDown size={12} className={cn('text-[var(--app-text-muted)] transition-transform', showModelPicker && 'rotate-180')} />
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
            className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none"
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            {/* Settings row */}
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Aspect ratio */}
              {aspectRatios.map((ar) => (
                <button
                  key={ar.value}
                  onClick={() => setConfig({ aspectRatio: ar.value as any })}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                    config.aspectRatio === ar.value
                      ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-sm'
                      : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                  )}
                >
                  {ar.label}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--app-border)]" />
              {/* Number of images */}
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

            {/* Generate button */}
            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || isLoading}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold transition-all',
                prompt.trim() && !isLoading
                  ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-lg shadow-[var(--app-accent)]/20 hover:brightness-110'
                  : 'bg-white/[0.06] text-[var(--app-text-muted)] cursor-not-allowed',
              )}
            >
              {isLoading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <Sparkles size={14} />
              )}
              {isLoading ? 'Generation...' : 'Generer'}
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
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between p-2.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {img.prompt && (
                      <span className="mr-2 truncate text-[10px] text-white/80">{img.prompt}</span>
                    )}
                    <div className="flex gap-1.5">
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
