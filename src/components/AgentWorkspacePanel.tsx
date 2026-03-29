import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Code2,
  FileText,
  Play,
  Radio,
  Search,
  Sparkles,
} from 'lucide-react';
import { AgentFieldSchema, AgentFormValues, StudioAgent } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const outputMeta = {
  pdf: { label: 'PDF', icon: FileText, accent: 'text-rose-300', bg: 'bg-rose-500/10' },
  html: { label: 'HTML', icon: Code2, accent: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  podcast: { label: 'Podcast', icon: Radio, accent: 'text-amber-300', bg: 'bg-amber-500/10' },
  code: { label: 'Code', icon: Code2, accent: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  research: { label: 'Research', icon: Search, accent: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  automation: { label: 'Automation', icon: BrainCircuit, accent: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10' },
} as const;

const buildFallbackField = (agent: StudioAgent): AgentFieldSchema => ({
  id: 'missionBrief',
  label: 'Brief libre',
  type: 'textarea',
  required: true,
  placeholder: agent.starterPrompt,
  helpText: "Ajoute ici le contexte de mission a transmettre a l'agent.",
});

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

  const renderableFields = useMemo(
    () => (agent.uiSchema.length > 0 ? agent.uiSchema : [buildFallbackField(agent)]),
    [agent]
  );

  useEffect(() => {
    setEditRequest('');
  }, [agent.id]);

  const renderField = (field: AgentFieldSchema) => {
    const baseInputClassName =
      'w-full rounded-[1.2rem] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-cyan-300/35 focus:bg-white/[0.055]';

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
            'flex w-full items-center justify-between rounded-[1.2rem] border px-4 py-3 text-left transition-all',
            checked
              ? 'border-cyan-300/30 bg-cyan-300/[0.08] text-white'
              : 'border-white/10 bg-white/[0.03] text-white/72 hover:bg-white/[0.045]'
          )}
        >
          <span className="text-sm">{field.label}</span>
          <span
            className={cn(
              'inline-flex h-6 w-11 items-center rounded-full border px-1 transition-all',
              checked ? 'border-cyan-200/30 bg-cyan-200/20' : 'border-white/10 bg-black/20'
            )}
          >
            <span
              className={cn(
                'h-4 w-4 rounded-full transition-transform',
                checked ? 'translate-x-5 bg-cyan-200' : 'translate-x-0 bg-white/55'
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
    <div className="mx-auto w-full max-w-5xl px-4 pt-6 sm:px-6 lg:px-10">
      <div className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))] shadow-[0_24px_80px_-40px_rgba(0,0,0,0.78)]">
        <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="border-b border-white/8 px-5 py-5 xl:border-b-0 xl:border-r">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', outputMeta[agent.outputKind].bg)}>
                  {React.createElement(outputMeta[agent.outputKind].icon, {
                    size: 18,
                    className: outputMeta[agent.outputKind].accent,
                  })}
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Workspace agent</div>
                  <div className="text-3xl font-semibold tracking-tight text-white">{agent.name}</div>
                  <div className="mt-1 text-sm text-white/48">{agent.tagline}</div>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/16 bg-cyan-300/[0.06] px-3 py-2 text-xs uppercase tracking-[0.18em] text-cyan-100/75">
                <Bot size={14} />
                {outputMeta[agent.outputKind].label}
              </div>
            </div>

            <p className="mt-5 max-w-2xl text-[15px] leading-7 text-white/64">{agent.mission}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              {agent.capabilities.map((capability) => (
                <span key={capability} className="rounded-full border border-white/8 px-3 py-2 text-sm text-white/72">
                  {capability}
                </span>
              ))}
            </div>

            <div className="mt-6 rounded-[1.4rem] border border-white/8 bg-white/[0.025] p-4">
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Starter prompt</div>
              <p className="mt-3 text-sm leading-6 text-white/66">{agent.starterPrompt}</p>
            </div>
          </div>

          <div className="px-5 py-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Interface de mission</div>
                <div className="mt-1 text-lg font-semibold tracking-tight text-white">Tu utilises cet agent directement ici</div>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-3 py-2 text-xs text-white/55">
                <CheckCircle2 size={14} className="text-cyan-200" />
                {renderableFields.length} champ(s)
              </div>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
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
                        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-cyan-100/70">
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

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-5">
              <div className="max-w-xl text-sm leading-6 text-white/48">
                Ici, l'utilisateur parle directement a l'agent. Cowork sert ensuite uniquement a faire evoluer cet agent si tu veux le corriger.
              </div>
              <button
                onClick={() => onRunAgent()}
                disabled={isRunning}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all',
                  isRunning
                    ? 'cursor-not-allowed bg-white/8 text-white/35'
                    : 'bg-white text-black hover:translate-y-[-1px]'
                )}
              >
                {isRunning ? (
                  <>
                    <Sparkles size={15} className="animate-pulse" />
                    Agent en cours
                  </>
                ) : (
                  <>
                    <Play size={15} />
                    Relancer l'agent
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-[1.8rem] border border-cyan-300/10 bg-cyan-300/[0.045]">
        <div className="flex items-center gap-2 border-b border-cyan-300/10 px-5 py-4 text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">
          <BrainCircuit size={13} />
          Cowork peut ameliorer cet agent
        </div>
        <div className="px-5 py-5">
          <p className="max-w-3xl text-sm leading-6 text-white/66">
            Si quelque chose te deplait dans l'agent, son prompt, ses outils ou son interface, demande-le ici. Cowork ouvrira une vraie session d'edition pour modifier cet agent existant dans le Hub.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            <textarea
              value={editRequest}
              onChange={(event) => setEditRequest(event.target.value)}
              placeholder="Ex: ajoute un champ type Pokemon, rends le prompt plus creatif, retire la recherche web, ajoute un mode illustration..."
              rows={4}
              className="min-h-[112px] w-full rounded-[1.4rem] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-cyan-300/35 focus:bg-white/[0.055]"
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
