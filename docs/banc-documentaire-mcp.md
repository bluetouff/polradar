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

## Questions libres à un assistant

Le client Codex découvre les outils du serveur public et choisit ses appels et leurs paramètres. Il reçoit la question en français et une consigne générale. Les outils attendus, faits de référence et adresses autorisées restent dans le banc. Les quatre questions portent sur un vote nominatif, l’attribution d’une proposition, un seuil de sondage et une date hors du registre parlementaire. [Cas du benchmark](../mcp/testdata/questions-assistant.json)

Le score vérifie l’outil et les paramètres qui ont permis de récupérer le bon relevé, les révisions déclarées par celui-ci, les valeurs citées dans la réponse et la reconnaissance des données absentes. Une citation doit correspondre à une adresse de référence et être étayée par le relevé obtenu. Les pages ajoutées à un PDF sont contrôlées lorsqu’elles figurent dans les références. Les valeurs supplémentaires, les liens sans appui et une réponse affirmative sur une donnée manquante font échouer le cas. Le barème utilise des équivalences explicites pour les valeurs courtes. Les formulations qui dépassent le barème appellent une relecture sémantique.

La commande utilise une session ChatGPT déjà ouverte dans Codex CLI. Chaque question ouvre un tour éphémère avec Polradar comme seul MCP et le shell désactivé. Les deux révisions à tester sont fournies sur la ligne de commande. Le rapport affiche le score de chaque cas, les outils appelés, les volumes de jetons et les durées, sans conserver les transcriptions. Pour reproduire le test sur l’édition observée le 24 novembre 2026, lorsque ces révisions sont servies, exécuter la commande ci-dessous depuis la racine du dépôt.

```sh
python3 scripts/test-assistant-codex.py \
  --revision 01afe20748aac995eeb4766f77a0bcfa1dd65305 \
  --revision-service e7ff2abc67b6f6d6f394aa67119a63b9764280a8
```

L’option `--cas` limite l’exécution à une question annotée. Les tests unitaires du barème s’exécutent sans session Codex. [Tests du barème](../tests/deploy/test_assistant_codex.py)

### Mesure du 24 novembre 2026

Les deux passages ont utilisé Codex CLI 0.169.1 et `gpt-6.2-sol` avec le site `01afe20` et le service `e7ff2ab`. L’assistant a trouvé le bon relevé dans les quatre cas à chaque passage. Le premier, avec une consigne de format plus courte, a obtenu 0 cas entièrement conformes sur 4 et une médiane de 16,567 s. Il a reconnu l’absence de donnée. Le deuxième utilise la consigne de valeurs courtes documentée ci-dessus.

| Question                    | Faits conformes et cités | Appels MCP |    Durée |
| --------------------------- | -----------------------: | ---------: | -------: |
| Vote sur la cybersécurité   |                      2/2 |          3 | 13,732 s |
| Attribution de Fret SNCF    |                      2/2 |          3 | 11,458 s |
| Seuil du sondage OpinionWay |                      2/2 |         18 | 20,220 s |
| Séance hors du registre     |                      0/1 |          3 | 13,615 s |

Le deuxième passage a obtenu **3 cas conformes sur 4**, six faits corrects et cités sur sept et une médiane de 13,674 s. Toutes les adresses données étaient étayées. Pour la séance hors registre, le statut d’indisponibilité a été reconnu. La valeur donnée pour le motif est restée hors du barème. Le code de sortie de cette exécution est 1. Les durées comprennent le lancement du client, l’inférence et les appels au service. [Documentation du MCP public](https://polradar.fr/mcp/documentation/)
