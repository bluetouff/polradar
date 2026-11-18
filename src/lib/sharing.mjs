const segmenter = new Intl.Segmenter('fr', { granularity: 'grapheme' });
const graphemes = (value) =>
  [...segmenter.segment(value)].map((s) => s.segment);

/** Static intent links. No SDK, request, cookie, or visitor state is involved. */
export function shareLinks(title, canonical) {
  const page = new URL(String(canonical));
  if (page.origin !== 'https://polradar.fr' || page.username || page.password)
    throw new Error('Adresse de partage hors de Polradar');
  page.search = '';
  page.hash = '';
  const url = page.href;
  const clean = String(title)
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
  const characters = graphemes(clean || 'Polradar');
  const available = 300 - graphemes(url).length - 1;
  if (available < 1)
    throw new Error('Adresse trop longue pour un partage Bluesky');
  const limit = Math.min(160, available);
  const text =
    characters.length > limit
      ? characters.slice(0, Math.max(0, limit - 1)).join('') + '…'
      : characters.join('');
  const intent = (base, params) => {
    const link = new URL(base);
    link.search = new URLSearchParams(params).toString();
    return link.href;
  };
  return [
    {
      id: 'x',
      label: 'X',
      href: intent('https://twitter.com/intent/tweet', { text, url }),
    },
    {
      id: 'bluesky',
      label: 'Bluesky',
      href: intent('https://bsky.app/intent/compose', {
        text: `${text}\n${url}`,
      }),
    },
    {
      id: 'linkedin',
      label: 'LinkedIn',
      href: intent('https://www.linkedin.com/sharing/share-offsite/', { url }),
    },
    {
      id: 'facebook',
      label: 'Facebook',
      href: intent('https://www.facebook.com/sharer/sharer.php', { u: url }),
    },
    {
      id: 'mail',
      label: 'E-mail',
      href: `mailto:?subject=${encodeURIComponent(text)}&body=${encodeURIComponent(`${text}\n${url}`)}`,
    },
  ];
}
