"""Render the private Search Console report without scripts or third-party resources."""

from datetime import date, datetime, timedelta, timezone
from html import escape
from math import isfinite
from unicodedata import category


MONTHS = (
    "", "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
)
METRICS = (
    ("clicks", "Clics", "Clics"),
    ("impressions", "Impressions", "Impressions"),
    ("ctr", "Taux de clic", "CTR"),
    ("position", "Position moyenne", "Position"),
)
EMPTY = '<span class="gsc-na"><span aria-hidden="true">n.d.</span><span class="gsc-sr">Non disponible</span></span>'
MAX_ROWS = 1000
GROUP_SIZE = 25
SPACE = "\u202f"


def _date(value):
    if not isinstance(value, str) or len(value) != 10:
        return None
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return None
    return parsed if parsed.isoformat() == value else None


def _date_label(value):
    day = "1er" if value.day == 1 else value.day
    return f"{day} {MONTHS[value.month]} {value.year}"


def _stamp(value):
    if isinstance(value, str) and len(value) <= 40:
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if not isinstance(value, datetime) or value.tzinfo is None:
        return None
    try:
        value = value.astimezone(timezone.utc)
    except (OverflowError, ValueError):
        return None
    return f'<time datetime="{value.isoformat()}">{_date_label(value)} à {value:%H}&#8239;h&#8239;{value:%M} UTC</time>'


def _key_text(raw):
    if not isinstance(raw, str):
        return ""
    # URL and query strings remain text, including any HTML-looking characters.
    # Prevent invisible controls and broken Unicode from changing the presentation.
    clean = "".join(" " if category(ch) in ("Cc", "Cf", "Cs") else ch for ch in raw[:2048]).strip()
    return clean + ("…" if len(raw) > 2048 else "")


def _number(raw):
    if type(raw) not in (int, float) or raw < 0 or raw > 2**53 - 1:
        return None
    return raw if isfinite(raw) else None


def _metrics(row):
    if not isinstance(row, dict):
        row = {}
    values = {key: _number(row.get(key)) for key, _, _ in METRICS}
    for name in ("clicks", "impressions"):
        value = values[name]
        values[name] = int(value) if value is not None and int(value) == value else None
    if values["ctr"] is not None and (values["ctr"] > 1 or values["impressions"] == 0):
        values["ctr"] = None
    if values["position"] is not None and (values["position"] < 1 or values["impressions"] == 0):
        values["position"] = None
    return values


def _integer(n):
    return f"{int(n):,}".replace(",", SPACE)


def _format(key, value):
    if value is None:
        return EMPTY
    if key in ("clicks", "impressions"):
        return _integer(value)
    if key == "ctr":
        pct = value * 100
        if 0 < pct < 0.01:
            return "&lt; 0,01" + SPACE + "%"
        return f"{pct:.2f}".rstrip("0").rstrip(".").replace(".", ",") + SPACE + "%"
    return f"{value:.2f}".removesuffix("0").replace(".", ",")


def _row(label, values):
    cells = "".join(
        f'<td><span class="gsc-cell-label" aria-hidden="true">{short}</span>{_format(key, values[key])}</td>'
        for key, _, short in METRICS
    )
    return f'<tr><th scope="row"><bdi>{escape(label)}</bdi></th>{cells}</tr>'


def _table(caption, dimension, body):
    labels = "".join(f'<th scope="col">{title}</th>' for _, title, _ in METRICS)
    return (f'<table class="gsc-table"><caption class="gsc-sr">{escape(caption)}</caption>'
            f'<thead><tr><th scope="col">{dimension}</th>{labels}</tr></thead><tbody>{body}</tbody></table>')


def _ranked(raw, title, dimension, group):
    records = []
    if isinstance(raw, list):
        for row in raw[:MAX_ROWS]:
            key = _key_text(row.get("key")) if isinstance(row, dict) else ""
            if key:
                records.append((key, _metrics(row)))
    count = len(records)
    if count:
        # The API supplies click order; keep its tie order.
        parts = []
        for offset in range(0, count, GROUP_SIZE):
            batch = records[offset:offset + GROUP_SIZE]
            rank = f"{_integer(offset + 1)} à {_integer(offset + len(batch))}" if len(batch) > 1 else _integer(offset + 1)
            prefix = "Rangs" if len(batch) > 1 else "Rang"
            body = "".join(_row(key, values) for key, values in batch)
            table = _table(f"{title}, rangs {rank}", dimension, body)
            opened = " open" if offset == 0 else ""
            parts.append(f'<details class="gsc-batch" name="{group}"{opened}><summary>{prefix} {rank}</summary>{table}</details>')
        contents = '<div class="gsc-groups">' + "".join(parts) + '</div>'
    else:
        contents = '<p class="gsc-note">Google n’a fourni aucune ligne pour cette période.</p>'
    label = "ligne" if count == 1 else "lignes"
    return (f'<details class="chart-panel gsc-ranking"><summary><strong>{title}</strong>'
            f'<span>{_integer(count)} {label}</span></summary>{contents}</details>')


def _series(rows, start, end):
    by_day = {}
    if isinstance(rows, list):
        for row in rows[:56]:
            day = _date(row.get("key")) if isinstance(row, dict) else None
            if day and start <= day <= end:
                # A duplicate is ambiguous. Treat that day as unavailable.
                by_day[day] = None if day in by_day else _metrics(row)
    return [(start + timedelta(days=i), by_day.get(start + timedelta(days=i)))
            for i in range((end - start).days + 1)]


