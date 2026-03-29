import { createGoogleAI, parseApiError, retryWithBackoff } from './google-genai.js';
import { log } from './logger.js';

export type AgentOutputKind = 'pdf' | 'html' | 'podcast' | 'code' | 'research' | 'automation';
export type AgentFieldType = 'text' | 'textarea' | 'select' | 'number' | 'boolean' | 'url';

export type AgentFieldSchema = {
  id: string;
  label: string;
  type: AgentFieldType;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  options?: string[];
};

export type AgentBlueprint = {
  id?: string;
  name: string;
  slug: string;
  tagline: string;
  summary: string;
  mission: string;
  whenToUse: string;
  outputKind: AgentOutputKind;
  starterPrompt: string;
  systemInstruction: string;
  uiSchema: AgentFieldSchema[];
  tools: string[];
  capabilities: string[];
  status?: 'ready' | 'draft';
  createdBy?: 'manual' | 'cowork';
  sourcePrompt?: string;
  sourceSessionId?: string;
};

export type HubAgentRecord = AgentBlueprint & {
  id: string;
  status: 'ready' | 'draft';
  createdBy: 'manual' | 'cowork';
  createdAt?: number;
  updatedAt?: number;
};

const AGENT_ARCHITECT_MODEL = 'gemini-3.1-flash-lite-preview';

const TOOL_LIBRARY = [
  'web_search',
  'web_fetch',
  'music_catalog_lookup',
  'begin_pdf_draft',
  'append_to_draft',
  'get_pdf_draft',
  'review_pdf_draft',
  'create_pdf',
  'release_file',
  'list_files',
  'list_recursive',
  'read_file',
  'write_file',
  'execute_script',
] as const;

const AGENT_ARCHITECT_SYSTEM_PROMPT = `Tu es l'architecte d'agents de Studio Pro.
Tu dois retourner UNIQUEMENT un objet JSON valide, sans markdown et sans texte autour.

Schema attendu:
{
  "name": "Nom court de l'agent",
  "slug": "slug-kebab-case",
  "tagline": "phrase courte produit",
  "summary": "resume concret en 1 phrase",
  "mission": "ce que l'agent accomplit exactement",
  "whenToUse": "quand l'utilisateur doit preferer cet agent",
  "outputKind": "pdf | html | podcast | code | research | automation",
  "starterPrompt": "prompt de depart que Cowork ou l'utilisateur peut envoyer a cet agent",
  "systemInstruction": "prompt systeme complet, directement reutilisable",
  "tools": ["liste d'outils pertinents"],
  "capabilities": ["3 a 6 capacites lisibles cote produit"],
  "uiSchema": [
    {
      "id": "champ",
      "label": "Label",
      "type": "text | textarea | select | number | boolean | url",
      "placeholder": "placeholder court",
      "helpText": "aide courte",
      "required": true,
      "options": ["si type=select"]
    }
  ]
}

Regles:
- Ecris en francais.
- Fais un agent specialise, reutilisable et vraiment utile.
- 3 a 6 champs UI max.
- Les tools doivent etre choisis dans cette liste: ${TOOL_LIBRARY.join(', ')}.
- Les capabilities sont des promesses produit courtes, pas du jargon.
- Si le brief parle de podcast ou d'audio, tu peux mentionner Gemini TTS et Lyria comme familles d'outils, sans figer de model IDs fragiles.
- Le systemInstruction doit etre exigeant, concret et exploitable tel quel.
- Le starterPrompt doit etre pret a l'emploi.
- Le slug doit etre propre et stable.
- N'invente pas de cle hors schema.`;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'agent-studio';
}

function clipText(value: unknown, max = 280): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

function normalizeAgentLookup(value: unknown): string {
  return slugify(typeof value === 'string' ? value : '');
}

function sanitizeTimestamp(value: unknown): number | undefined {
  const timestamp = Number(value);
  return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : undefined;
}

function uniqueStrings(values: unknown, max = 8): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const text = clipText(value, 120);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(text);
    if (output.length >= max) break;
  }

  return output;
}

function normalizeFieldType(value: unknown): AgentFieldType {
  const normalized = typeof value === 'string' ? value.toLowerCase().trim() : '';
  switch (normalized) {
    case 'textarea':
    case 'select':
    case 'number':
    case 'boolean':
    case 'url':
      return normalized;
    default:
      return 'text';
  }
}

function normalizeOutputKind(value: unknown, fallbackBrief = ''): AgentOutputKind {
  const normalized = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (normalized === 'pdf' || normalized === 'html' || normalized === 'podcast' || normalized === 'code' || normalized === 'research' || normalized === 'automation') {
    return normalized;
  }

  const brief = fallbackBrief.toLowerCase();
  if (brief.includes('podcast') || brief.includes('audio')) return 'podcast';
  if (brief.includes('html') || brief.includes('site') || brief.includes('landing')) return 'html';
  if (brief.includes('code') || brief.includes('app') || brief.includes('plugin')) return 'code';
  if (brief.includes('pdf') || brief.includes('rapport') || brief.includes('document')) return 'pdf';
  if (brief.includes('automatis') || brief.includes('routine')) return 'automation';
  return 'research';
}

