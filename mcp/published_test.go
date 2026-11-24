package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

// Run the actual client transport against the HTTP handler without opening a port.
type localTransport struct{ http.Handler }

func (h localTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if err := req.Context().Err(); err != nil {
		return nil, err
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w.Result(), nil
}

func TestPublishedSDK(t *testing.T) {
	h := handler(&store{root: publishedSite(t)}, openUsage(t.TempDir(), time.Now()))
	for _, version := range []string{"2025-11-25", "2026-07-28"} {
		t.Run(version, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
			defer cancel()
			client := mcp.NewClient(&mcp.Implementation{Name: "polradar-recette", Version: "1"}, nil)
			transport := &mcp.StreamableClientTransport{Endpoint: site + endpoint, HTTPClient: &http.Client{Transport: localTransport{h}}, MaxRetries: -1, DisableStandaloneSSE: true}
			session, err := client.Connect(ctx, transport, &mcp.ClientSessionOptions{ProtocolVersion: version})
			if err != nil {
				t.Fatal(err)
			}
			defer session.Close()
			list, err := session.ListTools(ctx, nil)
			if err != nil || len(list.Tools) != len(toolNames) {
				t.Fatalf("Découverte: %v", err)
			}
			result, err := session.CallTool(ctx, &mcp.CallToolParams{Name: "polradar_corpus", Arguments: map[string]any{}})
			if err != nil || result.IsError || result.StructuredContent == nil {
				t.Fatalf("Lecture: %v", err)
			}
			cancel()
			if _, err := session.ListTools(ctx, nil); err == nil {
				t.Fatal("Annulation ignorée")
			}
		})
	}
}

func publishedSite(t *testing.T) string {
	t.Helper()
	root := os.Getenv("POLRADAR_TEST_SITE")
	if root == "" {
		t.Skip("archive vérifiée via scripts/test-mcp-release.py")
	}
	return root
}

func TestPublishedCorpus(t *testing.T) {
	root := publishedSite(t)
	c, err := (&store{root: root}).load()
	if err != nil {
		t.Fatal(err)
	}
	if want := os.Getenv("POLRADAR_TEST_COMMIT"); want != "" && c.commit != want {
		t.Fatalf("Révision inattendue %s", c.commit)
	}
	for _, m := range c.Measures {
		_, empty, err := c.detail(measureArgs{ID: m.ID})
		if empty || err != nil {
			t.Fatalf("Fiche %s illisible: %v", m.ID, err)
		}
	}
	t.Logf("%d fiches lues sur le commit %s", len(c.Measures), c.commit)
	for kind := range collections {
		t.Run(kind, func(t *testing.T) {
			seen := map[string]bool{}
			total := -1
			for offset := 0; offset == 0 || offset < total; offset += 15 {
				result, _, err := c.publicData(dataArgs{Collection: kind, Offset: offset})
				if err != nil {
					t.Fatal(err)
				}
				raw, err := json.Marshal(result)
				if err != nil {
					t.Fatal(err)
				}
				var index struct {
					Total int `json:"total"`
					Rows  []struct {
						ID string `json:"id"`
					} `json:"publications"`
				}
				if err := json.Unmarshal(raw, &index); err != nil {
					t.Fatal(err)
				}
				if total != -1 && index.Total != total {
					t.Fatal("total instable")
				}
				total = index.Total
				for _, r := range index.Rows {
					if r.ID == "" || seen[r.ID] {
						t.Fatal("identifiant vide ou en double", r.ID)
					}
					seen[r.ID] = true
					_, empty, err := c.publicData(dataArgs{Collection: kind, ID: r.ID})
					if err != nil || empty {
						t.Errorf("identifiant %s illisible: %v", r.ID, err)
					}
				}
			}
			if len(seen) != total {
				t.Fatalf("pagination %d / %d", len(seen), total)
			}
			if total <= 0 {
				t.Fatal("collection publiée vide")
			}
			t.Logf("%d identifiants", len(seen))
		})
	}
}

func TestPublishedProtocols(t *testing.T) {
	root := publishedSite(t)
	for _, version := range []string{"2025-11-25", "2026-07-28"} {
		t.Run(version, func(t *testing.T) {
			h := handler(&store{root: root}, openUsage(t.TempDir(), time.Now()))
			rpc := func(method string, params map[string]any, notify bool) map[string]any {
				t.Helper()
				hdr := map[string]string{"MCP-Protocol-Version": version}
				if version == "2026-07-28" {
					hdr["Mcp-Method"] = method
					params["_meta"] = map[string]any{"io.modelcontextprotocol/protocolVersion": version, "io.modelcontextprotocol/clientCapabilities": map[string]any{}}
					if method == "tools/call" {
						hdr["Mcp-Name"] = params["name"].(string)
					}
				}
				msg := map[string]any{"jsonrpc": "2.0", "method": method, "params": params}
				if !notify {
					msg["id"] = 1
				}
				data, err := json.Marshal(msg)
				if err != nil {
					t.Fatal(err)
				}
				res := call(h, "POST", endpoint, string(data), hdr)
				if notify {
					if res.Code != 202 {
						t.Fatalf("%s HTTP %d", method, res.Code)
					}
					return nil
				}
				if res.Code != 200 {
					t.Fatalf("%s HTTP %d", method, res.Code)
				}
				var dst struct {
					Result map[string]any
					Error  json.RawMessage
				}
				if json.Unmarshal(res.Body.Bytes(), &dst) != nil || dst.Error != nil || dst.Result == nil || dst.Result["isError"] == true {
					t.Fatalf("%s: réponse inattendue (%q)", method, dst.Error)
				}
				return dst.Result
			}
			if version == "2025-11-25" {
				x := rpc("initialize", map[string]any{"protocolVersion": version, "clientInfo": map[string]any{"name": "Polradar-recette", "version": "1"}, "capabilities": map[string]any{}}, false)
				if x["protocolVersion"] != version {
					t.Fatal("négociation")
				}
				rpc("notifications/initialized", map[string]any{}, true)
			} else {
				x := rpc("server/discover", map[string]any{}, false)
				if x["supportedVersions"] == nil {
					t.Fatal("découverte")
				}
			}
			if tools, ok := rpc("tools/list", map[string]any{}, false)["tools"].([]any); !ok || len(tools) != len(toolNames) {
				t.Fatal("liste")
			}
			for _, test := range []struct {
				name string
				args map[string]any
			}{
				{"polradar_search", map[string]any{"query": "chiffrement", "limit": 1}},
				{"polradar_measure", map[string]any{"id": "herlin-semaine-40-heures"}},
				{"polradar_candidates", map[string]any{}},
				{"polradar_corpus", map[string]any{}},
				{"polradar_donnees", map[string]any{"collection": "sondages"}},
			} {
				if rpc("tools/call", map[string]any{"name": test.name, "arguments": test.args}, false)["structuredContent"] == nil {
					t.Fatal(test.name)
				}
			}
		})
	}
}
