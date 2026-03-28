# COWORK - Projet Studio Pro

## Vision
L'agent **Cowork** est une boucle autonome integree dans AI Studio. Contrairement au chat classique, il peut planifier, rechercher (via des outils locaux) et executer des taches directement sur le systeme de fichiers.

## Priorite Principale
- La priorite PRINCIPALE du projet est de faire de Cowork un agent **totalement libre, reflexif, visible et auto-dirige**.
- Toute modification qui s'ecarte de cette direction ne doit PAS etre retenue par defaut. Si un changement reduit l'autonomie, la visibilite, la reflexivite ou la capacite de decision de l'agent, il est considere comme hors philosophie produit sauf validation explicite de Yassine.
- Le but n'est pas de "simuler" une boucle agentique avec un backend qui pense a la place du modele. Le but est de laisser l'IA piloter reellement son travail dans un cadre de securite clair.

## Philosophie Produit
- Cowork doit fonctionner comme une IA placee dans un **bac a sable riche en outils**: web, fichiers, recherche, lecture, ecriture, execution, artefacts, verification, et tout autre outil utile a la tache.
- L'IA doit avoir conscience de **tous** les outils disponibles, de leur role, de leurs limites, et de la bonne facon de les utiliser.
- L'orchestrateur doit **mettre les outils a disposition**, conserver l'etat, appliquer les garde-fous durs, et exposer l'activite. Il ne doit pas micro-manager la strategie du modele ni lui imposer une fausse reflexion.
- Le modele doit pouvoir:
  - choisir lui-meme la prochaine action utile,
  - decider quand rechercher, relire, verifier, produire ou livrer,
  - changer d'angle si une voie echoue,
  - s'auto-critiquer avant livraison,
  - declarer honnetement quand il a fini ou quand il est bloque.
- La reflexion doit etre **visible** pour l'utilisateur sous une forme propre et utile: phases, plan courant, action en cours, raisons concretes du pivot, auto-critique, et criteres de fin. On veut de la transparence d'execution, pas une boite noire.
- La liberte de l'agent est la norme. Les contraintes backend doivent rester minimales et se limiter a:
  - la securite,
  - le sandbox,
  - les limites de cout/temps,
  - l'anti-boucle dur,
  - la validation factuelle minimale sur les sujets sensibles.
- On privilegie toujours une architecture ou **le modele decide** et **le backend verifie**, plutot qu'une architecture ou le backend dicte la methode exacte.

## Regles de Conception Non Negociables
- Ne pas cacher artificiellement l'agent derriere une UX qui donne l'impression qu'il "fait semblant". Si l'agent planifie, teste, pivote ou se critique, cela doit etre visible proprement.
- Ne pas transformer Cowork en workflow rigide a etapes fixes sauf contrainte de securite explicite.
- Ne pas retirer un outil ou en masquer l'existence au modele sans bonne raison.
- Ne pas imposer des sequences inutiles du type "tu dois toujours faire X puis Y puis Z" si le modele peut choisir une meilleure strategie.
- Ne pas refuser une finalisation juste parce qu'elle ne correspond pas a une logique backend trop mecanique, si le resultat est reellement pret et que les garde-fous durs sont respectes.
- Toute regression vers un agent plus opaque, plus contraint, plus scripté ou moins auto-dirige doit etre traitee comme une regression produit.

## Direction Architecturale Cible
- Backend mince, modele fort: le backend fournit le sandbox, l'inventaire des outils, l'etat persistant, la telemetrie, les garde-fous durs et la serialisation des runs.
- Strategie modele-led: le modele choisit son plan, ses appels d'outil, ses iterations, ses pivots, son auto-review et sa condition de fin.
- Visibilite maximale utile: timeline lisible, plan courant, rationale courte par action, etat des outils, blocages reels, et synthese finale.
- Outils decouvrables: Cowork doit connaitre clairement la liste des outils disponibles, leurs schemas d'entree/sortie et les cas d'usage typiques, sans etre force de les appeler.
- Fin de boucle honnete: l'agent doit pouvoir dire "j'ai fini" ou "je suis bloque", et le backend ne doit bloquer que pour une raison dure, explicite et justifiable.
- L'effet recherche/relecture/amelioration doit venir d'une vraie boucle du modele, pas d'un theatre de statuts.

