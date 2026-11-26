import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { sourceCommit } from './release-revision.mjs';
import path from 'node:path';
import { z } from 'astro/zod';
import { dateSchema } from '../src/lib/schema.mjs';
import { socialImageFor } from '../src/lib/social-images.mjs';

const root = path.resolve('dist');
async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? walk(path.join(dir, entry.name))
          : path.join(dir, entry.name),
      ),
    )
  ).flat();
}
const files = await walk(root);
const known = new Set(files);
known.add(path.join(root, 'build.json'));
const pages = files.filter((file) => file.endsWith('.html'));
const errors = [];
const sitemap = [];
const sitemapDate = dateSchema.or(z.iso.datetime({ offset: true }));
const verifiedImages = new Set();
const fingerprint = (bytes) => createHash('sha256').update(bytes).digest('hex');
const interactive = [
  ['recherche', 'api/recherche.json'],
  ['sondages', 'data/enquetes.json'],
  ['suivi', 'data/choix-suivi.json'],
];
const corpusPath = 'api/corpus.json';
const corpusRoutes = new Set([
  'comparer',
  'evolution',
  'historique',
  'mesures',
  'sources',
  'suivi',
]);
const hashes = Object.fromEntries(
  await Promise.all(
    [corpusPath, ...interactive.map(([, resource]) => resource)].map(
      async (resource) => [
        resource,
        fingerprint(await readFile(path.join(root, resource))),
      ],
    ),
  ),
);
for (const file of pages) {
  let html = await readFile(file, 'utf8');
  const route = `/${path
    .relative(root, file)
    .replaceAll(path.sep, '/')
    .replace(/index\.html$/, '')}`;
  const [, section, subpage] = route.split('/');
  if (section === 'mesures' && subpage && subpage !== 'page' && sourceCommit) {
    const stamped = html
      .replace(
        /<meta name="polradar-copy-revision" content="[a-f0-9]{40}">/g,
        '',
      )
      .replace(
        '</head>',
        `<meta name="polradar-copy-revision" content="${sourceCommit}"></head>`,
      );
    if (stamped !== html) {
      html = stamped;
      await writeFile(file, html);
    }
  }
  if (!subpage || subpage === 'page') {
    const resources = interactive
      .filter(([owner]) => section === owner)
      .map(([, resource]) => resource);
    if (corpusRoutes.has(section)) resources.push(corpusPath);
    if (resources.length) {
      const tags = resources
        .map(
          (resource) =>
            `<meta name="polradar-data" data-path="/${resource}" content="${hashes[resource]}">`,
        )
        .join('');
      html = html
        .replace(
          /<meta name="polradar-data" data-path="[^"]+" content="[a-f0-9]{64}">/g,
          '',
        )
        .replace('</head>', tags + '</head>');
      await writeFile(file, html);
    }
  }
  const expectedImage = new URL(
    socialImageFor(route).url,
    'https://polradar.fr',
  );
  const image = html.match(/<meta property="og:image" content="([^"]+)"/);
  const twitter = html.match(/<meta name="twitter:image" content="([^"]+)"/);
  if (
    image?.[1] !== expectedImage.href ||
    twitter?.[1] !== expectedImage.href ||
    !html.includes('name="twitter:card" content="summary_large_image"')
  )
    errors.push(`${route}: métadonnées OG incohérentes`);
  const imageTags =
    html.match(
      /<meta (?:property="og:image:alt"|name="twitter:image:alt") content="([^"]*)"/g,
    ) ?? [];
  const alt = socialImageFor(route)
    .alt.replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  if (
    imageTags.length !== 2 ||
    imageTags.some((tag) => !tag.endsWith('content="' + alt + '"'))
  )
    errors.push(`${route}: texte alternatif des cartes sociales incohérent`);
  const imagePath = path.join(root, expectedImage.pathname);
  if (!verifiedImages.has(imagePath)) {
    const png = await readFile(imagePath);
    if (
      png.length > 1024 * 1024 ||
      png.length < 24 ||
      png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
      png.readUInt32BE(16) !== 1200 ||
      png.readUInt32BE(20) !== 630
    )
      errors.push(`${route}: PNG OG invalide`);
    verifiedImages.add(imagePath);
  }
  if (!/http-equiv="content-security-policy"/i.test(html))
    errors.push(`${route}: CSP manquante`);
  if (
    /\s(?:on[a-z]+)\s*=|(?:href|src)\s*=\s*["']\s*(?:javascript|data:text\/html):/i.test(
      html,
    )
  )
    errors.push(`${route}: attribut actif interdit`);
  if (/unsafe-inline|unsafe-eval|<iframe\b|<object\b|<embed\b/i.test(html))
    errors.push(`${route}: contenu actif interdit`);
  for (const match of html.matchAll(/\b(href|src)="([^"]*)"/g)) {
    const [, attribute, raw] = match;
    if (attribute === 'src' && /^https?:/i.test(raw))
      errors.push(`${route}: ressource tierce ${raw}`);
    if (!raw.startsWith('/') || raw.startsWith('//')) continue;
    const local = decodeURIComponent(raw.split(/[?#]/)[0]);
    const target = path.resolve(root, `.${local}`);
    if (target !== root && !target.startsWith(`${root}${path.sep}`))
      errors.push(`${route}: chemin hors site`);
    if (!known.has(target) && !known.has(path.join(target, 'index.html')))
      errors.push(`${route}: lien cassé ${local}`);
  }
  if (!/name="robots" content="noindex/.test(html) && route !== '/404.html') {
    const htmlTag = html.match(/<html\b[^>]*>/)?.[0];
    const lastmod = htmlTag?.match(/\sdata-last-modified="([^"]*)"/)?.[1];
    if (lastmod !== undefined && !sitemapDate.safeParse(lastmod).success)
      errors.push(`${route}: date lastmod invalide`);
    const loc = `https://polradar.fr${route}`
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
    sitemap.push(
      `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`,
    );
  }
}
if (errors.length) throw new Error(errors.join('\n'));
await writeFile(
  path.join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.join('')}</urlset>\n`,
);
const surfaces = { ...hashes };
for (const resource of [
  'index.html',
  'statistiques/index.html',
  'recherche/index.html',
  'comparer/index.html',
  'sondages/index.html',
  'api/exports-v1.json',
  'api/qualite-documentaire.json',
  'rss.xml',
  'breves/rss.xml',
  'sitemap.xml',
]) {
  surfaces[resource] = fingerprint(await readFile(path.join(root, resource)));
}
const manifest = {
  sourceCommit,
  builtAt: new Date().toISOString(),
  repository: 'bluetouff/polradar',
  sha256: surfaces,
};
await writeFile(
  path.join(root, 'build.json'),
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  `${pages.length} pages vérifiées : liens internes, CSP et ressources locales.`,
);
