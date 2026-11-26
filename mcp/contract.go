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
	case answerTool, "polradar_search", "polradar_measure", "polradar_donnees",
		"polradar_question", "polradar_comparer", "polradar_votes", "polradar_changements", "polradar_territoires":
	default:
		return nil
	}
	schema, err := jsonschema.For[I](&jsonschema.ForOptions{})
	if err != nil {
		panic(err)
	}
	props := schema.Properties
	if revision := props["expectedRevision"]; revision != nil {
		revision.Pattern = "^$|" + commitID.String()
	}
	if offset := props["offset"]; offset != nil {
		offset.Minimum = jsonschema.Ptr(0.0)
		offset.Maximum = jsonschema.Ptr(float64(maxPageOffset))
	}
	setEnum := func(key string, values ...string) {
		for _, value := range values {
			props[key].Enum = append(props[key].Enum, value)
		}
	}
	switch name {
	case answerTool:
		props["question"].MinLength = jsonschema.Ptr(1)
		props["question"].MaxLength = jsonschema.Ptr(answerMaxQuestion)
	case "polradar_search":
		schema.Description = "Renseignez au moins un filtre : query, candidate, theme, scope ou candidateStatus."
		for _, key := range []string{"query", "candidate", "theme", "scope", "candidateStatus"} {
			schema.AnyOf = append(schema.AnyOf, &jsonschema.Schema{
				Required:   []string{key},
				Properties: map[string]*jsonschema.Schema{key: {MinLength: jsonschema.Ptr(1)}},
			})
		}
		setEnum("scope", "", "campagne", "parti", "orientation", "archive")
		setEnum("candidateStatus", "", "toutes", "actives", "retirees")
		setEnum("sort", "", "pertinence", "alphabetique")
		setEnum("mode", "", "preuves")
		props["query"].MaxLength = jsonschema.Ptr(maxSearchQueryLength)
		props["limit"].Minimum = jsonschema.Ptr(0.0)
		props["limit"].Maximum = jsonschema.Ptr(float64(maxSearchLimit))
		schema.If = &jsonschema.Schema{
			Required:   []string{"mode"},
			Properties: map[string]*jsonschema.Schema{"mode": {Enum: []any{"preuves"}}},
		}
		schema.Then = &jsonschema.Schema{
			Properties: map[string]*jsonschema.Schema{"limit": {Maximum: jsonschema.Ptr(float64(maxProofSearchLimit))}},
		}
	case "polradar_measure":
		props["id"].MinLength = jsonschema.Ptr(1)
		props["id"].MaxLength = jsonschema.Ptr(160)
		props["version"].Minimum = jsonschema.Ptr(0.0)
	case "polradar_donnees":
		setEnum("collection", slices.Sorted(maps.Keys(collections))...)
		setEnum("institution", append([]string{""}, actChambers...)...)
		setEnum("nature", append([]string{""}, actNatures...)...)
		setEnum("position", append([]string{""}, actPositions...)...)
		props["query"].MaxLength = jsonschema.Ptr(maxSearchQueryLength)
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
	var data any
	absent := func(key string) map[string]any { return fields(map[string]string{key: "null"}) }
	alternatives := func(items ...map[string]any) map[string]any { return map[string]any{"type": "object", "oneOf": items} }
	switch name {
	case answerTool:
		schema, err := jsonschema.For[documentaryAnswer](nil)
		if err != nil {
			panic(err)
		}
		props := schema.Properties
		props["etat"].Enum = []any{"documente", "partiel", "sans-resultat", "ambigu", "hors-perimetre"}
		for _, intent := range slices.Sorted(maps.Keys(answerRoutes)) {
			props["intention"].Enum = append(props["intention"].Enum, intent)
		}
		props["resultats"].MaxItems = jsonschema.Ptr(answerComparisonLimit)
		props["resultats"].Items.Properties["sources"].MaxItems = jsonschema.Ptr(answerSourceLimit)
		props["resultats"].Items.Properties["chiffres"].MaxItems = jsonschema.Ptr(answerFactLimit)
		comparison := props["resultats"].Items.Properties["comparaison"].Properties
		comparison["etat"].Enum = []any{"position", "complement-seul", "non-documente"}
		comparison["supplementaires"].MaxItems = jsonschema.Ptr(answerComparisonSupplementLimit)
		schema.If = &jsonschema.Schema{Properties: map[string]*jsonschema.Schema{"intention": {Enum: []any{"comparaison"}}}}
		schema.Else = &jsonschema.Schema{Properties: map[string]*jsonschema.Schema{"resultats": {MaxItems: jsonschema.Ptr(answerLimit)}}}
		data = schema
	case "polradar_question", "polradar_comparer":
		data = alternatives(fields(paged), absent("question"))
	case "polradar_votes", "polradar_changements":
		data = fields(paged)
	case "polradar_territoires":
		data = alternatives(fields(map[string]string{"codeInsee": "string", "commune": "string", "definitions": "object"}), absent("commune"))
	case "polradar_methodologie":
		data = fields(map[string]string{"url": "string", "dates": "string", "attribution": "string", "votes": "string"})
	case "polradar_corpus":
		data = fields(map[string]string{"campagne": "integer", "parti": "integer", "orientations": "integer", "archives": "integer", "sources": "integer", "themes": "array", "contratsCollections": "object", "versionTransportCorpus": "integer"})
	case "polradar_candidates":
		data = fields(map[string]string{"candidatures": "array"})
	case "polradar_search":
		searchData := fields(map[string]string{"total": "integer", "offset": "integer", "suivant": "integer|null", "resultats": "array"})
		results := searchData["properties"].(map[string]any)["resultats"].(map[string]any)
		row := fields(map[string]string{
			"id": "string", "titre": "string", "auteur": "string", "candidatureAssociee": "string",
			"statut": "string", "edition": "string", "resume": "string", "url": "string", "urlVersion": "string|null", "source": "object",
		})
		props := row["properties"].(map[string]any)
		source := fields(map[string]string{"id": "string", "url": "string", "document": "string", "passage": "string"})
		props["source"] = source
		evidence := fields(map[string]string{
			"description": "string", "chiffres": "array|null", "montants": "array|null",
			"beneficiaires": "string|null", "echeance": "string|null", "financement": "string|null", "sources": "array",
		})
		evidence["properties"].(map[string]any)["sources"].(map[string]any)["items"] = source
		evidence["description"] = "Présent avec mode=preuves. Les valeurs nulles signalent une information absente de la fiche."
		props["preuves"] = evidence
		props["urlVersion"].(map[string]any)["description"] = "Lien Polradar vers la version citée. Utilisez url si la version manque."
		results["items"] = row
		data = searchData
	case "polradar_measure":
		data = alternatives(fields(map[string]string{"id": "string", "titre": "string", "description": "string", "auteur": "string", "statutCandidatureActuel": "string", "sources": "array", "versions": "array", "liensDossierCourant": "object", "versionDemandee": "string|null", "url": "string", "urlVersion": "string|null"}), absent("fiche"))
	case "polradar_donnees":
		index := fields(map[string]string{"collection": "string", "total": "integer", "offset": "integer", "publications": "array", "suivant": "integer|null"})
		data = alternatives(index, fields(map[string]string{"collection": "string", "publication": "object", "rubrique": "string"}), fields(map[string]string{"collection": "string", "publication": "null"}))
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
