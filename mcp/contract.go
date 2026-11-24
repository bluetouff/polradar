package main

// The SDK validates these public structured results before returning them.
func toolOutput(name string) map[string]any {
	types := map[string]string{}
	switch name {
	case "polradar_corpus":
		types = map[string]string{"campagne": "integer", "parti": "integer", "orientations": "integer", "archives": "integer", "sources": "integer", "themes": "array"}
	case "polradar_candidates":
		types["candidatures"] = "array"
	case "polradar_search":
		types = map[string]string{"total": "integer", "offset": "integer", "resultats": "array"}
	case "polradar_measure":
		types = map[string]string{"id": "string", "titre": "string", "auteur": "string", "statutCandidature": "string", "sources": "array", "versions": "array", "liensDossier": "object"}
	case "polradar_donnees":
		types = map[string]string{"collection": "string", "total": "integer", "publications": "array", "sources": "array"}
	}
	properties := map[string]any{}
	for label, t := range types {
		properties[label] = map[string]any{"type": t}
	}
	return map[string]any{"type": "object", "required": []string{"revisionDuSite", "revisionDuService", "corpusVerifieLe", "sansResultat", "donnees"}, "properties": map[string]any{
		"revisionDuSite":    map[string]any{"type": "string", "pattern": "^[0-9a-f]{40}$"},
		"revisionDuService": map[string]any{"type": []string{"string", "null"}},
		"corpusVerifieLe":   map[string]any{"type": "string", "format": "date"},
		"sansResultat":      map[string]any{"type": "boolean"},
		"donnees":           map[string]any{"type": "object", "properties": properties},
	}}
}
