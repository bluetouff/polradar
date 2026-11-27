package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestAnswerTransport(t *testing.T) {
	data := &store{root: fixture(t)}
	h := handler(data, openUsage(t.TempDir(), time.Now()))
	const question = "Retrouve l’étude de cas pour le service public."
	const raw = `{"question":"` + question + `"}`
	response := call(h, http.MethodPost, answerPath, raw, map[string]string{"Origin": site})
	if response.Code != 200 || response.Header().Get("Access-Control-Allow-Origin") != "" ||
		response.Header().Get("Cache-Control") != "no-store" || response.Header().Get("Referrer-Policy") != "no-referrer" ||
		strings.Contains(response.Body.String(), question) {
		t.Fatalf("réponse REST %d %v %s", response.Code, response.Header(), response.Body.String())
	}
	var rest output
	rpc := runTool(h, answerTool, map[string]string{"question": question})
	var tool struct {
		Result struct {
			IsError           bool   `json:"isError"`
			StructuredContent output `json:"structuredContent"`
		}
	}
	if rpc.Code != 200 || json.Unmarshal(response.Body.Bytes(), &rest) != nil || json.Unmarshal(rpc.Body.Bytes(), &tool) != nil ||
		tool.Result.IsError || !reflect.DeepEqual(rest, tool.Result.StructuredContent) {
		t.Fatalf("parité REST/MCP : %s / %s", response.Body.String(), rpc.Body.String())
	}
	if got, _ := answerAt(rest.Data, "/resultats/0/auteur"); got != "Collectif de test" || rest.Empty {
		t.Fatalf("attribution de la fiche : %v", rest.Data)
	}
	if got, _ := answerAt(rest.Data, "/resultats/0/sources/0/url"); got != "https://example.org/programme#section" {
		t.Fatalf("passage exact : %v", got)
	}
	legacy := call(h, http.MethodGet, "/api/v1/mesures?query=etude", "", map[string]string{"Origin": "https://lecteur.example.org"})
	if legacy.Code != 200 || legacy.Header().Get("Access-Control-Allow-Origin") != "*" {
		t.Fatalf("régression de l’API en lecture : %d %v", legacy.Code, legacy.Header())
	}
}

func TestPublishedQuestionRelationAnswer(t *testing.T) {
	data := &store{root: publishedSite(t)}
	c, err := data.load()
	if err != nil {
		t.Fatal(err)
	}
	if c.commit == answerLegacyCommit {
		t.Skip("édition de compatibilité antérieure aux relations de question")
	}
	for _, tc := range []struct {
		name, question, cited, current, qualification, reason, sourceID string
	}{
		{
			"relance du nucléaire et auteur collectif",
			"Compare Marine Le Pen et David Lisnard sur la question climat-production-nucleaire.",
			"groupe-rn-accroitre-production-nucleaire-2025-v1", "groupe-rn-accroitre-production-nucleaire-2025-v1",
			"reponse", "autres_positions", "groupe-rn-communique-programmation-energie-2025",
		},
		{
			"version historique",
			"Compare Juan Branco et Nicolas Dupont-Aignan sur la question salaires-enseignants.",
			"branco-salaires-enseignants-debut-carriere-v1", "branco-salaires-enseignants-debut-carriere-v2",
			"reponse", "version_depassee", "branco-voie-pdf",
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			value, empty, err := c.answer(answerArgs{Question: tc.question, ExpectedRevision: c.commit})
			if err != nil || empty {
				t.Fatalf("relation indisponible : %v", err)
			}
			a := value.(documentaryAnswer)
			if a.State != "partiel" || a.Intent != "comparaison" || a.Reason != tc.reason || len(a.Results) != 2 {
				t.Fatalf("état de la relation : %+v", a)
			}
			item := a.Results[0]
			relation := item.Relation
			if relation == nil || item.Version != tc.cited || relation.CitedVersion != tc.cited || relation.CurrentVersion != tc.current ||
				relation.Qualification != tc.qualification || relation.VersionRule != "version-citee" || len(item.Sources) == 0 ||
				item.Sources[0].ID != tc.sourceID {
				t.Fatalf("qualification, version ou source : %+v", item)
			}
		})
	}
}

