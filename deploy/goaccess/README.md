# GoAccess privé pour Polradar

Le moteur GoAccess 1.12 agrège les journaux côté serveur. L’interface fournie lit uniquement son JSON qualifié. Elle évite les templates exécutés dynamiquement du rapport HTML natif : scripts et styles locaux, aucune permission CSP `unsafe-inline` ou `unsafe-eval`, aucun script ajouté au site public.

Le diagnostic du 18 novembre 2026 a trouvé GoAccess 1.12. Le vhost HTTPS Polradar n’avait aucun `CustomLog` déclaré. Ce paquet crée donc un journal HTTPS dédié, sans paramètres d’URL dans la ligne de requête. La collecte commence à son activation. Les anciennes requêtes non attribuables ne sont pas réaffectées à Polradar.

## Paquet et activation par l’opérateur

La version GitHub `site-<commit complet>` contient `polradar-goaccess.tar.gz` et son SHA-256. Le manifeste embarqué référence ce commit et les empreintes des sept fichiers installés. Télécharger le paquet de la version vérifiée, comparer son SHA-256, l’extraire dans un répertoire temporaire neuf, puis examiner `install.py`, `generate.py` et les unités. L’opérateur exécute lui-même :

```sh
sudo python3 -I ./install.py
```

Première installation seulement : les fichiers, l’identité et les dossiers préexistants provoquent un arrêt. L’installateur vérifie le vhost, GoAccess, l’authentification et les modules Apache avant modification. Il garde la configuration et une commande de retour arrière dans un dossier privé de `/var/backups/`. Il ajoute un seul `Include` au vhost HTTPS Polradar, teste Apache, génère le rapport, recharge Apache et active le timer. Un échec de configuration ou de lancement restaure le vhost d’origine. Les autres sites restent inchangés.

## Accès, confidentialité et périmètre

`https://polradar.fr/stats/` et tous ses fichiers exigent les identifiants propres à Polradar, stockés dans `/etc/apache2/polradar-stats.htpasswd` (root:www-data, 0640), hors de toute racine web. L’opérateur crée ce fichier avant la première installation avec `htpasswd`, en mode interactif et avec bcrypt ; l’option de création `-c` ne s’utilise que si le fichier n’existe pas. Les changements suivants mettent à jour le compte sans recréer le fichier. Les mots de passe des autres sites restent dans leurs propres fichiers. Le HTML, le JSON et les assets sont privés, non indexables et sans cache. Aucun mot de passe n’entre dans le dépôt ou le paquet.

L’installateur applique explicitement les permissions des dossiers et du journal après leur création, y compris avec un `umask 077`.

Le service `polradar-stats.service`, avec une identité sans connexion, lit les seuls journaux dédiés et ne peut écrire que dans son dossier de rapport. Le timer recalcule les agrégats toutes les 15 minutes. La rotation quotidienne garde 14 archives. Chaque génération relit l’ensemble disponible ; aucune restauration/persistance cumulative susceptible de doubler les comptes n’est utilisée. Le rapport garde les premières et dernières dates effectivement présentes. Un échec conserve le dernier rapport, dont l’ancienneté est signalée après 35 minutes.

Les IP, agents utilisateurs bruts, référents complets et paramètres d’URL sont exclus du JSON servi. Le filtre hors robots reconnus utilise un second passage du moteur GoAccess. Il ne mesure pas des personnes : les robots inconnus restent présents, et un même client peut produire plusieurs profils quotidiens.

## Vérifications après activation

Vérifier `apache2ctl configtest`, les deux unités, un 401 sans identifiants sur `/stats/` **et** `/stats/report.json`, puis ouvrir le rapport authentifié. Confirmer les graphiques et l’absence de violation CSP dans le navigateur. Vérifier les vrais agrégats produits par le moteur, l’horodatage et la première date. Un succès CI ou un écran de connexion ne vaut pas vérification du rendu privé.
