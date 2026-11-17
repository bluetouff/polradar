import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('markets', Path(__file__).resolve().parents[2] / 'scripts/collect-markets.py')
markets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(markets)
OBSERVED = '2026-11-17T15:00:00Z'


def poly():
    return {'id': '79987', 'slug': 'next-french-presidential-election', 'title': 'Next French Presidential Election', 'description': 'Rules of the election contract.', 'active': True, 'closed': False, 'volume': 123.45, 'markets': [
        {'id': '679018', 'active': True, 'closed': False, 'archived': False, 'acceptingOrders': True, 'outcomes': '["Yes", "No"]', 'question': 'Will Example win the 2027 French presidential election?', 'groupItemTitle': '<img src=x onerror=alert(1)>', 'description': 'Rules of the election contract.', 'bestBid': .34, 'bestAsk': .36, 'lastTradePrice': .35, 'updatedAt': OBSERVED, 'volumeNum': 123.45}
    ]}


def kalshi():
    return {'event': {'event_ticker': 'KXFRENCHPRES-27', 'series_ticker': 'KXFRENCHPRES', 'title': 'Next French presidential election winner?', 'markets': [
        {'event_ticker': 'KXFRENCHPRES-27', 'ticker': 'KXFRENCHPRES-27-TEST', 'market_type': 'binary', 'status': 'active', 'notional_value_dollars': '1.0000', 'yes_sub_title': 'Example', 'title': 'Will Example win?', 'yes_bid_dollars': '0.3400', 'yes_ask_dollars': '0.3600', 'yes_bid_size_fp': '5.00', 'yes_ask_size_fp': '10.00', 'last_price_dollars': '0.3500', 'volume_fp': '123.45', 'updated_time': OBSERVED, 'rules_primary': 'Yes if Example wins.', 'rules_secondary': ' '}
    ]}, 'markets': []}


class MarketTests(unittest.TestCase):
    def test_prices_and_volumes_keep_their_original_units(self):
        p = markets.validate_provider(markets.parse_polymarket(poly(), OBSERVED))
        k = markets.validate_provider(markets.parse_kalshi(kalshi(), OBSERVED))
        self.assertEqual((p['volumeUnit'], k['volumeUnit']), ('dollars', 'contrats'))
        self.assertEqual(p['contracts'][0]['bid'], .34)
        self.assertEqual(k['contracts'][0]['ask'], .36)
        self.assertIsNone(k['contracts'][0]['liquidity'])
        self.assertEqual(k['volume'], 123.45)

    def test_missing_values_and_empty_orderbooks_never_become_zero_prices(self):
        self.assertEqual(markets.quote(None, None), (None, None))
        self.assertEqual(markets.quote(0, 1), (None, None))
        self.assertEqual(markets.quote(0, 0), (None, None))
        self.assertEqual(markets.quote('.34', '.36', '0', '10'), (None, .36))
        data = poly(); data['markets'][0]['acceptingOrders'] = False
        row = markets.parse_polymarket(data, OBSERVED)['contracts'][0]
        self.assertIsNone(row['bid']); self.assertIsNone(row['ask'])

    def test_invalid_numbers_and_crossed_quotes_fail_closed(self):
        for value in [True, 'NaN', 'Infinity', '-0.1', {}, [], '1e999']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                markets.number(value)
        for bid, ask in [('.9', '.8'), ('1.1', '.5'), ('.5', '-.1')]:
            with self.subTest(bid=bid), self.assertRaises(ValueError):
                markets.quote(bid, ask)

    def test_wrong_event_or_outcome_orientation_is_rejected(self):
        for mutate in [lambda d: d.update(slug='another-election'), lambda d: d['markets'][0].update(outcomes='["No", "Yes"]'), lambda d: d['markets'][0].update(question='Will it rain?')]:
            data=poly(); mutate(data)
            with self.assertRaises(ValueError): markets.parse_polymarket(data, OBSERVED)
        data=kalshi();data['event']['markets'][0]['notional_value_dollars']='10'
        with self.assertRaises(ValueError): markets.parse_kalshi(data, OBSERVED)
        data=kalshi();data['event']['event_ticker']='KXOTHER-27'
        with self.assertRaises(ValueError): markets.parse_kalshi(data, OBSERVED)

    def test_duplicate_contracts_are_not_counted_twice(self):
        data=poly();data['markets']*=2
        with self.assertRaises(ValueError): markets.validate_provider(markets.parse_polymarket(data, OBSERVED))

    def test_dates_are_preserved_and_future_or_naive_dates_rejected(self):
        self.assertEqual(markets.timestamp('2026-11-17T15:30:00+01:00', OBSERVED), '2026-11-17T15:30:00+01:00')
        for value in ['2026-11-17T15:00:01Z', '2026-11-17', '2026-11-17T15:00:00', '2026-02-30T12:00:00Z']:
            with self.subTest(value=value), self.assertRaises(ValueError): markets.timestamp(value, OBSERVED)

    def test_external_text_stays_plain_and_never_selects_a_destination(self):
        row=markets.parse_polymarket(poly(), OBSERVED)
        self.assertEqual(row['contracts'][0]['label'], '<img src=x onerror=alert(1)>')
        self.assertEqual(row['apiUrl'], markets.FEEDS['polymarket'])
        self.assertEqual(row['contracts'][0]['rules'], '')

    def test_failure_has_no_quotes_no_old_observation_and_no_exception_details(self):
        with patch.object(markets.transport, 'fetch_reliably', side_effect=OSError('secret internal endpoint')):
            row=markets.collect('kalshi')
        self.assertEqual(row['status'], 'unavailable')
        self.assertEqual(row['contracts'], [])
        self.assertIsNone(row['volume'])
        self.assertNotIn('secret', str(row))
        self.assertGreater(row['observedAt'], OBSERVED)


if __name__ == '__main__':
    unittest.main()
