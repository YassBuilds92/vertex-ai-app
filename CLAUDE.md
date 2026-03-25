# RÈGLES D'UTILISATION DE L'API GEMINI (MODÈLES RÉCENTS)

1. **Recherche de documentation à jour :** Avant d'écrire du code impliquant l'API Gemini ou d'autres API d'IA, tu DOIS utiliser tes outils de recherche web pour vérifier quelles sont les toutes dernières versions des modèles disponibles. Ne te fie jamais à tes données d'entraînement internes pour le choix du modèle.

2. **Utilisation des modèles de dernière génération :** Par défaut, n'utilise plus JAMAIS les modèles de la famille `gemini-1.5` (ni pro, ni flash).

3. **Modèles actuels à privilégier :** À ce jour, la génération actuelle est la version 3 et 3.1. Tu dois privilégier l'utilisation de ces chaînes de caractères exactes pour tes appels API :
   - Pour les tâches complexes/qualitatives : `gemini-3.1-pro-preview` ou `gemini-3-pro-preview`
   - Pour les tâches rapides/économiques : `gemini-3.1-flash-lite-preview` ou `gemini-3-flash-preview`

4. **Vérification systématique :** Si tu dois implémenter une fonctionnalité API, vérifie toujours la syntaxe exacte exigée par les versions 3.x, car elle peut différer des versions 1.5.

# 🧠 MÉMOIRE ET APPRENTISSAGE (ÉVITER LES BOUCLES D'ERREURS)

1. **Fichier de connaissances (`AI_LEARNINGS.md`) :** Tu vas utiliser un fichier nommé `AI_LEARNINGS.md` (situé à la racine du projet) comme mémoire à long terme. S'il n'existe pas, crée-le.

2. **Lecture obligatoire :** Au début d'une nouvelle tâche complexe ou avant de corriger un bug, tu DOIS lire le contenu de `AI_LEARNINGS.md` pour vérifier si nous n'avons pas déjà rencontré et résolu un problème similaire par le passé.

3. **Documentation systématique :** À chaque fois que :
   - Nous passons beaucoup de temps à corriger une erreur tenace.
   - Tu te trompes de version d'API ou de modèle.
   - Nous trouvons une astuce spécifique à ce projet.
   -> Tu DOIS de toi-même écrire/ajouter un court résumé dans `AI_LEARNINGS.md` avec ce format : `[Problème rencontré] -> [Cause] -> [Solution/Code à utiliser]`.

4. **Ne sois pas têtu :** Si tu proposes une solution qui génère une erreur, n'essaie pas de forcer la même solution en boucle. Arrête-toi, analyse l'erreur, cherche une approche totalement différente, et documente ce qui n'a pas marché.

# 🚫 ANTI-ACHARNEMENT (ÉVITER LES SPIRALES DE DEBUG)

1. **Règle des 3 tentatives :** Si après 3 essais différents une fonctionnalité ne marche toujours pas (même erreur ou erreur similaire), tu DOIS t'arrêter immédiatement. Ne continue PAS à boucler. À la place :
   - Résume clairement ce qui ne marche pas et pourquoi.
   - Propose 2-3 approches **radicalement différentes** à l'utilisateur.
   - Attends sa décision avant de continuer.

2. **Interdiction de "maquiller" un échec :** Tu n'as JAMAIS le droit de :
   - Mocker/simuler une API pour faire croire que ça marche.
   - Contourner un problème sans le résoudre réellement.
   - Déclarer qu'un bug est résolu si tu n'as pas vu de preuve concrète (log de succès, réponse 200 réelle, screenshot fonctionnel).
   Si une feature ne marche pas, DIS-LE clairement au lieu de bricoler un faux fix.

3. **Limite d'interactions browser/outils :** Si tu te retrouves à enchaîner plus de 5 actions consécutives dans le navigateur (clics, exécution JS, extraction DOM…) sans progrès visible, ARRÊTE-TOI. C'est le signe que tu tournes en rond. Fais un pas en arrière, relis les logs serveur, et reformule le problème.

4. **Escalade obligatoire :** Si tu sens que tu es bloqué ou que tu commences à essayer des choses "au hasard", tu DOIS :
   - Écrire un diagnostic honnête dans `AI_LEARNINGS.md`.
   - Dire à l'utilisateur : "Je suis bloqué, voici ce que j'ai essayé et pourquoi ça ne marche pas."
   - Ne JAMAIS halluciner une résolution. L'honnêteté > la fausse complétion.