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
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { auth, OperationType, handleFirestoreError } from '../firebase';
import { useStore } from '../store/useStore';
import { AppMode, ChatSession } from '../types';
import { clearCoworkSessionSnapshots } from '../utils/cowork';
import { deleteSessionTree } from '../utils/sessionDeletion';
import { clearSessionSnapshots } from '../utils/sessionSnapshots';
import { markLocalSessionDeleted } from '../utils/sessionShells';

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
  onSessionDeleted?: (sessionId: string) => void;
}

export const SidebarLeft: React.FC<SidebarLeftProps> = ({
  user,
  sessions,
  isVertexConfigured,
  onNewChat,
  onModeChange,
  onSessionDeleted,
}) => {
  const {
    activeMode,
    activeSessionId,
    setActiveSessionId,
    isLeftSidebarVisible,
    setLeftSidebarVisible,
  } = useStore();

  const isMediaMode = activeMode === 'image' || activeMode === 'video' || activeMode === 'audio' || activeMode === 'lyria';

  const standardModeSessions = sessions
    .filter((session) => session.mode === activeMode && session.sessionKind !== 'agent' && session.sessionKind !== 'generated_app')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const agentSessions = activeMode === 'chat'
    ? sessions.filter((session) => session.sessionKind === 'agent').sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  const renderSessionList = (items: ChatSession[], options?: { badgeLabel?: string }) => (
    <div className="space-y-0.5">
      {items.map((session) => (
        <div key={session.id} className="group relative">
          <button
            onClick={() => setActiveSessionId(session.id, { remember: session.sessionKind !== 'agent' && session.sessionKind !== 'generated_app' })}
            className={cn(
              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-all duration-150',
              activeSessionId === session.id
                ? 'bg-[var(--app-accent-soft)] text-[var(--app-text)] font-medium'
                : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'
            )}
          >
            <div className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
              activeSessionId === session.id ? 'bg-[var(--app-accent)]' : 'bg-[var(--app-text-muted)]/20'
            )} />
            <span className="truncate flex-1">{session.title}</span>
            {options?.badgeLabel && (
              <span className="shrink-0 rounded-md bg-[var(--app-accent-soft)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[var(--app-accent)]">
                {options.badgeLabel}
              </span>
            )}
          </button>

          {items.length > 1 && (
            <button
              onClick={async (event) => {
                event.stopPropagation();
                if (!user) return;
                if (!window.confirm('Supprimer cette conversation ?')) return;
                markLocalSessionDeleted(user.uid, session.id);
                clearCoworkSessionSnapshots(user.uid, session.id);
                clearSessionSnapshots(user.uid, session.id);
                onSessionDeleted?.(session.id);
                if (activeSessionId === session.id) {
                  const nextSession = sessions.find((item) => item.id !== session.id && item.mode === activeMode && item.sessionKind !== 'agent' && item.sessionKind !== 'generated_app');
                  if (nextSession) setActiveSessionId(nextSession.id);
                  else onNewChat();
                }
                try {
                  await deleteSessionTree(user.uid, session.id);
                } catch (error) {
                  handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/sessions/${session.id}`);
                }
              }}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-md text-[var(--app-text-muted)] opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
              title="Supprimer"
            >
              <X size={12} />
            </button>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <aside
      className={cn(
        'fixed md:relative z-50 flex h-full flex-col overflow-hidden border-r border-[var(--app-border)] bg-[rgb(var(--app-bg-rgb))] transition-all duration-200 ease-out',
        isLeftSidebarVisible
          ? 'w-[280px] translate-x-0'
          : 'pointer-events-none w-0 -translate-x-full opacity-0 md:border-none'
      )}
    >
      {/* Header */}
      <div className="shrink-0 p-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--app-accent)] text-white">
              <Sparkles size={14} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--app-text)]">Studio</h1>
              <p className="text-[10px] text-[var(--app-text-muted)]">Gemini</p>
            </div>
          </div>
          <button
            onClick={() => setLeftSidebarVisible(false)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] md:hidden"
          >
            <X size={14} />
          </button>
        </div>

        <button
          onClick={onNewChat}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--app-accent)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 transition-opacity"
        >
          <Plus size={14} />
          {modeCreateLabel[activeMode]}
        </button>
      </div>

      {/* Modes */}
      <div className="shrink-0 px-3 pb-2">
        <div className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">Modes</div>
        <div className="grid grid-cols-3 gap-1">
          {(Object.entries(modeConfig) as [AppMode, (typeof modeConfig)[AppMode]][]).map(([mode, conf]) => {
            const Icon = conf.icon;
            const isActive = activeMode === mode;
            return (
              <button
                key={mode}
                onClick={() => onModeChange(mode)}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-lg py-2 text-[10px] font-medium transition-all duration-150',
                  isActive
                    ? 'bg-[var(--app-accent-soft)] text-[var(--app-accent)]'
                    : 'text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-text)]'
                )}
              >
                <Icon size={15} />
                <span>{conf.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Separator */}
      {!isMediaMode && <div className="mx-3 h-px bg-[var(--app-border)]" />}

      {/* History */}
      {isMediaMode ? (
        <div className="flex-1" />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">Historique</div>
            <span className="text-[10px] tabular-nums text-[var(--app-text-muted)]">
              {standardModeSessions.length + agentSessions.length}
            </span>
          </div>

          {standardModeSessions.length === 0 && agentSessions.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              {React.createElement(modeConfig[activeMode].icon, { size: 16, className: 'text-[var(--app-text-muted)]/40' })}
              <p className="text-xs text-[var(--app-text-muted)]">
                Aucun fil en <span className="font-medium text-[var(--app-text)]/60">{modeConfig[activeMode].label}</span>
              </p>
            </div>
          )}

          {standardModeSessions.length > 0 && renderSessionList(standardModeSessions)}

          {agentSessions.length > 0 && (
            <div className="mt-3">
              <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--app-text-muted)]">Agents</div>
              {renderSessionList(agentSessions, { badgeLabel: 'Agent' })}
            </div>
          )}
        </div>
      )}

      {/* User */}
      {user && (
        <div className="border-t border-[var(--app-border)] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img src={user.photoURL || ''} alt="" className="h-7 w-7 shrink-0 rounded-full ring-1 ring-[var(--app-border)]" />
              <div className="overflow-hidden">
                <div className="truncate text-xs font-medium text-[var(--app-text)]">{user.displayName}</div>
                <div className="truncate text-[10px] text-[var(--app-text-muted)]">{user.email}</div>
              </div>
            </div>
            <button
              onClick={() => auth.signOut()}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--app-text-muted)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
              title="Deconnexion"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="flex items-center justify-between border-t border-[var(--app-border)] px-3 py-2 text-[10px] text-[var(--app-text-muted)]">
        <div className="flex items-center gap-1.5">
          <Database size={11} />
          <span className="font-medium">Vertex AI</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span>{isVertexConfigured ? 'OK' : 'SDK'}</span>
          <div className={cn(
            'h-1.5 w-1.5 rounded-full',
            isVertexConfigured ? 'bg-emerald-400' : 'bg-amber-400'
          )} />
        </div>
      </div>
    </aside>
  );
};
