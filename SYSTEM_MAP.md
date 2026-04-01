# SYSTEM MAP

## Points d'entree
- `src/App.tsx` : shell principal, routing de modes, sessions, runtime chat/cowork/agent, branchement du hub.
- `api/index.ts` : point d'entree backend unique pour Vercel/Express, boucle Cowork et runtime outille.
- `server/routes/standard.ts` : routes standard non-Cowork (`/api/chat`, media, status, etc.).

## Frontend - zones cle
- `src/components/AgentsHub.tsx` : store `Cowork Apps`, vitrine, featured apps, detail de l'app selectionnee et poste de lancement.
- `src/components/AgentAppPreview.tsx` : bibliotheque de previews/studios par famille d'app (`pdf`, `html`, `podcast`, `code`, `research`, `automation`) avec palettes derivees par app.
- `src/components/AgentWorkspacePanel.tsx` : studio dedie d'une app ouverte, distinct du shell Cowork general.
- `src/components/SidebarLeft.tsx` : navigation, historique, sections chat/agents.
- `src/components/SidebarRight.tsx` : modele, capacites et reglages.
- `src/components/MessageItem.tsx` / `ChatInput.tsx` : conversation et composition.

## Donnees / types
- `src/types.ts` : types sessions, messages, agents/hub.
- `src/store/useStore.ts` : etat UI persistant (mode, session active, memorisation par mode).
- `src/utils/agentSnapshots.ts` : cache local-first des agents/hub.
- `src/utils/sessionShells.ts` : cache local-first des sessions.

## Backend - logique agentique
- `server/lib/agents.ts` : bibliotheque d'outils agents, blueprints et logique de creation/revision.
- `src/utils/cowork.ts` : hydratation des evenements SSE Cowork cote frontend.
- `src/utils/chat-parts.ts` et `server/lib/chat-parts.ts` : serialisation d'historique et pieces jointes.

## Flux critique Hub -> usage
1. Cowork cree ou modifie un blueprint/app.
2. Le frontend persiste l'entite hub localement puis en best effort vers Firestore.
3. `AgentsHub` la rend comme une app du store, avec positionnement produit et preview liee a `outputKind`.
4. L'ouverture lance un studio dedie via `AgentWorkspacePanel`.
5. Le runtime agent continue de tourner sur `/api/cowork`, mais la surface utilisateur est celle d'une app Cowork et non d'un agent abstrait.

## Fichiers chauds par type de changement
- Refonte visuelle hub/app store : `src/components/AgentsHub.tsx`, `src/components/AgentAppPreview.tsx`, `src/components/AgentWorkspacePanel.tsx`, `src/App.tsx`, `src/index.css`.
- Changement de contrat agent/app : `src/types.ts`, `server/lib/agents.ts`, `src/utils/agentSnapshots.ts`.
- Changement d'ouverture/workspace : `src/App.tsx`, `src/store/useStore.ts`.
