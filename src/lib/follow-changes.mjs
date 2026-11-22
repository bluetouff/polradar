import { evidenceDate, evolutionKinds } from './proposal-view.mjs';
import { snapshotChanges } from './features.mjs';
import { agendaDateLabel } from './campaign-visuals-view.mjs';
import { positionLabel, chambers } from './legislative-votes.mjs';
import { civilDateInParis, publicUrlSchema } from './schema.mjs';

export const snapshotLabels = {
  title: 'Intitulé',
  description: 'Proposition',
  beneficiaries: 'Bénéficiaires',
  timing: 'Calendrier',
  financing: 'Financement',
  metrics: 'Paramètres chiffrés',
  amounts: 'Montants',
  sourceRefs: 'Références',
  scope: 'Nature du document',
  partyAuthor: 'Auteur collectif',
  edition: 'Édition',
  checked: 'Date de consultation',
};
const scopeLabels = {
  campagne: 'Campagne 2027',
  parti: 'Projet de parti',
  orientation: 'Orientation',
  archive: 'Archive 2022',
};
const revisionLabels = {
  import: 'Mesure ajoutée',
  correction: 'Fiche corrigée',
  enrichissement: 'Fiche précisée',
  programme: 'Proposition modifiée',
};
const statuses = { annonce: 'Annoncé', tenu: 'Tenu', annule: 'Annulé' };
export function snapshotText(key, value, refs) {
  if (value == null || value.length === 0) return 'Non renseigné';
  if (key === 'metrics')
    return value
      .map(
        (v) => v.label + ' · ' + v.value.toLocaleString('fr-FR') + ' ' + v.unit,
      )
      .join('\n');
  if (key === 'amounts')
    return value
      .map((v) =>
        [
          v.label,
          v.value.toLocaleString('fr-FR') + ' ' + v.unit,
          v.period,
          v.basis === 'non-applicable' ? '' : v.basis,
        ]
          .filter(Boolean)
          .join(' · '),
      )
      .join('\n');
  if (key === 'sourceRefs')
    return value
      .map((v) =>
        [refs.get(v.sourceId)?.title, v.locator].filter(Boolean).join(' · '),
      )
      .join('\n');
  if (key === 'scope') return scopeLabels[value] ?? value;
  if (key === 'checked') return agendaDateLabel(value);
  return String(value);
}
function sourceLinks(refs, sources) {
  return refs.map(({ sourceId, locator }) => {
    const source = sources.get(sourceId);
    if (!source) throw Error('Référence de suivi inconnue : ' + sourceId);
    return {
      url: publicUrlSchema.parse(source.url),
      label: source.title,
      ...(locator ? { locator } : {}),
    };
  });
}
export function measureChanges({ measures, versions, sources }) {
  const byId = new Map(measures.map((m) => [m.id, m]));
  const snapshots = new Map(
    versions.map((v) => [v.measureId + '@' + v.number, v.snapshot]),
  );
  const refs = new Map(sources.map((s) => [s.id, s]));
  return versions.flatMap((v) => {
    const m = byId.get(v.measureId),
      current = v.snapshot,
      before = snapshots.get(v.measureId + '@' + (v.number - 1));
    if (!m || (v.number > 1 && !before))
      throw Error('Historique de mesure incomplet : ' + v.id);
    const keys = before
      ? snapshotChanges(before, current)
          .map((d) => d.key)
          .filter((k) => k !== 'checked')
      : ['description'];
    if (!keys.length) return []; // A new consultation alone carries no substantive change.
    const state = (snap) => ({
      fields: keys.map((k) => ({
        label: snapshotLabels[k],
        text: snapshotText(k, snap[k], refs),
      })),
      sources: sourceLinks(snap.sourceRefs, refs),
    });
    return [
      {
        id: v.id,
        day: v.recordedAt
          ? civilDateInParis(new Date(v.recordedAt))
          : v.observedOn,
        at: v.recordedAt,
        candidate: m.candidate,
        themes: [m.theme],
        author: current.partyAuthor ?? null,
        kind: 'mesure',
        label: revisionLabels[v.kind],
        title: current.title,
        context: scopeLabels[current.scope] + ' · ' + current.edition,
        href: before
          ? '/historique/?mesure=' +
            m.id +
            '&avant=' +
            (v.number - 1) +
            '&apres=' +
            v.number
          : '/mesures/' + m.id + '/#version-' + v.number,
        before: before ? state(before) : null,
        after: state(current),
      },
    ];
  });
}

export function agendaStates(data, sources) {
  const cities = new Map(data.cities.map((c) => [c.id, c.name]));
  return new Map(
    data.events.map((e) => {
      const place = [e.venue, cities.get(e.city)].filter(Boolean);
      const where =
        place.length === 2 && place[0].includes(place[1])
          ? place[0]
          : place.join(' · ');
      const fields = [
        { label: 'Statut', text: statuses[e.status] },
        {
          label: 'Rendez-vous',
          text:
            agendaDateLabel(e.date, e.latestPossibleDate) +
            (e.time ? ' à ' + e.time + ' (' + e.timezone + ')' : ''),
        },
        { label: 'Lieu', text: where || 'Lieu non précisé' },
      ];
      const refs = [...new Set([e.source, ...(e.additionalSources ?? [])])].map(
        (sourceId) => ({ sourceId }),
      );
      return [
        e.id,
        {
          candidate: e.candidate,
          themes: [],
          title: e.title,
          context: [
            agendaDateLabel(e.date, e.latestPossibleDate),
            cities.get(e.city),
          ]
            .filter(Boolean)
            .join(' · '),
          href: '/agenda/#' + e.id,
          state: { fields, sources: sourceLinks(refs, sources) },
        },
      ];
    }),
  );
}

