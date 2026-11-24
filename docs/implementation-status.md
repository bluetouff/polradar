# État d’implémentation de Polradar

Relevé du 24 novembre 2026. La référence publique est `55212bec2404042b87b7ec1f827e8cf2785866bb`. L’itération ci-dessous est locale. [Révision servie](https://polradar.fr/build.json) · [Matrice concurrentielle](competitive-audit.md)

## Architecture et référence

Astro construit le site et les données publiques à partir de fichiers validés. Les collecteurs GitHub Actions relèvent les sources officielles et publient avec des permissions limitées. Le service Go lit l’édition du site via une socket Unix derrière Apache. Les archives du site et des données réunissent des fichiers versionnés et une empreinte SHA-256. [Architecture](../README.md) · [Contrôles éditoriaux](../DATA_QUALITY.md) · [Déploiement](../deploy/README.md)

La base originale est sous ODbL 1.0, le code sous AGPL-3.0-only, les créations originales sous CC BY 4.0 et le SDK sous MIT. Les producteurs gardent les droits sur leurs données, documents et photographies. [Licences](https://polradar.fr/licences/)

| Indicateur                                          | Référence publique | Itération locale |
| --------------------------------------------------- | -----------------: | ---------------: |
| Dossiers de candidature, retraits compris           |                 35 |               35 |
| Propositions de campagne ou de parti                |              2 292 |            2 302 |
| Fiches, orientations et archives comprises          |              2 383 |            2 393 |
| États de proposition conservés                      |              2 496 |            2 507 |
| Terrains de sondage documentés                      |                 34 |               37 |
| Scénarios de sondage                                |                204 |              233 |
| Notices entièrement vérifiées                       |                 34 |               37 |
| Notices du catalogue dont l’objet reste à qualifier |                222 |              219 |
| Actes dans l’index parlementaire                    |              8 203 |            8 203 |
| Jeux d’open data au catalogue d’édition             |                 19 |               21 |
| Questions du banc MCP                               |                191 |              200 |

Le registre des sondages contient 257 entrées. Une entrée peut relever d’un baromètre d’opinion ou d’un autre périmètre. Les terrains, les notices et les scénarios ont des dénominateurs différents. [Registre des notices](https://polradar.fr/sondages/notices/) · [Corpus JSON](https://polradar.fr/api/corpus.json)

## Livraisons de l’itération

| Chantier                             | État                                     | Travail effectué et limites                                                                                                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Corpus et déduplication              | Partiel, implémenté                      | Dix fiches ajoutées et un état enrichi. Le relevé de qualité signale les formulations rigoureusement identiques en conservant auteur, type de fiche, portée et chiffres. Les rapprochements sémantiques demandent encore une lecture des sources.               |
| Matrice de couverture                | Implémenté                               | Le croisement par candidature, document, thème, sous-thème, type et millésime détaille campagne, parti, orientations, archives et références citées. Deux périmètres supplémentaires ont des unités vérifiées. Le relevé indique les passages restant à relier. |
| Candidatures                         | Partiel, en service                      | L’itération publie les effectifs par libellé de statut dans le relevé. L’historique individuel des transitions et la qualification des candidatures émergentes restent partiels.                                                                                |
| Sondages                             | Partiel, enrichi                         | Trois notices dépouillées, 29 scénarios et 262 scores. Les premières diffusions restent à établir. Les hypothèses gardent leurs effectifs et pages de résultat. Le chantier d’agrégation multi-instituts et les backtests restent ouverts.                      |
| Parlement                            | Partiel, export étendu                   | L’archive figée inclut l’index transversal des 8 203 actes. Le relevé compte par institution les scrutins et ceux qui ont au moins un vote individuel suivi. La couverture demeure celle des séances, mandats et sources recensés.                              |
| Économie                             | Partiel, en service                      | Indicateurs Eurostat, déclarations examinées, budgets sourcés et simulateurs CSG et retraite déjà disponibles. Le simulateur budgétaire national et les estimations indépendantes comparables restent ouverts.                                                  |
| Historique, actualité et comparateur | Partiel, en service                      | Les versions, les brèves, la chronologie, les comparatifs de questions et leurs références sont consultables. Restent notamment les synthèses temporelles et le recensement des évolutions de tous les programmes.                                              |
| Territoires                          | Partiel, en service                      | Résultats communaux de 2022, logement social et accès aux soins documentés. Les séries territoriales et résultats d’autres scrutins demandent une extension par millésime et périmètre.                                                                         |
| Parrainages                          | Dépendance externe                       | L’intégration des résultats 2027 dépend des publications du Conseil constitutionnel. La couverture historique et le modèle de publication restent à traiter.                                                                                                    |
| API et MCP                           | Partiel, banc étendu                     | 200 questions dans le banc existant. Les nouveaux cas portent sur les trois institutions, la pagination, les sondages historiques et les absences de résultat. L’environnement public continue de servir la référence.                                          |
| Open data                            | Implémenté pour les deux exports ajoutés | Index parlementaire et relevé documentaire dans le catalogue et l’archive figée. L’index documentaire externe existe déjà. [Fiche data.gouv.fr](https://www.data.gouv.fr/datasets/presidentielle-francaise-de-2027-index-documentaire-de-polradar)              |
| Studio, accès et SEO                 | Partiel, en service                      | Les 29 scénarios alimentent aussi les graphiques d’archives. Les tests de navigation couvrent les petits écrans. La mesure terrain, la PWA et l’internationalisation demeurent des chantiers distincts.                                                         |
| Qualité et collecte                  | Implémenté                               | Section « Couverture et fraîcheur » et JSON issus des mêmes données. Une donnée de succès plus ancienne dans une collecte en échec ne supplante plus un succès plus récent du journal.                                                                          |
| Sécurité                             | Correctifs locaux                        | Le collecteur vérifie les adresses publiques unicast. Le MCP précise la nature documentaire du contenu retourné. Le déployeur revérifie la révision et la procédure opérateur exige l’attestation du lanceur avant exécution.                                   |

Les nouvelles fiches portent sur l’énergie et le handicap chez Édouard Philippe et sur le livret Santé de Nouvelle Énergie. L’auteur collectif est explicite. La série sur les EPR prolonge une fiche existante. [Énergie](https://www.edouardphilippe.fr/programme/energie) · [Handicap](https://www.edouardphilippe.fr/programme/handicap) · [Livret Santé, page 8](https://nouvelle-energie-media-prod.s3.fr-par.scw.cloud/media/legacy/2026/05/Livret-Sante-Nouvelle-Energie.pdf#page=8)

Les notices intégrées portent sur l’Enquête électorale française Ipsos BVA et deux vagues Ifop. Les cellules absentes restent non renseignées. [Notice 10262](https://www.commission-des-sondages.fr/notices/files/notices/2026/septembre/10262-pres-enquete-electorale-ipsos-bva-le-monde-13-septembre.pdf) · [Notice 10284](https://www.commission-des-sondages.fr/notices/files/notices/2026/septembre/10284-pres-barometre-election-v6-ifop-30-septembre.pdf) · [Notice 10327](https://www.commission-des-sondages.fr/notices/files/notices/2026/octobre/10327-pres-barometre-election-v7-ifop-20-octobre.pdf)

## Performance de référence

Trois navigations Chromium par page de production, contexte neuf, fenêtre mobile 390 × 844, réseau et CPU non bridés. Les valeurs concernent le chargement initial. Ce protocole n’établit pas l’INP ni les Core Web Vitals terrain.

| Page                    | LCP médian | CLS observé | HTML décodé | Transfert initial |
| ----------------------- | ---------: | ----------: | ----------: | ----------------: |
| Accueil                 |     184 ms |           0 |    38 850 o |         109 007 o |
| Statistiques            |     152 ms |           0 |    44 407 o |          95 305 o |
| Couverture              |     184 ms |           0 |   101 306 o |         106 864 o |
| Recherche parlementaire |     168 ms |           0 |    23 723 o |          93 017 o |
| Studio                  |     172 ms |           0 |    98 088 o |         137 639 o |

Le TAR public occupait 133 345 280 octets sur 134 217 728. Tous les contrôles de taille, de chemins, de fichiers et d’empreinte restent actifs. [Procédure de mesure](capacite-publication.md)

Dans la construction locale, la matrice passe à 112 169 octets d’HTML et les statistiques à 47 070. Le Studio atteint 104 324 octets avec les scénarios supplémentaires. La recherche parlementaire conserve ses 23 723 octets d’HTML. Ces tailles comparent les réponses décodées. Le temps de chargement local ne se compare pas à un accès HTTPS au site.

La construction locale occupe 132 669 440 octets de TAR pour 5 642 fichiers. Le même protocole local mesurait 132 014 080 octets sur la référence. Appliquer cet écart à l’archive GitHub donnerait une marge de 212 Kio. Cette projection reste à confirmer sur le prochain artefact GitHub.

## Vérification et suites du plan

Le validateur contrôle les références et les types. Le banc MCP exécute les demandes sur un corpus figé, compare résultats et sources, puis mesure les appels localement. La revue défensive couvre les entrées API et MCP, les collecteurs, la publication et l’installation. Les protections propres aux comptes hébergeurs et la configuration Apache effectivement chargée relèvent d’une vérification d’exploitation. [Banc documentaire](banc-documentaire-mcp.md) · [Sécurité](../SECURITY.md)

La validation initiale a contrôlé 4 408 pages et réussi 198 tests Node et 135 tests Python. Sur Chromium, 171 tests ont réussi au premier passage. Le parcours de la frise qui avait dépassé son délai a réussi lors de sa relance isolée. Les audits npm et Go n’ont signalé aucun avis applicable. Une échéance stricte pour toutes les opérations système de collecte reste à vérifier au-delà des plafonds de durée des workflows.

Les priorités suivantes sont la qualification des 219 notices restantes, l’identification de leurs premières diffusions, l’extension du corpus primaire et l’élargissement des mandats parlementaires couverts. Le rapprochement des chiffrages indépendants avec leurs hypothèses précède le simulateur national. La comparaison concurrentielle sert de relevé daté. [Matrice concurrentielle](competitive-audit.md)
