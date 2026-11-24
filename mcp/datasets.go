package main

import (
	"encoding/json"
	"errors"
	"sort"
	"strings"
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
	Query            string `json:"query,omitempty" jsonschema:"Mots du titre ou de l’URL pour les sources, du texte ou de son identifiant pour le Parlement."`
	Collection       string `json:"collection" jsonschema:"Collection publique : sondages, economie, agenda, budgets, marches, parlement, sources, droit, financements, verifications, breves, arcom, graphiques, senat ou parlement-europeen."`
	ID               string `json:"id,omitempty" jsonschema:"Identifiant exact retourné par la liste. Sans identifiant, retourne jusqu’à 15 entrées."`
	Offset           int    `json:"offset,omitempty" jsonschema:"Position de départ pour la liste, à partir de zéro."`
	ExpectedRevision string `json:"expectedRevision,omitempty" jsonschema:"Révision du site renvoyée par la première page."`
}
type collection struct{ file, key, title, date, reference, page string }

var collections = map[string]collection{
	"sondages":           {"", "polls", "scenario", "published", "noticeSource", "/sondages/"},
	"economie":           {"economie.json", "series", "title", "updatedAt", "", "/economie/"},
	"agenda":             {"agenda.json", "events", "title", "date", "source", "/agenda/"},
	"budgets":            {"budgets-programmes.json", "entries", "label", "reviewedOn", "source", "/budget-programmes/"},
	"marches":            {"marches-predictifs.json", "providers", "title", "observedAt", "", "/marches-predictifs/"},
	"senat":              {"parlement/archives/index.json", "scrutins", "objet", "date", "", "/votes/archives/"},
	"parlement-europeen": {"parlement/archives/index.json", "scrutins", "objet", "date", "", "/votes/archives/"},
	"parlement":          {"parlement/index.json", "scrutins", "objet", "date", "", "/votes/registre/"},
	"sources":            {"documentation/sources.json", "items", "title", "checked", "", "/sources/"},
	"droit":              {"documentation/droit.json", "items", "title", "checked", "", "/numerique/ce-qui-changerait/"},
	"verifications":      {"documentation/verifications.json", "items", "title", "date", "", "/economie/declarations/"},
	"breves":             {"documentation/breves.json", "items", "title", "date", "", "/breves/"},
	"financements":       {"documentation/financements.json", "items", "title", "", "", "/financements/"},
	"arcom":              {"documentation/arcom.json", "items", "title", "date", "", "/temps-de-parole/"},
	"graphiques":         {"documentation/graphiques.json", "items", "title", "", "", "/mcp/documentation/"},
}

func (c *snapshot) publicData(a dataArgs) (any, bool, error) {
	if err := c.checkRevision(a.ExpectedRevision); err != nil {
		return nil, false, err
	}
	def, ok := collections[a.Collection]
	if !ok || len(a.ID) > 160 || a.Offset < 0 || a.Offset > 100000 || (a.ID != "" && a.Offset != 0) {
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
	if len(a.Query) > 160 || (a.Query != "" && (a.Collection != "sources" || a.ID != "" || normalize(a.Query) == "")) {
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
	refs := c.bySource
	if def.file == "" {
		rows = c.Polls
	} else {
		var doc map[string]json.RawMessage
		if readData(c.root+"/api/"+def.file, 10<<20, &doc) != nil || json.Unmarshal(doc[def.key], &rows) != nil || rows == nil {
			return nil, false, invalidCorpus
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
				}
				if a.Collection == "marches" {
					result["collecteLe"] = nullable(r.str("observedAt"))
					result["lecture"] = "Cours observés sur la plateforme à la date indiquée. Les disponibilités et les prix manquants sont fournis par le relevé."
				}
				return result, false, nil
			}
		}
		return map[string]any{"collection": a.Collection, "publication": nil}, true, nil
	}
	type entry struct {
		ID     string `json:"id"`
		Title  string `json:"titre"`
		Date   string `json:"date,omitempty"`
		Status string `json:"disponibilite,omitempty"`
	}
	list := make([]entry, 0, len(rows))
	for _, r := range rows {
		if a.Query != "" {
			searchable := normalize(r.str("title") + " " + r.str("url"))
			hit := true
			for _, term := range strings.Fields(normalize(a.Query)) {
				if !strings.Contains(searchable, term) {
					hit = false
					break
				}
			}
			if !hit {
				continue
			}
		}
		list = append(list, entry{r.str("id"), r.str(def.title), r.str(def.date), r.str("status")})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Date != list[j].Date {
			return list[i].Date > list[j].Date
		}
		return list[i].ID < list[j].ID
	})
	start := min(a.Offset, len(list))
	end := min(start+15, len(list))
	return map[string]any{"collection": a.Collection, "total": len(list), "offset": start, "publications": list[start:end], "rubrique": site + def.page, "collecteLe": collected, "jeuVerifieLe": checked}, start == end, nil
}
