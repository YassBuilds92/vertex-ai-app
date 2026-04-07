import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

import '../src/index.css';
import { ChatInput } from '../src/components/ChatInput';
import { SidebarRight } from '../src/components/SidebarRight';
import { StudioEmptyState } from '../src/components/StudioEmptyState';
import { useStore } from '../src/store/useStore';
import type { AppMode, Attachment, ChatSession } from '../src/types';

const params = new URLSearchParams(window.location.search);
const mode = (params.get('mode') as AppMode | null) || 'image';
const surface = params.get('surface') || 'empty';
const linkedPromptEnabled = params.get('linked') === '1';

const previewSelectedPrompt = linkedPromptEnabled
  ? {
      id: 'preview-linked-prompt',
      title: 'Directeur editoral',
      prompt: 'Tu gardes une voix nette, concise et exigeante. Tu proposes des versions plus claires sans perdre le style.',
      iconUrl: undefined,
    }
  : null;

const previewSession: ChatSession = {
  id: 'preview-session',
  title: 'Mode preview',
  messages: [],
  updatedAt: Date.now(),
  mode,
  userId: 'preview',
  systemInstruction: '',
  sessionKind: 'standard',
};

function PreviewApp() {
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);

  useEffect(() => {
    useStore.setState((state) => ({
      ...state,
      activeMode: mode,
      activeSessionId: 'preview-session',
      isLeftSidebarVisible: true,
      isRightSidebarVisible: true,
      isPromptRefinerEnabled: false,
    }));
    document.documentElement.className = 'dark';
  }, []);

  if (surface === 'panel') {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
        <div className="mx-auto grid min-h-screen w-full max-w-[1440px] gap-0 lg:grid-cols-[minmax(0,1fr)_392px]">
          <main className="border-r border-[var(--app-border)] p-4 sm:p-6">
            <div className="studio-panel-strong rounded-[2rem] p-4 sm:p-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-[var(--app-text-muted)]">Preview shell</div>
              <div className="mt-3 text-[1.25rem] font-semibold tracking-[-0.03em] text-[var(--app-text)]">
                {mode === 'cowork' ? 'Cowork options' : `Mode ${mode}`}
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--app-text)]/64">
                Harness local pour valider la composition du panneau droit et du composer sans depender du backend.
              </p>
              <div className="mt-6">
                <ChatInput
                  onSend={() => {}}
                  onStop={() => {}}
                  isLoading={false}
                  isRecording={false}
                  recordingTime={0}
                  onToggleRecording={() => {}}
                  processFiles={async () => {}}
                  pendingAttachments={pendingAttachments}
                  setPendingAttachments={setPendingAttachments}
                  setSelectedImage={() => {}}
                />
              </div>
            </div>
          </main>
          <SidebarRight
            activeSession={previewSession}
            selectedCustomPrompt={previewSelectedPrompt}
            onSelectedCustomPromptChange={() => {}}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
      <StudioEmptyState
        mode={mode}
        isAuthenticated
        onPrimaryAction={() => {}}
        onQuickPrompt={() => {}}
        onOpenAgentsHub={mode === 'cowork' ? () => {} : undefined}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>
);
