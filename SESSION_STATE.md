# SESSION STATE

## Derniere mise a jour
- Date: 2026-03-29
- Contexte: chantier Cowork / Hub Agents

## Accompli dans cette session
- Un `Hub Agents` natif a ete branche dans Cowork au lieu de rester une idee separee.
- Le backend Cowork sait maintenant concevoir un agent specialise via l'outil `create_agent_blueprint`.
- Cowork sait maintenant relancer un agent deja present dans le hub comme vraie sous-mission via `run_hub_agent`.
- Chaque requete `/api/cowork` embarque maintenant le catalogue des agents du hub pour que le modele puisse choisir entre reutiliser un specialiste existant ou en creer un nouveau.
- Le sous-agent execute une mini-boucle reelle avec le `systemInstruction` du blueprint et seulement les outils autorises par cet agent.
- La timeline Cowork expose des etapes explicites `Sous-mission` / `Sous-mission terminee` pendant la delegation reelle.
- Les regles Firestore du projet ont ete redeployees (`npm run deploy-rules`) pour corriger le `Missing or insufficient permissions` sur `users/{uid}/agents`.
- Le frontend n'interrompt plus tout le run Cowork si la persistance Firestore d'un `agent_blueprint` echoue: il affiche maintenant un warning de synchronisation du hub et continue la reponse.
- La boucle `/api/cowork` emet un nouvel evenement SSE `agent_blueprint`.
- Le frontend persiste les blueprints dans Firestore sous `users/{uid}/agents`.
- Une interface `Hub Agents` a ete ajoutee pour visualiser les agents crees, leur mission, leurs outils et leur premiere UI.
- Une route manuelle `/api/agents/create` a ete ajoutee pour creer un agent depuis l'interface sans passer par un run Cowork.
- Les regles Firestore ont ete mises a jour pour autoriser la collection `agents`.
- `AI_LEARNINGS.md` et `COWORK.md` ont ete enrichis avec la decision Hub Agents.

## Intentions du dernier changement
- Faire de la delegation une vraie capacite produit de Cowork.
- Eviter que Cowork dise "je t'ai cree un agent" sans objet persistant, sans UI et sans reutilisation possible.
- Poser le socle du futur modele "Cowork = agent general + possibilite de creer et relancer des specialistes".
- Passer du niveau "blueprint persiste" au niveau "specialiste relancable" sans introduire un sous-systeme multi-sessions separe.

## Fichiers modifies ou crees
- `api/index.ts`
- `api/lib/agents.ts`
- `api/lib/schemas.ts`
- `src/App.tsx`
- `src/components/AgentsHub.tsx`
- `test-cowork-loop.ts`
- `firestore.rules` (redeploy cote cloud, pas de contenu change dans cette session)

## Verification effectuee
- `npm run lint` : OK
- `npm run build` : OK
- `npx tsx test-cowork-loop.ts` : OK
- `npm run deploy-rules` : OK
- Validation navigateur authentifiee toujours non rejouee cette session : le blocage Firebase Auth local sur `127.0.0.1` reste actif.

## Blocages et pieges actifs
- Blocage principal: `auth/unauthorized-domain` sur `127.0.0.1` pendant le login Google en local.
- Consequence: impossible de valider visuellement en session connectee le cycle complet "creer un agent -> persistance Firestore -> reaffichage" tant que le domaine local n'est pas autorise dans Firebase Auth ou tant qu'on ne valide pas sur le domaine de deploiement.
- Attention: les consignes projet disent de privilegier la validation sur l'URL de production plutot que `localhost`.

## Ce qu'il reste a faire
- Transformer `uiSchema` en vraie surface de generative UI executable avec formulaire borne.
- Ajouter un point d'entree UI plus direct pour forcer ou suggerer explicitement la relance d'un agent du hub depuis l'interface si on veut reduire la dependance au choix autonome du modele.
- Ajouter l'auto-fill pour remplir le schema d'un agent a partir d'une demande libre.
- Cadrer le pipeline podcast pour script + TTS + musique Lyria avec verification officielle des model IDs et des APIs exactes.
- Valider visuellement le Hub Agents sur un domaine autorise Firebase.

## Reprise ideale la prochaine session
1. Verifier le domaine de validation disponible (Vercel ou domaine Firebase autorise).
2. Rejouer un run Cowork qui choisit un agent deja existant du hub et verifier qu'il appelle `run_hub_agent` au lieu de recreer un blueprint.
3. Si la relance autonome marche, ajouter si besoin une commande/UI explicite pour "forcer la delegation a cet agent".

