import React, { useState } from 'react';
import {
  FileAudio, Sparkles, Loader2, ChevronDown, Check, Play, Pause,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { Message } from '../types';
import {
  findGeminiTtsVoice,
  GEMINI_TTS_VOICES,
} from '../../shared/gemini-tts.js';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const ttsModels = [
  { id: 'gemini-2.5-flash-tts', label: 'Flash TTS', info: 'Rapide et naturel' },
  { id: 'gemini-2.5-flash-lite-preview-tts', label: 'Flash Lite TTS', info: 'Eco et leger' },
  { id: 'gemini-2.5-pro-tts', label: 'Pro TTS', info: 'Voix premium' },
];

interface AudioStudioProps {
  onGenerate: (prompt: string) => void;
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
  const [text, setText] = useState('');
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);

  const selectedVoice = findGeminiTtsVoice(config.ttsVoice || 'Kore');

  const allAudio = messages
    .filter((m) => m.role === 'model')
    .flatMap((m) => {
      const items: { url: string; prompt: string; mimeType?: string }[] = [];
      if (m.attachments) {
        for (const a of m.attachments) {
          if (a.type === 'audio' && a.url) {
            const userMsg = messages.find(
              (u) => u.role === 'user' && u.createdAt <= m.createdAt && u.createdAt > m.createdAt - 60000,
            );
            items.push({ url: a.url, prompt: userMsg?.content || '', mimeType: a.mimeType });
          }
        }
      }
      if (m.audio) items.push({ url: m.audio, prompt: '' });
      return items;
    });

  const handleSubmit = () => {
    if (!text.trim() || isLoading) return;
    onGenerate(text.trim());
    setText('');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="mx-auto w-full max-w-3xl flex-shrink-0 px-4 pt-6 pb-4 sm:px-6">
        {/* Controls row */}
        <div className="relative mb-4 flex flex-wrap items-center gap-2">
          {/* Model picker */}
          <div className="relative">
            <button
              onClick={() => { setShowModelPicker(!showModelPicker); setShowVoicePicker(false); }}
              className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-border-strong)]"
            >
              <FileAudio size={13} className="text-[var(--app-accent)]" />
              {ttsModels.find((m) => m.id === config.model)?.label || config.model}
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
                  {ttsModels.map((m) => (
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

          {/* Voice picker */}
          <div className="relative">
            <button
              onClick={() => { setShowVoicePicker(!showVoicePicker); setShowModelPicker(false); }}
              className="flex items-center gap-2 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--app-text)] transition-colors hover:border-[var(--app-border-strong)]"
            >
              {selectedVoice?.name || 'Kore'} — {selectedVoice?.style || ''}
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
                  {GEMINI_TTS_VOICES.map((v) => (
                    <button
                      key={v.name}
                      onClick={() => { setConfig({ ttsVoice: v.name }); setShowVoicePicker(false); }}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-[12px] transition-colors',
                        config.ttsVoice === v.name
                          ? 'bg-[var(--app-accent-soft)] font-bold text-[var(--app-accent)]'
                          : 'text-[var(--app-text)] hover:bg-white/[0.05]',
                      )}
                    >
                      <div>
                        <span className="font-semibold">{v.name}</span>
                        <span className="ml-1.5 text-[10px] text-[var(--app-text-muted)]">{v.style} · {v.gender === 'female' ? '♀' : '♂'}</span>
                      </div>
                      {config.ttsVoice === v.name && <Check size={13} />}
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
                ? 'border-[var(--app-accent)]/30 bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                : 'border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-text-muted)] hover:border-[var(--app-border-strong)]',
            )}
          >
            <Sparkles size={12} fill={isRefinerEnabled ? 'currentColor' : 'none'} />
            Raffineur IA
          </button>

          {/* Language */}
          <input
            value={config.ttsLanguageCode || 'fr-FR'}
            onChange={(e) => setConfig({ ttsLanguageCode: e.target.value })}
            className="w-20 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--app-text)] outline-none transition-colors focus:border-[var(--app-border-strong)]"
          />
        </div>

        {/* Text area */}
        <div className="relative rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] transition-colors focus-within:border-[var(--app-border-strong)]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(); }
            }}
            placeholder="Colle ton texte ici. Ctrl+Enter pour synthetiser."
            rows={6}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-14 text-[15px] leading-relaxed text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]/50 outline-none"
          />
          <div className="absolute bottom-3 right-3">
            <button
              onClick={handleSubmit}
              disabled={!text.trim() || isLoading}
              className={cn(
                'flex items-center gap-2 rounded-xl px-5 py-2 text-[13px] font-bold transition-all',
                text.trim() && !isLoading
                  ? 'bg-[var(--app-accent)] text-[#0a0a14] shadow-lg shadow-[var(--app-accent)]/20 hover:brightness-110'
                  : 'bg-white/[0.06] text-[var(--app-text-muted)] cursor-not-allowed',
              )}
            >
              {isLoading ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={14} />}
              {isLoading ? 'Synthese...' : 'Synthetiser'}
            </button>
          </div>
        </div>
      </div>

      {/* Audio list */}
      <div className="flex-1 overflow-y-auto px-4 pb-8 sm:px-6">
        <div className="mx-auto max-w-3xl space-y-3">
          {allAudio.length === 0 && !isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-[var(--app-accent-soft)]">
                <FileAudio size={24} className="text-[var(--app-accent)]" />
              </div>
              <p className="text-sm text-[var(--app-text-muted)]">Tes voix apparaitront ici</p>
            </div>
          ) : (
            <>
              {isLoading && (
                <div className="flex items-center gap-3 rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4">
                  <Loader2 size={18} className="animate-spin text-[var(--app-accent)]" />
                  <span className="text-sm text-[var(--app-text-muted)]">Synthese en cours...</span>
                </div>
              )}
              {[...allAudio].reverse().map((item, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-5 py-4 transition-colors hover:border-[var(--app-border-strong)]"
                >
                  {item.prompt && (
                    <p className="mb-3 text-[12px] leading-relaxed text-[var(--app-text-muted)] line-clamp-2">
                      {item.prompt}
                    </p>
                  )}
                  <audio src={item.url} controls className="w-full" preload="metadata" />
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
