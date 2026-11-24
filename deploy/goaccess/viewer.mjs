const number = new Intl.NumberFormat('fr-FR');
const dateLabel = (value) =>
  new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(`${value}T12:00:00Z`));
const make = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
let snapshot = null;
let referralLimit = 20;
const feedback = document.querySelector('#feedback');
const report = document.querySelector('#report');
const validCount = (v) => Number.isSafeInteger(v) && v >= 0;
const validDate = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(`${v}T12:00:00Z`)) &&
  new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
function validate(data) {
  if (
    data?.schemaVersion !== 1 ||
    !['waiting', 'ready'].includes(data.status) ||
    !Number.isFinite(Date.parse(data.generatedAt))
  )
    throw Error('Format du rapport invalide.');
  if (data.status === 'waiting') return data;
  if (
    !validDate(data.firstDate) ||
    !validDate(data.lastDate) ||
    data.firstDate > data.lastDate
  )
    throw Error('Période GoAccess invalide.');
  for (const view of [data.all, data.withoutKnownBots]) {
    if (
      !view ||
      !['requests', 'dailyProfiles', 'bytes'].every((k) => validCount(view[k]))
    )
      throw Error('Indicateurs GoAccess invalides.');
    for (const panel of [
      'visitors',
      'requests',
      'not_found',
      'visit_time',
      'referring_sites',
      'browsers',
      'status_codes',
    ]) {
      const rows = view.panels?.[panel];
      if (
        !Array.isArray(rows) ||
        rows.length > 10000 ||
        rows.some(
          (r) =>
            typeof r.label !== 'string' ||
            r.label.length > 500 ||
            !['hits', 'profiles', 'bytes'].every((k) => validCount(r[k])) ||
            r.profiles > r.hits,
        )
      )
        throw Error('Détail GoAccess invalide.');
    }
    const daily = view.panels.visitors;
    if (
      new Set(daily.map((r) => r.label)).size !== daily.length ||
      daily.some(
        (r) =>
          !validDate(r.label) ||
          r.label < data.firstDate ||
          r.label > data.lastDate,
      )
    )
      throw Error('Dates quotidiennes incohérentes.');
    if (
      daily.reduce((sum, r) => sum + r.hits, 0) !== view.requests ||
      daily.reduce((sum, r) => sum + r.profiles, 0) !== view.dailyProfiles ||
      daily.reduce((sum, r) => sum + r.bytes, 0) !== view.bytes
    )
      throw Error('Total quotidien incohérent.');
  }
  if (
    data.withoutKnownBots.requests > data.all.requests ||
    data.withoutKnownBots.dailyProfiles > data.all.dailyProfiles
  )
    throw Error('Filtre robots incohérent.');
  return data;
}
function byteLabel(bytes) {
  if (bytes < 1000) return `${number.format(bytes)} octets`;
  const scale = bytes >= 1e9 ? 1e9 : bytes >= 1e6 ? 1e6 : 1e3;
  return `${number.format(Math.round((bytes / scale) * 100) / 100)} ${scale === 1e9 ? 'Go' : scale === 1e6 ? 'Mo' : 'ko'}`;
}
const isDomain = (label) =>
  label.length <= 253 &&
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(label);
const isInternal = (label) =>
  ['polradar.fr', 'www.polradar.fr'].includes(label.toLowerCase());
