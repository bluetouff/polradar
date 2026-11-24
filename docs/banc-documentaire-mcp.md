# Banc documentaire MCP

Le jeu annoté du 24 novembre 2026 contient 191 questions en français dans 24 familles. Il couvre les onze outils de consultation. Chaque cas associe une question, l’appel structuré correspondant, des identifiants, des références, les champs attendus et la réponse à donner quand une donnée manque. Les assertions portent sur des identités, des dates, des quantités, des unités, des passages ou des valeurs nulles. Une source remplacée, une mauvaise attribution ou une réponse positive à une demande invalide font échouer le cas correspondant.

Les réponses de référence sont versionnées dans [le jeu de questions](../mcp/testdata/questions-documentaires.json). Les cas de programme s’appuient sur des versions de fiches identifiées. Les cas statistiques contrôlent l’unité, la fréquence et le code de série pour permettre aux producteurs de réviser leurs valeurs. Le contrôle du registre parlementaire porte notamment sur les voix individuelles, les identifiants des mandats et les totaux publiés. Les cas du Sénat et du Parlement européen distinguent le mandat en vigueur, une séance examinée sans mention et une période extérieure au relevé.

Chaque question est exécutée par le transport MCP local du service sur une édition construite du site. Les paramètres de l’outil sont fournis avec la question. Le score mesure la conformité des réponses structurées aux références. L’interprétation libre d’une question par un assistant et la qualité d’une réponse rédigée demandent une évaluation distincte.

Depuis le dossier `mcp/`, sur une édition construite dans `dist/` :

```sh
POLRADAR_TEST_SITE="$(cd ../dist && pwd)" go test -count=1 -run '^TestPublishedBancDocumentaire$' -v .
```

Sur l’édition locale du 24 novembre 2026, les **191 questions** ont rendu les champs et valeurs attendus. Le test de parcours des collections a aussi lu chaque identifiant annoncé par la pagination. Le test de compatibilité utilise l’archive vérifiée de l’édition précédente et appelle successivement chaque version du service sur l’autre version du site. [Test du corpus publié](../mcp/published_test.go) · [Matrice de compatibilité](../scripts/test-mcp-compatibility.py)
