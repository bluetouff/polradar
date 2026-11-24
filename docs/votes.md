# Propositions et votes passés

Au 23 novembre 2026, 28 fiches de mesures renvoient à 26 scrutins distincts dans trois chambres. Les 33 rapprochements documentent le vote individuel de dix personnalités. Chaque fiche donne l’objet du vote, la date de séance, le nom du votant, son choix, la portée du rapprochement et la source officielle. Le dossier indique la version de la mesure utilisée.

Les deux annexes européennes en français s’ouvrent à l’endroit du vote dans le document publié sur le portail de données du Parlement. Leur empreinte et leur date de consultation figurent dans `readingSources`. Les relevés XML d’origine conservent leur propre empreinte. [Accord UE-Canada, approbation du 15 février 2017](https://data.europarl.europa.eu/distribution/reds_iPlPv_Rcv/PV-8-2017-02-15-RCV/PV-8-2017-02-15-RCV-FNL_fr.xhtml#_Toc373651) · [Détachement des travailleurs, amendement 39 du 29 mai 2018](https://data.europarl.europa.eu/distribution/reds_iPlPv_Rcv/PV-8-2018-05-29-RCV/PV-8-2018-05-29-RCV-FNL_fr.xhtml#_Toc9196010)

## Enrichissement du 19 novembre 2026

Les nouveaux dossiers couvrent le CETA, l’énergie, le logement, l’immigration, la déclaration sur l’Ukraine et la fiscalité. Plusieurs personnalités peuvent avoir voté sur le même texte. Leurs choix sont relevés séparément. Lors du scrutin sur l’immigration du 19 décembre 2023 à l’Assemblée, Marine Le Pen a voté pour et Nicolas Dupont-Aignan s’est abstenu. La comparaison précise que le scrutin portait sur l’ensemble du texte. [Assemblée nationale, scrutin 3213](https://www.assemblee-nationale.fr/dyn/16/scrutins/3213)

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

## Registre des scrutins nominatifs de l’Assemblée

Les archives complètes des XVe et XVIe législatures totalisent 8 522 scrutins de l’Assemblée examinés. Un vote du Congrès contenu dans la même livraison a été écarté. Au moins une position ou une mise au point de l’une des sept personnes identifiées dans Polradar figure dans 3 070 scrutins. Une même personne peut être mentionnée dans plusieurs relevés. La présence d’une intention déclarée après le scrutin est visible à côté du vote enregistré. Les autres choix d’une motion de censure sont indéterminés. Les groupes sont ceux du relevé de séance. Les députés absents des listes nominatives restent sans position attribuée.

L’index public donne les identifiants des acteurs et des mandats, les groupes, les archives sources et leurs empreintes, la date de vérification et les liens vers les lots mensuels. Le champ `positions` de l’index compte les choix effectivement inscrits dans un relevé. Une mise au point seule possède une valeur `vote: null`. Les textes et les positions proviennent de l’Assemblée. La licence source figure dans l’index et les résultats renvoient au scrutin officiel. [Index](https://polradar.fr/api/parlement/index.json) · [Licence ouverte de l’Assemblée](https://data.assemblee-nationale.fr/licence-ouverte-open-licence)

Les identifiants PA issus des fiches parlementaires déjà vérifiées sont recoupés avec l’annuaire de la législature, le mandat PM et la date de séance. L’appartenance à un groupe n’intervient jamais dans l’attribution du vote. [Votes de la XVe législature](https://data.assemblee-nationale.fr/archives-anterieures/archives-15e/scrutins) · [Annuaire de la XVe législature](https://data.assemblee-nationale.fr/archives-anterieures/archives-15e/deputes-senateurs-et-ministres) · [Votes de la XVIe législature](https://data.assemblee-nationale.fr/archives-16e/votes) · [Annuaire de la XVIe législature](https://data.assemblee-nationale.fr/archives-16e/deputes-senateurs-ministres)

Le scrutin du 19 décembre 2023 en donne un exemple. Marine Le Pen figure dans les voix pour, Nicolas Dupont-Aignan parmi les abstentions. Le scrutin n°8 montre pourquoi conserver les mises au point. Fabien Roussel apparaît dans les voix pour et déclare n’avoir pas pris part au scrutin. [Immigration, scrutin 3213](https://www.assemblee-nationale.fr/dyn/16/scrutins/3213) · [Scrutin 8 et mise au point](https://www.assemblee-nationale.fr/dyn/16/scrutins/8)

Pour rejouer l’import à partir des archives publiques épinglées, fournir un dossier de cache local. La seconde commande relit les quatre archives sans accès réseau et vérifie que la sortie est identique octet par octet.

```sh
python3 scripts/import-scrutins-assemblee.py /tmp/polradar-archives-an --telecharger
python3 scripts/import-scrutins-assemblee.py /tmp/polradar-archives-an --verifier
```

Le registre factuel et les dossiers de rapprochement éditorial peuvent référencer le même scrutin. Leurs totaux ont des périmètres distincts. Les scrutins sélectionnés du Sénat et du Parlement européen figurent dans la rubrique Votes.
