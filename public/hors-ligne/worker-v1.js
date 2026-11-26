/* Ce worker ne sert que les ressources versionnées du lecteur. */
const cacheName = 'polradar-lecteur-v1';
const budget = 64 * 1024;
const assets = new Map([
  ['/hors-ligne/v1/', ['text/html']],
  ['/hors-ligne/lecteur-v1.js', ['text/javascript', 'application/javascript']],
  ['/hors-ligne/lecteur-v1.css', ['text/css']],
]);

async function installReader() {
  const cache = await caches.open(cacheName);
  if (
    (
      await Promise.all([...assets.keys()].map((path) => cache.match(path)))
    ).every(Boolean)
  )
    return;
  const downloaded = [];
  const signal = AbortSignal.timeout(10000);
  let remaining = budget;
  for (const [path, types] of assets) {
    const response = await fetch(path, {
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal,
    });
    const type = response.headers.get('Content-Type') || '';
    if (
      response.status !== 200 ||
      !types.includes(type.split(';')[0]) ||
      !response.body
    )
      throw Error('Ressource du lecteur indisponible');
    const chunks = [];
    const stream = response.body.getReader();
    try {
      for (;;) {
        const { value, done } = await stream.read();
        if (done) break;
        remaining -= value.byteLength;
        if (remaining < 0) throw Error('Lecteur trop volumineux');
        chunks.push(value);
      }
    } finally {
      await stream.cancel();
    }
    const headers = new Headers({ 'Content-Type': type });
    for (const name of [
      'Content-Security-Policy',
      'Permissions-Policy',
      'Referrer-Policy',
      'X-Content-Type-Options',
      'X-Frame-Options',
    ]) {
      const value = response.headers.get(name);
      if (value) headers.set(name, value);
    }
    downloaded.push([path, new Response(new Blob(chunks), { headers })]);
  }
  for (const [path, response] of downloaded) await cache.put(path, response);
}

self.addEventListener('install', (event) => {
  event.waitUntil(installReader().then(() => self.skipWaiting()));
});
self.addEventListener('activate', (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method === 'GET' &&
    url.origin === self.location.origin &&
    !url.search &&
    assets.has(url.pathname)
  )
    event.respondWith(
      caches
        .match(event.request, { cacheName })
        .then((copy) => copy ?? fetch(event.request)),
    );
});
