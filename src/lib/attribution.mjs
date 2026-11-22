import authors from '../data/document-authors.json' with { type: 'json' };

export const unspecifiedCollective = 'Document de parti';

/** @param {string} id @returns {{author:string, locator:string, checked:string} | null} */
export function documentCredit(id) {
  return Object.hasOwn(authors, id) ? authors[id] : null;
}

/** A dossier can contain a party programme, a signed contribution or an individual declaration. */
export function collectiveLabel(record) {
  if (record.partyAuthor) return record.partyAuthor;
  if (record.scope !== 'parti') return null;
  const ids =
    record.sourceRefs?.map((ref) => ref.sourceId) ?? record.sources ?? [];
  const author = ids.length ? documentCredit(ids[0])?.author : null;
  return author && ids.every((id) => documentCredit(id)?.author === author)
    ? author
    : unspecifiedCollective;
}

export function attributionLabel(record, candidateName) {
  return collectiveLabel(record) ?? candidateName;
}
