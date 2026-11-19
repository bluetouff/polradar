# Évolution des propositions et financements

`proposal-evolution.json` conserve des états de documents officiels séparés des révisions éditoriales de `versions.json`. Une capture fixe la référence, l’URL, un extrait court, son emplacement, la date de consultation et l’empreinte SHA-256 du document reçu. `recordedAt` date l’intégration technique ; il ne date pas une déclaration politique. La CI empêche de modifier ou retirer les états déjà publiés. Une correction s’ajoute dans un nouvel état.

Une édition 2022 ou 2024 conserve cette précision annuelle. Une consultation n’établit pas la date d’un changement de programme. L’annonce Lisnard d’avril 2026 est une reprise rétrospective par son parti, signalée comme telle. Le programme collectif du NFP reste distinct des campagnes présidentielles. Les seules différences numériques affichées utilisent une même base : le SMIC mensuel net nominal. Aucun montant n’est corrigé de l’inflation.

`financing-maps.json` ne contient aucun montant : ses relations renvoient aux entrées validées de `programme-budgets.json`. Les montants et répartitions n’ont qu’une seule définition. Les parts de l’effort annoncé par Édouard Philippe restent 50 %, 25 %, 25 % ; elles ne deviennent pas des euros exacts à partir d’une cible approximative. L’emprunt PCF de 500 milliards reste un financement sur cinq ans. Les liens défense/IA et profits/fonds de relocalisation n’encodent aucun montant, car leur quote-part est inconnue. Aucun total entre candidats ou entre horizons différents n’est calculé.

Les pages sont statiques et lisibles sans JavaScript. Les contrôles n’affichent que les identifiants connus du corpus ; les données externes passent par les schémas et sont rendues comme texte. Les graphiques ont une échelle propre à chaque enveloppe et une présentation adaptée aux petites largeurs.

## Enrichissement du 19 novembre 2026

Les 19 dossiers rassemblent 41 états de propositions pour onze personnalités. Les frises précisent le scrutin ou la campagne d’origine, y compris pour les programmes collectifs des européennes et des législatives de 2024. Les deux amendements de Marine Le Pen sur la TVA des énergies sont datés de leur dépôt. Les passages sur le kérosène de la liste PS–Place publique et de la campagne de Raphaël Glucksmann sont comparés selon les vols et le territoire visés. Les dispositions publiées sans montant sont conservées sous forme de texte.

## Enrichissement du 18 novembre 2026

Le corpus comporte 6 dossiers historiques (14 états, 5 candidats) et 16 schémas financiers (9 candidats). Les 9 captures initiales et les versions éditoriales déjà publiées sont conservées sans modification. Les ajouts Arthaud et Roussel reposent sur leurs professions de foi CNCCEP et des publications de parti de 2026. Le minimum de revenu de 2022 et le SMIC d’Arthaud en 2026 ont des champs distincts : aucune hausse automatique n’est calculée.

Les tableaux BTP et automobile donnent respectivement une somme des postes État de 12,01 Md€ et 1,37 Md€, pour des totaux publiés de 12 et 1,4 Md€. Le plan canicules d’Équinoxe affiche 9,5 Md€ pour cinq postes totalisant 9,45 Md€. Le champ `allocationDifference` conserve cet écart signé et son explication. Il est interdit pour une répartition en pourcentage ou une enveloppe approximative. Le validateur exige que l’écart corresponde exactement aux lignes. Le graphique utilise leur somme et affiche les deux montants ; aucun poste de compensation n’est créé.

Les cellules vides restent sans montant. Les sous-lignes « dont » du textile ne sont pas comptées deux fois. Les graphiques des plans sectoriels de Mélenchon représentent uniquement la colonne État. Pour Équinoxe, le contre-budget est limité à 2027 ; ses prêts et apports de fonds propres restent séparés des dépenses. Les économies de charge de la dette sont signalées comme hypothèse. Les recettes et économies affichées restent les estimations de leurs auteurs.

### Documents consultés

Les empreintes ci-dessous identifient les corps des documents consultés, non leurs dates de première publication.

- [cnc-arthaud-2022](https://www.cnccep.fr/pdfs/Candidat-01-Nathalie-Arthaud-Declaration.pdf) · consultation 2026-11-18T17:55:36.919346+00:00 · SHA-256 `3f15e26228232909dc4745cd883fb952734407eb58e96414098e7d1a34a35c45`.
- [cnc-roussel-2022](https://www.cnccep.fr/pdfs/Candidat-11-Fabien-Roussel-Declaration-accessible.pdf) · consultation 2026-11-18T18:00:17.366726+00:00 · SHA-256 `c37cd69cef21e85c4a1401d71c6d50d6f4a81c87350a5e5efe08d95b26632751`.
- [arthaud-discours-2026](https://www.lutte-ouvriere.org/portail/brochures/meeting-26-septembre-2026-discours-nathalie-arthaud-197446.html) · consultation 2026-11-18T17:45:41.512874+00:00 · SHA-256 `4342e8275ee31398b3ea8df28d3dbd1d4a612df485285f785bc380af45c13efa`.
- [arthaud-depliant-2026-pdf](https://www.lutte-ouvriere.org/medias/document/fichiers/2026/11/Depliant-NA-3nov.pdf) · consultation 2026-11-18T17:55:37.040474+00:00 · SHA-256 `bb7c928b5fb8e5d9e01ebc17e8700f6ade2ab2ec24418115b00a57160ac4365e`.
- [roussel-pacte-2026](https://www.pcf.fr/discours_de_fabien_roussel_fete_huma_31) · consultation 2026-11-18T17:45:39.831756+00:00 · SHA-256 `463fc9118f4ddbe53011977cab3703f2b9b2dfde4f999c6864b011149122c553`.
- [lfi-investissement-btp-2026](https://melenchon2027.fr/programme/plans-investissement/btp-logement/) · consultation 2026-11-18T17:45:38.732370+00:00 · SHA-256 `92e41017ad5b4dc8eacc39fcfda1859aab61f08cdff4c82640a2ea07a3d1268c`.
- [lfi-investissement-auto-2026](https://melenchon2027.fr/programme/plans-investissement/automobile/) · consultation 2026-11-18T17:45:40.108922+00:00 · SHA-256 `92d976bdecadc069e649eec8bd6bac93c26811c0c0d292cc01bd9f67a0af6c80`.
- [lfi-investissement-textile-2026](https://melenchon2027.fr/plans-investissement/textile/) · consultation 2026-11-18T17:45:41.331987+00:00 · SHA-256 `4093089c37cd591b5ab4b5e51679c42b7070d14cbccb3e8d1c33c221ad4b9d54`.
- [equinoxe-contre-budget-2027](https://parti-equinoxe.fr/contre-budget-2027/) · consultation 2026-11-18T17:57:32.440481+00:00 · SHA-256 `39a44e7c57af3eaf9a8151a846d099d765d686d51f70964e93d70ec3923a7927`.
- [dlf-economie-2026](https://www.debout-la-france.fr/projet/economie-travail/) · consultation 2026-11-18T17:45:39.353517+00:00 · SHA-256 `adc56c1fbfbeacee46142a9f606b30bf0ae2256c71615efb2492281fcb5b7492`.
