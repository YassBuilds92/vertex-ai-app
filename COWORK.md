# COWORK - Projet Studio Pro

## Vision
L'agent **Cowork** est une boucle autonome integree dans AI Studio. Contrairement au chat classique, il peut planifier, rechercher (via des outils locaux) et executer des taches directement sur le systeme de fichiers.

## Architecture
- **Frontend** : React (Zustand pour l'etat). Le mode `cowork` envoie des requetes a `/api/cowork`.
- **Backend** : Express (Node.js). La route `/api/cowork` gere une boucle d'iteration (jusqu'a 15 tours) avec evenements SSE types (`status`, `narration`, `tool_call`, `tool_result`, `warning`, `text_delta`, `done`, `error`) et conservation stricte du tour modele Gemini 3.1 pour les `thoughtSignature`.
- **IA** : Gemini 3.1 Pro Preview (Vertex AI).

## Outils Locaux (localTools)
- `report_progress` : narration visible entre les etapes, sans polluer la reponse finale.
- `list_files` : Liste les fichiers a la racine.
- `read_file` : Lit le contenu d'un fichier (securise).
- `write_file` : Ecrit un fichier (force vers `/tmp/` sur Vercel).
- `list_recursive` : Exploration profonde du projet.
- `web_search` : recherche web locale visible (fallback public, branchement provider possible plus tard).
- `web_fetch` : lecture d'une source web precise avec contenu nettoye.
- `release_file` : Uploade un fichier vers Google Cloud Storage et renvoie une URL signee de 7 jours.

## Etat d'Avancement
- [x] Initialisation du mode Cowork.
- [x] Boucle agentique avec support des outils locaux.
- [x] Support du streaming des pensees (thoughts).
- [x] Correction des erreurs de lecture seule sur Vercel.
- [x] Ajout d'un outil d'execution de script.
- [x] Correction de la boucle infinie (feedback UI + listing `/tmp/`).
- [x] Migration du flux PDF vers un outil natif Node (`create_pdf`).
- [x] Activation du moteur de raisonnement (Thinking Mode Gemini 3.1).
- [x] Amelioration de la resilience aux erreurs d'environnement (python/python3).
- [x] Fusion systematique du prompt systeme Cowork backend avec les consignes utilisateur pour eviter qu'un prompt frontend minimal neutralise les regles critiques.
- [x] Propagation de `call.id` dans les `functionResponse` et ajout d'un fallback final si `release_file` reussit mais que Gemini ne genere aucun texte de conclusion.
- [x] Ajout d'un garde-fou "artifact completion" : si l'utilisateur demande un PDF/fichier et que le modele s'arrete apres une synthese texte, la boucle relance un tour guide pour terminer `create_pdf -> release_file -> lien final`.
- [x] Correction de la regression Vertex AI : suppression de `includeServerSideToolInvocations` dans `/api/cowork` car ce parametre n'est pas supporte par Vertex AI, tout en conservant `googleSearch` / `codeExecution` via `config.tools`.
- [x] Correction de l'ecran vide Cowork : les erreurs SSE (`data.error`) sont maintenant remontees cote frontend au lieu d'etre ignorees silencieusement.
- [x] Affinage du garde-fou d'artefact : une simple lecture de fichier ne declenche plus `release_file`; la relance automatique ne s'active que pour les vraies demandes de creation/export.
- [x] Correction Gemini 3.1 / `thoughtSignature` : la boucle Cowork n'utilise plus `generateContentStream` pour reconstruire l'historique fonctionnel. Chaque tour conserve desormais le `content` complet retourne par Gemini avant de le rejouer a Vertex, ce qui evite l'erreur `function call ... is missing a thought_signature`.
- [x] Retry Cowork sur quotas : les appels modele de la boucle Cowork passent maintenant par `retryWithBackoff`, ce qui absorbe mieux les erreurs temporaires `RESOURCE_EXHAUSTED` (429) sur les taches type actu du jour + PDF.
- [x] Refonte UX Cowork : une timeline agentique persistante est maintenant stockee dans `message.activity`, avec `runState` / `runMeta`, au lieu d'un simple bloc de `thoughts`.
- [x] Refonte frontend Cowork : le message modele est cree des le debut du run puis mis a jour avec un flush debouncé vers Firestore, ce qui supprime l'effet "rien puis gros bloc final" et permet de recharger la session sans perdre l'activite.
- [x] Recherche web visible : Cowork ne depend plus du built-in `googleSearch` pour la recherche traçable. Il dispose de `web_search` / `web_fetch` et d'un garde-fou adaptatif qui force plusieurs recherches visibles + au moins une lecture de source pour les demandes d'actu/doc/version/briefing/comparatif.
- [x] Narration explicite : l'outil `report_progress` permet au modele de parler entre les outils comme un agent, sans transformer ces messages en reponse finale.

## Prochaines Etapes
1. Deployer ces corrections sur Vercel et revalider sur production les cas reels `lis package.json`, `creer moi un pdf test`, `fais-moi l'actu du jour puis fournis un PDF`, et un briefing d'actualite avec plusieurs recherches visibles.
2. Mesurer si l'agent utilise effectivement `report_progress` et `web_search`/`web_fetch` de facon satisfaisante; si besoin, resserrer encore le prompt systeme ou les relances guidees.
3. Reintroduire un streaming modele plus fin uniquement si on peut recuperer a la fois le ressenti "live" et la conservation exacte du tour Gemini signe.
4. Brancher ensuite un vrai provider de recherche (ex: Tavily) si le fallback public montre ses limites sur certains domaines.
5. Nettoyer les anciennes notes obsoletes pour que le document ne mentionne plus de workaround maintenant remplaces par la timeline SSE typee et les web tools locaux.
