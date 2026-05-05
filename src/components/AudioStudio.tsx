import React, { useMemo, useState } from 'react';
import {
  FileAudio,
  Loader2,
  Mic2,
  Sparkles,
} from 'lucide-react';

import {
  findGeminiTtsVoice,
  GEMINI_TTS_MODEL_OPTIONS,
  GEMINI_TTS_VOICES,
  getGeminiTtsModelLabel,
  modelSupportsGeminiTtsMultiSpeaker,
} from '../../shared/gemini-tts.js';
import { useStore } from '../store/useStore';
import { MediaGenerationRequest, Message } from '../types';
import { getGoogleRecommendedGenerationDefaults } from '../utils/generation-defaults';
import { buildAudioHistory } from '../utils/media-gallery-history';
import {
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
  const { configs, setConfig } = useStore();
  const config = configs.audio;

  const [text, setText] = useState('');

  const selectedVoice = findGeminiTtsVoice(config.ttsVoice || 'Kore');
  const allAudio = useMemo(() => buildAudioHistory(messages, { mode: 'audio' }), [messages]);
  const supportsDuo = modelSupportsGeminiTtsMultiSpeaker(config.model);
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

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(5rem,1fr)_auto_auto_auto_auto] gap-3 pt-2">
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
            placeholder="Texte a synthetiser, ton, rythme, intention vocale..."
            rows={8}
          />
        </MediaField>

        <div className="grid gap-4 sm:grid-cols-2">
          <MediaField label="Modele">
            <MediaSelect
              value={config.model}
              onChange={(event) => setConfig({
                model: event.target.value,
                ...getGoogleRecommendedGenerationDefaults('audio'),
              })}
            >
              {GEMINI_TTS_MODEL_OPTIONS.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </MediaSelect>
          </MediaField>

          <MediaField label="Voix">
            <MediaSelect
              value={config.ttsVoice || 'Kore'}
              onChange={(event) => setConfig({ ttsVoice: event.target.value })}
            >
              {GEMINI_TTS_VOICES.map((voice) => (
                <option key={voice.name} value={voice.name}>
                  {voice.name} - {voice.style}
                </option>
              ))}
            </MediaSelect>
          </MediaField>
        </div>

        <div className="grid gap-4 sm:grid-cols-[9rem_1fr]">
          <MediaField label="Langue">
            <MediaInput
              value={config.ttsLanguageCode || 'fr-FR'}
              onChange={(event) => setConfig({ ttsLanguageCode: event.target.value })}
            />
          </MediaField>

          <MediaField label="Style">
            <MediaInput
              value={config.ttsStyleInstructions || ''}
              onChange={(event) => setConfig({ ttsStyleInstructions: event.target.value })}
              placeholder="calme, energie, documentaire, annonce premium..."
            />
          </MediaField>
        </div>

        <InlineNotice>
          {selectedVoice
            ? `${selectedVoice.name} - ${selectedVoice.style} - ${selectedVoice.gender === 'female' ? 'voix feminine' : 'voix masculine'}`
            : modelLabel}
          {supportsDuo ? ' - duo possible avec 2 intervenants.' : ' - single-speaker.'}
        </InlineNotice>

        <PrimaryActionButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          loadingLabel="Synthese..."
          idleLabel="Synthetiser la voix"
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
        action={(
          <div className="border-l border-white/[0.08] pl-3 text-xs font-semibold text-[var(--app-text-muted)]">
            {allAudio.length} voix
          </div>
        )}
      />

      <div className="min-h-0 flex-1 space-y-3 overflow-hidden pt-2">
        {allAudio.length === 0 && !isLoading ? (
          <EmptyOutput
            icon={FileAudio}
            title="Aucune voix generee"
            detail="Les pistes vocales conserveront leur prompt source."
          />
        ) : (
          <>
            {isLoading && (
              <InlineNotice className="flex items-center gap-3">
                <Loader2 size={18} className="animate-spin text-[var(--media-accent)]" />
                Synthese vocale en cours...
              </InlineNotice>
            )}

            {allAudio.map((item, index) => (
              <StudioAudioPlayer
                key={item.id}
                src={item.url}
                title={item.name || `Voix ${allAudio.length - index}`}
                subtitle={item.model || item.mimeType || `${selectedVoice?.name || 'Gemini TTS'} - ${config.ttsLanguageCode || 'fr-FR'}`}
                prompt={item.prompt}
                downloadName={item.name || 'voix-generee.wav'}
                compact={index > 0}
                accentRgb="249,168,212"
                accentEndRgb="34,211,238"
                accentInk="#120711"
              />
            ))}
          </>
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
    />
  );
};
