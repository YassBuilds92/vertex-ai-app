import React, { useEffect, useMemo, useState } from 'react';
import {
  Clapperboard,
  Download,
  Film,
  Loader2,
  Monitor,
  Smartphone,
  Sparkles,
  Timer,
} from 'lucide-react';

import { useStore } from '../store/useStore';
import { MediaGenerationRequest, Message, ModelConfig } from '../types';
import { buildVideoHistory } from '../utils/media-gallery-history';
import {
  ChoiceButton,
  EmptyOutput,
  InlineNotice,
  MediaField,
  MediaPanel,
  MediaPanelHeader,
  MediaStudioShell,
  MediaTextarea,
  PrimaryActionButton,
  PromptSource,
  cn,
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

type VideoResolution = NonNullable<ModelConfig['videoResolution']>;
type VideoAspectRatio = NonNullable<ModelConfig['videoAspectRatio']>;

export const VideoStudio: React.FC<VideoStudioProps> = ({
  onGenerate,
  isLoading,
  messages,
}) => {
  const { configs, setConfig } = useStore();
  const config = configs.video;
  const [prompt, setPrompt] = useState('');
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);

  const videoResolutionOptions: VideoResolution[] = /preview/i.test(config.model || '')
    ? ['720p', '1080p', '4k']
    : ['720p', '1080p'];
  const allVideos = useMemo(() => buildVideoHistory(messages), [messages]);
  const featuredVideo = useMemo(
    () => allVideos.find((video) => video.id === selectedVideoId) || allVideos[0] || null,
    [allVideos, selectedVideoId],
  );
  const galleryVideos = useMemo(
    () => allVideos.filter((video) => video.id !== featuredVideo?.id),
    [allVideos, featuredVideo?.id],
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

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(5rem,1fr)_auto_auto_auto] gap-3 pt-2">
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
            placeholder="Sujet, mouvement camera, rythme, lumiere, ambiance, action finale..."
            rows={7}
          />
        </MediaField>

        <MediaField label="Format">
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: '16:9' as VideoAspectRatio, label: 'Paysage', icon: Monitor },
              { value: '9:16' as VideoAspectRatio, label: 'Portrait', icon: Smartphone },
            ]).map((option) => {
              const Icon = option.icon;
              return (
                <ChoiceButton
                  key={option.value}
                  active={(config.videoAspectRatio || '16:9') === option.value}
                  onClick={() => setConfig({ videoAspectRatio: option.value })}
                >
                  <Icon size={15} />
                  {option.label}
                </ChoiceButton>
              );
            })}
          </div>
        </MediaField>

        <div className="grid gap-4 sm:grid-cols-2">
          <MediaField label="Resolution">
            <div className="grid grid-cols-2 gap-2">
              {videoResolutionOptions.map((resolution) => (
                <ChoiceButton
                  key={resolution}
                  active={(config.videoResolution || '720p') === resolution}
                  onClick={() => setConfig({ videoResolution: resolution })}
                >
                  {resolution === '4k' ? '4K' : resolution}
                </ChoiceButton>
              ))}
            </div>
          </MediaField>

          <MediaField label="Duree">
            <div className="grid grid-cols-3 gap-2">
              {[4, 6, 8].map((seconds) => (
                <ChoiceButton
                  key={seconds}
                  active={(config.videoDurationSeconds || 6) === seconds}
                  onClick={() => setConfig({ videoDurationSeconds: seconds })}
                >
                  <Timer size={14} />
                  {seconds}s
                </ChoiceButton>
              ))}
            </div>
          </MediaField>
        </div>

        <PrimaryActionButton
          onClick={handleSubmit}
          disabled={!canSubmit}
          loading={isLoading}
          loadingLabel="Generation..."
          idleLabel="Generer la scene"
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
        action={(
          <div className="border-l border-white/[0.08] pl-3 text-xs font-semibold text-[var(--app-text-muted)]">
            {allVideos.length} video{allVideos.length > 1 ? 's' : ''}
          </div>
        )}
      />

      <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)_auto_auto] gap-2 pt-2">
        {isLoading && (
          <InlineNotice className="flex items-center gap-3">
            <Loader2 size={18} className="animate-spin text-[var(--media-accent)]" />
            Generation video en cours...
          </InlineNotice>
        )}

        {!featuredVideo && isLoading ? (
          <div className="flex min-h-0 animate-pulse items-center justify-center border border-white/[0.08]">
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

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-sm text-[var(--app-text-muted)]">
                {featuredVideo.mimeType || 'video'}{featuredVideo.createdAt ? ` - ${new Date(featuredVideo.createdAt).toLocaleDateString('fr-FR')}` : ''}
              </div>
              <a
                href={featuredVideo.url}
                download={featuredVideo.name || 'video-generee.mp4'}
                className="inline-flex items-center gap-1.5 border-b border-white/[0.16] px-1 py-1 text-xs font-semibold text-[var(--app-text)] hover:border-[var(--media-accent)]"
              >
                <Download size={15} />
                Telecharger
              </a>
            </div>

            <PromptSource prompt={featuredVideo.prompt} />

            {galleryVideos.length > 0 && (
              <div className="grid max-h-16 gap-2 overflow-hidden sm:grid-cols-2">
                {galleryVideos.map((video) => (
                  <button
                    key={video.id}
                    type="button"
                    onClick={() => setSelectedVideoId(video.id)}
                    className={cn(
                      'group overflow-hidden border-b text-left hover:border-[rgba(var(--media-accent-rgb),0.55)]',
                      selectedVideoId === video.id ? 'border-[var(--media-accent)]' : 'border-white/10',
                    )}
                  >
                    <video src={video.url} className="aspect-video w-full object-cover opacity-85 group-hover:opacity-100" preload="metadata" muted />
                    <div className="px-3 py-2 text-xs font-semibold text-[var(--app-text-muted)]">
                      {video.name || video.prompt || 'Scene video'}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <EmptyOutput
            icon={Film}
            title="Aucune scene video"
            detail="Le prochain rendu s'affichera ici avec son prompt source."
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
    />
  );
};
