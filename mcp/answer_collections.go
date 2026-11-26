package main

import (
	"encoding/json"
	"net/url"
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
)

var answerBallotNumber = regexp.MustCompile(`\bscrutin (?:n |numero )?([1-9][0-9]{0,5})\b`)

type answerVote struct {
	Candidat   string
	Vote       string
	Delegation *bool
}

func (c *snapshot) answerScrutinies(result *documentaryAnswer, question, topic string, people []candidate, ballot string) error {
	a := dataArgs{Nature: "vote", Collection: "parlement"}
	asksDelegation := answerHas(topic, "delegation", "par delegation")
	if asksDelegation && len(people) == 0 {
		result.describe("ambigu", "personne_a_preciser", "Indiquez le nom de la personne dont vous cherchez la délégation de vote.")
		return nil
	}
	dates := answerDates(question)
	if len(dates) > 2 {
		result.describe("ambigu", "periode_a_preciser", "Indiquez une seule séance ou une période avec ses deux dates.")
		return nil
	}
	if len(dates) > 0 {
		a.Debut, a.Fin = dates[0], dates[len(dates)-1]
	}
	switch {
	case answerHas(topic, "parlement europeen"):
		a.Institution = "parlement-europeen"
		topic = strings.ReplaceAll(topic, "parlement europeen", " ")
	case answerHas(topic, "assemblee nationale", "assemblee"):
		a.Institution = "assemblee"
		topic = strings.ReplaceAll(topic, "assemblee nationale", " ")
	case answerHas(topic, "senat"):
		a.Institution = "senat"
		topic = strings.ReplaceAll(topic, "senat", " ")
	}
	topic = withoutAnswerDates(question, topic)
	num := ""
	if match := answerBallotNumber.FindStringSubmatch(topic); match != nil {
		num = match[1]
		topic = answerBallotNumber.ReplaceAllString(topic, " ")
	}
	terms := []string{}
	for _, term := range answerTerms(topic) {
		if !answerHas("scrutin scrutins objet issue adopte adoptee adoption position positionne seance enregistre nominatifs nominatif assemblee contre abstention abstenu releve indique delegation", term) {
			terms = append(terms, term)
		}
	}
	if ballot == "" && num == "" && len(terms) == 0 && a.Debut == "" && len(people) == 0 {
		result.describe("ambigu", "scrutin_a_preciser", "Indiquez une référence, une date, une candidature ou l’objet du scrutin.")
		return nil
	}
	if err := c.contract.check("parlement"); err != nil {
		return err
	}
	index, err := c.actIndex()
	if err != nil {
		return err
	}
	if actCoverage(index, a) == "periode-hors-registre" {
		result.Coverage.URL = site + "/votes/archives/"
		result.Links = append(result.Links, answerLink{"Vérifier la période couverte par les archives", result.Coverage.URL})
		result.describe("hors-perimetre", "periode_hors_registre", "La date demandée se situe hors des séances documentées pour cette institution.")
		return nil
	}
	if len(people) == 1 && ballot == "" && num == "" {
		if index.Candidats[people[0].ID] == "" {
			result.describe("hors-perimetre", "personne_hors_registre", "Le dossier demandé ne figure pas dans les suivis nominatifs du registre.")
			return nil
		}
		a.Candidat = people[0].ID
	}
	if ballot != "" {
		terms = nil
	}
	total := 0
	namedVoteMissing := false
	delegationMissing := false
	for i := range index.Actes {
		r := &index.Actes[i]
		if ballot != "" && r.ID != ballot || num != "" && !strings.HasSuffix(r.ID, "V"+num) ||
			!matchAct(r, a, terms) {
			continue
		}
		total++
		if len(result.Results) >= answerLimit {
			continue
		}
		item := newAnswerItem(r.ID, r.Titre, result.Coverage.URL)
		labels := map[string]string{"assemblee": "Assemblée nationale", "senat": "Sénat", "parlement-europeen": "Parlement européen"}
		item.Author, item.Date, item.Status, item.Kind = labels[r.Institution], r.Date, "scrutin", "scrutin"
		item.addSource(answerSource{ID: r.ID, Document: item.Author, URL: answerDocumentURL(r.Source), Passage: r.Titre})
		var positions map[string]answerVote
		if asksDelegation {
			var err error
			positions, err = c.answerRollPositions(r)
			if err != nil {
				return err
			}
		}
		foundVotes := 0
		foundDelegations := 0
		for _, person := range people {
			if len(item.Facts) == answerFactLimit {
				break
			}
			for _, mention := range r.Mentions {
				if mention[0] == person.ID && mention[2] == "vote" {
					item.Facts = append(item.Facts, answerFact{Label: person.Name, Value: mention[1], Period: r.Date, SourceID: r.ID})
					foundVotes++
					if position, ok := positions[person.ID]; ok && len(item.Facts) < answerFactLimit {
						if position.Vote != mention[1] {
							return invalidCorpus
						}
						if position.Delegation != nil {
							value := "non"
							if *position.Delegation {
								value = "oui"
							}
							item.Facts = append(item.Facts, answerFact{Label: "Délégation de vote · " + person.Name, Value: value, Period: r.Date, SourceID: r.ID})
							foundDelegations++
						}
					}
					break
				}
			}
		}
		namedVoteMissing = namedVoteMissing || foundVotes < len(people)
		delegationMissing = delegationMissing || asksDelegation && foundDelegations < len(people)
		result.Results = append(result.Results, item)
	}
	result.finish(total, "Les résultats donnent l’objet du scrutin et son lien officiel.")
	switch {
	case num != "" && total > 1:
		result.describe("ambigu", "numero_reutilise", "Plusieurs scrutins portent ce numéro. Indiquez la législature avec la date ou la référence officielle.")
	case namedVoteMissing:
		result.describe("partiel", "votes_nominatifs_non_documentes", "Les scrutins sont documentés. Seuls les votes nominatifs présents dans le registre sont indiqués.")
	case delegationMissing:
		result.describe("partiel", "delegation_non_documentee", "Le vote est documenté. Le relevé disponible ne précise pas la délégation demandée.")
	}
	return nil
}

