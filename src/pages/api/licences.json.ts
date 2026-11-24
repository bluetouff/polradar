import { rights } from '../../lib/licences.mjs';
export function GET() {
  return Response.json({
    version: 1,
    documentation: 'https://polradar.fr/licences/',
    perimetres: rights.map(({ id, objet, licence, texte }) => ({
      id,
      objet,
      licence,
      texte,
    })),
  });
}
