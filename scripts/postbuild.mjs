import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
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
const pages = files.filter((file) => file.endsWith('.html'));
const errors = [];
const sitemap = [];
const sitemapDate = dateSchema.or(z.iso.datetime({ offset: true }));
const verifiedImages = new Set();
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const route = `/${path
    .relative(root, file)
    .replaceAll(path.sep, '/')
    .replace(/index\.html$/, '')}`;
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
let sourceCommit = process.env.GITHUB_SHA || null;
if (!sourceCommit) {
  try {
    sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    /* Une prévisualisation locale peut précéder le premier commit. */
  }
}
if (sourceCommit && !/^[a-f0-9]{40}$/.test(sourceCommit))
  throw new Error('Commit de construction invalide');
await writeFile(
  path.join(root, 'build.json'),
  `${JSON.stringify({ sourceCommit, builtAt: new Date().toISOString(), repository: 'bluetouff/polradar' }, null, 2)}\n`,
);
await writeFile(
  path.join(root, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.join('')}</urlset>\n`,
);
console.log(
  `${pages.length} pages vérifiées : liens internes, CSP et ressources locales.`,
);
