import type { Graphic } from './chart-publication';
import { editionId } from './chart-publication';
import {
  candidates,
  candidateById,
  dataset,
  formatDate,
  formatTimestamp,
  meta,
  polls,
  sourceById,
  sources,
} from './data';
import { economy } from './economy-data';
import { economyGraphic } from './economy-graphic.mjs';
import { pollGraphic, pollGraphicCatalog } from './poll-graphic.mjs';
import { payrolls, salaryGraphic, salaryImage } from './csg-paie.mjs';
import comparison from '../data/retirement-comparison.json';
import {
  cardSize,
  liveGraphicPath,
  retirementCard,
} from './retirement-embed.mjs';
import { retirementComparison } from './retirement-comparison.mjs';
import { legislativeVotes } from './votes-data';
import { chambers } from './legislative-votes.mjs';
import { studioCard } from './studio-card';
import { airtime, budgetAssessments } from './visual-data';
import { formatDuration } from './airtime-view.mjs';
import { formatBudgetAmount } from './campaign-visuals-view.mjs';
import { evolution } from './proposal-data';
import { evidenceDate, stateValue, stateUnit } from './proposal-view.mjs';
import { predictionMarkets } from './market-data';
import { marketPercent } from './markets.mjs';
import { labelPeriod } from './economy.mjs';

export const studioFamilies = {
  economie: 'Indicateurs économiques',
  sondages: 'Sondages',
  retraites: 'Retraites',
  fiscalite: 'Fiscalité',
  scrutins: 'Votes parlementaires',
  budgets: 'Budgets annoncés',
  evolution: 'Évolution des propositions',
  arcom: 'Temps de parole',
  marches: 'Marchés prédictifs',
};
type Family = keyof typeof studioFamilies;
type Cell = string | number | null;
interface Item {
  id: string;
  family: Family;
  label: string;
  graphic: Graphic;
  live: string;
  columns: string[];
  rows: Cell[][];
  generated?: boolean;
}
const items: Item[] = [];
function publish(
  family: Family,
  key: string,
  label: string,
  graphic: Graphic,
  columns: string[],
  rows: Cell[][],
  live?: string,
) {
  const id = family + '-' + key;
  if (!/^[a-z0-9][a-z0-9-]+$/.test(id) || items.some((i) => i.id === id))
    throw new Error('Identifiant Studio invalide : ' + id);
  items.push({
    id,
    family,
    label,
    graphic,
    columns,
    rows,
    live: live ?? '/graphiques/studio/' + id + '.svg',
    generated: !live,
  });
}

for (const series of economy) {
  publish(
    'economie',
    series.id,
    series.title,
    economyGraphic(economy, series.id),
    ['Période', 'Valeur', 'Unité', 'Drapeau Eurostat', 'Source'],
    series.observations.map(([period, value, flag]) => [
      period,
      value,
      series.unit,
      flag ?? null,
      series.links.table,
    ]),
    '/graphiques/economie/' + series.id + '.svg',
  );
}
for (const series of pollGraphicCatalog(polls)) {
  for (const wave of series.waves) {
    const graphic = pollGraphic(wave, sources);
    publish(
      'sondages',
      wave.id,
      wave.institute +
        ' · ' +
        formatDate(wave.published) +
        ' · ' +
        wave.scenario,
      graphic,
      [
        'Candidat testé',
        'Intentions exprimées (%)',
        'Hypothèse',
        'Début du terrain',
        'Fin du terrain',
        'Publication',
        'Notice',
      ],
      wave.results.map((r: (typeof wave.results)[number]) => [
        r.name,
        r.percentage,
        wave.scenario,
        wave.fieldworkStart,
        wave.fieldworkEnd,
        wave.published,
        sourceById(wave.noticeSource).url,
      ]),
      '/graphiques/sondages/' + series.id + '.svg',
    );
  }
}
for (const cohort of comparison.cohorts) {
  const card = retirementCard(comparison, cohort, dataset);
  const { panels, programmes } = retirementComparison(
    comparison,
    cohort,
    dataset,
  );
  const references = [
    ...comparison.legalSources,
    ...programmes.map((p) => ({
      label: p.name + ' · document comparé',
      url: p.source.url,
    })),
  ];
  publish(
    'retraites',
    cohort.id,
    'Naissance · ' + cohort.label,
    {
      ...cardSize,
      svg: card.svg,
      title: 'Retraites · ' + cohort.label,
      alt: card.summary,
      dateLabel: card.date,
      page: card.page,
      sources: references,
    },
    [
      'Génération',
      'Paramètre',
      'Règle ou programme',
      'Valeur documentée',
      'Vérification',
    ],
    panels.flatMap((panel) =>
      panel.rows.map((r) => [
        cohort.label,
        panel.label,
        r.name,
        r.text,
        comparison.reviewedOn,
      ]),
    ),
    liveGraphicPath(cohort.id),
  );
}
const salary = salaryGraphic();
publish(
  'fiscalite',
  'csg',
  'CSG sur trois salaires bruts',
  salary,
  [
    'Salaire brut mensuel (€)',
    'Assiette (€)',
    'Part déductible (€)',
    'Part non déductible (€)',
    'Total CSG (€)',
    'Source',
  ],
  payrolls.map((p) => [
    p.gross / 100,
    p.base / 100,
    p.deducted / 100,
    p.other / 100,
    p.total / 100,
    salary.sources[0].url,
  ]),
  salaryImage,
);

