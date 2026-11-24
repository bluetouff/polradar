package main

import (
	"encoding/json"
	"html"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestPublishedParity(t *testing.T) {
	root := publishedSite(t)
	c, err := (&store{root: root}).load()
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{"melenchon-travail-1", "groupe-rn-sante-cumul-soignants", "tondelier-sante-ordonnance-verte", "ruffin-education-laboratoire-ia", "attal-csg-salaires"} {
		t.Run(id, func(t *testing.T) {
			i, ok := c.byID[id]
			if !ok {
				t.Fatal("fiche absente")
			}
			m := c.Measures[i]
			got, empty, err := c.detail(measureArgs{ID: id})
			if err != nil || empty {
				t.Fatal("détail", err)
			}
			row := got.(map[string]any)
			page, err := os.ReadFile(filepath.Join(root, "mesures", id, "index.html"))
			if err != nil {
				t.Fatal(err)
			}
			body := html.UnescapeString(string(page))
			if !strings.Contains(body, m.Title) || !strings.Contains(body, m.DisplayAuthor) || !reflect.DeepEqual(row["montants"], m.Amounts) || !reflect.DeepEqual(row["financement"], m.Financing) {
				t.Fatal("écart de texte, d’auteur ou de montant")
			}
			for _, r := range m.SourceRefs {
				s := c.bySource[r.SourceID]
				citation := c.cited(r)
				if !strings.Contains(body, citation["url"].(string)) || !reflect.DeepEqual(citation["anneePublication"], s.PublishedYear) {
					t.Fatal("écart de source", s.ID)
				}
			}
			if id == "groupe-rn-sante-cumul-soignants" && (m.Scope != "parti" || len(m.BudgetEntryIDs) == 0 || m.DisplayAuthor == c.people[m.Candidate].Name) {
				t.Fatal("attribution ou chiffrage")
			}
			if id == "melenchon-travail-1" && (len(m.Amounts) == 0 || len(c.history[id]) < 2) {
				t.Fatal("montant ou historique absent")
			}
			if id == "ruffin-education-laboratoire-ia" && row["dateRetrait"].(*string) == nil {
				t.Fatal("retrait absent")
			}
			if id == "tondelier-sante-ordonnance-verte" {
				s := c.bySource[m.SourceRefs[0].SourceID]
				if s.Published != nil || s.PublishedYear == nil {
					t.Fatal("précision de date")
				}
			}
			for _, v := range c.history[id] {
				past, empty, err := c.detail(measureArgs{ID: id, Version: v.Number})
				if err != nil || empty {
					t.Fatal(err)
				}
				previous := past.(map[string]any)
				if previous["description"] != v.Snapshot.Description || previous["auteur"] != v.Author || !reflect.DeepEqual(previous["montants"], v.Snapshot.Amounts) {
					t.Fatal("version", v.ID)
				}
			}
		})
	}
	_, empty, err := c.search(searchArgs{Candidate: "ruffin", CandidateStatus: "actives"})
	if !empty || err != nil {
		t.Fatal("filtre de retrait")
	}
	_, empty, err = c.search(searchArgs{Candidate: "ruffin", CandidateStatus: "retirees"})
	if empty || err != nil {
		t.Fatal("accès aux fiches retirées")
	}
	if _, _, err := c.search(searchArgs{Theme: "retraites", ExpectedRevision: strings.Repeat("0", 40)}); err != errRevision {
		t.Fatal("pagination multi-révision")
	}
	poll := c.Polls[0]
	entry, _, err := c.publicData(dataArgs{Collection: "sondages", ID: poll.str("id")})
	if err != nil || len(poll["question"]) == 0 || !reflect.DeepEqual(entry.(map[string]any)["publication"].(record)["question"], poll["question"]) {
		t.Fatal("question originale")
	}
	market, _, err := c.publicData(dataArgs{Collection: "marches", ID: "kalshi"})
	if err != nil {
		t.Fatal(err)
	}
	r := market.(map[string]any)["publication"].(record)
	var contracts []record
	if json.Unmarshal(r["contracts"], &contracts) != nil {
		t.Fatal("contrats")
	}
	for _, contract := range contracts {
		if string(contract["liquidity"]) == "null" {
			return
		}
	}
	// A feed may subsequently publish all figures. No missing figure is required.
	if len(contracts) == 0 && r.str("status") == "available" {
		t.Fatal("marché disponible sans contrats")
	}
}
