# SYSTEM MAP

## Points d'entree
- `src/App.tsx` : shell principal, routing de modes, sessions, runtime chat/cowork/agent, branchement du hub.
- `api/index.ts` : point d'entree backend unique pour Vercel/Express, boucle Cowork et runtime outille.
- `server/routes/standard.ts` : routes standard non-Cowork (`/api/chat`, media, status, etc.).

## Frontend - zones cle
- `src/components/AgentsHub.tsx` : vue plein ecran `Cowork Apps`, type "autre app dans l'app", avec selection minimale d'apps + barre de creation en bas.
- `src/components/AgentAppPreview.tsx` : bibliotheque de previews/studios par famille d'app (`pdf`, `html`, `music`, `podcast`, `code`, `research`, `automation`) avec palettes derivees par app.
- `src/components/AgentWorkspacePanel.tsx` : studio dedie d'une app ouverte, distinct du shell Cowork general.
- `src/components/NasheedStudioWorkspace.tsx` : surface plein ecran specialisee pour les apps musicales/Nasheed, sans timeline de chat visible.
- `src/components/SidebarLeft.tsx` : navigation, historique, sections chat/agents.
- `src/components/SidebarRight.tsx` : modele, capacites et reglages.
- `src/components/MessageItem.tsx` / `ChatInput.tsx` : conversation et composition.

## Donnees / types
- `src/types.ts` : types sessions, messages, agents/hub, dont `outputKind: music`.
- `src/store/useStore.ts` : etat UI persistant (mode, session active, memorisation par mode).
- `src/utils/agentSnapshots.ts` : cache local-first des agents/hub.
- `src/utils/sessionShells.ts` : cache local-first des sessions.
- `src/utils/agentStudio.ts` : detection des apps a rendre comme surfaces specialisees (`nasheed` vs fallback standard).

## Backend - logique agentique
- `server/lib/agents.ts` : bibliotheque d'outils agents, blueprints et logique de creation/revision.
- `src/utils/cowork.ts` : hydratation des evenements SSE Cowork cote frontend.
- `src/utils/chat-parts.ts` et `server/lib/chat-parts.ts` : serialisation d'historique et pieces jointes.

## Flux critique Hub -> usage
1. Cowork cree ou modifie un blueprint/app.
2. Le frontend persiste l'entite hub localement puis en best effort vers Firestore.
3. Quand l'utilisateur ouvre `Cowork Apps`, `App.tsx` quitte temporairement le shell normal et rend une vue plein ecran dediee.
4. `AgentsHub` y rend les apps comme un lobby d'icones/noms avec une creation par chatbox basse.
5. L'ouverture d'une app lance d'abord soit une surface specialisee plein ecran (`NasheedStudioWorkspace` pour les apps `music`/nasheed), soit `AgentWorkspacePanel` pour les autres apps, sans auto-run immediat.
6. Le runtime agent continue de tourner sur `/api/cowork`, mais la surface utilisateur est celle d'une app Cowork et non d'un agent abstrait.

## Fichiers chauds par type de changement
- Refonte visuelle hub/app plein ecran : `src/components/AgentsHub.tsx`, `src/components/AgentAppPreview.tsx`, `src/components/AgentWorkspacePanel.tsx`, `src/components/NasheedStudioWorkspace.tsx`, `src/App.tsx`, `src/index.css`.
- Changement de contrat agent/app : `src/types.ts`, `server/lib/agents.ts`, `src/utils/agentSnapshots.ts`, `src/utils/agentStudio.ts`.
- Changement d'ouverture/workspace : `src/App.tsx`, `src/store/useStore.ts`.
