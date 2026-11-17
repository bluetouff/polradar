# Contribuer

Proposer les changements par pull request, avec un périmètre précis. Ne pas mélanger modification éditoriale, dépendance et déploiement sans nécessité.

Pour une source, renseigner son URL HTTPS publique, son auteur dans le titre, son type, sa date de publication lorsqu’elle est connue et la date de consultation effective. Ne pas déduire une heure de publication du chemin d’une URL.

Pour une fiche, conserver l’attribution, le millésime, les unités et le calendrier. Distinguer une proposition de campagne, un projet de parti, une orientation et une archive. Lors d’une modification substantielle, ajouter une entrée à l’historique. Ne pas réécrire une ancienne version pour masquer un changement.

Une mesure dans `measures.json` correspond à une proposition ou orientation distincte. Plusieurs mesures du même candidat sur un même thème sont permises. Renseigner les bénéficiaires, calendrier et financement uniquement après lecture de la source ; garder `null` lorsque la fiche ne les documente pas. Les paramètres et montants ont chacun leur unité et leur source. Les montants conservent période et base brut/net.

À chaque changement, ajouter dans `versions.json` un snapshot complet, avec un numéro consécutif, la date d’observation et l’heure effective d’enregistrement. Choisir `enrichissement` pour une précision de fiche, `correction` pour corriger une erreur, `programme` seulement pour une évolution politique documentée. `import` est réservé à la première version. Ne pas attribuer d’heure rétrospective aux fiches initiales. Mettre la mesure courante et son numéro de révision en accord avec le dernier snapshot. Exécuter `node scripts/check-history.mjs` ; les versions antérieures sont immuables.

Pour un sondage, conserver la notice et sa page, le terrain, la publication, la population, les échantillons global/inscrit/utile, le tour, les candidatures, les résultats et les marges indiquées. Un changement de questionnaire, institut, méthode, tour ou composition doit produire une série distincte. Documenter toute incohérence de la notice. Les pourcentages sans intention exprimée sont distincts des résultats par candidat.

Les articles utilisent les champs `title`, `description`, `category`, `published`, `updated`, `sources`, `themes`, `featured` et `draft`. Les identifiants de sources et de thèmes doivent déjà exister. Aucune donnée indisponible ne doit être remplacée par un chiffre plausible.

Exécuter `npm run validate`, `npm run test:e2e` et `npm run security:audit` avant une fusion. Une contribution n’autorise pas à modifier les secrets, l’infrastructure ou les données de production.
