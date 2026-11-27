package main

import (
	"encoding/json"
	"errors"
	"net/url"
	"sort"
	"strconv"
	"strings"
	"time"
)

type record map[string]json.RawMessage

func (r record) str(key string) string { var s string; json.Unmarshal(r[key], &s); return s }

type dataArgs struct {
	Recherche        bool   `json:"recherche,omitempty" jsonschema:"Recherche transversale du Parlement dans les trois institutions, avec textes et interventions."`
	Candidat         string `json:"candidat,omitempty" jsonschema:"Identifiant du candidat ou ancien candidat dans le registre parlementaire."`
	Institution      string `json:"institution,omitempty" jsonschema:"assemblee, senat ou parlement-europeen pour la recherche parlementaire."`
	Debut            string `json:"debut,omitempty" jsonschema:"Première date incluse, AAAA-MM-JJ."`
	Fin              string `json:"fin,omitempty" jsonschema:"Dernière date incluse, AAAA-MM-JJ."`
	Position         string `json:"position,omitempty" jsonschema:"Vote enregistré : pour, contre, abstention, non-votant ou non-votant-volontaire."`
	Nature           string `json:"nature,omitempty" jsonschema:"vote, depot, cosignature, rapport, intervention ou mise-au-point."`
	Theme            string `json:"theme,omitempty" jsonschema:"Thème du registre parlementaire. Numérique inclut le classement par objet de l’acte."`
	Periode          string `json:"periode,omitempty" jsonschema:"Sénat : année de début de session ; Parlement européen : date de la séance. Une liste sans période donne toutes les périodes couvertes."`
	Query            string `json:"query,omitempty" jsonschema:"Sondages : institut, commanditaire, scénario, identifiant ou date AAAA-MM-JJ. Comparaisons de sondages : identifiant ou intitulé de l’hypothèse. Économie : titre, description ou code de série. Sources : titre ou URL. Parlement : texte ou identifiant. Relations : identifiant exact de question, mesure ou version."`
	Collection       string `json:"collection" jsonschema:"Collection publique. debats renvoie les passages de prises de parole. simulation-budgetaire donne les comptes publics de référence, les unités et le contrat de calcul des scénarios."`
	ID               string `json:"id,omitempty" jsonschema:"Identifiant exact retourné par la liste. Sans identifiant, retourne jusqu’à 15 entrées."`
	Offset           int    `json:"offset,omitempty" jsonschema:"Position de départ pour la liste, à partir de zéro."`
	ExpectedRevision string `json:"expectedRevision,omitempty" jsonschema:"Révision du site renvoyée par la première page."`
}
type collection struct{ file, key, title, date, reference, page string }

const publicationPageSize = 15

var collections = map[string]collection{
	"sondages":              {"", "polls", "scenario", "published", "noticeSource", "/sondages/"},
	"comparaisons-sondages": {"scenarios-sondages.json", "comparisons", "label", "through", "", "/sondages/comparer/"},
	"economie":              {"economie.json", "series", "title", "updatedAt", "", "/economie/"},
	"agenda":                {"agenda.json", "events", "title", "date", "source", "/agenda/"},
	"budgets":               {"budgets-programmes.json", "entries", "label", "reviewedOn", "source", "/budget-programmes/"},
	"marches":               {"marches-predictifs.json", "providers", "title", "observedAt", "", "/marches-predictifs/"},
	"senat":                 {"parlement/archives/index.json", "scrutins", "objet", "date", "", "/votes/archives/"},
	"parlement-europeen":    {"parlement/archives/index.json", "scrutins", "objet", "date", "", "/votes/archives/"},
	"parlement":             {"parlement/index.json", "scrutins", "objet", "date", "", "/votes/registre/"},
	"sources":               {"documentation/sources.json", "items", "title", "checked", "", "/sources/"},
	"droit":                 {"documentation/droit.json", "items", "title", "checked", "", "/numerique/ce-qui-changerait/"},
	"verifications":         {"documentation/verifications.json", "items", "title", "date", "", "/economie/declarations/"},
	"breves":                {"documentation/breves.json", "items", "title", "date", "", "/breves/"},
	"financements":          {"documentation/financements.json", "items", "title", "", "", "/financements/"},
	"arcom":                 {"documentation/arcom.json", "items", "title", "date", "", "/temps-de-parole/"},
	"graphiques":            {"documentation/graphiques.json", "items", "title", "", "", "/mcp/documentation/"},
	"relations":             {"relations-documentaires.json", "relations", "", "", "", "/questions/"},
	"debats":                {"debats.json", "items", "title", "date", "", "/debats/"},
	"simulation-budgetaire": {"simulation-budgetaire.json", "items", "title", "date", "", "/economie/simulateur-budgetaire/"},
}

