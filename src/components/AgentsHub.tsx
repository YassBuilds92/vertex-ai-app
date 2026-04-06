import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  LayoutTemplate,
  Loader2,
  Menu,
  Plus,
  Search,
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
import { CoworkCreationChat } from './CoworkCreationChat';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

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
    payload: { brief?: string; transcript?: GeneratedAppCreationTranscriptTurn[] },
  ) => Promise<{ status: 'clarification_requested' | 'completed'; manifest?: unknown } | null> | void;
  onRunAgent: (agent: StudioAgent, values: Record<string, string | boolean>) => Promise<unknown> | void;
}

/* ------------------------------------------------------------------ */
/*  Panel views                                                        */
/* ------------------------------------------------------------------ */

type PanelView = 'chat' | 'showcase';

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panelView, setPanelView] = useState<PanelView>('chat');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  /* Update selected when latest created */
  useEffect(() => {
    if (latestCreatedAgent?.id) {
      setSelectedId(latestCreatedAgent.id);
      setPanelView('showcase');
    }
  }, [latestCreatedAgent]);

  /* Filter agents */
  const filteredAgents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return agents;
    return agents.filter((agent) => {
      const meta = getAgentAppMeta(agent);
      return [agent.name, agent.tagline, agent.summary, meta.label, meta.category, agent.outputKind]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [agents, searchQuery]);

  const selectedAgent = useMemo(
    () => filteredAgents.find((a) => a.id === selectedId) || null,
    [filteredAgents, selectedId],
  );

  /* Launch handler */
  const launchAgent = async (agent: StudioAgent) => {
    if (isRunningAgent) return;
    await onRunAgent(agent, createInitialFieldValues(getRenderableFields(agent)));
  };

  /* Select + show showcase */
  const selectApp = (agent: StudioAgent) => {
    setSelectedId(agent.id);
    setPanelView('showcase');
    setIsSidebarOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.section
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 1.01 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="relative flex h-[100dvh] max-h-[100dvh] w-full flex-1 overflow-hidden bg-[rgb(var(--app-bg-rgb))] text-white"
        >
          {/* Background */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_14%,rgba(117,214,255,0.10),transparent_24%),radial-gradient(circle_at_82%_12%,rgba(255,194,120,0.06),transparent_18%)]" />
            <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] [background-size:32px_32px]" />
          </div>

          {/* Mobile sidebar toggle */}
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute left-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 xl:hidden"
          >
            <Menu size={18} />
          </button>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-30 flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/60 transition-colors hover:text-white"
            title="Fermer"
          >
            <X size={16} />
          </button>

          {/* -------------------------------------------------------- */}
          {/*  Left panel — App library                                */}
          {/* -------------------------------------------------------- */}
          <>
            {/* Mobile overlay */}
            <AnimatePresence>
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsSidebarOpen(false)}
                  className="fixed inset-0 z-30 bg-black/50 xl:hidden"
                />
              )}
            </AnimatePresence>

            <motion.aside
              className={cn(
                'relative z-40 flex h-full w-72 shrink-0 flex-col border-r border-white/8 bg-[rgb(var(--app-bg-rgb))]',
                'max-xl:fixed max-xl:left-0 max-xl:top-0',
                !isSidebarOpen && 'max-xl:pointer-events-none max-xl:-translate-x-full',
                isSidebarOpen && 'max-xl:translate-x-0',
              )}
              style={{ transition: 'transform 0.25s ease' }}
            >
              {/* Sidebar header */}
              <div className="flex items-center gap-3 border-b border-white/6 px-4 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04]">
                  <LayoutTemplate size={15} className="text-indigo-200" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-white/35">Cowork</div>
                  <div className="text-sm font-semibold text-white/85">Apps</div>
                </div>
                <span className="rounded-full border border-white/8 bg-white/[0.03] px-2 py-0.5 text-[10px] text-white/40">
                  {agents.length}
                </span>
              </div>

              {/* Search */}
              <div className="px-3 pt-3">
                <label className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2 text-xs transition-colors focus-within:border-white/14">
                  <Search size={13} className="shrink-0 text-white/30" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Rechercher..."
                    className="min-w-0 flex-1 bg-transparent text-white outline-none placeholder:text-white/25"
                  />
                </label>
              </div>

              {/* New app button */}
              <div className="px-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPanelView('chat');
                    setSelectedId(null);
                    setIsSidebarOpen(false);
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-all',
                    panelView === 'chat' && !selectedId
                      ? 'border border-indigo-300/16 bg-indigo-400/[0.08] text-indigo-100'
                      : 'text-white/55 hover:bg-white/[0.05] hover:text-white/75',
                  )}
                >
                  <Plus size={15} />
                  Nouvelle app
                </button>
              </div>

              {/* Agent list */}
              <div className="mt-1 flex-1 overflow-y-auto px-3 pb-3">
                {filteredAgents.length === 0 ? (
                  <div className="px-3 py-6 text-center text-xs text-white/30">
                    Aucune app trouvee
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {filteredAgents.map((agent) => {
                      const meta = getAgentAppMeta(agent);
                      const palette = getAgentPalette(agent);
                      const Icon = meta.icon;
                      const isSelected = selectedId === agent.id && panelView === 'showcase';

                      return (
                        <button
                          key={agent.id}
                          type="button"
                          onClick={() => selectApp(agent)}
                          className={cn(
                            'group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-all',
                            isSelected
                              ? 'border border-white/12 bg-white/[0.07]'
                              : 'border border-transparent hover:bg-white/[0.04]',
                          )}
                        >
                          <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-black/20"
                            style={{ borderColor: palette.rim }}
                          >
                            <Icon size={14} style={{ color: palette.accent }} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-white/80">{agent.name}</div>
                            <div className="truncate text-[11px] text-white/35">{meta.category}</div>
                          </div>
                          <ArrowRight
                            size={12}
                            className="shrink-0 text-white/20 transition-all group-hover:translate-x-0.5 group-hover:text-white/40"
                          />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Warning */}
              {warningMessage && (
                <div className="border-t border-white/6 px-3 py-2">
                  <div className="rounded-lg bg-amber-400/[0.06] px-3 py-2 text-[11px] text-amber-100/60">
                    Store local
                  </div>
                </div>
              )}
            </motion.aside>
          </>

          {/* -------------------------------------------------------- */}
          {/*  Right panel — Content area                              */}
          {/* -------------------------------------------------------- */}
          <main className="relative z-10 flex min-w-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              {panelView === 'chat' ? (
                <motion.div
                  key="chat"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full flex-col"
                >
                  <CoworkCreationChat
                    isCreating={isCreating}
                    creationRun={creationRun}
                    latestCreatedAgent={latestCreatedAgent}
                    isRunningAgent={isRunningAgent}
                    onCreateAgent={onCreateAgent}
                    onLaunchApp={(agent) => void launchAgent(agent)}
                  />
                </motion.div>
              ) : selectedAgent ? (
                <motion.div
                  key={`showcase-${selectedAgent.id}`}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}
                  className="flex h-full flex-col overflow-y-auto"
                >
                  <AppShowcase
                    agent={selectedAgent}
                    isRunningAgent={isRunningAgent}
                    onLaunch={() => void launchAgent(selectedAgent)}
                    onCreateNew={() => {
                      setPanelView('chat');
                      setSelectedId(null);
                    }}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex h-full flex-col"
                >
                  <CoworkCreationChat
                    isCreating={isCreating}
                    creationRun={creationRun}
                    latestCreatedAgent={latestCreatedAgent}
                    isRunningAgent={isRunningAgent}
                    onCreateAgent={onCreateAgent}
                    onLaunchApp={(agent) => void launchAgent(agent)}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>
        </motion.section>
      )}
    </AnimatePresence>
  );
};

