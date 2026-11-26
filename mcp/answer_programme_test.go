package main

import (
	"strings"
	"testing"
)

func TestPublishedProgrammeNumeriqueBranco(t *testing.T) {
	corpus, err := (&store{root: publishedSite(t)}).load()
	if err != nil {
		t.Fatal(err)
	}
	// This compatibility fixture predates the digital review in the dossier export.
	if corpus.commit == answerLegacyCommit {
		t.Skip("édition antérieure au raccordement de la revue numérique")
	}
	for _, question := range []string{
		"C'est quoi le programme de branco sur le numérique ?",
		"Quelles sont les propositions numériques de Juan Branco ?",
		"Quel est le programme de Juan Branco en matière de numérique ?",
	} {
		value, empty, err := corpus.answer(answerArgs{Question: question})
		if err != nil || empty {
			t.Fatalf("%q : %v, %v", question, value, err)
		}
		answer := value.(documentaryAnswer)
		if answer.Coverage.Total == nil || *answer.Coverage.Total < 10 || len(answer.Results) != 3 {
			t.Fatalf("couverture numérique de Branco : %+v", answer)
		}
		if answer.Coverage.URL != site+"/numerique/candidats/#branco" || answer.State != "partiel" {
			t.Fatalf("accès au dossier et limite : %+v", answer)
		}
		for _, row := range answer.Results {
			if row.Person != "branco" || row.Author != "Juan Branco" || row.Version == "" ||
				len(row.Sources) == 0 || !strings.HasPrefix(row.Sources[0].URL, "https://") || row.Sources[0].Passage == "" {
				t.Fatalf("attribution ou preuve incomplète : %+v", row)
			}
		}
	}
	value, empty, err := corpus.search(searchArgs{
		Query: "C'est quoi le programme de branco sur le numérique ?", Candidate: "branco", Mode: "preuves",
	})
	if err != nil || empty {
		t.Fatalf("recherche du dossier numérique : %v, %v", value, err)
	}
	for _, row := range value.(map[string]any)["resultats"].([]map[string]any) {
		if row["auteur"] != "Juan Branco" || row["urlVersion"] == nil || row["preuves"] == nil {
			t.Fatalf("recherche sans attribution, version ou passage : %+v", row)
		}
	}
}
