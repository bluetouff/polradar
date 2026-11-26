package main

import (
	"encoding/json"
	"net/url"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"
)

// Reading the immutable search index once avoids opening hundreds of monthly
// files for each request. Only the first fifteen matching rows are retained.
type actRow struct {
	Releve      json.RawMessage `json:"releve,omitempty"`
	ID          string          `json:"id"`
	Date        string          `json:"date"`
	Institution string          `json:"institution"`
	Nature      string          `json:"nature"`
	Titre       string          `json:"titre"`
	Source      string          `json:"source"`
	Mentions    [][3]string     `json:"mentions"`
	Themes      []string        `json:"themes,omitempty"`
	Intitule    string          `json:"intitule,omitempty"`
	Intervenant string          `json:"intervenant,omitempty"`
	Dossier     string          `json:"dossier,omitempty"`
	text        string
}
type actIndex struct {
	Version                      int
	Empreinte                    string
	Candidats, Themes            map[string]string
	SeancesEurope, SessionsSenat []string
	Actes                        []actRow
}

var actChambers = []string{"assemblee", "senat", "parlement-europeen"}
var actNatures = []string{"vote", "rapport", "depot", "intervention", "cosignature", "mise-au-point"}
var actPositions = []string{"pour", "contre", "abstention", "non-votant", "non-votant-volontaire"}
var actHosts = []string{"www.assemblee-nationale.fr", "questions.assemblee-nationale.fr", "www.senat.fr", "data.europarl.europa.eu", "www.europarl.europa.eu", "redmapl3.europarl.europa.eu"}