export function ballotStates(data, measures) {
  const result = new Map(),
    ballots = new Map(data.ballots.map((b) => [b.id, b]));
  for (const dossier of data.cases)
    for (const link of dossier.links) {
      const ballot = ballots.get(link.ballotId),
        theme = measures.get(dossier.measureId)?.theme;
      const position = ballot?.positions.find(
        (p) => p.candidate === dossier.candidate,
      );
      if (!position || !theme)
        throw Error('Dossier de vote incomplet : ' + dossier.id);
      const key = ballot.id + '-' + position.candidate,
        previous = result.get(key);
      if (previous) {
        if (!previous.themes.includes(theme)) previous.themes.push(theme);
        continue;
      }
      result.set(key, {
        candidate: position.candidate,
        themes: [theme],
        title: ballot.title,
        context:
          chambers[ballot.chamber] +
          ' · scrutin du ' +
          agendaDateLabel(ballot.date),
        href: '/votes/#dossier=' + dossier.id,
        state: {
          fields: [
            {
              label: 'Position au scrutin',
              text: positionLabel(position, ballot),
            },
            { label: 'Groupe lors du vote', text: position.groupAtTime },
          ],
          sources: [
            {
              url: publicUrlSchema.parse(ballot.source.url),
              label: ballot.source.title,
              locator: ballot.source.locator,
            },
          ],
        },
      });
    }
  return result;
}

export function revisionChanges(kind, previous, current, sha, at) {
  const changes = [];
  for (const key of new Set([...previous.keys(), ...current.keys()])) {
    const a = previous.get(key),
      b = current.get(key),
      row = b ?? a;
    const changed =
      a && b
        ? b.state.fields
            .filter((f, i) => f.text !== a.state.fields[i]?.text)
            .map((f) => f.label)
        : null;
    const renamed = Boolean(a && b && a.title !== b.title);
    if (changed && !changed.length && !renamed) continue;
    const state = (s) => {
      if (!s) return null;
      const fields = changed
        ? s.state.fields.filter((f) => changed.includes(f.label))
        : [...s.state.fields];
      if (renamed) fields.unshift({ label: 'Intitulé', text: s.title });
      return { fields, sources: s.state.sources };
    };
    const label =
      kind === 'agenda'
        ? b
          ? a
            ? 'Rendez-vous modifié'
            : 'Rendez-vous ajouté'
          : 'Rendez-vous retiré du corpus'
        : b
          ? a
            ? 'Vote corrigé'
            : 'Vote documenté'
          : 'Vote retiré du corpus';
    changes.push({
      id: kind + '-' + sha.slice(0, 12) + '-' + key,
      day: civilDateInParis(new Date(at)),
      at,
      candidate: row.candidate,
      themes: row.themes,
      author: null,
      kind,
      label,
      title: row.title,
      context: row.context,
      href: b ? row.href : kind === 'agenda' ? '/agenda/' : '/votes/',
      before: state(a),
      after: state(b),
    });
  }
  return changes;
}

// Keep the first publication of each pair, even if an intermediate document is added later.
export function comparisonChanges(data, seen, at) {
  const byId = new Map(data.states.map((s) => [s.id, s])),
    changes = [];
  function view(s) {
    const fields = [
      { label: 'Document', text: s.edition + ' · ' + evidenceDate(s) },
      { label: 'Proposition', text: s.statement },
      { label: 'Périmètre', text: s.population },
    ];
    if (s.reported)
      fields.push({
        label: 'Attribution',
        text: 'Déclaration rapportée dans le document cité.',
      });
    return {
      fields,
      sources: [
        {
          label: s.source.title,
          url: publicUrlSchema.parse(s.source.url),
          locator: s.source.locator,
        },
      ],
    };
  }
  for (const track of data.tracks) {
    for (let i = 1; i < track.stateIds.length; i++) {
      const from = byId.get(track.stateIds[i - 1]),
        to = byId.get(track.stateIds[i]);
      const id = 'evolution-' + from.id + '-' + to.id;
      if (seen.has(id)) continue;
      seen.add(id);
      changes.push({
        id,
        day: civilDateInParis(new Date(at)),
        at,
        candidate: track.candidate,
        themes: [track.theme],
        author: null,
        kind: 'evolution',
        label: 'Comparaison documentée',
        title: track.title,
        context: evolutionKinds[track.kind] + ' · ' + track.note,
        href: '/evolution/#dossier=' + track.id,
        before: view(from),
        after: view(to),
      });
    }
  }
  return changes;
}