function defaultUiSchema(outputKind: AgentOutputKind): AgentFieldSchema[] {
  const common: AgentFieldSchema[] = [
    {
      id: 'objectif',
      label: 'Objectif',
      type: 'textarea',
      placeholder: 'Decris la tache exacte a accomplir',
      helpText: 'Le coeur de la mission a produire.',
      required: true,
    },
    {
      id: 'ton',
      label: 'Ton',
      type: 'text',
      placeholder: 'Direct, premium, pedagogique, energique...',
      helpText: 'Permet d ajuster le rendu final.',
      required: false,
    },
  ];

  if (outputKind === 'podcast') {
    return [
      ...common,
      {
        id: 'duree_minutes',
        label: 'Duree',
        type: 'number',
        placeholder: '8',
        helpText: 'Duree cible du podcast en minutes.',
        required: false,
      },
      {
        id: 'angle',
        label: 'Angle',
        type: 'text',
        placeholder: 'briefing, narratif, debrief...',
        helpText: 'Style editorial ou angle de narration.',
        required: false,
      },
    ];
  }

  if (outputKind === 'pdf') {
    return [
      ...common,
      {
        id: 'niveau_detail',
        label: 'Niveau de detail',
        type: 'select',
        placeholder: 'Dense',
        helpText: 'Choisis la profondeur du document.',
        required: false,
        options: ['Compact', 'Dense', 'Magazine'],
      },
      {
        id: 'sources',
        label: 'Sources requises',
        type: 'boolean',
        helpText: 'Active si tu veux un document fortement source.',
        required: false,
      },
    ];
  }

  if (outputKind === 'html' || outputKind === 'code') {
    return [
      ...common,
      {
        id: 'public',
        label: 'Public cible',
        type: 'text',
        placeholder: 'Equipe, clients, visiteurs...',
        helpText: 'Pour calibrer la structure et le langage.',
        required: false,
      },
      {
        id: 'format',
        label: 'Format',
        type: 'select',
        helpText: 'Nature du livrable a coder.',
        required: false,
        options: outputKind === 'html'
          ? ['Landing page', 'Mini-site', 'Page outil']
          : ['Prototype', 'Feature', 'Script'],
      },
    ];
  }

  return [
    ...common,
    {
      id: 'livrable',
      label: 'Livrable',
      type: 'text',
      placeholder: 'Synthese, plan, execution...',
      helpText: 'Ce que l agent doit remettre.',
      required: false,
    },
  ];
}

function sanitizeUiSchema(input: unknown, outputKind: AgentOutputKind): AgentFieldSchema[] {
  if (!Array.isArray(input)) {
    return defaultUiSchema(outputKind);
  }

  const fields: AgentFieldSchema[] = [];

  for (const rawField of input) {
    const field = rawField && typeof rawField === 'object' ? rawField as Record<string, unknown> : null;
    if (!field) continue;

    const label = clipText(field.label || field.id, 42);
    if (!label) continue;

    const id = slugify(String(field.id || label)).replace(/-/g, '_').slice(0, 36) || `field_${fields.length + 1}`;
    const type = normalizeFieldType(field.type);
    const options = type === 'select' ? uniqueStrings(field.options, 6) : undefined;

    fields.push({
      id,
      label,
      type,
      placeholder: clipText(field.placeholder, 80) || undefined,
      helpText: clipText(field.helpText, 120) || undefined,
      required: Boolean(field.required),
      options: options && options.length > 0 ? options : undefined,
    });

    if (fields.length >= 6) break;
  }

  return fields.length > 0 ? fields : defaultUiSchema(outputKind);
}

function extractJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf('{');
    const lastBrace = trimmed.lastIndexOf('}');
    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      throw new Error('Aucun JSON exploitable retourne.');
    }
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  }
}

