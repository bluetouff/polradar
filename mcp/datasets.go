package main

import (
	"encoding/json"
	"errors"
	"sort"
)

type record map[string]json.RawMessage

func (r record) str(key string) string { var s string; json.Unmarshal(r[key], &s); return s }

type dataArgs struct {
	Collection string `json:"collection" jsonschema:"Collection publique : sondages, economie, agenda, budgets ou marches."`
	ID         string `json:"id,omitempty" jsonschema:"Identifiant exact retourné par la liste. Sans identifiant, retourne jusqu’à 15 entrées."`
	Offset     int    `json:"offset,omitempty" jsonschema:"Position de départ pour la liste, à partir de zéro."`
}
type collection struct{ file, key, title, date, reference, page string }

var collections = map[string]collection{
	"sondages": {"", "polls", "scenario", "published", "noticeSource", "/sondages/"},
	"economie": {"economie.json", "series", "title", "updatedAt", "", "/economie/"},
	"agenda":   {"agenda.json", "events", "title", "date", "source", "/agenda/"},
	"budgets":  {"budgets-programmes.json", "entries", "label", "reviewedOn", "source", "/budget-programmes/"},
	"marches":  {"marches-predictifs.json", "providers", "title", "observedAt", "", "/marches-predictifs/"},
}

func (c *snapshot) publicData(a dataArgs) (any, bool, error) {
	def, ok := collections[a.Collection]
	if !ok || len(a.ID) > 160 || a.Offset < 0 || a.Offset > 100000 || (a.ID != "" && a.Offset != 0) {
		return nil, false, errors.New("Collection, identifiant ou pagination invalide.")
	}
	var rows []record
	refs := c.bySource
	if def.file == "" {
		rows = c.Polls
	} else {
		var doc map[string]json.RawMessage
		if readData(c.root+"/api/"+def.file, 10<<20, &doc) != nil || json.Unmarshal(doc[def.key], &rows) != nil || rows == nil {
			return nil, false, invalidCorpus
		}
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
				result := map[string]any{"collection": a.Collection, "publication": r, "rubrique": site + def.page}
				if def.reference != "" {
					s, ok := refs[r.str(def.reference)]
					if !ok {
						return nil, false, invalidCorpus
					}
					result["source"] = s
				}
				if a.Collection == "economie" {
					result["lectureObservations"] = "Chaque observation conserve la période, la valeur publiée et le code de statut fourni par la source. Les unités et la fréquence figurent dans la série."
				}
				if a.Collection == "marches" {
					result["lecture"] = "Cours observés sur la plateforme à la date indiquée. Les disponibilités et les prix manquants sont fournis par le relevé."
				}
				return result, false, nil
			}
		}
		return map[string]any{"collection": a.Collection, "publication": nil}, true, nil
	}
	type entry struct {
		ID    string `json:"id"`
		Title string `json:"titre"`
		Date  string `json:"date,omitempty"`
	}
	list := make([]entry, 0, len(rows))
	for _, r := range rows {
		list = append(list, entry{r.str("id"), r.str(def.title), r.str(def.date)})
	}
	sort.Slice(list, func(i, j int) bool {
		if list[i].Date != list[j].Date {
			return list[i].Date > list[j].Date
		}
		return list[i].ID < list[j].ID
	})
	start := min(a.Offset, len(list))
	end := min(start+15, len(list))
	return map[string]any{"collection": a.Collection, "total": len(list), "offset": start, "publications": list[start:end], "rubrique": site + def.page}, start == end, nil
}
