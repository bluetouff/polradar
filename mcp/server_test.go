package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func fixture(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()
	if err := os.Mkdir(filepath.Join(dir, "api"), 0755); err != nil {
		t.Fatal(err)
	}
	put := func(name, data string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(data), 0644); err != nil {
			t.Fatal(err)
		}
	}
	put("build.json", `{"sourceCommit":"`+strings.Repeat("a", 40)+`"}`)
	put("api/corpus.json", `{"meta":{"corpusUpdated":"2026-01-02"},"candidates":[{"id":"exemple","name":"Exemple","status":"Déclarée","statusSource":"source"}],"themes":[{"id":"travail","label":"Travail"}],"sources":[{"id":"source","title":"Document de test","url":"https://example.org/programme","checked":"2026-01-02"}],"measures":[{"id":"mesure","title":"Étude de cas","description":"Service public","displayAuthor":"Collectif de test","candidate":"exemple","theme":"travail","scope":"parti","edition":"Édition de test","checked":"2026-01-02","sourceRefs":[{"sourceId":"source","fragment":"section","locator":"Section de test"}]}],"polls":[{"id":"test-sondage","scenario":"Scénario de test","noticeSource":"source","published":"2026-01-01"}]}`)
	put("api/economie.json", `{"series":[{"id":"serie","title":"Série de test","unit":"indice","observations":[["2026-01",null,"p"]],"links":{"table":"https://example.org/serie"}}]}`)
	return dir
}
func call(h http.Handler, method, path, body string, headers map[string]string) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "https://polradar.fr"+path, strings.NewReader(body))
	r.Header.Set("Accept", "application/json, text/event-stream")
	r.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		if k == "Host" {
			r.Host = v
		} else if v == "" {
			r.Header.Del(k)
		} else {
			r.Header.Set(k, v)
		}
	}
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
func rpc(h http.Handler, method string, params any) *httptest.ResponseRecorder {
	b, _ := json.Marshal(map[string]any{"jsonrpc": "2.0", "id": 1, "method": method, "params": params})
	return call(h, "POST", endpoint, string(b), nil)
}
func runTool(h http.Handler, name string, args any) *httptest.ResponseRecorder {
	return rpc(h, "tools/call", map[string]any{"name": name, "arguments": args})
}
func TestToolsAndPrivacy(t *testing.T) {
	state := t.TempDir()
	u := openUsage(state, time.Now())
	h := handler(&store{root: fixture(t)}, u)
	init := rpc(h, "initialize", map[string]any{"protocolVersion": "2025-11-25", "clientInfo": map[string]any{"name": "test", "version": "1"}, "capabilities": map[string]any{}})
	if init.Code != 200 || !bytes.Contains(init.Body.Bytes(), []byte("2025-11-25")) {
		t.Fatal(init.Code, init.Body.String())
	}
	list := rpc(h, "tools/list", map[string]any{})
	var tools struct {
		Result struct {
			Tools []struct {
				Name        string
				Annotations struct {
					ReadOnlyHint    bool
					OpenWorldHint   bool
					DestructiveHint bool
				}
			}
		}
	}
	if json.Unmarshal(list.Body.Bytes(), &tools) != nil || len(tools.Result.Tools) != len(toolNames) {
		t.Fatal(list.Body.String())
	}
	for _, v := range tools.Result.Tools {
		if !v.Annotations.ReadOnlyHint || v.Annotations.OpenWorldHint || v.Annotations.DestructiveHint {
			t.Fatal(v.Name)
		}
	}
	result := runTool(h, "polradar_search", map[string]any{"query": "etude", "candidate": "exemple"})
	for _, want := range []string{"Collectif de test", "https://example.org/programme#section", "2026-01-02"} {
		if result.Code != 200 || !strings.Contains(result.Body.String(), want) {
			t.Fatal(want, result.Body.String())
		}
	}
	runTool(h, "polradar_search", map[string]any{"query": "prive-test-introuvable"})
	runTool(h, "polradar_search", map[string]any{"limit": 99})
	runTool(h, "outil_inconnu", map[string]any{})
	for _, k := range []string{"method", "stats"} {
		if k == "method" {
			rpc(h, "tools/list", map[string]any{})
		} else {
			call(h, "GET", statsPath, "", nil)
		}
	}
	r, err := openUsage(state, time.Now()).public(time.Now())
	if err != nil || len(r.Days) != 1 || r.Days[0].counts != (counts{1, 1, 1}) {
		t.Fatalf("compteurs %+v %v", r, err)
	}
	saved, err := os.ReadFile(filepath.Join(state, "usage.json"))
	if err != nil {
		t.Fatal(err)
	}
	for _, private := range []string{"prive-test", "exemple", "etude", "jsonrpc", "outil_inconnu"} {
		if bytes.Contains(saved, []byte(private)) {
			t.Fatal("Détail de requête persisté")
		}
	}
}
func TestHTTPBoundaries(t *testing.T) {
	h := handler(&store{root: fixture(t)}, openUsage(t.TempDir(), time.Now()))
	for _, c := range []struct {
		method, path string
		headers      map[string]string
		want         int
	}{
		{"GET", endpoint, nil, 405}, {"PUT", endpoint, nil, 405}, {"POST", statsPath, nil, 405}, {"GET", "/api/mcp-other", nil, 404}, {"GET", statsPath + "?q=texte", nil, 404},
		{"GET", statsPath, map[string]string{"Origin": "https://example.org"}, 403}, {"GET", statsPath, map[string]string{"Host": "example.org"}, 403},
		{"POST", endpoint, map[string]string{"Content-Type": "text/plain"}, 415}, {"POST", endpoint, map[string]string{"Accept": "application/json"}, 406},
	} {
		w := call(h, c.method, c.path, "{}", c.headers)
		if w.Code != c.want {
			t.Errorf("%s %s %v got %d want %d", c.method, c.path, c.headers, w.Code, c.want)
		}
	}
	if w := call(h, "POST", endpoint, strings.Repeat(" ", maxBody+1), nil); w.Code != 413 {
		t.Fatal(w.Code)
	}
	limiter := new(limits)
	now := time.Now()
	for i := 0; i < 90; i++ {
		if !limiter.allow("192.0.2.1", now) {
			t.Fatal(i)
		}
	}
	if limiter.allow("192.0.2.1", now) || !limiter.allow("192.0.2.2", now) || !limiter.allow("192.0.2.1", now.Add(time.Minute)) {
		t.Fatal("quota")
	}
}
func TestPublishedCollectionsAndReleaseSwitch(t *testing.T) {
	root := t.TempDir()
	a, b := fixture(t), fixture(t)
	link := filepath.Join(root, "site")
	if err := os.Symlink(a, link); err != nil {
		t.Fatal(err)
	}
	s := store{root: link}
	c, err := s.load()
	if err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"sondages", "economie", "sondages"} {
		id := "test-sondage"
		if key == "economie" {
			id = "serie"
		}
		v, empty, err := c.publicData(dataArgs{Collection: key, ID: id})
		j, _ := json.Marshal(v)
		if err != nil || empty || !strings.Contains(string(j), "https://example.org/") {
			t.Fatal(string(j), err)
		}
		if key == "economie" && !strings.Contains(string(j), `["2026-01",null,"p"]`) {
			t.Fatal("observation altérée")
		}
	}
	if _, _, err := c.publicData(dataArgs{Collection: "inconnue"}); err == nil {
		t.Fatal("collection acceptée")
	}
	next := filepath.Join(root, "next")
	if err := os.Symlink(b, next); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(next, link); err != nil {
		t.Fatal(err)
	}
	n, err := s.load()
	realB, _ := filepath.EvalSymlinks(b)
	if err != nil || n == c || n.root != realB {
		t.Fatal("version gelée", err)
	}
	if err := os.WriteFile(filepath.Join(b, "build.json"), []byte("{}"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := s.load(); err == nil {
		t.Fatal("version invalide présentée comme fraîche")
	}
}
func TestUsageContinuity(t *testing.T) {
	now := time.Date(2026, 1, 1, 23, 50, 0, 0, time.UTC)
	dir := t.TempDir()
	u := openUsage(dir, now)
	var g sync.WaitGroup
	for i := 0; i < 12; i++ {
		g.Add(1)
		go func() { defer g.Done(); u.record("polradar_corpus", counts{Success: 1}, now) }()
	}
	g.Wait()
	later := now.AddDate(0, 0, 30)
	u.record("polradar_measure", counts{Empty: 1}, later)
	r, err := openUsage(dir, later).public(later)
	if err != nil || len(r.Days) != 30 || r.Days[0].counts != (counts{}) || r.Days[29].Empty != 1 {
		t.Fatal(r, err)
	}
	if err := os.WriteFile(filepath.Join(dir, "usage.json"), []byte("incomplet"), 0600); err != nil {
		t.Fatal(err)
	}
	broken := openUsage(dir, later)
	if _, err = broken.public(later); err == nil {
		t.Fatal("chiffres indisponibles présentés comme zéro")
	}
	if w := call(handler(&store{root: fixture(t)}, broken), "GET", statsPath, "", nil); w.Code != 503 || !strings.Contains(w.Body.String(), "unavailable") {
		t.Fatal(w.Code)
	}
}
func TestModernClient(t *testing.T) {
	h := handler(&store{root: fixture(t)}, openUsage(t.TempDir(), time.Now()))
	b := `{"jsonrpc":"2.0","id":1,"method":"server/discover","params":{"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{}}}}`
	res := call(h, "POST", endpoint, b, map[string]string{"MCP-Protocol-Version": "2026-07-28", "Mcp-Method": "server/discover"})
	if res.Code != 200 || !strings.Contains(res.Body.String(), "supportedVersions") {
		t.Fatal(res.Code, res.Body.String())
	}
}
