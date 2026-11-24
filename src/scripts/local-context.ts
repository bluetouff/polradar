import elections from '../data/communes-2022.json';
import { communeCode, communeDataPath, readCommune } from '../lib/communes.mjs';
import {
  localContext,
  territoryDepartment,
  type Department,
} from '../lib/local-context';
async function json(path: string) {
  const r = await fetch(path, {
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  });
  if (!r.ok) throw Error('Données locales indisponibles');
  return r.json() as Promise<unknown>;
}
export function territoryContext(root: HTMLElement, aplUrl: string) {
  const areas = JSON.parse(root.dataset.areas!) as Department[];
  let health: Promise<unknown> | undefined;
  return async (code: string, current: () => boolean) => {
    if (!communeCode.test(code)) return;
    health ??= json(aplUrl).catch((e) => {
      health = undefined;
      throw e;
    });
    const [healthResult, ballots] = await Promise.allSettled([
      health,
      json(communeDataPath + code.slice(0, 2) + '.json'),
    ]);
    if (!current()) return;
    const map = healthResult.status === 'fulfilled' ? healthResult.value : null;
    const raw =
      map && typeof map === 'object' && Object.hasOwn(map, code)
        ? (map as Record<string, unknown>)[code]
        : null;
    const apl =
      typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;
    let record: ReturnType<typeof readCommune> | null = null;
    if (ballots.status === 'fulfilled' && Array.isArray(ballots.value)) {
      const row = ballots.value.find(
        (r: unknown) => Array.isArray(r) && r[0] === code,
      );
      if (row)
        record = readCommune(
          row,
          code,
          elections.rounds.map((r) => r.candidates.length),
        );
    }
    for (const f of localContext(
      apl,
      territoryDepartment(code, areas),
      record,
    )) {
      const term = root.querySelector('[data-context-field="' + f.key + '"]')!;
      term.querySelector('dt span')!.textContent = f.label;
      term.querySelector('dd')!.textContent = f.value;
    }
    for (const link of root.querySelectorAll<HTMLAnchorElement>(
      '[data-local-topic]',
    ))
      link.href = link.dataset.localTopic + '#commune=' + code;
    const vote = root.querySelector<HTMLAnchorElement>(
      '[data-local-election]',
    )!;
    vote.hidden = !record?.[3];
    vote.href = '/communes/#commune=' + code;
  };
}
