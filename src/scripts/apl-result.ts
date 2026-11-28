import { aplReading } from '../lib/dossiers-territoriaux';

export function renderAplResult(card: HTMLElement, value?: number) {
  if (value === undefined) {
    card.hidden = true;
    return;
  }
  const { index, number, category } = aplReading(value);
  card.querySelector('[data-apl-number]')!.textContent = number;
  card.querySelector('[data-apl-class]')!.textContent = category;
  card.querySelectorAll('.terrain-map-scale > span').forEach((segment, i) => {
    segment.classList.toggle('is-active', index === i);
  });
  card.hidden = false;
}