func (c *snapshot) actIndex() (*actIndex, error) {
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.parliament.search != nil {
		return c.parliament.search, nil
	}
	var raw actIndex
	if readData(filepath.Join(c.root, "api", "parlement", "recherche.json"), 6<<20, &raw) != nil || raw.Version != 1 || len(raw.Empreinte) != 64 || len(raw.Actes) > 18000 || len(raw.Actes) == 0 || len(raw.Candidats) == 0 {
		return nil, invalidCorpus
	}
	if strings.Trim(raw.Empreinte, "0123456789abcdef") != "" {
		return nil, invalidCorpus
	}
	ids := make(map[string]bool, len(raw.Actes))
	for i := range raw.Actes {
		b := &raw.Actes[i]
		u, e := url.Parse(b.Source)
		if e != nil || u.Scheme != "https" || u.User != nil || !slices.Contains(actHosts, u.Host) || b.ID == "" || len(b.ID) > 160 || ids[b.ID] || !dayOK(b.Date) ||
			b.Titre == "" || len(b.Titre) > 5000 || len(b.Mentions) > 40 || !slices.Contains(actChambers, b.Institution) || !slices.Contains(actNatures[:4], b.Nature) {
			return nil, invalidCorpus
		}
		if i > 0 {
			p := raw.Actes[i-1]
			if p.Date < b.Date || (p.Date == b.Date && p.ID >= b.ID) {
				return nil, invalidCorpus
			}
		}
		ids[b.ID] = true
		for _, m := range b.Mentions {
			if raw.Candidats[m[0]] == "" || (m[2] != "vote" && m[2] != "note" && m[2] != "signature") || (m[2] != "signature" && !slices.Contains(actPositions, m[1])) {
				return nil, invalidCorpus
			}
		}
		b.text = normalize(b.Titre + " " + b.Intitule + " " + b.Intervenant + " " + b.ID)
	}
	c.parliament.search = &raw
	return &raw, nil
}
func (a dataArgs) hasActFilters() bool {
	return a.Recherche || a.Candidat != "" || a.Institution != "" || a.Debut != "" || a.Fin != "" || a.Nature != "" || a.Position != "" || a.Theme != ""
}
func actCoverage(x *actIndex, a dataArgs) string {
	if a.Debut != "" && a.Debut == a.Fin && a.Institution == "parlement-europeen" {
		if slices.Contains(x.SeancesEurope, a.Debut) {
			return "seance-examinee"
		}
		if a.Debut == "2017-02-15" || a.Debut == "2018-05-29" {
			return "scrutin-isole"
		}
		return "periode-hors-registre"
	}
	if a.Debut != "" && a.Debut == a.Fin && a.Institution == "senat" && a.Nature == "vote" {
		for _, year := range x.SessionsSenat {
			n, _ := strconv.Atoi(year)
			start := year + "-10-01"
			if a.Debut >= start && ((a.Debut[:4] == year) || (a.Debut[:4] == strconv.Itoa(n+1) && a.Debut[5:] < "10-01")) {
				return "session-examinee"
			}
		}
		return "periode-hors-registre"
	}
	return "couverture-partielle"
}
func matchAct(b *actRow, a dataArgs, terms []string) bool {
	if (a.Institution != "" && a.Institution != b.Institution) || (a.Debut != "" && b.Date < a.Debut) || (a.Fin != "" && b.Date > a.Fin) || (a.Theme != "" && !slices.Contains(b.Themes, a.Theme)) {
		return false
	}
	if a.Nature != "" && a.Nature != "cosignature" && a.Nature != "mise-au-point" && b.Nature != a.Nature {
		return false
	}
	if a.Candidat != "" || a.Position != "" || a.Nature == "cosignature" || a.Nature == "mise-au-point" {
		found := false
		for _, m := range b.Mentions {
			if (a.Candidat == "" || a.Candidat == m[0]) && (a.Position == "" || m[2] == "vote" && a.Position == m[1]) &&
				(a.Nature != "cosignature" || m[2] == "signature" && m[1] == "coauteur") && (a.Nature != "mise-au-point" || m[2] == "note") {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	for _, term := range terms {
		if !strings.Contains(b.text, term) {
			return false
		}
	}
	return true
}
func (c *snapshot) searchActs(a dataArgs) (any, bool, error) {
	if !utf8.ValidString(a.Query) || utf8.RuneCountInString(a.Query) > maxSearchQueryLength || (a.Query != "" && normalize(a.Query) == "") || a.ID != "" || a.Periode != "" ||
		(a.Institution != "" && !slices.Contains(actChambers, a.Institution)) || (a.Nature != "" && !slices.Contains(actNatures, a.Nature)) ||
		(a.Position != "" && !slices.Contains(actPositions, a.Position)) || (a.Debut != "" && !dayOK(a.Debut)) || (a.Fin != "" && !dayOK(a.Fin)) || (a.Fin != "" && a.Debut > a.Fin) {
		return nil, false, errFilter
	}
	x, e := c.actIndex()
	if e != nil {
		return nil, false, e
	}
	if (a.Candidat != "" && x.Candidats[a.Candidat] == "") || (a.Theme != "" && x.Themes[a.Theme] == "") {
		return nil, false, errFilter
	}
	var total int
	selected := make([]*actRow, 0, publicationPageSize)
	terms := strings.Fields(normalize(a.Query))
	for i := range x.Actes {
		b := &x.Actes[i]
		if !matchAct(b, a, terms) {
			continue
		}
		if total >= a.Offset && len(selected) < cap(selected) {
			selected = append(selected, b)
		}
		total++
	}
	start := min(a.Offset, total)
	return map[string]any{"collection": "parlement", "total": total, "offset": start, "suivant": nextPageOffset(start, len(selected), total), "publications": selected, "rubrique": site + "/votes/recherche/", "couverture": actCoverage(x, a), "empreinteIndex": x.Empreinte}, len(selected) == 0, nil
}

func (c *snapshot) supplementaryAct(id string, index *parliamentIndex) (any, bool, error) {
	x, err := c.actIndex()
	if err != nil {
		return nil, false, err
	}
	for _, row := range x.Actes {
		if row.ID != id || len(row.Releve) == 0 {
			continue
		}
		var detail record
		if json.Unmarshal(row.Releve, &detail) != nil {
			return nil, false, invalidCorpus
		}
		var persons []struct{ Candidat, Mandat, Groupe string }
		if json.Unmarshal(detail["positions"], &persons) != nil || len(persons) == 0 {
			return nil, false, invalidCorpus
		}
		names, mandates, groups := map[string]record{}, map[string]record{}, map[string]record{}
		for _, p := range persons {
			name, okName := index.Personnes[p.Candidat]
			mandate, okMandate := index.Mandats[p.Mandat]
			if !okName || !okMandate || mandate.str("acteur") != name.str("id") {
				return nil, false, invalidCorpus
			}
			names[p.Candidat] = name
			mandates[p.Mandat] = mandate
			if p.Groupe != "" {
				g, ok := index.Groupes[p.Groupe]
				if !ok {
					return nil, false, invalidCorpus
				}
				groups[p.Groupe] = g
			}
		}
		n, _ := strconv.Atoi(strings.TrimPrefix(id, "VTANR5L17V"))
		pub := map[string]any{"id": id, "date": row.Date, "legislature": 17, "numero": n, "objet": row.Titre, "source": row.Source, "decision": detail["decision"], "type": detail["type"], "totaux": detail["totaux"], "positions": detail["positions"], "censure": detail.str("type") == "motion de censure"}
		return map[string]any{"collection": "parlement", "publication": pub, "rubrique": site + "/votes/recherche/", "personnes": names, "mandats": mandates, "groupes": groups, "jeuVerifieLe": index.Consultation, "licenceSource": index.LicenceSource}, false, nil
	}
	return map[string]any{"collection": "parlement", "publication": nil}, true, nil
}
