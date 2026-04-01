import React from 'react';
import {
  Bot,
  Code2,
  FileText,
  Globe2,
  Radio,
  Search,
  Sparkles,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { AgentFieldSchema, StudioAgent } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type PreviewSize = 'compact' | 'feature' | 'workspace';

type AgentAppMeta = {
  label: string;
  category: string;
  spotlight: string;
  studioLabel: string;
  actionLabel: string;
  heroHint: string;
  icon: LucideIcon;
};

type AgentPalette = {
  hue: number;
  accent: string;
  accentStrong: string;
  accentSoft: string;
  rim: string;
  glow: string;
  frame: React.CSSProperties;
  panel: React.CSSProperties;
  tile: React.CSSProperties;
};

const OUTPUT_META: Record<StudioAgent['outputKind'], AgentAppMeta> = {
  pdf: {
    label: 'PDF Atelier',
    category: 'Editorial',
    spotlight: 'Mise en page premium',
    studioLabel: 'Atelier documentaire',
    actionLabel: "Ouvrir l'atelier PDF",
    heroHint: 'compose, source et publie',
    icon: FileText,
  },
  html: {
    label: 'Site Forge',
    category: 'Web',
    spotlight: 'Mini-sites et pages fortes',
    studioLabel: 'Studio web',
    actionLabel: 'Ouvrir le studio web',
    heroHint: 'structure, design et export',
    icon: Globe2,
  },
  podcast: {
    label: 'Audio Studio',
    category: 'Podcast',
    spotlight: 'Voix, musique et master final',
    studioLabel: 'Studio podcast',
    actionLabel: 'Ouvrir le studio podcast',
    heroHint: 'ecrit, mixe et livre',
    icon: Radio,
  },
  code: {
    label: 'Code Lab',
    category: 'Build',
    spotlight: 'Prototype et execution',
    studioLabel: 'Labo code',
    actionLabel: 'Ouvrir le labo code',
    heroHint: 'spec, code et iteration',
    icon: Code2,
  },
  research: {
    label: 'Research Desk',
    category: 'Insight',
    spotlight: 'Recherche et dossiers sources',
    studioLabel: 'Desk research',
    actionLabel: 'Ouvrir le desk research',
    heroHint: 'cherche, lit et tranche',
    icon: Search,
  },
  automation: {
    label: 'Flow Console',
    category: 'Ops',
    spotlight: 'Routines et executions utiles',
    studioLabel: 'Console automation',
    actionLabel: 'Ouvrir la console automation',
    heroHint: 'declenche, surveille et boucle',
    icon: Workflow,
  },
};

const BASE_HUES: Record<StudioAgent['outputKind'], number> = {
  pdf: 16,
  html: 194,
  podcast: 36,
  code: 148,
  research: 226,
  automation: 174,
};

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function buildFallbackField(agent: StudioAgent): AgentFieldSchema {
  return {
    id: 'missionBrief',
    label: 'Brief libre',
    type: 'textarea',
    required: true,
    placeholder: agent.starterPrompt,
    helpText: "Ajoute ici le contexte de mission a transmettre a l'app.",
  };
}

export function getRenderableFields(agent: StudioAgent | null): AgentFieldSchema[] {
  if (!agent) return [];
  return agent.uiSchema.length > 0 ? agent.uiSchema : [buildFallbackField(agent)];
}

export function createInitialFieldValues(fields: AgentFieldSchema[]) {
  return Object.fromEntries(
    fields.map((field) => [field.id, field.type === 'boolean' ? false : ''])
  ) as Record<string, string | boolean>;
}

export function getAgentAppMeta(agent: Pick<StudioAgent, 'outputKind'>): AgentAppMeta {
  return OUTPUT_META[agent.outputKind];
}

export function getAgentPalette(agent: Pick<StudioAgent, 'id' | 'name' | 'outputKind'>): AgentPalette {
  const hash = hashString(`${agent.id}:${agent.name}:${agent.outputKind}`);
  const baseHue = BASE_HUES[agent.outputKind];
  const hue = (baseHue + (hash % 28) - 14 + 360) % 360;
  const accent = `hsl(${hue} 88% 74%)`;
  const accentStrong = `hsl(${(hue + 18) % 360} 90% 62%)`;
  const accentSoft = `hsla(${hue}, 88%, 72%, 0.16)`;
  const rim = `hsla(${hue}, 95%, 84%, 0.18)`;
  const glow = `hsla(${hue}, 90%, 56%, 0.36)`;

  return {
    hue,
    accent,
    accentStrong,
    accentSoft,
    rim,
    glow,
    frame: {
      background: [
        `radial-gradient(circle at 14% 14%, hsla(${hue}, 92%, 76%, 0.22), transparent 28%)`,
        `radial-gradient(circle at 86% 10%, hsla(${(hue + 34) % 360}, 88%, 68%, 0.16), transparent 24%)`,
        `linear-gradient(145deg, hsla(${hue}, 42%, 12%, 0.94), rgba(8, 11, 17, 0.97))`,
      ].join(','),
      boxShadow: `inset 0 1px 0 ${rim}, 0 28px 64px -36px ${glow}`,
    },
    panel: {
      background: `linear-gradient(180deg, hsla(${hue}, 34%, 18%, 0.9), rgba(8, 12, 18, 0.84))`,
      borderColor: `hsla(${hue}, 95%, 86%, 0.16)`,
      boxShadow: `0 18px 40px -28px ${glow}`,
    },
    tile: {
      background: `linear-gradient(180deg, hsla(${hue}, 85%, 82%, 0.12), rgba(255, 255, 255, 0.04))`,
      borderColor: `hsla(${hue}, 95%, 84%, 0.15)`,
    },
  };
}

function FauxLine({ palette, width, strong = false }: { palette: AgentPalette; width: string; strong?: boolean }) {
  return (
    <div
      className={cn('h-2 rounded-full', strong ? 'opacity-100' : 'opacity-70')}
      style={{
        width,
        background: strong
          ? `linear-gradient(90deg, ${palette.accent}, ${palette.accentStrong})`
          : `linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.24))`,
      }}
    />
  );
}

function PreviewBadge({
  palette,
  children,
}: {
  palette: AgentPalette;
  children: React.ReactNode;
}) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/74"
      style={{
        borderColor: palette.rim,
        background: palette.accentSoft,
      }}
    >
      {children}
    </span>
  );
}

