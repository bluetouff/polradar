package main

import (
	"encoding/json"
	"path/filepath"
	"regexp"
	"strconv"
	"time"
)

var ballotPattern = regexp.MustCompile(`^VTANR5L(15|16|17)V([1-9][0-9]{0,5})$`)

type parliamentMonth struct {
	Mois   string
	Nombre int
	Plages []struct{ Legislature, Premier, Dernier int }
}
type parliamentIndex struct {
	Version                 int
	Consultation            string
	LicenceSource           string
	Scrutins                int
	ScrutinsSupplementaires int
	Lots                    []parliamentMonth
	Personnes               map[string]record
	Mandats                 map[string]record
	Groupes                 map[string]record
}
type parliamentCache struct {
	search *actIndex
	index  *parliamentIndex
	month  string
	rows   []record
}

func (c *snapshot) rollIndex() (*parliamentIndex, error) {
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.parliament.index != nil {
		return c.parliament.index, nil
	}
	var index parliamentIndex
	if readData(filepath.Join(c.root, "api", "parlement", "index.json"), 128<<10, &index) != nil || index.Version != dataMajor || !dayOK(index.Consultation) || index.LicenceSource == "" || len(index.Lots) > 150 || len(index.Personnes) == 0 {
		return nil, invalidCorpus
	}
	total := 0
	previous := ""
	for _, m := range index.Lots {
		if _, e := time.Parse("2006-01", m.Mois); e != nil || previous != "" && m.Mois >= previous || m.Nombre < 1 || m.Nombre > 2000 || len(m.Plages) == 0 {
			return nil, invalidCorpus
		}
		previous = m.Mois
		total += m.Nombre
	}
	if total != index.Scrutins {
		return nil, invalidCorpus
	}
	c.parliament.index = &index
	return &index, nil
}

// One immutable month stays in memory. Parallel requests retain their own slice
// if another reader replaces the entry while their response is assembled.
func (c *snapshot) rollMonth(m parliamentMonth) ([]record, error) {
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.parliament.month == m.Mois {
		return c.parliament.rows, nil
	}
	var part struct {
		Version  int
		Mois     string
		Scrutins []record
	}
	if readData(filepath.Join(c.root, "api", "parlement", m.Mois+".json"), 2<<20, &part) != nil || part.Version != dataMajor || part.Mois != m.Mois || len(part.Scrutins) != m.Nombre {
		return nil, invalidCorpus
	}
	c.parliament.month = m.Mois
	c.parliament.rows = part.Scrutins
	return part.Scrutins, nil
}

func (c *snapshot) parliamentaryData(a dataArgs) (any, bool, error) {
	index, e := c.rollIndex()
	if e != nil {
		return nil, false, e
	}
	const pageURL = site + "/votes/registre/"
	missing := map[string]any{"collection": a.Collection, "publication": nil}
	if a.ID != "" {
		parts := ballotPattern.FindStringSubmatch(a.ID)
		if parts == nil {
			return missing, true, nil
		}
		term, _ := strconv.Atoi(parts[1])
		no, _ := strconv.Atoi(parts[2])
		for _, m := range index.Lots {
			possible := false
			for _, r := range m.Plages {
				if r.Legislature == term && no >= r.Premier && no <= r.Dernier {
					possible = true
					break
				}
			}
			if !possible {
				continue
			}
			rows, e := c.rollMonth(m)
			if e != nil {
				return nil, false, e
			}
			for _, b := range rows {
				if b.str("id") != a.ID {
					continue
				}
				var people []struct{ Candidat, Mandat, Groupe string }
				if e = json.Unmarshal(b["positions"], &people); e != nil || len(people) == 0 {
					return nil, false, invalidCorpus
				}
				names, mandates, groups := map[string]record{}, map[string]record{}, map[string]record{}
				for _, p := range people {
					n, nOK := index.Personnes[p.Candidat]
					mandate, mOK := index.Mandats[p.Mandat]
					if !nOK || !mOK || mandate.str("acteur") != n.str("id") {
						return nil, false, invalidCorpus
					}
					names[p.Candidat] = n
					mandates[p.Mandat] = mandate
					if p.Groupe != "" {
						g, ok := index.Groupes[p.Groupe]
						if !ok {
							return nil, false, invalidCorpus
						}
						groups[p.Groupe] = g
					}
				}
				return map[string]any{"collection": a.Collection, "publication": b, "rubrique": pageURL, "personnes": names, "mandats": mandates, "groupes": groups, "jeuVerifieLe": index.Consultation, "licenceSource": index.LicenceSource}, false, nil
			}
		}
		if term == 17 && index.ScrutinsSupplementaires > 0 {
			return c.supplementaryAct(a.ID, index)
		}
		return missing, true, nil
	}
	start := min(a.Offset, index.Scrutins)
	skip := start
	publications := make([]map[string]string, 0, 15)
	for _, m := range index.Lots {
		if skip >= m.Nombre {
			skip -= m.Nombre
			continue
		}
		rows, e := c.rollMonth(m)
		if e != nil {
			return nil, false, e
		}
		for _, b := range rows[skip:] {
			publications = append(publications, map[string]string{"id": b.str("id"), "titre": b.str("objet"), "date": b.str("date")})
			if len(publications) == 15 {
				break
			}
		}
		skip = 0
		if len(publications) == 15 {
			break
		}
	}
	return map[string]any{"collection": a.Collection, "total": index.Scrutins, "offset": start, "publications": publications, "rubrique": pageURL, "jeuVerifieLe": index.Consultation}, len(publications) == 0, nil
}