## Mise a jour complementaire - 2026-03-29 (image + TTS + Lyria)
- Nouveau besoin implemente: Cowork peut maintenant appeler nativement la generation d'image, Gemini TTS et Lyria sans heuristiques de mots-cles.
- Backend:
  - nouveau helper partage `api/lib/media-generation.ts`
  - nouvelles routes `POST /api/generate-audio` et `POST /api/generate-music`
  - nouveaux `localTools` Cowork:
    - `generate_image_asset`
    - `generate_tts_audio`
    - `generate_music_audio`
- UI:
  - le mode `audio` de `src/App.tsx` est enfin branche vers `/api/generate-audio`
  - `src/components/SidebarRight.tsx` expose maintenant le choix du modele TTS, de la voix et de la locale
  - le modele audio par defaut est passe a `gemini-2.5-flash-tts`
- Point technique notable:
  - `createGoogleAI()` force maintenant `global` aussi pour les modeles `tts`
  - Lyria 2 renvoie l'audio dans `predictions[0].bytesBase64Encoded`
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK

## Mise a jour complementaire - 2026-03-29 (frontend premium shell)
- Nouveau besoin implemente: refonte transversale du frontend pour sortir du rendu "template glassmorphism" et aller vers une DA type studio editorial premium.
- Direction visuelle retenue:
  - shell cinematographique sombre avec accents cyan / ambre
  - empty state central transforme en vrai poster produit actionnable
  - rail gauche, scene centrale et panneau droit reunis dans une meme langue visuelle
- Modifications principales:
  - `src/index.css`: nouveau systeme de tokens, nouveaux composants visuels (`studio-panel`, `studio-panel-strong`, `studio-button-*`, `studio-input`), fond global plus riche, typographie `Sora` + `IBM Plex Mono`
  - `src/components/StudioEmptyState.tsx`: nouveau hero central par mode (`chat`, `cowork`, `image`, `video`, `audio`)
  - `src/App.tsx`: shell, header, overlays, empty states et footer de composition realignes; titre mobile tronque proprement
  - `src/components/SidebarLeft.tsx`: rail gauche deja refondu et confirme visuellement
  - `src/components/SidebarRight.tsx`: inspector harmonise avec la nouvelle DA, meilleur drawer mobile, cartes de reglages plus lisibles
  - `src/components/ChatInput.tsx`: zone de saisie plus premium, boutons utilitaires et CTA d'envoi mieux cadres
  - `src/components/MessageItem.tsx`: avatars, bulles et actions mieux integres dans le nouveau langage visuel
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation Playwright desktop: shell global OK, panneau droit OK
  - validation Playwright mobile: hero OK, header plus propre, drawer parametres OK
- Limites restantes:
  - les snapshots d'accessibilite Playwright continuent de montrer certains drawers "ouverts" meme quand le screenshot reel est correct; se fier au rendu capture, pas uniquement a l'arbre
  - `AgentsHub` et `AgentWorkspacePanel` sont deja mieux relies au shell global via `App.tsx`, mais une passe de polish dediee reste possible si on veut pousser encore le niveau "awwwards" sur ces surfaces
  - test reel minimal `generateImageBinary()` : OK
  - test reel minimal `generateGeminiTtsBinary()` : OK
  - test reel minimal `generateLyriaBinary()` : OK
- Limite restante:
  - pas encore de vrai mode UI dedie a la musique, seulement la route backend et l'outil Cowork/agents

## Mise a jour complementaire - 2026-03-29 (retour prod Hub Agents)
- Le popup `Missing or insufficient permissions` cote Hub Agents ne doit plus bloquer l'app: la liste agents et la creation passent maintenant en mode degrade local si Firestore refuse la lecture ou l'ecriture.
- Un cache local `src/utils/agentSnapshots.ts` hydrate le hub avant synchro Firestore, conserve les agents crees localement, et fusionne les snapshots cloud quand ils reviennent.
- `src/App.tsx` n'utilise plus `handleFirestoreError()` pour la liste d'agents; il affiche un warning non bloquant et garde le hub utilisable sur l'appareil courant.
- `persistAgentBlueprint()` sauvegarde d'abord l'agent en etat local, puis tente Firestore en best effort sans casser le run ni la creation manuelle.
- `src/components/AgentsHub.tsx` n'est plus un simple registre: le panneau droit rend maintenant un vrai formulaire a partir du `uiSchema` (avec fallback `missionBrief` si le schema est vide) et expose un CTA `Lancer dans Cowork`.
- `handleRunAgentFromHub()` construit une relance explicite sur l'agent existant du hub et force le chemin "reutilise ce specialiste / n'en cree pas un nouveau".
- Deploiement prod effectue: `vercel deploy --prod --yes` a re-aliasse `https://vertex-ai-app-pearl.vercel.app` sur la build contenant le correctif Hub + l'UI executable.
- Verification supplementaire:
  - `npm run lint` : OK
  - `npm run build` : OK
  - chargement Playwright de `https://vertex-ai-app-pearl.vercel.app` : OK sur la surface publique
