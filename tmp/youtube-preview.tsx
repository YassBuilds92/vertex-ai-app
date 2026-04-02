import React from 'react';
import ReactDOM from 'react-dom/client';

import '../src/index.css';
import { AttachmentGallery } from '../src/components/AttachmentGallery';
import { ChatInput } from '../src/components/ChatInput';
import type { Attachment } from '../src/types';
import { useStore } from '../src/store/useStore';

const previewYoutubeAttachment: Attachment = {
  id: 'youtube-preview-1',
  type: 'youtube',
  url: 'https://www.youtube.com/watch?v=9hE5-98ZeCg',
  mimeType: 'video/mp4',
  name: 'Google Turns 25: A Quarter Century of Search',
  thumbnail: 'https://i.ytimg.com/vi/9hE5-98ZeCg/hqdefault.jpg',
  videoMetadata: {
    startOffsetSeconds: 40,
    endOffsetSeconds: 80,
    fps: 5,
  },
};

function PreviewApp() {
  const [pendingAttachments, setPendingAttachments] = React.useState<Attachment[]>([
    previewYoutubeAttachment,
  ]);

  React.useEffect(() => {
    useStore.setState((state) => ({
      ...state,
      activeMode: 'chat',
    }));
  }, []);

  React.useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    if (search.get('modal') !== '1') return;

    const timer = window.setTimeout(() => {
      const button = document.querySelector<HTMLButtonElement>('button[title="Regler la plage video"]');
      button?.click();
    }, 200);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] px-6 py-10 text-[var(--app-text)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <section className="studio-panel-strong rounded-[2rem] border border-[var(--app-border)] p-6">
          <div className="mb-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--app-text-muted)]">
              Harness YouTube
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-[var(--app-text)]">
              Pending attachment + persisted card
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--app-text-muted)]">
              Clique sur l’icone de reglages de la carte YouTube dans le composeur pour ouvrir le modal.
            </p>
          </div>

          <div className="mb-6">
            <AttachmentGallery
              attachments={[previewYoutubeAttachment]}
              setSelectedImage={() => {}}
            />
          </div>

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
        </section>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>
);
