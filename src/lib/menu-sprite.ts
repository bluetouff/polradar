import { createHash } from 'node:crypto';
import { groups } from './navigation';
import { iconPaths } from './icons.mjs';

// These controls already have text labels. The shared mask supplies only their artwork.
const decorations: Record<string, string> = {
  chevron: '.site-nav-group summary::after',
  share: '.page-share-label::before',
  external: '.footer-meta a::after',
  mail: '.page-share a[data-share-platform="mail"]::before',
  suivi: '.footer-follow::before',
  arrow: '.footer-follow::after,.footer-bottom>a::after',
};
const icons = [
  ...new Set([
    ...groups.flatMap((g) => [g.icon, ...g.links.map((link) => link[2])]),
    ...Object.keys(decorations),
  ]),
].sort();
const paths = icons.map((id) => {
  if (!Object.hasOwn(iconPaths, id) || !/^[a-z][a-z0-9-]*$/.test(id))
    throw new Error('Icône de navigation inconnue');
  const path = iconPaths[id as keyof typeof iconPaths];
  if (!/^[a-zA-Z0-9.,+\s-]+$/.test(path))
    throw new Error('Tracé de navigation invalide');
  return path;
});
const side = 24,
  height = side * icons.length;
const strokes = paths
  .map((d, i) => `<path transform="translate(0 ${i * side})" d="${d}"/>`)
  .join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${side}" height="${height}" viewBox="0 0 ${side} ${height}"><g fill="none" stroke="#000" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${strokes}</g></svg>`;
const digest = (value: string) =>
  createHash('sha256').update(value).digest('hex').slice(0, 16);
const imageFile = digest(svg) + '.svg';
const navLinks = groups.flatMap((group) => group.links);
const css =
  `:where(.site-nav-group .desk-links a,.site-nav-group summary,.footer-columns h2,.footer-follow,.page-share-label,.page-share a[data-share-platform="mail"])::before,:where(.site-nav-group summary,.footer-follow,.footer-meta a,.footer-bottom>a)::after{content:"";display:inline-block;flex:none;width:var(--pic-size,1rem);height:var(--pic-size,1rem);background:currentColor;mask-image:url("/pictos-menu/${imageFile}");mask-repeat:no-repeat;mask-size:100% auto;mask-position:0 var(--menu-y)}` +
  icons
    .map(
      (id, i) =>
        `${[`.menu-${id}`, ...navLinks.filter((link) => link[2] === id).map(([href]) => `.site-navigation a[href="${href}"]`), decorations[id]].filter(Boolean).join(',')}{--menu-y:${((i * 100) / Math.max(1, icons.length - 1)).toFixed(6)}%}`,
    )
    .join('');
const styleFile = digest(css) + '.css';
export const menuStyle = '/pictos-menu/' + styleFile;
export const menuAssets = [
  { file: imageFile, mime: 'image/svg+xml', body: svg },
  { file: styleFile, mime: 'text/css', body: css },
];
