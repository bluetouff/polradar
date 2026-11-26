package main

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
)

type dossiers struct {
	Questions        []record
	Votes            []record
	Evolutions       []record
	Digital          *digitalReview
	VersionDocuments []struct {
		VersionID string `json:"versionId"`
		Date      string
	}
	questionIndex map[string]record
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

const maxPageOffset = 100000

func (c *snapshot) validatePage(p pageArgs) error {
	if p.Offset < 0 || p.Offset > maxPageOffset {
		return errFilter
	}
	return c.checkRevision(p.ExpectedRevision)
}

func nextPageOffset(start, size, total int) *int {
	end := start + size
	if end >= total {
		return nil
	}
	return &end
}

func page[T any](rows []T, offset, limit int) map[string]any {
	start := min(offset, len(rows))
	end := min(start+limit, len(rows))
	next := nextPageOffset(start, end-start, len(rows))
	return map[string]any{"total": len(rows), "offset": start, "suivant": next, "finDeListe": next == nil, "aucunResultat": len(rows) == 0, "resultats": rows[start:end]}
}
func (c *snapshot) dossiers() (*dossiers, error) {
	if err := c.contract.check("dossiers"); err != nil {
		return nil, err
	}
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.editorial == nil {
		var d dossiers
		if readData(filepath.Join(c.root, "api", "dossiers.json"), dossiersLimit, &d) != nil || d.Questions == nil || d.Votes == nil || d.Evolutions == nil {
			return nil, invalidCorpus
		}
		var err error
		d.questionIndex, err = indexAnswerQuestions(d.Questions)
		if err != nil {
			return nil, err
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
		theme := v.str("theme")
		if theme == "" {
			theme = "non-classe"
		}
		if (a.Candidate == "" || a.Candidate == v.str("candidate")) && (a.Theme == "" || a.Theme == theme) && (a.Ballot == "" || a.Ballot == v.str("ballotId")) {
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
	Kind      string `json:"kind" jsonschema:"programme, redaction (correction et enrichissement), correction, enrichissement ou import."`
	DateBasis string `json:"dateBasis,omitempty" jsonschema:"observation ou document. Par défaut, date de l’étape pour les trajectoires et date d’observation pour les versions."`
	From      string `json:"from,omitempty" jsonschema:"Début inclus au format AAAA-MM-JJ."`
	To        string `json:"to,omitempty" jsonschema:"Fin incluse au format AAAA-MM-JJ."`
	Candidate string `json:"candidate,omitempty"`
	Theme     string `json:"theme,omitempty"`
	pageArgs
}

var changeKinds = []string{"programme", "redaction", "import", "correction", "enrichissement"}

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
	if !slices.Contains(changeKinds, a.Kind) || !slices.Contains([]string{"", "observation", "document"}, a.DateBasis) || (a.From != "" && !dayOK(a.From)) || (a.To != "" && !dayOK(a.To)) || (a.From != "" && a.To != "" && a.From > a.To) || len(a.Candidate) > 96 || len(a.Theme) > 96 {
		return nil, false, errFilter
	}
	type diff struct {
		id, date string
		value    func() any
	}
	rows := []diff{}
	match := func(candidate, theme, date string) bool {
		return (a.Candidate == "" || candidate == a.Candidate) && (a.Theme == "" || theme == a.Theme) && dateOverlaps(date, a.From, a.To)
	}
	linked := map[string]bool{}
	documentDates := map[string]string{}
	if a.Kind == "programme" {
		d, err := c.dossiers()
		if err != nil {
			return nil, false, err
		}
		for _, v := range d.Evolutions {
			if id := v.str("versionId"); id != "" {
				linked[id] = true
			}
			date := v.str("date")
			if a.DateBasis == "observation" {
				var after record
				if json.Unmarshal(v["after"], &after) == nil {
					date = after.str("observedOn")
				} else {
					date = ""
				}
			} else if a.DateBasis == "document" && v.str("dateKind") == "consultation" {
				date = ""
			}
			if match(v.str("candidate"), v.str("theme"), date) {
				rows = append(rows, diff{v.str("id"), date, func() any {
					out := make(map[string]any, len(v)+2)
					for key, value := range v {
						out[key] = value
					}
					kind := v.str("dateKind")
					if a.DateBasis == "observation" {
						kind = "observation"
					}
					out["dateFiltre"], out["typeDateFiltre"] = date, kind
					return out
				}})
			}
		}
		for _, item := range d.VersionDocuments {
			documentDates[item.VersionID] = item.Date
		}
	}
	for id, versions := range c.history {
		m := c.Measures[c.byID[id]]
		for j, v := range versions {
			kind := v.Kind
			if kind == "correction" || kind == "enrichissement" {
				kind = "redaction"
			}
			if (kind != a.Kind && v.Kind != a.Kind) || linked[v.ID] {
				continue
			}
			date := v.Observed
			basis := "observation"
			if a.DateBasis == "document" {
				date, basis = documentDates[v.ID], "document"
			}
			if !match(m.Candidate, m.Theme, date) {
				continue
			}
			rows = append(rows, diff{v.ID, date, func() any {
				var previous any
				if j > 0 {
					previous = c.versionSummary(versions[j-1])
				}
				return map[string]any{"id": v.ID, "versionId": v.ID, "candidate": m.Candidate, "theme": m.Theme, "kind": kind, "nature": v.Kind, "date": date, "dateKind": basis, "dateFiltre": date, "typeDateFiltre": basis, "dateDocument": nullable(documentDates[v.ID]), "dateObservation": v.Observed, "enregistreLe": v.Recorded, "resume": v.Summary, "avant": previous, "apres": c.versionSummary(v)}
			}})
		}
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].date != rows[j].date {
			return rows[i].date > rows[j].date
		}
		return rows[i].id < rows[j].id
	})
	result := page(rows, a.Offset, 5)
	window := result["resultats"].([]diff)
	values := make([]any, len(window))
	for i, r := range window {
		values[i] = r.value()
	}
	result["resultats"] = values
	return result, a.Offset >= len(rows), nil
}
func (c *snapshot) versionSummary(v edition) map[string]any {
	refs := []map[string]any{}
	for _, s := range v.Snapshot.SourceRefs {
		refs = append(refs, c.cited(s))
	}
	return map[string]any{"id": v.ID, "version": v.Number, "titre": v.Snapshot.Title, "texte": v.Snapshot.Description, "auteur": v.Author, "statut": v.Snapshot.Scope, "montants": v.Snapshot.Amounts, "chiffres": v.Snapshot.Metrics, "sources": refs, "url": site + "/mesures/" + v.MeasureID + "/#version-" + strconv.Itoa(v.Number)}
}

type territoryArgs struct {
	Code string `json:"code" jsonschema:"Code INSEE de la commune ou de l’arrondissement, par exemple 75056."`
}

var communeCode = regexp.MustCompile("^(?:[0-9]{2}|2[AaBb])[0-9]{3}$")

func (c *snapshot) territory(a territoryArgs) (any, bool, error) {
	code := strings.ToUpper(a.Code)
	if !communeCode.MatchString(code) {
		return nil, false, errFilter
	}
	if err := c.contract.check("territoires"); err != nil {
		return nil, false, err
	}
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.territorial == nil {
		var d territories
		if readData(filepath.Join(c.root, "api", "territoires.json"), territoriesLimit, &d) != nil || d.Names == nil || d.SRU == nil || d.APL == nil || d.Definitions == nil {
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
	value := map[string]any{
		"url": site + "/methode/", "attribution": "Le statut campagne désigne une déclaration de campagne. Un texte de parti conserve son auteur collectif. Une orientation exprime une direction générale. Les archives gardent leur millésime.",
		"absence": "Une case vide indique qu’aucun passage correspondant n’a été documenté.", "votes": "Le scrutin porte sur le texte indiqué. Abstention, absence et vote enregistré conservent leur qualification officielle.",
		"dates": "La publication peut être datée au jour, à l’année ou inconnue. La consultation et la collecte ont leurs propres dates.", "fraicheur": site + "/mises-a-jour/", "couverture": site + "/statistiques/",
		"releveFraicheur": site + "/api/qualite-documentaire.json",
	}
	var report struct {
		SourceCommit string   `json:"sourceCommit"`
		Collections  []record `json:"collections"`
	}
	// Éditions antérieures : garder le lien de lecture sans déduire un état.
	if readData(filepath.Join(c.root, "api", "qualite-documentaire.json"), 512<<10, &report) == nil && report.SourceCommit == c.commit {
		timing := make([]record, 0, len(report.Collections))
		for _, row := range report.Collections {
			if row["freshness"] != nil {
				timing = append(timing, row)
			}
		}
		if len(timing) > 0 {
			value["fraicheurCollectes"] = timing
		}
	}
	return value, false, nil
}
