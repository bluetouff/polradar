package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"reflect"
	"testing"
	"time"
)

func TestPublishedProofRelations(t *testing.T) {
	s := &store{root: publishedSite(t)}
	c, err := s.load()
	if err != nil {
		t.Fatal(err)
	}
	h := handler(s, openUsage(t.TempDir(), time.Now()))
	const path = "/api/v1/donnees/relations"
	const measure = "melenchon-education-2"
	if c.contract.major("relations") == 0 {
		args := dataArgs{Collection: "relations", Query: measure, ExpectedRevision: c.commit}
		if _, _, err := c.publicData(args); !errors.Is(err, invalidCorpus) {
			t.Fatalf("La collection absente doit produire une erreur de contrat: %v", err)
		}
		rest := call(h, http.MethodGet, path+"?query="+url.QueryEscape(measure), "", nil)
		if rest.Code != http.StatusServiceUnavailable {
			t.Fatalf("Statut de la collection absente: %d", rest.Code)
		}
		var rpc struct {
			Result struct{ IsError bool }
		}
		remote := runTool(h, "polradar_donnees", map[string]string{
			"collection": "relations", "query": measure, "expectedRevision": c.commit,
		})
		if json.Unmarshal(remote.Body.Bytes(), &rpc) != nil || !rpc.Result.IsError {
			t.Fatal("Le MCP doit signaler l’absence de la collection dans cette édition")
		}
		return
	}
	for _, query := range []string{measure, measure + "-v3"} {
		a := dataArgs{Collection: "relations", Query: query, ExpectedRevision: c.commit}
		value, empty, err := c.publicData(a)
		if err != nil || empty {
			t.Fatalf("Relations de %s indisponibles: %v", query, err)
		}
		rows := value.(map[string]any)["publications"].([]record)
		valid := false
		for _, row := range rows {
			if row.str("qualification") == "reponse" && row.str("versionCitee") == measure+"-v3" {
				valid = len(row["sources"]) > 2
			}
		}
		if !valid {
			t.Fatal("La réponse, sa version ou le passage manque")
		}
		rest := call(h, http.MethodGet, path+"?query="+url.QueryEscape(query), "", nil)
		var api output
		if rest.Code != http.StatusOK || json.Unmarshal(rest.Body.Bytes(), &api) != nil || api.Commit != c.commit {
			t.Fatalf("Réponse REST inexploitable: %d", rest.Code)
		}
		remote := runTool(h, "polradar_donnees", map[string]string{
			"collection": "relations", "query": query, "expectedRevision": c.commit,
		})
		var rpc struct {
			Result struct {
				IsError           bool
				StructuredContent output
			}
		}
		if json.Unmarshal(remote.Body.Bytes(), &rpc) != nil || rpc.Result.IsError ||
			!reflect.DeepEqual(rpc.Result.StructuredContent, api) {
			t.Fatal("Le dossier REST diffère du relevé MCP")
		}
	}
	if _, empty, err := c.publicData(dataArgs{Collection: "relations", Query: "question-sans-relation"}); err != nil || !empty {
		t.Fatalf("Le dossier absent doit rester vide: %v", err)
	}
}
