import React from 'react';
import ReactDOM from 'react-dom/client';
import '../src/index.css';
import { AgentsHub } from '../src/components/AgentsHub';
import { NasheedStudioWorkspace } from '../src/components/NasheedStudioWorkspace';
import type { AgentFormValues, Message, StudioAgent } from '../src/types';

const now = Date.now();

const previewAgents: StudioAgent[] = [
  {
    id: 'nasheed-studio',
    name: 'Nasheed Studio',
    slug: 'nasheed-studio',
    tagline: 'Compose des nasheeds, refrains et textures devotionnelles dans une vraie surface Lyria.',
    summary: 'Cadre le message, choisis la structure, pilote Lyria 3 et sors un master audio plus une cover si besoin.',
    mission: "Transformer une intention spirituelle ou editoriale en nasheed proprement compose, avec direction sonore claire, moteur Lyria adapte et export final pret a ecouter.",
    whenToUse: "Quand tu veux creer un nasheed, une ambience vocale ou un morceau spirituel sans tomber dans un workflow de podcast ou un simple chat.",
    outputKind: 'music',
    starterPrompt: "Compose un nasheed original a partir de la direction fournie, choisis le bon moteur Lyria puis livre un master final propre.",
    systemInstruction: "Tu es Nasheed Studio, une app Cowork specialisee dans la creation de nasheeds avec Lyria 3.",
    uiSchema: [
      { id: 'direction', label: 'Direction du nasheed', type: 'textarea', required: true, placeholder: 'Le message, la couleur, les voix et le type de refrain', helpText: 'Decris l intensite, les mots cles et l intention musicale.' },
      { id: 'structure', label: 'Structure', type: 'select', options: ['Intro + couplet + refrain', 'Hook court', 'Instrumental', 'Nasheed complet'], helpText: 'Choisis l architecture du morceau.' },
      { id: 'energie', label: 'Energie', type: 'select', options: ['Contemple', 'Ascendant', 'Epic', 'Minimal'], helpText: 'Calibre la poussee et la densite.' },
      { id: 'moteur', label: 'Moteur musical', type: 'select', options: ['Lyria 3 Pro preview', 'Lyria 3 Clip preview', 'Lyria 2 stable'], helpText: 'Lyria 3 pour le rendu ambitieux, Lyria 2 pour le repli robuste.' },
    ],
    tools: ['generate_music_audio', 'generate_image_asset', 'release_file'],
    capabilities: ['Cadre une direction musicale claire', 'Pilote Lyria 3 depuis une vraie surface', 'Livre un master et une cover assortie'],
    status: 'ready',
    createdBy: 'cowork',
    createdAt: now - 1000 * 60 * 60 * 12,
    updatedAt: now - 1000 * 60 * 20,
  },
  {
    id: 'site-issue',
    name: 'Issue Microsite',
    slug: 'issue-microsite',
    tagline: 'Transforme un dossier ou une veille en mini-site narratif.',
    summary: 'Monte une page forte avec hero, sections et direction artistique lisible.',
    mission: 'Prendre une matiere, structurer les sections et livrer un mini-site HTML publiable.',
    whenToUse: 'Quand tu veux une restitution web plus expressive qu un simple memo ou PDF.',
    outputKind: 'html',
    starterPrompt: "Construis un mini-site clair, premium et mobile-first a partir du brief.",
    systemInstruction: 'Tu es Issue Microsite, une app Cowork specialisee web.',
    uiSchema: [
      { id: 'sujet', label: 'Sujet', type: 'textarea', required: true, placeholder: 'Le sujet a transformer en experience web', helpText: 'Donne le coeur du dossier ou de la narration.' },
      { id: 'public', label: 'Public cible', type: 'text', placeholder: 'Equipe produit, client, audience externe...', helpText: 'Permet de calibrer le ton.' },
      { id: 'format', label: 'Format', type: 'select', options: ['Mini-site', 'Landing page', 'Page outil'], helpText: 'Choisis la structure produit.' },
    ],
    tools: ['web_search', 'web_fetch', 'write_file', 'release_file'],
    capabilities: ['Structure un recit visuel', 'Genere une page responsive', 'Sort un livrable publiable'],
    status: 'ready',
    createdBy: 'cowork',
    createdAt: now - 1000 * 60 * 60 * 48,
    updatedAt: now - 1000 * 60 * 60 * 3,
  },
  {
    id: 'dossier-premium',
    name: 'Dossier Premium',
    slug: 'dossier-premium',
    tagline: 'Produit des dossiers PDF sourcés avec vraie mise en page.',
    summary: 'Assemble recherche, structure et direction editoriale dans un atelier PDF.',
    mission: 'Fabriquer un document source, structuré et publiable sans perdre la qualité de forme.',
    whenToUse: 'Quand tu veux une note, un rapport ou un dossier premium a envoyer tel quel.',
    outputKind: 'pdf',
    starterPrompt: 'Cadre le sujet, ouvre les bonnes sources puis livre un PDF premium.',
    systemInstruction: 'Tu es Dossier Premium, une app Cowork specialisee PDF.',
    uiSchema: [
      { id: 'objectif', label: 'Objectif', type: 'textarea', required: true, placeholder: 'Le dossier a produire', helpText: 'Explique le livrable attendu.' },
      { id: 'detail', label: 'Niveau de detail', type: 'select', options: ['Compact', 'Dense', 'Magazine'], helpText: 'Choisis la profondeur du document.' },
      { id: 'sources', label: 'Sources requises', type: 'boolean', helpText: 'Force une recherche plus solide avant la redaction.' },
    ],
    tools: ['web_search', 'web_fetch', 'begin_pdf_draft', 'append_to_draft', 'review_pdf_draft', 'create_pdf', 'release_file'],
    capabilities: ['Structure un plan solide', 'Travaille les sources', 'Livre un PDF premium'],
    status: 'ready',
    createdBy: 'cowork',
    createdAt: now - 1000 * 60 * 60 * 72,
    updatedAt: now - 1000 * 60 * 60 * 10,
  },
  {
    id: 'signal-desk',
    name: 'Signal Desk',
    slug: 'signal-desk',
    tagline: 'Cherche, ouvre et tranche pour sortir un memo de decision.',
    summary: 'Cartographie un sujet, lit les sources directes et remonte les vrais signaux.',
    mission: 'Produire une synthese courte mais etayee sur un sujet large ou un marche flou.',
    whenToUse: 'Quand tu veux une recherche serieuse avant de prendre une decision.',
    outputKind: 'research',
    starterPrompt: 'Ouvre plusieurs sources, compare les signaux puis sors un memo actionnable.',
    systemInstruction: 'Tu es Signal Desk, une app Cowork specialisee research.',
    uiSchema: [
      { id: 'question', label: 'Question cle', type: 'textarea', required: true, placeholder: 'La question ou le benchmark a traiter', helpText: 'Cible la vraie decision a prendre.' },
      { id: 'zone', label: 'Zone', type: 'text', placeholder: 'Europe, France, Global...', helpText: 'Affine le terrain d analyse.' },
    ],
    tools: ['web_search', 'web_fetch'],
    capabilities: ['Cartographie vite un sujet', 'Lit les sources directes', 'Sort un memo net'],
    status: 'ready',
    createdBy: 'manual',
    createdAt: now - 1000 * 60 * 60 * 120,
    updatedAt: now - 1000 * 60 * 60 * 18,
  },
];

