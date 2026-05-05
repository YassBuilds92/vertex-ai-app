import React, { useEffect, useMemo, useState } from 'react';
import {
  Clapperboard,
  Download,
  Film,
  Loader2,
  Sparkles,
} from 'lucide-react';

import { useStore } from '../store/useStore';
import { MediaGenerationRequest, Message } from '../types';
import { buildVideoHistory } from '../utils/media-gallery-history';
import {
  EmptyOutput,
  MediaField,
  MediaPanel,
  MediaPanelHeader,
  MediaStudioShell,
  MediaTextarea,
  PrimaryActionButton,
  PromptSource,
  type MediaStudioTone,
} from './MediaStudioLayout';

const videoTone: MediaStudioTone = {
  accent: '#ffb86b',
  accentRgb: '255,184,107',
  accentInk: '#130c05',
  washRgb: '34,211,238',
  icon: Film,
};

interface VideoStudioProps {
  onGenerate: (prompt: string, request?: MediaGenerationRequest) => void;
  isLoading: boolean;
  messages: Message[];
}

export const VideoStudio: React.FC<VideoStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
}) => {
  const { configs } = useStore();
  const config = configs.video;
  const [prompt, setPrompt] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const allVideos = useMemo(() => buildVideoHistory(messages), [messages]);
  const featuredVideo = useMemo(
    () => allVideos.find((video) => video.id === selectedVideoId) || allVideos[0] || null,
    [allVideos, selectedVideoId],
  );
  const canSubmit = Boolean(prompt.trim()) && !isLoading;

  useEffect(() => {
    if (!allVideos.length) {
      setSelectedVideoId(null);
      return;
    }

    if (!selectedVideoId || !allVideos.some((video) => video.id === selectedVideoId)) {
      setSelectedVideoId(allVideos[0].id);
    }
  }, [allVideos, selectedVideoId]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    const cleanPrompt = prompt.trim();
    onGenerate(cleanPrompt, { originalPrompt: cleanPrompt });
    setPrompt('');
  };

  const composer = (
    <MediaPanel>
      <MediaPanelHeader
        label="Storyboard"
        title="Scene video"
        detail={`${config.videoAspectRatio || '16:9'} - ${config.videoDurationSeconds || 6}s - ${config.videoResolution || '720p'}`}
        icon={Clapperboard}
      />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] gap-3 pt-2">
        <MediaField label="Scene" className="min-h-0">
          <MediaTextarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="Decris la scene..."
            rows={7}
          />
        </MediaField>

        <PrimaryActionButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          loadingLabel="..."
          idleLabel="Generer"
          icon={Sparkles}
        />
      </div>
    </MediaPanel>
  );

  const stage = (
    <MediaPanel>
      <MediaPanelHeader
        label="Scene active"
        title={featuredVideo?.name || 'Rendu video'}
        detail={featuredVideo?.model || config.model || 'Veo'}
        icon={Film}
      />

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto_auto] gap-2 pt-2">
        {!featuredVideo && isLoading ? (
          <div className="flex min-h-0 animate-pulse items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[var(--media-accent)]" />
          </div>
        ) : featuredVideo ? (
          <>
            <div className="min-h-0 overflow-hidden bg-black">
              <video
                src={featuredVideo.url}
                controls
                className="h-full w-full bg-black object-contain"
                preload="metadata"
              />
            </div>

            <div className="flex justify-end">
              <a
                href={featuredVideo.url}
                download={featuredVideo.name || 'video-generee.mp4'}
                className="inline-flex h-8 w-8 items-center justify-center text-[var(--app-text-muted)] hover:text-[var(--app-text)]"
                title="Telecharger"
                aria-label="Telecharger"
              >
                <Download size={15} />
              </a>
            </div>

            <PromptSource prompt={featuredVideo.prompt} />
          </>
        ) : (
          <EmptyOutput
            icon={Film}
            title="Aucune scene video"
          />
        )}
      </div>
    </MediaPanel>
  );

  return (
    <MediaStudioShell
      tone={videoTone}
      eyebrow="Video"
      title="Cadrer une scene avant generation"
      subtitle="Une surface de storyboard pour choisir format, duree et intention sans masquer le rendu."
      metrics={[
        { label: 'Format', value: config.videoAspectRatio || '16:9' },
        { label: 'Duree', value: `${config.videoDurationSeconds || 6}s` },
        { label: 'Resolution', value: config.videoResolution || '720p' },
        { label: 'Rendus', value: allVideos.length },
      ]}
      composer={composer}
      stage={stage}
      rootProps={{ 'data-video-studio-scroll': 'true' }}
    />
  );
};
