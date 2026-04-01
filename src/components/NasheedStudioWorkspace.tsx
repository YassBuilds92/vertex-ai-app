import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AudioLines,
  Disc3,
  FileAudio,
  ImagePlus,
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
    label: 'Pret a composer',
    tone: 'border-white/10 bg-white/[0.04] text-white/74',
  },
  running: {
    label: 'Generation en cours',
    tone: 'border-amber-300/18 bg-amber-300/[0.08] text-amber-100',
  },
  completed: {
    label: 'Dernier rendu pret',
    tone: 'border-emerald-300/18 bg-emerald-300/[0.08] text-emerald-100',
  },
  failed: {
    label: 'Run a revoir',
    tone: 'border-rose-300/18 bg-rose-300/[0.08] text-rose-100',
  },
  aborted: {
    label: 'Run arrete',
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
    .slice(-5)
    .reverse();

  const latestRunMeta = latestModelMessage?.runMeta;
  const directionField = renderableFields.find((field) => field.type === 'textarea') || renderableFields[0];
  const directionValue = directionField ? formValues[directionField.id] : '';
  const controlFields = renderableFields.filter((field) => field.id !== directionField?.id);
  const structureField = findField(renderableFields, /structure|format/i);
  const energyField = findField(renderableFields, /energie|energy|intens|ton/i);
  const engineField = findField(renderableFields, /moteur|lyria|modele|model|engine/i);
  const structureValue = structureField ? formValues[structureField.id] : '';
  const energyValue = energyField ? formValues[energyField.id] : '';
  const engineValue = engineField ? formValues[engineField.id] : 'Lyria 3 Pro preview';

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
          rows={7}
          placeholder={field.placeholder}
          className="min-h-[220px] w-full rounded-[1.6rem] border border-white/10 bg-black/18 px-4 py-4 text-sm leading-7 text-white outline-none placeholder:text-white/24 focus:border-white/20"
        />
      );
    }

    return (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        value={typeof currentValue === 'string' ? currentValue : ''}
        onChange={(event) => onFieldChange(field.id, event.target.value)}
        placeholder={field.placeholder}
        className="w-full rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/24 focus:border-white/20"
      />
    );
  };

  return (
    <div className="studio-shell relative flex h-[100dvh] w-full overflow-hidden bg-[#07030b] text-[#f8f2e8]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_22%_18%,rgba(232,190,116,0.18),transparent_26%),radial-gradient(circle_at_76%_14%,rgba(148,211,255,0.14),transparent_22%),radial-gradient(circle_at_58%_88%,rgba(255,255,255,0.08),transparent_24%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),transparent_20%,transparent_80%,rgba(255,255,255,0.02))]" />
        <div className="absolute left-[18%] top-[22%] h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(231,193,110,0.16),transparent_66%)] blur-3xl" />
        <div className="absolute right-[10%] top-[18%] h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(111,199,255,0.14),transparent_70%)] blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col">
        <header className="border-b border-white/8 px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={onBackToHub}
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/74 transition-colors hover:bg-white/[0.08]"
              >
                <ArrowLeft size={15} />
                Cowork Apps
              </button>

              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-[0.3em] text-white/38">Nasheed Studio</div>
                <div className="mt-1 text-[clamp(1.45rem,2vw,2rem)] font-semibold tracking-[-0.05em] text-white">
                  {agent.name}
                </div>
                <div className="mt-1 max-w-3xl text-sm text-white/54">{agent.tagline}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                'Lyria 3 preview',
                typeof engineValue === 'string' && engineValue.trim() ? engineValue : 'Moteur configure',
                typeof structureValue === 'string' && structureValue.trim() ? structureValue : 'Structure libre',
              ].map((pill) => (
                <span
                  key={pill}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/68"
                >
                  <Sparkles size={12} style={{ color: palette.accent }} />
                  {pill}
                </span>
              ))}
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-[1600px] gap-4 xl:grid-cols-[360px_minmax(0,1fr)_380px]">
            <section className="space-y-4">
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] p-5 shadow-[0_24px_90px_-50px_rgba(0,0,0,0.92)]">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                  <Wand2 size={13} />
                  Direction musicale
                </div>

                {directionField && (
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-white/88">{directionField.label}</label>
                      {directionField.required && (
                        <span
                          className="rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70"
                          style={{ borderColor: palette.rim, background: palette.accentSoft }}
                        >
                          requis
                        </span>
                      )}
                    </div>
                    {renderField(directionField)}
                    {directionField.helpText && (
                      <p className="text-xs leading-5 text-white/42">{directionField.helpText}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] p-5">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                  <Disc3 size={13} />
                  Reglages de scene
                </div>

                <div className="mt-4 space-y-4">
                  {controlFields.map((field) => (
                    <div key={field.id} className="space-y-2">
                      {field.type !== 'boolean' && (
                        <div className="text-sm font-medium text-white/82">{field.label}</div>
                      )}
                      {renderField(field)}
                      {field.helpText && field.type !== 'boolean' && (
                        <p className="text-xs leading-5 text-white/42">{field.helpText}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(232,190,116,0.16),rgba(255,255,255,0.02))] p-5">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/44">
                  <AudioLines size={13} />
                  Lancement
                </div>
                <p className="mt-3 text-sm leading-6 text-white/64">
                  Cette surface pilote toujours le meme runtime Cowork, mais sans retomber dans une conversation generique. Ici, tu sculptes directement le morceau et tu lances le rendu depuis un vrai studio.
                </p>

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
                      Generation du nasheed...
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      Composer maintenant
                    </>
                  )}
                </button>
              </div>
            </section>

            <section className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: 'easeOut' }}
                className="overflow-hidden rounded-[2.4rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.018))] shadow-[0_34px_110px_-60px_rgba(0,0,0,0.9)]"
              >
                <div className="relative overflow-hidden px-5 py-5 sm:px-6 sm:py-6">
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-x-[8%] top-[12%] h-[72%] rounded-[2rem] bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_62%)]" />
                    <div
                      className="absolute left-1/2 top-[14%] h-[22rem] w-[22rem] -translate-x-1/2 rounded-full blur-3xl"
                      style={{ background: `radial-gradient(circle, ${palette.accentSoft}, transparent 72%)` }}
                    />
                  </div>

                  <div className="relative z-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-white/74"
                        style={{ borderColor: palette.rim, background: palette.accentSoft }}
                      >
                        <Disc3 size={13} />
                        Atelier de creation
                      </span>
                      <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.2em]', status.tone)}>
                        <Sparkles size={12} />
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
                      <div>
                        <h1 className="max-w-[11ch] text-balance text-[clamp(2.25rem,5vw,4.4rem)] font-semibold leading-[0.9] tracking-[-0.07em] text-white">
                          Compose un nasheed sans repasser par une chatbox.
                        </h1>
                        <p className="mt-4 max-w-2xl text-sm leading-7 text-white/58 sm:text-[15px]">
                          Cowork orchestre derriere la scene, mais l experience ici reste celle d un vrai studio: direction, moteur, structure, master final et cover dans la meme surface.
                        </p>

                        <div className="mt-6 grid gap-3 sm:grid-cols-3">
                          {[
                            { label: 'Structure', value: typeof structureValue === 'string' && structureValue.trim() ? structureValue : 'Intro + couplet + refrain' },
                            { label: 'Energie', value: typeof energyValue === 'string' && energyValue.trim() ? energyValue : 'Ascendant' },
                            { label: 'Moteur', value: typeof engineValue === 'string' && engineValue.trim() ? engineValue : 'Lyria 3 Pro preview' },
                          ].map((item) => (
                            <div key={item.label} className="rounded-[1.25rem] border border-white/10 bg-black/18 px-4 py-4">
                              <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">{item.label}</div>
                              <div className="mt-2 text-sm font-medium text-white/82">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-[1.8rem] border border-white/10 bg-black/20 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">Wave bus</div>
                        <div className="mt-4 flex h-44 items-end gap-2 overflow-hidden rounded-[1.4rem] border border-white/10 bg-black/24 px-4 pb-4">
                          {[22, 36, 54, 78, 58, 90, 62, 74, 46, 82, 56, 68].map((height, index) => (
                            <span
                              key={`${height}-${index}`}
                              className="w-full rounded-full"
                              style={{
                                height: `${height}%`,
                                background: index % 2 === 0
                                  ? `linear-gradient(180deg, ${palette.accent}, rgba(255,255,255,0.14))`
                                  : `linear-gradient(180deg, ${palette.accentStrong}, rgba(255,255,255,0.12))`,
                              }}
                            />
                          ))}
                        </div>
                        <div className="mt-4 grid grid-cols-2 gap-2">
                          {['Lead', 'Choeurs', 'Texture', 'Master'].map((label) => (
                            <div key={label} className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-[0.58fr_0.42fr]">
                      <div className="rounded-[1.7rem] border border-white/10 bg-black/18 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">Direction active</div>
                        <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-white/76">
                          {typeof directionValue === 'string' && directionValue.trim()
                            ? directionValue
                            : directionField?.placeholder || agent.mission}
                        </div>
                      </div>

                      <div className="rounded-[1.7rem] border border-white/10 bg-black/18 p-4">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">Plan du morceau</div>
                        <div className="mt-4 space-y-3">
                          {['Intro', 'Couplet', 'Refrain', 'Outro'].map((item, index) => (
                            <div key={item}>
                              <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/48">
                                <span>{item}</span>
                                <span>0{index + 1}</span>
                              </div>
                              <div className="mt-2 h-2 rounded-full bg-white/10">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${36 + index * 16}%`,
                                    background: `linear-gradient(90deg, ${palette.accent}, ${palette.accentStrong})`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>

              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                  <Wand2 size={13} />
                  Cowork peut faire evoluer ce studio
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/62">
                  Si tu veux une autre interface, d autres presets ou un comportement plus precis, decris la cible ici. Cowork modifiera cette app sans te renvoyer dans un chat standard.
                </p>
                <div className="mt-4 flex flex-col gap-3">
                  <textarea
                    value={editRequest}
                    onChange={(event) => setEditRequest(event.target.value)}
                    rows={4}
                    placeholder="Ex: ajoute un mode duo vocals, un preset reel nasheed epique, un rendu cover plus solennel, ou un dock d exports plus visible..."
                    className="min-h-[120px] w-full rounded-[1.5rem] border border-white/10 bg-black/18 px-4 py-3 text-sm text-white outline-none placeholder:text-white/24 focus:border-white/20"
                  />
                  <div className="flex justify-end">
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
                        'inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all',
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
              </div>
            </section>

            <section className="space-y-4">
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/40">Sorties recentes</div>
                    <div className="mt-1 text-lg font-semibold tracking-tight text-white">Master, stems et cover</div>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/56">
                    <FileAudio size={14} />
                    {recentAttachments.length} artefact{recentAttachments.length > 1 ? 's' : ''}
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
                  <div className="mt-4 rounded-[1.6rem] border border-dashed border-white/10 bg-black/20 p-5 text-sm leading-6 text-white/54">
                    Le prochain run doit sortir ici un master nasheed avec Lyria, puis eventuellement une cover et des variantes.
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
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                  <Sparkles size={13} />
                  Etat moteur
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: 'Phase', value: latestRunMeta?.phase || (isRunning ? 'generation' : 'attente') },
                    { label: 'Artefact', value: latestRunMeta?.artifactState || 'none' },
                    { label: 'Recherches', value: String(latestRunMeta?.searchCount || 0) },
                    { label: 'Sources', value: String(latestRunMeta?.sourcesOpened || 0) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-[1.2rem] border border-white/10 bg-black/18 px-4 py-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">{item.label}</div>
                      <div className="mt-2 text-sm font-medium text-white/82">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] p-5">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.24em] text-white/40">
                  <ImagePlus size={13} />
                  Journal Cowork
                </div>

                {recentActivity.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {recentActivity.map((item) => (
                      <div key={item.id} className="rounded-[1.25rem] border border-white/10 bg-black/18 px-4 py-3">
                        <div className="text-sm font-medium text-white/82">{item.title || 'Etape'}</div>
                        <div className="mt-1 text-sm leading-6 text-white/56">
                          {item.message || item.resultPreview || item.argsPreview || 'Mise a jour interne du studio.'}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1.25rem] border border-dashed border-white/10 bg-black/16 px-4 py-4 text-sm leading-6 text-white/54">
                    Le journal de generation apparaitra ici sans transformer la surface en conversation. Les sorties textuelles restent visibles comme notes de production.
                  </div>
                )}

                {latestModelMessage?.content?.trim() && (
                  <div className="mt-4 rounded-[1.25rem] border border-white/10 bg-black/18 px-4 py-4">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">Notes de production</div>
                    <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-white/74">
                      {latestModelMessage.content}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
};
