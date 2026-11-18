import { formatMoney } from './campaign-visuals-view.mjs';
export const evolutionKinds = {
  montant: 'Montant révisé',
  conditions: 'Conditions à comparer',
  perimetre: 'Périmètres distincts',
  maintien: 'Paramètres maintenus',
};
export const relationKinds = {
  affectation: 'Affectations annoncées',
  composition: 'Composition annoncée',
  financement: 'Financement annoncé',
  'non-chiffree': 'Lien partiellement documenté',
};
export function stateValue(state) {
  const n = state.value.toLocaleString('fr-FR');
  return state.unit === 'euros'
    ? formatMoney(state.value)
    : `${n} ${state.unit === 'ans' ? 'ans' : '€'}`;
}
export function stateUnit(state) {
  return {
    'euros-net-mois': 'net par mois',
    'euros-mois': 'par mois',
    euros: state.population,
    ans: 'âge légal cible',
  }[state.unit];
}
export function evidenceDate(state) {
  const label = {
    edition: 'Édition',
    publication: 'Publié le',
    declaration: 'Déclaration du',
    consultation: 'Consulté le',
    'mise-a-jour': 'Mis à jour le',
  }[state.date.kind];
  const value =
    state.date.value.length === 4
      ? state.date.value
      : new Intl.DateTimeFormat('fr-FR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          timeZone: 'Europe/Paris',
        }).format(new Date(`${state.date.value}T12:00:00Z`));
  return `${label} ${value}`;
}
/** Only identical monetary bases may produce a numeric change. Conditions and scope never do. */
export function proposalComparison(track, from, to) {
  if (from.id === to.id) return { label: 'Même document', delta: null };
  if (
    track.kind !== 'montant' ||
    from.unit !== to.unit ||
    from.basisKey !== to.basisKey
  )
    return { label: evolutionKinds[track.kind], delta: null };
  const delta = to.value - from.value;
  const unit = {
    'euros-net-mois': '€ net par mois',
    'euros-mois': '€ par mois',
    euros: '€',
    ans: 'ans',
  }[from.unit];
  return {
    label: `${delta > 0 ? '+' : ''}${delta.toLocaleString('fr-FR')} ${unit}`,
    delta,
  };
}
export function wrapLabel(label, limit = 29) {
  const lines = [''];
  for (const word of label.split(/\s+/)) {
    const i = lines.length - 1;
    if (lines[i] && (lines[i] + ' ' + word).length > limit) lines.push(word);
    else lines[i] += `${lines[i] ? ' ' : ''}${word}`;
  }
  return lines;
}
/**
 * Each map has its own denominator; approximate euros are never converted to percentages.
 * @param {(typeof import('./proposal-data').financingMaps)[number]} map
 * @param {(typeof import('./visual-data').programmeBudgets.profiles)[number]['entries'][number]} entry
 */
export function financingLayout(map, entry) {
  const percent = entry.allocationUnit === 'pourcentage';
  const denominator = percent ? 100 : entry.euros;
  const allocations = entry.allocation.length
    ? entry.allocation
    : [
        {
          label: map.origin.label,
          value: map.relation === 'non-chiffree' ? null : entry.euros,
        },
      ];
  const reverse = map.relation !== 'affectation';
  let y = 28;
  const leaves = allocations.map((a, i) => {
    const lines = wrapLabel(a.label);
    const band = a.value === null ? null : (a.value / denominator) * 176;
    const height = Math.max(94, lines.length * 20 + 56, (band ?? 0) + 20);
    const node = {
      ...a,
      path: '',
      i,
      lines,
      x: reverse ? 24 : 590,
      y,
      width: 326,
      height,
      band,
      assumed: map.assumptions.includes(a.label),
      amount:
        a.value === null
          ? map.origin.qualifier
          : percent
            ? `${a.value.toLocaleString('fr-FR')} %`
            : formatMoney(a.value),
    };
    y += height + 18;
    return node;
  });
  const height = Math.max(290, y + 10);
  const root = {
    x: reverse ? 590 : 24,
    y: (height - 230) / 2,
    width: 326,
    height: 230,
  };
  let offset = height / 2 - 88;
  for (const leaf of leaves) {
    const band = leaf.band;
    const a = reverse ? leaf : root,
      b = reverse ? root : leaf;
    const ay = reverse ? leaf.y + leaf.height / 2 : offset + (band ?? 0) / 2;
    const by = reverse ? offset + (band ?? 0) / 2 : leaf.y + leaf.height / 2;
    const x1 = a.x + a.width,
      x2 = b.x,
      cx = (x1 + x2) / 2;
    const curve = (s, e) => `C${cx},${s} ${cx},${e} ${x2},${e}`;
    leaf.path =
      band === null
        ? `M${x1},${ay} ${curve(ay, by)}`
        : `M${x1},${ay - band / 2} ${curve(ay - band / 2, by - band / 2)} L${x2},${by + band / 2} C${cx},${by + band / 2} ${cx},${ay + band / 2} ${x1},${ay + band / 2} Z`;
    if (band !== null) offset += band;
  }
  return { width: 940, height, root, leaves, percent, reverse };
}
