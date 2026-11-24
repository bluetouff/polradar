import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { readFile, realpath } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { cpus } from 'node:os';
import { chromium } from '@playwright/test';

const root = await realpath(process.argv[2] || 'dist');
if (
  !(await readFile(resolve(root, 'index.html'), 'utf8')).includes(
    'https://polradar.fr/',
  )
)
  throw Error('Le dossier doit contenir le site statique construit.');
const marker = await readFile(resolve(root, 'build.json'), 'utf8')
  .then(JSON.parse)
  .catch(() => null);
const sourceCommit = /^[a-f0-9]{40}$/.test(marker?.sourceCommit)
  ? marker.sourceCommit
  : null;
const routes = process.argv.slice(3);
if (!routes.length)
  routes.push(
    '/',
    '/mesures/attal-csg-salaires/',
    '/candidats/lassalle/',
    '/votes/',
    '/comparer/',
    '/recherche/',
    '/sondages/',
    '/territoires/',
    '/questions/sante-installation-medecins/',
    '/studio/',
    '/presse/',
    '/api/',
    '/mcp/',
  );
if (routes.some((p) => !/^\/(?:[a-z0-9-]+\/)*$/.test(p)))
  throw Error('Route locale HTML attendue.');
const runs = 3;
const profile = {
  width: 390,
  height: 844,
  dpr: 2,
  cpuSlowdown: 4,
  latencyMs: 60,
  downloadBitsPerSecond: 1600000,
  uploadBitsPerSecond: 750000,
};
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ico': 'image/x-icon',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};
const category = (type) =>
  type === 'text/html'
    ? 'html'
    : type === 'text/css'
      ? 'css'
      : type === 'text/javascript'
        ? 'js'
        : type.startsWith('image/')
          ? 'images'
          : type === 'application/json'
            ? 'data'
            : 'other';
const assets = new Map();
async function fileFor(pathname) {
  try {
    const relative =
      decodeURIComponent(pathname).slice(1) +
      (pathname.endsWith('/') ? 'index.html' : '');
    const file = await realpath(resolve(root, relative));
    return file.startsWith(root + sep) ? file : undefined;
  } catch {
    return;
  }
}

