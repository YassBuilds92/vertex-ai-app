import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  doc, collection, onSnapshot, query, orderBy, setDoc, updateDoc, deleteDoc, getDoc,
  OperationType, handleFirestoreError, User as FirebaseUser, cleanForFirestore
} from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from './store/useStore';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { ChatInput } from './components/ChatInput';
import { MessageItem } from './components/MessageItem';
import { AgentsHub } from './components/AgentsHub';
import { Message, ChatSession, AppMode, Attachment, AttachmentType, SystemPromptVersion, StudioAgent, AgentBlueprint } from './types';
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

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const LEGACY_COWORK_SYSTEM_INSTRUCTION = "Tu es un agent autonome en mode Cowork. Tu as accès à des outils pour accomplir des tâches complexes. Analyse, propose et exécute.";
const createClientMessageId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const slugifyAgentLabel = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agent-studio';

export default function App() {
  const { 
    activeMode, setActiveMode, activeSessionId, setActiveSessionId, 
    lastSessionIdsByMode,
    configs, setConfig, isLeftSidebarVisible, setLeftSidebarVisible,
    isRightSidebarVisible, setRightSidebarVisible, theme, 
    isPromptRefinerEnabled
  } = useStore();
  const config = configs[activeMode];

  // Handle theme class on root element
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'oled');
    if (theme === 'light') root.classList.add('light');
    if (theme === 'oled') root.classList.add('oled');
  }, [theme]);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [agents, setAgents] = useState<StudioAgent[]>([]);
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
  const [liveCoworkMessage, setLiveCoworkMessage] = useState<Message | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [showAgentsHub, setShowAgentsHub] = useState(false);
  const [latestCreatedAgent, setLatestCreatedAgent] = useState<StudioAgent | null>(null);

  const activeSessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const liveCoworkMessageRef = useRef<Message | null>(null);
  const coworkFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const coworkFlushTargetRef = useRef<{ userId: string; sessionId: string } | null>(null);
  const coworkStorageModeRef = useRef<'rich' | 'legacy'>('rich');
  const coworkStorageWarningShownRef = useRef(false);
  const sendInFlightRef = useRef(false);

  const activeSession = sessions.find(s => s.id === activeSessionId) || { 
    id: 'local-new', 
    title: customTitle || 'Nouvelle conversation', 
    messages: [], 
    updatedAt: Date.now(), 
    mode: activeMode, 
    userId: user?.uid || '', 
    systemInstruction: config?.systemInstruction || configs.chat?.systemInstruction || '' 
  };

  const materializeAgentBlueprint = useCallback((blueprint: AgentBlueprint, overrides?: Partial<StudioAgent>): StudioAgent => {
    const now = Date.now();
    const baseSlug = slugifyAgentLabel(blueprint.slug || blueprint.name || 'agent-studio');
    const id = blueprint.id || `${baseSlug}-${now.toString(36)}`;

    return {
      ...blueprint,
      ...overrides,
      id,
      slug: baseSlug,
      name: blueprint.name || overrides?.name || 'Agent specialise',
      tagline: blueprint.tagline || overrides?.tagline || 'Agent pret a deleguer',
      summary: blueprint.summary || overrides?.summary || 'Blueprint genere par Cowork.',
      mission: blueprint.mission || overrides?.mission || blueprint.summary || 'Mission a preciser.',
      whenToUse: blueprint.whenToUse || overrides?.whenToUse || 'A utiliser quand tu veux deleguer une mission recurrente.',
      starterPrompt: blueprint.starterPrompt || overrides?.starterPrompt || `Prends en charge cette mission: ${blueprint.name || 'agent specialise'}.`,
      systemInstruction: blueprint.systemInstruction || overrides?.systemInstruction || `Tu es ${blueprint.name || 'un agent specialise'}.`,
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
    };
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

    await setDoc(
      doc(db, 'users', user.uid, 'agents', nextAgent.id),
      cleanForFirestore(nextAgent)
    );

    setLatestCreatedAgent(nextAgent);
    if (openHub) {
      setShowAgentsHub(true);
    }

    return nextAgent;
  }, [materializeAgentBlueprint, user]);

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

  const activateMode = useCallback((mode: AppMode) => {
    setActiveMode(mode);

    const preferredSessionId = lastSessionIdsByMode[mode];
    const preferredSession = preferredSessionId
      ? sessions.find(session => session.id === preferredSessionId && session.mode === mode)
      : undefined;
    const fallbackSession = sessions.find(session => session.mode === mode);

    if (preferredSession) {
      setActiveSessionId(preferredSession.id);
      return;
    }

    if (fallbackSession) {
      setActiveSessionId(fallbackSession.id);
      return;
    }

    setPendingAttachments([]);
    setCustomTitle(null);
    setActiveSessionId('local-new');
  }, [lastSessionIdsByMode, sessions, setActiveMode, setActiveSessionId]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const modes: AppMode[] = ['chat', 'cowork', 'image', 'video', 'audio'];
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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    fetch('/api/status').then(res => res.json()).then(data => setIsVertexConfigured(data.isVertexConfigured));
  }, []);

  useEffect(() => {
    if (!user) { setSessions([]); return; }
    const q = query(collection(db, 'users', user.uid, 'sessions'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), messages: [] } as ChatSession)));
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setAgents([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'agents'), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setAgents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudioAgent)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/agents`);
    });
  }, [user]);

  useEffect(() => {
    if (activeMode !== 'cowork') {
      setShowAgentsHub(false);
    }
  }, [activeMode]);

  // Auto-scroll logic to maintain focus on the latest message/streaming content
  useEffect(() => {
    if (isLoading || displayedMessages.length > 0) {
      const scrollTimer = setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 100);
      return () => clearTimeout(scrollTimer);
    }
  }, [displayedMessages.length, streamingContent, streamingThoughts, isLoading]);

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
      if (activeMode === 'cowork') {
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
  }, [user, activeMode, activeSessionId]);



  const handleNewChat = useCallback(() => {
    setPendingAttachments([]);
    setCustomTitle(null);
    setActiveSessionId('local-new');
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

  const handleCreateAgent = useCallback(async (brief: string) => {
    if (!user || isCreatingAgent) return null;

    const cleanedBrief = brief.trim();
    if (!cleanedBrief) return null;

    setIsCreatingAgent(true);
    try {
      const response = await fetch('/api/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief: cleanedBrief,
          source: 'manual',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.blueprint) {
        throw new Error(data?.details || data?.message || "Impossible de creer l'agent.");
      }

      return await persistAgentBlueprint(data.blueprint as AgentBlueprint, {
        createdBy: 'manual',
        sourcePrompt: cleanedBrief,
        sourceSessionId: activeSessionId && activeSessionId !== 'local-new' ? activeSessionId : undefined,
        openHub: true,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : String(error));
      return null;
    } finally {
      setIsCreatingAgent(false);
    }
  }, [activeSessionId, isCreatingAgent, persistAgentBlueprint, user]);

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
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: displayedMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 180,
    overscan: 5,
  });
  const shouldVirtualizeMessages = activeMode !== 'cowork' && !isLoading && displayedMessages.length > 80;

  useEffect(() => {
    if (!shouldVirtualizeMessages) return;

    const frame = window.requestAnimationFrame(() => {
      rowVirtualizer.measure();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [shouldVirtualizeMessages, rowVirtualizer, displayedMessages.length, streamingContent, streamingThoughts, isLoading, expandedThoughts]);

  // --- ATTACHMENTS HELPERS ---
  const uploadAttachment = async (attachment: Attachment, userId: string, sessionId: string): Promise<string> => {
    // If it's already a URL (not base64), return it
    if (attachment.url.startsWith('http') && !attachment.url.includes('base64')) return attachment.url;
    
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
        return attachment.url;
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
      const { url } = await response.json();
      return url;
    } catch (e: any) {
      console.warn("Storage upload failed, attempting compression fallback:", e);
      
      // FALLBACK: Store directly in Firestore if we can compress it < 1MB
      if (attachment.base64 || (attachment.url && attachment.url.startsWith('data:'))) {
        const sourceData = attachment.base64 || attachment.url;
        
        // If it's already small enough, just return it
        if (sourceData.length < 800000) return sourceData;

        // Otherwise, compress it
        console.info("Compressing image for Firestore storage...");
        let compressed = await compressImage(sourceData, 800, 800, 0.7);
        
        // Final safety check: if still too big, go even smaller
        if (compressed.length > 1000000) {
          compressed = await compressImage(compressed, 512, 512, 0.5);
        }
        
        if (compressed.length < 1048000) {
           return compressed;
        }
      }

      throw new Error(`Échec de l'enregistrement : Storage inaccessible et image trop grande pour Firestore. Détails: ${e.message || String(e)}`);
    }
  };

  const handleSend = async (textToSend: string, overrideMessages?: Message[]) => {
    if ((!textToSend.trim() && pendingAttachments.length === 0 && !overrideMessages) || isLoading || sendInFlightRef.current) return;
    
    // Clear old response state immediately to prevent "phantom" previous responses
    setStreamingContent('');
    setStreamingThoughts('');
    setExpandedThoughts(prev => {
      const { streaming, ...rest } = prev;
      return rest;
    });
    setLiveCoworkMessage(null);
    liveCoworkMessageRef.current = null;
    
    const isCoworkRun = activeMode === 'cowork';
    sendInFlightRef.current = true;
    setIsLoading(true);
    setStreamingThoughtsExpanded(true);
    setExpandedThoughts(prev => ({ ...prev, streaming: true }));
    abortControllerRef.current = new AbortController();

    try {
      let currentSessionId = activeSessionId;
      if (user && (currentSessionId === 'local-new' || !currentSessionId)) {
        const newId = Date.now().toString();
        const sessionPayload = {
          title: customTitle || textToSend.slice(0, 30) || 'Nouvelle conversation',
          updatedAt: Date.now(),
          mode: activeMode,
          userId: user.uid,
          systemInstruction: config?.systemInstruction || configs.chat?.systemInstruction || ''
        };
        try {
          await setDoc(doc(db, 'users', user.uid, 'sessions', newId), sessionPayload);
        } catch (error) {
          console.warn('Session creation degraded, continuing with local state:', error);
        }
        setSessions(prev => {
          const nextSession: ChatSession = { id: newId, messages: [], ...sessionPayload };
          const withoutCurrent = prev.filter(session => session.id !== newId);
          return [nextSession, ...withoutCurrent];
        });
        setCustomTitle(null);
        currentSessionId = newId;
        setActiveSessionId(newId);
      }

      if (!user || !currentSessionId) return;
      await touchSession(currentSessionId);

      // Clean attachments for Firestore
      const cleanAttachments: Attachment[] = [];
      for (const att of pendingAttachments) {
        const { file, ...rest } = att;
        const uploadUrl = await uploadAttachment(att, user.uid, currentSessionId);
        cleanAttachments.push({ ...rest, url: uploadUrl, base64: undefined }); 
      }

      // --- PROMPT REFINEMENT ---
      let refinedInstruction = undefined;
      let finalPrompt = textToSend;

      if (overrideMessages) {
        const lastMsg = overrideMessages[overrideMessages.length - 1];
        finalPrompt = lastMsg.content;
      }

      if (isPromptRefinerEnabled && !overrideMessages && finalPrompt.trim()) {
        setRefiningStatus("Optimisation de votre prompt par l'IA...");
        try {
          const refineRes = await fetch('/api/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: finalPrompt })
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
      const generationPrompt = (activeMode === 'image' || activeMode === 'video') && refinedInstruction 
        ? refinedInstruction 
        : finalPrompt;

      // --- BRANCHED LOGIC BASED ON MODE ---
      
      if (activeMode === 'image') {
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
            model: config?.model || configs.chat.model,
            aspectRatio: config?.aspectRatio,
            imageSize: config.imageSize,
            numberOfImages: config.numberOfImages,
            personGeneration: config.personGeneration,
            safetySetting: config.safetySetting,
            thinkingLevel: config.thinkingLevel
          })
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.details || errData.message || 'Erreur génération image');
        }
        const data = await response.json();
        
        const generatedImageUrl = data.url;

        const modelMessage: Message = {
          id: createClientMessageId('model'),
          role: 'model',
          content: "Image générée avec succès.",
          attachments: [{ id: Date.now().toString(), type: 'image', url: generatedImageUrl, name: 'Image générée' }],
          createdAt: Date.now(),
        };
        const persistedModel = await persistSessionMessage(currentSessionId, modelMessage);
        if (!persistedModel) {
          setOptimisticMessages(prev => [...prev.filter(message => message.id !== modelMessage.id), modelMessage]);
        }
        
        setIsLoading(false);
        return;
      }

      if (activeMode === 'cowork') {
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

        const apiHistory = overrideMessages ? overrideMessages.slice(0, -1) : currentMessages;
        const historyForApi = apiHistory.map(m => ({
          role: m.role,
          parts:
            m.attachments && m.attachments.length > 0
              ? [
                  { text: m.content || ' ' },
                  ...m.attachments.map(a =>
                    a.type === 'youtube'
                      ? { fileData: { fileUri: a.url, mimeType: 'video/mp4' } }
                      : { inlineData: { mimeType: a.mimeType || 'image/jpeg', data: a.base64?.split(',')[1] || a.base64 || '' } }
                  ),
                ]
              : [{ text: m.content || ' ' }],
        }));
        const coworkSystemInstruction = config?.systemInstruction?.trim();
        const sanitizedCoworkSystemInstruction =
          coworkSystemInstruction && coworkSystemInstruction !== LEGACY_COWORK_SYSTEM_INSTRUCTION
            ? coworkSystemInstruction
            : undefined;

        const response = await fetch('/api/cowork', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            message: finalPrompt,
            history: historyForApi,
            attachments: cleanAttachments,
            config: {
              model: config?.model || configs.chat.model,
              temperature: config?.temperature ?? 0.1,
              topP: config?.topP ?? 1.0,
              topK: config?.topK ?? 1,
              maxOutputTokens: config?.maxOutputTokens || 65536,
              systemInstruction: sanitizedCoworkSystemInstruction,
              googleSearch: config?.googleSearch !== false,
              codeExecution: config?.codeExecution !== false,
              thinkingLevel: config?.thinkingLevel || 'high',
            },
            clientContext: {
              locale: navigator.language || 'fr-FR',
              timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Paris',
              nowIso: new Date().toISOString(),
            },
            sessionId: currentSessionId,
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

        const modelMessage: Message = {
          id: `cowork-${Date.now()}`,
          role: 'model',
          content: '',
          thoughts: '',
          activity: [{
            id: `cw-init-${Date.now()}`,
            kind: 'status',
            timestamp: Date.now(),
            iteration: 0,
            title: 'Initialisation',
            message: "Connexion a la boucle Cowork...",
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
              await persistAgentBlueprint(data.blueprint, {
                createdBy: 'cowork',
                sourcePrompt: data.blueprint.sourcePrompt || finalPrompt,
                sourceSessionId: currentSessionId,
              });
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

      if (activeMode === 'video') {
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
            videoResolution: config?.videoResolution || '720p',
            videoAspectRatio: config?.videoAspectRatio || '16:9',
            videoDurationSeconds: config?.videoDurationSeconds || 6
          })
        });

        if (!response.ok) throw new Error('Erreur génération vidéo');
        const data = await response.json();
        
        const modelMessage: Message = {
          id: createClientMessageId('model'),
          role: 'model',
          content: "Vidéo générée avec succès.",
          attachments: [{ id: Date.now().toString(), type: 'video', url: data.url, name: 'Vidéo générée' }],
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
        finalAttachments = lastMsg.attachments || [];
        finalRefinedInstruction = lastMsg.refinedInstruction || refinedInstruction;
      }

      const apiHistory = overrideMessages ? overrideMessages.slice(0, -1) : currentMessages;
      const historyForApi = apiHistory.map(m => ({
        role: m.role,
        parts: m.attachments && m.attachments.length > 0 
          ? [{ text: m.content || " " }, ...m.attachments.map(a => (a.type === 'youtube' ? { fileData: { fileUri: a.url, mimeType: "video/mp4" } } : { inlineData: { mimeType: a.mimeType || "image/jpeg", data: a.base64?.split(',')[1] || a.base64 || "" } }))]
          : [{ text: m.content || " " }]
      }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortControllerRef.current.signal,
        body: JSON.stringify({
          message: finalMessage,
          history: historyForApi,
          attachments: finalAttachments,
          config: {
            model: activeMode === 'chat' ? (config?.model || configs.chat.model) : configs.chat.model,
            temperature: config?.temperature ?? 0.7,
            topP: config?.topP ?? 0.95,
            topK: config?.topK ?? 40,
            maxOutputTokens: config?.maxOutputTokens || 8192,
            systemInstruction: config?.systemInstruction || configs.chat.systemInstruction || '',
            googleSearch: !!config?.googleSearch,
            thinkingLevel: config?.thinkingLevel || 'high'
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

      if (thoughts) setExpandedThoughts(prev => ({ ...prev, [modelMsgId]: true }));

      const modelMessage: Message = {
        id: modelMsgId,
        role: 'model',
        content: fullContent,
        thoughts,
        createdAt: Date.now(),
      };
      const persistedModel = await persistSessionMessage(currentSessionId, modelMessage);
      if (!persistedModel) {
        setOptimisticMessages(prev => [...prev.filter(message => message.id !== modelMessage.id), modelMessage]);
      }

    } catch (error: any) {
      if (isCoworkRun && liveCoworkMessageRef.current) {
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
        idx={index}
        isLast={index === displayedMessages.length - 1}
        isLoading={isLoading}
        isExpanded={!!expandedThoughts[msg.id]}
        onToggleThoughts={() => setExpandedThoughts(p => ({ ...p, [msg.id]: !p[msg.id] }))}
        setSelectedImage={setSelectedImage}
        onEdit={handleEdit}
        onRetry={handleRetry}
      />
    </div>
  );


  return (
    <div className={cn(
      "flex h-[100dvh] w-full transition-all duration-500 font-sans",
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
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
        {isRightSidebarVisible && (
          <motion.div 
            key="side-overlay-right"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRightSidebarVisible(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {!isAuthReady ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
      ) : (
        <div 
          className="flex-1 flex flex-col relative w-full overflow-hidden"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Global Dropzone Overlay */}
          <AnimatePresence>
            {isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 z-[100] bg-[var(--app-bg)]/40 backdrop-blur-md flex items-center justify-center border-2 border-dashed border-indigo-500/40 m-4 rounded-[2.5rem] pointer-events-none"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 1.1, opacity: 0 }}
                  className="flex flex-col items-center gap-4 p-12 bg-[var(--app-surface)]/80 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl ring-1 ring-indigo-500/20"
                >
                  <div className="w-20 h-20 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 ring-8 ring-indigo-500/5">
                    <Plus size={40} className="animate-pulse" />
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xl font-bold text-[var(--app-text)] tracking-tight">Ajouter des fichiers</span>
                    <span className="text-sm font-medium text-[var(--app-text-muted)] uppercase tracking-[0.2em]">Déposez-les n'importe où</span>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <header className="h-16 border-b border-[var(--app-border)] flex items-center justify-between px-6 bg-[var(--app-bg)]/80 backdrop-blur-md z-40 relative">
            <div className="flex items-center gap-4 flex-1 overflow-hidden">
               <button onClick={() => setLeftSidebarVisible(!isLeftSidebarVisible)} className="p-2 hover:bg-[var(--app-text)]/5 rounded-lg transition-colors shrink-0"><Menu size={20}/></button>
               
               <div className="flex items-center gap-2 overflow-hidden flex-1 group/title">
                 {!user ? (
                   <h1 className="text-sm font-semibold text-[var(--app-text)] truncate">Studio Pro</h1>
                 ) : isEditingTitle ? (
                   <div className="flex items-center gap-2 w-full max-w-md">
                     <input 
                       autoFocus 
                       value={titleInput} 
                       onChange={e => setTitleInput(e.target.value)}
                       onKeyDown={e => e.key === 'Enter' && handleManualTitleUpdate()}
                       onBlur={() => setIsEditingTitle(false)}
                       className="bg-[var(--app-text)]/[0.05] border border-indigo-500/30 rounded-lg px-3 py-1.5 text-sm w-full outline-none focus:ring-1 focus:ring-indigo-500/30" 
                     />
                     <button onClick={handleManualTitleUpdate} className="p-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition-colors"><Check size={14}/></button>
                   </div>
                 ) : (
                   <>
                     <h1 className="text-sm font-semibold text-[var(--app-text)] truncate">{activeSession.title}</h1>
                     <div className="flex items-center gap-1 opacity-0 group-hover/title:opacity-100 transition-opacity">
                        <button 
                          onClick={() => { setTitleInput(activeSession.title); setIsEditingTitle(true); }}
                          className="p-1.5 hover:bg-[var(--app-text)]/5 rounded-md text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-all"
                          title="Modifier manuellement"
                        >
                          <Pencil size={13} />
                        </button>
                        <button 
                          onClick={handleAiTitleUpdate}
                          disabled={isGeneratingTitle}
                          className={cn(
                            "p-1.5 hover:bg-[var(--app-text)]/5 rounded-md text-[var(--app-text-muted)] hover:text-indigo-400 transition-all",
                            isGeneratingTitle && "animate-pulse"
                          )}
                          title="Générer par IA"
                        >
                          <Sparkles size={13} />
                        </button>
                     </div>
                   </>
                 )}
               </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
               {activeMode === 'cowork' && user && (
                 <button
                   onClick={() => setShowAgentsHub(true)}
                   className="inline-flex items-center gap-2 rounded-full border border-cyan-300/18 bg-cyan-300/[0.07] px-3 py-2 text-sm font-medium text-cyan-100 transition-colors hover:bg-cyan-300/[0.12]"
                   title="Ouvrir le Hub Agents"
                 >
                   <Bot size={15} />
                   <span className="hidden sm:inline">Hub Agents</span>
                   {agents.length > 0 && (
                     <span className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] text-white/80">
                       {agents.length}
                     </span>
                   )}
                 </button>
               )}
               <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-[var(--app-text)]/5 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><Search size={20}/></button>
               <button onClick={() => handleExport('md')} className="p-2 hover:bg-[var(--app-text)]/5 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><Download size={20}/></button>
               <button onClick={() => setRightSidebarVisible(!isRightSidebarVisible)} className="p-2 hover:bg-[var(--app-text)]/5 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><SlidersHorizontal size={20}/></button>
            </div>
          </header>

          {activeMode === 'cowork' && user && latestCreatedAgent && !showAgentsHub && (
            <div className="border-b border-cyan-300/10 bg-cyan-300/[0.05] px-6 py-3">
              <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/55">Agent cree</div>
                  <div className="truncate text-sm text-cyan-50">
                    {latestCreatedAgent.name} est pret dans le Hub Agents.
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowAgentsHub(true)}
                    className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black transition-transform hover:translate-y-[-1px]"
                  >
                    Ouvrir
                  </button>
                  <button
                    onClick={() => setLatestCreatedAgent(null)}
                    className="rounded-full border border-white/10 px-3 py-2 text-sm text-white/60 transition-colors hover:text-white"
                    title="Masquer"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {!user ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <button 
                  onClick={async () => {
                    try {
                      await signInWithPopup(auth, googleProvider);
                    } catch (error: any) {
                      console.error("Login error:", error);
                      alert(`Erreur de connexion : ${error.message || String(error)}`);
                    }
                  }} 
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20"
                >
                  Se connecter avec Google
                </button>
            </div>
          ) : (
            <>
              <AgentsHub
                isOpen={showAgentsHub}
                agents={agents}
                isCreating={isCreatingAgent}
                latestCreatedAgent={latestCreatedAgent}
                onClose={() => setShowAgentsHub(false)}
                onCreateAgent={handleCreateAgent}
              />

              <main ref={parentRef} className="relative flex-1 overflow-x-hidden overflow-y-auto">
                {shouldVirtualizeMessages ? (
                  <div
                    style={{
                      height: `${rowVirtualizer.getTotalSize()}px`,
                      width: '100%',
                      position: 'relative',
                    }}
                    className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-10"
                  >
                    {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                      const msg = displayedMessages[virtualItem.index];
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
                            idx={virtualItem.index}
                            isLast={virtualItem.index === displayedMessages.length - 1}
                            isLoading={isLoading}
                            isExpanded={!!expandedThoughts[msg.id]}
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
                  <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 lg:px-10">
                    {displayedMessages.map((msg, index) => renderMessageRow(msg, index))}
                  </div>
                )}
                 {/* Refining Status */}
                 {refiningStatus && (
                    <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 text-indigo-400 sm:px-6 lg:px-10">
                     <div className="p-2 bg-indigo-500/10 rounded-lg animate-pulse">
                        <Sparkles size={18} className="animate-spin-slow" />
                     </div>
                     <span className="text-sm font-medium tracking-wide">{refiningStatus}</span>
                   </div>
                 )}

                 {/* Message en cours de génération — visible immédiatement avec toggle Thoughts */}
                 {isLoading && !refiningStatus && activeMode !== 'cowork' && (
                    <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6 lg:px-10">
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
                <div ref={messagesEndRef} className="h-44" />
              </main>

              <div className="p-5 bg-gradient-to-t from-inherit via-inherit to-transparent pt-10">
                <div className="max-w-3xl mx-auto">
                  <ChatInput onSend={handleSend} onStop={() => abortControllerRef.current?.abort()} isLoading={isLoading} isRecording={isRecording} recordingTime={recordingTime} onToggleRecording={toggleRecording} processFiles={processFiles} pendingAttachments={pendingAttachments} setPendingAttachments={setPendingAttachments} setSelectedImage={setSelectedImage} />
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <SidebarRight activeSession={activeSession as ChatSession} />
      
      {/* Search Overlay */}
      <AnimatePresence>
        {showSearch && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="absolute top-20 left-1/2 -translate-x-1/2 w-full max-w-xl z-[100] px-4">
            <div className="bg-[var(--app-surface)]/90 backdrop-blur-xl border border-[var(--app-border)] rounded-2xl p-4 shadow-2xl">
              <div className="flex items-center gap-3">
                <Search size={18} className="text-[var(--app-text-muted)]" />
                <input autoFocus placeholder="Rechercher dans la conversation..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-[var(--app-text)] w-full text-sm placeholder:text-[var(--app-text-muted)]/50" />
                <button onClick={() => setShowSearch(false)}><X size={18} className="text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors" /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal image */}
      {selectedImage && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <img src={selectedImage} className="max-w-full max-h-full rounded-2xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}
