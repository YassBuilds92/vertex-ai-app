# NOW

## Objectif actuel
- Revalider en conditions reelles la navigation `Cowork Apps` apres le correctif retour accueil : une app ouverte (`Nasheed Studio` / generated app) ne doit plus devenir la surface de fond quand on revient au hub.
- Puis rejouer le pivot `generated app` : creation -> ouverture dans `GeneratedAppHost` -> run -> publication -> evolution Cowork -> nouvelle draft.

## Blocage actuel
- Pas de blocage code immediat : le correctif de navigation compile et bundle.
- La validation visuelle automatisee reste partielle sur cette machine :
  - Playwright MCP bloque sur une permission Windows hors workspace
  - l'outil screenshot desktop a echoue cote handle natif
- Le flux reel `retour a l'accueil depuis Nasheed Studio / GeneratedAppHost` reste a observer dans la vraie app authentifiee avec Firestore/Vertex actifs.
- Le flux complet `create generated app -> publish -> update draft` reste a rejouer dans la vraie app authentifiee avec Firestore/Vertex actifs.

## Prochaine action exacte
- Ouvrir `Cowork Apps` dans la vraie app et verifier d'abord la navigation :
  - ouvrir `Nasheed Studio`
  - cliquer `Retour a l'accueil`
  - fermer le hub pour confirmer qu'on reste bien sur l'accueil Cowork et pas sur la session app precedente
- Ensuite verifier un flux reel sur 2 cas :
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
- Rejouer en vrai le retour `app ouverte -> Retour a l'accueil -> fermeture du hub` pour confirmer que `Nasheed Studio` ne reste plus la surface de fond.
- Rejouer en vrai le flux `create -> open -> run -> publish -> update` sur session authentifiee.
- Verifier un cas `Pokemon` (image) et un cas `Nasheed` (music).
- Confirmer qu'une draft en echec de build remonte bien son `buildLog` dans le host.
- Revalider desktop/mobile dans le shell complet, pas seulement via code/lint/build.

## Risques immediats
- Le correctif `Retour a l'accueil` repose maintenant sur `activateMode('cowork')` ; il faut l'observer sur un vrai compte pour confirmer qu'il n'introduit pas de regression sur la reprise des workspaces `agent-*` et `gapp-*`.
- La preuve visuelle du `GeneratedAppHost` n'a pas encore ete capturee a cause des limites outils locales.
- Le chunk principal reste lourd ; non bloquant pour ce lot, mais a garder en tete si le host genere grossit encore.
