package main

import (
	_ "embed"
	"encoding/json"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"unicode"
)

//go:embed lexique-recherche.json
var lexicalJSON []byte

type expression struct {
	variant, canonical []string
}

type searchLanguage struct {
	stop, openers, question map[string]bool
	forms                   map[string]string
	expressions             map[string][]expression
}

var lexicon = loadLexicon()
var groupedNumber = regexp.MustCompile(`\b[0-9]{1,3}(?: [0-9]{3})+\b`)
var lexicalWord = regexp.MustCompile(`[\p{L}\p{N}]+(?:[.,][0-9]+)?|[%€]`)

func loadLexicon() searchLanguage {
	var resource struct {
		Version     int
		MotsVides   []string
		Formes      []string
		Expressions [][]string
		Questions   struct{ Debuts, Mots string }
	}
	if json.Unmarshal(lexicalJSON, &resource) != nil || resource.Version != 1 {
		panic("Lexique de recherche incompatible.")
	}
	forms := map[string]string{}
	for _, family := range resource.Formes {
		words := strings.Fields(family)
		for _, variant := range words {
			forms[variant] = words[0]
		}
	}
	expressions := map[string][]expression{}
	for _, family := range resource.Expressions {
		if len(family) < 2 {
			panic("Expression de recherche incomplète.")
		}
		canonical := strings.Fields(family[0])
		for _, phrase := range family[1:] {
			words := strings.Fields(phrase)
			expressions[words[0]] = append(expressions[words[0]], expression{words, canonical})
		}
	}
	for _, rules := range expressions {
		sort.SliceStable(rules, func(i, j int) bool { return len(rules[i].variant) > len(rules[j].variant) })
	}
	return searchLanguage{
		stop:        tokenSet(resource.MotsVides),
		openers:     wordSet(resource.Questions.Debuts),
		question:    wordSet(resource.Questions.Mots),
		forms:       forms,
		expressions: expressions,
	}
}

func wordSet(text string) map[string]bool {
	return tokenSet(strings.Fields(text))
}

func tokenSet(text []string) map[string]bool {
	words := make(map[string]bool, len(text))
	for _, w := range text {
		words[w] = true
	}
	return words
}

func lexicalTokens(text string) []string {
	folded := strings.Map(func(r rune) rune {
		if unicode.IsMark(r) {
			return -1
		}
		if unicode.IsSpace(r) {
			return ' '
		}
		return unicode.ToLower(r)
	}, text)
	folded = groupedNumber.ReplaceAllStringFunc(accents.Replace(folded), func(number string) string {
		return strings.ReplaceAll(number, " ", "")
	})
	tokens := lexicalWord.FindAllString(folded, -1)
	for i, word := range tokens {
		if word[0] >= '0' && word[0] <= '9' {
			tokens[i] = strings.ReplaceAll(word, ",", ".")
		}
	}
	return tokens
}

func canonicalWords(words []string) []string {
	result := make([]string, 0, len(words))
	for len(words) > 0 {
		next, consumed := words[:1], 1
		for _, phrase := range lexicon.expressions[words[0]] {
			if len(words) >= len(phrase.variant) && slices.Equal(words[:len(phrase.variant)], phrase.variant) {
				next, consumed = phrase.canonical, len(phrase.variant)
				break
			}
		}
		for _, word := range next {
			if form := lexicon.forms[word]; form != "" {
				word = form
			}
			result = append(result, word)
		}
		words = words[consumed:]
	}
	return result
}

func lexicalTerms(text string) []string {
	terms := canonicalWords(strings.Fields(text))
	return slices.DeleteFunc(terms, func(word string) bool {
		return lexicon.stop[word]
	})
}

func indexedTerms(text string) map[string]bool {
	raw := lexicalTokens(text)
	words := tokenSet(raw)
	for _, word := range canonicalWords(raw) {
		words[word] = true
	}
	return words
}

func measureQuery(query string) string {
	first, _, _ := strings.Cut(query, " ")
	if !lexicon.openers[first] {
		return query
	}
	terms := strings.Fields(query)
	kept := terms[:0]
	for _, term := range terms {
		if !lexicon.question[term] {
			kept = append(kept, term)
		}
	}
	return strings.Join(kept, " ")
}

type lexicalRecord struct {
	title            string
	titleTerms, body map[string]bool
}

func indexRecord(m measure, candidate, theme string) lexicalRecord {
	title := strings.Join(lexicalTokens(m.Title), " ")
	fields := []string{m.Title, m.Description, m.DisplayAuthor, candidate, theme}
	if m.DigitalTopic != "" {
		fields = append(fields, "numérique")
	}
	for _, field := range []*string{m.Beneficiaries, m.Timing, m.Financing} {
		if field != nil {
			fields = append(fields, *field)
		}
	}
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
	text := strings.Join(fields, " ")
	words := indexedTerms(text)
	// Specific rail services can be found by their broader mode of transport.
	normalized := " " + normalize(text) + " "
	if words["ter"] || strings.Contains(normalized, " fret ferroviaire ") || strings.Contains(normalized, " liaison ferroviaire ") {
		words["transport"], words["ferroviaire"] = true, true
	}
	return lexicalRecord{title, indexedTerms(m.Title), words}
}

func lexicalPrefix(term string) bool {
	if len(term) < 4 || lexicon.forms[term] != "" {
		return false
	}
	return strings.IndexFunc(term, func(r rune) bool { return r < 'a' || r > 'z' }) == -1
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
		if lexicalPrefix(term) {
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