func TestPublishedQuestionRelationCompatibility(t *testing.T) {
	c, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	if c.commit != answerLegacyCommit {
		t.Skip("recette de lecture de l’édition de compatibilité abc3846")
	}
	value, empty, err := c.answer(answerArgs{
		Question:         "Compare Marine Le Pen et David Lisnard sur la question climat-production-nucleaire.",
		ExpectedRevision: c.commit,
	})
	if err != nil || empty {
		t.Fatalf("lecture de l’ancienne édition : %v", err)
	}
	a := value.(documentaryAnswer)
	if a.State != "partiel" || a.Reason != "qualification_relation_indisponible" ||
		len(a.Results) != 2 || a.Results[0].Relation != nil || len(a.Results[0].Sources) == 0 {
		t.Fatalf("provenance de l’ancienne édition : %+v", a)
	}
}

func TestAnswerTransportRejections(t *testing.T) {
	const raw = `{"question":"Quelle est la source de cette fiche ?"}`
	h := handler(&store{root: fixture(t)}, openUsage(t.TempDir(), time.Now()))
	for _, tc := range []struct {
		name, method, path, body string
		headers                  map[string]string
		status                   int
		code                     string
	}{
		{"method", http.MethodGet, answerPath, "", nil, 405, "methode_non_autorisee"},
		{"browser origin", http.MethodPost, answerPath, raw, map[string]string{"Origin": "https://lecteur.example.org"}, 403, "origine_refusee"},
		{"query", http.MethodPost, answerPath + "?question=exemple", raw, nil, 400, "question_invalide"},
		{"media type", http.MethodPost, answerPath, raw, map[string]string{"Content-Type": "text/plain"}, 415, "format_invalide"},
		{"unrecognised field", http.MethodPost, answerPath, `{"question":"Question","sort":"new"}`, nil, 400, "question_invalide"},
		{"repeated question", http.MethodPost, answerPath, `{"question":"Question","question":"Une autre question"}`, nil, 400, "question_invalide"},
		{"non text question", http.MethodPost, answerPath, `{"question":true}`, nil, 400, "question_invalide"},
		{"empty after normalization", http.MethodPost, answerPath, `{"question":"  ?  "}`, nil, 400, "question_invalide"},
		{"too many characters", http.MethodPost, answerPath, `{"question":"` + strings.Repeat("é", 301) + `"}`, nil, 400, "question_invalide"},
		{"max transport size", http.MethodPost, answerPath, strings.Repeat(" ", answerBodyLimit+1), nil, 413, "taille_excessive"},
		{"incorrect edition", http.MethodPost, answerPath, `{"question":"Question","expectedRevision":"` + strings.Repeat("b", 40) + `"}`, nil, 409, "revision_changee"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			r := call(h, tc.method, tc.path, tc.body, tc.headers)
			var body map[string]string
			if r.Code != tc.status || json.Unmarshal(r.Body.Bytes(), &body) != nil || body["code"] != tc.code || len(body) != 2 {
				t.Fatalf("statut %d, réponse %s", r.Code, r.Body.String())
			}
		})
	}
}

func TestAnswerUsageRollback(t *testing.T) {
	date := time.Date(2026, 11, 26, 10, 0, 0, 0, time.UTC)
	day := dateKey(date)
	dir := t.TempDir()
	u := openUsage(dir, date)
	u.record("polradar_search", counts{Success: 2}, date)
	u.record(answerTool, counts{Empty: 1}, date)
	if err := u.checkpoint(); err != nil {
		t.Fatal(err)
	}
	legacyPath := filepath.Join(dir, "usage.json")
	var legacy usageFile
	if err := readData(legacyPath, 1<<18, &legacy); err != nil || !validUsageFile(legacy, legacyToolNames) ||
		len(legacy.Days[day]) != 1 || legacy.Days[day]["polradar_search"].Success != 2 {
		t.Fatalf("compteurs lisibles par le service 1.5 : %+v %v", legacy, err)
	}
	// La 1.5 augmente ses propres compteurs après une restauration.
	legacy.Days[day]["polradar_search"] = counts{Success: 3}
	if err := writeUsageFile(legacyPath, legacy); err != nil {
		t.Fatal(err)
	}
	resumed := openUsage(dir, date)
	report, err := resumed.public(date)
	if err != nil || len(report.Days) != 1 || len(report.Tools) != len(toolNames) ||
		resumed.records.Days[day]["polradar_search"].Success != 3 || resumed.records.Days[day][answerTool].Empty != 1 {
		t.Fatalf("agrégats restaurés : %+v %v", report, err)
	}
}