function meter(value, max, label) {
  const el = make('meter');
  el.min = 0;
  el.max = Math.max(1, max);
  el.value = value;
  el.setAttribute('aria-label', label);
  return el;
}
function referralTable(rows) {
  const table = make('table', undefined, 'referral-table');
  const head = make('thead'),
    line = make('tr');
  for (const label of ['Site', 'Requêtes', 'Uniques']) {
    const th = make('th', label);
    th.scope = 'col';
    line.append(th);
  }
  head.append(line);
  table.append(head);
  const body = make('tbody'),
    max = Math.max(1, ...rows.map((r) => r.hits));
  for (const row of rows) {
    const line = make('tr'),
      site = make('th');
    site.scope = 'row';
    site.append(
      make('span', row.label),
      meter(
        row.hits,
        max,
        `${row.label} : ${number.format(row.hits)} requêtes`,
      ),
    );
    line.append(
      site,
      make('td', number.format(row.hits)),
      make('td', number.format(row.profiles)),
    );
    body.append(line);
  }
  table.append(body);
  return table;
}
function renderReferrals(view) {
  const external = view.panels.referring_sites
    .filter((r) => isDomain(r.label) && !isInternal(r.label))
    .sort((a, b) => b.hits - a.hits || a.label.localeCompare(b.label));
  const other = view.panels.referring_sites
    .filter((r) => !isDomain(r.label) || isInternal(r.label))
    .sort((a, b) => b.hits - a.hits);
  const distinct = new Set(external.map((r) => r.label.toLowerCase())).size;
  const summary = document.querySelector('#referral-summary');
  summary.textContent = `${number.format(distinct)} ${distinct === 1 ? 'domaine externe recensé' : 'domaines externes recensés'} · uniques journaliers par site, sans les additionner entre sites.`;
  const target = document.querySelector('#referral-table');
  target.replaceChildren();
  if (external.length)
    target.append(referralTable(external.slice(0, referralLimit)));
  else target.append(make('p', 'Aucun site externe recensé dans ce filtre.'));
  const more = document.querySelector('#referral-more');
  more.hidden = external.length <= referralLimit;
  more.textContent = `Voir les ${number.format(Math.min(20, Math.max(0, external.length - referralLimit)))} lignes suivantes`;
  const internal = document.querySelector('#referral-other');
  internal.replaceChildren();
  if (other.length) {
    const details = make('details');
    details.append(
      make('summary', 'Navigation interne et référents non retenus'),
      referralTable(other),
    );
    internal.append(details);
  }
  return distinct;
}
function render() {
  const data = snapshot;
  const stale = Date.now() - Date.parse(data.generatedAt) > 35 * 60000;
  feedback.textContent = stale
    ? 'Ce rapport a plus de 35 minutes. Vérifier le service de génération avant de conclure sur le trafic récent.'
    : data.status === 'waiting'
      ? 'Collecte active : aucune requête analysable dans le journal dédié pour le moment.'
      : '';
  document.querySelector('#coverage').textContent =
    `${data.firstDate ? `Du ${dateLabel(data.firstDate)} au ${dateLabel(data.lastDate)} · ` : ''}Généré le ${new Date(data.generatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris)`;
  report.hidden = data.status !== 'ready';
  if (report.hidden) return;
  const view = data[document.querySelector('#scope').value];
  const sites = renderReferrals(view);
  const metrics = document.querySelector('#metrics');
  metrics.replaceChildren();
  for (const [label, value, note] of [
    [
      'Visiteurs uniques',
      number.format(view.dailyProfiles),
      data.firstDate === data.lastDate
        ? `Uniques GoAccess du ${dateLabel(data.firstDate)}`
        : 'Cumul des uniques journaliers sur la période',
    ],
    [
      'Requêtes analysées',
      number.format(view.requests),
      'Ressources et erreurs incluses',
    ],
    ['Sites référents', number.format(sites), 'Domaines externes recensés'],
    [
      'Données transférées',
      byteLabel(view.bytes),
      'Octets consignés dans les journaux',
    ],
  ]) {
    const card = make('article');
    card.append(
      make('span', label),
      make('strong', value),
      make('small', note),
    );
    metrics.append(card);
  }
  const chart = document.querySelector('#daily-chart');
  chart.replaceChildren();
  const daily = [...view.panels.visitors].sort((a, b) =>
    a.label.localeCompare(b.label),
  );
  const metric = document.querySelector('#daily-metric').value;
  const unit = metric === 'profiles' ? 'visiteurs uniques' : 'requêtes';
  document.querySelector('#daily-title').textContent =
    metric === 'profiles' ? 'Visiteurs uniques par jour' : 'Requêtes par jour';
  if (!daily.length)
    chart.append(make('p', 'Aucune observation dans ce filtre.'));
  else {
    const max = Math.max(1, ...daily.map((r) => r[metric]));
    const grid = make('div', undefined, 'daily-bars');
    daily.forEach((row) => {
      const bar = make('div', undefined, 'day');
      bar.append(
        make('strong', number.format(row[metric])),
        meter(
          row[metric],
          max,
          `${dateLabel(row.label)} : ${number.format(row[metric])} ${unit}`,
        ),
        make('span', dateLabel(row.label)),
      );
      grid.append(bar);
    });
    chart.append(grid);
  }
  const panels = document.querySelector('#panels');
  panels.replaceChildren();
  for (const [key, title] of [
    ['requests', 'Pages et chemins demandés'],
    ['visit_time', 'Heures observées'],
    ['browsers', 'Navigateurs et robots'],
    ['status_codes', 'Codes HTTP'],
    ['not_found', 'Chemins en erreur 404'],
  ]) {
    const section = make('section', undefined, 'chart-panel');
    section.append(make('h2', title));
    const rows = [...view.panels[key]]
      .sort((a, b) =>
        key === 'visit_time' ? a.label.localeCompare(b.label) : b.hits - a.hits,
      )
      .slice(0, 30);
    if (!rows.length)
      section.append(make('p', 'Aucune observation dans ce filtre.'));
    else {
      const list = make('ol', undefined, 'ranked'),
        max = Math.max(1, ...rows.map((r) => r.hits));
      rows.forEach((row) => {
        const li = make('li');
        li.append(
          make('span', row.label),
          make('strong', number.format(row.hits)),
          meter(
            row.hits,
            max,
            `${row.label} : ${number.format(row.hits)} requêtes`,
          ),
        );
        list.append(li);
      });
      section.append(list);
    }
    panels.append(section);
  }
}
async function load() {
  const button = document.querySelector('#refresh');
  button.disabled = true;
  try {
    const response = await fetch('report.json', {
      cache: 'no-store',
      credentials: 'same-origin',
      redirect: 'error',
    });
    if (!response.ok)
      throw Error(
        'Rapport indisponible. Vérifier la génération GoAccess et l’accès privé.',
      );
    const text = await response.text();
    if (text.length > 20 * 1024 * 1024) throw Error('Rapport trop volumineux.');
    snapshot = validate(JSON.parse(text));
    referralLimit = 20;
    render();
  } catch (error) {
    feedback.textContent =
      error instanceof Error ? error.message : 'Rapport indisponible.';
    report.hidden = true;
  } finally {
    button.disabled = false;
  }
}
document.querySelector('#refresh').addEventListener('click', load);
document.querySelector('#scope').addEventListener('change', () => {
  if (snapshot) {
    referralLimit = 20;
    render();
  }
});
document.querySelector('#daily-metric').addEventListener('change', () => {
  if (snapshot) render();
});
document.querySelector('#referral-more').addEventListener('click', () => {
  referralLimit += 20;
  if (snapshot) render();
});
// A GoAccess-only installation has no Search Console report.
const googleReport = document.getElementById('google-report');
if (googleReport) {
  fetch('google.html', {
    method: 'HEAD',
    cache: 'no-store',
    credentials: 'same-origin',
    redirect: 'error',
  })
    .then((response) => {
      if (
        response.ok &&
        response.headers.get('Content-Type')?.startsWith('text/html')
      )
        googleReport.hidden = false;
    })
    .catch(() => {});
}
load();
