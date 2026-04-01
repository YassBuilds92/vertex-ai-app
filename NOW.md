# NOW

## Objectif actuel
- Stabiliser le nouveau mode plein ecran `Cowork Apps`, qui remplace le hub serre dans le shell par une vraie vue separee.

## Blocage actuel
- Pas de blocage technique immediat.
- La prochaine validation utile est produit: verifier le ressenti dans l'app complete avec de vraies apps Cowork et pas seulement sur fixtures locales.

## Prochaine action exacte
- Rejouer l'ouverture de `Cowork Apps` dans la vraie app, confirmer que la sortie/entree plein ecran est bien fluide et que l'ouverture d'une app sans auto-run est le bon comportement produit.

## Fichiers chauds
- `src/components/AgentsHub.tsx`
- `src/App.tsx`
- `src/components/AgentWorkspacePanel.tsx`
- `src/components/AgentAppPreview.tsx`
- `server/lib/agents.ts`
- `COWORK.md`

## Validations restantes
- Rejouer `Cowork Apps` dans la vraie app avec login/session reelle.
- Verifier que l'ouverture d'une app sans auto-run ne casse pas le flow de lancement ensuite depuis le studio.
- Reconfirmer desktop/mobile sur des vraies donnees, pas seulement sur le harness `tmp`.

## Risques immediats
- Certaines apps reelles trop pauvres peuvent paraitre encore trop similaires si leurs blueprints restent faibles.
- Le passage plein ecran est valide localement, mais doit encore etre ressenti dans le shell complet en session reelle.
