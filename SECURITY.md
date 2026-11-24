# Sécurité

## Signaler une vulnérabilité

Utiliser l’onglet GitHub « Security », puis « Report a vulnerability » lorsqu’il est disponible, ou écrire à `admin@toonux.com`. Ne pas publier de secret, donnée personnelle ou preuve d’exploitation sensible dans une issue publique.

## Frontières du projet

Le site de production ne contient que les fichiers statiques de `dist/`. Le dépôt, les dépendances, les outils de déploiement et leurs journaux restent hors de la racine servie. Le navigateur n’appelle aucune API tierce. Les liens documentaires externes restent des liens de navigation.

Les données éditoriales sont validées avant construction. Astro échappe les textes. Le comparateur crée ses éléments avec `textContent` et ne transforme jamais une recherche ou un paramètre d’URL en HTML. La CSP native Astro autorise les scripts et styles construits avec leurs empreintes ; elle n’autorise ni `unsafe-inline` ni `unsafe-eval`.

Les jobs Actions ont des permissions explicites. Les jobs de publication des releases Site et Services reçoivent `contents: write` dans leurs conditions de publication sur `main`. Les actions GitHub sont fixées par commit. Les installations utilisent le verrou et désactivent les scripts npm de dépendances.

Le serveur lit uniquement des versions publiques sur les domaines GitHub autorisés. Il contrôle le commit courant de `main`, le workflow réussi, l’empreinte de l’archive et le manifeste construit. Les liens symboliques, traversées de chemin, fichiers exécutables, extensions serveur et archives surdimensionnées sont refusés. Une erreur de vérification HTTPS après activation déclenche un retour arrière.

L’empreinte SHA-256 contrôle l’intégrité du transfert. Le modèle de confiance repose aussi sur la sécurité du compte GitHub, du dépôt et de GitHub Actions ; elle ne constitue pas une signature indépendante.

## Exploitation

Le déploiement statique s’exécute sans root. Zen récupère des versions publiques par HTTPS. Les collectes qui publient des données ont une clé dédiée à ce seul dépôt, accessible à leur étape de publication sur `main`. Le script de récupération nécessite une revue et une installation distincte sur Zen.

Les mises à jour de dépendances sont proposées par Dependabot ; elles doivent passer les mêmes contrôles. Activer l’authentification multifacteur sur les comptes mainteneurs. Ne jamais ajouter de clé, fichier `.env`, cookie ou adresse interne dans le code, une source éditoriale, un workflow ou un artefact.

Les en-têtes HTTP, TLS, la configuration Apache, le compte système et les sauvegardes du serveur appartiennent à l’exploitation de l’hébergement. La CSP du document complète les contrôles Apache existants. Les réglages recommandés et la procédure de restauration figurent dans `deploy/README.md`.

## Applicabilité de l’avis picomatch

Évaluation du 17 novembre 2026 : [GHSA-fc5q-39xc-vjpf / CVE-2026-112366](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) vise les motifs extglob répétés fournis à picomatch. Astro installe les versions 4.0.7 et 2.3.2. Aucun correctif publié n’est identifié dans l’avis ; le verrou de dépendances est conservé. Le [mainteneur conteste l’applicabilité aux motifs de confiance](https://github.com/micromatch/picomatch/pull/235). Cette qualification ne constitue pas un correctif de la bibliothèque.

Dans Polradar, le motif de collecte des articles est la constante `**/*.md` de `src/content.config.ts`. Les autres motifs proviennent de la configuration de construction. Les recherches publiques utilisent la normalisation, `includes` et des comparaisons littérales dans `src/lib/features.mjs`. Elles ne deviennent jamais des motifs glob. La production sert exclusivement les fichiers statiques de `dist/` ; les dépendances Node.js restent dans l’environnement de construction.

L’alerte est qualifiée comme non applicable au chemin des entrées publiques de cette architecture. Les tests couvrent les chaînes ressemblant à des extglobs comme texte recherché. L’ajout d’un adaptateur serveur, d’une API de recherche de fichiers ou de motifs fournis par un visiteur impose une nouvelle qualification. Les mises à jour de dépendances et le contrôle npm restent actifs. `npm run security:audit` lit le rapport npm complet et bloque tout avis modéré ou plus élevé qui ne relève pas de cette qualification. La qualification de ce seul avis, y compris ses effets transitifs, est liée aux empreintes des fichiers examinés, aux deux versions exactes de picomatch, à leurs intégrités npm et au correctif proposé dans le rapport. Elle expire au plus tard après quatorze jours. Toute modification de cette frontière, de la recommandation npm ou du périmètre de l’avis impose un réexamen ; la bibliothèque n’est jamais annoncée comme corrigée.
