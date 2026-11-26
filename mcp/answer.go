package main

import (
	"regexp"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	answerTool        = "polradar_answer"
	answerLimit       = 3
	answerMaxQuestion = 300
	answerFactLimit   = 8
)

type answerArgs struct {
	Question         string `json:"question" jsonschema:"Question documentaire en français, jusqu’à 300 caractères."`
	ExpectedRevision string `json:"expectedRevision,omitempty" jsonschema:"Révision du site attendue, si connue."`
}

type answerSource struct {
	ID                   string `json:"id"`
	Document             string `json:"document"`
	URL                  string `json:"url"`
	Passage              string `json:"passage"`
	Publication          string `json:"publication,omitempty"`
	PublicationYear      string `json:"anneePublication,omitempty"`
	PublicationReference string `json:"justificatifPublication,omitempty"`
	Consultation         string `json:"consultation,omitempty"`
}

type answerFact struct {
	Label    string `json:"libelle"`
	Value    string `json:"valeur"`
	Unit     string `json:"unite,omitempty"`
	Period   string `json:"periode,omitempty"`
	Basis    string `json:"base,omitempty"`
	SourceID string `json:"sourceId,omitempty"`
}

type answerRelation struct {
	ID             string `json:"id"`
	Qualification  string `json:"qualification"`
	Justification  string `json:"justification"`
	Status         string `json:"statut"`
	CitedVersion   string `json:"versionCitee"`
	CurrentVersion string `json:"versionCourante"`
	VersionRule    string `json:"regleVersion"`
}

type answerItem struct {
	ID         string                     `json:"id"`
	Version    string                     `json:"versionId,omitempty"`
	Person     string                     `json:"candidatureAssociee,omitempty"`
	Title      string                     `json:"titre"`
	Summary    string                     `json:"resume,omitempty"`
	Author     string                     `json:"auteur,omitempty"`
	Status     string                     `json:"statut,omitempty"`
	Date       string                     `json:"date,omitempty"`
	Kind       string                     `json:"typeDate,omitempty"`
	URL        string                     `json:"url"`
	Sources    []answerSource             `json:"sources"`
	Facts      []answerFact               `json:"chiffres"`
	Relation   *answerRelation            `json:"relation,omitempty"`
	Comparison *answerCandidateComparison `json:"comparaison,omitempty"`
}

type answerLink struct {
	Label string `json:"libelle"`
	URL   string `json:"url"`
}

type answerCoverage struct {
	Scope      string                    `json:"perimetre"`
	Total      *int                      `json:"total"`
	Limit      int                       `json:"limite"`
	URL        string                    `json:"url"`
	Comparison *answerComparisonCoverage `json:"comparaison,omitempty"`
}

type documentaryAnswer struct {
	State       string         `json:"etat"`
	Intent      string         `json:"intention"`
	Title       string         `json:"titre"`
	Explanation string         `json:"explication"`
	Reason      string         `json:"motif,omitempty"`
	Coverage    answerCoverage `json:"couverture"`
	Results     []answerItem   `json:"resultats"`
	Links       []answerLink   `json:"liens"`
}

type answerRoute struct{ title, scope, path, action string }

