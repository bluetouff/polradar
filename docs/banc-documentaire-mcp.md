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

Le client Codex découvre les outils du serveur testé et choisit ses appels et leurs paramètres. Il reçoit la question en français et une consigne générale. Les outils attendus, faits de référence et adresses autorisées restent dans le banc. Les seize questions portent notamment sur des attributions, des unités, des périodes, des votes et des dates hors couverture. [Cas du benchmark](../mcp/testdata/questions-assistant.json)

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

### Première recette de la version 1.5

Sur le lot du 26 novembre construit localement à partir de `3222083`, le banc structuré compte **204 cas conformes sur 204**, 201 appels distincts et 29 familles. Parmi ces cas, 119 exigent une adresse exacte, 15 une réponse vide et 7 une erreur. La réponse JSON-RPC médiane mesure 4 156 octets, le 95e percentile 9 555 octets. Le service répond localement en 645 µs au p50 et 5,742 ms au p95 pour cette exécution. Les nouvelles questions vérifient les preuves dans la réponse de recherche et la localisation des données par série, date de terrain et page de notice.

Codex CLI 0.169.1 et `gpt-6.2-sol` ont reçu cinq questions sans nom d’outil ni paramètres. Le binaire local testait le même corpus de travail. Les appels passaient par le transport HTTP du service, sans clé API.

| Question                             | Faits conformes et cités | Appels MCP |    Durée | Jetons d’entrée, dont cache |
| ------------------------------------ | -----------------------: | ---------: | -------: | --------------------------: |
| Vote sur la cybersécurité            |                      2/2 |          5 | 17,373 s |             70 610 (50 304) |
| Attribution de Fret SNCF             |                      2/2 |          2 | 15,581 s |             75 613 (54 144) |
| Seuil du sondage OpinionWay          |                      2/2 |          2 | 15,400 s |             73 003 (51 584) |
| Séance hors du registre              |                      0/1 |          3 | 13,124 s |             53 942 (31 488) |
| Priorités pour la taille des classes |                      2/2 |          1 | 15,884 s |             55 259 (43 904) |

Le barème valide **4 réponses sur 5**, avec **2 appels médians** et aucune adresse hors référence. Le client reconnaît la séance non couverte et cite le registre. Son libellé « Séance du 18 mars 2024 hors couverture » sort des valeurs attendues. Le seuil OpinionWay passe de 18 à 2 appels entre les deux passages observés. Un premier essai local avait donné deux tours indisponibles et une étiquette de révision absente dans le binaire de test. Le tableau utilise l’exécution après correction de cette étiquette. Il décrit cinq questions et un client. Le SDK Go a aussi exercé les deux versions du protocole. [Questions libres](../mcp/testdata/questions-assistant.json)

### Contre-audit du 26 novembre 2026

Les deux passages utilisent Codex CLI 0.169.1 et `gpt-6.2-sol`, sur le corpus `867cd06`. Le barème reconnaît les différentes formulations d’une séance hors du registre et contrôle toute date donnée dans le motif. Les chemins annotés permettent aussi d’exiger un poste précis d’un tableau.

| Passage                               | Questions conformes | Faits corrects et cités | Appels médians | Résultats MCP médians, octets | Durée médiane |
| ------------------------------------- | ------------------: | ----------------------: | -------------: | ----------------------------: | ------------: |
| 1.5 publique, cinq questions communes |                 5/5 |                     9/9 |              2 |                        10 652 |      15,436 s |
| 1.6 locale, mêmes questions           |                 5/5 |                     9/9 |              2 |                         8 673 |      15,149 s |
| 1.6 locale, banc étendu               |               10/16 |                   17/25 |              2 |                       9 605,5 |      19,162 s |

Le cas OpinionWay passe de deux appels à un. Les six échecs du banc étendu contiennent dix citations hors référence et deux faits supplémentaires. Les onze annotations ajoutées ont chacune été rapprochées du relevé attendu sur le service public 1.5 par appel structuré. Les durées incluent l’inférence, le lancement du client et des transports différents entre les deux passages. Le volume représente les résultats sérialisés MCP. Le banc structuré sur archive du lot atteint 208/208. [Cas annotés et références](../mcp/testdata/questions-documentaires.json)

### Parité de la recherche

Sur les mêmes données `867cd06`, seize cas communs vérifient les concepts, les auteurs et le premier résultat attendu. Le Web passe de 13/16 à 16/16 et le MCP de 12/16 à 16/16. Les quinze requêtes positives retrouvent le résultat attendu en tête des deux surfaces. Le jeu Web tenu à l’écart de ce réglage reste à 28/30. [Cas communs](../mcp/testdata/recherche-commune.json) · [Lexique partagé](../mcp/lexique-recherche.json)

```sh
node scripts/benchmark-recherche.mjs dist --commun
(cd mcp && POLRADAR_TEST_SITE="$(cd ../dist && pwd)" go test -run '^TestPublishedRechercheCommune$' -count=1 -v .)
```

### Comparaison du 26 au 27 novembre

La même série de 16 questions et le même barème ont été utilisés avec Codex CLI 0.169.1 et `gpt-6.2-sol`. Le site et le service publics étaient à `85ffdf8`. La première recette du 27 utilise l’archive et le service de travail construits sur cette base avant l’ajout du dossier législatif sur l’aide à mourir. Le transport de recette passe par HTTP local et le même gestionnaire Go.

| Exécution                    | Questions entièrement conformes | Durée médiane |
| ---------------------------- | ------------------------------: | ------------: |
| Production MCP 1.6.2         |                           10/16 |      14,249 s |
| Version locale intermédiaire |                           11/16 |      14,454 s |
| Second essai local           |                            9/16 |      14,184 s |

