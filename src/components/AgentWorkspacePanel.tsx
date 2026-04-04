import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Play,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { AgentFieldSchema, AgentFormValues, StudioAgent } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  AgentAppPreview,
  getAgentAppMeta,
  getAgentPalette,
  getRenderableFields,
} from './AgentAppPreview';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface AgentWorkspacePanelProps {
  agent: StudioAgent;
  formValues: AgentFormValues;
  isRunning: boolean;
  onFieldChange: (fieldId: string, value: string | boolean) => void;
  onRunAgent: () => Promise<unknown> | void;
  onAskCowork: (request: string) => Promise<unknown> | void;
}

export const AgentWorkspacePanel: React.FC<AgentWorkspacePanelProps> = ({
  agent,
  formValues,
  isRunning,
  onFieldChange,
  onRunAgent,
  onAskCowork,
}) => {
  const [editRequest, setEditRequest] = useState('');
  const capabilities = Array.isArray(agent.capabilities) ? agent.capabilities : [];
  const tools = Array.isArray(agent.tools) ? agent.tools : [];

  const renderableFields = useMemo(
    () => getRenderableFields(agent),
    [agent]
  );
  const meta = getAgentAppMeta(agent);
  const palette = getAgentPalette(agent);

  useEffect(() => {
    setEditRequest('');
  }, [agent.id]);

  const renderField = (field: AgentFieldSchema) => {
    const baseInputClassName =
      'w-full rounded-lg border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-indigo-300/35 focus:bg-white/[0.055]';

    const currentValue = formValues[field.id];

    if (field.type === 'textarea') {
      return (
        <textarea
          value={typeof currentValue === 'string' ? currentValue : ''}
          onChange={(event) => onFieldChange(field.id, event.target.value)}
          placeholder={field.placeholder}
          rows={5}
          className={cn(baseInputClassName, 'min-h-[140px] resize-y')}
        />
      );
    }

    if (field.type === 'select') {
      return (
        <select
          value={typeof currentValue === 'string' ? currentValue : ''}
          onChange={(event) => onFieldChange(field.id, event.target.value)}
          className={baseInputClassName}
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
      const checked = Boolean(currentValue);
      return (
        <button
          type="button"
          onClick={() => onFieldChange(field.id, !checked)}
          className={cn(
            'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-all',
            checked
              ? 'border-indigo-300/30 bg-indigo-300/[0.08] text-white'
              : 'border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.045]'
          )}
        >
          <span className="text-sm">{field.label}</span>
          <span
            className={cn(
              'inline-flex h-6 w-11 items-center rounded-full border px-1 transition-all',
              checked ? 'border-indigo-200/30 bg-indigo-200/20' : 'border-white/10 bg-black/20'
            )}
          >
            <span
              className={cn(
                'h-4 w-4 rounded-full transition-transform',
                checked ? 'translate-x-5 bg-indigo-200' : 'translate-x-0 bg-white/55'
              )}
            />
          </span>
        </button>
      );
    }

    return (
      <input
        type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'}
        value={typeof currentValue === 'string' ? currentValue : ''}
        onChange={(event) => onFieldChange(field.id, event.target.value)}
        placeholder={field.placeholder}
        className={baseInputClassName}
      />
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pt-6 sm:px-6 lg:px-10">
      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.78)]">
          <div className="border-b border-white/8 px-5 py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">App Cowork</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{agent.name}</div>
                <div className="mt-2 text-sm text-white/48">{agent.tagline}</div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/78"
                  style={{ borderColor: palette.rim, background: palette.accentSoft }}
                >
                  {meta.label}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs uppercase tracking-[0.18em] text-white/56">
                  {agent.createdBy === 'cowork' ? 'built by cowork' : 'manual'}
                </span>
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/64">{agent.mission}</p>
          </div>

          <div className="px-5 py-5">
            <AgentAppPreview agent={agent} size="workspace" />

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Quand l'utiliser</div>
                <p className="mt-3 text-sm leading-6 text-white/66">{agent.whenToUse}</p>
              </div>
              <div className="rounded-xl border border-white/8 bg-white/[0.025] p-4">
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Starter prompt</div>
                <p className="mt-3 text-sm leading-6 text-white/66">{agent.starterPrompt}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {capabilities.map((capability) => (
                <span key={capability} className="rounded-full border border-white/8 px-3 py-2 text-sm text-white/72">
                  {capability}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="overflow-hidden rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]">
            <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">{meta.studioLabel}</div>
                <div className="mt-1 text-lg font-semibold tracking-tight text-white">Poste de lancement</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-3 py-2 text-xs text-white/55">
                <CheckCircle2 size={14} className="text-indigo-200" />
                {renderableFields.length} champ(s)
              </div>
            </div>

            <div className="px-5 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                {renderableFields.map((field) => (
                  <div
                    key={field.id}
                    className={cn(
                      'space-y-2',
                      field.type === 'textarea' ? 'md:col-span-2' : ''
                    )}
                  >
                    {field.type !== 'boolean' && (
                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-white/88">{field.label}</label>
                        {field.required && (
                          <span
                            className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/78"
                            style={{ borderColor: palette.rim, background: palette.accentSoft }}
                          >
                            requis
                          </span>
                        )}
                      </div>
                    )}
                    {renderField(field)}
                    {field.helpText && (
                      <p className="text-xs leading-5 text-white/42">{field.helpText}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-6 flex flex-col items-stretch gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-xl text-sm leading-6 text-white/48">
                  Cette app tourne dans son propre studio. Cowork sert ensuite a l'ameliorer, pas a la remplacer par une surface generique.
                </div>
                <button
                  onClick={() => onRunAgent()}
                  disabled={isRunning}
                  className={cn(
                    'inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all sm:w-auto',
                    isRunning
                      ? 'cursor-not-allowed bg-white/8 text-white/35'
                      : 'bg-white text-black hover:translate-y-[-1px]'
                  )}
                >
                  {isRunning ? (
                    <>
                      <Sparkles size={15} className="animate-pulse" />
                      Lancement...
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      {meta.actionLabel}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/42">
              <Wand2 size={13} />
              Outils et surface
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {tools.length > 0 ? (
                tools.map((tool) => (
                  <span key={tool} className="rounded-full border border-white/8 bg-black/18 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/62">
                    {tool}
                  </span>
                ))
              ) : (
                <span className="text-sm text-white/48">Aucun outil specialise declare.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-indigo-300/10 bg-indigo-300/[0.045]">
        <div className="flex items-center gap-2 border-b border-indigo-300/10 px-5 py-4 text-[11px] uppercase tracking-[0.2em] text-indigo-100/70">
          <BrainCircuit size={13} />
          Cowork peut faire evoluer cette app
        </div>
        <div className="px-5 py-5">
          <p className="max-w-3xl text-sm leading-6 text-white/66">
            Si quelque chose te deplait dans l'app, son prompt, ses outils ou son interface, demande-le ici. Cowork ouvrira une vraie session d'edition pour modifier cette app existante dans le store.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <textarea
              value={editRequest}
              onChange={(event) => setEditRequest(event.target.value)}
              placeholder="Ex: rends cette app plus editoriale, ajoute un champ angle, change le rendu podcast, simplifie l'interface..."
              rows={4}
              className="min-h-[112px] w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-indigo-300/35 focus:bg-white/[0.055]"
            />
            <div className="flex justify-end">
              <button
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
                    ? 'cursor-not-allowed bg-white/8 text-white/35'
                    : 'border border-white/12 bg-white/[0.05] text-white hover:bg-white/[0.08]'
                )}
              >
                Envoyer a Cowork
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
