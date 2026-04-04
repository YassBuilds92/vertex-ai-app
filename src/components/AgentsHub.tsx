import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LayoutTemplate,
  Loader2,
  Search,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GeneratedAppCreationRun, GeneratedAppCreationTranscriptTurn, StudioAgent } from '../types';
import {
  AgentAppPreview,
  createInitialFieldValues,
  getAgentAppMeta,
  getAgentPalette,
  getRenderableFields,
} from './AgentAppPreview';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getViewport() {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

function getPageSize(width: number, height: number) {
  if (width >= 1500 && height >= 920) return 8;
  if (width >= 1100) return 6;
  if (width >= 640) return 6;
  return 4;
}

function getTileGrid(width: number) {
  if (width >= 1280) return 'grid-cols-2';
  if (width >= 640) return 'grid-cols-3';
  return 'grid-cols-2';
}

function formatProjectAge(timestamp?: number) {
  if (!timestamp) return 'recent';

  const delta = Math.max(0, Date.now() - timestamp);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (delta < hour) return `mis a jour il y a ${Math.max(1, Math.round(delta / minute))} min`;
  if (delta < day) return `mis a jour il y a ${Math.max(1, Math.round(delta / hour))} h`;
  return `mis a jour il y a ${Math.max(1, Math.round(delta / day))} j`;
}

function creationTurnLabel(turn: GeneratedAppCreationTranscriptTurn) {
  if (turn.role === 'assistant') return 'Cowork';
  if (turn.kind === 'answer') return 'Votre reponse';
  return 'Votre brief';
}

function buildCreationPreviewAgent(run: GeneratedAppCreationRun | null): StudioAgent | null {
  const preview = run?.manifest || run?.manifestPreview;
  if (!preview) return null;

  return {
    id: `creation-preview-${preview.slug || 'pending'}`,
    name: preview.name,
    slug: preview.slug,
    tagline: preview.tagline,
    summary: preview.summary,
    mission: preview.mission,
    whenToUse: preview.whenToUse,
    outputKind: preview.outputKind,
    starterPrompt: `Ouvre ${preview.name}.`,
    systemInstruction: `Tu es ${preview.name}.`,
    uiSchema: Array.isArray(preview.uiSchema) ? preview.uiSchema : [],
    tools: Array.isArray(preview.toolAllowList) ? preview.toolAllowList : [],
    capabilities: Array.isArray(preview.capabilities) ? preview.capabilities : [],
    status: run?.status === 'completed' ? 'ready' : 'draft',
    createdBy: 'cowork',
    createdAt: run?.startedAt || Date.now(),
    updatedAt: run?.completedAt || run?.startedAt || Date.now(),
  };
}

const STARTER_IDEAS = [
  "Je veux un studio ou deux IA debattent entre elles puis sortent un podcast avec musique.",
  "Je veux une app qui lit plusieurs sources, clarifie ma demande puis livre une note de decision propre.",
  "Je veux une app qui transforme un dossier en mini-site premium avec une interface vraiment faite pour ce sujet.",
];

interface AgentsHubProps {
  isOpen: boolean;
  agents: StudioAgent[];
  isCreating: boolean;
  creationRun?: GeneratedAppCreationRun | null;
  isRunningAgent: boolean;
  latestCreatedAgent?: StudioAgent | null;
  warningMessage?: string | null;
  onClose: () => void;
  onCreateAgent: (
    payload: { brief?: string; transcript?: GeneratedAppCreationTranscriptTurn[] }
  ) => Promise<{ status: 'clarification_requested' | 'completed'; manifest?: unknown } | null> | void;
  onRunAgent: (agent: StudioAgent, values: Record<string, string | boolean>) => Promise<unknown> | void;
}

export const AgentsHub: React.FC<AgentsHubProps> = ({
  isOpen,
  agents,
  isCreating,
  creationRun,
  isRunningAgent,
  latestCreatedAgent,
  warningMessage,
  onClose,
  onCreateAgent,
  onRunAgent,
}) => {
  const [brief, setBrief] = useState('');
  const [clarificationReply, setClarificationReply] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [viewport, setViewport] = useState(getViewport);

  useEffect(() => {
    if (latestCreatedAgent?.id) setSelectedId(latestCreatedAgent.id);
  }, [latestCreatedAgent]);

  useEffect(() => {
    const sync = () => setViewport(getViewport());
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

  useEffect(() => {
    if (!creationRun?.awaitingClarification) {
      setClarificationReply('');
    }
  }, [creationRun?.awaitingClarification]);

  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return agents;

    return agents.filter((agent) => {
      const meta = getAgentAppMeta(agent);
      const haystack = [
        agent.name,
        agent.tagline,
        agent.summary,
        agent.mission,
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

  const pageSize = useMemo(() => getPageSize(viewport.width, viewport.height), [viewport]);
  const totalPages = Math.max(1, Math.ceil(Math.max(filteredAgents.length, 1) / pageSize));
  const selectedAgent = useMemo(
    () => filteredAgents.find((agent) => agent.id === selectedId) || filteredAgents[0] || null,
    [filteredAgents, selectedId]
  );
  const selectedIndex = selectedAgent ? filteredAgents.findIndex((agent) => agent.id === selectedAgent.id) : -1;

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

  const creationTranscript = creationRun?.transcript || [];
  const isAwaitingClarification = Boolean(creationRun?.awaitingClarification);
  const creationPreviewAgent = useMemo(() => buildCreationPreviewAgent(creationRun || null), [creationRun]);
  const showcaseAgent = creationPreviewAgent || selectedAgent;
  const showcaseMeta = showcaseAgent ? getAgentAppMeta(showcaseAgent) : null;
  const showcasePalette = showcaseAgent ? getAgentPalette(showcaseAgent) : null;
  const ShowcaseIcon = showcaseMeta?.icon || LayoutTemplate;
  const showcaseFields = showcaseAgent ? getRenderableFields(showcaseAgent).slice(0, 4) : [];
  const showcaseCapabilities = (showcaseAgent?.capabilities || []).slice(0, 3);
  const latestCreationPhase = creationRun?.phases[creationRun.phases.length - 1] || null;
  const recentCreationPhases = creationRun?.phases.slice(-4) || [];
  const primaryLaunchAgent =
    creationRun?.status === 'completed' && latestCreatedAgent ? latestCreatedAgent : selectedAgent;

  const submit = async () => {
    const cleanedBrief = brief.trim();
    if (isCreating) return;

    if (isAwaitingClarification && creationTranscript.length > 0) {
      const cleanedReply = clarificationReply.trim();
      if (!cleanedReply) return;

      const result = await onCreateAgent({
        transcript: [...creationTranscript, { role: 'user', content: cleanedReply, kind: 'answer' }],
      });
      setClarificationReply('');
      if (result && 'status' in result && result.status === 'completed') setBrief('');
      return;
    }

    if (!cleanedBrief) return;
    const result = await onCreateAgent({ brief: cleanedBrief });
    if (result && 'status' in result && result.status === 'completed') setBrief('');
  };

  const launchAgent = async (agent: StudioAgent) => {
    if (isRunningAgent) return;
    await onRunAgent(agent, createInitialFieldValues(getRenderableFields(agent)));
  };

  const composerDisabled = isCreating || (isAwaitingClarification ? !clarificationReply.trim() : !brief.trim());

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
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(117,214,255,0.12),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(255,194,120,0.08),transparent_18%),radial-gradient(circle_at_72%_78%,rgba(86,114,255,0.12),transparent_24%)]" />
            <div className="absolute inset-0 opacity-45 [background-image:linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:28px_28px]" />
            <div className="absolute left-[18%] top-[18%] h-56 w-56 rounded-full bg-cyan-300/8 blur-3xl" />
            <div className="absolute bottom-[12%] right-[18%] h-64 w-64 rounded-full bg-indigo-300/8 blur-3xl" />
          </div>

          <div className="relative z-10 grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto]">
            <header className="border-b border-white/8 px-4 py-4 sm:px-6 lg:px-8">
              <div className="mx-auto flex max-w-[1580px] flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] border border-white/10 bg-white/[0.05]">
                    <LayoutTemplate size={18} className="text-cyan-200" />
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/38">Cowork apps</div>
                    <div className="text-base font-semibold tracking-tight text-white/92">Gestionnaire d'applications</div>
                  </div>
                  <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] text-white/58">
                    {filteredAgents.length} app{filteredAgents.length > 1 ? 's' : ''}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center xl:w-[min(58rem,100%)] xl:justify-end">
                  <label className="relative flex h-12 flex-1 items-center overflow-hidden rounded-[1.2rem] border border-white/10 bg-white/[0.05] px-4 text-sm text-white/72">
                    <Search size={16} className="mr-3 shrink-0 text-white/38" />
                    <input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Rechercher une app, une idee, un usage..."
                      className="w-full bg-transparent text-white outline-none placeholder:text-white/30"
                    />
                  </label>
                  {warningMessage && (
                    <div className="inline-flex h-12 items-center gap-2 rounded-full border border-amber-300/16 bg-amber-300/[0.08] px-4 text-xs text-amber-50/88">
                      <AlertTriangle size={14} className="text-amber-200" />
                      Store local
                    </div>
                  )}
                  <button
                    onClick={onClose}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-[1.1rem] border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/72 transition-colors hover:border-white/16 hover:text-white"
                    title="Fermer Cowork Apps"
                  >
                    <X size={16} />
                    Fermer
                  </button>
                </div>
              </div>
            </header>

            <main className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
              <div className="mx-auto grid max-w-[1580px] gap-4 xl:h-full xl:grid-cols-[320px_minmax(0,1fr)_320px]">
                <section className="flex min-h-0 flex-col rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/36">Bibliotheque</div>
                      <div className="mt-1 text-sm text-white/58">Toutes les apps du studio, comme sur une tablette.</div>
                    </div>
                    <div className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                      {page + 1}/{totalPages}
                    </div>
                  </div>

                  {filteredAgents.length === 0 ? (
                    <div className="mt-4 rounded-[1.45rem] border border-dashed border-white/10 bg-black/16 px-4 py-5 text-sm leading-7 text-white/46">
                      Aucun resultat. Essaie un autre mot-cle ou decris une nouvelle app en bas.
                    </div>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={`${page}-${pageSize}-${searchQuery}`}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className={cn('mt-4 grid gap-3', getTileGrid(viewport.width))}
                      >
                        {pageAgents.map((agent) => {
                          const meta = getAgentAppMeta(agent);
                          const palette = getAgentPalette(agent);
                          const Icon = meta.icon;
                          const isSelected = selectedAgent?.id === agent.id;

                          return (
                            <button
                              key={agent.id}
                              type="button"
                              onClick={() => setSelectedId(agent.id)}
                              className={cn(
                                'group relative aspect-[1.06/1] overflow-hidden rounded-[1.45rem] border p-3 text-left transition-all',
                                isSelected
                                  ? 'border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.11),rgba(255,255,255,0.04))]'
                                  : 'border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] hover:border-white/14 hover:bg-white/[0.06]'
                              )}
                            >
                              <div className="pointer-events-none absolute left-3 top-3 h-20 w-20 rounded-full blur-2xl" style={{ background: palette.glow }} />
                              <div className="relative z-10 flex h-full flex-col">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] border bg-black/24" style={{ borderColor: palette.rim }}>
                                    <Icon size={18} style={{ color: palette.accent }} />
                                  </div>
                                  <span className="inline-flex rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/66" style={{ borderColor: palette.rim, background: palette.accentSoft }}>
                                    {meta.category}
                                  </span>
                                </div>
                                <div className="mt-auto">
                                  <div className="text-sm font-semibold leading-5 text-white">{agent.name}</div>
                                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/42">{meta.label}</div>
                                  <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-white/42">
                                    <span>{agent.createdBy === 'cowork' ? 'built by Cowork' : 'manuel'}</span>
                                    <span className="inline-flex items-center gap-1 text-white/58 transition-transform group-hover:translate-x-[2px]">
                                      Voir
                                      <ArrowRight size={12} />
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  )}

                  {totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/36">Page {page + 1} sur {totalPages}</div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setPage((currentPage) => Math.max(0, currentPage - 1))} disabled={page === 0} className={cn('flex h-10 w-10 items-center justify-center rounded-full border', page === 0 ? 'cursor-not-allowed border-white/8 bg-white/[0.02] text-white/24' : 'border-white/10 bg-white/[0.05] text-white/72 hover:border-white/16 hover:text-white')}>
                          <ChevronLeft size={17} />
                        </button>
                        <button type="button" onClick={() => setPage((currentPage) => Math.min(totalPages - 1, currentPage + 1))} disabled={page >= totalPages - 1} className={cn('flex h-10 w-10 items-center justify-center rounded-full border', page >= totalPages - 1 ? 'cursor-not-allowed border-white/8 bg-white/[0.02] text-white/24' : 'border-white/10 bg-white/[0.05] text-white/72 hover:border-white/16 hover:text-white')}>
                          <ChevronRight size={17} />
                        </button>
                      </div>
                    </div>
                  )}
                </section>

                <section className="flex min-h-0 flex-col rounded-[2.2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/36">Interface active</div>
                      <div className="mt-2 flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] border bg-black/18" style={{ borderColor: showcasePalette?.rim || 'rgba(255,255,255,0.14)', background: showcasePalette?.accentSoft || 'rgba(255,255,255,0.04)' }}>
                          <ShowcaseIcon size={18} style={{ color: showcasePalette?.accent || '#d8f6ff' }} />
                        </div>
                        <div className="min-w-0">
                          <h1 className="text-balance text-[clamp(1.7rem,4vw,2.7rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white">{showcaseAgent?.name || 'Selectionnez une app'}</h1>
                          <p className="mt-2 max-w-[44rem] text-sm leading-7 text-white/58">{showcaseAgent?.summary || showcaseAgent?.tagline || "Chaque app a sa propre surface. Selectionnez-en une pour voir son interface s'ouvrir ici."}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {showcaseMeta && <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/66"><ShowcaseIcon size={13} style={{ color: showcasePalette?.accent || '#d8f6ff' }} />{showcaseMeta.label}</span>}
                      {creationPreviewAgent && creationRun?.status !== 'completed' && <span className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-300/[0.08] px-3 py-2 text-xs uppercase tracking-[0.18em] text-cyan-50/84"><Loader2 size={13} className="animate-spin" />Preview en construction</span>}
                      {showcaseAgent?.updatedAt && <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/44">{formatProjectAge(showcaseAgent.updatedAt)}</span>}
                    </div>
                  </div>

                  <div className="mt-4 min-h-[18rem] flex-1 overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/16">
                    {showcaseAgent ? <AgentAppPreview agent={showcaseAgent} size={viewport.width >= 1280 ? 'workspace' : 'feature'} className="h-full min-h-[20rem] border-none bg-transparent" /> : <div className="flex h-full min-h-[20rem] items-center justify-center px-6 text-center text-sm leading-7 text-white/48">Le store est vide pour l'instant. Decris ton idee en bas et Cowork commencera par clarifier le bon chemin.</div>}
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="rounded-[1.5rem] border border-white/10 bg-black/18 p-4">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Signes propres a l'app</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {showcaseFields.length > 0 ? showcaseFields.map((field) => <span key={field.id} className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs text-white/68">{field.label}</span>) : <span className="text-sm text-white/46">L'interface se definira au fil de la generation.</span>}
                      </div>
                      {showcaseCapabilities.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{showcaseCapabilities.map((capability) => <span key={capability} className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/52">{capability}</span>)}</div>}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      {creationRun?.status === 'completed' && latestCreatedAgent && <button type="button" onClick={() => void launchAgent(latestCreatedAgent)} disabled={isRunningAgent} className={cn('inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all', isRunningAgent ? 'cursor-not-allowed bg-white/8 text-white/35' : 'border border-cyan-300/18 bg-cyan-300/[0.1] text-cyan-50 hover:bg-cyan-300/[0.15]')}>{isRunningAgent ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}Ouvrir la nouvelle app</button>}
                      {primaryLaunchAgent && <button type="button" onClick={() => void launchAgent(primaryLaunchAgent)} disabled={isRunningAgent} className={cn('inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all', isRunningAgent ? 'cursor-not-allowed bg-white/8 text-white/35' : 'bg-[linear-gradient(180deg,rgba(232,240,255,0.92),rgba(174,188,214,0.9))] text-[#07121d] hover:-translate-y-[1px]')}>{isRunningAgent ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}{primaryLaunchAgent === latestCreatedAgent && creationRun?.status === 'completed' ? 'Ouvrir le studio' : "Ouvrir l'app selectionnee"}</button>}
                    </div>
                  </div>
                </section>

                <aside className="flex min-h-0 flex-col gap-4">
                  <section className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.22em] text-white/36">{creationRun ? 'Cowork en direct' : 'Cap produit'}</div>
                        <div className="mt-2 text-lg font-semibold tracking-tight text-white">{isAwaitingClarification ? 'Clarification avant generation' : creationRun ? latestCreationPhase?.label || 'Cowork construit la prochaine app' : 'Cowork doit poser les bonnes questions avant de produire'}</div>
                      </div>
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-[1rem] border border-white/10 bg-white/[0.04] text-white/58"><Wand2 size={16} /></div>
                    </div>

                    {creationRun ? (
                      <>
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em]', creationRun.awaitingClarification ? 'border-cyan-300/18 bg-cyan-300/[0.08] text-cyan-50/84' : creationRun.status === 'completed' ? 'border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-50/84' : creationRun.status === 'failed' ? 'border-rose-300/18 bg-rose-300/[0.08] text-rose-50/84' : 'border-cyan-300/16 bg-cyan-300/[0.08] text-cyan-50/84')}>
                            {creationRun.status === 'running' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                            {creationRun.awaitingClarification ? 'clarification' : creationRun.status}
                          </span>
                          {creationPreviewAgent && <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/52">{creationPreviewAgent.name}</span>}
                        </div>

                        {isAwaitingClarification && <div className="mt-4 rounded-[1.3rem] border border-cyan-300/16 bg-cyan-300/[0.06] p-4 text-sm leading-6 text-white/76">{creationRun.clarificationQuestion || "Cowork a besoin d'un detail supplementaire pour cadrer l'app."}</div>}

                        {creationTranscript.length > 0 && <div className="mt-4 space-y-2">{creationTranscript.slice(-3).map((turn, index) => <div key={`${turn.role}-${turn.kind || 'info'}-${index}`} className={cn('rounded-[1.2rem] border px-3.5 py-3 text-sm leading-6', turn.role === 'assistant' ? 'border-cyan-300/18 bg-cyan-300/[0.07] text-white/82' : 'border-white/10 bg-black/18 text-white/70')}><div className="text-[10px] uppercase tracking-[0.18em] text-white/42">{creationTurnLabel(turn)}</div><div className="mt-1.5">{turn.content}</div></div>)}</div>}

                        {recentCreationPhases.length > 0 && <div className="mt-4 space-y-3">{recentCreationPhases.map((phase, index) => { const isLast = index === recentCreationPhases.length - 1; const failedStep = phase.phase === 'bundle_failed' || creationRun.status === 'failed'; return <div key={`${phase.phase}-${phase.timestamp || index}`} className="flex items-start gap-3"><div className="flex flex-col items-center"><span className={cn('flex h-8 w-8 items-center justify-center rounded-full border', failedStep ? 'border-rose-300/18 bg-rose-300/[0.08] text-rose-100' : 'border-cyan-300/16 bg-cyan-300/[0.08] text-cyan-100')}>{failedStep ? <AlertTriangle size={14} /> : creationRun.status === 'running' && isLast ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}</span>{!isLast && <span className="mt-2 h-6 w-px bg-white/10" />}</div><div className="min-w-0 pb-1"><div className="text-sm font-medium text-white/86">{phase.label}</div><div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/36">{phase.phase.replace(/_/g, ' ')}</div></div></div>; })}</div>}
                      </>
                    ) : (
                      <div className="mt-4 space-y-3">
                        {[
                          'Comprendre la vision avant de choisir un chemin technique.',
                          'Poser les vraies questions: audio, musique, debat, livrables, structure des tours.',
                          "Generer ensuite une interface propre a l'app, pas un formulaire generique.",
                        ].map((step, index) => <div key={step} className="flex gap-3 rounded-[1.25rem] border border-white/10 bg-black/18 px-3.5 py-3"><div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-cyan-300/16 bg-cyan-300/[0.08] text-xs font-semibold text-cyan-100">0{index + 1}</div><p className="text-sm leading-6 text-white/68">{step}</p></div>)}
                      </div>
                    )}
                  </section>

                  <section className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/36">Interface distincte</div>
                    {showcaseAgent ? (
                      <>
                        <div className="mt-3 text-lg font-semibold tracking-tight text-white">{showcaseAgent.name}</div>
                        <p className="mt-2 text-sm leading-6 text-white/60">{showcaseAgent.tagline || showcaseAgent.mission}</p>
                        <div className="mt-4 flex flex-wrap gap-2">{showcaseFields.slice(0, 3).map((field) => <span key={field.id} className="inline-flex rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/66">{field.label}</span>)}</div>
                        {showcaseCapabilities.length > 0 && <div className="mt-4 space-y-2">{showcaseCapabilities.map((capability) => <div key={capability} className="rounded-[1.1rem] border border-white/10 bg-black/18 px-3.5 py-3 text-sm leading-6 text-white/66">{capability}</div>)}</div>}
                      </>
                    ) : <p className="mt-3 text-sm leading-6 text-white/48">La prochaine app prendra sa propre forme des que tu l'auras decrite.</p>}
                    {warningMessage && <div className="mt-4 rounded-[1.2rem] border border-amber-300/14 bg-amber-300/[0.07] px-3.5 py-3 text-sm leading-6 text-amber-50/84">{warningMessage}</div>}
                  </section>
                </aside>
              </div>
            </main>

            <footer className="border-t border-white/8 bg-black/22 px-4 pb-4 pt-3 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-[1580px]">
                <form onSubmit={(event) => { event.preventDefault(); void submit(); }} className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-3 sm:p-4">
                  {isAwaitingClarification && <div className="mb-3 grid gap-3 xl:grid-cols-2"><div className="rounded-[1.35rem] border border-white/10 bg-black/18 px-4 py-3"><div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Brief initial</div><p className="mt-2 text-sm leading-6 text-white/70">{creationTranscript[0]?.content || brief || 'La vision initiale reste visible ici.'}</p></div><div className="rounded-[1.35rem] border border-cyan-300/16 bg-cyan-300/[0.06] px-4 py-3"><div className="text-[10px] uppercase tracking-[0.18em] text-cyan-100/68">Question de Cowork</div><p className="mt-2 text-sm leading-6 text-white/82">{creationRun?.clarificationQuestion || "Cowork attend une precision avant de continuer."}</p></div></div>}

                  <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/40"><Wand2 size={13} className="text-cyan-200" />{isAwaitingClarification ? 'Repondre a Cowork' : 'Entrez ce que vous voulez, Cowork clarifiera le bon chemin'}</div>
                      {isAwaitingClarification ? (
                        <textarea value={clarificationReply} onChange={(event) => setClarificationReply(event.target.value)} rows={viewport.width < 640 ? 4 : 3} placeholder="Reponds librement: format audio, musique, structure du debat, tours separes, livrables..." className="w-full resize-none rounded-[1.45rem] border border-cyan-300/18 bg-cyan-300/[0.05] px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/34" />
                      ) : (
                        <textarea value={brief} onChange={(event) => setBrief(event.target.value)} rows={viewport.width < 640 ? 4 : 3} placeholder="Entrez ce que vous voulez. Votre imagination deborde: debat entre deux IA, podcast avec musique, studio multi-agents, app de recherche, microsite, n'importe quoi." className="w-full resize-none rounded-[1.45rem] border border-white/10 bg-white/[0.05] px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/30" />
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                      {creationRun?.status === 'completed' && latestCreatedAgent && <button type="button" onClick={() => void launchAgent(latestCreatedAgent)} disabled={isRunningAgent} className={cn('inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all', isRunningAgent ? 'cursor-not-allowed bg-white/8 text-white/35' : 'border border-white/10 bg-white/[0.04] text-white/78 hover:border-white/16 hover:text-white')}>{isRunningAgent ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}Ouvrir l'app</button>}
                      <button type="submit" disabled={composerDisabled} className={cn('inline-flex h-12 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all', composerDisabled ? 'cursor-not-allowed bg-white/8 text-white/35' : 'bg-[linear-gradient(180deg,rgba(232,240,255,0.92),rgba(174,188,214,0.9))] text-[#07121d] hover:-translate-y-[1px]')}>
                        {isCreating ? <><Loader2 size={16} className="animate-spin" />Creation...</> : <><Sparkles size={16} />{isAwaitingClarification ? 'Repondre et reprendre' : 'Demander a Cowork'}</>}
                      </button>
                    </div>
                  </div>

                  {!isAwaitingClarification && !brief.trim() && <div className="mt-3 flex flex-wrap gap-2">{STARTER_IDEAS.map((idea) => <button key={idea} type="button" onClick={() => setBrief(idea)} className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/62 transition-colors hover:border-white/16 hover:bg-white/[0.06] hover:text-white">{idea}</button>)}</div>}
                </form>
              </div>
            </footer>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