export function sanitizeAgentBlueprint(raw: unknown, brief = ''): AgentBlueprint {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const outputKind = normalizeOutputKind(input.outputKind, brief);
  const name = clipText(input.name, 48) || 'Agent specialise';
  const slug = slugify(String(input.slug || name));
  const tools = uniqueStrings(input.tools, 10).filter(tool => TOOL_LIBRARY.includes(tool as typeof TOOL_LIBRARY[number]));
  const capabilities = uniqueStrings(input.capabilities, 6);
  const uiSchema = sanitizeUiSchema(input.uiSchema, outputKind);

  return {
    name,
    slug,
    tagline: clipText(input.tagline, 72) || `Specialiste ${outputKind}`,
    summary: clipText(input.summary, 180) || clipText(brief, 180) || `Agent ${name} pret a l emploi.`,
    mission: clipText(input.mission, 240) || clipText(brief, 240) || `Accomplir la mission suivante: ${name}.`,
    whenToUse: clipText(input.whenToUse, 200) || `Utilise cet agent quand la demande tourne surtout autour de ${name.toLowerCase()}.`,
    outputKind,
    starterPrompt: clipText(input.starterPrompt, 420) || `Prends en charge cette mission: ${brief || name}.`,
    systemInstruction: clipText(input.systemInstruction, 4000) || `Tu es ${name}, un agent specialise. Tu livres un resultat net, exploitable et honnete.`,
    uiSchema,
    tools: tools.length > 0 ? tools : ['web_search', 'web_fetch'],
    capabilities: capabilities.length > 0 ? capabilities : [
      'Cadre vite la mission',
      'Propose un livrable net',
      'Travaille avec une interface simple',
    ],
    status: input.status === 'draft' ? 'draft' : 'ready',
    createdBy: input.createdBy === 'manual' ? 'manual' : 'cowork',
    sourcePrompt: clipText(input.sourcePrompt || brief, 500) || undefined,
    sourceSessionId: clipText(input.sourceSessionId, 80) || undefined,
  };
}

export function sanitizeHubAgentRecord(raw: unknown): HubAgentRecord | null {
  if (!raw || typeof raw !== 'object') return null;

  const input = raw as Record<string, unknown>;
  const blueprint = sanitizeAgentBlueprint(
    input,
    clipText(input.sourcePrompt || input.mission || input.summary, 500)
  );
  const id = clipText(input.id, 96) || `${blueprint.slug}-hub`;

  return {
    ...blueprint,
    id,
    status: input.status === 'draft' ? 'draft' : 'ready',
    createdBy: input.createdBy === 'manual' ? 'manual' : 'cowork',
    createdAt: sanitizeTimestamp(input.createdAt),
    updatedAt: sanitizeTimestamp(input.updatedAt),
  };
}

export function pickHubAgentRecord(agents: HubAgentRecord[], selector: string): HubAgentRecord | null {
  const cleanedSelector = clipText(selector, 160);
  if (!cleanedSelector) return null;

  const availableAgents = [...agents]
    .filter(agent => agent.status !== 'draft')
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0));
  const normalizedSelector = normalizeAgentLookup(cleanedSelector);

  const exactMatch = availableAgents.find(agent =>
    [agent.id, agent.slug, agent.name].some(value => normalizeAgentLookup(value) === normalizedSelector)
  );
  if (exactMatch) return exactMatch;

  const partialMatch = availableAgents.find(agent =>
    [agent.id, agent.slug, agent.name, agent.tagline, agent.summary, agent.mission]
      .filter(Boolean)
      .some(value => {
        const normalizedValue = normalizeAgentLookup(value);
        return Boolean(normalizedValue) && (
          normalizedValue.includes(normalizedSelector)
          || normalizedSelector.includes(normalizedValue)
        );
      })
  );

  return partialMatch || null;
}

export function summarizeHubAgentsForPrompt(agents: HubAgentRecord[], max = 8): string {
  const visibleAgents = [...agents]
    .filter(agent => agent.status !== 'draft')
    .sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0))
    .slice(0, Math.max(1, max));

  return visibleAgents
    .map((agent) => {
      const promise = clipText(agent.whenToUse || agent.tagline || agent.summary, 120);
      const capabilityLine = agent.capabilities.length > 0
        ? ` | cap: ${agent.capabilities.slice(0, 3).join(', ')}`
        : '';
      return `- id=${agent.id} | slug=${agent.slug} | ${agent.name} | ${agent.outputKind} | ${promise}${capabilityLine}`;
    })
    .join('\n');
}

export async function generateAgentBlueprintFromBrief(brief: string, source: 'manual' | 'cowork' = 'manual'): Promise<AgentBlueprint> {
  const cleanedBrief = clipText(brief, 1200);
  if (!cleanedBrief) {
    throw new Error("Le brief de creation d'agent est vide.");
  }

  const ai = createGoogleAI(AGENT_ARCHITECT_MODEL);

  try {
    const result = await retryWithBackoff(() => ai.models.generateContent({
      model: AGENT_ARCHITECT_MODEL,
      contents: [{ role: 'user', parts: [{ text: cleanedBrief }] }],
      config: {
        systemInstruction: AGENT_ARCHITECT_SYSTEM_PROMPT,
        temperature: 0.35,
      }
    }));

    const parsed = extractJsonObject(result.text || '');
    const blueprint = sanitizeAgentBlueprint(parsed, cleanedBrief);
    blueprint.createdBy = source;
    blueprint.sourcePrompt = cleanedBrief;
    return blueprint;
  } catch (error) {
    const cleanError = parseApiError(error);
    log.error('Agent blueprint generation failed', cleanError);
    throw new Error(cleanError);
  }
}
