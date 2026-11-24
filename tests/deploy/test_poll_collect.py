import importlib.util
from pathlib import Path
from datetime import date
import unittest


def load(name, filename):
    scripts = Path(__file__).resolve().parents[2] / 'scripts'
    spec = importlib.util.spec_from_file_location(name, scripts / filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


polls = load('poll_collector', 'collect-polls.py')


class PollCollectorTests(unittest.TestCase):
    def test_catalogue_binds_day_and_download_to_commission(self):
        def entry(path, label):
            return f'<p class="download-line"><a class="pdf_download" href="{path}">{label}</a> - Novembre 2026</p>'

        body = ''.join([
            entry('/notices/medias/fichiers/add/2410', '10382 Pres IV YOUGOV Le Huffpost 19 novembre'),
            entry('//example.org/notices/medias/fichiers/add/123', '10390 Pres IV IFOP 19 novembre'),
            entry('/notices/medias/fichiers/add/111?next=other', '10391 Pres IV IFOP 19 novembre'),
            entry('/notices/medias/fichiers/add/112', '10392 Pres IV IFOP 20 novembre'),
            entry('/notices/medias/fichiers/add/113', '10393 Pres logement IFOP 19 novembre'),
        ]).encode()
        rows = polls.notices(body, date(2026, 11, 19))
        self.assertEqual(rows, [{
            'number': '10382',
            'url': polls.ORIGIN + '/notices/medias/fichiers/add/2410',
            'published': date(2026, 11, 19),
            'institute': 'yougov',
        }])

    def test_inventory_keeps_opinion_old_and_undated_items_separate_from_import(self):
        row = lambda path, label, edition: f'<p class="download-line"><a class="pdf_download" href="{path}">{label}</a>{edition}</p>'
        body = (row('/notices/medias/fichiers/add/2419', '10395 Pres barometre politique ODOXA', '- Novembre 2026') +
                row('/notices/medias/fichiers/add/2258', '9889A Pres IV', '- Septembre 2024') +
                row('/notices/medias/fichiers/add/2411', 'Libellé nouveau', '')).encode()
        inventory = polls.catalogue_rows(body)
        self.assertEqual([r['number'] for r in inventory], ['10395','9889a',None])
        self.assertEqual([r['listedMonth'] for r in inventory], ['2026-11','2024-09',None])
        self.assertEqual(polls.notices(body, date(2026,11,24)), [])
        with self.assertRaises(ValueError):
            polls.catalogue_rows(body + row('//example.org/other', 'Étranger', '').encode())
        with self.assertRaises(ValueError):
            polls.catalogue_rows(body + row('/notices/medias/fichiers/add/2419','Contradictoire','').encode())

    def test_weighted_column_does_not_replace_raw_base_and_unknown_is_not_zero(self):
        base, rows = polls.yougov_table([
            'Base                          630           566',
            '',
            'Édouard Philippe - Horizons   40%           46%',
            'Marine Le Pen - RN            60%           54%',
            'Non pris en compte dans ce calcul : 399 répondants',
        ], True, {})
        self.assertEqual(base, 630)
        self.assertEqual([row['percentage'] for row in rows], [46, 54])
        self.assertIsNone(polls.result('Nathalie Arthaud', '-', {})['percentage'])
        with self.assertRaises(ValueError):
            polls.yougov_table(['Base       630       566', 'Marine Le Pen - RN     60%'], True, {})
        with self.assertRaises(ValueError):
            polls.check_results([{'id': 'a', 'percentage': 60}, {'id': 'b', 'percentage': 45}], 'second', whole=True)

    def test_future_and_oversize_dates_are_not_admitted(self):
        self.assertEqual(polls.period('Terrain du 30 octobre au 2 novembre 2026'), (date(2026, 10, 30), date(2026, 11, 2)))
        with self.assertRaises(ValueError):
            polls.period('Terrain du 13 janvier au 16 novembre 2026')
        with self.assertRaises(ValueError):
            polls.layout(b'<html>not a notice</html>')


class DailyTransferTests(unittest.TestCase):
    def test_invalid_paths_and_payloads_are_rejected_before_writes(self):
        import tempfile
        from unittest.mock import patch

        transfer = load('daily_data_files', 'daily-data-files.py')
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            artifact = root / 'artifact'
            artifact.mkdir()
            data = root / 'src/data'
            data.mkdir(parents=True)
            previous = data / 'polls.json'
            previous.write_text('[]')
            (artifact / 'polls.json').write_text('[1]')
            (artifact / 'extra.txt').write_text('outside allowlist')
            with patch.multiple(transfer, DATA=data, ARTIFACT=artifact, ROOT=root):
                with self.assertRaises(ValueError):
                    transfer.apply()
                self.assertEqual(previous.read_text(), '[]')
                (artifact / 'extra.txt').unlink()
                (artifact / 'polls.json').unlink()
                (artifact / 'polls.json').symlink_to(previous)
                with self.assertRaises(ValueError):
                    transfer.apply()
                self.assertEqual(previous.read_text(), '[]')


if __name__ == '__main__':
    unittest.main()
