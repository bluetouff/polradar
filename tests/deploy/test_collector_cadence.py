from contextlib import ExitStack
from datetime import date
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock, patch
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts' / (name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


watch = module('watch-sources')
polls = module('collect-polls')
transfer = module('daily-data-files')
http = watch.http_cache


class ConditionalRequests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'state.json'
        self.state = http.State(self.path)
        self.url = 'https://example.org/document'
        self.digest = http.key('public document')

    def test_cache_is_bounded_and_validators_never_follow_a_redirect_to_another_resource(self):
        self.state.remember('monitor', self.url, {'entity': http.key(self.url), 'etag':'"v1"', 'modified':'Tue, 24 Nov 2026 13:02:01 GMT'}, self.digest)
        self.state.save()
        self.assertNotIn(self.url, self.path.read_text())
        self.assertNotIn('public document', self.path.read_text())
        seen = http.State(self.path).get('monitor', self.url)
        self.assertEqual(http.headers(seen, self.url), {'If-None-Match':'"v1"', 'If-Modified-Since':'Tue, 24 Nov 2026 13:02:01 GMT'})
        for url in ('https://example.org/another', 'https://other.example/document'):
            self.assertEqual(http.headers(seen, url), {})
        self.assertEqual(http.headers({**seen, 'etag':'"v1"\r\nX-Foo: evil', 'modified':'bad'}, self.url), {})
        self.path.write_text('[]')
        with self.assertRaises(ValueError):
            http.State(self.path)

    def test_retry_after_is_persistent_and_no_connection_precedes_its_expiry(self):
        now = 1795525321
        with patch.object(http.time, 'time', return_value=now):
            self.assertEqual(http.retry_at('60', now), now + 60)
            self.assertEqual(http.retry_at('garbage', now), now + 3600)
            self.assertEqual(http.retry_at('Tue, 24 Nov 2026 13:02:01 GMT', 1), 1795525321)
            self.state.defer('example.org', '600')
            self.state.save()
            with patch.object(watch, 'STATE', http.State(self.path)), patch.object(watch, 'public_addresses', side_effect=AssertionError):
                meta = {}
                self.assertEqual(watch.fetch(self.url, {'example.org'}, response_meta=meta)[0], 429)
                self.assertTrue(meta['deferred'])
                source = {'id':'source','url': self.url}
                observed = watch.inspect(source, {}, {'example.org'})
                self.assertEqual((observed['httpStatus'],observed['status']), (None,'bloque'))
        with patch.object(http.time, 'time', return_value=now + 601):
            self.assertFalse(http.State(self.path).deferred('example.org'))
        with patch.object(watch, 'fetch', return_value=(429,'',b'')) as network, patch.object(watch.time,'sleep'):
            self.assertEqual(watch.fetch_reliably(self.url, {'example.org'})[0],429)
            self.assertEqual(network.call_count,1)

    def test_not_modified_does_not_close_an_unreviewed_change(self):
        self.state.remember('veille-1::', self.url, {'entity': http.key(self.url), 'etag':'"v1"'}, self.digest)
        with patch.object(watch, 'STATE', self.state), patch.object(watch, 'fetch_reliably', return_value=(304,'',b'')):
            old = {'fingerprint': self.digest, 'previousFingerprint': 'a'*64, 'status':'modifie'}
            changed = watch.inspect({'id':'x', 'url':self.url}, old, {'example.org'})
        self.assertEqual((changed['status'],changed['previousFingerprint'],changed['fingerprint']), ('modifie','a'*64,self.digest))

    def test_index_304_requires_exact_reusable_published_rows(self):
        at = '2026-11-24T07:05:00Z'
        row = {'number':'55001', 'label':'55001 Pres IV IFOP 24 novembre', 'downloadId':'9251', 'listedMonth':'2026-11'}
        previous = {'rows':[{**row, 'lastListedAt':at}], 'lastSuccessAt':at}
        self.state.remember('index-v1', polls.INDEX, {'entity':http.key(polls.INDEX), 'etag':'"p"'}, polls.catalogue_key([row]))
        with patch.object(polls.transport,'STATE',self.state), patch.object(polls.transport,'fetch_reliably',return_value=(304,'',b'')) as request:
            self.assertEqual(polls.read_catalogue(previous), ([row],[row]))
            self.assertTrue(request.call_args.kwargs['conditional'])
            previous['rows'][0]['label'] = 'Autre libellé'
            with self.assertRaises(ValueError):
                polls.read_catalogue(previous)
            self.assertIsNone(request.call_args.kwargs['conditional'])

    def test_priority_pass_only_opens_new_or_corrected_notice_metadata(self):
        old = {'number':'55001','downloadId':'9251','label':'55001 Pres IV IFOP 24 novembre','listedMonth':'2026-11'}
        new = {**old,'number':'55002','downloadId':'9252','label':'55002 Pres IV IFOP 24 novembre'}
        with patch.object(polls,'read_catalogue',return_value=([old,new],[old])), patch.object(polls.transport,'fetch_reliably',return_value=(503,'',b'')) as request:
            out = polls.collect(date(2026,11,24), new_only=True)
            self.assertEqual(len(out['catalogue']), 2)
            self.assertEqual([p['number'] for p in out['review']], ['55002'])
            self.assertEqual([call.args[0] for call in request.call_args_list], [polls.ORIGIN+'/notices/medias/fichiers/add/9252'])
        with patch.object(polls,'read_catalogue',return_value=([old],[old])), patch.object(polls.transport,'fetch_reliably',side_effect=AssertionError):
            self.assertEqual(polls.collect(date(2026,11,24),new_only=True)['review'],[])

    def fetch_pdf(self, url, headers, pieces):
        response = Mock(status=200)
        response.getheader.side_effect = lambda name, default=None: headers.get(name,default)
        response.isclosed.return_value = False
        response.read1.side_effect = [*pieces, b'']
        conn = Mock()
        conn.getresponse.return_value = response
        with ExitStack() as stack:
            for obj, prop, result in ((watch,'public_addresses',['1.1.1.1']), (watch.http.client,'HTTPSConnection',conn),
                                      (watch.ssl,'create_default_context', Mock()), (watch.socket,'create_connection',Mock())):
                stack.enter_context(patch.object(obj, prop,return_value=result))
            meta = {}
            result = watch.fetch(url, {urlsplit(url).hostname}, response_meta=meta, stream_pdf=True)
        return result, meta

    def test_large_pdf_has_the_same_sha256_without_returning_a_body(self):
        url = watch.LARGE_PDF_URLS['dlf-famille-2026']
        pieces = [b'%P',b'DF-1.7\n'] + [b'1' * 65536] * 49
        digest = hashlib.sha256(b''.join(pieces)).hexdigest()
        hdr = {'Content-Type':'application/pdf','Content-Length':str(sum(map(len,pieces)))}
        result, meta = self.fetch_pdf(url,hdr,pieces)
        self.assertEqual(result,(200,'application/pdf',b''))
        self.assertEqual((meta['pdf_sha256'],meta['size']), (digest,sum(map(len,pieces))))
        for address, headers, chunks in [
            (self.url,hdr,pieces), (url,{**hdr,'Content-Length':str(watch.LARGE_PDF_LIMIT+1)},pieces),
            (url,{'Content-Type':'text/html'},[b'%PDF-x']),
            (url,{'Content-Type':'application/pdf'},[b'HTML']),
            (url,{'Content-Type':'application/pdf','Content-Length':'123'},[b'%PDF-x']),
        ]:
            with self.subTest(address=address, headers=headers), self.assertRaises(ValueError):
                self.fetch_pdf(address,headers,chunks)


