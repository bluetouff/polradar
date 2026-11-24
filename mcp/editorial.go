package main

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

type dossiers struct {
	Questions  []record
	Votes      []record
	Evolutions []record
}
type territories struct {
	Names       map[string]string
	SRU         map[string]json.RawMessage
	APL         map[string]json.RawMessage
	Definitions record
}
type pageArgs struct {
	Offset           int    `json:"offset,omitempty" jsonschema:"Position de départ, à partir de zéro."`
	ExpectedRevision string `json:"expectedRevision,omitempty" jsonschema:"Révision du site de la première page."`
}

func (c *snapshot) validatePage(p pageArgs) error {
	if p.Offset < 0 || p.Offset > 100000 {
		return errFilter
	}
	return c.checkRevision(p.ExpectedRevision)
}
func page[T any](rows []T, offset, limit int) map[string]any {
	start := min(offset, len(rows))
	end := min(start+limit, len(rows))
	var next *int
	if end < len(rows) {
		next = &end
	}
	return map[string]any{"total": len(rows), "offset": start, "suivant": next, "resultats": rows[start:end]}
}
func (c *snapshot) dossiers() (*dossiers, error) {
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.editorial == nil {
		var d dossiers
		if readData(filepath.Join(c.root, "api", "dossiers.json"), 8<<20, &d) != nil || d.Questions == nil || d.Votes == nil || d.Evolutions == nil {
			return nil, invalidCorpus
		}
		c.editorial = &d
	}
	return c.editorial, nil
}

type questionArgs struct {
	ID    string `json:"id,omitempty" jsonschema:"Identifiant précis de la question. Sans identifiant, liste des questions."`
	Theme string `json:"theme,omitempty" jsonschema:"Thème à sélectionner dans la liste."`
	pageArgs
}

func questionByID(d *dossiers, id string) (record, []record, error) {
	for _, q := range d.Questions {
		if q.str("id") == id {
			var rows []record
			if json.Unmarshal(q["positions"], &rows) != nil || rows == nil {
				return nil, nil, invalidCorpus
			}
			return q, rows, nil
		}
	}
	return nil, nil, nil
}
func questionSummary(q record) map[string]string {
	return map[string]string{"id": q.str("id"), "titre": q.str("title"), "theme": q.str("theme"), "url": q.str("url")}
}
func (c *snapshot) question(a questionArgs) (any, bool, error) {
	if err := c.validatePage(a.pageArgs); err != nil {
		return nil, false, err
	}
	if len(a.ID) > 160 || len(a.Theme) > 96 || a.ID != "" && a.Theme != "" {
		return nil, false, errFilter
	}
	d, err := c.dossiers()
	if err != nil {
		return nil, false, err
	}
	if a.ID != "" {
		q, rows, err := questionByID(d, a.ID)
		if err != nil {
			return nil, false, err
		}
		if q == nil {
			return map[string]any{"question": nil}, true, nil
		}
		result := page(rows, a.Offset, 4)
		result["question"] = questionSummary(q)
		return result, a.Offset >= len(rows), nil
	}
	rows := []map[string]string{}
	for _, q := range d.Questions {
		if a.Theme == "" || q.str("theme") == a.Theme {
			rows = append(rows, questionSummary(q))
		}
	}
	sort.Slice(rows, func(i, j int) bool { return rows[i]["id"] < rows[j]["id"] })
	return page(rows, a.Offset, 12), a.Offset >= len(rows), nil
}

type compareArgs struct {
	Question   string   `json:"question" jsonschema:"Identifiant retourné par polradar_question."`
	Candidates []string `json:"candidates" jsonschema:"Deux à six identifiants de candidatures distinctes."`
	pageArgs
}

func (c *snapshot) compare(a compareArgs) (any, bool, error) {
	if err := c.validatePage(a.pageArgs); err != nil {
		return nil, false, err
	}
	if len(a.Candidates) < 2 || len(a.Candidates) > 6 || a.Question == "" || len(a.Question) > 160 {
		return nil, false, errFilter
	}
	d, err := c.dossiers()
	if err != nil {
		return nil, false, err
	}
	q, positions, err := questionByID(d, a.Question)
	if err != nil {
		return nil, false, err
	}
	if q == nil {
		return map[string]any{"question": nil}, true, nil
	}
	selected := map[string]bool{}
	rows := []map[string]any{}
	for _, id := range a.Candidates {
		person, ok := c.people[id]
		if !ok || selected[id] {
			return nil, false, errors.New("Candidature inconnue ou répétée.")
		}
		selected[id] = true
		row := map[string]any{"candidate": id, "nom": person.Name, "statutCandidature": person.Status, "dateRetrait": nullable(person.WithdrawnOn), "reponse": nil}
		for _, v := range positions {
			if v.str("candidate") == id {
				row["reponse"] = v
				break
			}
		}
		rows = append(rows, row)
	}
	result := page(rows, a.Offset, 3)
	result["question"] = questionSummary(q)
	return result, a.Offset >= len(rows), nil
}

type voteArgs struct {
	Candidate string `json:"candidate,omitempty"`
	Theme     string `json:"theme,omitempty"`
	Ballot    string `json:"ballot,omitempty" jsonschema:"Identifiant du scrutin nominatif."`
	pageArgs
}

func (c *snapshot) votes(a voteArgs) (any, bool, error) {
	if err := c.validatePage(a.pageArgs); err != nil {
		return nil, false, err
	}
	if len(a.Candidate) > 96 || len(a.Theme) > 96 || len(a.Ballot) > 160 {
		return nil, false, errFilter
	}
	d, err := c.dossiers()
	if err != nil {
		return nil, false, err
	}
	rows := []record{}
	for _, v := range d.Votes {
		if (a.Candidate == "" || a.Candidate == v.str("candidate")) && (a.Theme == "" || a.Theme == v.str("theme")) && (a.Ballot == "" || a.Ballot == v.str("ballotId")) {
			rows = append(rows, v)
		}
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].str("date") != rows[j].str("date") {
			return rows[i].str("date") > rows[j].str("date")
		}
		return rows[i].str("id") < rows[j].str("id")
	})
	return page(rows, a.Offset, 5), a.Offset >= len(rows), nil
}

