# Qualité et fraîcheur des données

## Attribuer une proposition

Le champ `candidate` rattache une fiche à un dossier. La nature du document distingue campagne, projet de parti, orientation et archive. Pour un projet de parti, Polradar conserve d’abord la signature explicite de la fiche. À défaut, il utilise la signature vérifiée des documents cités si tous concordent. Une tribune signée porte le nom de son auteur. Quand les pièces divergent ou que la signature manque, le lecteur voit « Document de parti » et peut consulter les références. L’appartenance politique et l’hébergeur d’une page ne suffisent pas à identifier un auteur. [Registre avec passages et dates](src/data/document-authors.json) · [Résolution](src/lib/attribution.mjs)

Dans `/api/corpus.json`, les mesures et engagements exposent `displayAuthor`, en plus du dossier `candidate` et du champ éditorial `partyAuthor` lorsqu’il existe. Les instantanés conservent leurs champs d’origine. L’export de recherche JSON fournit `author` pour les mesures. Le CSV garde les six colonnes existantes et ajoute « Auteur du document ». [Corpus](https://polradar.fr/api/corpus.json) · [Recherche et export](https://polradar.fr/recherche/)

## Dates et dénominateurs

| Objet                         | Ce que le lecteur doit pouvoir vérifier                                                                                                                                                                                                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mesure, discours, rendez-vous | La date de déclaration, la publication du document, sa consultation et l’ajout à Polradar ont des significations propres. Respecter l’année seule ou l’absence de date. Un événement annoncé garde ce statut jusqu’à confirmation.                                                          |
| Version                       | Conserver le document et le passage précis. Une nouvelle formulation par la rédaction, une référence corrigée et un changement annoncé par un candidat ont des catégories distinctes.                                                                                                       |
| Sondage                       | Afficher terrain, institut, commanditaire, tour, liste testée, base, effectif interrogé et effectif utile quand connu. Distinguer vague, scénario et notice. Conserver un résultat inférieur au seuil ou non publié sous sa forme d’origine. Le libellé exact fait foi dans la notice liée. |
| Indicateur et financement     | Associer valeur, unité, période, fréquence et statut du producteur. Un point absent crée une rupture. Un contre-budget, un coût de programme, une dépense constatée et un prix de contrat restent des objets distincts.                                                                     |
| Vote                          | Vérifier le mandat de l’élu au jour du scrutin, la chambre, le numéro, le texte, le stade et le vote nominatif. Conserver la différence entre abstention, absence de vote personnel et adoption sans scrutin. L’interprétation est éditoriale.                                              |
| Intégration de graphique      | La copie figée contient les octets du SVG et les références. L’image actualisée reprend la dernière donnée publiée pour la même série. Publier la période du fournisseur et donner accès à la source.                                                                                       |

## Lire le journal quotidien

Le contrôle automatisé des publications de programmes, sondages, marchés, séries Eurostat et relevés Arcom est programmé à **05 h 23 UTC**. La revue éditoriale est programmée à **18 h, heure de Paris**. Le journal donne l’heure effective. Les producteurs ont leurs propres fréquences de publication. Un relevé mensuel reste mensuel même si Polradar le contrôle chaque jour. [Journal public](https://polradar.fr/mises-a-jour/) · [Collecte structurée](.github/workflows/watch.yml) · [Veille éditoriale](.github/workflows/editorial.yml)

Le 22 novembre 2026, la veille structurée a relevé 139 sources accessibles sans changement, 12 modifiées, 5 bloquées et 2 indisponibles. La revue éditoriale hébergée a exécuté 43 recherches sur 33 candidatures et dix rubriques. Elle a relevé trois publications et intégré zéro changement par ce passage. La découverte d’une URL déclenche une revue quand la signification du changement demande une lecture. Les sources hors sélection gardent leur propre date de consultation.

## Contrôles de livraison

1. Exécuter le formatage de contrôle, `npm run check` et `npm test`. Les schémas vérifient dates civiles, références, instantanés, unités et cohérence entre les objets.
2. Exécuter `npm run build` et `npm run test:e2e`. Vérifier le HTML, la navigation clavier, la petite largeur, les filtres, les flux, les liens locaux, les exports et les cas sans JavaScript.
3. Exécuter `npm run security:audit`. Examiner les modifications, les fichiers inclus et les trois limites de l’archive. Les contrôles de publication lient l’artefact à sa révision.
4. Après un push autorisé, comparer `main`, le workflow, le SHA de la release et le marqueur servi. Ouvrir ensuite une fiche et un graphique concernés. Un contrôle de liens sortants décrit les URL et la date effectivement testées. [Marqueur public](https://polradar.fr/build.json)

Le relevé du 23 novembre identifie chaque terrain dans la notice méthodologique des instituts. Les deux tours et les variantes de candidatures d’un même échantillon partagent `surveyId`. Une observation sans terrain identifié reste incluse dans les résultats et dans `observationsWithoutSurvey`. Le nombre de notices dénombre les documents distincts cités, même quand plusieurs décrivent un même recueil. La date de vérification d’une mesure est attachée à la fiche. La date de consultation est attachée à chaque document. Le marqueur `/build.json` donne la construction technique en UTC.

Au 23 novembre 2026, la rédaction a relu les 14 notices utilisées par les 64 observations et le rapport de résultats Odoxa. La question et sa base figurent pour chaque observation avec la page du questionnaire ou des résultats. La collecte suivante marquera toute nouvelle formulation « à relire ». Un point dont le libellé est inconnu reste visible seul. Une ponctuation différente ne sépare pas la série. Une équivalence de sens doit être explicitement motivée dans les deux observations. Une autre population, base ou hypothèse reste distincte.

Les 58 adresses SVG actualisées publiées avant la relecture ont un registre de migration. Une adresse conserve son périmètre quand la comparaison est confirmée. En cas de scission ultérieure, elle revient à sa dernière observation historique et les nouveaux périmètres reçoivent de nouvelles adresses. Les SVG figés déjà distribués gardent leur contenu et leur empreinte. [Registre des séries publiées](src/data/poll-graphic-migration.json)

## Relations budgétaires et couverture documentaire

La relation d’un montant avec une mesure vise une version publiée et un passage de la pièce budgétaire. Le validateur exige une référence commune et refuse les versions inconnues, les doublons et les postes de ventilation absents du document. La lecture éditoriale établit que les deux passages portent sur la même action. Le chiffrage conserve sa devise, sa période et ses hypothèses. Les postes peuvent être inclus dans une même enveloppe. Les montants portés sur une fiche et les montants du registre ne s’additionnent pas.

La matrice distingue les textes signés, les orientations, les textes collectifs et les cas où le document consulté ne livre aucune réponse à la question. La première comparaison sur six dossiers consigne les sources et le périmètre de recherche de chaque cellule. Le statut d’annonce passée dans l’agenda appelle une confirmation de tenue. Dans la revue de veille, un lien de découverte ou de recherche demande une lecture de l’original avant toute attribution. [Méthode du pilote](docs/audit-concurrence-2026-11-20.md#pilote-documentaire-du-23-novembre-2026)
