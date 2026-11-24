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


def _ranked(raw, title, dimension, group, empty="Google n’a fourni aucune ligne pour cette période."):
    records = []
    if isinstance(raw, list):
        for row in raw[:MAX_ROWS]:
            key = _key_text(row.get("key")) if isinstance(row, dict) else ""
            if key:
                records.append((key, _metrics(row)))
    count = len(records)
    if count:
        # Preserve the order selected by the caller.
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
        contents = f'<p class="gsc-note">{escape(empty)}</p>'
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


def _keyed(raw):
    if not isinstance(raw, list):
        return {}
    records = {}
    for row in raw[:MAX_ROWS]:
        if not isinstance(row, dict) or not isinstance(row.get("key"), str):
            continue
        values = _metrics(row)
        if row["key"] and all(value is not None for value in values.values()) and values["clicks"] <= values["impressions"]:
            records[row["key"]] = values
    return records


def _small_table(title, headings, rows, empty):
    if not rows:
        return f'<p class="gsc-note">{escape(empty)}</p>'
    columns = "".join(f'<th scope="col">{escape(label)}</th>' for label in headings)
    body = []
    for row in rows:
        cells = "".join(
            f'<td><span class="gsc-cell-label" aria-hidden="true">{escape(label)}</span>{escape(str(value))}</td>'
            for label, value in zip(headings[1:], row[1:])
        )
        body.append(f'<tr><th scope="row"><bdi>{escape(_key_text(row[0]))}</bdi></th>{cells}</tr>')
    return (f'<table class="gsc-table"><caption class="gsc-sr">{escape(title)}</caption><thead><tr>{columns}</tr></thead>'
            '<tbody>' + "".join(body) + '</tbody></table>')


def _query_signals(queries):
    by_impressions = sorted(_keyed(queries).items(), key=lambda i: (-i[1]["impressions"], i[0]))
    ranked = [dict(values, key=key) for key, values in by_impressions if 4 <= values["position"] <= 20]
    low_ctr = [dict(values, key=key) for key, values in by_impressions if values["impressions"] >= 100 and values["ctr"] <= 0.02]
    question_words = ("qui ", "que ", "quel ", "quels ", "quelle ", "quelles ", "comment ", "quand ", "où ",
                      "combien ", "pourquoi ", "est-ce ", "qu’est-ce ", "qu'est-ce ")
    questions = [dict(values, key=key) for key, values in by_impressions
                 if values["impressions"] >= 20 and values["clicks"] == 0
                 and (key.strip().endswith("?") or key.strip().casefold().startswith(question_words))]
    return ('<section class="gsc-rankings"><h2>Requêtes à examiner</h2>'
            '<p class="gsc-note">Positions moyennes de 4 à 20 incluses. Le second tableau retient les requêtes ayant au moins '
            '100 impressions et un taux de clic inférieur ou égal à 2 % sur 28 jours. Les tableaux présentent jusqu’à 25 requêtes '
            'par impressions décroissantes parmi les lignes disponibles.</p><div class="gsc-rank-grid">'
            + _ranked(ranked[:25], "Positions 4 à 20", "Requête", "gsc-position", "Aucune requête de la sélection dans cette plage de positions.")
            + _ranked(low_ctr[:25], "Fortes impressions et faible taux de clic", "Requête", "gsc-ctr", "Aucune requête de la sélection ne remplit les deux seuils.")
            + '</div><h3>Questions sans clic</h3><p class="gsc-note">Questions repérées par leur formulation, avec au moins '
            '20 impressions et aucun clic. Ouvrir la page concernée pour vérifier si son contenu répond à la question.</p>'
            + _ranked(questions[:25], "Questions à relire", "Recherche", "gsc-questions",
                      "Aucune question ne remplit ces critères dans les lignes reçues.") + '</section>')