func (c *snapshot) answerRollPositions(act *actRow) (map[string]answerVote, error) {
	if !ballotPattern.MatchString(act.ID) {
		return nil, nil
	}
	value, empty, err := c.parliamentaryData(dataArgs{Collection: "parlement", ID: act.ID})
	if err != nil || empty {
		return nil, err
	}
	var raw json.RawMessage
	switch row := value.(map[string]any)["publication"].(type) {
	case record:
		if row.str("id") != act.ID || row.str("date") != act.Date || row.str("source") != act.Source {
			return nil, invalidCorpus
		}
		raw = row["positions"]
	case map[string]any:
		if row["id"] != act.ID || row["date"] != act.Date || row["source"] != act.Source {
			return nil, invalidCorpus
		}
		raw, _ = row["positions"].(json.RawMessage)
	}
	var positions []answerVote
	if json.Unmarshal(raw, &positions) != nil {
		return nil, invalidCorpus
	}
	byPerson := make(map[string]answerVote, len(positions))
	for _, pos := range positions {
		if _, known := byPerson[pos.Candidat]; pos.Candidat == "" || known {
			return nil, invalidCorpus
		}
		byPerson[pos.Candidat] = pos
	}
	return byPerson, nil
}

func withoutAnswerDates(question, text string) string {
	for _, date := range answerDates(question) {
		text = strings.ReplaceAll(text, normalize(date), " ")
	}
	for _, match := range answerLongDate.FindAllString(normalize(question), -1) {
		text = strings.ReplaceAll(text, match, " ")
	}
	return strings.Join(strings.Fields(text), " ")
}

var answerNoticePage = regexp.MustCompile(`\bpage ([1-9][0-9]{0,3})\b`)

func namedPollField(text, field string) bool {
	value := normalize(field)
	if answerHas(text, value) {
		return true
	}
	// The published institute can include the company’s partner in a wave.
	for _, token := range strings.Fields(value) {
		if slices.Contains([]string{"ifop", "ipsos", "opinionway", "yougov", "cluster17", "harris", "elabe", "verian", "bva"}, token) && answerHas(text, token) {
			return true
		}
	}
	return false
}

