package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"os"
	"path/filepath"
)

const corpusExport = "api/corpus.json"
const corpusPartsManifest = "api/corpus-parts.json"
const corpusTransportVersion = 1
const reassembledCorpusLimit = 64 << 20

func readCatalog(root, revision, checksum string, result *catalog) error {
	path := filepath.Join(root, corpusExport)
	index := filepath.Join(root, corpusPartsManifest)
	if _, err := os.Lstat(index); errors.Is(err, os.ErrNotExist) {
		return readData(path, corpusLimit, result)
	} else if err != nil {
		return invalidCorpus
	}
	var manifest struct {
		Version      int    `json:"version"`
		SourceCommit string `json:"sourceCommit"`
		SHA256       string `json:"sha256"`
		Bytes        int64  `json:"bytes"`
	}
	if err := readData(index, 32<<10, &manifest); err != nil ||
		manifest.Version != corpusTransportVersion || manifest.SourceCommit != revision || manifest.SHA256 != checksum ||
		manifest.Bytes <= 0 || manifest.Bytes > reassembledCorpusLimit {
		return invalidCorpus
	}
	file, err := os.Open(path)
	if err != nil {
		return invalidCorpus
	}
	defer file.Close()
	if stat, err := file.Stat(); err != nil || !stat.Mode().IsRegular() || stat.Size() != manifest.Bytes {
		return invalidCorpus
	}
	hash := sha256.New()
	decoder := json.NewDecoder(io.TeeReader(io.LimitReader(file, manifest.Bytes+1), hash))
	decoder.UseNumber()
	if err := decodeCatalog(decoder, result); err != nil || hex.EncodeToString(hash.Sum(nil)) != checksum {
		return invalidCorpus
	}
	return nil
}

func decodeCatalog(decoder *json.Decoder, result *catalog) error {
	if token, err := decoder.Token(); err != nil || token != json.Delim('{') {
		return invalidCorpus
	}
	seen := map[string]bool{}
	for decoder.More() {
		token, err := decoder.Token()
		key, ok := token.(string)
		if err != nil || !ok || seen[key] {
			return invalidCorpus
		}
		seen[key] = true
		switch key {
		case "meta":
			err = decoder.Decode(&result.Meta)
		case "candidates":
			result.Candidates, err = decodeCorpusArray[candidate](decoder)
		case "themes":
			result.Themes, err = decodeCorpusArray[theme](decoder)
		case "sources":
			result.Sources, err = decodeCorpusArray[source](decoder)
		case "measures":
			result.Measures, err = decodeCorpusArray[measure](decoder)
		case "versions":
			result.Versions, err = decodeCorpusArray[edition](decoder)
		case "polls":
			result.Polls, err = decodeCorpusArray[record](decoder)
		default:
			err = skipCorpusField(decoder)
		}
		if err != nil {
			return invalidCorpus
		}
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim('}') {
		return invalidCorpus
	}
	if _, err := decoder.Token(); err != io.EOF {
		return invalidCorpus
	}
	return nil
}

func decodeCorpusArray[T any](decoder *json.Decoder) ([]T, error) {
	opening, err := decoder.Token()
	if err != nil || opening == nil {
		return nil, err
	}
	if opening != json.Delim('[') {
		return nil, invalidCorpus
	}
	items := []T{}
	for decoder.More() {
		var item T
		if err := decoder.Decode(&item); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	if token, err := decoder.Token(); err != nil || token != json.Delim(']') {
		return nil, invalidCorpus
	}
	return items, nil
}

func skipCorpusField(decoder *json.Decoder) error {
	token, err := decoder.Token()
	if _, container := token.(json.Delim); err != nil || !container {
		return err
	}
	depth := 1
	for depth != 0 {
		token, err := decoder.Token()
		if err != nil {
			return err
		}
		switch token {
		case json.Delim('['), json.Delim('{'):
			depth++
		case json.Delim(']'), json.Delim('}'):
			depth--
		}
	}
	return nil
}