/* ------------------------------------------------------------------ */
/*  App Showcase sub-component                                         */
/* ------------------------------------------------------------------ */

interface AppShowcaseProps {
  agent: StudioAgent;
  isRunningAgent: boolean;
  onLaunch: () => void;
  onCreateNew: () => void;
}

const AppShowcase: React.FC<AppShowcaseProps> = ({ agent, isRunningAgent, onLaunch, onCreateNew }) => {
  const meta = getAgentAppMeta(agent);
  const palette = getAgentPalette(agent);
  const Icon = meta.icon;
  const fields = getRenderableFields(agent).slice(0, 6);
  const capabilities = (agent.capabilities || []).slice(0, 4);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-white/6 px-8 py-6 xl:px-12">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-black/20"
              style={{ borderColor: palette.rim, boxShadow: `0 0 24px ${palette.glow}` }}
            >
              <Icon size={22} style={{ color: palette.accent }} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-semibold tracking-tight text-white">{agent.name}</h1>
                <span
                  className="rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]"
                  style={{ borderColor: palette.rim, background: palette.accentSoft, color: palette.accent }}
                >
                  {meta.category}
                </span>
              </div>
              <p className="mt-1.5 max-w-xl text-sm leading-6 text-white/50">
                {agent.summary || agent.tagline}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/8 bg-white/[0.03] px-4 text-sm text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/75"
            >
              <Plus size={14} />
              Nouvelle
            </button>
            <button
              type="button"
              onClick={onLaunch}
              disabled={isRunningAgent}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-gradient-to-b from-white/90 to-white/75 px-5 text-sm font-semibold text-[#0a0f1a] transition-all hover:-translate-y-px hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isRunningAgent ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              Ouvrir l'app
            </button>
          </div>
        </div>
      </div>

      {/* Preview + details */}
      <div className="flex-1 overflow-y-auto px-8 py-6 xl:px-12">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Preview */}
          <div className="min-h-[24rem] overflow-hidden rounded-2xl border border-white/8 bg-black/14">
            <AgentAppPreview agent={agent} size="workspace" className="h-full min-h-[24rem] border-none bg-transparent" />
          </div>

          {/* Details sidebar */}
          <div className="space-y-4">
            {/* Mission */}
            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Mission</div>
              <p className="mt-2 text-sm leading-6 text-white/60">{agent.mission}</p>
            </div>

            {/* Fields */}
            {fields.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Champs</div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {fields.map((f) => (
                    <span
                      key={f.id}
                      className="inline-flex rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55"
                    >
                      {f.label}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Capabilities */}
            {capabilities.length > 0 && (
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Capacites</div>
                <div className="mt-3 space-y-1.5">
                  {capabilities.map((cap) => (
                    <div
                      key={cap}
                      className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs leading-5 text-white/50"
                    >
                      {cap}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/35">Infos</div>
              <div className="mt-3 space-y-2 text-xs text-white/40">
                <div className="flex justify-between">
                  <span>Type</span>
                  <span className="text-white/55">{meta.label}</span>
                </div>
                <div className="flex justify-between">
                  <span>Cree par</span>
                  <span className="text-white/55">{agent.createdBy === 'cowork' ? 'Cowork' : 'Manuel'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Statut</span>
                  <span className="text-white/55">{agent.status}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
