package main

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
)

const dataMajor = 1
const corpusLimit = 10 << 20
const dossiersLimit = 8 << 20
const territoriesLimit = 5 << 20

var collectionNames = [...]string{"corpus", "dossiers", "territoires", "sondages", "comparaisons-sondages", "economie", "agenda", "budgets", "marches", "parlement", "sources", "droit", "verifications", "breves", "financements", "arcom", "graphiques", "senat", "parlement-europeen", "relations", "debats", "simulation-budgetaire"}

type dataContract struct {
	Version     int            `json:"version"`
	Collections map[string]int `json:"collections"`
}

func loadContract(root string) (*dataContract, error) {
	path := filepath.Join(root, "api", "contrat-donnees.json")
	if _, err := os.Stat(path); errors.Is(err, os.ErrNotExist) {
		// The 1.1 release predates the manifest. Only its original collections exist.
		return nil, nil
	}
	var result dataContract
	if readData(path, 8192, &result) != nil || result.Version != dataMajor || result.Collections == nil {
		return nil, fmt.Errorf("%w Contrat de données incompatible.", invalidCorpus)
	}
	return &result, nil
}

func (c *dataContract) major(name string) int {
	if c == nil {
		switch name {
		case "corpus", "dossiers", "territoires", "sondages", "economie", "agenda", "budgets", "marches":
			return dataMajor
		}
		return 0
	}
	return c.Collections[name]
}

func (c *dataContract) check(name string) error {
	if c.major(name) != dataMajor {
		return fmt.Errorf("%w Collection %s incompatible.", invalidCorpus, name)
	}
	return nil
}

func (c *dataContract) status() map[string]any {
	result := map[string]any{}
	for _, name := range collectionNames {
		result[name] = map[string]any{"version": c.major(name), "compatible": c.check(name) == nil}
	}
	return result
}
