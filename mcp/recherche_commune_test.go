package main

import (
	"encoding/json"
	"os"
	"slices"
	"testing"
	"time"
)

func TestPublishedRechercheCommune(t *testing.T) {
	c, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	if c.contract.major("parlement") != dataMajor {
		t.Skip("édition antérieure au banc commun")
	}
	raw, err := os.ReadFile("testdata/recherche-commune.json")
	if err != nil {
		t.Fatal(err)
	}
	var suite struct {
		Version int
		Cases   []struct {
			ID, Query, Candidate, Theme, Source string
			Expected, Excluded                  []string
		}
	}
	if err := json.Unmarshal(raw, &suite); err != nil || suite.Version != 1 || len(suite.Cases) < 10 {
		t.Fatal("Banc commun absent ou incompatible", err)
	}
	passed, first, positive, reciprocal := 0, 0, 0, 0.0
	seen := map[string]bool{}
	durations := make([]time.Duration, 0, len(suite.Cases))
	for _, row := range suite.Cases {
		if row.ID == "" || seen[row.ID] || row.Query == "" || row.Expected == nil {
			t.Fatal("Cas de recherche incomplet", row.ID)
		}
		seen[row.ID] = true
		if len(row.Expected) > 0 {
			positive++
		}
		for _, id := range row.Expected {
			i, ok := c.byID[id]
			if !ok {
				t.Fatalf("%s : fiche annotée absente", row.ID)
			}
			m := c.Measures[i]
			if (row.Candidate != "" && m.Candidate != row.Candidate) ||
				(row.Theme != "" && m.Theme != row.Theme) ||
				(row.Source != "" && !slices.ContainsFunc(m.SourceRefs, func(r reference) bool { return r.SourceID == row.Source })) {
				t.Fatalf("%s : attribution ou référence annotée différente", row.ID)
			}
		}
		clock := time.Now()
		result, _, err := c.search(searchArgs{Query: row.Query, Candidate: row.Candidate, Theme: row.Theme, Limit: 5})
		durations = append(durations, time.Since(clock))
		if err != nil {
			t.Fatal(err)
		}
		rank := 0
		rows := result.(map[string]any)["resultats"].([]map[string]any)
		excluded := false
		var ids []string
		for i, match := range rows {
			id := match["id"].(string)
			ids = append(ids, id)
			if rank == 0 && slices.Contains(row.Expected, id) {
				rank = i + 1
			}
			excluded = excluded || slices.Contains(row.Excluded, id)
		}
		if (len(row.Expected) == 0 && len(rows) == 0) || (rank > 0 && !excluded) {
			passed++
		} else {
			t.Errorf("%s : résultats %v, attendus %v", row.ID, ids, row.Expected)
		}
		if rank == 1 {
			first++
		}
		if rank > 0 {
			reciprocal += 1 / float64(rank)
		}
	}
	slices.Sort(durations)
	t.Logf("Recherche commune %s : %d/%d cas, %d/%d au premier rang, MRR@5 %.3f, p50 %s, p95 %s", c.commit, passed, len(suite.Cases), first, positive,
		reciprocal/float64(positive), durations[(len(durations)-1)/2], durations[(95*len(durations)+99)/100-1])
}
