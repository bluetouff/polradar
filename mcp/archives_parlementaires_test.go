package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"
)

func TestPublishedArchivesParlementaires(t *testing.T) {
	s := &store{root: publishedSite(t)}
	c, err := s.load()
	if err != nil {
		t.Fatal(err)
	}
	if c.contract.major("senat") != dataMajor || c.contract.major("parlement-europeen") != dataMajor {
		t.Skip("édition antérieure aux registres du Sénat et du Parlement européen")
	}
	for _, act := range []struct {
		collection, id, person, vote, mandate string
		yes, no, abstain                      int
	}{
		{"senat", "senat-2022-233", "04033B", "pour", "51908", 201, 115, 29},
		{"parlement-europeen", "MTG-PL-2024-03-13-DEC-166377", "197694", "pour", "membership/197694-f-154607", 262, 351, 8},
	} {
		v, empty, e := c.publicData(dataArgs{Collection: act.collection, ID: act.id})
		if empty || e != nil {
			t.Fatal(act.id, e)
		}
		raw, _, e := c.resource("donnees/"+act.collection+"/"+act.id, nil)
		if e != nil || !reflect.DeepEqual(v, raw) {
			t.Fatal("écart entre REST et MCP", act.id)
		}
		d := decoded(t, v)
		p := d["publication"].(map[string]any)
		position := p["positions"].([]any)[0].(map[string]any)
		person := d["personnes"].(map[string]any)[act.person].(map[string]any)
		if p["pour"] != float64(act.yes) || p["contre"] != float64(act.no) || p["abstentions"] != float64(act.abstain) || position["vote"] != act.vote || position["personne"] != act.person || position["mandat"] != act.mandate || person["candidat"] != position["candidat"] {
			t.Fatal("écart avec la source institutionnelle", act.id)
		}
		if p["source"] == "" || d["jeuVerifieLe"] == "" || d["droitsSource"].(map[string]any)["licence"] == "" {
			t.Fatal("provenance absente", act.id)
		}
	}
	index, err := c.archiveIndex()
	if err != nil {
		t.Fatal(err)
	}
	euroTotal := 0
	for _, lot := range index.Lots {
		if lot.Institution == "Parlement européen" {
			euroTotal += lot.Nombre
		}
	}
	for _, test := range []struct {
		c, p  string
		total int
	}{
		{"senat", "", 673}, {"senat", "2006", 129}, {"senat", "2022", 331}, {"senat", "2023", 213},
		{"parlement-europeen", "", euroTotal}, {"parlement-europeen", "2024-03-12", 0}, {"parlement-europeen", "2024-03-13", 132},
	} {
		v, empty, e := c.publicData(dataArgs{Collection: test.c, Periode: test.p})
		if e != nil || empty != (test.total == 0) {
			t.Fatal(test, e)
		}
		d := decoded(t, v)
		l := d["publications"].([]any)
		if d["total"] != float64(test.total) || len(l) != min(15, test.total) || d["couverture"] != "periodes-consultees" {
			t.Fatal("comptage", test)
		}
		if test.total == 0 && d["releve"].(map[string]any)["scrutinsNominauxExamines"] != 33.0 {
			t.Fatal("étendue du relevé du 12 mars")
		}
		v, empty, e = c.publicData(dataArgs{Collection: test.c, Periode: test.p, Offset: 100000})
		if e != nil || !empty || decoded(t, v)["offset"] != float64(test.total) {
			t.Fatal("fin de pagination", test)
		}
	}
	for _, test := range []struct{ c, p, id, status string }{
		{"senat", "2007", "", "periode-non-couverte"},
		{"parlement-europeen", "2024-03-18", "", "periode-non-couverte"},
		{"senat", "", "senat-2022-99999", "aucune-mention-dans-la-selection"},
		{"senat", "", "MTG-PL-2024-03-13-DEC-166377", "identifiant-inconnu"},
		{"parlement-europeen", "", "senat-2022-233", "identifiant-inconnu"},
	} {
		v, empty, e := c.publicData(dataArgs{Collection: test.c, Periode: test.p, ID: test.id})
		if !empty || e != nil {
			t.Fatal(test, e)
		}
		d := decoded(t, v)
		if d["couverture"] != test.status || d["publication"] != nil {
			t.Fatal("qualification", test)
		}
		if _, ok := d["total"]; ok {
			t.Fatal("total attribué à une donnée manquante", test)
		}
	}
	for _, a := range []dataArgs{
		{Collection: "senat", Periode: "../2006"}, {Collection: "parlement-europeen", Periode: "2024-02-31"},
		{Collection: "senat", Periode: "2022", ID: "senat-2022-233"}, {Collection: "parlement", Periode: "2022"},
		{Collection: "senat", Offset: 100001}, {Collection: "senat", Query: "retraites"},
	} {
		if _, _, e := c.publicData(a); e == nil {
			t.Fatal("filtre accepté", a)
		}
	}
	h := handler(s, openUsage(t.TempDir(), time.Now()))
	for _, test := range []struct {
		path   string
		status int
	}{
		{"/senat/senat-2022-233", 200}, {"/parlement-europeen/MTG-PL-2024-03-13-DEC-166377", 200},
		{"/parlement-europeen?periode=2024-03-12", 200}, {"/parlement-europeen?periode=2024-03-18", 200},
		{"/senat/senat-2022-99999", 404}, {"/senat/senat-2022-233?periode=2022", 400},
		{"/senat?periode=2022&periode=2023", 400}, {"/parlement?periode=2022", 400},
		{"/senat?periode=2022&expectedRevision=0000000000000000000000000000000000000000", 409},
	} {
		x := call(h, "GET", "/api/v1/donnees"+test.path, "", nil)
		if x.Code != test.status {
			t.Fatalf("%s : %d", test.path, x.Code)
		}
	}
}