type changeArgs struct {
	Kind      string `json:"kind" jsonschema:"programme pour les documents de campagne, redaction pour les modifications de fiche."`
	From      string `json:"from,omitempty" jsonschema:"Début inclus au format AAAA-MM-JJ."`
	To        string `json:"to,omitempty" jsonschema:"Fin incluse au format AAAA-MM-JJ."`
	Candidate string `json:"candidate,omitempty"`
	Theme     string `json:"theme,omitempty"`
	pageArgs
}

func dateOverlaps(value, from, to string) bool {
	lo, hi := value, value
	if len(value) == 4 {
		lo = value + "-01-01"
		hi = value + "-12-31"
	}
	return value != "" && (from == "" || hi >= from) && (to == "" || lo <= to)
}
func (c *snapshot) changes(a changeArgs) (any, bool, error) {
	if err := c.validatePage(a.pageArgs); err != nil {
		return nil, false, err
	}
	if (a.Kind != "programme" && a.Kind != "redaction") || (a.From != "" && !dayOK(a.From)) || (a.To != "" && !dayOK(a.To)) || (a.From != "" && a.To != "" && a.From > a.To) || len(a.Candidate) > 96 || len(a.Theme) > 96 {
		return nil, false, errFilter
	}
	type diff struct {
		id, date string
		data     any
	}
	rows := []diff{}
	match := func(candidate, theme, date string) bool {
		return (a.Candidate == "" || candidate == a.Candidate) && (a.Theme == "" || theme == a.Theme) && dateOverlaps(date, a.From, a.To)
	}
	if a.Kind == "programme" {
		d, err := c.dossiers()
		if err != nil {
			return nil, false, err
		}
		for _, v := range d.Evolutions {
			if match(v.str("candidate"), v.str("theme"), v.str("date")) {
				rows = append(rows, diff{v.str("id"), v.str("date"), v})
			}
		}
	} else {
		for id, versions := range c.history {
			m := c.Measures[c.byID[id]]
			for j := 1; j < len(versions); j++ {
				v := versions[j]
				previous := versions[j-1]
				if !match(m.Candidate, m.Theme, v.Observed) {
					continue
				}
				rows = append(rows, diff{v.ID, v.Observed, map[string]any{"id": v.ID, "candidate": m.Candidate, "theme": m.Theme, "kind": "redaction", "nature": v.Kind, "dateObservation": v.Observed, "enregistreLe": v.Recorded, "resume": v.Summary, "avant": c.versionSummary(previous), "apres": c.versionSummary(v)}})
			}
		}
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].date != rows[j].date {
			return rows[i].date > rows[j].date
		}
		return rows[i].id < rows[j].id
	})
	values := make([]any, len(rows))
	for i, r := range rows {
		values[i] = r.data
	}
	return page(values, a.Offset, 5), a.Offset >= len(rows), nil
}
func (c *snapshot) versionSummary(v edition) map[string]any {
	refs := []map[string]any{}
	for _, s := range v.Snapshot.SourceRefs {
		refs = append(refs, c.cited(s))
	}
	return map[string]any{"id": v.ID, "version": v.Number, "titre": v.Snapshot.Title, "texte": v.Snapshot.Description, "auteur": v.Author, "statut": v.Snapshot.Scope, "montants": v.Snapshot.Amounts, "chiffres": v.Snapshot.Metrics, "sources": refs, "url": site + "/mesures/" + v.MeasureID + "/"}
}

type territoryArgs struct {
	Code string `json:"code" jsonschema:"Code INSEE de la commune ou de l’arrondissement, par exemple 75056."`
}

var communeCode = regexp.MustCompile("^(?:[0-9]{2}|2[AB])[0-9]{3}$")

func (c *snapshot) territory(a territoryArgs) (any, bool, error) {
	code := strings.ToUpper(a.Code)
	if !communeCode.MatchString(code) {
		return nil, false, errFilter
	}
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.territorial == nil {
		var d territories
		if readData(filepath.Join(c.root, "api", "territoires.json"), 5<<20, &d) != nil || d.Names == nil || d.SRU == nil || d.APL == nil || d.Definitions == nil {
			return nil, false, invalidCorpus
		}
		c.territorial = &d
	}
	d := c.territorial
	name, ok := d.Names[code]
	if !ok {
		return map[string]any{"commune": nil}, true, nil
	}
	return map[string]any{"commune": name, "codeInsee": code, "inventaireSRU": d.SRU[code], "accessibiliteGeneralistes": d.APL[code], "definitions": d.Definitions}, false, nil
}
func (c *snapshot) methodology(_ struct{}) (any, bool, error) {
	return map[string]any{"url": site + "/methode/", "attribution": "Le statut campagne désigne une déclaration de campagne. Un texte de parti conserve son auteur collectif. Une orientation exprime une direction générale. Les archives gardent leur millésime.", "absence": "Une case vide indique qu’aucun passage correspondant n’a été documenté.", "votes": "Le scrutin porte sur le texte indiqué. Abstention, absence et vote enregistré conservent leur qualification officielle.", "dates": "La publication peut être datée au jour, à l’année ou inconnue. La consultation et la collecte ont leurs propres dates.", "fraicheur": site + "/mises-a-jour/", "couverture": site + "/statistiques/"}, false, nil
}
