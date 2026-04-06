import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Send,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import type {
  GeneratedAppCreationRun,
  GeneratedAppCreationTranscriptTurn,
  StudioAgent,
} from '../types';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface CoworkCreationChatProps {
  isCreating: boolean;
  creationRun?: GeneratedAppCreationRun | null;
  latestCreatedAgent?: StudioAgent | null;
  isRunningAgent: boolean;
  onCreateAgent: (
    payload: { brief?: string; transcript?: GeneratedAppCreationTranscriptTurn[] },
  ) => Promise<{ status: 'clarification_requested' | 'completed'; manifest?: unknown } | null> | void;
  onLaunchApp: (agent: StudioAgent) => void;
}

/* ------------------------------------------------------------------ */
/*  Starter ideas                                                      */
/* ------------------------------------------------------------------ */

const STARTER_IDEAS = [
  'Un generateur de spritesheet avec preview en grille et animation live',
  'Un studio ou deux IA debattent puis sortent un podcast avec musique',
  'Un generateur de cartes Pokemon avec choix du modele et preview',
  'Une app qui transforme un dossier en mini-site premium',
  'Un outil de recherche multi-sources qui livre une note de decision',
];

/* ------------------------------------------------------------------ */
/*  Phase label helper                                                 */
/* ------------------------------------------------------------------ */