## Architecture
- **Frontend** : React (Zustand pour l'etat). Le mode `cowork` envoie des requetes a `/api/cowork`.
- **Backend** : Express (Node.js). La route `/api/cowork` gere une boucle d'iteration (jusqu'a 15 tours) avec evenements SSE types (`status`, `narration`, `tool_call`, `tool_result`, `warning`, `text_delta`, `done`, `error`) et conservation stricte du tour modele Gemini 3.1 pour les `thoughtSignature`.
- **IA** : Gemini 3.1 Pro Preview (Vertex AI).

## Outils Locaux (localTools)
- `report_progress` : outil debug optionnel pour tracer la strategie. Il n'est plus obligatoire en mode normal.
- `music_catalog_lookup` : lookup musique/discographie specialise (catalogue officiel, titres manquants, album-only, feats optionnels, couverture par sources).
- `list_files` : Liste les fichiers a la racine.
- `read_file` : Lit le contenu d'un fichier (securise).
- `write_file` : Ecrit un fichier (force vers `/tmp/` sur Vercel).
- `list_recursive` : Exploration profonde du projet.
- `web_search` : recherche web locale visible avec qualite explicite (`relevant`, `degraded`, `off_topic`, `transient_error`), provider remonte et blocage des repetitions faibles.
- `web_fetch` : lecture d'une source web precise avec contenu nettoye.
- `begin_pdf_draft` : initialise un brouillon PDF persistant pour la session courante.
- `append_to_draft` : ajoute des sections et sources au brouillon PDF sans regenirer tout le document.
- `get_pdf_draft` : relit l'etat courant du brouillon PDF (mots, sections, theme, review approuvee).
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
- [x] Self-review PDF recommandee : pour les PDF exigeants, Cowork peut passer par `review_pdf_draft` avant `create_pdf` pour une vraie passe qualite visible, memoriser la signature du brouillon valide et reutiliser le cache de rendu. Cette review n'est plus un prerequis bloquant pour l'export.
- [x] Boucle hybride stateful : la boucle Cowork ne depend plus des nudges separes ni d'une limite dure a 15 tours. Elle reconstruit maintenant un `CoworkSessionState` backend-owned (`factsCollected`, `sourcesValidated`, `searchesFailed`, `toolsBlocked`, `phase`, `modelCompletionScore`, `completionScore`, `modelTaskComplete`, `effectiveTaskComplete`, `blockers`, `consecutiveDegradedSearches`, `cooldowns`) et ne livre que quand le backend valide l'etat final.
- [x] `report_progress` structure obligatoire : le modele doit maintenant fournir `what_i_know`, `what_i_need`, `why_this_tool`, `expected_result`, `fallback_plan`, `completion.score`, `completion.taskComplete` et `completion.phase` avant tout outil actionnable. Cowork refuse les tours sans ce schema ou avec plusieurs outils actionnables dans le meme tour.
- [x] Cooldowns web scoppes + pivot direct : apres incident transitoire `403/429`, Cowork place un cooldown par famille de requete ou hostname (`2s -> 4s -> 8s -> 16s`) au lieu de bloquer toute la boucle. Apres 2 recherches degradees sur une meme famille, le prompt backend pousse explicitement vers des URLs directes de fallback (`fr_news`, `intl_news`, `economy`, `tech_docs`, `sport`).
- [x] Timeline epuree par defaut : le frontend comprend maintenant l'evenement SSE `reasoning`, affiche `phase`, `% de completude`, `blocages`, `sources validees` et masque les `tool_call` en vue normale. Les messages type `Iteration X` / `Cowork poursuit l'execution` ont disparu de l'UX.
- [x] Firestore + tests aligns : `runMeta` accepte maintenant aussi `validatedSearches`, `degradedSearches`, `blockedQueryFamilies`, `validatedSources`, `blockerCount`, `phase`, `completionScore`, `modelCompletionScore`, `taskComplete`, et un test `test-cowork-loop.ts` couvre le gate strict factual, la livraison PDF, le fallback direct et l'echelle de cooldown.
- [x] Stabilisation du streaming et des réponses : correction du bug de l'ancienne réponse qui persistait lors d'un nouvel envoi grâce à un reset synchrone du state `streamingContent`.
- [x] Amélioration UX du bloc de réflexion : ajout d'une `min-h` stable, d'un `ThinkingIndicator` plus explicite et d'animations de transition pour supprimer les sauts d'écran lors du passage de l'analyse à la réponse.
- [x] Automatisation des liens YouTube : détection automatique des URLs YouTube (pasting), extraction en pièce jointe type `youtube`, retrait du lien du texte et récupération du titre via la nouvelle route backend `/api/metadata`.
- [x] Correction de la ReferenceError au démarrage : réorganisation des déclarations dans `App.tsx` pour s'assurer que `displayedMessages` et `activeSession` sont initialisés avant d'être utilisés dans les hooks (TDZ).
- [x] Routeur d'execution Cowork : `/api/cowork` choisit maintenant entre `creative_single_turn`, `research_loop` et `artifact_loop` au lieu d'envoyer toutes les demandes dans la meme boucle outillee.
- [x] Mode creatif mono-appel : les textes creatifs sans besoin externe passent maintenant par un seul appel modele avec plan interne cache, redaction, auto-relecture et polish, sans `web_search` force ni timeline pseudo-agentique.
- [x] Blocage discret des prompts haineux : Cowork coupe desormais en amont les demandes visant a humilier/deshumaniser des groupes, sans lancer d'outils ni de recherche, puis propose un recadrage bref vers une critique des comportements/systemes.
- [x] No-op detection : la boucle memorise `stalledTurns`, `lastProgressFingerprint` et `lastActionSignature`, puis s'arrete proprement apres 3 tours sans progres concret au lieu de consommer 20-30 appels modele.
- [x] No-op detection multi-outils fiabilisee : Cowork fingerprint maintenant aussi l'etat de review PDF validee (`latestApprovedPdfReviewSignature`) et compte les no-op sur la repetition du meme etat backend meme si l'agent alterne `review_pdf_draft -> create_pdf -> release_file -> finalisation refusee`, ce qui coupe enfin les faux progres en boucle.
- [x] `web_fetch` pertinent ou rien : une lecture ne compte plus comme source validante uniquement parce qu'elle est `full`; il faut maintenant `quality=full` ET `relevance=relevant` contre la demande ou la derniere requete de recherche.
- [x] Completion backend-owned + UI compacte : `completionScore` n'est plus gonfle par l'auto-confiance du modele, `runMeta` expose `executionMode` / `publicPhase`, les `thoughts` Cowork sont caches par defaut et les compteurs debug lourds ne sont plus affiches en vue normale.
- [x] Finalisation propre sans `report_progress` : quand le modele livre enfin un vrai texte visible en mode normal, Cowork marque ce tour comme tentative de livraison (`markVisibleDeliveryAttempt`) puis accepte la reponse si les blocages backend sont leves. Cela corrige les boucles `Finalisation refusee` apres `create_pdf` + `release_file`.
- [x] Narration publique derivee des outils : si Gemini appelle un outil sans texte exploitable, Cowork emet maintenant une narration lisible (`Recherche`, `Verification`, `Relecture`, `Mise en page`, `Livraison`, etc.) a partir de l'outil reel, ce qui rend la boucle visible sans exposer le raisonnement brut.

- [x] Plan public modele-led : Cowork dispose maintenant d'un outil `publish_status` en mode normal pour exposer publiquement la phase, le focus, la prochaine action, le pivot et le critere de fin sans passer par `report_progress` ni par du texte final parasite.
- [x] Veto backend limite aux blocages durs : `research_incomplete` n'est plus un veto de livraison. Le backend continue de scorer et de verifier, mais `effectiveTaskComplete` ne depend plus que des vrais blockers durs (source/artefact/review), ce qui rapproche la boucle d'un mode "backend verifie, modele decide".
- [x] Fin des nudges backend systematiques : apres un appel d'outil, Cowork laisse maintenant Gemini repartir des vrais `functionResponse` sans injecter a chaque tour un message `user` de cadrage. Les rappels backend ne reviennent que sur tour vide, no-op, finalisation prematuree ou blocage dur explicite.
- [x] Couverture musique specialisee reconnue comme vraie preuve : une couverture `music_catalog_lookup` suffisamment solide peut maintenant lever l'exigence de source classique dans `computeCompletionState()`, au lieu de forcer artificiellement un `web_fetch` supplementaire.
- [x] Timeline Cowork sans chevauchement : le mode `cowork` n'utilise plus la virtualisation des messages dans `src/App.tsx`, ce qui evite les superpositions quand une carte agentique grossit fortement pendant le streaming (timeline, warnings, long texte final). Les autres modes gardent la virtualisation avec une remesure forcee.
- [x] Validation d'articles d'actu reellement pertinents : le matching strict de `web_fetch` ignore maintenant davantage de mots d'actualite trop generiques (`actualite`, `news`, `headlines`, `monde`, `international`, etc.), ce qui permet a un vrai article date et contextualise de lever `strict_source_missing` sans laisser passer les homepages generiques.
- [x] Tavily-first + pivot direct deterministic : `web_search` utilise maintenant Tavily comme provider autoritaire quand `TAVILY_API_KEY` est present, renvoie `searchMode`, `directSourceUrls` et `searchDisabledReason`, et n'active plus les moteurs publics par defaut (`ALLOW_PUBLIC_SEARCH_FALLBACKS=false`). Quand Tavily manque, degrade ou faiblit, Cowork pousse explicitement vers `web_fetch` sur des sources fiables au lieu de boucler sur des reformulations.
- [x] Broad-news FR+EN reconnu comme vrai contexte d'actu : les demandes type `actu du jour`, `actualite mondiale`, `panorama news` ou les requetes multi-angles (`economie + tech + climat + monde`) passent maintenant par une vraie categorie `broad_news`, avec sources FR+EN fiables (`franceinfo`, `lemonde`, `france24`, `reuters`, `bbc`, `aljazeera`) au lieu de basculer a tort vers `economy` ou `tech_docs`.
- [x] Pivot direct vraiment impose sur l'actu stricte : Cowork memorise maintenant un `pendingDirectPivot` par famille de recherche, marque les hotes deja tentes, refuse les nouveaux `web_search` proches tant qu'un `web_fetch` direct n'a pas ete tente/valide, et compte le changement d'hote comme un vrai progres pour eviter les faux no-op pendant le pivot.
- [x] Echec utilisateur modele-led au lieu de dump backend : si la boucle recherche s'arrete sans source validee ni artefact livre, Cowork ne copie plus `buildBlockerPrompt()` dans le texte visible. Il lance un dernier tour Gemini sans outils pour formuler une vraie reponse humaine de blocage, puis sort en `runState='failed'` au lieu de `completed`.
- [x] Contrat optionnel review -> create pour les PDFs : si `create_pdf.reviewSignature` est fournie, le backend valide via `validateCreatePdfReviewSignature()` qu'elle correspond exactement a la derniere self-review approuvee pour ce brouillon. Sinon, l'export peut partir sans review bloquante.
- [x] Brouillon PDF incrementiel persistant : Cowork dispose maintenant d'un `activePdfDraft` par session, construit via `begin_pdf_draft` / `append_to_draft` / `get_pdf_draft`, ce qui supprime la logique one-shot pour les PDF longs.
- [x] Cap produit PDF honnete : les demandes explicites au-dela de `3000` mots sont maintenant plafonnees a `~3000` mots par session, annoncees proprement, puis construites par tranches plutot que simulees visuellement.
- [x] PDF thematiques + audit anti-pages vides : `create_pdf` accepte `theme` (`legal`, `news`, `report`), applique des rendus distincts, active la cover seulement si le volume le justifie, et rejette/rerend les sorties contenant des pages body vides.
- [x] Migration hybride PDF vers LaTeX externe : Cowork peut maintenant choisir `engine=latex` pour les PDF premium/news/report et conserver `pdfkit` pour les documents simples/formels. Le client de compilation externe vit dans `server/pdf/latex.ts` et parle a un provider HTTP compatible YtoTech au lieu d'embarquer TinyTeX dans la Function Vercel.
- [x] Module LaTeX partage sorti de `api/` : le helper de rendu/compilation LaTeX a ete deplace vers `server/pdf/latex.ts` pour que Vercel l'embarque bien avec `api/index` au lieu de le traiter comme une Function routee separee, ce qui supprimе le crash `ERR_MODULE_NOT_FOUND` au boot de `/api/status`, `/api/chat` et `/api/cowork`.
- [x] Brouillon `.tex` stateful : `begin_pdf_draft` / `append_to_draft` / `get_pdf_draft` exposent maintenant `engine`, `compiler`, `signature`, `sourceMode` et un `sourcePreview` pour les brouillons LaTeX. Un draft LaTeX peut etre genere depuis les sections/meta ou pilote en source libre via `latexSource`.
- [x] Review LaTeX compilee + cachee : `review_pdf_draft` tente une vraie compilation de controle quand le moteur vaut `latex`, remonte `compileLogPreview`, met en cache le PDF signe et laisse `create_pdf` reutiliser ce cache si la signature approuvee est inchangée.
- [x] Anti-boucle PDF renforce : `create_pdf` detecte maintenant `alreadyCreated`, refuse un troisieme echec sur la meme signature LaTeX sans modification materielle, et bloque les recreations inutiles apres un `release_file` reussi sur le meme artefact.
- [x] Config runtime LaTeX explicite : ajout de `LATEX_RENDER_PROVIDER`, `LATEX_RENDER_BASE_URL` et `LATEX_RENDER_TIMEOUT_MS` dans `.env.example` et `/api/status`, avec une suite de tests dedies (`test-latex-provider.ts`) pour succes / erreur / timeout du provider externe.
- [x] Mode refinement esthetique PDF : Cowork detecte maintenant quand l'utilisateur demande de modifier l'esthetique d'un PDF deja livre (via `requestIsArtifactRefinement` + `historyContainsRecentPdfDelivery`), passe en mode `artifact_refinement` qui desactive la recherche web, filtre les outils de recherche, skip les blockers de recherche dans `computeCompletionState`, et injecte un system prompt specifique pour re-styler le PDF depuis le contenu deja present dans l'historique.
- [x] Template news magazine premium : le theme `news` dispose maintenant d'un rendu dedie (`buildNewsLatexDocument`) avec couverture pleine page (fond sombre + accent rouge via TikZ/eso-pic), blocs tcolorbox colores par section (8 palettes alternees), separateurs visuels, pagination stylisee et sources dans un encadre.
- [x] Packages LaTeX enrichis : ajout de `fontspec`, `setspace`, `eso-pic`, `microtype`, `ragged2e`, `parskip` a `ALLOWED_LATEX_PACKAGES` pour permettre un controle typographique et visuel complet en XeLaTeX.
- [x] Prompt Cowork "libere v2" : le system prompt fait maintenant passer l'honnetete avant la completion, impose un aveu d'insuffisance apres 3 tentatives serieuses sans resultat probant, pousse l'exclusion semantique des homonymes/hors-sujet (`-google -cloud -api`, contexte, domaine) et explique explicitement comment reagir quand `stalledTurns` augmente.

- [x] LIBERATION COMPLETE: Cowork est passe d'une boucle hybride backend-owned a un agent modele-led. Le backend fournit des outils, le modele decide seul de sa strategie. Changements:
  - Suppression de `classifyCoworkExecutionMode` et tous les `requestNeeds*`/`requestIs*` qui scannaient les mots-cles pour forcer un mode.
  - Suppression de tous les hard blockers (`research_incomplete`, `strict_source_missing`, `pdf_review_required`, `artifact_not_created`, `artifact_not_released`).
  - Suppression de `buildBlockerPrompt` et `buildResearchCompletionPrompt` qui injectaient des ordres comme messages `role:user`.
  - Suppression de la logique "Finalisation refusee" qui bloquait le texte visible du modele.
  - Tous les outils toujours disponibles (plus de filtrage par mode).
  - `review_pdf_draft` retourne toujours `ready: true` (suggestions, pas blocages).
  - `validateCreatePdfReviewSignature` retourne toujours `ok: true` (plus de signature obligatoire).
  - System prompt universel non-directif : "Tu decides seul de ta strategie."
  - Garde-fous conserves : coupe-circuit anti-boucle (stalledTurns >= 3), sandbox fichiers, compilation LaTeX, anti-abus.

## Prochaines Etapes
1. Observer le comportement du modele en mode libre et ajuster le system prompt si necessaire.
2. Muscler `publish_status` pour qu'il couvre aussi l'auto-critique avant livraison, la raison de pivot et l'eventuelle declaration honnete de blocage.
3. Nettoyer le code mort : supprimer les fonctions `requestNeeds*`/`requestIs*` et `classifyCoworkExecutionMode` completement au lieu de les neutraliser.
6. Rendre la timeline plus fidele a la vraie autonomie de l'agent: moins de cosmétique, plus d'etat reel, de plan et de decisions.
7. Rejouer le cas `fais un son "allo salam" avec une vraie boucle agentique ... puis fais un beau pdf` pour verifier qu'on retrouve une boucle de recherche -> ecriture -> critique -> amelioration -> PDF -> livraison, sans logique mecanique parasite.
8. Revalider en production les cas reels `creer moi un pdf test`, `fais-moi l'actu du jour puis fournis un PDF`, `fais moi un pdf tres long sur l'actu du jour`, puis naviguer entre plusieurs conversations Cowork pour verifier que la liberte de l'agent reste compatible avec la stabilite produit.
9. Rejouer en production les cas factuels sensibles (`Tariq Ramadan il va aller en prison ?`, `actu du jour stp`, `Iran : actualite brulante`) pour verifier qu'un agent plus libre reste honnete, source, et capable de pivoter sans broder.
10. Rejouer en production les cas de recherche creative ancree dans le reel (`cherche toute l'actu sur lui puis fais un son`) pour verifier que l'agent choisit lui-meme la bonne profondeur de recherche avant d'ecrire.
11. Rejouer en production le cas VEN1 et d'autres artistes ambigus pour verifier que `music_catalog_lookup` reste un outil librement utilisable par le modele, sans rigidifier le flux global.
12. Ajouter si besoin une vraie carte d'artefact Cowork (boutons `Ouvrir` / `Telecharger` / `Copier le lien`) sans masquer la logique agentique reelle.
13. Reintroduire un streaming modele plus fin uniquement si on peut recuperer a la fois le ressenti "live", la visibilite des decisions, et la conservation exacte du tour Gemini signe.
14. Verifier que `TAVILY_API_KEY` est bien configure sur Vercel, puis revalider les demandes strictes (actualite, justice, docs/version) avec Tavily en provider prioritaire et les fallbacks publics seulement en secours.
15. Rejouer en production des demandes de documents formels sans le mot `pdf` (`fais moi une attestation de stage fictive`, `lettre de motivation fictive`, `certificat de travail`) pour verifier qu'un agent plus libre garde un rendu officiel propre sans replonger dans des workflows figes.
16. Configurer en production `LATEX_RENDER_PROVIDER` / `LATEX_RENDER_BASE_URL` / `LATEX_RENDER_TIMEOUT_MS`, puis rejouer les cas premium (`actu magazine`, `rapport thematique`, `pdf beau`) pour valider le chemin LaTeX externe sur Vercel.
17. Observer les vrais taux d'echec du provider LaTeX externe (timeouts, 4xx/5xx, logs de compilation), puis ajuster si besoin la politique de retry et les messages de pivot plutot que de degrader silencieusement vers `pdfkit`.

### Revalidation Additionnelle
1. Rejouer le cas `fais un son "allo salam" avec une vraie boucle agentique ... puis fais un beau pdf` pour verifier qu'apres `review_pdf_draft -> create_pdf -> release_file`, Cowork livre bien le texte final ou le lien sans repasser par `Finalisation refusee`.
2. Verifier en production qu'un tour final texte sans `report_progress` est bien accepte quand les blocages backend sont leves, au lieu d'etre compte comme `blocked_visible_text`.
3. Verifier que les nouvelles narrations publiques (`Recherche`, `Verification`, `Relecture`, `Mise en page`, `Livraison`) apparaissent bien meme quand Gemini appelle un outil sans texte d'accompagnement.
