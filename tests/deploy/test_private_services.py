from datetime import date, datetime, timezone
from pathlib import Path
import json
import runpy
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
collector=runpy.run_path(str(ROOT/'deploy/goaccess/gsc_collect.py'))
render=runpy.run_path(str(ROOT/'deploy/goaccess/gsc_view.py'))['render']
ops=runpy.run_path(str(ROOT/'deploy/operations/install.py'))
apache=runpy.run_path(str(ROOT/'deploy/goaccess/install.py'))['APACHE']
now=datetime(2026,8,4,4,30,tzinfo=timezone.utc)


def metrics(key=None):
    row={'clicks':1,'impressions':8,'ctr':0.125,'position':2.75}
    if key is not None: row['keys']=[key]
    return row


class SearchReport(unittest.TestCase):
    def query(self, start, end, dim, limit):
        if dim=='date':
            self.assertEqual(end,date(2026,8,2))  # August 3 in California
            data=[metrics('2026-07-31'),metrics('2026-08-02')]
        else:
            self.assertEqual((start,end),(date(2026,7,6),date(2026,8,2)))
            data=[metrics({'page':'https://polradar.fr/mesures/', 'query':'<exemple & essai>'}.get(dim))]
        return {'responseAggregationType':'byPage' if dim=='page' else 'byProperty','rows':data}

    def test_real_dates_totals_and_escaped_rows(self):
        snap=collector['collect'](self.query,now)
        self.assertEqual(len(snap['daily']),2)
        self.assertEqual(snap['totals']['clicks'],1)
        self.assertEqual(snap['pages'][0]['position'],2.75)
        html=render(snap,now.isoformat()).decode()
        self.assertIn('&lt;exemple &amp; essai&gt;',html)
        self.assertNotIn('<exemple',html)
        self.assertNotIn('<script',html)
        self.assertIn('2026-08-02',html)

    def test_empty_has_no_synthetic_totals(self):
        snap=collector['collect'](lambda a,b,d,l:{'responseAggregationType':'byPage' if d=='page' else 'byProperty'},now)
        self.assertIsNone(snap['totals'])
        self.assertEqual(snap['queries'],[])

    def test_rejects_wrong_property_duplicate_bad_value_or_wrong_response(self):
        start=end=date(2026,8,2)
        for dimension,reply in [
            ('page',{'rows':[metrics('https://polradar.fr.evil.test/')],'responseAggregationType':'byPage'}),
            ('date',{'rows':[metrics('2026-08-02')]*2,'responseAggregationType':'byProperty'}),
            (None,{'rows':[dict(metrics(),ctr=float('nan'))],'responseAggregationType':'byProperty'}),
            (None,{'error':'private text'}),
        ]:
            with self.assertRaises(ValueError):
                collector['rows'](reply,dimension,start,end,100)

    def test_failed_refresh_keeps_snapshot_and_marks_report(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp)
            report=root/'google.html'
            snap=collector['collect'](self.query,now)
            self.assertTrue(collector['refresh'](lambda:snap,render,root,report,now))
            before=(root/'last.json').read_bytes()
            def failed(): raise OSError('private error')
            self.assertFalse(collector['refresh'](failed,render,root,report,now))
            self.assertEqual(before,(root/'last.json').read_bytes())
            self.assertIn('échoué',report.read_text())
            self.assertNotIn('private error',report.read_text())
            self.assertEqual((root/'last.json').stat().st_mode & 0o777,0o600)
            self.assertEqual(report.stat().st_mode & 0o777,0o640)

    def test_static_and_private_routes_are_distinct(self):
        patched=ops['private_alias'](apache)
        self.assertEqual(ops['private_alias'](patched),patched)
        self.assertLess(patched.index(ops['ALIAS']),patched.index('Alias /stats/'))
        with self.assertRaises(ValueError): ops['private_alias'](apache.replace('Require valid-user','Require all granted'))
        self.assertFalse((ROOT/'src/pages/stats').exists())
        self.assertNotIn('google.html',(ROOT/'mcp/main.go').read_text())

    def test_mcp_patch_refuses_other_vhosts_and_is_repeatable(self):
        v='<VirtualHost *:443>\n  ServerName polradar.fr\n</VirtualHost>'
        patched=ops['patched_vhost'](v)
        self.assertEqual(ops['patched_vhost'](patched),patched)
        for bad in [v.replace('443','80'),v.replace('polradar.fr','different.test'),v+'\n'+v]:
            with self.assertRaises(ValueError): ops['patched_vhost'](bad)

    def test_enrollment_is_limited_to_the_prepared_reader(self):
        key_id = 'a' * 40
        account = {'project_id': 'polradar', 'type': 'service_account', 'client_email': ops['READER'],
                   'token_uri': 'https://oauth2.googleapis.com/token',
                   'private_key': '-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----\n'}
        check = ops['enrollment_data']
        record = check(json.dumps({**account, 'extra': 'ignored'}).encode(), key_id)
        self.assertEqual(record, {**account, 'private_key_id': key_id})
        for data, kid in [(b'{' ,key_id), (b' '*32769,key_id), (json.dumps(account).encode(), 'invalid'),
                          (json.dumps({**account, 'private_key_id':'b'*40}).encode(), key_id),
                          (json.dumps({**account, 'client_email':'wrong'}).encode(), key_id),
                          (json.dumps({**account, 'token_uri':'https://other.test/'}).encode(), key_id)]:
            with self.assertRaises(ValueError):
                check(data, kid)
