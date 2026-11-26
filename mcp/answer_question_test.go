package main

import (
	"encoding/json"
	"testing"
	"time"
)

func TestAnswerQuestionKey(t *testing.T) {
	if answerQuestionKey("Quelle est la position de sur le droit du sol ?") != answerQuestionKey("droit du sol") {
		t.Fatal("la formulation de la question doit reconnaître son sujet")
	}
	for _, topic := range []string{"le sol", "droit du sol à Mayotte"} {
		if answerQuestionKey(topic) == answerQuestionKey("droit du sol") {
			t.Fatalf("le périmètre a disparu de %q", topic)
		}
	}
	questions := []record{
		{"id": json.RawMessage(`"priorite-1"`), "answerAliases": json.RawMessage(`["sujet partagé", "question précise"]`)},
		{"id": json.RawMessage(`"priorite-2"`), "answerAliases": json.RawMessage(`["sujet partagé"]`)},
	}
	index, err := indexAnswerQuestions(questions)
	if err != nil || index[answerQuestionKey("sujet partagé")] != nil ||
		index[answerQuestionKey("question précise")].str("id") != "priorite-1" {
		t.Fatal("un alias ambigu ne doit pas sélectionner de dossier")
	}
}

func TestPublishedAnswerQuestionDossiers(t *testing.T) {
	data := &store{root: publishedSite(t)}
	c, err := data.load()
	if err != nil {
		t.Fatal(err)
	}
	d, err := c.dossiers()
	if err != nil {
		t.Fatal(err)
	}
	if d.questionIndex[answerQuestionKey("droit du sol")] == nil {
		t.Skip("édition antérieure aux nouveaux dossiers")
	}
	h := handler(data, openUsage(t.TempDir(), time.Now()))
	for _, tc := range []struct {
		question, dossier, candidate, version, source, state, motif, qualification string
	}{
		{"Quelle est la position de Marine Le Pen sur l’aide à l’Ukraine ?", "aide-ukraine", "lepen", "lepen-europe-1-v2", "", "documente", "", "reponse"},
		{"Que propose Teddy Riner sur l’aide à l’Ukraine ?", "aide-ukraine", "riner", "riner-interroger-consequences-aide-ukraine-v1", "riner-lci-ukraine-manche-2026-11-26", "partiel", "complements_seuls", "complement"},
		{"Que propose Karim Bouamrane sur la CSG des salaires ?", "fiscalite-csg-salaires", "bouamrane", "bouamrane-baisser-csg-jusquau-salaire-median-v1", "", "documente", "", "reponse"},
		{"Quelle est la position de Clara Egger sur la CSG des salaires ?", "fiscalite-csg-salaires", "egger", "", "", "sans-resultat", "document_examine", ""},
		{"Que propose Delphine Batho contre les déserts médicaux ?", "sante-installation-medecins", "batho", "batho-installation-medecins-centres-sante-v1", "batho-programme-pleine-sante", "documente", "", "reponse"},
		{"Que propose Gilles Platret sur le temps de travail ?", "travail-duree-travail", "platret", "platret-retour-39-heures-v1", "platret-communique-candidature", "documente", "", "reponse"},
		{"Quelle est la position de Sébastien Bonnal sur la loi SRU ?", "logement-obligations-parc-social", "bonnal", "bonnal-maintenir-quotas-loi-sru-v1", "", "documente", "", "reponse"},
		{"Quelle est la position de Jean-François Legendre sur l’AME ?", "immigration-aide-medicale-etat", "legendre", "legendre-questionner-ame-sans-reforme-v1", "legendre-manifeste-64", "partiel", "complements_seuls", "complement"},
		{"Que propose Jean-Luc Mélenchon pour les élèves par classe ?", "education-eleves-par-classe", "melenchon", "melenchon-education-2-v3", "lfi-school", "documente", "", "reponse"},
		{"Quelle est la position de Gabriel Attal sur le nucléaire ?", "climat-production-nucleaire", "attal", "attal-plan-messmer-2-v1", "", "documente", "", "reponse"},
		{"Que propose Marine Le Pen sur Parcoursup ?", "education-acces-etudes", "lepen", "lepen-publier-criteres-admission-superieur-v1", "lepen-tf1-parcoursup-octobre-2026", "documente", "", "reponse"},
		{"Que propose David Lisnard sur Parcoursup ?", "education-acces-etudes", "lisnard", "lisnard-remplacer-parcoursup-orientation-v1", "lisnard-bfm-rmc-ecole-2026", "documente", "", "reponse"},
		{"Que propose Édouard Philippe sur Parcoursup ?", "education-acces-etudes", "philippe", "philippe-conserver-ameliorer-parcoursup-orientation-v1", "philippe-questions-reponses-ecoles", "documente", "", "reponse"},
	} {
		t.Run(tc.candidate, func(t *testing.T) {
			got := answerThroughTransports(t, h, tc.question, c.commit)
			anchor := "#candidat-" + tc.candidate
			if tc.motif == "document_examine" {
				anchor = "#revue-" + tc.candidate
			}
			fields := map[string]any{
				"/etat":           tc.state,
				"/couverture/url": "https://polradar.fr/questions/" + tc.dossier + "/" + anchor,
			}
			if tc.motif != "" {
				fields["/motif"] = tc.motif
			}
			if tc.version != "" {
				fields["/resultats/0/candidatureAssociee"] = tc.candidate
				fields["/resultats/0/versionId"] = tc.version
				fields["/resultats/0/relation/qualification"] = tc.qualification
				fields["/resultats/0/relation/versionCitee"] = tc.version
				if tc.source != "" {
					fields["/resultats/0/sources/0/id"] = tc.source
				}
				if ref, ok := answerAt(got.Data, "/resultats/0/sources/0/passage"); !ok || ref == "" {
					t.Error("repère du passage absent")
				}
			} else {
				fields["/resultats"] = []any{}
			}
			expectComparisonFields(t, got.Data, fields)
		})
	}
}
