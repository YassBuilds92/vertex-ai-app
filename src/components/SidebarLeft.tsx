import React from 'react';
import { 
  Sparkles, X, Plus, LogOut, Database,
  MessageSquare, Image as ImageIcon, Film, Mic, BrainCircuit
} from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { useStore } from '../store/useStore';
import { AppMode, ChatSession } from '../types';
import { clearCoworkSessionSnapshots } from '../utils/cowork';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const modeConfig = {
  chat: { icon: MessageSquare, label: 'Chat & Raisonnement', color: 'indigo', gradient: 'from-indigo-500 to-blue-600' },
  cowork: { icon: BrainCircuit, label: 'Cowork (Autonome)', color: 'purple', gradient: 'from-purple-500 to-indigo-600' },
  image: { icon: ImageIcon, label: "Génération d'Images", color: 'pink', gradient: 'from-pink-500 to-rose-600' },
  video: { icon: Film, label: 'Génération Vidéo', color: 'emerald', gradient: 'from-emerald-500 to-teal-600' },
  audio: { icon: Mic, label: 'Text-to-Speech', color: 'amber', gradient: 'from-amber-500 to-orange-600' },
} as const;

const modeIcons = {
  chat: MessageSquare,
  cowork: BrainCircuit,
  image: ImageIcon,
  video: Film,
  audio: Mic,
};

