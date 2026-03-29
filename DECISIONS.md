# DECISIONS

## 2026-03-29 - Reparer les sessions Firestore orphelines depuis l'historique de messages
- Statut: adopte
- Contexte: des conversations existaient bien dans `users/{uid}/sessions/{sessionId}/messages`, mais pas dans `users/{uid}/sessions/{sessionId}` a cause d'un schema de regles trop strict. Resultat produit: aucune conversation visible sur les autres appareils.
- Decision: conserver Firestore comme source de verite, corriger les regles, puis reconstruire automatiquement les session shells manquants depuis une requete `collectionGroup('messages')` cote client.
- Pourquoi:
  - repare les conversations deja cassees sans migration admin separee
  - ne rajoute aucune dependance ni backend de maintenance
  - fonctionne aussi quand le parent de la sous-collection `messages` n'existe plus
- Alternatives ecartees:
  - script manuel admin ponctuel: trop fragile et non embarque dans le produit
  - reset total des conversations: inacceptable pour l'utilisateur
  - fallback local-only: ne resout pas la synchro multi-appareils

## 2026-03-29 - Hub Agents integre a Cowork
- Statut: adopte
- Contexte: l'utilisateur veut que Cowork soit l'essence du produit, capable soit d'executer lui-meme, soit de creer un specialiste delegable et reutilisable.
- Decision: integrer le Hub Agents dans l'univers Cowork au lieu de construire un produit annexe independant.
- Pourquoi:
  - colle a la vision produit "agent general + specialistes"
  - evite un hub decoratif sans lien avec la boucle agentique
  - permet a Cowork de livrer un objet concret et persistant quand il parle de delegation
- Consequence:
  - ajout de `create_agent_blueprint` cote backend
  - nouvel evenement SSE `agent_blueprint`
  - persistance Firestore `users/{uid}/agents`
  - UI `Hub Agents` cote frontend

## 2026-03-29 - Delegation via blueprint avant execution reelle
- Statut: adopte
- Contexte: il fallait livrer une premiere brique utile sans casser la boucle Cowork existante ni ouvrir tout de suite un sous-systeme multi-runs complexe.
- Decision: commencer par la creation et la persistance de blueprints d'agents avant de brancher l'execution d'un agent du hub comme sous-mission reelle.
- Pourquoi:
  - chemin le plus simple et le plus robuste pour livrer une valeur produit immediate
  - limite le risque de regression dans `/api/cowork`
  - fournit deja une base stable pour la future generative UI
- Alternatives ecartees:
  - sous-agents executes immediatement dans la meme session: trop de complexite pour un premier lot
  - hub frontend seulement: rejete car trop cosmetique

## 2026-03-29 - Pas de nouvelle dependance frontend pour le Hub
- Statut: adopte
- Contexte: le hub pouvait etre implemente avec la stack deja presente.
- Decision: reutiliser React, Motion, Firestore et la stack CSS existante sans ajouter de librairie d'UI ni de gestion de schema.
- Pourquoi:
  - aucune dependance additionnelle necessaire pour ce premier lot
  - limite la dette technique
  - accelere la livraison et le controle du rendu

## 2026-03-29 - Validation UI locale marquee comme partielle
- Statut: adopte
- Contexte: Playwright a permis de charger l'app, mais le login Google local est bloque par Firebase Auth.
- Decision: documenter explicitement la validation visuelle comme partielle et ne pas pretendre que le flow authentifie est valide.
- Pourquoi:
  - respect de l'honnetete radicale
  - evite de declarer un cycle Firestore/HUB verifie alors qu'il ne l'est pas completement

