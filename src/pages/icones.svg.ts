import type { APIRoute } from 'astro';
import { iconPaths } from '../lib/icons.mjs';

export const GET: APIRoute = () => {
  const paths = Object.entries(iconPaths).map(([id, path]) => {
    if (!/^[a-z][a-z0-9-]*$/.test(id) || !/^[a-zA-Z0-9.,+\s-]+$/.test(path))
      throw new Error('Tracé d’icône invalide');
    return `<path id="${id}" d="${path}"/>`;
  });
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg"><defs>${paths.join('')}</defs></svg>`,
    {
      headers: { 'Content-Type': 'image/svg+xml;charset=utf-8' },
    },
  );
};
