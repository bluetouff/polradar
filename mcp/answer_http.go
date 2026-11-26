package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"mime"
	"net/http"
	"strings"
	"unicode/utf8"
)

const answerPath = restPrefix + "reponse"
const answerBodyLimit = 4096

func answerHTTPError(w http.ResponseWriter, r *http.Request, status int) {
	codes := map[int][2]string{
		400: {"question_invalide", "La question ou les paramètres ne sont pas valides."},
		403: {"origine_refusee", "Origine refusée."},
		405: {"methode_non_autorisee", "Envoyez la question dans un corps JSON avec POST."},
		409: {"revision_changee", errRevision.Error()},
		413: {"taille_excessive", "La requête ou la réponse dépasse la taille autorisée."},
		415: {"format_invalide", "Utilisez un corps JSON en UTF-8."},
		429: {"quota_atteint", "Quota atteint."},
		503: {"service_indisponible", "Les données ou le service sont temporairement indisponibles."},
	}
	message := codes[status]
	w.WriteHeader(status)
	if r.Method != http.MethodHead {
		_ = json.NewEncoder(w).Encode(map[string]string{"code": message[0], "erreur": message[1]})
	}
}

func decodeAnswerArgs(body []byte) (answerArgs, error) {
	var args answerArgs
	if !utf8.Valid(body) {
		return args, errFilter
	}
	decoder := json.NewDecoder(bytes.NewReader(body))
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return args, errFilter
	}
	fields := map[string]bool{}
	for decoder.More() {
		token, err := decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || fields[key] || key != "question" && key != "expectedRevision" {
			return args, errFilter
		}
		fields[key] = true
		token, err = decoder.Token()
		value, ok := token.(string)
		if err != nil || !ok {
			return args, errFilter
		}
		if key == "question" {
			args.Question = value
		} else {
			args.ExpectedRevision = value
		}
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') {
		return args, errFilter
	}
	if _, err := decoder.Token(); err != io.EOF {
		return args, errFilter
	}
	return args, validateAnswerArgs(args)
}

func serveAnswer(w http.ResponseWriter, r *http.Request, data *store) {
	if r.URL.RawQuery != "" || r.URL.ForceQuery {
		answerHTTPError(w, r, 400)
		return
	}
	media, params, err := mime.ParseMediaType(r.Header.Get("Content-Type"))
	if err != nil || media != "application/json" || len(r.Header.Values("Content-Type")) != 1 ||
		len(params) > 1 || len(params) == 1 && !strings.EqualFold(params["charset"], "utf-8") ||
		len(r.Header.Values("Content-Encoding")) != 0 {
		answerHTTPError(w, r, 415)
		return
	}
	if r.ContentLength > answerBodyLimit {
		answerHTTPError(w, r, 413)
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, answerBodyLimit+1))
	if err != nil {
		answerHTTPError(w, r, 400)
		return
	}
	if len(body) > answerBodyLimit {
		answerHTTPError(w, r, 413)
		return
	}
	args, err := decodeAnswerArgs(body)
	if err != nil {
		answerHTTPError(w, r, 400)
		return
	}
	c, err := data.load()
	if err != nil {
		answerHTTPError(w, r, 503)
		return
	}
	value, empty, err := c.answer(args)
	switch {
	case errors.Is(err, errRevision):
		answerHTTPError(w, r, 409)
		return
	case errors.Is(err, errFilter):
		answerHTTPError(w, r, 400)
		return
	case err != nil:
		answerHTTPError(w, r, 503)
		return
	}
	raw, err := json.Marshal(c.envelope(value, empty))
	if err != nil {
		answerHTTPError(w, r, 503)
		return
	}
	if len(raw) > maxOutput {
		answerHTTPError(w, r, 413)
		return
	}
	_, _ = w.Write(raw)
}
