# Propositions et votes passés

La première sélection comprend six dossiers, six scrutins distincts et six personnalités. Elle rapproche un état éditorial figé d’une proposition et des listes nominatives officielles. Elle ne mesure ni l’ensemble d’une carrière parlementaire ni une cohérence politique.

## Sélection vérifiée le 18 novembre 2026

| Scrutin                                                                                             | Objet et séance                                                          | Position reprise                                         |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| [Assemblée, 14e législature, n°647](https://www.assemblee-nationale.fr/14/scrutins/jo0647.asp)      | Ensemble de la réforme des retraites, 15 octobre 2013                    | Édouard Philippe : contre                                |
| [Assemblée, 15e législature, n°49](https://www.assemblee-nationale.fr/dyn/15/scrutins/49)           | Habilitation sur le dialogue social, 13 juillet 2017                     | Gabriel Attal : pour                                     |
| [Assemblée, 15e législature, n°169](https://www.assemblee-nationale.fr/dyn/15/scrutins/169)         | Article 12, remplacement de l’ISF par l’IFI, 20 octobre 2017             | Jean-Luc Mélenchon et François Ruffin : contre l’article |
| [Assemblée, 15e législature, n°1716](https://questions.assemblee-nationale.fr/dyn/15/scrutins/1716) | Motion de rejet du texte sur l’ISF et l’impôt sur le revenu, 7 mars 2019 | Jean-Luc Mélenchon et François Ruffin : contre la motion |
| [Sénat, session 2022-2023, n°233](https://www.senat.fr/scrutin-public/2022/scr2022-233.html)        | Article 7 de la réforme des retraites, séance du 8 mars 2023             | Bruno Retailleau : pour l’article                        |
| [Assemblée, 16e législature, n°1240](https://www.assemblee-nationale.fr/dyn/16/scrutins/1240)       | Motion de censure après le 49.3 sur les retraites, 20 mars 2023          | Fabien Roussel : pour la motion                          |

Le scrutin de 2013 compte 49 abstentions : les groupes en recensent 17, 2, 16 et 14, en accord avec 568 votants et 519 suffrages exprimés. La synthèse et la seconde présentation détaillée du même document sont deux affichages du même vote.

Pour la censure, seuls les suffrages favorables sont recensés. Les autres positions sont `null`, jamais assimilées à des voix contre. La majorité requise de 287 figure dans le [compte rendu officiel](https://www.assemblee-nationale.fr/dyn/16/comptes-rendus/seance/session-ordinaire-de-2022-2023/premiere-seance-du-lundi-20-mars-2023). La motion a recueilli 278 voix et a été rejetée. Ce vote met en cause le gouvernement ; il ne vote pas une retraite à 60 ans.

Le Sénat donne au scrutin n°233 la date de séance du 8 mars. Ses résultats intègrent une mise au point et peuvent inclure des délégations. Cette date de séance n’est pas une heure de vote reconstituée. Les comptes rendus liés précisent le contenu des articles et des textes.

## Qualification et corrections

`src/data/legislative-votes.json` conserve le titre, la portée, les totaux, l’identité complète, le groupe de l’époque, l’URL institutionnelle, l’heure de consultation et le SHA-256 du document reçu. Les identifiants parlementaires sont repris lorsqu’ils sont explicitement liés dans la liste ; ils restent absents pour les anciennes listes en texte. Un homonyme ou une absence de la liste ne permet aucune attribution.

Chaque dossier référence une entrée immuable de `versions.json`. Sa date de consultation ne devient pas la date d’annonce du candidat. Les archives, projets de parti et programmes de campagne gardent leur édition. Les scrutins sur un texte entier ou une motion portent obligatoirement la relation « portée plus large ». Les autres rapprochements décrivent leurs différences de périmètre.

Les anciens scrutins sont protégés par `scripts/check-history.mjs`. Une rectification impose un nouvel identifiant de relevé et une note explicite, puis la mise à jour du lien du dossier. Les versions déjà publiées restent conservées.

La piste de la proposition de SMIC du 24 novembre 2022 a été écartée : le texte avait été retiré de l’ordre du jour. Les scrutins voisins sur d’autres textes et les noms approchants ont aussi été exclus. Un résultat de recherche ne suffit pas à qualifier un vote.
