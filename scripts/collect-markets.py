#!/usr/bin/env python3
"""Collect two fixed, public, read-only election feeds. Default output is a review artifact."""
import argparse
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
import importlib.util
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('source_transport', ROOT / 'scripts/watch-sources.py')
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)
FEEDS = {
    'polymarket': 'https://gamma-api.polymarket.com/events/slug/next-french-presidential-election',
    'kalshi': 'https://external-api.kalshi.com/trade-api/v2/events/KXFRENCHPRES-27?with_nested_markets=true',
}
HOSTS = {'gamma-api.polymarket.com', 'external-api.kalshi.com'}


def text(value, limit=10000):
    if not isinstance(value, str) or not value.strip() or len(value) > limit or '\x00' in value:
        raise ValueError('Invalid text')
    return value.strip()


def decimal(value, maximum=Decimal('1e18')):
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (str, int, float)):
        raise ValueError('Invalid number')
    try:
        number = Decimal(str(value))
    except InvalidOperation as exc:
        raise ValueError('Invalid number') from exc
    if not number.is_finite() or number < 0 or (maximum is not None and number > maximum):
        raise ValueError('Number outside bounds')
    return number


def number(value, maximum=Decimal('1e18')):
    result = decimal(value, maximum)
    return None if result is None else float(result)


def timestamp(value, observed):
    if value is None:
        return None
    if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?(?:Z|[+-]\d\d:\d\d)', value):
        raise ValueError('Invalid timestamp')
    parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if parsed > datetime.fromisoformat(observed.replace('Z', '+00:00')):
        raise ValueError('Future timestamp')
    return value


def identifier(value):
    value = text(value, 150)
    if not re.fullmatch(r'[A-Za-z0-9-]+', value):
        raise ValueError('Invalid identifier')
    return value


def quote(bid_value, ask_value, bid_size=None, ask_size=None):
    bid, ask = decimal(bid_value, 1), decimal(ask_value, 1)
    # A zero bid or an ask at the full payout is a boundary, not a two-sided quote.
    if bid in (None, Decimal(0), Decimal(1)) or (bid_size is not None and decimal(bid_size) == 0):
        bid = None
    if ask in (None, Decimal(0), Decimal(1)) or (ask_size is not None and decimal(ask_size) == 0):
        ask = None
    if bid is not None and ask is not None and bid > ask:
        raise ValueError('Crossed quote')
    return None if bid is None else float(bid), None if ask is None else float(ask)


def parse_polymarket(data, observed):
    if not isinstance(data, dict) or data.get('slug') != 'next-french-presidential-election':
        raise ValueError('Wrong event')
    if data.get('active') is not True or data.get('closed') is not False:
        raise ValueError('Event is not active')
    rows = data.get('markets')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 250:
        raise ValueError('Invalid contract list')
    result = []
    for item in rows:
        if not isinstance(item, dict):
            raise ValueError('Invalid contract')
        if item.get('closed') is True or item.get('archived') is True or item.get('active') is not True:
            continue
        outcomes = json.loads(item['outcomes']) if isinstance(item.get('outcomes'), str) else item.get('outcomes')
        if outcomes != ['Yes', 'No']:
            raise ValueError('Unexpected outcomes')
        bid, ask = quote(item.get('bestBid'), item.get('bestAsk'))
        if item.get('acceptingOrders') is not True:
            bid, ask = None, None
        question = text(item.get('question'), 500)
        if 'French presidential election' not in question:
            raise ValueError('Wrong contract question')
        result.append({
            'id': identifier(item.get('id')), 'label': text(item.get('groupItemTitle'), 200),
            'question': question, 'bid': bid, 'ask': ask,
            'lastPrice': number(item.get('lastTradePrice'), 1),
            'updatedAt': timestamp(item.get('updatedAt'), observed),
            'volume': number(item.get('volumeNum')), 'liquidity': number(item.get('liquidityNum')),
            'rules': '' if item.get('description') == data.get('description') else text(item.get('description')),
        })
    return {
        'id': 'polymarket', 'eventId': identifier(data.get('id')),
        'title': text(data.get('title'), 500),
        'url': 'https://polymarket.com/event/next-french-presidential-election',
        'apiUrl': FEEDS['polymarket'], 'observedAt': observed,
        'status': 'available', 'error': None, 'volumeUnit': 'dollars',
        'volume': number(data.get('volume')), 'rules': text(data.get('description')),
        'contracts': result,
    }