## 2026-03-29 - Relance d'un agent du hub par transmission explicite du catalogue
- Statut: adopte
- Contexte: le backend `/api/cowork` n'a pas acces nativement aux agents persistes dans Firestore cote client, donc il ne pouvait pas reutiliser un specialiste existant.
- Decision: transmettre le catalogue `hubAgents` dans chaque requete `/api/cowork`, puis ajouter un outil `run_hub_agent` qui relance un agent existant comme vraie sous-mission.
- Pourquoi:
  - garde l'architecture simple sans backend Firestore supplementaire
  - permet a Cowork de reutiliser un specialiste deja cree au lieu d'empiler des blueprints
  - rend la delegation reelle sans ouvrir tout de suite un sous-systeme multi-runs persistant
- Alternatives ecartees:
  - lecture Firestore directe cote backend: plus lourde et inutile pour cette etape
  - nouveau service dedie aux sous-agents: premature et trop risquee pour le lot actuel

## 2026-03-29 - Hub Agents local-first si Firestore degrade
- Statut: adopte
- Contexte: en production, des refus `Missing or insufficient permissions` pouvaient encore survenir sur `users/{uid}/agents`, et la lecture Firestore cassait l'UX du hub avec une popup bloquante.
- Decision: rendre le Hub Agents local-first avec snapshots `localStorage`, synchro Firestore en best effort et warning visible au lieu d'une erreur modale.
- Pourquoi:
  - l'agent cree doit rester utilisable meme si le cloud refuse temporairement la collection
  - la creation d'agent ne doit plus faire echouer Cowork ni l'interface manuelle
  - le hub reste coherent avec la promesse produit "delegation reutilisable"
- Consequence:
  - ajout de `src/utils/agentSnapshots.ts`
  - lecture `users/{uid}/agents` degradee en warning non bloquant
  - persistance locale avant tentative Firestore dans `persistAgentBlueprint()`

## 2026-03-29 - Le Hub doit etre une surface d'execution, pas un catalogue
- Statut: adopte
- Contexte: afficher seulement le `uiSchema` sous forme de badges donnait l'illusion d'une UI sans permettre de lancer reellement la mission.
- Decision: faire du Hub Agents une vraie interface de lancement avec renderer de champs, validation minimale et CTA direct vers Cowork.
- Pourquoi:
  - un agent sans interface executable reste trop abstrait pour l'utilisateur
  - la relance explicite reduit la dependance au choix implicite du modele
  - cela rend visible la difference entre blueprint, mission et execution
- Consequence:
  - `src/components/AgentsHub.tsx` rend maintenant un formulaire complet

## 2026-03-29 - Direction frontend "studio editorial premium"
- Statut: adopte
- Contexte: l'interface etait fonctionnelle mais encore trop proche d'un dashboard generique, avec un grand vide central et des panneaux visuellement inegaux.
- Decision: assumer une direction artistique forte type "atelier / control room" avec un hero editorial au centre, des panneaux unifies, une typographie plus marquee et un responsive pense des le shell.
- Pourquoi:
  - donne une vraie personnalite produit a Studio Pro au lieu d'un simple habillage
  - rend les etats vides utiles et desirables au lieu de montrer un trou dans l'interface
  - cree une base coherente pour tous les modes (`chat`, `cowork`, `image`, `video`, `audio`)
- Consequence:
  - refonte des fondations CSS dans `src/index.css`
  - ajout de `src/components/StudioEmptyState.tsx`
  - harmonisation de `src/App.tsx`, `SidebarLeft`, `SidebarRight`, `ChatInput` et `MessageItem`
  - validation visuelle systematique desktop + mobile via Playwright
  - `src/App.tsx` expose `handleRunAgentFromHub()`
  - le hub peut relancer un specialiste existant meme si son `uiSchema` est vide grace au fallback `missionBrief`

## 2026-03-29 - L'utilisateur utilise l'agent, Cowork l'edite
- Statut: adopte
- Contexte: le besoin produit a ete precise apres livraison du niveau 2. Le workflow vise n'est pas "Cowork utilise le specialiste pour toi", mais "Cowork construit l'agent, puis toi tu utilises cet agent directement".
- Decision: transformer les agents du hub en workspaces utilisateurs de premiere classe, et releguer Cowork a la creation et a l'edition de ces agents.
- Pourquoi:
  - colle au besoin reel formule par l'utilisateur
  - rend l'agent concret et accessible sans prompt technique
  - permet une boucle produit claire: usage direct -> feedback -> modification par Cowork
