package main

import (
	"fmt"
	"slices"
	"strings"
)

type digitalReview struct {
	Checked   string
	Topics    []digitalTopic
	Documents map[string][]string
}

type digitalTopic struct {
	ID         string
	MeasureIDs []string
}

func programmeWords(topic string) string {
	for _, lead := range []string{"c est quoi ", "qu est ce que ", "peux tu me dire ", "dis moi "} {
		if rest, ok := strings.CutPrefix(topic, lead); ok {
			topic = rest
			break
		}
	}
	topic = strings.NewReplacer(" en matiere de ", " ", " sur la question de ", " ", " sur le sujet de ", " ").Replace(topic)
	terms := slices.DeleteFunc(answerTerms(topic), func(word string) bool {
		switch word {
		case "programme", "programmes", "volet", "mesure", "mesures", "contient", "quoi":
			return true
		}
		return false
	})
	return strings.Join(terms, " ")
}

// A theme heading identifies a catalogue, while a narrower query keeps its terms.
func (c *snapshot) answerProgrammeTopic(result *documentaryAnswer, words string, people []candidate) (bool, error) {
	if words == "" {
		return false, nil
	}
	person := candidate{}
	if len(people) == 1 {
		person = people[0]
	}
	digital, detail, liberty := digitalSubject(words)
	if digital && person.WithdrawnOn == "" {
		return c.answerDigitalProgramme(result, person, detail, liberty)
	}
	for _, theme := range c.Themes {
		if words != programmeWords(normalize(theme.Label)) && words != programmeWords(normalize(theme.ID)) {
			continue
		}
		args := searchArgs{Theme: theme.ID, Candidate: person.ID, Limit: answerLimit}
		if person.ID == "" {
			args.CandidateStatus = "actives"
		}
		data, _, err := c.matchMeasures(args)
		if err != nil {
			return true, err
		}
		page := data.(map[string]any)
		result.Title = theme.Label + " dans les programmes"
		result.Coverage.Scope = "Fiches courantes classées dans le thème « " + theme.Label + " »"
		themeURL := site + "/themes/" + theme.ID + "/"
		result.Coverage.URL = themeURL
		result.Links = []answerLink{{"Parcourir le thème " + theme.Label, themeURL}}
		if person.ID != "" {
			result.Title = theme.Label + " dans le dossier de " + person.Name
			result.Coverage.Scope += " pour " + person.Name
			candidateURL := site + "/candidats/" + person.ID + "/"
			result.Links = append([]answerLink{{"Consulter le dossier de " + person.Name, candidateURL}}, result.Links...)
		}
		for _, row := range page["resultats"].([]map[string]any) {
			result.Results = append(result.Results, c.measureAnswer(c.Measures[c.byID[row["id"].(string)]]))
		}
		result.finish(page["total"].(int), "Les fiches du thème indiquent l’auteur et le document d’origine.")
		return true, nil
	}
	return false, nil
}

func digitalSubject(words string) (digital bool, detail string, liberty bool) {
	if words == "liberte expression" {
		return true, "", true
	}
	terms := strings.Fields(words)
	if slices.Contains(terms, "numerique") {
		rest := slices.DeleteFunc(terms, func(w string) bool {
			return w == "numerique" || w == "strategie" || w == "transition"
		})
		narrow := strings.Join(rest, " ")
		return true, narrow, narrow == "liberte expression"
	}
	return false, "", false
}

