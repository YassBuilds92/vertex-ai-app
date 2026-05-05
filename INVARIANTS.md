# INVARIANTS

## Produit
- Cowork doit rester modele-led: le backend fournit outils, etat et garde-fous, mais ne dicte pas la strategie.
- En multi-tour, Cowork doit toujours traiter en priorite le dernier message utilisateur; l'historique precedent sert de contexte, pas d'ordre de reexecuter tout le dossier.
- Le shell principal ne doit plus exposer `Hub Agents` ni `Cowork Apps`; ces surfaces sont legacy tant que l'utilisateur ne demande pas explicitement leur retour.
- Cowork ne doit pas envoyer ou utiliser `hubAgents` depuis l'UI principale.
- Une `generated app` est une entite produit de premiere classe, distincte du blueprint d'agent legacy.
- Modifier une `generated app` cree une nouvelle draft; la version publiee reste stable tant qu'on n'a pas explicitement publie.

## UX
- Les surfaces frontend importantes doivent etre validees sur rendu reel, pas seulement sur lecture de code.
- Le shell doit garder une identite premium et non generique; eviter les dashboards de cartes SaaS interchangeables.
- Les modes media doivent conserver une surface dediee par mode, avec prompt source recopiable quand un artefact a ete genere.

## Technique
- Pas de nouvelle dependance frontend si la stack existante suffit.
- Les workspaces/apps doivent rester compatibles avec la persistance locale-first et la synchro Firestore best-effort deja en place.
- Les `generated apps` restent Google-only cote modeles et ne peuvent appeler que les outils explicitement allowlistes par leur manifest.
- Cowork pur peut recevoir une instruction systeme custom comme consigne supplementaire utilisateur; elle ne doit pas faire mentir Cowork sur les outils, fichiers ou livraisons reels.
- Les pieces jointes media generees doivent conserver leurs metas de generation utiles (`mode`, `prompt`, `model`) pour les galeries, copies et futurs outils d'instruction; ne pas reintroduire de metas de Raffineur IA dans l'UI.
- Toute capacite Cowork v2 doit etre gated par env var et rester OFF par defaut tant qu'elle n'a pas passe ses smokes reels.
- Le RAG auto-injecte doit rester borne a un budget d'environ 2K tokens max dans le system prompt.
- Toute lecture/ecriture memoire Cowork doit etre filtree par `userId` et ne jamais melanger plusieurs utilisateurs.
