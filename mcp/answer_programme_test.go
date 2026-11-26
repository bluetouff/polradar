package main

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
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

func TestPublishedProgrammesCandidatsPrioritaires(t *testing.T) {
	data := &store{root: publishedSite(t)}
	corpus, err := data.load()
	if err != nil {
		t.Fatal(err)
	}
	if corpus.commit == answerLegacyCommit {
		t.Skip("édition antérieure à ces propositions")
	}
	h := handler(data, openUsage(t.TempDir(), time.Now()))
	for _, row := range []struct {
		question, person, measureID, sourceID string
	}{
		{"Que propose Serge Tinland sur la sortie de l’Union européenne ?", "tinland", "tinland-referendum-union-europeenne", "tinland-politique-europeenne"},
		{"Que propose Marine Le Pen sur la place de la France dans l’OTAN ?", "lepen", "lepen-sortir-commandement-integre-otan", "lepen-euronaval-otan-2026"},
		{"Le programme de Jean-Luc Mélenchon prévoit-il de sortir de l’Union européenne ?", "melenchon", "melenchon-rester-dans-union-et-euro-negocier-traites", "melenchon-programme-18"},
		{"Que propose David Lisnard pour libérer le foncier public ?", "lisnard", "lisnard-densifier-liberer-foncier-public", "lisnard-entretien-logement-2025"},
		{"Que propose Raphaël Glucksmann sur les salaires des enseignants ?", "glucksmann", "glucksmann-revaloriser-salaire-enseignants-10-25", "glucksmann-franc-jeu-salaires-2026"},
		{"Que propose Édouard Philippe pour l’installation des médecins ?", "philippe", "philippe-reguler-installation-medecins-si-echec", "philippe-sante-2026"},
	} {
		t.Run(row.person, func(t *testing.T) {
			result := answerThroughTransports(t, h, row.question, corpus.commit)
			body, err := json.Marshal(result.Data)
			if err != nil {
				t.Fatal(err)
			}
			var answer documentaryAnswer
			if err := json.Unmarshal(body, &answer); err != nil {
				t.Fatal(err)
			}
			for _, item := range answer.Results {
				if item.ID != row.measureID || item.Person != row.person || item.Version == "" || item.Author == "" {
					continue
				}
				for _, source := range item.Sources {
					if source.ID == row.sourceID && source.Passage != "" && strings.HasPrefix(source.URL, "https://") {
						return
					}
				}
			}
			t.Fatalf("%q : fiche attribuée ou passage absents parmi les résultats : %+v", row.question, answer)
		})
	}
}
