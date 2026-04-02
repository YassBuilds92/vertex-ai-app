# NOW

## Objectif actuel
- Rejouer en environnement authentifie puis deploye la nouvelle passe d'audit:
  - shell d'accueil respire et reste visible desktop/mobile
  - `Cowork Apps` reste auto-defini sans rails `outputKindHint`
  - les generated apps gardent un runtime neutre pilote par leur manifest

## Blocage actuel
- La passe est validee localement, mais pas encore rejouee en vrai contexte connecte:
  - pas encore de verification terrain du shell apres login Google / Firestore reel
  - pas encore de preuve deployee du brief libre `Cowork Apps -> clarification -> app`
  - le bundle principal est nettement reduit mais reste encore au-dessus du warning Vite

## Prochaine action exacte
- Redeployer puis rejouer 4 parcours reels:
  - accueil vide desktop/mobile apres login
  - brief hybride libre dans `Cowork Apps`
  - brief ambigu avec clarification conversationnelle
  - ouverture d'une ancienne generated app pour confirmer la migration douce/fallback

## Fichiers chauds
- `src/App.tsx`
- `src/components/StudioEmptyState.tsx`
- `src/components/SidebarLeft.tsx`
- `src/components/SidebarRight.tsx`
- `server/lib/generated-apps.ts`
- `api/index.ts`
- `COWORK.md`
- `DECISIONS.md`
- `QA_RECIPES.md`

## Validations restantes
- Rejouer un vrai run authentifie apres deploy.
- Verifier visuellement le shell d'accueil dans l'app connectee.
- Verifier qu'aucun `outputKindHint` / rail produit ne reapparait cote runtime.
- Mesurer si une passe perf supplementaire sur le chunk principal est encore necessaire.

## Risques immediats
- Le comportement final reste a confirmer en environnement auth/store reel.
- Le warning Vite sur le chunk principal n'est pas elimine, seulement reduit.
- Les anciennes generated apps peuvent encore afficher un fallback legacy tant qu'elles ne sont pas regenerees.
