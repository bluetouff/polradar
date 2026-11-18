const number = new Intl.NumberFormat('fr-FR');
const make = (tag, text, className) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  if (className) el.className = className;
  return el;
};
let snapshot = null;
const feedback = document.querySelector('#feedback');
const report = document.querySelector('#report');
const validCount = (v) => Number.isSafeInteger(v) && v >= 0;
function validate(data) {
  if (
    data?.schemaVersion !== 1 ||
    !['waiting', 'ready'].includes(data.status) ||
    !Number.isFinite(Date.parse(data.generatedAt))
  )
    throw Error('Format du rapport invalide.');
  if (data.status === 'waiting') return data;
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
            !['hits', 'profiles', 'bytes'].every((k) => validCount(r[k])),
        )
      )
        throw Error('Détail GoAccess invalide.');
    }
    if (
      view.panels.visitors.reduce((sum, r) => sum + r.hits, 0) !== view.requests
    )
      throw Error('Total quotidien incohérent.');
  }
  return data;
}
function byteLabel(bytes) {
  if (bytes < 1000) return `${number.format(bytes)} octets`;
  const scale = bytes >= 1e9 ? 1e9 : bytes >= 1e6 ? 1e6 : 1e3;
  return `${number.format(Math.round((bytes / scale) * 100) / 100)} ${scale === 1e9 ? 'Go' : scale === 1e6 ? 'Mo' : 'ko'}`;
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
    `${data.firstDate ? `Du ${data.firstDate} au ${data.lastDate} · ` : ''}Généré le ${new Date(data.generatedAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris)`;
  report.hidden = data.status !== 'ready';
  if (report.hidden) return;
  const view = data[document.querySelector('#scope').value];
  const metrics = document.querySelector('#metrics');
  metrics.replaceChildren();
  for (const [label, value, note] of [
    [
      'Requêtes analysées',
      number.format(view.requests),
      'Ressources et erreurs incluses',
    ],
    [
      'Profils quotidiens cumulés',
      number.format(view.dailyProfiles),
      'Comptages GoAccess, pas des personnes',
    ],
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
  const daily = view.panels.visitors;
  if (!daily.length)
    chart.append(make('p', 'Aucune observation dans ce filtre.'));
  else {
    const max = Math.max(1, ...daily.map((r) => r.hits));
    const grid = make('div', undefined, 'daily-bars');
    daily.forEach((row) => {
      const bar = make('div', undefined, 'day');
      const meter = make('meter');
      meter.min = 0;
      meter.max = max;
      meter.value = row.hits;
      meter.setAttribute(
        'aria-label',
        `${row.label} : ${number.format(row.hits)} requêtes`,
      );
      bar.append(
        make('strong', number.format(row.hits)),
        meter,
        make('span', row.label),
      );
      grid.append(bar);
    });
    chart.append(grid);
  }
  const panels = document.querySelector('#panels');
  panels.replaceChildren();
  for (const [key, title] of [
    ['requests', 'Pages et chemins demandés'],
    ['referring_sites', 'Domaines référents'],
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
      const list = make('ol', undefined, 'ranked');
      const max = Math.max(1, ...rows.map((r) => r.hits));
      rows.forEach((row) => {
        const li = make('li');
        li.append(
          make('span', row.label),
          make('strong', number.format(row.hits)),
        );
        const meter = make('meter');
        meter.min = 0;
        meter.max = max;
        meter.value = row.hits;
        meter.setAttribute(
          'aria-label',
          `${row.label} : ${number.format(row.hits)} requêtes`,
        );
        li.append(meter);
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
  if (snapshot) render();
});
load();
