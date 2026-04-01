# NOW

## Objectif actuel
- Revalider en conditions reelles le pivot `generated app` : creation -> ouverture dans `GeneratedAppHost` -> run -> publication -> evolution Cowork -> nouvelle draft, sans retomber dans l'ancien modele "hub d'agents".

## Blocage actuel
- Pas de blocage code immediat : le socle compile et bundle.
- La validation visuelle automatisee reste partielle sur cette machine :
  - Playwright MCP bloque sur une permission Windows hors workspace
  - l'outil screenshot desktop a echoue cote handle natif
- Le flux complet `create generated app -> publish -> update draft` reste a rejouer dans la vraie app authentifiee avec Firestore/Vertex actifs.

## Prochaine action exacte
- Ouvrir `Cowork Apps` dans la vraie app puis verifier un flux reel sur 2 cas :
  - `app de cartes Pokemon personnalisees`
  - `app nasheed`
- Pour chaque cas, confirmer que :
  - la creation passe bien par `/api/generated-apps/create`
  - l'entite apparait dans le store puis s'ouvre dans `GeneratedAppHost`
  - le run utilise bien `appRuntime` avec le `systemInstruction`, les champs UI et la `toolAllowList` de l'app
  - `Publier la draft` fige bien une version live
  - une evolution via Cowork regenere une nouvelle draft sans ecraser la version publiee

## Fichiers chauds
- `src/App.tsx`
- `api/index.ts`
- `server/lib/generated-apps.ts`
- `server/routes/standard.ts`
- `src/components/GeneratedAppHost.tsx`
- `src/generated-app-sdk.tsx`
- `src/utils/generatedAppBundle.ts`
- `src/utils/generatedAppSnapshots.ts`
- `src/utils/sessionRecovery.ts`
- `src/utils/sessionShells.ts`
- `QA_RECIPES.md`
- `SESSION_STATE.md`
- `COWORK.md`
- `DECISIONS.md`
- `SYSTEM_MAP.md`

## Validations restantes
- Rejouer en vrai le flux `create -> open -> run -> publish -> update` sur session authentifiee.
- Verifier un cas `Pokemon` (image) et un cas `Nasheed` (music).
- Confirmer qu'une draft en echec de build remonte bien son `buildLog` dans le host.
- Revalider desktop/mobile dans le shell complet, pas seulement via code/lint/build.

## Risques immediats
- Le correctif de reparation de sessions attend maintenant le chargement des catalogues agents/apps ; il faut l'observer sur un vrai compte pour confirmer la reprise des workspaces `agent-*` et `gapp-*`.
- La preuve visuelle du `GeneratedAppHost` n'a pas encore ete capturee a cause des limites outils locales.
- Le chunk principal reste lourd ; non bloquant pour ce lot, mais a garder en tete si le host genere grossit encore.
