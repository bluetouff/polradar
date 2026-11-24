from datetime import date, datetime, timedelta, timezone
from pathlib import Path
import json
import runpy
import tempfile
import unittest
from unittest.mock import patch

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
        elif dim == ('query', 'page'):
            self.assertEqual((start, end, limit), (date(2026,7,6), date(2026,8,2), 250))
            data = [dict(metrics(), keys=['<exemple & essai>', 'https://polradar.fr/mesures/'])]
        elif dim == 'page' and end == date(2026,7,5):
            self.assertEqual(start, date(2026,6,8))
            data = [metrics('https://polradar.fr/mesures/')]
        else:
            self.assertEqual((start,end),(date(2026,7,6),date(2026,8,2)))
            data=[metrics({'page':'https://polradar.fr/mesures/', 'query':'<exemple & essai>'}.get(dim))]
        return {'responseAggregationType':'byPage' if dim in ('page', ('query','page')) else 'byProperty','rows':data}

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
            (None,{'rows':[dict(metrics(),position=10**400)],'responseAggregationType':'byProperty'}),
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

    def test_daily_bounds_comparison_periods_and_optional_breakdowns(self):
        calls = []
        def query(start, end, dim, limit):
            calls.append((start,end,dim,limit))
            return self.query(start,end,dim,limit)
        snap = collector['collect'](query, now)
        self.assertEqual(len(calls), 6)
        self.assertEqual(len(snap['queryPages']), 1)
        current = date.fromisoformat(snap['startDate']), date.fromisoformat(snap['endDate'])
        before = date.fromisoformat(snap['previous']['startDate']), date.fromisoformat(snap['previous']['endDate'])
        self.assertEqual(current[0]-before[1], timedelta(days=1))
        self.assertEqual(current[1]-current[0], before[1]-before[0])
        def partial(start, end, dim, limit):
            if dim == ('query','page') or end == before[1]:
                raise OSError('fixture confidentielle')
            return self.query(start,end,dim,limit)
        snap = collector['collect'](partial, now)
        html = render(snap, now.isoformat()).decode()
        self.assertIsNone(snap['previous']['pages'])
        self.assertIsNone(snap['queryPages'])
        self.assertIn('Le relevé croisé des requêtes et pages est indisponible',html)
        self.assertIn('Comparaison des pages indisponible',html)
        self.assertNotIn('fixture confidentielle',html)
        self.assertIsNotNone(snap['totals'])

    def test_compound_dimensions_and_private_boundaries(self):
        test_pairs = collector['rows']
        first = dict(metrics(),keys=['question test', 'https://polradar.fr/a/'])
        second = dict(metrics(),keys=['question test', 'https://polradar.fr/b/'])
        def parse(records, agg='byPage'):
            return test_pairs({'rows':records,'responseAggregationType':agg},('query','page'),now.date(),now.date(),250)
        self.assertEqual(len(parse([first,second])),2)
        self.assertEqual(len(parse([first],'auto')),1)
        search=collector['search']
        with patch.dict(search.__globals__,post=lambda url, payload, headers: json.loads(payload)):
            request=search('fixture',now.date(),now.date(),('query','page'),250)
        self.assertEqual(request['dimensions'],['query','page'])
        self.assertEqual(request['aggregationType'],'auto')
        self.assertEqual(request['rowLimit'],250)
        self.assertEqual(request['dataState'],'final')
        for bad in ([first, first], [dict(first,keys=first['keys'][::-1])],
                    [dict(first,keys=['q', 'https://polradar.fr.invalid/'])],
                    [dict(first,keys=['q', 'https://polradar.fr@invalid.test/'])],
                    [dict(first,keys=['q'])], [dict(first,keys=[True, 'https://polradar.fr/'])]):
            with self.assertRaises(ValueError): parse(bad)
        with self.assertRaises(ValueError): parse([first],'byProperty')

    def test_opportunities_thresholds_date_integrity_and_bounded_rank(self):
        snap=collector['collect'](self.query,now)
        def row(key, clicks, impressions, position):
            return {'key':key, 'clicks':clicks, 'impressions':impressions, 'ctr':clicks/impressions, 'position':position}
        snap['queries']=[row('limite basse',2,100,4),row('limite haute',0,99,20),row('hors seuil',3,100,20.1),
                         row('Comment vérifier un exemple ?',0,20,21)]
        snap['pages']=[row('https://polradar.fr/un/',8,100,5),row('https://polradar.fr/deux/',2,10,3),
                       row('https://polradar.fr/absente/',1,10,3)]
        snap['previous']['pages']=[row('https://polradar.fr/un/',4,100,4),row('https://polradar.fr/deux/',10,40,3)]
        snap['queryPages']=[dict(row('',2,100,4),query='<q&>',page='https://polradar.fr/un/'),
                            dict(row('',8,100,5),query='<q&>',page='https://polradar.fr/deux/')]
        html=render(snap,now.isoformat()).decode()
        positions=html.split('<strong>Positions 4 à 20</strong>')[1].split('<strong>Fortes impressions')[0]
        self.assertIn('limite basse',positions)
        self.assertIn('limite haute',positions)
        self.assertNotIn('hors seuil',positions)
        low=html.split('<strong>Fortes impressions et faible taux de clic</strong>')[1].split('<h2>Évolution des pages')[0]
        self.assertIn('limite basse',low)
        self.assertNotIn('limite haute',low)
        self.assertNotIn('hors seuil',low)
        questions=html.split('<strong>Questions à relire</strong>')[1].split('<h2>Évolution des pages')[0]
        self.assertIn('Comment vérifier un exemple ?',questions)
        self.assertNotIn('limite basse',questions)
        changes=html.split('<h2>Évolution des pages sur deux périodes de 28 jours</h2>')[1].split('<h2>Plusieurs pages')[0]
        self.assertIn('+4',changes)
        self.assertIn('−8',changes)
        self.assertNotIn('absente',changes)
        self.assertIn('&lt;q&amp;&gt;',html)
        self.assertNotIn('<q&>',html)
        snap['previous']['startDate']='2026-06-09'
        self.assertIn('Comparaison des pages indisponible',render(snap,now.isoformat()).decode())

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