def _page_changes(snapshot, start, end):
    previous = snapshot.get("previous")
    unavailable = '<p class="gsc-note">Comparaison des pages indisponible pour ces deux périodes.</p>'
    if not isinstance(previous, dict) or not isinstance(previous.get("pages"), list):
        return unavailable
    before_start, before_end = _date(previous.get("startDate")), _date(previous.get("endDate"))
    if (before_start is None or before_end is None or (end-start).days != 27
            or (start-before_end).days != 1 or (before_end-before_start).days != 27):
        return unavailable
    current, before = _keyed(snapshot.get("pages")), _keyed(previous["pages"])
    changes = [(key, current[key]["clicks"]-before[key]["clicks"], before[key]["clicks"], current[key]["clicks"])
               for key in current.keys() & before.keys()]
    def table(direction, title):
        selected = sorted((r for r in changes if r[1]*direction > 0), key=lambda r: (-direction*r[1], r[0]))[:15]
        rows = [(key, _integer(old), _integer(new), ("+" if diff > 0 else "−") + _integer(abs(diff)))
                for key, diff, old, new in selected]
        return (f'<article class="chart-panel"><h3>{title}</h3>'
                + _small_table(title, ("Page", "Avant", "Après", "Écart"), rows,
                               "Aucune page commune aux deux relevés dans ce sens de variation.") + '</article>')
    return (f'<p class="gsc-note">Clics du {_date_label(before_start)} au {_date_label(before_end)}, '
            f'puis du {_date_label(start)} au {_date_label(end)}. Jusqu’à 15 pages par sens de variation. '
            'Seules les URL présentes dans les deux relevés sont comparées.</p><div class="gsc-rank-grid">'
            + table(1, "Pages en progression") + table(-1, "Pages en recul") + '</div>')


def _shared_queries(raw):
    if not isinstance(raw, list):
        return '<p class="gsc-note">Le relevé croisé des requêtes et pages est indisponible.</p>'
    by_query = {}
    for record in raw[:250]:
        if not isinstance(record, dict):
            continue
        query, page = record.get("query"), record.get("page")
        values = _metrics(record)
        if (isinstance(query, str) and query and isinstance(page, str) and page
                and values["impressions"] and values["clicks"] is not None):
            by_query.setdefault(query, {})[page] = values
    groups = sorted(((q, pages) for q, pages in by_query.items() if len(pages) >= 2),
                    key=lambda item: (-len(item[1]), item[0]))[:15]
    parts = []
    for query, pages in groups:
        ordered = sorted(pages.items(), key=lambda item: (-item[1]["impressions"], item[0]))
        entries = [(page, _integer(v["clicks"]), _integer(v["impressions"])) for page, v in ordered]
        parts.append(f'<details class="gsc-batch"><summary><bdi>{escape(_key_text(query))}</bdi> · {len(pages)} pages</summary>'
                     + _small_table("Pages affichées pour la même requête", ("Page", "Clics", "Impressions"), entries, "") + '</details>')
    return ('<p class="gsc-note">Jusqu’à 250 paires requête et page fournies par Google. Une requête présente sur plusieurs URL '
            'invite à vérifier la réponse de chaque page et les liens entre elles.</p>'
            + ("".join(parts) if parts else '<p class="gsc-note">Aucune requête associée à plusieurs pages dans ce relevé.</p>'))



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
                    f'<div class="gsc-rank-grid">{rankings}</div></section>'
                    + _query_signals(snapshot.get("queries"))
                    + '<section class="gsc-rankings"><h2>Évolution des pages sur deux périodes de 28 jours</h2>'
                    + _page_changes(snapshot, start, end) + '</section>'
                    + '<section class="chart-panel"><h2>Plusieurs pages pour une même recherche</h2>'
                    + _shared_queries(snapshot.get("queryPages")) + '</section>')
    html = ('''<!doctype html><html lang="fr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow,noarchive">
<meta name="referrer" content="no-referrer"><meta name="format-detection" content="telephone=no,email=no,address=no">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'">
<title>Recherche Google · Statistiques privées de Polradar</title><link rel="stylesheet" href="viewer.css"></head>
<body class="gsc-report"><header><a href="./" aria-label="Retour à l’audience de Polradar">polradar<span>.</span></a><p>Statistiques privées<br><small>Google Search Console</small></p></header>
<main><p class="kicker">AUDIENCE / RECHERCHE GOOGLE</p><h1>Polradar dans la recherche Google</h1>''' + contents +
            '''</main><footer class="gsc-footer"><a href="./">Audience du site</a><a href="https://search.google.com/search-console" rel="noreferrer">Google Search Console ↗</a></footer></body></html>''')
    return html.encode("utf-8")
