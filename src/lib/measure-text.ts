export const sameSentence = (a: string, b: string) =>
  a.trim().replace(/[.!?…]+$/u, '') === b.trim().replace(/[.!?…]+$/u, '');

export function sourceCountLabel(refs: { sourceId: string }[]) {
  const count = new Set(refs.map((ref) => ref.sourceId)).size;
  return `${count} source${count > 1 ? 's' : ''}`;
}
