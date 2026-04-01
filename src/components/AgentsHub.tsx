import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  LayoutTemplate,
  Loader2,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { StudioAgent } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  createInitialFieldValues,
  getAgentAppMeta,
  getAgentPalette,
  getRenderableFields,
} from './AgentAppPreview';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AgentsHubProps {
  isOpen: boolean;
  agents: StudioAgent[];
  isCreating: boolean;
  isRunningAgent: boolean;
  latestCreatedAgent?: StudioAgent | null;
  warningMessage?: string | null;
  onClose: () => void;
  onCreateAgent: (brief: string) => Promise<unknown> | void;
  onRunAgent: (agent: StudioAgent, values: Record<string, string | boolean>) => Promise<unknown> | void;
}

export const AgentsHub: React.FC<AgentsHubProps> = ({
  isOpen,
  agents,
  isCreating,
  isRunningAgent,
  latestCreatedAgent,
  warningMessage,
  onClose,
  onCreateAgent,
  onRunAgent,
}) => {
  const [brief, setBrief] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (latestCreatedAgent?.id) {
      setSelectedId(latestCreatedAgent.id);
    }
  }, [latestCreatedAgent]);

  useEffect(() => {
    if (!selectedId && agents[0]?.id) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId) || agents[0] || null,
    [agents, selectedId]
  );

  const selectedMeta = selectedAgent ? getAgentAppMeta(selectedAgent) : null;
  const selectedPalette = selectedAgent ? getAgentPalette(selectedAgent) : null;
  const SelectedIcon = selectedMeta?.icon || LayoutTemplate;

  const submit = async () => {
    const cleaned = brief.trim();
    if (!cleaned || isCreating) return;
    await onCreateAgent(cleaned);
    setBrief('');
  };

  const handleLaunch = async () => {
    if (!selectedAgent || isRunningAgent) return;
    const initialValues = createInitialFieldValues(getRenderableFields(selectedAgent));
    await onRunAgent(selectedAgent, initialValues);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.section
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="relative flex min-h-[100dvh] w-full flex-1 overflow-hidden bg-[#05070b] text-white"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,210,255,0.14),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(255,206,107,0.12),transparent_22%),radial-gradient(circle_at_20%_80%,rgba(115,139,255,0.1),transparent_28%)]" />
            <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
            <div className="absolute left-1/2 top-[22%] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.03),transparent_66%)] blur-3xl" />
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <header className="flex items-center justify-between px-5 py-5 sm:px-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.04]">
                  <LayoutTemplate size={18} className="text-cyan-200" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/36">Cowork Apps</div>
                  <div className="text-sm font-medium text-white/86">Lobby creatif des apps Cowork</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {warningMessage && (
                  <div className="hidden items-center gap-2 rounded-full border border-amber-300/16 bg-amber-300/[0.08] px-3 py-2 text-xs text-amber-50/88 md:inline-flex">
                    <AlertTriangle size={14} className="text-amber-200" />
                    Store local
                  </div>
                )}
                <button
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-[1.35rem] border border-white/10 bg-white/[0.03] text-white/58 transition-colors hover:text-white"
                  title="Fermer Cowork Apps"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <main className="flex min-h-0 flex-1 flex-col px-5 pb-5 sm:px-8 sm:pb-7">
              <div className="mx-auto flex min-h-0 w-full max-w-7xl flex-1 flex-col">
                <div className="flex flex-1 flex-col items-center justify-center gap-10 py-4 sm:gap-12 sm:py-6">
                  <div className="mx-auto max-w-4xl text-center">
                    <div className="text-[11px] uppercase tracking-[0.32em] text-white/30">Une autre app dans l'app</div>
                    <h1 className="mx-auto mt-4 max-w-[8.5ch] text-balance text-[clamp(2.35rem,8.8vw,5.2rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-white sm:max-w-3xl">
                      Entre dans une app Cowork, ou decris celle que tu veux faire naitre.
                    </h1>
                    <p className="mx-auto mt-5 max-w-[34rem] text-sm leading-7 text-white/48 sm:text-[15px]">
                      Ici le shell disparait. Il reste juste les apps, leurs noms, et une barre de creation pour en fabriquer une nouvelle.
                    </p>
                  </div>

                  {selectedAgent ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedAgent.id}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="flex flex-col items-center text-center"
                      >
                        <div
                          className="relative flex h-28 w-28 items-center justify-center rounded-[2rem] border"
                          style={{
                            borderColor: selectedPalette?.rim,
                            background: selectedPalette?.frame.background,
                            boxShadow: selectedPalette?.frame.boxShadow,
                          }}
                        >
                          <div
                            className="absolute inset-[10px] rounded-[1.5rem] border"
                            style={{
                              borderColor: selectedPalette?.rim,
                              background: selectedPalette?.accentSoft,
                            }}
                          />
                          <SelectedIcon size={34} className="relative z-10" style={{ color: selectedPalette?.accent }} />
                        </div>

                        <div className="mt-5 text-[11px] uppercase tracking-[0.28em] text-white/34">
                          {selectedMeta?.label}
                        </div>
                        <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
                          {selectedAgent.name}
                        </div>
                        <div className="mt-3 max-w-2xl text-sm leading-7 text-white/54 sm:text-[15px]">
                          {selectedAgent.tagline}
                        </div>

                        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row">
                          <button
                            onClick={handleLaunch}
                            disabled={isRunningAgent}
                            className={cn(
                              'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all',
                              isRunningAgent
                                ? 'cursor-not-allowed bg-white/8 text-white/35'
                                : 'bg-white text-black hover:-translate-y-[1px]'
                            )}
                          >
                            {isRunningAgent ? (
                              <>
                                <Loader2 size={15} className="animate-spin" />
                                Ouverture...
                              </>
                            ) : (
                              <>
                                {selectedMeta?.actionLabel || "Ouvrir l'app"}
                                <ArrowRight size={15} />
                              </>
                            )}
                          </button>
                          <div className="text-xs uppercase tracking-[0.22em] text-white/28">
                            {agents.length} app{agents.length > 1 ? 's' : ''} dans le lobby
                          </div>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <div className="text-center text-white/42">
                      Aucune app pour le moment. Cree la premiere juste en bas.
                    </div>
                  )}

                  <div className="w-full">
                    {agents.length === 0 ? (
                      <div className="mx-auto max-w-xl text-center text-sm leading-7 text-white/38">
                        Le lobby est vide pour l'instant. Decris une app a Cowork dans la barre de creation et elle apparaitra ici.
                      </div>
                    ) : (
                      <div className="mx-auto grid w-full max-w-5xl grid-cols-3 justify-items-center gap-x-3 gap-y-7 sm:grid-cols-4 sm:gap-x-8 sm:gap-y-10 lg:grid-cols-5 xl:grid-cols-6">
                        {agents.map((agent) => {
                          const meta = getAgentAppMeta(agent);
                          const palette = getAgentPalette(agent);
                          const Icon = meta.icon;
                          const isSelected = selectedAgent?.id === agent.id;

                          return (
                            <button
                              key={agent.id}
                              onClick={() => setSelectedId(agent.id)}
                              className="group flex w-[96px] flex-col items-center gap-3 text-center sm:w-[142px] sm:gap-4"
                            >
                              <div
                                className={cn(
                                  'relative flex h-16 w-16 items-center justify-center rounded-[1.35rem] border transition-all duration-300 sm:h-24 sm:w-24 sm:rounded-[1.7rem]',
                                  isSelected ? 'scale-105' : 'opacity-72 group-hover:opacity-100'
                                )}
                                style={{
                                  borderColor: palette.rim,
                                  background: palette.frame.background,
                                  boxShadow: isSelected ? palette.frame.boxShadow : 'none',
                                }}
                              >
                                <div
                                  className="absolute inset-[7px] rounded-[1rem] border transition-all duration-300 sm:inset-[9px] sm:rounded-[1.25rem]"
                                  style={{
                                    borderColor: palette.rim,
                                    background: palette.accentSoft,
                                  }}
                                />
                                <Icon
                                  size={22}
                                  className="relative z-10 transition-transform duration-300 group-hover:scale-105"
                                  style={{ color: palette.accent }}
                                />
                              </div>

                              <div className="space-y-1">
                                <div
                                  className={cn(
                                    'text-sm font-medium tracking-tight transition-colors',
                                    isSelected ? 'text-white' : 'text-white/74 group-hover:text-white'
                                  )}
                                >
                                  {agent.name}
                                </div>
                                <div className="text-[10px] uppercase tracking-[0.22em] text-white/26">
                                  {meta.category}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="mx-auto w-full max-w-4xl pb-1 pt-4">
                  {warningMessage && (
                    <div className="mb-4 flex items-start gap-3 rounded-[1.5rem] border border-amber-300/12 bg-amber-300/[0.06] px-4 py-3 text-sm leading-6 text-amber-50/86 md:hidden">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-200" />
                      <span>{warningMessage}</span>
                    </div>
                  )}

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit();
                    }}
                    className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04] text-cyan-200 sm:flex">
                        <Wand2 size={18} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="px-2 pb-2 text-[11px] uppercase tracking-[0.24em] text-white/30">
                          Creer une app
                        </div>
                        <textarea
                          value={brief}
                          onChange={(event) => setBrief(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && !event.shiftKey) {
                              event.preventDefault();
                              void submit();
                            }
                          }}
                          rows={1}
                          placeholder="Decris l'app que Cowork doit construire..."
                          className="min-h-[64px] w-full resize-none rounded-[1.5rem] border border-white/8 bg-black/20 px-4 py-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/30"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isCreating || !brief.trim()}
                        className={cn(
                          'flex h-12 w-full shrink-0 items-center justify-center rounded-[1.4rem] px-5 text-sm font-semibold transition-all sm:h-14 sm:w-auto',
                          isCreating || !brief.trim()
                            ? 'cursor-not-allowed bg-white/8 text-white/35'
                            : 'bg-white text-black hover:-translate-y-[1px]'
                        )}
                      >
                        {isCreating ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} />
                            <span className="ml-2 hidden sm:inline">Creer</span>
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </main>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