function phaseLabel(phase: string): string {
  const map: Record<string, string> = {
    brief_validated: 'Brief valide',
    clarification_requested: 'Clarification demandee',
    clarification_resolved: 'Clarification resolue',
    spec_ready: 'Specification prete',
    source_ready: 'Code source genere',
    bundle_ready: 'Bundle pret',
    bundle_skipped: 'Bundle ignore',
    bundle_failed: 'Erreur de bundle',
    manifest_ready: 'App prete',
  };
  return map[phase] || phase.replace(/_/g, ' ');
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const CoworkCreationChat: React.FC<CoworkCreationChatProps> = ({
  isCreating,
  creationRun,
  latestCreatedAgent,
  isRunningAgent,
  onCreateAgent,
  onLaunchApp,
}) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);

  const transcript = creationRun?.transcript || [];
  const isAwaiting = Boolean(creationRun?.awaitingClarification);
  const isCompleted = creationRun?.status === 'completed';
  const isFailed = creationRun?.status === 'failed';
  const recentPhases = creationRun?.phases.slice(-4) || [];

  /* Auto-scroll ---------------------------------------------------- */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [transcript.length, recentPhases.length, isAwaiting, isCompleted]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  };

  /* Submit ---------------------------------------------------------- */
  const submit = async () => {
    const text = input.trim();
    if (!text || isCreating) return;

    setInput('');

    if (isAwaiting && transcript.length > 0) {
      await onCreateAgent({
        transcript: [...transcript, { role: 'user', content: text, kind: 'answer' }],
      });
    } else {
      await onCreateAgent({ brief: text });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  /* Empty state ----------------------------------------------------- */
  const isEmpty = transcript.length === 0 && !creationRun;

  return (
    <div className="flex h-full flex-col">
      {/* Chat messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6"
      >
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center">
            <div className="relative mb-8">
              <div className="absolute -inset-6 rounded-full bg-indigo-400/10 blur-2xl" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Sparkles size={32} className="text-indigo-300" />
              </div>
            </div>
            <h2 className="text-center text-2xl font-semibold tracking-tight text-white">
              Decrivez votre app
            </h2>
            <p className="mt-3 max-w-md text-center text-sm leading-6 text-white/50">
              Cowork va vous poser les bonnes questions pour comprendre exactement ce que vous voulez, puis generera une interface sur mesure.
            </p>
            <div className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
              {STARTER_IDEAS.map((idea) => (
                <button
                  key={idea}
                  type="button"
                  onClick={() => setInput(idea)}
                  className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2.5 text-[13px] leading-5 text-white/55 transition-all hover:border-white/14 hover:bg-white/[0.06] hover:text-white/75"
                >
                  {idea}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl space-y-4">
            {/* Transcript bubbles */}
            {transcript.map((turn, i) => (
              <motion.div
                key={`${turn.role}-${i}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-6 ${
                    turn.role === 'user'
                      ? 'bg-white/[0.08] text-white/85'
                      : 'border border-indigo-300/12 bg-indigo-400/[0.06] text-white/80'
                  }`}
                >
                  {turn.role === 'assistant' && (
                    <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-300/70">
                      Cowork
                    </div>
                  )}
                  <div className="whitespace-pre-wrap">{turn.content}</div>
                </div>
              </motion.div>
            ))}

            {/* Awaiting clarification question */}
            {isAwaiting && creationRun?.clarificationQuestion && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-start"
              >
                <div className="max-w-[85%] rounded-2xl border border-indigo-300/12 bg-indigo-400/[0.06] px-4 py-3 text-sm leading-6 text-white/80">
                  <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-indigo-300/70">
                    Cowork
                  </div>
                  <div className="whitespace-pre-wrap">{creationRun.clarificationQuestion}</div>
                </div>
              </motion.div>
            )}

            {/* Phase progress inline */}
            {recentPhases.length > 0 && !isAwaiting && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-center"
              >
                <div className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    {recentPhases.map((phase, idx) => {
                      const isLast = idx === recentPhases.length - 1;
                      const failed = phase.phase === 'bundle_failed';
                      return (
                        <div key={`${phase.phase}-${idx}`} className="flex items-center gap-2">
                          {idx > 0 && <div className="h-px w-4 bg-white/10" />}
                          <div className="flex items-center gap-1.5">
                            {failed ? (
                              <AlertTriangle size={12} className="text-rose-300" />
                            ) : isLast && creationRun?.status === 'running' ? (
                              <Loader2 size={12} className="animate-spin text-indigo-300" />
                            ) : (
                              <CheckCircle2 size={12} className="text-emerald-300/70" />
                            )}
                            <span className="text-[11px] text-white/50">{phase.label || phaseLabel(phase.phase)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Typing indicator */}
            {isCreating && !isAwaiting && !isCompleted && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-start"
              >
                <div className="flex items-center gap-1.5 rounded-2xl border border-indigo-300/10 bg-indigo-400/[0.04] px-4 py-3">
                  <div className="flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <motion.div
                        key={d}
                        className="h-1.5 w-1.5 rounded-full bg-indigo-300/50"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: d * 0.2 }}
                      />
                    ))}
                  </div>
                  <span className="ml-2 text-xs text-white/40">Cowork reflechit...</span>
                </div>
              </motion.div>
            )}

            {/* Completion card */}
            {isCompleted && latestCreatedAgent && (
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="flex justify-center"
              >
                <div className="w-full max-w-sm rounded-2xl border border-emerald-300/14 bg-emerald-400/[0.05] p-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-300/16 bg-emerald-400/[0.08]">
                    <CheckCircle2 size={22} className="text-emerald-300" />
                  </div>
                  <h3 className="mt-3 text-lg font-semibold text-white">{latestCreatedAgent.name}</h3>
                  <p className="mt-1.5 text-sm text-white/50">{latestCreatedAgent.tagline || latestCreatedAgent.summary}</p>
                  <button
                    type="button"
                    onClick={() => onLaunchApp(latestCreatedAgent)}
                    disabled={isRunningAgent}
                    className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-white/90 to-white/75 px-6 text-sm font-semibold text-[#0a0f1a] transition-all hover:-translate-y-px hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isRunningAgent ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                    Ouvrir l'app
                  </button>
                </div>
              </motion.div>
            )}

            {/* Error */}
            {isFailed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex justify-center"
              >
                <div className="rounded-xl border border-rose-300/14 bg-rose-400/[0.05] px-4 py-3 text-sm text-rose-100/80">
                  <AlertTriangle size={14} className="mb-1 inline text-rose-300" />{' '}
                  {creationRun?.error || "La generation a echoue. Reessayez avec une description differente."}
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="border-t border-white/6 bg-black/20 px-6 pb-5 pt-4">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 transition-colors focus-within:border-indigo-300/25 focus-within:bg-white/[0.06]">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isAwaiting
                  ? 'Repondez a Cowork...'
                  : isCompleted
                    ? 'Decrivez une nouvelle app...'
                    : 'Decrivez l\'app que vous voulez creer...'
              }
              disabled={isCreating && !isAwaiting}
              className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/28 disabled:cursor-not-allowed disabled:opacity-40"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!input.trim() || (isCreating && !isAwaiting)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-white/50 transition-all hover:bg-white/[0.14] hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