const workspaceValues: AgentFormValues = {
  direction: 'Nasheed chaleureux et eleve sur la gratitude, refrain ample, voix masculines douces, percussion legere et sensation d aube.',
  structure: 'Nasheed complet',
  energie: 'Ascendant',
  moteur: 'Lyria 3 Pro preview',
};

const workspaceMessages: Message[] = [
  {
    id: 'preview-model-1',
    role: 'model',
    content: 'Master nasheed cree. Le refrain est plus ample, la texture percussive reste discrete et une cover associee a ete preparee pour la livraison finale.',
    attachments: [
      {
        id: 'preview-audio',
        type: 'audio',
        url: '/tmp/duo-smoke.wav',
        mimeType: 'audio/wav',
        name: 'nasheed-master.wav',
      },
      {
        id: 'preview-cover',
        type: 'image',
        url: '/tmp/qa-image-test.png',
        mimeType: 'image/png',
        name: 'nasheed-cover.png',
      },
    ],
    activity: [
      {
        id: 'activity-1',
        kind: 'status',
        timestamp: now,
        iteration: 1,
        title: 'Direction verrouillee',
        message: 'Le message, la structure et l energie du morceau ont ete stabilises avant generation.',
      },
      {
        id: 'activity-2',
        kind: 'tool_result',
        timestamp: now,
        iteration: 2,
        title: 'Generation Lyria',
        message: 'Un premier master Lyria 3 Pro a ete rendu puis retenu comme base finale.',
        toolName: 'generate_music_audio',
      },
      {
        id: 'activity-3',
        kind: 'tool_result',
        timestamp: now,
        iteration: 3,
        title: 'Cover associee',
        message: 'Une cover assortie a ete exportee pour accompagner le master.',
        toolName: 'generate_image_asset',
      },
    ],
    runState: 'completed',
    runMeta: {
      iterations: 3,
      modelCalls: 2,
      toolCalls: 2,
      searchCount: 0,
      fetchCount: 0,
      sourcesOpened: 0,
      domainsOpened: 0,
      artifactState: 'released',
      stalledTurns: 0,
      retryCount: 0,
      queueWaitMs: 0,
      mode: 'autonomous',
      phase: 'delivery',
      taskComplete: true,
      inputTokens: 0,
      outputTokens: 0,
      thoughtTokens: 0,
      toolUseTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
      estimatedCostEur: 0,
    },
    createdAt: now,
  },
];

function PreviewApp() {
  const search = new URLSearchParams(window.location.search);
  const view = search.get('view') || 'store';
  const previewAgent = previewAgents[0];

  if (view === 'workspace') {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-text)]">
        <NasheedStudioWorkspace
          agent={previewAgent}
          formValues={workspaceValues}
          messages={workspaceMessages}
          isRunning={false}
          onFieldChange={() => {}}
          onRunAgent={() => {}}
          onAskCowork={() => {}}
          onBackToHub={() => {}}
          setSelectedImage={() => {}}
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[var(--app-bg)] text-[var(--app-text)]">
      <AgentsHub
        isOpen
        agents={previewAgents}
        isCreating={false}
        isRunningAgent={false}
        latestCreatedAgent={previewAgents[0]}
        onClose={() => {}}
        onCreateAgent={() => {}}
        onRunAgent={() => {}}
      />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PreviewApp />
  </React.StrictMode>
);