def _plot(days, metric, title):
    values = [row[metric] if row is not None else None for _, row in days]
    known = [v for v in values if v is not None]
    if not known:
        return f'<figure class="gsc-plot"><figcaption>{title}</figcaption><p class="gsc-note">Série indisponible.</p></figure>'
    maximum = max(known)
    slot = 560 / len(values)
    bar = min(36, slot * 0.70)
    marks = []
    for i, value in enumerate(values):
        x = (i + 0.5) * slot
        if value is None:
            marks.append(f'<path class="gsc-gap" d="M{x:.2f} 96l3 3-3 3-3-3z"/>')
        elif value == 0:
            marks.append(f'<path class="gsc-flat" d="M{x-bar/2:.2f} 90h{bar:.2f}"/>')
        else:
            h = value / maximum * 84
            marks.append(f'<rect x="{x-bar/2:.2f}" y="{90-h:.2f}" width="{bar:.2f}" height="{h:.2f}"/>')
    scale = f'De 0 à {_integer(maximum)}' if maximum else 'Maximum 0'
    start, end = days[0][0], days[-1][0]
    return (f'<figure class="gsc-plot gsc-{metric}"><figcaption><strong>{title}</strong><span>{scale}</span></figcaption>'
            '<svg viewBox="0 0 560 104" preserveAspectRatio="none" aria-hidden="true" focusable="false">'
            '<path class="gsc-gridline" d="M0 6h560M0 48h560M0 90h560"/>' + "".join(marks) + '</svg>'
            f'<div class="gsc-range" aria-hidden="true"><span>{start:%d/%m}</span><span>{end:%d/%m}</span></div></figure>')


def _trend(days):
    graphs = _plot(days, "clicks", "Clics") + _plot(days, "impressions", "Impressions")
    missing = any(row is None or row["clicks"] is None or row["impressions"] is None for _, row in days)
    legend = ('<p class="gsc-gap-key"><span aria-hidden="true">◇</span> Jour sans donnée dans la série.</p>'
              if missing else "")
    rows = "".join(_row(_date_label(day), row or _metrics(None)) for day, row in reversed(days))
    daily = _table("Résultats par jour, du plus récent au plus ancien", "Jour", rows)
    return (f'<section class="chart-panel gsc-activity"><h2>Évolution quotidienne</h2><div class="gsc-plots">{graphs}</div>{legend}'
            f'<details class="gsc-history"><summary>Chiffres par jour</summary>{daily}</details></section>')


def render(snapshot, attempted_at, failed=False):
    """Return a complete private UTF-8 HTML page, including pending and stale states."""
    attempt = _stamp(attempted_at)
    start = _date(snapshot.get("startDate")) if isinstance(snapshot, dict) else None
    end = _date(snapshot.get("endDate")) if isinstance(snapshot, dict) else None
    fetched = _stamp(snapshot.get("fetchedAt")) if isinstance(snapshot, dict) else None
    valid = start is not None and end is not None and 0 <= (end - start).days < 28 and fetched is not None
    if not valid:
        contents = ('<p class="gsc-message">La collecte Google Search Console a échoué. Aucun relevé précédent disponible.</p>'
                    if failed or snapshot is not None else
                    '<p class="gsc-message">En attente du premier relevé Google Search Console.</p>')
        if attempt:
            contents += f'<p class="gsc-note">Dernière tentative le {attempt}.</p>'
    else:
        period = (f'<p class="gsc-period">Du <time datetime="{start.isoformat()}">{_date_label(start)}</time> au '
                  f'<time datetime="{end.isoformat()}">{_date_label(end)}</time> · heure du Pacifique.</p>')
        status = f'<p class="gsc-note">Relevé collecté le {fetched}.</p>'
        if failed:
            when = f' du {attempt}' if attempt else ''
            status = f'<p class="gsc-message">La collecte{when} a échoué. Dernière collecte réussie le {fetched}.</p>'
        totals = _metrics(snapshot.get("totals"))
        metrics = "".join(f'<article><span>{title}</span><strong>{_format(key, totals[key])}</strong></article>'
                          for key, title, _ in METRICS)
        trend = _trend(_series(snapshot.get("daily"), start, end))
        rankings = (_ranked(snapshot.get("queries"), "Requêtes", "Requête", "gsc-queries") +
                    _ranked(snapshot.get("pages"), "Pages", "Page", "gsc-pages"))
        contents = (f'{period}{status}<section class="metrics gsc-metrics" aria-label="Totaux sur la période">{metrics}</section>{trend}'
                    '<section class="gsc-rankings"><h2>Requêtes et pages dans les résultats Google</h2>'
                    '<p class="gsc-note">Jusqu’à 1&#8239;000 lignes par tableau, classées par clics. Google peut omettre des requêtes.</p>'
                    f'<div class="gsc-rank-grid">{rankings}</div></section>')
    html = ('''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer"><meta name="format-detection" content="telephone=no,email=no,address=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>Recherche Google · Statistiques privées de Polradar</title><link rel="stylesheet" href="viewer.css"></head>
<body class="gsc-report"><header><a href="./" aria-label="Retour à l’audience de Polradar">polradar<span>.</span></a><p>Statistiques privées<br><small>Google Search Console</small></p></header>
<main><p class="kicker">AUDIENCE / RECHERCHE GOOGLE</p><h1>Polradar dans la recherche Google</h1>''' + contents +
            '''</main><footer class="gsc-footer"><a href="./">Audience du site</a><a href="https://search.google.com/search-console" rel="noreferrer">Google Search Console ↗</a></footer></body></html>''')
    return html.encode("utf-8")
