import React, { Suspense, useState, useEffect, useRef, useCallback } from 'react';
import { 
  MessageSquare, Plus, Send, 
  Bot, User, Database, Image as ImageIcon, 
  Film, Mic, Sparkles, Globe, SlidersHorizontal, Paperclip,
  Loader2, ChevronRight, X, Youtube, FileText, Music, Video, BrainCircuit, ChevronDown, AlertCircle,
  Menu, LogOut, LogIn, Play, Check, Zap, Crown, Gauge, Copy, Pencil, RotateCcw, Square, Brain, History,
  Search, Download
} from 'lucide-react';

import {
  auth, db, googleProvider, signInWithPopup, onAuthStateChanged,
  doc, collection, collectionGroup, onSnapshot, query, where, orderBy, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs,
  OperationType, handleFirestoreError, User as FirebaseUser, cleanForFirestore
} from './firebase';
import { limit } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from './store/useStore';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { ChatInput } from './components/ChatInput';
import { MessageItem } from './components/MessageItem';
import { StudioEmptyState } from './components/StudioEmptyState';
import { Message, ChatSession, AppMode, Attachment, AttachmentType, SystemPromptVersion, StudioAgent, AgentBlueprint, AgentFormValues, GeneratedAppCreationEvent, GeneratedAppCreationRun, GeneratedAppCreationTranscriptTurn, GeneratedAppManifest, SelectedCustomPromptRef, WorkspaceFile } from './types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  applyCoworkEventToMessage,
  clearCoworkSessionSnapshots,
  CoworkStreamEvent,
  createEmptyRunMeta,
  hydrateCoworkMessages,
  sanitizeCoworkMessageForStorage,
  saveCoworkSessionSnapshot,
} from './utils/cowork';
import {
  clearSessionSnapshots,
  hydrateSessionMessages,
  saveSessionSnapshot,
} from './utils/sessionSnapshots';
import {
  buildRecoveredSessionShell,
  normalizeRecoveredMessage,
} from './utils/sessionRecovery';
import {
  loadLocalSessionShells,
  mergeSessionsWithLocal,
  saveLocalSessionShell,
} from './utils/sessionShells';
import {
  loadLocalAgents,
  mergeAgentsWithLocal,
  normalizeAgent,
  saveLocalAgent,
} from './utils/agentSnapshots';
import {
  loadLocalGeneratedApps,
  mergeGeneratedAppsWithLocal,
  normalizeGeneratedApp,
  saveLocalGeneratedApp,
} from './utils/generatedAppSnapshots';
import {
  buildApiAttachmentPayloads,
  buildApiHistoryFromMessages,
} from './utils/chat-parts';
import { resolveAgentStudioKind } from './utils/agentStudio';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AgentWorkspacePanel = React.lazy(async () => {
  const module = await import('./components/AgentWorkspacePanel');
  return { default: module.AgentWorkspacePanel };
});

const AgentsHub = React.lazy(async () => {
  const module = await import('./components/AgentsHub');
  return { default: module.AgentsHub };
});

const GeneratedAppHost = React.lazy(async () => {
  const module = await import('./components/GeneratedAppHost');
  return { default: module.GeneratedAppHost };
});

const ImageStudio = React.lazy(async () => {
  const module = await import('./components/ImageStudio');
  return { default: module.ImageStudio };
});

const VideoStudio = React.lazy(async () => {
  const module = await import('./components/VideoStudio');
  return { default: module.VideoStudio };
});

const AudioStudio = React.lazy(async () => {
  const module = await import('./components/AudioStudio');
  return { default: module.AudioStudio };
});

const LyriaStudio = React.lazy(async () => {
  const module = await import('./components/LyriaStudio');
  return { default: module.LyriaStudio };
});

const NasheedStudioWorkspace = React.lazy(async () => {
  const module = await import('./components/NasheedStudioWorkspace');
  return { default: module.NasheedStudioWorkspace };
});

const StudioSurfaceFallback: React.FC<{ label: string }> = ({ label }) => (
  <div className="studio-panel-strong flex min-h-[18rem] w-full items-center justify-center rounded-[2rem] border border-[var(--app-border)] bg-[var(--app-surface-strong)]/90 px-6 py-8 text-center">
    <div className="flex flex-col items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--app-border-strong)] bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
        <Loader2 size={18} className="animate-spin" />
      </div>
      <div className="text-sm font-medium text-[var(--app-text)]">{label}</div>
      <div className="text-xs uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
        chargement progressif
      </div>
    </div>
  </div>
);

const hasRenderableMessage = (message: Message) =>
  Boolean(
    message.content?.trim()
    || message.thoughts?.trim()
    || message.audio
    || message.video
    || (Array.isArray(message.images) && message.images.length > 0)
    || (Array.isArray(message.thoughtImages) && message.thoughtImages.length > 0)
    || (Array.isArray(message.attachments) && message.attachments.length > 0)
    || (Array.isArray(message.activity) && message.activity.length > 0)
  );

const LEGACY_COWORK_SYSTEM_INSTRUCTION = "Tu es un agent autonome en mode Cowork. Tu as accès à des outils pour accomplir des tâches complexes. Analyse, propose et exécute.";
const createClientMessageId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const MESSAGE_VISIBILITY_LIMIT = 15;
const AUTO_SCROLL_BOTTOM_THRESHOLD = 96;
const slugifyAgentLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agent-studio';

const buildAgentRuntimeFormValues = (agent: StudioAgent, values: AgentFormValues): AgentFormValues => {
  const uiSchema = Array.isArray(agent.uiSchema) ? agent.uiSchema : [];
  const normalizedEntries = (uiSchema.length > 0 ? uiSchema : [{
    id: 'missionBrief',
    label: 'Brief libre',
    type: 'textarea',
  }]).map((field) => {
    const rawValue = values[field.id];
    if (field.type === 'boolean') {
      return [field.id, Boolean(rawValue)] as const;
    }

    return [field.id, typeof rawValue === 'string' ? rawValue : ''] as const;
  });

  return Object.fromEntries(normalizedEntries);
};

const adaptGeneratedAppToStudioAgent = (app: GeneratedAppManifest): StudioAgent => {
  const normalizedApp = normalizeGeneratedApp(app);

  return {
    id: normalizedApp.id,
    name: normalizedApp.name,
    slug: normalizedApp.slug,
    tagline: normalizedApp.tagline,
    summary: normalizedApp.summary,
    mission: normalizedApp.mission,
    whenToUse: normalizedApp.whenToUse,
    outputKind: normalizedApp.outputKind,
    starterPrompt: normalizedApp.starterPrompt,
    systemInstruction: normalizedApp.systemInstruction,
    uiSchema: normalizedApp.uiSchema,
    tools: normalizedApp.toolAllowList,
    capabilities: normalizedApp.capabilities,
    status: normalizedApp.status === 'failed' ? 'draft' : 'ready',
    createdBy: normalizedApp.createdBy,
    sourcePrompt: normalizedApp.sourcePrompt,
    sourceSessionId: normalizedApp.sourceSessionId,
    createdAt: normalizedApp.createdAt,
    updatedAt: normalizedApp.updatedAt,
  };
};

const formatAgentFormValues = (agent: StudioAgent, values: AgentFormValues) =>
  Object.entries(buildAgentRuntimeFormValues(agent, values))
    .filter(([, value]) => typeof value === 'boolean' || String(value).trim().length > 0)
    .map(([fieldId, value]) => {
      const fieldLabel = agent.uiSchema.find(field => field.id === fieldId)?.label
        || (fieldId === 'missionBrief' ? 'Brief libre' : fieldId);
      return `- ${fieldLabel}: ${typeof value === 'boolean' ? (value ? 'oui' : 'non') : String(value).trim()}`;
    });

const buildAgentLaunchPrompt = (agent: StudioAgent, values: AgentFormValues) => {
  const formattedValues = formatAgentFormValues(agent, values);

  return [
    agent.starterPrompt || `Prends en charge la mission de ${agent.name}.`,
    formattedValues.length > 0 ? `Parametres de l'interface:\n${formattedValues.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
};

const buildGeneratedAppLaunchPrompt = (app: GeneratedAppManifest, values: AgentFormValues) => {
  const formattedValues = Object.entries(values)
    .filter(([, value]) => typeof value === 'boolean' || String(value || '').trim().length > 0)
    .map(([fieldId, value]) => {
      const fieldLabel = app.uiSchema.find(field => field.id === fieldId)?.label || fieldId;
      return `- ${fieldLabel}: ${typeof value === 'boolean' ? (value ? 'oui' : 'non') : String(value).trim()}`;
    });
  const identityBlock = [
    app.identity?.mission ? `Mission: ${app.identity.mission}` : '',
    app.identity?.posture ? `Posture: ${app.identity.posture}` : '',
    Array.isArray(app.identity?.successCriteria) && app.identity.successCriteria.length > 0
      ? `Criteres de reussite:\n${app.identity.successCriteria.map((item) => `- ${item}`).join('\n')}`
      : '',
  ].filter(Boolean).join('\n');

  return [
    app.starterPrompt || `Prends en charge la mission de ${app.name}.`,
    identityBlock,
    formattedValues.length > 0 ? `Parametres de l'interface:\n${formattedValues.join('\n')}` : '',
  ].filter(Boolean).join('\n\n');
};

const buildGeneratedAppRemotePayload = (manifest: GeneratedAppManifest): GeneratedAppManifest => ({
  ...manifest,
  draftVersion: {
    ...manifest.draftVersion,
    sourceCode: manifest.draftVersion.sourceUrl ? '' : manifest.draftVersion.sourceCode,
    bundleCode: manifest.draftVersion.bundleUrl ? undefined : manifest.draftVersion.bundleCode,
  },
  publishedVersion: manifest.publishedVersion
    ? {
        ...manifest.publishedVersion,
        sourceCode: manifest.publishedVersion.sourceUrl ? '' : manifest.publishedVersion.sourceCode,
        bundleCode: manifest.publishedVersion.bundleUrl ? undefined : manifest.publishedVersion.bundleCode,
      }
    : undefined,
});

const GENERATED_APP_CREATION_PHASES: GeneratedAppCreationEvent['phase'][] = [
  'brief_validated',
  'clarification_requested',
  'clarification_resolved',
  'spec_ready',
  'source_ready',
  'bundle_ready',
  'bundle_skipped',
  'bundle_failed',
  'manifest_ready',
];

const isGeneratedAppCreationEvent = (value: unknown): value is GeneratedAppCreationEvent => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return typeof input.label === 'string'
    && typeof input.phase === 'string'
    && GENERATED_APP_CREATION_PHASES.includes(input.phase as GeneratedAppCreationEvent['phase']);
};

const isGeneratedAppManifestEnvelope = (value: unknown): value is { manifest: GeneratedAppManifest } => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return Boolean(input.manifest && typeof input.manifest === 'object');
};

const isGeneratedAppClarificationEnvelope = (
  value: unknown
): value is { question: string; transcript?: GeneratedAppCreationTranscriptTurn[] } => {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return typeof input.question === 'string';
};

const applyGeneratedAppCreationEvent = (
  current: GeneratedAppCreationRun | null,
  event: GeneratedAppCreationEvent
): GeneratedAppCreationRun => {
  const awaitingClarification = event.phase === 'clarification_requested'
    ? true
    : event.phase === 'clarification_resolved'
      ? false
      : current?.awaitingClarification || false;

  const clarificationQuestion = event.phase === 'clarification_requested'
    ? (event.clarificationQuestion || event.label)
    : event.phase === 'clarification_resolved'
      ? undefined
      : current?.clarificationQuestion;

  return {
    status: 'running',
    startedAt: current?.startedAt || event.timestamp || Date.now(),
    phases: [...(current?.phases || []), event],
    manifestPreview: event.manifestPreview || current?.manifestPreview,
    sourceCode: event.sourceCode || current?.sourceCode,
    buildLog: event.buildLog || current?.buildLog,
    manifest: current?.manifest,
    transcript: event.transcript || current?.transcript,
    awaitingClarification,
    clarificationQuestion,
  };
};

const isScrolledNearBottom = (element: HTMLElement, threshold = AUTO_SCROLL_BOTTOM_THRESHOLD) =>
  element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;

