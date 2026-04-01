# NOW

## Objectif actuel
- Revalider en conditions reelles le lifecycle generated app apres reclassement du bundle optionnel:
  - creation SSE visible dans `Cowork Apps`
  - ouverture native dans `GeneratedAppHost`
  - bundle env-dependent reclasse en `skipped` au lieu de faux `failed`
  - run
  - publication de draft meme si aucun bundle n'est disponible
  - evolution Cowork vers une nouvelle draft

## Blocage actuel
- Pas de blocage code immediat:
  - le backend streame maintenant `brief_validated -> spec_ready -> source_ready -> bundle_ready|bundle_skipped|bundle_failed -> manifest_ready`
  - les erreurs d'environnement `generated-app-sdk/react-jsx-runtime` ne doivent plus rester en faux `bundle failed`
  - le host ouvre toujours l'app via `GeneratedAppCanvas`
  - la publication n'exige plus `bundleCode`
- La vraie limite restante est produit/auth:
  - le flux complet authentifie `create -> open -> run -> publish -> update draft` reste a observer sur une session reelle
  - il faut confirmer qu'une ancienne draft stockee avec ce faux echec est maintenant rehydratee en `skipped` dans la vraie app

## Prochaine action exacte
- Rejouer dans la vraie app connectee:
  - creer une generated app depuis `Cowork Apps`
  - confirmer que la timeline SSE apparait et que le preview natif se materialise pendant la creation
  - verifier qu'un environment skip remonte comme `bundle skipped` sans panneau rouge
  - ouvrir l'app dans `GeneratedAppHost`
  - lancer un run
  - publier une draft avec `bundle skipped` ou `bundle failed`
  - demander une evolution via Cowork et verifier qu'une nouvelle draft est creee sans ecraser la live

## Fichiers chauds
- `server/lib/generated-apps.ts`
- `server/routes/standard.ts`
- `src/App.tsx`
- `src/components/AgentsHub.tsx`
- `src/components/GeneratedAppHost.tsx`
- `src/generated-app-sdk.tsx`
- `src/utils/generatedAppSnapshots.ts`
- `tmp/cowork-apps-preview.tsx`
- `test-generated-app-manifest.ts`
- `test-generated-app-lifecycle.ts`
- `test-generated-app-stream.ts`
- `QA_RECIPES.md`
- `DECISIONS.md`
- `COWORK.md`
- `SESSION_STATE.md`

## Validations restantes
- Rejouer le flux authentifie complet dans la vraie app.
- Observer un cas prod ou le bundle est saute a cause de l'environnement empaquete et confirmer que le host reste neutre/ouvrable/publishable.
- Observer aussi un vrai echec bundle applicatif et confirmer que le host reste ouvrable/publishable.
- Reconfirmer le rendu du host et de la creation visible avec des donnees Firestore/Gemini non simulees.

## Risques immediats
- Le vrai build prod peut encore produire d'autres erreurs de resolution non couvertes par le reclassement `skipped`.
- Le preview natif est maintenant canonique; toute regression future qui rebloque le host sur le bundle serait une regression produit majeure.