- Consequence:
  - sessions `sessionKind='agent'`
  - panneau `AgentWorkspacePanel`
  - runtime backend `agentRuntime` sur `/api/cowork`
  - nouvel outil `update_agent_blueprint` pour modifier un agent existant

## 2026-03-29 - Exigence qualitative guidee par l'etat, pas par un plan rigide
- Statut: adopte
- Contexte: l'utilisateur veut des boucles plus engagees et moins paresseuses, mais refuse qu'on code un plan fixe du type "8 recherches obligatoires" ou des checklists deterministes par demande.
- Decision: renforcer la posture du system prompt et ajouter des nudges qualite fondes sur l'etat reel du run (matiere collectee, sources ouvertes, densite du brouillon, artefact en cours), sans forcer une sequence d'actions predefinie.
- Pourquoi:
  - laisse le modele libre de sa strategie
  - corrige la paresse observable quand Cowork part trop vite en livraison avec peu de substance
  - evite de retomber dans des pipelines rigides pilotes par mots-cles
- Consequence:
  - system prompt Cowork plus exigeant sur la substance
  - ajout d'un helper `buildCoworkEngagementNudge()` dans `api/index.ts`
  - relance douce du modele quand un brouillon ou une recherche restent trop maigres pour la promesse implicite du livrable

## 2026-03-29 - Options explicites et defaults neutres
- Statut: adopte
- Contexte: meme apres avoir retire les gros faux positifs, le runtime restait encore partiellement pilote par des heuristiques lexicales et des relances backend invisibles.
- Decision: basculer Cowork vers des outils a options explicites et des defaults neutres, sans deduction backend de la strategie a partir du prompt utilisateur.
- Pourquoi:
  - colle au cap produit "le modele decide, le backend verifie"
  - supprime les derniers effets de bord ou le backend choisissait `news`, `strict`, `latex`, `theme`, `time_range` ou un nudge qualite a la place du modele
  - rend le comportement beaucoup plus lisible a debugger: si une recherche est stricte ou orientee news, c'est parce que le modele l'a demande
- Consequence:
  - `web_search` accepte maintenant `topic`, `searchDepth`, `strict`, `timeRange`, `includeDomains`, `directSourceUrls`
  - `web_fetch` accepte maintenant `contextQuery` et `strict`
  - `buildTavilySearchPlan()` et `searchWeb()` ont des defaults neutres quand ces options ne sont pas fournies
  - `getPdfQualityTargets()` retourne `null` par defaut et `resolvePdfEngine(auto)` tombe sur `pdfkit`
  - les relances backend `buildCoworkEngagementNudge()` et `artifactCompletionPrompt` sortent du chemin runtime normal

## 2026-03-29 - Les media generators deviennent des outils de premiere classe
- Statut: adopte
- Contexte: l'utilisateur veut que Cowork puisse appeler librement la generation d'image, Gemini TTS et Lyria, sans passer par des mots-cles backend ni des workflows caches.
- Decision: exposer trois vrais `localTools` (`generate_image_asset`, `generate_tts_audio`, `generate_music_audio`) qui creent des fichiers locaux dans `/tmp/`, puis laissent le modele decider s'il faut les publier via `release_file`.
- Pourquoi:
  - reste coherent avec la philosophie "le modele decide, le backend verifie"
  - rend ces capacites reutilisables par Cowork et par les agents du hub
  - evite de dupliquer des pipelines speciaux cote frontend uniquement
- Consequence:
  - ajout d'un helper partage `api/lib/media-generation.ts`
  - ajout des routes `/api/generate-audio` et `/api/generate-music`
  - le mode `audio` de l'UI fonctionne enfin reellement

