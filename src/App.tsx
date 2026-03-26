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
  doc, collection, onSnapshot, query, orderBy, setDoc, addDoc, updateDoc, deleteDoc, getDoc,
  OperationType, handleFirestoreError, User as FirebaseUser, cleanForFirestore
} from './firebase';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from './store/useStore';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { SidebarLeft } from './components/SidebarLeft';
import { SidebarRight } from './components/SidebarRight';
import { ChatInput } from './components/ChatInput';
import { MessageItem } from './components/MessageItem';
import { Message, ChatSession, AppMode, Attachment, AttachmentType, SystemPromptVersion } from './types';
import { useVirtualizer } from '@tanstack/react-virtual';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}


export default function App() {
  const { 
    activeMode, setActiveMode, activeSessionId, setActiveSessionId, 
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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
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

  const activeSessionIdRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const modes: AppMode[] = ['chat', 'image', 'video', 'audio'];
        const next = modes[(modes.indexOf(activeMode) + 1) % modes.length];
        setActiveMode(next);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        setLeftSidebarVisible(!isLeftSidebarVisible);
        setRightSidebarVisible(!isRightSidebarVisible);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeMode, isLeftSidebarVisible, isRightSidebarVisible, setActiveMode, setLeftSidebarVisible, setRightSidebarVisible]);

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
    if (!user || !activeSessionId || activeSessionId === 'local-new') {
      setCurrentMessages([]);
      setOptimisticMessages([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'sessions', activeSessionId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setCurrentMessages(fetchedMessages);
      
      // Clean up optimistic messages that have landed in Firestore
      setOptimisticMessages(prev => prev.filter(om => 
        !fetchedMessages.some(fm => fm.role === om.role && fm.content === om.content && Math.abs(fm.createdAt - om.createdAt) < 5000)
      ));
      
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: fetchedMessages } : s));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user?.uid}/sessions/${activeSessionId}/messages`);
    });
  }, [user, activeSessionId]);


  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [customTitle, setCustomTitle] = useState<string | null>(null);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const activeSession = sessions.find(s => s.id === activeSessionId) || { id: 'local-new', title: customTitle || 'Nouvelle conversation', messages: [], updatedAt: Date.now(), mode: activeMode, userId: user?.uid || '', systemInstruction: config?.systemInstruction || '' };

  const handleNewChat = useCallback(() => {
    setPendingAttachments([]);
    setCustomTitle(null);
    setActiveSessionId('local-new');
  }, [setActiveSessionId]);

  const handleModeChange = (mode: AppMode) => {
    setActiveMode(mode);
    const existing = sessions.find(s => s.mode === mode);
    if (existing) setActiveSessionId(existing.id);
    else handleNewChat();
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

  const displayedMessages = React.useMemo(() => {
    // Merge Firestore messages and optimistic ones
    // We already filter optimisticMessages in the onSnapshot callback, 
    // but this ensures a clean combined list for the UI.
    return [...currentMessages, ...optimisticMessages];
  }, [currentMessages, optimisticMessages]);

  // Virtualizer for performance
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: displayedMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  // --- ATTACHMENTS HELPERS ---
  const uploadAttachment = async (attachment: Attachment, userId: string, sessionId: string): Promise<string> => {
    // If it's already a URL (not base64), return it
    if (attachment.url.startsWith('http') && !attachment.url.includes('base64')) return attachment.url;
    
    try {
      let blob: Blob;
      if (attachment.file) {
        blob = attachment.file;
      } else if (attachment.base64) {
        // Convert base64 to blob
        const base64Data = attachment.base64.split(',')[1] || attachment.base64;
        const mimeType = attachment.mimeType || 'image/png';
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        blob = new Blob([byteArray], { type: mimeType });
      } else {
        return attachment.url;
      }

      const fileExt = attachment.mimeType?.split('/')[1] || 'png';
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const storageRef = ref(storage, `users/${userId}/sessions/${sessionId}/${fileName}`);
      
      const snapshot = await uploadBytes(storageRef, blob);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (e) {
      console.error("Upload failed:", e);
      return attachment.url; // Fallback to original
    }
  };

  const handleSend = async (textToSend: string, overrideMessages?: Message[]) => {
    if ((!textToSend.trim() && pendingAttachments.length === 0 && !overrideMessages) || isLoading) return;
    
    setIsLoading(true);
    setStreamingThoughtsExpanded(true);
    abortControllerRef.current = new AbortController();

    try {
      let currentSessionId = activeSessionId;
      if (user && (currentSessionId === 'local-new' || !currentSessionId)) {
        const newId = Date.now().toString();
        await setDoc(doc(db, 'users', user.uid, 'sessions', newId), {
          title: customTitle || textToSend.slice(0, 30) || 'Nouvelle conversation',
          updatedAt: Date.now(),
          mode: activeMode,
          userId: user.uid,
          systemInstruction: config?.systemInstruction || ''
        });
        setCustomTitle(null);
        currentSessionId = newId;
        setActiveSessionId(newId);
      }

      if (!user || !currentSessionId) return;

      // Clean attachments for Firestore
      const cleanAttachments: Attachment[] = [];
      for (const att of pendingAttachments) {
        const { file, ...rest } = att;
        const uploadUrl = await uploadAttachment(att, user.uid, currentSessionId);
        cleanAttachments.push({ ...rest, url: uploadUrl, base64: undefined }); 
      }

      // --- BRANCHED LOGIC BASED ON MODE ---
      
      if (activeMode === 'image' && !overrideMessages) {
        // IMAGE GENERATION FLOW
        const userMessage: Omit<Message, 'id'> = { 
          role: 'user', content: textToSend, createdAt: Date.now(), attachments: cleanAttachments 
        };
        const tempId = `opt-${Date.now()}`;
        setOptimisticMessages(prev => [...prev, { ...userMessage, id: tempId } as Message]);
        await addDoc(collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages'), cleanForFirestore({ ...userMessage, sessionId: currentSessionId, userId: user.uid }));
        setPendingAttachments([]);

        const response = await fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: textToSend,
            model: config.model,
            aspectRatio: config.aspectRatio,
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
        
        const generatedImageUrl = await uploadAttachment({
          id: Date.now().toString(),
          type: 'image',
          url: data.base64,
          base64: data.base64,
          name: 'Image générée'
        }, user.uid, currentSessionId);

        await addDoc(collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages'), cleanForFirestore({
          role: 'model',
          content: "Image générée avec succès.",
          attachments: [{ id: Date.now().toString(), type: 'image', url: generatedImageUrl, name: 'Image générée' }],
          createdAt: Date.now(),
          sessionId: currentSessionId,
          userId: user.uid
        }));
        
        setIsLoading(false);
        return;
      }

      if (activeMode === 'video' && !overrideMessages) {
        // VIDEO GENERATION FLOW
        const userMessage: Omit<Message, 'id'> = { 
          role: 'user', content: textToSend, createdAt: Date.now(), attachments: cleanAttachments 
        };
        const tempId = `opt-${Date.now()}`;
        setOptimisticMessages(prev => [...prev, { ...userMessage, id: tempId } as Message]);
        await addDoc(collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages'), cleanForFirestore({ ...userMessage, sessionId: currentSessionId, userId: user.uid }));
        setPendingAttachments([]);

        const response = await fetch('/api/generate-video', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: textToSend,
            videoResolution: config.videoResolution,
            videoAspectRatio: config.videoAspectRatio,
            videoDurationSeconds: config.videoDurationSeconds
          })
        });

        if (!response.ok) throw new Error('Erreur génération vidéo');
        const data = await response.json();
        
        await addDoc(collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages'), cleanForFirestore({
          role: 'model',
          content: "Vidéo générée avec succès.",
          attachments: [{ id: Date.now().toString(), type: 'video', url: data.url, name: 'Vidéo générée' }],
          createdAt: Date.now(),
          sessionId: currentSessionId,
          userId: user.uid
        }));
        
        setIsLoading(false);
        return;
      }

      // --- CHAT FLOW (Default) ---
      let refinedInstruction = undefined;
      if (isPromptRefinerEnabled && !overrideMessages) {
        setRefiningStatus("Optimisation de votre prompt par l'IA...");
        try {
          const refineRes = await fetch('/api/refine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: textToSend })
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

      let finalMessage = textToSend;
      let finalAttachments = cleanAttachments;
      let finalRefinedInstruction = refinedInstruction;

      if (!overrideMessages) {
        const userMessage: Omit<Message, 'id'> = { 
          role: 'user', 
          content: textToSend, 
          createdAt: Date.now(), 
          attachments: cleanAttachments,
          refinedInstruction
        };
        const tempId = `opt-${Date.now()}`;
        setOptimisticMessages(prev => [...prev, { ...userMessage, id: tempId } as Message]);
        const { refinedInstruction: _, ...firestorePayload } = userMessage;
        await addDoc(collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages'), cleanForFirestore({ 
          ...firestorePayload, sessionId: currentSessionId, userId: user.uid 
        }));
        setPendingAttachments([]);
      } else {
        const lastMsg = overrideMessages[overrideMessages.length - 1];
        finalMessage = lastMsg.content;
        finalAttachments = lastMsg.attachments || [];
        finalRefinedInstruction = lastMsg.refinedInstruction;
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
            model: activeMode === 'chat' ? config.model : configs.chat.model,
            temperature: config.temperature,
            topP: config.topP,
            topK: config.topK,
            maxOutputTokens: config.maxOutputTokens || 8192,
            systemInstruction: config.systemInstruction,
            googleSearch: config.googleSearch,
            thinkingLevel: config.thinkingLevel
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
      const modelMsgRef = doc(db, 'users', user.uid, 'sessions', currentSessionId, 'messages', modelMsgId);

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
              if (data.text) { fullContent += data.text; setStreamingContent(fullContent); }
              if (data.thoughts) { thoughts += data.thoughts; setStreamingThoughts(thoughts); }
            } catch (e) {}
          }
        }
      }

      setStreamingContent('');
      setStreamingThoughts('');
      if (thoughts) setExpandedThoughts(prev => ({ ...prev, [modelMsgId]: true }));

      await setDoc(modelMsgRef, cleanForFirestore({
        role: 'model', content: fullContent, thoughts: thoughts, createdAt: Date.now(), sessionId: currentSessionId, userId: user.uid
      }));

    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Send error:', error);
        alert(`Erreur d'envoi : ${error.message || String(error)}`);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleRetry = async (idx: number) => {
    if (!user || !activeSessionId || activeSessionId === 'local-new') return;
    
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

    handleSend('', historyToProcess);
  };

  const handleEdit = async (idx: number, newText: string) => {
    if (!user || !activeSessionId || activeSessionId === 'local-new') return;
    const targetMsg = currentMessages[idx];
    
    await updateDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId, 'messages', targetMsg.id), {
      content: newText
    });

    const messagesToDelete = currentMessages.slice(idx + 1).map(m => m.id);
    await Promise.all(messagesToDelete.map(id => 
      deleteDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId, 'messages', id))
    ));

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
               <button onClick={() => setShowSearch(!showSearch)} className="p-2 hover:bg-[var(--app-text)]/5 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><Search size={20}/></button>
               <button onClick={() => handleExport('md')} className="p-2 hover:bg-[var(--app-text)]/5 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><Download size={20}/></button>
               <button onClick={() => setRightSidebarVisible(!isRightSidebarVisible)} className="p-2 hover:bg-[var(--app-text)]/5 rounded-lg text-[var(--app-text-muted)] hover:text-[var(--app-text)] transition-colors"><SlidersHorizontal size={20}/></button>
            </div>
          </header>

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
              <main ref={parentRef} className="flex-1 overflow-y-auto relative">
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                  className="max-w-4xl mx-auto px-4 md:px-10"
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
                          onToggleThoughts={() => setExpandedThoughts(p => ({...p, [msg.id]: !p[msg.id]}))}
                          setSelectedImage={setSelectedImage}
                          onEdit={handleEdit}
                          onRetry={handleRetry}
                        />
                      </div>
                    );
                  })}
                </div>
                 {/* Refining Status */}
                 {refiningStatus && (
                   <div className="max-w-4xl mx-auto px-4 md:px-10 py-4 flex items-center gap-3 text-indigo-400">
                     <div className="p-2 bg-indigo-500/10 rounded-lg animate-pulse">
                        <Sparkles size={18} className="animate-spin-slow" />
                     </div>
                     <span className="text-sm font-medium tracking-wide">{refiningStatus}</span>
                   </div>
                 )}

                 {/* Message en cours de génération — visible immédiatement avec toggle Thoughts */}
                 {isLoading && !refiningStatus && (
                  <div className="max-w-4xl mx-auto px-4 md:px-10 py-4">
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
