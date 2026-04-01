import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronLeft,
  ChevronRight,
  Cog,
  LayoutTemplate,
  Loader2,
  Search,
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
  if (width >= 1280) return 4;
  if (width >= 920) return 3;
  return 2;
}

function getHubPageColumns(pageSize: number) {
  if (pageSize >= 4) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-4';
  if (pageSize === 3) return 'grid-cols-1 md:grid-cols-3';
  return 'grid-cols-1 sm:grid-cols-2';
}

function formatProjectAge(timestamp?: number) {
  if (!timestamp) return 'recent';

  const delta = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < hour) {
    return `mis a jour il y a ${Math.max(1, Math.round(delta / minute))} min`;
  }

  if (delta < day) {
    return `mis a jour il y a ${Math.max(1, Math.round(delta / hour))} h`;
  }

  return `mis a jour il y a ${Math.max(1, Math.round(delta / day))} j`;
}

function getAgentQuickActionLabel(agent: Pick<StudioAgent, 'outputKind'>) {
  return getAgentAppMeta(agent).actionLabel;
}

const CREATION_TYPES = ['Podcast', 'Musique', 'Creature', 'Carte', 'Analyse', 'Autre'];

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
  const [creationNotes, setCreationNotes] = useState('');
  const [creationType, setCreationType] = useState(CREATION_TYPES[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [viewport, setViewport] = useState(getViewportSize);

  useEffect(() => {
    if (latestCreatedAgent?.id) {
      setSelectedId(latestCreatedAgent.id);
    }
  }, [latestCreatedAgent]);

  useEffect(() => {
    const syncViewport = () => setViewport(getViewportSize());
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return agents;

    return agents.filter((agent) => {
      const meta = getAgentAppMeta(agent);
      const haystack = [
        agent.name,
        agent.tagline,
        agent.summary,
        meta.label,
        meta.category,
        meta.spotlight,
        agent.outputKind,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [agents, searchQuery]);

  useEffect(() => {
    if (!filteredAgents.length) {
      setSelectedId(null);
      return;
    }

    if (!selectedId || !filteredAgents.some((agent) => agent.id === selectedId)) {
      setSelectedId(filteredAgents[0].id);
    }
  }, [filteredAgents, selectedId]);

  const pageSize = useMemo(() => getHubPageSize(viewport.width), [viewport.width]);
  const totalPages = Math.max(1, Math.ceil(Math.max(filteredAgents.length, 1) / pageSize));

  const selectedAgent = useMemo(
    () => filteredAgents.find((agent) => agent.id === selectedId) || filteredAgents[0] || null,
    [filteredAgents, selectedId]
  );
  const selectedIndex = selectedAgent
    ? filteredAgents.findIndex((agent) => agent.id === selectedAgent.id)
    : -1;

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
    return filteredAgents.slice(start, start + pageSize);
  }, [filteredAgents, page, pageSize]);

  const isDesktopScene = viewport.width >= 1280;

  const recentAgents = useMemo(() => {
    const source = filteredAgents.length > 0 ? filteredAgents : agents;
    const withoutSelected = selectedAgent
      ? source.filter((agent) => agent.id !== selectedAgent.id)
      : source;

    return (withoutSelected.length > 0 ? withoutSelected : source).slice(0, isDesktopScene ? 2 : 3);
  }, [agents, filteredAgents, isDesktopScene, selectedAgent]);

  const selectedMeta = selectedAgent ? getAgentAppMeta(selectedAgent) : null;
  const selectedPalette = selectedAgent ? getAgentPalette(selectedAgent) : null;
  const SelectedIcon = selectedMeta?.icon || LayoutTemplate;
  const pageColumnsClass = getHubPageColumns(pageSize);
  const hasSearchResults = filteredAgents.length > 0;

  const submit = async () => {
    const cleanedBrief = brief.trim();
    const cleanedNotes = creationNotes.trim();
    if (!cleanedBrief || isCreating) return;

    const assembledPrompt = [
      `Type d'application cible: ${creationType}`,
      cleanedBrief,
      cleanedNotes ? `Structure, fonctionnalites ou design:\n${cleanedNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    await onCreateAgent(assembledPrompt);
    setBrief('');
    setCreationNotes('');
  };

  const launchAgent = async (agent: StudioAgent) => {
    if (isRunningAgent) return;
    const initialValues = createInitialFieldValues(getRenderableFields(agent));
    await onRunAgent(agent, initialValues);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.section
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-1 overflow-hidden bg-[#04070d] text-white"
        >
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(101,199,255,0.12),transparent_28%),radial-gradient(circle_at_88%_14%,rgba(255,193,116,0.08),transparent_18%),radial-gradient(circle_at_10%_82%,rgba(95,121,255,0.1),transparent_24%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),transparent_20%,transparent_80%,rgba(255,255,255,0.02))]" />
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-[linear-gradient(180deg,transparent,rgba(140,214,255,0.18),transparent)] opacity-60" />
            <div className="absolute left-1/2 top-[18%] h-[30rem] w-[42rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(118,205,255,0.08),transparent_64%)] blur-3xl" />
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <header className="border-b border-white/8 px-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-[1520px] flex-col gap-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/[0.04]">
                      <LayoutTemplate size={18} className="text-cyan-200" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.24em] text-white/36">Cowork</div>
                      <div className="text-base font-semibold tracking-tight text-white/92">Mon studio d'apps</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 lg:hidden">
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.03] text-white/58 transition-colors hover:text-white"
                      title="Parametres"
                    >
                      <Cog size={16} />
                    </button>
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.03] text-white/58 transition-colors hover:text-white"
                      title="Notifications"
                    >
                      <Bell size={16} />
                    </button>
                    <button
                      onClick={onClose}
                      className="flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.03] text-white/58 transition-colors hover:text-white"
                      title="Fermer Cowork Apps"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div className="flex flex-1 items-center gap-3 lg:justify-end">
                  <label className="relative flex h-12 flex-1 items-center overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 text-sm text-white/72 shadow-[0_18px_60px_-40px_rgba(0,0,0,0.8)] sm:max-w-[540px]">
                    <Search size={16} className="mr-3 shrink-0 text-white/38" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Rechercher des outils, des idees..."
                      className="w-full bg-transparent text-white outline-none placeholder:text-white/28"
                    />
                  </label>

                  <div className="hidden items-center gap-2 lg:flex">
                    {warningMessage && (
                      <div className="inline-flex h-11 items-center gap-2 rounded-full border border-amber-300/16 bg-amber-300/[0.08] px-3.5 text-xs text-amber-50/88">
                        <AlertTriangle size={14} className="text-amber-200" />
                        Store local
                      </div>
                    )}
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.03] text-white/58 transition-colors hover:text-white"
                      title="Parametres"
                    >
                      <Cog size={16} />
                    </button>
                    <button
                      type="button"
                      className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.03] text-white/58 transition-colors hover:text-white"
                      title="Notifications"
                    >
                      <Bell size={16} />
                    </button>
                    <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/[0.05] text-sm font-semibold text-white">
                      {selectedAgent?.name?.charAt(0) || 'C'}
                    </div>
                    <button
                      onClick={onClose}
                      className="flex h-11 w-11 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.03] text-white/58 transition-colors hover:text-white"
                      title="Fermer Cowork Apps"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </header>

            <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8 lg:py-5 xl:overflow-hidden">
              <div className="mx-auto grid min-h-full max-w-[1520px] gap-4 xl:h-full xl:grid-cols-[minmax(0,1fr)_336px]">
                <section className="grid min-h-0 gap-4 xl:grid-rows-[minmax(0,1fr)_auto]">
                  <div className="relative overflow-hidden rounded-[2.1rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.035),rgba(255,255,255,0.015))] px-5 py-5 shadow-[0_34px_110px_-58px_rgba(0,0,0,0.92)] sm:px-8 sm:py-7">
                    <div className="pointer-events-none absolute inset-0">
                      <div className="absolute left-1/2 top-[12%] h-[80%] w-[72%] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(115,203,255,0.11),transparent_62%)] blur-[28px]" />
                      <div
                        className="absolute inset-x-[12%] top-[18%] h-[58%] opacity-60"
                        style={{
                          backgroundImage: [
                            'radial-gradient(circle at center, rgba(255,255,255,0.1), transparent 52%)',
                            'conic-gradient(from 180deg at 50% 100%, transparent 0deg, rgba(132,214,255,0.18) 12deg, transparent 26deg, rgba(132,214,255,0.14) 34deg, transparent 48deg, rgba(132,214,255,0.18) 58deg, transparent 72deg, rgba(132,214,255,0.14) 84deg, transparent 96deg, rgba(132,214,255,0.18) 108deg, transparent 124deg, rgba(132,214,255,0.14) 138deg, transparent 156deg, rgba(132,214,255,0.18) 170deg, transparent 180deg)',
                          ].join(', '),
                        }}
                      />
                    </div>

                    <div className="relative z-10 flex h-full min-h-[19rem] flex-col items-center justify-center text-center sm:min-h-[21rem] xl:min-h-0">
                      {hasSearchResults && selectedAgent ? (
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={selectedAgent.id}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="flex w-full max-w-5xl flex-col items-center"
                          >
                            <div className="text-[11px] uppercase tracking-[0.34em] text-white/34">Mon ecosysteme Cowork</div>
                            <h1 className="mt-3 max-w-[14ch] text-balance text-[clamp(2.1rem,4.9vw,4.15rem)] font-semibold leading-[0.95] tracking-[-0.06em] text-white">
                              Ouvrez des outils puissants ou co-creez l'IA de demain.
                            </h1>
                            <p className="mt-3 max-w-[44rem] text-pretty text-sm leading-7 text-white/56 sm:text-[15px]">
                              Une application phare mise en avant, un studio d'apps en bas, et un laboratoire de co-creation sur la droite pour imaginer le prochain produit.
                            </p>

                            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
                              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
                                <SelectedIcon size={14} style={{ color: selectedPalette?.accent }} />
                                {selectedMeta?.label}
                              </span>
                              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/56">
                                {selectedAgent.name}
                              </span>
                            </div>
                          </motion.div>
                        </AnimatePresence>
                      ) : (
                        <div className="flex max-w-xl flex-col items-center text-center">
                          <div className="text-[11px] uppercase tracking-[0.34em] text-white/34">Recherche</div>
                          <h1 className="mt-5 text-balance text-[clamp(2.2rem,7vw,4.1rem)] font-semibold leading-[0.94] tracking-[-0.06em] text-white">
                            Aucune app ne correspond a cette recherche.
                          </h1>
                          <p className="mt-4 text-sm leading-7 text-white/54 sm:text-[15px]">
                            Essaie un autre mot-cle, ou cree une nouvelle app depuis le laboratoire sur la droite.
                          </p>
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white/78 transition-colors hover:bg-white/[0.08]"
                          >
                            Effacer la recherche
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.018))] px-4 py-4 shadow-[0_34px_100px_-56px_rgba(0,0,0,0.86)] backdrop-blur-xl sm:px-5 sm:py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/34">
                          Mon studio d'applications d'IA
                        </div>
                        <div className="mt-1 text-sm text-white/56">
                          {filteredAgents.length === 0
                            ? 'Decris une premiere app pour ouvrir le studio.'
                            : `Page ${page + 1} / ${totalPages} - ${filteredAgents.length} application${filteredAgents.length > 1 ? 's' : ''}`}
                        </div>
                      </div>

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

                    {filteredAgents.length === 0 ? (
                      <div className="mt-4 rounded-[1.4rem] border border-dashed border-white/10 bg-black/20 px-4 py-6 text-sm leading-7 text-white/42">
                        Le studio attend sa prochaine app. Utilise le panneau de co-creation pour lancer une nouvelle idee.
                      </div>
                    ) : (
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={`${page}-${pageSize}-${searchQuery}`}
                          initial={{ opacity: 0, x: 16 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -16 }}
                          transition={{ duration: 0.18, ease: 'easeOut' }}
                          className={cn('mt-4 grid gap-3', pageColumnsClass)}
                        >
                          {pageAgents.map((agent) => {
                            const meta = getAgentAppMeta(agent);
                            const palette = getAgentPalette(agent);
                            const Icon = meta.icon;
                            const isSelected = selectedAgent?.id === agent.id;

                            return (
                              <article
                                key={agent.id}
                                className={cn(
                                  'flex min-h-[14rem] flex-col rounded-[1.55rem] border p-4 transition-all duration-300',
                                  isSelected
                                    ? 'border-white/14 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[0_22px_60px_-34px_rgba(0,0,0,0.85)]'
                                    : 'border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] hover:border-white/12 hover:bg-white/[0.05]'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => setSelectedId(agent.id)}
                                  className="flex flex-1 flex-col text-left"
                                >
                                  <div className="flex items-start gap-3">
                                    <div
                                      className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.2rem] border"
                                      style={{
                                        borderColor: palette.rim,
                                        background: palette.frame.background,
                                        boxShadow: isSelected ? palette.frame.boxShadow : 'none',
                                      }}
                                    >
                                      <Icon size={20} style={{ color: palette.accent }} />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="truncate text-lg font-semibold tracking-tight text-white">
                                        {agent.name}
                                      </div>
                                      <div className="mt-1 text-sm text-white/58">{meta.spotlight}</div>
                                    </div>
                                  </div>

                                  <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/52">
                                    {agent.tagline}
                                  </p>

                                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
                                    <span
                                      className="inline-flex rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/66"
                                      style={{ borderColor: palette.rim, background: palette.accentSoft }}
                                    >
                                      {meta.category}
                                    </span>
                                    <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
                                      {meta.label}
                                    </span>
                                  </div>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => void launchAgent(agent)}
                                  disabled={isRunningAgent}
                                  className={cn(
                                    'mt-4 inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-all',
                                    isRunningAgent
                                      ? 'cursor-not-allowed bg-white/8 text-white/35'
                                      : isSelected
                                        ? 'bg-white text-black hover:-translate-y-[1px]'
                                        : 'border border-white/10 bg-white/[0.04] text-white/78 hover:border-white/18 hover:text-white'
                                  )}
                                >
                                  {isRunningAgent && isSelected ? (
                                    <>
                                      <Loader2 size={15} className="mr-2 animate-spin" />
                                      Ouverture...
                                    </>
                                  ) : (
                                    getAgentQuickActionLabel(agent)
                                  )}
                                </button>
                              </article>
                            );
                          })}
                        </motion.div>
                      </AnimatePresence>
                    )}
                  </div>
                </section>
                <aside className="flex min-h-0 flex-col rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-4 shadow-[0_34px_100px_-56px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">
                        Laboratoire de co-creation d'applications
                      </div>
                      <h2 className="mt-3 text-[1.55rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white">
                        Concevez votre prochaine app
                      </h2>
                    </div>
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.03] text-white/48">
                      <Wand2 size={16} />
                    </div>
                  </div>

                  {warningMessage && (
                    <div className="mt-4 flex items-start gap-3 rounded-[1.4rem] border border-amber-300/14 bg-amber-300/[0.07] px-4 py-3 text-sm leading-6 text-amber-50/86">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-200" />
                      <span>{warningMessage}</span>
                    </div>
                  )}

                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void submit();
                    }}
                    className="mt-4 rounded-[1.6rem] border border-white/10 bg-black/18 p-3.5"
                  >
                    <div className="space-y-3">
                      <textarea
                        value={brief}
                        onChange={(event) => setBrief(event.target.value)}
                        rows={3}
                        placeholder="Quel type d'outil d'IA voulez-vous creer ? Decrivez votre vision, le role de l'app et le besoin qu'elle doit couvrir."
                        className="min-h-[5.1rem] w-full resize-none rounded-[1.3rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/30"
                      />

                      <textarea
                        value={creationNotes}
                        onChange={(event) => setCreationNotes(event.target.value)}
                        rows={2}
                        placeholder="Decrivez l'app que Cowork doit construire: structure, fonctionnalites, design, ton ou livrables attendus."
                        className="min-h-[4.1rem] w-full resize-none rounded-[1.3rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/30"
                      />

                      <label className="block">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/40">
                          Type d'application
                        </span>
                        <select
                          value={creationType}
                          onChange={(event) => setCreationType(event.target.value)}
                          className="h-12 w-full rounded-[1.1rem] border border-white/8 bg-white/[0.03] px-4 text-sm text-white outline-none transition-colors focus:border-cyan-300/30"
                        >
                          {CREATION_TYPES.map((type) => (
                            <option key={type} value={type} className="bg-[#0a1018]">
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>

                      <button
                        type="submit"
                        disabled={isCreating || !brief.trim()}
                        className={cn(
                          'flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all',
                          isCreating || !brief.trim()
                            ? 'cursor-not-allowed bg-white/8 text-white/35'
                            : 'bg-[linear-gradient(180deg,rgba(232,240,255,0.92),rgba(174,188,214,0.9))] text-[#07121d] hover:-translate-y-[1px]'
                        )}
                      >
                        {isCreating ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            Creation...
                          </>
                        ) : (
                          <>
                            <Sparkles size={16} />
                            Lancer l'assistant co-createur
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[1.6rem] border border-white/10 bg-black/18 p-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">
                          Derniers projets collaboratifs
                        </div>
                        <div className="mt-1 text-sm text-white/50">
                          Les apps les plus recentes du studio Cowork.
                        </div>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                        {agents.length}
                      </div>
                    </div>

                    <div className={cn('mt-4 grid gap-3', isDesktopScene ? 'grid-rows-2' : 'sm:grid-cols-3 xl:grid-cols-1')}>
                      {recentAgents.map((agent) => {
                        const meta = getAgentAppMeta(agent);
                        const palette = getAgentPalette(agent);
                        const Icon = meta.icon;

                        return (
                          <button
                            key={agent.id}
                            type="button"
                            onClick={() => setSelectedId(agent.id)}
                            className="group rounded-[1.2rem] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left transition-all hover:border-white/16 hover:bg-white/[0.05]"
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem] border"
                                style={{ borderColor: palette.rim, background: palette.accentSoft }}
                              >
                                <Icon size={15} style={{ color: palette.accent }} />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold text-white">{agent.name}</div>
                                <div className="mt-0.5 line-clamp-1 text-[11px] leading-5 text-white/48">
                                  {agent.summary || agent.tagline}
                                </div>
                              </div>
                            </div>

                            <div className="mt-2.5 flex items-center justify-between gap-3">
                              <span className="text-[10px] uppercase tracking-[0.18em] text-white/34">
                                {formatProjectAge(agent.updatedAt)}
                              </span>
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-white/68 transition-transform group-hover:translate-x-[2px]">
                                {meta.category}
                                <ArrowRight size={13} />
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </aside>
              </div>
            </main>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
