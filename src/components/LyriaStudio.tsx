import React, { useMemo, useState } from 'react';
import {
  Loader2,
  Music,
  Sparkles,
} from 'lucide-react';

import {
  getLyriaModelLabel,
} from '../../shared/lyria-models.js';
import { useStore } from '../store/useStore';
import { MediaGenerationRequest, Message } from '../types';
import { buildAudioHistory } from '../utils/media-gallery-history';
import {
  EmptyOutput,
  MediaField,
  MediaPanel,
  MediaPanelHeader,
  MediaStudioShell,
  MediaTextarea,
  PrimaryActionButton,
  type MediaStudioTone,
} from './MediaStudioLayout';
import { StudioAudioPlayer } from './StudioAudioPlayer';

const lyriaTone: MediaStudioTone = {
  accent: '#34d399',
  accentRgb: '52,211,153',
  accentInk: '#04120d',
  washRgb: '250,204,21',
  icon: Music,
};

interface LyriaStudioProps {
  onGenerate: (prompt: string, request?: MediaGenerationRequest) => void;
  isLoading: boolean;
  messages: Message[];
}

export const LyriaStudio: React.FC<LyriaStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
}) => {
  const { configs } = useStore();
  const config = configs.lyria;
  const [prompt, setPrompt] = useState('');

  const allTracks = useMemo(() => buildAudioHistory(messages, { mode: 'lyria' }), [messages]);
  const featuredTrack = allTracks[0] || null;
  const canSubmit = Boolean(prompt.trim()) && !isLoading;
  const modelLabel = getLyriaModelLabel(config.model);
  const sampleCount = config.sampleCount || 1;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const cleanPrompt = prompt.trim();
    onGenerate(cleanPrompt, { originalPrompt: cleanPrompt });
    setPrompt('');
  };

  const composer = (
    <MediaPanel>
      <MediaPanelHeader
        label="Lyria"
        title="Composition"
        detail={`${modelLabel} - ${sampleCount} variante${sampleCount > 1 ? 's' : ''}`}
        icon={Music}
      />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 pt-2">
        <MediaField label="Prompt" className="min-h-0">
          <MediaTextarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Decris le morceau..."
            rows={8}
          />
        </MediaField>

        <PrimaryActionButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          loadingLabel="..."
          idleLabel="Composer"
          icon={Sparkles}
        />
      </div>
    </MediaPanel>
  );

  const stage = (
    <MediaPanel>
      <MediaPanelHeader
        label="Sortie"
        title={modelLabel}
        detail={`${allTracks.length} piste${allTracks.length > 1 ? 's' : ''}`}
        icon={Music}
      />

      <div className="grid min-h-0 flex-1 pt-2">
        {!featuredTrack && !isLoading ? (
          <EmptyOutput
            icon={Music}
            title="Aucun morceau"
          />
        ) : !featuredTrack && isLoading ? (
          <div className="flex min-h-0 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[var(--media-accent)]" />
          </div>
        ) : (
          featuredTrack && (
            <StudioAudioPlayer
              key={featuredTrack.id}
              src={featuredTrack.url}
              title="Morceau"
              prompt={featuredTrack.prompt}
              downloadName={featuredTrack.name || 'lyria-track.wav'}
              accentRgb="52,211,153"
              accentEndRgb="250,204,21"
              accentInk="#061105"
            />
          )
        )}
      </div>
    </MediaPanel>
  );

  return (
    <MediaStudioShell
      tone={lyriaTone}
      eyebrow="Lyria"
      title="Composer une piste musicale"
      subtitle="Une direction musicale concise, des variantes claires et un lecteur dedie au rendu."
      metrics={[
        { label: 'Modele', value: modelLabel },
        { label: 'Variantes', value: sampleCount },
        { label: 'Negative', value: config.negativePrompt ? 'Actif' : 'Vide' },
        { label: 'Pistes', value: allTracks.length },
      ]}
      composer={composer}
      stage={stage}
      rootProps={{ 'data-lyria-studio-scroll': 'true' }}
    />
  );
};
