package main

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestPublishedQuestionCoverage(t *testing.T) {
	c, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	d, err := c.dossiers()
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range d.Questions {
		_, rows, err := questionByID(d, q.str("id"))
		if err != nil {
			t.Fatal(err)
		}
		seen := map[string]bool{}
		for _, r := range rows {
			id := r.str("candidate")
			if seen[id] || c.people[id].ID == "" {
				t.Fatal("dossier dupliqué ou inconnu", id)
			}
			seen[id] = true
			var items []record
			if err := json.Unmarshal(r["positions"], &items); err != nil {
				t.Fatal(err)
			}
			for _, position := range items {
				var refs []record
				if json.Unmarshal(position["sources"], &refs) != nil || len(refs) == 0 || position.str("author") == "" {
					t.Fatal("citation", q.str("id"))
				}
			}
		}
		for _, person := range c.Candidates {
			if person.WithdrawnOn == "" && !seen[person.ID] {
				t.Fatal("candidat absent", person.ID, q.str("id"))
			}
		}
	}
	if _, _, err := c.compare(compareArgs{Question: "fiscalite-csg-salaires", Candidates: []string{"attal", "attal"}}); err == nil {
		t.Fatal("doublon")
	}
	if _, _, err := c.changes(changeArgs{Kind: "programme", From: "2026-02-30"}); err == nil {
		t.Fatal("date impossible")
	}
	for _, mode := range []string{"programme", "redaction"} {
		_, empty, err := c.changes(changeArgs{Kind: mode})
		if empty || err != nil {
			t.Fatal(mode, err)
		}
	}
	for _, code := range []string{"75056", "75101", "97120", "2B033"} {
		_, empty, err := c.territory(territoryArgs{code})
		if empty || err != nil {
			t.Fatal(code, err)
		}
	}
	_, empty, err := c.territory(territoryArgs{"00000"})
	if !empty || err != nil {
		t.Fatal("code absent")
	}
	if !dateOverlaps("2022", "2022-05-01", "2022-05-02") || dateOverlaps("2022", "", "2021-12-31") {
		t.Fatal("millésime")
	}
}
func TestPublishedLexical(t *testing.T) {
	c, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	for _, q := range []string{"retraite", "suppression de la CSG", "médecins", "logement social", "chiffrement", "agriculture", "police", "1700"} {
		v, empty, err := c.search(searchArgs{Query: q, Limit: 25})
		if err != nil || empty {
			t.Fatal(q, err)
		}
		result := v.(map[string]any)
		rows := result["resultats"].([]map[string]any)
		first, _, _ := c.search(searchArgs{Query: q, Limit: 1})
		if first.(map[string]any)["resultats"].([]map[string]any)[0]["id"] != rows[0]["id"] {
			t.Fatal("ordre instable")
		}
		for _, row := range rows {
			if !strings.HasPrefix(row["source"].(map[string]any)["url"].(string), "https://") {
				t.Fatal("citation")
			}
		}
		if q == "suppression de la CSG" {
			all, _, _ := c.search(searchArgs{Query: q, Candidate: "attal"})
			if all.(map[string]any)["total"].(int) == 0 {
				t.Fatal("CSG Attal")
			}
		}
		t.Log(q, result["total"])
	}
}
