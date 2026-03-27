# COWORK - Projet Studio Pro

## Vision
L'agent **Cowork** est une boucle autonome integree dans AI Studio. Contrairement au chat classique, il peut planifier, rechercher (via des outils locaux) et executer des taches directement sur le systeme de fichiers.

## Architecture
- **Frontend** : React (Zustand pour l'etat). Le mode `cowork` envoie des requetes a `/api/cowork`.
- **Backend** : Express (Node.js). La route `/api/cowork` gere une boucle d'iteration (jusqu'a 15 tours) avec evenements SSE types (`status`, `narration`, `tool_call`, `tool_result`, `warning`, `text_delta`, `done`, `error`) et conservation stricte du tour modele Gemini 3.1 pour les `thoughtSignature`.
- **IA** : Gemini 3.1 Pro Preview (Vertex AI).

## Outils Locaux (localTools)
- `report_progress` : narration visible entre les etapes, sans polluer la reponse finale.
- `music_catalog_lookup` : lookup musique/discographie specialise (catalogue officiel, titres manquants, album-only, feats optionnels, couverture par sources).
- `list_files` : Liste les fichiers a la racine.
- `read_file` : Lit le contenu d'un fichier (securise).
- `write_file` : Ecrit un fichier (force vers `/tmp/` sur Vercel).
- `list_recursive` : Exploration profonde du projet.
- `web_search` : recherche web locale visible avec qualite explicite (`relevant`, `degraded`, `off_topic`, `transient_error`), provider remonte et blocage des repetitions faibles.
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

- [x] Fallback public de recherche durci : quand `DuckDuckGo` renvoie `403` sur Vercel, Cowork bascule maintenant vers `Bing RSS`, puis `DuckDuckGo`, puis `Google News RSS` pour garder des resultats visibles avec URL exploitables.
- [x] Telemetrie / garde-fou de recherche corriges : `runMeta` ne compte plus les appels bloques par l'anti-boucle, `buildResearchCompletionPrompt()` se base sur des recherches/lectures reussies, et la relance recherche ne bloque plus la conclusion une fois `release_file` reussi.
- [x] Securite PDF : `write_file` refuse desormais tout chemin `.pdf` pour empecher la fabrication de faux PDFs texte et forcer l'usage de `create_pdf`.
- [x] Compatibilite Firestore de la timeline Cowork : les regles acceptent maintenant `activity` / `runState` / `runMeta`, et le frontend retombe sur une persistance legacy si le cloud n'a pas encore recu les nouvelles regles.
- [x] Contexte temporel explicite : le frontend envoie maintenant `clientContext` (`locale`, `timeZone`, `nowIso`), Cowork construit un `requestClock`, injecte la date absolue dans son system prompt, et realigne les `web_search` temporelles sur la date du jour pour eviter les derives type `23 mai 2024` sur une demande "actu du jour".
- [x] PDF long-form renforce : la profondeur de recherche est maintenant dynamique selon la demande (`getResearchTargets()`), `MAX_ITERATIONS` s'adapte aux briefs plus longs, `create_pdf` refuse les rapports trop courts quand l'utilisateur demande un PDF dense, et le rendu PDF est passe a une vraie mise en page multi-page (couverture, resume, headers, footers, pagination, sections stylisees).
- [x] Navigation fichier / PDF adoucie : les liens rendus par Cowork s'ouvrent maintenant dans un nouvel onglet via un renderer Markdown dedie, ce qui evite de remplacer l'interface AI Studio quand l'utilisateur ouvre un PDF signe.
- [x] Memoire locale de secours pour Cowork : chaque message modele riche (`content`, `thoughts`, `activity`, `runState`, `runMeta`) est desormais miroir en `localStorage`, puis rehydrate a l'ouverture d'une session pour limiter les pertes si Firestore arrive en retard ou retombe en mode legacy.
- [x] Retour sur la bonne discussion : l'etat Zustand memorise maintenant la derniere session par mode (`lastSessionIdsByMode`), `updatedAt` des sessions est touche a chaque envoi, et le draft live Cowork n'est plus affiche dans la mauvaise conversation quand on navigue entre plusieurs threads.
- [x] Telemetrie live Cowork : `runMeta` remonte maintenant en direct les appels modele, tokens input/output/reasoning/tool, total tokens et un cout estime USD/EUR a partir de `usageMetadata` Gemini 3.1 et des tarifs Vertex AI.
- [x] Retry intelligent visible : les retries Cowork distinguent maintenant quota, saturation simultanee et indisponibilite temporaire, avec backoff exponentiel + jitter et messages explicites dans la timeline.
- [x] Serialisation par conversation : `/api/cowork` file maintenant les runs par `sessionId`, et le frontend ajoute un verrou synchrone (`sendInFlightRef`) pour bloquer les doubles envois ultra rapides.
- [x] Recherche creative verifiee : les demandes "documente-toi puis ecris" sont maintenant traitees comme de la recherche profonde via `requestNeedsGroundedWriting()`, avec decomposition visible et obligation de contextualiser les requetes + lire une source avant la redaction finale.
- [x] Recherche creative sur personne/sujet d'actualite durcie : Cowork reconnait maintenant aussi les formulations naturelles (`cherche`, `toute l'actu sur lui`, `tout ce qu'il y a autour`) et les demandes de texte a charge/a decharge sur une personne reelle. Il impose alors plus de recherche visible (`web_search` + `web_fetch`) et interdit les paroles finales tant que la documentation n'est pas suffisante.
- [x] Recherche artiste/discographie fiabilisee : les demandes du type "j'ai tel son, dis-moi ceux qu'il me manque" sont maintenant classees comme recherche profonde via `requestNeedsMusicCatalogResearch()`, avec minima `3 web_search + 2 web_fetch`, obligation de chercher d'abord l'alias exact, et reranking des SERP pour ne plus accepter les faux positifs `Bing RSS` quand `DuckDuckGo` renvoie les vraies pages artiste.
- [x] Lookup musique specialise : Cowork dispose maintenant d'un outil `music_catalog_lookup` qui resolve l'artiste via Apple Music / YouTube / TrackMusik, etend les albums vers leurs tracklists, separe `missingConfirmed` / `albumOnly` / `optionalFeatures`, et refuse de presenter une liste "complete" si la couverture reste partielle.
- [x] Anti-boucle scoppé par recherche/source : l'agent ne bloque plus `web_search` globalement apres deux echecs quelconques. Le blocage se fait maintenant par requete/famille de requetes pour `web_search` et par URL/hostname pour `web_fetch`. Les 403/429 et indisponibilites temporaires sont traites comme degradations transitoires, pas comme echecs terminaux.
- [x] Activite Cowork musique plus lisible : la timeline reconnait `music_catalog_lookup`, les previews de resultat exposent la couverture (domaines, catalogue, album) et les incidents transitoires de provider ne ressortent plus en erreur rouge systematique.
- [x] Recherche stricte et honnete : Cowork distingue maintenant les recherches valides des resultats degrades/hors sujet, n'incremente `validatedSearches` que sur les vrais `web_search` pertinents, impose au moins une source `web_fetch` sur les sujets factuels sensibles, bloque les requetes strictement repetitives, et coupe proprement avec un message d'insuffisance si la recherche reste trop faible apres les relances.
- [x] Timeline recherche honnete : `runMeta` expose maintenant `validatedSearches`, `degradedSearches` et `blockedQueryFamilies`, les `tool_result` degradés passent en warning ambre, et les warnings affichent le provider, la famille bloquee et la raison du pivot.

