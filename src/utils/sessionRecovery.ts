import { AppMode, Attachment, ChatSession, GeneratedAppManifest, Message, StudioAgent } from '../types';

type RecoverableMessage = Partial<Message> & {
  id?: string;
  sessionId?: string;
  userId?: string;
};

function clipTitle(value: string, max = 60) {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  return compact.length > max ? `${compact.slice(0, max - 1).trimEnd()}...` : compact;
}

function parseAgentIdFromSessionId(sessionId: string) {
  const match = /^agent-(.+)-(\d+)$/.exec(sessionId);
  return match?.[1] || null;
}

function parseGeneratedAppIdFromSessionId(sessionId: string) {
  const match = /^gapp-(.+)-(\d+)$/.exec(sessionId);
  return match?.[1] || null;
}

function inferSessionMode(sessionId: string, messages: Message[]): AppMode {
  if (sessionId.startsWith('cw-') || messages.some((message) => message.runMeta || (message.activity?.length ?? 0) > 0)) {
    return 'cowork';
  }

  const modelAttachments = messages
    .filter((message) => message.role === 'model')
    .flatMap((message) => message.attachments || []);
  const hasLyriaSignal = modelAttachments.some((attachment) => (
    attachment.type === 'audio'
      && /lyria|musique|music/i.test(`${attachment.name || ''} ${attachment.mimeType || ''}`)
  )) || messages.some((message) => message.role === 'model' && /lyria/i.test(message.content || ''));

  if (modelAttachments.some((attachment) => attachment.type === 'video')) return 'video';
  if (hasLyriaSignal) return 'lyria';
  if (modelAttachments.some((attachment) => attachment.type === 'audio')) return 'audio';
  if (modelAttachments.some((attachment) => attachment.type === 'image')) return 'image';
  return 'chat';
}

function inferRecoveredTitle(mode: AppMode, messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === 'user' && message.content.trim().length > 0);
  if (firstUserMessage) {
    return clipTitle(firstUserMessage.content);
  }

  const fallbackTitles: Record<AppMode, string> = {
    chat: 'Conversation restauree',
    cowork: 'Mission Cowork restauree',
    image: 'Generation image restauree',
    video: 'Generation video restauree',
    audio: 'Generation audio restauree',
    lyria: 'Generation Lyria restauree',
  };

  return fallbackTitles[mode];
}

function normalizeAttachments(value: unknown): Attachment[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const attachments = value
    .filter((item): item is Attachment => Boolean(item) && typeof item === 'object' && 'type' in item && 'url' in item)
    .map((item) => ({
      ...item,
      id: String(item.id || `att-${Date.now()}`),
      type: item.type,
      url: String(item.url || ''),
    }))
    .filter((item) => item.url.length > 0);

  return attachments.length > 0 ? attachments : undefined;
}

export function normalizeRecoveredMessage(message: RecoverableMessage, fallbackId: string): Message | null {
  if (message.role !== 'user' && message.role !== 'model') return null;

  return {
    id: String(message.id || fallbackId),
    role: message.role,
    content: typeof message.content === 'string' ? message.content : '',
    createdAt: Number(message.createdAt || 0) || Date.now(),
    thoughts: typeof message.thoughts === 'string' ? message.thoughts : undefined,
    attachments: normalizeAttachments(message.attachments),
    images: Array.isArray(message.images) ? message.images.filter((item): item is string => typeof item === 'string') : undefined,
    thoughtImages: Array.isArray(message.thoughtImages) ? message.thoughtImages.filter((item): item is string => typeof item === 'string') : undefined,
    audio: typeof message.audio === 'string' ? message.audio : undefined,
    video: typeof message.video === 'string' ? message.video : undefined,
    refinedInstruction: typeof message.refinedInstruction === 'string' ? message.refinedInstruction : undefined,
    activity: Array.isArray(message.activity) ? message.activity : undefined,
    runState: message.runState,
    runMeta: message.runMeta,
  };
}

export function buildRecoveredSessionShell(
  sessionId: string,
  userId: string,
  messages: Message[],
  agentsById: Map<string, StudioAgent>,
  generatedAppsById?: Map<string, GeneratedAppManifest>
): ChatSession | null {
  if (!sessionId || !userId || messages.length === 0) return null;

  const sortedMessages = [...messages].sort((left, right) => left.createdAt - right.createdAt);
  const updatedAt = sortedMessages[sortedMessages.length - 1]?.createdAt || Date.now();
  const parsedAgentId = parseAgentIdFromSessionId(sessionId);
  const parsedGeneratedAppId = parseGeneratedAppIdFromSessionId(sessionId);
  const recoveredAgent = parsedAgentId ? agentsById.get(parsedAgentId) : undefined;
  const recoveredGeneratedApp = parsedGeneratedAppId ? generatedAppsById?.get(parsedGeneratedAppId) : undefined;
  const sessionKind = recoveredGeneratedApp ? 'generated_app' : recoveredAgent ? 'agent' : 'standard';
  const mode = parsedAgentId || parsedGeneratedAppId ? 'chat' : inferSessionMode(sessionId, sortedMessages);
  const title = inferRecoveredTitle(mode, sortedMessages);
  const firstUserMessage = sortedMessages.find((message) => message.role === 'user' && message.content.trim().length > 0);

  return {
    id: sessionId,
    title,
    messages: [],
    updatedAt,
    mode,
    userId,
    systemInstruction: recoveredGeneratedApp?.systemInstruction || recoveredAgent?.systemInstruction || '',
    sessionKind,
    agentWorkspace: recoveredAgent
      ? {
          agent: recoveredAgent,
          formValues: {},
          lastLaunchPrompt: firstUserMessage?.content || recoveredAgent.starterPrompt,
        }
      : undefined,
    generatedAppWorkspace: recoveredGeneratedApp
      ? {
          app: recoveredGeneratedApp,
          formValues: {},
          lastLaunchPrompt: firstUserMessage?.content || recoveredGeneratedApp.starterPrompt,
        }
      : undefined,
  };
}