class ConcurrentPublication(unittest.TestCase):
    def test_notice_append_preserves_editorial_changes_but_data_conflicts_abort_before_writes(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            dest, packet = root / 'data', root / 'transfer'
            dest.mkdir(); packet.mkdir()
            original = [{'id':'old'}]
            adding = {'id':'notice-commission-55001','kind':'institution','url':'https://www.commission-des-sondages.fr/notices/medias/fichiers/add/9251'}
            current = [*original,{'id':'article-editeur'}]
            encoded = lambda value: json.dumps(value).encode()
            (dest / 'sources.json').write_bytes(encoded(current))
            (packet / 'sources.json').write_bytes(encoded([*original,adding]))
            record = {'hash':hashlib.sha256(encoded(original)).hexdigest(), 'originalCount':1}
            (packet / 'bases.json').write_text(json.dumps({'sources.json':record}))
            with patch.object(transfer, 'DATA', dest), patch.object(transfer, 'ARTIFACT', packet), patch.object(transfer.subprocess, 'run'):
                transfer.apply()
                self.assertEqual(json.loads((dest/'sources.json').read_bytes()),[*current,adding])
                (dest / 'sources.json').write_bytes(encoded(current))
                (dest / 'polls.json').write_bytes(encoded(['new main']))
                (packet / 'polls.json').write_bytes(encoded(['stale transfer']))
                (packet / 'bases.json').write_text(json.dumps({'sources.json':record,'polls.json':{'hash':'a'*64}}))
                with self.assertRaises(ValueError): transfer.apply()
                self.assertEqual(json.loads((dest/'sources.json').read_bytes()),current)
                self.assertEqual(json.loads((dest/'polls.json').read_bytes()),['new main'])

                (packet / 'polls.json').unlink()
                (packet / 'bases.json').write_text(json.dumps({'sources.json':record}))
                (dest / 'sources.json').write_bytes(encoded(original))
                for rows in ([{'id':'substitue'}, adding], [*original,{**adding,'url':'https://ailleurs.example/notice'}],
                             [*original,adding,adding]):
                    (packet / 'sources.json').write_bytes(encoded(rows))
                    with self.subTest(rows=rows), self.assertRaises(ValueError):
                        transfer.apply()
                    self.assertEqual(json.loads((dest/'sources.json').read_bytes()),original)
