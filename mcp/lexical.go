package main

import (
	"encoding/json"
	"strconv"
	"strings"
)

var stopWords = wordSet("a au aux avec ce cette d de des du en et l la le les par pour sur un une")
var aliases = [][]string{
	{"csg", "contribution sociale generalisee"}, {"smic", "salaire minimum interprofessionnel de croissance"},
	{"hlm", "habitation a loyer modere", "logements sociaux", "logement social"},
	{"cybersecurite", "securite informatique", "securite numerique"},
	{"chiffrement", "cryptographie"}, {"ehpad", "etablissement d hebergement pour personnes agees dependantes"},
	{"pac", "politique agricole commune"}, {"onu", "nations unies", "organisation des nations unies"},
	{"vaccination obligatoire", "obligations vaccinales", "obligation vaccinale"},
	{"ponderer", "ponderation"},
}

func wordSet(text string) map[string]bool {
	words := map[string]bool{}
	for _, w := range strings.Fields(text) {
		words[w] = true
	}
	return words
}
func lexicalTerms(text string) []string {
	terms := []string{}
	for _, w := range strings.Fields(text) {
		if !stopWords[w] {
			terms = append(terms, w)
		}
	}
	return terms
}

type lexicalRecord struct {
	title            string
	titleTerms, body map[string]bool
}

func indexRecord(m measure, candidate, theme string) lexicalRecord {
	title := normalize(m.Title)
	fields := []string{title, m.Description, m.DisplayAuthor, candidate, theme}
	for _, group := range [][]json.RawMessage{m.Metrics, m.Amounts} {
		for _, raw := range group {
			var n struct {
				Value                      *float64
				Label, Unit, Period, Basis string
			}
			if json.Unmarshal(raw, &n) == nil && n.Value != nil {
				fields = append(fields, strconv.FormatFloat(*n.Value, 'f', -1, 64), n.Label, n.Unit, n.Period, n.Basis)
			}
		}
	}
	text := " " + normalize(strings.Join(fields, " ")) + " "
	words := wordSet(text)
	// Specific rail services can be found by their broader mode of transport.
	if words["ter"] || strings.Contains(text, " fret ferroviaire ") || strings.Contains(text, " liaison ferroviaire ") {
		words["transport"], words["ferroviaire"] = true, true
	}
	for _, group := range aliases {
		found := false
		for _, phrase := range group {
			if strings.Contains(text, " "+phrase+" ") {
				found = true
				break
			}
		}
		if found {
			for _, phrase := range group {
				for _, term := range lexicalTerms(phrase) {
					words[term] = true
				}
			}
		}
	}
	return lexicalRecord{title, wordSet(title), words}
}
func (r lexicalRecord) rank(query string, terms []string) (int, bool) {
	score := 0
	for _, term := range terms {
		if r.titleTerms[term] {
			score += 8
			continue
		}
		if r.body[term] {
			score += 4
			continue
		}
		found := false
		if len(term) >= 4 {
			for word := range r.body {
				if strings.HasPrefix(word, term) {
					found = true
					break
				}
			}
		}
		if !found {
			return 0, false
		}
		score++
	}
	if query != "" {
		if r.title == query {
			score += 100
		} else if strings.Contains(" "+r.title+" ", " "+query+" ") {
			score += 40
		}
	}
	return score, true
}
