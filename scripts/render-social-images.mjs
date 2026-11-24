import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import {
  readFile,
  mkdir,
  lstat,
  writeFile,
  readdir,
  unlink,
  rename,
} from 'node:fs/promises';
import sharp from 'sharp';
import { chromium } from '@playwright/test';
import { socialImages } from '../src/lib/social-images.mjs';
import { socialImageHtml } from '../src/lib/social-image-view.mjs';

const output = new URL('../public/og/', import.meta.url);
await mkdir(output, { recursive: true });
const directory = await lstat(new URL('../public/og', import.meta.url));
if (!directory.isDirectory() || directory.isSymbolicLink())
  throw Error('Répertoire OG non sûr');
const css = await readFile(
  new URL('../src/styles/social-images.css', import.meta.url),
);
const font = await readFile(
  new URL('../src/assets/fonts/archivo-latin.woff2', import.meta.url),
);
const logo = await readFile(
  new URL('../public/marque/polradar.svg', import.meta.url),
);
const pages = new Map(
  socialImages.map((c) => [`/card/${c.id}`, socialImageHtml(c)]),
);
const art = await readFile(
  new URL('../src/assets/social/urne-editoriale.webp', import.meta.url),
);
const cached = new URL('../.cache/polradar-og/', import.meta.url);
await mkdir(cached, { recursive: true });
if (
  !(
    await lstat(new URL('../.cache/polradar-og', import.meta.url))
  ).isDirectory()
)
  throw Error('Cache OG non sûr');
const toolchain = createHash('sha256')
  .update(process.platform)
  .update(process.arch)
  .update(process.versions.node)
  .update(await readFile(new URL('../package-lock.json', import.meta.url)))
  .update(await readFile(new URL(import.meta.url)))
  .update(css)
  .update(font)
  .update(logo)
  .digest('hex');
