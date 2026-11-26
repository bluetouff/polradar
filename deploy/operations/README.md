# Services de Polradar sur Zen

Le site statique, le serveur MCP et le rapport Search Console se déploient indépendamment. Une nouvelle version du site est prise en compte au prochain appel d’un outil MCP. GitHub construit les paquets des deux services depuis `main` dans le workflow [Services Polradar](https://github.com/bluetouff/polradar/actions/workflows/services.yml).

## Activer une version

Sur Debian, télécharger `polradar-activer.sh`, `polradar-activer.sha256` et `services.sigstore.json` dans la release `services-<commit>`. Utiliser le commit complet validé dans le workflow Services. Vérifier le SHA-256 et l’attestation du lanceur avant de l’exécuter.

```sh
revision='COMMIT_COMPLET_VALIDE'
sha256sum --check polradar-activer.sha256 &&
  gh attestation verify polradar-activer.sh --bundle services.sigstore.json \
    --repo bluetouff/polradar \
    --signer-workflow bluetouff/polradar/.github/workflows/services.yml \
    --source-ref refs/heads/main --source-digest "$revision" \
    --deny-self-hosted-runners &&
  sh polradar-activer.sh mcp
```

Pour Search Console, remplacer `mcp` par `gsc` dans la dernière commande. Le lanceur sélectionne le paquet adapté à Zen et vérifie sa propre attestation de paquet avant l’installation.

Lancer le script depuis le compte opérateur sur Zen. L’installation utilise un dossier temporaire privé de root, teste Apache et conserve les fichiers remplacés dans `/var/backups`. Une erreur d’activation déclenche la restauration de la configuration. La sortie indique le commit, l’URL et la sauvegarde.

## Serveur MCP et API HTTP

Apache transmet `/api/mcp`, `/api/mcp-stats.json` et les ressources sous `/api/v1/` à la même socket Unix. Les clients HTTP consultent les propositions et les données avec GET ou HEAD. Le proxy retire les cookies et les identifiants HTTP de ces requêtes publiques. Le processus lit les fichiers du site publié. Il écrit ses compteurs dans `/var/lib/polradar-mcp`. Les compteurs agrègent les appels aux outils déclarés par jour UTC et par résultat sur trente jours. Les consultations de l’API HTTP, la lecture du graphique et la découverte du protocole sont exclues des compteurs MCP. [Statistiques MCP](https://polradar.fr/mcp/statistiques/)

À partir du service 1.6, `/api/v1/reponse` accepte POST pour recevoir une question documentaire en lecture seule dans un corps JSON. Le chemin est fixe et les paramètres d’URL sont refusés. Le service ne transmet ni ne journalise la question. Les journaux d’accès du site excluent les appels API. Les appels MCP à `polradar_answer` alimentent uniquement des totaux journaliers dans `usage-answer.json`. Lors d’un retour au service 1.5, les anciens compteurs restent lisibles dans `usage.json`. La reprise du service 1.6 réunit les deux historiques de compteurs.

Les appels sont agrégés en mémoire par outil et par jour UTC. Le compteur écrit un point de reprise toutes les quinze secondes et à l’arrêt normal. Un arrêt brutal peut perdre les appels depuis la dernière écriture réussie. Un échec de stockage rend le rapport indisponible jusqu’à la reprise. Les tests et les appels répétés comptent aussi. Le lanceur exige GitHub CLI avec prise en charge de `gh attestation verify`, vérifie la provenance du paquet par révision avant sudo et contrôle la liste fermée de ses fichiers.

## Recherche Google

Le rapport quotidien de 18 h 15 (heure de Paris) apparaît à `/stats/google.html`. Il utilise l’authentification existante de GoAccess. La clé, les réponses de l’API et les fichiers du rapport restent sur le serveur. Le compte de service dédié a un accès limité à la propriété préfixe `https://polradar.fr/`. La collecte utilise la portée OAuth en lecture seule. [API Search Analytics](https://developers.google.com/webmaster-tools/v1/api_reference_index)

Lors de la première installation, le script fait correspondre le certificat public préparé sur Zen à celui publié par Google IAM, puis installe le fichier du compte dans `/etc/polradar-gsc/reader.json` (root, 0600). Systemd transmet la clé au seul service de collecte. Une fois le premier appel à Search Console réussi, la copie de préparation est supprimée. Pour une mise à jour, le script utilise la clé déjà installée. Renouveler le certificat avant son échéance en validant la nouvelle clé avant de révoquer l’ancienne. [Certificats des comptes de service](https://docs.cloud.google.com/iam/docs/keys-upload)

Le rapport montre les 28 jours se terminant au dernier jour de données définitives disponible dans la fenêtre consultée, jusqu’à 1 000 requêtes et 1 000 pages. Les totaux de propriété proviennent de Google. Les requêtes anonymisées peuvent être absentes du détail. Un échec daté laisse accessible le dernier relevé valide. [Agrégation des données Search Console](https://support.google.com/webmasters/answer/7576553?hl=fr)

Dans le rapport privé, les requêtes situées entre les positions moyennes 4 et 20 sont classées par impressions. Un second tableau retient celles qui atteignent 100 impressions avec un CTR d’au plus 2 %. Les questions sans clic sont repérées à partir de 20 impressions. Ces seuils sont des choix éditoriaux de Polradar.

Les pages en hausse et en baisse sont classées par variation du nombre de clics sur deux périodes consécutives de 28 jours. Seules les URL retournées sur les deux périodes sont comparables. Un croisement séparé porte sur 250 paires requête et page au maximum. Deux appels quotidiens supplémentaires suffisent. Une ventilation indisponible est signalée dans le rapport. Google peut limiter les lignes retournées et anonymiser des requêtes. [Méthode Search Analytics](https://developers.google.com/webmaster-tools/v1/searchanalytics/query)
