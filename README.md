# Polradar

Observatoire indépendant et documenté de la présidentielle française de 2027. Site Astro statique, sans publicité, compte utilisateur, police distante ou outil de suivi.

[Le site](https://polradar.fr/) · [La méthode](https://polradar.fr/methode/) · [Les sources](https://polradar.fr/sources/)

## Développer

Node 24 LTS et Python 3.10 ou supérieur. Les versions npm sont figées dans le verrou.

```sh
npm ci --ignore-scripts
npm run dev
```

```sh
npm run validate
npx --no-install playwright install chromium
npm run test:e2e
npm run security:audit
```

`npm run build` construit les pages et contrôle les liens internes, les ressources locales et la présence de la CSP. Les tests couvrent les données, le comparateur, le mobile et les archives de livraison malveillantes.

## Contenus

- `src/data/` : candidatures, thèmes, fiches thématiques initiales, mesures, versions intégrales, sondages, relevés de veille et chiffres publics.
- `src/content/articles/` : décryptages Markdown avec métadonnées validées.
- `src/pages/` : pages et routes statiques.
- `src/lib/schema.mjs` : validation des types, références et invariants.
- `deploy/` : récupération et activation des versions publiques sur le serveur.

Le corpus comprend 33 candidatures recensées, 12 thèmes et 335 fiches de mesures ou orientations, dont 9 archives de 2022. Les 69 fiches thématiques initiales conservent leurs adresses ; le registre en comprend désormais 131. Les 362 versions sont des états du contenu Polradar : les enrichissements éditoriaux sont distingués des évolutions de programme. Il ne s’agit pas d’une liste officielle exhaustive. Chaque référence conserve sa propre date de consultation.

Le registre de sondages contient 36 relevés de scénarios, regroupés en 30 séries compatibles sur neuf vagues, provenant de sept instituts : Elabe, Ifop, Ipsos BVA, Odoxa, Cluster17, OpinionWay et Toluna Harris Interactive. Les notices de la Commission des sondages documentent les terrains, échantillons et méthodes. Pour Odoxa, les résultats sont liés séparément à la publication de l’institut. Chaque courbe conserve le même institut, tour, méthode et liste de candidatures. Les effectifs utiles inconnus restent à `null`. Les bases des non-exprimés et les marges indicatives sont précisées dans chaque fiche. Les comptes de campagne et les résultats territoriaux restent à intégrer.

Les vues `/temps-de-parole/`, `/budget-programmes/` et `/agenda/` proposent les relevés Arcom de juillet à septembre 2026 (24 médias), 26 montants annoncés pour 13 profils et 25 rendez-vous officiels couvrant 15 profils dans 19 communes. Elles conservent les périodes, les données absentes et les sources. La collecte Arcom accompagne la veille quotidienne et produit un artefact à examiner ; elle ne publie pas de données automatiquement. Voir [la méthode et les commandes de mise à jour](docs/visualisations.md).

La recherche à facettes et les exports CSV/JSON fonctionnent localement. Les paramètres de recherche sont dans le fragment de l’URL ; les termes ne partent pas dans les journaux HTTP. Le suivi facultatif utilise `localStorage`, sans compte ou synchronisation. Les flux `/rss/candidats/<id>.xml` et `/rss/themes/<id>.xml` restent utilisables indépendamment. Les dates connues seulement au jour ne reçoivent pas d’heure fictive dans le RSS. Les dates de publication, de mise à jour du document et de consultation sont distinctes.

La relecture du 17 novembre 2026 renseigne notamment les dossiers de Dupont-Aignan, Egger, Kazib, Labib, Mikolajczak et Philippot, et complète Ruffin avec les cahiers industrie, éducation, numérique et jeunesse. Les discours de Roussel conservent leur millésime ; les projets collectifs restent attribués aux partis. Les archives 2022 ne sont pas reconduites en programmes actuels. Les anciennes versions restent inchangées. Les candidatures sans document de programme intégré restent indiquées comme telles.

La chronologie rassemble 26 événements datés, avec des catégories, une recherche et des filtres par personnalité. Chaque entrée distingue événement, publication et mise à jour de document. Une vague de sondage forme un seul événement, quel que soit son nombre de scénarios.

La présentation utilise la police Archivo, servie localement depuis `src/assets/fonts/` sous licence SIL OFL 1.1. Le reste du projet conserve sa licence MIT. La home présente les volumes de fiches par thème, une série de sondages compatible et les relevés distincts des deux marchés ; l’annuaire des 33 profils est disposé en colonnes sans étirer les autres blocs.

La galerie des candidatures présente 24 portraits réels avec attribution et conditions de réutilisation sur `/credits-photos/`. Les images sont conservées localement et optimisées par Astro lorsque leurs conditions le permettent. Le JPEG de campagne de Benoît Mathieu est servi sans réencodage ; aucun hébergeur d’images n’est appelé par le navigateur. Les portraits plus anciens conservent leur année. Les autorisations propres au Parlement européen et au portrait officiel de Benoît Mathieu sont distinguées des licences Creative Commons ; elles sont limitées aux fichiers vérifiés. Les candidatures sans portrait qualifié restent affichées avec leur nom. Le filtre par thème indique les fiches disponibles dans le corpus, sans supprimer les dossiers encore à documenter.

La carte `/divergences/` rapproche quatre paramètres chiffrés du corpus : âge général de départ, durée de cotisation, SMIC mensuel net et seuil d’exonération annoncé pour les héritages. Les conditions et sources restent visibles sous chaque graphique. Les clés `age-depart` et `age-retraite` désignent la cible générale ; l’âge de pénibilité et celui du taux plein restent séparés. Le SMIC compare uniquement les montants mensuels nets renseignés dans les données structurées, sans convertir les montants bruts. Les graphiques excluent les archives et refusent les unités ou valeurs contradictoires. Ils ne produisent pas de score politique. Les thèmes, fiches et sources restent consultables sans JavaScript.

## Marchés prédictifs

La page `/marches-predictifs/` présente les contrats actifs sur le vainqueur de la prochaine présidentielle française, depuis les API publiques Polymarket et Kalshi. Les données sont des relevés statiques datés, sans appel à ces plateformes dans le navigateur, sans clé et sans fonction de transaction. Les noms des contrats ne constituent pas une liste de candidatures déclarées.

```sh
python3 scripts/collect-markets.py
```

La sortie par défaut est `artifacts/markets-review.json`. Relire les règles, les dates, les carnets et les unités avant de préparer un relevé pour le site :

```sh
python3 scripts/collect-markets.py --publish-snapshot
npm run validate
npm run test:e2e
```

Cette option écrit `src/data/prediction-markets.json` ; elle ne pousse pas Git. Un échec produit un état indisponible, sans reprendre un ancien prix avec un nouvel horodatage. Le script réutilise le transport HTTPS borné de la veille et ne contacte que deux hôtes fixes. Les prix sont les milieux des meilleures offres achat/vente disponibles, sans renormalisation ni moyenne entre plateformes. Un carnet incomplet reste inconnu. Les volumes Polymarket sont en dollars et ceux de Kalshi en contrats. L’API statique `/api/marches-predictifs.json` conserve les valeurs, règles et horodatages du relevé. Une mention signale les relevés de plus de six heures.

## Veille et historique

Le workflow `watch.yml` est programmé chaque jour à 05:23 UTC (exécution pouvant être retardée par GitHub). Il produit un rapport à relire, conservé 14 jours, sans accès en écriture au dépôt. Il ne modifie pas les programmes. Les références PCF utilisent deux PDF officiels et la captation publiée sur la chaîne YouTube du parti. Le relevé de la captation lit les métadonnées officielles oEmbed, sans exécuter ni intégrer le lecteur externe. Il vérifie l’existence de la vidéo et les changements de titre ou de chaîne ; il ne compare pas le son et les images. Le lien du texte national publié le 15 septembre est conservé comme référence précédente de la captation du 12 septembre. Les reprises sur les erreurs HTTP transitoires restent bornées et la vérification TLS est maintenue. Le site affiche le dernier relevé intégré, avec sa date effective ; le lien vers Actions donne accès aux exécutions suivantes.

```sh
python3 scripts/watch-sources.py
```

Le rapport est écrit dans `artifacts/watch-report.json` et `artifacts/watch-report.md`. Le script limite les destinations aux hôtes des sources déclarées, contrôle les IP publiques à chaque redirection, conserve HTTPS et la validation des certificats, borne les téléchargements et n’exécute aucun contenu distant. Une requête à la fois est autorisée par hébergeur, avec une seconde d’espacement et trois tentatives au maximum pour les erreurs temporaires. Les échecs persistants restent visibles. Les pages de Ruffin et de Nouvelle Énergie contenant des compteurs de soutiens ou d’adhérents sont conservées comme références mais exclues de la veille (`watch: false`) ; les cahiers et les pages thématiques sont surveillés.

Les trois références PCF utilisent deux PDF hébergés par le compte officiel du parti et sa vidéo officielle. La republication Haute-Savoie en HTTP 429 est remplacée. `previousUrl` conserve les anciennes adresses ; `watchContentClass` limite l’empreinte au texte de l’article pour exclure les autres billets et les éléments de page. Le tract de Selma Labib, de 6,9 Mo, reste consultable mais hors téléchargement automatique limité à 3 Mio.

Pour les premières mesures d’Anasse Kazib, la veille compare le corps de l’article officiel (`parrafos`). Les articles associés et leur ordre sont exclus. L’ordre et le texte des paragraphes du programme restent comparés : une modification, un ajout ou un retrait produit un signalement. Si le conteneur attendu disparaît ou devient incomplet, la source est signalée comme non exploitable. La veille planifiée reste quotidienne ; aucun relevé complet n’est déclenché à chaque push.

Pour intégrer un relevé : relire les liens et états du rapport, vérifier les changements dans les documents originaux, puis copier le JSON validé vers `src/data/watch.json`. Une indisponibilité reste affichée comme telle. Pour mettre à jour une mesure, conserver toutes les entrées de `versions.json`, ajouter la nouvelle version complète puis synchroniser `measures.json` et son numéro `revision`. La CI compare les anciennes versions avec la base Git et refuse leur réécriture. `node scripts/check-history.mjs` fait ce contrôle localement contre `HEAD`.

## Mettre à jour le site

1. Modifier les contenus ou le code dans une branche et ouvrir une pull request.
2. Faire passer les contrôles `Validate`, relire les sources et fusionner dans `main`.
3. GitHub Actions construit le site et publie une version `site-<commit>` accompagnée de son empreinte SHA-256.
4. Le serveur récupère les nouvelles versions toutes les cinq minutes et active uniquement un commit de `main` dont le workflow a réussi.

Le serveur ne construit pas de code npm. GitHub ne possède ni accès SSH ni secret de déploiement. Les pull requests ne peuvent pas publier de version. Une livraison rejetée conserve la version précédente. Le mécanisme est détaillé dans [deploy/README.md](deploy/README.md).

Le fichier public [`build.json`](https://polradar.fr/build.json) permet de comparer le commit servi avec le dépôt. Une compilation réussie n’établit pas à elle seule que le site a été mis à jour.

## Contribuer et signaler un problème

Voir [CONTRIBUTING.md](CONTRIBUTING.md) et [SECURITY.md](SECURITY.md). Les corrections éditoriales doivent contenir une source et préserver le millésime des documents.

## Licence

[MIT](LICENSE), pour le code et les contenus originaux du projet. Les documents de tiers cités, les noms et les marques restent soumis à leurs propres droits. La licence du dépôt ne les relicencie pas.