func TestContratEtBornesDesArchives(t *testing.T) {
	var previous *dataContract
	for _, kind := range []string{"senat", "parlement-europeen"} {
		if previous.major(kind) != 0 {
			t.Fatal("nouvelle collection déclarée sur ancienne édition")
		}
		if _, _, err := (&snapshot{}).publicData(dataArgs{Collection: kind}); !errors.Is(err, invalidCorpus) {
			t.Fatal("réponse ancienne édition", err)
		}
	}
	root := t.TempDir()
	dir := filepath.Join(root, "api", "parlement", "archives")
	if e := os.MkdirAll(dir, 0700); e != nil {
		t.Fatal(e)
	}
	path := filepath.Join(dir, "index.json")
	ix := map[string]any{"version": 1, "consultation": "2026-11-24", "droitsSources": map[string]any{"senat": map[string]any{"licence": "https://data.senat.fr/licence/"}}, "personnes": map[string]any{"04033B": map[string]any{"candidat": "retailleau"}}, "total": 1, "lots": []archivePart{{ID: "senat-../2006", Institution: "Sénat", Nombre: 1, Mentions: 1, Source: "source"}}}
	raw, _ := json.Marshal(ix)
	c := snapshot{root: root}
	if e := os.WriteFile(path, raw, 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := c.archiveIndex(); !errors.Is(e, invalidCorpus) {
		t.Fatal("chemin de lot inconnu accepté")
	}
	if e := os.WriteFile(path, bytes.Repeat([]byte(" "), 96<<10+1), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := c.archiveIndex(); !errors.Is(e, invalidCorpus) {
		t.Fatal("index surdimensionné accepté")
	}
	if _, ok := archivePeriod("inconnue", "senat-2022"); ok {
		t.Fatal("institution inconnue")
	}
	p := archivePart{ID: "senat-2022", Nombre: 1}
	chunk := filepath.Join(dir, p.ID+".json")
	data := map[string]any{"version": 1, "periode": p.ID, "scrutins": []map[string]any{{"institution": "parlement-europeen", "id": "MTG-PL-2024-12-19-DEC-171398", "date": "2024-12-19", "source": "source", "objet": "résolution"}}}
	raw, _ = json.Marshal(data)
	if e := os.WriteFile(chunk, raw, 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := c.archiveRows(p); !errors.Is(e, invalidCorpus) {
		t.Fatal("institution erronée acceptée")
	}
	if e := os.WriteFile(chunk, bytes.Repeat([]byte(" "), 2<<20+1), 0600); e != nil {
		t.Fatal(e)
	}
	if _, e := c.archiveRows(p); !errors.Is(e, invalidCorpus) {
		t.Fatal("lot surdimensionné accepté")
	}
}
