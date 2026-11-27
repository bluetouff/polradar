package main

import (
	"encoding/json"
	"net/url"
	"os"
	"reflect"
	"slices"
	"strconv"
	"strings"
	"testing"
	"time"
)

type documentaryQuestion struct {
	Famille      string
	Question     string
	Outil        string
	Arguments    map[string]any
	Attendus     map[string]any
	Champs       []string
	Sources      []string
	Vide         bool
	Erreur       bool
	Identifiants []string
}

func answerAt(value any, path string) (any, bool) {
	for _, s := range strings.Split(strings.TrimPrefix(path, "/"), "/") {
		if obj, ok := value.(map[string]any); ok {
			candidate, present := obj[s]
			if !present {
				return nil, false
			}
			value = candidate
			continue
		}
		arr, ok := value.([]any)
		n, e := strconv.Atoi(s)
		if !ok || e != nil || n < 0 || n >= len(arr) {
			return nil, false
		}
		value = arr[n]
	}
	return value, true
}

// This run invokes the actual MCP protocol handler in memory. The public HTTP
// gateway's concurrency/rate policy is tested separately without public traffic.
func TestPublishedBancDocumentaire(t *testing.T) {
	data := &store{root: publishedSite(t)}
	c, e := data.load()
	if e != nil {
		t.Fatal(e)
	}
	if want := os.Getenv("POLRADAR_TEST_COMMIT"); want != "" && c.commit != want {
		t.Fatalf("Révision inattendue %s", c.commit)
	}
	if c.contract.major("parlement") != dataMajor {
		t.Skip("banc de référence v1.3")
	}
	raw, e := os.ReadFile("testdata/questions-documentaires.json")
	if e != nil {
		t.Fatal(e)
	}
	var suite struct {
		Version   int
		Questions []documentaryQuestion
	}
	if json.Unmarshal(raw, &suite) != nil || suite.Version != 1 || len(suite.Questions) < 150 {
		t.Fatal("banc incomplet")
	}
	h := protocol(data, openUsage(t.TempDir(), time.Now()))
	answerAvailable := c.commit != answerLegacyCommit
	unique := map[string]bool{}
	calls := map[string]bool{}
	families := map[string]int{}
	tools := map[string]bool{}
	passed, exactSources, emptyAnswers, expectedErrors := 0, 0, 0, 0
	durations := make([]time.Duration, 0, len(suite.Questions))
	sizes := make([]int, 0, len(suite.Questions))
	started := time.Now()
	for _, q := range suite.Questions {
		if unique[q.Question] || len(q.Question) < 12 || q.Famille == "" || len(q.Sources) == 0 || len(q.Identifiants) == 0 || (!q.Erreur && len(q.Attendus) == 0) {
			t.Fatal("annotation incomplète", q.Question)
		}
		unique[q.Question] = true
		if q.Outil == answerTool && !answerAvailable {
			continue
		}
		// The compatibility archive predates the restored credit for the joint programme.
		if c.commit == answerLegacyCommit && q.Outil == "polradar_measure" && q.Arguments["id"] == "lalanne-fiscalite-taxes-carburants" {
			q.Attendus["/auteur"] = "Francis Lalanne"
		}
		// The pinned edition predates Billetdoux’s timestamped campaign citations.
		if c.commit == answerLegacyCommit && q.Outil == "polradar_comparer" && q.Arguments["question"] == "fiscalite-transmission-patrimoine" {
			const path = "/resultats/0/reponse/positions/0/versionId"
			if q.Attendus[path] == "billetdoux-heritage-bareme-v2" {
				q.Attendus[path] = "billetdoux-heritage-bareme-v1"
			}
		}
		// The pinned edition predates the added recording of Arthaud's SMIC proposal.
		if c.commit == answerLegacyCommit && q.Outil == "polradar_comparer" && q.Arguments["question"] == "travail-salaire-minimum" {
			const path = "/resultats/0/reponse/positions/0/versionId"
			if q.Attendus[path] == "arthaud-travail-smic-v2" {
				q.Attendus[path] = "arthaud-travail-smic-v1"
			}
		}
		// The pinned archive exported the documentary date in evenement, including for announcements.
		if c.commit == answerLegacyCommit && q.Outil == "polradar_donnees" && q.Arguments["collection"] == "breves" {
			if date, found := q.Attendus["/publication/dateDocumentaire"]; found {
				q.Attendus["/publication/evenement"] = date
				delete(q.Attendus, "/publication/dateDocumentaire")
				delete(q.Attendus, "/publication/typeDateDocumentaire")
			}
		}
		collection, _ := q.Arguments["collection"].(string)
		if (collection == "senat" || collection == "parlement-europeen") && c.contract.major(collection) != dataMajor {
			continue
		}
		args, e := json.Marshal(q.Arguments)
		if e != nil {
			t.Fatal("arguments de référence", q.Question)
		}
		calls[q.Outil+" "+string(args)] = true
		families[q.Famille]++
		tools[q.Outil] = true
		for _, s := range q.Sources {
			u, er := url.Parse(s)
			if er != nil || u.Scheme != "https" || u.Hostname() == "" || u.User != nil || u.Port() != "" {
				t.Fatal("référence", q.Question)
			}
		}
		for _, want := range q.Attendus {
			if s, ok := want.(string); ok && slices.Contains(q.Sources, s) {
				exactSources++
				break
			}
		}
		if q.Vide {
			emptyAnswers++
		}
		if q.Erreur {
			expectedErrors++
		}
		ok := t.Run(q.Famille+"/"+q.Question, func(t *testing.T) {
			start := time.Now()
			res := runTool(h, q.Outil, q.Arguments)
			durations = append(durations, time.Since(start))
			sizes = append(sizes, res.Body.Len())
			var resp struct {
				Result struct {
					IsError           bool
					StructuredContent output
				}
				Error json.RawMessage
			}
			if res.Code != 200 || json.Unmarshal(res.Body.Bytes(), &resp) != nil {
				t.Fatal("transport", res.Code)
			}
			if resp.Result.IsError || resp.Error != nil {
				if !q.Erreur {
					t.Fatal("erreur d’outil")
				}
				return
			}
			if q.Erreur {
				t.Fatal("entrée invalide acceptée")
			}
			out := resp.Result.StructuredContent
			if out.Commit != c.commit || out.Contract != dataMajor || out.Empty != q.Vide || out.Updated == "" || out.Updated != c.Meta.Updated {
				t.Fatal("enveloppe ou révision")
			}
			for _, path := range q.Champs {
				if _, present := answerAt(out.Data, path); !present {
					t.Error("champ indispensable absent", path)
				}
			}
			for path, want := range q.Attendus {
				got, present := answerAt(out.Data, path)
				if !present || !reflect.DeepEqual(got, want) {
					t.Errorf("%s : obtenu %v, attendu %v", path, got, want)
				}
			}
		})
		if ok {
			passed++
		}
	}
	if len(families) < 14 || len(calls) < 100 {
		t.Errorf("couverture insuffisante de %d familles et %d appels distincts", len(families), len(calls))
	}
	for _, name := range toolNames {
		if name == answerTool && !answerAvailable {
			continue
		}
		if !tools[name] {
			t.Error("outil sans question de référence", name)
		}
	}
	if len(durations) == 0 {
		t.Fatal("aucune question exécutée")
	}
	total := time.Since(started)
	slices.Sort(durations)
	slices.Sort(sizes)
	p50 := durations[(len(durations)-1)/2]
	p95 := durations[(95*len(durations)+99)/100-1]
	t.Logf("%d/%d questions conformes sur %s, %d appels distincts, %d familles, %d outils", passed, len(durations), c.commit, len(calls), len(families), len(tools))
	t.Logf("%d questions vérifient une adresse de source exacte, %d résultats vides et %d erreurs attendus", exactSources, emptyAnswers, expectedErrors)
	t.Logf("Latence par appel hors réseau : p50 %s, p95 %s. Lot complet : %s", p50.Round(time.Microsecond), p95.Round(time.Microsecond), total.Round(time.Millisecond))
	t.Logf("Taille de la réponse JSON-RPC : p50 %d octets, p95 %d octets", sizes[(len(sizes)-1)/2], sizes[(95*len(sizes)+99)/100-1])
}