def parse_kalshi(data, observed):
    if not isinstance(data, dict) or not isinstance(data.get('event'), dict):
        raise ValueError('Missing event')
    event = data['event']
    if event.get('event_ticker') != 'KXFRENCHPRES-27' or event.get('series_ticker') != 'KXFRENCHPRES':
        raise ValueError('Wrong event')
    rows = event.get('markets') or data.get('markets')
    if not isinstance(rows, list) or not 1 <= len(rows) <= 250:
        raise ValueError('Invalid contract list')
    result = []
    for item in rows:
        if not isinstance(item, dict) or item.get('event_ticker') != 'KXFRENCHPRES-27' or item.get('market_type') != 'binary':
            raise ValueError('Wrong contract')
        if item.get('status') != 'active':
            continue
        if decimal(item.get('notional_value_dollars')) != Decimal(1):
            raise ValueError('Unexpected payout')
        bid, ask = quote(item.get('yes_bid_dollars'), item.get('yes_ask_dollars'), item.get('yes_bid_size_fp'), item.get('yes_ask_size_fp'))
        secondary = item.get('rules_secondary')
        if secondary is not None and not isinstance(secondary, str):
            raise ValueError('Invalid secondary rules')
        secondary = secondary.strip() if secondary else ''
        result.append({
            'id': identifier(item.get('ticker')), 'label': text(item.get('yes_sub_title'), 200),
            'question': text(item.get('title'), 500), 'bid': bid, 'ask': ask,
            'lastPrice': number(item.get('last_price_dollars'), 1),
            'updatedAt': timestamp(item.get('updated_time'), observed),
            'volume': number(item.get('volume_fp')), 'liquidity': None,
            'rules': text(item.get('rules_primary')) + ('\n' + text(secondary) if secondary else ''),
        })
    # Kalshi volumes count contracts; never sum them as dollars or mix them with Polymarket.
    volumes = [row['volume'] for row in result]
    return {
        'id': 'kalshi', 'eventId': 'KXFRENCHPRES-27', 'title': text(event.get('title'), 500),
        'url': FEEDS['kalshi'], 'apiUrl': FEEDS['kalshi'], 'observedAt': observed,
        'status': 'available', 'error': None, 'volumeUnit': 'contrats',
        'volume': sum(volumes) if volumes and all(v is not None for v in volumes) else None,
        'rules': 'Chaque contrat est réglé sur la victoire de la personnalité nommée à la prochaine élection présidentielle française. Les règles propres à chaque contrat sont reproduites ci-dessous.',
        'contracts': result,
    }


def validate_provider(provider):
    rows = provider['contracts']
    if not rows or len({row['id'] for row in rows}) != len(rows):
        raise ValueError('Missing or duplicate contracts')
    return provider


def collect(provider):
    try:
        status, kind, body = transport.fetch_reliably(FEEDS[provider], HOSTS)
        observed = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
        if status != 200 or kind != 'application/json':
            raise ValueError('Unavailable JSON feed')
        data = json.loads(body)
        parser = parse_polymarket if provider == 'polymarket' else parse_kalshi
        return validate_provider(parser(data, observed))
    except (OSError, ValueError, KeyError, TypeError, OverflowError):
        # Do not promote an old quote to a fresh observation or expose exception details.
        return {
            'id': provider, 'eventId': 'next-french-presidential-election' if provider == 'polymarket' else 'KXFRENCHPRES-27',
            'title': 'Prochaine élection présidentielle française', 'url': FEEDS[provider], 'apiUrl': FEEDS[provider],
            'observedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
            'status': 'unavailable', 'error': 'source-unavailable-or-invalid',
            'volumeUnit': 'dollars' if provider == 'polymarket' else 'contrats',
            'volume': None, 'rules': 'Flux indisponible ou réponse invalide lors de ce relevé.', 'contracts': [],
        }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish-snapshot', action='store_true', help='Write the reviewed-site input instead of a review artifact; never pushes Git.')
    args = parser.parse_args()
    data = {'version': 1, 'providers': [collect(provider) for provider in FEEDS]}
    target = ROOT / ('src/data/prediction-markets.json' if args.publish_snapshot else 'artifacts/markets-review.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix('.tmp')
    temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(target)
    for row in data['providers']:
        print(f"{row['id']}: {row['status']}, {len(row['contracts'])} contracts, {row['observedAt']}")
    return 0 if all(row['status'] == 'available' for row in data['providers']) else 1


if __name__ == '__main__':
    raise SystemExit(main())