var collectionSearchFields = map[string][]string{
	"sondages":              {"id", "scenario", "institute", "commissioner"},
	"comparaisons-sondages": {"id", "label"},
	"economie":              {"id", "title", "description", "dataset", "group"},
	"sources":               {"title", "url"},
	"breves":                {"id", "title", "description", "date", "evenement"},
	"financements":          {"id", "title", "candidate"},
	"debats":                {"id", "title", "description", "author", "theme", "date"},
}

type pollComparisonMethod struct {
	WindowDays int    `json:"fenetreJours"`
	Weighting  string `json:"ponderation"`
	Export     string `json:"export"`
}

func pollDate(r record, date string) bool {
	return r.str("fieldworkStart") == date || r.str("fieldworkEnd") == date || r.str("published") == date
}

func (c *snapshot) publicData(a dataArgs) (any, bool, error) {
	if err := c.checkRevision(a.ExpectedRevision); err != nil {
		return nil, false, err
	}
	def, ok := collections[a.Collection]
	if !ok || len(a.ID) > collectionIDLimit(a.Collection) || a.Offset < 0 || a.Offset > maxPageOffset || (a.ID != "" && a.Offset != 0) {
		return nil, false, errors.New("Collection, identifiant ou pagination invalide.")
	}
	var rows []record
	if err := c.contract.check(a.Collection); err != nil {
		return nil, false, err
	}
	if a.hasActFilters() || (a.Collection == "parlement" && a.Query != "") {
		if a.Collection != "parlement" {
			return nil, false, errFilter
		}
		return c.searchActs(a)
	}
	if a.Collection == "relations" {
		return c.proofRelations(a, def)
	}
	searchFields := collectionSearchFields[a.Collection]
	if len([]rune(a.Query)) > maxSearchQueryLength || (a.Query != "" && (len(searchFields) == 0 || a.ID != "" || normalize(a.Query) == "")) {
		return nil, false, errFilter
	}
	if a.Periode != "" && (a.ID != "" || (a.Collection != "senat" && a.Collection != "parlement-europeen")) {
		return nil, false, errFilter
	}
	if a.Collection == "senat" || a.Collection == "parlement-europeen" {
		return c.archivesData(a)
	}
	if a.Collection == "parlement" {
		return c.parliamentaryData(a)
	}
	var collected, checked *string
	var comparison *pollComparisonMethod
	refs := c.bySource
	if def.file == "" {
		rows = c.Polls
	} else {
		var doc map[string]json.RawMessage
		if readData(c.root+"/api/"+def.file, 10<<20, &doc) != nil || json.Unmarshal(doc[def.key], &rows) != nil || rows == nil {
			return nil, false, invalidCorpus
		}
		if (a.Collection == "debats" || a.Collection == "simulation-budgetaire") && record(doc).str("sourceCommit") != c.commit {
			return nil, false, invalidCorpus
		}
		if a.Collection == "comparaisons-sondages" {
			var version, days int
			weighting := record(doc).str("weighting")
			if json.Unmarshal(doc["version"], &version) != nil || version != dataMajor ||
				record(doc).str("sourceCommit") != c.commit ||
				json.Unmarshal(doc["windowDays"], &days) != nil || days < 1 || days > 366 || weighting == "" {
				return nil, false, invalidCorpus
			}
			comparison = &pollComparisonMethod{days, weighting, site + "/api/" + def.file}
		}
		collected = nullable(record(doc).str("collectedAt"))
		checked = nullable(record(doc).str("checked"))
		if raw, ok := doc["sources"]; ok {
			var items []source
			if json.Unmarshal(raw, &items) != nil {
				return nil, false, invalidCorpus
			}
			refs = map[string]source{}
			for _, v := range items {
				refs[v.ID] = v
			}
		}
	}
	if a.ID != "" {
		for _, r := range rows {
			if r.str("id") == a.ID {
				result := map[string]any{"collection": a.Collection, "publication": r, "rubrique": site + def.page, "collecteLe": collected, "jeuVerifieLe": checked}
				if def.reference != "" {
					s, ok := refs[r.str(def.reference)]
					if !ok {
						return nil, false, invalidCorpus
					}
					result["source"] = s
					sources := []source{s}
					var extra []string
					if raw := r["additionalSources"]; raw != nil && json.Unmarshal(raw, &extra) != nil {
						return nil, false, invalidCorpus
					}
					for _, id := range extra {
						s, ok := refs[id]
						if !ok {
							return nil, false, invalidCorpus
						}
						sources = append(sources, s)
					}
					result["sources"] = sources
				}
				if a.Collection == "economie" {
					result["lectureObservations"] = "Chaque observation conserve la période, la valeur publiée et le code de statut fourni par la source. Les unités et la fréquence figurent dans la série."
					frequencies := map[string]string{"M": "Mensuelle", "Q": "Trimestrielle", "A": "Annuelle"}
					if label := frequencies[r.str("frequency")]; label != "" {
						result["frequence"] = label
					}
				}
				if a.Collection == "breves" {
					result["lectureDates"] = "date désigne la publication de la brève sur Polradar. evenement désigne la date de l’événement lorsqu’elle est établie."
				}
				if a.Collection == "sondages" {
					result["lectureDates"] = "fieldworkStart et fieldworkEnd bornent le terrain. published indique la date de diffusion renseignée, si elle est connue."
				}
				if a.Collection == "financements" {
					result["lectureHorizon"] = "entry.period et entry.horizon indiquent la période du montant présenté. Consultez les sources pour les hypothèses et le périmètre."
				}
				if a.Collection == "marches" {
					result["collecteLe"] = nullable(r.str("observedAt"))
					result["lecture"] = "Cours observés sur la plateforme à la date indiquée. Les disponibilités et les prix manquants sont fournis par le relevé."
				}
				if comparison != nil {
					result["methodeComparative"] = comparison
					result["rubrique"] = site + def.page + "#" + url.PathEscape(r.str("id"))
				}
				return result, false, nil
			}
		}
		return map[string]any{"collection": a.Collection, "publication": nil}, true, nil
	}
	type entry struct {
		ID            string `json:"id"`
		Title         string `json:"titre"`
		Date          string `json:"date,omitempty"`
		Status        string `json:"disponibilite,omitempty"`
		Institute     string `json:"institut,omitempty"`
		Commissioner  string `json:"commanditaire,omitempty"`
		FieldworkFrom string `json:"terrainDu,omitempty"`
		FieldworkTo   string `json:"terrainAu,omitempty"`
		Notice        string `json:"notice,omitempty"`
		row           record
	}
	var words, dates []string
	for _, word := range strings.Fields(a.Query) {
		if a.Collection == "sondages" {
			value := strings.Trim(word, ".,;:!?()")
			if _, err := time.Parse(time.DateOnly, value); err == nil {
				dates = append(dates, value)
				continue
			}
		}
		words = append(words, strings.Fields(normalize(word))...)
	}
	list := make([]entry, 0, len(rows))
rowLoop:
	for _, r := range rows {
		for _, date := range dates {
			if !pollDate(r, date) {
				continue rowLoop
			}
		}
		if len(words) != 0 {
			parts := make([]string, 0, len(searchFields))
			for _, field := range searchFields {
				parts = append(parts, r.str(field))
			}
			searchable := normalize(strings.Join(parts, " "))
			for _, word := range words {
				if !strings.Contains(searchable, word) {
					continue rowLoop
				}
			}
		}
		list = append(list, entry{ID: r.str("id"), Title: r.str(def.title), Date: r.str(def.date), Status: r.str("status"), row: r})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Date != list[j].Date {
			return list[i].Date > list[j].Date
		}
		return list[i].ID < list[j].ID
	})
	start := min(a.Offset, len(list))
	end := min(start+publicationPageSize, len(list))
	publications := list[start:end]
	if a.Collection == "sondages" {
		for i := range publications {
			item := &publications[i]
			r := item.row
			item.Institute, item.Commissioner = r.str("institute"), r.str("commissioner")
			item.FieldworkFrom, item.FieldworkTo = r.str("fieldworkStart"), r.str("fieldworkEnd")
			item.Notice = refs[r.str(def.reference)].URL
			var page int
			if item.Notice != "" && json.Unmarshal(r["noticePage"], &page) == nil && page > 0 {
				item.Notice = strings.SplitN(item.Notice, "#", 2)[0] + "#page=" + strconv.Itoa(page)
			}
		}
	}
	result := map[string]any{"collection": a.Collection, "total": len(list), "offset": start, "suivant": nextPageOffset(start, len(publications), len(list)), "publications": publications, "rubrique": site + def.page, "collecteLe": collected, "jeuVerifieLe": checked}
	if comparison != nil {
		result["methodeComparative"] = comparison
	}
	return result, start == end, nil
}