func (c *snapshot) answerPolls(result *documentaryAnswer, question, topic string, people []candidate) error {
	if err := c.contract.check("sondages"); err != nil {
		return err
	}
	dates := answerDates(question)
	exact := ""
	names := map[string]bool{}
	for _, r := range c.Polls {
		if id := r.str("id"); id != "" && answerHas(topic, normalize(id)) {
			exact = id
			break
		}
		if v := r.str("institute"); namedPollField(topic, v) {
			names[v] = true
		}
	}
	page := ""
	if match := answerNoticePage.FindStringSubmatch(topic); match != nil {
		page = match[1]
	}
	if exact == "" && len(names) == 0 && len(dates) == 0 {
		result.describe("ambigu", "sondage_a_preciser", "Indiquez un institut, une date de terrain ou la référence du scénario.")
		return nil
	}
	round := ""
	if answerHas(topic, "premier tour") {
		round = "premier"
	} else if answerHas(topic, "second tour", "deuxieme tour") {
		round = "second"
	}
	selected := []record{}
	terrain := answerHas(topic, "terrain")
	if len(dates) > 2 {
		result.describe("ambigu", "terrain_a_preciser", "Précisez une date ou les deux dates du terrain à examiner.")
		return nil
	}
	period := ""
	if len(dates) == 0 {
		period = economyPeriod(question)
	}
	commissioners := map[string]bool{}
	for _, r := range c.Polls {
		if v := r.str("commissioner"); v != "" && answerHas(topic, normalize(v)) {
			commissioners[v] = true
		}
	}
	for _, r := range c.Polls {
		if exact != "" && r.str("id") != exact || exact == "" && len(names) != 0 && !names[r.str("institute")] ||
			len(commissioners) != 0 && !commissioners[r.str("commissioner")] || round != "" && r.str("round") != round ||
			page != "" && string(r["noticePage"]) != page {
			continue
		}
		if period != "" {
			date := r.str("published")
			if terrain {
				date = r.str("fieldworkStart")
			}
			if !strings.HasPrefix(date, period+"-") {
				continue
			}
		}
		if !slices.ContainsFunc(dates, func(date string) bool {
			if terrain {
				return r.str("fieldworkStart") == "" || date < r.str("fieldworkStart") || date > r.str("fieldworkEnd")
			}
			return !pollDate(r, date)
		}) {
			selected = append(selected, r)
		}
	}
	sort.Slice(selected, func(i, j int) bool {
		x, y := selected[i], selected[j]
		if x.str("published") != y.str("published") {
			return x.str("published") > y.str("published")
		}
		if x.str("noticeSource") != y.str("noticeSource") {
			return x.str("noticeSource") < y.str("noticeSource")
		}
		var a, b int
		json.Unmarshal(x["noticePage"], &a)
		json.Unmarshal(y["noticePage"], &b)
		if a != b {
			return a < b
		}
		return x.str("id") < y.str("id")
	})
	namedResultMissing := false
	for _, r := range selected[:min(answerLimit, len(selected))] {
		id := r.str("id")
		item := newAnswerItem(id, r.str("scenario"), result.Coverage.URL+"#"+(url.Values{"enquete": {id}}).Encode())
		item.Author, item.Status = r.str("institute"), "scenario"
		item.Date, item.Kind = r.str("published"), "publication"
		item.Summary = answerText(r.str("population"), 720)
		id = r.str("noticeSource")
		var n int
		fragment, passage := "", ""
		if json.Unmarshal(r["noticePage"], &n) == nil && n > 0 {
			fragment, passage = "page="+strconv.Itoa(n), "Page "+strconv.Itoa(n)+" de la notice"
		}
		item.addSource(c.answerCitation(reference{SourceID: id, Locator: passage, Fragment: fragment}))
		period := pollPeriod(r)
		if len(item.Sources) > 0 {
			var sample json.Number
			if json.Unmarshal(r["usefulSample"], &sample) == nil && sample != "" {
				item.Facts = append(item.Facts, answerFact{Label: "Effectif utile de ce scénario", Value: sample.String(), Unit: "personnes", Period: period, SourceID: id})
			}
			var shares []struct {
				ID         string
				Percentage *json.Number
				Below      *json.Number
			}
			if len(people) > 0 && json.Unmarshal(r["results"], &shares) != nil {
				return invalidCorpus
			}
			found := 0
			for _, person := range people {
				if len(item.Facts) == answerFactLimit {
					break
				}
				for _, share := range shares {
					if share.ID != person.ID {
						continue
					}
					value := ""
					switch {
					case share.Percentage != nil:
						value = share.Percentage.String()
					case share.Below != nil:
						value = "< " + share.Below.String()
					}
					if value != "" {
						item.Facts = append(item.Facts, answerFact{Label: person.Name, Value: value, Unit: "%", Period: period, SourceID: id})
						found++
					}
					break
				}
			}
			namedResultMissing = namedResultMissing || len(people) > found
		}
		result.Results = append(result.Results, item)
	}
	result.finish(len(selected), "Les valeurs se lisent avec le scénario, le terrain et la base d’enquête indiqués par la notice.")
	if namedResultMissing {
		result.describe("partiel", "resultat_non_documente", "Une candidature demandée n’a pas de valeur documentée dans au moins un scénario affiché.")
	} else if len(people) != 0 && len(selected) > 1 {
		result.describe("ambigu", "scenario_a_preciser", "Plusieurs scénarios correspondent à la demande. Choisissez la notice ou la page avant d’interpréter un chiffre isolé.")
	}
	return nil
}

