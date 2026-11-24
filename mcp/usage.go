package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"sort"
	"sync"
	"time"
)

var toolNames = []string{"polradar_search", "polradar_measure", "polradar_candidates", "polradar_corpus", "polradar_donnees"}

type counts struct {
	Success int64 `json:"success"`
	Empty   int64 `json:"empty"`
	Error   int64 `json:"error"`
}

func (c *counts) add(n counts) { c.Success += n.Success; c.Empty += n.Empty; c.Error += n.Error }

type usageFile struct {
	First string                       `json:"first"`
	Days  map[string]map[string]counts `json:"days"`
}
type daily struct {
	Date string `json:"date"`
	counts
}
type perTool struct {
	Name string `json:"name"`
	counts
}
type report struct {
	Status  string    `json:"status"`
	Since   string    `json:"since"`
	Through string    `json:"through"`
	Days    []daily   `json:"days"`
	Tools   []perTool `json:"tools"`
}
type usage struct {
	mu          sync.Mutex
	path        string
	records     usageFile
	unavailable bool
}

func dateKey(t time.Time) string { return t.UTC().Format(time.DateOnly) }
func dayOK(s string) bool        { _, err := time.Parse(time.DateOnly, s); return err == nil }
func openUsage(dir string, now time.Time) *usage {
	u := &usage{path: filepath.Join(dir, "usage.json")}
	err := readData(u.path, 1<<18, &u.records)
	if err != nil {
		if _, statErr := os.Stat(u.path); os.IsNotExist(statErr) {
			u.records = usageFile{First: dateKey(now), Days: map[string]map[string]counts{}}
			u.unavailable = u.save() != nil
		} else {
			u.unavailable = true
		}
		return u
	}
	if !dayOK(u.records.First) || u.records.Days == nil || len(u.records.Days) > 30 {
		u.unavailable = true
		return u
	}
	for day, items := range u.records.Days {
		if !dayOK(day) || day < u.records.First {
			u.unavailable = true
			break
		}
		for name, n := range items {
			if !slices.Contains(toolNames, name) || n.Success < 0 || n.Empty < 0 || n.Error < 0 || n.Success > 1e9 || n.Empty > 1e9 || n.Error > 1e9 {
				u.unavailable = true
				break
			}
		}
	}
	return u
}
func (u *usage) save() error {
	b, err := json.Marshal(u.records)
	if err != nil {
		return err
	}
	f, err := os.CreateTemp(filepath.Dir(u.path), ".usage-")
	if err != nil {
		return err
	}
	defer os.Remove(f.Name())
	if _, err = f.Write(b); err == nil {
		err = f.Sync()
	}
	closeErr := f.Close()
	if err != nil {
		return err
	}
	if closeErr != nil {
		return closeErr
	}
	return os.Rename(f.Name(), u.path)
}
func (u *usage) record(name string, outcome counts, now time.Time) {
	if !slices.Contains(toolNames, name) {
		return
	}
	u.mu.Lock()
	defer u.mu.Unlock()
	if u.unavailable {
		return
	}
	key := dateKey(now)
	if key < u.records.First {
		u.unavailable = true
		return
	}
	earliest := dateKey(now.UTC().AddDate(0, 0, -29))
	for day := range u.records.Days {
		if day < earliest {
			delete(u.records.Days, day)
		}
	}
	if u.records.Days[key] == nil {
		u.records.Days[key] = map[string]counts{}
	}
	n := u.records.Days[key][name]
	n.add(outcome)
	u.records.Days[key][name] = n
	if u.save() != nil {
		u.unavailable = true
	}
}
func (u *usage) public(now time.Time) (report, error) {
	u.mu.Lock()
	defer u.mu.Unlock()
	today := dateKey(now)
	if u.unavailable || u.records.First > today {
		return report{}, errors.New("Comptage indisponible.")
	}
	first := max(u.records.First, dateKey(now.UTC().AddDate(0, 0, -29)))
	r := report{Status: "available", Since: first, Through: today, Days: []daily{}, Tools: []perTool{}}
	totals := map[string]counts{}
	for d, _ := time.Parse(time.DateOnly, first); dateKey(d) <= today; d = d.AddDate(0, 0, 1) {
		day := dateKey(d)
		var sum counts
		for name, value := range u.records.Days[day] {
			sum.add(value)
			t := totals[name]
			t.add(value)
			totals[name] = t
		}
		r.Days = append(r.Days, daily{day, sum})
	}
	for _, name := range toolNames {
		r.Tools = append(r.Tools, perTool{name, totals[name]})
	}
	sort.Slice(r.Tools, func(i, j int) bool { return r.Tools[i].Name < r.Tools[j].Name })
	return r, nil
}
