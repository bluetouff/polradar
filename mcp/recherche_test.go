package main

import (
	"html"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// Each question was annotated by reading the candidate's entire non-archive
// theme and its cited document before running the engine. Three results maximum.
func TestPublishedRechercheAnnotee(t *testing.T) {
	c, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	if c.contract == nil {
		t.Skip("corpus antérieur aux fiches annotées")
	}
	cases := []struct {
		theme, candidate, query string
		ids                     []string
	}{
		{"retraites", "herlin", "retraite par capitalisation", []string{"herlin-capitalisation"}},
		{"travail", "kazib", "hausse des salaires", []string{"kazib-hausse-generale-salaires", "kazib-travail-smic"}},
		{"fiscalite", "kazib", "agios bancaires", []string{"kazib-credits-sans-agios"}},
		{"climat", "rohou", "transport ferroviaire", []string{"rohou-climat-ter", "rohou-climat-fret", "mei-reorienter-les-aides-aux-deplacements-interieurs-lorsquune-liaison-ferroviaire-effi"}},
		{"immigration", "herlin", "préférence nationale", []string{"herlin-preference-nationale"}},
		{"securite", "herlin", "confusion des peines", []string{"herlin-fin-confusion-peines"}},
		{"sante", "herlin", "vaccination obligatoire", []string{"herlin-lever-obligations-vaccinales"}},
		{"education", "kazib", "service national universel", []string{"kazib-refus-snu"}},
		{"institutions", "cheve", "pondération des avis", []string{"cheve-ponderation-avis-competences"}},
		{"europe", "legendre", "veto aux Nations unies", []string{"legendre-fin-veto-onu"}},
		{"logement", "herlin", "obligation de logements sociaux", []string{"herlin-abroger-obligation-logement-social"}},
		{"social", "rohou", "missions d’intérêt général", []string{"rohou-engagement-jeunes-interet-general"}},
	}
	retrieved, relevant, matched := 0, 0, 0
	for _, tc := range cases {
		expected := map[string]bool{}
		for _, id := range tc.ids {
			index, ok := c.byID[id]
			if !ok || c.Measures[index].Theme != tc.theme || c.Measures[index].Candidate != tc.candidate {
				t.Fatal("Annotation invalide", id)
			}
			expected[id] = true
		}
		v, _, e := c.search(searchArgs{Theme: tc.theme, Candidate: tc.candidate, Query: tc.query, Limit: 3})
		if e != nil {
			t.Fatal(e)
		}
		rows := v.(map[string]any)["resultats"].([]map[string]any)
		hits := 0
		for _, r := range rows {
			if expected[r["id"].(string)] {
				hits++
			}
		}
		t.Logf("%s : %d pertinents sur %d renvoyés, %d attendus", tc.theme, hits, len(rows), len(expected))
		retrieved += len(rows)
		relevant += len(expected)
		matched += hits
	}
	if retrieved == 0 || matched < 14 {
		t.Fatal("La recherche perd des fiches pertinentes du jeu annoté")
	}
	t.Logf("12 questions : %d pertinents sur %d rendus dans les trois premiers, %d attendus", matched, retrieved, relevant)
}

func TestPublishedRechercheQuestionsLibres(t *testing.T) {
	root := publishedSite(t)
	c, err := (&store{root: root}).load()
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct{ question, id, documentedSince string }{
		{"Que propose Jean-Luc Mélenchon pour les élèves par classe ?", "melenchon-education-2", "2026-11-25"},
		{"Revalorisation du salaire minimum 1 700 euros Mélenchon", "melenchon-travail-1", "2026-11-17"},
		{"Que propose Raphaël Glucksmann sur la CSG des salaires ?", "glucksmann-csg-salaires", ""},
		{"Quelles sont les propositions d’Édouard Philippe pour les départs anticipés à la retraite ?", "philippe-retraites-2", ""},
		{"Que propose David Lisnard pour le temps de travail ?", "lisnard-temps-de-travail-accords", "2026-11-25"},
		{"Comment Marine Le Pen veut-elle faire évoluer la TVA sur l’énergie ?", "lepen-climat-tva-energie", ""},
	} {
		t.Run(tc.id, func(t *testing.T) {
			if c.Meta.Edition < tc.documentedSince {
				t.Skip("Ce passage est documenté après l’édition de référence testée pour la compatibilité.")
			}
			v, empty, err := c.search(searchArgs{Query: tc.question, Mode: "preuves", Limit: 3})
			if err != nil || empty {
				t.Fatalf("Recherche vide ou en erreur : %v", err)
			}
			rows := v.(map[string]any)["resultats"].([]map[string]any)
			for i, row := range rows {
				if row["id"] != tc.id {
					continue
				}
				m := c.Measures[c.byID[tc.id]]
				page, err := os.ReadFile(filepath.Join(root, "mesures", m.ID, "index.html"))
				if err != nil {
					t.Fatal(err)
				}
				body := html.UnescapeString(string(page))
				version, ok := row["urlVersion"].(*string)
				citation := row["source"].(map[string]any)
				if !ok || version == nil || *version != measureURL(m.ID, m.Revision) ||
					!strings.Contains(body, `id="`+strings.SplitN(*version, "#", 2)[1]+`"`) ||
					!strings.Contains(body, citation["url"].(string)) ||
					citation["passage"] != m.SourceRefs[0].Locator ||
					row["auteur"] != m.DisplayAuthor || row["statut"] != m.Scope || row["resume"] == "" {
					t.Fatal("La fiche, son auteur et son passage doivent correspondre au site")
				}
				detail, empty, err := c.detail(measureArgs{ID: m.ID, ExpectedRevision: c.commit})
				if err != nil || empty {
					t.Fatal("La fiche doit être lisible sur la même édition")
				}
				proof := row["preuves"].(map[string]any)
				for _, key := range []string{"description", "chiffres", "montants", "beneficiaires", "echeance", "financement", "sources"} {
					if !reflect.DeepEqual(proof[key], detail.(map[string]any)[key]) {
						t.Errorf("Le mode preuves et la fiche divergent sur %s", key)
					}
				}
				if _, _, err := c.detail(measureArgs{ID: m.ID, ExpectedRevision: strings.Repeat("0", 40)}); err != errRevision {
					t.Fatal("Une lecture sur une autre édition doit être signalée")
				}
				t.Logf("Rang %d, version et passage vérifiés", i+1)
				return
			}
			t.Fatalf("Fiche attendue absente des trois premiers résultats : %v", rows)
		})
	}
	if _, empty, err := c.search(searchArgs{Query: "Que propose Jean-Luc Mélenchon sur les vols habités vers Neptune ?"}); err != nil || !empty {
		t.Fatal("Une question hors corpus doit rendre une recherche vide")
	}
	index, empty, err := c.search(searchArgs{Scope: "parti", Mode: "preuves"})
	if err != nil || empty {
		t.Fatal("Page de preuves illisible")
	}
	page := index.(map[string]any)
	next := page["suivant"].(*int)
	if next == nil || *next != 3 || len(page["resultats"].([]map[string]any)) != 3 {
		t.Fatal("La première page doit compter trois lignes et un repère pour la suite")
	}
}
