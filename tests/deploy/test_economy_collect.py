import datetime as dt
import json
import pathlib
import runpy
import unittest

script = runpy.run_path(pathlib.Path(__file__).resolve().parents[2] / "scripts" / "collect-economy.py")
parse_series = script["parse_series"]
source_url = script["source_url"]

SERIES = {
    "id": "test",
    "dataset": "demo",
    "frequency": "M",
    "filters": {"unit": "PC"},
}
AS_OF = dt.datetime(2026, 11, 19, 13, tzinfo=dt.timezone.utc)


def document(geo="FR"):
    return {
        "class": "dataset", "version": "2.0", "extension": {"id": "DEMO"},
        "id": ["freq", "unit", "geo", "time"],
        "size": [1, 1, 1, 3],
        "dimension": {
            "freq": {"category": {"index": {"M": 0}}},
            "unit": {"category": {"index": {"PC": 0}}},
            "geo": {"category": {"index": {geo: 0}}},
            "time": {"category": {"index": {"2026-07": 0, "2026-08": 1, "2026-09": 2}}},
        },
        "updated": "2026-10-18T11:00:00+0200",
        "value": {"0": 0, "2": 1},
        "status": {"2": "p"},
    }


class EurostatTests(unittest.TestCase):
    def test_sparse_cells_keep_missing_observations_and_flags(self):
        row = parse_series(SERIES, json.dumps(document()).encode(), AS_OF)
        self.assertEqual(row["observations"], [
            ["2026-07", "0", ""], ["2026-08", None, ""], ["2026-09", "1", "p"],
        ])

    def test_wrong_selector_future_timestamp_and_invalid_dataset_are_rejected(self):
        with self.assertRaises(ValueError):
            parse_series(SERIES, json.dumps(document("BE")).encode(), AS_OF)
        future = document()
        future["updated"] = "2027-01-01T00:00:00Z"
        with self.assertRaises(ValueError):
            parse_series(SERIES, json.dumps(future).encode(), AS_OF)
        with self.assertRaises(ValueError):
            source_url(dict(SERIES, dataset="../demo"))