export default function App() {
  const { 
    activeMode, setActiveMode, activeSessionId, setActiveSessionId, 
    lastSessionIdsByMode,
    configs, setConfig, isLeftSidebarVisible, setLeftSidebarVisible,
    isRightSidebarVisible, setRightSidebarVisible, theme, 
    isPromptRefinerEnabled, setPromptRefinerEnabled
  } = useStore();
  const config = configs[activeMode];

  // Handle theme class on root element
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'oled');
    if (theme === 'light') root.classList.add('light');
    if (theme === 'oled') root.classList.add('oled');
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const syncVisibility = () => {
      if (media.matches) {
        setLeftSidebarVisible(false);
        setRightSidebarVisible(false);
      }
    };

    syncVisibility();
    media.addEventListener('change', syncVisibility);
    return () => media.removeEventListener('change', syncVisibility);
  }, [setLeftSidebarVisible, setRightSidebarVisible]);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [agents, setAgents] = useState<StudioAgent[]>([]);
  const [generatedApps, setGeneratedApps] = useState<GeneratedAppManifest[]>([]);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);
  const [isVertexConfigured, setIsVertexConfigured] = useState<boolean | null>(null);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [expandedThoughts, setExpandedThoughts] = useState<Record<string, boolean>>({});
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [currentMessages, setCurrentMessages] = useState<Message[]>([]);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [streamingThoughts, setStreamingThoughts] = useState<string>('');
  const [streamingThoughtsExpanded, setStreamingThoughtsExpanded] = useState<boolean>(true);
  const [refiningStatus, setRefiningStatus] = useState<string | null>(null);
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [recentlyCompletedMessageId, setRecentlyCompletedMessageId] = useState<string | null>(null);
  const [liveCoworkMessage, setLiveCoworkMessage] = useState<Message | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [showAgentsHub, setShowAgentsHub] = useState(false);
  const [latestCreatedAgent, setLatestCreatedAgent] = useState<StudioAgent | null>(null);
  const [latestCreatedGeneratedApp, setLatestCreatedGeneratedApp] = useState<GeneratedAppManifest | null>(null);
  const [generatedAppCreationRun, setGeneratedAppCreationRun] = useState<GeneratedAppCreationRun | null>(null);
  const [agentsWarning, setAgentsWarning] = useState<string | null>(null);
  const [isRunningHubAgent, setIsRunningHubAgent] = useState(false);
  const [isPublishingGeneratedApp, setIsPublishingGeneratedApp] = useState(false);
  const [hasLoadedRemoteSessions, setHasLoadedRemoteSessions] = useState(false);
  const [hasLoadedRemoteAgents, setHasLoadedRemoteAgents] = useState(false);
  const [hasLoadedRemoteGeneratedApps, setHasLoadedRemoteGeneratedApps] = useState(false);
  const [selectedCustomPrompt, setSelectedCustomPrompt] = useState<SelectedCustomPromptRef | null>(null);

  const activeSessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const liveCoworkMessageRef = useRef<Message | null>(null);
  const coworkFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coworkFlushTargetRef = useRef<{ userId: string; sessionId: string } | null>(null);
  const coworkStorageModeRef = useRef<'rich' | 'legacy'>('rich');
  const coworkStorageWarningShownRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const handleSendRuntimeRef = useRef<((text: string, overrideMessages?: Message[], runtimeSessionOverride?: ChatSession) => Promise<void>) | null>(null);
  const sessionRepairAttemptedRef = useRef<Record<string, boolean>>({});

  const activeSessionFromList = sessions.find(s => s.id === activeSessionId) || null;
  const activeSession = activeSessionFromList || {
    id: 'local-new', 
    title: customTitle || 'Nouvelle conversation', 
    messages: [], 
    updatedAt: Date.now(), 
    mode: activeMode, 
    userId: user?.uid || '', 
    systemInstruction: config?.systemInstruction || configs.chat?.systemInstruction || '',
    selectedCustomPrompt: selectedCustomPrompt || undefined,
    sessionKind: 'standard' as const,
  };

  const isAgentSession = activeSession.sessionKind === 'agent' && Boolean(activeSession.agentWorkspace);
  const isGeneratedAppSession = activeSession.sessionKind === 'generated_app' && Boolean(activeSession.generatedAppWorkspace);
  const richSessionUsesCoworkSnapshots = activeMode === 'cowork' || isAgentSession || isGeneratedAppSession;

  const activeAgentWorkspace = React.useMemo(() => {
    if (activeSession.sessionKind !== 'agent' || !activeSession.agentWorkspace) return null;

    const sessionAgent = normalizeAgent(activeSession.agentWorkspace.agent);
    const latestAgent = agents.find(agent => agent.id === sessionAgent.id)
      || sessionAgent;

    return {
      ...activeSession.agentWorkspace,
      agent: latestAgent,
      formValues: buildAgentRuntimeFormValues(latestAgent, activeSession.agentWorkspace.formValues || {}),
    };
  }, [activeSession, agents]);
  const activeAgentStudioKind = activeAgentWorkspace
    ? resolveAgentStudioKind(activeAgentWorkspace.agent)
    : 'default';
  const activeGeneratedAppWorkspace = React.useMemo(() => {
    if (activeSession.sessionKind !== 'generated_app' || !activeSession.generatedAppWorkspace) return null;

    const sessionApp = normalizeGeneratedApp(activeSession.generatedAppWorkspace.app);
    const latestApp = generatedApps.find(app => app.id === sessionApp.id)
      || sessionApp;

    return {
      ...activeSession.generatedAppWorkspace,
      app: latestApp,
      formValues: buildAgentRuntimeFormValues(adaptGeneratedAppToStudioAgent(latestApp), activeSession.generatedAppWorkspace.formValues || {}),
    };
  }, [activeSession, generatedApps]);

  useEffect(() => {
    if (!user) {
      setSelectedCustomPrompt(null);
      return;
    }

    if (activeSessionFromList?.selectedCustomPrompt) {
      setSelectedCustomPrompt(activeSessionFromList.selectedCustomPrompt);
      return;
    }

    if (activeSessionId && activeSessionId !== 'local-new') {
      setSelectedCustomPrompt(null);
    }
  }, [
    activeSessionFromList?.id,
    activeSessionFromList?.selectedCustomPrompt?.id,
    activeSessionFromList?.selectedCustomPrompt?.title,
    activeSessionFromList?.selectedCustomPrompt?.prompt,
    activeSessionFromList?.selectedCustomPrompt?.iconUrl,
    activeSessionId,
    user,
  ]);

  const materializeAgentBlueprint = useCallback((blueprint: AgentBlueprint, overrides?: Partial<StudioAgent>): StudioAgent => {
    const now = Date.now();
    const baseSlug = slugifyAgentLabel(blueprint.slug || blueprint.name || 'agent-studio');
    const id = blueprint.id || `${baseSlug}-${now.toString(36)}`;

    return normalizeAgent({
      ...blueprint,
      ...overrides,
      id,
      slug: baseSlug,
      name: blueprint.name || overrides?.name || 'App Cowork',
      tagline: blueprint.tagline || overrides?.tagline || 'App prete a ouvrir',
      summary: blueprint.summary || overrides?.summary || 'Blueprint genere par Cowork.',
      mission: blueprint.mission || overrides?.mission || blueprint.summary || 'Mission a preciser.',
      whenToUse: blueprint.whenToUse || overrides?.whenToUse || 'A utiliser quand tu veux deleguer une mission recurrente.',
      starterPrompt: blueprint.starterPrompt || overrides?.starterPrompt || `Prends en charge cette mission dans l'app ${blueprint.name || 'Cowork'}.`,
      systemInstruction: blueprint.systemInstruction || overrides?.systemInstruction || `Tu es ${blueprint.name || 'une app Cowork specialisee'}.`,
      outputKind: blueprint.outputKind || overrides?.outputKind || 'research',
      uiSchema: Array.isArray(blueprint.uiSchema) ? blueprint.uiSchema : [],
      tools: Array.isArray(blueprint.tools) ? blueprint.tools : [],
      capabilities: Array.isArray(blueprint.capabilities) ? blueprint.capabilities : [],
      status: blueprint.status || overrides?.status || 'ready',
      createdBy: overrides?.createdBy || blueprint.createdBy || 'manual',
      sourcePrompt: overrides?.sourcePrompt ?? blueprint.sourcePrompt,
      sourceSessionId: overrides?.sourceSessionId ?? blueprint.sourceSessionId,
      createdAt: overrides?.createdAt || now,
      updatedAt: now,
    });
  }, []);

  const persistAgentBlueprint = useCallback(async (
    blueprint: AgentBlueprint,
    overrides?: Partial<StudioAgent> & { openHub?: boolean }
  ) => {
    if (!user) return null;

    const { openHub, ...materialOverrides } = overrides || {};
    const nextAgent = materializeAgentBlueprint(blueprint, materialOverrides);

    setAgents(prev => {
      const withoutCurrent = prev.filter(agent => agent.id !== nextAgent.id);
      return [nextAgent, ...withoutCurrent].sort((left, right) => right.updatedAt - left.updatedAt);
    });

    setLatestCreatedAgent(nextAgent);
    if (openHub) {
      setShowAgentsHub(true);
    }

    saveLocalAgent(user.uid, nextAgent);

    try {
      await setDoc(
        doc(db, 'users', user.uid, 'agents', nextAgent.id),
        cleanForFirestore(nextAgent)
      );
    } catch (error) {
      console.error('Agent persistence degraded, keeping local snapshot only:', error);
      setAgentsWarning("Cowork Apps ne peut pas se synchroniser avec Firestore pour l'instant. Les apps restent disponibles sur cet appareil.");
    }

    return nextAgent;
  }, [materializeAgentBlueprint, user]);

  const persistGeneratedAppManifest = useCallback(async (
    manifest: GeneratedAppManifest,
    options?: { openHub?: boolean }
  ) => {
    if (!user) return null;

    const nextManifest = normalizeGeneratedApp({
      ...manifest,
      updatedAt: Number(manifest.updatedAt || Date.now()),
      createdAt: Number(manifest.createdAt || Date.now()),
    });

    setGeneratedApps(prev => {
      const withoutCurrent = prev.filter(app => app.id !== nextManifest.id);
      return [nextManifest, ...withoutCurrent].sort((left, right) => right.updatedAt - left.updatedAt);
    });

    setLatestCreatedGeneratedApp(nextManifest);
    if (options?.openHub) {
      setShowAgentsHub(true);
    }

    saveLocalGeneratedApp(user.uid, nextManifest);

    try {
      await setDoc(
        doc(db, 'users', user.uid, 'generatedApps', nextManifest.id),
        cleanForFirestore(buildGeneratedAppRemotePayload(nextManifest))
      );
    } catch (error) {
      console.error('Generated app persistence degraded, keeping local snapshot only:', error);
      setAgentsWarning("Cowork Apps ne peut pas se synchroniser completement avec Firestore pour l'instant. Les apps restent disponibles sur cet appareil.");
    }

    return nextManifest;
  }, [user]);

  const displayedMessages = React.useMemo(() => {
    const merged = new Map<string, Message>();

    for (const message of currentMessages) {
      merged.set(message.id, message);
    }
    for (const message of optimisticMessages) {
      merged.set(message.id, message);
    }
    if (liveCoworkMessage && coworkFlushTargetRef.current?.sessionId === activeSessionId) {
      merged.set(liveCoworkMessage.id, liveCoworkMessage);
    }

    return Array.from(merged.values()).sort((a, b) => a.createdAt - b.createdAt);
  }, [activeSessionId, currentMessages, optimisticMessages, liveCoworkMessage]);
  const hiddenMessagesCount = Math.max(0, displayedMessages.length - MESSAGE_VISIBILITY_LIMIT);
  const visibleMessageOffset = hiddenMessagesCount;
  const visibleMessages = React.useMemo(
    () => (hiddenMessagesCount > 0 ? displayedMessages.slice(-MESSAGE_VISIBILITY_LIMIT) : displayedMessages),
    [displayedMessages, hiddenMessagesCount]
  );

  const hasRenderableConversation = React.useMemo(
    () => displayedMessages.some(hasRenderableMessage),
    [displayedMessages]
  );
  const hasStandardSessionHistoryForMode = React.useMemo(
    () => sessions.some((session) => session.mode === activeMode && session.sessionKind === 'standard'),
    [activeMode, sessions]
  );
  const shouldShowEmptyState = !activeAgentWorkspace
    && !activeGeneratedAppWorkspace
    && !hasRenderableConversation
    && !isLoading
    && !refiningStatus
    && (activeSessionId === 'local-new' || !hasStandardSessionHistoryForMode);
  const shouldRenderMessageEndSpacer = displayedMessages.length > 0 || isLoading || Boolean(refiningStatus);

  const activeModeLabel = {
    chat: 'Chat & Raisonnement',
    cowork: 'Cowork',
    image: "Generation d'Images",
    video: 'Generation Video',
    audio: 'Text-to-Speech',
    lyria: 'Lyria / Musique',
  }[activeMode];
  const activeModeCreateLabel = {
    chat: 'Nouveau chat',
    cowork: 'Nouvelle mission',
    image: 'Nouvelle image',
    video: 'Nouvelle video',
    audio: 'Nouvelle voix',
    lyria: 'Nouveau morceau',
  }[activeMode];

  const activeSurfaceLabel = isAgentSession || isGeneratedAppSession
    ? 'App Cowork'
    : activeModeLabel;
  const isCoworkAppsView = Boolean(user && activeMode === 'cowork' && showAgentsHub);
  const isDedicatedAgentStudioView = Boolean(user && activeAgentWorkspace && activeAgentStudioKind !== 'default');
  const coworkStoreAgents = React.useMemo(
    () => [
      ...generatedApps.map(adaptGeneratedAppToStudioAgent),
      ...agents,
    ].sort((left, right) => right.updatedAt - left.updatedAt),
    [agents, generatedApps]
  );
  const latestCreatedStorePreview = latestCreatedGeneratedApp
    ? adaptGeneratedAppToStudioAgent(latestCreatedGeneratedApp)
    : latestCreatedAgent;

  const getPreferredSessionsForMode = useCallback((mode: AppMode) => (
    sessions.filter((session) => session.mode === mode && !(mode === 'chat' && (session.sessionKind === 'agent' || session.sessionKind === 'generated_app')))
  ), [sessions]);

  const handleGoogleLogin = useCallback(async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login error:", error);
      alert(`Erreur de connexion : ${error.message || String(error)}`);
    }
  }, []);

  const handleQuickStartPrompt = useCallback(async (prompt: string) => {
    if (!user) {
      await handleGoogleLogin();
      return;
    }

    if (isLoading || sendInFlightRef.current) return;
    if (handleSendRuntimeRef.current) {
      await handleSendRuntimeRef.current(prompt);
    }
  }, [handleGoogleLogin, isLoading, user]);

  const activateMode = useCallback((mode: AppMode) => {
    setActiveMode(mode);

    const preferredSessionId = lastSessionIdsByMode[mode];
    const availableSessions = getPreferredSessionsForMode(mode);
    const preferredSession = preferredSessionId
      ? availableSessions.find(session => session.id === preferredSessionId)
      : undefined;
    const fallbackSession = availableSessions[0];

    if (preferredSession) {
      setActiveSessionId(preferredSession.id, { modeOverride: mode });
      return;
    }

    if (fallbackSession) {
      setActiveSessionId(fallbackSession.id, { modeOverride: mode });
      return;
    }

    setPendingAttachments([]);
    setCustomTitle(null);
    setActiveSessionId('local-new', { remember: false, modeOverride: mode });
  }, [getPreferredSessionsForMode, lastSessionIdsByMode, setActiveMode, setActiveSessionId]);

  const openCoworkAppsHome = useCallback(() => {
    setSelectedImage(null);
    activateMode('cowork');
    setShowAgentsHub(true);
  }, [activateMode]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const modes: AppMode[] = ['chat', 'cowork', 'image', 'video', 'audio', 'lyria'];
        const next = modes[(modes.indexOf(activeMode) + 1) % modes.length];
        activateMode(next);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setLeftSidebarVisible(!isLeftSidebarVisible);
        setRightSidebarVisible(!isRightSidebarVisible);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activateMode, activeMode, isLeftSidebarVisible, isRightSidebarVisible, setLeftSidebarVisible, setRightSidebarVisible]);

  // Audio Hook
  const { isRecording, recordingTime, toggleRecording } = useAudioRecorder((dataUrl) => {
    setPendingAttachments(prev => [...prev, {
      id: Date.now().toString(),
      type: 'audio',
      url: dataUrl,
      name: `Enregistrement vocal`
    }]);
  });

  useEffect(() => {
    let authResolved = false;
    const authReadyFallback = window.setTimeout(() => {
      if (authResolved) return;
      console.warn('Firebase auth init timed out; falling back to unauthenticated shell.');
      setIsAuthReady(true);
    }, 4000);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      authResolved = true;
      window.clearTimeout(authReadyFallback);
      setUser(u);
      setIsAuthReady(true);
    });

    return () => {
      authResolved = true;
      window.clearTimeout(authReadyFallback);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    fetch('/api/status').then(res => res.json()).then(data => setIsVertexConfigured(data.isVertexConfigured));
  }, []);

  useEffect(() => {
    if (!user) {
      setSessions([]);
      setHasLoadedRemoteSessions(false);
      setHasLoadedRemoteAgents(false);
      setHasLoadedRemoteGeneratedApps(false);
      sessionRepairAttemptedRef.current = {};
      return;
    }

    const localSessions = loadLocalSessionShells(user.uid);
    if (localSessions.length > 0) {
      setSessions(localSessions);
    }

    const q = query(collection(db, 'users', user.uid, 'sessions'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const remoteSessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), messages: [] } as ChatSession));
      setSessions(
        snapshot.metadata.fromCache && remoteSessions.length === 0
          ? loadLocalSessionShells(user.uid)
          : mergeSessionsWithLocal(user.uid, remoteSessions)
      );
      setHasLoadedRemoteSessions(true);
    }, (error) => {
      console.error('Session list sync failed:', error);
      setSessions(loadLocalSessionShells(user.uid));
      setHasLoadedRemoteSessions(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAgents([]);
      setAgentsWarning(null);
      setHasLoadedRemoteAgents(false);
      return;
    }

    const localAgents = loadLocalAgents(user.uid);
    if (localAgents.length > 0) {
      setAgents(localAgents);
    }

    const q = query(collection(db, 'users', user.uid, 'agents'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const remoteAgents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudioAgent));
      setAgents(mergeAgentsWithLocal(user.uid, remoteAgents));
      setAgentsWarning(null);
      setHasLoadedRemoteAgents(true);
    }, (error) => {
      console.error('Agent list sync degraded, using local snapshots:', error);
      const fallbackAgents = loadLocalAgents(user.uid);
      setAgents(fallbackAgents);
      setAgentsWarning(
        fallbackAgents.length > 0
          ? "Cowork Apps n'a pas pu se synchroniser avec Firestore. Affichage du cache local sur cet appareil."
          : "Cowork Apps n'a pas pu se synchroniser avec Firestore. Les prochaines apps seront gardees localement sur cet appareil."
      );
      setHasLoadedRemoteAgents(true);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setGeneratedApps([]);
      setHasLoadedRemoteGeneratedApps(false);
      return;
    }

    const localApps = loadLocalGeneratedApps(user.uid);
    if (localApps.length > 0) {
      setGeneratedApps(localApps);
    }

    const q = query(collection(db, 'users', user.uid, 'generatedApps'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const remoteApps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as GeneratedAppManifest));
      setGeneratedApps(mergeGeneratedAppsWithLocal(user.uid, remoteApps));
      setAgentsWarning(null);
      setHasLoadedRemoteGeneratedApps(true);
    }, (error) => {
      console.error('Generated app list sync degraded, using local snapshots:', error);
      const fallbackApps = loadLocalGeneratedApps(user.uid);
      setGeneratedApps(fallbackApps);
      setAgentsWarning(
        fallbackApps.length > 0
          ? "Cowork Apps n'a pas pu se synchroniser completement avec Firestore. Affichage du cache local sur cet appareil."
          : "Cowork Apps n'a pas pu se synchroniser avec Firestore. Les prochaines apps resteront disponibles localement."
      );
      setHasLoadedRemoteGeneratedApps(true);
    });
  }, [user]);

  useEffect(() => {
    if (activeMode !== 'cowork') {
      setShowAgentsHub(false);
    }
  }, [activeMode]);

  useEffect(() => {
    if (!showAgentsHub) return;
    setLeftSidebarVisible(false);
    setRightSidebarVisible(false);
  }, [setLeftSidebarVisible, setRightSidebarVisible, showAgentsHub]);

  useEffect(() => {
    setRecentlyCompletedMessageId(null);
  }, [activeSessionId]);

  useEffect(() => {
    const container = parentRef.current;
    if (!container) return;

    const syncAutoScrollState = () => {
      shouldAutoScrollRef.current = isScrolledNearBottom(container);
    };

    syncAutoScrollState();
    container.addEventListener('scroll', syncAutoScrollState, { passive: true });
    return () => container.removeEventListener('scroll', syncAutoScrollState);
  }, [activeSessionId, shouldShowEmptyState]);

  useEffect(() => {
    shouldAutoScrollRef.current = true;
  }, [activeSessionId]);

  useEffect(() => {
    if (shouldShowEmptyState || !shouldRenderMessageEndSpacer || !shouldAutoScrollRef.current) return;

    const scrollFrame = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: isLoading || streamingContent || streamingThoughts ? 'auto' : 'smooth',
        block: 'end',
      });
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, [
    activeSessionId,
    displayedMessages.length,
    streamingContent,
    streamingThoughts,
    isLoading,
    refiningStatus,
    shouldRenderMessageEndSpacer,
    shouldShowEmptyState,
  ]);

  useEffect(() => {
    if (!user) {
      setCurrentMessages([]);
      setOptimisticMessages([]);
      setLiveCoworkMessage(null);
      liveCoworkMessageRef.current = null;
      coworkFlushTargetRef.current = null;
      return;
    }
    if (!activeSessionId || activeSessionId === 'local-new') {
      setCurrentMessages([]);
      setOptimisticMessages([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'sessions', activeSessionId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      let hydratedMessages = fetchedMessages;
      if (richSessionUsesCoworkSnapshots) {
        hydratedMessages = hydrateCoworkMessages(hydratedMessages, user.uid, activeSessionId);
      }
      hydratedMessages = hydrateSessionMessages(hydratedMessages, user.uid, activeSessionId);
      setCurrentMessages(hydratedMessages);
      clearSessionSnapshots(user.uid, activeSessionId, fetchedMessages.map(message => message.id));

      const liveId = liveCoworkMessageRef.current?.id;
      if (liveId && coworkFlushTargetRef.current?.sessionId === activeSessionId) {
        const persistedLiveMessage = hydratedMessages.find(msg => msg.id === liveId);
        if (persistedLiveMessage && persistedLiveMessage.runState && persistedLiveMessage.runState !== 'running') {
          setLiveCoworkMessage(null);
          liveCoworkMessageRef.current = null;
        }
      }
      
      // Clean up optimistic messages that have landed in Firestore
      setOptimisticMessages(prev => prev.filter(om => 
        !hydratedMessages.some(fm =>
          fm.id === om.id
          || (fm.role === om.role && fm.content === om.content && Math.abs(fm.createdAt - om.createdAt) < 5000)
        )
      ));
      
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: hydratedMessages } : s));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user?.uid}/sessions/${activeSessionId}/messages`);
    });
  }, [activeSessionId, richSessionUsesCoworkSnapshots, user]);



  const handleNewChat = useCallback(() => {
    setPendingAttachments([]);
    setCustomTitle(null);
    setActiveSessionId('local-new', { remember: false });
  }, [setActiveSessionId]);

  const handleModeChange = (mode: AppMode) => {
    activateMode(mode);
  };

  const processFiles = async (files: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      
      // Convert to base64 for the API
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      newAttachments.push({
        id: Math.random().toString(36).substring(7),
        type: file.type.startsWith('image/') ? 'image' : 
              file.type.startsWith('video/') ? 'video' : 
              file.type.startsWith('audio/') ? 'audio' : 'document',
        url,
        file,
        name: file.name,
        mimeType: file.type,
        base64
      });
    }
    setPendingAttachments(prev => [...prev, ...newAttachments]);
  };

  const setCoworkDraft = useCallback((nextValue: Message | ((prev: Message | null) => Message | null)) => {
    setLiveCoworkMessage(prev => {
      const next =
        typeof nextValue === 'function'
          ? (nextValue as (prev: Message | null) => Message | null)(prev)
          : nextValue;
      liveCoworkMessageRef.current = next;
      return next;
    });
  }, []);

  const touchSession = useCallback(async (sessionId: string) => {
    if (!user || !sessionId || sessionId === 'local-new') return;

    try {
      await updateDoc(doc(db, 'users', user.uid, 'sessions', sessionId), {
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.warn('Session timestamp update failed:', error);
    }
  }, [user]);

  const persistSessionMessage = useCallback(async (sessionId: string, message: Message) => {
    if (!user || !sessionId || sessionId === 'local-new') return false;

    saveSessionSnapshot(user.uid, sessionId, message);

    try {
      await setDoc(
        doc(db, 'users', user.uid, 'sessions', sessionId, 'messages', message.id),
        cleanForFirestore({
          ...message,
          sessionId,
          userId: user.uid,
        })
      );
      clearSessionSnapshots(user.uid, sessionId, [message.id]);
      return true;
    } catch (error) {
      console.warn('Message persistence degraded, keeping local snapshot only:', error);
      return false;
    }
  }, [user]);

  const persistCoworkSnapshot = useCallback(async (message: Message, target: { userId: string; sessionId: string }) => {
    const messageRef = doc(db, 'users', target.userId, 'sessions', target.sessionId, 'messages', message.id);
    const sanitized = sanitizeCoworkMessageForStorage(message);
    const richPayload = cleanForFirestore({
      ...sanitized,
      sessionId: target.sessionId,
      userId: target.userId,
    });
    const { activity, runState, runMeta, ...legacyMessage } = sanitized;
    const legacyPayload = cleanForFirestore({
      ...legacyMessage,
      sessionId: target.sessionId,
      userId: target.userId,
    });

    if (coworkStorageModeRef.current === 'legacy') {
      await setDoc(messageRef, legacyPayload);
      return;
    }

    try {
      await setDoc(messageRef, richPayload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
      const isPermissionError =
        errorMessage.includes('missing or insufficient permissions') ||
        errorMessage.includes('permission-denied') ||
        errorMessage.includes('permission denied');

      if (!isPermissionError) {
        throw error;
      }

      coworkStorageModeRef.current = 'legacy';
      if (!coworkStorageWarningShownRef.current) {
        coworkStorageWarningShownRef.current = true;
        console.warn('Cowork Firestore rules are outdated. Falling back to legacy message persistence without activity metadata.');
      }
      await setDoc(messageRef, legacyPayload);
    }
  }, []);

  const handleCreateAgent = useCallback(async (
    payload: { brief?: string; transcript?: GeneratedAppCreationTranscriptTurn[] }
  ): Promise<{ status: 'clarification_requested' | 'completed'; manifest?: GeneratedAppManifest } | null> => {
    if (!user || isCreatingAgent) return null;

    const cleanedBrief = typeof payload.brief === 'string' ? payload.brief.trim() : '';
    const requestTranscript = Array.isArray(payload.transcript) ? payload.transcript : undefined;
    if (!cleanedBrief && (!requestTranscript || requestTranscript.length === 0)) return null;

    setIsCreatingAgent(true);
    setGeneratedAppCreationRun(prev => ({
      status: 'running',
      startedAt: prev?.startedAt || Date.now(),
      phases: requestTranscript ? (prev?.phases || []) : [],
      manifestPreview: requestTranscript ? prev?.manifestPreview : undefined,
      sourceCode: requestTranscript ? prev?.sourceCode : undefined,
      buildLog: requestTranscript ? prev?.buildLog : undefined,
      manifest: requestTranscript ? prev?.manifest : undefined,
      transcript: requestTranscript || prev?.transcript,
      awaitingClarification: false,
      clarificationQuestion: undefined,
    }));
    try {
      const response = await fetch('/api/generated-apps/create/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: cleanedBrief,
          transcript: requestTranscript,
          source: 'manual',
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.details || data?.message || "Impossible de creer l'app.");
      }

      if (!response.body) {
        throw new Error("Le flux de creation n'a pas pu demarrer.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let pendingEvent = 'message';
      let pendingData: string[] = [];
      let finalManifest: GeneratedAppManifest | null = null;
      let finalClarification: { question: string; transcript?: GeneratedAppCreationTranscriptTurn[] } | null = null;
      let streamError: string | null = null;

      const flushSseChunk = async () => {
        if (pendingData.length === 0) {
          pendingEvent = 'message';
          return;
        }

        const rawPayload = pendingData.join('\n').trim();
        pendingData = [];
        const nextEvent = pendingEvent;
        pendingEvent = 'message';

        if (!rawPayload) return;

        const data = JSON.parse(rawPayload) as unknown;

        if (nextEvent === 'generated_app_creation') {
          if (isGeneratedAppCreationEvent(data)) {
            setGeneratedAppCreationRun(prev => applyGeneratedAppCreationEvent(prev, data));
          }
          return;
        }

        if (nextEvent === 'generated_app_manifest' && isGeneratedAppManifestEnvelope(data)) {
          finalManifest = normalizeGeneratedApp(data.manifest);
          return;
        }

        if (nextEvent === 'generated_app_clarification' && isGeneratedAppClarificationEnvelope(data)) {
          finalClarification = data;
          setGeneratedAppCreationRun(prev => ({
            status: 'running',
            startedAt: prev?.startedAt || Date.now(),
            phases: prev?.phases || [],
            manifestPreview: prev?.manifestPreview,
            sourceCode: prev?.sourceCode,
            buildLog: prev?.buildLog,
            manifest: prev?.manifest,
            transcript: data.transcript || prev?.transcript,
            awaitingClarification: true,
            clarificationQuestion: data.question,
          }));
          return;
        }

        if (nextEvent === 'error' && data && typeof data === 'object') {
          const message = (data as Record<string, unknown>).message;
          streamError = typeof message === 'string' ? message : "La creation de l'app a echoue.";
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });

        let delimiterIndex = buffer.indexOf('\n\n');
        while (delimiterIndex !== -1) {
          const rawEvent = buffer.slice(0, delimiterIndex);
          buffer = buffer.slice(delimiterIndex + 2);

          const lines = rawEvent.split(/\r?\n/);
          for (const line of lines) {
            if (!line || line.startsWith(':')) continue;
            if (line.startsWith('event:')) {
              pendingEvent = line.slice(6).trim();
              continue;
            }
            if (line.startsWith('data:')) {
              pendingData.push(line.slice(5).trimStart());
            }
          }

          await flushSseChunk();
          delimiterIndex = buffer.indexOf('\n\n');
        }

        if (done) break;
      }

      if (buffer.trim()) {
        const lines = buffer.split(/\r?\n/);
        for (const line of lines) {
          if (!line || line.startsWith(':')) continue;
          if (line.startsWith('event:')) {
            pendingEvent = line.slice(6).trim();
            continue;
          }
          if (line.startsWith('data:')) {
            pendingData.push(line.slice(5).trimStart());
          }
        }
        await flushSseChunk();
      }

      if (streamError) {
        throw new Error(streamError);
      }

      if (finalClarification) {
        setGeneratedAppCreationRun(prev => ({
          status: 'completed',
          startedAt: prev?.startedAt || Date.now(),
          completedAt: Date.now(),
          phases: prev?.phases || [],
          manifestPreview: prev?.manifestPreview,
          sourceCode: prev?.sourceCode,
          buildLog: prev?.buildLog,
          manifest: prev?.manifest,
          transcript: finalClarification?.transcript || prev?.transcript,
          awaitingClarification: true,
          clarificationQuestion: finalClarification.question,
        }));
        return { status: 'clarification_requested' };
      }

      if (!finalManifest) {
        throw new Error("Le flux de creation s'est termine sans manifest.");
      }

      const persistedManifest = await persistGeneratedAppManifest({
        ...finalManifest,
        createdBy: 'manual',
        sourcePrompt: cleanedBrief || finalManifest.sourcePrompt,
        sourceSessionId: activeSessionId && activeSessionId !== 'local-new' ? activeSessionId : undefined,
      }, {
        openHub: true,
      });

      setGeneratedAppCreationRun(prev => ({
        status: 'completed',
        startedAt: prev?.startedAt || Date.now(),
        completedAt: Date.now(),
        phases: prev?.phases || [],
        manifestPreview: prev?.manifestPreview,
        sourceCode: prev?.sourceCode,
        buildLog: prev?.buildLog,
        manifest: persistedManifest || finalManifest || undefined,
        transcript: prev?.transcript,
        awaitingClarification: false,
        clarificationQuestion: undefined,
      }));

      return { status: 'completed', manifest: persistedManifest || finalManifest };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGeneratedAppCreationRun(prev => ({
        status: 'failed',
        startedAt: prev?.startedAt || Date.now(),
        completedAt: Date.now(),
        phases: prev?.phases || [],
        manifestPreview: prev?.manifestPreview,
        sourceCode: prev?.sourceCode,
        buildLog: prev?.buildLog,
        manifest: prev?.manifest,
        transcript: prev?.transcript,
        awaitingClarification: false,
        clarificationQuestion: undefined,
        error: message,
      }));
      return null;
    } finally {
      setIsCreatingAgent(false);
    }
  }, [activeSessionId, isCreatingAgent, persistGeneratedAppManifest, user]);

  const persistSessionShell = useCallback(async (session: ChatSession) => {
    if (!user) return false;

    const { messages, ...sessionPayload } = session;
    saveLocalSessionShell(user.uid, session, { pendingRemote: true });

    try {
      await setDoc(
        doc(db, 'users', user.uid, 'sessions', session.id),
        cleanForFirestore(sessionPayload)
      );
      saveLocalSessionShell(user.uid, session, { pendingRemote: false });
      return true;
    } catch (error) {
      console.warn('Session shell persistence degraded, keeping local state:', error);
      return false;
    }
  }, [user]);

  const upsertSessionLocal = useCallback((session: ChatSession, options?: { pendingRemote?: boolean }) => {
    setSessions(prev => {
      const withoutCurrent = prev.filter(existing => existing.id !== session.id);
      return [session, ...withoutCurrent].sort((left, right) => right.updatedAt - left.updatedAt);
    });

    if (user) {
      saveLocalSessionShell(user.uid, session, { pendingRemote: options?.pendingRemote });
    }
  }, [user]);

  useEffect(() => {
    if (!user || !hasLoadedRemoteSessions || !hasLoadedRemoteAgents || !hasLoadedRemoteGeneratedApps) return;
    if (sessionRepairAttemptedRef.current[user.uid]) return;

    sessionRepairAttemptedRef.current[user.uid] = true;
    let cancelled = false;

    const repairMissingSessionShells = async () => {
      try {
        const knownSessionIds = new Set(sessions.map((session) => session.id));
        const agentsById = new Map(agents.map((agent) => [agent.id, agent]));
        const generatedAppsById = new Map(generatedApps.map((app) => [app.id, app]));
        const snapshot = await getDocs(
          query(collectionGroup(db, 'messages'), where('userId', '==', user.uid))
        );

        const orphanMessages = new Map<string, Message[]>();

        for (const docSnapshot of snapshot.docs) {
          const rawData = docSnapshot.data() as Record<string, unknown>;
          const sessionId =
            typeof rawData.sessionId === 'string' && rawData.sessionId.trim().length > 0
              ? rawData.sessionId
              : docSnapshot.ref.parent.parent?.id;

          if (!sessionId || knownSessionIds.has(sessionId)) continue;

          const normalizedMessage = normalizeRecoveredMessage(
            { id: docSnapshot.id, ...(rawData as Partial<Message>) },
            docSnapshot.id
          );
          if (!normalizedMessage) continue;

          const sessionMessages = orphanMessages.get(sessionId) || [];
          sessionMessages.push(normalizedMessage);
          orphanMessages.set(sessionId, sessionMessages);
        }

        if (orphanMessages.size === 0) return;

        const recoveredSessions = Array.from(orphanMessages.entries())
          .map(([sessionId, messages]) => buildRecoveredSessionShell(sessionId, user.uid, messages, agentsById, generatedAppsById))
          .filter((session): session is ChatSession => Boolean(session));

        if (recoveredSessions.length === 0) return;

        await Promise.all(recoveredSessions.map(async (session) => {
          const { messages, ...sessionPayload } = session;
          await setDoc(
            doc(db, 'users', user.uid, 'sessions', session.id),
            cleanForFirestore(sessionPayload),
            { merge: true }
          );
        }));

        if (cancelled) return;

        setSessions((prev) => {
          const merged = new Map(prev.map((session) => [session.id, session]));
          for (const session of recoveredSessions) {
            const current = merged.get(session.id);
            merged.set(session.id, current ? { ...current, ...session, messages: current.messages } : session);
          }
          return Array.from(merged.values()).sort((left, right) => right.updatedAt - left.updatedAt);
        });

        console.info(`Recovered ${recoveredSessions.length} Firestore session shell(s) from message history.`);
      } catch (error) {
        console.warn('Session shell repair skipped after Firestore error:', error);
      }
    };

    void repairMissingSessionShells();

    return () => {
      cancelled = true;
    };
  }, [agents, generatedApps, hasLoadedRemoteAgents, hasLoadedRemoteGeneratedApps, hasLoadedRemoteSessions, sessions, user]);

  const updateAgentWorkspaceValues = useCallback(async (nextValues: AgentFormValues) => {
    if (!user || !activeSessionId || activeSessionId === 'local-new' || !activeAgentWorkspace) return;

    const normalizedValues = buildAgentRuntimeFormValues(activeAgentWorkspace.agent, nextValues);

    setSessions(prev => prev.map(session => {
      if (session.id !== activeSessionId || session.sessionKind !== 'agent' || !session.agentWorkspace) {
        return session;
      }

      return {
        ...session,
        updatedAt: Date.now(),
        agentWorkspace: {
          ...session.agentWorkspace,
          formValues: normalizedValues,
        }
      };
    }));

    try {
      await updateDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId), {
        updatedAt: Date.now(),
        agentWorkspace: cleanForFirestore({
          ...activeAgentWorkspace,
          formValues: normalizedValues,
        }),
      });
    } catch (error) {
      console.warn('Agent workspace form persistence degraded:', error);
    }
  }, [activeAgentWorkspace, activeSessionId, user]);

  const updateGeneratedAppWorkspaceValues = useCallback(async (nextValues: AgentFormValues) => {
    if (!user || !activeSessionId || activeSessionId === 'local-new' || !activeGeneratedAppWorkspace) return;

    const normalizedValues = buildAgentRuntimeFormValues(adaptGeneratedAppToStudioAgent(activeGeneratedAppWorkspace.app), nextValues);

    setSessions(prev => prev.map(session => {
      if (session.id !== activeSessionId || session.sessionKind !== 'generated_app' || !session.generatedAppWorkspace) {
        return session;
      }

      return {
        ...session,
        updatedAt: Date.now(),
        generatedAppWorkspace: {
          ...session.generatedAppWorkspace,
          formValues: normalizedValues,
        }
      };
    }));

    try {
      await updateDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId), {
        updatedAt: Date.now(),
        generatedAppWorkspace: cleanForFirestore({
          ...activeGeneratedAppWorkspace,
          app: buildGeneratedAppRemotePayload(activeGeneratedAppWorkspace.app),
          formValues: normalizedValues,
        }),
      });
    } catch (error) {
      console.warn('Generated app workspace form persistence degraded:', error);
    }
  }, [activeGeneratedAppWorkspace, activeSessionId, user]);

  const requestCoworkAgentEdit = useCallback(async (agent: StudioAgent, request: string, formValues: AgentFormValues) => {
    if (!user) return;

    const cleanedRequest = request.trim();
    if (!cleanedRequest || isLoading || sendInFlightRef.current) return;

    const agentContextLines = formatAgentFormValues(agent, formValues);
    const sessionId = `cw-agent-edit-${Date.now()}`;
    const session: ChatSession = {
      id: sessionId,
      title: `Cowork · ${agent.name}`,
      messages: [],
      updatedAt: Date.now(),
      mode: 'cowork',
      userId: user.uid,
      systemInstruction: configs.cowork.systemInstruction || '',
      sessionKind: 'standard',
    };

    upsertSessionLocal(session, { pendingRemote: true });
    await persistSessionShell(session);
    setActiveMode('cowork');
    setActiveSessionId(sessionId, { modeOverride: 'cowork' });
    setCustomTitle(null);
    setShowAgentsHub(false);

    const editPrompt = [
      `Modifie l'app existante du store "${agent.name}" (id: ${agent.id}, slug: ${agent.slug}).`,
      "N'en cree pas une nouvelle. Mets a jour cette app existante avec l'outil update_agent_blueprint.",
      `Demande utilisateur: ${cleanedRequest}`,
      `Systeme actuel: ${agent.systemInstruction}`,
      agent.tools.length > 0 ? `Outils actuels: ${agent.tools.join(', ')}` : '',
      agent.capabilities.length > 0 ? `Capacites actuelles: ${agent.capabilities.join(', ')}` : '',
      agent.uiSchema.length > 0
        ? `Interface actuelle: ${agent.uiSchema.map(field => `${field.label} (${field.type})`).join(', ')}`
        : 'Interface actuelle: aucune interface detaillee.',
      agentContextLines.length > 0 ? `Dernieres valeurs utilisees:\n${agentContextLines.join('\n')}` : '',
      "Si l'utilisateur demande un changement d'interface, mets a jour uiSchema. Si l'utilisateur demande un changement de comportement, mets a jour le prompt systeme et les outils si necessaire pour cette app.",
    ].filter(Boolean).join('\n\n');

    if (handleSendRuntimeRef.current) {
      await handleSendRuntimeRef.current(editPrompt, undefined, session);
    }
  }, [configs.cowork.systemInstruction, isLoading, persistSessionShell, setActiveMode, setActiveSessionId, upsertSessionLocal, user]);

  const requestCoworkGeneratedAppEdit = useCallback(async (app: GeneratedAppManifest, request: string, formValues: AgentFormValues) => {
    if (!user) return;

    const cleanedRequest = request.trim();
    if (!cleanedRequest || isLoading || sendInFlightRef.current) return;

    const appContextLines = Object.entries(formValues)
      .filter(([, value]) => typeof value === 'boolean' || String(value || '').trim().length > 0)
      .map(([fieldId, value]) => {
        const label = app.uiSchema.find(field => field.id === fieldId)?.label || fieldId;
        return `- ${label}: ${typeof value === 'boolean' ? (value ? 'oui' : 'non') : String(value).trim()}`;
      });

    const sessionId = `cw-generated-app-edit-${Date.now()}`;
    const session: ChatSession = {
      id: sessionId,
      title: `Cowork · ${app.name}`,
      messages: [],
      updatedAt: Date.now(),
      mode: 'cowork',
      userId: user.uid,
      systemInstruction: configs.cowork.systemInstruction || '',
      sessionKind: 'standard',
    };

    upsertSessionLocal(session, { pendingRemote: true });
    await persistSessionShell(session);
    setActiveMode('cowork');
    setActiveSessionId(sessionId, { modeOverride: 'cowork' });
    setCustomTitle(null);
    setShowAgentsHub(false);

    const editPrompt = [
      `Modifie l'app experte existante "${app.name}" (id: ${app.id}, slug: ${app.slug}).`,
      "N'en cree pas une nouvelle. Mets a jour cette app existante avec l'outil update_generated_app.",
      `Demande utilisateur: ${cleanedRequest}`,
      `Systeme actuel: ${app.systemInstruction}`,
      app.toolAllowList.length > 0 ? `Outils actuels: ${app.toolAllowList.join(', ')}` : '',
      app.capabilities.length > 0 ? `Capacites actuelles: ${app.capabilities.join(', ')}` : '',
      app.uiSchema.length > 0
        ? `Interface actuelle: ${app.uiSchema.map(field => `${field.label} (${field.type})`).join(', ')}`
        : 'Interface actuelle: aucune interface detaillee.',
      `Modeles actuels: texte=${app.modelProfile.textModel}${app.modelProfile.imageModel ? `, image=${app.modelProfile.imageModel}` : ''}${app.modelProfile.musicModel ? `, musique=${app.modelProfile.musicModel}` : ''}${app.modelProfile.ttsModel ? `, voix=${app.modelProfile.ttsModel}` : ''}`,
      appContextLines.length > 0 ? `Dernieres valeurs utilisees:\n${appContextLines.join('\n')}` : '',
      "Si l'utilisateur demande un changement d'interface, regenere uiSchema et la draft de code. Si l'utilisateur demande un changement de comportement, mets a jour le prompt systeme, les outils autorises, les modeles et la direction visuelle si necessaire.",
    ].filter(Boolean).join('\n\n');

    if (handleSendRuntimeRef.current) {
      await handleSendRuntimeRef.current(editPrompt, undefined, session);
    }
  }, [configs.cowork.systemInstruction, isLoading, persistSessionShell, setActiveMode, setActiveSessionId, upsertSessionLocal, user]);

  const openAgentWorkspace = useCallback(async (
    agent: StudioAgent,
    values: AgentFormValues,
    options?: { autoRun?: boolean }
  ) => {
    if (!user) return;

    const normalizedValues = buildAgentRuntimeFormValues(agent, values);
    const sessionId = `agent-${agent.id}-${Date.now()}`;
    const launchPrompt = buildAgentLaunchPrompt(agent, normalizedValues);
    const session: ChatSession = {
      id: sessionId,
      title: `App · ${agent.name}`,
      messages: [],
      updatedAt: Date.now(),
      mode: 'chat',
      userId: user.uid,
      systemInstruction: agent.systemInstruction,
      sessionKind: 'agent',
      agentWorkspace: {
        agent,
        formValues: normalizedValues,
        lastLaunchPrompt: launchPrompt,
      },
    };

    upsertSessionLocal(session, { pendingRemote: true });
    await persistSessionShell(session);
    setActiveMode('chat');
    setActiveSessionId(sessionId, { remember: false, modeOverride: 'chat' });
    setCustomTitle(null);
    setShowAgentsHub(false);

    if (options?.autoRun !== false && handleSendRuntimeRef.current) {
      await handleSendRuntimeRef.current(launchPrompt, undefined, session);
    }
  }, [persistSessionShell, setActiveMode, setActiveSessionId, upsertSessionLocal, user]);

  const openGeneratedAppWorkspace = useCallback(async (
    app: GeneratedAppManifest,
    values: AgentFormValues,
    options?: { autoRun?: boolean }
  ) => {
    if (!user) return;

    const normalizedValues = buildAgentRuntimeFormValues(adaptGeneratedAppToStudioAgent(app), values);
    const sessionId = `gapp-${app.id}-${Date.now()}`;
    const launchPrompt = buildGeneratedAppLaunchPrompt(app, normalizedValues);
    const session: ChatSession = {
      id: sessionId,
      title: `App · ${app.name}`,
      messages: [],
      updatedAt: Date.now(),
      mode: 'chat',
      userId: user.uid,
      systemInstruction: app.systemInstruction,
      sessionKind: 'generated_app',
      generatedAppWorkspace: {
        app: buildGeneratedAppRemotePayload(normalizeGeneratedApp(app)),
        formValues: normalizedValues,
        lastLaunchPrompt: launchPrompt,
      },
    };

    upsertSessionLocal(session, { pendingRemote: true });
    await persistSessionShell(session);
    setActiveMode('chat');
    setActiveSessionId(sessionId, { remember: false, modeOverride: 'chat' });
    setCustomTitle(null);
    setShowAgentsHub(false);

    if (options?.autoRun !== false && handleSendRuntimeRef.current) {
      await handleSendRuntimeRef.current(launchPrompt, undefined, session);
    }
  }, [persistSessionShell, setActiveMode, setActiveSessionId, upsertSessionLocal, user]);

  const releaseCoworkDraft = useCallback(async (options?: { clear?: boolean }) => {
    const draft = liveCoworkMessageRef.current;
    const target = coworkFlushTargetRef.current;

    if (coworkFlushTimerRef.current) {
      clearTimeout(coworkFlushTimerRef.current);
      coworkFlushTimerRef.current = null;
    }

    if (draft && target) {
      try {
        await persistCoworkSnapshot(draft, target);
      } catch (error) {
        console.error('Cowork draft persistence failed:', error);
      }
    }

    if (options?.clear === false) return;

    setLiveCoworkMessage(null);
    liveCoworkMessageRef.current = null;
    coworkFlushTargetRef.current = null;
  }, [persistCoworkSnapshot]);

  const persistLiveCoworkMessage = useCallback(async () => {
    await releaseCoworkDraft({ clear: false });
  }, [releaseCoworkDraft]);

  const scheduleCoworkPersist = useCallback(() => {
    if (coworkFlushTimerRef.current) {
      clearTimeout(coworkFlushTimerRef.current);
    }
    coworkFlushTimerRef.current = setTimeout(() => {
      coworkFlushTimerRef.current = null;
      void persistLiveCoworkMessage();
    }, 350);
  }, [persistLiveCoworkMessage]);

  const flushCoworkPersist = useCallback(async () => {
    await releaseCoworkDraft({ clear: false });
  }, [releaseCoworkDraft]);

  useEffect(() => {
    return () => {
      void releaseCoworkDraft();
    };
  }, [releaseCoworkDraft]);

  useEffect(() => {
    const target = coworkFlushTargetRef.current;
    if (!liveCoworkMessage || !target) return;

    saveCoworkSessionSnapshot(target.userId, target.sessionId, liveCoworkMessage);
  }, [liveCoworkMessage]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (
      e.clientX <= rect.left ||
      e.clientX >= rect.right ||
      e.clientY <= rect.top ||
      e.clientY >= rect.bottom
    ) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleExport = (format: 'pdf' | 'md') => {
    const content = currentMessages.map(m => `**${m.role.toUpperCase()}**: ${m.content}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeSession.title}.${format}`;
    a.click();
  };


  // --- IMAGE COMPRESSION HELPER ---
  const compressImage = async (base64: string, maxWidth = 1024, maxHeight = 1024, quality = 0.8): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        // Try JPEG for better compression
        const compressed = canvas.toDataURL('image/jpeg', quality);
        resolve(compressed);
      };
      img.onerror = () => resolve(base64); // Fallback to original if can't load
      img.src = base64;
    });
  };

  // Virtualizer for performance
  const rowVirtualizer = useVirtualizer({
    count: visibleMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });
  const shouldVirtualizeMessages = activeMode !== 'cowork' && !activeAgentWorkspace && !activeGeneratedAppWorkspace && !isLoading && visibleMessages.length > 80;

  useEffect(() => {
    if (!shouldVirtualizeMessages) return;

    const frame = window.requestAnimationFrame(() => {
      rowVirtualizer.measure();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [shouldVirtualizeMessages, rowVirtualizer, visibleMessages.length, streamingContent, streamingThoughts, isLoading, expandedThoughts]);

  // --- ATTACHMENTS HELPERS ---
  const uploadAttachment = async (
    attachment: Attachment,
    userId: string,
    sessionId: string,
  ): Promise<{ url: string; storageUri?: string }> => {
    // If it's already a URL (not base64), return it
    if (attachment.url.startsWith('http') && !attachment.url.includes('base64')) {
      return {
        url: attachment.url,
        storageUri: attachment.storageUri,
      };
    }
    
    try {
      let blob: Blob;
      if (attachment.file) {
        blob = attachment.file;
      } else if (attachment.base64) {
        // More robust conversion using fetch for data URLs
        try {
          const res = await fetch(attachment.base64);
          blob = await res.blob();
        } catch (convError) {
          console.warn("Manual blob conversion fallback for:", attachment.name);
          const base64Data = attachment.base64.split(',')[1] || attachment.base64;
          const mimeType = attachment.mimeType || 'image/png';
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          blob = new Blob([byteArray], { type: mimeType });
        }
      } else {
        return {
          url: attachment.url,
          storageUri: attachment.storageUri,
        };
      }

      const fileExt = attachment.mimeType?.split('/')[1] || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base64: attachment.base64 || attachment.url,
          fileName,
          mimeType: attachment.mimeType || 'image/png'
        })
      });

      if (!response.ok) {
        throw new Error(`Erreur serveur lors de l'upload: ${response.statusText}`);
      }
      const { url, storageUri } = await response.json();
      return { url, storageUri };
    } catch (e: any) {
      console.warn("Storage upload failed, attempting compression fallback:", e);
      
      // FALLBACK: Store directly in Firestore if we can compress it < 1MB
      if (attachment.base64 || (attachment.url && attachment.url.startsWith('data:'))) {
        const sourceData = attachment.base64 || attachment.url;
        
        // If it's already small enough, just return it
        if (sourceData.length < 800000) return { url: sourceData };

        // Otherwise, compress it
        console.info("Compressing image for Firestore storage...");
        let compressed = await compressImage(sourceData, 800, 800, 0.7);
        
        // Final safety check: if still too big, go even smaller
        if (compressed.length > 1000000) {
          compressed = await compressImage(compressed, 512, 512, 0.5);
        }
        
        if (compressed.length < 1048000) {
           return { url: compressed };
        }
      }

      throw new Error(`Échec de l'enregistrement : Storage inaccessible et image trop grande pour Firestore. Détails: ${e.message || String(e)}`);
    }
  };

  const handleSend = async (textToSend: string, overrideMessages?: Message[], runtimeSessionOverride?: ChatSession) => {
    if ((!textToSend.trim() && pendingAttachments.length === 0 && !overrideMessages) || isLoading || sendInFlightRef.current) return;

    const scrollContainer = parentRef.current;
    shouldAutoScrollRef.current = !scrollContainer || isScrolledNearBottom(scrollContainer) || displayedMessages.length === 0;
    setRecentlyCompletedMessageId(null);
    
    // Clear old response state immediately to prevent "phantom" previous responses
    setStreamingContent('');
    setStreamingThoughts('');
    setExpandedThoughts(prev => {
      const { streaming, ...rest } = prev;
      return rest;
    });
    setLiveCoworkMessage(null);
    liveCoworkMessageRef.current = null;
    
    sendInFlightRef.current = true;
    setIsLoading(true);
    setStreamingThoughtsExpanded(true);
    setExpandedThoughts(prev => ({ ...prev, streaming: true }));
    abortControllerRef.current = new AbortController();
    let isRichToolRun = false;

    try {
      const effectiveSession = runtimeSessionOverride || activeSession;
      const effectiveMode = runtimeSessionOverride?.mode || activeMode;
      const effectiveConfig = configs[effectiveMode];
      const effectiveSessionMessages = runtimeSessionOverride?.messages || currentMessages;
      const isCoworkRun = effectiveMode === 'cowork';
      const isAgentRun = effectiveSession.sessionKind === 'agent' && Boolean(effectiveSession.agentWorkspace);
      const isGeneratedAppRun = effectiveSession.sessionKind === 'generated_app' && Boolean(effectiveSession.generatedAppWorkspace);
      isRichToolRun = isCoworkRun || isAgentRun || isGeneratedAppRun;

      let currentSessionId = runtimeSessionOverride?.id || activeSessionId;
      if (user && (currentSessionId === 'local-new' || !currentSessionId)) {
        const newId = Date.now().toString();
        const nextSession: ChatSession = {
          id: newId,
          title: customTitle || textToSend.slice(0, 30) || 'Nouvelle conversation',
          messages: [],
          updatedAt: Date.now(),
          mode: effectiveMode,
          userId: user.uid,
          systemInstruction: effectiveSession.systemInstruction || effectiveConfig?.systemInstruction || configs.chat?.systemInstruction || '',
          selectedCustomPrompt: effectiveSession.selectedCustomPrompt || selectedCustomPrompt || undefined,
          sessionKind: effectiveSession.sessionKind || 'standard',
          agentWorkspace: effectiveSession.agentWorkspace,
        };
        upsertSessionLocal(nextSession, { pendingRemote: true });
        await persistSessionShell(nextSession);
        setCustomTitle(null);
        currentSessionId = newId;
        setActiveSessionId(newId, {
          remember: effectiveSession.sessionKind !== 'agent',
          modeOverride: effectiveMode,
        });
      }

      if (!user || !currentSessionId) return;
      await touchSession(currentSessionId);

      // Keep a rich payload for the current request, but persist lightweight attachments only.
      const requestAttachments: Attachment[] = [];
      const cleanAttachments: Attachment[] = [];
      for (const att of pendingAttachments) {
        const { file, ...rest } = att;
        const uploaded = await uploadAttachment(att, user.uid, currentSessionId);
        requestAttachments.push({
          ...rest,
          url: uploaded.url,
          storageUri: uploaded.storageUri,
          base64: uploaded.storageUri ? undefined : rest.base64,
        });
        cleanAttachments.push({
          ...rest,
          url: uploaded.url,
          storageUri: uploaded.storageUri,
          base64: undefined,
        });
      }

      // --- PROMPT REFINEMENT ---
      let refinedInstruction = undefined;
      let finalPrompt = textToSend;

      if (overrideMessages) {
        const lastMsg = overrideMessages[overrideMessages.length - 1];
        finalPrompt = lastMsg.content;
      }

      const isMediaMode = ['image', 'video', 'audio', 'lyria'].includes(effectiveMode);
      if (isPromptRefinerEnabled && !overrideMessages && finalPrompt.trim() && !isMediaMode) {
        setRefiningStatus("Optimisation de votre prompt par l'IA...");
        try {
          const refineRes = await fetch('/api/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: finalPrompt, mode: effectiveMode })
          });
          if (refineRes.ok) {
            const refineData = await refineRes.json();
            refinedInstruction = refineData.refinedInstruction;
          }
        } catch (e) {
          console.error("Refinement failed:", e);
        } finally {
          setRefiningStatus(null);
        }
      }

      // In Image/Video mode, the refined instruction IS the prompt
      const generationPrompt = (effectiveMode === 'image' || effectiveMode === 'video' || effectiveMode === 'audio' || effectiveMode === 'lyria') && refinedInstruction 
        ? refinedInstruction 
        : finalPrompt;

      // --- BRANCHED LOGIC BASED ON MODE ---
      
      if (effectiveMode === 'image') {
        // IMAGE GENERATION FLOW
        if (!overrideMessages) {
          const userMessage: Message = {
            id: createClientMessageId('msg'),
            role: 'user', content: finalPrompt, createdAt: Date.now(), attachments: cleanAttachments, refinedInstruction 
          };
          setOptimisticMessages(prev => [...prev, userMessage]);
          await persistSessionMessage(currentSessionId, userMessage);
          setPendingAttachments([]);
        }

        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: generationPrompt,
            model: effectiveConfig?.model || configs.chat.model,
            aspectRatio: effectiveConfig?.aspectRatio,
            imageSize: effectiveConfig.imageSize,
            numberOfImages: effectiveConfig.numberOfImages,
            personGeneration: effectiveConfig.personGeneration,
            safetySetting: effectiveConfig.safetySetting,
            thinkingLevel: effectiveConfig.thinkingLevel
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.details || errData.message || 'Erreur génération image');
        }
        const data = await response.json();

        const imageAttachments: Attachment[] = data.images
          ? data.images.map((img: any, idx: number) => ({
              id: `${Date.now()}-${idx}`,
              type: 'image' as AttachmentType,
              url: img.url,
              storageUri: img.storageUri,
              name: `Image ${idx + 1}`,
            }))
          : [{
              id: Date.now().toString(),
              type: 'image' as AttachmentType,
              url: data.url,
              storageUri: data.storageUri,
              name: 'Image générée',
            }];

        const modelMessage: Message = {
          id: createClientMessageId('model'),
          role: 'model',
          content: imageAttachments.length > 1 ? `${imageAttachments.length} images générées.` : "Image générée avec succès.",
          attachments: imageAttachments,
          createdAt: Date.now(),
        };
        const persistedModel = await persistSessionMessage(currentSessionId, modelMessage);
        if (!persistedModel) {
          setOptimisticMessages(prev => [...prev.filter(message => message.id !== modelMessage.id), modelMessage]);
        }
        
        setIsLoading(false);
        return;
      }

      if (effectiveMode === 'audio') {
        if (!overrideMessages) {
          const userMessage: Message = {
            id: createClientMessageId('msg'),
            role: 'user',
            content: finalPrompt,
            createdAt: Date.now(),
            attachments: cleanAttachments,
            refinedInstruction,
          };
          setOptimisticMessages(prev => [...prev, userMessage]);
          await persistSessionMessage(currentSessionId, userMessage);
          setPendingAttachments([]);
        }

        const response = await fetch('/api/generate-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: generationPrompt,
            model: effectiveConfig?.model || configs.audio.model,
            ttsVoice: effectiveConfig?.ttsVoice,
            ttsLanguageCode: effectiveConfig?.ttsLanguageCode,
            ttsStyleInstructions: effectiveConfig?.ttsStyleInstructions,
            temperature: effectiveConfig?.temperature,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.details || errData.message || 'Erreur génération audio');
        }

        const data = await response.json();
        const modelMessage: Message = {
          id: createClientMessageId('model'),
          role: 'model',
          content: "Audio généré avec succès.",
          attachments: [{
            id: Date.now().toString(),
            type: 'audio',
            url: data.url,
            storageUri: data.storageUri,
            mimeType: data.mimeType || 'audio/wav',
            name: 'Audio généré',
          }],
          createdAt: Date.now(),
        };
        const persistedModel = await persistSessionMessage(currentSessionId, modelMessage);
        if (!persistedModel) {
          setOptimisticMessages(prev => [...prev.filter(message => message.id !== modelMessage.id), modelMessage]);
        }

        setIsLoading(false);
        return;
      }

      if (effectiveMode === 'lyria') {
        if (!overrideMessages) {
          const userMessage: Message = {
            id: createClientMessageId('msg'),
            role: 'user',
            content: finalPrompt,
            createdAt: Date.now(),
            attachments: cleanAttachments,
            refinedInstruction,
          };
          setOptimisticMessages(prev => [...prev, userMessage]);
          await persistSessionMessage(currentSessionId, userMessage);
          setPendingAttachments([]);
        }

        const response = await fetch('/api/generate-music', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: generationPrompt,
            model: effectiveConfig?.model || configs.lyria.model,
            negativePrompt: effectiveConfig?.negativePrompt,
            seed: effectiveConfig?.seed,
            sampleCount: effectiveConfig?.sampleCount,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.details || errData.message || 'Erreur generation musicale');
        }

        const data = await response.json();
        const modelMessage: Message = {
          id: createClientMessageId('model'),
          role: 'model',
          content: 'Piste Lyria generee avec succes.',
          attachments: [{
            id: Date.now().toString(),
            type: 'audio',
            url: data.url,
            storageUri: data.storageUri,
            mimeType: data.mimeType || 'audio/wav',
            name: 'Piste Lyria generee',
          }],
          createdAt: Date.now(),
        };
        const persistedModel = await persistSessionMessage(currentSessionId, modelMessage);
        if (!persistedModel) {
          setOptimisticMessages(prev => [...prev.filter(message => message.id !== modelMessage.id), modelMessage]);
        }

        setIsLoading(false);
        return;
      }

      if (isCoworkRun || isAgentRun || isGeneratedAppRun) {
        if (!overrideMessages) {
          const userMessage: Message = {
            id: createClientMessageId('msg'),
            role: 'user',
            content: finalPrompt,
            createdAt: Date.now(),
            attachments: cleanAttachments,
          };
          setOptimisticMessages(prev => [...prev, userMessage]);
          await persistSessionMessage(currentSessionId, userMessage);
          setPendingAttachments([]);
        }

        const apiHistory = overrideMessages ? overrideMessages.slice(0, -1) : effectiveSessionMessages;
        const historyForApi = buildApiHistoryFromMessages(apiHistory, {
          includeCoworkMemory: true,
        });
        const currentRequestAttachments = overrideMessages
          ? (overrideMessages[overrideMessages.length - 1]?.attachments || [])
          : requestAttachments;
        const coworkSystemInstruction = effectiveConfig?.systemInstruction?.trim();
        const sanitizedCoworkSystemInstruction =
          coworkSystemInstruction && coworkSystemInstruction !== LEGACY_COWORK_SYSTEM_INSTRUCTION
            ? coworkSystemInstruction
            : undefined;
        const agentRuntime = isAgentRun && effectiveSession.agentWorkspace
          ? {
              ...effectiveSession.agentWorkspace.agent,
              formValues: effectiveSession.agentWorkspace.formValues,
            }
          : undefined;
        const appRuntime = isGeneratedAppRun && effectiveSession.generatedAppWorkspace
          ? {
              ...effectiveSession.generatedAppWorkspace.app,
              formValues: effectiveSession.generatedAppWorkspace.formValues,
            }
          : undefined;

        let workspaceFiles: WorkspaceFile[] = [];
        if (isCoworkRun && !isAgentRun && !isGeneratedAppRun && user) {
          try {
            const wsSnap = await getDocs(
              query(
                collection(db, 'users', user.uid, 'workspace', 'files'),
                orderBy('createdAt', 'desc'),
                limit(30)
              )
            );
            workspaceFiles = wsSnap.docs.map(d => ({ fileId: d.id, ...d.data() } as WorkspaceFile));
          } catch { /* silencieux — l'espace de travail vide ne bloque pas */ }
        }

        const response = await fetch('/api/cowork', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            message: finalPrompt,
            history: historyForApi,
            attachments: buildApiAttachmentPayloads(currentRequestAttachments),
            config: {
              model: effectiveConfig?.model || configs.chat.model,
              temperature: effectiveConfig?.temperature ?? 0.1,
              topP: effectiveConfig?.topP ?? 1.0,
              topK: effectiveConfig?.topK ?? 1,
              maxOutputTokens: effectiveConfig?.maxOutputTokens || 65536,
              systemInstruction: sanitizedCoworkSystemInstruction,
              googleSearch: effectiveConfig?.googleSearch !== false,
              codeExecution: effectiveConfig?.codeExecution !== false,
              thinkingLevel: effectiveConfig?.thinkingLevel || 'high',
            },
            clientContext: {
              locale: navigator.language || 'fr-FR',
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
              nowIso: new Date().toISOString(),
            },
            hubAgents: isCoworkRun && effectiveConfig?.agentDelegationEnabled ? agents : undefined,
            generatedApps,
            agentRuntime,
            appRuntime,
            sessionId: currentSessionId,
            userIdHint: isCoworkRun && !isAgentRun && !isGeneratedAppRun && user ? user.uid : undefined,
            memorySearchEnabled: isCoworkRun && !isAgentRun && !isGeneratedAppRun ? true : undefined,
            workspaceFiles: isCoworkRun && !isAgentRun && !isGeneratedAppRun ? workspaceFiles : undefined,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.details || errData.message || 'Erreur mode Cowork');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('Flux Cowork indisponible');

        const decoder = new TextDecoder();
        let buffer = '';

        const runtimeLabel = isGeneratedAppRun
          ? (effectiveSession.generatedAppWorkspace?.app.name || 'App')
          : isAgentRun
            ? (effectiveSession.agentWorkspace?.agent.name || 'Agent')
            : 'Cowork';

        const modelMessage: Message = {
          id: `${isGeneratedAppRun ? 'gapp' : isAgentRun ? 'agent' : 'cowork'}-${Date.now()}`,
          role: 'model',
          content: '',
          thoughts: '',
          activity: [{
            id: `${isGeneratedAppRun ? 'gapp' : isAgentRun ? 'agent' : 'cw'}-init-${Date.now()}`,
            kind: 'status',
            timestamp: Date.now(),
            iteration: 0,
            title: 'Initialisation',
            message: isGeneratedAppRun || isAgentRun
              ? `Ouverture de l'app ${runtimeLabel}...`
              : 'Connexion a la boucle Cowork...',
            status: 'info',
          }],
          runState: 'running',
          runMeta: createEmptyRunMeta(),
          createdAt: Date.now(),
        };

        coworkStorageModeRef.current = 'rich';
        coworkStorageWarningShownRef.current = false;
        coworkFlushTargetRef.current = { userId: user.uid, sessionId: currentSessionId };
        setCoworkDraft(modelMessage);
        await persistCoworkSnapshot(modelMessage, { userId: user.uid, sessionId: currentSessionId });

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
            const chunk = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 2);
            if (!chunk.startsWith('data: ')) continue;

            const data = JSON.parse(chunk.slice(6)) as CoworkStreamEvent & { error?: string };
            if (data.error && !data.type) {
              throw new Error(data.error);
            }

            if (data.type === 'agent_blueprint' && data.blueprint) {
              try {
                await persistAgentBlueprint(data.blueprint, {
                  createdBy: 'cowork',
                  sourcePrompt: data.blueprint.sourcePrompt || finalPrompt,
                  sourceSessionId: currentSessionId,
                });
              } catch (persistError) {
                console.error('Agent blueprint persistence failed:', persistError);
                setCoworkDraft(prev => {
                  if (!prev) return prev;
                  return applyCoworkEventToMessage(prev, {
                    type: 'warning',
                    title: 'Hub non synchronise',
                    message: "L'app a ete generee, mais sa sauvegarde Firestore a echoue. Le run Cowork continue.",
                  });
                });
              }
            }

            if (data.type === 'generated_app_manifest' && data.manifest) {
              try {
                await persistGeneratedAppManifest({
                  ...data.manifest,
                  createdBy: 'cowork',
                  sourcePrompt: data.manifest.sourcePrompt || finalPrompt,
                  sourceSessionId: currentSessionId,
                });
              } catch (persistError) {
                console.error('Generated app persistence failed:', persistError);
                setCoworkDraft(prev => {
                  if (!prev) return prev;
                  return applyCoworkEventToMessage(prev, {
                    type: 'warning',
                    title: 'Store non synchronise',
                    message: "L'app a ete regeneree, mais sa sauvegarde Firestore a echoue. Le run Cowork continue.",
                  });
                });
              }
            }

            if (data.type === 'workspace_file_created' && user) {
              try {
                const {
                  type: _t,
                  timestamp: _ts,
                  iteration: _iteration,
                  runMeta: _runMeta,
                  fileId,
                  ...fileData
                } = data as Record<string, unknown>;
                const createdAt =
                  typeof fileData.createdAt === 'number' && Number.isFinite(fileData.createdAt)
                    ? Number(fileData.createdAt)
                    : Date.now();
                if (typeof fileId === 'string' && fileId.trim()) {
                  await setDoc(
                    doc(db, 'users', user.uid, 'workspace', 'files', fileId),
                    cleanForFirestore({
                      ...fileData,
                      createdAt,
                    })
                  );
                } else {
                  await addDoc(collection(db, 'users', user.uid, 'workspace', 'files'), cleanForFirestore({
                    ...fileData,
                    createdAt,
                  }));
                }
              } catch (e) {
                console.error('Workspace file persistence failed:', e);
              }
            }

            if (data.type === 'workspace_file_deleted' && data.fileId && user) {
              try {
                await deleteDoc(doc(db, 'users', user.uid, 'workspace', 'files', String(data.fileId)));
              } catch (e) {
                console.error('Workspace file delete failed:', e);
              }
            }

            setCoworkDraft(prev => (prev ? applyCoworkEventToMessage(prev, data) : prev));
            scheduleCoworkPersist();

            if (data.type === 'error') {
              throw new Error(data.message || 'Erreur mode Cowork');
            }
          }
        }

        setCoworkDraft(prev => {
          if (!prev) return prev;
          if (prev.runState && prev.runState !== 'running') return prev;
          return { ...prev, runState: 'completed' };
        });
        await flushCoworkPersist();
        return;
      }

      if (effectiveMode === 'video') {
        // VIDEO GENERATION FLOW
        if (!overrideMessages) {
          const userMessage: Message = {
            id: createClientMessageId('msg'),
            role: 'user', content: finalPrompt, createdAt: Date.now(), attachments: cleanAttachments 
          };
          setOptimisticMessages(prev => [...prev, userMessage]);
          await persistSessionMessage(currentSessionId, userMessage);
          setPendingAttachments([]);
        }

        const response = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: generationPrompt,
            videoResolution: effectiveConfig?.videoResolution || '720p',
            videoAspectRatio: effectiveConfig?.videoAspectRatio || '16:9',
            videoDurationSeconds: effectiveConfig?.videoDurationSeconds || 6
          })
        });

        if (!response.ok) throw new Error('Erreur génération vidéo');
        const data = await response.json();
        
        const modelMessage: Message = {
          id: createClientMessageId('model'),
          role: 'model',
          content: "Vidéo générée avec succès.",
          attachments: [{
            id: Date.now().toString(),
            type: 'video',
            url: data.url,
            storageUri: data.storageUri,
            name: 'Vidéo générée',
          }],
          createdAt: Date.now(),
        };
        const persistedModel = await persistSessionMessage(currentSessionId, modelMessage);
        if (!persistedModel) {
          setOptimisticMessages(prev => [...prev.filter(message => message.id !== modelMessage.id), modelMessage]);
        }
        
        setIsLoading(false);
        return;
      }

      let finalMessage = finalPrompt;
      let finalRequestAttachments = requestAttachments;
      let finalAttachments = cleanAttachments;
      let finalRefinedInstruction = refinedInstruction;

      if (!overrideMessages) {
        const userMessage: Message = {
          id: createClientMessageId('msg'),
          role: 'user', 
          content: finalPrompt, 
          createdAt: Date.now(), 
          attachments: cleanAttachments,
          refinedInstruction
        };
        setOptimisticMessages(prev => [...prev, userMessage]);
        await persistSessionMessage(currentSessionId, userMessage);
        setPendingAttachments([]);
      } else {
        const lastMsg = overrideMessages[overrideMessages.length - 1];
        finalMessage = lastMsg.content;
        finalRequestAttachments = lastMsg.attachments || [];
        finalAttachments = lastMsg.attachments || [];
        finalRefinedInstruction = lastMsg.refinedInstruction || refinedInstruction;
      }

      const apiHistory = overrideMessages ? overrideMessages.slice(0, -1) : effectiveSessionMessages;
      const historyForApi = buildApiHistoryFromMessages(apiHistory);

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          message: finalMessage,
          history: historyForApi,
          attachments: buildApiAttachmentPayloads(finalRequestAttachments),
          config: {
            model: effectiveMode === 'chat' ? (effectiveConfig?.model || configs.chat.model) : configs.chat.model,
            temperature: effectiveConfig?.temperature ?? 0.7,
            topP: effectiveConfig?.topP ?? 0.95,
            topK: effectiveConfig?.topK ?? 40,
            maxOutputTokens: effectiveConfig?.maxOutputTokens || 8192,
            systemInstruction: effectiveConfig?.systemInstruction || configs.chat.systemInstruction || '',
            googleSearch: !!effectiveConfig?.googleSearch,
            codeExecution: !!effectiveConfig?.codeExecution,
            thinkingLevel: effectiveConfig?.thinkingLevel || 'high'
          },
          refinedSystemInstruction: finalRefinedInstruction
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || errorData.error || `Server returned ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';
      let thoughts = '';
      let buffer = '';

      const modelMsgId = Date.now().toString();

      setStreamingContent('');
      setStreamingThoughts('');

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 2);
          if (chunk.startsWith('data: ')) {
            try {
              const data = JSON.parse(chunk.slice(6));
              if (data.error) {
                throw new Error(data.error);
              }
              if (data.text) { fullContent += data.text; setStreamingContent(fullContent); }
              if (data.thoughts) { thoughts += data.thoughts; setStreamingThoughts(thoughts); }
            } catch (e) {
              throw e;
            }
          }
        }
      }

      setStreamingThoughtsExpanded(false);
      if (thoughts) {
        setExpandedThoughts(prev => ({ ...prev, [modelMsgId]: false }));
      }

      const modelMessage: Message = {
        id: modelMsgId,
        role: 'model',
        content: fullContent,
        thoughts,
        createdAt: Date.now(),
      };
      setRecentlyCompletedMessageId(modelMsgId);
      setOptimisticMessages(prev => [...prev.filter(message => message.id !== modelMessage.id), modelMessage]);
      const persistedModel = await persistSessionMessage(currentSessionId, modelMessage);
      if (!persistedModel) {
        setOptimisticMessages(prev => [...prev.filter(message => message.id !== modelMessage.id), modelMessage]);
      }

    } catch (error: any) {
      if (isRichToolRun && liveCoworkMessageRef.current) {
        if (error.name === 'AbortError') {
          setCoworkDraft(prev => {
            if (!prev || prev.runState === 'aborted') return prev;
            const next = applyCoworkEventToMessage(prev, {
              type: 'warning',
              title: 'Interrompu',
              message: "Execution arretee par l'utilisateur.",
            });
            return { ...next, runState: 'aborted' };
          });
        } else {
          setCoworkDraft(prev => {
            if (!prev) return prev;
            if (prev.runState && prev.runState !== 'running') return prev;
            return applyCoworkEventToMessage(prev, {
              type: 'error',
              message: error.message || String(error),
              runState: 'failed',
            });
          });
        }
        await flushCoworkPersist();
      }

      if (error.name !== 'AbortError') {
        console.error('Send error:', error);
        alert(`Erreur d'envoi : ${error.message || String(error)}`);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
      sendInFlightRef.current = false;
    }
  };
  handleSendRuntimeRef.current = handleSend;

  const rerunActiveAgentWorkspace = useCallback(async () => {
    if (!user || !activeSessionId || activeSessionId === 'local-new' || !activeAgentWorkspace) return;
    if (isLoading || sendInFlightRef.current) return;

    const launchPrompt = buildAgentLaunchPrompt(activeAgentWorkspace.agent, activeAgentWorkspace.formValues);
    const updatedSession: ChatSession = {
      ...activeSession,
      updatedAt: Date.now(),
      sessionKind: 'agent',
      agentWorkspace: {
        ...activeAgentWorkspace,
        formValues: buildAgentRuntimeFormValues(activeAgentWorkspace.agent, activeAgentWorkspace.formValues),
        lastLaunchPrompt: launchPrompt,
      },
    };

    upsertSessionLocal(updatedSession, { pendingRemote: true });
    await persistSessionShell(updatedSession);

    if (handleSendRuntimeRef.current) {
      await handleSendRuntimeRef.current(launchPrompt, undefined, updatedSession);
    }
  }, [activeAgentWorkspace, activeSession, activeSessionId, isLoading, persistSessionShell, upsertSessionLocal, user]);

  const rerunActiveGeneratedAppWorkspace = useCallback(async () => {
    if (!user || !activeSessionId || activeSessionId === 'local-new' || !activeGeneratedAppWorkspace) return;
    if (isLoading || sendInFlightRef.current) return;

    const launchPrompt = buildGeneratedAppLaunchPrompt(activeGeneratedAppWorkspace.app, activeGeneratedAppWorkspace.formValues);
    const updatedSession: ChatSession = {
      ...activeSession,
      updatedAt: Date.now(),
      sessionKind: 'generated_app',
      generatedAppWorkspace: {
        ...activeGeneratedAppWorkspace,
        app: buildGeneratedAppRemotePayload(activeGeneratedAppWorkspace.app),
        formValues: buildAgentRuntimeFormValues(adaptGeneratedAppToStudioAgent(activeGeneratedAppWorkspace.app), activeGeneratedAppWorkspace.formValues),
        lastLaunchPrompt: launchPrompt,
      },
    };

    upsertSessionLocal(updatedSession, { pendingRemote: true });
    await persistSessionShell(updatedSession);

    if (handleSendRuntimeRef.current) {
      await handleSendRuntimeRef.current(launchPrompt, undefined, updatedSession);
    }
  }, [activeGeneratedAppWorkspace, activeSession, activeSessionId, isLoading, persistSessionShell, upsertSessionLocal, user]);

  const publishActiveGeneratedAppWorkspace = useCallback(async () => {
    if (!user || !activeGeneratedAppWorkspace) return;
    if (isPublishingGeneratedApp) return;

    setIsPublishingGeneratedApp(true);
    try {
      const response = await fetch('/api/generated-apps/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manifest: activeGeneratedAppWorkspace.app,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.manifest) {
        throw new Error(data?.details || data?.message || "Impossible de publier l'app.");
      }

      const publishedManifest = await persistGeneratedAppManifest(data.manifest as GeneratedAppManifest);
      if (!publishedManifest || !activeSessionId || activeSessionId === 'local-new') return;

      const updatedSession: ChatSession = {
        ...activeSession,
        updatedAt: Date.now(),
        sessionKind: 'generated_app',
        generatedAppWorkspace: {
          ...activeGeneratedAppWorkspace,
          app: buildGeneratedAppRemotePayload(publishedManifest),
        },
      };

      upsertSessionLocal(updatedSession, { pendingRemote: true });
      await persistSessionShell(updatedSession);
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
    } finally {
      setIsPublishingGeneratedApp(false);
    }
  }, [activeGeneratedAppWorkspace, activeSession, activeSessionId, isPublishingGeneratedApp, persistGeneratedAppManifest, persistSessionShell, upsertSessionLocal, user]);

  const handleRunAgentFromHub = useCallback(async (
    agent: StudioAgent,
    values: AgentFormValues
  ) => {
    if (isLoading || sendInFlightRef.current) return;

    setIsRunningHubAgent(true);

    try {
      const matchedGeneratedApp = generatedApps.find(app => app.id === agent.id);
      if (matchedGeneratedApp) {
        await openGeneratedAppWorkspace(matchedGeneratedApp, values, { autoRun: false });
      } else {
        await openAgentWorkspace(agent, values, { autoRun: false });
      }
    } finally {
      setIsRunningHubAgent(false);
    }
  }, [generatedApps, isLoading, openAgentWorkspace, openGeneratedAppWorkspace]);

  const handleRetry = async (idx: number) => {
    if (!user || !activeSessionId || activeSessionId === 'local-new' || isLoading || sendInFlightRef.current) return;
    
    const messages = currentMessages;
    const targetMsg = messages[idx];
    
    let messagesToDelete: string[] = [];
    let historyToProcess: Message[] = [];

    if (targetMsg.role === 'model') {
      let userMsgIdx = -1;
      for (let i = idx - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          userMsgIdx = i;
          break;
        }
      }
      if (userMsgIdx === -1) return;
      
      // Supprimer ce message modèle ET tous les messages qui suivent
      messagesToDelete = messages.slice(idx).map(m => m.id);
      historyToProcess = messages.slice(0, userMsgIdx + 1);
    } else {
      // Supprimer tous les messages qui suivent le message utilisateur
      messagesToDelete = messages.slice(idx + 1).map(m => m.id);
      historyToProcess = messages.slice(0, idx + 1);
    }

    if (historyToProcess.length === 0) return;

    await Promise.all(messagesToDelete.map(id => 
      deleteDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId, 'messages', id))
    ));
    clearCoworkSessionSnapshots(user.uid, activeSessionId, messagesToDelete);
    clearSessionSnapshots(user.uid, activeSessionId, messagesToDelete);

    handleSend('', historyToProcess);
  };

  const handleEdit = async (idx: number, newText: string) => {
    if (!user || !activeSessionId || activeSessionId === 'local-new' || isLoading || sendInFlightRef.current) return;
    const targetMsg = currentMessages[idx];
    
    await updateDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId, 'messages', targetMsg.id), {
      content: newText
    });

    const messagesToDelete = currentMessages.slice(idx + 1).map(m => m.id);
    await Promise.all(messagesToDelete.map(id =>
      deleteDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId, 'messages', id))
    ));
    clearCoworkSessionSnapshots(user.uid, activeSessionId, messagesToDelete);
    clearSessionSnapshots(user.uid, activeSessionId, messagesToDelete);

    const historyToProcess = [...currentMessages.slice(0, idx), { ...targetMsg, content: newText }];
    handleSend('', historyToProcess);
  };

  const handleManualTitleUpdate = async () => {
    if (!user || !titleInput.trim()) return;
    
    if (activeSessionId === 'local-new') {
      setCustomTitle(titleInput);
      setIsEditingTitle(false);
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId), { title: titleInput });
      setIsEditingTitle(false);
    } catch (e) { console.error(e); }
  };

  const handleAiTitleUpdate = async () => {
    if (!user || currentMessages.length === 0) return;
    setIsGeneratingTitle(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: "Génère un titre très court et percutant (max 5 mots) pour cette discussion. Réponds UNIQUEMENT avec le titre, rien d'autre.",
          history: currentMessages.slice(0, 10).map(m => ({ 
            role: m.role, 
            parts: [{ text: m.content }] 
          })),
          config: { 
            model: 'gemini-3.1-flash-lite-preview',
            temperature: 0.1, 
            topP: 1, topK: 1, maxOutputTokens: 64,
            systemInstruction: "Tu es un assistant spécialisé dans le titrage minimaliste. Ton thinking doit être minimal.",
            thinkingLevel: 'low'
          }
        })
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let aiTitle = '';
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.text) aiTitle += data.text;
            } catch (e) {}
          }
        }
      }
      aiTitle = aiTitle.trim().replace(/^["']|["']$/g, '');
      if (aiTitle) {
        if (activeSessionId === 'local-new') {
          setCustomTitle(aiTitle);
        } else {
          await updateDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId), { title: aiTitle });
        }
      }
    } catch (e) { console.error(e); } finally { setIsGeneratingTitle(false); }
  };

  const renderMessageRow = (msg: Message, index: number) => (
    <div key={msg.id || index} className="py-4">
      <MessageItem
        msg={msg}
        idx={visibleMessageOffset + index}
        isLast={index === visibleMessages.length - 1}
        isLoading={isLoading}
        isExpanded={!!expandedThoughts[msg.id]}
        disableEntranceAnimation={msg.id === recentlyCompletedMessageId}
        onToggleThoughts={() => setExpandedThoughts(p => ({ ...p, [msg.id]: !p[msg.id] }))}
        setSelectedImage={setSelectedImage}
        onEdit={handleEdit}
        onRetry={handleRetry}
      />
    </div>
  );


  if (isCoworkAppsView) {
    return (
      <div
        className={cn(
          "studio-shell flex h-[100dvh] w-full overflow-hidden transition-all duration-500 font-sans",
          "bg-[var(--app-bg)] text-[var(--app-text)]"
        )}
      >
        <AgentsHub
          isOpen={showAgentsHub}
          agents={coworkStoreAgents}
          isCreating={isCreatingAgent}
          creationRun={generatedAppCreationRun}
          isRunningAgent={isRunningHubAgent || isLoading}
          latestCreatedAgent={latestCreatedStorePreview}
          warningMessage={agentsWarning}
          onClose={() => setShowAgentsHub(false)}
          onCreateAgent={handleCreateAgent}
          onRunAgent={handleRunAgentFromHub}
        />
      </div>
    );
  }

  if (isDedicatedAgentStudioView && activeAgentWorkspace && activeAgentStudioKind === 'nasheed') {
    return (
      <>
        <Suspense fallback={<div className="flex h-[100dvh] w-full items-center justify-center bg-[var(--app-bg)] px-6"><StudioSurfaceFallback label="Ouverture du studio nasheed..." /></div>}>
          <NasheedStudioWorkspace
            agent={activeAgentWorkspace.agent}
            formValues={activeAgentWorkspace.formValues}
            messages={displayedMessages}
            isRunning={isLoading}
            onFieldChange={(fieldId, value) => {
              void updateAgentWorkspaceValues({
                ...activeAgentWorkspace.formValues,
                [fieldId]: value,
              });
            }}
            onRunAgent={() => rerunActiveAgentWorkspace()}
            onAskCowork={(request) => requestCoworkAgentEdit(
              activeAgentWorkspace.agent,
              request,
              activeAgentWorkspace.formValues
            )}
            onBackToHub={openCoworkAppsHome}
            setSelectedImage={setSelectedImage}
          />
        </Suspense>
        {selectedImage && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4 backdrop-blur-xl" onClick={() => setSelectedImage(null)}>
            <img src={selectedImage} className="max-h-full max-w-full rounded-[2rem] border border-white/10 shadow-[0_30px_80px_-28px_rgba(0,0,0,0.9)]" />
          </div>
        )}
      </>
    );
  }

  if (activeGeneratedAppWorkspace) {
    return (
      <Suspense fallback={<div className="flex h-[100dvh] w-full items-center justify-center bg-[var(--app-bg)] px-6"><StudioSurfaceFallback label="Ouverture de l'app autonome..." /></div>}>
        <GeneratedAppHost
          manifest={activeGeneratedAppWorkspace.app}
          formValues={activeGeneratedAppWorkspace.formValues}
          messages={displayedMessages}
          isRunning={isLoading}
          isPublishing={isPublishingGeneratedApp}
          onFieldChange={(fieldId, value) => {
            void updateGeneratedAppWorkspaceValues({
              ...activeGeneratedAppWorkspace.formValues,
              [fieldId]: value,
            });
          }}
          onRunApp={() => rerunActiveGeneratedAppWorkspace()}
          onPublishApp={() => publishActiveGeneratedAppWorkspace()}
          onAskCowork={(request) => requestCoworkGeneratedAppEdit(
            activeGeneratedAppWorkspace.app,
            request,
            activeGeneratedAppWorkspace.formValues
          )}
          onBackToHub={openCoworkAppsHome}
        />
      </Suspense>
    );
  }

  return (
    <div className={cn(
      "studio-shell flex h-[100dvh] w-full font-sans",
      "bg-[var(--app-bg)] text-[var(--app-text)]"
    )}>
      <SidebarLeft user={user} sessions={sessions} isVertexConfigured={isVertexConfigured} onNewChat={handleNewChat} onModeChange={handleModeChange} />

      {/* Mobile Overlays */}
      <AnimatePresence>
        {isLeftSidebarVisible && (
          <motion.div
            key="side-overlay-left"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLeftSidebarVisible(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
        {isRightSidebarVisible && (
          <motion.div
            key="side-overlay-right"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRightSidebarVisible(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {!isAuthReady ? (
        <div className="flex flex-1 items-center justify-center">
          <div className="studio-panel flex items-center gap-3 rounded-full px-5 py-3 text-sm text-[var(--app-text-muted)]">
            <Loader2 className="animate-spin text-[var(--app-accent)]" size={16} />
            Chargement du studio...
          </div>
        </div>
      ) : (
        <div 
          className="relative flex w-full flex-1 flex-col overflow-hidden"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[40vh] bg-[radial-gradient(ellipse_at_top,var(--app-accent-soft),transparent_60%)] opacity-40" />
          </div>

          {/* Global Dropzone Overlay */}
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] m-3 flex items-center justify-center rounded-2xl border-2 border-dashed border-[var(--app-accent)]/30 bg-[rgba(var(--app-bg-rgb),0.8)] backdrop-blur-sm pointer-events-none"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.05, opacity: 0 }}
                  className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] p-10 shadow-2xl"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                    <Plus size={28} />
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-semibold text-[var(--app-text)]">Deposer des fichiers</div>
                    <div className="mt-1 text-sm text-[var(--app-text-muted)]">N'importe ou</div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <header className="relative z-40 flex h-14 items-center justify-between border-b border-[var(--app-border)] bg-[rgb(var(--app-bg-rgb))]/80 backdrop-blur-md px-3 sm:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
               <button onClick={() => setLeftSidebarVisible(!isLeftSidebarVisible)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] transition-colors"><Menu size={16}/></button>
               {user && (
                 <button onClick={handleNewChat} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] transition-colors" title={activeModeCreateLabel}>
                   <Plus size={16} />
                 </button>
               )}

               <div className="group/title flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                 {!user ? (
                   <div className="min-w-0">
                     <div className="truncate text-sm font-semibold text-[var(--app-text)]">Studio</div>
                     <div className="truncate text-[10px] text-[var(--app-text-muted)]">{activeModeLabel}</div>
                   </div>
                 ) : isEditingTitle ? (
                   <div className="flex w-full max-w-sm items-center gap-2">
                     <input autoFocus value={titleInput} onChange={e => setTitleInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleManualTitleUpdate()} onBlur={() => setIsEditingTitle(false)} className="studio-input text-sm py-1.5" />
                     <button onClick={handleManualTitleUpdate} className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-accent)] text-white"><Check size={14}/></button>
                   </div>
                 ) : (
                   <>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[var(--app-text)]">{activeSession.title}</div>
                        <div className="flex items-center gap-1.5">
                          <span className="truncate text-[10px] text-[var(--app-text-muted)]">{activeSurfaceLabel}</span>
                         {(activeSession.sessionKind === 'agent' || activeSession.sessionKind === 'generated_app') && (
                           <span className="rounded-md bg-[var(--app-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase text-[var(--app-accent)]">App</span>
                         )}
                       </div>
                     </div>
                     <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/title:opacity-100">
                        <button onClick={() => { setTitleInput(activeSession.title); setIsEditingTitle(true); }} className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] transition-colors" title="Modifier"><Pencil size={12} /></button>
                        <button onClick={handleAiTitleUpdate} disabled={isGeneratingTitle} className={cn("flex h-7 w-7 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent)] transition-colors", isGeneratingTitle && "animate-pulse")} title="Titre IA"><Sparkles size={12} /></button>
                     </div>
                   </>
                 )}
               </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
               {activeMode === 'cowork' && user && (
                 <button onClick={() => setShowAgentsHub(true)} className="hidden items-center gap-1.5 rounded-lg bg-[var(--app-accent-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-accent)] hover:bg-[var(--app-accent-soft)] sm:inline-flex" title="Cowork Apps">
                   <Bot size={13} />
                   <span className="hidden sm:inline">Apps</span>
                   {coworkStoreAgents.length > 0 && (<span className="rounded-md bg-[var(--app-accent)]/20 px-1.5 py-0.5 text-[10px]">{coworkStoreAgents.length}</span>)}
                 </button>
               )}
               <button onClick={() => setShowSearch(!showSearch)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] transition-colors"><Search size={15}/></button>
               <button onClick={() => handleExport('md')} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] transition-colors"><Download size={15}/></button>
               <button onClick={() => setRightSidebarVisible(!isRightSidebarVisible)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] transition-colors"><SlidersHorizontal size={15}/></button>
            </div>
          </header>

          {activeMode === 'cowork' && user && !showAgentsHub && (latestCreatedStorePreview || agentsWarning) && (
            <div className="border-b border-[var(--app-border)] px-3 py-2 sm:px-4">
              <div className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-2">
                {latestCreatedStorePreview && (
                  <button onClick={() => setShowAgentsHub(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--app-accent-soft)] px-2.5 py-1.5 text-xs font-medium text-[var(--app-accent)] transition-colors hover:bg-[var(--app-accent-soft)]">
                    <Bot size={12} />
                    <span className="max-w-[12rem] truncate">{latestCreatedStorePreview.name} prete</span>
                  </button>
                )}
                {agentsWarning && (
                  <button onClick={() => setShowAgentsHub(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-400 transition-colors">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    Local
                  </button>
                )}
                {latestCreatedStorePreview && (
                  <button onClick={() => { setLatestCreatedAgent(null); setLatestCreatedGeneratedApp(null); }} className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors" title="Masquer">
                    <X size={12} />
                  </button>
                )}
              </div>
            </div>
          )}

          {!user ? (
            <main className="relative flex-1 min-h-0 overflow-hidden">
              <StudioEmptyState
                mode={activeMode}
                isAuthenticated={false}
                onPrimaryAction={handleGoogleLogin}
                onQuickPrompt={handleGoogleLogin}
              />
            </main>
          ) : (
            <>
              {showAgentsHub && (
                <Suspense fallback={<div className="absolute inset-0 z-[90] flex items-center justify-center bg-[rgb(var(--app-bg-rgb))] px-6"><StudioSurfaceFallback label="Ouverture de Cowork Apps..." /></div>}>
                  <AgentsHub
                    isOpen={showAgentsHub}
                    agents={coworkStoreAgents}
                    isCreating={isCreatingAgent}
                    creationRun={generatedAppCreationRun}
                    isRunningAgent={isRunningHubAgent || isLoading}
                    latestCreatedAgent={latestCreatedStorePreview}
                    warningMessage={agentsWarning}
                    onClose={() => setShowAgentsHub(false)}
                    onCreateAgent={handleCreateAgent}
                    onRunAgent={handleRunAgentFromHub}
                  />
                </Suspense>
              )}

              {/* --- MEDIA STUDIO MODES (image / video / audio / lyria) --- */}
              {(activeMode === 'image' || activeMode === 'video' || activeMode === 'audio' || activeMode === 'lyria') && !isAgentSession && !isGeneratedAppSession ? (
                <main className="relative flex-1 min-h-0 overflow-hidden">
                  <Suspense fallback={<div className="flex h-full items-center justify-center"><Loader2 size={22} className="animate-spin text-[var(--app-accent)]" /></div>}>
                    {activeMode === 'image' && (
                      <ImageStudio
                        onGenerate={handleSend}
                        isLoading={isLoading}
                        messages={displayedMessages}
                        onImageClick={setSelectedImage}
                        isRefinerEnabled={isPromptRefinerEnabled}
                        onToggleRefiner={() => setPromptRefinerEnabled(!isPromptRefinerEnabled)}
                      />
                    )}
                    {activeMode === 'video' && (
                      <VideoStudio
                        onGenerate={handleSend}
                        isLoading={isLoading}
                        messages={displayedMessages}
                        isRefinerEnabled={isPromptRefinerEnabled}
                        onToggleRefiner={() => setPromptRefinerEnabled(!isPromptRefinerEnabled)}
                      />
                    )}
                    {activeMode === 'audio' && (
                      <AudioStudio
                        onGenerate={handleSend}
                        isLoading={isLoading}
                        messages={displayedMessages}
                        isRefinerEnabled={isPromptRefinerEnabled}
                        onToggleRefiner={() => setPromptRefinerEnabled(!isPromptRefinerEnabled)}
                      />
                    )}
                    {activeMode === 'lyria' && (
                      <LyriaStudio
                        onGenerate={handleSend}
                        isLoading={isLoading}
                        messages={displayedMessages}
                        isRefinerEnabled={isPromptRefinerEnabled}
                        onToggleRefiner={() => setPromptRefinerEnabled(!isPromptRefinerEnabled)}
                      />
                    )}
                  </Suspense>
                </main>
              ) : (
              <>
              <main
                ref={parentRef}
                className={cn(
                  'relative flex-1 min-h-0 overflow-x-hidden',
                  shouldShowEmptyState ? 'overflow-hidden' : 'overflow-y-auto'
                )}
              >
                {shouldShowEmptyState && (
                  <StudioEmptyState
                    mode={activeMode}
                    isAuthenticated={true}
                    onPrimaryAction={() => handleQuickStartPrompt("Commence une nouvelle mission dans ce mode.")}
                    onQuickPrompt={handleQuickStartPrompt}
                    onOpenAgentsHub={activeMode === 'cowork' ? () => setShowAgentsHub(true) : undefined}
                  />
                )}
                {!shouldShowEmptyState && (
                  <>
                {activeAgentWorkspace && (
                  <Suspense fallback={<div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-10"><StudioSurfaceFallback label="Preparation de l'espace agent..." /></div>}>
                    <AgentWorkspacePanel
                      agent={activeAgentWorkspace.agent}
                      formValues={activeAgentWorkspace.formValues}
                      isRunning={isLoading}
                      onFieldChange={(fieldId, value) => {
                        void updateAgentWorkspaceValues({
                          ...activeAgentWorkspace.formValues,
                          [fieldId]: value,
                        });
                      }}
                      onRunAgent={() => rerunActiveAgentWorkspace()}
                      onAskCowork={(request) => requestCoworkAgentEdit(
                        activeAgentWorkspace.agent,
                        request,
                        activeAgentWorkspace.formValues
                      )}
                    />
                  </Suspense>
                )}
                {hiddenMessagesCount > 0 && (
                  <div className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6 lg:px-10">
                    <div className="flex items-start gap-3 rounded-xl border border-[var(--app-border)] bg-white/[0.03] px-4 py-3 text-sm text-[var(--app-text-muted)]">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--app-accent-soft)] text-[var(--app-accent)]">
                        <History size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--app-text)]">
                          Affichage allégé
                        </div>
                        <p className="mt-1 leading-relaxed">
                          Seuls les {MESSAGE_VISIBILITY_LIMIT} derniers messages sont affichés pour garder la conversation fluide.
                          {' '}Les {hiddenMessagesCount} messages plus anciens restent conservés dans la discussion et dans la mémoire.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {shouldVirtualizeMessages ? (
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                    className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10"
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                      const msg = visibleMessages[virtualItem.index];
                      const absoluteIndex = visibleMessageOffset + virtualItem.index;
                      if (!msg) return null;
                      return (
                        <div
                          key={msg.id || virtualItem.key}
                          data-index={virtualItem.index}
                          ref={rowVirtualizer.measureElement}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualItem.start}px)`,
                          }}
                          className="py-4"
                        >
                          <MessageItem
                            msg={msg}
                            idx={absoluteIndex}
                            isLast={virtualItem.index === visibleMessages.length - 1}
                            isLoading={isLoading}
                            isExpanded={!!expandedThoughts[msg.id]}
                            disableEntranceAnimation={msg.id === recentlyCompletedMessageId}
                            onToggleThoughts={() => setExpandedThoughts(p => ({ ...p, [msg.id]: !p[msg.id] }))}
                            setSelectedImage={setSelectedImage}
                            onEdit={handleEdit}
                            onRetry={handleRetry}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10">
                    {visibleMessages.map((msg, index) => renderMessageRow(msg, index))}
                  </div>
                )}
                 {/* Refining Status */}
                 {refiningStatus && (
                    <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-4 text-indigo-400 sm:px-6 lg:px-10">
                     <div className="p-2 bg-indigo-500/10 rounded-lg animate-pulse">
                        <Sparkles size={18} className="animate-spin-slow" />
                     </div>
                     <span className="text-sm font-medium tracking-wide">{refiningStatus}</span>
                   </div>
                 )}

                 {/* Message en cours de génération — visible immédiatement avec toggle Thoughts */}
                 {isLoading && !refiningStatus && activeMode !== 'cowork' && !isAgentSession && !isGeneratedAppSession && (
                    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-10">
                     <MessageItem
                       msg={{ id: 'streaming', role: 'model', content: streamingContent, thoughts: streamingThoughts, createdAt: Date.now() }}
                      idx={displayedMessages.length}
                      isLast={true}
                      isLoading={true}
                      isExpanded={streamingThoughtsExpanded}
                      onToggleThoughts={() => setStreamingThoughtsExpanded(p => !p)}
                      setSelectedImage={setSelectedImage}
                      onEdit={() => {}}
                      onRetry={() => {}}
                    />
                  </div>
                )}
                {shouldRenderMessageEndSpacer && (
                  <div ref={messagesEndRef} className="h-32 sm:h-40" />
                )}
                  </>
                )}
              </main>

              <div className="border-t border-[var(--app-border)] bg-[rgb(var(--app-bg-rgb))]/80 backdrop-blur-md px-3 pb-3 pt-3 sm:px-4">
                <div className="mx-auto max-w-3xl">
                  <ChatInput onSend={handleSend} onStop={() => abortControllerRef.current?.abort()} isLoading={isLoading} isRecording={isRecording} recordingTime={recordingTime} onToggleRecording={toggleRecording} processFiles={processFiles} pendingAttachments={pendingAttachments} setPendingAttachments={setPendingAttachments} setSelectedImage={setSelectedImage} />
                </div>
              </div>
              </>
              )}
            </>
          )}
        </div>
      )}

      <SidebarRight
        activeSession={activeSession as ChatSession}
        selectedCustomPrompt={selectedCustomPrompt}
        onSelectedCustomPromptChange={setSelectedCustomPrompt}
      />
      
      {/* Search Overlay */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute left-1/2 top-20 z-[100] w-full max-w-lg -translate-x-1/2 px-4">
            <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-strong)] p-3 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-2.5">
                <Search size={15} className="text-[var(--app-accent)] shrink-0" />
                <input autoFocus placeholder="Rechercher…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-transparent border-none outline-none text-sm text-[var(--app-text)] placeholder:text-[var(--app-text-muted)]" />
                <button onClick={() => setShowSearch(false)} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)] transition-colors"><X size={14} /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal image */}
      {selectedImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4 backdrop-blur-md" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} className="max-h-full max-w-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
