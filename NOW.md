# NOW

## Objectif actuel
- Revalider en conditions reelles `Cowork Apps` apres le correctif creation + densite :
  - la creation d'une generated app ne doit plus echouer avec `Cannot read properties of undefined (reading 'length')`
  - le hub doit rester lisible, aere et sans texte coupe sur desktop standard
- Puis rejouer le pivot `generated app` : creation -> ouverture dans `GeneratedAppHost` -> run -> publication -> evolution Cowork -> nouvelle draft.

## Blocage actuel
- Pas de blocage code immediat :
  - le bug serveur `sanitizeFields()` sur `options.length` est corrige
  - le hub a ete recompacte et revalide visuellement via captures Edge headless
- Les limites restantes sont surtout de validation produit reelle :
  - le flux authentifie `create generated app -> publish -> update draft` reste a observer dans la vraie app
  - `GeneratedAppHost` n'a pas encore de preuve visuelle automatisee fiable sur cette machine
  - le rendu mobile du lobby est plus propre et sans clipping, mais merite encore une revalidation produit dans le shell complet

## Prochaine action exacte
- Ouvrir `Cowork Apps` dans la vraie app et verifier d'abord un flux reel de creation :
  - saisir un brief de generated app depuis le laboratoire
  - confirmer qu'aucune alerte `reading 'length'` n'apparait
  - confirmer que l'app arrive bien dans le store et s'ouvre
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
- `server/lib/generated-apps.ts`
- `src/components/AgentsHub.tsx`
- `src/components/AgentAppPreview.tsx`
- `src/components/AgentWorkspacePanel.tsx`
- `src/generated-app-sdk.tsx`
- `src/utils/agentSnapshots.ts`
- `src/utils/generatedAppSnapshots.ts`
- `src/components/GeneratedAppHost.tsx`
- `test-generated-app-manifest.ts`
- `QA_RECIPES.md`
- `AI_LEARNINGS.md`
- `SESSION_STATE.md`
- `COWORK.md`

## Validations restantes
- Rejouer en vrai le flux `create -> open -> run -> publish -> update` sur session authentifiee.
- Verifier un cas `Pokemon` (image) et un cas `Nasheed` (music).
- Reconfirmer le lobby `Cowork Apps` dans la vraie app desktop avec des donnees reelles, pas seulement via harness.
- Confirmer qu'une draft en echec de build remonte bien son `buildLog` dans le host.
- Revalider desktop/mobile dans le shell complet, pas seulement via code/lint/build.

## Risques immediats
- Le correctif creation generated app corrige la sanitisation cote serveur et blinde le frontend, mais il faut encore l'observer sur de vraies reponses Gemini/Firestore.
- La preuve visuelle du `GeneratedAppHost` n'a pas encore ete capturee a cause des limites outils locales.
- Le chunk principal reste lourd ; non bloquant pour ce lot, mais a garder en tete si le host genere grossit encore.
