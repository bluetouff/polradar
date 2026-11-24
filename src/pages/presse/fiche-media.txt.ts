import type { APIRoute } from 'astro';
import {
  pressAddress,
  pressDate,
  pressDescription,
  pressFigures,
  pressNumber,
} from '../../lib/press';

export const GET: APIRoute = () =>
  new Response(
    [
      'POLRADAR · FICHE MÉDIA',
      'Édition du ' + pressDate,
      '',
      pressDescription,
      '',
      ...pressFigures.map(
        ({ value, label }) => pressNumber(value) + ' ' + label,
      ),
      'Périmètre et décomptes : https://polradar.fr/statistiques/',
      '',
      'RESSOURCES POUR UNE RÉDACTION',
      'Comparer les générations face au droit des retraites : https://polradar.fr/comparer/retraites/',
      'Illustrer l’inflation avec les données Eurostat : https://polradar.fr/economie/inflation/',
      'Vérifier un scrutin nominatif : https://polradar.fr/votes/',
      'Logos : https://polradar.fr/marque/polradar.svg et https://polradar.fr/marque/polradar-clair.svg',
      'Méthode : https://polradar.fr/methode/',
      'Site, services et collecteurs : AGPL-3.0-only. Base originale : ODbL 1.0. Articles, illustrations et graphiques originaux : CC BY 4.0.',
      'SDK et exemples externes : MIT. Nom, logo et identité Polradar : droits réservés. Documents et données de tiers : licences d’origine.',
      'Crédits et conditions de réutilisation : https://polradar.fr/licences/',
      'Exports des jeux de données : https://polradar.fr/api/exports-v1.json',
      'Documentation API : https://polradar.fr/api/',
      'Documentation MCP : https://polradar.fr/mcp/documentation/',
      '',
      'PARTENARIATS ET CORRECTIONS',
      'Pour un partenariat, précisez votre média, le sujet, le format et la date de publication souhaitée.',
      'Pour une correction, joignez le lien et le passage concernés ainsi que le document de référence.',
      'Contact : ' + pressAddress,
      'Espace presse : https://polradar.fr/presse/',
      '',
    ].join('\n'),
    { headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  );
