package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPublicAPIReads(t *testing.T) {
	usage := openUsage(t.TempDir(), time.Now())
	h := handler(&store{root: fixture(t)}, usage)
	for _, tc := range []struct{ path, fragment string }{
		{"/", `"openapi":"https://polradar.fr/api/openapi.json"`},
		{"/corpus", `"parti":1`},
		{"/candidats?includeWithdrawn=true", `"id":"exemple"`},
		{"/mesures", `"total":1`},
		{"/mesures?query=%C3%A9tude&scope=parti&theme=travail&candidate=exemple&limit=1", `"auteur":"Collectif de test"`},
		{"/mesures?query=%C3%A9tude&mode=preuves", `"preuves":{"beneficiaires":null,"chiffres":null,"description":"Service public"`},
		{"/mesures?scope=archive", `"sansResultat":true`},
		{"/mesures?offset=1", `"resultats":[]`},
		{"/mesures/mesure", `"passage":"Section de test"`},
		{"/donnees/sondages", `"id":"test-sondage"`},
		{"/donnees/sondages?query=sc%C3%A9nario%202026-01-01", `"id":"test-sondage"`},
		{"/donnees/sondages?query=sc%C3%A9nario%202026-01-11", `"sansResultat":true`},
		{"/donnees/economie?query=s%C3%A9rie", `"id":"serie"`},
		{"/donnees/sondages/test-sondage", `"noticeSource":"source"`},
		{"/donnees/economie/serie", `["2026-01",null,"p"]`},
		{"/donnees/economie?offset=3", `"publications":[]`},
	} {
		r := call(h, "GET", "/api/v1"+tc.path, "", map[string]string{"Origin": "https://example.org"})
		if r.Code != 200 || !json.Valid(r.Body.Bytes()) || !strings.Contains(r.Body.String(), tc.fragment) ||
			!strings.Contains(r.Body.String(), strings.Repeat("a", 40)) || r.Header().Get("Access-Control-Allow-Origin") != "*" ||
			r.Header().Get("Access-Control-Allow-Credentials") != "" || r.Header().Get("Set-Cookie") != "" {
			t.Fatalf("GET %s : réponse ou métadonnées incorrectes (%d)", tc.path, r.Code)
		}
		head := call(h, "HEAD", "/api/v1"+tc.path, "", nil)
		if head.Code != 200 || head.Body.Len() != 0 || head.Header().Get("Content-Type") != r.Header().Get("Content-Type") {
			t.Fatal("HEAD", tc.path, head.Code)
		}
	}
	report, err := usage.public(time.Now())
	if err != nil {
		t.Fatal(err)
	}
	for _, day := range report.Days {
		if day.counts != (counts{}) {
			t.Fatal("Accès API compté dans le MCP")
		}
	}
}

func TestPublicAPIBoundaries(t *testing.T) {
	h := handler(&store{root: fixture(t)}, openUsage(t.TempDir(), time.Now()))
	for _, tc := range []struct {
		path   string
		status int
	}{
		{"/mesures?limit=0", 400}, {"/mesures?limit=26", 400}, {"/mesures?offset=-1", 400},
		{"/mesures?mode=preuves&limit=6", 400}, {"/mesures?mode=inconnu", 400},
		{"/mesures?offset=100001", 400}, {"/mesures?query=", 400}, {"/mesures?query=%20", 400},
		{"/mesures?query=" + strings.Repeat("a", 161), 400}, {"/mesures?query=" + strings.Repeat("a", 2050), 400},
		{"/mesures?limit=1&limit=2", 400}, {"/mesures?scope=absent", 400}, {"/mesures?param=absent", 400},
		{"/mesures?query=%ff", 400}, {"/corpus?offset=0", 400}, {"/candidats?includeWithdrawn=1", 400},
		{"/mesures/absente", 404}, {"/mesures/mesure?limit=1", 400}, {"/donnees/inconnue", 404},
		{"/donnees/economie/absente", 404}, {"/donnees/economie/serie?offset=0", 400},
		{"/donnees/economie?limit=1", 400}, {"/donnees/economie/serie/suite", 404}, {"/stats", 404}, {"/donnees/google", 404},
		{"/donnees/agenda?query=exemple", 400}, {"/donnees/sondages?query=%21", 400}, {"/donnees/sondages/test-sondage?query=test", 400},
	} {
		r := call(h, "GET", "/api/v1"+tc.path, "", nil)
		var result map[string]any
		if r.Code != tc.status || json.Unmarshal(r.Body.Bytes(), &result) != nil || len(result) != 1 || result["erreur"] == nil {
			t.Error(tc.path, r.Code)
		}
	}
	for _, method := range []string{"POST", "PUT", "DELETE", "PATCH", "OPTIONS"} {
		r := call(h, method, "/api/v1/mesures", "", nil)
		if r.Code != 405 || r.Header().Get("Allow") != "GET, HEAD" {
			t.Fatal(method, r.Code)
		}
	}
	if call(h, "GET", "/api/v1/corpus", "body", nil).Code != 400 || call(h, "GET", "/api/v1/corpus", "", map[string]string{"Host": "example.org"}).Code != 403 {
		t.Fatal("Limites HTTP")
	}
	if r := call(h, "HEAD", "/api/v1/mesures/inconnue", "", nil); r.Code != 404 || r.Body.Len() != 0 {
		t.Fatal(r.Code)
	}
}

func TestPublicAPIRateLimitAndUnavailableCorpus(t *testing.T) {
	root := fixture(t)
	h := handler(&store{root: root}, openUsage(t.TempDir(), time.Now()))
	if err := os.WriteFile(filepath.Join(root, "build.json"), []byte("{}"), 0600); err != nil {
		t.Fatal(err)
	}
	r := call(h, "GET", "/api/v1/corpus", "", nil)
	if r.Code != 503 || strings.Contains(r.Body.String(), root) {
		t.Fatal("Corpus indisponible")
	}
	// Up to two windows in case the test straddles the minute boundary.
	for i := 0; i < 181; i++ {
		r := call(h, "GET", "/api/v1/corpus", "", nil)
		if r.Code == 429 {
			if r.Header().Get("Retry-After") != "60" || !json.Valid(r.Body.Bytes()) {
				t.Fatal("Réponse de quota invalide")
			}
			return
		}
	}
	t.Fatal("Quota HTTP ignoré")
}
