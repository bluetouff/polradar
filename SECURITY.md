# Sécurité

## Signaler une vulnérabilité

Utiliser l’onglet GitHub « Security », puis « Report a vulnerability » lorsqu’il est disponible, ou écrire à `admin@toonux.com`. Ne pas publier de secret, donnée personnelle ou preuve d’exploitation sensible dans une issue publique.

## Frontières du projet

Le site de production ne contient que les fichiers statiques de `dist/`. Le dépôt, les dépendances, les outils de déploiement et leurs journaux restent hors de la racine servie. Le navigateur n’appelle aucune API tierce. Les liens documentaires externes restent des liens de navigation.

Les données éditoriales sont validées avant construction. Astro échappe les textes. Le comparateur crée ses éléments avec `textContent` et ne transforme jamais une recherche ou un paramètre d’URL en HTML. La CSP native Astro autorise les scripts et styles construits avec leurs empreintes ; elle n’autorise ni `unsafe-inline` ni `unsafe-eval`.

Les jobs Actions ont des permissions explicites. Seul le job de publication d’un push sur `main` reçoit `contents: write`. Les actions tierces sont limitées aux actions officielles GitHub, fixées par commit. Les installations utilisent le verrou et désactivent les scripts npm de dépendances.

Le serveur lit uniquement des versions publiques sur les domaines GitHub autorisés. Il contrôle le commit courant de `main`, le workflow réussi, l’empreinte de l’archive et le manifeste construit. Les liens symboliques, traversées de chemin, fichiers exécutables, extensions serveur et archives surdimensionnées sont refusés. Une erreur de vérification HTTPS après activation déclenche un retour arrière.

L’empreinte SHA-256 contrôle l’intégrité du transfert. Le modèle de confiance repose aussi sur la sécurité du compte GitHub, du dépôt et de GitHub Actions ; elle ne constitue pas une signature indépendante.

## Exploitation

Le déploiement s’exécute sans root et sans clé SSH conservée dans GitHub. Le script de récupération n’est pas mis à jour automatiquement par le dépôt : une modification de ce script nécessite une revue et une installation distincte côté serveur.

Les mises à jour de dépendances sont proposées par Dependabot ; elles doivent passer les mêmes contrôles. Activer l’authentification multifacteur sur les comptes mainteneurs. Ne jamais ajouter de clé, fichier `.env`, cookie ou adresse interne dans le code, une source éditoriale, un workflow ou un artefact.

Les en-têtes HTTP, TLS, la configuration Apache, le compte système et les sauvegardes du serveur appartiennent à l’exploitation de l’hébergement. La CSP du document complète les contrôles Apache existants. Les réglages recommandés et la procédure de restauration figurent dans `deploy/README.md`.
