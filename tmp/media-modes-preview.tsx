import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';

import '../src/index.css';
import { ChatInput } from '../src/components/ChatInput';
import { ImageStudio } from '../src/components/ImageStudio';
import { AudioStudio } from '../src/components/AudioStudio';
import { VideoStudio } from '../src/components/VideoStudio';
import { LyriaStudio } from '../src/components/LyriaStudio';
import { SidebarRight } from '../src/components/SidebarRight';
import { StudioEmptyState } from '../src/components/StudioEmptyState';
import { useStore } from '../src/store/useStore';
import type { AppMode, Attachment, ChatSession, Message } from '../src/types';

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

const sampleImageUrl = 'https://picsum.photos/seed/studio-image-preview/1400/1050';
const sampleImageUrlAlt = 'https://picsum.photos/seed/studio-image-preview-alt/900/1200';
const sampleAudioUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';

class PreviewErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  override componentDidCatch(error: Error) {
    console.error('Preview harness error:', error);
  }

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#120811] px-6 py-10 text-[#ffe7ef]">
        <div className="mx-auto max-w-3xl rounded-[2rem] border border-rose-400/30 bg-rose-950/40 p-6 shadow-[0_32px_80px_-48px_rgba(0,0,0,0.9)]">
          <div className="text-[11px] font-black uppercase tracking-[0.24em] text-rose-200/70">
            Preview runtime error
          </div>
          <h1 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">
            Le harness a casse
          </h1>
          <p className="mt-4 text-sm leading-7 text-rose-100/80">{this.state.error}</p>
        </div>
      </div>
    );
  }
}

