import { createHash } from 'node:crypto';
import { escapeHtml } from './social-image-view.mjs';
import { meta } from './data';
import { isPublicSourceUrl } from './source-url.mjs';

export interface Graphic {
  svg: string;
  width: number;
  height: number;
  title: string;
  alt: string;
  dateLabel: string;
  sources: { label: string; url: string }[];
  page: string;
}

export function editionId(graphic: Graphic) {
  return createHash('sha256').update(graphic.svg).digest('hex');
}

function httpsUrl(value: string, local = false) {
  const url = new URL(value, meta.site);
  if (
    !isPublicSourceUrl(url.href) ||
    (local && url.origin !== new URL(meta.site).origin)
  ) {
    throw new Error('Adresse de publication invalide');
  }
  return escapeHtml(url.href);
}

export function publicationCode(
  graphic: Graphic,
  livePath: string,
  livePage: string,
  liveAlt: string,
  frozen: boolean,
) {
  const image = frozen
    ? 'data:image/svg+xml;base64,' + Buffer.from(graphic.svg).toString('base64')
    : httpsUrl(livePath, true);
  const page = httpsUrl(frozen ? graphic.page : livePage, true);
  const sources = frozen
    ? graphic.sources.map(
        (source) =>
          '<a href="' +
          httpsUrl(source.url) +
          '" rel="noreferrer">' +
          escapeHtml(source.label) +
          '</a>',
      )
    : [];
  const caption = [
    '<a href="' + page + '" rel="noreferrer">Polradar · données et méthode</a>',
    ...(frozen ? [escapeHtml(graphic.dateLabel), ...sources] : []),
  ].join(' · ');
  return (
    '<figure>\n  <img src="' +
    image +
    '" alt="' +
    escapeHtml(frozen ? graphic.alt : liveAlt) +
    '" width="' +
    graphic.width +
    '" height="' +
    graphic.height +
    '" style="max-width:100%;height:auto" loading="lazy" decoding="async" referrerpolicy="no-referrer">\n  <figcaption>' +
    caption +
    '</figcaption>\n</figure>'
  );
}
