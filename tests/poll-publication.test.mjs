import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPollPublication } from '../src/lib/poll-publication.mjs';
const window = {
  debut: '2030-05-03T22:00:00Z',
  fin: '2030-05-05T18:00:00Z',
  source: 'https://www.legifrance.gouv.fr/jorf/texte-de-recette',
};
const at = (value, rule = window) =>
  checkPollPublication(new Date(value), { version: 1, fenetres: [rule] });
test('La fenêtre suit la veille à minuit heure de Paris et la clôture effective, bornes comprises puis exclues', () => {
  at('2030-05-03T21:59:59Z');
  assert.throws(() => at(window.debut), /suspendue/);
  assert.throws(() => at('2030-05-05T17:59:59Z'), /suspendue/);
  at(window.fin);
});
test('Un calendrier vide préserve la publication, toute fenêtre invalide est rejetée', () => {
  checkPollPublication(new Date(), { version: 1, fenetres: [] });
  for (const changed of [
    { source: 'https://example.org/tour' },
    { debut: '2030-02-31T12:00:00Z' },
    { fin: window.debut },
    { source: 'https://www.legifrance.gouv.fr/' },
    { fin: '05/05/2030' },
  ])
    assert.throws(() => at('2030-01-01T00:00:00Z', { ...window, ...changed }));
});