function renderPdfPreview(agent: StudioAgent, palette: AgentPalette) {
  return (
    <div className="grid h-full gap-3 md:grid-cols-[0.54fr_0.46fr]">
      <div
        className="rounded-[1.35rem] border p-4 text-slate-900 shadow-[0_28px_60px_-32px_rgba(0,0,0,0.55)]"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98), rgba(247,245,240,0.94))',
          borderColor: 'rgba(255,255,255,0.55)',
        }}
      >
        <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">Edition</div>
        <div className="mt-3 text-xl font-semibold tracking-tight">{agent.name}</div>
        <div className="mt-2 text-sm text-slate-500">{agent.tagline}</div>
        <div className="mt-5 space-y-2.5">
          <div className="h-16 rounded-[1rem] bg-slate-100 p-3">
            <div className="flex items-center justify-between">
              <div className="h-2 w-20 rounded-full bg-slate-300" />
              <div className="h-2 w-10 rounded-full bg-slate-200" />
            </div>
            <div className="mt-3 space-y-2">
              <div className="h-2 w-full rounded-full bg-slate-200" />
              <div className="h-2 w-5/6 rounded-full bg-slate-200" />
              <div className="h-2 w-3/5 rounded-full bg-slate-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="h-20 rounded-[1rem] bg-slate-100" />
            <div className="h-20 rounded-[1rem] bg-slate-100" />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-[1.25rem] border p-3" style={palette.panel}>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/52">
            <span>Brief</span>
            <span>PDF</span>
          </div>
          <div className="mt-3 space-y-2.5">
            <FauxLine palette={palette} width="82%" strong />
            <FauxLine palette={palette} width="100%" />
            <FauxLine palette={palette} width="72%" />
          </div>
        </div>
        <div className="flex-1 rounded-[1.25rem] border p-3" style={palette.tile}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Sections</div>
          <div className="mt-3 space-y-2">
            {['Couverture', 'Plan', 'Sources'].map((label) => (
              <div key={label} className="flex items-center justify-between rounded-[0.95rem] bg-black/18 px-3 py-2 text-sm text-white/72">
                <span>{label}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: palette.accent }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderHtmlPreview(agent: StudioAgent, palette: AgentPalette) {
  return (
    <div className="h-full rounded-[1.35rem] border p-3" style={palette.panel}>
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <div className="flex gap-1.5">
          {['#f87171', '#fbbf24', '#4ade80'].map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          ))}
        </div>
        <div className="ml-2 h-7 flex-1 rounded-full border border-white/10 bg-black/18 px-3 text-xs leading-7 text-white/54">
          {agent.slug}.cowork.app
        </div>
      </div>
      <div className="mt-4 grid h-[calc(100%-3.25rem)] gap-3 md:grid-cols-[0.58fr_0.42fr]">
        <div className="rounded-[1.25rem] border p-4" style={palette.tile}>
          <PreviewBadge palette={palette}>{agent.outputKind}</PreviewBadge>
          <div className="mt-4 max-w-[13rem] text-2xl font-semibold leading-[1.02] tracking-tight text-white">
            {agent.name}
          </div>
          <div className="mt-2 text-sm leading-6 text-white/62">{agent.summary}</div>
          <div className="mt-5 flex gap-2">
            <div className="h-9 rounded-full px-4 text-sm font-semibold leading-9 text-slate-950" style={{ background: palette.accent }}>
              Live demo
            </div>
            <div className="h-9 rounded-full border border-white/10 px-4 text-sm leading-9 text-white/70">
              Structure
            </div>
          </div>
        </div>
        <div className="grid gap-3">
          <div className="rounded-[1.15rem] border p-3" style={palette.tile}>
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Hero</div>
            <div className="mt-3 h-20 rounded-[1rem]" style={{ background: `linear-gradient(135deg, ${palette.accentSoft}, rgba(255,255,255,0.04))` }} />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-3">
            <div className="rounded-[1.15rem] border p-3" style={palette.tile}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Sections</div>
              <div className="mt-3 space-y-2">
                <FauxLine palette={palette} width="88%" strong />
                <FauxLine palette={palette} width="64%" />
                <FauxLine palette={palette} width="74%" />
              </div>
            </div>
            <div className="rounded-[1.15rem] border p-3" style={palette.tile}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">CTA</div>
              <div className="mt-3 h-9 rounded-full" style={{ background: `linear-gradient(90deg, ${palette.accent}, ${palette.accentStrong})` }} />
              <div className="mt-3 space-y-2">
                <FauxLine palette={palette} width="76%" />
                <FauxLine palette={palette} width="58%" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderPodcastPreview(agent: StudioAgent, palette: AgentPalette) {
  const bars = [40, 68, 82, 56, 92, 48, 72, 38, 78, 44];
  return (
    <div className="grid h-full gap-3 md:grid-cols-[0.52fr_0.48fr]">
      <div className="rounded-[1.35rem] border p-4" style={palette.panel}>
        <div className="flex items-center justify-between">
          <PreviewBadge palette={palette}>recording</PreviewBadge>
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/44">Mix bus</span>
        </div>
        <div className="mt-4 text-2xl font-semibold tracking-tight text-white">{agent.name}</div>
        <div className="mt-2 text-sm text-white/60">{agent.tagline}</div>
        <div className="mt-6 flex h-28 items-end gap-2 rounded-[1.25rem] border border-white/10 bg-black/18 px-3 pb-3">
          {bars.map((height, index) => (
            <span
              key={`${height}-${index}`}
              className="w-full rounded-full"
              style={{
                height: `${height}%`,
                background: index % 2 === 0
                  ? `linear-gradient(180deg, ${palette.accent}, rgba(255,255,255,0.18))`
                  : `linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.18))`,
              }}
            />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {['Host', 'Bed', 'Master', 'Cover'].map((item) => (
            <div key={item} className="rounded-[1rem] border border-white/10 bg-white/[0.04] px-3 py-3 text-sm text-white/72">
              {item}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-[1.25rem] border p-3" style={palette.tile}>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.18em] text-white/52">
            <span>Voix</span>
            <span>2 pistes</span>
          </div>
          <div className="mt-3 space-y-2.5">
            {['Host A', 'Host B'].map((host, index) => (
              <div key={host} className="flex items-center justify-between rounded-[0.95rem] bg-black/18 px-3 py-2 text-sm text-white/74">
                <span>{host}</span>
                <span className="h-2 w-16 rounded-full" style={{ background: index === 0 ? palette.accent : 'rgba(255,255,255,0.55)' }} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 rounded-[1.25rem] border p-3" style={palette.tile}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Timeline</div>
          <div className="mt-4 space-y-3">
            {['Intro', 'Sujet', 'Cloture'].map((item, index) => (
              <div key={item}>
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.18em] text-white/46">
                  <span>{item}</span>
                  <span>0{index + 1}</span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${42 + index * 18}%`,
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
  );
}

function renderCodePreview(agent: StudioAgent, palette: AgentPalette) {
  return (
    <div className="grid h-full gap-3 md:grid-cols-[0.58fr_0.42fr]">
      <div className="rounded-[1.35rem] border p-3" style={palette.panel}>
        <div className="flex items-center justify-between border-b border-white/10 pb-3 text-[11px] uppercase tracking-[0.18em] text-white/52">
          <span>Editor</span>
          <span>{agent.slug}.ts</span>
        </div>
        <div className="mt-4 space-y-3">
          {['const mission =', 'async function run()', 'return deliverable', 'export default app'].map((line, index) => (
            <div key={line} className="flex items-center gap-3">
              <span className="w-5 text-right text-xs text-white/28">{index + 1}</span>
              <div className="flex-1 rounded-[0.9rem] border border-white/8 bg-black/18 px-3 py-2 text-sm text-white/70">
                {line}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3">
        <div className="rounded-[1.2rem] border p-3" style={palette.tile}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Status</div>
          <div className="mt-3 space-y-2">
            {['Build', 'Preview', 'Ship'].map((label, index) => (
              <div key={label} className="flex items-center justify-between rounded-[0.95rem] bg-black/18 px-3 py-2 text-sm text-white/72">
                <span>{label}</span>
                <span className="h-2 w-2 rounded-full" style={{ background: index === 2 ? 'rgba(255,255,255,0.35)' : palette.accent }} />
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 rounded-[1.2rem] border p-3" style={palette.tile}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Terminal</div>
          <div className="mt-3 rounded-[1rem] bg-black/30 p-3 font-mono text-xs leading-6 text-white/62">
            <div>$ launch {agent.slug}</div>
            <div className="text-white/38">compiling assets...</div>
            <div style={{ color: palette.accent }}>preview ready</div>
            <div className="text-white/38">awaiting new brief</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function renderResearchPreview(agent: StudioAgent, palette: AgentPalette) {
  return (
    <div className="grid h-full gap-3 md:grid-cols-[0.46fr_0.54fr]">
      <div className="rounded-[1.35rem] border p-3" style={palette.panel}>
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Dossier</div>
        <div className="mt-3 rounded-[1.2rem] border border-white/10 bg-black/18 p-4">
          <div className="text-xl font-semibold tracking-tight text-white">{agent.name}</div>
          <div className="mt-2 text-sm leading-6 text-white/60">{agent.summary}</div>
          <div className="mt-4 space-y-2.5">
            <FauxLine palette={palette} width="84%" strong />
            <FauxLine palette={palette} width="100%" />
            <FauxLine palette={palette} width="78%" />
          </div>
        </div>
      </div>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          {['Sources', 'Angles'].map((label) => (
            <div key={label} className="rounded-[1.15rem] border p-3" style={palette.tile}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">{label}</div>
              <div className="mt-4 text-3xl font-semibold tracking-tight text-white">
                {label === 'Sources' ? '12' : '04'}
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 rounded-[1.15rem] border p-3" style={palette.tile}>
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Notes</div>
          <div className="mt-3 space-y-2.5">
            {['Cadre', 'Signal', 'Decision'].map((item, index) => (
              <div key={item} className="flex gap-3 rounded-[1rem] bg-black/18 px-3 py-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-slate-950" style={{ background: index === 0 ? palette.accent : 'rgba(255,255,255,0.78)' }}>
                  {index + 1}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white/76">{item}</div>
                  <div className="mt-1 text-xs leading-5 text-white/46">Lecture directe, tri et synthese ciblee.</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderAutomationPreview(palette: AgentPalette) {
  return (
    <div className="grid h-full gap-3 md:grid-cols-[0.42fr_0.58fr]">
      <div className="rounded-[1.35rem] border p-3" style={palette.panel}>
        <div className="text-[11px] uppercase tracking-[0.18em] text-white/52">Triggers</div>
        <div className="mt-3 space-y-2.5">
          {['Inbox', 'Watch', 'Deliver'].map((step, index) => (
            <div key={step} className="flex items-center justify-between rounded-[1rem] border border-white/10 bg-black/18 px-3 py-3 text-sm text-white/74">
              <span>{step}</span>
              <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-white/46">
                0{index + 1}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-[1.35rem] border p-4" style={palette.tile}>
        <div className="flex items-center justify-between">
          <PreviewBadge palette={palette}>active flow</PreviewBadge>
          <span className="text-[11px] uppercase tracking-[0.18em] text-white/44">schedule</span>
        </div>
        <div className="mt-5 space-y-4">
          {['Collecte', 'Filtre', 'Action'].map((step, index) => (
            <div key={step} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-slate-950" style={{ background: palette.accent }}>
                  {index + 1}
                </span>
                {index < 2 && <span className="mt-2 h-12 w-px bg-white/12" />}
              </div>
              <div className="flex-1 rounded-[1rem] border border-white/10 bg-black/18 px-4 py-3">
                <div className="text-sm font-semibold text-white/78">{step}</div>
                <div className="mt-1 text-xs leading-5 text-white/46">Etat, regles et execution visible.</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function renderPreviewByKind(agent: StudioAgent, palette: AgentPalette) {
  switch (agent.outputKind) {
    case 'pdf':
      return renderPdfPreview(agent, palette);
    case 'html':
      return renderHtmlPreview(agent, palette);
    case 'podcast':
      return renderPodcastPreview(agent, palette);
    case 'code':
      return renderCodePreview(agent, palette);
    case 'automation':
      return renderAutomationPreview(palette);
    case 'research':
    default:
      return renderResearchPreview(agent, palette);
  }
}

const sizeConfig: Record<PreviewSize, { shell: string; header: string; caption: string; footer: string }> = {
  compact: {
    shell: 'min-h-[14.5rem] rounded-[1.65rem] p-4',
    header: 'text-[10px] tracking-[0.2em]',
    caption: 'text-[13px]',
    footer: 'mt-4 gap-2',
  },
  feature: {
    shell: 'min-h-[18rem] rounded-[2rem] p-5',
    header: 'text-[10px] tracking-[0.24em]',
    caption: 'text-[14px]',
    footer: 'mt-5 gap-2.5',
  },
  workspace: {
    shell: 'min-h-[21rem] rounded-[2.1rem] p-5',
    header: 'text-[10px] tracking-[0.24em]',
    caption: 'text-[15px]',
    footer: 'mt-5 gap-3',
  },
};

interface AgentAppPreviewProps {
  agent: StudioAgent;
  size?: PreviewSize;
  className?: string;
}

export const AgentAppPreview: React.FC<AgentAppPreviewProps> = ({
  agent,
  size = 'compact',
  className,
}) => {
  const meta = getAgentAppMeta(agent);
  const palette = getAgentPalette(agent);
  const Icon = meta.icon;
  const fields = getRenderableFields(agent).slice(0, size === 'compact' ? 2 : 3);
  const config = sizeConfig[size];

  return (
    <div className={cn('relative overflow-hidden border border-white/8', config.shell, className)} style={palette.frame}>
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: [
            'linear-gradient(transparent 96%, rgba(255,255,255,0.04) 96%)',
            'linear-gradient(90deg, transparent 96%, rgba(255,255,255,0.03) 96%)',
          ].join(','),
          backgroundSize: '100% 18px, 18px 100%',
        }}
      />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={cn('font-semibold uppercase text-white/46', config.header)}>
            {meta.category} app
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] border bg-black/20"
              style={{ borderColor: palette.rim }}
            >
              <Icon size={18} style={{ color: palette.accent }} />
            </div>
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold tracking-tight text-white">{agent.name}</div>
              <div className={cn('truncate text-white/56', config.caption)}>{meta.spotlight}</div>
            </div>
          </div>
        </div>

        <PreviewBadge palette={palette}>{agent.createdBy === 'cowork' ? 'built by cowork' : 'manual'}</PreviewBadge>
      </div>

      <div className="relative z-10 mt-5">{renderPreviewByKind(agent, palette)}</div>

      <div className={cn('relative z-10 flex flex-wrap items-center', config.footer)}>
        {fields.map((field) => (
          <span
            key={field.id}
            className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium text-white/68"
            style={{ borderColor: palette.rim, background: 'rgba(255,255,255,0.04)' }}
          >
            {field.label}
          </span>
        ))}
        {fields.length === 0 && (
          <span className="inline-flex items-center rounded-full border px-3 py-1.5 text-[11px] font-medium text-white/68" style={{ borderColor: palette.rim }}>
            Interface libre
          </span>
        )}
      </div>

      <div className="pointer-events-none absolute -right-12 bottom-[-3.5rem]">
        <div
          className="flex h-28 w-28 items-center justify-center rounded-full blur-2xl"
          style={{ background: palette.glow }}
        />
      </div>
      <div className="pointer-events-none absolute left-[-2rem] top-[-2rem]">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-full blur-2xl"
          style={{ background: palette.accentSoft }}
        />
      </div>
      <div className="pointer-events-none absolute bottom-4 right-4 text-[11px] uppercase tracking-[0.24em] text-white/28">
        {meta.heroHint}
      </div>
      <div className="pointer-events-none absolute top-4 right-4 text-white/10">
        <Sparkles size={18} />
      </div>
      <div className="pointer-events-none absolute bottom-4 left-4 text-white/10">
        <Bot size={18} />
      </div>
    </div>
  );
};