- [x] Documents formels PDF fiabilises : Cowork reconnait maintenant les demandes type `attestation`, `certificat` ou `lettre` meme sans le mot `pdf`, force une structure minimale en plusieurs blocs, interdit les placeholders quand le document doit etre fictif, et rend ces livrables avec une mise en page plus "document officiel" que "report".

## Prochaines Etapes
1. Revalider sur production les cas reels `creer moi un pdf test`, `fais-moi l'actu du jour puis fournis un PDF`, `fais moi un pdf tres long sur l'actu du jour`, puis naviguer entre plusieurs conversations Cowork pour verifier que le PDF s'ouvre hors onglet, que la timeline revient apres reload, et que les compteurs tokens/euros montent correctement.
2. Rejouer en production le cas `Tariq Ramadan il va aller en prison ?` pour verifier qu'il n'y a plus de rafale de `web_search` quasi identiques, qu'au moins une source est lue avant conclusion, et qu'en cas de recherche insuffisante Cowork s'arrete honnetement au lieu de broder.
3. Rejouer en production le cas `fais un son pour defendre Tariq Ramadan` et les variantes `cherche toute l'actu sur lui puis fais un son` pour verifier que Cowork fait bien `plan -> recherche -> verification -> production` au lieu d'ecrire des paroles des l'iteration 1.
4. Rejouer en production le cas VEN1 et d'autres artistes ambigus pour verifier que `music_catalog_lookup` reste robuste quand Apple Music sert une page US/EN, et qu'il n'annonce jamais une liste exhaustive quand `coverage.partial` devrait rester vrai.
5. Ajouter si besoin une vraie carte d'artefact Cowork (boutons `Ouvrir` / `Telecharger` / `Copier le lien`) pour ne plus dependre uniquement d'un lien Markdown dans le texte final.
6. Reintroduire un streaming modele plus fin uniquement si on peut recuperer a la fois le ressenti "live" et la conservation exacte du tour Gemini signe.
7. Configurer `TAVILY_API_KEY` sur Vercel puis revalider les demandes strictes (actualite, justice, docs/version) avec Tavily en provider prioritaire et les fallbacks publics seulement en secours.
8. Rejouer en production des demandes de documents formels sans le mot `pdf` (`fais moi une attestation de stage fictive`, `lettre de motivation fictive`, `certificat de travail`) pour verifier que Cowork n'exporte plus de placeholders et conserve bien le layout "document officiel".
