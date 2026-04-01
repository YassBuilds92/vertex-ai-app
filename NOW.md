# NOW

## Objectif actuel
- Revalider dans la vraie app qu'un clic sur une app musicale type `Nasheed Studio` ouvre bien une surface dediee et non un chat generique.

## Blocage actuel
- Pas de blocage code immediat.
- La surface `Nasheed Studio` est validee sur harness local, mais pas encore rejouee avec une app persistee reelle dans le shell complet authentifie.
- Le tout premier vrai run musical (master + cover) depuis cette nouvelle surface reste a observer hors fixtures locales.

## Prochaine action exacte
- Ouvrir `Cowork Apps` dans la vraie app, cliquer sur une app musicale/Nasheed reelle et verifier que:
  - l'app entre dans `NasheedStudioWorkspace` au lieu de retomber dans la surface chat
  - un run reel depuis `Composer maintenant` sort bien dans le rail `Sorties recentes`
  - la navigation retour vers `Cowork Apps` reste nette sans casser la session agent

## Fichiers chauds
- `src/App.tsx`
- `src/components/NasheedStudioWorkspace.tsx`
- `src/components/AgentAppPreview.tsx`
- `server/lib/agents.ts`
- `QA_RECIPES.md`
- `SESSION_STATE.md`
- `COWORK.md`
- `DECISIONS.md`

## Validations restantes
- Rejouer le clic reel hub -> `Nasheed Studio` dans une session authentifiee.
- Verifier un premier export reel audio/cover depuis la surface dediee.
- Reconfirmer desktop/mobile sur des vraies donnees, pas seulement sur le harness `tmp`.
- Observer si la colonne `Sorties recentes` doit etre encore compacte sur desktop de faible hauteur.

## Risques immediats
- Des blueprints reels encore classes `podcast` mais sans indices musicaux forts peuvent rater la nouvelle surface dediee.
- Un premier vrai run Lyria 3 peut encore demander un ajustement de prompt/engine une fois confronte a des donnees reelles.
- Le rendu est valide sur harness local, mais doit encore etre ressenti dans le shell complet en session reelle.
