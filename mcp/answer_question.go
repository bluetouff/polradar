package main

import (
	"encoding/json"
	"slices"
	"strings"
)

// Ignore the question framing while preserving words that define the subject,
// such as "droit" in "droit du sol" and a territory in a local question.
var questionFraming = wordSet("c ces ce cela comment compare comparez comparer comparaison comparatif " +
	"concernant contient dire dis donne est il leur lui me mesure mesures moi nous " +
	"peut peux position positions prevoit prevoient programme programmes propose proposent proposee proposition propositions " +
	"qu que quel quelle quelles quels question quoi s sa selon sont son source sources sujet t te tu veut veulent volet vous")

func answerQuestionKey(topic string) string {
	words := lexicalTerms(normalize(topic))
	words = slices.DeleteFunc(words, func(word string) bool { return questionFraming[word] })
	return strings.Join(words, " ")
}

func indexAnswerQuestions(questions []record) (map[string]record, error) {
	index := make(map[string]record, len(questions)*3)
	for _, question := range questions {
		var aliases []string
		if raw := question["answerAliases"]; raw != nil && json.Unmarshal(raw, &aliases) != nil {
			return nil, invalidCorpus
		}
		for _, label := range append(aliases, question.str("id"), question.str("title")) {
			key := answerQuestionKey(label)
			if key == "" {
				continue
			}
			if existing, ok := index[key]; ok && existing.str("id") != question.str("id") {
				index[key] = nil
			} else {
				index[key] = question
			}
		}
	}
	return index, nil
}

func (c *snapshot) answerCandidateQuestion(result *documentaryAnswer, topic string, person candidate) (bool, error) {
	d, err := c.dossiers()
	if err != nil {
		// The catalogue remains usable when this optional collection is unavailable.
		return false, nil
	}
	q := d.questionIndex[answerQuestionKey(topic)]
	if q == nil {
		return false, nil
	}
	id := q.str("id")
	_, dossiers, err := questionByID(d, id)
	if err != nil {
		return true, err
	}
	at := slices.IndexFunc(dossiers, func(row record) bool { return row.str("candidate") == person.ID })
	if at < 0 {
		// An older edition may not contain all active dossiers.
		return false, nil
	}
	row := dossiers[at]
	replies, err := c.answerComparisonPositions(id, person, "reponse", row["positions"])
	if err != nil {
		return true, err
	}
	context, err := c.answerComparisonPositions(id, person, "complement", row["complements"])
	if err != nil {
		return true, err
	}
	href := answerPageURL(q.str("url"))
	if href == "" {
		return true, invalidCorpus
	}
	result.Title = q.str("title")
	result.Coverage.Scope = "Positions et compléments reliés à cette question dans le dossier de " + person.Name
	total := len(replies) + len(context)
	switch {
	case total > 0:
		href += "#candidat-" + person.ID
	case row.str("status") == "revue":
		href += "#revue-" + person.ID
	default:
		href += "#couverture"
	}
	result.Coverage.URL = href
	result.Links = []answerLink{{"Consulter le dossier sur cette question", href}}

	items := append(replies, context...)
	result.Results = append(result.Results, items[:min(len(items), answerLimit)]...)
	result.finish(total, "Les fiches reprennent les passages reliés à cette question et leur attribution.")
	switch {
	case total == 0 && row.str("status") == "revue":
		result.describe("sans-resultat", "document_examine", "Les documents indiqués dans le dossier ont été examinés. Aucun passage répondant à cette question n’y a été relevé.")
	case total == 0:
		result.describe("sans-resultat", "position_non_documentee", "Aucune position n’est reliée à cette question pour ce dossier dans l’édition consultée.")
	case len(replies) == 0:
		result.describe("partiel", "complements_seuls", "Les passages ci-dessous éclairent la question. Le dossier ne contient encore aucune position qui y répond directement.")
	case slices.ContainsFunc(result.Results, func(item answerItem) bool {
		return item.Relation != nil && item.Relation.Status == "version-depassee"
	}):
		result.describe("partiel", "version_depassee", "Le dossier cite une ou plusieurs versions antérieures. Les fiches donnent aussi accès aux versions plus récentes.")
	}
	return true, nil
}