func pollPeriod(r record) string {
	start, end := r.str("fieldworkStart"), r.str("fieldworkEnd")
	if start != "" && end != "" && start != end {
		return start + " – " + end
	}
	if start != "" {
		return start
	}
	return end
}

var (
	answerMonthPeriod   = regexp.MustCompile(`\b[0-9]{4}-[0-9]{2}\b`)
	answerQuarterPeriod = regexp.MustCompile(`(?i)\b([0-9]{4})-Q([1-4])\b`)
	answerPeriodInText  = regexp.MustCompile(`\b(?:t([1-4]) ([0-9]{4})|([a-z]+) ([0-9]{4}))\b`)
	answerYear          = regexp.MustCompile(`\b[0-9]{4}\b`)
)

func economyPeriod(question string) string {
	if match := answerQuarterPeriod.FindString(question); match != "" {
		return strings.ToUpper(match)
	}
	if match := answerMonthPeriod.FindString(question); match != "" {
		return match
	}
	for _, match := range answerPeriodInText.FindAllStringSubmatch(normalize(question), -1) {
		if match[1] != "" {
			return match[2] + "-Q" + match[1]
		}
		if month := slices.Index(answerMonths, match[3]) + 1; month > 0 {
			if month < 10 {
				return match[4] + "-0" + strconv.Itoa(month)
			}
			return match[4] + "-" + strconv.Itoa(month)
		}
	}
	return answerYear.FindString(question)
}

func (c *snapshot) answerEconomy(result *documentaryAnswer, question, topic string) error {
	rows, err := c.answerRecords("economie")
	if err != nil {
		return err
	}
	period := economyPeriod(question)
	topic = withoutAnswerDates(question, topic)
	topic = strings.ReplaceAll(topic, normalize(period), " ")
	topic = answerPeriodInText.ReplaceAllStringFunc(topic, func(text string) string {
		if economyPeriod(text) == period {
			return " "
		}
		return text
	})
	topic = strings.Join(strings.Fields(topic), " ")
	selected := answerChoose(rows, topic)
	if len(selected) == 1 {
		row := selected[0]
		terms := indexedTerms(row.str("id") + " " + row.str("title"))
		if slices.ContainsFunc(answerTerms(topic), func(term string) bool {
			return !terms[term] && !answerHas("dernier derniere actuel actuelle evolution courbe graphique taux indicateur indicateurs eurostat chiffre valeur pourcentage points t1 t2 t3 t4 emploi perimetre", term)
		}) {
			selected = nil
		}
	}
	if len(selected) != 1 {
		result.describe("ambigu", "serie_a_preciser", "Précisez la série, l’unité et la période. Les indicateurs distinguent la France, les unités et les fréquences publiées.")
		for _, row := range selected[:min(len(selected), answerLimit)] {
			result.Links = append(result.Links, answerLink{row.str("title"), result.Coverage.URL})
		}
		return nil
	}
	row := selected[0]
	id := row.str("id")
	item := newAnswerItem(id, row.str("title"), site+"/economie/"+id+"/")
	item.Author, item.Status, item.Summary = "Eurostat", "observation", answerText(row.str("description"), 720)
	var table struct{ Table string }
	if json.Unmarshal(row["links"], &table) != nil {
		return invalidCorpus
	}
	if row.str("dataset") != "" {
		item.addSource(answerSource{ID: row.str("dataset"), Document: "Eurostat · " + item.Title, URL: answerDocumentURL(table.Table), Passage: row.str("dataset")})
	}
	switch {
	case period == "":
		var latest []string
		if json.Unmarshal(row["latest"], &latest) == nil {
			addObservation(&item, latest, row)
		}
	case len(period) == 4 && row.str("frequency") != "A":
		result.describe("ambigu", "periode_a_preciser", "Sélectionnez le mois ou le trimestre à consulter pour cette série.")
		result.Links = append(result.Links, answerLink{"Voir la série", item.URL})
		return nil
	default:
		var values [][]string
		if json.Unmarshal(row["observations"], &values) != nil {
			return invalidCorpus
		}
		for _, value := range values {
			if len(value) > 0 && value[0] == period {
				addObservation(&item, value, row)
				break
			}
		}
	}
	result.Coverage.URL = item.URL
	result.Title = item.Title
	result.Links = append(result.Links, answerLink{"Voir la série et le graphique", item.URL})
	if len(item.Facts) == 0 {
		result.Coverage.Total = new(int)
		result.describe("sans-resultat", "observation_absente", "La série est documentée. Cette édition ne donne pas d’observation chiffrée pour la période demandée.")
		return nil
	}
	result.Results = append(result.Results, item)
	result.finish(1, "La valeur est celle de cette édition de la série, pour l’unité et la période indiquées.")
	return nil
}

