import { type Sru } from '../lib/dossiers-territoriaux';
import { sruReading } from '../lib/sru-result';

export function renderSruResult(card: HTMLElement, row?: Sru) {
  if (!row) {
    card.hidden = true;
    return;
  }
  const { rate, exact, status, below, scale, target, targetLabel, exempt } =
    sruReading(row);
  card.toggleAttribute('data-below', below);
  card.toggleAttribute('data-exact', exact);
  card.querySelector('[data-sru-rate]')!.textContent = rate;
  card.querySelector('[data-sru-status]')!.textContent = status;
  card.querySelector('[data-sru-target]')!.textContent = target;
  card.querySelector('[data-sru-target-label]')!.textContent = targetLabel;
  card.querySelector<HTMLElement>('[data-sru-exemption]')!.hidden = !exempt;
  const chart = card.querySelector<HTMLElement>('[data-sru-scale]')!;
  chart.hidden = !scale;
  if (scale) {
    chart
      .querySelector('[data-sru-fill]')!
      .setAttribute('width', String(scale.width));
    const marker = chart.querySelector('[data-sru-marker]')!;
    marker.setAttribute('x1', String(scale.marker));
    marker.setAttribute('x2', String(scale.marker));
    chart.querySelector('[data-sru-end]')!.textContent = scale.end;
  }
  card.hidden = false;
}
