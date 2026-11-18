# Médias, budgets et agenda

Les trois pages restent statiques. Les filtres s’exécutent dans le navigateur, sans appel à un tiers, sans géolocalisation et sans profil de lecteur. Les documents et les fiches restent consultables sans JavaScript. Les paramètres de sélection sont conservés dans le fragment du lien.

| Page                  | Données                           | Grain et unité                                            |
| --------------------- | --------------------------------- | --------------------------------------------------------- |
| `/temps-de-parole/`   | `src/data/airtime.json`           | Mois, média, personnalité ; secondes publiées par l’Arcom |
| `/budget-programmes/` | `src/data/programme-budgets.json` | Montant attribué à un document, avec période et périmètre |
| `/agenda/`            | `src/data/campaign-agenda.json`   | Annonce d’un rendez-vous, date locale et commune          |

## Temps de parole

Le premier relevé couvre juillet, août et septembre 2026 : 24 médias, dont 15 télévisions et 9 radios. Ce sont les fichiers de personnalités **hors période électorale**, consultés le 17 novembre 2026. Les jours de publication ne sont pas déduits de leur nom de fichier. Les empreintes SHA-256 conservent la version des CSV consultés.

Le parseur vérifie les trois lignes d’en-tête et les catégories JTF, MAG, PROG. Ces catégories sont additionnées par média et personnalité. Le dénominateur d’une bande contient les cellules renseignées de toutes les personnalités du fichier, y compris les personnes absentes du corpus Polradar. Les cinq profils colorés sont choisis dans la sélection courante ; les autres durées publiées restent dans le gris.

Un tiret ou une personne absente reste inconnu. Une valeur numérique `00:00:00` reste un zéro observé. Les sommes représentent les cellules renseignées et peuvent être partielles. Aucune inférence d’équité, d’égalité, d’intention de vote ou de temps d’antenne présidentiel n’est faite.

Les correspondances de noms sont explicites dans `airtimeAliases`. Par exemple, `BRANCO REMI` ne correspond pas à Juan Branco. Un nom ambigu ou un en-tête modifié bloque l’import.

### Relevé quotidien et intégration

Le workflow `watch.yml` conserve son unique déclenchement quotidien à 05:23 UTC. Le collecteur Arcom réutilise le transport existant : HTTPS, hôte autorisé, contrôle des IP publiques et des redirections, limites de taille et de durée. Il lit les données JSON intégrées à la page officielle, sans exécuter son JavaScript. Il télécharge au plus les trois derniers mois complets et compare leurs empreintes à celles intégrées au site.

L’artefact `airtime-review` contient les fichiers, un manifeste et un résumé. Une erreur produit un état indisponible ; elle conserve les données du site et remplace tout ancien manifeste réussi. Le collecteur ne publie rien. En début d’année, une page annuelle encore vide est signalée comme indisponible : aucune période de substitution n’est inventée.

Après examen des fichiers de l’artefact, les placer dans `artifacts/airtime-review/`, puis :

```sh
node scripts/import-airtime.mjs
```

Cette commande vérifie les empreintes, le format CSV et le schéma, puis écrit un aperçu `snapshot.json`. Pour intégrer le relevé examiné :

```sh
node scripts/import-airtime.mjs --write
npx --no-install prettier --write src/data/airtime.json
npm run validate
```

Le push suit le processus habituel du dépôt ; aucune de ces commandes ne pousse ni ne déploie.

## Budgets

Les montants sont des annonces attribuées, pas des évaluations indépendantes. Au 18 novembre 2026, la sélection contient treize profils et vingt-six montants. Les projets de Debout la France, Nouvelle Énergie, des Patriotes et du PCF conservent le périmètre « parti ». Les autres entrées relèvent des documents de campagne cités.

Les barres de montants annuels partagent une échelle par nature de montant (dépense, économie ou recette). Les répartitions utilisent leur propre dénominateur et ne modifient pas ces échelles. Les investissements sans récurrence indiquée et les objectifs à terme gardent leur propre période. Un montant approximatif reste marqué `≈`. La répartition de Philippe reste en pourcentage : le montant proche de 150 milliards ne justifie pas une conversion en montants exacts. Pour Retailleau, 146 et 51 milliards sont deux affectations incluses dans 197 milliards, pas trois postes à additionner.

Les répartitions doivent se réconcilier avec le montant annoncé ou 100 %. Aucun budget complet, solde général, cumul quinquennal ou financement manquant n’est calculé. Une allocation individuelle n’est pas transformée en coût global. Toute nouvelle entrée doit avoir une référence existante, un emplacement dans le document, une période et un périmètre explicites.

Les fourchettes sont enregistrées avec leur borne basse et leur borne haute (`euros`, `eurosMax`), jamais remplacées par une moyenne. Les montants en millions restent lisibles sans arrondi au milliard. Les montants sur plusieurs années, les objectifs à terme et les périodes non précisées ont des catégories distinctes. Un financement par emprunt, comme le pacte du PCF, reste identifié comme financement et non comme coût budgétaire net. Les sources supplémentaires d’une entrée sont validées et affichées avec la référence principale.

L’actualisation du 18 novembre conserve notamment les 8 à 12 milliards sur cinq ans du logement des jeunes chez Ruffin, les 240 millions annuels de part de l’État dans le plan textile de Mélenchon, et les périodes non précisées chez Asselineau et pour la loi contre les violences de Tondelier. Le tableau des Patriotes retient 15 milliards pour la contribution nette à l’UE, contre 20 dans son texte introductif : cette différence est signalée dans la fiche. Aucun de ces postes n’est additionné à un autre programme.

## Agenda et carte

Au 18 novembre 2026, la sélection contient vingt-cinq annonces officielles, quinze profils et dix-neuf communes. La présence de la personnalité doit être explicite dans l’annonce. Les dates de publication et de consultation figurent dans la source ; la fiche porte la date de l’événement. Une date passée ne suffit pas à déclarer que le rendez-vous a eu lieu.

Les filtres à venir/passés utilisent le jour civil à Paris, y compris lorsque le lecteur se trouve dans un autre fuseau. Les horaires sont locaux, en heure de Paris. Les centres des communes proviennent de l’API géographique de l’État ; ils ne représentent pas des coordonnées de salles. Les points proches sont regroupés et donnent accès à un choix de communes. Une adresse absente est signalée comme telle.

Le contour de métropole et de Corse est extrait du fichier Natural Earth 1:50m, disponible dans le domaine public. `france-map.json` conserve sa source, la licence et l’empreinte du fichier téléchargé. Les coordonnées bornées servent à tracer un SVG local ; aucun SVG extérieur ni fond de carte distant n’est exécuté ou chargé. Un événement sans commune peut rester dans la liste, sans repère inventé.

Les annonces officielles ajoutées sont incluses dans la veille quotidienne. Une modification de lieu, d’horaire ou une annulation demande une correction éditoriale vérifiée avant publication.

## Validation

Les schémas des relevés, montants, coordonnées et références sont exécutés par `npm run check` et lors de la construction. Les tests couvrent les cellules absentes, les noms ambigus, le dénominateur des bandes, les répartitions non réconciliées, les périodes, le changement de jour à Paris, le viewBox, les filtres, la réinitialisation, les liens de sélection, les petites largeurs et le rendu sans JavaScript.

Les scripts de recherche et les fichiers téléchargés dans `artifacts/` sont exclus du contrôle TypeScript ; les sources et les tests du site restent contrôlés. Aucune dépendance ou permission de publication n’a été ajoutée.