var answerRoutes = map[string]answerRoute{
	"proposition":  {"Propositions documentées", "Fiches courantes de campagne, de parti et d’orientation", "/recherche/", "Consulter le catalogue des propositions"},
	"comparaison":  {"Comparer des propositions", "Questions et positions documentées dans la grille comparative", "/comparer/", "Ouvrir le comparateur"},
	"source":       {"Sources et passages", "Sources associées aux fiches et catalogue documentaire", "/sources/", "Consulter le catalogue des sources"},
	"scrutin":      {"Scrutins et votes documentés", "Scrutins du registre parlementaire indexé", "/votes/recherche/", "Explorer le registre parlementaire"},
	"sondage":      {"Scénarios de sondage", "Scénarios enregistrés et notices correspondantes", "/sondages/", "Lire les sondages par scénario"},
	"economie":     {"Séries économiques", "Indicateurs économiques publiés", "/economie/", "Consulter les séries économiques"},
	"historique":   {"Évolutions documentées", "Versions, corrections et changements suivis par Polradar", "/evolution/", "Consulter l’évolution des propositions"},
	"juridique":    {"Droit en vigueur documenté", "Dossiers de droit en vigueur et textes cités", "/numerique/ce-qui-changerait/", "Consulter le droit en vigueur"},
	"financement":  {"Financements documentés", "Montants et hypothèses sourcés", "/budget-programmes/", "Consulter les budgets des programmes"},
	"verification": {"Déclarations vérifiées", "Déclarations rapprochées d’une mesure officielle", "/economie/declarations/", "Consulter les déclarations examinées"},
	"simulation":   {"Simulations documentées", "Simulateurs et hypothèses disponibles", "/economie/simulateurs/", "Choisir un simulateur"},
	"territoire":   {"Données territoriales", "Communes couvertes par les relevés SRU et APL", "/territoires/", "Ouvrir Ma commune"},
	"inconnue":     {"Question hors périmètre", "Publications et données documentées", "/methode/", "Consulter le périmètre de Polradar"},
}

func newDocumentaryAnswer(intent string) documentaryAnswer {
	route := answerRoutes[intent]
	return documentaryAnswer{
		Intent: intent, Title: route.title,
		Coverage: answerCoverage{Scope: route.scope, Limit: answerLimit, URL: site + route.path},
		Results:  []answerItem{},
		Links:    []answerLink{{route.action, site + route.path}},
	}
}

func (a *documentaryAnswer) describe(state, reason, text string) {
	a.State, a.Reason, a.Explanation = state, reason, text
}

func (a *documentaryAnswer) finish(total int, explanation string) {
	a.Coverage.Total = &total
	if total == 0 {
		a.describe("sans-resultat", "aucune_correspondance", "Aucun passage correspondant n’a été retrouvé dans ce périmètre.")
		return
	}
	a.describe("documente", "", explanation)
	if total > len(a.Results) {
		a.describe("partiel", "liste_bornee", explanation+" Le lien de la rubrique permet de poursuivre la consultation.")
	}
}

func newAnswerItem(id, title, url string) answerItem {
	return answerItem{ID: id, Title: title, URL: url, Sources: []answerSource{}, Facts: []answerFact{}}
}

func validateAnswerArgs(a answerArgs) error {
	if !utf8.ValidString(a.Question) || utf8.RuneCountInString(a.Question) > answerMaxQuestion ||
		strings.IndexFunc(a.Question, unicode.IsControl) >= 0 || normalize(a.Question) == "" ||
		a.ExpectedRevision != "" && !commitID.MatchString(a.ExpectedRevision) {
		return errFilter
	}
	return nil
}

func answerHas(text string, phrases ...string) bool {
	for _, phrase := range phrases {
		if phrase != "" && strings.Contains(" "+text+" ", " "+phrase+" ") {
			return true
		}
	}
	return false
}

var (
	answerID       = regexp.MustCompile(`\b[a-z0-9]+(?:-[a-z0-9]+)+\b`)
	answerBallot   = regexp.MustCompile(`(?i)\bVTANR5L(?:15|16|17)V[1-9][0-9]{0,5}\b`)
	answerISODate  = regexp.MustCompile(`\b[0-9]{4}-[0-9]{2}-[0-9]{2}\b`)
	answerLongDate = regexp.MustCompile(`\b([0-9]{1,2})(?:er)? ([a-z]+) ([0-9]{4})\b`)
	answerVersion  = regexp.MustCompile(`\bversion[- ]([1-9][0-9]{0,5})\b`)
	answerQuote    = regexp.MustCompile(`«([^»]+)»|"([^"]+)"`)
)

var answerMonths = strings.Fields("janvier fevrier mars avril mai juin juillet aout septembre octobre novembre decembre")