func TestAnswerMissingData(t *testing.T) {
	root := fixture(t)
	if err := os.Remove(filepath.Join(root, "api", "economie.json")); err != nil {
		t.Fatal(err)
	}
	h := handler(&store{root: root}, openUsage(t.TempDir(), time.Now()))
	r := call(h, http.MethodPost, answerPath, `{"question":"Quel est le taux de chômage ?"}`, nil)
	var body map[string]string
	if r.Code != 503 || json.Unmarshal(r.Body.Bytes(), &body) != nil || body["code"] != "service_indisponible" {
		t.Fatalf("jeu absent : %d %s", r.Code, r.Body.String())
	}
}

const answerLegacyCommit = "abc3846fc6c17d7e894e6a0add20d0611c2328e6"

func TestPublishedRetirementLawAnswer(t *testing.T) {
	c, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	if c.contract.major("droit") != dataMajor {
		t.Skip("édition antérieure à la collection de droit")
	}
	value, empty, err := c.answer(answerArgs{Question: "Quel âge légal pour ouvrir les droits à la retraite ?"})
	if err != nil {
		t.Fatal(err)
	}
	answer := value.(documentaryAnswer)
	if answer.Intent != "juridique" || answer.Coverage.URL != site+"/comparer/retraites/" {
		t.Fatal(answer)
	}
	if answer.Reason == "regles_a_consulter" {
		t.Skip("compatibilité avec un export sans synthèse sourcée")
	}
	if empty || answer.State != "documente" || len(answer.Results) != 1 {
		t.Fatal(answer)
	}
	result := answer.Results[0]
	if !strings.Contains(result.Summary, "64 ans pour la génération 1969 et après") ||
		len(result.Sources) != 1 || result.Sources[0].ID != "assurance-retraite-age" {
		t.Fatal(result)
	}
	for _, question := range []string{
		"Quel âge légal pour la retraite en Belgique ?",
		"Quel âge légal pour la retraite des personnes nées en 1965 ?",
	} {
		value, empty, err := c.answer(answerArgs{Question: question})
		if err != nil || !empty || value.(documentaryAnswer).State != "ambigu" {
			t.Fatalf("%s : %v (%v)", question, value, err)
		}
	}
}

