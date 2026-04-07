import { AgentBlueprint, ActivityItem, Attachment, GeneratedAppManifest, Message, RunMeta, RunState } from '../types';

const MAX_ACTIVITY_ITEMS = 80;
const MAX_ACTIVITY_TEXT = 420;
const MAX_THOUGHT_CHARS = 16000;
const MAX_LOCAL_SNAPSHOTS_PER_SESSION = 24;
const COWORK_LOCAL_STORAGE_KEY = 'studio-pro-cowork-snapshots-v1';

type ActivityMetaValue = string | number | boolean | null | undefined;

export type CoworkStreamEvent =
  | {
      type: 'status';
      timestamp?: number;
      iteration?: number;
      title?: string;
      message?: string;
      runState?: RunState;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'reasoning';
      timestamp?: number;
      iteration?: number;
      title?: string;
      message?: string;
      meta?: Record<string, ActivityMetaValue>;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'narration';
      timestamp?: number;
      iteration?: number;
      title?: string;
      message?: string;
    }
  | {
      type: 'thought';
      timestamp?: number;
      iteration?: number;
      text?: string;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'tool_call';
      timestamp?: number;
      iteration?: number;
      toolName?: string;
      argsPreview?: string;
      meta?: Record<string, ActivityMetaValue>;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'tool_result';
      timestamp?: number;
      iteration?: number;
      toolName?: string;
      status?: 'success' | 'warning' | 'error';
      resultPreview?: string;
      meta?: Record<string, ActivityMetaValue>;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'agent_blueprint';
      timestamp?: number;
      iteration?: number;
      blueprint?: AgentBlueprint;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'generated_app_manifest';
      timestamp?: number;
      iteration?: number;
      manifest?: GeneratedAppManifest;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'released_file';
      timestamp?: number;
      iteration?: number;
      title?: string;
      message?: string;
      attachment?: Attachment;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'workspace_file_created';
      timestamp?: number;
      iteration?: number;
      fileId?: string;
      fileName?: string;
      mimeType?: string;
      attachmentType?: string;
      storageUri?: string;
      fileSizeBytes?: number;
      sessionId?: string;
      label?: string;
      createdAt?: number;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'workspace_file_deleted';
      timestamp?: number;
      iteration?: number;
      fileId?: string;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'warning';
      timestamp?: number;
      iteration?: number;
      title?: string;
      message?: string;
      toolName?: string;
      meta?: Record<string, ActivityMetaValue>;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'text_delta';
      timestamp?: number;
      iteration?: number;
      text?: string;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'done';
      timestamp?: number;
      iteration?: number;
      runState?: RunState;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'error';
      timestamp?: number;
      iteration?: number;
      message?: string;
      runState?: RunState;
      runMeta?: Partial<RunMeta>;
    };

export function createEmptyRunMeta(): RunMeta {
  return {
    iterations: 0,
    modelCalls: 0,
    toolCalls: 0,
    searchCount: 0,
    fetchCount: 0,
    sourcesOpened: 0,
    domainsOpened: 0,
    artifactState: 'none',
    stalledTurns: 0,
    retryCount: 0,
    queueWaitMs: 0,
    mode: 'autonomous',
    phase: 'analysis',
    taskComplete: false,
    inputTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
    toolUseTokens: 0,
    totalTokens: 0,
    estimatedCostUsd: 0,
    estimatedCostEur: 0,
  };
}

function clipText(value?: string, max = MAX_ACTIVITY_TEXT): string | undefined {
  if (!value) return undefined;
  return value.length > max ? `${value.slice(0, max)}... [tronque]` : value;
}

function sanitizeMeta(meta?: Record<string, ActivityMetaValue>) {
  if (!meta) return undefined;
  const cleaned = Object.fromEntries(
    Object.entries(meta)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        typeof value === 'string' ? clipText(value, 180) : value,
      ])
  );
  return Object.keys(cleaned).length > 0 ? cleaned : undefined;
}

function nextActivityId(messageId: string, length: number) {
  return `${messageId}-act-${length + 1}`;
}

function sanitizeAttachment(attachment: Attachment): Attachment {
  return {
    id: attachment.id || `${attachment.type}-${attachment.url}`,
    type: attachment.type,
    url: attachment.url,
    storageUri: attachment.storageUri,
    mimeType: attachment.mimeType,
    name: attachment.name,
    thumbnail: attachment.thumbnail,
    base64: attachment.base64,
    videoMetadata: attachment.videoMetadata,
  };
}

