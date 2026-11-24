# Reprendre une édition de Polradar

Le [catalogue des jeux](https://polradar.fr/donnees/) indique l’unité, le producteur et les limites de chaque fichier. Son [équivalent DCAT](https://polradar.fr/api/catalogue-dcat.json) donne les URL stables. La [matrice des licences](https://polradar.fr/licences/) sépare les droits de la base, des œuvres originales et des pièces citées.

Le [catalogue JSON](https://polradar.fr/api/exports-v1.json) donne l’archive attachée à une révision Git, sa date d’édition et la liste des jeux. Une archive contient un manifeste avec la révision et l’empreinte SHA-256 de chaque fichier, les définitions exposées par chaque jeu, ainsi que les licences et la notice de réutilisation. Le fichier `corpus-v1.sha256` de la même release permet de vérifier le téléchargement avec `sha256sum -c corpus-v1.sha256`.

## Préparer la fiche data.gouv.fr

Après le build, `node scripts/preparer-datagouv.mjs` génère le descriptif de l’index documentaire original. Le brouillon cite l’URL actualisée et le fichier exact dans l’archive de l’édition. La publication sur le portail relève du compte de l’éditeur. Son [guide de publication](https://guides.data.gouv.fr/jeux-de-donnees) décrit les champs et les ressources distantes.

Pour le registre parlementaire, les scrutins et positions sont fournis par l’Assemblée nationale sous sa [Licence ouverte](https://data.assemblee-nationale.fr/licence-ouverte-open-licence). Pour les sondages, marches, séries économiques et textes de droit, conserver le producteur et ses conditions pour chaque donnée reprise.
