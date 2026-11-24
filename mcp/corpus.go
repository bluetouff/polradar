package main

import (
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
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
	ID                   string  `json:"id"`
	Title                string  `json:"title"`
	URL                  string  `json:"url"`
	Published            *string `json:"published"`
	PublishedYear        *string `json:"publishedYear"`
	PublicationReference *string `json:"publicationReference,omitempty"`
	Checked              string  `json:"checked"`
}
type reference struct {
	SourceID string `json:"sourceId"`
	Locator  string `json:"locator"`
	Fragment string `json:"fragment,omitempty"`
}
type measure struct {
	ID             string            `json:"id"`
	Title          string            `json:"title"`
	Description    string            `json:"description"`
	Candidate      string            `json:"candidate"`
	DisplayAuthor  string            `json:"displayAuthor"`
	Theme          string            `json:"theme"`
	Scope          string            `json:"scope"`
	Edition        string            `json:"edition"`
	Checked        string            `json:"checked"`
	Revision       int               `json:"revision"`
	SourceRefs     []reference       `json:"sourceRefs"`
	Metrics        []json.RawMessage `json:"metrics"`
	Amounts        []json.RawMessage `json:"amounts"`
	Beneficiaries  *string           `json:"beneficiaries"`
	Timing         *string           `json:"timing"`
	Financing      *string           `json:"financing"`
	BudgetEntryIDs []string          `json:"budgetEntryIds"`
	VoteCaseIDs    []string          `json:"voteCaseIds"`
	EvolutionIDs   []string          `json:"evolutionIds"`
}
type edition struct {
	ID        string  `json:"id"`
	MeasureID string  `json:"measureId"`
	Number    int     `json:"number"`
	Kind      string  `json:"kind"`
	Observed  string  `json:"observedOn"`
	Recorded  *string `json:"recordedAt"`
	Summary   string  `json:"summary"`
	Author    string  `json:"displayAuthor"`
	Snapshot  measure `json:"snapshot"`
}
type catalog struct {
	Meta struct {
		Updated string `json:"corpusUpdated"`
		Edition string `json:"edition"`
	} `json:"meta"`
	Candidates []candidate
	Themes     []theme
	Sources    []source
	Measures   []measure
	Versions   []edition
	Polls      []record
}
type snapshot struct {
	contract    *dataContract
	extraMu     sync.Mutex
	editorial   *dossiers
	territorial *territories
	lexical     []lexicalRecord
	catalog
	commit   string
	root     string
	byID     map[string]int
	bySource map[string]source
	people   map[string]candidate
	history  map[string][]edition
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
	c.contract, err = loadContract(root)
	if err != nil {
		return nil, err
	}
	if err := c.contract.check("corpus"); err != nil {
		return nil, err
	}
	if err := readData(filepath.Join(root, "api", "corpus.json"), corpusLimit, &c.catalog); err != nil {
		return nil, invalidCorpus
	}
	if _, err = time.Parse(time.DateOnly, c.Meta.Updated); err != nil || len(c.Measures) == 0 || len(c.Candidates) == 0 || len(c.Sources) == 0 {
		return nil, invalidCorpus
	}
	for _, v := range c.Sources {
		c.bySource[v.ID] = v
	}
	names := map[string]string{}
	c.people = make(map[string]candidate, len(c.Candidates))
	for _, v := range c.Candidates {
		names[v.ID] = v.Name
		c.people[v.ID] = v
	}
	themes := map[string]string{}
	for _, v := range c.Themes {
		themes[v.ID] = v.Label
	}
	sort.Slice(c.Measures, func(i, j int) bool { return c.Measures[i].ID < c.Measures[j].ID })
	c.lexical = make([]lexicalRecord, len(c.Measures))
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
		c.lexical[i] = indexRecord(m, names[m.Candidate], themes[m.Theme])
	}
	c.history = make(map[string][]edition)
	for _, v := range c.Versions {
		if _, ok := c.byID[v.MeasureID]; !ok || v.Number < 1 || len(v.Snapshot.SourceRefs) == 0 {
			return nil, invalidCorpus
		}
		c.history[v.MeasureID] = append(c.history[v.MeasureID], v)
	}
	for id := range c.history {
		list := c.history[id]
		sort.Slice(list, func(i, j int) bool { return list[i].Number < list[j].Number })
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
	return map[string]any{"id": s.ID, "document": s.Title, "url": link, "passage": ref.Locator, "publication": s.Published, "anneePublication": s.PublishedYear, "justificatifPublication": s.PublicationReference, "consultation": s.Checked}
}
func (c *snapshot) card(m measure) map[string]any {
	p := c.people[m.Candidate]
	return map[string]any{"id": m.ID, "titre": m.Title, "auteur": m.DisplayAuthor, "candidatureAssociee": m.Candidate, "statutCandidature": p.Status, "dateRetrait": nullable(p.WithdrawnOn), "sourceStatut": nullable(c.bySource[p.StatusSource].URL), "theme": m.Theme, "statut": m.Scope, "edition": m.Edition, "verifieLe": m.Checked, "url": site + "/mesures/" + m.ID + "/", "source": c.cited(m.SourceRefs[0])}
}

