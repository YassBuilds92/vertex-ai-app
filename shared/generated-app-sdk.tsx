import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, PackageOpen, Sparkles, Wand2 } from 'lucide-react';

import type { AgentFieldSchema, AgentFormValues, GeneratedAppManifest, Message } from '../src/types.js';

export interface GeneratedAppComponentProps {
  manifest: GeneratedAppManifest;
  featureDeck?: string[];
  formValues: AgentFormValues;
  isRunning: boolean;
  messages: Message[];
  onFieldChange: (fieldId: string, value: string | boolean) => void;
  onRun: () => Promise<unknown> | void;
  onPublish?: () => Promise<unknown> | void;
  canPublish?: boolean;
  onAskCowork?: (request: string) => Promise<unknown> | void;
}

function collectArtifacts(messages: Message[]) {
  return messages
    .filter((message) => message.role === 'model')
    .flatMap((message) => message.attachments || [])
    .slice()
    .reverse();
}

function fieldInputClassName(accentColor: string) {
  return 'w-full rounded-[1.2rem] border border-white/10 bg-white/[0.045] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/28 focus:bg-white/[0.065]';
}

function renderField(
  field: AgentFieldSchema,
  value: string | boolean | undefined,
  onFieldChange: (fieldId: string, value: string | boolean) => void,
  accentColor: string
) {
  const baseClassName = fieldInputClassName(accentColor);

  if (field.type === 'textarea') {
    return (
      <textarea
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onFieldChange(field.id, event.target.value)}
        placeholder={field.placeholder}
        rows={5}
        className={`${baseClassName} min-h-[130px] resize-y`}
        style={{ boxShadow: `inset 0 0 0 1px ${accentColor}14` }}
      />
    );
  }

  if (field.type === 'select') {
    return (
      <select
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onFieldChange(field.id, event.target.value)}
        className={baseClassName}
        style={{ boxShadow: `inset 0 0 0 1px ${accentColor}14` }}
      >
        <option value="" className="bg-slate-950 text-white/60">
          Choisir une option
        </option>
        {(field.options || []).map((option) => (
          <option key={option} value={option} className="bg-slate-950 text-white">
            {option}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'boolean') {
    const checked = Boolean(value);
    return (
      <button
        type="button"
        onClick={() => onFieldChange(field.id, !checked)}
        className="flex w-full items-center justify-between rounded-[1.2rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-left text-sm text-white transition-all"
        style={{ boxShadow: `inset 0 0 0 1px ${checked ? `${accentColor}30` : 'transparent'}` }}
      >
        <span>{field.label}</span>
        <span className="inline-flex h-6 w-11 items-center rounded-full border border-white/10 bg-black/20 px-1">
          <span
            className={`h-4 w-4 rounded-full transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
            style={{ background: checked ? accentColor : 'rgba(255,255,255,0.5)' }}
          />
        </span>
      </button>
    );
  }

  return (
    <input
      type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
      value={typeof value === 'string' ? value : ''}
      onChange={(event) => onFieldChange(field.id, event.target.value)}
      placeholder={field.placeholder}
      className={baseClassName}
      style={{ boxShadow: `inset 0 0 0 1px ${accentColor}14` }}
    />
  );
}

export function GeneratedAppCanvas({
  manifest,
  featureDeck = [],
  formValues,
  isRunning,
  messages,
  onFieldChange,
  onRun,
  onPublish,
  canPublish,
  onAskCowork,
}: GeneratedAppComponentProps) {
  const [editRequest, setEditRequest] = useState('');
  const accentColor = manifest.visualDirection.accentColor || '#7dd3fc';
  const artifacts = useMemo(() => collectArtifacts(messages), [messages]);
  const manifestFields = Array.isArray(manifest.uiSchema) ? manifest.uiSchema : [];

  return (
    <div className="relative min-h-full overflow-hidden rounded-[2.2rem] border border-white/10 bg-[#060b12] text-white shadow-[0_34px_110px_-54px_rgba(0,0,0,0.92)]">
      <div className="pointer-events-none absolute inset-0">
        <div
          className="absolute inset-0 opacity-80"
          style={{
            background: [
              `radial-gradient(circle at 14% 12%, ${accentColor}22, transparent 24%)`,
              `radial-gradient(circle at 88% 18%, ${accentColor}16, transparent 20%)`,
              'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015))',
            ].join(','),
          }}
        />
        <div className="absolute inset-y-0 left-[54%] w-px bg-[linear-gradient(180deg,transparent,rgba(255,255,255,0.12),transparent)] opacity-70" />
      </div>

      <div className="relative z-10 grid min-h-full gap-0 xl:grid-cols-[1.08fr_0.92fr]">
        <section className="border-b border-white/10 px-5 py-5 xl:border-b-0 xl:border-r">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/34">{manifest.outputKind} expert app</div>
              <h2 className="mt-3 max-w-[12ch] text-balance text-[clamp(2rem,4vw,3.35rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white">
                {manifest.name}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60">{manifest.tagline}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/62">
                {manifest.status}
              </span>
              <span className="rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/84" style={{ borderColor: `${accentColor}44`, background: `${accentColor}18` }}>
                built by cowork
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex flex-col justify-between rounded-[1.8rem] border border-white/10 bg-black/18 p-5">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Direction active</div>
                <p className="mt-3 text-sm leading-7 text-white/68">{manifest.mission}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {featureDeck.map((item) => (
                    <span key={item} className="rounded-full border border-white/10 px-3 py-2 text-xs text-white/70">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
              <div className="mt-8">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Thesis</div>
                <p className="mt-3 text-sm leading-7 text-white/54">{manifest.visualDirection.thesis}</p>
              </div>
            </div>

            <div className="rounded-[1.8rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Atelier</div>
                  <div className="mt-1 text-lg font-semibold tracking-tight text-white">Poste de lancement</div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/18 px-3 py-2 text-xs text-white/60">
                  <CheckCircle2 size={14} style={{ color: accentColor }} />
                  {manifestFields.length} champ(s)
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {manifestFields.map((field) => (
                  <div key={field.id} className={field.type === 'textarea' ? 'space-y-2 md:col-span-2' : 'space-y-2'}>
                    {field.type !== 'boolean' && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-white/86">{field.label}</label>
                        {field.required && (
                          <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/82" style={{ borderColor: `${accentColor}44`, background: `${accentColor}16` }}>
                            requis
                          </span>
                        )}
                      </div>
                    )}
                    {renderField(field, formValues[field.id], onFieldChange, accentColor)}
                    {field.helpText && <p className="text-xs leading-5 text-white/42">{field.helpText}</p>}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-xl text-sm leading-6 text-white/48">
                  {manifest.runtime.emptyStateLabel || 'Le prochain run apparaitra ici avec ses artefacts principaux.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  {onPublish && (
                    <button
                      type="button"
                      onClick={() => void onPublish()}
                      disabled={!canPublish || isRunning}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <PackageOpen size={15} />
                      Publier
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onRun()}
                    disabled={isRunning}
                    className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-black transition-all disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ background: accentColor }}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        Lancement...
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        {manifest.runtime.primaryActionLabel}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="grid min-h-full grid-rows-[auto_1fr_auto] px-5 py-5">
          <div className="rounded-[1.7rem] border border-white/10 bg-black/18 p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">{manifest.runtime.resultLabel}</div>
            <div className="mt-4 space-y-3">
              {artifacts.length > 0 ? (
                artifacts.slice(0, 5).map((artifact) => (
                  <a
                    key={`${artifact.type}-${artifact.url}`}
                    href={artifact.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-3 rounded-[1.15rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/74 transition-colors hover:bg-white/[0.07]"
                  >
                    <span className="min-w-0 truncate">{artifact.name || artifact.type}</span>
                    <span className="shrink-0 text-[11px] uppercase tracking-[0.16em] text-white/42">{artifact.type}</span>
                  </a>
                ))
              ) : (
                <div className="rounded-[1.15rem] border border-dashed border-white/10 bg-white/[0.03] px-4 py-5 text-sm leading-6 text-white/44">
                  {manifest.runtime.emptyStateLabel}
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 rounded-[1.7rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-5">
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Moteur</div>
            <div className="mt-4 grid gap-3">
              <div className="rounded-[1.1rem] border border-white/10 bg-black/18 px-4 py-3 text-sm text-white/70">
                Texte: {manifest.modelProfile.textModel}
              </div>
              {manifest.modelProfile.imageModel && (
                <div className="rounded-[1.1rem] border border-white/10 bg-black/18 px-4 py-3 text-sm text-white/70">
                  Image: {manifest.modelProfile.imageModel}
                </div>
              )}
              {manifest.modelProfile.musicModel && (
                <div className="rounded-[1.1rem] border border-white/10 bg-black/18 px-4 py-3 text-sm text-white/70">
                  Musique: {manifest.modelProfile.musicModel}
                </div>
              )}
              {manifest.modelProfile.ttsModel && (
                <div className="rounded-[1.1rem] border border-white/10 bg-black/18 px-4 py-3 text-sm text-white/70">
                  Voix: {manifest.modelProfile.ttsModel}
                </div>
              )}
            </div>
          </div>

          {onAskCowork && (
            <div className="mt-5 rounded-[1.7rem] border border-cyan-300/10 bg-cyan-300/[0.05] p-5">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-cyan-100/72">
                <Wand2 size={13} />
                Cowork peut faire evoluer cette app
              </div>
              <p className="mt-3 text-sm leading-6 text-white/64">{manifest.runtime.editHint}</p>
              <textarea
                value={editRequest}
                onChange={(event) => setEditRequest(event.target.value)}
                rows={4}
                placeholder="Decris ici l evolution voulue..."
                className="mt-4 min-h-[112px] w-full rounded-[1.3rem] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-white/28"
              />
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={async () => {
                    const cleaned = editRequest.trim();
                    if (!cleaned || isRunning) return;
                    await onAskCowork(cleaned);
                    setEditRequest('');
                  }}
                  disabled={isRunning || !editRequest.trim()}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition-all disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Envoyer a Cowork
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