function buildMockMessages(targetMode: AppMode): Message[] {
  if (targetMode === 'image') {
    return [
      {
        id: 'image-user-1',
        role: 'user',
        content: 'Un heros shonen en contre-plongee, aura bleue, pluie fine, vitesse et tension.',
        refinedInstruction: 'Hero shonen en contre-plongee, cape dechiree, aura bleue electrique, pluie fine, speed lines, encrage net, contrastes dramatiques, cadre vertical heroique, eclairage froid et metal, atmosphere de climax.',
        createdAt: Date.now() - 120_000,
      },
      {
        id: 'image-model-1',
        role: 'model',
        content: '2 images generees.',
        attachments: [
          {
            id: 'image-a',
            type: 'image',
            url: sampleImageUrl,
            name: 'Hero frame A',
            generationMeta: {
              mode: 'image',
              prompt: 'Un heros shonen en contre-plongee, aura bleue, pluie fine, vitesse et tension.',
              refinedPrompt: 'Hero shonen en contre-plongee, cape dechiree, aura bleue electrique, pluie fine, speed lines, encrage net, contrastes dramatiques, cadre vertical heroique, eclairage froid et metal, atmosphere de climax.',
              model: 'gemini-3.1-flash-image-preview',
              refinerProfileId: 'image-manga-shonen',
              refinerCustomInstructions: 'Renforcer l energie shonen et la lisibilite des poses.',
            },
          },
          {
            id: 'image-b',
            type: 'image',
            url: sampleImageUrlAlt,
            name: 'Hero frame B',
            generationMeta: {
              mode: 'image',
              prompt: 'Un heros shonen en contre-plongee, aura bleue, pluie fine, vitesse et tension.',
              refinedPrompt: 'Hero shonen en contre-plongee, cape dechiree, aura bleue electrique, pluie fine, speed lines, encrage net, contrastes dramatiques, cadre vertical heroique, eclairage froid et metal, atmosphere de climax.',
              model: 'gemini-3.1-flash-image-preview',
              refinerProfileId: 'image-manga-shonen',
              refinerCustomInstructions: 'Renforcer l energie shonen et la lisibilite des poses.',
            },
          },
        ],
        createdAt: Date.now() - 100_000,
      },
      {
        id: 'image-user-2',
        role: 'user',
        content: 'Un packshot premium de parfum noir avec reflets rouges et texture verre.',
        refinedInstruction: 'Packshot premium de parfum noir facette, reflets rouges bordeaux, fond graphite, verre poli, lumiere latérale precise, ombre douce, composition editoriale luxe, macro details, atmosphere nocturne.',
        createdAt: Date.now() - 60_000,
      },
      {
        id: 'image-model-2',
        role: 'model',
        content: 'Image generee avec succes.',
        attachments: [
          {
            id: 'image-c',
            type: 'image',
            url: sampleImageUrl,
            name: 'Packshot noir',
            generationMeta: {
              mode: 'image',
              prompt: 'Un packshot premium de parfum noir avec reflets rouges et texture verre.',
              refinedPrompt: 'Packshot premium de parfum noir facette, reflets rouges bordeaux, fond graphite, verre poli, lumiere laterale precise, ombre douce, composition editoriale luxe, macro details, atmosphere nocturne.',
              model: 'gemini-3-pro-image-preview',
              refinerProfileId: 'image-product-editorial',
              refinerCustomInstructions: 'Accentuer le rendu luxe et la precision matiere.',
            },
          },
        ],
        createdAt: Date.now() - 45_000,
      },
    ];
  }

  if (targetMode === 'audio') {
    return [
      {
        id: 'audio-user-1',
        role: 'user',
        content: 'Bonsoir, bienvenue dans notre capsule audio. On va parler vite, clair et avec le sourire.',
        refinedInstruction: 'Bonsoir et bienvenue dans cette capsule audio. On va aller droit au but, avec une voix souriante, nette et tres fluide.',
        createdAt: Date.now() - 80_000,
      },
      {
        id: 'audio-model-1',
        role: 'model',
        content: 'Audio genere avec succes.',
        attachments: [
          {
            id: 'audio-a',
            type: 'audio',
            url: sampleAudioUrl,
            name: 'Capsule accueil',
            mimeType: 'audio/mpeg',
            generationMeta: {
              mode: 'audio',
              prompt: 'Bonsoir, bienvenue dans notre capsule audio. On va parler vite, clair et avec le sourire.',
              refinedPrompt: 'Bonsoir et bienvenue dans cette capsule audio. On va aller droit au but, avec une voix souriante, nette et tres fluide.',
              model: 'gemini-2.5-flash-tts',
              refinerProfileId: 'audio-brand-voice',
              refinerCustomInstructions: 'Garder une diction nette et souriante.',
            },
          },
        ],
        createdAt: Date.now() - 70_000,
      },
      {
        id: 'audio-user-2',
        role: 'user',
        content: 'Annonce ce produit comme un spot premium, plus pose et plus rassurant.',
        refinedInstruction: 'Decouvrez une experience premium, calme et rassurante, pensee pour offrir une sensation de confiance immediate.',
        createdAt: Date.now() - 30_000,
      },
      {
        id: 'audio-model-2',
        role: 'model',
        content: 'Audio genere avec succes.',
        attachments: [
          {
            id: 'audio-b',
            type: 'audio',
            url: sampleAudioUrl,
            name: 'Spot premium',
            mimeType: 'audio/mpeg',
            generationMeta: {
              mode: 'audio',
              prompt: 'Annonce ce produit comme un spot premium, plus pose et plus rassurant.',
              refinedPrompt: 'Decouvrez une experience premium, calme et rassurante, pensee pour offrir une sensation de confiance immediate.',
              model: 'gemini-2.5-pro-tts',
              refinerProfileId: 'audio-brand-voice',
              refinerCustomInstructions: 'Accentuer la confiance et le calme.',
            },
          },
        ],
        createdAt: Date.now() - 15_000,
      },
    ];
  }

  if (targetMode === 'video') {
    return [
      {
        id: 'video-user-1',
        role: 'user',
        content: 'Plan d ouverture d une ville sous la pluie, travelling lent, neon et foule.',
        createdAt: Date.now() - 90_000,
      },
      {
        id: 'video-model-1',
        role: 'model',
        content: 'Video generee avec succes.',
        attachments: [
          {
            id: 'video-a',
            type: 'video',
            url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
            name: 'Plan neon',
            mimeType: 'video/mp4',
            generationMeta: {
              mode: 'video',
              prompt: 'Plan d ouverture d une ville sous la pluie, travelling lent, neon et foule.',
              refinedPrompt: 'Ouverture cinematographique d une ville sous la pluie, travelling lent, reflets neon, foule diffuse, atmosphere nocturne, sensation de tension elegante.',
              model: 'veo',
              refinerProfileId: 'video-cinematic',
              refinerCustomInstructions: 'Favoriser un rendu plus cinematographique.',
            },
          },
        ],
        createdAt: Date.now() - 75_000,
      },
    ];
  }

  if (targetMode === 'lyria') {
    return [
      {
        id: 'lyria-user-1',
        role: 'user',
        content: 'Beat trap melancolique, basse ronde, texture nocturne, hook simple.',
        refinedInstruction: 'Beat trap melancolique nocturne, basse ronde, pads brumeux, drums nets, hook simple et memorisable, energie contenue.',
        createdAt: Date.now() - 60_000,
      },
      {
        id: 'lyria-model-1',
        role: 'model',
        content: 'Piste Lyria generee avec succes.',
        attachments: [
          {
            id: 'lyria-a',
            type: 'audio',
            url: sampleAudioUrl,
            name: 'Beat preview',
            mimeType: 'audio/mpeg',
            generationMeta: {
              mode: 'lyria',
              prompt: 'Beat trap melancolique, basse ronde, texture nocturne, hook simple.',
              refinedPrompt: 'Beat trap melancolique nocturne, basse ronde, pads brumeux, drums nets, hook simple et memorisable, energie contenue.',
              model: 'lyria-002',
              refinerProfileId: 'lyria-dark-trap',
              refinerCustomInstructions: 'Garder une texture sombre mais propre.',
            },
          },
        ],
        createdAt: Date.now() - 40_000,
      },
    ];
  }

  return [];
}

