package main

import (
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"
)

func TestPollComparisonRejectsMixedEditions(t *testing.T) {
	root := fixture(t)
	if err := os.WriteFile(filepath.Join(root, "api", "contrat-donnees.json"), []byte(`{"version":1,"collections":{"corpus":1,"comparaisons-sondages":1}}`), 0644); err != nil {
		t.Fatal(err)
	}
	file := filepath.Join(root, "api", "scenarios-sondages.json")
	const beginning = `{"version":1,"windowDays":45,"weighting":"test","comparisons":[{"id":"hypothese","label":"Hypothèse"}],"sourceCommit":"`
	for _, tt := range []struct {
		name, rev string
		status    int
	}{
		{"édition cohérente", strings.Repeat("a", 40), 200},
		{"autre édition", strings.Repeat("b", 40), 503},
	} {
		t.Run(tt.name, func(t *testing.T) {
			if err := os.WriteFile(file, []byte(beginning+tt.rev+`"}`), 0644); err != nil {
				t.Fatal(err)
			}
			h := handler(&store{root: root}, openUsage(t.TempDir(), time.Now()))
			response := call(h, http.MethodGet, "/api/v1/donnees/comparaisons-sondages/hypothese", "", nil)
			if response.Code != tt.status {
				t.Fatalf("état de la collection : %d", response.Code)
			}
		})
	}
}

func TestPublishedPollComparisonParity(t *testing.T) {
	root := publishedSite(t)
	data := &store{root: root}
	c, err := data.load()
	if err != nil {
		t.Fatal(err)
	}
	if c.contract.major("comparaisons-sondages") != dataMajor {
		t.Skip("édition antérieure à l’exposition des comparaisons dans le service")
	}
	var report struct {
		SourceCommit string
		WindowDays   int
		Weighting    string
		Comparisons  []map[string]any
	}
	if err := readData(filepath.Join(root, "api", "scenarios-sondages.json"), 1<<20, &report); err != nil ||
		report.SourceCommit != c.commit || len(report.Comparisons) == 0 {
		t.Fatalf("export de la comparaison : %v", err)
	}
	h := handler(data, openUsage(t.TempDir(), time.Now()))
	const collectionPath = "/api/v1/donnees/comparaisons-sondages"
	list := call(h, http.MethodGet, collectionPath, "", nil)
	var catalogue output
	if list.Code != 200 || json.Unmarshal(list.Body.Bytes(), &catalogue) != nil ||
		catalogue.Commit != c.commit || catalogue.Data.(map[string]any)["total"] != float64(len(report.Comparisons)) {
		t.Fatalf("liste des hypothèses : %d %s", list.Code, list.Body.String())
	}
	for _, comparison := range report.Comparisons {
		id := comparison["id"].(string)
		t.Run(id, func(t *testing.T) {
			rest := call(h, http.MethodGet, collectionPath+"/"+id+"?expectedRevision="+c.commit, "", nil)
			mcp := runTool(h, "polradar_donnees", map[string]string{"collection": "comparaisons-sondages", "id": id, "expectedRevision": c.commit})
			var restResponse output
			var mcpResponse struct {
				Result struct {
					IsError           bool
					StructuredContent output
				}
			}
			if rest.Code != 200 || mcp.Code != 200 || json.Unmarshal(rest.Body.Bytes(), &restResponse) != nil ||
				json.Unmarshal(mcp.Body.Bytes(), &mcpResponse) != nil || mcpResponse.Result.IsError ||
				!reflect.DeepEqual(restResponse, mcpResponse.Result.StructuredContent) || restResponse.Commit != report.SourceCommit {
				t.Fatalf("parité des transports : %d %d", rest.Code, mcp.Code)
			}
			result := restResponse.Data.(map[string]any)
			method := map[string]any{
				"fenetreJours": float64(report.WindowDays), "ponderation": report.Weighting, "export": site + "/api/scenarios-sondages.json",
			}
			if !reflect.DeepEqual(result["publication"], comparison) || !reflect.DeepEqual(result["methodeComparative"], method) ||
				result["rubrique"] != site+"/sondages/comparer/#"+id {
				t.Fatal("une hypothèse, ses notices, son résultat ou sa méthode diffèrent de l’export des graphiques")
			}
		})
	}
}
