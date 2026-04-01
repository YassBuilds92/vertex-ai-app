import type { AgentOutputKind, StudioAgent } from '../types';

export type AgentStudioKind = 'default' | 'nasheed';

type AgentStudioIdentity = Pick<StudioAgent, 'outputKind'> & Partial<Pick<
  StudioAgent,
  'name' | 'slug' | 'tagline' | 'summary' | 'mission'
>>;

const strongNasheedPattern = /\b(nasheed|anashid|anachid|nashid|lyria|beat|instrumental|melodie|melody|chorus|refrain|hook|acapella|anthem|track|chant)\b/i;
const softMusicTitlePattern = /\b(music|musique|song|songs|chanson)\b/i;

export function resolveAgentStudioKind(agent: AgentStudioIdentity | null | undefined): AgentStudioKind {
  if (!agent) return 'default';
  if (agent.outputKind === 'music') return 'nasheed';

  const fullHaystack = [
    agent.name,
    agent.slug,
    agent.tagline,
    agent.summary,
    agent.mission,
  ]
    .filter(Boolean)
    .join(' ');

  const titleHaystack = [agent.name, agent.slug].filter(Boolean).join(' ');

  if (agent.outputKind === 'podcast' && strongNasheedPattern.test(fullHaystack)) {
    return 'nasheed';
  }

  if (agent.outputKind === 'podcast' && softMusicTitlePattern.test(titleHaystack)) {
    return 'nasheed';
  }

  return 'default';
}

export function resolveAgentVisualOutputKind(agent: AgentStudioIdentity | null | undefined): AgentOutputKind {
  if (!agent) return 'research';
  return resolveAgentStudioKind(agent) === 'nasheed' ? 'music' : agent.outputKind;
}
