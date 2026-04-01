import React from 'react';

import type { GeneratedAppManifest } from '../types';
import type { GeneratedAppComponentProps } from '../generated-app-sdk';

type GeneratedAppModule = {
  default?: React.ComponentType<GeneratedAppComponentProps>;
};

const componentCache = new Map<string, React.ComponentType<GeneratedAppComponentProps>>();

async function resolveBundleCode(manifest: GeneratedAppManifest) {
  if (manifest.draftVersion.bundleCode) {
    return manifest.draftVersion.bundleCode;
  }

  if (manifest.draftVersion.bundleUrl) {
    const response = await fetch(manifest.draftVersion.bundleUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Impossible de charger le bundle de preview (${response.status}).`);
    }
    return await response.text();
  }

  throw new Error("Aucun bundle de preview n'est disponible pour cette app.");
}

export async function loadGeneratedAppComponent(manifest: GeneratedAppManifest) {
  const cacheKey = `${manifest.id}:${manifest.draftVersion.id}:${manifest.draftVersion.bundleHash || 'draft'}`;
  const cached = componentCache.get(cacheKey);
  if (cached) return cached;

  const bundleCode = await resolveBundleCode(manifest);
  const blob = new Blob([bundleCode], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    const mod = await import(/* @vite-ignore */ url) as GeneratedAppModule;
    if (!mod.default) {
      throw new Error("Le bundle genere n'exporte pas de composant par defaut.");
    }
    componentCache.set(cacheKey, mod.default);
    return mod.default;
  } finally {
    URL.revokeObjectURL(url);
  }
}
