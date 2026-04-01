import React, { useEffect, useState } from 'react';
import { ArrowLeft, Loader2, UploadCloud } from 'lucide-react';

import type { AgentFormValues, GeneratedAppManifest, Message } from '../types';
import type { GeneratedAppComponentProps } from '../generated-app-sdk';
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
  const [AppComponent, setAppComponent] = useState<React.ComponentType<GeneratedAppComponentProps> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setAppComponent(null);
    setLoadError(null);

    void loadGeneratedAppComponent(manifest)
      .then((component) => {
        if (!cancelled) {
          setAppComponent(() => component);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : String(error));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [manifest]);

  const canPublish = Boolean(
    !isPublishing
    && manifest.status !== 'failed'
    && (manifest.draftVersion.bundleCode || manifest.draftVersion.bundleUrl)
    && (!manifest.publishedVersion || manifest.publishedVersion.id !== manifest.draftVersion.id)
  );

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
              Retour au store
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
          {loadError ? (
            <div className="rounded-[2rem] border border-rose-300/16 bg-rose-300/[0.08] p-6">
              <div className="text-sm font-semibold text-rose-50">Le bundle de cette draft n'a pas pu etre charge.</div>
              <p className="mt-3 text-sm leading-6 text-rose-50/80">{loadError}</p>
              {manifest.draftVersion.buildLog && (
                <pre className="mt-4 overflow-x-auto rounded-[1.4rem] border border-white/10 bg-black/25 p-4 text-xs leading-6 text-white/70">
                  {manifest.draftVersion.buildLog}
                </pre>
              )}
            </div>
          ) : AppComponent ? (
            <AppComponent
              manifest={manifest}
              formValues={formValues}
              isRunning={isRunning}
              messages={messages}
              onFieldChange={onFieldChange}
              onRun={onRunApp}
              onPublish={onPublishApp}
              canPublish={canPublish}
              onAskCowork={onAskCowork}
            />
          ) : (
            <div className="flex min-h-[60vh] items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.03]">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/72">
                <Loader2 size={15} className="animate-spin" />
                Chargement de la draft...
              </div>
            </div>
          )}
        </div>
      </main>
    </section>
  );
};
