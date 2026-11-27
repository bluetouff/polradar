# Corrections du contre-audit du 27 novembre 2026

## Synthèse

Vers 16 h 06, heure de Paris, `main` et le site public étaient à `e298d604e05be6341173e7de2aae4640689bd00f`. Les 14 empreintes annoncées dans le manifeste public concordaient. L’API indiquait un service à `3ac6243f11600ff3fef0de55187ab1b88d97e2f7` et un corpus à `e298d60`. L’édition locale part de ce `HEAD`. Les archives de recette reprennent son identifiant de construction et contiennent le diff de travail. [Manifeste public](https://polradar.fr/build.json) · [État REST](https://polradar.fr/api/v1/corpus)

Le lot corrige deux recherches injustement vides, documente l’âge légal dans le moteur commun, relie une position déjà recensée à la question sur l’OTAN et répare l’affichage initial des statistiques MCP. La validation porte sur ce lot de correction des priorités 0. Les cibles de long terme et les contrôles encore ouverts figurent en fin de document.

## UX et fonctionnalités

- **Recherche.** Le lexique commun reconnaît les formulations « revalorisation du salaire minimum » et « ouvrir les droits ». Le résultat sur le SMIC revient à la mesure citée. Le résultat sur les retraites mène au tableau par génération. Les requêtes annotées qui doivent rester vides le restent.
- **Réponse documentaire.** La question générale sur l’âge légal renvoie au dossier du régime général et au tableau de l’Assurance retraite. La réponse précise la génération, la date de prise d’effet de la pension et l’existence d’exceptions. Les formulations précisant un pays hors du dossier ou une génération à vérifier demandent une précision. [Comparaison des retraites](https://polradar.fr/comparer/retraites/) · [Assurance retraite](https://www.lassuranceretraite.fr/portail-info/home/actif/age-depart/age-depart-retraite.html)
- **Statistiques MCP.** Le HTML initial renvoie au relevé JSON. Le graphique et son tableau apparaissent après validation du relevé. Le zéro exige une période observée à zéro. Une réponse défaillante produit un état d’indisponibilité. Les erreurs qualifiées sont consultables dans un panneau natif. Les autres restent comptées dans « Sans catégorie publiée ». Le relevé public observé totalisait 1 643 appels sur quatre jours UTC, dont 61 erreurs. Le même HTML public contenait d’emblée la phrase « Aucun appel enregistré sur cette période ». [Page publique](https://polradar.fr/mcp/statistiques/) · [Relevé JSON public](https://polradar.fr/api/mcp-stats.json)

## Données et provenance

| Indicateur                                | Public de référence | Lot local |
| ----------------------------------------- | ------------------: | --------: |
| Fiches de campagne ou de parti            |               5 162 |     5 162 |
| Candidatures actives dans le corpus       |                  46 |        46 |
| Sources au catalogue                      |               1 137 |     1 138 |
| Enquêtes identifiées                      |                  83 |        83 |
| Couples prioritaires avec réponse sourcée |           205 / 330 | 206 / 330 |
| Couples examinés sans réponse directe     |                  38 |        38 |
| Couples à examiner                        |                  87 |        86 |

Le décompte prioritaire couvre 66 questions pour Raphaël Glucksmann, Marine Le Pen, David Lisnard, Jean-Luc Mélenchon et Édouard Philippe. Les états « mesure », « déclaration », « orientation » et « parti » entrent dans le total des réponses sourcées. La version 2 de la fiche d’Édouard Philippe ajoute le passage de son entretien avec El País qui soutient un pilier européen de l’OTAN. La déclaration d’Euronaval fournit le passage sur le rôle de la France dans l’Alliance. La qualification reste une orientation. La version 1 reste accessible. La lettre de Raphaël Glucksmann sur la garantie américaine reste un complément. [Décompte de référence](https://polradar.fr/api/couverture-questions.json) · [Entretien original](https://elpais.com/internacional/2026-11-01/edouard-philippe-francia-es-hoy-mas-debil-economicamente-y-la-sociedad-es-mas-violenta-y-crispada.html) · [Déclaration rapportée par l’AFP](https://www.leparisien.fr/politique/presidentielle-2027-edouard-philippe-veut-massifier-notre-armement-conventionnel-leffort-de-defense-ne-doit-pas-etre-relache-05-11-2026-HHHH2VXS2FG3JAZJCUVR3ZRHC4.php)

Le tableau des 330 couples et les captures sont disponibles dans `artifacts/contre-audit-2026-11-27/`. Le CSV indique l’état de chaque édition, les identifiants de versions et ceux des sources du lot local. Les URLs pointent vers les questions publiques. La matrice donne les lacunes constatées dans le corpus et les relectures consignées.

## Recherche et agentique

| Banc Web             | Référence | Lot local | Recall@10 avant et après |
| -------------------- | --------: | --------: | -----------------------: |
| Recette ciblée       |   28 / 30 |   30 / 30 |           90,5 % → 100 % |
| Validation séparée   |   32 / 32 |   32 / 32 |          94,2 % → 94,2 % |
| Confirmation séparée |   30 / 30 |   30 / 30 |          97,6 % → 97,6 % |
| Commun Web et MCP    |   16 / 16 |   16 / 16 |          96,7 % → 96,7 % |

Sur les 21 requêtes positives de la recette ciblée, Recall@5 passe de 90,5 % à 100 %, Precision@5 de 19,0 % à 21,0 %, MRR de 0,825 à 0,921 et nDCG@10 de 0,846 à 0,941. Deux résultats vides injustifiés tombent à zéro. La réussite d’un cas demande une référence attendue dans les cinq premiers résultats ou un résultat vide quand cette absence est annotée. Le rappel et la précision utilisent seulement les URLs de référence. La précision divise par cinq, avec des annotations non exhaustives. Le MRR utilise le rang du premier document attendu. Le nDCG utilise une pertinence binaire. La validation séparée reste sous la cible de 95 % de rappel à dix. La recette ciblée a guidé ces corrections. [Banc de recherche](../scripts/benchmark-recherche.mjs)

Le Web utilise `POST /api/v1/reponse`. Le même moteur est exposé par `polradar_answer`. Sur la question générale concernant l’âge légal, les deux transports renvoient le même objet de données dans chaque édition. Après correction, la réponse passe de `sans-resultat` à `documente` et le navigateur affiche la source directement. Le premier repère légal est publié dans la collection `droit` à côté des données du tableau. La lecture d’une édition antérieure sans ce repère garde le renvoi vers le dossier. [Documentation API](https://polradar.fr/api/) · [Contrat du moteur documentaire](https://polradar.fr/mcp/documentation/) · [Banc documentaire](banc-documentaire-mcp.md)

| Banc libre de régression | Référence locale |     Lot local |
| ------------------------ | ---------------: | ------------: |
| Réponses conformes       |          12 / 16 |       11 / 16 |
| Faits conformes et cités |          19 / 25 |       19 / 25 |
| Appels MCP médians       |              2,5 |           2,5 |
| Résultat MCP médian      |    13 443 octets | 10 483 octets |
| Durée médiane par tour   |           15,9 s |        16,3 s |

Un passage par édition, avec Codex CLI 0.169.1 et `gpt-6.2-sol`, via HTTP local et socket Unix. Les cas sur Élabé, la réunion de Lille, une ancienne version de retraite et la périodicité d’un chiffrage Lisnard échouent aux deux passages. Le passage local corrigé échoue aussi sur une séance hors du registre. L’échantillon et la variation entre tours laissent les écarts de score et de volume à confirmer. Le banc indépendant de 100 questions conserve son dernier résultat documenté de 35/100 sur l’édition `51a2ffd`. [Historique et barème](banc-documentaire-mcp.md)

Le banc structuré valide 208 questions sur 208 dans les deux éditions. Le lot final passe aussi les 16 cas de recherche communs côté Go. Les réponses HTTP et MCP du parcours des retraites sont comparées sur le service local, puis la preuve est vérifiée dans la page.

## Sécurité

L’audit npm retourne zéro avis. Govulncheck `v1.10.0`, utilisé par la CI, n’identifie aucune vulnérabilité dans le périmètre analysé. Apache a journalisé la requête statique de contrôle. Les paramètres de recherche de recette étaient absents des journaux d’accès, GoAccess et d’erreur. La revue locale couvre les validations des URL de preuve, l’insertion des données comme texte, les états du relevé statistiques et la compatibilité du transport. L’outil Codex Security a répondu deux fois que la cible avait changé au démarrage. Le scan global reste bloqué. [Modèle de menace](../SECURITY.md)

## Performance, accessibilité et non-régression

La recette comparative comprend 77 états par édition. Chromium couvre 320, 360, 375, 390, 430, 768, 1 024, 1 440 et 1 920 px. Firefox et WebKit complètent à 390 et 1 440 px. Aucun débordement de page ni appel tiers n’a été observé sur ces états. Axe-core 4.14.1 n’a remonté aucune violation automatique sur les 22 états mesurés de chaque édition. Les vérifications au clavier couvrent notamment le choix de candidature, le focus déplacé vers la réponse et l’ouverture du relevé des erreurs. Les tests avec lecteur d’écran, zoom navigateur et participants restent ouverts.

La suite finale passe 248 tests Playwright à deux workers. Deux tests du comparateur avaient dépassé leur délai lors d’un premier passage concurremment aux autres mesures. Les trois parcours de ce fichier passent ensuite trois fois en isolation, puis dans la suite complète. Astro vérifie 8 793 pages, liens et ressources compris. Les 255 tests Node, les 158 tests Python et la suite Go avec détection de races passent. L’archive finale passe aussi une recette Go ciblée sur le moteur documentaire, sa recherche et ses preuves. Le contrôle d’historique confirme la conservation des 5 747 versions existantes. L’archive de captures contient 48 images, dont deux vues du relevé public rejoué localement.

| Page             | LCP de laboratoire initial | LCP de laboratoire corrigé | CLS avant et après |
| ---------------- | -------------------------: | -------------------------: | -----------------: |
| Accueil          |                   1 032 ms |                   1 040 ms |                  0 |
| Recherche        |                     844 ms |                     824 ms |                  0 |
| Comparateur      |                     840 ms |                     764 ms |                  0 |
| Statistiques MCP |                     720 ms |                     668 ms |                  0 |

Médianes de trois navigations Chromium locales par page et édition, à 390 px avec ralentissement CPU et débit simulé. Les deux éditions sont mesurées successivement à l’issue des suites. La recette de recherche mesure 20,10 puis 20,08 ms au p50 à chaud et 34,58 puis 34,95 ms au p95. Sur le seul premier appel de chaque processus, la mesure est de 385 puis 576 ms. Les percentiles terrain restent à mesurer. [Protocole de navigation](../scripts/audit-navigation.mjs) · [Banc lexical](../scripts/benchmark-recherche.mjs)

## Déploiement et retour arrière

Le lot utilise le transport partitionné déjà prévu par le projet. Construire par `npm run build`, puis exécuter `python3 scripts/package-release.py --format partitioned` et `python3 scripts/test-mcp-release.py artifacts/site.tar.gz`. Le corpus reconstitué de 12 122 238 octets dépasse le plafond de 10 Mio du paquet historique. Le paquet final pèse 35 563 821 octets compressés, en dessous du plafond de 64 Mio. Vérifier la version et le support de la partition côté service avant activation, puis vérifier le manifeste public, la réponse juridique et la page des statistiques. Le service et le site sont publiés selon leurs workflows respectifs. En cas de retour arrière, utiliser le couple service et archive de référence selon la procédure opérateur. [Publication et rollback](../deploy/README.md) · [Service et socket](../deploy/operations/README.md)

## Priorités résiduelles

| Priorité | Problème et impact                                                                                                                            | Critère de validation                                                                                                                      |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | La matrice contient encore 124 couples prioritaires sans réponse directe. Le déplacement dans le corpus ne suffit pas à établir une position. | Relire chaque couple, relier un passage qualifié ou consigner la pièce et le périmètre effectivement examinés.                             |
| P0       | La pertinence du banc indépendant de l’assistant et le rappel sur le jeu Web séparé restent sous les cibles.                                  | Annoter les échecs par fait, source et attribution. Rejouer sur un jeu indépendant et au moins deux clients avant d’interpréter les gains. |
| P0       | La recette humaine, le contrôle manuel WCAG et le scan Codex Security global restent incomplets.                                              | Rejouer les parcours essentiels avec participants, lecteurs d’écran et zoom. Obtenir un scan complet sur la révision contrôlée.            |
| P1       | La couverture du droit en vigueur reste surtout concentrée sur le numérique et les retraites.                                                 | Qualifier de nouveaux dossiers par texte applicable, date, périmètre et exceptions.                                                        |
| P1       | Les métriques de terrain et la disponibilité mensuelle ne sont pas établies dans ce relevé.                                                   | Mesurer LCP, INP et CLS au p75 ainsi que la disponibilité sur la période prévue, sans collecte de recherche individuelle.                  |
| P2       | Les performances et la couverture des services comparables évoluent.                                                                          | Actualiser le benchmark concurrentiel avec les mêmes tâches, unités et limites de vérification.                                            |
| P3       | La reproduction des captures comparatives demande une recette locale distincte de la CI.                                                      | Automatiser un échantillon stable d’écrans avec la version du navigateur et la révision du corpus.                                         |