async function asset(pathname) {
  if (assets.has(pathname)) return assets.get(pathname);
  try {
    const file = await fileFor(pathname);
    if (!file) return;
    const uncompressed = await readFile(file);
    const mime = types[extname(file)] || 'application/octet-stream';
    const compressed =
      /^text\/|^application\/(json|xml)$|^image\/svg\+xml$/.test(mime);
    const bytes = compressed
      ? gzipSync(uncompressed, { level: 6 })
      : uncompressed;
    const value = { bytes, raw: uncompressed.length, mime, compressed };
    assets.set(pathname, value);
    return value;
  } catch {
    return;
  }
}
const server = createServer(async (req, res) => {
  if (req.method !== 'GET') {
    res.writeHead(405).end();
    return;
  }
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const item = await asset(pathname);
  if (!item) {
    res.writeHead(404).end();
    return;
  }
  res
    .writeHead(200, {
      'Content-Type': item.mime,
      'Content-Length': item.bytes.length,
      'Cache-Control': 'no-store',
      ...(item.compressed ? { 'Content-Encoding': 'gzip' } : {}),
    })
    .end(item.bytes);
});
await new Promise((ok, fail) => {
  server.once('error', fail);
  server.listen(0, '127.0.0.1', ok);
});
const origin = 'http://127.0.0.1:' + server.address().port;
let browser;
const pages = [];
const median = (a) => {
  const v = a.filter((n) => n !== null).sort((x, y) => x - y);
  return v.length === a.length ? v[Math.floor(v.length / 2)] : null;
};
try {
  browser = await chromium.launch({ headless: true });
  for (const route of routes) {
    const samples = [];
    for (let run = 0; run < runs; run++) {
      const context = await browser.newContext({
        viewport: { width: profile.width, height: profile.height },
        isMobile: true,
        deviceScaleFactor: profile.dpr,
        serviceWorkers: 'block',
      });
      try {
        const external = new Set(),
          broken = new Set(),
          requests = [];
        await context.route('**/*', (r) => {
          const u = new URL(r.request().url());
          if (u.origin === origin || !/^https?:$/.test(u.protocol))
            return r.continue();
          external.add(u.hostname);
          return r.abort();
        });
        const page = await context.newPage();
        page.on('requestfailed', (r) => {
          const u = new URL(r.url());
          if (u.origin === origin) broken.add(u.pathname);
        });
        page.on('response', (r) => {
          const u = new URL(r.url());
          if (u.origin === origin) {
            requests.push(u.pathname);
            if (r.status() >= 400) broken.add(u.pathname);
          }
        });
        const client = await context.newCDPSession(page);
        await client.send('Network.enable');
        await client.send('Network.setCacheDisabled', { cacheDisabled: true });
        await client.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: profile.latencyMs,
          downloadThroughput: profile.downloadBitsPerSecond / 8,
          uploadThroughput: profile.uploadBitsPerSecond / 8,
        });
        await client.send('Emulation.setCPUThrottlingRate', {
          rate: profile.cpuSlowdown,
        });
        await page.addInitScript(() => {
          const kinds = PerformanceObserver.supportedEntryTypes;
          window.lab = {
            lcp: null,
            element: null,
            cls: kinds.includes('layout-shift') ? 0 : null,
          };
          if (kinds.includes('largest-contentful-paint'))
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) {
                window.lab.lcp = e.startTime;
                window.lab.element = e.element?.tagName || null;
              }
            }).observe({ type: 'largest-contentful-paint', buffered: true });
          if (kinds.includes('layout-shift')) {
            let start = 0,
              last = 0,
              score = 0;
            new PerformanceObserver((list) => {
              for (const e of list.getEntries()) {
                if (e.hadRecentInput) continue;
                if (
                  !last ||
                  e.startTime - last >= 1000 ||
                  e.startTime - start >= 5000
                ) {
                  start = e.startTime;
                  score = 0;
                }
                score += e.value;
                last = e.startTime;
                window.lab.cls = Math.max(window.lab.cls, score);
              }
            }).observe({ type: 'layout-shift', buffered: true });
          }
        });
        const response = await page.goto(origin + route, {
          waitUntil: 'load',
          timeout: 60000,
        });
        if (!response?.ok()) throw Error('Page absente : ' + route);
        await page.waitForLoadState('networkidle', { timeout: 60000 });
        await page.evaluate(
          () =>
            new Promise((resolve) =>
              requestAnimationFrame(() => requestAnimationFrame(resolve)),
            ),
        );
        const view = await page.evaluate(() => {
          const list = (s) => Array.from(document.querySelectorAll(s));
          const controls = list(
            'input:not([type=hidden]),select,textarea',
          ).filter((el) => el.getClientRects().length);
          const schemas = new Set(
            list('[itemscope][itemtype]').flatMap((e) =>
              e.getAttribute('itemtype').split(/\s+/),
            ),
          );
          function graph(entry) {
            if (!entry || typeof entry !== 'object') return;
            for (const t of [entry['@type']].flat().filter(Boolean))
              schemas.add(t);
            for (const v of Object.values(entry))
              if (typeof v === 'object')
                Array.isArray(v) ? v.forEach(graph) : graph(v);
          }
          let invalidJsonLd = 0;
          for (const e of list('script[type="application/ld+json"]'))
            try {
              graph(JSON.parse(e.textContent));
            } catch {
              invalidJsonLd++;
            }
          return {
            ...window.lab,
            dom: document.getElementsByTagName('*').length,
            viewport: innerWidth,
            overflow: document.documentElement.scrollWidth > innerWidth,
            lang: document.documentElement.lang,
            h1: list('main h1').map((e) => e.textContent.trim()),
            main: list('main').length,
            skip: Boolean(
              document.querySelector('a[href="#contenu"]') &&
              document.getElementById('contenu'),
            ),
            missingAlt: list('img:not([alt])').length,
            unnamedControls: controls.filter(
              (e) =>
                !e.labels?.length &&
                !e.getAttribute('aria-label') &&
                !e.getAttribute('aria-labelledby') &&
                !e.title,
            ).length,
            canonical:
              document.querySelector('link[rel=canonical]')?.href ?? null,
            description:
              document.querySelector('meta[name=description]')?.content || null,
            schemas: [...schemas],
            invalidJsonLd,
            links: [
              ...new Set(
                list('a[href]')
                  .map((e) => e.href)
                  .filter((v) => v.startsWith(location.origin + '/'))
                  .map((v) => new URL(v).pathname),
              ),
            ],
          };
        });
        const bytes = { html: 0, css: 0, js: 0, images: 0, data: 0, other: 0 };
        for (const path of requests) {
          const item = assets.get(path);
          if (item) bytes[category(item.mime)] += item.bytes.length;
        }
        const missingTargets = [];
        for (const p of view.links)
          if (
            !p.startsWith('/api/v1/') &&
            p !== '/api/mcp' &&
            !p.startsWith('/stats/') &&
            !(await fileFor(p))
          )
            missingTargets.push(p);
        const { links, ...detail } = view;
        samples.push({
          ...detail,
          canonicalOK: view.canonical === 'https://polradar.fr' + route,
          largestResources: [...new Set(requests)]
            .map((path) => ({
              path,
              bytes: assets.get(path)?.bytes.length ?? 0,
            }))
            .sort((a, b) => b.bytes - a.bytes)
            .slice(0, 3),
          totalBytes: Object.values(bytes).reduce((s, v) => s + v, 0),
          bytes,
          requests: requests.length,
          internalLinks: links.length,
          missingTargets,
          failedRequests: [...broken],
          external: [...external],
        });
      } finally {
        await context.close();
      }
    }
    const last = samples.at(-1);
    pages.push({
      route,
      ...last,
      lcpMs: median(samples.map((s) => s.lcp)),
      cls: median(samples.map((s) => s.cls)),
      lcp: undefined,
      samples: samples.map((s) => ({
        lcpMs: s.lcp,
        cls: s.cls,
        totalBytes: s.totalBytes,
        dom: s.dom,
      })),
    });
    console.error('Mesuré', route);
  }
  const issues = pages
    .filter(
      (page) =>
        !page.canonicalOK ||
        !page.description ||
        page.h1.length !== 1 ||
        page.main !== 1 ||
        page.lang !== 'fr' ||
        !page.skip ||
        page.overflow ||
        page.missingAlt ||
        page.unnamedControls ||
        page.invalidJsonLd ||
        page.missingTargets.length ||
        page.failedRequests.length ||
        page.external.length,
    )
    .map((page) => page.route);
  if (issues.length) {
    console.error('Pages à revoir : ' + issues.join(', '));
    process.exitCode = 1;
  }
  console.log(
    JSON.stringify(
      {
        sourceCommit,
        measuredAt: new Date().toISOString(),
        chromium: browser.version(),
        processor: cpus()[0]?.model,
        runs,
        profile,
        issues,
        pages,
      },
      null,
      2,
    ),
  );
} finally {
  try {
    await browser?.close();
  } finally {
    await new Promise((ok) => server.close(ok));
  }
}
