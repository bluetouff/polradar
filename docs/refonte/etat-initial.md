# Refonte Polradar 2.0 · état initial

Le 25 novembre 2026 à 9 h 57, heure de Paris, le site et la branche publique `main` indiquaient la révision `727d4659fc40715c9fd68de56a4cf00f6eaf50cb`. Le travail part de cette révision. Le service Go indiquait sa propre révision `e7ff2abc67b6f6d6f394aa67119a63b9764280a8` et la version 1.4.0. Le corpus annoncé par le MCP correspondait à celui de l’API REST. Les onze outils et les quinze collections ont répondu au contrôle prévu par le dépôt. [Marqueur du site](https://polradar.fr/build.json) · [Contrat REST](https://polradar.fr/api/v1/corpus) · [Script de vérification](../../scripts/etat-production.py)

## Fonctions existantes

| Parcours                                         | Fonction de cette édition                                                                                                        | Vérification ou limite                                                                                                                                                            |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Candidats](https://polradar.fr/candidats/)      | 45 dossiers dont un retrait, portraits crédités, statut et pièces de référence, fiches par thème                                 | La fiche Dubuisson documente 26 mesures et orientations et deux ensembles de 16 et 13 sections relues. [Dossier](https://polradar.fr/candidats/dubuisson/)                        |
| [Programmes](https://polradar.fr/mesures/)       | 2 498 propositions de campagne ou de parti, 93 orientations, 25 archives et 2 732 états de fiches                                | Aucun résultat de comptage sans référence dans le relevé. 450 des 774 sources ont un passage documenté. [Qualité documentaire](https://polradar.fr/api/qualite-documentaire.json) |
| [Comparer](https://polradar.fr/comparer/)        | Deux ou trois candidats par thème, métriques comparables, dossiers par question, retraites et numérique face au droit en vigueur | Les fiches restent consultables par thème avec JavaScript désactivé. [Questions](https://polradar.fr/questions/) · [Retraites](https://polradar.fr/comparer/retraites/)           |
| [Recherche](https://polradar.fr/recherche/)      | Index JSON local au navigateur, recherche par mots, facettes, exports et pagination                                              | Les filtres et les exports existent déjà. L’index initial privilégie les textes au détriment des chemins vers le droit et les données publiques.                                  |
| [Sondages](https://polradar.fr/sondages/)        | 74 enquêtes identifiées, 430 observations de scénarios, 74 notices dans le relevé des enquêtes intégrées                         | Le registre des notices traite un périmètre distinct. Les scénarios ne sont pas comptés comme des terrains. [Notices](https://polradar.fr/sondages/notices/)                      |
| [Campagne](https://polradar.fr/campagne/)        | Brèves, agenda, chronologie, dates du scrutin, heures d’antenne et comptes de campagne                                           | Le journal distingue la collecte, le succès et la date des données. [Mises à jour](https://polradar.fr/mises-a-jour/)                                                             |
| [Parlement](https://polradar.fr/votes/)          | 8 203 actes indexés, recherche transversale et dossiers de rapprochement sourcés                                                 | Sélection de scrutins, positions individuelles et actes indexés ont des unités différentes. [Recherche](https://polradar.fr/votes/recherche/)                                     |
| [Économie](https://polradar.fr/economie/)        | 18 séries Eurostat, finances publiques, déclarations chiffrées, budgets, taxes sur l’électricité, CSG et retraite                | Les simulateurs existent et calculent côté navigateur. [Simulateurs](https://polradar.fr/economie/simulateurs/)                                                                   |
| [Territoires](https://polradar.fr/territoires/)  | Résultats communaux 2022, inventaire de logements sociaux et accès aux médecins                                                  | L’unité, le millésime et le champ accompagnent chaque résultat.                                                                                                                   |
| [Mon suivi](https://polradar.fr/suivi/)          | Préférences locales, changements sur 24 heures ou sept jours, liens permanents et RSS                                            | Le premier chargement de l’édition de départ récupère le corpus complet, même avec une sélection vide.                                                                            |
| [Presse](https://polradar.fr/presse/)            | Médiakit, partenariat, Studio et graphiques intégrables figés ou actualisés                                                      | [Studio](https://polradar.fr/studio/) · [Exemples d’intégration](https://polradar.fr/comparer/retraites/)                                                                         |
| [Données ouvertes](https://polradar.fr/donnees/) | 22 jeux nommés par l’API de catalogue, export versionné, fiches sources, API et MCP publics                                      | [Catalogue JSON](https://polradar.fr/api/exports-v1.json) · [Documentation API](https://polradar.fr/api/) · [Documentation MCP](https://polradar.fr/mcp/documentation/)           |
| Publication                                      | Astro statique, collecteurs GitHub Actions, REST et MCP en Go derrière Apache                                                    | Le déployeur valide la révision, la taille, les chemins de fichiers et l’intégrité. [Architecture](../../README.md) · [Exploitation](../../deploy/README.md)                      |

## Mesures initiales

Les captures de production couvrent 14 parcours aux six tailles 360 × 800, 390 × 844, 768 × 1 024, 1 024 × 768, 1 440 × 900 et 1 920 × 1 080. Les 84 captures ont été obtenues. Aucun débordement de la page ni erreur de chargement principal n’a été détecté à cet état initial. Le site déclare un thème clair.

Sur l’accueil à 390 px, l’urne, les dates du scrutin et les indicateurs occupent le premier écran. Le comparateur mobile affiche les réglages avant les deux sélecteurs de candidats. Sur les sondages, les liens spécialisés occupent plusieurs lignes avant la source et la première valeur. Le menu change de représentation sur les pages profondes quand le JavaScript se charge. Le diagnostic porte sur la hiérarchie de lecture et les interactions observées.

La mesure reproductible réutilise l’archive `727d465` dont l’empreinte et le manifeste ont été validés. Chromium 159, Apple M3, profil 390 × 844 avec CPU ×4, 1,6 Mbit/s, latence émulée de 60 ms, navigateur neuf et trois observations par page. Les transferts viennent du petit serveur gzip local de la recette. [Script de mesure](../../scripts/audit-navigation.mjs)

| Page            | LCP médian |    CLS | Transfert initial |
| --------------- | ---------: | -----: | ----------------: |
| Accueil         |     852 ms |      0 |          99 815 o |
| Candidats       |   1 248 ms |      0 |         439 900 o |
| Fiche Dubuisson |     832 ms |      0 |         102 472 o |
| Comparateur     |     688 ms |      0 |          82 829 o |
| Recherche       |     696 ms |      0 |          85 819 o |
| Sondages        |     852 ms |      0 |         157 872 o |
| Mon suivi       |     760 ms | 0,0213 |         928 853 o |

L’archive initiale comprend 6 180 fichiers, 148 469 760 octets de TAR et 20 680 355 octets de gzip. L’archive est conservée hors du dépôt de la refonte. Le rapport de production, les captures et les observations brutes sont livrés dans le dossier d’artefacts Polradar 2.0.

La protection de la publication et la politique de confidentialité utilisent des contrôles distincts de la validation du frontend. Les liens de partage s’activent sur demande. Les données de suivi restent dans le stockage du navigateur. La revue de la refonte vérifie les entrées traitées dans le navigateur et les régressions de CSP sans modifier les workflows, Apache ou les droits. [Politique de sécurité](../../SECURITY.md) · [Confidentialité](https://polradar.fr/mentions/)
