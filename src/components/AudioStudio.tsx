import React, { useMemo, useState } from 'react';
import {
  FileAudio,
  Loader2,
  Mic2,
  Sparkles,
} from 'lucide-react';

import {
  findGeminiTtsVoice,
  getGeminiTtsModelLabel,
} from '../../shared/gemini-tts.js';
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

const audioTone: MediaStudioTone = {
  accent: '#f9a8d4',
  accentRgb: '249,168,212',
  accentInk: '#160711',
  washRgb: '34,211,238',
  icon: Mic2,
};

interface AudioStudioProps {
  onGenerate: (prompt: string, request?: MediaGenerationRequest) => void;
  isLoading: boolean;
  messages: Message[];
}

export const AudioStudio: React.FC<AudioStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
}) => {
  const { configs } = useStore();
  const config = configs.audio;

  const [text, setText] = useState('');

  const selectedVoice = findGeminiTtsVoice(config.ttsVoice || 'Kore');
  const allAudio = useMemo(() => buildAudioHistory(messages, { mode: 'audio' }), [messages]);
  const featuredAudio = allAudio[0] || null;
  const canSubmit = Boolean(text.trim()) && !isLoading;
  const modelLabel = getGeminiTtsModelLabel(config.model);
  const voiceLabel = selectedVoice
    ? `${selectedVoice.name} - ${selectedVoice.style}`
    : config.ttsVoice || 'Kore';

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const cleanText = text.trim();
    onGenerate(cleanText, { originalPrompt: cleanText });
    setText('');
  };

  const composer = (
    <MediaPanel>
      <MediaPanelHeader
        label="Voix"
        title="Console narration"
        detail={`${voiceLabel} - ${config.ttsLanguageCode || 'fr-FR'}`}
        icon={Mic2}
      />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 pt-2">
        <MediaField label="Texte" className="min-h-0">
          <MediaTextarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Colle le texte..."
            rows={8}
          />
        </MediaField>

        <PrimaryActionButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          loadingLabel="..."
          idleLabel="Synthese"
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
        detail={voiceLabel}
        icon={FileAudio}
      />

      <div className="grid min-h-0 flex-1 pt-2">
        {!featuredAudio && !isLoading ? (
          <EmptyOutput
            icon={FileAudio}
            title="Aucune voix generee"
          />
        ) : !featuredAudio && isLoading ? (
          <div className="flex min-h-0 items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[var(--media-accent)]" />
          </div>
        ) : (
          featuredAudio && (
            <StudioAudioPlayer
              key={featuredAudio.id}
              src={featuredAudio.url}
              title="Voix"
              prompt={featuredAudio.prompt}
              downloadName={featuredAudio.name || 'voix-generee.wav'}
              accentRgb="249,168,212"
              accentEndRgb="34,211,238"
              accentInk="#120711"
            />
          )
        )}
      </div>
    </MediaPanel>
  );

  return (
    <MediaStudioShell
      tone={audioTone}
      eyebrow="Voix"
      title="Diriger une voix expressive"
      subtitle="Texte, voix et rendu audio restent relies au meme prompt source."
      metrics={[
        { label: 'Modele', value: modelLabel },
        { label: 'Voix', value: selectedVoice?.name || config.ttsVoice || 'Kore' },
        { label: 'Langue', value: config.ttsLanguageCode || 'fr-FR' },
        { label: 'Rendus', value: allAudio.length },
      ]}
      composer={composer}
      stage={stage}
      rootProps={{ 'data-audio-studio-scroll': 'true' }}
    />
  );
};
