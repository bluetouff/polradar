package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

var errResource = errors.New("Ressource introuvable.")
var errFilter = errors.New("Paramètre de requête invalide.")

func apiError(w http.ResponseWriter, r *http.Request, status int, message string) {
	w.WriteHeader(status)
	if r.Method != http.MethodHead {
		json.NewEncoder(w).Encode(map[string]string{"erreur": message})
	}
}

func allowedParams(q url.Values, keys ...string) bool {
	for k, values := range q {
		if !slices.Contains(keys, k) || len(values) != 1 || values[0] == "" ||
			!utf8.ValidString(values[0]) || strings.IndexFunc(values[0], unicode.IsControl) >= 0 {
			return false
		}
	}
	return true
}

func numberParam(q url.Values, key string, fallback, minValue, maxValue int) (int, bool) {
	if !q.Has(key) {
		return fallback, true
	}
	raw := q.Get(key)
	n, err := strconv.Atoi(raw)
	return n, err == nil && strconv.Itoa(n) == raw && n >= minValue && n <= maxValue
}

func (c *snapshot) resource(path string, q url.Values) (any, bool, error) {
	switch path {
	case "":
		if len(q) != 0 {
			return nil, false, errFilter
		}
		return map[string]any{"version": "1", "documentation": site + "/api/", "openapi": site + "/api/openapi.json",
			"ressources": []string{"corpus", "candidats", "mesures", "donnees/{collection}"}}, false, nil
	case "corpus":
		if len(q) != 0 {
			return nil, false, errFilter
		}
		return c.counts(struct{}{})
	case "candidats":
		if !allowedParams(q, "includeWithdrawn") {
			return nil, false, errFilter
		}
		option := q.Get("includeWithdrawn")
		if option != "" && option != "true" && option != "false" {
			return nil, false, errFilter
		}
		return c.listPeople(candidateArgs{IncludeWithdrawn: option == "true"})
	case "mesures":
		if !allowedParams(q, "query", "candidate", "theme", "scope", "limit", "offset", "candidateStatus", "sort") {
			return nil, false, errFilter
		}
		offset, okOffset := numberParam(q, "offset", 0, 0, 100000)
		limit, okLimit := numberParam(q, "limit", 10, 1, 25)
		if !okOffset || !okLimit || (q.Has("query") && normalize(q.Get("query")) == "") {
			return nil, false, errFilter
		}
		return c.matchMeasures(searchArgs{Query: q.Get("query"), Candidate: q.Get("candidate"),
			Theme: q.Get("theme"), Scope: q.Get("scope"), CandidateStatus: q.Get("candidateStatus"), Sort: q.Get("sort"), Offset: offset, Limit: limit})
	}

	parts := strings.Split(path, "/")
	if len(parts) == 2 && parts[0] == "mesures" && parts[1] != "" && len(parts[1]) <= 160 {
		version, ok := numberParam(q, "version", 0, 1, 100000)
		if !ok || !allowedParams(q, "version") {
			return nil, false, errFilter
		}
		v, empty, err := c.detail(measureArgs{ID: parts[1], Version: version})
		if empty {
			return nil, false, errResource
		}
		return v, empty, err
	}
	if (len(parts) == 2 || len(parts) == 3) && parts[0] == "donnees" {
		if _, ok := collections[parts[1]]; !ok {
			return nil, false, errResource
		}
		args := dataArgs{Collection: parts[1]}
		if len(parts) == 3 {
			if parts[2] == "" || len(parts[2]) > 160 {
				return nil, false, errResource
			}
			if len(q) != 0 {
				return nil, false, errFilter
			}
			args.ID = parts[2]
		} else {
			offset, ok := numberParam(q, "offset", 0, 0, 100000)
			if !ok || !allowedParams(q, "offset") {
				return nil, false, errFilter
			}
			args.Offset = offset
		}
		v, empty, err := c.publicData(args)
		if args.ID != "" && empty {
			return nil, false, errResource
		}
		return v, empty, err
	}
	return nil, false, errResource
}

func serveData(w http.ResponseWriter, r *http.Request, data *store) {
	if len(r.URL.RawQuery) > 2048 || r.ContentLength != 0 || len(r.TransferEncoding) != 0 {
		apiError(w, r, 400, "Requête trop longue ou corps de requête inattendu.")
		return
	}
	q, err := url.ParseQuery(r.URL.RawQuery)
	if err != nil {
		apiError(w, r, 400, errFilter.Error())
		return
	}
	c, err := data.load()
	if err != nil {
		apiError(w, r, 503, err.Error())
		return
	}
	if q.Has("expectedRevision") {
		if len(q["expectedRevision"]) != 1 || !commitID.MatchString(q.Get("expectedRevision")) {
			apiError(w, r, 400, errFilter.Error())
			return
		}
		if c.checkRevision(q.Get("expectedRevision")) != nil {
			apiError(w, r, 409, errRevision.Error())
			return
		}
		q.Del("expectedRevision")
	}
	v, empty, err := c.resource(strings.TrimPrefix(r.URL.Path, restPrefix), q)
	switch {
	case errors.Is(err, errResource):
		apiError(w, r, 404, err.Error())
	case errors.Is(err, invalidCorpus):
		apiError(w, r, 503, err.Error())
	case err != nil:
		apiError(w, r, 400, err.Error())
	default:
		if r.Method != http.MethodHead {
			json.NewEncoder(w).Encode(c.envelope(v, empty))
		}
	}
}
