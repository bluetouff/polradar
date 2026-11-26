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

const answerSourceLimit = 6

func answerDocumentURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil {
		return ""
	}
	return u.String()
}

func answerPageURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil || u.User != nil {
		return ""
	}
	if u.Scheme == "https" && u.Host == "polradar.fr" {
		return u.String()
	}
	if !u.IsAbs() && u.Host == "" && strings.HasPrefix(u.Path, "/") && !strings.HasPrefix(u.Path, "//") && !strings.Contains(u.Path, "\\") {
		return site + u.String()
	}
	return ""
}

func answerText(s string, limit int) string {
	if utf8.RuneCountInString(s) <= limit {
		return s
	}
	return strings.TrimSpace(string([]rune(s)[:limit])) + "…"
}

func (c *snapshot) answerCitation(ref reference) answerSource {
	s := c.bySource[ref.SourceID]
	cited := c.cited(ref)
	v := answerSource{ID: s.ID, Document: s.Title, URL: answerDocumentURL(cited["url"].(string)), Passage: ref.Locator, Consultation: s.Checked}
	if s.Published != nil {
		v.Publication = *s.Published
	}
	if s.PublishedYear != nil {
		v.PublicationYear = *s.PublishedYear
	}
	if s.PublicationReference != nil {
		v.PublicationReference = *s.PublicationReference
	}
	return v
}

func (item *answerItem) addSource(source answerSource) {
	if source.ID != "" && source.URL != "" && source.Document != "" && len(item.Sources) < answerSourceLimit &&
		!slices.ContainsFunc(item.Sources, func(p answerSource) bool {
			return p.ID == source.ID && p.URL == source.URL && p.Passage == source.Passage
		}) {
		item.Sources = append(item.Sources, source)
	}
}

func (c *snapshot) measureAnswer(m measure) answerItem {
	item := newAnswerItem(m.ID, m.Title, measureURL(m.ID, 0))
	for _, v := range c.history[m.ID] {
		if v.Number == m.Revision {
			item.Version, item.URL = v.ID, measureURL(m.ID, v.Number)
			break
		}
	}
	item.Person = m.Candidate
	item.Summary, item.Author, item.Status = answerText(m.Description, 720), m.DisplayAuthor, m.Scope
	if dayOK(m.Checked) {
		item.Date, item.Kind = m.Checked, "consultation"
	}
	for _, ref := range m.SourceRefs {
		item.addSource(c.answerCitation(ref))
	}
	for _, group := range [][]json.RawMessage{m.Metrics, m.Amounts} {
		for _, raw := range group {
			var value struct {
				Label, Unit, Period, Basis string
				SourceID                   string `json:"sourceId"`
				Value                      json.Number
			}
			if json.Unmarshal(raw, &value) == nil && value.Value != "" && value.Label != "" && len(item.Facts) < answerFactLimit &&
				slices.ContainsFunc(item.Sources, func(s answerSource) bool { return s.ID == value.SourceID }) {
				item.Facts = append(item.Facts, answerFact{Label: value.Label, Value: value.Value.String(), Unit: value.Unit, Period: value.Period, Basis: value.Basis, SourceID: value.SourceID})
			}
		}
	}
	return item
}

func (c *snapshot) answerMeasureFunding(result *documentaryAnswer, m measure) {
	item := c.measureAnswer(m)
	if m.Financing != nil && *m.Financing != "" {
		item.Summary = answerText(*m.Financing, 720)
		result.Results = append(result.Results, item)
		result.finish(1, "Le financement et les montants éventuels reprennent la fiche et ses sources.")
		return
	}
	result.Results = append(result.Results, item)
	result.describe("partiel", "financement_non_documente", "La fiche et ses sources sont disponibles. Aucun financement précis n’y est renseigné.")
}

func (c *snapshot) versionMeasure(m measure, version edition) measure {
	s := version.Snapshot
	s.ID, s.Candidate, s.Theme, s.DisplayAuthor, s.Revision = m.ID, m.Candidate, m.Theme, version.Author, version.Number
	return s
}

func (c *snapshot) requestedMeasure(question string) (measure, bool) {
	for _, id := range answerID.FindAllString(strings.ToLower(question), -1) {
		if i, ok := c.byID[id]; ok {
			return c.Measures[i], true
		}
	}
	quote := answerQuote.FindAllStringSubmatch(question, -1)
	if len(quote) != 1 {
		return measure{}, false
	}
	title := normalize(quote[0][1] + quote[0][2])
	var selected measure
	for _, m := range c.Measures {
		if normalize(m.Title) == title {
			if selected.ID != "" {
				return measure{}, false
			}
			selected = m
		}
	}
	return selected, selected.ID != ""
}

