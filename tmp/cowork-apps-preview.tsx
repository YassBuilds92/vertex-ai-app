import React from 'react';
import ReactDOM from 'react-dom/client';
import '../src/index.css';
import { AgentsHub } from '../src/components/AgentsHub';
import { AgentWorkspacePanel } from '../src/components/AgentWorkspacePanel';
import type { AgentFormValues, StudioAgent } from '../src/types';

const now = Date.now();

const previewAgents: StudioAgent[] = [
  {
    id: 'podcast-editorial',
    name: 'Briefing Sonore',
    slug: 'briefing-sonore',
    tagline: "Veille, script, voix, bed musical et master final dans une meme app.",
    summary: "Transforme un sujet d'actualite en episode court, credible et pret a publier.",
    mission: "Cadrer un angle, produire un script original, generer la narration, ajouter l'habillage sonore et livrer un master final exploitable.",
    whenToUse: "Quand tu veux un podcast ou un flash audio qui sorte proprement sans devoir bricoler les pistes a la main.",
    outputKind: 'podcast',
    starterPrompt: "Prends le sujet fourni, ecris un angle clair, structure l'episode puis livre un master final.",
    systemInstruction: "Tu es Briefing Sonore, une app Cowork specialisee podcast.",
    uiSchema: [
      { id: 'angle', label: 'Angle editorial', type: 'textarea', required: true, placeholder: "Le sujet et l'angle a traiter", helpText: "Decris l'angle, le ton et le public vise." },
      { id: 'duree', label: 'Duree cible', type: 'select', options: ['2 min', '5 min', '8 min'], helpText: "Calibre le format de l'episode." },
      { id: 'cover', label: 'Generer cover', type: 'boolean', helpText: "Ajoute une cover en plus du master audio." },
    ],
    tools: ['web_search', 'web_fetch', 'create_podcast_episode', 'generate_image_asset', 'release_file'],
    capabilities: ['Ecrit un angle audio clair', 'Livre un master final mixe', 'Peut generer une cover assortie'],
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
  angle: 'Fais un briefing de 5 minutes sur les nouveaux usages IA en PME, ton clair et vivant.',
  duree: '5 min',
  cover: true,
};

function PreviewApp() {
  const search = new URLSearchParams(window.location.search);
  const view = search.get('view') || 'store';
  const previewAgent = previewAgents[0];

  if (view === 'workspace') {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] px-6 py-8 text-[var(--app-text)]">
        <AgentWorkspacePanel
          agent={previewAgent}
          formValues={workspaceValues}
          isRunning={false}
          onFieldChange={() => {}}
          onRunAgent={() => {}}
          onAskCowork={() => {}}
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
