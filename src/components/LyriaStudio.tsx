import React, { useMemo, useState } from 'react';
import {
  Loader2,
  Music,
  Sparkles,
} from 'lucide-react';

import {
  getLyriaModelLabel,
  LYRIA_MODEL_OPTIONS,
} from '../../shared/lyria-models.js';
import { useStore } from '../store/useStore';
import { MediaGenerationRequest, Message } from '../types';
import { getGoogleRecommendedGenerationDefaults } from '../utils/generation-defaults';
import { buildAudioHistory } from '../utils/media-gallery-history';
import {
  ChoiceButton,
  EmptyOutput,
  InlineNotice,
  MediaField,
  MediaInput,
  MediaPanel,
  MediaPanelHeader,
  MediaSelect,
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
  const { configs, setConfig } = useStore();
  const config = configs.lyria;
  const [prompt, setPrompt] = useState('');

  const allTracks = useMemo(() => buildAudioHistory(messages, { mode: 'lyria' }), [messages]);
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

      <div className="space-y-5 p-4 sm:p-5">
        <MediaField label="Prompt musical">
          <MediaTextarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Energie, tempo, instruments, texture, structure, emotion dominante..."
            rows={8}
          />
        </MediaField>

        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <MediaField label="Modele">
            <MediaSelect
              value={config.model}
              onChange={(event) => setConfig({
                model: event.target.value,
                ...getGoogleRecommendedGenerationDefaults('lyria'),
              })}
            >
              {LYRIA_MODEL_OPTIONS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>

          <MediaField label="Variantes">
            <div className="grid grid-cols-4 gap-2">
              {[1, 2, 3, 4].map((count) => (
                <ChoiceButton
                  key={count}
                  active={sampleCount === count}
                  onClick={() => setConfig({ sampleCount: count })}
                >
                  {count}
                </ChoiceButton>
              ))}
            </div>
          </MediaField>
        </div>

        <MediaField label="Negative prompt">
          <MediaInput
            value={config.negativePrompt || ''}
            onChange={(event) => setConfig({ negativePrompt: event.target.value })}
            placeholder="sons, styles ou ambiances a eviter"
          />
        </MediaField>

        <PrimaryActionButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          loadingLabel="Composition..."
          idleLabel="Composer le morceau"
          icon={Sparkles}
        />
      </div>
    </MediaPanel>
  );

  const stage = (
    <MediaPanel className="min-h-[34rem]">
      <MediaPanelHeader
        label="Sortie"
        title={modelLabel}
        detail={`${allTracks.length} piste${allTracks.length > 1 ? 's' : ''}`}
        action={(
          <div className="rounded-lg border border-[var(--app-border)] bg-white/[0.045] px-3 py-2 text-sm font-semibold text-[var(--app-text-muted)]">
            {allTracks.length} piste{allTracks.length > 1 ? 's' : ''}
          </div>
        )}
      />

      <div className="space-y-4 p-4 sm:p-5">
        {allTracks.length === 0 && !isLoading ? (
          <EmptyOutput
            icon={Music}
            title="Aucun morceau"
            detail="Les pistes Lyria apparaitront avec leur prompt source."
          />
        ) : (
          <>
            {isLoading && (
              <InlineNotice className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-[var(--media-accent)]" />
                Composition en cours...
              </InlineNotice>
            )}

            {allTracks.map((track, index) => (
              <StudioAudioPlayer
                key={track.id}
                src={track.url}
                title={track.name || `Piste ${allTracks.length - index}`}
                subtitle={track.model || track.mimeType || config.model}
                prompt={track.prompt}
                downloadName={track.name || 'lyria-track.wav'}
                compact={index > 0}
                accentRgb="52,211,153"
                accentEndRgb="250,204,21"
                accentInk="#061105"
              />
            ))}
          </>
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
    />
  );
};
