# NOW

## Objectif actuel
- Valider en environnement authentifie puis deploye le nouveau flux `Cowork Apps` auto-defini:
  - brief libre
  - clarification conversationnelle si besoin
  - generation d'une app qui definit elle-meme son interface, son identite et ses defaults outils

## Blocage actuel
- Le chantier est valide localement, mais pas encore rejoue dans la vraie app connectee apres deploy:
  - pas encore de preuve authentifiee du flux `brief libre -> question Cowork -> app creee`
  - pas encore de verification terrain qu'un brief hybride ne subit aucun choix force
  - les anciennes apps peuvent encore s'ouvrir en mode fallback legacy tant qu'elles ne sont pas regenerees

## Prochaine action exacte
- Redeployer puis rejouer 3 parcours reels:
  - creation avec brief hybride libre: `une app qui peut faire debat, extrait audio, cover et fiche`
  - creation avec brief ambigu pour verifier la question libre de Cowork puis la reprise apres reponse
  - ouverture d'une ancienne generated app pour confirmer la migration douce `legacy -> fallback`, sans casse

## Fichiers chauds
- `server/lib/generated-apps.ts`
- `server/lib/schemas.ts`
- `server/routes/standard.ts`
- `api/index.ts`
- `src/App.tsx`
- `src/components/AgentsHub.tsx`
- `src/components/GeneratedAppHost.tsx`
- `src/types.ts`
- `test-generated-app-stream.ts`
- `test-generated-app-manifest.ts`
- `test-cowork-loop.ts`

## Validations restantes
- Rejouer un vrai run authentifie `Cowork Apps` apres deploy.
- Verifier visuellement l'absence totale d'options forcees dans le hub.
- Verifier qu'une app nouvelle ouvre bien d'abord son composant genere, puis le fallback seulement si bundle/source indisponible.
- Confirmer que `manifest.runtime.toolDefaults` pilote bien le run reel dans l'app connectee.

## Risques immediats
- Tant que le patch n'est pas deploye, la prod peut encore garder des rails produit trop directifs.
- Une ancienne app regeneree avant ce chantier peut rester plus generique jusqu'a une nouvelle draft.
- Le chemin `component primary` est valide localement, mais son comportement exact en contexte auth/store reel reste encore a prouver.
