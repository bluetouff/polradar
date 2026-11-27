import { normalize } from './features.mjs';
import lexicon from '../../mcp/lexique-recherche.json';

const openers = new Set(lexicon.questions.debuts.split(' '));
for (const opener of [
  'qui',
  'ou',
  'quand',
  'pourquoi',
  'combien',
  'comparer',
  'compare',
  'comparez',
  'verifier',
  'verifiez',
  'simuler',
  'simulez',
  'expliquer',
  'expliquez',
])
  openers.add(opener);

export function isDocumentaryQuestion(query: string) {
  const input = normalize(query);
  const start = input.match(/^[a-z]+/)?.[0];
  return Boolean(
    input.endsWith('?') ||
    (start && openers.has(start) && /[\s'’]/u.test(input)),
  );
}

export function documentaryKeywords(query: string) {
  const text = normalize(query);
  const qualified = text.match(
    /^(?:que (?:proposent|prevoient) les (?:candidats|candidatures|partis) (?:sur|pour|en matiere de)|comparer les propositions (?:relatives (?:au|aux|a)|sur))\s+(.+?)\s*\??$/u,
  );
  return qualified
    ? qualified[1].replace(/^(?:le|la|les|du|des)\s+|^l['’]/u, '')
    : query;
}
