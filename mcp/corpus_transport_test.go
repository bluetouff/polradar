package main

import (
	"bytes"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"runtime"
	"strconv"
	"strings"
	"testing"
	"time"
)

func writeCorpusFixtureFile(t *testing.T, root, name string, data []byte) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(root, name), data, 0600); err != nil {
		t.Fatal(err)
	}
}

func markCorpusFixture(t *testing.T, root, revision string, corpus []byte) {
	t.Helper()
	digest := fmt.Sprintf("%x", sha256.Sum256(corpus))
	index, err := json.Marshal(map[string]any{
		"version": 1, "sourceCommit": revision, "sha256": digest, "bytes": len(corpus),
	})
	if err != nil {
		t.Fatal(err)
	}
	marker, err := json.Marshal(map[string]any{
		"sourceCommit": revision, "sha256": map[string]string{corpusExport: digest},
	})
	if err != nil {
		t.Fatal(err)
	}
	writeCorpusFixtureFile(t, root, corpusPartsManifest, index)
	writeCorpusFixtureFile(t, root, "build.json", marker)
}

func TestReassembledCorpusKeepsLegacyCatalogue(t *testing.T) {
	root := fixture(t)
	old, err := (&store{root: root}).load()
	if err != nil {
		t.Fatal(err)
	}
	corpus, err := os.ReadFile(filepath.Join(root, corpusExport))
	if err != nil {
		t.Fatal(err)
	}
	corpus = append(corpus, bytes.Repeat([]byte(" "), corpusLimit-len(corpus)+1)...)
	writeCorpusFixtureFile(t, root, corpusExport, corpus)
	if _, err := (&store{root: root}).load(); err == nil {
		t.Fatal("The legacy budget must still protect unpartitioned corpora")
	}
	markCorpusFixture(t, root, old.commit, corpus)
	current, err := (&store{root: root}).load()
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(old.catalog, current.catalog) || old.commit != current.commit {
		t.Fatal("The transport must retain the published facts and edition")
	}
	corpus[len(corpus)-1] = '\n'
	writeCorpusFixtureFile(t, root, corpusExport, corpus)
	if _, err := (&store{root: root}).load(); err == nil {
		t.Fatal("A corpus with a different checksum must be rejected")
	}
}

func TestReassembledCatalogueConsumesTheCompleteDocument(t *testing.T) {
	for _, test := range []struct {
		document string
		valid    bool
	}{
		{`{"annotations":{"array":[1,{"check":[true,null]}]},"sources":[],"polls":null}`, true},
		{`{"sources":[], "sources": []}`, false},
		{`{"annotations":{"array":[1`, false},
		{`{"sources":{}}`, false},
		{`{"sources":[]} {}`, false},
	} {
		var data catalog
		if (decodeCatalog(json.NewDecoder(strings.NewReader(test.document)), &data) == nil) != test.valid {
			t.Errorf("Catalogue validation differs for %q", test.document)
		}
	}
}

func TestLocalCorpusGrowth(t *testing.T) {
	root := os.Getenv("POLRADAR_GROWTH_SITE")
	if root == "" {
		t.Skip("Run scripts/test-corpus-growth.py --mcp for an isolated load fixture")
	}
	expected := func(key string) int {
		value, err := strconv.Atoi(os.Getenv(key))
		if err != nil || value <= 0 {
			t.Fatalf("Missing or invalid load fixture count: %s", key)
		}
		return value
	}
	factor := expected("POLRADAR_GROWTH_FACTOR")
	started := time.Now()
	current, err := (&store{root: root}).load()
	if err != nil {
		t.Fatal(err)
	}
	elapsed := time.Since(started)
	if len(current.Measures) != factor*expected("POLRADAR_GROWTH_MEASURES") ||
		len(current.Versions) != factor*expected("POLRADAR_GROWTH_VERSIONS") {
		t.Fatal("Document counts differ from the growth fixture")
	}
	runtime.GC()
	var stats runtime.MemStats
	runtime.ReadMemStats(&stats)
	t.Logf("%d×: %d mesures, %d versions, chargement %s, tas vivant %d octets",
		factor, len(current.Measures), len(current.Versions), elapsed.Round(time.Millisecond), stats.HeapAlloc)
	runtime.KeepAlive(current)
}
