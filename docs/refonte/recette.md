# Polradar 2.0 · recette de la refonte

La révision locale de la recette est `67bfca70b520ba650ba078a96a6370059595b5cf`. Elle part de l’édition publique `727d465`. L’état initial et le comparatif décrivent séparément les fonctions observées et les limites du relevé. [État initial](etat-initial.md) · [Comparatif](comparatif.md)

## Parcours et composants

| Parcours                   | Changements contrôlés                                                                                                                                                                                                                                                                                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation                 | Six liens d’usage en HTML statique. « Rubriques » contient les entrées spécialisées et mène à l’index complet. Sur mobile, les six entrées occupent deux rangées. Le volet s’ouvre sans déplacer la page, se ferme à la sortie au clavier et rend le focus à son déclencheur après Échap. [Navigation](../../src/components/SiteNavigation.astro) · [Rubriques](../../src/pages/rubriques.astro)            |
| Accueil                    | Objet du site, recherche et quatre parcours au premier écran. Brèves et derniers terrains avant les compteurs documentaires. Les compteurs proviennent du relevé partagé et de la sélection de scrutins effectivement publiée. Les thèmes proposés sont des entrées éditoriales, sans candidat choisi. [Accueil](../../src/pages/index.astro) · [Recherche d’accueil](../../src/components/HomeCover.astro) |
| Candidat                   | Statut, date de consultation de sa source, crédit de photo, accès aux mesures, au dossier de relecture et aux passages originaux. Les analyses non disponibles n’apparaissent pas comme des liens. [Fiche](../../src/pages/candidats/%5Bid%5D.astro)                                                                                                                                                        |
| Comparaison                | Deux emplacements vides par défaut. Ajout facultatif d’un troisième candidat. Les URL conservent le thème, la sélection et les archives. Après un résultat, les sauts vers les candidats et l’export JSON gardent les références. [Formulaire](../../src/pages/comparer.astro) · [Rendu et export](../../src/scripts/compare.ts)                                                                            |
| Recherche                  | Index en local dans le navigateur, thèmes en tête de l’index avant saisie, facettes existantes, indications de type et d’auteur, accès au droit, aux données locales et aux séries publiques. Les formes usuelles et les sigles sont normalisés, et la correction d’une faute à une lettre exige une interprétation unique. [Index](../../src/lib/search.ts) · [Moteur](../../src/lib/features.mjs)         |
| Sondages et graphiques     | Sélection de l’enquête et notice avant les liens spécialisés. Cibles des séries agrandies. Les cartes d’indicateurs sur l’accueil gardent valeurs, unités, période et accès à la série. [Sondages](../../src/pages/sondages.astro) · [Indicateurs](../../src/components/HomeSignals.astro)                                                                                                                  |
| Territoires et simulations | Accès courts aux chiffres locaux, aux résultats électoraux et aux soins. Les valeurs du tableau communal conservent leur unité sur petit écran. Trois entrées guident vers les simulations existantes. [Territoires](../../src/pages/territoires/index.astro) · [Mon quotidien](../../src/pages/economie/simulateurs.astro)                                                                                 |
| Suivi                      | Fiches suivies visibles avant la longue liste de sélection. L’index de choix suffit au premier chargement. Les fiches ou les versions nécessaires à une demande explicite chargent le corpus. Effacer une sélection invalide les résultats encore en cours de chargement. [Suivi](../../src/scripts/follow.ts) · [Journal](../../src/scripts/follow-since.ts)                                               |
| Presse, API et MCP         | Hiérarchie commune des titres et liens directs vers exemples, listes d’outils et exports dans la documentation. [API](../../src/pages/api/index.astro) · [MCP](../../src/pages/mcp/index.astro)                                                                                                                                                                                                             |

Les fichiers de données, licences, URL des fiches, formats d’export, protocoles et services de publication gardent leurs contrats. L’index des rubriques a sa propre URL et sa carte de partage. Les liens profonds et les cinq anciens fragments de navigation sur l’accueil restent accessibles.

## Conventions d’interface

Le fond `#f7f6f2`, l’encre `#192d38` et l’accent `#245f61` servent la lecture. Les couleurs par série restent réservées aux graphiques. Archivo reste auto-hébergée. Le corps de texte partagé est à 16 px avec un interligne de 1,58. Les titres principaux visent 24 à 28 px. Les variables partagées règlent les marges, la largeur du contenu, les rayons et les cibles de 44 px de la navigation principale.