func answerDates(question string) []string {
	dates := []string{}
	add := func(date string) {
		if dayOK(date) && !slices.Contains(dates, date) {
			dates = append(dates, date)
		}
	}
	for _, raw := range answerISODate.FindAllString(question, -1) {
		add(raw)
	}
	for _, match := range answerLongDate.FindAllStringSubmatch(normalize(question), -1) {
		month := slices.Index(answerMonths, match[2]) + 1
		if month > 0 {
			day, _ := strconv.Atoi(match[1])
			year, _ := strconv.Atoi(match[3])
			date := time.Date(year, time.Month(month), day, 0, 0, 0, 0, time.UTC)
			if date.Day() == day && int(date.Month()) == month {
				add(date.Format(time.DateOnly))
			}
		}
	}
	sort.Strings(dates)
	return dates
}

func (c *snapshot) answerCandidates(text string) ([]candidate, string) {
	// A full name takes precedence over the other names that intersect it.
	selected := []candidate{}
	search := " " + text + " "
	for _, person := range c.Candidates {
		full := normalize(person.Name)
		if full == "" || !strings.Contains(full, " ") || !answerHas(search, full) {
			continue
		}
		selected = append(selected, person)
		search = strings.ReplaceAll(search, " "+full+" ", " ")
	}
	for _, person := range c.Candidates {
		if slices.ContainsFunc(selected, func(entry candidate) bool { return entry.ID == person.ID }) {
			continue
		}
		surname := ""
		if _, after, ok := strings.Cut(person.Name, " "); ok {
			surname = normalize(after)
		}
		id := normalize(person.ID)
		if !answerHas(search, surname, id) {
			continue
		}
		selected = append(selected, person)
		for _, alias := range []string{surname, id} {
			if alias != "" {
				search = strings.ReplaceAll(search, " "+alias+" ", " ")
			}
		}
	}
	// Use the order of names in the question, otherwise the published order.
	sort.SliceStable(selected, func(i, j int) bool {
		return answerNamePosition(text, selected[i]) < answerNamePosition(text, selected[j])
	})
	return selected, strings.Join(strings.Fields(search), " ")
}

func answerNamePosition(text string, person candidate) int {
	text = " " + text + " "
	position := len(text)
	_, surname, _ := strings.Cut(person.Name, " ")
	for _, name := range []string{person.Name, surname, person.ID} {
		if name == "" {
			continue
		}
		if at := strings.Index(text, " "+normalize(name)+" "); at >= 0 && at < position {
			position = at
		}
	}
	return position
}

var answerNoise = wordSet("actuellement an annees aujourd hui autres candidature candidatures candidat candidats cas ces cet ceux chaque cite citer " +
	"combien comme comment comparer concernant connaitre contexte date demande depuis dit document donne donnees droit elle entre est eux explique expliquez faire faut fiche " +
	"figures france francaise historique ici il info information informations jusqu justifie leur leurs lui moi montre montrez maintenant nouveaux nous on ont original ou " +
	"pages passage passe peut peux piece politique polradar pourquoi precedent preuve preuves propose proposent proposait proposee " +
	"proposition propositions publie publiees qu quand que quel quelle quelles quels retrouve retrouver resume s sa savoir selon sont son source sources " +
	"sujet t te toutes tous trouve trouver veut veulent voter votent vote votes votez vous")

func answerTerms(text string) []string {
	terms := []string{}
	for _, word := range lexicalTerms(text) {
		if !answerNoise[word] && !slices.Contains(terms, word) {
			terms = append(terms, word)
		}
	}
	return terms
}

