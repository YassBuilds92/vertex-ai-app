import { ActivityItem, Message, RunMeta, RunState } from '../types';

const MAX_ACTIVITY_ITEMS = 80;
const MAX_ACTIVITY_TEXT = 420;
const MAX_THOUGHT_CHARS = 16000;

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
      status?: 'success' | 'error';
      resultPreview?: string;
      meta?: Record<string, ActivityMetaValue>;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'warning';
      timestamp?: number;
      iteration?: number;
      title?: string;
      message?: string;
      toolName?: string;
      runMeta?: Partial<RunMeta>;
    }
  | {
      type: 'text_delta';
      timestamp?: number;
      iteration?: number;
      text?: string;
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
    };

export function createEmptyRunMeta(): RunMeta {
  return {
    iterations: 0,
    toolCalls: 0,
    webSearches: 0,
    webFetches: 0,
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
    toolCalls: Math.max(Number(current?.toolCalls || 0), Number(incoming?.toolCalls || 0)),
    webSearches: Math.max(Number(current?.webSearches || 0), Number(incoming?.webSearches || 0)),
    webFetches: Math.max(Number(current?.webFetches || 0), Number(incoming?.webFetches || 0)),
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
          status: event.status === 'error' ? 'error' : 'success',
        })
      );

    case 'warning':
      next.runState = next.runState === 'failed' ? 'failed' : next.runState;
      return pushActivity(
        next,
        createActivityItem(next, 'warning', iteration, timestamp, {
          title: event.title || 'Avertissement',
          message: event.message,
          toolName: event.toolName,
          status: 'error',
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