func addObservation(item *answerItem, value []string, row record) {
	if len(value) < 3 || value[0] == "" || value[1] == "" || len(item.Sources) == 0 {
		return
	}
	item.Facts = append(item.Facts, answerFact{Label: item.Title, Value: value[1], Unit: row.str("unit"), Period: value[0], Basis: value[2], SourceID: item.Sources[0].ID})
}

var answerCommuneCode = regexp.MustCompile(`(?i)\b(?:[0-9]{2}|2[ab])[0-9]{3}\b`)

func (c *snapshot) answerTerritory(result *documentaryAnswer, question string) error {
	codes := answerCommuneCode.FindAllString(question, -1)
	if len(codes) != 1 {
		result.describe("ambigu", "commune_a_preciser", "Indiquez le code Insee d’une commune. La rubrique permet aussi une recherche par nom.")
		return nil
	}
	code := strings.ToUpper(codes[0])
	value, empty, err := c.territory(territoryArgs{Code: code})
	if err != nil {
		return err
	}
	if empty {
		result.finish(0, "")
		return nil
	}
	row := value.(map[string]any)
	name := row["commune"].(string)
	definitions := row["definitions"].(record)
	page := result.Coverage.URL + "#commune=" + code
	item := newAnswerItem(code, name, page)
	var sru struct{ Rate string }
	if raw, ok := row["inventaireSRU"].(json.RawMessage); ok && len(raw) != 0 && json.Unmarshal(raw, &sru) != nil {
		return invalidCorpus
	}
	var apl json.Number
	if raw, ok := row["accessibiliteGeneralistes"].(json.RawMessage); ok && len(raw) != 0 && json.Unmarshal(raw, &apl) != nil {
		return invalidCorpus
	}
	for _, metric := range []struct{ id, label, value, dateField string }{
		{"sru", "Part de logements sociaux", strings.TrimSuffix(sru.Rate, "%"), "inventaire"},
		{"apl", "Accessibilité aux médecins généralistes", apl.String(), "millesime"},
	} {
		var def record
		if metric.value == "" || json.Unmarshal(definitions[metric.id], &def) != nil {
			continue
		}
		link := answerDocumentURL(def.str("source"))
		if link == "" {
			continue
		}
		period := def.str(metric.dateField)
		if period == "" && metric.id == "apl" {
			var year json.Number
			if json.Unmarshal(def[metric.dateField], &year) == nil {
				period = year.String()
			}
		}
		item.addSource(answerSource{ID: metric.id, Document: metric.label, URL: link, Passage: name + ", code Insee " + code})
		item.Facts = append(item.Facts, answerFact{Label: metric.label, Value: metric.value, Unit: def.str("unite"), Period: period, Basis: def.str("champ"), SourceID: metric.id})
	}
	result.Links = append(result.Links, answerLink{"Voir les chiffres et leur périmètre pour cette commune", page})
	result.Coverage.URL = page
	result.Results = append(result.Results, item)
	result.finish(1, "L’inventaire des logements sociaux et l’accès aux soins ont chacun leur source, leur périmètre et leur millésime.")
	if len(item.Facts) < 2 {
		result.describe("partiel", "releve_communal_incomplet", "La commune est identifiée. Les chiffres sont affichés pour les relevés disponibles.")
	}
	return nil
}
