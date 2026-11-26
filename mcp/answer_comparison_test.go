package main

import (
	"encoding/json"
	"net/http"
	"reflect"
	"strconv"
	"strings"
	"testing"
	"time"
)

func answerThroughTransports(t *testing.T, h http.Handler, question string, revision string) output {
	t.Helper()
	args := answerArgs{Question: question, ExpectedRevision: revision}
	body, err := json.Marshal(args)
	if err != nil {
		t.Fatal(err)
	}
	rest := call(h, http.MethodPost, answerPath, string(body), nil)
	mcp := runTool(h, answerTool, args)
	var restOutput output
	var mcpOutput struct {
		Result struct {
			IsError           bool
			StructuredContent output
		}
	}
	if rest.Code != http.StatusOK || mcp.Code != http.StatusOK || json.Unmarshal(rest.Body.Bytes(), &restOutput) != nil ||
		json.Unmarshal(mcp.Body.Bytes(), &mcpOutput) != nil || mcpOutput.Result.IsError ||
		!reflect.DeepEqual(restOutput, mcpOutput.Result.StructuredContent) {
		t.Fatalf("parité de transport : REST %d %s, MCP %d %s", rest.Code, rest.Body.String(), mcp.Code, mcp.Body.String())
	}
	if restOutput.Commit != revision {
		t.Fatalf("révision inattendue %s", restOutput.Commit)
	}
	if rest.Body.Len() > maxOutput {
		t.Fatalf("réponse de %d octets au-delà du budget", rest.Body.Len())
	}
	t.Logf("Réponse REST structurée : %d octets", rest.Body.Len())
	return restOutput
}

func expectComparisonFields(t *testing.T, payload any, fields map[string]any) {
	t.Helper()
	for path, want := range fields {
		if got, ok := answerAt(payload, path); !ok || !reflect.DeepEqual(got, want) {
			t.Errorf("%s : obtenu %v, attendu %v", path, got, want)
		}
	}
}

func TestPublishedAnswerComparisonCandidateCoverage(t *testing.T) {
	data := &store{root: publishedSite(t)}
	c, err := data.load()
	if err != nil {
		t.Fatal(err)
	}
	if c.commit == answerLegacyCommit {
		t.Skip("édition antérieure aux relations qualifiées")
	}
	h := handler(data, openUsage(t.TempDir(), time.Now()))
	names := []string{"Gabriel Attal", "David Lisnard", "Jean-Luc Mélenchon", "Raphaël Glucksmann", "Dominique de Villepin", "Éric Zemmour"}
	ids := []string{"attal", "lisnard", "melenchon", "glucksmann", "villepin", "zemmour"}
	for n := 2; n <= len(names); n++ {
		t.Run(strconv.Itoa(n), func(t *testing.T) {
			question := "Compare " + strings.Join(names[:n-1], ", ") + " et " + names[n-1] + " sur la CSG des salaires."
			response := answerThroughTransports(t, h, question, c.commit)
			raw, _ := answerAt(response.Data, "/resultats")
			rows, ok := raw.([]any)
			total, _ := answerAt(response.Data, "/couverture/total")
			if !ok || total != float64(n) || len(rows) != n {
				t.Fatalf("%d candidatures demandées, %d restituées, total déclaré %v", n, len(rows), total)
			}
			expectComparisonFields(t, response.Data, map[string]any{
				"/couverture/limite":                              float64(6),
				"/couverture/comparaison/candidaturesDemandees":   float64(n),
				"/couverture/comparaison/candidaturesIdentifiees": float64(n),
				"/couverture/comparaison/candidaturesTraitees":    float64(n),
				"/couverture/comparaison/avecPosition":            float64(n),
				"/couverture/comparaison/sansPosition":            float64(0),
				"/couverture/comparaison/complementsSeuls":        float64(0),
				"/couverture/comparaison/resultatsTronques":       float64(0),
			})
			for i, id := range ids[:n] {
				candidate, _ := answerAt(rows[i], "/candidatureAssociee")
				source, _ := answerAt(rows[i], "/sources/0/url")
				if candidate != id || source == nil {
					t.Fatalf("dossier %d : obtenu %v sans la preuve attendue pour %s", i, candidate, id)
				}
			}
		})
	}
}

