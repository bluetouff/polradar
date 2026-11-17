# Contribuer

Proposer les changements par pull request, avec un périmètre précis. Ne pas mélanger modification éditoriale, dépendance et déploiement sans nécessité.

Pour une source, renseigner son URL HTTPS publique, son auteur dans le titre, son type, sa date de publication lorsqu’elle est connue et la date de consultation effective. Ne pas déduire une heure de publication du chemin d’une URL.

Pour une fiche, conserver l’attribution, le millésime, les unités et le calendrier. Distinguer une proposition de campagne, un projet de parti, une orientation et une archive. Lors d’une modification substantielle, ajouter une entrée à l’historique. Ne pas réécrire une ancienne version pour masquer un changement.

Les articles utilisent les champs `title`, `description`, `category`, `published`, `updated`, `sources`, `themes`, `featured` et `draft`. Les identifiants de sources et de thèmes doivent déjà exister. Aucune donnée indisponible ne doit être remplacée par un chiffre plausible.

Exécuter `npm run validate`, `npm run test:e2e` et `npm run security:audit` avant une fusion. Une contribution n’autorise pas à modifier les secrets, l’infrastructure ou les données de production.
