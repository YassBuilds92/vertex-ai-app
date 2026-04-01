import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AudioLines,
  Disc3,
  FileAudio,
  Play,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AttachmentGallery } from './AttachmentGallery';
import { getAgentPalette, getRenderableFields } from './AgentAppPreview';
import { AgentFieldSchema, AgentFormValues, Attachment, Message, StudioAgent } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type NasheedStudioWorkspaceProps = {
  agent: StudioAgent;
  formValues: AgentFormValues;
  messages: Message[];
  isRunning: boolean;
  onFieldChange: (fieldId: string, value: string | boolean) => void;
  onRunAgent: () => Promise<unknown> | void;
  onAskCowork: (request: string) => Promise<unknown> | void;
  onBackToHub: () => void;
  setSelectedImage: (url: string) => void;
};

const runStateMeta = {
  idle: {
    label: 'Pret',
    tone: 'border-white/10 bg-white/[0.04] text-white/72',
  },
  running: {
    label: 'En rendu',
    tone: 'border-amber-300/18 bg-amber-300/[0.08] text-amber-100',
  },
  completed: {
    label: 'Master pret',
    tone: 'border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-100',
  },
  failed: {
    label: 'A revoir',
    tone: 'border-rose-300/18 bg-rose-300/[0.08] text-rose-100',
  },
  aborted: {
    label: 'Arrete',
    tone: 'border-amber-300/18 bg-amber-300/[0.08] text-amber-100',
  },
} as const;