interface SidebarLeftProps {
  user: any;
  sessions: ChatSession[];
  isVertexConfigured: boolean | null;
  onNewChat: () => void;
  onModeChange: (mode: AppMode) => void;
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({ 
  user, sessions, isVertexConfigured, onNewChat, onModeChange 
}) => {
  const { 
    activeMode, activeSessionId, setActiveSessionId, 
    isLeftSidebarVisible, setLeftSidebarVisible 
  } = useStore();

  const currentModeSessions = sessions.filter(s => s.mode === activeMode);

  return (
    <div className={cn(
      "fixed md:relative h-full border-r border-[var(--app-border)] bg-[var(--app-bg)]/40 backdrop-blur-3xl flex flex-col z-50 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] overflow-hidden",
      isLeftSidebarVisible 
        ? "w-[280px] translate-x-0 opacity-100" 
        : "w-0 -translate-x-full opacity-0 pointer-events-none md:border-none"
    )}>
      {/* Brand */}
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25 ring-1 ring-white/10">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="font-bold text-[15px] tracking-tight text-[var(--app-text)]">Studio Pro</h1>
              <p className="text-[10px] text-[var(--app-text-muted)] font-medium tracking-wide uppercase">Gemini AI</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Selector */}
      <div className="px-4 mb-4">
        <div className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-[0.15em] mb-2.5 px-2">Modes</div>
        <div className="space-y-0.5">
          {(Object.entries(modeConfig) as [AppMode, typeof modeConfig.chat][]).map(([id, conf]) => {
            const Icon = modeIcons[id as keyof typeof modeIcons];
            const isActive = activeMode === id;
            return (
              <div
                key={id}
                onClick={() => onModeChange(id as AppMode)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-200 group cursor-pointer",
                  isActive 
                    ? "bg-[var(--app-text)]/[0.08] text-[var(--app-text)] border border-[var(--app-border)] shadow-sm" 
                    : "text-[var(--app-text-muted)] hover:bg-[var(--app-text)]/[0.04] hover:text-[var(--app-text)] border border-transparent"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-200",
                    isActive 
                      ? `bg-gradient-to-br ${conf.gradient} shadow-md shadow-indigo-500/20` 
                      : "bg-[var(--app-text)]/[0.04] group-hover:bg-[var(--app-text)]/[0.08]"
                  )}>
                    <Icon size={14} className={isActive ? "text-white" : "text-[var(--app-text-muted)] group-hover:text-[var(--app-text)]"} />
                  </div>
                  {conf.label}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isActive) onModeChange(id as AppMode);
                    onNewChat();
                  }}
                  className="p-1.5 text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded-lg hover:bg-[var(--app-text)]/10 transition-colors opacity-0 group-hover:opacity-100"
                  title="Nouveau"
                >
                  <Plus size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Session History */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 mt-2">
        <div className="flex items-center justify-between mb-2 px-2">
          <div className="text-[10px] font-bold text-[var(--app-text-muted)] uppercase tracking-[0.15em]">Historique</div>
          <button 
            onClick={onNewChat}
            className="p-1 text-[var(--app-text-muted)] hover:text-[var(--app-text)] rounded-md hover:bg-[var(--app-text)]/5 transition-colors"
            title="Nouvelle conversation"
          >
            <Plus size={14} />
          </button>
        </div>
        <div className="space-y-0.5">
          {currentModeSessions.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 py-8 px-4 text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--app-text)]/[0.04] border border-[var(--app-border)] flex items-center justify-center">
                {React.createElement(modeIcons[activeMode as keyof typeof modeIcons], { size: 18, className: 'text-zinc-600' })}
              </div>
              <p className="text-[11px] text-zinc-600 leading-relaxed">
                Aucune conversation en <span className="text-zinc-500 font-medium">{modeConfig[activeMode].label}</span>
              </p>
            </div>
          )}
          {currentModeSessions
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map(session => (
            <div key={session.id} className="relative group">
              <button
                onClick={() => setActiveSessionId(session.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] text-left transition-all duration-200",
                  activeSessionId === session.id 
                    ? "bg-[var(--app-text)]/[0.07] text-[var(--app-text)] border border-[var(--app-border)]" 
                    : "text-[var(--app-text-muted)] hover:bg-[var(--app-text)]/[0.04] hover:text-[var(--app-text)] border border-transparent"
                )}
              >
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0 transition-colors",
                  activeSessionId === session.id ? "bg-indigo-400" : "bg-[var(--app-text-muted)]/30 group-hover:bg-[var(--app-text-muted)]/50"
                )} />
                <span className="truncate pr-10">{session.title}</span>
              </button>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                {currentModeSessions.length > 1 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!user) return;
                      if (!window.confirm('Supprimer cette conversation ?')) return;
                      try {
                        await deleteDoc(doc(db, 'users', user.uid, 'sessions', session.id));
                        clearCoworkSessionSnapshots(user.uid, session.id);
                        if (activeSessionId === session.id) {
                          const nextSession = sessions.find(s => s.id !== session.id && s.mode === activeMode);
                          if (nextSession) setActiveSessionId(nextSession.id);
                          else onNewChat();
                        }
                      } catch (error) {
                        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/sessions/${session.id}`);
                      }
                    }}
                    className="w-7 h-7 flex items-center justify-center text-[var(--app-text-muted)] hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-[var(--app-text)]/5"
                    title="Supprimer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* User Profile / Logout */}
      {user && (
        <div className="p-4 border-t border-[var(--app-border)] bg-[var(--app-text)]/[0.02]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-8 h-8 rounded-full ring-1 ring-[var(--app-border)] shrink-0" />
              <div className="overflow-hidden">
                <div className="text-[13px] font-medium text-[var(--app-text)] truncate">{user.displayName}</div>
                <div className="text-[10px] text-[var(--app-text-muted)] truncate">{user.email}</div>
              </div>
            </div>
            <button 
              onClick={() => auth.signOut()}
              className="p-2 text-[var(--app-text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
              title="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Sidebar Footer */}
      <div className="p-4 border-t border-[var(--app-border)] text-[11px] text-[var(--app-text-muted)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database size={13} />
          <span className="font-medium">Vertex AI</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]">{isVertexConfigured ? 'Connecté' : 'SDK'}</span>
          <div className={cn(
            "w-2 h-2 rounded-full transition-colors",
            isVertexConfigured 
              ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" 
              : "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]"
          )} />
        </div>
      </div>
    </div>
  );
};