## 2026-03-29 - PDF premium modele-led via metadonnees de section
- Statut: adopte
- Contexte: l'utilisateur veut des PDF LaTeX tres beaux et vraiment thematiques, y compris avec une ambiance differente d'une page/section a l'autre, sans revenir a des mots-cles backend qui imposent une strategie.
- Decision: faire porter l'art direction par les sections elles-memes (`visualTheme`, `mood`, `motif`, `flagHints`, `pageStyle`, `pageBreakBefore`) et laisser Cowork choisir explicitement `engine='latex'` quand il vise un rendu premium.
- Pourquoi:
  - permet des spreads visuels differents (ex: guerre puis football) sans raw `.tex` obligatoire
  - reste coherent avec la philosophie "le modele decide, le backend rend"
  - garde un fallback simple (`pdfkit`) pour les documents ordinaires
- Consequence:
  - `api/index.ts` accepte et preserve ces champs dans les brouillons PDF
  - `server/pdf/latex.ts` sait maintenant composer des couvertures/sections premium avec motifs et badges drapeaux
  - Cowork est informe dans son prompt et ses outils qu'il peut piloter cette DA sans heuristique backend

## 2026-03-29 - Le brouillon PDF devient un vrai atelier de revision
- Statut: adopte
- Contexte: l'utilisateur ne veut pas d'un "brouillon" qui est en pratique un premier jet pousse presque directement en PDF. Il veut que Cowork puisse relire, reprendre, couper, reordonner et maturer le texte avant export.
- Decision: ajouter un vrai verbe de revision au contrat PDF avec `revise_pdf_draft`, au lieu de garder un workflow limite a `begin_pdf_draft -> append_to_draft -> create_pdf`.
- Pourquoi:
  - `append_to_draft` seul cree un comportement d'empilement, pas de reecriture
  - la qualite editoriale demande parfois de remplacer ou supprimer, pas seulement d'ajouter
  - cela reste modele-led: on ne force pas une checklist, on donne juste au modele une vraie surface de travail
- Consequence:
  - `api/index.ts` expose `reviseActivePdfDraft()` et le tool `revise_pdf_draft`
  - revision possible des metas (`title`, `subtitle`, `summary`, `author`)
  - remplacement complet des sections ou operations 1-based (`replace`, `remove`, `insert_before`, `insert_after`, `append`)
  - `sourcesMode=append|replace`
  - la consigne systeme Cowork parle du brouillon comme d'un atelier de travail avant `create_pdf`

## 2026-03-29 - Le podcast devient un artefact audio de premiere classe
- Statut: adopte
- Contexte: l'utilisateur veut que Cowork puisse produire un vrai podcast audio complet, pas juste un script ou deux assets separes. La voix doit pouvoir venir de `gemini-2.5-pro-tts` et le fond sonore de Lyria.
- Decision: ajouter un tool autonome `create_podcast_episode` qui orchestre un pipeline complet:
  - narration TTS
  - bed musical Lyria
  - mix final audio unique
- Pourquoi:
  - correspond exactement au besoin produit "il fait ce qu'il veut" pour le podcast
  - garde la logique modele-led: Cowork choisit s'il fournit un `script` exact ou juste un `brief`
  - evite de demander a l'utilisateur de mixer lui-meme la voix et la musique
- Consequence:
  - `api/lib/media-generation.ts` expose `generatePodcastEpisode()`
  - defaut podcast narration = `gemini-2.5-pro-tts`
  - defaut podcast musique = `lyria-002`
  - le mix final passe par `ffmpeg` local avec intro/outro legeres
  - Cowork peut ensuite publier directement le fichier via `release_file`

