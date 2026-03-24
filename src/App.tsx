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
  OperationType, handleFirestoreError, User as FirebaseUser
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
    isRightSidebarVisible, setRightSidebarVisible, theme
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
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'sessions', activeSessionId, 'messages'), orderBy('createdAt', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const fetchedMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setCurrentMessages(fetchedMessages);
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: fetchedMessages } : s));
    });
  }, [user, activeSessionId]);

  const activeSession = sessions.find(s => s.id === activeSessionId) || { id: 'local-new', title: 'Nouvelle conversation', messages: [], updatedAt: Date.now(), mode: activeMode, userId: user?.uid || '', systemInstruction: config?.systemInstruction || '' };

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const handleNewChat = useCallback(() => {
    setPendingAttachments([]);
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
      newAttachments.push({
        id: Math.random().toString(36).substring(7),
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'document',
        url,
        file,
        name: file.name
      });
    }
    setPendingAttachments(prev => [...prev, ...newAttachments]);
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

  // Virtualizer for performance
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: currentMessages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const handleSend = async (textToSend: string, overrideMessages?: Message[]) => {
    if ((!textToSend.trim() && pendingAttachments.length === 0 && !overrideMessages) || isLoading) return;
    
    setIsLoading(true);
    setStreamingThoughtsExpanded(true);

    try {
      let currentSessionId = activeSessionId;
      if (user && (currentSessionId === 'local-new' || !currentSessionId)) {
        const newId = Date.now().toString();
        await setDoc(doc(db, 'users', user.uid, 'sessions', newId), {
          title: textToSend.slice(0, 30) || 'Nouvelle conversation',
          updatedAt: Date.now(),
          mode: activeMode,
          userId: user.uid,
          systemInstruction: config?.systemInstruction || ''
        });
        currentSessionId = newId;
        setActiveSessionId(newId);
      }

      if (!user || !currentSessionId) return;

      // Clean attachments for Firestore (remove File objects)
      const cleanAttachments = pendingAttachments.map(({ file, ...rest }) => {
        const cleaned = { ...rest };
        Object.keys(cleaned).forEach(key => {
          if (cleaned[key as keyof typeof cleaned] === undefined) {
            delete cleaned[key as keyof typeof cleaned];
          }
        });
        return cleaned;
      });

      const userMessage: Message = { 
        id: Date.now().toString(), 
        role: 'user', 
        content: textToSend, 
        createdAt: Date.now(), 
        attachments: cleanAttachments 
      };

      if (!overrideMessages) {
        await addDoc(collection(db, 'users', user.uid, 'sessions', currentSessionId, 'messages'), { 
          ...userMessage, 
          sessionId: currentSessionId, 
          userId: user.uid 
        });
      }

      setPendingAttachments([]);
      const messagesToProcess = overrideMessages || [...currentMessages, userMessage];
      // Toujours utiliser un modèle de chat, même si on est en mode image/video/audio
      const chatModel = activeMode === 'chat' ? config.model : configs.chat.model;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: chatModel,
          messages: messagesToProcess.map(m => ({ role: m.role, content: m.content })),
          config: {
            temperature: config.temperature,
            topP: config.topP,
            topK: config.topK,
            systemInstruction: config.systemInstruction,
            googleSearch: config.googleSearch,
            thinkingConfig: { thinkingLevel: config.thinkingLevel }
          }
        })
      });

      if (!response.ok) throw new Error('Failed to fetch AI response');

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
              if (data.text) {
                fullContent += data.text;
                setStreamingContent(fullContent);
              }
              if (data.thoughts) {
                thoughts += data.thoughts;
                setStreamingThoughts(thoughts);
              }
            } catch (e) {}
          }
        }
      }

      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.text) fullContent += data.text;
          if (data.thoughts) thoughts += data.thoughts;
        } catch (e) {}
      }

      setStreamingContent('');
      setStreamingThoughts('');
      setStreamingThoughtsExpanded(true);
      if (thoughts) {
        setExpandedThoughts(prev => ({ ...prev, [modelMsgId]: true }));
      }

      await setDoc(modelMsgRef, {
        id: modelMsgId,
        role: 'model',
        content: fullContent,
        thoughts: thoughts,
        createdAt: Date.now(),
        sessionId: currentSessionId,
        userId: user.uid
      });

    } catch (error) {
      console.error('Send error:', error);
    } finally {
      setIsLoading(false);
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
    if (!user || activeSessionId === 'local-new' || !titleInput.trim()) return;
    try {
      await updateDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId), { title: titleInput });
      setIsEditingTitle(false);
    } catch (e) { console.error(e); }
  };

  const handleAiTitleUpdate = async () => {
    if (!user || activeSessionId === 'local-new' || currentMessages.length === 0) return;
    setIsGeneratingTitle(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemini-3.1-flash-lite-preview',
          messages: [
            ...currentMessages.slice(0, 10).map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: "Génère un titre très court et percutant (max 5 mots) pour cette discussion. Réponds UNIQUEMENT avec le titre, rien d'autre." }
          ],
          config: { 
            temperature: 0.1, 
            systemInstruction: "Tu es un assistant spécialisé dans le titrage minimaliste. Ton thinking doit être minimal.",
            thinkingConfig: { thinkingLevel: 'low' }
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
        await updateDoc(doc(db, 'users', user.uid, 'sessions', activeSessionId), { title: aiTitle });
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setLeftSidebarVisible(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
        {isRightSidebarVisible && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setRightSidebarVisible(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {!isAuthReady ? (
        <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" /></div>
      ) : !user ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <button onClick={() => signInWithPopup(auth, googleProvider)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-500/20">Se connecter avec Google</button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col relative w-full overflow-hidden">
          <header className="h-16 border-b border-[var(--app-border)] flex items-center justify-between px-6 bg-[var(--app-bg)]/80 backdrop-blur-md z-40 relative">
            <div className="flex items-center gap-4 flex-1 overflow-hidden">
               <button onClick={() => setLeftSidebarVisible(!isLeftSidebarVisible)} className="p-2 hover:bg-[var(--app-text)]/5 rounded-lg transition-colors shrink-0"><Menu size={20}/></button>
               
               <div className="flex items-center gap-2 overflow-hidden flex-1 group/title">
                 {isEditingTitle ? (
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
                const msg = currentMessages[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
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
                      isLast={virtualItem.index === currentMessages.length - 1}
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
            {/* Message en cours de génération — visible immédiatement avec toggle Thoughts */}
            {isLoading && (
              <div className="max-w-4xl mx-auto px-4 md:px-10 py-4">
                <MessageItem
                  msg={{ id: 'streaming', role: 'model', content: streamingContent, thoughts: streamingThoughts, createdAt: Date.now() }}
                  idx={currentMessages.length}
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
