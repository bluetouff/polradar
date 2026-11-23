import { corpus, el, anchor, svg, number, date, download } from './ui';
import {
  pollSeries,
  pollColor,
  pollScoreLabel,
  rankedPollResults,
  chartGeometry,
  csvValue,
} from '../lib/features.mjs';
import type { Poll } from '../lib/data';
const round = document.querySelector<HTMLSelectElement>('#poll-round')!,
  institute = document.querySelector<HTMLSelectElement>('#poll-institute')!,
  scenario = document.querySelector<HTMLSelectElement>('#poll-scenario')!,
  plot = document.querySelector<HTMLElement>('#poll-plot')!,
  legend = document.querySelector<HTMLElement>('#poll-legend')!,
  range = document.querySelector<HTMLInputElement>('#poll-wave')!,
  bars = document.querySelector<HTMLElement>('#poll-bars')!,
  method = document.querySelector<HTMLElement>('#poll-method')!,
  embedLink = document.querySelector<HTMLAnchorElement>('#poll-embed-link')!,
  status = document.querySelector<HTMLElement>('#poll-status')!;
const shortDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Europe/Paris',
  }).format(new Date(value + 'T12:00:00Z'));
async function start() {
  const data = await corpus(),
    groups = pollSeries(data.polls) as Poll[][];
  let rows = groups[0],
    active: string[] = [],
    index = rows.length - 1;
  function selectGroups(requested?: string) {
    const available = groups.filter(
      (group) =>
        group[0].round === round.value &&
        (!institute.value || group[0].institute === institute.value),
    );
    scenario.replaceChildren(
      ...available.map((group) => {
        const option = el(
          'option',
          `${group[0].institute} · ${group[0].scenario}`,
        );
        option.value = group[0].id;
        return option;
      }),
    );
    if (requested && available.some((group) => group[0].id === requested))
      scenario.value = requested;
    rows =
      available.find((group) => group[0].id === scenario.value) ||
      available[0] ||
      [];
    index = Math.max(0, rows.length - 1);
    active = [];
    range.max = String(Math.max(0, rows.length - 1));
    range.value = String(index);
    range.disabled = rows.length < 2;
    renderLegend();
    render();
  }
  function renderLegend() {
    legend.replaceChildren();
    if (!rows.length) return;
    for (const result of rows[0].results) {
      const label = el('label'),
        input = el('input');
      input.type = 'checkbox';
      input.value = result.id;
      input.checked = active.includes(result.id);
      label.append(
        input,
        el('span', undefined, `legend-color series-${pollColor(result.id)}`),
        el('span', result.name),
      );
      input.addEventListener('change', () => {
        active = input.checked
          ? [...active, result.id]
          : active.filter((id) => id !== result.id);
        renderPlot();
      });
      legend.append(label);
    }
  }
  function renderPlot() {
    plot.replaceChildren();
    if (!rows.length) {
      plot.append(el('p', 'Aucune enquête pour cette sélection.', 'notice'));
      return;
    }
    const geometry = chartGeometry(
        rows,
        active.length ? active : rows[0].results.map((item) => item.id),
        Math.max(240, plot.clientWidth),
      ),
      chart = svg('svg', {
        class: 'poll-chart',
        viewBox: `0 0 ${geometry.width} 320`,
        role: 'img',
        'aria-label':
          'Intentions de vote dans le scénario sélectionné, par date de fin de terrain',
      });
    chart.append(
      svg(
        'text',
        { x: String(geometry.left), y: '24', class: 'chart-unit' },
        '% des intentions exprimées',
      ),
    );
    for (const tick of geometry.ticks) {
      chart.append(
        svg('line', {
          class: 'chart-grid',
          x1: String(geometry.left),
          x2: String(geometry.right),
          y1: String(tick.y),
          y2: String(tick.y),
        }),
        svg(
          'text',
          {
            class: 'chart-tick',
            x: String(geometry.left - 12),
            y: String(tick.y + 4),
            'text-anchor': 'end',
          },
          number(tick.value),
        ),
      );
    }
    for (const tick of geometry.dates) {
      chart.append(
        svg('line', {
          class: 'chart-guide',
          x1: String(tick.x),
          x2: String(tick.x),
          y1: '48',
          y2: '258',
        }),
        svg(
          'text',
          {
            class: 'chart-tick chart-date',
            x: String(tick.x),
            y: '292',
            'text-anchor':
              rows.length === 1
                ? 'middle'
                : tick.index === 0
                  ? 'start'
                  : tick.index === rows.length - 1
                    ? 'end'
                    : 'middle',
          },
          shortDate(tick.date),
        ),
      );
    }
    for (const line of geometry.lines) {
      const group = svg('g', { class: `plot-series series-${line.color}` });
      group.append(svg('path', { class: 'plot-line', d: line.path }));
      for (const point of line.points) {
        const marker = svg('circle', {
          class: `plot-point${point.index === index ? ' selected' : ''}`,
          cx: String(point.x),
          cy: String(point.y),
          r: point.index === index ? '6' : '4.5',
          'data-candidate': line.id,
          'data-index': String(point.index),
          tabindex: '0',
          role: 'button',
          'aria-label': `${line.name}, ${number(point.value)} %, terrain achevé le ${date(point.date)}`,
        });
        marker.append(
          svg(
            'title',
            {},
            `${line.name} : ${number(point.value)} % · ${date(point.date)}`,
          ),
        );
        const activate = () => {
          index = point.index;
          range.value = String(index);
          const focused = document.activeElement === marker;
          render();
          if (focused)
            plot
              .querySelector<SVGElement>(
                `[data-candidate="${line.id}"][data-index="${point.index}"]`,
              )
              ?.focus();
          status.textContent = `${line.name} : ${number(point.value)} % · ${date(point.date)}`;
        };
        marker.addEventListener('click', activate);
        marker.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            activate();
          }
        });
        group.append(marker);
      }
      chart.append(group);
    }
    plot.append(chart);
  }
  function render() {
    renderPlot();
    bars.replaceChildren();
    method.replaceChildren();
    embedLink.hidden = !rows.length;
    if (!rows.length) {
      status.textContent = 'Aucun scénario correspondant.';
      return;
    }
    const poll = rows[index];
    embedLink.href = `/sondages/integrer/${poll.id}/`;
    document.querySelector('#poll-wave-total')!.textContent =
      `${rows.length} observation${rows.length > 1 ? 's' : ''}`;
    for (const selector of ['#poll-selected-date', '#poll-bar-date'])
      document.querySelector(selector)!.textContent = date(poll.fieldworkEnd);
    document.querySelector('#poll-first-date')!.textContent = date(
      rows[0].fieldworkEnd,
    );
    document.querySelector('#poll-last-date')!.textContent = date(
      rows.at(-1)!.fieldworkEnd,
    );
    range.setAttribute('aria-valuetext', date(poll.fieldworkEnd));
    for (const result of rankedPollResults(poll)) {
      const row = el('div', undefined, 'poll-bar-row');
      row.append(el('span', result.name), el('strong', pollScoreLabel(result)));
      bars.append(row);
      if (result.percentage === null) continue;
      const bar = svg('svg', { viewBox: '0 0 300 8', 'aria-hidden': 'true' });
      bar.append(
        svg('rect', {
          class: 'poll-bar-track',
          width: '300',
          height: '6',
          y: '1',
          rx: '3',
        }),
        svg('rect', {
          class: `poll-bar-fill series-${pollColor(result.id)}`,
          width: String((result.percentage / 100) * 300),
          height: '6',
          y: '1',
          rx: '3',
        }),
      );
      row.append(bar);
    }
    document.querySelector('#poll-no-intention')!.textContent =
      poll.noIntention === null
        ? 'Part sans intention exprimée : non renseignée.'
        : `Sans intention exprimée : ${number(poll.noIntention)} % ${poll.noIntentionNote || '(donnée distincte des pourcentages de candidats).'}`;
    const heading = el('div', undefined, 'register-heading'),
      source = data.sources.find((source) => source.id === poll.noticeSource)!,
      link = anchor(
        `Notice officielle, page ${poll.noticePage} ↗`,
        `${source.url}#page=${poll.noticePage}`,
      );
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    heading.append(el('h2', 'Enquête et méthode'), link);
    const dl = el('dl', undefined, 'poll-method-grid');
    const values = [
      ['Institut / commanditaire', `${poll.institute} / ${poll.commissioner}`],
      [
        'Terrain',
        `Du ${date(poll.fieldworkStart)} au ${date(poll.fieldworkEnd)}`,
      ],
      ['Date de publication', date(poll.published)],
      [
        'Échantillon global',
        `${number(poll.sampleSize)} personnes, dont ${number(poll.registeredSample)} inscrits`,
      ],
      [
        'Effectif utile exprimé',
        poll.usefulSample === null
          ? 'Non précisé pour cette question'
          : number(poll.usefulSample),
      ],
      ['Collecte et population', `${poll.method} ${poll.population}`],
    ];
    for (const [label, value] of values) {
      const row = el('div');
      row.append(el('dt', label), el('dd', value));
      dl.append(row);
    }
    method.append(
      heading,
      dl,
      el(
        'p',
        `${poll.uncertainty} Niveau de confiance indiqué : ${poll.margin.confidence} %.`,
      ),
    );
    if (poll.resultSource) {
      const resultSource = data.sources.find(
        (source) => source.id === poll.resultSource,
      )!;
      const resultLink = anchor(
        `Résultats de l’institut, page ${poll.resultPage} ↗`,
        `${resultSource.url}#page=${poll.resultPage}`,
      );
      resultLink.target = '_blank';
      resultLink.rel = 'noopener noreferrer';
      const paragraph = el('p');
      paragraph.append(resultLink);
      method.append(paragraph);
    }
    status.textContent = `${poll.institute} · ${poll.scenario} · ${date(poll.fieldworkEnd)}`;
    history.replaceState(null, '', `/sondages/#enquete=${poll.id}`);
  }
  document
    .querySelector('#poll-filters')!
    .addEventListener('submit', (event) => event.preventDefault());
  round.addEventListener('change', () => selectGroups());
  institute.addEventListener('change', () => selectGroups());
  scenario.addEventListener('change', () => selectGroups(scenario.value));
  range.addEventListener('input', () => {
    index = Number(range.value);
    render();
  });
  document.querySelector('#poll-export')!.addEventListener('click', () => {
    if (!rows.length) return;
    const poll = rows[index];
    const csv = [
      [
        'Institut',
        'Tour',
        'Scénario',
        'Terrain début',
        'Terrain fin',
        'Publication',
        'Candidat',
        'Pourcentage exprimé',
        'Notice',
        'Borne supérieure exclusive (%)',
      ],
      ...poll.results.map((result) => [
        poll.institute,
        poll.round,
        poll.scenario,
        poll.fieldworkStart,
        poll.fieldworkEnd,
        poll.published,
        result.name,
        result.percentage === null ? '' : String(result.percentage),
        data.sources.find((source) => source.id === poll.noticeSource)!.url,
        result.below === undefined ? '' : String(result.below),
      ]),
    ]
      .map((row) => row.map(csvValue).join(';'))
      .join('\r\n');
    download(
      '\uFEFF' + csv,
      'text/csv;charset=utf-8',
      `polradar-${poll.id}.csv`,
    );
  });
  const fragment = location.hash.slice(1);
  const requested =
      new URLSearchParams(fragment).get('enquete') ??
      document.getElementById(fragment)?.dataset.vague,
    poll = data.polls.find((poll) => poll.id === requested);
  if (poll) {
    round.value = poll.round;
    institute.value = poll.institute;
    const group = groups.find((group) =>
      group.some((row) => row.id === poll.id),
    )!;
    selectGroups(group[0].id);
    index = rows.findIndex((row) => row.id === poll.id);
    range.value = String(index);
    render();
  } else selectGroups();
  let lastWidth = plot.clientWidth;
  new ResizeObserver(() => {
    if (Math.abs(plot.clientWidth - lastWidth) > 1) {
      lastWidth = plot.clientWidth;
      renderPlot();
    }
  }).observe(plot);
}
start().catch(() => {
  status.textContent =
    'Les contrôles interactifs n’ont pas pu être chargés. Le graphique initial et les notices restent consultables.';
});
