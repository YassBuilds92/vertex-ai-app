# SYSTEM MAP

## Points d'entree
- `src/App.tsx` : shell principal, routing de modes, sessions et runtime chat/cowork/agent. Les anciennes sessions `generated_app` sont maintenant redirigees vers `Cowork` au lieu d'ouvrir une surface `Cowork Apps`.
- `api/index.ts` : point d'entree backend unique pour Vercel/Express, boucle Cowork, runtime outille et nouveau chemin `appRuntime`.
- `server/routes/standard.ts` : routes standard non-Cowork (`/api/chat`, media, status) + endpoints `generated-apps/create` et `generated-apps/publish`.
- `server/lib/generated-apps.ts` : generation de manifest, rendu TSX, bundling, upload best-effort et lifecycle draft/published/failed.
- `cloud-run/cowork-workers/src/index.js` : nouveau service Cloud Run externe pour les capacites lourdes/isolees de Cowork v2. Phase 0 expose seulement `/health` + des routes reservees `501`.

## Frontend - zones cle
- `src/components/AgentAppPreview.tsx` : bibliotheque de previews/studios par famille d'app (`pdf`, `html`, `music`, `podcast`, `code`, `research`, `automation`) avec palettes derivees par app.
- `src/components/AgentWorkspacePanel.tsx` : studio dedie d'une app ouverte, distinct du shell Cowork general.
- `src/components/GeneratedAppHost.tsx` : host legacy d'une generated app. Il reste dans le repo mais n'est plus expose par le shell principal.
- `src/components/NasheedStudioWorkspace.tsx` : surface plein ecran specialisee pour les apps musicales/Nasheed, sans timeline de chat visible.
- `src/components/SidebarLeft.tsx` : navigation, historique, sections chat/agents. Les sessions `generated_app` ne sont plus listees dans la navigation.
- `src/components/SidebarRight.tsx` : modele, capacites et reglages avances, avec reset des defaults Google; ne plus reintroduire de section Raffineur IA ni Hub Agents.
- `src/components/MessageItem.tsx` / `ChatInput.tsx` : conversation et composition.
- `src/generated-app-sdk.tsx` : mini-SDK frontend partage rendu par les bundles generes.

## Donnees / types
- `src/types.ts` : types sessions, messages, agents legacy et `GeneratedAppManifest`.
- `src/store/useStore.ts` : etat UI persistant (mode, session active, memorisation par mode).
- `src/utils/agentSnapshots.ts` : cache local-first des agents/hub.
- `src/utils/generatedAppSnapshots.ts` : cache local-first des generated apps.
- `src/utils/sessionShells.ts` : cache local-first des sessions.
- `src/utils/generatedAppBundle.ts` : charge dynamiquement le bundle ESM d'une generated app.
- `src/utils/agentStudio.ts` : detection des apps a rendre comme surfaces specialisees (`nasheed` vs fallback standard).
- `src/utils/generation-defaults.ts` : defaults visibles de generation (`temperature`, `topP`, `topK`, `maxOutputTokens`) et detection d'un ecart utilisateur pour afficher le reset.

## Backend - logique agentique
- `server/lib/agents.ts` : bibliotheque d'outils agents, blueprints et logique de creation/revision.
- `server/lib/generated-apps.ts` : equivalent cote generated apps, avec source + bundle versionnes.
- `server/lib/cowork-workers.ts` : client unique vers le worker Cloud Run (bearer auth, retry, SSE passthrough).
- `server/lib/chunking.ts` : extraction PDF + chunking texte pour le RAG text-first.
- `server/lib/embeddings.ts` : wrapper Vertex embeddings pour Cowork.
- `server/lib/qdrant.ts` : client REST Qdrant, collection/indexes et requetes vectorielles.
- `server/lib/cowork-memory.ts` : orchestration index/search/recall/forget de la memoire Cowork.
- `src/utils/cowork.ts` : hydratation des evenements SSE Cowork cote frontend.
- `src/utils/chat-parts.ts` et `server/lib/chat-parts.ts` : serialisation d'historique et pieces jointes.

## Infra externe
- `cloud-run/cowork-workers/` : sous-projet de service Cloud Run autonome, avec `Dockerfile`, `cloudbuild.yaml`, `README.md` et un runtime Node 22 minimal.
- Les futures capacites RAG/sandbox/browser/healing doivent passer par `server/lib/cowork-workers.ts` plutot que d'appeler Cloud Run a la main depuis `api/index.ts`.

## Flux critique Generated App
1. L'utilisateur ou Cowork demande une nouvelle app experte.
2. `server/lib/generated-apps.ts` genere un `GeneratedAppManifest`, puis `sourceCode` TSX et `bundleCode` ESM.
3. Le frontend persiste cette app localement puis en best effort vers `users/{uid}/generatedApps/{appId}`.
4. Le shell principal n'expose plus de launcher `Cowork Apps`; une session `generated_app` historique est maintenant renvoyee vers `Cowork`.
5. `GeneratedAppHost` reste disponible comme composant legacy mais n'est plus route depuis le shell principal.
6. Un run passe par `/api/cowork` avec `appRuntime` ; le backend remplace la posture Cowork generale par le `systemInstruction` specialise, la `toolAllowList` et le `modelProfile` de l'app.
7. `Publier la draft` recopie `draftVersion` vers `publishedVersion`.
8. Une demande d'evolution via Cowork emet un nouvel evenement `generated_app_manifest` et regenere une draft sur le meme `id`, sans casser la version live.

## Fichiers chauds par type de changement
- Refonte visuelle Cowork/app plein ecran : `src/components/AgentAppPreview.tsx`, `src/components/GeneratedAppHost.tsx`, `src/generated-app-sdk.tsx`, `src/components/NasheedStudioWorkspace.tsx`, `src/App.tsx`, `src/index.css`.
- Changement de contrat generated app : `src/types.ts`, `server/lib/schemas.ts`, `server/lib/generated-apps.ts`, `src/utils/generatedAppSnapshots.ts`.
- Changement runtime/Cowork : `api/index.ts`, `src/utils/cowork.ts`, `src/App.tsx`.
- Changement de persistance/reprise : `src/utils/sessionRecovery.ts`, `src/utils/sessionShells.ts`, `firestore.rules`.
- Changement Cowork v2 / worker externe : `server/lib/cowork-workers.ts`, `server/lib/config.ts`, `cloud-run/cowork-workers/*`, `test-cowork-workers.ts`, puis plus tard `server/lib/embeddings.ts`, `server/lib/qdrant.ts`, `server/lib/github.ts`, `server/lib/vercel.ts`.
- Changement Cowork v2 / memoire RAG : `api/index.ts`, `server/lib/chunking.ts`, `server/lib/embeddings.ts`, `server/lib/qdrant.ts`, `server/lib/cowork-memory.ts`, `src/App.tsx`, `src/utils/cowork.ts`, `src/components/MessageItem.tsx`, `test-cowork-rag.ts`.
