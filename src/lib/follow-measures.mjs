import { snapshotChanges } from './features.mjs';
import { agendaDateLabel } from './campaign-visuals-view.mjs';
import { isPublicSourceUrl } from './source-url.mjs';
import { followDay } from './follow-window.mjs';
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
export function sourceLinks(refs, sources) {
  return refs.map(({ sourceId, locator }) => {
    const source = sources.get(sourceId);
    if (!source) throw Error('Référence de suivi inconnue : ' + sourceId);
    if (!isPublicSourceUrl(source.url)) throw Error('URL de source invalide');
    return {
      url: source.url,
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
        day: v.recordedAt ? followDay(Date.parse(v.recordedAt)) : v.observedOn,
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
