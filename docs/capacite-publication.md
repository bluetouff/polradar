# Capacité de publication

## Recette locale du 27 novembre 2026

L’archive du lot local sur la base `85ffdf8` utilise le transport partitionné. Le déployeur de recette a vérifié le manifeste et reconstitué l’export complet de 11 395 327 octets à partir de 18 partitions. Le plus grand membre du TAR est `api/recherche.json`. L’archive de données de 3 740 351 octets a été relue et rapprochée de ses 25 jeux annoncés.

| Plafond                   |  Occupation |      Limite |       Marge |
| ------------------------- | ----------: | ----------: | ----------: |
| Gzip, octets              |  33 999 131 |  67 108 864 |  33 109 733 |
| TAR, octets               | 271 882 240 | 536 870 912 | 264 988 672 |
| Membres                   |       9 715 |      20 000 |      10 285 |
| Plus grand membre, octets |   4 653 437 |  10 485 760 |   5 832 323 |

Le plus haut taux d’occupation est de 50,7 %. Les quatre plafonds laissent une réserve de croissance pour ce lot.

## Activation du 26 novembre 2026

Le déployeur installé sur Zen correspond à la révision `ac39a2fcb2ae14fad6a11234ae4bde592a0c4005`. Le service MCP 1.6.0 annonce la version 1 du transport du corpus. Une question sur la CSG a donné la même réponse et les mêmes références sur REST et MCP. GitHub Actions sélectionne le profil `partitioned` via `POLRADAR_SITE_TRANSPORT`. [Contrat public](https://polradar.fr/api/v1/corpus) · [Paquet du service](https://github.com/bluetouff/polradar/releases/tag/services-ac39a2fcb2ae14fad6a11234ae4bde592a0c4005)

Pour vérifier la première publication dans ce format, rapprocher la révision de `build.json` de celle du manifeste `/api/corpus-parts.json`, puis contrôler l’empreinte de `/api/corpus.json` après reconstitution. Le rapport `site-capacity.json` joint à la release indique les volumes occupés et les plafonds appliqués.

## Référence du 26 novembre 2026

L’archive de `867cd0601aa35c3dd18b62ef554cf76b2624b433` a été téléchargée, contrôlée par SHA-256 et extraite localement. La révision a aussi été vérifiée sur le site public et auprès du MCP 1.5.0. [Archive de l’édition](https://github.com/bluetouff/polradar/releases/tag/site-867cd0601aa35c3dd18b62ef554cf76b2624b433) · [Manifeste public](https://polradar.fr/build.json)

| Limite                       | Mesure publiée |     Plafond |      Marge |
| ---------------------------- | -------------: | ----------: | ---------: |
| Archive gzip, en octets      |     29 433 737 |  37 748 736 |  8 314 999 |
| TAR complet, en octets       |    225 904 640 | 268 435 456 | 42 530 816 |
| Nombre de fichiers           |          8 635 |      10 000 |      1 365 |
| Plus grand membre, en octets |      9 883 291 |  10 485 760 |    602 469 |

`api/corpus.json` occupe 94,3 % du plafond individuel. Ses propositions courantes représentent 3 570 893 octets et ses versions 4 248 775 octets, délimiteurs de champs compris. Les index de recherche publique et parlementaire occupent respectivement 4 033 292 et 4 146 988 octets.

Hors en-têtes TAR, le HTML représente 154 376 273 octets, le JSON 41 975 413, le XML 9 898 949, les images 7 771 189 et les SVG 4 343 228. Les pages de mesures représentent 68 040 425 octets de HTML et autres ressources sous `mesures/`. La déduplication exacte ne concernerait que 127 237 octets. Les descriptions, passages et versions restent nécessaires aux exports qui les contiennent.

## Transport partitionné

Le paquet accepte des fragments d’au plus 2 Mio, jusqu’à 128, répartis par collection du corpus. Chaque fragment est une plage d’octets de l’export. Le manifeste `api/corpus-parts.json` donne la révision, la collection, la position, la taille et l’empreinte de chaque plage. Un fragment sert au transport. L’URL historique et le contrat JSON v1 restent identiques.

Le déployeur contrôle l’inventaire et les empreintes pendant l’extraction. Il reconstitue le fichier dans le répertoire de préparation avec le SHA-256 annoncé par `build.json`. Le répertoire public contient le corpus reconstitué et son manifeste. Les fragments restent dans le TAR. Le fichier reconstitué a un plafond propre de 64 Mio. Sur l’archive actuelle, répartir les mêmes fichiers entre plusieurs TAR ajouterait des transferts et garderait un coût cumulé similaire.

| Profil                         |   Gzip | TAR décompressé | Membres | Par membre |
| ------------------------------ | -----: | --------------: | ------: | ---------: |
| Historique                     | 36 Mio |         256 Mio |  10 000 |     10 Mio |
| Partitionné, manifeste en tête | 64 Mio |         512 Mio |  20 000 |     10 Mio |

Le profil historique reste celui du paquet par défaut. En mode partitionné, le paquet place son manifeste en tête pour que le déployeur puisse vérifier sa forme et sa révision avant de retenir les plafonds adaptés. Ce choix est ensuite confirmé par la vérification complète de l’inventaire et des SHA-256. Les anciens paquets partitionnés gardent la même structure de données et passent sous les plafonds historiques.

Aux poids moyens mesurés sur les 9 094 membres du build `f3cbf49`, 20 000 membres représenteraient environ 495 Mio en TAR et 62 Mio en gzip. Cette projection motive l’enveloppe. Le déployeur borne le téléchargement, décompresse en blocs et réserve de l’espace sur le système de fichiers de publication. Le budget de préparation inclut le TAR temporaire et les blocs de la nouvelle édition. Les copies conservées pour restauration sont déjà comptées dans le disque occupé.

Go lit le format reconstitué en flux et décode les listes utilisées par le service. Les anciennes éditions gardent leur chemin de lecture et le plafond de 10 Mio. Si un nouveau corpus dépasse ce seuil, le déployeur vérifie la capacité du service avant la bascule et sa révision après. La vérification HTTPS et le retour à l’édition précédente utilisent le mécanisme existant. [Procédure d’exploitation](../deploy/README.md#activer-le-transport-partitionné)

Le rapport de construction signale 70 % en surveillance, 85 % en action préventive et 95 % en risque critique. La création du paquet bloque au plafond. Les vérifications d’extraction et d’intégrité restent présentes indépendamment de ces seuils.

## Recette isolée

```sh
python3 scripts/test-corpus-growth.py site.tar.gz --checksum site.sha256 \
  --revision 867cd0601aa35c3dd18b62ef554cf76b2624b433 --mcp
```

La recette conserve les pages, les index de recherche et les autres collections de référence. Elle multiplie uniquement les fiches et leurs versions, avec des identifiants distincts dans une copie temporaire. Le script vérifie les octets restitués et les nombres de fiches réellement chargées. Ce scénario mesure le corpus et son coût d’installation à pages constantes. La croissance du HTML, des index et du nombre de pages nécessite une mesure dédiée.

| Charge | Fiches | Versions | Corpus en octets | Gzip en octets | TAR en octets | Membres | Plages |
| ------ | -----: | -------: | ---------------: | -------------: | ------------: | ------: | -----: |
| 1×     |  4 370 |    4 628 |        9 883 291 |     29 750 308 |   225 925 120 |   8 652 |     17 |
| 2×     |  8 740 |    9 256 |       17 961 827 |     30 896 346 |   234 004 480 |   8 656 |     21 |
| 5×     | 21 850 |   23 140 |       42 197 435 |     34 333 945 |   258 242 560 |   8 667 |     32 |

Le plus grand membre de cette archive est l’index parlementaire, à 4 146 988 octets. Le TAR de la charge 5× atteint 96,2 % de l’enveloppe de 256 Mio utilisée lors de cette recette. Ses fichiers reconstitués occupent 251 587 979 octets de contenu, auxquels s’ajoutent le TAR temporaire et les éditions présentes sur le disque. Les clients de l’export complet continuent de recevoir le JSON complet.

Sur le poste macOS de recette, le packaging des trois charges a pris respectivement 8,83 s, 12,07 s et 13,27 s. L’extraction et les contrôles d’intégrité ont pris 4,33 s, 3,26 s et 4,26 s. Le chargement local de la charge 5× a pris 1,108 s et laissé 113 937 304 octets de tas vivant après une collecte Go. Cette mesure porte sur un instantané isolé avec `GOMEMLIMIT=136MiB`. Le RSS de Zen et la coexistence de deux éditions agrandies restent à mesurer.

Un second essai garde 4 370 fiches et porte l’historique à 23 140 versions. Le corpus reconstitué mesure 26 879 031 octets et son TAR 242 923 520 octets. Le service 1.6 le charge en 1,281 s dans la recette locale. Le service 1.5 signale le dépassement de son plafond individuel.

## Archive finale du lot local

L’archive a été construite avec les changements de l’espace de travail et le corpus de référence `867cd06`. Elle inclut le lecteur hors ligne et le relevé des relations documentaires. Le format partitionné restitue l’export de 9 883 291 octets, réparti en 17 fragments. Le plus grand membre du TAR reste l’index parlementaire.

| Plafond de publication    |  Occupation |      Limite |      Marge |
| ------------------------- | ----------: | ----------: | ---------: |
| Gzip, octets              |  28 680 804 |  37 748 736 |  9 067 932 |
| TAR, octets               | 227 276 800 | 268 435 456 | 41 158 656 |
| Membres                   |       8 664 |      10 000 |      1 336 |
| Plus grand membre, octets |   4 146 988 |  10 485 760 |  6 338 772 |

Le format historique de la même construction compte 8 647 membres, 227 256 320 octets de TAR et 28 674 085 octets de gzip. La copie partitionnée ajoute 17 membres nets et 20 480 octets de TAR pour préparer la croissance de l’export. Le changement de format relève de l’activation du déployeur.

## Recette du profil agrandi sur `f3cbf49`

L’archive historique locale de `f3cbf49` a été contrôlée par SHA-256. Elle contient 9 094 membres, 236 144 640 octets de TAR et 29 701 646 octets de gzip. Son export de 10 473 558 octets laisse 12 202 octets sous le plafond historique.

| Charge du corpus | Fiches | Versions | Corpus, octets | Gzip, octets | TAR, octets | Membres |
| ---------------- | -----: | -------: | -------------: | -----------: | ----------: | ------: |
| 1×               |  4 689 |    4 948 |     10 473 558 |   29 688 850 | 236 165 120 |   9 111 |
| 2×               |  9 378 |    9 896 |     19 111 698 |   30 917 742 | 244 797 440 |   9 115 |
| 5×               | 23 445 |   24 740 |     45 026 118 |   34 604 080 | 270 725 120 |   9 128 |

Ces trois archives gardent les pages et index d’origine. Chaque corpus a été restitué à l’octet près puis lu par le service Go. À 5×, les fichiers installés représentent 263 707 743 octets logiques, auxquels s’ajoutent le TAR temporaire et l’allocation du système de fichiers. Le plus grand membre reste l’index de recherche à 4 299 524 octets.

Un second paquet double également les 4 689 pages individuelles de fiches et les entrées de mesures dans l’index. Il contient 13 804 membres, 314 132 480 octets de TAR et 33 861 374 octets de gzip. L’index atteint 7 729 393 octets. Le packaging avec extraction de contrôle a pris 30,81 s et culminé à 182 370 304 octets de RSS sur le poste de recette macOS.

Une projection à 5× des mêmes pages et entrées donne au moins 27 884 membres, un index de 18 019 000 octets et environ 548 Mo de TAR avec son bourrage. Ces quantités dépassent les plafonds agrandis du nombre de membres, de la taille individuelle et du TAR. La projection exclut la croissance des autres pages et des paginations. La recette à 5× du corpus mesure un autre périmètre, à pages et index constants.

À 5×, un instantané a représenté 123 762 080 octets de tas Go vivant après collecte, avec `GOMEMLIMIT=136MiB`. Zen fixe aussi `MemoryMax=192M` pour le service. Deux instantanés de cette taille représenteraient environ 236 Mio de tas d’après la mesure d’un instantané. Le test de croissance porte sur le chargement local d’un seul instantané. Une rotation à cette échelle sous la limite systemd demande sa propre recette.