function mergeAttachments(
  current?: Attachment[],
  incoming?: Attachment[],
): Attachment[] | undefined {
  const merged = new Map<string, Attachment>();

  for (const attachment of [...(current || []), ...(incoming || [])]) {
    if (!attachment?.url) continue;
    const sanitized = sanitizeAttachment(attachment);
    const key = `${sanitized.type}:${sanitized.url}:${sanitized.name || ''}`;
    merged.set(key, sanitized);
  }

  return merged.size > 0 ? Array.from(merged.values()) : undefined;
}

function pushActivity(message: Message, item: ActivityItem): Message {
  const nextActivity = [...(message.activity || []), item];
  const cappedActivity =
    nextActivity.length > MAX_ACTIVITY_ITEMS
      ? nextActivity.slice(nextActivity.length - MAX_ACTIVITY_ITEMS)
      : nextActivity;

  return {
    ...message,
    activity: cappedActivity,
  };
}

function mergeRunMeta(current?: Partial<RunMeta>, incoming?: Partial<RunMeta>): RunMeta {
  return {
    iterations: Math.max(Number(current?.iterations || 0), Number(incoming?.iterations || 0)),
    modelCalls: Math.max(Number(current?.modelCalls || 0), Number(incoming?.modelCalls || 0)),
    toolCalls: Math.max(Number(current?.toolCalls || 0), Number(incoming?.toolCalls || 0)),
    searchCount: Math.max(Number(current?.searchCount || 0), Number(incoming?.searchCount || 0)),
    fetchCount: Math.max(Number(current?.fetchCount || 0), Number(incoming?.fetchCount || 0)),
    sourcesOpened: Math.max(Number(current?.sourcesOpened || 0), Number(incoming?.sourcesOpened || 0)),
    domainsOpened: Math.max(Number(current?.domainsOpened || 0), Number(incoming?.domainsOpened || 0)),
    artifactState: (incoming?.artifactState || current?.artifactState || 'none') as RunMeta['artifactState'],
    stalledTurns: Math.max(Number(current?.stalledTurns || 0), Number(incoming?.stalledTurns || 0)),
    retryCount: Math.max(Number(current?.retryCount || 0), Number(incoming?.retryCount || 0)),
    queueWaitMs: Math.max(Number(current?.queueWaitMs || 0), Number(incoming?.queueWaitMs || 0)),
    mode: (incoming?.mode || current?.mode || 'autonomous') as RunMeta['mode'],
    phase: String(incoming?.phase || current?.phase || 'analysis'),
    taskComplete: Boolean(incoming?.taskComplete ?? current?.taskComplete ?? false),
    inputTokens: Math.max(Number(current?.inputTokens || 0), Number(incoming?.inputTokens || 0)),
    outputTokens: Math.max(Number(current?.outputTokens || 0), Number(incoming?.outputTokens || 0)),
    thoughtTokens: Math.max(Number(current?.thoughtTokens || 0), Number(incoming?.thoughtTokens || 0)),
    toolUseTokens: Math.max(Number(current?.toolUseTokens || 0), Number(incoming?.toolUseTokens || 0)),
    totalTokens: Math.max(Number(current?.totalTokens || 0), Number(incoming?.totalTokens || 0)),
    estimatedCostUsd: Math.max(Number(current?.estimatedCostUsd || 0), Number(incoming?.estimatedCostUsd || 0)),
    estimatedCostEur: Math.max(Number(current?.estimatedCostEur || 0), Number(incoming?.estimatedCostEur || 0)),
  };
}

function createActivityItem(
  message: Message,
  kind: ActivityItem['kind'],
  iteration: number,
  timestamp: number,
  extra: Omit<ActivityItem, 'id' | 'kind' | 'iteration' | 'timestamp'>
): ActivityItem {
  return {
    id: nextActivityId(message.id, message.activity?.length || 0),
    kind,
    iteration,
    timestamp,
    title: clipText(extra.title, 120),
    message: clipText(extra.message, 480),
    status: extra.status,
    toolName: extra.toolName,
    argsPreview: clipText(extra.argsPreview, 260),
    resultPreview: clipText(extra.resultPreview, 320),
    meta: sanitizeMeta(extra.meta),
  };
}

