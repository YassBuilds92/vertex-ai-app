import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
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

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

function getHubPageSize(width: number) {
  if (width >= 1280) return 6;
  if (width >= 1024) return 5;
  if (width >= 640) return 4;
  return 3;
}

function getHubPageColumns(pageSize: number) {
  if (pageSize >= 6) return 'grid-cols-6';
  if (pageSize === 5) return 'grid-cols-5';
  if (pageSize === 4) return 'grid-cols-4';
  return 'grid-cols-3';
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
  const [page, setPage] = useState(0);
  const [viewport, setViewport] = useState(getViewportSize);

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

  useEffect(() => {
    const syncViewport = () => setViewport(getViewportSize());
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const pageSize = useMemo(() => getHubPageSize(viewport.width), [viewport.width]);
  const totalPages = Math.max(1, Math.ceil(Math.max(agents.length, 1) / pageSize));

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedId) || agents[0] || null,
    [agents, selectedId]
  );
  const selectedIndex = selectedAgent ? agents.findIndex((agent) => agent.id === selectedAgent.id) : -1;

  useEffect(() => {
    if (selectedIndex < 0) {
      setPage(0);
      return;
    }

    const nextPage = Math.floor(selectedIndex / pageSize);
    setPage((currentPage) => (currentPage === nextPage ? currentPage : nextPage));
  }, [pageSize, selectedIndex]);

  useEffect(() => {
    setPage((currentPage) => Math.min(currentPage, totalPages - 1));
  }, [totalPages]);

  const pageAgents = useMemo(() => {
    const start = page * pageSize;
    return agents.slice(start, start + pageSize);
  }, [agents, page, pageSize]);

  const selectedMeta = selectedAgent ? getAgentAppMeta(selectedAgent) : null;
  const selectedPalette = selectedAgent ? getAgentPalette(selectedAgent) : null;
  const SelectedIcon = selectedMeta?.icon || LayoutTemplate;
  const isCompactHeight = viewport.height < 920;
  const isTightHeight = viewport.height < 820;
  const pageColumnsClass = getHubPageColumns(pageSize);

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
          className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-1 overflow-hidden bg-[#05070b] text-white"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(99,210,255,0.14),transparent_34%),radial-gradient(circle_at_85%_18%,rgba(255,206,107,0.12),transparent_22%),radial-gradient(circle_at_20%_80%,rgba(115,139,255,0.1),transparent_28%)]" />
            <div className="absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent)]" />
            <div className="absolute left-1/2 top-[22%] h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.03),transparent_66%)] blur-3xl" />
          </div>

          <div className="relative flex min-h-0 flex-1 flex-col">
            <header className={cn('flex items-center justify-between px-5 sm:px-8', isCompactHeight ? 'py-4' : 'py-5')}>
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

            <main className={cn('flex min-h-0 flex-1 flex-col px-5 sm:px-8', isCompactHeight ? 'pb-4' : 'pb-7')}>
              <div className={cn('mx-auto grid h-full w-full max-w-7xl min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]', isCompactHeight ? 'gap-4' : 'gap-6')}>
                <div className={cn('mx-auto flex w-full max-w-4xl flex-col items-center text-center', isCompactHeight ? 'gap-3 pt-1' : 'gap-4 pt-3')}>
                  <div className="text-[11px] uppercase tracking-[0.32em] text-white/30">Une autre app dans l'app</div>
                  <h1
                    className={cn(
                      'mx-auto max-w-[11ch] text-balance font-semibold leading-[0.9] tracking-[-0.07em] text-white sm:max-w-[12ch]',
                      isTightHeight
                        ? 'text-[clamp(1.7rem,5.2vw,3.1rem)]'
                        : 'text-[clamp(2.25rem,7vw,4.6rem)]'
                    )}
                  >
                    Ouvre une app Cowork, ou invente la suivante.
                  </h1>
                  <p
                    className={cn(
                      'mx-auto max-w-[40rem] text-white/48',
                      isCompactHeight ? 'text-[12px] leading-5' : 'text-sm leading-7 sm:text-[15px]'
                    )}
                  >
                    Tout tient dans l'ecran: une app mise en avant, un dock pagine pour les autres, et une seule barre pour en creer une nouvelle.
                  </p>
                </div>

                <div className="flex min-h-0 items-center justify-center">
                  {selectedAgent ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={selectedAgent.id}
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="flex w-full max-w-4xl flex-col items-center text-center"
                      >
                        <div
                          className={cn(
                            'relative flex items-center justify-center rounded-[2rem] border',
                            isCompactHeight ? 'h-20 w-20' : 'h-28 w-28'
                          )}
                          style={{
                            borderColor: selectedPalette?.rim,
                            background: selectedPalette?.frame.background,
                            boxShadow: selectedPalette?.frame.boxShadow,
                          }}
                        >
                          <div
                            className={cn(
                              'absolute rounded-[1.45rem] border',
                              isCompactHeight ? 'inset-[9px]' : 'inset-[10px]'
                            )}
                            style={{
                              borderColor: selectedPalette?.rim,
                              background: selectedPalette?.accentSoft,
                            }}
                          />
                          <SelectedIcon
                            size={isCompactHeight ? 24 : 34}
                            className="relative z-10"
                            style={{ color: selectedPalette?.accent }}
                          />
                        </div>

                        <div className={cn('uppercase tracking-[0.28em] text-white/34', isCompactHeight ? 'mt-3 text-[10px]' : 'mt-5 text-[11px]')}>
                          {selectedMeta?.label}
                        </div>
                        <div
                          className={cn(
                            'mt-3 max-w-[14ch] text-balance font-semibold tracking-[-0.05em] text-white',
                            isCompactHeight ? 'text-[clamp(1.5rem,4vw,2.5rem)]' : 'text-[clamp(2.15rem,4.9vw,3.8rem)]'
                          )}
                        >
                          {selectedAgent.name}
                        </div>
                        <div
                          className={cn(
                            'mt-3 max-w-2xl text-pretty text-white/54',
                            isCompactHeight ? 'hidden' : 'line-clamp-2 text-[15px] leading-7'
                          )}
                        >
                          {selectedAgent.tagline}
                        </div>
                        <div className={cn('mt-4 text-[11px] uppercase tracking-[0.22em] text-white/26', isCompactHeight && 'mt-3')}>
                          {agents.length} app{agents.length > 1 ? 's' : ''} dans le lobby
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <div className="text-center text-white/42">
                      Aucune app pour le moment. Cree la premiere juste en bas.
                    </div>
                  )}
                </div>

                <div
                  className={cn(
                    'grid w-full pb-1 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.42fr)] lg:items-end',
                    isCompactHeight ? 'gap-3' : 'gap-4'
                  )}
                >
                  <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.018))] px-4 py-4 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.75)] backdrop-blur-xl sm:px-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/30">Apps disponibles</div>
                        <div className="mt-1 text-sm text-white/58">
                          {agents.length === 0 ? 'Le store attend sa premiere app.' : `Page ${page + 1} / ${totalPages}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {selectedAgent && (
                          <button
                            onClick={handleLaunch}
                            disabled={isRunningAgent}
                            className={cn(
                              'inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold transition-all',
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
                                <span className="hidden sm:inline">{selectedMeta?.actionLabel || "Ouvrir l'app"}</span>
                                <span className="sm:hidden">Ouvrir</span>
                                <ArrowRight size={15} />
                              </>
                            )}
                          </button>
                        )}

                        {totalPages > 1 && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))}
                            disabled={page === 0}
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full border transition-all',
                              page === 0
                                ? 'cursor-not-allowed border-white/8 bg-white/[0.02] text-white/24'
                                : 'border-white/10 bg-white/[0.04] text-white/72 hover:border-white/18 hover:text-white'
                            )}
                            title="Page precedente"
                          >
                            <ChevronLeft size={17} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1))}
                            disabled={page >= totalPages - 1}
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-full border transition-all',
                              page >= totalPages - 1
                                ? 'cursor-not-allowed border-white/8 bg-white/[0.02] text-white/24'
                                : 'border-white/10 bg-white/[0.04] text-white/72 hover:border-white/18 hover:text-white'
                            )}
                            title="Page suivante"
                          >
                            <ChevronRight size={17} />
                          </button>
                        </div>
                        )}
                      </div>
                    </div>

                    {agents.length === 0 ? (
                      <div className="mt-4 text-sm leading-7 text-white/38">
                        Decris une app a Cowork dans la barre de creation et elle apparaitra ici.
                      </div>
                    ) : (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${page}-${pageSize}`}
                          initial={{ opacity: 0, x: 14 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -14 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className={cn('mt-4 grid items-start justify-items-center gap-3 sm:gap-4', pageColumnsClass)}
                        >
                          {pageAgents.map((agent) => {
                            const meta = getAgentAppMeta(agent);
                            const palette = getAgentPalette(agent);
                            const Icon = meta.icon;
                            const isSelected = selectedAgent?.id === agent.id;

                            return (
                              <button
                                key={agent.id}
                                onClick={() => setSelectedId(agent.id)}
                                className="group flex min-w-0 w-full max-w-[124px] flex-col items-center gap-2 text-center sm:max-w-[132px]"
                              >
                                <div
                                  className={cn(
                                    'relative flex items-center justify-center rounded-[1.45rem] border transition-all duration-300',
                                    isCompactHeight ? 'h-14 w-14' : 'h-16 w-16',
                                    isSelected ? 'scale-105' : 'opacity-72 group-hover:opacity-100'
                                  )}
                                  style={{
                                    borderColor: palette.rim,
                                    background: palette.frame.background,
                                    boxShadow: isSelected ? palette.frame.boxShadow : 'none',
                                  }}
                                >
                                  <div
                                    className="absolute inset-[7px] rounded-[1rem] border transition-all duration-300"
                                    style={{
                                      borderColor: palette.rim,
                                      background: palette.accentSoft,
                                    }}
                                  />
                                  <Icon
                                    size={isCompactHeight ? 19 : 21}
                                    className="relative z-10 transition-transform duration-300 group-hover:scale-105"
                                    style={{ color: palette.accent }}
                                  />
                                </div>

                                <div className="min-w-0 space-y-1">
                                  <div
                                    className={cn(
                                      'truncate text-sm font-medium tracking-tight transition-colors',
                                      isSelected ? 'text-white' : 'text-white/74 group-hover:text-white'
                                    )}
                                  >
                                    {agent.name}
                                  </div>
                                  <div className="truncate text-[10px] uppercase tracking-[0.22em] text-white/26">
                                    {meta.category}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>

                  <div className="w-full lg:max-w-none">
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
                      className="h-full rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-3 shadow-[0_30px_90px_-50px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                    >
                      <div className="flex h-full flex-col gap-3">
                        <div className="flex items-center gap-3 px-2 pt-1">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] text-cyan-200">
                            <Wand2 size={16} />
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.24em] text-white/30">
                              Creer une app
                            </div>
                            <div className="mt-1 text-sm text-white/50">
                              Decris la prochaine app a ajouter au lobby.
                            </div>
                          </div>
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
                          className={cn(
                            'w-full resize-none rounded-[1.5rem] border border-white/8 bg-black/20 px-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/30',
                            isCompactHeight ? 'min-h-[58px] py-3.5' : 'min-h-[64px] py-4'
                          )}
                        />

                        <button
                          type="submit"
                          disabled={isCreating || !brief.trim()}
                          className={cn(
                            'mt-auto flex h-12 w-full shrink-0 items-center justify-center rounded-[1.4rem] px-5 text-sm font-semibold transition-all',
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
                              <span className="ml-2">Creer</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
