package main

import (
	"errors"
	"os"
	"path/filepath"
	"testing"
)

// This test is copied into the pinned legacy service by the release matrix.
func TestLegacyCorpusBudget(t *testing.T) {
	root := os.Getenv("POLRADAR_TEST_SITE")
	file := filepath.Join(root, "api", "corpus.json")
	stat, err := os.Stat(file)
	if err != nil || stat.Size() <= corpusLimit {
		t.Fatal("Expected a valid corpus larger than the legacy budget")
	}
	if _, err := (&store{root: root}).load(); !errors.Is(err, invalidCorpus) {
		t.Fatal("The previous service must report the oversized corpus as unavailable")
	}
}
