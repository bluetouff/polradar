package main

import (
	"maps"
	"slices"
	"sort"
	"strings"

	"github.com/google/jsonschema-go/jsonschema"
)

// Advertise the bounds the tools already enforce, so clients can build valid arguments.
func toolInput[I any](name string) *jsonschema.Schema {
	switch name {
	case "polradar_search", "polradar_donnees", "polradar_comparer", "polradar_changements", "polradar_territoires":
	default:
		return nil
	}
	schema, err := jsonschema.For[I](&jsonschema.ForOptions{})
	if err != nil {
		panic(err)
	}
	props := schema.Properties
	setEnum := func(key string, values ...string) {
		for _, value := range values {
			props[key].Enum = append(props[key].Enum, value)
		}
	}
	switch name {
	case "polradar_search":
		schema.Description = "Renseignez au moins un filtre : query, candidate, theme, scope ou candidateStatus."
		schema.MinProperties = jsonschema.Ptr(1)
		setEnum("scope", "", "campagne", "parti", "orientation", "archive")
		setEnum("candidateStatus", "", "toutes", "actives", "retirees")
		setEnum("sort", "", "pertinence", "alphabetique")
		props["query"].MaxLength = jsonschema.Ptr(160)
		props["limit"].Minimum = jsonschema.Ptr(0.0)
		props["limit"].Maximum = jsonschema.Ptr(25.0)
	case "polradar_donnees":
		setEnum("collection", slices.Sorted(maps.Keys(collections))...)
	case "polradar_comparer":
		props["candidates"].Type = "array"
		props["candidates"].Types = nil
		props["candidates"].MinItems = jsonschema.Ptr(2)
		props["candidates"].MaxItems = jsonschema.Ptr(6)
		props["candidates"].UniqueItems = true
		props["question"].MinLength = jsonschema.Ptr(1)
	case "polradar_changements":
		setEnum("kind", changeKinds...)
		setEnum("dateBasis", "", "observation", "document")
	case "polradar_territoires":
		props["code"].Pattern = communeCode.String()
	}
	return schema
}

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
