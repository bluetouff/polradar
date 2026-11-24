import importlib.util
from pathlib import Path
from datetime import date, datetime
import json
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('airtime', Path(__file__).resolve().parents[2]/'scripts/collect-airtime.py')
airtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(airtime)


class AirtimeTests(unittest.TestCase):
    def body(self, changes=None):
        item = {'date_start':'01/09/2026','date_end':'30/09/2026','type':'uploaded_csv_personnalites','format':'csv','file_uri':'/sites/default/files/tphe/files/speaking_time_files/personnes.csv'}
        if changes: item.update(changes)
        settings={'tphpe':[{'annee':2026,'mois':[{'nom':'Septembre','fichiers':[item]}]}]}
        return ('<script data-drupal-selector="drupal-settings-json">'+json.dumps(settings)+'</script>').encode()

    def test_only_a_complete_month_of_the_selected_year_is_collected(self):
        rows=airtime.source_files(self.body(),2026,date(2026,11,17))
        self.assertEqual(rows[0]['month'],'2026-09')
        for changes in [{'date_end':'29/09/2026'},{'date_start':'02/09/2026'},{'date_start':'01/09/2025'},{'format':'html'},{'file_uri':'https://example.org/file.csv'}]:
            with self.subTest(changes=changes),self.assertRaises(ValueError):airtime.source_files(self.body(changes),2026,date(2026,11,17))
        with self.assertRaises(ValueError):airtime.source_files(self.body(),2026,date(2026,9,30))

    def test_remote_markup_is_data_and_never_selects_another_host_or_path(self):
        with self.assertRaises(ValueError):airtime.source_files(b'<script>window.location="https://example.org"</script>',2026,date(2026,11,17))
        with self.assertRaises(ValueError):airtime.source_files(self.body()+self.body(),2026,date(2026,11,17))
        for path in ['//localhost/file.csv','/sites/default/files/tphe/files/speaking_time_files/../../private.csv','/sites/default/files/tphe/files/speaking_time_files/%00.csv','/sites/default/files/tphe/files/speaking_time_files/file.csv?url=http://localhost/']:
            with self.subTest(path=path),self.assertRaises(ValueError):airtime.file_url(path)
        self.assertEqual(airtime.file_url('/sites/default/files/tphe/files/speaking_time_files/a%20%281%29.csv'),'https://www.arcom.fr/sites/default/files/tphe/files/speaking_time_files/a%20%281%29.csv')

    def test_december_is_detected_when_the_current_year_has_no_release(self):
        previous = self.body({'date_start': '01/12/2026', 'date_end': '31/12/2026'})
        answers = [(404, 'text/html', b''), (200, 'text/html', previous)]
        with patch.object(airtime.transport, 'fetch_reliably', side_effect=answers) as fetch:
            files, unavailable = airtime.recent_files(datetime(2027, 1, 25))
        self.assertEqual([row['month'] for row in files], ['2026-12'])
        self.assertEqual(unavailable, [2027])
        self.assertTrue(fetch.call_args_list[1].args[0].endswith('/2026'))


    def test_reuses_only_the_published_csv_for_the_same_url_and_compiler(self):
        url = 'https://www.arcom.fr/sites/default/files/tphe/files/speaking_time_files/a.csv'
        row = {'month': '2026-09', 'sourceUrl': url}
        digest = 'a' * 64
        with TemporaryDirectory() as folder:
            output = Path(folder)
            state = airtime.transport.http_cache.State(output / 'cache.json')
            state.remember('compiler-v1', url, {'entity': airtime.transport.http_cache.key(url), 'etag': '"v1"'}, digest)
            with patch.object(airtime.transport, 'STATE', state), patch.object(airtime.transport, 'fetch_reliably', return_value=(304, '', b'')) as fetch:
                airtime.collect_month(row, {**row, 'sha256': digest}, 'compiler-v1', output)
                self.assertTrue(row['reuse'])
                self.assertEqual(fetch.call_args.kwargs['conditional']['digest'], digest)
                self.assertFalse((output / '2026-09.csv').exists())
                for known, purpose in [(None, 'compiler-v1'), ({**row, 'sha256': 'b' * 64}, 'compiler-v1'), ({**row, 'sha256': digest}, 'compiler-v2')]:
                    with self.assertRaises(ValueError):
                        airtime.collect_month(dict(row), known, purpose, output)
                    self.assertEqual(fetch.call_args.kwargs['conditional'], {})


if __name__=='__main__':unittest.main()