func TestPublishedAnswerComparisonEvidence(t *testing.T) {
	data := &store{root: publishedSite(t)}
	c, err := data.load()
	if err != nil {
		t.Fatal(err)
	}
	if c.commit == answerLegacyCommit {
		t.Skip("édition antérieure aux relations qualifiées")
	}
	h := handler(data, openUsage(t.TempDir(), time.Now()))
	t.Run("positions, absence et complément individuel", func(t *testing.T) {
		r := answerThroughTransports(t, h, "Compare Raphaël Glucksmann, David Lisnard, Teddy Riner, Marine Le Pen, Juan Branco et Jean-Luc Mélenchon sur la question climat-production-nucleaire.", c.commit)
		expectComparisonFields(t, r.Data, map[string]any{
			"/etat":  "partiel",
			"/motif": "positions_non_documentees",
			"/couverture/comparaison/candidaturesTraitees":          float64(6),
			"/couverture/comparaison/avecPosition":                  float64(4),
			"/couverture/comparaison/sansPosition":                  float64(2),
			"/couverture/comparaison/complementsSeuls":              float64(1),
			"/resultats/0/auteur":                                   "Raphaël Glucksmann",
			"/resultats/0/comparaison/nombrePositions":              float64(2),
			"/resultats/0/comparaison/supplementaires/0/versionId":  "ps-climat-mix-v1",
			"/resultats/0/comparaison/supplementaires/0/auteur":     "Parti socialiste",
			"/resultats/0/comparaison/supplementaires/0/statut":     "parti",
			"/resultats/0/comparaison/supplementaires/0/source/url": "https://projet-socialiste.fr/projet/vivre-libres/",
			"/resultats/1/versionId":                                "lisnard-nucleaire-hydraulique-v1",
			"/resultats/1/comparaison/nombrePositions":              float64(3),
			"/resultats/1/comparaison/supplementaires/1/versionId":  "lisnard-prolonger-reacteurs-nucleaires-60-ans-v1",
			"/resultats/2/candidatureAssociee":                      "riner",
			"/resultats/2/comparaison/etat":                         "non-documente",
			"/resultats/2/sources":                                  []any{},
			"/resultats/3/candidatureAssociee":                      "lepen",
			"/resultats/3/comparaison/etat":                         "complement-seul",
			"/resultats/3/comparaison/nombrePositions":              float64(0),
			"/resultats/3/comparaison/nombreComplements":            float64(2),
			"/resultats/3/relation/qualification":                   "complement",
			"/resultats/3/versionId":                                "lepen-relancer-euratom-reacteurs-francais-v1",
			"/resultats/3/comparaison/supplementaires/0/versionId":  "lepen-renegocier-prix-electricite-europe-v3",
			"/resultats/3/comparaison/supplementaires/0/source/url": "https://www.marinelepen.com/materiel-de-campagne/3/telecharger#page=2",
			"/resultats/4/candidatureAssociee":                      "branco",
			"/resultats/5/candidatureAssociee":                      "melenchon",
		})
	})
	t.Run("version citée et version actuelle", func(t *testing.T) {
		r := answerThroughTransports(t, h, "Compare Gabriel Attal et Raphaël Glucksmann sur la CSG des salaires.", c.commit)
		expectComparisonFields(t, r.Data, map[string]any{
			"/etat":                                 "partiel",
			"/motif":                                "version_depassee",
			"/resultats/1/versionId":                "glucksmann-csg-salaires-v2",
			"/resultats/1/relation/statut":          "version-depassee",
			"/resultats/1/relation/versionCourante": "glucksmann-csg-salaires-v3",
			"/resultats/1/url":                      "https://polradar.fr/mesures/glucksmann-csg-salaires/#version-2",
		})
	})
	t.Run("quatrième proposition signalée", func(t *testing.T) {
		r := answerThroughTransports(t, h, "Compare Raphaël Glucksmann et Gabriel Attal sur la question social-garde-jeunes-enfants.", c.commit)
		expectComparisonFields(t, r.Data, map[string]any{
			"/etat":  "partiel",
			"/motif": "comparaison_tronquee",
			"/couverture/comparaison/candidaturesTraitees": float64(2),
			"/couverture/comparaison/resultatsTronques":    float64(1),
			"/resultats/0/comparaison/nombrePositions":     float64(4),
			"/resultats/0/comparaison/resultatsTronques":   float64(1),
			"/resultats/0/comparaison/url":                 "https://polradar.fr/questions/social-garde-jeunes-enfants/#candidat-glucksmann",
		})
		supplementary, _ := answerAt(r.Data, "/resultats/0/comparaison/supplementaires")
		if rows, ok := supplementary.([]any); !ok || len(rows) != 2 {
			t.Fatal(supplementary)
		}
	})
	t.Run("nom non identifié", func(t *testing.T) {
		r := answerThroughTransports(t, h, "Compare Gabriel Attal, Candidature Exemple et David Lisnard sur la CSG des salaires.", c.commit)
		expectComparisonFields(t, r.Data, map[string]any{
			"/etat":  "partiel",
			"/motif": "candidatures_non_identifiees",
			"/couverture/comparaison/candidaturesDemandees":   float64(3),
			"/couverture/comparaison/candidaturesIdentifiees": float64(2),
			"/couverture/comparaison/candidaturesTraitees":    float64(2),
		})
	})
}

func TestPublishedHistoricalComparatorPagination(t *testing.T) {
	data := &store{root: publishedSite(t)}
	c, err := data.load()
	if err != nil {
		t.Fatal(err)
	}
	h := handler(data, openUsage(t.TempDir(), time.Now()))
	ids := []string{"attal", "lisnard", "melenchon", "glucksmann", "villepin", "zemmour"}
	for _, offset := range []int{0, 3} {
		response := runTool(h, "polradar_comparer", compareArgs{
			Question: "fiscalite-csg-salaires", Candidates: ids,
			pageArgs: pageArgs{Offset: offset, ExpectedRevision: c.commit},
		})
		var rpc struct {
			Result struct {
				IsError           bool
				StructuredContent output
			}
		}
		if response.Code != http.StatusOK || json.Unmarshal(response.Body.Bytes(), &rpc) != nil || rpc.Result.IsError {
			t.Fatal(response.Body.String())
		}
		payload := rpc.Result.StructuredContent.Data
		var next any
		if offset == 0 {
			next = float64(3)
		}
		expectComparisonFields(t, payload, map[string]any{
			"/total": float64(6), "/offset": float64(offset), "/suivant": next,
			"/resultats/0/candidate": ids[offset], "/resultats/2/candidate": ids[offset+2],
		})
		if results, _ := answerAt(payload, "/resultats"); len(results.([]any)) != 3 {
			t.Fatal(results)
		}
	}
}
