import { createHash } from 'node:crypto';
import { readFile, lstat, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'astro/zod';
import {
  civilDateInParis,
  dateSchema,
  idSchema,
  publicUrlSchema,
  validateDataset,
  validateFeatures,
} from '../src/lib/schema.mjs';
import {
  editorialLead,
  editorialReviewSchema,
  editorialSections,
} from '../src/lib/editorial-reviews.mjs';
import {
  agendaSchema,
  validateVisualReferences,
} from '../src/lib/campaign-visuals.mjs';

const data = new URL('../src/data/', import.meta.url);
const catalog = JSON.parse(
  await readFile(new URL('./editorial-origins.json', import.meta.url), 'utf8'),
);
const text = (n) =>
  z
    .string()
    .max(n)
    .regex(/^[^<>\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]*$/u);
const published = z.strictObject({
  url: publicUrlSchema,
  title: text(220).min(2),
  date: dateSchema,
  candidates: z.array(idSchema).max(40),
  event: z
    .strictObject({
      start: z.union([dateSchema, z.iso.datetime({ offset: true })]),
      status: z.enum(['EventScheduled', 'EventCancelled', 'EventRescheduled']),
      performer: text(100).min(2),
      city: text(100),
      venue: text(180),
    })
    .nullable(),
});
const input = z.strictObject({
  scope: z.enum(['annonces', 'complete']).optional(),
  checkedAt: z.iso.datetime({ offset: true }),
  since: dateSchema,
  queries: z
    .array(
      z.strictObject({
        id: idSchema,
        count: z.number().int().min(0).max(150).nullable(),
        engine: z.enum(['google', 'bing']).nullable(),
        leads: z.array(editorialLead).max(2),
      }),
    )
    .max(500),
  checks: z
    .array(
      z.strictObject({
        source: idSchema,
        ok: z.boolean(),
        issues: z
          .array(
            z.enum([
              'flux-indisponible',
              'article-indisponible',
              'limite-editeur',
            ]),
          )
          .max(3)
          .optional(),
        url: publicUrlSchema.nullable(),
        publications: z.array(published).max(8),
        proposals: z
          .array(
            z.strictObject({
              number: z.number().int().min(1).max(999),
              title: text(170).min(2),
            }),
          )
          .max(65),
      }),
    )
    .min(1)
    .max(1000),
});
const stamp = (s) => createHash('sha256').update(s).digest('hex').slice(0, 20);
const fold = (s) =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const host = (s) => new URL(s).hostname.replace(/^www\./, '');
const byPath = (a) => [...new Map(a.map((x) => [x.path, x])).values()];
const sameKeys = (a, b) =>
  a.length === b.size &&
  new Set(a).size === a.length &&
  a.every((k) => b.has(k));
const sharedHosts = new Set([
  'x.com',
  'twitter.com',
  'youtube.com',
  'youtu.be',
  'facebook.com',
  'instagram.com',
  'linkedin.com',
  'drive.google.com',
  'docs.google.com',
  'assets.nationbuilder.com',
]);

function recordSource(db, origin, article, day) {
  const existing = db.sources.find((s) => s.url === article.url);
  if (existing) return existing;
  const id = 'ed-src-' + stamp(article.url);
  if (db.sources.some((s) => s.id === id))
    throw Error('Collision de référence');
  const entry = {
    id,
    title: article.title,
    url: article.url,
    publisher: host(article.url),
    kind: origin.kind,
    published: article.date,
    checked: day,
    watch: false,
  };
  db.sources.push(entry);
  return entry;
}

function recordBrief(db, article, ref, day) {
  if (!article.candidates.length || !['campagne', 'parti'].includes(ref.kind))
    return;
  // An article reports a publication by its issuer. Its headline is never a verified personal pledge.
  const id = 'veille-' + stamp(article.url);
  if (db.events.some((e) => e.id === id || e.sources.includes(ref.id))) return;
  const title = '« ' + article.title + ' »';
  const headline = fold(article.title);
  // A headline from a campaign cannot establish the scope of a judicial proceeding.
  if (
    /\b(plainte|detournement de fonds|enquete (preliminaire|judiciaire)|information judiciaire|mise? en examen|temoin assiste|condamnation|poursuites penales)\b/.test(
      headline,
    )
  )
    return;
  // Relative invitations can already have expired when a feed is indexed.
  if (/\b(rendez vous|venez|rejoignez nous|inscrivez vous)\b/.test(headline)) {
    if (!article.event || article.event.status === 'EventCancelled') return;
    const start = article.event.start;
    const eventDay =
      start.length === 10 ? start : civilDateInParis(new Date(start));
    if (eventDay < day) return;
  }
  const category =
    article.event || /\b(meeting|reunion publique|deplacement)\b/.test(headline)
      ? 'meeting'
      : /\b(programme|proposition\w*)\b/.test(headline)
        ? 'programme'
        : /\b(candidature|investiture|retrait)\b/.test(headline)
          ? 'candidature'
          : null;
  if (!category) return;
  db.events.push({
    id,
    date: article.date,
    title,
    description: 'Publication de ' + host(article.url) + '.',
    kind: 'past',
    category,
    dateKind: 'publication',
    candidates: article.candidates,
    sources: [ref.id],
    publicationBrief: day,
  });
  return { title: article.title, path: '/breves/' + id + '/' };
}

function recordMeeting(db, article, ref, day) {
  const info = article.event;
  if (
    !info ||
    article.candidates.length !== 1 ||
    !['parti', 'campagne'].includes(ref.kind)
  )
    return;
  const id = 'rdv-' + stamp(article.url),
    candidate = article.candidates[0];
  if (
    fold(info.performer) !==
    fold(db.candidates.find((c) => c.id === candidate).name)
  )
    return;
  const dated = info.start.length !== 10,
    instant = dated ? new Date(info.start) : null;
  const date = dated ? civilDateInParis(instant) : info.start;
  const when = dated
    ? new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(instant)
    : null;
  const city =
    db.agenda.cities.find((c) => fold(c.name) === fold(info.city))?.id ?? null;
  const status = info.status === 'EventCancelled' ? 'annule' : 'annonce';
  const prior = db.agenda.events.find(
    (e) =>
      e.id === id ||
      (e.candidate === candidate &&
        (e.source === ref.id || e.additionalSources?.includes(ref.id))),
  );
  if (prior && (prior.id !== id || prior.status === 'tenu')) return;
  if (
    !prior &&
    (date < day ||
      db.agenda.events.some(
        (e) =>
          e.candidate === candidate &&
          e.date === date &&
          (e.city === city || e.source === ref.id),
      ))
  )
    return;
  const row = {
    id,
    candidate,
    date,
    time: when,
    timezone: 'Europe/Paris',
    city,
    title: article.title,
    venue: [info.venue, info.city].filter(Boolean).join(', ') || null,
    note: 'Annonce publiée sur ' + host(article.url) + '.',
    source: ref.id,
    status,
  };
  if (prior && JSON.stringify(prior) === JSON.stringify(row)) return;
  if (prior) Object.assign(prior, row);
  else db.agenda.events.push(row);
  db.agenda.checked = day;
  return { title: article.title, path: '/agenda/#' + id };
}

function recordProposal(db, parent, source, item, day, at) {
  const id = 'mesure-' + stamp(source.id + '#' + item.number);
  const prior = db.measures.find((m) => m.id === id);
  const n = String(item.number);
  if (
    !prior &&
    db.measures.some(
      (m) =>
        m.parentId === parent.id &&
        (fold(m.title) === fold(item.title) ||
          m.sourceRefs.some(
            (r) =>
              r.sourceId === source.id &&
              new RegExp('\\bproposition (n )?' + n + '\\b').test(
                fold(r.locator),
              ),
          )),
    )
  )
    return;
  if (prior?.title === item.title) return;
  const snap = {
    title: item.title,
    description:
      'Intitulé de la proposition n° ' + n + ' dans le document cité.',
    beneficiaries: null,
    timing: null,
    financing: null,
    metrics: [],
    amounts: [],
    sourceRefs: [{ sourceId: source.id, locator: 'Proposition n° ' + n + '.' }],
    scope: parent.scope,
    ...(parent.partyAuthor ? { partyAuthor: parent.partyAuthor } : {}),
    edition: parent.edition,
    checked: day,
  };
  const number = (prior?.revision ?? 0) + 1;
  if (prior) Object.assign(prior, snap, { revision: number });
  else
    db.measures.push({
      id,
      parentId: parent.id,
      candidate: parent.candidate,
      theme: parent.theme,
      revision: number,
      ...snap,
    });
  db.versions.push({
    id: id + '-v' + number,
    measureId: id,
    number,
    kind: prior ? 'programme' : 'import',
    observedOn: day,
    recordedAt: at,
    summary: prior
      ? 'L’éditeur a modifié l’intitulé numéroté.'
      : 'Lecture de l’intitulé numéroté sur la page du programme.',
    snapshot: snap,
  });
  return { title: item.title, path: '/mesures/' + id + '/' };
}

export function integrate(
  raw,
  db,
  run,
  attempt,
  now = Date.now(),
  config = catalog,
) {
  const report = input.parse(raw);
  if (
    !/^[1-9]\d{0,15}$/.test(run) ||
    !Number.isSafeInteger(attempt) ||
    attempt < 1
  )
    throw Error('Exécution inconnue');
  const at = Date.parse(report.checkedAt),
    day = civilDateInParis(new Date(at));
  if (
    at > now ||
    now - at > 24 * 3600e3 ||
    report.since > day ||
    Date.parse(day) - Date.parse(report.since) > 31 * 864e5
  )
    throw Error('Relevé périmé');
  const people = db.candidates.filter((c) => !c.withdrawnOn);
  const queries = new Map(report.queries.map((q) => [q.id, q.count]));
  const priority = report.scope === 'annonces';
  const desks = priority
    ? Object.keys(config.announcements)
    : Object.keys(editorialSections);
  const owners = new Map();
  for (const c of people)
    for (const id of config.candidates[c.id] ?? [c.statusSource]) {
      const list = owners.get(id) ?? [];
      list.push(c.id);
      owners.set(id, list);
    }
  const origins = new Set(
    priority
      ? Object.values(config.announcements).flat()
      : [
          ...owners.keys(),
          ...Object.values(config.sections).flatMap((d) => d.sources),
          ...Object.keys(config.programmes),
        ],
  );
  if (
    !sameKeys(
      report.queries.map((q) => q.id),
      new Set(priority ? [] : [...people.map((c) => c.id), ...desks]),
    ) ||
    !sameKeys(
      report.checks.map((c) => c.source),
      origins,
    )
  )
    throw Error('Inventaire incomplet ou différent du dépôt');
  for (const q of report.queries)
    if (
      (q.count === null) !== (q.engine === null) ||
      q.leads.length > (q.count ?? 0) ||
      q.leads.some(
        (l) =>
          l.date < report.since ||
          l.date > day ||
          (q.engine === 'google') !== (l.article !== null),
      )
    )
      throw Error('Résultats de recherche incohérents');
  const previous = db.reviews.find(
    (r) =>
      civilDateInParis(new Date(r.checkedAt)) === day &&
      (r.scope === 'annonces') === priority,
  );
  if (
    previous?.hosted &&
    (Date.parse(previous.checkedAt) > at ||
      (previous.hosted.run === run && previous.hosted.attempt >= attempt))
  )
    return;
  const changes = Object.fromEntries(desks.map((k) => [k, []])),
    refs = new Set(),
    checks = new Map();
  for (const row of report.checks) {
    const source = db.sources.find((s) => s.id === row.source);
    if (
      !source ||
      (priority &&
        (row.proposals.length ||
          !['campagne', 'parti', 'institution'].includes(source.kind))) ||
      (!row.ok && (row.publications.length || row.proposals.length))
    )
      throw Error('Origine incohérente');
    if (
      row.url === null
        ? row.ok
        : ![source.url, new URL('/', source.url).href].includes(row.url)
    )
      throw Error('Point de départ non autorisé');
    checks.set(source.id, row.ok);
    if (row.proposals.length && !Object.hasOwn(config.programmes, source.id))
      throw Error('Document de programme non répertorié');
    if (
      new Set(row.proposals.map((p) => p.number)).size !== row.proposals.length
    )
      throw Error('Numéro de proposition ambigu');
    for (const item of row.proposals) {
      const parent = db.engagements.find(
        (e) =>
          e.id === config.programmes[source.id] &&
          e.sources.includes(source.id),
      );
      if (
        !parent ||
        !['campagne', 'parti'].includes(parent.scope) ||
        !['campagne', 'parti'].includes(source.kind)
      )
        throw Error('Attribution de programme inconnue');
      const change = recordProposal(
        db,
        parent,
        source,
        item,
        day,
        report.checkedAt,
      );
      if (change) changes.propositions.push(change);
    }
    for (const a of row.publications) {
      const url = new URL(a.url);
      const knownMeeting =
        a.event &&
        a.candidates.length === 1 &&
        db.agenda.events.some(
          (e) =>
            e.id === 'rdv-' + stamp(a.url) &&
            e.candidate === a.candidates[0] &&
            e.date >= day &&
            e.status !== 'tenu',
        );
      if (
        host(a.url) !== host(source.url) ||
        sharedHosts.has(host(a.url)) ||
        url.hash ||
        /%2f|%5c|%0a|%0d/i.test(url.pathname) ||
        [...url.searchParams.keys()].some(
          (k) =>
            !['p', 'page_id', 'article', 'id_article', 'id', 'lang'].includes(
              k,
            ),
        ) ||
        (a.date < report.since && !knownMeeting) ||
        a.date > day ||
        new Set(a.candidates).size !== a.candidates.length ||
        a.candidates.some((id) => !owners.get(source.id)?.includes(id))
      )
        throw Error('Publication non rattachée à son origine');
      // Only first-party pages enter the source catalogue automatically.
      if (!['institution', 'campagne', 'parti'].includes(source.kind)) continue;
      const ref = recordSource(db, source, a, day);
      if (a.date >= report.since) {
        refs.add(ref.id);
        const brief = recordBrief(db, a, ref, day);
        if (brief) changes.breves.push(brief);
      }
      const meeting = recordMeeting(db, a, ref, day);
      if (meeting) changes.agenda.push(meeting);
    }
  }
  const machine = db.daily[0];
  const checksForDesk = (id) =>
    priority
      ? config.announcements[id]
      : [
          ...new Set([
            ...config.sections[id].sources,
            ...(id === 'propositions' ? Object.keys(config.programmes) : []),
          ]),
        ];
  const partial = new Set(
    report.checks.filter((c) => c.issues?.length).map((c) => c.source),
  );
  const sections = desks.map((id) => {
    const sources = checksForDesk(id),
      accessible = sources.filter((s) => checks.get(s)).length,
      count = queries.get(id);
    const status =
      !accessible && (priority || count === null)
        ? 'indisponible'
        : !accessible ||
            count === null ||
            accessible < sources.length ||
            sources.some((s) => partial.has(s))
          ? 'partiel'
          : 'consulte';
    const note = priority
      ? accessible +
        ' sur ' +
        sources.length +
        ' sources officielles accessibles.'
      : (count === null
          ? 'Recherche d’actualité indisponible.'
          : count +
            ' résultat' +
            (count > 1 ? 's' : '') +
            ' dans l’index d’actualité.') +
        ' ' +
        accessible +
        ' sur ' +
        sources.length +
        ' références de la rubrique accessibles.';
    const earlier = previous?.hosted
      ? (previous.sections.find((s) => s.id === id)?.changes ?? [])
      : [];
    const links = byPath([...earlier, ...changes[id]]);
    return {
      id,
      status: status === 'indisponible' && links.length ? 'partiel' : status,
      note,
      sources,
      changes: links,
    };
  });
  const candidateIds = people
    .filter((c) => queries.has(c.id) && queries.get(c.id) !== null)
    .map((c) => c.id);
  const manual = previous && (!previous.hosted || previous.manualCheckedAt);
  const prevChanges = previous?.hosted?.changes ?? [];
  const hosted = {
    run,
    attempt,
    since: report.since,
    queries: report.queries,
    checks: report.checks.map((c) => ({
      id: c.source,
      ok: c.ok,
      url: c.url,
      ...(c.issues?.length ? { issues: c.issues } : {}),
    })),
    publications: [
      ...new Set([...(previous?.hosted?.publications ?? []), ...refs]),
    ],
    changes: byPath([...prevChanges, ...Object.values(changes).flat()]),
  };
  const next = {
    ...(priority ? { scope: 'annonces' } : {}),
    checkedAt: report.checkedAt,
    ...(machine
      ? { collection: { run: machine.run, attempt: machine.attempt } }
      : {}),
    candidates: manual ? previous.candidates : candidateIds,
    sections: manual ? previous.sections : sections,
    hosted,
  };
  if (manual)
    next.manualCheckedAt = previous.manualCheckedAt ?? previous.checkedAt;
  if (previous) db.reviews.splice(db.reviews.indexOf(previous), 1);
  db.reviews.unshift(next);
  db.reviews.sort((a, b) => Date.parse(b.checkedAt) - Date.parse(a.checkedAt));
  editorialReviewSchema(db.candidates, db.sources).parse(db.reviews);
}

const files = {
  candidates: 'candidates',
  sources: 'sources',
  engagements: 'engagements',
  themes: 'themes',
  events: 'events',
  polls: 'polls',
  budget: 'budget',
  meta: 'meta',
  measures: 'measures',
  versions: 'versions',
  watch: 'watch',
  reviews: 'editorial-reviews',
  daily: 'daily-updates',
  agenda: 'campaign-agenda',
  budgets: 'programme-budgets',
};
const writable = [
  'sources',
  'events',
  'measures',
  'versions',
  'reviews',
  'agenda',
];
async function main() {
  const target = new URL(
    '../artifacts/editorial/edition.json',
    import.meta.url,
  );
  const stat = await lstat(target);
  if (!stat.isFile() || stat.size > 1024 * 1024)
    throw Error('Artefact invalide');
  const db = Object.fromEntries(
    await Promise.all(
      Object.entries(files).map(async ([k, name]) => [
        k,
        JSON.parse(await readFile(new URL(name + '.json', data), 'utf8')),
      ]),
    ),
  );
  const before = Object.fromEntries(
    writable.map((k) => [k, JSON.stringify(db[k])]),
  );
  integrate(
    JSON.parse(await readFile(target, 'utf8')),
    db,
    process.env.GITHUB_RUN_ID,
    Number(process.env.GITHUB_RUN_ATTEMPT),
  );
  const errors = [
    ...validateDataset(db),
    ...validateFeatures(db),
    ...validateVisualReferences(
      db.budgets,
      agendaSchema.parse(db.agenda),
      db.candidates,
      db.sources,
      db.versions,
    ),
  ];
  if (errors.length) throw Error('Incohérence dans les données éditoriales');
  if (process.argv[2] === '--check') return;
  if (process.argv.length !== 2) throw Error('Argument inconnu');
  for (const k of writable)
    if (before[k] !== JSON.stringify(db[k]))
      await writeFile(
        new URL(files[k] + '.json', data),
        JSON.stringify(db[k], null, 2) + '\n',
      );
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  main().catch((err) => {
    console.error(
      err instanceof z.ZodError ? 'Structure du relevé invalide.' : err.message,
    );
    process.exitCode = 1;
  });
