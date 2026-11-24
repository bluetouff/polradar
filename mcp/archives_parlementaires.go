package main

import (
	"encoding/json"
	"path/filepath"
	"regexp"
	"strings"
	"time"
)

var senateID = regexp.MustCompile(`^senat-([0-9]{4})-[1-9][0-9]{0,5}$`)
var euroID = regexp.MustCompile(`^MTG-PL-([0-9]{4}-[0-9]{2}-[0-9]{2})-DEC-[1-9][0-9]{0,7}$`)
var senateYear = regexp.MustCompile(`^[0-9]{4}$`)

type archivePart struct {
	ID               string
	Titre            string
	Institution      string
	Nombre, Mentions int
	Source           string
}
type archivesIndex struct {
	Version        int
	Consultation   string
	DroitsSources  map[string]record
	Personnes      map[string]record
	Total          int
	Lots           []archivePart
	SessionsEurope []struct {
		Date                string
		Decisions, Nominaux int
	}
}
type archivesCache struct {
	index *archivesIndex
	part  string
	rows  []record
}

func archivePeriod(collection, id string) (string, bool) {
	var prefix string
	switch collection {
	case "senat":
		prefix = "senat-"
	case "parlement-europeen":
		prefix = "europe-"
	default:
		return "", false
	}
	if !strings.HasPrefix(id, prefix) {
		return "", false
	}
	p := strings.TrimPrefix(id, prefix)
	if collection == "senat" {
		return p, senateYear.MatchString(p)
	}
	_, e := time.Parse("2006-01-02", p)
	return p, e == nil
}
func (c *snapshot) archiveIndex() (*archivesIndex, error) {
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.archives.index != nil {
		return c.archives.index, nil
	}
	var index archivesIndex
	if readData(filepath.Join(c.root, "api", "parlement", "archives", "index.json"), 96<<10, &index) != nil || index.Version != dataMajor || !dayOK(index.Consultation) || len(index.Lots) == 0 || len(index.Lots) > 175 || len(index.Personnes) == 0 {
		return nil, invalidCorpus
	}
	total := 0
	seen := map[string]bool{}
	last := map[string]string{}
	sessions := map[string]int{}
	for _, d := range index.SessionsEurope {
		if _, exists := sessions[d.Date]; exists || !dayOK(d.Date) || d.Nominaux < 0 || d.Decisions < d.Nominaux {
			return nil, invalidCorpus
		}
		sessions[d.Date] = d.Nominaux
	}
	for _, p := range index.Lots {
		institution := ""
		switch p.Institution {
		case "Sénat":
			institution = "senat"
		case "Parlement européen":
			institution = "parlement-europeen"
		default:
			return nil, invalidCorpus
		}
		period, ok := archivePeriod(institution, p.ID)
		if !ok || seen[p.ID] || (last[institution] != "" && period >= last[institution]) || p.Nombre < 0 || p.Nombre > 2000 || p.Mentions < p.Nombre || p.Source == "" || index.DroitsSources[institution].str("licence") == "" {
			return nil, invalidCorpus
		}
		if institution == "parlement-europeen" {
			n, exists := sessions[period]
			if !exists || p.Nombre > n {
				return nil, invalidCorpus
			}
			delete(sessions, period)
		}
		last[institution] = period
		seen[p.ID] = true
		total += p.Nombre
	}
	if total != index.Total || len(sessions) != 0 {
		return nil, invalidCorpus
	}
	c.archives.index = &index
	return &index, nil
}
func (c *snapshot) archiveRows(p archivePart) ([]record, error) {
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.archives.part == p.ID {
		return c.archives.rows, nil
	}
	var doc struct {
		Version  int
		Periode  string
		Scrutins []record
	}
	if readData(filepath.Join(c.root, "api", "parlement", "archives", p.ID+".json"), 2<<20, &doc) != nil || doc.Version != dataMajor || doc.Periode != p.ID || doc.Scrutins == nil || len(doc.Scrutins) != p.Nombre {
		return nil, invalidCorpus
	}
	ids := map[string]bool{}
	for _, row := range doc.Scrutins {
		id := row.str("id")
		institution := row.str("institution")
		period, ok := archivePeriod(institution, p.ID)
		var match []string
		if institution == "senat" {
			match = senateID.FindStringSubmatch(id)
		} else if institution == "parlement-europeen" {
			match = euroID.FindStringSubmatch(id)
		}
		if !ok || match == nil || match[1] != period || ids[id] || !dayOK(row.str("date")) || row.str("objet") == "" || row.str("source") == "" {
			return nil, invalidCorpus
		}
		ids[id] = true
	}
	c.archives.part = p.ID
	c.archives.rows = doc.Scrutins
	return doc.Scrutins, nil
}
func (c *snapshot) archivesData(a dataArgs) (any, bool, error) {
	ix, e := c.archiveIndex()
	if e != nil {
		return nil, false, e
	}
	period := a.Periode
	if a.ID != "" {
		var match []string
		if a.Collection == "senat" {
			match = senateID.FindStringSubmatch(a.ID)
		} else {
			match = euroID.FindStringSubmatch(a.ID)
		}
		if match == nil {
			return map[string]any{"collection": a.Collection, "publication": nil, "couverture": "identifiant-inconnu"}, true, nil
		}
		period = match[1]
	}
	var requested map[string]any
	wanted := []archivePart{}
	periods := []map[string]any{}
	total := 0
	for _, p := range ix.Lots {
		date, ok := archivePeriod(a.Collection, p.ID)
		if !ok {
			continue
		}
		entry := map[string]any{"periode": date, "scrutins": p.Nombre, "mentions": p.Mentions, "source": p.Source}
		if a.Collection == "parlement-europeen" {
			for _, d := range ix.SessionsEurope {
				if d.Date == date {
					entry["decisionsExaminees"] = d.Decisions
					entry["scrutinsNominauxExamines"] = d.Nominaux
					break
				}
			}
		}
		periods = append(periods, entry)
		if period == "" || date == period {
			wanted = append(wanted, p)
			total += p.Nombre
			if date == period {
				requested = entry
			}
		}
	}
	if a.Periode != "" {
		pref := "senat-"
		if a.Collection == "parlement-europeen" {
			pref = "europe-"
		}
		if _, ok := archivePeriod(a.Collection, pref+a.Periode); !ok {
			return nil, false, errFilter
		}
	}
	result := map[string]any{"collection": a.Collection, "rubrique": site + "/votes/archives/", "jeuVerifieLe": ix.Consultation, "droitsSource": ix.DroitsSources[a.Collection], "periodes": periods, "index": site + "/api/parlement/archives/index.json", "couverture": "periodes-consultees"}
	if period != "" {
		result["periodeDemandee"] = period
		if requested != nil {
			result["releve"] = requested
		}
	}
	if len(wanted) == 0 {
		result["publication"] = nil
		result["couverture"] = "periode-non-couverte"
		return result, true, nil
	}
	if a.ID != "" {
		for _, p := range wanted {
			rows, e := c.archiveRows(p)
			if e != nil {
				return nil, false, e
			}
			for _, row := range rows {
				if row.str("id") != a.ID {
					continue
				}
				var positions []struct{ Personne, Candidat string }
				if json.Unmarshal(row["positions"], &positions) != nil || len(positions) == 0 {
					return nil, false, invalidCorpus
				}
				people := map[string]record{}
				for _, pos := range positions {
					person, ok := ix.Personnes[pos.Personne]
					if !ok || person.str("candidat") != pos.Candidat {
						return nil, false, invalidCorpus
					}
					people[pos.Personne] = person
				}
				result["publication"] = row
				result["personnes"] = people
				return result, false, nil
			}
		}
		result["publication"] = nil
		result["couverture"] = "aucune-mention-dans-la-selection"
		return result, true, nil
	}
	start := min(a.Offset, total)
	skip := start
	entries := make([]map[string]string, 0, 15)
	for _, p := range wanted {
		if skip >= p.Nombre {
			skip -= p.Nombre
			continue
		}
		rows, e := c.archiveRows(p)
		if e != nil {
			return nil, false, e
		}
		for _, row := range rows[skip:] {
			entries = append(entries, map[string]string{"id": row.str("id"), "titre": row.str("objet"), "date": row.str("date")})
			if len(entries) == 15 {
				break
			}
		}
		if len(entries) == 15 {
			break
		}
		skip = 0
	}
	result["total"] = total
	result["offset"] = start
	result["publications"] = entries
	return result, len(entries) == 0, nil
}
