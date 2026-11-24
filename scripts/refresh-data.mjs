import { catalogueSchema, mergeCatalogue } from '../src/lib/poll-catalogue.mjs';
import { readFile, rename, writeFile } from 'node:fs/promises';
import { pollSchema, sourceSchema } from '../src/lib/schema.mjs';
import { marketSnapshotSchema } from '../src/lib/markets.mjs';
import { economySchema } from '../src/lib/economy.mjs';

const root = new URL('../', import.meta.url);
const json = async (path) =>
  JSON.parse(await readFile(new URL(path, root), 'utf8'));
const data = (name) => 'src/data/' + name + '.json';
async function write(name, value) {
  const target = new URL(data(name), root);
  const temporary = new URL(target.href + '.tmp');
  await writeFile(temporary, JSON.stringify(value, null, 2) + '\n');
  await rename(temporary, target);
}

const noticeReport = await json('artifacts/polls-review/review.json');
const previousCatalogue = catalogueSchema.parse(
  await json(data('poll-catalogue')),
);
const catalogue = mergeCatalogue(previousCatalogue, noticeReport);
const newSources = sourceSchema.array().parse(noticeReport.sources);
const newPolls = pollSchema.array().parse(noticeReport.polls);
if (newSources.length || newPolls.length) {
  const added = new Set(newSources.map((source) => source.id));
  const referenced = new Set(newPolls.map((poll) => poll.noticeSource));
  if (
    newSources.length !== added.size ||
    added.size !== referenced.size ||
    [...added].some((id) => !referenced.has(id)) ||
    newSources.some((source) => {
      const url = new URL(source.url);
      return (
        source.kind !== 'institution' ||
        !/^notice-commission-[0-9]{4,6}[a-z]?$/.test(source.id) ||
        url.origin !== 'https://www.commission-des-sondages.fr' ||
        !/^\/notices\/medias\/fichiers\/add\/[1-9][0-9]{0,6}$/.test(
          url.pathname,
        ) ||
        url.search ||
        url.hash
      );
    })
  )
    throw new Error('Références des nouvelles notices invalides');

  const [published, sources] = await Promise.all([
    json(data('polls')),
    json(data('sources')),
  ]);
  const pollIds = new Set(published.map(({ id }) => id));
  const sourceIds = new Set(sources.map(({ id }) => id));
  if (
    new Set(newPolls.map(({ id }) => id)).size !== newPolls.length ||
    newPolls.some(({ id }) => pollIds.has(id)) ||
    newSources.some(({ id }) => sourceIds.has(id))
  )
    throw new Error('Notice ou scénario déjà intégré');

  await write('sources', [...sources, ...newSources]);
  await write('polls', [...published, ...newPolls]);
}

await write('poll-catalogue', catalogue);

if (!process.argv.includes('--polls-only')) {
  const [daily, previous] = await Promise.all([
    json('artifacts/markets-review.json').then((value) =>
      marketSnapshotSchema.parse(value),
    ),
    json(data('prediction-markets')).then((value) =>
      marketSnapshotSchema.parse(value),
    ),
  ]);
  const providers = daily.providers.map((provider) => {
    const last = previous.providers.find((row) => row.id === provider.id);
    if (last && Date.parse(provider.observedAt) < Date.parse(last.observedAt))
      throw new Error('Relevé de marché antérieur au relevé publié');
    return provider.status === 'unavailable' && last?.status === 'unavailable'
      ? last
      : provider;
  });
  if (JSON.stringify(providers) !== JSON.stringify(previous.providers))
    await write('prediction-markets', { version: daily.version, providers });

  let economy;
  try {
    economy = economySchema.parse(
      await json('artifacts/economy-review/economy.json'),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (economy) await write('economy', economy);
}
