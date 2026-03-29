import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Code2,
  FileText,
  Loader2,
  Play,
  Radio,
  Search,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AgentFieldSchema, StudioAgent } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const suggestions = [
  "Cree un agent qui fait un PDF premium sur l'actu du jour.",
  "Cree un agent qui transforme une actu en mini-site HTML.",
  "Cree un agent podcast qui livre un master final bien mixe avec cover.",
];

const outputMeta = {
  pdf: { label: 'PDF', icon: FileText, accent: 'text-rose-300', bg: 'bg-rose-500/10' },
  html: { label: 'HTML', icon: Code2, accent: 'text-cyan-300', bg: 'bg-cyan-500/10' },
  podcast: { label: 'Podcast', icon: Radio, accent: 'text-amber-300', bg: 'bg-amber-500/10' },
  code: { label: 'Code', icon: Code2, accent: 'text-emerald-300', bg: 'bg-emerald-500/10' },
  research: { label: 'Research', icon: Search, accent: 'text-indigo-300', bg: 'bg-indigo-500/10' },
  automation: { label: 'Automation', icon: BrainCircuit, accent: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10' },
} as const;

const formatRelativeDate = (timestamp: number) => {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(timestamp));
  } catch {
    return '';
  }
};

const buildFallbackField = (agent: StudioAgent): AgentFieldSchema => ({
  id: 'missionBrief',
  label: 'Brief libre',
  type: 'textarea',
  required: true,
  placeholder: agent.starterPrompt,
  helpText: 'Ajoute ici le contexte de mission a transmettre a Cowork.',
});

const getRenderableFields = (agent: StudioAgent | null): AgentFieldSchema[] => {
  if (!agent) return [];
  return agent.uiSchema.length > 0 ? agent.uiSchema : [buildFallbackField(agent)];
};

const createInitialFieldValues = (fields: AgentFieldSchema[]) =>
  Object.fromEntries(
    fields.map((field) => [field.id, field.type === 'boolean' ? false : ''])
  ) as Record<string, string | boolean>;

interface AgentsHubProps {
  isOpen: boolean;
  agents: StudioAgent[];
  isCreating: boolean;
  isRunningAgent: boolean;
  latestCreatedAgent?: StudioAgent | null;
  warningMessage?: string | null;
  onClose: () => void;
  onCreateAgent: (brief: string) => Promise<unknown> | void;
  onRunAgent: (agent: StudioAgent, values: Record<string, string | boolean>) => Promise<unknown> | void;
}

