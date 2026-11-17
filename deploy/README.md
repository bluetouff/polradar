# Publication sur Debian / Apache

## Principe

`push main` → contrôles GitHub Actions → version statique publique → récupération par le serveur toutes les cinq minutes → vérification → activation → test HTTPS local.

Aucun secret de serveur n’est stocké dans GitHub. Aucun runner GitHub n’entre sur le serveur. Le compte système récupère les deux fichiers d’une version publique, contrôle l’empreinte, le commit de `main`, le workflow `Site` réussi et le manifeste `build.json`. Les téléchargements et redirections restent limités à des domaines GitHub précis.

Le site ne reçoit ni dépôt Git, ni `node_modules`, ni outil de déploiement. Les archives n’acceptent que des fichiers statiques ordinaires, avec des limites de taille et de nombre. Le déploiement s’interrompt si un contrôle échoue.

## Installation initiale

L’opérateur vérifie la configuration Apache, le propriétaire des répertoires et les deux scripts avant installation. Le serveur doit disposer de Python 3.10+, curl, cron et d’un certificat HTTPS valide pour `polradar.fr`.

- Racine Apache : `/var/www/html/polradar`.
- Versions : `/var/www/html/.polradar-releases/<commit>`.
- Script, verrou et journaux : `~/.local/share/polradar/`, mode 0700.
- Sauvegarde du site initial : `~/.local/share/polradar/original-document-root`.

Le répertoire parent de la racine Apache doit être inscriptible par le compte de déploiement, sans être ouvert aux autres comptes. La sauvegarde et la racine doivent se trouver sur le même système de fichiers. Apache doit déjà autoriser le suivi des liens symboliques dans cette arborescence. L’installation ne modifie ni Apache, ni TLS, ni les permissions d’autres sites.

Copier `pull-release.py` et `install-user.py` dans un répertoire privé temporaire du compte de déploiement. Puis, après revue :

```sh
python3 install-user.py
python3 "$HOME/.local/share/polradar/pull-release.py"
```

L’installateur préserve les lignes existantes de la crontab. Le script installé n’est pas remplacé automatiquement par les versions du site. Une mise à jour du déployeur suit une revue distincte et les tests `tests/deploy/`.

Au premier déploiement, le dossier d’origine est conservé dans le répertoire privé, puis remplacé par un lien vers la version validée. Aux suivants, le remplacement du lien est atomique. Le test local utilise HTTPS, le nom de domaine attendu et la vérification normale du certificat. Un échec restaure le dossier ou le lien précédent.

## Vérifier la publication

```sh
curl --fail https://polradar.fr/build.json
curl --fail --head https://polradar.fr/
```

Comparer `sourceCommit` avec `main` et avec la version GitHub. Vérifier aussi une page de candidature, une fiche et le comparateur dans le navigateur. Une exécution Actions réussie peut précéder la récupération par cron.

## Retour arrière

Pour une correction ordinaire, restaurer le contenu souhaité dans Git puis publier un nouveau commit de `main`. Cette méthode conserve l’historique et utilise les contrôles habituels.

En incident, désactiver la seule ligne `# polradar-public-deploy` dans `crontab -e` avant une restauration manuelle. Les versions précédentes et le dossier initial sont conservés. L’opérateur peut rétablir un lien vers une version déjà validée par un remplacement atomique. Ne pas copier aveuglément une archive dans la racine active.

## Exploitation et réglages Apache

Les versions sont conservées pour restauration ; surveiller l’espace disque et supprimer, après revue, les anciennes versions qui ne sont plus servies ni nécessaires. Ne jamais supprimer la cible du lien actif. Les journaux techniques ne doivent contenir ni jeton ni URL signée de téléchargement.

La configuration actuelle utilise `AllowOverride None`. Le site n’essaie pas de contourner ce réglage avec un `.htaccess`. La CSP est construite dans chaque document HTML. Les en-têtes Apache existants (HSTS, `nosniff`, protection de l’intégration en frame et restrictions de permissions) doivent être préservés.

Pour une évolution d’exploitation, l’opérateur peut faire appliquer dans le vhost HTTPS, après revue et test `apache2ctl configtest`, un `ErrorDocument 404 /404.html`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` et `Content-Security-Policy: frame-ancestors 'none'`. Cette dernière politique d’en-tête complète la CSP du document. Les ressources `_astro` identifiées par leur contenu peuvent recevoir un cache immuable, tandis que HTML, JSON et XML doivent être revalidés.

Ces réglages privilégiés ne sont pas appliqués par le déployeur. Ils ne sont pas nécessaires à la récupération des nouvelles versions.
