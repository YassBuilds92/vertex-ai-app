# NOW

## Objectif actuel
- Stabiliser et affiner le pivot `Hub Agents` -> `Cowork Apps`, avec un store d'apps credible et des studios d'app distincts.

## Blocage actuel
- Pas de blocage code immediat.
- La prochaine vraie validation produit doit se faire sur des apps creees par Cowork en session authentifiee, pas seulement sur le harness local.

## Prochaine action exacte
- Rejouer le flux complet sur de vraies apps Cowork persistantes et pousser encore la singularite de chaque app si certaines creations restent trop generiques.

## Fichiers chauds
- `src/components/AgentsHub.tsx`
- `src/components/AgentAppPreview.tsx`
- `src/components/AgentWorkspacePanel.tsx`
- `src/App.tsx`
- `server/lib/agents.ts`
- `COWORK.md`

## Validations restantes
- Rejouer le store avec de vraies apps construites par Cowork et verifier la variete des `uiSchema`.
- Verifier en session authentifiee que l'ouverture d'une app garde un comportement coherent avec le runtime existant et la persistence locale/Firestore.

## Risques immediats
- Certaines apps reelles peu renseignees peuvent encore retomber sur un rendu trop proche du fallback de leur famille `outputKind`.
- Le store est maintenant visuellement juste, mais la profondeur produit depend encore de la qualite des blueprints generes par Cowork.