- Limite restante: le flow Hub authentifie n'a toujours pas ete revalide en navigateur de test sans session Google; la validation complete depend d'un compte connecte sur le domaine autorise.

## Mise a jour complementaire - 2026-03-29 (correction du modele produit agent)
- Le besoin produit a ete clarifie: l'utilisateur ne veut PAS que Cowork utilise l'agent a sa place.
- Nouveau modele produit retenu:
  - Cowork cree l'agent
  - Cowork peut ensuite modifier l'agent
  - l'utilisateur ouvre l'agent dans son propre workspace et l'utilise directement
- `src/App.tsx` gere maintenant des sessions `sessionKind='agent'` avec `agentWorkspace` (snapshot d'agent + valeurs de formulaire).
- Une session agent passe par la boucle outillee `/api/cowork`, mais en runtime agent:
  - prompt systeme = `systemInstruction` de l'agent
  - tools visibles = tools de l'agent uniquement
  - branding runtime = agent, pas Cowork
- Le frontend ouvre maintenant une vraie session `Agent · <Nom>` quand on lance un agent depuis le hub, puis envoie une mission initiale construite depuis `starterPrompt` + les champs remplis.
- Un nouveau panneau `AgentWorkspacePanel` affiche:
  - les champs de l'interface de l'agent
  - un bouton `Relancer l'agent`
  - une zone `Envoyer a Cowork` pour demander une evolution de l'agent
- Cowork sait maintenant modifier un agent existant via un nouvel outil backend `update_agent_blueprint`, qui emet a nouveau `agent_blueprint` avec le meme `id` d'agent pour ecraser le blueprint existant.
- Deploiement prod re-execute apres ce vrai changement de cap:
  - `vercel deploy --prod --yes`
  - alias prod confirme sur `https://vertex-ai-app-pearl.vercel.app`

## Ce qu'il reste a faire
- Valider en session connectee le cycle complet:
  - ouvrir un agent depuis le hub
  - verifier que le workspace agent apparait
  - relancer l'agent dans sa propre conversation
  - demander une modif a Cowork
  - verifier que le meme agent du hub est mis a jour
- Ajuster eventuellement la copy restante qui parle encore de `run_hub_agent` dans certaines reponses libres du modele.

## Mise a jour complementaire - 2026-03-29 (faux positif artefact/PDF)
- Bug reproduit et corrige: une demande non artefact du type `c quoi le mieux entre le plus et le business` pouvait basculer en pipeline PDF si le texte colle contenait un mot ambigu comme `presentation` (ex: `sur presentation d'un numero de TVA valide`).
- Cause racine: `requestNeedsDownloadableArtifact()` et `requestNeedsPdfArtifact()` lisaient tout le message brut, y compris les longs contenus colles, au lieu de se concentrer sur l'intention de la demande.
- Correctif applique dans `api/index.ts`:
  - ajout de `getCoworkIntentWindow()`
  - ajout de `requestHasDeliverableIntent()`
  - durcissement des heuristiques pour que les noms ambigus (`presentation`, `document`, `rapport`, etc.) ne declenchent un livrable que s'ils sont portes par une vraie intention de creation/export
- Regression ajoutee dans `test-cowork-loop.ts`:
  - le cas `presentation d'un numero de TVA valide` doit rester `false`
  - une vraie demande `cree moi une presentation...` doit rester `true`
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK
  - reproduction isolee via `npx tsx -` : prompt fautif => `{ downloadable: false, pdf: false }`

## Mise a jour complementaire - 2026-03-29 (suppression du forcing runtime par mots-cles)
- Retour produit explicite: l'utilisateur ne veut plus de backend qui decide "il faut un PDF / un fichier / une recherche" a partir de mots-cles. La logique voulue est: intelligence du modele + bon prompt systeme, avec garde-fous fondes sur l'etat reel, pas sur le lexique.
- Correctif applique dans `api/index.ts`:
  - `buildCoworkSystemInstruction()` n'injecte plus de directives runtime conditionnelles basees sur `requestNeedsDownloadableArtifact()` / `requestNeedsPdfArtifact()` / `requestNeedsExternalGrounding()`
  - `computeCompletionState()` ne bloque plus un run juste parce que le prompt contenait `pdf` ou `document`
  - les blockers artefact ne se declenchent maintenant que si un livrable est reellement en cours (`activePdfDraft`) ou deja cree (`latestCreatedArtifactPath`)
  - `buildArtifactCompletionPrompt()` ne force plus la completion d'apres le texte utilisateur; il ne pousse a `create_pdf` / `release_file` que si l'artefact est deja amorce
  - les messages de fallback finaux ne parlent plus de PDF a partir du prompt; ils se calent sur l'etat reel du run
- Regressions ajoutees dans `test-cowork-loop.ts`:
  - un prompt `Cree-moi un PDF de test` sans brouillon ni fichier cree ne bloque plus artificiellement la completion
  - un brouillon PDF actif + aucun fichier final cree => `artifact_not_created`
  - un fichier deja cree mais non publie => `artifact_not_released`
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK

## Mise a jour complementaire - 2026-03-29 (Cowork plus engage sans plan impose)
- Nouveau retour produit: Cowork etait encore trop paresseux sur les livrables editoriaux type `pdf actu du soir`, avec peu de recherches, aucune source lue, et un brouillon/artefact lance trop tot.
- Correctif applique:
  - le system prompt Cowork pousse maintenant explicitement a calibrer l'effort sur l'ambition reelle de la mission et a refuser les versions maigres
  - ajout d'un helper `buildCoworkEngagementNudge()` dans `api/index.ts`
  - apres un tour outils, si l'etat reel montre une matiere trop mince pour la promesse du livrable (ex: recherches sans lecture directe, brouillon editorial trop court ou peu source), la boucle injecte une relance qualite douce au modele
  - cette relance n'impose pas un plan fixe; elle dit au modele d'enrichir, varier, lire, pivoter ou assumer une version courte, mais lui laisse choisir la meilleure suite
- Etat technique:
  - nouveau champ session `lastEngagementNudgeSignature` pour eviter les relances qualite repetitives sur le meme etat
  - couverture de tests ajoutee sur les cas:
    - `web_search` repete sans `web_fetch`
    - brouillon PDF editorial encore trop maigre
    - brouillon suffisamment dense et source => pas de nudge
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK

## Mise a jour complementaire - 2026-03-29 (suppression des heuristiques restantes et des relances backend)
- Nouveau retour produit explicite: l'utilisateur ne veut plus aucun moteur backend pilote par mots-cles ni aucune relance qui dicte la strategie au modele pendant le run.
- Correctif applique dans `api/index.ts`:
  - retrait de la relance `buildCoworkEngagementNudge()` du chemin runtime
  - retrait de la relance automatique `artifactCompletionPrompt` quand Cowork essaye de conclure sans avoir fini le livrable; le run echoue maintenant honnetement au lieu de recevoir un ordre backend supplementaire
  - `web_search` n'aligne plus la requete sur la date ni sur une categorie deduite du prompt; le modele peut maintenant passer explicitement `topic`, `searchDepth`, `strict`, `timeRange`, `includeDomains`, `directSourceUrls`
  - `web_fetch` accepte maintenant `contextQuery` et `strict` explicitement, sans deduire la severite depuis le prompt utilisateur
  - `buildTavilySearchPlan()` et `searchWeb()` ne choisissent plus `news`, `advanced`, des domaines de confiance ou des sources directes a partir de mots du prompt; sans option explicite, les defaults sont neutres
  - `getPdfQualityTargets()` retourne maintenant `null` par defaut et les choix PDF auto (`theme`, `engine`, exigences editoriales) ne sont plus derives du message utilisateur
  - `resolvePdfEngine()` ne force plus `latex` depuis le prompt; `auto` tombe maintenant sur `pdfkit` tant que le modele n'exprime pas autre chose
- Correctif applique dans les tests:
  - refonte de `test-cowork-loop.ts` pour verifier les nouveaux defaults neutres et les options explicites
  - refonte de `test-pdf-heuristics.ts` pour verifier le contrat PDF sans heuristiques implicites
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-pdf-heuristics.ts` : OK
  - `npm run build` : OK

## Mise a jour complementaire - 2026-03-29 (LaTeX premium par section/page)
- Nouveau besoin implemente: les PDF LaTeX peuvent maintenant changer de direction artistique par section/page sans exiger un raw `.tex` complet.
- Backend / contrat:
  - `PdfSectionInput` et `NormalizedPdfSection` acceptent maintenant:
    - `visualTheme`
    - `accentColor`
    - `mood`
    - `motif`
    - `pageStyle`
    - `pageBreakBefore`
    - `flagHints`
  - `begin_pdf_draft`, `append_to_draft`, `review_pdf_draft` et `create_pdf` documentent ces champs dans leurs schemas d'outil et les preservent dans le brouillon/state.
- Rendu:
  - `server/pdf/latex.ts` sait maintenant produire:
    - un `report` premium avec couverture soignee
    - un `news` premium via le nouveau chemin `buildNewsLatexDocumentV2`
    - des spreads de section TikZ avec palettes, motifs et badges drapeaux
  - le mode `legal` reste volontairement sobre.
- Compatibilite LaTeX:
  - `ALLOWED_LATEX_PACKAGES` a ete etendu pour accepter plus de packages de mise en page premium (`calc`, `array`, `booktabs`, `fontawesome5`, `lettrine`, `charter`, `helvet`, etc.)
  - correction technique importante: les mini-drapeaux utilisent maintenant des couleurs TikZ valides via `fill={[HTML]...}`.
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-latex-provider.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npm run build` : OK
  - smoke test compile LaTeX reelle via provider externe (`ytotech`, `xelatex`) : OK, PDF binaire recu (~23 KB)
- Intention du dernier changement:
  - rendre Cowork capable de faire un PDF "arbres" vraiment theme arbre
  - permettre a un journal multi-sujets d'avoir une vraie DA differente par page/section (ex: guerre puis football)
  - rester modele-led: aucun forcing backend par mots-cle, seulement des champs explicites que le modele peut choisir

## Mise a jour complementaire - 2026-03-29 (brouillon PDF vraiment revisable)
- Retour produit explicite: le brouillon PDF etait encore traite comme un quasi-export, car la seule mutation riche etait `append_to_draft`; Cowork pouvait donc ecrire un premier jet puis filer trop vite vers `create_pdf`.
- Correctif applique dans `api/index.ts`:
  - ajout d'un vrai helper `reviseActivePdfDraft()` cote backend
  - ajout d'un nouvel outil `revise_pdf_draft`
  - le brouillon peut maintenant:
    - changer `title`, `subtitle`, `summary`, `author`
    - remplacer toute la liste de sections
    - appliquer des operations structurelles 1-based (`replace`, `remove`, `insert_before`, `insert_after`, `append`)
    - remplacer ou enrichir les sources via `sourcesMode=append|replace`
  - garde-fou honnete pour le mode LaTeX raw:
    - si le brouillon est en `sourceMode='raw'`, une vraie revision structurelle en LaTeX exige un `latexSource` complet mis a jour
    - seule exception pratique: l'agent peut aussi basculer explicitement vers `engine='pdfkit'`
  - la consigne systeme Cowork parle maintenant du brouillon comme d'un atelier de travail:
    - premier jet
    - relecture
    - revision
    - export seulement quand le texte est mur
  - le fallback artefact n'ordonne plus "termine-le maintenant", il rappelle aussi les options `get_pdf_draft`, `revise_pdf_draft`, `review_pdf_draft`
- Effet produit:
  - Cowork n'est plus limite a "ajouter encore un bloc"
  - il peut reellement revenir sur le plan, reecrire une section, supprimer un passage faible, reordonner la structure et reprendre son texte avant export
- Tests ajoutes:
  - revision d'un brouillon avec remplacement / insertion / suppression de sections
  - refus honnete d'une vraie revision sur brouillon LaTeX raw sans `latexSource` complet
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-latex-provider.ts` : OK
  - `npm run build` : OK

## Mise a jour complementaire - 2026-03-29 (podcast audio complet)
- Retour produit explicite: l'utilisateur veut que Cowork puisse creer un vrai podcast, pas seulement un texte ou deux assets audio separes. Le texte parle doit pouvoir etre cree/narre par `gemini-2.5-pro-tts`, et le fond sonore doit venir de Lyria.
- Correctif applique:
  - `api/lib/media-generation.ts`
    - ajout de `DEFAULT_PODCAST_TTS_MODEL = 'gemini-2.5-pro-tts'`
    - ajout des builders:
      - `buildPodcastNarrationPrompt()`
      - `buildPodcastMusicPrompt()`
    - ajout de `generatePodcastEpisode()`
    - le pipeline fait maintenant:
      - narration TTS
      - generation du bed musical Lyria
      - mix final local via `ffmpeg`/`ffprobe`
  - `api/index.ts`
    - ajout du tool Cowork `create_podcast_episode`
    - ce tool accepte soit:
      - `script` exact a narrer
      - soit `brief` pour laisser `gemini-2.5-pro-tts` creer et dire lui-meme le texte parle
    - sortie: vrai fichier audio final dans `/tmp/`, pret a publier via `release_file`
- Contrat actuel:
  - modeles par defaut du tool podcast:
    - TTS: `gemini-2.5-pro-tts`
    - musique: `lyria-002`
  - le mix ajoute une petite intro musicale, cale la voix dessus, baisse le fond, puis fait une outro courte
  - le tool renvoie aussi des apercus de prompts (`narrationPromptPreview`, `musicPromptPreview`) pour debug utile
- Tests / verification:
  - `npm run lint` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-latex-provider.ts` : OK
  - `npm run build` : OK
  - smoke test reel minimal:
    - narration: `gemini-2.5-pro-tts`
    - musique: `lyria-002`
    - mix final: OK
    - fichier cree: `C:\\Users\\Yassine\\AppData\\Local\\Temp\\codex-podcast-smoke.mp3`
    - taille: ~350 KB
    - duree voix: ~12.7 s
    - duree finale: ~14.5 s
- Limite restante:
  - le mix final depend de `ffmpeg` present sur la machine serveur. Valide localement ici, mais non encore verifie sur l'hebergement distant.

## Mise a jour complementaire - 2026-03-29 (batterie Cowork)
- Nouveau besoin:
  - l'utilisateur a demande une vraie batterie de tests pour mesurer Cowork sur recherche, documents, raisonnement, stress et iteration
  - contrainte produit reconfirmee: corriger par personnalite / prompt systeme / descriptions d'outils, pas en remettant des forcing backend
- Correctifs appliques:
  - ajout du runner `test-cowork-battery.ts`
  - renforcement du prompt systeme Cowork dans `api/index.ts` pour:
    - dissocier clairement `web_search` (reperage) et `web_fetch` (lecture/verif directe)
    - pousser la couverture multi-angle / multi-pays / multi-entites
    - pousser la verification pour business / juridique / finance / RH / marche
    - rappeler qu'une couverture large avec trop peu de lectures directes reste mince
  - `buildCoworkProgressFingerprint()` compte maintenant aussi `webSearchCount` et `webFetchCount`, ce qui evite les faux stalls quand l'agent est encore en collecte utile
  - le message de resultat `web_search` dit maintenant explicitement que les pistes ne sont pas encore des sources lues
- Methode de test retenue:
  - les runs batterie les plus fiables se font avec un serveur backend ephemere lance dans le meme process shell que la batterie
  - le vieux serveur detache sur `:3000` etait instable pour les longues series de tests et produisait des faux negatifs
- Etat mesure:
  - rapports generes dans `tmp/cowork-battery/`
  - la batterie complete a ete jouee presque entierement puis completee par des sous-ensembles cibles pour finir `5.2` / `5.3`
  - passes robustes observes:
    - `2.1` CV + lettre
    - `3.1` arbitrage complexe
    - `4.2` tache impossible
    - `4.4` multilingue
    - `5.1` feedback loop
  - progres nets mais encore insuffisants:
    - `1.1` dossier eau: lit enfin plusieurs sources mais ne cherche pas encore assez large
    - `1.2` fact-check: forte hausse des recherches, ouverture de sources partielle mais encore sous le seuil cible
    - `5.3` chaine startups: va maintenant jusqu'aux 2 PDF et a la traduction, mais l'etayage direct des profils reste trop mince
  - faiblesse dominante restante:
    - Cowork reste encore sous-source sur certains dossiers larges, comparatifs de marche et taches multi-entites
    - plusieurs demandes business / juridiques / memo peuvent encore partir trop "de tete" ou avec trop peu de `web_fetch`
- Fichiers touches:
  - `api/index.ts`
  - `test-cowork-battery.ts`
  - `test-cowork-loop.ts`

## Mise a jour complementaire - 2026-03-29 (Vercel Hobby / limite de fonctions)
- Nouveau besoin:
  - la prod Vercel echouait avec `No more than 12 Serverless Functions can be added to a Deployment on the Hobby plan`
  - l'utilisateur a demande une correction sans perte de performances ni de fonctionnalites
- Cause racine confirmee:
  - `vercel.json` rewrite deja tout `/api/(.*)` vers `/api`, donc l'architecture cible etait bien un seul point d'entree backend
  - malgre ca, le dossier `api/` contenait encore `lib/*`, `middleware/*` et `routes/*`
  - Vercel Hobby comptait ces fichiers `.ts` comme fonctions serveur supplementaires
- Correctif applique:
  - deplacement de tout l'interne hors de `api/` vers:
    - `server/lib/*`
    - `server/middleware/*`
    - `server/routes/*`
  - `api/index.ts` reste l'unique entree serverless routable
  - imports recables dans `api/index.ts`, `server/routes/standard.ts`, `test-cowork-loop.ts`, `test-podcast-media.ts`
  - suppression des dossiers vides `api/lib`, `api/middleware`, `api/pdf`, `api/routes`
- Verification:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx test-cowork-loop.ts` : OK
  - `npx tsx test-pdf-heuristics.ts` : OK
  - `npx tsx test-latex-provider.ts` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npx tsx test-image-gen.ts` : OK
  - `npx vercel build --prod` : OK
  - preuve cle: `.vercel/output/functions` ne contient plus qu'une seule fonction `api/index.func`
- Fichiers touches:
  - `api/index.ts`
  - `server/lib/agents.ts`
  - `server/lib/config.ts`
  - `server/lib/google-genai.ts`
  - `server/lib/logger.ts`
  - `server/lib/media-generation.ts`
  - `server/lib/path-utils.ts`
  - `server/lib/schemas.ts`
  - `server/lib/storage.ts`
  - `server/middleware/api-errors.ts`
  - `server/middleware/auth.ts`
  - `server/middleware/request-hardening.ts`
  - `server/routes/standard.ts`
  - `test-cowork-loop.ts`
  - `test-podcast-media.ts`
- Intention exacte:
  - aligner l'arborescence backend avec l'intention produit et la semantique Vercel: un backend Express monolithique expose via une seule function, avec le reste du code en modules internes non routables

## Mise a jour complementaire - 2026-03-29 (podcast master unique)
- Nouveau besoin:
  - l'utilisateur veut que Cowork livre un vrai podcast final, pas des stems separes voix/musique
  - il faut un seul fichier bien monte, avec la voix prioritaire sur la musique
  - il faut eviter que `create_podcast_episode` casse si `ffprobe` ou `ffmpeg` ne sont pas disponibles
- Correctifs appliques:
  - `server/lib/media-generation.ts`
    - suppression de la dependance dure a `ffprobe` pour mesurer la duree: la narration TTS est maintenant lue directement depuis son header WAV
    - ajout d'un fallback de mix WAV pur TypeScript quand `ffmpeg` est indisponible ou echoue
    - fallback avec:
      - resampling lineaire
      - adaptation mono/stereo
      - high-pass doux sur la voix
      - ducking du bed sous la voix
      - loop crossfade leger pour rendre la repetition musicale plus propre
      - limitation de pic en sortie
    - chemin `ffmpeg` ameliore quand disponible:
      - high-pass / low-pass
      - compression de voix
      - sidechain ducking
      - limiter final
  - `api/index.ts`
    - `create_podcast_episode` expose maintenant `outputExtension`
    - le tool est decrit comme le chemin normal pour un podcast pret a publier
    - `generate_tts_audio` / `generate_music_audio` sont explicitement recadres vers les cas ou l'utilisateur demande les composants separes
    - les resultats remontent maintenant `mixStrategy`
  - `server/lib/agents.ts`
    - `create_podcast_episode` rejoint la bibliotheque d'outils autorises
    - les agents podcast par defaut utilisent maintenant:
      - `web_search`
      - `web_fetch`
      - `generate_image_asset`
      - `create_podcast_episode`
      - `release_file`
    - le prompt d'architecte d'agents dit de preferer le master final unique aux stems separes
  - `src/components/AgentsHub.tsx`
    - copy et suggestion mises a jour pour pousser "master final bien mixe + cover"
- Verification:
  - `npm run lint` : OK
  - `npm run build` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npx tsx verify-agent-blueprints.ts` : OK
- Fichiers touches:
  - `server/lib/media-generation.ts`
  - `api/index.ts`
  - `server/lib/agents.ts`
  - `src/components/AgentsHub.tsx`
  - `test-podcast-media.ts`
  - `verify-agent-blueprints.ts`
- Limites restantes:
  - si on force un modele `lyria-3-*` et que l'hebergement n'a pas `ffmpeg`, le fallback WAV ne peut pas encore decoder le MP3 Lyria 3; le chemin le plus robuste reste `lyria-002` boucle sous toute la narration
  - la cover n'est pas encore embeddee dans le MP3; le bon chemin produit reste `create_podcast_episode` pour le master audio puis `generate_image_asset` pour la cover
- Intention exacte:
  - faire de "podcast" un vrai artefact audio premium de premiere classe dans Cowork
  - eviter que le modele livre des composants separes quand l'utilisateur attend un episode pret a publier

## Mise a jour complementaire - 2026-03-29 (stabilisation chat/agent + perf frontend)
- Retour produit traite:
  - frontend trop serre
  - selecteur de modeles recouvert par `Capacites & outils`
  - warning Hub local trop envahissant
  - sessions agent qui polluent `Chat & Raisonnement`
  - copy/runtime qui affichait encore Cowork dans un workspace agent
  - thinking Gemini invisible en chat standard
  - shell visuellement trop lourd et moins fluide
- Correctifs appliques:
  - `server/routes/standard.ts` envoie maintenant `thinkingConfig` avec `includeThoughts: true` sur `/api/chat`
  - `server/lib/google-genai.ts` centralise `buildThinkingConfig()` pour Gemini 3.x/3.1 et 2.5
  - `api/index.ts` migre aussi vers `thinkingConfig` pour Cowork/agent et pour les reponses finales bloquees
  - `src/store/useStore.ts` n'ecrase plus `lastSessionIdsByMode` pour `local-new` ou les sessions agent quand `remember` est desactive
  - `src/components/SidebarLeft.tsx` separe maintenant l'historique normal et les sessions `sessionKind='agent'`
  - `src/App.tsx` distingue mieux Cowork vs agent runtime dans les labels, placeholders et snapshots riches
  - le gros bandeau jaune Hub local est remplace par une ligne d'etat compacte en pills
  - `src/components/SidebarRight.tsx` remplace l'ancien dropdown absolu par une liste de modeles inline
  - `src/index.css`, `MessageItem.tsx`, `ChatInput.tsx`, `SidebarLeft.tsx`, `SidebarRight.tsx` et `App.tsx` ont ete alleges pour la fluidite
- Verification effectuee:
  - `npm run lint` : OK
  - `npm run build` : OK
  - validation Playwright locale sur `http://127.0.0.1:3000` : OK pour le shell, les libelles de mode et le selecteur de modeles non recouvert
  - validation SSE brute `/api/chat` avec `gemini-3.1-pro-preview` : OK, le stream renvoie maintenant des events `thoughts` avant `text`
- Limites restantes:
  - le rendu live du bloc thinking dans l'UI complete n'a pas ete rejoue en session Google connectee pendant cette passe
  - le warning Vite sur les chunks > 500 kB reste a traiter dans une prochaine passe perf si on veut pousser encore la fluidite

## Mise a jour complementaire - 2026-03-29 (podcast actu robuste)
- Bug produit traite:
  - un run `FAIS MOI UN PODCAST SUR LACTU DU JOUR` pouvait echouer en chaine avec:
    - blocage recitation
    - `ffmpeg ENOENT`
    - fallback WAV declare tronque
    - puis une reponse finale mensongere qui accusait le manque de sources au lieu du pipeline podcast
- Correctifs appliques:
  - `server/lib/media-generation.ts`
    - generation d'un script podcast original via `gemini-3.1-flash-lite-preview` avant passage au TTS
    - prompt musique Lyria rendu beaucoup plus abstrait pour eviter les recitation checks lies aux noms propres / titres d'actualite
    - retry musique avec prompt degrade si le premier prompt se fait bloquer
    - fallback final `voice-only` si le fond musical ou le mix ne sont pas disponibles
    - parser WAV assoupli quand seul le `data chunk` est tronque/plus court qu'annonce
    - si `ffmpeg` est absent, le fallback `wav-fallback` prend proprement le relais
  - `api/index.ts`
    - `create_podcast_episode` remonte maintenant `warning`, `narrationScriptPreview` et un message honnete si le master est cree en `voice-only`
    - la cloture Cowork conserve la vraie cause d'echec recente (`latestFailureContext`) au lieu d'inventer un probleme de sources
    - `buildCoworkBlockedUserReplyPrompt()` insiste pour ne pas blamer la recherche si le blocage principal vient d'un media/podcast/PDF
- Verification effectuee:
  - `npm run lint` : OK
  - `npx tsx test-podcast-media.ts` : OK
  - `npm run build` : OK
  - smoke test reel `generatePodcastEpisode()` sur un brief d'actu charge en noms propres : OK (`ffmpeg`, MP3)
  - smoke test reel sans `ffmpeg` dans le `PATH` : OK (`wav-fallback`, WAV final au lieu d'un crash)
