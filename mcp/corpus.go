package main

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"sync"
	"time"
	"unicode"
)

const site = "https://polradar.fr"

var invalidCorpus = errors.New("Le corpus publié est indisponible.")
var commitID = regexp.MustCompile("^[0-9a-f]{40}$")

type candidate struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Party        string `json:"party"`
	Status       string `json:"status"`
	StatusSource string `json:"statusSource"`
	WithdrawnOn  string `json:"withdrawnOn,omitempty"`
}
type theme struct {
	ID    string `json:"id"`
	Label string `json:"label"`
}
type source struct {
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	URL       string  `json:"url"`
	Published *string `json:"published"`
	Checked   string  `json:"checked"`
}
type reference struct {
	SourceID string `json:"sourceId"`
	Locator  string `json:"locator"`
	Fragment string `json:"fragment,omitempty"`
}
type measure struct {
	ID            string            `json:"id"`
	Title         string            `json:"title"`
	Description   string            `json:"description"`
	Candidate     string            `json:"candidate"`
	DisplayAuthor string            `json:"displayAuthor"`
	Theme         string            `json:"theme"`
	Scope         string            `json:"scope"`
	Edition       string            `json:"edition"`
	Checked       string            `json:"checked"`
	Revision      int               `json:"revision"`
	SourceRefs    []reference       `json:"sourceRefs"`
	Metrics       []json.RawMessage `json:"metrics"`
}
type catalog struct {
	Meta struct {
		Updated string `json:"corpusUpdated"`
	} `json:"meta"`
	Candidates []candidate
	Themes     []theme
	Sources    []source
	Measures   []measure
	Polls      []record
}
type snapshot struct {
	catalog
	commit   string
	root     string
	byID     map[string]int
	bySource map[string]source
	words    []string
}
type store struct {
	root    string
	mu      sync.Mutex
	current *snapshot
	release string
}

func readData(path string, limit int64, dest any) error {
	f, err := os.Open(path)
	if err != nil {
		return invalidCorpus
	}
	defer f.Close()
	st, err := f.Stat()
	if err != nil || !st.Mode().IsRegular() || st.Size() > limit {
		return invalidCorpus
	}
	data, err := io.ReadAll(io.LimitReader(f, limit+1))
	if err != nil || int64(len(data)) > limit || json.Unmarshal(data, dest) != nil {
		return invalidCorpus
	}
	return nil
}

var accents = strings.NewReplacer("é", "e", "è", "e", "ê", "e", "ë", "e", "à", "a", "â", "a", "ä", "a", "ï", "i", "î", "i", "ô", "o", "ö", "o", "û", "u", "ü", "u", "ù", "u", "ç", "c", "œ", "oe", "æ", "ae", "’", " ")

func normalize(s string) string {
	return strings.Join(strings.FieldsFunc(accents.Replace(strings.ToLower(s)), func(r rune) bool { return !unicode.IsLetter(r) && !unicode.IsDigit(r) }), " ")
}

func (s *store) load() (*snapshot, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	// The site's deployer atomically swaps a symlink between immutable, validated releases.
	root, err := filepath.EvalSymlinks(s.root)
	if err != nil {
		return nil, invalidCorpus
	}
	var marker struct {
		Commit string `json:"sourceCommit"`
	}
	if err := readData(filepath.Join(root, "build.json"), 4096, &marker); err != nil || !commitID.MatchString(marker.Commit) {
		return nil, invalidCorpus
	}
	if s.current != nil && root == s.release && s.current.commit == marker.Commit {
		return s.current, nil
	}
	c := &snapshot{commit: marker.Commit, root: root, byID: map[string]int{}, bySource: map[string]source{}}
	if err := readData(filepath.Join(root, "api", "corpus.json"), 10<<20, &c.catalog); err != nil {
		return nil, invalidCorpus
	}
	if _, err = time.Parse(time.DateOnly, c.Meta.Updated); err != nil || len(c.Measures) == 0 || len(c.Candidates) == 0 || len(c.Sources) == 0 {
		return nil, invalidCorpus
	}
	for _, v := range c.Sources {
		c.bySource[v.ID] = v
	}
	names := map[string]string{}
	for _, v := range c.Candidates {
		names[v.ID] = v.Name
	}
	themes := map[string]string{}
	for _, v := range c.Themes {
		themes[v.ID] = v.Label
	}
	sort.Slice(c.Measures, func(i, j int) bool { return c.Measures[i].ID < c.Measures[j].ID })
	c.words = make([]string, len(c.Measures))
	for i, m := range c.Measures {
		if _, exists := c.byID[m.ID]; exists || m.ID == "" || m.DisplayAuthor == "" || names[m.Candidate] == "" || themes[m.Theme] == "" || len(m.SourceRefs) == 0 {
			return nil, invalidCorpus
		}
		for _, ref := range m.SourceRefs {
			if _, ok := c.bySource[ref.SourceID]; !ok {
				return nil, invalidCorpus
			}
		}
		c.byID[m.ID] = i
		c.words[i] = normalize(strings.Join([]string{m.Title, m.Description, m.DisplayAuthor, names[m.Candidate], themes[m.Theme]}, " "))
	}
	s.release, s.current = root, c
	return c, nil
}