func (c *snapshot) answerProposals(result *documentaryAnswer, question, topic string, people []candidate) error {
	if m, ok := c.requestedMeasure(question); ok {
		result.Results = append(result.Results, c.measureAnswer(m))
		result.finish(1, "La fiche indique l’auteur et le passage qui documente cette proposition.")
		return nil
	}
	if result.Intent == "source" {
		for _, s := range c.Sources {
			if s.URL != "" && strings.Contains(question, s.URL) {
				item := newAnswerItem(s.ID, s.Title, site+"/sources/")
				item.addSource(c.answerCitation(reference{SourceID: s.ID}))
				result.Results = append(result.Results, item)
				result.finish(1, "Ce document figure dans le catalogue de Polradar. Les passages des fiches se consultent dans le corpus.")
				return nil
			}
		}
	}
	words := strings.Join(answerTerms(topic), " ")
	if words == "" && len(people) != 1 || utf8.RuneCountInString(words) > 160 {
		result.describe("ambigu", "sujet_a_preciser", "Précisez le sujet, le nom de la candidature ou l’identifiant de la fiche.")
		return nil
	}
	if len(people) > 1 {
		result.describe("ambigu", "dossier_a_preciser", "Choisissez la candidature pour laquelle vous souhaitez retrouver le passage.")
		return nil
	}
	args := searchArgs{Query: words, Limit: answerLimit}
	if len(people) == 1 {
		args.Candidate = people[0].ID
		result.Coverage.Scope = "Fiches de campagne, de parti et d’orientation du dossier " + people[0].Name
	}
	data, _, err := c.matchMeasures(args)
	if err != nil {
		return err
	}
	page := data.(map[string]any)
	for _, row := range page["resultats"].([]map[string]any) {
		m := c.Measures[c.byID[row["id"].(string)]]
		result.Results = append(result.Results, c.measureAnswer(m))
	}
	result.finish(page["total"].(int), "Chaque fiche indique le document et le passage qui l’étayent.")
	return nil
}

// Titles and identifiers are public editorial data. A tied match requires a
// choice from the reader rather than an arbitrary selection by candidate.
func answerTopicScore(terms []string, id, title string) int {
	score := 0
	name := normalize(title)
	keys := indexedTerms(id + " " + title)
	for _, term := range terms {
		if keys[term] {
			score++
			if answerHas(name, term) {
				score++
			}
		}
	}
	return score
}

func answerChoose(rows []record, topic string) []record {
	best := 0
	selected := []record{}
	terms := answerTerms(topic)
	for _, row := range rows {
		id, title := row.str("id"), row.str("title")
		if id == "" || title == "" {
			continue
		}
		score := answerTopicScore(terms, id, title)
		if answerHas(topic, normalize(id), normalize(title)) {
			score += 100
		}
		if score == 0 || score < best {
			continue
		}
		if score > best {
			best = score
			selected = nil
		}
		selected = append(selected, row)
	}
	return selected
}

