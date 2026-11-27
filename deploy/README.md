# Publication sur Debian / Apache

## Principe

`push main` → contrôles GitHub Actions → version statique publique → récupération par le serveur toutes les cinq minutes → vérification → activation → test HTTPS local.

Le [relevé de capacité](../docs/capacite-publication.md) donne les mesures de l’archive publiée, le coût de la croissance documentaire et les contrôles du transport partitionné.

Aucun secret de serveur n’est stocké dans GitHub. Aucun runner GitHub n’entre sur le serveur. Le compte système récupère les deux fichiers d’une version publique, contrôle l’empreinte, le commit de `main`, le workflow `Site` réussi et le manifeste `build.json`. Les téléchargements et redirections restent limités à des domaines GitHub précis.

Le site ne reçoit ni dépôt Git, ni `node_modules`, ni outil de déploiement. Les archives n’acceptent que des fichiers statiques ordinaires, avec des limites de taille et de nombre. Le déploiement s’interrompt si un contrôle échoue.

Le résumé du job de publication indique la marge sur le gzip, le TAR, le nombre de membres et le plus grand membre. Les alertes de capacité utilisent les seuils de 70 %, 85 % et 95 %. Le paquet est bloqué au plafond. Les limites globales sont celles du déployeur installé.

## Installation initiale

L’opérateur vérifie la configuration Apache, le propriétaire des répertoires et les deux scripts avant installation. Le serveur doit disposer de Python 3.10+, curl, cron et d’un certificat HTTPS valide pour `polradar.fr`.

- Racine Apache : `/var/www/html/polradar`.
- Versions : `/var/www/html/.polradar-releases/<commit>`.
- Script, verrou et journaux : `~/.local/share/polradar/`, mode 0700.
- Sauvegarde du site initial : `~/.local/share/polradar/original-document-root`.

Le répertoire parent de la racine Apache et le dossier initial lui-même doivent être inscriptibles par le compte de déploiement, sans être ouverts aux autres comptes. Si ce dossier appartient à root, l’opérateur doit d’abord en transférer la propriété au compte du site, sans modification récursive. La sauvegarde et la racine doivent se trouver sur le même système de fichiers. Apache doit déjà autoriser le suivi des liens symboliques dans cette arborescence. L’installation ne modifie ni Apache, ni TLS, ni les permissions d’autres sites.

Copier `pull-release.py` et `install-user.py` dans un répertoire privé temporaire du compte de déploiement. Puis, après revue :

```sh
python3 install-user.py
python3 "$HOME/.local/share/polradar/pull-release.py"
```

L’installateur préserve les lignes existantes de la crontab. Au format historique, le déployeur accepte un TAR de 256 Mio décompressés, en-têtes et bourrage compris. L’archive gzip est limitée à 36 Mio, le nombre de fichiers à 10 000 et chaque fichier à 10 Mio. La décompression se fait par blocs dans un fichier temporaire privé. Pour mettre à jour le déployeur, exécuter `python3 -I install-user.py --update-only` depuis la copie privée des deux scripts vérifiés. Cette opération est indépendante des publications du site et se vérifie avec les tests `tests/deploy/`.

Au premier déploiement, le dossier d’origine est conservé dans le répertoire privé, puis remplacé par un lien vers la version validée. Aux suivants, le remplacement du lien est atomique. Le test local utilise HTTPS, le nom de domaine attendu et la vérification normale du certificat. Un échec restaure le dossier ou le lien précédent.

## Vérifier la publication

```sh
curl --fail https://polradar.fr/build.json
curl --fail --head https://polradar.fr/
```

Comparer `sourceCommit` avec `main` et avec la version GitHub. Vérifier aussi une page de candidature, une fiche et le comparateur dans le navigateur. Une exécution Actions réussie peut précéder la récupération par cron.

## Activer le transport partitionné

Le paquet garde son format historique par défaut. La recette locale utilise `python3 scripts/package-release.py --format partitioned` après la construction. Le document public `/api/corpus.json` garde ses octets et sa structure. Le manifeste additionnel `/api/corpus-parts.json` décrit les plages de l’export.

L’opérateur met à jour le déployeur avec `install-user.py --update-only` et suit la procédure de publication du service compatible. La réponse publique à `GET /api/v1/corpus` doit annoncer `donnees.versionTransportCorpus` à `1`. L’activation du format passe ensuite par la variable GitHub Actions `POLRADAR_SITE_TRANSPORT`, avec la valeur `partitioned`. Une nouvelle publication produit l’archive du format choisi à la révision validée.

Le nouveau paquet partitionné ouvre une enveloppe de 64 Mio gzip, 512 Mio TAR et 20 000 membres. Le manifeste de transport en tête du TAR est contrôlé avant de retenir ce profil. Les anciens paquets, y compris les archives partitionnées sans manifeste en tête, passent avec leur enveloppe historique. Chaque membre reste limité à 10 Mio et le corpus reconstitué à 64 Mio. Dès que ce corpus dépasse 10 Mio, le déployeur exige un service compatible lisant l’édition courante avant la bascule. Il vérifie ensuite que le service lit la nouvelle révision. Un échec rétablit le lien précédent.

Le TAR temporaire et la nouvelle édition sont préparés sur le système de fichiers de publication. La décompression utilise au maximum la moitié de l’espace disponible initialement. Puis l’inventaire permet d’estimer les blocs nécessaires à la nouvelle édition, dont le corpus reconstitué. L’espace disponible tient déjà compte des éditions conservées pour retour arrière. Une archive proche du plafond peut nécessiter environ 1 Gio encore libre pendant la préparation. [Mesures de capacité](../docs/capacite-publication.md)

## Retour arrière

Pour une correction ordinaire, restaurer le contenu souhaité dans Git puis publier un nouveau commit de `main`. Cette méthode conserve l’historique et utilise les contrôles habituels.

En incident, désactiver la seule ligne `# polradar-public-deploy` dans `crontab -e` avant une restauration manuelle. L’opérateur peut rétablir par remplacement atomique le lien vers l’une des versions conservées pour retour arrière. Le dossier initial reste disponible dans la sauvegarde privée. Ne pas copier aveuglément une archive dans la racine active.

## Exploitation et réglages Apache

Après une bascule validée par les contrôles HTTPS, le déployeur conserve la version active et les deux dernières versions locales déployées avec succès. Sous le même verrou, il examine les copies plus anciennes. Il supprime une copie seulement si le tag GitHub pointe sur son commit et si les empreintes SHA-256 publiées par GitHub concordent avec le fichier `site.sha256` de cette version. Les copies non vérifiables sont conservées. Si deux versions de retour arrière sont indisponibles, la purge est reportée au prochain déploiement réussi. Les décisions figurent dans `deploy.log`.

La configuration actuelle utilise `AllowOverride None`. Le site n’essaie pas de contourner ce réglage avec un `.htaccess`. La CSP est construite dans chaque document HTML. Les en-têtes Apache existants (HSTS, `nosniff`, protection de l’intégration en frame et restrictions de permissions) doivent être préservés.

Pour une évolution d’exploitation, l’opérateur peut faire appliquer dans le vhost HTTPS, après revue et test `apache2ctl configtest`, un `ErrorDocument 404 /404.html`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` et `Content-Security-Policy: frame-ancestors 'none'`. Cette dernière politique d’en-tête complète la CSP du document. Les ressources `_astro` identifiées par leur contenu peuvent recevoir un cache immuable, tandis que HTML, JSON et XML doivent être revalidés.

Ces réglages privilégiés ne sont pas appliqués par le déployeur. Ils ne sont pas nécessaires à la récupération des nouvelles versions.
