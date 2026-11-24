package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// Re-encode as a client would so assertions cover the public field names.
func decoded(t *testing.T, value any) map[string]any {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var out map[string]any
	if err = json.Unmarshal(data, &out); err != nil {
		t.Fatal(err)
	}
	return out
}

func TestPublishedChangeClassification(t *testing.T) {
	c, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	wanted := map[string]bool{"retailleau-institutions-assistant-ia-agents-v2": false, "retailleau-institutions-derogations-ia-rgpd-v2": false}
	rows := func(a changeArgs) []map[string]any {
		t.Helper()
		var all []map[string]any
		for {
			v, _, e := c.changes(a)
			if e != nil {
				t.Fatal(e)
			}
			r := decoded(t, v)
			for _, raw := range r["resultats"].([]any) {
				all = append(all, raw.(map[string]any))
			}
			if r["suivant"] == nil {
				break
			}
			a.Offset = int(r["suivant"].(float64))
			a.ExpectedRevision = c.commit
		}
		return all
	}
	for _, v := range rows(changeArgs{Kind: "programme", Candidate: "retailleau", DateBasis: "observation", From: "2026-11-24", To: "2026-11-24"}) {
		id, _ := v["id"].(string)
		if previous, ok := wanted[id]; ok {
			if previous || v["dateObservation"] != "2026-11-24" || v["nature"] != "programme" {
				t.Fatalf("classification %s", id)
			}
			if c.contract != nil && v["dateDocument"] != "2026-11-23" {
				t.Fatal("date document", id, v["dateDocument"])
			}
			before, after := v["avant"].(map[string]any), v["apres"].(map[string]any)
			if len(after["sources"].([]any)) == 0 || len(before["sources"].([]any)) == 0 || reflect.DeepEqual(before, after) {
				t.Fatal("instantanés", id)
			}
			wanted[id] = true
		}
	}
	for id, ok := range wanted {
		if !ok {
			t.Fatal("programme absent", id)
		}
	}
	for _, v := range rows(changeArgs{Kind: "redaction", Candidate: "retailleau"}) {
		if _, wrong := wanted[v["id"].(string)]; wrong {
			t.Fatal("programme sous rédaction")
		}
	}
	if c.contract != nil {
		doc := rows(changeArgs{Kind: "programme", DateBasis: "document", From: "2026-11-23", To: "2026-11-23", Candidate: "retailleau"})
		for id := range wanted {
			n := 0
			for _, v := range doc {
				if v["id"] == id {
					n++
				}
			}
			if n != 1 {
				t.Fatal("filtre document", id, n)
			}
		}
	}
	corrected := false
	for _, v := range rows(changeArgs{Kind: "correction", Candidate: "philippe"}) {
		if v["id"] == "philippe-fiscalite-1-v2" && v["nature"] == "correction" && v["avant"] != nil {
			corrected = true
		}
	}
	if !corrected {
		t.Fatal("correction perdue")
	}
	multi := false
	for _, v := range rows(changeArgs{Kind: "programme"}) {
		if v["before"] != nil && v["after"] != nil && v["url"] != nil {
			multi = true
			break
		}
	}
	if !multi {
		t.Fatal("trajectoire documentée absente")
	}
}

func TestPublishedCurrentAndHistoricalContext(t *testing.T) {
	c, e := (&store{root: publishedSite(t)}).load()
	if e != nil {
		t.Fatal(e)
	}
	v, empty, e := c.detail(measureArgs{ID: "philippe-fiscalite-1", Version: 1})
	if e != nil || empty {
		t.Fatal(e)
	}
	old := decoded(t, v)
	if !strings.HasSuffix(old["url"].(string), "/#version-1") || old["statutCandidatureActuel"] != old["statutCandidature"] || !reflect.DeepEqual(old["liensDossierCourant"], old["liensDossier"]) {
		t.Fatal("contexte de la version")
	}
	v, empty, e = c.votes(voteArgs{Theme: "non-classe"})
	if e != nil || empty {
		t.Fatal(e)
	}
	for _, row := range decoded(t, v)["resultats"].([]any) {
		r := row.(map[string]any)
		if r["measureId"] != nil || r["relation"] != nil || r["rollCall"] == nil {
			t.Fatal("scrutin indépendant")
		}
	}
	const id = "fiscalite-csg-salaires"
	for _, test := range []struct {
		size  int
		fetch func(pageArgs) (any, bool, error)
	}{
		{4, func(p pageArgs) (any, bool, error) { return c.question(questionArgs{ID: id, pageArgs: p}) }},
		{3, func(p pageArgs) (any, bool, error) {
			return c.compare(compareArgs{Question: id, Candidates: []string{"attal", "ruffin", "glucksmann", "lisnard", "melenchon", "philippe"}, pageArgs: p})
		}},
	} {
		v, _, err := test.fetch(pageArgs{})
		if err != nil {
			t.Fatal(err)
		}
		first := decoded(t, v)
		if int(first["suivant"].(float64)) != test.size {
			t.Fatal("taille de page")
		}
		v, _, err = test.fetch(pageArgs{Offset: test.size, ExpectedRevision: c.commit})
		if err != nil {
			t.Fatal(err)
		}
		if decoded(t, v)["offset"].(float64) != float64(test.size) {
			t.Fatal("suite")
		}
		if _, _, err = test.fetch(pageArgs{Offset: test.size, ExpectedRevision: strings.Repeat("f", 40)}); err == nil {
			t.Fatal("révision périmée")
		}
		v, empty, err = test.fetch(pageArgs{Offset: 9000})
		p := decoded(t, v)
		if err != nil || !empty || p["finDeListe"] != true || p["aucunResultat"] != false {
			t.Fatal("fin de liste")
		}
	}
}

func TestCollectionVersionsAndBoundaries(t *testing.T) {
	root := t.TempDir()
	api := filepath.Join(root, "api")
	if e := os.Mkdir(api, 0700); e != nil {
		t.Fatal(e)
	}
	if v, e := loadContract(root); e != nil || v.check("corpus") != nil {
		t.Fatal("compatibilité 1.1")
	}
	path := filepath.Join(api, "contrat-donnees.json")
	write := func(data string) {
		if e := os.WriteFile(path, []byte(data), 0600); e != nil {
			t.Fatal(e)
		}
	}
	write(`{"version":2,"collections":{}}`)
	if _, e := loadContract(root); !errors.Is(e, invalidCorpus) {
		t.Fatal("contrat inconnu accepté")
	}
	write(`{"version":1,"collections":{"corpus":1,"territoires":2}}`)
	v, e := loadContract(root)
	if e != nil || v.check("corpus") != nil || !errors.Is(v.check("territoires"), invalidCorpus) || !errors.Is(v.check("dossiers"), invalidCorpus) {
		t.Fatal("isolation des collections")
	}
	snap := snapshot{contract: v, root: root}
	if _, _, e := snap.territory(territoryArgs{"75056"}); e == nil || !strings.Contains(e.Error(), "territoires") {
		t.Fatal("état précis")
	}
	for _, limit := range []int{corpusLimit, dossiersLimit, territoriesLimit} {
		for _, delta := range []int{-1, 0, 1} {
			payload := append([]byte("{}"), bytes.Repeat([]byte(" "), limit+delta-2)...)
			if e := os.WriteFile(path, payload, 0600); e != nil {
				t.Fatal(e)
			}
			var dst map[string]any
			if e := readData(path, int64(limit), &dst); (e != nil) != (delta > 0) {
				t.Fatalf("plafond %d %+d: %v", limit, delta, e)
			}
		}
	}
}