func (c *snapshot) answerComparison(result *documentaryAnswer, topic string, people []candidate) error {
	if len(people) < 2 || len(people) > 6 || len(answerTerms(topic)) == 0 {
		result.describe("ambigu", "comparaison_a_preciser", "Indiquez un sujet et les deux à six candidatures à comparer.")
		return nil
	}
	d, err := c.dossiers()
	if err != nil {
		return err
	}
	selected := answerChoose(d.Questions, topic)
	if len(selected) != 1 {
		result.describe("ambigu", "question_comparative_a_preciser", "Choisissez une question documentée dans le comparateur.")
		for _, q := range selected[:min(len(selected), answerLimit)] {
			if href := answerPageURL(q.str("url")); href != "" {
				result.Links = append(result.Links, answerLink{q.str("title"), href})
			}
		}
		return nil
	}
	q := selected[0]
	ids := make([]string, len(people))
	for i, person := range people {
		ids[i] = person.ID
	}
	result.Title = q.str("title")
	if len(ids) <= 3 {
		href := site + "/comparer/?" + (url.Values{"question": {q.str("id")}, "c": {strings.Join(ids, ",")}}).Encode()
		result.Links = append(result.Links, answerLink{"Retrouver cette sélection dans le comparateur", href})
	}
	// The question page is a canonical entry independent of client state.
	if href := answerPageURL(q.str("url")); href != "" {
		result.Coverage.URL = href
		result.Links = append(result.Links, answerLink{"Lire la question et toutes ses positions", href})
	}
	data, _, err := c.compare(compareArgs{Question: q.str("id"), Candidates: ids})
	if err != nil {
		return err
	}
	page := data.(map[string]any)
	missing := 0
	otherPositions := false
	outdated := false
	unqualified := false
	for _, candidateRow := range page["resultats"].([]map[string]any) {
		id, name := candidateRow["candidate"].(string), candidateRow["nom"].(string)
		response, _ := candidateRow["reponse"].(record)
		var positions []record
		if len(response) != 0 && json.Unmarshal(response["positions"], &positions) != nil {
			return invalidCorpus
		}
		if len(positions) == 0 {
			item := newAnswerItem(id, name, result.Coverage.URL)
			item.Status, item.Summary = "non-documente", "Aucun passage correspondant n’est documenté ici pour ce dossier."
			if raw := response["complements"]; raw != nil {
				var complements []record
				if json.Unmarshal(raw, &complements) != nil {
					return invalidCorpus
				}
				if len(complements) != 0 {
					context, err := c.answerQuestionPosition(q.str("id"), id, name, "complement", complements[0])
					if err != nil {
						return err
					}
					item = context
				}
			}
			result.Results = append(result.Results, item)
			missing++
			continue
		}
		otherPositions = otherPositions || len(positions) > 1
		item, err := c.answerQuestionPosition(q.str("id"), id, name, "reponse", positions[0])
		if err != nil {
			return err
		}
		unqualified = unqualified || item.Relation == nil
		outdated = outdated || item.Relation != nil && item.Relation.Status == "version-depassee"
		result.Results = append(result.Results, item)
	}
	result.finish(page["total"].(int), "Les positions restent rattachées à la question et à l’auteur du passage cité.")
	if unqualified {
		result.describe("partiel", "qualification_relation_indisponible", "Cette édition fournit les passages cités. La qualification des liens en réponse ou complément reste indisponible pour cette édition.")
	} else if missing > 0 {
		result.describe("partiel", "positions_non_documentees", "La grille indique les réponses documentées. Les propositions de contexte portent la mention « complément ».")
	} else if outdated {
		result.describe("partiel", "version_depassee", "La comparaison conserve les versions citées. Les fiches correspondantes indiquent les versions plus récentes.")
	} else if otherPositions {
		result.describe("partiel", "autres_positions", "La page de la question donne les autres positions documentées et leurs limites.")
	}
	return nil
}

func (c *snapshot) answerQuestionPosition(question, candidateID, name, qualification string, position record) (answerItem, error) {
	index, ok := c.byID[position.str("measureId")]
	if !ok || c.Measures[index].Candidate != candidateID {
		return answerItem{}, invalidCorpus
	}
	m := c.Measures[index]
	history := c.history[m.ID]
	version, ok := findAnswerEdition(history, position.str("versionId"))
	if !ok {
		return answerItem{}, invalidCorpus
	}
	item := c.measureAnswer(c.versionMeasure(m, version))
	item.Title = name + " · " + position.str("title")
	item.Summary = answerText(position.str("description"), 720)
	if raw := position["relation"]; raw != nil {
		var relation answerRelation
		expectStatus := "version-courante"
		if m.Revision != version.Number {
			expectStatus = "version-depassee"
		}
		if json.Unmarshal(raw, &relation) != nil || relation.Qualification != qualification ||
			relation.ID != "question-proposition:"+question+":"+version.ID ||
			relation.CitedVersion != version.ID || relation.CurrentVersion != history[len(history)-1].ID ||
			relation.VersionRule != "version-citee" || relation.Status != expectStatus || strings.TrimSpace(relation.Justification) == "" {
			return answerItem{}, invalidCorpus
		}
		item.Relation = &relation
	} else if qualification == "complement" {
		return answerItem{}, invalidCorpus
	}
	return item, nil
}

func findAnswerEdition(versions []edition, id string) (edition, bool) {
	for _, v := range versions {
		if v.ID == id {
			return v, true
		}
	}
	return edition{}, false
}