function dedupeAttachments(messages: Message[]) {
  const seen = new Set<string>();
  const output: Attachment[] = [];

  for (const message of [...messages].reverse()) {
    for (const attachment of message.attachments || []) {
      const key = `${attachment.type}:${attachment.url}:${attachment.name || ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      output.push(attachment);
      if (output.length >= 8) return output;
    }
  }

  return output;
}

function findField(fields: AgentFieldSchema[], pattern: RegExp) {
  return fields.find((field) => pattern.test(`${field.id} ${field.label}`));
}

function getStringValue(value: string | boolean | undefined) {
  return typeof value === 'string' ? value.trim() : '';
}

function summarizeText(value: string, maxLength: number) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength).trimEnd()}...`;
}

function buildHeadline(value: string, fallback: string) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return fallback;
  const firstSentence = compact.split(/[.!?]/)[0]?.trim() || compact;
  return summarizeText(firstSentence, 42);
}

function buildStructureSteps(structureValue: string) {
  const chunks = structureValue
    .split(/\+|\/|>|,|;/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (chunks.length >= 2) {
    return chunks.slice(0, 4);
  }

  return ['Intro', 'Couplet', 'Refrain', 'Outro'];
}

function formatMetricValue(value: string) {
  if (!value) return '';
  if (/^\d+$/.test(value)) return `${value} s`;
  return value;
}

export const NasheedStudioWorkspace: React.FC<NasheedStudioWorkspaceProps> = ({
  agent,
  formValues,
  messages,
  isRunning,
  onFieldChange,
  onRunAgent,
  onAskCowork,
  onBackToHub,
  setSelectedImage,
}) => {
  const [editRequest, setEditRequest] = useState('');
  const renderableFields = useMemo(() => getRenderableFields(agent), [agent]);
  const palette = getAgentPalette(agent);

  useEffect(() => {
    setEditRequest('');
  }, [agent.id]);

  const latestModelMessage = useMemo(
    () => [...messages].reverse().find((message) =>
      message.role === 'model'
      && (
        Boolean(message.content?.trim())
        || Boolean(message.attachments?.length)
        || Boolean(message.activity?.length)
      )),
    [messages]
  );

  const recentAttachments = useMemo(() => dedupeAttachments(messages), [messages]);
  const masterAudio = recentAttachments.find((attachment) => attachment.type === 'audio');
  const statusKey = isRunning
    ? 'running'
    : latestModelMessage?.runState || 'idle';
  const status = runStateMeta[statusKey];

  const recentActivity = (latestModelMessage?.activity || [])
    .filter((item) => item.kind !== 'tool_call')
    .slice(-4)
    .reverse();

  const latestRunMeta = latestModelMessage?.runMeta;
  const directionField = renderableFields.find((field) => field.type === 'textarea') || renderableFields[0];
  const directionText = directionField
    ? getStringValue(formValues[directionField.id]) || directionField.placeholder || agent.mission
    : agent.mission;
  const directionHeadline = buildHeadline(directionText, agent.name);
  const controlFields = renderableFields.filter((field) => field.id !== directionField?.id);
  const structureField = findField(renderableFields, /structure|format/i);
  const energyField = findField(renderableFields, /energie|energy|intens|ton|ambiance|mood|emotion/i);
  const engineField = findField(renderableFields, /moteur|lyria|modele|model|engine/i);
  const durationField = findField(renderableFields, /duree|duration|second|length/i);
  const structureValue = structureField ? getStringValue(formValues[structureField.id]) : '';
  const energyValue = energyField ? getStringValue(formValues[energyField.id]) : '';
  const engineValue = engineField ? getStringValue(formValues[engineField.id]) : 'Lyria 3 Pro preview';
  const durationValue = durationField ? formatMetricValue(getStringValue(formValues[durationField.id])) : '';
  const structureSteps = buildStructureSteps(structureValue);

  const spotlightStats = [
    { label: 'Moteur', value: engineValue || 'Lyria 3 Pro preview' },
    { label: 'Format', value: structureValue || 'Libre' },
    ...(energyValue ? [{ label: 'Ambiance', value: energyValue }] : []),
    ...(durationValue ? [{ label: 'Duree', value: durationValue }] : []),
  ].slice(0, 4);

  const runStats = [
    { label: 'Phase', value: latestRunMeta?.phase || (isRunning ? 'generation' : 'attente') },
    { label: 'Artefact', value: latestRunMeta?.artifactState || 'none' },
    { label: 'Recherches', value: String(latestRunMeta?.searchCount || 0) },
    { label: 'Sources', value: String(latestRunMeta?.sourcesOpened || 0) },
  ];

  const renderField = (field: AgentFieldSchema) => {
    const currentValue = formValues[field.id];

    if (field.type === 'select') {
      return (
        <div className="grid gap-2 sm:grid-cols-2">
          {(field.options || []).map((option) => {
            const isActive = currentValue === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => onFieldChange(field.id, option)}
                className={cn(
                  'rounded-[1.2rem] border px-4 py-3 text-left text-sm transition-all',
                  isActive
                    ? 'text-slate-950'
                    : 'border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]'
                )}
                style={isActive ? {
                  background: `linear-gradient(135deg, ${palette.accent}, ${palette.accentStrong})`,
                  borderColor: 'transparent',
                  boxShadow: `0 18px 40px -26px ${palette.glow}`,
                } : undefined}
              >
                {option}
              </button>
            );
          })}
        </div>
      );
    }

    if (field.type === 'boolean') {
      const checked = Boolean(currentValue);
      return (
        <button
          type="button"
          onClick={() => onFieldChange(field.id, !checked)}
          className={cn(
            'flex w-full items-center justify-between rounded-[1.25rem] border px-4 py-3 text-left transition-all',
            checked
              ? 'border-transparent text-slate-950'
              : 'border-white/10 bg-white/[0.04] text-white/72 hover:bg-white/[0.07]'
          )}
          style={checked ? {
            background: `linear-gradient(135deg, ${palette.accent}, ${palette.accentStrong})`,
            boxShadow: `0 18px 40px -26px ${palette.glow}`,
          } : undefined}
        >
          <span className="text-sm font-medium">{field.label}</span>
          <span
            className={cn(
              'inline-flex h-6 w-11 items-center rounded-full border px-1 transition-all',
              checked ? 'border-black/10 bg-black/10' : 'border-white/10 bg-black/20'
            )}
          >
            <span
              className={cn(
                'h-4 w-4 rounded-full transition-transform',
                checked ? 'translate-x-5 bg-slate-950' : 'translate-x-0 bg-white/55'
              )}
            />
          </span>
        </button>
      );
    }

    if (field.type === 'textarea') {
      return (
        <textarea
          value={typeof currentValue === 'string' ? currentValue : ''}
          onChange={(event) => onFieldChange(field.id, event.target.value)}
          rows={6}
          placeholder={field.placeholder}
          className="min-h-[200px] w-full rounded-[1.7rem] border border-white/10 bg-black/24 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-white/22 focus:border-white/20"
        />
      );
    }

    return (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        value={typeof currentValue === 'string' ? currentValue : ''}
        onChange={(event) => onFieldChange(field.id, event.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/22 focus:border-white/20"
      />
    );
  };

  return (
    <div className="studio-shell relative flex h-[100dvh] w-full overflow-hidden bg-[#06040a] text-[#f8f2e8]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_16%_12%,rgba(232,190,116,0.16),transparent_24%),radial-gradient(circle_at_78%_10%,rgba(148,211,255,0.12),transparent_20%),radial-gradient(circle_at_62%_78%,rgba(255,255,255,0.05),transparent_22%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),transparent_22%,transparent_82%,rgba(255,255,255,0.02))]" />
        <div className="absolute left-[18%] top-[18%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(231,193,110,0.14),transparent_66%)] blur-3xl" />
        <div className="absolute right-[12%] top-[14%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(111,199,255,0.12),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="border-b border-white/8 bg-black/10 px-4 py-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1540px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <button
                type="button"
                onClick={onBackToHub}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/74 transition-colors hover:bg-white/[0.08]"
              >
                <ArrowLeft size={15} />
                Cowork Apps
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] uppercase tracking-[0.3em] text-white/38">Nasheed Studio</span>
                  <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.18em]', status.tone)}>
                    <Sparkles size={11} />
                    {status.label}
                  </span>
                </div>
                <div className="mt-2 text-[clamp(1.45rem,2vw,2rem)] font-semibold tracking-[-0.05em] text-white">
                  {agent.name}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[engineValue || 'Lyria 3', structureValue || 'Structure libre', energyValue || 'Ambiance libre']
                .filter(Boolean)
                .slice(0, 3)
                .map((pill) => (
                  <span
                    key={pill}
                    className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/68"
                  >
                    <Sparkles size={12} style={{ color: palette.accent }} />
                    {summarizeText(pill, 28)}
                  </span>
                ))}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1540px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
            <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-5 shadow-[0_24px_90px_-50px_rgba(0,0,0,0.92)]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                    <Wand2 size={13} />
                    Direction
                  </div>
                  {directionField?.required && (
                    <span
                      className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/68"
                      style={{ borderColor: palette.rim, background: palette.accentSoft }}
                    >
                      requis
                    </span>
                  )}
                </div>

                {directionField && (
                  <div className="mt-4 space-y-3">
                    <label className="text-sm font-medium text-white/88">{directionField.label}</label>
                    {renderField(directionField)}
                  </div>
                )}
              </div>

              {controlFields.length > 0 && (
                <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                    <Disc3 size={13} />
                    Reglages
                  </div>

                  <div className="mt-4 space-y-4">
                    {controlFields.map((field) => (
                      <div key={field.id} className="space-y-2.5">
                        {field.type !== 'boolean' && (
                          <div className="text-sm font-medium text-white/80">{field.label}</div>
                        )}
                        {renderField(field)}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Session</div>
                    <div className="mt-2 text-lg font-semibold tracking-tight text-white">
                      {isRunning ? 'Rendu en cours' : 'Pret a lancer'}
                    </div>
                  </div>
                  <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.18em]', status.tone)}>
                    <Sparkles size={11} />
                    {status.label}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRunAgent()}
                  disabled={isRunning}
                  className={cn(
                    'mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all',
                    isRunning
                      ? 'cursor-not-allowed bg-white/10 text-white/36'
                      : 'text-slate-950'
                  )}
                  style={!isRunning ? {
                    background: `linear-gradient(135deg, ${palette.accent}, ${palette.accentStrong})`,
                    boxShadow: `0 22px 44px -28px ${palette.glow}`,
                  } : undefined}
                >
                  {isRunning ? (
                    <>
                      <Sparkles size={15} className="animate-pulse" />
                      Generation...
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      Composer
                    </>
                  )}
                </button>

                <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/18 p-3.5">
                  <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/38">
                    <Wand2 size={12} />
                    Modifier le studio
                  </div>
                  <textarea
                    value={editRequest}
                    onChange={(event) => setEditRequest(event.target.value)}
                    rows={3}
                    placeholder="Mode duo vocals, cover plus solennelle, dock exports..."
                    className="mt-3 min-h-[110px] w-full rounded-[1.35rem] border border-white/10 bg-black/22 px-4 py-3 text-sm text-white outline-none placeholder:text-white/22 focus:border-white/20"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const cleaned = editRequest.trim();
                      if (!cleaned || isRunning) return;
                      await onAskCowork(cleaned);
                      setEditRequest('');
                    }}
                    disabled={isRunning || !editRequest.trim()}
                    className={cn(
                      'mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all',
                      isRunning || !editRequest.trim()
                        ? 'cursor-not-allowed bg-white/10 text-white/36'
                        : 'border border-white/12 bg-white/[0.05] text-white hover:bg-white/[0.08]'
                    )}
                  >
                    Envoyer a Cowork
                    <Wand2 size={15} />
                  </button>
                </div>
              </div>
            </aside>

            <section className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="overflow-hidden rounded-[2.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] shadow-[0_34px_110px_-60px_rgba(0,0,0,0.9)]"
              >
                <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-x-[7%] top-[10%] h-[72%] rounded-[2.4rem] bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_62%)]" />
                    <div
                      className="absolute left-[20%] top-[12%] h-[18rem] w-[18rem] rounded-full blur-3xl"
                      style={{ background: `radial-gradient(circle, ${palette.accentSoft}, transparent 72%)` }}
                    />
                    <div className="absolute inset-x-6 bottom-0 h-px bg-white/10" />
                  </div>

                  <div className="relative z-10 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-white/72"
                          style={{ borderColor: palette.rim, background: palette.accentSoft }}
                        >
                          <Disc3 size={13} />
                          Session live
                        </span>
                        {masterAudio && (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/18 bg-emerald-300/[0.08] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-emerald-100">
                            <FileAudio size={13} />
                            Master livre
                          </span>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Direction active</div>
                        <h1 className="mt-4 max-w-[12ch] text-balance text-[clamp(2.5rem,5vw,4.85rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-white">
                          {directionHeadline}
                        </h1>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        {spotlightStats.map((item) => (
                          <div key={item.label} className="rounded-[1.35rem] border border-white/10 bg-black/18 px-4 py-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">{item.label}</div>
                            <div className="mt-2 text-sm font-medium text-white/82">{summarizeText(item.value, 28)}</div>
                          </div>
                        ))}
                      </div>

                      <div className="rounded-[2rem] border border-white/10 bg-black/22 p-4 sm:p-5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Wave bus</div>
                          <div className="text-[11px] uppercase tracking-[0.18em] text-white/34">
                            {structureSteps.length} scenes
                          </div>
                        </div>

                        <div className="mt-6 flex h-48 items-end gap-2 overflow-hidden rounded-[1.6rem] border border-white/10 bg-black/24 px-4 pb-4">
                          {[16, 28, 44, 60, 54, 74, 52, 86, 62, 72, 46, 68, 58, 80].map((height, index) => (
                            <span
                              key={`${height}-${index}`}
                              className="w-full rounded-full transition-transform duration-300 hover:-translate-y-1"
                              style={{
                                height: `${height}%`,
                                background: index % 3 === 0
                                  ? `linear-gradient(180deg, ${palette.accentStrong}, rgba(255,255,255,0.1))`
                                  : `linear-gradient(180deg, ${palette.accent}, rgba(255,255,255,0.12))`,
                              }}
                            />
                          ))}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {['Lead', 'Choeurs', 'Percu', 'Master'].map((label) => (
                            <div key={label} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid content-start gap-4">
                      <div className="rounded-[1.9rem] border border-white/10 bg-black/18 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Plan</div>
                        <div className="mt-4 space-y-3">
                          {structureSteps.map((item, index) => (
                            <div key={`${item}-${index}`}>
                              <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/46">
                                <span>{item}</span>
                                <span>{String(index + 1).padStart(2, '0')}</span>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${42 + index * 14}%`,
                                    background: `linear-gradient(90deg, ${palette.accent}, ${palette.accentStrong})`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.9rem] border border-white/10 bg-black/18 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Brief</div>
                        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/74">
                          {directionText}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </section>

            <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Sorties</div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-white">Master et assets</div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/56">
                    <FileAudio size={14} />
                    {recentAttachments.length}
                  </div>
                </div>

                {masterAudio ? (
                  <div className="mt-4 rounded-[1.6rem] border border-white/10 bg-black/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-[1rem] bg-white/[0.08]">
                        <FileAudio size={18} style={{ color: palette.accent }} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-white">{masterAudio.name || 'Master audio'}</div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/42">{masterAudio.mimeType || 'audio'}</div>
                      </div>
                    </div>
                    <div className="mt-4 rounded-[1.2rem] border border-white/10 bg-black/16 p-3">
                      <audio controls src={masterAudio.url} className="w-full" />
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.6rem] border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/52">
                    Le prochain rendu apparaitra ici.
                  </div>
                )}

                {recentAttachments.length > 0 && (
                  <div className="mt-4">
                    <AttachmentGallery
                      attachments={recentAttachments}
                      setSelectedImage={setSelectedImage}
                      variant="compact"
                    />
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                      <AudioLines size={13} />
                      Run
                    </div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-white">Etat et journal</div>
                  </div>
                  <div className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] uppercase tracking-[0.18em]', status.tone)}>
                    <Sparkles size={11} />
                    {status.label}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {runStats.map((item) => (
                    <div key={item.label} className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-3">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">{item.label}</div>
                      <div className="mt-2 text-sm font-medium text-white/82">{item.value}</div>
                    </div>
                  ))}
                </div>

                {recentActivity.length > 0 ? (
                  <div className="mt-4 space-y-2.5">
                    {recentActivity.map((item) => (
                      <div key={item.id} className="rounded-[1.25rem] border border-white/10 bg-black/18 px-4 py-3">
                        <div className="text-sm font-medium text-white/82">{item.title || 'Etape'}</div>
                        <div className="mt-1 text-sm leading-6 text-white/54">
                          {summarizeText(item.message || item.resultPreview || item.argsPreview || 'Mise a jour interne du studio.', 110)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-white/10 bg-black/16 px-4 py-4 text-sm leading-6 text-white/52">
                    Le journal de run apparaitra ici.
                  </div>
                )}

                {latestModelMessage?.content?.trim() && (
                  <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-black/18 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/40">Notes</div>
                    <div className="mt-3 max-h-[180px] overflow-y-auto pr-1 whitespace-pre-wrap text-sm leading-6 text-white/72">
                      {latestModelMessage.content}
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};
