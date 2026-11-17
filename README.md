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

- `src/data/` : candidatures, thèmes, engagements, sources, chronologie et chiffres publics.
- `src/content/articles/` : décryptages Markdown avec métadonnées validées.
- `src/pages/` : pages et routes statiques.
- `src/lib/schema.mjs` : validation des types, références et invariants.
- `deploy/` : récupération et activation des versions publiques sur le serveur.

Le corpus initial comprend 12 candidatures sélectionnées, 12 thèmes et 69 fiches, archives 2022 comprises. Il ne représente pas une liste officielle exhaustive. Chaque référence conserve sa propre date de consultation. Une absence de fiche signifie que le sujet reste à documenter dans ce corpus.

Les données d’opinion ne sont publiées qu’avec leurs notices, leurs scénarios et leurs dates de terrain. Le registre est initialement vide. Les fonctionnalités de temps de parole, de financement et de résultats territoriaux demandent encore leur intégration documentaire.

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