func (c *snapshot) answerHistory(result *documentaryAnswer, question, topic string, people []candidate) error {
	if m, ok := c.requestedMeasure(question); ok {
		list := c.history[m.ID]
		n := 0
		if match := answerVersion.FindStringSubmatch(strings.ToLower(question)); match != nil {
			n, _ = strconv.Atoi(match[1])
		} else {
			text := normalize(question)
			switch {
			case answerHas(text, "premiere version"):
				n = 1
			case answerHas(text, "deuxieme version", "seconde version"):
				n = 2
			case answerHas(text, "troisieme version"):
				n = 3
			}
		}
		total := 0
		for i := len(list) - 1; i >= 0; i-- {
			v := list[i]
			if n != 0 && n != v.Number {
				continue
			}
			total++
			if len(result.Results) < answerLimit {
				item := c.measureAnswer(c.versionMeasure(m, v))
				item.Title = "Version " + strconv.Itoa(v.Number) + " · " + item.Title
				item.Date, item.Kind = v.Observed, "observation"
				result.Results = append(result.Results, item)
			}
		}
		result.Coverage.Scope = "Versions conservées pour la fiche"
		result.finish(total, "La version citée reprend le texte et les références de l’édition documentaire correspondante.")
		return nil
	}
	dates := answerDates(question)
	if len(dates) == 0 || len(people) > 1 {
		result.describe("ambigu", "periode_a_preciser", "Indiquez une période avec des dates ou l’identifiant d’une fiche à examiner.")
		return nil
	}
	words := strings.Join(answerTerms(topic), " ")
	// Keep unsupported topic filters visible through the full archive instead
	// of returning revisions from unrelated subjects.
	args := changeArgs{Kind: "programme", DateBasis: "observation", From: dates[0], To: dates[len(dates)-1]}
	for _, subject := range c.Themes {
		if answerHas(words, normalize(subject.ID), normalize(subject.Label)) {
			if args.Theme != "" {
				result.describe("ambigu", "theme_historique_a_preciser", "Sélectionnez un seul thème pour examiner ses changements dans la période.")
				return nil
			}
			args.Theme = subject.ID
		}
	}
	recognized := "changement changements change changes programme programmes evolution evolutions archives version versions cette semaine quels entre jour du au et depuis corrections correction en enregistre derniers dernier annee ont"
	remaining := normalize(topic)
	for _, date := range dates {
		remaining = strings.ReplaceAll(remaining, normalize(date), " ")
	}
	for _, match := range answerLongDate.FindAllString(normalize(question), -1) {
		remaining = strings.ReplaceAll(remaining, match, " ")
	}
	if args.Theme == "" {
		for _, term := range answerTerms(remaining) {
			if !answerHas(recognized, term) {
				result.describe("partiel", "theme_historique_a_preciser", "L’historique est indexé par période, candidature et thème. Sélectionnez un thème du corpus dans la rubrique.")
				return nil
			}
		}
	}
	if len(people) == 1 {
		args.Candidate = people[0].ID
	}
	if answerHas(normalize(question), "depuis") && len(dates) == 1 {
		args.To = ""
	}
	if answerHas(normalize(question), "corrections", "correction") {
		args.Kind = "correction"
	}
	data, _, err := c.changes(args)
	if err != nil {
		return err
	}
	page := data.(map[string]any)
	for _, row := range page["resultats"].([]any) {
		if len(result.Results) >= answerLimit {
			break
		}
		value, ok := row.(map[string]any)
		if !ok {
			return invalidCorpus
		}
		id := answerString(value, "versionId")
		suffix := strings.LastIndex(id, "-v")
		if suffix < 0 {
			continue
		}
		measureID := id[:suffix]
		index, ok := c.byID[measureID]
		if !ok {
			continue
		}
		v, ok := findAnswerEdition(c.history[measureID], id)
		if !ok {
			continue
		}
		item := c.measureAnswer(c.versionMeasure(c.Measures[index], v))
		item.Date, item.Kind = answerString(value, "dateFiltre"), "observation"
		result.Results = append(result.Results, item)
	}
	result.finish(page["total"].(int), "Les dates correspondent à l’observation des changements dans le corpus.")
	return nil
}

func answerString(row map[string]any, field string) string {
	value, _ := row[field].(string)
	return value
}

func (c *snapshot) answerRecords(collection string) ([]record, error) {
	def := collections[collection]
	if def.file == "" {
		return nil, invalidCorpus
	}
	if err := c.contract.check(collection); err != nil {
		return nil, err
	}
	var raw map[string]json.RawMessage
	var rows []record
	if readData(filepath.Join(c.root, "api", def.file), 2<<20, &raw) != nil || json.Unmarshal(raw[def.key], &rows) != nil || rows == nil {
		return nil, invalidCorpus
	}
	return rows, nil
}

