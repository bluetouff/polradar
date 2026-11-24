package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"testing"
)

// Run separately from the race detector so its allocator does not inflate RSS.
func TestLocalSnapshotFootprint(t *testing.T) {
	old, next := os.Getenv("POLRADAR_PREVIOUS_SITE"), os.Getenv("POLRADAR_TEST_SITE")
	if old == "" || next == "" {
		t.Skip("nécessite deux éditions réelles")
	}
	rss := func(stage string) {
		raw, e := exec.Command("ps", "-o", "rss=", "-p", strconv.Itoa(os.Getpid())).Output()
		if e != nil {
			t.Fatal(e)
		}
		kb, e := strconv.ParseInt(strings.TrimSpace(string(raw)), 10, 64)
		if e != nil {
			t.Fatal(e)
		}
		t.Logf("%s : %d Kio RSS", stage, kb)
	}
	link := filepath.Join(t.TempDir(), "site")
	if e := os.Symlink(old, link); e != nil {
		t.Fatal(e)
	}
	s := store{root: link}
	rss("avant chargement")
	c, e := s.load()
	if e != nil {
		t.Fatal(e)
	}
	rss("corpus chargé")
	warm := func(c *snapshot) error {
		if _, e := c.dossiers(); e != nil {
			return e
		}
		if _, _, e := c.territory(territoryArgs{"75056"}); e != nil {
			return e
		}
		if c.contract.major("parlement") == dataMajor {
			_, _, e := c.publicData(dataArgs{Collection: "parlement", ID: "VTANR5L16V3213"})
			return e
		}
		return nil
	}
	if e := warm(c); e != nil {
		t.Fatal(e)
	}
	rss("dossiers et territoires chargés")
	var group sync.WaitGroup
	for i := 0; i < 8; i++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for j := 0; j < 8; j++ {
				if _, _, e := c.search(searchArgs{Query: "logement", Limit: 5}); e != nil {
					t.Error(e)
				}
			}
		}()
	}
	group.Wait()
	rss("après 64 recherches avec 8 lecteurs")
	incoming := link + "-next"
	if e := os.Symlink(next, incoming); e != nil {
		t.Fatal(e)
	}
	if e := os.Rename(incoming, link); e != nil {
		t.Fatal(e)
	}
	newer, e := s.load()
	if e != nil {
		t.Fatal(e)
	}
	if e = warm(newer); e != nil {
		t.Fatal(e)
	}
	if newer == c {
		t.Fatal("pas de bascule de répertoire")
	}
	rss("deux éditions en mémoire")
	runtime.KeepAlive(c)
	runtime.KeepAlive(newer)
}