function PreviewApp() {
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const mockMessages = buildMockMessages(mode);

  useEffect(() => {
    useStore.setState((state) => ({
      ...state,
      activeMode: mode,
      activeSessionId: 'preview-session',
      isLeftSidebarVisible: true,
      isRightSidebarVisible: true,
      configs: {
        ...state.configs,
        [mode]: {
          ...state.configs[mode],
          refinerEnabled: true,
        },
      },
    }));
    document.documentElement.className = 'dark';
  }, []);

  if (surface === 'studio') {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
        {mode === 'image' && (
          <ImageStudio
            onGenerate={() => {}}
            isLoading={false}
            messages={mockMessages}
            onImageClick={() => {}}
            isRefinerEnabled
            onToggleRefiner={() => {}}
          />
        )}
        {mode === 'audio' && (
          <AudioStudio
            onGenerate={() => {}}
            isLoading={false}
            messages={mockMessages}
            isRefinerEnabled
            onToggleRefiner={() => {}}
          />
        )}
        {mode === 'video' && (
          <VideoStudio
            onGenerate={() => {}}
            isLoading={false}
            messages={mockMessages}
            isRefinerEnabled
            onToggleRefiner={() => {}}
          />
        )}
        {mode === 'lyria' && (
          <LyriaStudio
            onGenerate={() => {}}
            isLoading={false}
            messages={mockMessages}
            isRefinerEnabled
            onToggleRefiner={() => {}}
          />
        )}
      </div>
    );
  }

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
            onSessionInstructionChange={() => {}}
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
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewErrorBoundary>
      <PreviewApp />
    </PreviewErrorBoundary>
  </React.StrictMode>
);