func TestPublishedAnswer(t *testing.T) {
	data := &store{root: publishedSite(t)}
	c, err := data.load()
	if err != nil {
		t.Fatal(err)
	}
	if c.commit == answerLegacyCommit {
		t.Skip("édition de compatibilité antérieure au moteur de réponse")
	}
	for _, tc := range []struct {
		question, intent, state, id string
		check                       func(*testing.T, documentaryAnswer)
	}{
		{"Que proposent les candidats sur la CSG ?", "proposition", "partiel", "", func(t *testing.T, a documentaryAnswer) {
			if len(a.Results) != answerLimit || *a.Coverage.Total <= answerLimit {
				t.Fatal(a)
			}
		}},
		{"Quel est l’objet du scrutin n° 9916 sur la cybersécurité ?", "scrutin", "documente", "VTANR5L17V9916", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if r.Date != "2026-11-17" || !strings.Contains(r.Title, "cybersécurité") ||
				r.Sources[0].URL != "https://www.assemblee-nationale.fr/dyn/17/scrutins/9916" {
				t.Fatal(r)
			}
		}},
		{"Comment Gabriel Attal a-t-il voté au scrutin n°9916 du 17 novembre 2026 à l’Assemblée nationale sur la cybersécurité des infrastructures critiques ? Le relevé indique-t-il une délégation de vote ?", "scrutin", "documente", "VTANR5L17V9916", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if len(r.Facts) != 2 || r.Facts[0].Value != "pour" || r.Facts[0].Label != "Gabriel Attal" ||
				r.Facts[1].Value != "oui" || r.Facts[1].Label != "Délégation de vote · Gabriel Attal" || r.Facts[1].SourceID != r.Facts[0].SourceID {
				t.Fatal(r)
			}
		}},
		{"Au scrutin n°9916 du 17 novembre 2026 à l’Assemblée nationale, combien de voix pour et d’abstentions ? Le texte a-t-il été adopté ?", "scrutin", "documente", "VTANR5L17V9916", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if len(r.Facts) != 3 || r.Facts[0].Value != "464" || r.Facts[1].Value != "16" ||
				r.Facts[2].Value != "adopté" || r.Facts[2].SourceID != r.Sources[0].ID {
				t.Fatal(r)
			}
		}},
		{"Quel vote Bruno Retailleau a-t-il exprimé lors du scrutin du Sénat sur l’article 7 du budget rectificatif de la Sécurité sociale, le 8 mars 2023 ?", "scrutin", "documente", "senat-2022-233", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if len(a.Results) != 1 || *a.Coverage.Total != 1 || len(r.Facts) != 1 ||
				r.Facts[0] != (answerFact{Label: "Bruno Retailleau", Value: "pour", Period: "2023-03-08", SourceID: r.ID}) ||
				len(r.Sources) != 1 || r.Sources[0].URL != "https://www.senat.fr/scrutin-public/2022/scr2022-233.html" {
				t.Fatal(a)
			}
		}},
		{"Quel vote Bruno Retailleau a-t-il exprimé au Sénat sur l’article 999 du budget rectificatif de la Sécurité sociale le 8 mars 2023 ?", "scrutin", "sans-resultat", "", nil},
		{"Quels scénarios OpinionWay CNEWS ont un terrain le 21 octobre 2026 ?", "sondage", "partiel", "opinionway-commission-10333-p12", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if *a.Coverage.Total != 4 || r.Sources[0].URL != "https://www.commission-des-sondages.fr/notices/medias/fichiers/add/2352#page=12" ||
				r.Facts[0].Value != "680" || r.Facts[0].Period != "2026-10-21 – 2026-10-22" {
				t.Fatal(a)
			}
		}},
		{"Dans le sondage opinionway-commission-10333-p12, quel score pour Nathalie Arthaud ?", "sondage", "documente", "opinionway-commission-10333-p12", func(t *testing.T, a documentaryAnswer) {
			if got := a.Results[0].Facts[1]; got.Value != "< 1" || got.Unit != "%" {
				t.Fatal(got)
			}
		}},
		{"Le terrain du sondage opinionway-commission-10333-p12 était-il le 21 septembre 2026 ?", "sondage", "sans-resultat", "", nil},
		{"Sondage Élabé diffusé le 29 août 2026 : quelles sont les dates de début et de fin du terrain ?", "sondage", "documente", "elabe-2026-08-29-attal", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if len(a.Results) != 1 || *a.Coverage.Total != 1 || r.Status != "terrain" || r.Date != "2026-08-29" || len(r.Sources) != 1 ||
				r.Sources[0].URL != "https://www.commission-des-sondages.fr/notices/files/notices/2026/aout/10245-pres-iv-elabe-29-aout.pdf" {
				t.Fatal(r)
			}
			if len(r.Facts) != 2 || r.Facts[0].Label != "Début du terrain" || r.Facts[0].Value != "2026-08-26" ||
				r.Facts[1].Label != "Fin du terrain" || r.Facts[1].Value != "2026-08-28" ||
				r.Facts[0].SourceID != r.Facts[1].SourceID || r.Facts[0].SourceID != r.Sources[0].ID {
				t.Fatal(r.Facts)
			}
		}},
		{"Le sondage Élabé publié le 2026-08-29 avait-il encore un terrain le 30 août 2026 ?", "sondage", "sans-resultat", "", nil},
		{"Quel horizon temporel Polradar rattache-t-il aux économies annoncées dans l’affectation du programme de David Lisnard ?", "financement", "documente", "lisnard-affectations", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			want := answerFact{Label: "Périodicité des économies annoncées", Value: "annuel", Period: "Par an à terme ; montée en charge progressive", SourceID: "lisnard-repartition-2026"}
			if len(r.Facts) != 1 || r.Facts[0] != want || r.Person != "lisnard" || r.URL != site+"/financements/#carte=lisnard-affectations" || a.Coverage.URL != r.URL ||
				len(r.Sources) != 3 || r.Sources[0].ID != want.SourceID || r.Sources[1].ID != "lisnard-crayon-2026" || r.Sources[2].ID != "lisnard-economies-annuelles-2026" {
				t.Fatal(a)
			}
		}},
		{"Quel est l’horizon des économies dans l’affectation du programme de Bruno Retailleau ?", "financement", "documente", "retailleau-affectations", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if len(r.Facts) != 1 || r.Facts[0].Value != "horizon" || r.Facts[0].Period != "En 2032 ; montant non présenté comme un cumul" {
				t.Fatal(r)
			}
		}},
		{"Quel est l’horizon des économies dans l’affectation du programme de Gabriel Attal ?", "financement", "ambigu", "", nil},
		{"Compare Gabriel Attal et Raphaël Glucksmann sur la CSG des salaires", "comparaison", "partiel", "attal-csg-salaires", func(t *testing.T, a documentaryAnswer) {
			if len(a.Results) != 2 || !strings.HasSuffix(a.Results[0].URL, "#version-2") || a.Reason != "version_depassee" {
				t.Fatal(a)
			}
			glucksmann := a.Results[1]
			if glucksmann.ID != "glucksmann-csg-salaires" || !strings.HasSuffix(glucksmann.URL, "#version-2") ||
				glucksmann.Relation == nil || glucksmann.Relation.Status != "version-depassee" ||
				glucksmann.Relation.CitedVersion != "glucksmann-csg-salaires-v2" || glucksmann.Relation.CurrentVersion != "glucksmann-csg-salaires-v3" {
				t.Fatal(a)
			}
		}},
		{"Compare Gabriel Attal et Marine Le Pen sur la CSG des salaires", "comparaison", "partiel", "attal-csg-salaires", func(t *testing.T, a documentaryAnswer) {
			if a.Results[1].Status != "non-documente" || len(a.Results[1].Sources) != 0 || a.Reason != "positions_non_documentees" {
				t.Fatal(a)
			}
		}},
		{"Quel est actuellement le taux d’inflation harmonisée en France en octobre 2026 ?", "economie", "documente", "inflation", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			want := answerFact{Label: r.Title, Value: "3.7", Unit: "%", Period: "2026-10", SourceID: "prc_hicp_minr"}
			if r.Facts[0] != want || !strings.Contains(r.Sources[0].URL, "prc_hicp_minr") {
				t.Fatal(r)
			}
		}},
		{"Quel était le taux de chômage en Allemagne en septembre 2026 ?", "economie", "ambigu", "", nil},
		{"Quel est le droit en vigueur sur le chiffrement ?", "juridique", "documente", "outils-chiffres-1", func(t *testing.T, a documentaryAnswer) {
			if r := a.Results[0]; r.Sources[0].URL != "https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006421577/" {
				t.Fatal(r)
			}
		}},
		{"Quel est le droit en vigueur sur le chiffrement en Belgique ?", "juridique", "ambigu", "", nil},
		{"Quel article de la LCEN Polradar cite-t-il en premier dans la fiche du droit d’utiliser le chiffrement ?", "juridique", "documente", "outils-chiffres-1", func(t *testing.T, a documentaryAnswer) {
			if len(a.Results) != 1 || a.Results[0].Sources[0].Passage != "LCEN, art. 30 I" {
				t.Fatal(a)
			}
		}},
		{"Quel est le passage source de melenchon-education-2 ?", "source", "documente", "melenchon-education-2", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if r.Version != "melenchon-education-2-v3" || r.Person != "melenchon" || !strings.Contains(r.Title, "élèves par classe") ||
				!strings.Contains(r.Sources[0].URL, "#:~:text=R%C3%A9duire%20partout%20les%20effectifs%20par%20classe") {
				t.Fatal(r)
			}
		}},
		{"Version 3 de la fiche melenchon-education-2", "historique", "documente", "melenchon-education-2", func(t *testing.T, a documentaryAnswer) {
			if r := a.Results[0]; r.Kind != "observation" || !strings.HasSuffix(r.URL, "/#version-3") || !strings.Contains(r.Title, "élèves par classe") {
				t.Fatal(r)
			}
		}},
		{"Dans la première version de la fiche « Reconstituer Fret SNCF », quel auteur est indiqué ? Quel type de proposition Polradar lui attribue-t-il ?", "historique", "documente", "ps-reconstituer-fret-sncf", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if r.Version != "ps-reconstituer-fret-sncf-v1" || r.Author != "Parti socialiste" || r.Status != "parti" {
				t.Fatal(r)
			}
		}},
		{"Vérifie la déclaration farandou-chomage-t3-2026", "verification", "documente", "farandou-chomage-t3-2026", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if len(r.Facts) != 2 || len(r.Sources) != 2 || r.Facts[1].Value != "8.2" || r.Sources[1].URL != "https://www.insee.fr/fr/statistiques/9118603" {
				t.Fatal(r)
			}
		}},
		{"Quels chiffres pour la commune de Paris, code Insee 75056 ?", "territoire", "documente", "75056", func(t *testing.T, a documentaryAnswer) {
			if r := a.Results[0]; r.Title != "Paris" || len(r.Facts) != 2 || r.Facts[0].Period != "2025-01-01" || r.Facts[1].Period != "2024" {
				t.Fatal(r)
			}
		}},
		{"Que propose Fabien Roussel sur le droit de préemption des salariés pour reprendre leur entreprise en coopérative ?", "proposition", "documente", "roussel-ess-preemption-salaries-cooperative", func(t *testing.T, a documentaryAnswer) {
			r := a.Results[0]
			if r.Author != "Parti communiste français" || r.Person != "roussel" || r.Status != "parti" || len(r.Sources) != 1 ||
				r.Sources[0].ID != "pcf-economie-sociale-solidaire" || !strings.HasSuffix(r.Sources[0].URL, "#page=8") || r.Sources[0].Passage == "" {
				t.Fatal(r)
			}
		}},
		{"Que propose Fabien Roussel sur le droit de préemption des salariés pour reprendre leur entreprise en coopérative avec un seuil de 500 salariés ?", "proposition", "sans-resultat", "", nil},
		{"Comment comparer les candidats ?", "comparaison", "ambigu", "", nil},
		{"Quel vote de Raphaël Glucksmann au Parlement européen le 18 mars 2024 ?", "scrutin", "hors-perimetre", "", nil},
		{"Qui va gagner la présidentielle ?", "inconnue", "hors-perimetre", "", nil},
	} {
		t.Run(tc.question, func(t *testing.T) {
			v, empty, err := c.answer(answerArgs{Question: tc.question, ExpectedRevision: c.commit})
			if err != nil {
				t.Fatal(err)
			}
			a := v.(documentaryAnswer)
			if a.State != tc.state || a.Intent != tc.intent || a.Title == "" || a.Explanation == "" || len(a.Results) > answerLimit || empty != (len(a.Results) == 0) {
				t.Fatalf("état ou intention : %+v", a)
			}
			if tc.id != "" && (empty || a.Results[0].ID != tc.id) {
				t.Fatalf("première pièce : %+v", a.Results)
			}
			for _, row := range a.Results {
				if len(row.Sources) > answerSourceLimit || len(row.Facts) > answerFactLimit {
					t.Fatal("projection trop grande", row.ID)
				}
				for _, fact := range row.Facts {
					found := false
					for _, source := range row.Sources {
						found = found || fact.SourceID == source.ID && source.URL != ""
					}
					if !found {
						t.Fatal("valeur sans référence", fact)
					}
				}
			}
			if tc.check != nil {
				tc.check(t, a)
			}
		})
	}
}
