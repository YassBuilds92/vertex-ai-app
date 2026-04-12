# NOW

## Objectif actuel
- Garder `Cowork` sans surface `Cowork Apps` dans le shell principal.

## Blocage actuel
- Aucun blocage build/runtime local:
  - `npm run lint` -> OK
  - `npm run build` -> OK
  - capture visuelle locale du mode `Cowork` vide -> OK (`tmp/cowork-empty-after-removal.png`)
- Il reste seulement une validation connectee si l'utilisateur veut verifier le shell reel avec ses sessions Firebase.

## Prochaine action exacte
- Ouvrir une session connectee, passer en mode `Cowork`, puis verifier qu'aucun bouton/overlay/section `Apps` n'apparait encore dans le shell.

## Fichiers chauds
- `src/App.tsx`
- `src/components/StudioEmptyState.tsx`
- `src/components/SidebarLeft.tsx`
- `SYSTEM_MAP.md`

## Validations restantes
- smoke visuel connecte du shell principal
- si souhaite par l'utilisateur: decider si le lifecycle backend `generated-apps` doit lui aussi etre retire, ou seulement masque cote UI

## Risques immediats
- des sessions `generated_app` historiques peuvent encore exister en stockage local/Firestore, meme si le shell les redirige maintenant vers `Cowork`
