# NOW

## Objectif actuel
- Revalider le flux generated app podcast apres patch runtime:
  - confirmer en UI authentifiee que `Produire maintenant` sort bien un `Master final`
  - verifier qu'une app podcast respecte ses modeles declares (`modelProfile`) et sa vraie allowlist outillee
  - decider ensuite si le patch local doit etre deploye

## Blocage actuel
- Pas de panne backend prod confirmee sur le flux generated app podcast:
  - `POST /api/generated-apps/create/stream` en prod a bien cree une app `IA Duel Podcast`
  - `POST /api/cowork` en prod a bien produit puis publie un master audio
- Reste un ecart entre le code local et la prod:
  - avant patch local, une generated app pouvait annoncer `gemini-2.5-flash-tts` mais executer `create_podcast_episode` en `gemini-2.5-pro-tts` si le modele n'explicitait pas `ttsModel`
  - le sanitiseur de manifests pouvait aussi laisser passer des outils parasites comme `write_file` pour une app podcast

## Prochaine action exacte
- Rejouer en navigateur authentifie:
  - `ouvrir IA Duel Podcast -> Produire maintenant -> verifier que le Master final se remplit`
  - confirmer que l'app utilise bien les modeles/outils attendus apres redeploiement eventuel
- Si la verification UI doit toucher la prod, redeployer d'abord le patch local courant

## Fichiers chauds
- `api/index.ts`
- `server/lib/generated-apps.ts`
- `test-cowork-loop.ts`
- `test-generated-app-manifest.ts`
- `COWORK.md`
- `SESSION_STATE.md`
- `BUGS_GRAVEYARD.md`

## Validations restantes
- Verifier le rendu UI reel du host generated app avec session authentifiee.
- Verifier en conditions reelles que les apps podcast regenerees n'embarquent plus d'outils parasites.
- Redéployer si l'objectif est de corriger le comportement prod observe par l'utilisateur.

## Risques immediats
- Tant que le patch local n'est pas deploye, la prod garde encore l'ancien comportement sur les defaults outilles.
- Les apps podcast deja creees avant regeneration peuvent conserver une allowlist plus large que souhaitee.
- L'UI authentifiee reelle n'a pas encore ete revalidee visuellement a cause du blocage Playwright MCP sur cette machine.
