import test from 'node:test';
import assert from 'node:assert/strict';
import { newsSitemap } from '../src/lib/news-sitemap.mjs';
test('le sitemap Actualités conserve les deux jours civils, hors entrées futures ou périmées', () => {
  const days = ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27'];
  const input = days.map((day) => ({
    day,
    path: '/breves/test-' + day + '/',
    title: 'Débat <budget> & vote',
  }));
  const xml = newsSitemap(input, '2026-10-26');
  assert.equal((xml.match(/<url>/g) ?? []).length, 2);
  assert.ok(xml.includes('2026-10-25'));
  assert.ok(xml.includes('2026-10-26'));
  assert.ok(!xml.includes('2026-10-27'));
  assert.ok(!xml.includes('2026-10-24'));
  assert.ok(xml.includes('&lt;budget&gt; &amp;'));
});
