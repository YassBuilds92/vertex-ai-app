# INVARIANTS

## Produit
- Cowork doit rester modele-led: le backend fournit outils, etat et garde-fous, mais ne dicte pas la strategie.
- En multi-tour, Cowork doit toujours traiter en priorite le dernier message utilisateur; l'historique precedent sert de contexte, pas d'ordre de reexecuter tout le dossier.
- Le hub ne doit pas ressembler a un simple catalogue technique d'agents; il doit exposer des experiences utilisables directement par l'utilisateur.
- Pour le hub, la promesse produit cible est un app store d'apps creees par Cowork, avec un role, une interface et un comportement distincts pour chaque app.
- L'utilisateur doit pouvoir ouvrir et utiliser directement une app/agent; Cowork sert a creer et faire evoluer cette experience.
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
- Cowork pur ne doit jamais laisser une instruction systeme custom prendre le controle de son runtime autonome.
- Les pieces jointes media generees doivent conserver leurs metas de generation (`prompt`, `refinedPrompt`, modele, profil de raffineur, consignes perso) pour les galeries, copies et futurs outils d'instruction.
- Toute capacite Cowork v2 doit etre gated par env var et rester OFF par defaut tant qu'elle n'a pas passe ses smokes reels.
- Le RAG auto-injecte doit rester borne a un budget d'environ 2K tokens max dans le system prompt.
- Toute lecture/ecriture memoire Cowork doit etre filtree par `userId` et ne jamais melanger plusieurs utilisateurs.
