# Reprendre une édition de Polradar

Le [catalogue des jeux](https://polradar.fr/donnees/) indique l’unité, le producteur et les limites de chaque fichier. Son [équivalent DCAT](https://polradar.fr/api/catalogue-dcat.json) donne les URL stables. La [matrice des licences](https://polradar.fr/licences/) sépare les droits de la base, des œuvres originales et des pièces citées.

Le [catalogue JSON](https://polradar.fr/api/exports-v1.json) donne l’archive attachée à une révision Git, sa date d’édition et la liste des jeux. Une archive contient un manifeste avec la révision et l’empreinte SHA-256 de chaque fichier, les définitions exposées par chaque jeu, ainsi que les licences et la notice de réutilisation. Le fichier `corpus-v1.sha256` de la même release permet de vérifier le téléchargement avec `sha256sum -c corpus-v1.sha256`.

## Lire une fiche hors connexion

« Garder hors ligne » enregistre le titre, l’auteur affiché, le résumé et les références de la fiche choisie sur cet appareil. Une nouvelle sauvegarde remplace la précédente après réussite. La copie indique la date et la révision de l’édition, la version de la fiche et l’heure d’enregistrement. Le lecteur peut être rouvert depuis son adresse directe ou depuis le raccourci du manifeste dans les lanceurs qui le proposent. Le reste du site demande une connexion.

La copie est limitée à une fiche et à 48 Kio. Sa lecture vérifie son empreinte SHA-256 enregistrée sur cet appareil. Le worker v1 sert uniquement la page, le script et le style du lecteur, dans un cache limité à 64 Kio. La première sauvegarde déclenche son installation. « Effacer la copie et le cache » retire le contenu, le cache du lecteur et l’enregistrement du worker. Les préférences de « Mon suivi » ont leurs propres commandes locales.

## Préparer la fiche data.gouv.fr

L’index documentaire de Polradar est publié avec la licence ODbL 1.0. Les deux ressources de la fiche pointent vers le JSON actualisé et la documentation publique. [Fiche data.gouv.fr](https://www.data.gouv.fr/datasets/presidentielle-francaise-de-2027-index-documentaire-de-polradar)

Chaque nouvelle release fournit `datagouv-documents.json` à côté de l’archive du corpus. Après le build, `node scripts/preparer-datagouv.mjs` produit le même fichier localement. La préparation et la livraison sur GitHub fonctionnent sans compte data.gouv.fr.

1. Rechercher « Polradar » dans le catalogue du portail et reprendre la fiche de l’index si elle existe déjà. Les champs de `dataset` donnent le titre, la description, les mots-clés et la licence `odc-odbl`. L’index est enrichi quand de nouvelles références sont examinées, d’où la fréquence `irregular`. [Catalogue data.gouv.fr](https://www.data.gouv.fr/api/1/datasets/?q=polradar)
2. Renseigner les deux entrées de `resources` comme ressources distantes. La première pointe vers le JSON actualisé, la seconde vers la documentation lisible. Le téléchargement conserve la même adresse au fil des éditions. [Guide de publication](https://guides.data.gouv.fr/jeux-de-donnees/publier-un-jeu-de-donnees)
3. Utiliser `edition` pour contrôler une version précise. Vérifier `corpus-v1.sha256` avant de lire `api/documents.json` dans l’archive. L’empreinte `edition.sha256` porte sur ce seul fichier. Le nombre de références et la révision sont ceux de cette édition.

La fiche de portail couvre l’index documentaire original. L’archive complète citée dans sa description rassemble aussi des scrutins, séries économiques et autres jeux soumis aux conditions de leurs producteurs. Les droits sont détaillés par jeu dans le [catalogue DCAT](https://polradar.fr/api/catalogue-dcat.json). Les champs du jeu et des ressources correspondent au [contrat public de l’API data.gouv.fr](https://www.data.gouv.fr/api/1/swagger.json).

Pour le registre parlementaire, les scrutins et positions sont fournis par l’Assemblée nationale sous sa [Licence ouverte](https://data.assemblee-nationale.fr/licence-ouverte-open-licence). Les exports complets du [Sénat](https://polradar.fr/api/parlement/archives/senat.json) et du [Parlement européen](https://polradar.fr/api/parlement/archives/parlement-europeen.json) donnent les séances examinées, les personnes présentes dans les relevés et les droits du producteur. Pour les sondages, marchés, séries économiques et textes de droit, conserver le producteur et ses conditions pour chaque donnée reprise.
