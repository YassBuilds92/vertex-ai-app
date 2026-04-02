export type GeneratedAppBundleStatus = 'ready' | 'failed' | 'skipped';

type GeneratedAppBundleStateInput = {
  bundleStatus?: string | null | undefined;
  bundleCode?: string | null | undefined;
  bundleUrl?: string | null | undefined;
  buildLog?: string | null | undefined;
};

const OPTIONAL_PREVIEW_BUNDLE_PATTERNS = [
  /could not resolve "\.\/(?:src|shared)\/generated-app-sdk\.(?:tsx|js)"/i,
  /could not resolve "react\/jsx-runtime"/i,
  /could not resolve "lucide-react"/i,
] as const;

export function isOptionalGeneratedAppBundleIssue(buildLog: string | null | undefined) {
  const message = typeof buildLog === 'string' ? buildLog.trim() : '';
  if (!message) return false;
  return OPTIONAL_PREVIEW_BUNDLE_PATTERNS.some((pattern) => pattern.test(message));
}

export function normalizeGeneratedAppBundleState(
  input: GeneratedAppBundleStateInput
): {
  bundleStatus: GeneratedAppBundleStatus;
  buildLog?: string;
} {
  const bundleCode = typeof input.bundleCode === 'string' ? input.bundleCode.trim() : '';
  const bundleUrl = typeof input.bundleUrl === 'string' ? input.bundleUrl.trim() : '';
  const buildLog = typeof input.buildLog === 'string' ? input.buildLog.trim() : '';
  const rawStatus = typeof input.bundleStatus === 'string' ? input.bundleStatus.trim().toLowerCase() : '';
  const hasUsableBundle = bundleCode.length > 0 || bundleUrl.length > 0;
  const shouldSkip = !hasUsableBundle && isOptionalGeneratedAppBundleIssue(buildLog);

  if (hasUsableBundle || rawStatus === 'ready') {
    return {
      bundleStatus: 'ready',
      buildLog: buildLog || undefined,
    };
  }

  if (rawStatus === 'skipped' || shouldSkip) {
    return {
      bundleStatus: 'skipped',
      buildLog: shouldSkip ? undefined : buildLog || undefined,
    };
  }

  if (rawStatus === 'failed') {
    return {
      bundleStatus: 'failed',
      buildLog: buildLog || undefined,
    };
  }

  if (buildLog) {
    return {
      bundleStatus: 'failed',
      buildLog,
    };
  }

  return {
    bundleStatus: 'skipped',
  };
}