Les boutons, sélecteurs, formulaires et panneaux ouvrants restent natifs. Les destinations et liens documentaires sont rendus côté serveur. L’index conserve ses pages et ses liens thématiques sans JavaScript. Les filtres interactifs, le comparateur personnalisé et la recherche par fragment utilisent le script du navigateur. La CSS commune simplifie les en-têtes, les cartes et les liens de navigation interne. [Styles partagés](../../src/styles/reading.css) · [Modern Web Guidance](https://github.com/GoogleChrome/modern-web-guidance-src/tree/main/guides/accessibility) · [Taille des cibles](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) · [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)

## Sécurité et confidentialité

Les contrôles sur les formulaires, la recherche et le partage couvrent les URL, le rendu et les requêtes émises. La recherche d’accueil transmet la saisie dans le fragment du lien, lu par le navigateur. Les exports sont produits sur place depuis des données publiques. La sélection de Mon suivi reste locale. Le moteur lexical travaille avec des chaînes bornées et n’interprète pas les entrées comme du HTML.

Le build vérifie les politiques CSP, les liens internes et les ressources locales. L’audit npm ne signale aucun avis applicable. Le test Apache local a vérifié que les paramètres de recherche ne figurent pas dans les journaux de recette. Le point d’accès public aux statistiques privées a répondu 401 sans identifiants. La vérification des en-têtes, le contrôle de secrets par motifs et la lecture du diff sont distincts d’un scan exhaustif. Codex Security a retourné une erreur de résolution de la révision dans ce worktree.

Les protocoles et contrôles de publication gardent leur périmètre. Le banc Go contrôle les schémas, les références, les résultats vides et les erreurs attendues, sur des appels structurés. L’évaluation des questions libres à un agent publiée dans le banc documentaire porte sur une édition précédente. [Banc MCP](../banc-documentaire-mcp.md) · [Politique du projet](../../SECURITY.md)

## Corrections issues de la recette

La recette a repéré les valeurs et unités séparées dans la fiche communale à 320 px, les libellés divergents entre texte visible et nom accessible, et les sélecteurs de sondage trop petits. Les captures ont aussi montré que l’index vide ouvrait sur les premières mesures d’un seul candidat. Les valeurs communales disposent d’une colonne adaptée, les contrôles ont des noms concordants et l’index démarre sur les thèmes.

L’ancien accès au guide MCP et le parcours de la relecture de Dubuisson ont été contrôlés sans sacrifier les tests existants. Le test de suivi vérifie aussi qu’un chargement retardé ne restaure pas une sélection effacée.

## Résultats de la recette

Astro a contrôlé **4 881 pages**. Les **224 tests Node, 141 tests Python et 186 tests Playwright** ont réussi. La première passe Playwright en parallèle des captures et de l’audit a connu deux dépassements de délai. La passe consacrée aux tests navigateur sur la même révision a confirmé les deux parcours. Le banc MCP a obtenu **200 réponses conformes sur 200** sur la révision de code finale. Le contrôle HTTP public a confirmé l’édition `727d465` et des réponses valides pour les onze outils et quinze collections. [Banc de recette du dépôt](../banc-documentaire-mcp.md) · [Révision publique](https://polradar.fr/build.json)

Les **168 captures avant et après** couvrent quatorze parcours à six tailles. Les captures finales n’ont relevé ni débordement de page ni échec de chargement. Une vérification complémentaire a rejoué le menu au clavier, la recherche avec faute jusqu’à la référence Dubuisson, la comparaison avec deux candidats et les chiffres de la commune à 320 px.

Axe 4.14.1 a remonté 6 occurrences de règles sur 30 états de référence et **0 sur 38 états** de recette. Les jeux d’états incluent les pages communes et des états interactifs supplémentaires après refonte. Les contrastes des couleurs partagées mesurent de 6,08:1 à 13,18:1 sur les associations vérifiées. Ces mesures complètent la navigation clavier et la lecture des captures. La validation avec lecteur d’écran, le zoom navigateur à 200 % et les contrastes que l’outil laisse à examiner demandent une vérification dédiée.

### Recherche

Le banc a obtenu **97/100**, sur 4 257 entrées. Un cas réussi retrouve un lien attendu dans les cinq premières réponses ou préserve l’absence de résultat attendue. Avant refonte, 49 des 77 cas pour lesquels l’index possédait une cible, cas vides compris, étaient conformes. Les autres testent des entrées documentaires désormais indexées. La première recherche sur index déjà téléchargé a pris 145,03 ms. En régime chaud, la médiane est de 6,03 ms et le p95 de 11,24 ms sur Apple M3, Node v26.11.1. Les temps excluent le réseau et le rendu. [Les 100 requêtes annotées](requetes.tsv) · [Script de mesure](../../scripts/benchmark-recherche.mjs)

Les trois échecs concernent une formulation sur le plafonnement de l’électricité, une question relative aux hôpitaux et l’orthographe « Edward Philippe ». Les requêtes qui attribueraient à tort une suppression de la CSG ou qui inventent une valeur ne sont pas rapprochées d’une proposition différente.

### Performance de navigation

Même profil que l’état initial. Chromium 159, Apple M3, profil mobile 390 × 844, CPU bridé ×4, 1,6 Mbit/s, latence de 60 ms, cache froid. Trois navigations par page. Le transfert est la somme des corps envoyés par le serveur local en gzip. [Script](../../scripts/audit-navigation.mjs)

| Page                    | LCP médian avant | LCP médian après | Kio avant | Kio après |
| ----------------------- | ---------------: | ---------------: | --------: | --------: |
| `/`                     |           852 ms |           856 ms |      97,5 |      89,9 |
| `/candidats/`           |         1 248 ms |         1 284 ms |     429,6 |     431,4 |
| `/candidats/dubuisson/` |           832 ms |           888 ms |     100,1 |     100,5 |
| `/comparer/`            |           688 ms |           728 ms |      80,9 |      81,1 |
| `/recherche/`           |           696 ms |           716 ms |      83,8 |      84,5 |
| `/sondages/`            |           852 ms |           808 ms |     154,2 |     154,9 |
| `/territoires/`         |           792 ms |           724 ms |      89,2 |      88,8 |
| `/suivi/`               |           760 ms |           648 ms |     907,1 |      84,4 |

Les résultats de laboratoire renseignent le LCP, les déplacements de mise en page et les octets. L’INP et les Core Web Vitals des visiteurs restent à mesurer. Les budgets initiaux visent 105 Kio pour l’accueil, le comparateur, la recherche et la documentation, 120 Kio pour une fiche ou une commune, 460 Kio pour la galerie de candidats, 170 Kio pour les sondages et 110 Kio pour Mon suivi avant sélection. Ils se comparent avec ce même protocole.

### Lighthouse

Trois passages mobiles par page avec Lighthouse 13.6.0, Chromium 159 et les conditions simulées par défaut. Les médianes de la dernière passe sur l’accueil et les sondages proviennent du build 67bfca7. Les mesures de la fiche candidat, du comparateur et de Mon suivi proviennent de la revue intermédiaire bbee301. Les rapports bruts détaillent la dispersion.

| Page                    | Révision  | Performance | Accessibilité | Bonnes pratiques | SEO |
| ----------------------- | --------- | ----------: | ------------: | ---------------: | --: |
| `/`                     | `67bfca7` |         100 |           100 |              100 | 100 |
| `/candidats/dubuisson/` | `bbee301` |         100 |           100 |              100 | 100 |
| `/comparer/`            | `bbee301` |         100 |           100 |              100 | 100 |
| `/sondages/`            | `67bfca7` |         100 |           100 |              100 | 100 |
| `/suivi/`               | `bbee301` |         100 |           100 |              100 |  66 |

Mon suivi porte une directive volontaire de non-indexation. L’évaluation SEO de cette page reflète cette directive.

### Archive de publication

| Déploiement                 |     Utilisé |     Plafond |              Marge |
| --------------------------- | ----------: | ----------: | -----------------: |
| Archive gzip (octets)       |  19,701,715 |  29,360,128 |  9,658,413 (32.9%) |
| TAR complet (octets)        | 151,787,520 | 201,326,592 | 49,539,072 (24.6%) |
| Fichiers                    |       6,184 |       8,000 |      1,816 (22.7%) |
| Plus grand fichier (octets) |   6,242,952 |  10,485,760 |  4,242,808 (40.5%) |

Cette archive locale a passé le contrôle d’empreinte, de révision, de taille et de fichiers. Les captures, rapports bruts et journaux de recette sont livrés hors dépôt dans le dossier Polradar 2.0 de l’espace de travail.

## Protocole de compréhension humaine

Recruter au moins cinq personnes qui découvrent Polradar, avec un groupe sur téléphone et un groupe sur ordinateur. Ouvrir la même édition à l’accueil dans une session neuve. Donner une tâche à la fois, sans tutoriel préalable et avec un ordre varié entre participants.

| Tâche à proposer                                                                 | Critère                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------ |
| Dire à quoi sert le site                                                         | Moins de 10 s, reformulation libre.        |
| Ouvrir le dossier Dubuisson et situer son statut                                 | Moins de 20 s.                             |
| Choisir deux candidats et comparer leurs propositions sur les retraites          | Moins de 30 s.                             |
| Retrouver la proposition sur la CSG et lire qui la porte                         | Moins de 30 s.                             |
| Ouvrir la référence d’une mesure depuis sa fiche                                 | Deux actions au maximum.                   |
| Expliquer la différence entre deux propositions et ce qui manque dans le corpus  | Réponse correcte, sans aide.               |
| Trouver le sondage le plus récent et indiquer sa date de terrain et son scénario | Moins de 20 s.                             |
| Lire la donnée de logement social pour Paris et identifier son millésime         | Moins de 30 s.                             |
| Démarrer une simulation avec une valeur fictive donnée                           | Moins de 30 s.                             |
| Identifier les hypothèses et la référence du calcul                              | Visibles depuis le résultat.               |
| Transmettre le lien d’une comparaison                                            | Deux actions au maximum après le résultat. |
| Retrouver une nouvelle brève                                                     | Moins de 20 s.                             |
| Trouver un exemple d’appel REST ou le guide MCP                                  | Moins de 30 s.                             |

Pour chaque tâche, noter le temps, le résultat, les hésitations, les erreurs et les retours en arrière. Demander à la fin une explication de la source et une note de facilité de 1 à 5. Les scores sont anonymes. L’objectif est 80 % de réussite sans aide pour chaque parcours critique. Cette recette humaine reste à réaliser. L’audit navigateur ne démontre ni ces durées auprès de lecteurs novices, ni la conformité générale avec un lecteur d’écran.

## Critères pour engager le lot suivant

Les comparaisons de coût et de droit, les registres et les usages territoriaux existants constituent le socle. Après la recette humaine, commencer par les cas où le dossier contient à la fois une règle en vigueur, une proposition explicite et des paramètres calculables. La validation sur des pièces réelles précède l’extension aux nouveaux foyers types et au suivi institutionnel des parrainages.

### Grille d’observation pour la consolidation

Utiliser les tâches ci-dessus dans une session individuelle de 15 à 20 minutes. Garder la même édition et annoncer que la personne peut interrompre le test. Noter uniquement un code de participant, la catégorie d’appareil, la taille de fenêtre et la familiarité déclarée avec ce type de site. Répartir les cinq premières sessions entre téléphone et ordinateur et commencer avec une personne peu à l’aise avec les outils numériques dans chaque groupe.

| Code | Tâche | Durée | Réussie sans aide | Aide apportée | Première action | Hésitations et erreurs | Reformulation |
| ---- | ----- | ----- | ----------------- | ------------- | --------------- | ---------------------- | ------------- |
| P…   | …     | … s   | Oui / non         | …             | …               | …                      | …             |

Faire verbaliser la règle, la proposition ou la source après la tentative chronométrée. Noter un abandon dès que la personne renonce. Pour chaque tâche, calculer le nombre de réussites sans aide divisé par le nombre de tentatives. Avec cinq participants, quatre réussites atteignent l’objectif exploratoire. Dans la synthèse, indiquer la révision, l’appareil, les tâches, les obstacles observés, leur fréquence et la correction suivie d’une nouvelle tentative. Traiter en priorité les erreurs d’interprétation, les blocages et les échecs répétés, puis les hésitations. Conserver des observations anonymes et aucun choix politique.

Pour les requêtes, le classement réussit si l’un des liens attendus figure parmi les cinq premiers, ou si une question sans réponse ne produit aucun résultat. Les 100 cas historiques et les requêtes de validation ont des formulations distinctes. Les durées mesurées en JavaScript portent sur l’index déjà téléchargé. Le relevé navigateur mesure séparément le chargement et le rendu.
