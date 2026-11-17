import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

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
for (const file of pages) {
  const html = await readFile(file, 'utf8');
  const route = `/${path
    .relative(root, file)
    .replaceAll(path.sep, '/')
    .replace(/index\.html$/, '')}`;
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
  if (!/name="robots" content="noindex/.test(html) && route !== '/404.html')
    sitemap.push(`https://polradar.fr${route}`);
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
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.map((url) => `<url><loc>${url}</loc></url>`).join('')}</urlset>\n`,
);
console.log(
  `${pages.length} pages vérifiées : liens internes, CSP et ressources locales.`,
);
