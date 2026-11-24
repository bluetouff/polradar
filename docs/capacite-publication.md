# Capacité de publication

L’archive publiée pour la révision `33468582042c32b1130c99ad97d24d317ad07711`, servie le 24 novembre 2026, a été téléchargée avec son fichier SHA-256. Le déployeur l’a extraite dans un répertoire de recette et a retrouvé la révision attendue. Le rapport de compilation reprend désormais les quatre limites du déployeur.

| Limite                        |     Utilisé |     Plafond |              Marge |
| ----------------------------- | ----------: | ----------: | -----------------: |
| Archive gzip                  |  18 492 163 |  25 165 824 | 6 673 661 (26,5 %) |
| TAR complet                   | 127 098 880 | 134 217 728 |  7 118 848 (5,3 %) |
| Nombre de fichiers            |       5 563 |       6 000 |        437 (7,3 %) |
| Plus grand fichier individuel |   4 942 675 |  10 485 760 | 5 543 085 (52,9 %) |

Les tailles sont en octets. Le TAR inclut les en-têtes et le remplissage. Le plus gros fichier est `api/corpus.json`. Les pages de mesures occupent 31 981 923 octets hors en-têtes, les exports `api/` 19 919 512, les pages de votes 8 879 188 et les pages de documents 8 401 395. [Archive GitHub de l’édition](https://github.com/bluetouff/polradar/releases/tag/site-33468582042c32b1130c99ad97d24d317ad07711)

```sh
python3 scripts/release_capacity.py site.tar.gz --checksum site.sha256 \
  --revision 33468582042c32b1130c99ad97d24d317ad07711
```

## Séparation des données et des pages

Deux TAR de recette ont été reconstitués à partir des mêmes fichiers, au même format USTAR. Le lot `api/` occupe 20 039 680 octets de TAR et 151 fichiers. Le lot des autres chemins occupe 107 069 440 octets et 5 412 fichiers. Les deux lots gzip totalisent 18 670 565 octets. Séparer ces lots libérerait environ 20,2 % de la limite TAR pour le lot de pages. L’espace disque cumulé et le nombre total de fichiers resteraient du même ordre. En particulier, le lot de pages conserverait seulement 588 fichiers de marge s’il gardait le plafond actuel de 6 000 fichiers.

Le format étudié lie les deux empreintes et les deux inventaires à la même révision. Le déployeur téléchargerait les lots dans un répertoire temporaire, vérifierait leurs tailles, empreintes et chemins, puis refuserait tout chemin dupliqué. Le contrôle du site, du contrat de données et du corpus précéderait une seule bascule atomique. Les URL de lecture et l’ancienne édition resteraient disponibles durant la bascule. L’activation de ce format demanderait une recette du disque de Zen avec l’ancienne et la nouvelle édition simultanées, ainsi que des tests de lot manquant, d’empreinte erronée, de révision divergente et de retour arrière. La publication actuelle garde le format à une archive.