func (c *snapshot) answerDigitalProgramme(result *documentaryAnswer, person candidate, detail string, liberty bool) (bool, error) {
	dossiers, err := c.dossiers()
	if err != nil {
		return true, err
	}
	review := dossiers.Digital
	if review == nil {
		// Older site releases can still be read through the proof search.
		return false, nil
	}
	if !dayOK(review.Checked) || len(review.Topics) == 0 {
		return true, invalidCorpus
	}

	title := "Le numérique"
	if liberty {
		title = "La liberté d’expression"
		detail = ""
	}
	result.Title = title + " dans les programmes"
	result.Coverage.Scope = "Fiches de la revue documentaire du numérique"
	result.Coverage.URL = site + "/numerique/candidats/"
	if person.ID != "" {
		result.Title = title + " dans le dossier de " + person.Name
		result.Coverage.Scope += " pour " + person.Name
		result.Coverage.URL += "#" + person.ID
	}
	result.Links = []answerLink{{"Consulter les fiches et les documents examinés", result.Coverage.URL}}
	if liberty {
		result.Links = append(result.Links, answerLink{"Consulter le dossier Liberté d’expression", site + "/numerique/liberte-expression/"})
	}
	if person.ID != "" {
		result.Links = append(result.Links, answerLink{"Ouvrir le dossier de " + person.Name, site + "/candidats/" + person.ID + "/"})
	}

	seen := map[string]bool{}
	groups := make([][]int, 0, len(review.Topics))
	total, relevant := 0, 0
	terms := lexicalTerms(detail)
	for _, topic := range review.Topics {
		if liberty && topic.ID != "liberte-expression" {
			continue
		}
		matches := []int{}
		for _, id := range topic.MeasureIDs {
			i, ok := c.byID[id]
			if !ok || seen[id] || c.Measures[i].Scope == "archive" {
				return true, invalidCorpus
			}
			seen[id] = true
			m := c.Measures[i]
			if person.ID != "" && person.ID != m.Candidate || c.people[m.Candidate].WithdrawnOn != "" {
				continue
			}
			relevant++
			if _, matchesTerms := c.lexical[i].rank(detail, terms); matchesTerms {
				matches = append(matches, i)
			}
		}
		total += len(matches)
		if len(matches) > 0 {
			groups = append(groups, matches)
		}
	}

	// Take one result per editorial topic before taking a second from a topic.
	for i := 0; len(result.Results) < answerLimit && len(result.Results) < total; i++ {
		for _, group := range groups {
			if i < len(group) {
				result.Results = append(result.Results, c.measureAnswer(c.Measures[group[i]]))
				if len(result.Results) == answerLimit {
					break
				}
			}
		}
	}
	if total == 0 {
		if len(terms) > 0 {
			data, empty, err := c.matchMeasures(searchArgs{
				Query: "numerique " + detail, Candidate: person.ID, CandidateStatus: "actives", Limit: answerLimit,
			})
			if err != nil {
				return true, err
			}
			if !empty {
				page := data.(map[string]any)
				result.Coverage.Scope = "Fiches courantes du corpus mentionnant le numérique et les termes de la question"
				for _, row := range page["resultats"].([]map[string]any) {
					result.Results = append(result.Results, c.measureAnswer(c.Measures[c.byID[row["id"].(string)]]))
				}
				result.finish(page["total"].(int), "Les fiches correspondent aux termes recherchés dans le corpus. Le dossier numérique donne accès à la sélection thématique.")
				return true, nil
			}
		}
		result.Coverage.Total = &total
		switch {
		case relevant != 0:
			result.describe("sans-resultat", "sujet_non_retrouve", "Les mots de la question ne correspondent à aucune fiche de la sélection. Le dossier donne accès aux sujets documentés.")
		case person.ID != "" && len(review.Documents[person.ID]) == 0:
			result.describe("sans-resultat", "revue_non_documentee", "La revue de ce dossier reste à compléter. Le dossier du candidat permet de consulter les autres sources disponibles.")
		default:
			result.describe("sans-resultat", "aucune_fiche_dans_la_revue", "Les documents examinés sont accessibles dans la revue. Aucune fiche précise n’est reliée à cette question dans ce périmètre.")
		}
		return true, nil
	}
	explanation := "La revue relie une fiche à ses sources."
	if total > 1 {
		explanation = fmt.Sprintf("La revue relie %d fiches à leurs sources.", total)
	}
	result.finish(total, explanation)
	return true, nil
}
