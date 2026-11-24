# Services de Polradar sur Zen

Le site statique, le serveur MCP et le rapport Search Console se déploient indépendamment. Une nouvelle version du site est prise en compte au prochain appel d’un outil MCP. GitHub construit les paquets des deux services depuis `main` dans le workflow [Services Polradar](https://github.com/bluetouff/polradar/actions/workflows/services.yml).

## Activer une version

Sur Debian, télécharger `polradar-activer.sh` dans la release `services-<commit>` et vérifier son SHA-256. Lancer `sh polradar-activer.sh mcp` ou `sh polradar-activer.sh gsc`. Ce script contient le commit et les empreintes des trois archives publiées. Il sélectionne le paquet adapté à l’architecture de Zen. L’attestation GitHub du script ou de l’archive est vérifiable avec `gh attestation verify FICHIER --repo bluetouff/polradar --signer-workflow bluetouff/polradar/.github/workflows/services.yml --source-ref refs/heads/main --source-digest COMMIT`.

Lancer le script depuis le compte opérateur sur Zen. L’installation utilise un dossier temporaire privé de root, teste Apache et conserve les fichiers remplacés dans `/var/backups`. Une erreur d’activation déclenche la restauration de la configuration. La sortie indique le commit, l’URL et la sauvegarde.

## Serveur MCP et API HTTP

Apache transmet `/api/mcp`, `/api/mcp-stats.json` et les ressources sous `/api/v1/` à la même socket Unix. Les clients HTTP consultent les propositions et les données avec GET ou HEAD. Le proxy retire les cookies et les identifiants HTTP de ces requêtes publiques. Le processus lit les fichiers du site publié. Il écrit ses compteurs dans `/var/lib/polradar-mcp`. Les compteurs agrègent les appels aux cinq outils par jour UTC et par résultat sur trente jours. Les consultations de l’API HTTP, la lecture du graphique et la découverte du protocole sont exclues des compteurs MCP. [Statistiques MCP](https://polradar.fr/mcp/statistiques/)

## Recherche Google

Le rapport quotidien de 18 h 15 (heure de Paris) apparaît à `/stats/google.html`. Il utilise l’authentification existante de GoAccess. La clé, les réponses de l’API et les fichiers du rapport restent sur le serveur. Le compte de service dédié a un accès limité à la propriété préfixe `https://polradar.fr/`. La collecte utilise la portée OAuth en lecture seule. [API Search Analytics](https://developers.google.com/webmaster-tools/v1/api_reference_index)

Lors de la première installation, le script fait correspondre le certificat public préparé sur Zen à celui publié par Google IAM, puis installe le fichier du compte dans `/etc/polradar-gsc/reader.json` (root, 0600). Systemd transmet la clé au seul service de collecte. Une fois le premier appel à Search Console réussi, la copie de préparation est supprimée. Pour une mise à jour, le script utilise la clé déjà installée. Renouveler le certificat avant son échéance en validant la nouvelle clé avant de révoquer l’ancienne. [Certificats des comptes de service](https://docs.cloud.google.com/iam/docs/keys-upload)

Le rapport montre les 28 jours se terminant au dernier jour de données définitives disponible dans la fenêtre consultée, jusqu’à 1 000 requêtes et 1 000 pages. Les totaux de propriété proviennent de Google. Les requêtes anonymisées peuvent être absentes du détail. Un échec daté laisse accessible le dernier relevé valide. [Agrégation des données Search Console](https://support.google.com/webmasters/answer/7576553?hl=fr)
