import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { shareLinks } from '../src/lib/sharing.mjs';
import { socialImages, socialImageFor } from '../src/lib/social-images.mjs';
import { socialImageHtml } from '../src/lib/social-image-view.mjs';
const graphemes = (s) =>
  [...new Intl.Segmenter('fr', { granularity: 'grapheme' }).segment(s)].length;
test('les cinq partages n’ajoutent aucun paramètre de suivi et ignorent recherche et fragment', () => {
  const page = 'https://polradar.fr/mesures/retailleau-retraites-1/';
  const links = shareLinks(
    'Retraites & fiscalité <2027>',
    page + '?utm_source=secret#dossier=prive',
  );
  assert.deepEqual(
    links.map((l) => l.id),
    ['x', 'bluesky', 'linkedin', 'facebook', 'mail'],
  );
  const allowed = {
    x: ['text', 'url'],
    bluesky: ['text'],
    linkedin: ['url'],
    facebook: ['u'],
    mail: ['subject', 'body'],
  };
  for (const l of links) {
    const u = new URL(l.href);
    assert.deepEqual([...u.searchParams.keys()], allowed[l.id]);
    const content = [...u.searchParams.values()].join(' ');
    assert.ok(content.includes(page));
    assert.ok(!content.includes('secret') && !content.includes('prive'));
  }
});
test('les titres sont encodés et ne peuvent injecter d’en-tête mail', () => {
  const links = shareLinks(
    'Économie & salaires\r\nBcc: ex@example.org',
    'https://polradar.fr/',
  );
  const mail = new URL(links.at(-1).href);
  assert.equal(mail.searchParams.get('bcc'), null);
  assert.ok(!/[\r\n]/.test(mail.searchParams.get('subject')));
  assert.equal(
    new URL(links[0].href).searchParams.get('text'),
    'Économie & salaires Bcc: ex@example.org',
  );
});
test('le texte Bluesky tient en 300 graphèmes et les adresses non canoniques sont refusées', () => {
  const long = '👨‍👩‍👧‍👦 e\u0301'.repeat(150);
  const text = new URL(
    shareLinks(long, 'https://polradar.fr/mesures/une-proposition/')[1].href,
  ).searchParams.get('text');
  assert.ok(graphemes(text) <= 300);
  assert.ok(text.includes('…\nhttps://polradar.fr/'));
  for (const u of [
    'https://example.org/',
    'http://polradar.fr/',
    'https://polradar.fr@evil.org/',
    'https://user:password@polradar.fr/',
    'https://polradar.fr/' + 'a'.repeat(300),
  ])
    assert.throws(() => shareLinks('Titre', u));
});
test('l’accueil et toutes les rubriques ont un PNG distinct et les sous-pages héritent de la bonne rubrique', () => {
  const pages = readdirSync(new URL('../src/pages/', import.meta.url), {
    withFileTypes: true,
  });
  const paths = pages
    .filter(
      (p) => p.isFile() && p.name.endsWith('.astro') && p.name !== '404.astro',
    )
    .map((p) =>
      p.name === 'index.astro' ? '/' : `/${p.name.replace('.astro', '')}/`,
    );
  paths.push(
    '/candidats/',
    '/presse/',
    '/studio/',
    '/documents/',
    '/breves/',
    '/communes/',
    '/comparer/retraites/',
    '/dossiers/',
    '/dossiers/retraites-ages-et-conditions/',
    '/engagements/',
    '/mesures/',
    '/mcp/',
    '/mcp/documentation/',
    '/api/',
    '/mcp/statistiques/',
    '/numerique/',
    '/numerique/liberte-expression/',
    '/questions/',
    '/numerique/comparer/',
    '/numerique/ce-qui-changerait/',
    '/economie/',
    '/economie/declarations/',
    '/economie/simulateurs/',
    '/economie/simulateurs/electricite/',
    '/economie/simulateurs/smic/',
    '/economie/simulateurs/temps-de-travail/',
    '/economie/simulateurs/carburants/',
    '/economie/simulateurs/loyers/',
    '/economie/simulateurs/successions/',
    '/economie/simulateurs/allocations-familiales/',
    '/territoires/',
    '/economie/finances-publiques/',
    '/themes/',
  );
  assert.equal(socialImages.length, paths.length);
  const agenda = JSON.parse(
    readFileSync(
      new URL('../src/data/campaign-agenda.json', import.meta.url),
      'utf8',
    ),
  );
  const communes = new Set(
    agenda.events.map((event) => event.city).filter(Boolean),
  );
  assert.ok(
    socialImageFor('/agenda/').description.includes(
      `${communes.size} communes`,
    ),
  );
  assert.equal(socialImageFor('/agenda/').graphic.points.length, communes.size);
  assert.equal(
    new Set(socialImages.map((c) => c.url)).size,
    socialImages.length,
  );
  for (const path of paths) assert.equal(socialImageFor(path).path, path);
  for (const card of socialImages) {
    assert.equal(card.url, `/og/${card.id}.png`);
    assert.equal(socialImageFor(card.path + 'detail/').id, card.id);
  }
  assert.equal(socialImageFor('/mesures/une-fiche/').id, 'mesures');
});
test('les visuels échappent leurs libellés et n’intègrent aucun script, événement ou ressource distante', () => {
  const hostile = '<img src="https://evil.test/pixel" onerror="alert(1)">';
  const card = structuredClone(socialImages.find((c) => c.id === 'sondages'));
  card.title = hostile;
  card.graphic.rows[0].label = hostile;
  const html = socialImageHtml(card);
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  for (const c of socialImages) {
    const html = socialImageHtml(c);
    assert.ok(
      !/<script\b|\son[a-z]+=|\sstyle=|(?:src|href)="https?:/i.test(html),
    );
  }
});
