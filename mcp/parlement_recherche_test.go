package main

import (
	"encoding/json"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

func TestActSearchSitesMCPREST(t *testing.T) {
	root := publishedSite(t)
	if _, err := os.Stat(filepath.Join(root, "api", "parlement", "recherche.json")); os.IsNotExist(err) {
		t.Skip("édition précédente du registre")
	}
	c, err := (&store{root: root}).load()
	if err != nil {
		t.Fatal(err)
	}
	get := func(a dataArgs) map[string]any {
		t.Helper()
		a.Collection = "parlement"
		v, _, e := c.publicData(a)
		if e != nil {
			t.Fatal(e)
		}
		return decoded(t, v)
	}
	for _, test := range []struct {
		a dataArgs
		q url.Values
	}{
		{dataArgs{Query: "CETA", Institution: "parlement-europeen", Position: "contre", Candidat: "melenchon"}, url.Values{"query": {"CETA"}, "institution": {"parlement-europeen"}, "position": {"contre"}, "candidat": {"melenchon"}}},
		{dataArgs{Nature: "cosignature", Candidat: "retailleau"}, url.Values{"nature": {"cosignature"}, "candidat": {"retailleau"}}},
		{dataArgs{Debut: "2026-11-04", Fin: "2026-11-04", Institution: "assemblee"}, url.Values{"debut": {"2026-11-04"}, "fin": {"2026-11-04"}, "institution": {"assemblee"}}},
	} {
		want := get(test.a)
		value, _, err := c.resource("donnees/parlement", test.q)
		if err != nil || !reflect.DeepEqual(want, decoded(t, value)) {
			t.Fatalf("désaccord transport : %v", err)
		}
	}
	j := get(dataArgs{Query: "CETA", Institution: "parlement-europeen", Position: "contre", Candidat: "melenchon"})
	pubs := j["publications"].([]any)
	b := pubs[0].(map[string]any)
	if len(pubs) != 1 || b["id"] != "pe8-20170215-ceta" || len(b["mentions"].([]any)) != 3 || b["source"] == "" {
		t.Fatal("CETA", b)
	}
	// A senator's vote and another senator's signature must never be combined.
	test := actRow{Institution: "senat", Nature: "depot", Mentions: [][3]string{{"a", "primo-signataire", "signature"}, {"b", "coauteur", "signature"}}}
	if matchAct(&test, dataArgs{Candidat: "a", Nature: "cosignature"}, nil) || !matchAct(&test, dataArgs{Candidat: "b", Nature: "cosignature"}, nil) {
		t.Fatal("rôle attribué à une autre personne")
	}
	distinct := actRow{Nature: "vote", Mentions: [][3]string{{"a", "contre", "vote"}, {"b", "pour", "vote"}, {"a", "pour", "note"}}}
	if matchAct(&distinct, dataArgs{Candidat: "a", Position: "pour"}, nil) {
		t.Fatal("intention confondue avec un vote")
	}
	for _, d := range []struct{ day, coverage string }{{"2024-03-13", "seance-examinee"}, {"2017-02-15", "scrutin-isole"}, {"2020-06-01", "periode-hors-registre"}} {
		out := get(dataArgs{Debut: d.day, Fin: d.day, Institution: "parlement-europeen", Candidat: "durif"})
		if out["total"] != 0.0 || out["couverture"] != d.coverage {
			t.Fatal(out)
		}
	}
	all := get(dataArgs{Recherche: true})
	if all["total"] != 8203.0 || len(all["publications"].([]any)) != 15 {
		t.Fatal("borne ou décompte", all["total"])
	}
	bytes, _ := json.Marshal(all)
	t.Logf("Première page publique : %d octets, %d résultats", len(bytes), len(all["publications"].([]any)))
	x, e := c.actIndex()
	if e != nil {
		t.Fatal(e)
	}
	size, err := os.Stat(filepath.Join(root, "api", "parlement", "recherche.json"))
	if err != nil || size.Size() > 6<<20 {
		t.Fatal("taille", err)
	}
	t.Logf("Index statique : %d octets, %d actes", size.Size(), len(x.Actes))
	if get(dataArgs{Recherche: true, Offset: 100000})["offset"] != float64(len(x.Actes)) {
		t.Fatal("offset hors borne")
	}
	if get(dataArgs{ID: "VTANR5L17V489"})["publication"].(map[string]any)["totaux"].(map[string]any)["contre"] != 162.0 {
		t.Fatal("scrutin XVIIe historique")
	}
	for _, args := range []dataArgs{{Institution: "x"}, {Debut: "2025-02-30"}, {Debut: "2025-02-02", Fin: "2025-01-01"}, {Position: "absent"}, {Recherche: true, ID: "id"}, {Recherche: true, Candidat: "inconnu"}} {
		args.Collection = "parlement"
		if _, _, e := c.publicData(args); e == nil {
			t.Fatal("filtre invalide", args)
		}
	}
}
