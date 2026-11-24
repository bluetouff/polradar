package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestPublishedParlement(t *testing.T) {
	c, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	if c.contract.major("parlement") != 1 {
		t.Skip("édition antérieure au registre")
	}
	detail := func(id string) map[string]any {
		t.Helper()
		v, empty, e := c.publicData(dataArgs{Collection: "parlement", ID: id})
		if e != nil || empty {
			t.Fatal(id, e)
		}
		resp := decoded(t, v)
		b := resp["publication"].(map[string]any)
		if b["id"] != id || resp["jeuVerifieLe"] == "" || resp["licenceSource"] == "" {
			t.Fatal(id, "provenance")
		}
		return b
	}
	b := detail("VTANR5L16V3213")
	totals := b["totaux"].(map[string]any)
	if totals["pour"] != 349.0 || totals["contre"] != 186.0 || totals["abstention"] != 38.0 || b["source"] != "https://www.assemblee-nationale.fr/dyn/16/scrutins/3213" {
		t.Fatal("vote immigration")
	}
	v := detail("VTANR5L16V8")
	found := false
	for _, raw := range v["positions"].([]any) {
		p := raw.(map[string]any)
		if p["candidat"] == "roussel" && p["vote"] == "pour" && p["misesAuPoint"].([]any)[0].(map[string]any)["vote"] == "non-votant" {
			found = true
		}
	}
	if !found {
		t.Fatal("mise au point écrasant le choix enregistré")
	}
	censure := detail("VTANR5L16V1240")["totaux"].(map[string]any)
	if censure["contre"] != nil || censure["abstention"] != nil {
		t.Fatal("vote inventé")
	}
	a := dataArgs{Collection: "parlement", Offset: 100000}
	row, eol, e := c.publicData(a)
	if !eol || e != nil || decoded(t, row)["total"].(float64) < 3070 {
		t.Fatal("borne")
	}
	a.ExpectedRevision = "0000000000000000000000000000000000000000"
	if _, _, e = c.publicData(a); !errors.Is(e, errRevision) {
		t.Fatal("révision")
	}
	for _, id := range []string{"../api", "VTANR5L16V999999", "VTANR5L16V0"} {
		_, empty, e := c.publicData(dataArgs{Collection: "parlement", ID: id})
		if e != nil || !empty {
			t.Fatal("résultat inattendu", id)
		}
	}
	query := "Légifrance"
	out, empty, e := c.publicData(dataArgs{Collection: "sources", Query: query})
	if e != nil || empty {
		t.Fatal(e)
	}
	rest, _, e := c.resource("donnees/sources", map[string][]string{"query": {query}})
	if e != nil || !reflect.DeepEqual(decoded(t, out), decoded(t, rest)) {
		t.Fatal("parité REST/MCP")
	}
	for _, a := range []dataArgs{{Collection: "parlement", ID: "test", Query: query}, {Collection: "sources", Query: "  "}, {Collection: "sources", ID: "source", Query: query}} {
		if _, _, e := c.publicData(a); e == nil {
			t.Fatal("paramètre invalide accepté")
		}
	}
}

func TestRegistreAncienneEditionEtFichiers(t *testing.T) {
	var prior *dataContract
	if prior.major("parlement") != 0 || prior.major("sondages") != 1 {
		t.Fatal("versions des collections antérieures")
	}
	root := t.TempDir()
	dir := filepath.Join(root, "api", "parlement")
	if e := os.MkdirAll(dir, 0700); e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(dir, "index.json")
	index := map[string]any{"version": 1, "consultation": "2026-11-24", "licenceSource": "source", "personnes": map[string]any{"a": map[string]any{}}, "lots": []map[string]any{{"mois": "../ailleurs", "nombre": 1, "plages": []map[string]int{{"legislature": 16, "premier": 1, "dernier": 1}}}}, "scrutins": 1}
	data, _ := json.Marshal(index)
	if e := os.WriteFile(path, data, 0600); e != nil {
		t.Fatal(e)
	}
	c := snapshot{root: root}
	if _, e := c.rollIndex(); e == nil {
		t.Fatal("mois non valide")
	}
	if e := os.WriteFile(path, bytes.Repeat([]byte(" "), 128<<10+1), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := c.rollIndex(); e == nil {
		t.Fatal("index surdimensionné")
	}
}
