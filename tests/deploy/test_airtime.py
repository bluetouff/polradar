import importlib.util
from pathlib import Path
from datetime import date
import json
import unittest

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


if __name__=='__main__':unittest.main()