func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (c *snapshot) checkRevision(want string) error {
	if want != "" && want != c.commit {
		return errRevision
	}
	return nil
}

var errRevision = errors.New("La révision demandée diffère de celle du site. Recommencez la pagination.")

type searchArgs struct {
	Sort             string `json:"sort,omitempty" jsonschema:"pertinence ou alphabetique."`
	CandidateStatus  string `json:"candidateStatus,omitempty" jsonschema:"toutes (défaut), actives ou retirees. Concerne le dossier associé, y compris pour un texte de parti."`
	ExpectedRevision string `json:"expectedRevision,omitempty" jsonschema:"Révision du site renvoyée par la première page."`
	Query            string `json:"query,omitempty" jsonschema:"Mots à rechercher dans les propositions, jusqu’à 160 caractères."`
	Candidate        string `json:"candidate,omitempty" jsonschema:"Identifiant de la candidature associée, à retrouver avec polradar_candidates."`
	Theme            string `json:"theme,omitempty" jsonschema:"Identifiant d’un thème, disponible via polradar_corpus."`
	Scope            string `json:"scope,omitempty" jsonschema:"campagne, parti, orientation ou archive. Les archives nécessitent une sélection explicite."`
	Offset           int    `json:"offset,omitempty" jsonschema:"Première ligne, à partir de zéro."`
	Limit            int    `json:"limit,omitempty" jsonschema:"Nombre de lignes (10 par défaut, 25 au maximum)."`
}

func (c *snapshot) search(a searchArgs) (any, bool, error) {
	if normalize(a.Query) == "" && a.Candidate == "" && a.Theme == "" && a.Scope == "" && a.CandidateStatus == "" {
		return nil, false, errors.New("Indiquez des mots, un candidat, un thème ou un statut.")
	}
	return c.matchMeasures(a)
}

