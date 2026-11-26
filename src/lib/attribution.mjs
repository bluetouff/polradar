import authors from '../data/document-authors.json' with { type: 'json' };

export const unspecifiedCollective = 'Document de parti';

/** @param {string} id @returns {{author:string, locator:string, checked:string, campaignAttribution?:true} | null} */
export function documentCredit(id) {
  return Object.hasOwn(authors, id) ? authors[id] : null;
}

/** A dossier can contain a party programme, a signed contribution or an individual declaration. */
export function collectiveLabel(record) {
  if (record.partyAuthor) return record.partyAuthor;
  const party = record.scope === 'parti';
  if (!party && record.scope !== 'campagne') return null;
  const ids =
    record.sourceRefs?.map((ref) => ref.sourceId) ?? record.sources ?? [];
  const credits = ids.map(documentCredit);
  const author = credits[0]?.author;
  if (
    author &&
    credits.every(
      (credit) =>
        credit?.author === author && (party || credit.campaignAttribution),
    )
  )
    return author;
  return party ? unspecifiedCollective : null;
}

export function attributionLabel(record, candidateName) {
  return collectiveLabel(record) ?? candidateName;
}
