package main

import (
	"sort"
	"strings"
)

// Each result has a concrete shape, including absent identifiers and empty pages.
func fields(spec map[string]string) map[string]any {
	properties := map[string]any{}
	required := []string{}
	for name, description := range spec {
		types := strings.Split(description, "|")
		properties[name] = map[string]any{"type": types}
		required = append(required, name)
	}
	sort.Strings(required)
	return map[string]any{"type": "object", "properties": properties, "required": required}
}

func toolOutput(name string) map[string]any {
	paged := map[string]string{"total": "integer", "offset": "integer", "resultats": "array", "suivant": "integer|null", "aucunResultat": "boolean", "finDeListe": "boolean"}
	var data map[string]any
	absent := func(key string) map[string]any { return fields(map[string]string{key: "null"}) }
	alternatives := func(items ...map[string]any) map[string]any { return map[string]any{"type": "object", "oneOf": items} }
	switch name {
	case "polradar_question", "polradar_comparer":
		data = alternatives(fields(paged), absent("question"))
	case "polradar_votes", "polradar_changements":
		data = fields(paged)
	case "polradar_territoires":
		data = alternatives(fields(map[string]string{"codeInsee": "string", "commune": "string", "definitions": "object"}), absent("commune"))
	case "polradar_methodologie":
		data = fields(map[string]string{"url": "string", "dates": "string", "attribution": "string", "votes": "string"})
	case "polradar_corpus":
		data = fields(map[string]string{"campagne": "integer", "parti": "integer", "orientations": "integer", "archives": "integer", "sources": "integer", "themes": "array", "contratsCollections": "object"})
	case "polradar_candidates":
		data = fields(map[string]string{"candidatures": "array"})
	case "polradar_search":
		data = fields(map[string]string{"total": "integer", "offset": "integer", "resultats": "array"})
	case "polradar_measure":
		data = alternatives(fields(map[string]string{"id": "string", "titre": "string", "description": "string", "auteur": "string", "statutCandidatureActuel": "string", "sources": "array", "versions": "array", "liensDossierCourant": "object", "versionDemandee": "string|null", "url": "string"}), absent("fiche"))
	case "polradar_donnees":
		data = alternatives(fields(map[string]string{"collection": "string", "total": "integer", "offset": "integer", "publications": "array"}), fields(map[string]string{"collection": "string", "publication": "object", "rubrique": "string"}), fields(map[string]string{"collection": "string", "publication": "null"}))
	}
	return map[string]any{"type": "object", "required": []string{"versionContrat", "revisionDuSite", "revisionDuService", "corpusVerifieLe", "sansResultat", "donnees"}, "properties": map[string]any{
		"versionContrat":    map[string]any{"type": "integer", "const": dataMajor},
		"revisionDuSite":    map[string]any{"type": "string", "pattern": "^[0-9a-f]{40}$"},
		"revisionDuService": map[string]any{"type": []string{"string", "null"}},
		"corpusVerifieLe":   map[string]any{"type": "string", "format": "date"},
		"sansResultat":      map[string]any{"type": "boolean"},
		"donnees":           data,
	}}
}
