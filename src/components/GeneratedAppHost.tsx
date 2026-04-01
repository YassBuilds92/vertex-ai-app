import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Loader2, UploadCloud } from 'lucide-react';

import type { AgentFormValues, GeneratedAppManifest, Message } from '../types';
import { GeneratedAppCanvas } from '../generated-app-sdk';
import { loadGeneratedAppComponent } from '../utils/generatedAppBundle';

interface GeneratedAppHostProps {
  manifest: GeneratedAppManifest;
  formValues: AgentFormValues;
  messages: Message[];
  isRunning: boolean;
  isPublishing: boolean;
  onBackToHub: () => void;
  onFieldChange: (fieldId: string, value: string | boolean) => void;
  onRunApp: () => Promise<unknown> | void;
  onPublishApp: () => Promise<unknown> | void;
  onAskCowork: (request: string) => Promise<unknown> | void;
}

export const GeneratedAppHost: React.FC<GeneratedAppHostProps> = ({
  manifest,
  formValues,
  messages,
  isRunning,
  isPublishing,
  onBackToHub,
  onFieldChange,
  onRunApp,
  onPublishApp,
  onAskCowork,
}) => {
  const [bundleLoadState, setBundleLoadState] = useState<'idle' | 'loading' | 'ready' | 'failed' | 'skipped'>('idle');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoadError(null);

    if (
      manifest.draftVersion.bundleStatus === 'skipped'
      || (!manifest.draftVersion.bundleCode && !manifest.draftVersion.bundleUrl)
    ) {
      setBundleLoadState('skipped');
      return () => {
        cancelled = true;
      };
    }

    setBundleLoadState('loading');

    void loadGeneratedAppComponent(manifest)
      .then(() => {
        if (!cancelled) {
          setBundleLoadState('ready');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setBundleLoadState('failed');
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [manifest]);

  const canPublish = Boolean(
    !isPublishing
    && (manifest.draftVersion.sourceCode || manifest.draftVersion.sourceUrl)
    && (!manifest.publishedVersion || manifest.publishedVersion.id !== manifest.draftVersion.id)
  );
  const bundleStatus = useMemo(() => {
    if (bundleLoadState === 'failed') return 'failed';
    if (bundleLoadState === 'ready') return 'ready';
    return manifest.draftVersion.bundleStatus;
  }, [bundleLoadState, manifest.draftVersion.bundleStatus]);
  const diagnosticsMessage = loadError || (bundleStatus === 'failed' ? manifest.draftVersion.buildLog || null : null);
  const featureDeck = useMemo(() => manifest.capabilities.slice(0, 4), [manifest.capabilities]);

  return (
    <section className="relative flex min-h-[100dvh] w-full flex-col overflow-hidden bg-[#03070d] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_10%,rgba(91,214,255,0.12),transparent_24%),radial-gradient(circle_at_86%_12%,rgba(255,174,92,0.08),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]" />

      <header className="relative z-10 border-b border-white/10 px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1520px] flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBackToHub}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-white/80 transition-colors hover:bg-white/[0.08]"
            >
              <ArrowLeft size={15} />
              Retour a l'accueil
            </button>
            <div>
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/34">Generated App Host</div>
              <div className="mt-1 text-base font-semibold tracking-tight text-white">{manifest.name}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-white/62">
              draft {manifest.draftVersion.id}
            </span>
            <span
              className="rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.18em]"
              style={{
                borderColor:
                  bundleStatus === 'failed'
                    ? 'rgba(252, 165, 165, 0.22)'
                    : bundleStatus === 'ready'
                      ? 'rgba(134, 239, 172, 0.22)'
                      : 'rgba(255,255,255,0.12)',
                background:
                  bundleStatus === 'failed'
                    ? 'rgba(251, 113, 133, 0.09)'
                    : bundleStatus === 'ready'
                      ? 'rgba(74, 222, 128, 0.08)'
                      : 'rgba(255,255,255,0.04)',
                color:
                  bundleStatus === 'failed'
                    ? 'rgba(255, 228, 230, 0.92)'
                    : bundleStatus === 'ready'
                      ? 'rgba(236, 253, 245, 0.92)'
                      : 'rgba(255,255,255,0.72)',
              }}
            >
              bundle {bundleStatus}
            </span>
            <span className="rounded-full border border-cyan-300/14 bg-cyan-300/[0.08] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-cyan-50/84">
              preview native
            </span>
            {manifest.publishedVersion && (
              <span className="rounded-full border border-emerald-300/18 bg-emerald-300/[0.08] px-3 py-2 text-[11px] uppercase tracking-[0.18em] text-emerald-50/84">
                live {manifest.publishedVersion.id}
              </span>
            )}
            <button
              type="button"
              onClick={() => void onPublishApp()}
              disabled={!canPublish}
              className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isPublishing ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
              Publier la draft
            </button>
          </div>
        </div>
      </header>

      <main className="relative z-10 flex-1 overflow-y-auto px-4 py-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1520px]">
          <div className="mb-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.42fr)]">
            <div className="rounded-[1.6rem] border border-cyan-300/10 bg-cyan-300/[0.05] px-5 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cyan-300/16 bg-cyan-300/[0.08] text-cyan-100">
                  <CheckCircle2 size={16} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-cyan-50">Preview native active</div>
                  <p className="mt-1 text-sm leading-6 text-cyan-50/72">
                    Le host rend cette app directement depuis son manifest. Le bundle reste un diagnostic secondaire, sans bloquer l'ouverture ni la publication.
                  </p>
                </div>
              </div>
            </div>

            <div
              className="rounded-[1.6rem] border px-5 py-4"
              style={{
                borderColor: bundleStatus === 'failed' ? 'rgba(252,165,165,0.18)' : 'rgba(255,255,255,0.1)',
                background: bundleStatus === 'failed' ? 'rgba(251,113,133,0.07)' : 'rgba(255,255,255,0.03)',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
                  style={{
                    borderColor: bundleStatus === 'failed' ? 'rgba(252,165,165,0.22)' : 'rgba(255,255,255,0.12)',
                    background: bundleStatus === 'failed' ? 'rgba(251,113,133,0.08)' : 'rgba(255,255,255,0.04)',
                    color: bundleStatus === 'failed' ? 'rgba(255,228,230,0.94)' : 'rgba(255,255,255,0.72)',
                  }}
                >
                  {bundleLoadState === 'loading' ? <Loader2 size={16} className="animate-spin" /> : <AlertTriangle size={16} />}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {bundleStatus === 'failed'
                      ? 'Bundle de preview en echec'
                      : bundleStatus === 'ready'
                        ? 'Bundle de preview valide'
                        : bundleStatus === 'skipped'
                          ? 'Bundle de preview saute'
                        : bundleLoadState === 'loading'
                          ? 'Verification du bundle'
                          : 'Bundle optionnel'}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-white/64">
                    {bundleStatus === 'failed'
                      ? 'La draft reste utilisable et publiable via le rendu natif.'
                      : bundleStatus === 'ready'
                        ? 'Le bundle compile aussi correctement pour le host.'
                        : bundleStatus === 'skipped'
                          ? 'Cet environnement garde le rendu natif comme chemin principal, sans penaliser l ouverture.'
                        : bundleLoadState === 'loading'
                          ? 'Le host verifie le bundle en arriere-plan.'
                          : 'Aucun bundle n est requis pour cette ouverture.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {diagnosticsMessage && (
            <div className="mb-4 rounded-[1.8rem] border border-white/10 bg-black/24 p-5">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">Diagnostic bundle</div>
              {loadError && <p className="mt-3 text-sm leading-6 text-rose-50/84">{loadError}</p>}
              <pre className="mt-3 overflow-x-auto rounded-[1.2rem] border border-white/10 bg-black/28 p-4 text-xs leading-6 text-white/70">
                {diagnosticsMessage}
              </pre>
            </div>
          )}

          <GeneratedAppCanvas
            manifest={manifest}
            featureDeck={featureDeck}
            formValues={formValues}
            isRunning={isRunning}
            messages={messages}
            onFieldChange={onFieldChange}
            onRun={onRunApp}
            onPublish={onPublishApp}
            canPublish={canPublish}
            onAskCowork={onAskCowork}
          />
        </div>
      </main>
    </section>
  );
};
