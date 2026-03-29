import React from 'react';
import {
  BrainCircuit,
  Database,
  Film,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  Mic,
  Plus,
  Sparkles,
  X,
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
  chat: { icon: MessageSquare, label: 'Chat & Raisonnement' },
  cowork: { icon: BrainCircuit, label: 'Cowork (Autonome)' },
  image: { icon: ImageIcon, label: "Génération d'Images" },
  video: { icon: Film, label: 'Génération Vidéo' },
  audio: { icon: Mic, label: 'Text-to-Speech' },
} as const;

interface SidebarLeftProps {
  user: any;
  sessions: ChatSession[];
  isVertexConfigured: boolean | null;
  onNewChat: () => void;
  onModeChange: (mode: AppMode) => void;
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  user,
  sessions,
  isVertexConfigured,
  onNewChat,
  onModeChange,
}) => {
  const {
    activeMode,
    activeSessionId,
    setActiveSessionId,
    isLeftSidebarVisible,
    setLeftSidebarVisible,
  } = useStore();

  const currentModeSessions = sessions.filter((session) => session.mode === activeMode);

  return (
    <aside
      className={cn(
        'fixed md:relative z-50 flex h-full flex-col overflow-hidden border-r border-[var(--app-border)] bg-[rgba(var(--app-bg-rgb),0.82)] backdrop-blur-3xl transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]',
        isLeftSidebarVisible
          ? 'w-[292px] translate-x-0 opacity-100'
          : 'pointer-events-none w-0 -translate-x-full opacity-0 md:border-none'
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,236,255,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.035),transparent_18%)]" />

      <div className="relative p-5 pb-0">
        <div className="mb-7 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,rgba(129,236,255,0.16),rgba(68,196,255,0.24))] shadow-[0_20px_50px_-28px_rgba(68,196,255,0.5)]">
              <Sparkles size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-[var(--app-text)]">Studio Pro</h1>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--app-text-muted)]">Gemini AI</p>
            </div>
          </div>

          <button
            onClick={() => setLeftSidebarVisible(false)}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-white/[0.03] text-[var(--app-text-muted)] md:hidden"
            title="Fermer"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <div className="relative mb-4 px-4">
        <div className="mb-2.5 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">Modes</div>
        <div className="space-y-1">
          {(Object.entries(modeConfig) as [AppMode, (typeof modeConfig)[AppMode]][]).map(([mode, conf]) => {
            const Icon = conf.icon;
            const isActive = activeMode === mode;

            return (
              <div
                key={mode}
                onClick={() => onModeChange(mode)}
                className={cn(
                  'studio-glow flex w-full cursor-pointer items-center justify-between gap-3 rounded-[1.25rem] border px-3.5 py-3 text-[13px] font-medium transition-all duration-200',
                  isActive
                    ? 'border-[var(--app-border-strong)] bg-[var(--app-accent-soft)] text-[var(--app-text)] shadow-[0_22px_40px_-30px_rgba(68,196,255,0.45)]'
                    : 'border-transparent text-[var(--app-text-muted)] hover:bg-white/[0.04] hover:text-[var(--app-text)]'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-all',
                      isActive ? 'border border-white/12 bg-white/[0.1]' : 'bg-white/[0.04] group-hover:bg-white/[0.08]'
                    )}
                  >
                    <Icon size={15} className={isActive ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'} />
                  </div>
                  {conf.label}
                </div>

                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    if (!isActive) onModeChange(mode);
                    onNewChat();
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--app-text-muted)] opacity-0 transition-all group-hover:opacity-100 hover:bg-white/[0.08] hover:text-[var(--app-text)]"
                  title="Nouveau"
                >
                  <Plus size={14} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative mt-2 flex-1 overflow-y-auto px-3 pb-3">
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">Historique</div>
          <button
            onClick={onNewChat}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-[var(--app-text-muted)] transition-colors hover:bg-white/[0.04] hover:text-[var(--app-text)]"
            title="Nouvelle conversation"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="space-y-1">
          {currentModeSessions.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 px-4 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-white/[0.04]">
                {React.createElement(modeConfig[activeMode].icon, { size: 18, className: 'text-[var(--app-text-muted)]' })}
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                Aucune conversation en <span className="font-medium text-[var(--app-text)]/78">{modeConfig[activeMode].label}</span>
              </p>
            </div>
          )}

          {currentModeSessions
            .sort((a, b) => b.updatedAt - a.updatedAt)
            .map((session) => (
              <div key={session.id} className="group relative">
                <button
                  onClick={() => setActiveSessionId(session.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-[1.2rem] border px-3 py-2.5 text-left text-[13px] transition-all duration-200',
                    activeSessionId === session.id
                      ? 'border-[var(--app-border)] bg-white/[0.06] text-[var(--app-text)]'
                      : 'border-transparent text-[var(--app-text-muted)] hover:bg-white/[0.04] hover:text-[var(--app-text)]'
                  )}
                >
                  <div
                    className={cn(
                      'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                      activeSessionId === session.id ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-text-muted)]/30'
                    )}
                  />
                  <span className="truncate pr-10">{session.title}</span>
                </button>

                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                  {currentModeSessions.length > 1 && (
                    <button
                      onClick={async (event) => {
                        event.stopPropagation();
                        if (!user) return;
                        if (!window.confirm('Supprimer cette conversation ?')) return;

                        try {
                          await deleteDoc(doc(db, 'users', user.uid, 'sessions', session.id));
                          clearCoworkSessionSnapshots(user.uid, session.id);
                          if (activeSessionId === session.id) {
                            const nextSession = sessions.find((item) => item.id !== session.id && item.mode === activeMode);
                            if (nextSession) setActiveSessionId(nextSession.id);
                            else onNewChat();
                          }
                        } catch (error) {
                          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/sessions/${session.id}`);
                        }
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-xl text-[var(--app-text-muted)] opacity-0 transition-all group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-300"
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

      {user && (
        <div className="relative border-t border-[var(--app-border)] bg-white/[0.02] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <img src={user.photoURL || ''} alt={user.displayName || ''} className="h-8 w-8 shrink-0 rounded-full ring-1 ring-[var(--app-border)]" />
              <div className="overflow-hidden">
                <div className="truncate text-[13px] font-medium text-[var(--app-text)]">{user.displayName}</div>
                <div className="truncate text-[10px] text-[var(--app-text-muted)]">{user.email}</div>
              </div>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="flex h-10 w-10 items-center justify-center rounded-2xl text-[var(--app-text-muted)] transition-all hover:bg-red-500/10 hover:text-red-300"
              title="Déconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="relative flex items-center justify-between border-t border-[var(--app-border)] p-4 text-[11px] text-[var(--app-text-muted)]">
        <div className="flex items-center gap-2">
          <Database size={13} />
          <span className="font-medium">Vertex AI</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]">{isVertexConfigured ? 'Connecté' : 'SDK'}</span>
          <div
            className={cn(
              'h-2 w-2 rounded-full transition-colors',
              isVertexConfigured
                ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]'
                : 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]'
            )}
          />
        </div>
      </div>
    </aside>
  );
};
