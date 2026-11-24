package main

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestCheckpointRecovery(t *testing.T) {
	dir := t.TempDir()
	now := time.Now()
	u := openUsage(dir, now)
	u.record("polradar_corpus", counts{Success: 1}, now)
	good := u.path
	u.path = filepath.Join(dir, "absent", "usage.json")
	if u.checkpoint() == nil {
		t.Fatal("échec du stockage ignoré")
	}
	if _, err := u.public(now); err == nil {
		t.Fatal("échec présenté comme une valeur")
	}
	u.path = good
	if err := u.checkpoint(); err != nil {
		t.Fatal(err)
	}
	r, err := openUsage(dir, now).public(now)
	if err != nil || r.Days[len(r.Days)-1].Success != 1 {
		t.Fatal("reprise", err)
	}
	b, err := os.ReadFile(good)
	if err != nil || len(b) > 2048 {
		t.Fatal("taille compteur")
	}
}
func TestSharedQuotaAndMinuteBoundary(t *testing.T) {
	l := new(limits)
	last := time.Unix(1799999999, 0)
	first := last.Truncate(time.Minute).Add(time.Minute)
	for i := 0; i < 90; i++ {
		if !l.allow("192.0.2.1", last) {
			t.Fatal("quota par adresse")
		}
	}
	if l.allow("::ffff:192.0.2.1", last) {
		t.Fatal("IPv4 mappée doit partager le quota")
	}
	if !l.allow("192.0.2.1", first) {
		t.Fatal("nouvelle fenêtre")
	}
}
