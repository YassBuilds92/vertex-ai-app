# INVARIANTS

## Produit
- Cowork doit rester modele-led: le backend fournit outils, etat et garde-fous, mais ne dicte pas la strategie.
- Le hub ne doit pas ressembler a un simple catalogue technique d'agents; il doit exposer des experiences utilisables directement par l'utilisateur.
- Pour le hub, la promesse produit cible est un app store d'apps creees par Cowork, avec un role, une interface et un comportement distincts pour chaque app.
- L'utilisateur doit pouvoir ouvrir et utiliser directement une app/agent; Cowork sert a creer et faire evoluer cette experience.

## UX
- Les surfaces frontend importantes doivent etre validees sur rendu reel, pas seulement sur lecture de code.
- Le shell doit garder une identite premium et non generique; eviter les dashboards de cartes SaaS interchangeables.

## Technique
- Pas de nouvelle dependance frontend si la stack existante suffit.
- Les workspaces/apps doivent rester compatibles avec la persistance locale-first et la synchro Firestore best-effort deja en place.