const fingerprint = (card) => {
  const h = createHash('sha256')
    .update(toolchain)
    .update(pages.get(`/card/${card.id}`));
  if (card.id === 'accueil') h.update(art);
  return h.digest('hex');
};
const digest = (buf) => createHash('sha256').update(buf).digest('hex');
function validPng(buf) {
  return (
    buf.length >= 32 &&
    buf.length <= 1024 * 1024 &&
    buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
    buf.readUInt32BE(16) === 1200 &&
    buf.readUInt32BE(20) === 630
  );
}
async function checkedPng(url) {
  const st = await lstat(url);
  if (!st.isFile() || st.size > 1024 * 1024)
    throw Error('Fichier PNG non ordinaire');
  const bytes = await readFile(url);
  if (!validPng(bytes)) throw Error('PNG OG invalide');
  return bytes;
}
async function replace(target, content) {
  const tmp = new URL(`./.og-${randomUUID()}`, target);
  try {
    await writeFile(tmp, content, { mode: 0o644, flag: 'wx' });
    await rename(tmp, target);
  } finally {
    await unlink(tmp).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}
const available = await readdir(cached);
const usedCache = new Set();
const pending = [];
for (const card of socialImages) {
  const prefix = `${card.id}-${fingerprint(card)}-`;
  const hit = available.find(
    (name) =>
      name.startsWith(prefix) &&
      /^[0-9a-f]{64}\.png$/.test(name.slice(prefix.length)),
  );
  if (hit) {
    const bytes = await checkedPng(new URL(hit, cached)).catch(() => null);
    if (bytes && hit === prefix + digest(bytes) + '.png') {
      await replace(new URL(card.file, output), bytes);
      usedCache.add(hit);
      continue;
    }
  }
  pending.push(card);
}
const legacy = new URL('../src/assets/social/anciens/', import.meta.url);
const oldNames = await readdir(legacy);
for (const name of oldNames) {
  if (!/^accueil-[a-f0-9]{20}\.png$/.test(name))
    throw Error('Ancienne image OG inattendue');
  await replace(new URL(name, output), await checkedPng(new URL(name, legacy)));
}
const server = createServer((request, response) => {
  const route = request.url;
  const headers = {
    'Content-Security-Policy':
      "default-src 'none'; script-src 'none'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
  };
  if (request.method !== 'GET') {
    response.writeHead(405, headers);
    response.end();
    return;
  }
  if (route === '/card.css') {
    response.writeHead(200, {
      ...headers,
      'Content-Type': 'text/css; charset=utf-8',
    });
    response.end(css);
  } else if (route === '/marque/polradar.svg') {
    response.writeHead(200, { ...headers, 'Content-Type': 'image/svg+xml' });
    response.end(logo);
  } else if (route === '/assets/urne-editoriale.webp') {
    response.writeHead(200, { ...headers, 'Content-Type': 'image/webp' });
    response.end(art);
  } else if (route === '/archivo.woff2') {
    response.writeHead(200, { ...headers, 'Content-Type': 'font/woff2' });
    response.end(font);
  } else if (pages.has(route)) {
    response.writeHead(200, {
      ...headers,
      'Content-Type': 'text/html; charset=utf-8',
    });
    response.end(pages.get(route));
  } else {
    response.writeHead(404, headers);
    response.end();
  }
});
let browser;
try {
  if (pending.length) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    if (!address || typeof address === 'string')
      throw Error('Serveur de rendu indisponible');
    const origin = `http://127.0.0.1:${address.port}`;
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
      javaScriptEnabled: false,
      serviceWorkers: 'block',
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
    });
    const errors = [];
    await context.route('**/*', (route) => {
      if (new URL(route.request().url()).origin === origin)
        return route.continue();
      errors.push('Ressource extérieure interdite au rendu');
      return route.abort();
    });
    const page = await context.newPage();
    page.on('response', (res) => {
      if (res.status() >= 400) errors.push('Ressource OG indisponible');
    });
    page.on('pageerror', (error) => errors.push(error.message));
    for (const card of pending) {
      const target = new URL(card.file, output);
      try {
        const stat = await lstat(target);
        if (!stat.isFile() || stat.isSymbolicLink())
          throw Error('Destination OG non sûre');
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
      const response = await page.goto(`${origin}/card/${card.id}`);
      if (response?.status() !== 200)
        throw Error(`Rendu OG en échec : ${card.id}`);
      await page.evaluate(() => document.fonts.ready);
      const overflow = await page.evaluate(() => {
        const problems = [];
        if (
          document.documentElement.scrollWidth > 1200 ||
          document.documentElement.scrollHeight > 630
        )
          problems.push('page');
        for (const element of document.querySelectorAll(
          'h1, .og-description, .og-graphic, .og-card header, .og-card footer',
        )) {
          const r = element.getBoundingClientRect();
          if (
            r.left < 0 ||
            r.right > 1200 ||
            r.top < 0 ||
            r.bottom > 630 ||
            element.scrollHeight > element.clientHeight + 1
          )
            problems.push(element.className || element.tagName);
        }
        const main = document.querySelector('main').getBoundingClientRect(),
          footer = document.querySelector('footer').getBoundingClientRect();
        if (main.bottom > footer.top) problems.push('footer-overlap');
        return problems;
      });
      if (overflow.length || errors.length)
        throw Error(`${card.id} : ${[...overflow, ...errors].join(', ')}`);
      const bitmap = await page.screenshot({
        type: 'png',
        animations: 'disabled',
      });
      const png = await sharp(bitmap)
        .png({
          palette: true,
          colours: 256,
          dither: 0.5,
          effort: 7,
          compressionLevel: 9,
          // Indexed PNGs compress better when their palette indices are left unfiltered.
          adaptiveFiltering: false,
        })
        .toBuffer();
      if (
        png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
        png.readUInt32BE(16) !== 1200 ||
        png.readUInt32BE(20) !== 630
      )
        throw Error('PNG OG invalide');
      if (!validPng(png)) throw Error('PNG trop volumineux ou invalide');
      await replace(target, png);
      const key = `${card.id}-${fingerprint(card)}-${digest(png)}.png`;
      await replace(new URL(key, cached), png);
      usedCache.add(key);
    }
  }
  // This ignored directory owns only the catalogue's fingerprinted PNG names.
  // Keep unrelated files intact, and never follow a link while pruning a render.
  const currentFiles = new Set([
    ...oldNames,
    ...socialImages.map((c) => c.file),
  ]);
  for (const file of available) {
    if (
      !usedCache.has(file) &&
      /^[a-z0-9-]+-[a-f0-9]{64}-[a-f0-9]{64}\.png$/.test(file)
    )
      await unlink(new URL(file, cached));
  }
  const prefixes = socialImages.map((c) => `${c.id}-`);
  for (const file of await readdir(output)) {
    if (
      currentFiles.has(file) ||
      !prefixes.some(
        (prefix) =>
          file.startsWith(prefix) &&
          /^[a-f0-9]{20}\.png$/.test(file.slice(prefix.length)),
      )
    )
      continue;
    const target = new URL(file, output);
    const stat = await lstat(target);
    if (!stat.isFile() || stat.isSymbolicLink())
      throw Error('Ancien rendu OG non ordinaire');
    await unlink(target);
  }
  console.log(
    `${pending.length} images OG rendues · ${socialImages.length - pending.length} reprises du cache, 1200 × 630, sans ressource distante.`,
  );
} finally {
  await browser?.close();
  if (server.listening) await new Promise((resolve) => server.close(resolve));
}
