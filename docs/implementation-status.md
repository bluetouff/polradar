# État d’implémentation de Polradar

Le 26 novembre 2026, avant cette livraison, le site servait `3222083b80484692ce78568328b5120ed904b321` et le MCP annonçait `1.4.0`. Le manifeste public donne la révision du site et les réponses MCP et REST indiquent aussi celle du service. [Manifeste](https://polradar.fr/build.json) · [Relevé précédent](https://github.com/bluetouff/polradar/blob/3222083b80484692ce78568328b5120ed904b321/docs/implementation-status.md)

## Corpus et preuve

| Unité                                     | Édition publique de référence | Lot du 26 novembre |
| ----------------------------------------- | ----------------------------: | -----------------: |
| Dossiers de candidature, retraits compris |                            45 |                 45 |
| Propositions de campagne                  |                         2 437 |              2 466 |
| Propositions de parti                     |                         1 768 |              1 768 |
| Propositions de campagne ou de parti      |                         4 205 |              4 234 |
| Orientations                              |                           112 |                111 |
| Archives                                  |                            25 |                 25 |
| Versions de fiches                        |                         4 573 |              4 628 |
| Sources                                   |                           891 |                895 |
| Terrains de sondage identifiés            |                            83 |                 83 |
| Scénarios de sondage                      |                           481 |                481 |
| Actes de l’index parlementaire            |                         8 203 |              8 203 |

Les 28 nouvelles fiches portent sur les dossiers de Marine Le Pen, Jean-Luc Mélenchon, David Lisnard, Édouard Philippe et Raphaël Glucksmann. Une orientation de la première est devenue une proposition documentée. Les fiches gardent l’auteur indiqué par le document et le repère de lecture. Le registre recense aussi les sections examinées et les sections à relire. [Mesures](https://polradar.fr/mesures/) · [Couverture documentaire](https://polradar.fr/documents/couverture/)

Les statistiques et la transparence donnent la date de la dernière version enregistrée à Paris et la révision de construction. Le graphique des 14 jours compte les enregistrements datés. Les 99 versions historiques dont la date d’enregistrement est inconnue figurent dans le total. Les dates des sources restent consultables sur chaque fiche. [Statistiques](https://polradar.fr/statistiques/) · [Contrôles éditoriaux](../DATA_QUALITY.md)

## Parcours

- L’accueil propose six accès directs et des exemples de parcours vers les propositions, les sources et les scrutins. Sur mobile, Accueil, Recherche, Comparer et Mon suivi restent accessibles dans une barre basse. Les outils d’analyse et d’intégration sont réunis dans le répertoire des rubriques. [Accueil](https://polradar.fr/) · [Répertoire](https://polradar.fr/rubriques/)
- Le service 1.5 permet d’obtenir la fiche et ses passages en un appel avec `mode=preuves`. Il rend une ancre de version pour la citation et recherche les sondages par institut, commanditaire, scénario ou date. Les séries économiques se cherchent par titre ou code. Le contrat et la documentation distinguent l’édition servie et le service installé. [Guide MCP](https://polradar.fr/mcp/documentation/) · [OpenAPI](https://polradar.fr/api/openapi.json)
- Le modèle de menace documente les frontières de la collecte, de la publication et du service en lecture seule. Le site et le service ont des procédures d’activation indépendantes. [Sécurité](../SECURITY.md) · [Déploiement](../deploy/README.md)

## Mesures et limites

La validation locale a construit et vérifié 7 269 pages, passé 244 tests Node, 143 tests Python et 203 tests Playwright. Elle a vérifié la compatibilité du service et des éditions dans les deux sens. Les audits de dépendances npm et Go ont renvoyé zéro alerte applicable. La vérification intégrale WCAG avec des personnes et des lecteurs d’écran reste ouverte. [Déploiement](../deploy/README.md)

À 390 px, le champ de recherche passe de 309 à 196 px depuis le haut et la section des brèves de 888 à 697 px. Entre 320 et 1 920 px, le protocole de navigation local observe un CLS de 0 et 917 octets supplémentaires de CSS et JS décodés pour l’accueil. Ces mesures portent sur Chromium en laboratoire. Le benchmark concurrentiel conserve ses dates d’observation et les unités utilisées par chaque site. [Matrice concurrentielle](competitive-audit.md)

Le banc structuré valide 204 cas. La recette en langage naturel obtient 4 réponses entièrement conformes sur 5, avec deux appels médians. Le détail expose également l’échec, les citations, les durées et les jetons. [Banc documentaire](banc-documentaire-mcp.md)

L’archive locale compte 8 634 fichiers, 224 276 480 octets de TAR et 28 156 417 octets compressés. Le corpus JSON occupe 9 883 291 octets, avec 602 469 octets de marge sur son plafond. [Procédure de mesure](capacite-publication.md)

Les priorités documentaires restent la lecture intégrale des programmes et prises de parole, la comparaison des chiffrages indépendants et l’extension des cas de parité. La présence de 83 terrains n’établit aucune comparabilité entre hypothèses. La PWA, la distribution en anglais, le simulateur budgétaire national, la mesure terrain de la performance et l’évaluation agentique sur 1 000 questions restent à traiter.
