package main

import (
	"encoding/json"
	"path/filepath"
	"regexp"
)

var documentaryNodeID = regexp.MustCompile("^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$")
var snapshotID = regexp.MustCompile("-v[1-9][0-9]*$")

type documentaryNode struct {
	ID   string `json:"id"`
	Type string `json:"type"`
}

type documentaryEdge struct {
	relation record
	origin   documentaryNode
	target   documentaryNode
}

type documentaryGraph struct {
	edges []documentaryEdge
	byID  map[string]record
}

func collectionIDLimit(name string) int {
	if name == "relations" {
		return 300
	}
	return 160
}

func (n documentaryNode) matches(query string) bool {
	return n.ID == query || (n.Type == "version" && snapshotID.ReplaceAllString(n.ID, "") == query)
}

func (c *snapshot) proofGraph(file string) (*documentaryGraph, error) {
	c.extraMu.Lock()
	defer c.extraMu.Unlock()
	if c.proofs != nil {
		return c.proofs, nil
	}
	var export struct {
		Version   int      `json:"version"`
		Commit    string   `json:"sourceCommit"`
		Relations []record `json:"relations"`
	}
	if readData(filepath.Join(c.root, "api", file), 8<<20, &export) != nil ||
		export.Version != dataMajor || export.Commit != c.commit || export.Relations == nil {
		return nil, invalidCorpus
	}
	graph := &documentaryGraph{
		edges: make([]documentaryEdge, 0, len(export.Relations)),
		byID:  make(map[string]record, len(export.Relations)),
	}
	for _, relation := range export.Relations {
		id := relation.str("id")
		edge := documentaryEdge{relation: relation}
		if id == "" || len(id) > collectionIDLimit("relations") || graph.byID[id] != nil ||
			json.Unmarshal(relation["origin"], &edge.origin) != nil || edge.origin.ID == "" ||
			json.Unmarshal(relation["target"], &edge.target) != nil || edge.target.ID == "" {
			return nil, invalidCorpus
		}
		graph.edges = append(graph.edges, edge)
		graph.byID[id] = relation
	}
	c.proofs = graph
	return graph, nil
}

func (c *snapshot) proofRelations(a dataArgs, def collection) (any, bool, error) {
	if a.Periode != "" || len(a.Query) > maxSearchQueryLength ||
		(a.Query != "" && (a.ID != "" || !documentaryNodeID.MatchString(a.Query))) {
		return nil, false, errFilter
	}
	graph, err := c.proofGraph(def.file)
	if err != nil {
		return nil, false, err
	}
	base := site + "/api/" + def.file
	if a.ID != "" {
		if relation, exists := graph.byID[a.ID]; exists {
			return map[string]any{"collection": a.Collection, "publication": relation, "rubrique": base}, false, nil
		}
		return map[string]any{"collection": a.Collection, "publication": nil}, true, nil
	}
	matches := make([]record, 0)
	for _, edge := range graph.edges {
		if a.Query == "" || edge.origin.matches(a.Query) || edge.target.matches(a.Query) {
			matches = append(matches, edge.relation)
		}
	}
	start := min(a.Offset, len(matches))
	end := min(start+publicationPageSize, len(matches))
	return map[string]any{
		"collection": a.Collection, "total": len(matches), "offset": start,
		"suivant":      nextPageOffset(start, end-start, len(matches)),
		"publications": matches[start:end], "rubrique": base,
	}, start == end, nil
}
