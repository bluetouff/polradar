import { readFile, writeFile, rename } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { airtimeSchema, compileArcom } from '../src/lib/airtime.mjs';

// Compile the verified daily files locally. The default writes a preview.
const root = new URL('../', import.meta.url);
const directory = new URL('artifacts/airtime-review/', root);
const manifest = JSON.parse(
  await readFile(new URL('manifest.json', directory), 'utf8'),
);
const refresh = process.argv.includes('--refresh');
if (refresh && manifest.status === 'unavailable') {
  console.log('Arcom indisponible. Relevé publié conservé.');
  process.exit(0);
}
if (
  manifest.version !== 1 ||
  !['review', 'unchanged'].includes(manifest.status) ||
  !Array.isArray(manifest.months) ||
  manifest.months.length < 1 ||
  manifest.months.length > 3
)
  throw new Error('Relevé indisponible ou invalide');
const months = [];
for (const row of manifest.months) {
  if (!/^202[5-9]-(0[1-9]|1[0-2])$/.test(row.month))
    throw new Error('Période invalide');
  const raw = await readFile(new URL(`${row.month}.csv`, directory));
  if (
    raw.length > 2000000 ||
    createHash('sha256').update(raw).digest('hex') !== row.sha256
  )
    throw new Error('Empreinte de fichier incorrecte');
  months.push({
    month: row.month,
    sourceUrl: row.sourceUrl,
    sha256: row.sha256,
    services: compileArcom(
      new TextDecoder('utf-8', { fatal: true }).decode(raw),
    ),
  });
}
const source = new URL('src/data/airtime.json', root);
if (refresh) {
  const previous = airtimeSchema.parse(
    JSON.parse(await readFile(source, 'utf8')),
  );
  if (manifest.checked < previous.checked)
    throw new Error('Consultation Arcom antérieure à la dernière publication');
  months.push(
    ...previous.months.filter(
      (month) => !months.some((row) => row.month === month.month),
    ),
  );
}
months.sort((a, b) => b.month.localeCompare(a.month));
const snapshot = airtimeSchema.parse({
  version: 1,
  checked: manifest.checked,
  months,
});
const write = refresh || process.argv.includes('--write');
const destination = write ? source : new URL('snapshot.json', directory);
const temporary = new URL(destination.href + '.tmp');
await writeFile(temporary, JSON.stringify(snapshot, null, 2) + '\n');
await rename(temporary, destination);
console.log(
  `${snapshot.months.length} relevés validés. ${write ? 'Données locales mises à jour.' : 'Aperçu : artifacts/airtime-review/snapshot.json.'}`,
);