func answerIntent(text string, people []candidate, ballot string) string {
	switch {
	case answerHas(text, "qui va gagner", "qui gagnera", "qui sera elu", "prevoir le vainqueur", "predire le vainqueur"):
		return "inconnue"
	case answerHas(text, "verifie", "verifier", "est ce vrai", "est il vrai", "affirmation"):
		return "verification"
	case answerHas(text, "simuler", "simulation", "simulateur"):
		return "simulation"
	case ballot != "" || answerHas(text, "scrutin", "scrutins", "a vote", "ont vote", "quels votes"):
		return "scrutin"
	case answerHas(text, "sondage", "sondages", "scenarios", "terrain") || answerHas(text, "opinionway", "ifop", "ipsos"):
		return "sondage"
	case answerHas(text, "archive", "archives", "version", "evolution", "evolutions", "qu est ce qui a change", "qu est ce qui change", "ont change"):
		return "historique"
	case answerHas(text, "source", "sources", "texte original", "document original", "preuve", "preuves"):
		return "source"
	case answerHas(text, "compare", "comparer", "comparaison", "comparatif") || len(people) > 1:
		return "comparaison"
	case answerHas(text, "droit en vigueur", "regles en vigueur", "est il legal", "est elle legale", "autorise par la loi", "qui peut utiliser le chiffrement") ||
		answerHas(text, "lcen") && answerHas(text, "article", "droit", "loi"):
		return "juridique"
	case answerHas(text, "financement", "financements", "chiffrage", "chiffrages", "cout de la mesure", "cout de cette mesure"):
		return "financement"
	case answerHas(text, "propose", "proposent", "proposition", "propositions", "programme", "programmes"):
		return "proposition"
	case answerHas(text, "vote", "votes", "votent"):
		return "scrutin"
	case answerHas(text, "commune", "territoire", "code insee", "sru", "mon territoire"):
		return "territoire"
	case answerHas(text, "indicateur", "indicateurs", "eurostat", "inflation", "taux de chomage", "dette publique", "croissance", "taux d emploi"):
		return "economie"
	default:
		return "proposition"
	}
}

func (c *snapshot) answer(a answerArgs) (any, bool, error) {
	if err := validateAnswerArgs(a); err != nil {
		return nil, false, err
	}
	if err := c.checkRevision(a.ExpectedRevision); err != nil {
		return nil, false, err
	}
	text := normalize(a.Question)
	people, topic := c.answerCandidates(text)
	ballot := strings.ToUpper(answerBallot.FindString(a.Question))
	intent := answerIntent(text, people, ballot)
	result := newDocumentaryAnswer(intent)
	var err error
	switch intent {
	case "proposition", "source":
		err = c.answerProposals(&result, a.Question, topic, people)
	case "comparaison":
		err = c.answerComparison(&result, topic, people, a.Question)
	case "scrutin":
		err = c.answerScrutinies(&result, a.Question, topic, people, ballot)
	case "sondage":
		err = c.answerPolls(&result, a.Question, topic, people)
	case "economie":
		err = c.answerEconomy(&result, a.Question, topic)
	case "juridique":
		err = c.answerLaw(&result, topic)
	case "historique":
		err = c.answerHistory(&result, a.Question, topic, people)
	case "verification":
		err = c.answerVerification(&result, a.Question)
	case "territoire":
		err = c.answerTerritory(&result, a.Question)
	case "financement":
		if m, ok := c.requestedMeasure(a.Question); ok {
			c.answerMeasureFunding(&result, m)
			break
		}
		result.describe("ambigu", "mesure_a_preciser", "Indiquez l’identifiant d’une proposition pour examiner ses montants et son financement documenté.")
	case "simulation":
		result.describe("partiel", "hypotheses_a_preciser", "Choisissez le dispositif à examiner. La rubrique donne les hypothèses et les sources documentées.")
	case "inconnue":
		result.describe("hors-perimetre", "prediction_hors_perimetre", "Le corpus documente la campagne, les enquêtes et leurs limites. Il ne permet pas d’établir le résultat d’un scrutin à venir.")
	}
	if err != nil {
		return nil, false, err
	}
	if result.State == "documente" && slices.ContainsFunc(result.Results, func(row answerItem) bool { return len(row.Sources) == 0 }) {
		result.describe("partiel", "piece_non_disponible", "Une référence originale manque dans la réponse. La rubrique indique le périmètre des données disponibles.")
	}
	return result, len(result.Results) == 0, nil
}