func (c *snapshot) answerLaw(result *documentaryAnswer, topic string) error {
	rows, err := c.answerRecords("droit")
	if err != nil {
		return err
	}
	for _, phrase := range []string{"droit en vigueur", "regles en vigueur", "autorise par la loi"} {
		topic = strings.ReplaceAll(topic, phrase, " ")
	}
	topic = strings.Join(strings.Fields(topic), " ")
	selected := answerChoose(rows, topic)
	if len(selected) == 0 {
		result.describe("hors-perimetre", "droit_non_documente", "Aucun dossier de droit en vigueur ne correspond à cette question dans le corpus.")
		return nil
	}
	if len(selected) > 1 || !answerLegalTopicMatches(topic, selected[0]) {
		result.describe("ambigu", "contexte_juridique_a_preciser", "Précisez le dispositif juridique à examiner.")
		for _, row := range selected[:min(len(selected), answerLimit)] {
			if href := answerPageURL(row.str("page")); href != "" {
				result.Links = append(result.Links, answerLink{row.str("title"), href})
			}
		}
		return nil
	}
	row := selected[0]
	path := answerPageURL(row.str("page"))
	result.Title = row.str("title")
	if path != "" {
		result.Coverage.URL = path
		result.Links = append(result.Links, answerLink{"Lire le dossier et ses limites", path})
	}
	var rules []struct {
		Title, Body string
		Refs        []struct{ SourceID, Label, URL string }
	}
	if json.Unmarshal(row["rules"], &rules) != nil || len(rules) == 0 {
		result.describe("partiel", "regles_a_consulter", "La rubrique renvoie vers les règles, exceptions et références applicables.")
		return nil
	}
	limit := answerLimit
	if answerHas(topic, "premier article", "article cite en premier", "en premier") {
		limit = 1
	}
	for i, rule := range rules[:min(len(rules), limit)] {
		item := newAnswerItem(row.str("id")+"-"+strconv.Itoa(i+1), rule.Title, path)
		item.Summary, item.Status = answerText(rule.Body, 720), "droit-en-vigueur"
		if dayOK(row.str("checked")) {
			item.Date, item.Kind = row.str("checked"), "consultation"
		}
		for _, r := range rule.Refs {
			citation := c.answerCitation(reference{SourceID: r.SourceID, Locator: r.Label})
			citation.URL = answerDocumentURL(r.URL)
			item.addSource(citation)
		}
		result.Results = append(result.Results, item)
	}
	total := len(rules)
	if limit == 1 {
		total = 1
	}
	result.finish(total, "Les références sont présentées dans l’ordre du dossier de droit en vigueur.")
	return nil
}

func answerLegalTopicMatches(topic string, row record) bool {
	terms := indexedTerms(row.str("id") + " " + row.str("title"))
	return !slices.ContainsFunc(answerTerms(topic), func(term string) bool {
		return !terms[term] && !answerHas("qui article lcen premier regle regles legal legale loi legislation applicable autorise autorisation usage utilisation utiliser a t il possible", term)
	})
}

func (c *snapshot) answerVerification(result *documentaryAnswer, question string) error {
	rows, err := c.answerRecords("verifications")
	if err != nil {
		return err
	}
	text := normalize(question)
	for _, row := range rows {
		quote, id := normalize(row.str("quote")), row.str("id")
		if !answerHas(text, quote, normalize(id)) {
			continue
		}
		item := newAnswerItem(id, row.str("title"), result.Coverage.URL)
		item.Summary, item.Author, item.Status = row.str("context"), row.str("speaker"), row.str("assessment")
		item.Date, item.Kind = row.str("date"), "publication"
		for _, k := range []string{"statement", "reference"} {
			var ref record
			if json.Unmarshal(row[k], &ref) != nil {
				continue
			}
			s := answerSource{ID: id + "-" + k, Document: ref.str("title"), URL: answerDocumentURL(ref.str("url")), Publication: ref.str("date"), Passage: row.str("period")}
			if k == "statement" {
				s.Passage = row.str("quote")
			}
			item.addSource(s)
		}
		if len(item.Sources) == 2 {
			for _, field := range []struct{ key, label, reference string }{{"claimed", "Valeur déclarée", "statement"}, {"observed", "Valeur publiée", "reference"}} {
				if value := row.str(field.key); value != "" {
					item.Facts = append(item.Facts, answerFact{Label: field.label, Value: value, Unit: row.str("unit"), Period: row.str("period"), SourceID: id + "-" + field.reference})
				}
			}
		}
		result.Results = append(result.Results, item)
		result.finish(1, "Cette déclaration a fait l’objet d’un rapprochement documenté. Le périmètre et les sources figurent dans la fiche.")
		return nil
	}
	result.describe("hors-perimetre", "affirmation_non_examinee", "Aucune vérification publiée ne correspond à cette formulation. Donnez l’identifiant d’une vérification ou la déclaration exacte.")
	return nil
}
