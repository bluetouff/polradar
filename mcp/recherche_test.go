package main

import "testing"

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