Le premier essai local donne 23 faits exacts sur 25, dont 18 correctement cités. Le second en donne 22, dont 15 correctement cités. Les cinq écarts communs concernent le libellé de l’absence d’un vote le 18 mars 2024, les dates Élabé, la réunion de Lille, la citation d’une version de retraite et la périodicité d’un chiffrage Lisnard. Le second relevé ajoute le repère juridique sur le chiffrement et les citations d’un amendement européen. Le vote du Sénat sur les retraites est conforme sur les deux essais locaux. Il demande respectivement 20 et 29 appels.

Le moteur traitait la date de diffusion d’un sondage comme une date de terrain quand la question mentionnait les deux. Le test ajouté exige que la question sur la diffusion du 29 août restitue le début et la fin du terrain, du 26 au 28 août, avec la notice. Les deux scores libres ci-dessus précèdent cette correction. [Notice de la Commission des sondages](https://www.commission-des-sondages.fr/notices/files/notices/2026/aout/10245-pres-iv-elabe-29-aout.pdf#page=1)

Après correction, la réponse documentaire passe ce test. Lors du nouvel essai libre ciblé, le client a interrogé la collection des sondages. Il a donné les deux dates attendues. Le cas échoue encore sur le relevé choisi, les citations et un fait supplémentaire.

Le banc structuré sur l’archive locale vérifie 208 cas sur 208. Le catalogue Web obtient 100 cas conformes sur 100 sur ses requêtes annotées. Les 16 cas de recherche communs au Web et au MCP passent également. [Annotations du banc libre de régression](../mcp/testdata/questions-assistant.json)

Pour réexécuter le banc public, fournir les deux révisions servies à `scripts/test-assistant-codex.py`. L’option `--url` accepte aussi un endpoint de recette `/api/mcp` sur `127.0.0.1`. Ce dernier doit être installé avec les paramètres de transport de l’environnement testé.

### Jeu indépendant du 27 novembre 2026

Les 100 questions demandent 124 faits dans quatorze familles. Les annotations indiquent la pièce, le passage, l’édition, la difficulté et les formulations acceptées. Les faits sont rapprochés des programmes, des notices, des textes réglementaires, des comptes publics et des relevés de l’Assemblée nationale. Une question qui porte sur les limites du registre se vérifie dans son index de couverture. [Questions et annotations](../mcp/testdata/questions-assistant-independant.json)

Le client reçoit la question et le format de réponse. Il choisit ses outils et leurs paramètres. Le contrôle rapproche chaque fait de ses propres pièces et des adresses effectivement fournies au cours du tour. Lorsqu’une référence vise un document entier, un passage de ce document transmis par l’outil est accepté. Une page PDF explicitement annotée reste un repère distinct. Les tours interrompus et les réponses exploitables ont des compteurs distincts.

L’option `--jeu independant` sélectionne ce corpus de questions. La sortie enregistre son empreinte SHA-256, le client, le modèle et les deux révisions. `--parallele 2` permet deux tours simultanés sur le serveur de recette local. La recette publique procède une question à la fois.

Le 27 novembre, Codex CLI 0.169.1 et `gpt-6.2-sol` ont interrogé le MCP de recette sur l’archive et le service `51a2ffd`. Empreinte du jeu `9a983d0aa81a691806dc68e33e5fb6496a39f997c037afe53f323b06c50b52f7`. Une première passe a laissé 48 tours sans réponse exploitable. La reprise de ces 48 tours à deux de front a fourni une réponse pour chacun. Les résultats ci-dessous conservent les premières réponses exploitables des 100 cas.

| Famille            | Questions | Conformes | Faits corrects et cités |
| ------------------ | --------: | --------: | ----------------------: |
| Programmes         |        31 |         6 |                   10/40 |
| Budgets            |         2 |         1 |                     1/3 |
| Attributions       |         3 |         0 |                     0/3 |
| Votes              |        21 |        13 |                   21/30 |
| Sondages           |        12 |         8 |                   11/15 |
| Candidatures       |         1 |         0 |                     0/1 |
| Droit              |        12 |         2 |                    2/12 |
| Économie           |         6 |         3 |                     3/6 |
| Agenda             |         2 |         0 |                     0/2 |
| Débats             |         2 |         1 |                     1/3 |
| Territoires        |         2 |         0 |                     0/2 |
| Comparaisons       |         1 |         0 |                     1/2 |
| Financements       |         1 |         1 |                     1/1 |
| Données manquantes |         4 |         0 |                     0/4 |
| **Total**          |   **100** |    **35** |              **51/124** |

Le client a vu une pièce attendue dans 67 cas, a donné 58 valeurs conformes et a produit 45 citations hors des références autorisées. Il a reconnu les quatre absences attendues. Les formulations ou citations de ces quatre abstentions restent en échec. La durée médiane est de 16,004 secondes pour quatre appels MCP médians. Les durées incluent le lancement du client et le traitement par le modèle. Le barème rapproche les valeurs de leurs pièces et les compare comme un ensemble. La mesure couvre ce client, ce modèle et cette édition.

La recette de régression de la même édition donne 11 réponses entièrement conformes sur 16. Dans le lot local suivant, la réponse sur les dates de terrain regroupe les scénarios d’une même enquête. La réponse sur un scrutin de l’Assemblée ajoute les totaux demandés et l’issue d’après le relevé officiel. Le test de transport vérifie la compatibilité et les tests documentaires sur archive contrôlent ces deux parcours. Le score du jeu indépendant correspond à la version antérieure à ces changements.