for (const b of legislativeVotes.ballots) {
  const choices = [
    { name: 'Pour', value: b.tally.for },
    { name: 'Contre', value: b.tally.against },
    { name: 'Abstentions', value: b.tally.abstained },
  ];
  const desk = chambers[b.chamber];
  const date = formatDate(b.date);
  const lines = choices.map((c) => ({
    ...c,
    reading:
      c.value === null
        ? 'Non publié'
        : c.value.toLocaleString('fr-FR') + ' voix',
  }));
  const references = [{ label: b.source.title, url: b.source.url }];
  const note =
    b.kind === 'motion-censure'
      ? 'Seules les voix en faveur de la censure sont décomptées.'
      : 'La longueur représente le nombre de voix sur une échelle commune de 0 à ' +
        b.tally.voters +
        ' votants.';
  publish(
    'scrutins',
    b.id,
    date + ' · ' + desk + ' · ' + b.shortTitle,
    studioCard({
      title: b.shortTitle,
      desk,
      date,
      lines,
      scale: b.tally.voters,
      note,
      sources: references,
      page: '/votes/',
    }),
    [
      'Date',
      'Institution',
      'Objet du scrutin',
      'Position',
      'Voix',
      'Votants',
      'Source',
    ],
    choices.map((c) => [
      b.date,
      desk,
      b.title,
      c.name,
      c.value,
      b.tally.voters,
      b.source.url,
    ]),
  );
}
for (const budget of budgetAssessments) {
  const source = sourceById(budget.source);
  const author = budget.estimator ?? 'Auteur du chiffrage non renseigné';
  const scope =
    budget.scope === 'parti' ? 'Programme de parti' : 'Document de campagne';
  const date = budget.reviewedOn
    ? 'Vérifié le ' + formatDate(budget.reviewedOn)
    : 'Document consulté le ' + formatDate(source.checked);
  const kind = {
    depense: 'Dépense proposée',
    economie: 'Économie annoncée',
    recette: 'Recette annoncée',
    'baisse-recette': 'Baisse de recettes annoncée',
    financement: 'Financement proposé',
    trajectoire: 'Trajectoire annoncée',
  }[budget.kind];
  const lines = [
    { name: kind, reading: formatBudgetAmount(budget) },
    { name: 'Horizon annoncé', reading: budget.horizon },
  ];
  publish(
    'budgets',
    budget.id,
    'Dossier ' + candidateById(budget.dossier).name + ' · ' + budget.label,
    studioCard({
      title: budget.label,
      desk: scope + ' · ' + author,
      date,
      lines,
      note: budget.publicScope ?? budget.locator,
      sources: [{ label: source.title, url: source.url }],
      page: '/budget-programmes/#' + budget.id,
    }),
    [
      'Auteur du chiffrage',
      'Attribution',
      'Objet',
      'Nature',
      'Montant (€)',
      'Borne supérieure (€)',
      'Montant approximatif',
      'Horizon',
      'Source',
    ],
    [
      [
        author,
        scope,
        budget.label,
        kind,
        budget.euros,
        budget.eurosMax ?? null,
        budget.approximate ? 'Oui' : 'Non',
        budget.horizon,
        source.url,
      ],
    ],
  );
}
for (const track of evolution.tracks) {
  const states = track.stateIds.map((id) =>
    evolution.states.find((s) => s.id === id)!,
  );
  const name = candidateById(track.candidate).name;
  const lines = states.map((s) => ({
    name: evidenceDate(s) + ' · ' + s.edition,
    reading: s.statement,
  }));
  const references = states.map((s) => ({
    label: s.source.title,
    url: s.source.url,
  }));
  publish(
    'evolution',
    track.id,
    name + ' · ' + track.title,
    studioCard({
      title: track.title,
      desk: 'Dossier · ' + name,
      date: 'Vérifié le ' + formatDate(evolution.checked),
      lines,
      note: track.note,
      sources: references,
      page: '/evolution/#dossier=' + track.id,
    }),
    [
      'Date du document',
      'Nature de la date',
      'Édition',
      'Proposition',
      'Valeur documentée',
      'Unité ou périmètre',
      'Source',
    ],
    states.map((s) => [
      s.date.value,
      s.date.kind,
      s.edition,
      s.statement,
      stateValue(s),
      stateUnit(s),
      s.source.url,
    ]),
  );
}
for (const month of airtime.months) {
  const date = labelPeriod(month.month);
  for (const c of candidates) {
    const entries = month.services.map((s) => ({
      service: s,
      observation: s.observations.find((o) => o.candidate === c.id),
    }));
    const published = entries.filter(
      (r) => typeof r.observation?.seconds === 'number',
    );
    if (!published.length) continue;
    const lines = published.map(({ service, observation }) => ({
      name: service.name,
      reading: formatDuration(observation!.seconds),
      value: observation!.seconds,
    }));
    const unit =
      'Durées publiées par service. Les cellules absentes du relevé ne sont pas comptées. Certaines durées sont partielles.';
    publish(
      'arcom',
      month.month + '-' + c.id,
      c.name + ' · ' + date,
      studioCard({
        title: c.name,
        desk: 'Temps de parole · Arcom',
        date,
        lines,
        scale: Math.max(...published.map((r) => r.observation!.seconds!)),
        note: unit,
        sources: [{ label: 'Arcom · relevé mensuel', url: month.sourceUrl }],
        page: '/temps-de-parole/',
      }),
      [
        'Mois',
        'Média',
        'Personnalité',
        'Secondes publiées',
        'Cellules renseignées',
        'Source',
      ],
      entries.map(({ service, observation }) => [
        month.month,
        service.name,
        c.name,
        observation?.seconds ?? null,
        observation?.publishedCells ?? 0,
        month.sourceUrl,
      ]),
    );
  }
}
for (const provider of predictionMarkets.providers) {
  const desk = provider.id === 'polymarket' ? 'Polymarket' : 'Kalshi';
  for (const contract of provider.contracts) {
    const lines = [
      { name: 'Meilleur achat', value: contract.bid },
      { name: 'Meilleure vente', value: contract.ask },
      { name: 'Dernière transaction', value: contract.lastPrice },
    ].map((c) => ({ ...c, reading: marketPercent(c.value) }));
    const note =
      'Prix du contrat « oui », exprimés en pourcentage de sa valeur de règlement. Cotations et conditions de résolution propres à ' +
      desk +
      '.';
    publish(
      'marches',
      provider.id + '-' + contract.id.toLowerCase(),
      desk + ' · ' + contract.label,
      studioCard({
        title: contract.label,
        desk: 'Marché prédictif · ' + desk,
        date: formatTimestamp(provider.observedAt),
        lines,
        scale: 1,
        note,
        sources: [
          { label: desk + ' · événement et conditions', url: provider.url },
        ],
        page: '/marches-predictifs/',
      }),
      [
        'Opérateur',
        'Contrat',
        'Question exacte',
        'Prix (fraction de la valeur de règlement)',
        'Type de prix',
        'Relevé UTC',
        'Dernière modification du contrat',
        'Règle de résolution',
        'Source',
      ],
      lines.map((l) => [
        desk,
        contract.id,
        contract.question,
        l.value,
        l.name,
        provider.observedAt,
        contract.updatedAt,
        contract.rules || provider.rules,
        provider.url,
      ]),
    );
  }
}
export const studioItems = items;
export function studioPublication(item: Item) {
  return {
    ...item,
    edition: editionId(item.graphic),
    pageUrl: new URL(item.graphic.page, meta.site).href,
    liveUrl: new URL(item.live, meta.site).href,
  };
}
