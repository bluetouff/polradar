# Banc documentaire MCP

Le jeu annoté du 24 novembre 2026 contient 200 questions en français dans 26 familles et 197 appels distincts. Il couvre les onze outils de consultation. Chaque cas associe une question, l’appel structuré correspondant, des identifiants, des références, les champs attendus et la réponse à donner quand une donnée manque. Les assertions portent sur des identités, des dates, des quantités, des unités, des passages ou des valeurs nulles.

Les cas de programme s’appuient sur des versions de fiches identifiées. Les cas statistiques contrôlent l’unité, la fréquence et le code de série. Les archives de sondages vérifient aussi les seuils inférieurs à 1 %, les bases de calcul et le statut de la première diffusion. Les cas parlementaires contrôlent les voix individuelles, les mandats, les totaux, la pagination et le filtre Numérique dans les trois institutions. Les cas du Sénat et du Parlement européen distinguent le mandat en vigueur, une séance examinée sans mention et une période extérieure au relevé. [Questions et références versionnées](../mcp/testdata/questions-documentaires.json)

Chaque question est exécutée par le transport MCP local avec les paramètres d’outil fournis. Le score mesure la conformité de la réponse structurée aux assertions et à la révision attendue. En mode verbeux, le rapport indique aussi les cas qui vérifient une adresse de source exacte, les réponses vides et les erreurs attendues. Les percentiles p50 et p95 mesurent le temps de traitement par appel, y compris le chargement du jeu de données au premier usage. L’interprétation libre de la question et la qualité d’une réponse rédigée demandent une évaluation distincte.

Depuis le dossier `mcp/`, sur une édition construite dans `dist/` :

```sh
POLRADAR_TEST_SITE="$(cd ../dist && pwd)" go test -count=1 -run '^TestPublishedBancDocumentaire$' -v .
```

Deux exécutions successives sur l’archive vérifiée de la révision `55212be` ont obtenu **200 réponses conformes sur 200**. Parmi ces questions, 116 vérifient une adresse de source exacte, 14 attendent une réponse vide et 7 attendent une erreur. Le p50 hors réseau était de 277 à 287 µs et le p95 de 1,599 à 1,717 ms. Le lot complet prenait 152 à 162 ms sur le poste de recette. [Archive de référence du 24 novembre 2026](https://github.com/bluetouff/polradar/releases/tag/site-55212bec2404042b87b7ec1f827e8cf2785866bb)

La recette de chaque archive parcourt aussi les identifiants annoncés par la pagination. La matrice de compatibilité utilise l’archive vérifiée de l’édition précédente et exécute chaque version du service sur l’autre version du site. [Test du corpus publié](../mcp/published_test.go) · [Matrice de compatibilité](../scripts/test-mcp-compatibility.py)