## 2026-03-29 - Batterie Cowork pilotee par prompt, pas par veto backend
- Statut: adopte
- Contexte: l'utilisateur a explicitement refuse un retour aux mots-cles declencheurs, quotas backend caches ou nudges injectes comme ordres. Il voulait que l'amelioration passe par la personnalite de l'agent, son prompt systeme et la clarte de ses outils.
- Decision: corriger Cowork pour la batterie utilisateur via:
  - renforcement du prompt systeme
  - descriptions/outils de recherche plus explicites
  - fingerprint de progression plus honnete
  - mais sans reintroduire de blockers metier ou de forcing strategique cote backend
- Pourquoi:
  - reste coherent avec la philosophie produit "le modele decide, le backend verifie"
  - laisse une vraie autonomie de strategie
  - rend les progres observables sans theatre backend
- Consequence:
  - ajout de `test-cowork-battery.ts`
  - `buildCoworkProgressFingerprint()` compte aussi la collecte de recherche
  - `buildCoworkSystemInstruction()` insiste maintenant sur:
    - `web_search` = reperage
    - `web_fetch` = lecture/verif directe
    - couverture multi-angle / multi-entites
    - verification business / juridique / finance / RH / marche

## 2026-03-29 - `api/` doit rester un espace d'entree Vercel, pas un namespace backend complet
- Statut: adopte
- Contexte: le deploiement Vercel Hobby cassait avec une limite de nombre de functions, alors meme que le projet est concu comme un backend Express unique deja rewrite par `vercel.json`.
- Decision: reserver `api/` aux seuls entrypoints serverless et deplacer tout module interne backend dans `server/`.
- Pourquoi:
  - aligne l'arborescence avec le modele de deploiement Vercel
  - evite que des helpers `lib/`, `middleware/`, `routes/` soient comptes comme functions distinctes
  - ne change ni les capacites ni la perf utile, car le runtime cible restait deja `api/index.ts`
- Consequence:
  - `api/index.ts` devient l'unique fichier backend routable
  - `server/lib/*`, `server/middleware/*`, `server/routes/*` portent toute la logique interne
  - la verification de reference est `npx vercel build --prod` + un seul output `api/index.func`

## 2026-03-29 - Un podcast doit sortir comme un master final unique
- Statut: adopte
- Contexte: l'utilisateur a explicitement rejete les livraisons podcast en composants separes. Pour lui, "fais un podcast" signifie un vrai episode bien monte, pas une voix d'un cote et une musique de l'autre.
- Decision:
  - `create_podcast_episode` devient le chemin podcast principal
  - `generate_tts_audio` et `generate_music_audio` restent des outils de bas niveau, reserves aux demandes explicites de stems separes
  - les agents podcast par defaut doivent viser `create_podcast_episode` + `generate_image_asset` + `release_file`
- Pourquoi:
  - colle au sens produit reel du mot "podcast"
  - reduit les chances que le modele satisfasse techniquement la demande tout en ratant la promesse utilisateur
  - garde une voie simple pour la cover sans complexifier le master audio
- Consequence:
  - `server/lib/agents.ts` oriente les blueprints podcast vers un livrable unique
  - `api/index.ts` decrit explicitement `create_podcast_episode` comme le bon outil pour un podcast pret a publier
  - l'UI du Hub Agents pousse maintenant la formulation "master final bien mixe + cover"

## 2026-03-29 - Le pipeline podcast ne doit plus dependre durement de `ffprobe` / `ffmpeg`
- Statut: adopte
- Contexte: le premier pipeline podcast etait correct en local, mais fragile sur hebergement: `ffprobe` manquant cassait la mesure de duree, et sans `ffmpeg` il n'y avait plus de master final.
- Decision:
  - mesurer la duree de la narration directement depuis son WAV
  - conserver `ffmpeg` comme chemin premium quand il existe
  - ajouter un fallback TypeScript pur pour le mix WAV standard
- Pourquoi:
  - supprime le point de rupture `ffprobe ENOENT`
  - permet toujours de livrer un master final unique avec le couple robuste `gemini-2.5-pro-tts` + `lyria-002`
  - evite d'ajouter une dependance npm lourde de transcodage
