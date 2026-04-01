import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  LayoutTemplate,
  Loader2,
  Play,
  Sparkles,
  Wand2,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { AgentFieldSchema, StudioAgent } from '../types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  AgentAppPreview,
  createInitialFieldValues,
  getAgentAppMeta,
  getAgentPalette,
  getRenderableFields,
} from './AgentAppPreview';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const suggestions = [
  "Cree une app Cowork qui transforme l'actu du jour en PDF premium source.",
  "Cree une app Cowork qui transforme une veille en mini-site avec vraie direction artistique.",
  "Cree une app Cowork podcast qui ecrit, mixe et livre un master final avec cover.",
];

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
    () => agents.find((agent) => agent.id === selectedId) || agents[0] || null,
    [agents, selectedId]
  );

  const featuredAgents = useMemo(
    () => agents.filter((agent) => agent.createdBy === 'cowork').slice(0, 3),
    [agents]
  );

  const coworkCount = useMemo(
    () => agents.filter((agent) => agent.createdBy === 'cowork').length,
    [agents]
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
    setFormValues((prev) => ({ ...prev, [fieldId]: value }));
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
      setValidationMessage(`Renseigne "${missingField.label}" avant d'ouvrir cette app.`);
      return;
    }

    setValidationMessage(null);
    await onRunAgent(selectedAgent, formValues);
  };

  const selectedMeta = selectedAgent ? getAgentAppMeta(selectedAgent) : null;
  const selectedPalette = selectedAgent ? getAgentPalette(selectedAgent) : null;

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
          className="absolute inset-0 z-50 overflow-y-auto bg-[var(--app-bg)]/96 backdrop-blur-3xl"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,255,0.14),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(245,158,11,0.12),_transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%)]" />

          <div className="relative flex min-h-full flex-col">
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/6 bg-[var(--app-bg)]/72 px-6 py-5 backdrop-blur-2xl">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <LayoutTemplate size={18} className="text-cyan-300" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Cowork Apps</div>
                  <div className="text-xl font-semibold tracking-tight text-white">Un app store interne pour les apps que Cowork construit lui-meme</div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="rounded-2xl border border-white/8 bg-white/[0.03] p-3 text-white/60 transition-colors hover:text-white"
                title="Fermer le store"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid flex-1 grid-cols-1 gap-6 px-6 pb-6 pt-6 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-6">
                <section className="overflow-hidden rounded-[2.4rem] border border-white/8 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]">
                  <div className="grid gap-6 px-6 py-6 lg:grid-cols-[1.1fr_0.9fr]">
                    <div className="max-w-3xl">
                      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                        <Sparkles size={12} />
                        App store Cowork
                      </div>
                      <h2 className="max-w-2xl text-balance text-4xl font-semibold leading-[0.95] tracking-[-0.05em] text-white sm:text-5xl">
                        Des apps construites par Cowork, chacune avec sa propre logique et sa propre scene.
                      </h2>
                      <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/62">
                        Ici on ne stocke pas juste des prompts. Cowork fabrique des mini-produits utilisables: leur promesse, leur interface, leur type de sortie et leur poste de lancement.
                      </p>

                      <div className="mt-6 flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/74">
                          <span className="text-xl font-semibold tracking-tight text-white">{agents.length}</span>
                          app{agents.length > 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/74">
                          <span className="text-xl font-semibold tracking-tight text-white">{coworkCount}</span>
                          creee{coworkCount > 1 ? 's' : ''} par Cowork
                        </span>
                        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-sm text-white/74">
                          <span className="text-xl font-semibold tracking-tight text-white">6</span>
                          familles d'experience
                        </span>
                      </div>

                      <div className="mt-7 flex flex-wrap items-center gap-3">
                        {suggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            onClick={() => setBrief(suggestion)}
                            className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[12px] text-white/65 transition-colors hover:text-white"
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[2rem] border border-white/8 bg-black/20 p-4 shadow-[0_30px_80px_-35px_rgba(0,0,0,0.8)]">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-white/42">
                        <Wand2 size={12} />
                        Forger une nouvelle app
                      </div>
                      <div className="mt-4 flex flex-col gap-3">
                        <textarea
                          value={brief}
                          onChange={(event) => setBrief(event.target.value)}
                          placeholder="Ex: cree une app Cowork qui analyse des startups, score les dossiers et livre un memo PDF actionnable"
                          className="min-h-[148px] w-full rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-5 py-4 text-[15px] text-white outline-none transition-colors placeholder:text-white/28 focus:border-cyan-300/35"
                        />
                        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <p className="max-w-xl text-sm leading-6 text-white/45">
                            Cowork doit sortir ici une app claire, pas un specialiste abstrait: promesse produit, interface utile et comportement distinct.
                          </p>
                          <button
                            onClick={submit}
                            disabled={isCreating || !brief.trim()}
                            className={cn(
                              'inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all sm:w-auto',
                              isCreating || !brief.trim()
                                ? 'cursor-not-allowed bg-white/8 text-white/35'
                                : 'bg-white text-black hover:translate-y-[-1px]'
                            )}
                          >
                            {isCreating ? 'Creation...' : 'Creer cette app'}
                            <ArrowRight size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {warningMessage && (
                  <div className="rounded-[1.8rem] border border-amber-300/12 bg-amber-300/[0.07] px-4 py-4 text-sm text-amber-50/88">
                    <div className="flex items-start gap-3">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-200" />
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-amber-100/60">Synchro cloud indisponible</div>
                        <p className="mt-2 leading-6">{warningMessage}</p>
                      </div>
                    </div>
                  </div>
                )}

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">Vitrine Cowork</div>
                      <div className="mt-1 text-sm text-white/55">Les apps recentes construites par Cowork remontent ici en premier.</div>
                    </div>
                  </div>

                  {featuredAgents.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-white/10 px-6 py-10 text-center text-white/45">
                      Aucune app Cowork mise en avant pour le moment. Lance une creation depuis le module ci-dessus.
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-3">
                      {featuredAgents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => setSelectedId(agent.id)}
                          className={cn(
                            'group text-left transition-transform hover:-translate-y-[2px]',
                            selectedAgent?.id === agent.id ? 'ring-1 ring-cyan-300/26' : ''
                          )}
                        >
                          <AgentAppPreview agent={agent} size="feature" />
                        </button>
                      ))}
                    </div>
                  )}
                </section>

                <section className="space-y-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.22em] text-white/42">Catalogue</div>
                      <div className="mt-1 text-sm text-white/55">{agents.length} app(s) dans le store interne</div>
                    </div>
                    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs uppercase tracking-[0.18em] text-white/42">
                      apps utilisables
                    </div>
                  </div>

                  {agents.length === 0 ? (
                    <div className="rounded-[2rem] border border-dashed border-white/10 px-6 py-10 text-center text-white/45">
                      Le store est vide pour l'instant. Cree une premiere app Cowork depuis le brief ci-dessus.
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                      {agents.map((agent) => (
                        <button
                          key={agent.id}
                          onClick={() => setSelectedId(agent.id)}
                          className={cn(
                            'group text-left transition-transform hover:-translate-y-[2px]',
                            selectedAgent?.id === agent.id ? 'ring-1 ring-cyan-300/24' : ''
                          )}
                        >
                          <AgentAppPreview agent={agent} />
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              <div className="space-y-6 xl:sticky xl:top-[6.5rem] xl:self-start">
                {selectedAgent ? (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedAgent.id}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -12 }}
                      transition={{ duration: 0.22 }}
                      className="space-y-5"
                    >
                      <div className="overflow-hidden rounded-[2.1rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]">
                        <div className="border-b border-white/8 px-5 py-5">
                          <div className="flex items-center justify-between gap-4">
                            <div>
                              <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">{selectedMeta?.label}</div>
                              <div className="mt-1 text-3xl font-semibold tracking-tight text-white">{selectedAgent.name}</div>
                              <div className="mt-2 text-sm text-white/50">{selectedAgent.tagline}</div>
                            </div>
                            <div className="rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-[0.18em] text-white/48">
                              Mis a jour {formatRelativeDate(selectedAgent.updatedAt)}
                            </div>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2">
                            <span
                              className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/78"
                              style={{
                                borderColor: selectedPalette?.rim,
                                background: selectedPalette?.accentSoft,
                              }}
                            >
                              {selectedAgent.createdBy === 'cowork' ? 'Creee par Cowork' : 'Ajoutee manuellement'}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/54">
                              {selectedMeta?.category}
                            </span>
                            <span className="inline-flex items-center rounded-full border border-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/54">
                              {selectedMeta?.studioLabel}
                            </span>
                          </div>
                        </div>

                        <div className="px-5 py-5">
                          <AgentAppPreview agent={selectedAgent} size="workspace" />
                        </div>
                      </div>

                      <div className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-5">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Promesse</div>
                        <p className="mt-3 text-[15px] leading-7 text-white/66">{selectedAgent.mission}</p>
                        <div className="mt-5 grid gap-3 md:grid-cols-2">
                          <div className="rounded-[1.25rem] border border-white/8 bg-black/18 p-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">Quand l'utiliser</div>
                            <p className="mt-2 text-sm leading-6 text-white/62">{selectedAgent.whenToUse}</p>
                          </div>
                          <div className="rounded-[1.25rem] border border-white/8 bg-black/18 p-4">
                            <div className="text-[11px] uppercase tracking-[0.18em] text-white/42">Interface embarquee</div>
                            <p className="mt-2 text-sm leading-6 text-white/62">
                              {renderableFields.length} champ(s) utilisateur, structuree(s) comme un poste de lancement propre a l'app.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.02))]">
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
                                      <span
                                        className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/78"
                                        style={{
                                          borderColor: selectedPalette?.rim,
                                          background: selectedPalette?.accentSoft,
                                        }}
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

                          {validationMessage && (
                            <div className="mt-4 rounded-[1.2rem] border border-amber-300/14 bg-amber-300/[0.07] px-4 py-3 text-sm text-amber-50/88">
                              {validationMessage}
                            </div>
                          )}

                          <div className="mt-6 flex flex-col items-stretch gap-4 border-t border-white/8 pt-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="max-w-xl text-sm leading-6 text-white/48">
                              L'ouverture ne renvoie pas vers un simple chat generique. Elle lance cette app dans son propre studio, avec son prompt, ses outils et ses parametres.
                            </div>
                            <button
                              onClick={runSelectedAgent}
                              disabled={isRunningAgent}
                              className={cn(
                                'inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all sm:w-auto',
                                isRunningAgent
                                  ? 'cursor-not-allowed bg-white/8 text-white/35'
                                  : 'bg-white text-black hover:translate-y-[-1px]'
                              )}
                            >
                              {isRunningAgent ? (
                                <>
                                  <Loader2 size={15} className="animate-spin" />
                                  Ouverture...
                                </>
                              ) : (
                                <>
                                  <Play size={15} />
                                  {selectedMeta?.actionLabel || "Ouvrir l'app"}
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.025] p-5">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Capacites visibles</div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {selectedAgent.capabilities.length > 0 ? (
                              selectedAgent.capabilities.map((capability) => (
                                <span key={capability} className="rounded-full border border-white/8 px-3 py-2 text-sm text-white/72">
                                  {capability}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-white/48">Pas encore de capacites formalisees.</span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.025] p-5">
                          <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Outils autorises</div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {selectedAgent.tools.length > 0 ? (
                              selectedAgent.tools.map((tool) => (
                                <span key={tool} className="rounded-full border border-white/8 bg-black/18 px-3 py-2 text-xs uppercase tracking-[0.14em] text-white/62">
                                  {tool}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-white/48">Aucun outil specialise declare.</span>
                            )}
                          </div>
                          <div className="mt-4 rounded-[1.2rem] border border-white/8 bg-black/18 px-4 py-4 text-sm leading-6 text-white/56">
                            <div className="font-medium text-white/72">Starter prompt</div>
                            <div className="mt-2">{selectedAgent.starterPrompt}</div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                ) : (
                  <div className="rounded-[2rem] border border-dashed border-white/10 px-6 py-10 text-center text-white/45">
                    Selectionne une app pour voir son studio, sa promesse et son interface de lancement.
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
