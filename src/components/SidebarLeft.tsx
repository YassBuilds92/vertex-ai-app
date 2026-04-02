import React from 'react';
import {
  BrainCircuit,
  Database,
  Film,
  Image as ImageIcon,
  LogOut,
  MessageSquare,
  Mic,
  Music,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { doc, deleteDoc } from 'firebase/firestore';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { db, auth, OperationType, handleFirestoreError } from '../firebase';
import { useStore } from '../store/useStore';
import { AppMode, ChatSession } from '../types';
import { clearCoworkSessionSnapshots } from '../utils/cowork';
import { clearSessionSnapshots } from '../utils/sessionSnapshots';
import { removeLocalSessionShell } from '../utils/sessionShells';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const modeConfig = {
  chat: { icon: MessageSquare, label: 'Chat' },
  cowork: { icon: BrainCircuit, label: 'Cowork' },
  image: { icon: ImageIcon, label: 'Images' },
  video: { icon: Film, label: 'Video' },
  audio: { icon: Mic, label: 'Voix' },
  lyria: { icon: Music, label: 'Lyria' },
} as const;

const modeCreateLabel: Record<AppMode, string> = {
  chat: 'Nouveau chat',
  cowork: 'Nouvelle mission',
  image: 'Nouvelle image',
  video: 'Nouvelle scene',
  audio: 'Nouvelle voix',
  lyria: 'Nouveau morceau',
};

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

  const standardModeSessions = sessions
    .filter((session) => session.mode === activeMode && session.sessionKind !== 'agent' && session.sessionKind !== 'generated_app')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const agentSessions = activeMode === 'chat'
    ? sessions
        .filter((session) => session.sessionKind === 'agent')
        .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  const appSessions = activeMode === 'chat'
    ? sessions
        .filter((session) => session.sessionKind === 'generated_app')
        .sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  const renderSessionList = (items: ChatSession[], options?: { badgeLabel?: string }) => (
    <div className="space-y-1.5">
      {items.map((session) => (
        <div key={session.id} className="group relative">
          <button
            onClick={() => setActiveSessionId(session.id, { remember: session.sessionKind !== 'agent' && session.sessionKind !== 'generated_app' })}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-[1.25rem] border px-3 py-2.5 text-left text-[13px] transition-all duration-200',
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
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate">{session.title}</span>
                {options?.badgeLabel && (
                  <span className="shrink-0 rounded-full border border-[var(--app-border)] bg-white/[0.04] px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[var(--app-accent)]">
                    {options.badgeLabel}
                  </span>
                )}
              </div>
            </div>
          </button>

          <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
            {items.length > 1 && (
              <button
                onClick={async (event) => {
                  event.stopPropagation();
                  if (!user) return;
                  if (!window.confirm('Supprimer cette conversation ?')) return;

                  try {
                    await deleteDoc(doc(db, 'users', user.uid, 'sessions', session.id));
                    clearCoworkSessionSnapshots(user.uid, session.id);
                    clearSessionSnapshots(user.uid, session.id);
                    removeLocalSessionShell(user.uid, session.id);

                    if (activeSessionId === session.id) {
                      const nextSession = sessions.find((item) => item.id !== session.id && item.mode === activeMode && item.sessionKind !== 'agent' && item.sessionKind !== 'generated_app');
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
  );

  return (
    <aside
      className={cn(
        'fixed md:relative z-50 flex h-full flex-col overflow-hidden border-r border-[var(--app-border)] bg-[rgba(var(--app-bg-rgb),0.86)] backdrop-blur-xl transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]',
        isLeftSidebarVisible
          ? 'w-[320px] translate-x-0 opacity-100'
          : 'pointer-events-none w-0 -translate-x-full opacity-0 md:border-none'
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(129,236,255,0.08),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_18%)]" />

      <div className="relative shrink-0 px-4 pt-3.5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[1.15rem] border border-[var(--app-border-strong)] bg-[linear-gradient(135deg,rgba(129,236,255,0.16),rgba(68,196,255,0.24))] shadow-[0_20px_50px_-28px_rgba(68,196,255,0.5)]">
              <Sparkles size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold tracking-tight text-[var(--app-text)]">Studio Pro</h1>
              <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[var(--app-text-muted)]">Google stack</p>
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

        <button
          onClick={onNewChat}
          className="studio-button-primary studio-glow mb-4 flex w-full items-center justify-center gap-2.5 rounded-[1.35rem] px-4 py-3 text-[13px] font-semibold"
        >
          <Plus size={15} />
          {modeCreateLabel[activeMode]}
        </button>
      </div>

      <div className="relative shrink-0 px-4 pb-1">
        <div className="mb-1.5 px-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">Modes</div>
        <div className="space-y-1">
          {(Object.entries(modeConfig) as [AppMode, (typeof modeConfig)[AppMode]][]).map(([mode, conf]) => {
            const Icon = conf.icon;
            const isActive = activeMode === mode;

            return (
              <div
                key={mode}
                onClick={() => onModeChange(mode)}
                className={cn(
                  'studio-glow flex w-full cursor-pointer items-center gap-2.5 rounded-[1.25rem] border px-3 py-2.5 text-[12.5px] font-medium transition-all duration-200',
                  isActive
                    ? 'border-[var(--app-border-strong)] bg-[var(--app-accent-soft)] text-[var(--app-text)] shadow-[0_22px_40px_-30px_rgba(68,196,255,0.45)]'
                    : 'border-transparent text-[var(--app-text-muted)] hover:bg-white/[0.04] hover:text-[var(--app-text)]'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-[1.95rem] w-[1.95rem] items-center justify-center rounded-[0.95rem] transition-all',
                      isActive ? 'border border-white/12 bg-white/[0.1]' : 'bg-white/[0.04]'
                    )}
                  >
                    <Icon size={14} className={isActive ? 'text-[var(--app-accent)]' : 'text-[var(--app-text-muted)]'} />
                  </div>
                  <span className="leading-snug">{conf.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative mt-3 flex-1 min-h-0 overflow-y-auto px-3 pb-2">
        <div className="mb-2 flex items-center justify-between px-2">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--app-text-muted)]">Historique</div>
          <div className="rounded-full border border-[var(--app-border)] bg-white/[0.03] px-2.5 py-1 text-[10px] font-medium text-[var(--app-text-muted)]">
            {standardModeSessions.length + agentSessions.length + appSessions.length}
          </div>
        </div>

        <div className="space-y-1">
          {standardModeSessions.length === 0 && agentSessions.length === 0 && appSessions.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 px-4 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--app-border)] bg-white/[0.04]">
                {React.createElement(modeConfig[activeMode].icon, { size: 18, className: 'text-[var(--app-text-muted)]' })}
              </div>
              <p className="text-[11px] leading-relaxed text-[var(--app-text-muted)]">
                Aucun fil en <span className="font-medium text-[var(--app-text)]/78">{modeConfig[activeMode].label}</span>
              </p>
            </div>
          )}

          {standardModeSessions.length > 0 && renderSessionList(standardModeSessions)}

          {agentSessions.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
                Agents
              </div>
              {renderSessionList(agentSessions, { badgeLabel: 'Agent' })}
            </div>
          )}

          {appSessions.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="px-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--app-text-muted)]">
                Apps
              </div>
              {renderSessionList(appSessions, { badgeLabel: 'App' })}
            </div>
          )}
        </div>
      </div>

      {user && (
        <div className="relative border-t border-[var(--app-border)] bg-white/[0.02] px-4 py-3">
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
              title="Deconnexion"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="relative flex items-center justify-between border-t border-[var(--app-border)] px-4 py-3 text-[11px] text-[var(--app-text-muted)]">
        <div className="flex items-center gap-2">
          <Database size={13} />
          <span className="font-medium">Vertex AI</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px]">{isVertexConfigured ? 'Connecte' : 'SDK'}</span>
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