export function applyCoworkEventToMessage(message: Message, event: CoworkStreamEvent): Message {
  const timestamp = event.timestamp || Date.now();
  const iteration = Number(event.iteration || 0);
  let next: Message = {
    ...message,
    runMeta: mergeRunMeta(message.runMeta, 'runMeta' in event ? event.runMeta : undefined),
  };

  switch (event.type) {
    case 'status':
      next.runState = event.runState || next.runState || 'running';
      if (event.title || event.message) {
        next = pushActivity(
          next,
          createActivityItem(next, 'status', iteration, timestamp, {
            title: event.title,
            message: event.message,
            status: 'info',
          })
        );
      }
      return next;

    case 'reasoning':
      return pushActivity(
        next,
        createActivityItem(next, 'reasoning', iteration, timestamp, {
          title: event.title || 'Raisonnement',
          message: event.message,
          meta: event.meta,
          status: 'info',
        })
      );

    case 'narration':
      return pushActivity(
        next,
        createActivityItem(next, 'narration', iteration, timestamp, {
          title: event.title,
          message: event.message,
          status: 'info',
        })
      );

    case 'tool_call':
      return pushActivity(
        next,
        createActivityItem(next, 'tool_call', iteration, timestamp, {
          title: event.toolName ? `Appel outil: ${event.toolName}` : 'Appel outil',
          toolName: event.toolName,
          argsPreview: event.argsPreview,
          meta: event.meta,
          status: 'info',
        })
      );

    case 'tool_result':
      return pushActivity(
        next,
        createActivityItem(next, 'tool_result', iteration, timestamp, {
          title: event.toolName ? `Resultat: ${event.toolName}` : 'Resultat outil',
          toolName: event.toolName,
          resultPreview: event.resultPreview,
          meta: event.meta,
          status: event.status === 'error' ? 'error' : event.status === 'warning' ? 'warning' : 'success',
        })
      );

    case 'agent_blueprint':
      return pushActivity(
        next,
        createActivityItem(next, 'status', iteration, timestamp, {
          title: event.blueprint?.name ? `Agent cree: ${event.blueprint.name}` : 'Agent cree',
          message: event.blueprint?.tagline || "Le Hub Agents vient de recevoir un nouveau specialiste.",
          status: 'success',
        })
      );

    case 'generated_app_manifest':
      return pushActivity(
        next,
        createActivityItem(next, 'status', iteration, timestamp, {
          title: event.manifest?.name ? `App creee: ${event.manifest.name}` : 'App creee',
          message: event.manifest?.tagline || "Le store Cowork vient de recevoir une nouvelle app experte.",
          status: 'success',
        })
      );

    case 'released_file': {
      const nextAttachments = mergeAttachments(
        next.attachments,
        event.attachment ? [event.attachment] : undefined,
      );
      const withAttachment = {
        ...next,
        attachments: nextAttachments,
      };

      if (!event.title && !event.message && !event.attachment) {
        return withAttachment;
      }

      return pushActivity(
        withAttachment,
        createActivityItem(withAttachment, 'status', iteration, timestamp, {
          title: event.title || 'Livrable publie',
          message:
            event.message
            || (event.attachment?.name
              ? `${event.attachment.name} est disponible en preview dans la conversation.`
              : "Le livrable publie est disponible dans la conversation."),
          meta: event.attachment
            ? {
                type: event.attachment.type,
                mimeType: event.attachment.mimeType,
              }
            : undefined,
          status: 'success',
        })
      );
    }

    case 'warning':
      next.runState = next.runState === 'failed' ? 'failed' : next.runState;
      return pushActivity(
        next,
        createActivityItem(next, 'warning', iteration, timestamp, {
          title: event.title || 'Avertissement',
          message: event.message,
          toolName: event.toolName,
          meta: event.meta,
          status: 'warning',
        })
      );

    case 'thought':
      return {
        ...next,
        thoughts: clipText(`${next.thoughts || ''}${event.text || ''}`, MAX_THOUGHT_CHARS),
      };

    case 'text_delta':
      return {
        ...next,
        content: `${next.content || ''}${event.text || ''}`,
      };

    case 'done':
      return {
        ...next,
        runState: event.runState || 'completed',
      };

    case 'error':
      next = pushActivity(
        next,
        createActivityItem(next, 'warning', iteration, timestamp, {
          title: 'Erreur',
          message: event.message,
          status: 'error',
        })
      );
      return {
        ...next,
        runState: event.runState || 'failed',
      };

    default:
      return next;
  }
}

export function sanitizeCoworkMessageForStorage(message: Message): Message {
  return {
    ...message,
    attachments: mergeAttachments(message.attachments),
    thoughts: clipText(message.thoughts, MAX_THOUGHT_CHARS),
    runMeta: mergeRunMeta(createEmptyRunMeta(), message.runMeta),
    activity: (message.activity || [])
      .slice(-(MAX_ACTIVITY_ITEMS))
      .map((item) => ({
        ...item,
        title: clipText(item.title, 120),
        message: clipText(item.message, 480),
        argsPreview: clipText(item.argsPreview, 260),
        resultPreview: clipText(item.resultPreview, 320),
        meta: sanitizeMeta(item.meta),
      })),
  };
}

