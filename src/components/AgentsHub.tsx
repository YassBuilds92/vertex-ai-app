import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  CheckCircle2,
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
import { GeneratedAppCreationRun, StudioAgent } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
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

function getViewportSize() {
  if (typeof window === 'undefined') {
    return { width: 1440, height: 900 };
  }

  return { width: window.innerWidth, height: window.innerHeight };
}

function getHubPageSize(width: number) {
  if (width >= 1580) return 3;
  if (width >= 1040) return 2;
  return 1;
}

function getHubPageColumns(pageSize: number) {
  if (pageSize >= 3) return 'grid-cols-1 xl:grid-cols-3';
  if (pageSize === 2) return 'grid-cols-1 lg:grid-cols-2';
  return 'grid-cols-1';
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

type CreationClarificationOption = {
  id: string;
  label: string;
  description: string;
  prompt: string;
  why: string;
  recommended?: boolean;
};

type CreationClarification = {
  question: string;
  helpText: string;
  options: CreationClarificationOption[];
  recommendedId: string;
};

function normalizeCreationIntent(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function buildCreationClarification(creationType: string, brief: string): CreationClarification | null {
  const normalized = normalizeCreationIntent(brief);
  if (!normalized.trim()) return null;

  const wantsDebate = /\b(debat|debate|duel|joute|controverse|affrontement|versus|vs)\b/.test(normalized)
    || (/\b(deux|2|duo)\b/.test(normalized) && /\b(ia|ai|voix|intervenants?|speakers?)\b/.test(normalized));

  if (creationType === 'Podcast') {
    return {
      question: 'Quel format audio veux-tu vraiment fabriquer avant la generation ?',
      helpText: 'Choisir la direction maintenant evite que Cowork parte sur une forme d app trop generique.',
      recommendedId: wantsDebate ? 'duel' : 'conversation',
      options: [
        {
          id: 'duel',
          label: 'Duel contradictoire',
          description: 'Deux voix IA defendront des positions opposees avec objections, rebuttals et synthese finale.',
          prompt: "Orientation produit: l'app doit organiser un vrai debat audio entre deux IA/personas distincts. Elle doit faire parler deux voix opposees, avec theses, contre-arguments, repliques et synthese finale. Interdit de retomber en chronique solo.",
          why: "Recommande car ce cadrage empeche la derive vers un podcast mono-voix et colle a une promesse de debat reel.",
          recommended: wantsDebate,
        },
        {
          id: 'conversation',
          label: 'Conversation editoriale',
          description: 'Deux voix explorent ensemble le sujet, mais sans opposition frontale systematique.',
          prompt: "Orientation produit: l'app doit produire un duo editorial fluide et pedagogique, avec deux voix complementaires qui explorent un sujet ensemble plutot que de s'affronter frontalement.",
          why: "Utile si tu veux un duo vivant mais moins conflictuel, plus magazine que duel.",
          recommended: !wantsDebate,
        },
        {
          id: 'chronique',
          label: 'Chronique solo',
          description: 'Une seule voix structure le sujet en capsule ou en editorial audio.',
          prompt: "Orientation produit: l'app peut rester une chronique audio solo, avec une seule voix, un angle net et un master final propre.",
          why: "A garder seulement si tu veux volontairement un format monologue ou capsule solo.",
        },
      ],
    };
  }

  return {
    question: 'Avant generation, quel niveau de cadrage veux-tu donner a cette app ?',
    helpText: 'Cette etape sert a verrouiller la forme du produit avant que Cowork n ecrive le systeme, l interface et les outils.',
    recommendedId: 'focused',
    options: [
      {
        id: 'focused',
        label: 'Atelier focal',
        description: 'Une app resserree autour d un geste principal, avec peu de friction et un resultat tres net.',
        prompt: "Orientation produit: construis une app tres focalisee sur un geste principal, avec une interface dense mais simple et un livrable final immediatement exploitable.",
        why: "Recommande si tu veux une app claire, rapide a comprendre et difficile a diluer.",
        recommended: true,
      },
      {
        id: 'expert',
        label: 'Expert autonome',
        description: 'Une app plus libre, capable de cadrer le besoin et de prendre quelques decisions a ta place.',
        prompt: "Orientation produit: construis une app experte autonome qui peut cadrer le besoin, choisir une strategie utile et produire un resultat plus ambitieux sans interface bavarde.",
        why: "Utile si tu veux donner plus de latitude au moteur et a la logique backend de l app.",
      },
      {
        id: 'control-room',
        label: 'Control room',
        description: 'Une app plus outillee, avec plusieurs reglages visibles et une posture de studio ou cockpit.',
        prompt: "Orientation produit: construis une app type studio/cockpit avec plusieurs reglages visibles, un espace de pilotage clair et des sorties bien exposees.",
        why: "Interessant quand l utilisateur veut piloter finement le rendu ou comparer plusieurs variantes.",
      },
    ],
  };
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

interface AgentsHubProps {
  isOpen: boolean;
  agents: StudioAgent[];
  isCreating: boolean;
  creationRun?: GeneratedAppCreationRun | null;
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
  creationRun,
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
  const [creationClarification, setCreationClarification] = useState<CreationClarification | null>(null);
  const [selectedClarificationId, setSelectedClarificationId] = useState<string | null>(null);
  const [customClarification, setCustomClarification] = useState('');
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

  useEffect(() => {
    setCreationClarification(null);
    setSelectedClarificationId(null);
    setCustomClarification('');
  }, [brief, creationNotes, creationType]);

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
  const isShortViewport = viewport.height < 930;
  const heroTitle = isShortViewport
    ? 'Ouvrez une app nette. Forgez la suivante.'
    : 'Ouvrez une app nette, puis forgez la suivante.';
  const heroCopy = selectedAgent
    ? isShortViewport
      ? selectedAgent.tagline || selectedAgent.summary
      : selectedAgent.summary || selectedAgent.tagline
    : '';

  const recentAgents = useMemo(() => {
    const source = filteredAgents.length > 0 ? filteredAgents : agents;
    const withoutSelected = selectedAgent
      ? source.filter((agent) => agent.id !== selectedAgent.id)
      : source;
    const recentCount = isDesktopScene ? (isShortViewport ? 1 : 2) : 2;

    return (withoutSelected.length > 0 ? withoutSelected : source).slice(0, recentCount);
  }, [agents, filteredAgents, isDesktopScene, isShortViewport, selectedAgent]);

  const selectedMeta = selectedAgent ? getAgentAppMeta(selectedAgent) : null;
  const selectedPalette = selectedAgent ? getAgentPalette(selectedAgent) : null;
  const SelectedIcon = selectedMeta?.icon || LayoutTemplate;
  const pageColumnsClass = getHubPageColumns(pageSize);
  const hasSearchResults = filteredAgents.length > 0;
  const hasCreationRun = Boolean(creationRun);
  const creationPreviewAgent = useMemo(() => buildCreationPreviewAgent(creationRun || null), [creationRun]);
  const creationSourceSnippet = useMemo(() => {
    const source = creationRun?.sourceCode?.trim();
    if (!source) return null;
    const lines = source.split('\n');
    return {
      lineCount: lines.length,
      snippet: lines.slice(0, 8).join('\n'),
    };
  }, [creationRun?.sourceCode]);
  const latestCreationPhase = creationRun?.phases[creationRun.phases.length - 1];

  const submit = async () => {
    const cleanedBrief = brief.trim();
    const cleanedNotes = creationNotes.trim();
    if (!cleanedBrief || isCreating) return;

    if (!creationClarification) {
      const clarification = buildCreationClarification(
        creationType,
        [cleanedBrief, cleanedNotes].filter(Boolean).join('\n')
      );
      if (clarification) {
        setCreationClarification(clarification);
        setSelectedClarificationId(clarification.recommendedId);
        return;
      }
    }

    const selectedOption = creationClarification?.options.find((option) => option.id === selectedClarificationId);
    const cleanedCustomClarification = customClarification.trim();

    const assembledPrompt = [
      `Type d'application cible: ${creationType}`,
      cleanedBrief,
      cleanedNotes ? `Structure, fonctionnalites ou design:\n${cleanedNotes}` : '',
      selectedOption ? `Direction validee avant generation:\n${selectedOption.prompt}` : '',
      cleanedCustomClarification ? `Autre direction imposee par l'utilisateur:\n${cleanedCustomClarification}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    await onCreateAgent(assembledPrompt);
    setBrief('');
    setCreationNotes('');
    setCreationClarification(null);
    setSelectedClarificationId(null);
    setCustomClarification('');
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
              <div className="mx-auto grid min-h-full max-w-[1520px] gap-5 xl:h-full xl:grid-cols-[minmax(0,1fr)_388px] xl:gap-6">
                <section className={cn('grid min-h-0 gap-5 xl:grid-rows-[minmax(0,1fr)_auto] xl:gap-6', hasCreationRun ? 'order-last xl:order-none' : '')}>
                  <div className="relative overflow-hidden rounded-[2.35rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.015))] px-6 py-6 shadow-[0_34px_110px_-58px_rgba(0,0,0,0.92)] sm:px-9 sm:py-8">
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

                    <div className={cn(
                      'relative z-10 flex h-full flex-col items-center justify-center text-center xl:min-h-0',
                      isShortViewport ? 'min-h-[17.5rem] sm:min-h-[18.5rem]' : 'min-h-[19rem] sm:min-h-[21rem]'
                    )}>
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
                            <h1 className={cn(
                              'mt-4 text-balance font-semibold leading-[0.92] tracking-[-0.065em] text-white',
                              isShortViewport
                                ? 'max-w-[13ch] text-[clamp(1.9rem,4vw,3.2rem)]'
                                : 'max-w-[11ch] text-[clamp(2.3rem,5vw,4.45rem)]'
                            )}>
                              {heroTitle}
                            </h1>
                            <p className="mt-4 max-w-[34rem] text-pretty text-sm leading-7 text-white/56 sm:text-[15px]">
                              {heroCopy}
                            </p>

                            <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/70">
                                <SelectedIcon size={14} style={{ color: selectedPalette?.accent }} />
                                {selectedMeta?.label}
                              </span>
                              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/56">
                                {selectedAgent.name}
                              </span>
                              <span className="inline-flex rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.2em] text-white/56">
                                {filteredAgents.length} app{filteredAgents.length > 1 ? 's' : ''}
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

                  <div className={cn(
                    'rounded-[2.1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.018))] px-4 py-4 shadow-[0_34px_100px_-56px_rgba(0,0,0,0.86)] backdrop-blur-xl sm:px-5',
                    isShortViewport ? 'sm:py-4' : 'sm:py-5'
                  )}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/34">
                          Mon studio d'applications d'IA
                        </div>
                        <div className="mt-1 text-sm leading-6 text-white/56">
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
                          className={cn('mt-5 grid gap-4', pageColumnsClass)}
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
                                  'flex min-h-[15.75rem] flex-col rounded-[1.75rem] border p-5 transition-all duration-300',
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
                                    <div className="min-w-0 flex-1">
                                      <div className="text-pretty text-[1.28rem] font-semibold leading-[1.05] tracking-[-0.035em] text-white">
                                        {agent.name}
                                      </div>
                                      <div className="mt-2 text-[12px] uppercase tracking-[0.2em] text-white/42">
                                        {meta.spotlight}
                                      </div>
                                    </div>
                                  </div>

                                  <p className="mt-5 text-sm leading-7 text-white/56">
                                    {agent.summary || agent.tagline}
                                  </p>

                                  <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
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
                                    'mt-5 inline-flex h-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-all',
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
                <aside className={cn(
                  'flex min-h-0 flex-col rounded-[2.1rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-4 shadow-[0_34px_100px_-56px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:p-5',
                  hasCreationRun ? 'order-first xl:order-none' : ''
                )}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">
                        Laboratoire de co-creation d'applications
                      </div>
                      <h2 className="mt-3 max-w-[12ch] text-[1.72rem] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
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
                    className="mt-5 rounded-[1.7rem] border border-white/10 bg-black/18 p-4"
                  >
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/40">
                          {hasCreationRun ? 'Nouvelle vision' : 'Vision'}
                        </span>
                        <textarea
                          value={brief}
                          onChange={(event) => setBrief(event.target.value)}
                          rows={hasCreationRun ? 2 : isShortViewport ? 3 : 4}
                          placeholder="Ex: un studio podcast qui cherche, ecrit, narre et livre un master final."
                          className={cn(
                            'w-full resize-none rounded-[1.35rem] border border-white/8 bg-white/[0.04] px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/30',
                            hasCreationRun ? 'min-h-[4.6rem]' : isShortViewport ? 'min-h-[6rem]' : 'min-h-[7.4rem]'
                          )}
                        />
                      </label>

                      {!hasCreationRun && (
                        <>
                          <label className="block">
                            <span className="mb-2 block text-[11px] uppercase tracking-[0.2em] text-white/40">
                              Contraintes
                            </span>
                            <textarea
                              value={creationNotes}
                              onChange={(event) => setCreationNotes(event.target.value)}
                              rows={isShortViewport ? 2 : 3}
                              placeholder="Fonctions, ton, design, livrable, moteurs ou limites."
                              className={cn(
                                'w-full resize-none rounded-[1.35rem] border border-white/8 bg-white/[0.03] px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/30',
                                isShortViewport ? 'min-h-[4.3rem]' : 'min-h-[5.5rem]'
                              )}
                            />
                          </label>

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
                        </>
                      )}

                      <button
                        type="submit"
                        disabled={
                          isCreating
                          || !brief.trim()
                          || (Boolean(creationClarification) && !selectedClarificationId)
                          || (selectedClarificationId === 'other' && !customClarification.trim())
                        }
                        className={cn(
                          'flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all',
                          isCreating
                          || !brief.trim()
                          || (Boolean(creationClarification) && !selectedClarificationId)
                          || (selectedClarificationId === 'other' && !customClarification.trim())
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
                            {creationClarification
                              ? 'Valider et generer l app'
                              : hasCreationRun
                                ? 'Lancer une autre app'
                                : "Lancer l'assistant co-createur"}
                          </>
                        )}
                      </button>
                    </div>
                  </form>

                  {creationClarification && (
                    <div className="mt-5 rounded-[1.7rem] border border-cyan-300/12 bg-cyan-300/[0.05] p-4">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-[1rem] border border-cyan-300/16 bg-cyan-300/[0.08] text-cyan-100">
                          <Sparkles size={14} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-100/68">
                            Cadrage avant generation
                          </div>
                          <div className="mt-2 text-sm font-semibold text-white">
                            {creationClarification.question}
                          </div>
                          <p className="mt-2 text-sm leading-6 text-white/62">
                            {creationClarification.helpText}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 space-y-3">
                        {creationClarification.options.map((option) => {
                          const isSelected = selectedClarificationId === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setSelectedClarificationId(option.id)}
                              className={cn(
                                'w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all',
                                isSelected
                                  ? 'border-cyan-300/34 bg-cyan-300/[0.12]'
                                  : 'border-white/10 bg-black/18 hover:border-white/18 hover:bg-white/[0.04]'
                              )}
                            >
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-white">{option.label}</span>
                                {option.recommended && (
                                  <span className="rounded-full border border-cyan-300/26 bg-cyan-300/[0.12] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-cyan-50/86">
                                    recommande
                                  </span>
                                )}
                              </div>
                              <p className="mt-2 text-sm leading-6 text-white/66">{option.description}</p>
                              <p className="mt-2 text-xs leading-5 text-white/46">{option.why}</p>
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          onClick={() => setSelectedClarificationId('other')}
                          className={cn(
                            'w-full rounded-[1.35rem] border px-4 py-4 text-left transition-all',
                            selectedClarificationId === 'other'
                              ? 'border-cyan-300/34 bg-cyan-300/[0.12]'
                              : 'border-white/10 bg-black/18 hover:border-white/18 hover:bg-white/[0.04]'
                          )}
                        >
                          <div className="text-sm font-semibold text-white">Autre direction</div>
                          <p className="mt-2 text-sm leading-6 text-white/66">
                            Imposer une forme d app qui n est pas dans les trois directions proposees.
                          </p>
                        </button>

                        {selectedClarificationId === 'other' && (
                          <textarea
                            value={customClarification}
                            onChange={(event) => setCustomClarification(event.target.value)}
                            rows={3}
                            placeholder="Decris exactement la direction produit a imposer avant la generation."
                            className="w-full resize-none rounded-[1.3rem] border border-white/10 bg-black/22 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/28 focus:border-cyan-300/30"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  {creationRun && (
                    <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">
                            Creation visible
                          </div>
                          <div className="mt-1 text-sm font-semibold text-white">
                            {creationRun.status === 'completed'
                              ? 'App prête dans le studio'
                              : creationRun.status === 'failed'
                                ? 'Creation interrompue'
                                : latestCreationPhase?.label || 'Cowork construit la draft'}
                          </div>
                        </div>
                        <span
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em]',
                            creationRun.status === 'completed'
                              ? 'border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-50/84'
                              : creationRun.status === 'failed'
                                ? 'border-rose-300/18 bg-rose-300/[0.08] text-rose-50/84'
                                : 'border-cyan-300/16 bg-cyan-300/[0.08] text-cyan-50/84'
                          )}
                        >
                          {creationRun.status === 'running' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                          {creationRun.status}
                        </span>
                      </div>

                      {creationPreviewAgent && (
                        <div className="mt-4 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/18">
                          <AgentAppPreview
                            agent={creationPreviewAgent}
                            size="feature"
                            className={cn('min-h-[14rem]', isShortViewport && 'min-h-[12rem]')}
                          />
                        </div>
                      )}

                      {creationRun.phases.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {creationRun.phases.map((phase, index) => {
                            const isLast = index === creationRun.phases.length - 1;
                            const failedStep = phase.phase === 'bundle_failed' || creationRun.status === 'failed';

                            return (
                              <div key={`${phase.phase}-${phase.timestamp || index}`} className="flex items-start gap-3">
                                <div className="flex flex-col items-center">
                                  <span
                                    className={cn(
                                      'flex h-8 w-8 items-center justify-center rounded-full border',
                                      failedStep
                                        ? 'border-rose-300/18 bg-rose-300/[0.08] text-rose-100'
                                        : 'border-cyan-300/16 bg-cyan-300/[0.08] text-cyan-100'
                                    )}
                                  >
                                    {failedStep ? (
                                      <AlertTriangle size={14} />
                                    ) : creationRun.status === 'running' && isLast ? (
                                      <Loader2 size={14} className="animate-spin" />
                                    ) : (
                                      <CheckCircle2 size={14} />
                                    )}
                                  </span>
                                  {!isLast && <span className="mt-2 h-6 w-px bg-white/10" />}
                                </div>
                                <div className="min-w-0 pb-2">
                                  <div className="text-sm font-medium text-white/88">{phase.label}</div>
                                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/36">
                                    {phase.phase.replace(/_/g, ' ')}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {(creationSourceSnippet || creationRun.buildLog || creationRun.error) && (
                        <div className="mt-4 grid gap-3">
                          {creationSourceSnippet && (
                            <div className="rounded-[1.25rem] border border-white/10 bg-black/18 p-4">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">Source</div>
                                <div className="text-[11px] uppercase tracking-[0.18em] text-white/44">
                                  {creationSourceSnippet.lineCount} lignes
                                </div>
                              </div>
                              <pre className="mt-3 overflow-x-auto text-xs leading-6 text-white/66">
                                {creationSourceSnippet.snippet}
                              </pre>
                            </div>
                          )}

                          {(creationRun.buildLog || creationRun.error) && (
                            <div className="rounded-[1.25rem] border border-white/10 bg-black/18 p-4">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-white/38">
                                {creationRun.status === 'failed' ? 'Erreur' : 'Diagnostic bundle'}
                              </div>
                              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs leading-6 text-white/66">
                                {creationRun.error || creationRun.buildLog}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {creationRun.status === 'completed' && latestCreatedAgent && (
                        <button
                          type="button"
                          onClick={() => void launchAgent(latestCreatedAgent)}
                          disabled={isRunningAgent}
                          className={cn(
                            'mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all',
                            isRunningAgent
                              ? 'cursor-not-allowed bg-white/8 text-white/35'
                              : 'bg-[linear-gradient(180deg,rgba(232,240,255,0.92),rgba(174,188,214,0.9))] text-[#07121d] hover:-translate-y-[1px]'
                          )}
                        >
                          {isRunningAgent ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                          Ouvrir le studio
                        </button>
                      )}
                    </div>
                  )}

                  {!isShortViewport && (
                    <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-[1.7rem] border border-white/10 bg-black/18 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.22em] text-white/34">
                            Derniers projets collaboratifs
                          </div>
                          <div className="mt-1 text-sm leading-6 text-white/50">
                            Une vue rapide sur les surfaces les plus recentes du studio.
                          </div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/60">
                          {agents.length}
                        </div>
                      </div>

                      <div className={cn('mt-4 grid gap-3', isDesktopScene ? 'grid-rows-2' : 'grid-cols-1')}>
                        {recentAgents.map((agent) => {
                          const meta = getAgentAppMeta(agent);
                          const palette = getAgentPalette(agent);
                          const Icon = meta.icon;

                          return (
                            <button
                              key={agent.id}
                              type="button"
                              onClick={() => setSelectedId(agent.id)}
                              className="group rounded-[1.3rem] border border-white/10 bg-white/[0.03] px-3.5 py-3.5 text-left transition-all hover:border-white/16 hover:bg-white/[0.05]"
                            >
                              <div className="flex items-start gap-3">
                                <div
                                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem] border"
                                  style={{ borderColor: palette.rim, background: palette.accentSoft }}
                                >
                                  <Icon size={15} style={{ color: palette.accent }} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold leading-5 text-white">{agent.name}</div>
                                  <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/42">
                                    {meta.category}
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
                  )}
                </aside>
              </div>
            </main>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  );
};
