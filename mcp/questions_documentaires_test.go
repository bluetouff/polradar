package main

import (
	"encoding/json"
	"net/url"
	"os"
	"reflect"
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
	unique := map[string]bool{}
	families := map[string]int{}
	tools := map[string]bool{}
	passed, available := 0, 0
	started := time.Now()
	for _, q := range suite.Questions {
		if unique[q.Question] || len(q.Question) < 12 || q.Famille == "" || len(q.Sources) == 0 || len(q.Identifiants) == 0 || (!q.Erreur && len(q.Attendus) == 0) {
			t.Fatal("annotation incomplète", q.Question)
		}
		unique[q.Question] = true
		collection, _ := q.Arguments["collection"].(string)
		if (collection == "senat" || collection == "parlement-europeen") && c.contract.major(collection) != dataMajor {
			continue
		}
		available++
		families[q.Famille]++
		tools[q.Outil] = true
		for _, s := range q.Sources {
			u, er := url.Parse(s)
			if er != nil || u.Scheme != "https" || u.Hostname() == "" {
				t.Fatal("référence", q.Question)
			}
		}
		ok := t.Run(q.Famille+"/"+q.Question, func(t *testing.T) {
			res := runTool(h, q.Outil, q.Arguments)
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
			if out.Commit != c.commit || out.Contract != dataMajor || out.Empty != q.Vide || out.Updated == "" {
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
	if len(families) < 14 || len(tools) != len(toolNames) {
		t.Errorf("couverture insuffisante de %d familles et %d outils", len(families), len(tools))
	}
	t.Logf("%d/%d questions conformes, %d familles, %d outils ; temps du lot hors réseau %s", passed, available, len(families), len(tools), time.Since(started).Round(time.Millisecond))
}
