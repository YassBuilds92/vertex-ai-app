# NOW

## Objectif actuel
- Rejouer `Cowork Apps` dans la vraie app avec une session authentifiee, maintenant que le shell ne reste plus bloque sur `Chargement du studio...` en environnement headless.

## Blocage actuel
- Pas de blocage technique immediat.
- La prochaine validation utile est produit: verifier le ressenti dans l'app complete avec de vraies apps Cowork et pas seulement sur fixtures locales.
- Il reste a confirmer le comportement quand le store contient vraiment plus d'apps que la page courante sur desktop reel.
- La validation reelle de `Cowork Apps` reste dependante d'une session authentifiee; le fallback headless montre maintenant le shell et l'empty state, mais pas le store authentifie.

## Prochaine action exacte
- Rejouer l'ouverture de `Cowork Apps` dans la vraie app, confirmer que:
  - le lobby tient entierement dans le viewport sans scroll
  - les fleches de pagination sortent bien quand le nombre d'apps depasse la page
  - l'ouverture d'une app sans auto-run reste le bon comportement produit
  - tout cela est vrai avec une vraie session Google et de vraies apps du store

## Fichiers chauds
- `src/components/AgentsHub.tsx`
- `src/App.tsx`
- `QA_RECIPES.md`
- `SESSION_STATE.md`
- `COWORK.md`

## Validations restantes
- Rejouer `Cowork Apps` dans la vraie app avec login/session reelle.
- Verifier que le fallback `isAuthReady` ne produit pas de clignotement parasite quand Firebase Auth repond normalement.
- Verifier que l'ouverture d'une app sans auto-run ne casse pas le flow de lancement ensuite depuis le studio.
- Reconfirmer desktop/mobile sur des vraies donnees, pas seulement sur le harness `tmp`.
- Verifier les noms d'apps tres longs dans le dock pagine.

## Risques immediats
- Certaines apps reelles trop pauvres peuvent paraitre encore trop similaires si leurs blueprints restent faibles.
- Des noms d'apps reels tres longs peuvent tasser les libelles du dock et necessiter un dernier polissage.
- Le passage plein ecran est valide localement, mais doit encore etre ressenti dans le shell complet en session reelle.
- Le fallback auth evite le spinner infini en headless, mais doit etre observe une fois dans un navigateur normal pour confirmer qu'il reste invisible quand tout se passe bien.
