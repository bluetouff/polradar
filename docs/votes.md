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

## Sessions du Sénat et séances du Parlement européen

Les sessions 2006-2007, 2022-2023 et 2023-2024 du Sénat fournissent 673 scrutins et 802 positions de Jean-Luc Mélenchon et Bruno Retailleau. Les matricules de DOSLEG sont recoupés avec les mandats et les appartenances de l’annuaire pour la date de chaque scrutin. L’export de l’annuaire emploie des codes de groupe durables, notamment « UMP » pour la période 2022-2024. Les résultats nominatifs et les totaux pour, contre et abstention concordent sur les 673 scrutins. Les mises au point sont publiées au niveau du scrutin, avec le compte rendu cité. [Travaux législatifs du Sénat](https://data.senat.fr/dosleg/) · [Annuaire et groupes](https://data.senat.fr/les-senateurs/) · [Licence ouverte du Sénat](https://data.senat.fr/licence/)

Au 24 novembre 2026, le Parlement européen fournit 1 576 décisions comportant un vote ou une intention nominative de Raphaël Glucksmann parmi 2 147 scrutins nominaux examinés sur 29 journées de 2024 à 2026. Son identifiant 197694 relie chaque décision au mandat et au groupe du jour. Le vote exprimé et les éventuelles intentions déclarées après coup restent distincts. Le 12 novembre 2026, par exemple, aucun des 95 scrutins nominatifs de la séance ne contient de mention du député. Le registre conserve les résultats collectifs, le texte soumis et le point exact du procès-verbal. Pour deux scrutins, le nombre de voix contre est absent du champ agrégé. La liste complète des votants, contrôlée contre l’effectif publié, permet de compter zéro voix contre. [Dossier du député](https://www.europarl.europa.eu/meps/fr/197694/RAPHAEL_GLUCKSMANN/home) · [Séance du 21 octobre 2026](https://data.europarl.europa.eu/api/v2/meetings/MTG-PL-2026-10-21/decisions?format=application%2Fld%2Bjson) · [Conditions de réutilisation](https://data.europarl.europa.eu/en/discover/rules-on-the-european-parliaments-open-data)

Quatre scrutins éditoriaux du 13 mars 2024 sont reliés aux points nominatifs sur l’intelligence artificielle, la liberté des médias et les litiges de consommation. La correspondance vérifie le rapport, l’amendement lorsque le scrutin en désigne un, le numéro du point dans l’annexe, les trois résultats collectifs et le vote du député. Le champ `scrutinEditorial` permet de retrouver le relevé Polradar. [Vote sur l’accord provisoire relatif à l’intelligence artificielle](https://data.europarl.europa.eu/eli/dl/doc/PV-9-2024-03-13-RCV-ITM-003)

Le scrutin du CETA du 15 février 2017 reste identifié par le numéro 77143 dans le XML de la huitième législature. Les enregistrements de Marine Le Pen (identifiant de votant 5332, annuaire 28210), Jean-Luc Mélenchon (5916, 96742) et Florian Philippot (6474, 110977) figurent dans les voix contre. L’import vérifie chaque appartenance et l’identifiant du mandat au jour du vote, puis recoupe les 695 votants avec les trois totaux officiels. Le compte rendu rattache l’intervention de Marine Le Pen au groupe ENL et au débat du jour. Jean-Luc Mélenchon a également déposé une explication de vote sur ce rapport. Rejouer `python3 scripts/import-actes-senat-europe.py /tmp/polradar-archives-ceta --ceta --telecharger --verifier` permet de contrôler les trois attributions. L’annexe XML complète est conservée dans le dépôt sous forme compressée. À l’ouverture, l’import vérifie son empreinte contre celle du scrutin publié. Les cinq fichiers d’annuaire proviennent du portail ouvert du Parlement. La page rassemble les trois votes sur le même accord. [Annexe nominative du Parlement européen](<https://www.europarl.europa.eu/RegData/seance_pleniere/proces_verbal/2017/02-15/liste_presence/P8_PV(2017)02-15(RCV)_XC.xml>) · [Débat sur le CETA](https://www.europarl.europa.eu/news/fr/press-room/20170209IPR61728/ceta-le-parlement-adopte-l-accord-commercial-ue-canada) · [Explication de vote de Jean-Luc Mélenchon](https://www.europarl.europa.eu/meps/fr/96742/JEAN-LUC_MELENCHON/all-activities/written-explanations/8)

Les deux institutions sont consultables sur la [page des sessions](https://polradar.fr/votes/archives/). L’[index des exports par période](https://polradar.fr/api/parlement/archives/index.json) donne les effectifs et les adresses institutionnelles utilisés pour la collecte. Pour rejouer l’import et vérifier la sortie octet par octet :

```sh
python3 scripts/import-actes-senat-europe.py /tmp/polradar-archives-senat-europe --telecharger --verifier
```

Le contrôle traite le fichier SQL de DOSLEG comme une suite de lignes de données. Le Sénat remplace périodiquement ses exports. Une correction de la sélection historique ressort à la comparaison avec le fichier vérifié dans Git.

## Textes signés au Sénat

Le registre des dépôts réunit 261 propositions de loi, 54 autres textes et 19 rapports ou avis entre octobre 1986 et mai 2026. Les matricules 04033B et 86039K sont reliés aux codes d’auteur sénatorial de DOSLEG. Chaque signature indique le rôle que le Sénat attribue au déposant et son mandat à cette date. Dans un rapport, un président conserve cette qualité. Les statuts de campagne sont suivis dans le corpus des mesures. [Base DOSLEG](https://data.senat.fr/dosleg/) · [Annuaire des mandats](https://data.senat.fr/les-senateurs/)

Les 337 lignes de signatures comprennent deux références orphelines de DOSLEG et deux références internes vers le même avis sur la nomination des présidents de l’audiovisuel public. L’export conserve les deux codes de cet avis et les deux références orphelines. Les 334 adresses de publication distinctes ont répondu le 24 novembre 2026. Les intitulés des textes reprennent le dossier de dépôt. Pour un rapport sans intitulé dans la base, l’import lit l’en-tête de sa publication au Sénat. [Avis n° 152](https://www.senat.fr/rap/a08-152/a08-152.html)

```sh
python3 scripts/import-textes-senat.py /tmp/polradar-archives-senat --telecharger --verifier
```

Une nouvelle vérification emploie un cache neuf. L’option `--consulte-le AAAA-MM-JJ` enregistre la date de ce nouveau relevé.

[Parcourir les dépôts](https://polradar.fr/votes/textes-senat/) · [Télécharger l’export JSON](https://polradar.fr/api/parlement/textes-senat.json) · [Licence des données du Sénat](https://data.senat.fr/licence/)

La livraison du 24 novembre 2026 ajoute la XVIIe législature. Sur les 10 101 scrutins du fichier institutionnel, 5 206 correspondent au périmètre retenu et 408 contiennent une mention nominative. Depuis janvier 2026, l’import examine chaque scrutin. Pour 2024 et 2025, il retient les scrutins solennels, les motions de censure et les scrutins déjà présents dans les dossiers éditoriaux. L’annuaire recoupe les mandats de Gabriel Attal, Marine Le Pen et François Ruffin. Le dernier scrutin du fichier source date du 20 novembre 2026. [Votes de la XVIIe législature](https://data.assemblee-nationale.fr/travaux-parlementaires/votes) · [Annuaire des mandats de la XVIIe législature](https://data.assemblee-nationale.fr/acteurs/deputes-senateurs-ministres-de-la-legislature)
