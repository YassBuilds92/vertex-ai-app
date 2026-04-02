# NOW

## Objectif actuel
- Revalider puis deployer le correctif `IA Duel Podcast`:
  - confirmer qu'une generated app de duel sort bien un vrai debat audio a 2 voix
  - verifier en UI authentifiee que `Produire maintenant` remplit bien un `Master audio` esthetique
  - confirmer que la creation d'app passe bien par une clarification initiale avant generation

## Blocage actuel
- Le correctif est valide localement, mais pas encore prouve dans la vraie app connectee:
  - pas de run prod/authentifie rejoue de bout en bout apres ces patches
  - la clarification initiale a ete validee au code, mais pas encore capturee proprement dans l'UI reelle
  - les apps deja creees avant regeneration peuvent encore conserver une structure trop generique tant qu'elles ne sont pas regenerees

## Prochaine action exacte
- Redeployer le patch courant puis rejouer:
  - `Cowork Apps -> creation app podcast/debat -> validation de la clarification recommandee`
  - `ouvrir IA Duel Podcast -> Produire maintenant -> verifier duo vocal + carte audio + lecteur`
  - confirmer que les `tool_result.meta` exposent bien les 2 speakers et la strategie de mix

## Fichiers chauds
- `api/index.ts`
- `server/lib/generated-apps.ts`
- `shared/generated-app-sdk.tsx`
- `src/App.tsx`
- `src/components/AgentsHub.tsx`
- `test-cowork-loop.ts`
- `COWORK.md`
- `SESSION_STATE.md`
- `QA_RECIPES.md`

## Validations restantes
- Rejouer un vrai run authentifie `IA Duel Podcast` apres deploy.
- Capturer visuellement la clarification initiale dans `Cowork Apps`.
- Verifier qu'une app de duel regeneree embarque bien le schema `topic + stance_a + stance_b + debate_frame + duration`.

## Risques immediats
- Tant que le patch local n'est pas deploye, la prod peut encore retomber sur un rendu solo-chronique.
- Une generated app de debat deja persistÃ©e peut demander une regeneration pour profiter pleinement du schema specialise.
- La validation visuelle finale reste partielle tant que le host reeel connecte n'a pas ete rejoue.