export const AgentsHub: React.FC<AgentsHubProps> = ({
  isOpen,
  agents,
  isCreating,
  isRunningAgent,
  latestCreatedAgent,
  warningMessage,
  onClose,
  onCreateAgent,
  onRunAgent,
}) => {
  const [brief, setBrief] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [validationMessage, setValidationMessage] = useState<string | null>(null);

  useEffect(() => {
    if (latestCreatedAgent?.id) {
      setSelectedId(latestCreatedAgent.id);
    }
  }, [latestCreatedAgent]);

  useEffect(() => {
    if (!selectedId && agents[0]?.id) {
      setSelectedId(agents[0].id);
    }
  }, [agents, selectedId]);

  const selectedAgent = useMemo(
    () => agents.find(agent => agent.id === selectedId) || agents[0] || null,
    [agents, selectedId]
  );

  const renderableFields = useMemo(
    () => getRenderableFields(selectedAgent),
    [selectedAgent]
  );

  useEffect(() => {
    setFormValues(createInitialFieldValues(renderableFields));
    setValidationMessage(null);
  }, [renderableFields, selectedAgent?.id]);

  const submit = async () => {
    const cleaned = brief.trim();
    if (!cleaned || isCreating) return;
    await onCreateAgent(cleaned);
    setBrief('');
  };

  const updateFieldValue = (fieldId: string, value: string | boolean) => {
    setFormValues(prev => ({ ...prev, [fieldId]: value }));
  };

  const runSelectedAgent = async () => {
    if (!selectedAgent || isRunningAgent) return;

    const missingField = renderableFields.find((field) => {
      if (!field.required) return false;
      if (field.type === 'boolean') return false;
      const value = formValues[field.id];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missingField) {
      setValidationMessage(`Renseigne "${missingField.label}" avant de lancer l'agent.`);
      return;
    }

    setValidationMessage(null);
    await onRunAgent(selectedAgent, formValues);
  };

  const renderField = (field: AgentFieldSchema) => {
    const baseInputClassName =
      'w-full rounded-[1.2rem] border border-white/10 bg-white/[0.035] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/30 focus:border-cyan-300/35 focus:bg-white/[0.055]';

    const currentValue = formValues[field.id];

    if (field.type === 'textarea') {
      return (
        <textarea
          value={typeof currentValue === 'string' ? currentValue : ''}
          onChange={(event) => updateFieldValue(field.id, event.target.value)}
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
          onChange={(event) => updateFieldValue(field.id, event.target.value)}
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
          onClick={() => updateFieldValue(field.id, !checked)}
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
        onChange={(event) => updateFieldValue(field.id, event.target.value)}
        placeholder={field.placeholder}
        className={baseInputClassName}
      />
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          transition={{ duration: 0.28 }}
          className="absolute inset-0 z-50 bg-[var(--app-bg)]/96 backdrop-blur-3xl"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,255,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.12),_transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%)]" />

          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/6 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Bot size={18} className="text-cyan-300" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Hub Agents</div>
                  <div className="text-xl font-semibold tracking-tight text-white">Cowork cree les specialistes, toi tu les utilises ici</div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-white/60 transition-colors hover:text-white"
                title="Fermer le hub"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 overflow-hidden xl:grid-cols-[1.02fr_0.98fr]">
              <div className="overflow-y-auto border-b border-white/6 xl:border-b-0 xl:border-r">
                <section className="px-6 pb-8 pt-8">
                  <div className="max-w-3xl">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                      <Sparkles size={12} />
                      Delegation native Cowork
                    </div>
                    <h2 className="max-w-2xl text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl">
                      Un hub vivant pour creer un agent, puis l'utiliser comme vrai produit.
                    </h2>
                    <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/62">
                      Cowork fabrique le prompt, les outils et l'interface. Ensuite, c'est toi qui ouvres l'agent, qui l'utilises, puis qui demandes a Cowork de l'ameliorer si besoin.
                    </p>
                  </div>

                  <div className="mt-8 rounded-[2rem] border border-white/8 bg-black/20 p-4 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.8)]">
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/42">
                      <Wand2 size={12} />
                      Forge un agent
                    </div>
                    <div className="mt-4 flex flex-col gap-3">
                      <textarea
                        value={brief}
                        onChange={(event) => setBrief(event.target.value)}
                        placeholder="Ex: cree un agent podcast actu qui fait la veille, ecrit le script, genere un master final bien mixe et une cover"
                        className="min-h-[132px] w-full rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-5 py-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/35"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setBrief(suggestion)}
                            className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-[12px] text-white/65 transition-colors hover:text-white"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <p className="max-w-xl text-sm leading-6 text-white/45">
                          Le blueprint genere le prompt systeme, les outils, une premiere UI, puis le meme agent peut etre relance ensuite comme sous-mission reelle.
                        </p>
                        <button
                          onClick={submit}
                          disabled={isCreating || !brief.trim()}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all',
                            isCreating || !brief.trim()
                              ? 'cursor-not-allowed bg-white/8 text-white/35'
                              : 'bg-white text-black hover:translate-y-[-1px]'
                          )}
                        >
                          {isCreating ? 'Creation...' : 'Creer cet agent'}
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {warningMessage && (
                    <div className="mt-5 rounded-[1.6rem] border border-amber-300/12 bg-amber-300/[0.07] px-4 py-4 text-sm text-amber-50/88">
                      <div className="flex items-start gap-3">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-200" />
                        <div>
                          <div className="text-[11px] uppercase tracking-[0.2em] text-amber-100/60">Synchro cloud indisponible</div>
                          <p className="mt-2 leading-6">{warningMessage}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </section>

                <section className="border-t border-white/6 px-6 py-6">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">Agents disponibles</div>
                      <div className="mt-1 text-sm text-white/55">{agents.length} specialiste(s) dans le hub</div>
                    </div>
                  </div>

                  {agents.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-white/10 px-6 py-10 text-center text-white/45">
                      Le hub est vide pour l'instant. Cree un premier agent depuis Cowork ou depuis le champ ci-dessus.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {agents.map((agent) => {
                        const meta = outputMeta[agent.outputKind];
                        const Icon = meta.icon;
                        const isActive = selectedAgent?.id === agent.id;

                        return (
                          <button
                            key={agent.id}
                            onClick={() => setSelectedId(agent.id)}
                            className={cn(
                              'w-full rounded-[1.6rem] border px-4 py-4 text-left transition-all',
                              isActive
                                ? 'border-white/14 bg-white/[0.06]'
                                : 'border-white/6 bg-white/[0.025] hover:bg-white/[0.045]'
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-2xl', meta.bg)}>
                                    <Icon size={16} className={meta.accent} />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="truncate text-[16px] font-semibold tracking-tight text-white">{agent.name}</div>
                                    <div className="truncate text-sm text-white/48">{agent.tagline}</div>
                                  </div>
                                </div>
                                <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/58">{agent.summary}</p>
                              </div>
                              <div className="shrink-0 text-right text-[11px] uppercase tracking-[0.18em] text-white/32">
                                <div>{meta.label}</div>
                                <div className="mt-2 normal-case tracking-normal text-white/32">{formatRelativeDate(agent.updatedAt)}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>

              <div className="overflow-y-auto px-6 py-8">
                {selectedAgent ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedAgent.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.22 }}
                      className="mx-auto max-w-2xl"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', outputMeta[selectedAgent.outputKind].bg)}>
                            {React.createElement(outputMeta[selectedAgent.outputKind].icon, {
                              size: 18,
                              className: outputMeta[selectedAgent.outputKind].accent,
                            })}
                          </div>
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">{outputMeta[selectedAgent.outputKind].label}</div>
                            <div className="text-3xl font-semibold tracking-tight text-white">{selectedAgent.name}</div>
                          </div>
                        </div>

                        <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/48">
                          Mis a jour {formatRelativeDate(selectedAgent.updatedAt)}
                        </div>
                      </div>

                      <p className="mt-5 max-w-2xl text-[16px] leading-7 text-white/65">{selectedAgent.mission}</p>

                      <div className="mt-8 grid gap-4 md:grid-cols-3">
                        <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.025] p-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Quand l'utiliser</div>
                          <p className="mt-3 text-sm leading-6 text-white/62">{selectedAgent.whenToUse}</p>
                        </div>
                        <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.025] p-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Sortie cible</div>
                          <p className="mt-3 text-sm leading-6 text-white/62">
                            Ce specialiste pousse une sortie de type {outputMeta[selectedAgent.outputKind].label.toLowerCase()}.
                          </p>
                        </div>
                        <div className="rounded-[1.6rem] border border-cyan-300/14 bg-cyan-300/[0.04] p-4">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">Delegation</div>
                          <p className="mt-3 text-sm leading-6 text-white/68">
                            Le formulaire ci-dessous construit la mission de relance que Cowork enverra a cet agent existant.
                          </p>
                        </div>
                      </div>

                      <div className="mt-8 overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]">
                        <div className="flex items-center justify-between gap-4 border-b border-white/8 px-5 py-4">
                          <div>
                            <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Poste de lancement</div>
                            <div className="mt-1 text-lg font-semibold tracking-tight text-white">Interface de mission</div>
                          </div>
                          <div className="inline-flex items-center gap-2 rounded-full border border-white/8 bg-black/20 px-3 py-2 text-xs text-white/55">
                            <CheckCircle2 size={14} className="text-cyan-200" />
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

                          {validationMessage && (
                            <div className="mt-4 rounded-[1.2rem] border border-amber-300/14 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-50/88">
                              {validationMessage}
                            </div>
                          )}

                          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/8 pt-5">
                            <div className="max-w-xl text-sm leading-6 text-white/48">
                              Ouvre cet agent dans son propre workspace avec son prompt, ses tools et les parametres saisis ici. Cowork sert ensuite a le faire evoluer si tu veux le corriger.
                            </div>
                            <button
                              onClick={runSelectedAgent}
                              disabled={isRunningAgent}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all',
                                isRunningAgent
                                  ? 'cursor-not-allowed bg-white/8 text-white/35'
                                  : 'bg-white text-black hover:translate-y-[-1px]'
                              )}
                            >
                              {isRunningAgent ? (
                                <>
                                  <Loader2 size={15} className="animate-spin" />
                                  Relance en cours
                                </>
                              ) : (
                                <>
                                  <Play size={15} />
                                  Ouvrir l'agent
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="mt-8 grid gap-6 lg:grid-cols-2">
                        <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.025] p-5">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Starter prompt</div>
                          <p className="mt-3 text-sm leading-7 text-white/68">{selectedAgent.starterPrompt}</p>
                        </div>
                        <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.025] p-5">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Outils preferes</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {selectedAgent.tools.length > 0 ? (
                              selectedAgent.tools.map((tool) => (
                                <span key={tool} className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-white/62">
                                  {tool}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-white/42">Aucun outil specifique declare.</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-6 rounded-[1.8rem] border border-white/8 bg-white/[0.025] p-5">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Capacites</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedAgent.capabilities.length > 0 ? (
                            selectedAgent.capabilities.map((capability) => (
                              <span key={capability} className="rounded-full border border-white/8 px-3 py-2 text-sm text-white/72">
                                {capability}
                              </span>
                            ))
                          ) : (
                            <span className="text-sm text-white/42">Aucune capacite detaillee pour l'instant.</span>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-white/40">
                    Selectionne un agent pour voir son interface et le relancer.
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
