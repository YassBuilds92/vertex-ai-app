import React, { useState } from 'react';
import {
  Film, Sparkles, Loader2, Play, Download,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { Message } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VideoStudioProps {
  onGenerate: (prompt: string) => void;
  isLoading: boolean;
  messages: Message[];
  isRefinerEnabled: boolean;
  onToggleRefiner: () => void;
}

export const VideoStudio: React.FC<VideoStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
  isRefinerEnabled,
  onToggleRefiner,
}) => {
  const { configs, setConfig } = useStore();
  const config = configs.video;
  const [prompt, setPrompt] = useState('');

  const allVideos = messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => {
      const vids: { url: string; prompt: string }[] = [];
      if (m.attachments) {
        for (const a of m.attachments) {
          if (a.type === 'video' && a.url) {
            const userMsg = messages.find(
              (u) => u.role === 'user' && u.createdAt <= m.createdAt && u.createdAt > m.createdAt - 120000,
            );
            vids.push({ url: a.url, prompt: userMsg?.content || '' });
          }
        }
      }
      if (m.video) vids.push({ url: m.video, prompt: '' });
      return vids;
    });

  const handleSubmit = () => {
    if (!prompt.trim() || isLoading) return;
    onGenerate(prompt.trim());
    setPrompt('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-4xl flex-shrink-0 px-4 pt-6 pb-4 sm:px-6">
        {/* Refiner toggle */}
        <div className="mb-4 flex items-center gap-2">
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
        </div>

        {/* Prompt */}
        <div className="relative rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] transition-colors focus-within:border-[var(--app-border-strong)]">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="Decris ta scene — mouvement de camera, ambiance, sujet, style cine..."
            rows={3}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none"
          />
          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {/* Aspect ratio */}
              {['16:9', '9:16'].map((ratio) => (
                <button
                  key={ratio}
                  onClick={() => setConfig({ videoAspectRatio: ratio as any })}
                  className={cn(
                    'rounded-lg px-3 py-1 text-[11px] font-bold transition-all',
                    config.videoAspectRatio === ratio
                      ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                      : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                  )}
                >
                  {ratio === '16:9' ? 'Paysage' : 'Portrait'}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--app-border)]" />
              {/* Resolution */}
              {['720p', '1080p', '4k'].map((res) => (
                <button
                  key={res}
                  onClick={() => setConfig({ videoResolution: res as any })}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                    config.videoResolution === res
                      ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                      : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                  )}
                >
                  {res}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--app-border)]" />
              {/* Duration */}
              {[4, 6, 8].map((s) => (
                <button
                  key={s}
                  onClick={() => setConfig({ videoDurationSeconds: s })}
                  className={cn(
                    'rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all',
                    config.videoDurationSeconds === s
                      ? 'bg-[var(--app-accent)] text-[#0a0a14]'
                      : 'bg-white/[0.06] text-[var(--app-text-muted)] hover:bg-white/10',
                  )}
                >
                  {s}s
                </button>
              ))}
            </div>

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
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Film size={14} />}
              {isLoading ? 'Generation...' : 'Creer'}
            </button>
          </div>
        </div>
      </div>

      {/* Video Gallery */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-4xl">
          {allVideos.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-accent-soft)]">
                <Film size={24} className="text-[var(--app-accent)]" />
              </div>
              <p className="text-sm text-[var(--app-text-muted)]">Tes videos apparaitront ici</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {isLoading && (
                <div className="aspect-video animate-pulse rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] flex items-center justify-center">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={28} className="animate-spin text-[var(--app-accent)]" />
                    <span className="text-xs text-[var(--app-text-muted)]">Generation en cours...</span>
                  </div>
                </div>
              )}
              {[...allVideos].reverse().map((vid, i) => (
                <div
                  key={i}
                  className="group relative overflow-hidden rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] transition-all hover:border-[var(--app-border-strong)]"
                >
                  <video
                    src={vid.url}
                    controls
                    className="aspect-video w-full object-cover"
                    preload="metadata"
                  />
                  {vid.prompt && (
                    <div className="border-t border-[var(--app-border)] px-3 py-2">
                      <p className="truncate text-[11px] text-[var(--app-text-muted)]">{vid.prompt}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
