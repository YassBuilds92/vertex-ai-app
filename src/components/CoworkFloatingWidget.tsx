import React, { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, Send, Sparkles, X } from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface HistoryEntry {
  request: string;
  timestamp: number;
  status: 'pending' | 'sent';
}

interface CoworkFloatingWidgetProps {
  onAskCowork: (request: string) => Promise<unknown> | void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CoworkFloatingWidget: React.FC<CoworkFloatingWidgetProps> = ({ onAskCowork }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const submit = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const entry: HistoryEntry = { request: text, timestamp: Date.now(), status: 'pending' };
    setHistory((prev) => [...prev.slice(-9), entry]);
    setInput('');
    setIsSending(true);

    try {
      await onAskCowork(text);
      setHistory((prev) =>
        prev.map((h) => (h === entry ? { ...h, status: 'sent' as const } : h)),
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 380, damping: 26 }}
            className="flex w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgb(var(--app-bg-rgb))]/95 shadow-2xl shadow-black/40 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-indigo-300" />
                <span className="text-xs font-medium uppercase tracking-[0.16em] text-white/60">
                  Modifier l'app
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/[0.08] hover:text-white/70"
              >
                <X size={13} />
              </button>
            </div>

            {/* History */}
            <div ref={scrollRef} className="max-h-52 min-h-[3rem] flex-1 overflow-y-auto px-4 py-3">
              {history.length === 0 ? (
                <p className="text-center text-xs leading-5 text-white/35">
                  Dites ce que vous voulez changer et l'IA modifiera l'interface en temps reel.
                </p>
              ) : (
                <div className="space-y-2">
                  {history.map((entry, i) => (
                    <div
                      key={`${entry.timestamp}-${i}`}
                      className="flex items-start gap-2 rounded-lg bg-white/[0.04] px-3 py-2 text-xs leading-5 text-white/65"
                    >
                      <span className="mt-0.5 shrink-0">
                        {entry.status === 'pending' ? (
                          <Loader2 size={11} className="animate-spin text-indigo-300/60" />
                        ) : (
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400/50" />
                        )}
                      </span>
                      <span>{entry.request}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-white/8 px-3 py-3">
              <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 transition-colors focus-within:border-indigo-300/20">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ajoute un selecteur de theme..."
                  disabled={isSending}
                  className="min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/25 disabled:opacity-40"
                />
                <button
                  type="button"
                  onClick={() => void submit()}
                  disabled={!input.trim() || isSending}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-white/40 transition-colors hover:bg-white/[0.12] hover:text-white disabled:opacity-20"
                >
                  <Send size={12} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating button */}
      <motion.button
        type="button"
        onClick={() => {
          setIsOpen((prev) => !prev);
          if (!isOpen) setTimeout(() => inputRef.current?.focus(), 120);
        }}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.94 }}
        className="relative flex h-12 w-12 items-center justify-center rounded-full border border-indigo-300/20 bg-indigo-500/20 text-indigo-200 shadow-lg shadow-indigo-500/10 backdrop-blur-sm transition-colors hover:bg-indigo-500/30"
      >
        <div className="absolute inset-0 rounded-full bg-indigo-400/10 blur-md" />
        <Sparkles size={18} className="relative" />
      </motion.button>
    </div>
  );
};
