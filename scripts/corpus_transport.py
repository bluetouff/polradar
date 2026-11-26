"""Partition a generated corpus into byte ranges without changing its JSON export."""
import hashlib
import json
from pathlib import Path
import re

from release_capacity import DEPLOY

WHITESPACE = re.compile(r'[ \t\r\n]*')


def sections(source):
    decoder = json.JSONDecoder()

    def skip(position):
        return WHITESPACE.match(source, position).end()

    opening = skip(0)
    if source[opening:opening + 1] != '{':
        raise ValueError('Expected a corpus object')
    start = 0
    position = skip(opening + 1)
    names = set()
    while True:
        name, end = decoder.raw_decode(source, position)
        if not isinstance(name, str) or not DEPLOY['COLLECTION'].fullmatch(name) or name in names:
            raise ValueError('Invalid corpus collection name')
        names.add(name)
        colon = skip(end)
        if source[colon:colon + 1] != ':':
            raise ValueError('Expected a corpus field')
        value, end = decoder.raw_decode(source, skip(colon + 1))
        del value
        separator = skip(end)
        if source[separator:separator + 1] == '}':
            if skip(separator + 1) != len(source):
                raise ValueError('Unexpected data after the corpus')
            yield name, source[start:].encode('utf-8')
            return
        if source[separator:separator + 1] != ',':
            raise ValueError('Expected a corpus separator')
        position = skip(separator + 1)
        yield name, source[start:position].encode('utf-8')
        start = position


def prepare(path: Path, revision, fingerprint):
    if path.stat().st_size > DEPLOY['MAX_CORPUS']:
        raise ValueError('Corpus exceeds the reconstructable size')
    with path.open('rb') as file:
        body = file.read(DEPLOY['MAX_CORPUS'] + 1)
    digest = hashlib.sha256(body).hexdigest()
    if len(body) > DEPLOY['MAX_CORPUS'] or digest != fingerprint:
        raise ValueError('Corpus differs from the build manifest')
    rows = []
    members = {}
    offset = 0
    limit = DEPLOY['MAX_CORPUS_PART']
    for collection, contents in sections(body.decode('utf-8')):
        for start in range(0, len(contents), limit):
            fragment = contents[start:start + limit]
            if len(rows) >= DEPLOY['MAX_CORPUS_PARTS']:
                raise ValueError('Too many corpus partitions')
            members[DEPLOY['part_name'](len(rows))] = fragment
            rows.append({
                'collection': collection, 'offset': offset, 'bytes': len(fragment),
                'sha256': hashlib.sha256(fragment).hexdigest(),
            })
            offset += len(fragment)
    if offset != len(body):
        raise ValueError('Corpus partition size mismatch')
    manifest = {
        'version': 1, 'sourceCommit': revision, 'sha256': digest,
        'bytes': offset, 'partitions': rows,
    }
    members[DEPLOY['CORPUS_PARTS_MANIFEST']] = json.dumps(manifest, separators=(',', ':')).encode() + b'\n'
    return members, manifest