func (c *snapshot) matchMeasures(a searchArgs) (any, bool, error) {
	if err := c.checkRevision(a.ExpectedRevision); err != nil {
		return nil, false, err
	}
	switch a.CandidateStatus {
	case "", "toutes", "actives", "retirees":
	default:
		return nil, false, errors.New("Filtre de candidature inconnu.")
	}
	if len([]rune(a.Query)) > 160 || len(a.Candidate) > 96 || len(a.Theme) > 96 || a.Offset < 0 || a.Offset > 100000 || a.Limit < 0 || a.Limit > 25 {
		return nil, false, errors.New("Vérifiez les filtres et les limites de pagination.")
	}
	if a.Scope != "" && a.Scope != "campagne" && a.Scope != "parti" && a.Scope != "orientation" && a.Scope != "archive" {
		return nil, false, errors.New("Statut inconnu.")
	}
	if a.Sort != "" && a.Sort != "pertinence" && a.Sort != "alphabetique" {
		return nil, false, errFilter
	}
	query := normalize(a.Query)
	terms := lexicalTerms(query)
	if query != "" && len(terms) == 0 {
		return nil, false, errors.New("Précisez le terme recherché.")
	}
	if a.Limit == 0 {
		a.Limit = 10
	}
	type hit struct{ index, rank int }
	hits := []hit{}
	for i, m := range c.Measures {
		withdrawn := c.people[m.Candidate].WithdrawnOn != ""
		if (a.CandidateStatus == "actives" && withdrawn) || (a.CandidateStatus == "retirees" && !withdrawn) {
			continue
		}
		if (a.Candidate != "" && a.Candidate != m.Candidate) || (a.Theme != "" && a.Theme != m.Theme) || (a.Scope == "" && m.Scope == "archive") || (a.Scope != "" && a.Scope != m.Scope) {
			continue
		}
		rank, ok := c.lexical[i].rank(query, terms)
		if ok {
			hits = append(hits, hit{i, rank})
		}
	}
	sort.Slice(hits, func(i, j int) bool {
		aHit, bHit := hits[i], hits[j]
		if a.Sort != "alphabetique" && aHit.rank != bHit.rank {
			return aHit.rank > bHit.rank
		}
		aTitle, bTitle := c.lexical[aHit.index].title, c.lexical[bHit.index].title
		if aTitle != bTitle {
			return aTitle < bTitle
		}
		return c.Measures[aHit.index].ID < c.Measures[bHit.index].ID
	})
	start := min(a.Offset, len(hits))
	end := min(start+a.Limit, len(hits))
	rows := make([]map[string]any, 0, end-start)
	for _, h := range hits[start:end] {
		rows = append(rows, c.card(c.Measures[h.index]))
	}
	return map[string]any{"total": len(hits), "offset": a.Offset, "resultats": rows}, len(rows) == 0, nil
}

type measureArgs struct {
	ID      string `json:"id" jsonschema:"Identifiant exact d’une fiche retournée par la recherche."`
	Version int    `json:"version,omitempty" jsonschema:"Numéro de version. Par défaut, fiche courante."`
}

func (c *snapshot) detail(a measureArgs) (any, bool, error) {
	if a.ID == "" || len(a.ID) > 160 || a.Version < 0 {
		return nil, false, errors.New("Identifiant de fiche invalide.")
	}
	i, ok := c.byID[a.ID]
	if !ok {
		return map[string]any{"fiche": nil}, true, nil
	}
	m := c.Measures[i]
	links := m
	var versionID string
	hist := make([]map[string]any, 0, len(c.history[m.ID]))
	for _, v := range c.history[m.ID] {
		hist = append(hist, map[string]any{"id": v.ID, "numero": v.Number, "nature": v.Kind, "observeLe": v.Observed, "enregistreLe": v.Recorded, "resume": v.Summary, "url": site + "/mesures/" + m.ID + "/#version-" + strconv.Itoa(v.Number)})
		if a.Version == v.Number {
			s := v.Snapshot
			s.ID, s.Candidate, s.Theme, s.DisplayAuthor, s.Revision = m.ID, m.Candidate, m.Theme, v.Author, v.Number
			m = s
			versionID = v.ID
		}
	}
	if a.Version > 0 && versionID == "" {
		return map[string]any{"fiche": nil}, true, nil
	}
	row := c.card(m)
	delete(row, "source")
	row["description"] = m.Description
	row["revision"] = m.Revision
	row["chiffres"] = m.Metrics
	row["montants"], row["beneficiaires"], row["echeance"], row["financement"] = m.Amounts, m.Beneficiaries, m.Timing, m.Financing
	row["versions"], row["versionDemandee"] = hist, nullable(versionID)
	row["liensDossier"] = map[string]any{"budgetEntryIds": links.BudgetEntryIDs, "voteCaseIds": links.VoteCaseIDs, "evolutionIds": links.EvolutionIDs}
	row["liensDossierCourant"] = row["liensDossier"]
	row["statutCandidatureActuel"] = c.people[m.Candidate].Status
	if versionID != "" {
		row["url"] = site + "/mesures/" + m.ID + "/#version-" + strconv.Itoa(a.Version)
	}
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
	return map[string]any{"campagne": n["campagne"], "parti": n["parti"], "orientations": n["orientation"], "archives": n["archive"], "editionDocumentaire": c.Meta.Edition, "sources": len(c.Sources), "themes": c.Themes, "contratsCollections": c.contract.status(), "url": site + "/statistiques/"}, false, nil
}