type CoworkLocalSnapshots = Record<string, Record<string, Record<string, Message>>>;

function canUseLocalStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

function readCoworkLocalSnapshots(): CoworkLocalSnapshots {
  if (!canUseLocalStorage()) return {};

  try {
    const raw = window.localStorage.getItem(COWORK_LOCAL_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as CoworkLocalSnapshots;
  } catch {
    return {};
  }
}

function writeCoworkLocalSnapshots(store: CoworkLocalSnapshots) {
  if (!canUseLocalStorage()) return;

  try {
    window.localStorage.setItem(COWORK_LOCAL_STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore quota or serialization failures. Firestore remains the source of truth.
  }
}

function pruneSessionSnapshots(messagesById: Record<string, Message>) {
  const entries = Object.entries(messagesById)
    .sort(([, left], [, right]) => right.createdAt - left.createdAt)
    .slice(0, MAX_LOCAL_SNAPSHOTS_PER_SESSION);

  return Object.fromEntries(entries);
}

function pickLongerText(current?: string, fallback?: string) {
  if (!current) return fallback;
  if (!fallback) return current;
  return fallback.length > current.length ? fallback : current;
}

function pickRunState(current?: RunState, fallback?: RunState) {
  if (current && current !== 'running') return current;
  if (fallback && fallback !== 'running') return fallback;
  return current || fallback;
}

function mergeCoworkMessage(current: Message, snapshot: Message): Message {
  return sanitizeCoworkMessageForStorage({
    ...current,
    content: pickLongerText(current.content, snapshot.content) || '',
    thoughts: pickLongerText(current.thoughts, snapshot.thoughts),
    attachments: mergeAttachments(current.attachments, snapshot.attachments),
    images: (current.images?.length ?? 0) > 0 ? current.images : snapshot.images,
    thoughtImages: (current.thoughtImages?.length ?? 0) > 0 ? current.thoughtImages : snapshot.thoughtImages,
    audio: current.audio || snapshot.audio,
    video: current.video || snapshot.video,
    refinedInstruction: current.refinedInstruction || snapshot.refinedInstruction,
    activity:
      (snapshot.activity?.length ?? 0) > (current.activity?.length ?? 0)
        ? snapshot.activity
        : current.activity,
    runState: pickRunState(current.runState, snapshot.runState),
    runMeta: mergeRunMeta(current.runMeta, snapshot.runMeta),
  });
}

export function saveCoworkSessionSnapshot(userId: string, sessionId: string, message: Message) {
  if (!userId || !sessionId || message.role !== 'model') return;

  const store = readCoworkLocalSnapshots();
  const userSnapshots = store[userId] || {};
  const sessionSnapshots = userSnapshots[sessionId] || {};

  sessionSnapshots[message.id] = sanitizeCoworkMessageForStorage(message);
  userSnapshots[sessionId] = pruneSessionSnapshots(sessionSnapshots);
  store[userId] = userSnapshots;

  writeCoworkLocalSnapshots(store);
}

export function clearCoworkSessionSnapshots(userId: string, sessionId: string, messageIds?: string[]) {
  if (!userId || !sessionId) return;

  const store = readCoworkLocalSnapshots();
  const userSnapshots = store[userId];
  if (!userSnapshots || !userSnapshots[sessionId]) return;

  if (!messageIds || messageIds.length === 0) {
    delete userSnapshots[sessionId];
  } else {
    for (const messageId of messageIds) {
      delete userSnapshots[sessionId][messageId];
    }

    if (Object.keys(userSnapshots[sessionId]).length === 0) {
      delete userSnapshots[sessionId];
    }
  }

  if (Object.keys(userSnapshots).length === 0) {
    delete store[userId];
  } else {
    store[userId] = userSnapshots;
  }

  writeCoworkLocalSnapshots(store);
}

export function hydrateCoworkMessages(messages: Message[], userId: string, sessionId: string): Message[] {
  if (!userId || !sessionId) return messages;

  const store = readCoworkLocalSnapshots();
  const sessionSnapshots = store[userId]?.[sessionId];
  if (!sessionSnapshots) return messages;

  const merged = new Map<string, Message>();

  for (const message of messages) {
    const snapshot = sessionSnapshots[message.id];
    merged.set(message.id, snapshot ? mergeCoworkMessage(message, snapshot) : message);
  }

  for (const [messageId, snapshot] of Object.entries(sessionSnapshots)) {
    if (!merged.has(messageId)) {
      merged.set(messageId, snapshot);
    }
  }

  return Array.from(merged.values()).sort((left, right) => left.createdAt - right.createdAt);
}