func (c *snapshot) cited(ref reference) map[string]any {
	s := c.bySource[ref.SourceID]
	link := s.URL
	if ref.Fragment != "" {
		link = strings.SplitN(link, "#", 2)[0] + "#" + ref.Fragment
	}
	return map[string]any{"document": s.Title, "url": link, "passage": ref.Locator, "publication": s.Published, "consultation": s.Checked}
}
func (c *snapshot) card(m measure) map[string]any {
	return map[string]any{"id": m.ID, "titre": m.Title, "auteur": m.DisplayAuthor, "candidatureAssociee": m.Candidate, "theme": m.Theme, "statut": m.Scope, "edition": m.Edition, "verifieLe": m.Checked, "url": site + "/mesures/" + m.ID + "/", "source": c.cited(m.SourceRefs[0])}
}

type searchArgs struct {
	Query     string `json:"query,omitempty" jsonschema:"Mots à rechercher dans les propositions, jusqu’à 160 caractères."`
	Candidate string `json:"candidate,omitempty" jsonschema:"Identifiant de la candidature associée, à retrouver avec polradar_candidates."`
	Theme     string `json:"theme,omitempty" jsonschema:"Identifiant d’un thème, disponible via polradar_corpus."`
	Scope     string `json:"scope,omitempty" jsonschema:"campagne, parti, orientation ou archive. Les archives nécessitent une sélection explicite."`
	Offset    int    `json:"offset,omitempty" jsonschema:"Première ligne, à partir de zéro."`
	Limit     int    `json:"limit,omitempty" jsonschema:"Nombre de lignes (10 par défaut, 25 au maximum)."`
}

func (c *snapshot) search(a searchArgs) (any, bool, error) {
	if len([]rune(a.Query)) > 160 || len(a.Candidate) > 96 || len(a.Theme) > 96 || a.Offset < 0 || a.Offset > 100000 || a.Limit < 0 || a.Limit > 25 {
		return nil, false, errors.New("Vérifiez les filtres et les limites de pagination.")
	}
	if a.Scope != "" && a.Scope != "campagne" && a.Scope != "parti" && a.Scope != "orientation" && a.Scope != "archive" {
		return nil, false, errors.New("Statut inconnu.")
	}
	terms := strings.Fields(normalize(a.Query))
	if len(terms) == 0 && a.Candidate == "" && a.Theme == "" && a.Scope == "" {
		return nil, false, errors.New("Indiquez des mots, un candidat, un thème ou un statut.")
	}
	if a.Limit == 0 {
		a.Limit = 10
	}
	rows := make([]map[string]any, 0, a.Limit)
	total := 0
	for i, m := range c.Measures {
		if (a.Candidate != "" && a.Candidate != m.Candidate) || (a.Theme != "" && a.Theme != m.Theme) || (a.Scope == "" && m.Scope == "archive") || (a.Scope != "" && a.Scope != m.Scope) {
			continue
		}
		match := true
		for _, term := range terms {
			if !strings.Contains(c.words[i], term) {
				match = false
				break
			}
		}
		if !match {
			continue
		}
		if total >= a.Offset && len(rows) < a.Limit {
			rows = append(rows, c.card(m))
		}
		total++
	}
	return map[string]any{"total": total, "offset": a.Offset, "resultats": rows}, len(rows) == 0, nil
}

type measureArgs struct {
	ID string `json:"id" jsonschema:"Identifiant exact d’une fiche retournée par la recherche."`
}

func (c *snapshot) detail(a measureArgs) (any, bool, error) {
	if a.ID == "" || len(a.ID) > 160 {
		return nil, false, errors.New("Identifiant de fiche invalide.")
	}
	i, ok := c.byID[a.ID]
	if !ok {
		return map[string]any{"fiche": nil}, true, nil
	}
	m := c.Measures[i]
	row := c.card(m)
	delete(row, "source")
	row["description"] = m.Description
	row["revision"] = m.Revision
	row["chiffres"] = m.Metrics
	refs := make([]map[string]any, 0, len(m.SourceRefs))
	for _, r := range m.SourceRefs {
		refs = append(refs, c.cited(r))
	}
	row["sources"] = refs
	return row, false, nil
}

type candidateArgs struct {
	IncludeWithdrawn bool `json:"includeWithdrawn,omitempty" jsonschema:"Inclure les candidatures dont le retrait est documenté."`
}

func (c *snapshot) listPeople(a candidateArgs) (any, bool, error) {
	rows := []map[string]any{}
	for _, p := range c.Candidates {
		if p.WithdrawnOn != "" && !a.IncludeWithdrawn {
			continue
		}
		row := map[string]any{"id": p.ID, "nom": p.Name, "statut": p.Status, "organisation": p.Party, "url": site + "/candidats/" + p.ID + "/"}
		if p.WithdrawnOn != "" {
			row["retrait"] = p.WithdrawnOn
		}
		if s, ok := c.bySource[p.StatusSource]; ok {
			row["sourceStatut"] = s.URL
		}
		rows = append(rows, row)
	}
	return map[string]any{"candidatures": rows}, len(rows) == 0, nil
}
func (c *snapshot) counts(_ struct{}) (any, bool, error) {
	n := map[string]int{}
	for _, m := range c.Measures {
		n[m.Scope]++
	}
	return map[string]any{"campagne": n["campagne"], "parti": n["parti"], "orientations": n["orientation"], "archives": n["archive"], "sources": len(c.Sources), "themes": c.Themes, "url": site + "/statistiques/"}, false, nil
}
