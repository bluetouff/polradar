import { publicData, el, svg, number, date, download } from './ui';
import {
  pollSeries,
  pollColor,
  pollNoticeLabel,
  pollScoreLabel,
  rankedPollResults,
  chartGeometry,
  csvValue,
} from '../lib/features.mjs';
import type { DocumentedPoll } from '../lib/data';
import { renderPollMethod } from './poll-method';
const round = document.querySelector<HTMLSelectElement>('#poll-round')!,
  institute = document.querySelector<HTMLSelectElement>('#poll-institute')!,
  scenario = document.querySelector<HTMLSelectElement>('#poll-scenario')!,
  trend = document.querySelector<HTMLElement>('#poll-trend')!,
  workspace = document.querySelector<HTMLElement>('.poll-workspace')!,
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
  const data = await publicData<{
      polls: DocumentedPoll[];
      sources: { id: string; url: string }[];
    }>('/data/enquetes.json'),
    groups = pollSeries(data.polls) as DocumentedPoll[][];
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
    if (rows.length < 2) return;
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
    if (rows.length < 2) return;
    const geometry = chartGeometry(
        rows,
        active.length ? active : rows[0].results.map((item) => item.id),
        Math.max(240, plot.clientWidth),
      ),
      chart = svg('svg', {
        class: 'poll-chart',
        viewBox: `0 0 ${geometry.width} 320`,
        role: 'group',
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
              tick.index === 0
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
      chart.append(group);
    }
    for (const wave of geometry.waves) {
      const label = `Afficher les résultats du ${date(wave.date)}`;
      const marker = svg('g', {
        class: `plot-wave${wave.index === index ? ' selected' : ''}`,
        'data-index': String(wave.index),
        tabindex: '0',
        role: 'button',
        'aria-label': label,
        'aria-pressed': String(wave.index === index),
      });
      const line = {
        x1: String(wave.x),
        x2: String(wave.x),
        y1: '48',
        y2: '258',
      };
      marker.append(
        svg('title', {}, label),
        svg('line', { ...line, class: 'plot-wave-target' }),
        svg('line', { ...line, class: 'plot-wave-guide' }),
      );
      const activate = () => {
        index = wave.index;
        range.value = String(index);
        const focused = document.activeElement === marker;
        render();
        if (focused)
          plot
            .querySelector<SVGElement>(`.plot-wave[data-index="${index}"]`)
            ?.focus();
      };
      marker.addEventListener('click', activate);
      marker.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          activate();
        }
      });
      chart.append(marker);
    }
    plot.append(chart);
  }
  function render() {
    const hasHistory = rows.length > 1;
    trend.hidden = !hasHistory;
    workspace.dataset.mode = hasHistory ? 'history' : 'snapshot';
    renderPlot();
    bars.replaceChildren();
    method.hidden = !rows.length;
    embedLink.hidden = !rows.length;
    const quickSource =
      document.querySelector<HTMLAnchorElement>('#poll-quick-source')!;
    quickSource.hidden = !rows.length;
    if (!rows.length) {
      for (const id of [
        'poll-selected-date',
        'poll-bar-date',
        'poll-first-date',
        'poll-last-date',
        'poll-wave-total',
        'poll-no-intention',
      ])
        document.getElementById(id)!.textContent = '';
      status.textContent = 'Aucun scénario correspondant.';
      return;
    }
    const poll = rows[index];
    embedLink.hidden = Boolean(poll.historicalImport);
    if (poll.historicalImport) embedLink.removeAttribute('href');
    else embedLink.href = `/sondages/integrer/${poll.id}/`;
    document.querySelector('#poll-wave-total')!.textContent =
      `${rows.length} observation${rows.length > 1 ? 's' : ''}`;
    document.querySelector('#poll-selected-date')!.textContent = date(
      poll.fieldworkEnd,
    );
    document
      .querySelector('#poll-bar-date')!
      .replaceChildren(
        `${poll.institute} · ${poll.scenario}`,
        el('br'),
        `Du ${date(poll.fieldworkStart)} au ${date(poll.fieldworkEnd)}`,
      );
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
      const bar = svg('svg', {
        viewBox: '0 0 300 8',
        preserveAspectRatio: 'none',
        'aria-hidden': 'true',
      });
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
    quickSource.href = renderPollMethod(method, poll, data.sources);
    quickSource.textContent = pollNoticeLabel(poll) + ' ↗';
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
    const question = poll.question;
    const publication = poll.firstPublication ?? {
      status: 'inconnue' as const,
    };
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
        'Source des résultats',
        'Borne supérieure exclusive (%)',
        'Enquête',
        'Question originale',
        'Base',
        'Source de la question',
        'Vérification du libellé',
        'Statut documentaire',
        'Première diffusion vérifiée',
        'Média de première diffusion',
        'Date de première diffusion',
        'Heure locale indiquée',
        'Source de la première diffusion',
        'Documents retrouvés (type, éditeur, date, heure de Paris, URL)',
      ],
      ...poll.results.map((result) => [
        poll.institute,
        poll.round,
        poll.scenario,
        poll.fieldworkStart,
        poll.fieldworkEnd,
        poll.published ?? '',
        result.name,
        result.percentage === null ? '' : String(result.percentage),
        data.sources.find(
          (source) => source.id === (poll.resultSource ?? poll.noticeSource),
        )!.url +
          '#page=' +
          (poll.resultPage ?? poll.noticePage),
        result.below === undefined ? '' : String(result.below),
        poll.surveyId ?? '',
        ...(question?.status === 'verifiee'
          ? [
              question.wording,
              question.base,
              data.sources.find((s) => s.id === question.sourceId)!.url +
                '#page=' +
                question.page,
              question.checked,
              'vérifiée',
            ]
          : ['', '', '', '', 'à relire']),
        ...(publication.status === 'verifiee'
          ? [
              'Oui',
              publication.media,
              publication.date,
              publication.localTime ?? '',
              publication.sourceUrl,
            ]
          : ['Non établie', '', '', '', '']),
        (poll.publicationDocuments ?? [])
          .map((doc) =>
            [doc.label, doc.publisher, doc.date, doc.localTime, doc.url]
              .filter(Boolean)
              .join(' · '),
          )
          .join(' | '),
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
  document.getElementById('poll-export-json')!.addEventListener('click', () => {
    const poll = rows[index];
    if (!poll) return;
    const ids = [
      poll.noticeSource,
      poll.resultSource,
      poll.question?.status === 'verifiee' ? poll.question.sourceId : undefined,
    ];
    const sources = data.sources.filter((s) => ids.includes(s.id));
    download(
      JSON.stringify({ scenario: poll, sources }, null, 2),
      'application/json',
      `polradar-${poll.id}.json`,
    );
  });
  function openFragment() {
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
    }
    return Boolean(poll);
  }
  if (!openFragment()) selectGroups();
  window.addEventListener('hashchange', () => {
    if (openFragment())
      document.getElementById('poll-results-heading')?.focus();
  });
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
