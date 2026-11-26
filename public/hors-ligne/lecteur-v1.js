const readerPath = '/hors-ligne/v1/';
const workerPath = '/hors-ligne/worker-v1.js';
const scopePath = '/hors-ligne/';
const cacheName = 'polradar-lecteur-v1';
const key = 'polradar-fiche-hors-ligne-v1';
const maxBytes = 48 * 1024;
const idPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const revisionPattern = /^[a-f0-9]{40}$/;
const shell = [
  readerPath,
  '/hors-ligne/lecteur-v1.js',
  '/hors-ligne/lecteur-v1.css',
];

function text(node) {
  return node?.textContent?.replace(/\s+/g, ' ').trim() || '';
}

function publicLink(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

function validDay(value) {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function valid(snapshot) {
  const string = (value) => typeof value === 'string' && value.length > 0;
  return (
    snapshot?.format === 1 &&
    string(snapshot.id) &&
    snapshot.id.length <= 100 &&
    idPattern.test(snapshot.id) &&
    string(snapshot.revision) &&
    revisionPattern.test(snapshot.revision) &&
    validDay(snapshot.edition) &&
    Number.isInteger(snapshot.version) &&
    snapshot.version > 0 &&
    string(snapshot.savedAt) &&
    Number.isFinite(Date.parse(snapshot.savedAt)) &&
    [snapshot.title, snapshot.author, snapshot.description].every(string) &&
    Array.isArray(snapshot.sources) &&
    snapshot.sources.length > 0 &&
    snapshot.sources.every(
      (source) =>
        string(source?.title) &&
        string(source.passage) &&
        string(source.url) &&
        publicLink(source.url),
    )
  );
}

async function fingerprint(snapshot) {
  const bytes = new TextEncoder().encode(JSON.stringify(snapshot));
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(hash, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}

async function read() {
  try {
    const raw = localStorage.getItem(key);
    if (
      raw &&
      raw.length <= maxBytes &&
      new TextEncoder().encode(raw).byteLength <= maxBytes
    ) {
      const { sha256, ...snapshot } = JSON.parse(raw);
      if (valid(snapshot) && sha256 === (await fingerprint(snapshot)))
        return snapshot;
    }
  } catch {
    // Une copie indisponible laisse la lecture publique accessible.
  }
  return null;
}

function copyExists() {
  try {
    return localStorage.getItem(key) !== null;
  } catch {
    return false;
  }
}

function capture(panel) {
  const sources = document.querySelector('#sources')?.closest('section');
  const credit = document.querySelector('.page-title .measure-meta');
  return {
    format: 1,
    id: panel.dataset.offlineMeasure,
    version: Number(panel.dataset.ficheVersion),
    revision: document.querySelector('meta[name="polradar-copy-revision"]')
      ?.content,
    edition: document.querySelector('time[data-polradar-date="edition"]')
      ?.dateTime,
    savedAt: new Date().toISOString(),
    title: text(document.querySelector('.page-title h1')),
    author: Array.from(credit?.childNodes ?? [], text)
      .filter(Boolean)
      .join(' · '),
    description: text(document.querySelector('.measure-lead')),
    sources: [
      ...(sources?.querySelectorAll('.precise-sources > li') ?? []),
    ].map((row) => {
      const link = row.querySelector('a[href]');
      return {
        title: text(link),
        url: link?.href,
        passage: text(row.querySelector('p')),
      };
    }),
  };
}

async function activated(registration) {
  const worker =
    registration.active ?? registration.installing ?? registration.waiting;
  if (worker?.state === 'activated') return;
  if (!worker) throw Error('Lecteur indisponible');
  await new Promise((resolve, reject) => {
    const done = (error) => {
      clearTimeout(timeout);
      worker.removeEventListener('statechange', check);
      error ? reject(error) : resolve();
    };
    const check = () => {
      if (worker.state === 'activated') done();
      if (worker.state === 'redundant') done(Error('Lecteur indisponible'));
    };
    const timeout = setTimeout(
      () => done(Error('Installation interrompue')),
      12000,
    );
    worker.addEventListener('statechange', check);
    check();
  });
}

async function shellReady() {
  return (
    await Promise.all(shell.map((path) => caches.match(path, { cacheName })))
  ).every(Boolean);
}

async function prepareReader() {
  const scope = new URL(scopePath, location.origin).href;
  const existing = await navigator.serviceWorker.getRegistration(readerPath);
  if (existing?.scope === scope && existing.active && !(await shellReady()))
    await existing.unregister();
  const registration = await navigator.serviceWorker.register(workerPath, {
    scope: scopePath,
  });
  await activated(registration);
  if (!(await shellReady())) throw Error('Lecteur incomplet');
}

function setupSave(panel) {
  const save = panel.querySelector('button');
  const status = panel.querySelector('[role="status"]');
  const link = panel.querySelector('a');
  read().then((copy) => {
    link.hidden = !copy;
  });
  panel.hidden = false;
  save.addEventListener('click', async () => {
    save.disabled = true;
    status.textContent = 'Préparation de la copie…';
    try {
      await navigator.locks.request(key, async () => {
        const snapshot = capture(panel);
        if (
          !valid(snapshot) ||
          location.pathname !== `/mesures/${snapshot.id}/`
        )
          throw Error('Fiche indisponible');
        const raw = JSON.stringify({
          ...snapshot,
          sha256: await fingerprint(snapshot),
        });
        if (new TextEncoder().encode(raw).byteLength > maxBytes)
          throw Error('Fiche trop volumineuse');
        await prepareReader();
        localStorage.setItem(key, raw);
      });
      link.hidden = false;
      status.textContent = 'Fiche disponible hors connexion.';
    } catch {
      status.textContent = 'La copie n’a pas pu être enregistrée.';
    } finally {
      save.disabled = false;
    }
  });
}

const time = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeStyle: 'short',
  timeZone: 'Europe/Paris',
});
const day = new Intl.DateTimeFormat('fr-FR', {
  dateStyle: 'long',
  timeZone: 'Europe/Paris',
});

function setupReader(reader) {
  const empty = reader.querySelector('[data-empty]');
  const record = reader.querySelector('[data-record]');
  const network = reader.querySelector('[data-network]');
  const erase = reader.querySelector('[data-erase]');
  const make = (name, content) => {
    const node = document.createElement(name);
    node.textContent = content;
    return node;
  };
  const connection = () => {
    network.textContent = navigator.onLine
      ? 'En ligne · copie locale'
      : 'Hors connexion';
  };
  let generation = 0;
  const render = async () => {
    const current = ++generation;
    const snapshot = await read();
    const cacheExists = await caches.has(cacheName).catch(() => false);
    if (current !== generation) return;
    empty.hidden = Boolean(snapshot);
    record.hidden = !snapshot;
    erase.hidden = !copyExists() && !cacheExists;
    if (!snapshot) {
      record.querySelector('h2').replaceChildren();
      for (const node of record.querySelectorAll(
        '[data-author], [data-description], [data-metadata], [data-sources]',
      ))
        node.replaceChildren();
      record.querySelector('[data-original]').removeAttribute('href');
      return;
    }
    record.querySelector('h2').textContent = snapshot.title;
    record.querySelector('[data-author]').textContent = snapshot.author;
    record.querySelector('[data-description]').textContent =
      snapshot.description;
    record.querySelector('[data-metadata]').replaceChildren(
      ...[
        [
          'Date de l’édition',
          day.format(new Date(`${snapshot.edition}T12:00:00Z`)),
        ],
        ['Révision de l’édition', snapshot.revision],
        ['Version de la fiche', String(snapshot.version)],
        [
          'Copie enregistrée le',
          time.format(new Date(snapshot.savedAt)) + ' (heure de Paris)',
        ],
      ].flatMap(([label, value]) => [make('dt', label), make('dd', value)]),
    );
    record.querySelector('[data-sources]').replaceChildren(
      ...snapshot.sources.map((source) => {
        const row = make('li', '');
        const link = make('a', source.title);
        link.href = source.url;
        link.rel = 'noreferrer';
        row.append(link, make('p', source.passage));
        return row;
      }),
    );
    record.querySelector('[data-original]').href = `/mesures/${snapshot.id}/`;
  };
  erase.addEventListener('click', async () => {
    erase.disabled = true;
    try {
      await navigator.locks.request(key, async () => {
        localStorage.removeItem(key);
        await caches.delete(cacheName);
        const registration =
          await navigator.serviceWorker.getRegistration(readerPath);
        if (registration?.scope === new URL(scopePath, location.origin).href)
          await registration.unregister();
      });
      await render();
      empty.textContent = 'Copie et cache effacés de cet appareil.';
      empty.setAttribute('tabindex', '-1');
      empty.focus();
    } catch {
      render();
      network.textContent = 'L’effacement complet n’a pas abouti.';
    } finally {
      erase.disabled = false;
    }
  });
  for (const event of ['online', 'offline'])
    window.addEventListener(event, connection);
  window.addEventListener('storage', (event) => {
    if (event.key === key || event.key === null) render();
  });
  connection();
  render();
}

const panel = document.querySelector('[data-offline-measure]');
const reader = document.querySelector('[data-offline-reader]');
if (
  'serviceWorker' in navigator &&
  'caches' in window &&
  'locks' in navigator
) {
  if (panel && document.querySelector('meta[name="polradar-copy-revision"]'))
    setupSave(panel);
  if (reader) setupReader(reader);
} else if (reader) {
  reader.querySelector('[data-empty]').textContent =
    'Lecture locale indisponible dans ce navigateur.';
}