- Consequence:
  - `server/lib/media-generation.ts` embarque maintenant parse WAV, resampling, adaptation mono/stereo, ducking, loop crossfade et limiter
  - en l'absence d'encodeur mp3 local, le systeme peut quand meme rendre un WAV final plutot que d'echouer
  - limite connue assumee: `lyria-3-*` reste plus dependant d'un decodeur externe si sa sortie est MP3

## 2026-03-29 - Les sessions agent ne doivent pas contaminer le mode chat
- Statut: adopte
- Contexte: ouvrir un agent depuis le Hub le faisait vivre sous `mode: 'chat'`, mais l'experience attendue n'est pas "remplacer le dernier chat", c'est "ouvrir un workspace voisin".
- Decision: conserver les agents sous la surface chat pour reutiliser le runtime, mais les isoler dans l'etat/navigation via `sessionKind='agent'`, une section historique dediee et une memorisation opt-in du dernier thread.
- Pourquoi:
  - evite l'impression que l'historique chat normal disparait
  - garde le routing simple sans creer un sixieme mode entier
  - permet a l'agent d'avoir son branding propre sans rebasculer en Cowork
- Consequence:
  - `setActiveSessionId()` accepte maintenant `remember` et `modeOverride`
  - `SidebarLeft` separe les agents du reste de l'historique
  - `App.tsx` choisit les bons placeholders et labels selon `sessionKind`

## 2026-03-29 - Le selecteur de modeles doit vivre inline, pas en overlay absolu
- Statut: adopte
- Contexte: dans le panneau droit, le dropdown modeles se faisait recouvrir par `Capacites & outils`.
- Decision: remplacer l'overlay absolu par une liste inline expandable dans le flux normal de `SidebarRight`.
- Pourquoi:
  - supprime les problemes de stacking context entre cartes
  - rend le layout plus stable sur desktop et mobile
  - simplifie le composant tout en donnant plus d'air au panneau
- Consequence:
  - `src/components/SidebarRight.tsx` utilise maintenant un bloc `AnimatePresence` en hauteur auto au lieu d'un menu flottant

## 2026-03-29 - La fluidite prime sur le glassmorphism lourd
- Statut: adopte
- Contexte: la DA premium etait reussie visuellement, mais le cout GPU/paint etait trop eleve pour l'objectif produit de fluidite maximale.
- Decision: conserver l'identite visuelle, mais retirer les effets globaux les plus couteux: transitions sur tout le DOM, flous trop forts et surfaces repetitives trop lourdes.
- Pourquoi:
  - le ressenti produit voulu est "fluide", pas "beau mais lourd"
  - les bulles/messages et panneaux repetes sont les vraies surfaces critiques pour les FPS
- Consequence:
  - `src/index.css` cible seulement les transitions utiles
  - les blur/shadows de `MessageItem`, `ChatInput`, `SidebarLeft`, `SidebarRight` et du shell sont reduits

## 2026-03-29 - Un podcast doit degrader vers un master voix seule plutot que tomber en echec
- Statut: adopte
- Contexte: pour l'utilisateur, un podcast avec voix seule reste un livrable utile. Un echec total a cause du fond musical ou de `ffmpeg` est pire qu'un master vocal propre et honnete.
- Decision: `create_podcast_episode` doit preferer un fallback `voice-only` quand le bed musical ou le mix local echouent.
- Pourquoi:
  - respecte la promesse produit "livrer quelque chose d'exploitable"
  - evite les faux echec totaux sur des problemes d'infra audio non essentiels
  - reste honnete si le fallback est expose dans le resultat et dans la copy
- Consequence:
  - `server/lib/media-generation.ts` peut maintenant retourner `mixStrategy: 'voice-only'`
  - `api/index.ts` remonte explicitement ce statut et son warning
