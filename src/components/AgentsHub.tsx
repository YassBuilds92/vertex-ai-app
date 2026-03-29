import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  Code2,
  FileText,
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
  "Cree un agent podcast qui prepare script, voix et ambiance musicale.",
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

const renderFieldType = (field: AgentFieldSchema) => {
  const tone = field.required ? 'text-white/90' : 'text-white/65';
  if (field.type === 'textarea') return <div className={cn("rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm", tone)}>{field.label}</div>;
  if (field.type === 'select') return <div className={cn("rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm", tone)}>{field.label}{field.options?.length ? ` · ${field.options.slice(0, 3).join(' / ')}` : ''}</div>;
  if (field.type === 'boolean') return <div className={cn("rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm inline-flex", tone)}>{field.label}</div>;
  return <div className={cn("rounded-full border border-white/8 bg-white/[0.03] px-4 py-2 text-sm inline-flex", tone)}>{field.label}</div>;
};

interface AgentsHubProps {
  isOpen: boolean;
  agents: StudioAgent[];
  isCreating: boolean;
  latestCreatedAgent?: StudioAgent | null;
  onClose: () => void;
  onCreateAgent: (brief: string) => Promise<unknown> | void;
}

export const AgentsHub: React.FC<AgentsHubProps> = ({
  isOpen,
  agents,
  isCreating,
  latestCreatedAgent,
  onClose,
  onCreateAgent,
}) => {
  const [brief, setBrief] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const submit = async () => {
    const cleaned = brief.trim();
    if (!cleaned || isCreating) return;
    await onCreateAgent(cleaned);
    setBrief('');
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
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(110,231,255,0.12),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(244,114,182,0.12),_transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_26%)] pointer-events-none" />

          <div className="relative flex h-full flex-col">
            <div className="flex items-center justify-between border-b border-white/6 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                  <Bot size={18} className="text-cyan-300" />
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Hub Agents</div>
                  <div className="text-xl font-semibold tracking-tight text-white">Cowork cree ses specialistes ici</div>
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

            <div className="grid flex-1 grid-cols-1 gap-0 overflow-hidden xl:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-y-auto border-b border-white/6 xl:border-b-0 xl:border-r">
                <section className="px-6 pb-8 pt-8">
                  <div className="max-w-3xl">
                    <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/8 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-cyan-200/80">
                      <Sparkles size={12} />
                      Delegation native Cowork
                    </div>
                    <h2 className="max-w-2xl text-4xl font-semibold leading-[1.02] tracking-tight text-white sm:text-5xl">
                      Un agent general qui peut produire, ou te fabriquer le bon operateur.
                    </h2>
                    <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/62">
                      PDF sur l actu, page HTML, agent podcast, mini-specialiste code: Cowork garde la main, puis pousse les agents recurrent dans ce hub pour les reutiliser ensuite.
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
                        placeholder="Ex: cree un agent podcast actu qui fait la veille, ecrit le script, prepare la voix et une ambiance musicale"
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
                          Le blueprint genere le prompt systeme, les outils preferes et une premiere UI structuree pour la suite.
                        </p>
                        <button
                          onClick={submit}
                          disabled={isCreating || !brief.trim()}
                          className={cn(
                            "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all",
                            isCreating || !brief.trim()
                              ? "cursor-not-allowed bg-white/8 text-white/35"
                              : "bg-white text-black hover:translate-y-[-1px]"
                          )}
                        >
                          {isCreating ? 'Creation...' : 'Creer cet agent'}
                          <ArrowRight size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
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
                      Le hub est vide pour l instant. Cree un premier agent depuis Cowork ou depuis le champ ci-dessus.
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
                              "w-full rounded-[1.6rem] border px-4 py-4 text-left transition-all",
                              isActive
                                ? "border-white/14 bg-white/[0.06]"
                                : "border-white/6 bg-white/[0.025] hover:bg-white/[0.045]"
                            )}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-2xl", meta.bg)}>
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
                  <div className="mx-auto max-w-2xl">
                    <div className="flex items-center gap-3">
                      <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", outputMeta[selectedAgent.outputKind].bg)}>
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

                    <p className="mt-5 text-[16px] leading-7 text-white/65">{selectedAgent.mission}</p>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Quand l utiliser</div>
                        <p className="mt-3 text-sm leading-7 text-white/62">{selectedAgent.whenToUse}</p>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Capacites</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedAgent.capabilities.map((capability) => (
                            <span key={capability} className="rounded-full border border-white/8 px-3 py-2 text-sm text-white/72">
                              {capability}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-10">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Interface de depart</div>
                      <div className="mt-4 flex flex-wrap gap-2.5">
                        {selectedAgent.uiSchema.map((field) => (
                          <div key={field.id}>
                            {renderFieldType(field)}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-10 grid gap-6 lg:grid-cols-2">
                      <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.025] p-5">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Starter prompt</div>
                        <p className="mt-3 text-sm leading-7 text-white/68">{selectedAgent.starterPrompt}</p>
                      </div>
                      <div className="rounded-[1.8rem] border border-white/8 bg-white/[0.025] p-5">
                        <div className="text-[11px] uppercase tracking-[0.2em] text-white/38">Outils preferes</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedAgent.tools.map((tool) => (
                            <span key={tool} className="rounded-full border border-white/8 bg-white/[0.02] px-3 py-2 text-sm text-white/62">
                              {tool}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-10 rounded-[1.8rem] border border-cyan-300/14 bg-cyan-300/[0.04] p-5">
                      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-cyan-100/70">
                        <BrainCircuit size={12} />
                        Essence Cowork
                      </div>
                      <p className="mt-3 text-sm leading-7 text-white/68">
                        Cowork peut continuer a traiter la demande lui-meme, ou pousser ce specialiste quand la mission merite une delegation recurrente.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-white/40">
                    Selectionne un agent pour voir son blueprint.
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
