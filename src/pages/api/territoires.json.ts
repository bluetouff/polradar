import { readFileSync } from 'node:fs';
import { updateCommuneIndex } from '../../lib/communes.mjs';
import changes from '../../data/territoires/annuaire.json';
import sru from '../../data/territoires/sru.json';
import apl from '../../data/territoires/apl.json';
import {
  sruSource,
  aplSource,
  sruPage,
  aplPage,
} from '../../lib/dossiers-territoriaux';

export function GET() {
  const index = JSON.parse(
    readFileSync('public/data/communes/2022/index.json', 'utf8'),
  );
  return Response.json({
    version: 1,
    names: Object.fromEntries(updateCommuneIndex(index, changes)),
    sru,
    apl,
    definitions: {
      sru: {
        unite: '% des résidences principales',
        inventaire: '2025-01-01',
        perimetre: '2026-01-01',
        exemption: '2026 à 2028',
        source: sruSource,
        dossier: 'https://polradar.fr' + sruPage,
      },
      apl: {
        unite: 'consultations accessibles par an et par habitant standardisé',
        millesime: 2024,
        source: aplSource,
        dossier: 'https://polradar.fr' + aplPage,
        champ:
          'Médecins généralistes, hors Mayotte. Paris, Lyon et Marseille sont pondérées par la population standardisée de leurs arrondissements.',
      },
    },
  });
}
