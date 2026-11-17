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

Le corpus comprend 12 candidatures sélectionnées, 12 thèmes et 209 fiches de mesures ou orientations, dont 9 archives de 2022. Les 69 fiches thématiques initiales conservent leurs adresses ; le registre en comprend désormais 85. Les 236 versions sont des états du contenu Polradar : les enrichissements éditoriaux sont distingués des évolutions de programme. Il ne s’agit pas d’une liste officielle exhaustive. Chaque référence conserve sa propre date de consultation.

Le registre de sondages contient trois vagues Elabe (août, octobre et novembre 2026), chacune avec trois scénarios, vérifiées dans les notices de la Commission des sondages. Chaque courbe conserve le même institut, tour, méthode et liste de candidatures. Les effectifs utiles inconnus restent nuls (`null`), sans fabrication. Le premier périmètre ne couvre qu’un institut. Le temps de parole, le financement et les résultats territoriaux restent à intégrer.

La recherche à facettes et les exports CSV/JSON fonctionnent localement. Les paramètres de recherche sont dans le fragment de l’URL ; les termes ne partent pas dans les journaux HTTP. Le suivi facultatif utilise `localStorage`, sans compte ou synchronisation. Les flux `/rss/candidats/<id>.xml` et `/rss/themes/<id>.xml` restent utilisables indépendamment. Les dates connues seulement au jour ne reçoivent pas d’heure fictive dans le RSS. Les dates de publication, de mise à jour du document et de consultation sont distinctes.

La relecture du 17 novembre 2026 ajoute 110 fiches réparties sur neuf dossiers. Les discours de Roussel conservent leur millésime, les propositions de Nouvelle Énergie restent attribuées au parti et les déclarations récentes de Zemmour sont marquées comme orientations. Le programme 2027 de l’UPR est encore annoncé en préparation sur son site ; ses archives ne sont pas reconduites. Les anciens snapshots restent inchangés.

## Veille et historique

Le workflow `watch.yml` est programmé chaque jour à 05:23 UTC (exécution pouvant être retardée par GitHub). Il produit un rapport à relire, conservé 14 jours, sans accès en écriture au dépôt. Il ne modifie pas les programmes. Le site affiche le dernier relevé intégré, avec sa date effective ; le lien vers Actions donne accès aux exécutions suivantes.

```sh
python3 scripts/watch-sources.py
```

Le rapport est écrit dans `artifacts/watch-report.json` et `artifacts/watch-report.md`. Le script limite les destinations aux hôtes des sources déclarées, contrôle les IP publiques à chaque redirection, conserve HTTPS et la validation des certificats, borne les téléchargements et n’exécute aucun contenu distant. Une requête à la fois est autorisée par hébergeur, avec une seconde d’espacement et trois tentatives au maximum pour les erreurs temporaires. Les échecs persistants restent visibles. Les pages de Ruffin et de Nouvelle Énergie contenant des compteurs de soutiens ou d’adhérents sont conservées comme références mais exclues de la veille (`watch: false`) ; les cahiers et les pages thématiques sont surveillés.

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
