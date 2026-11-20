import comptes from '../../data/comptes-presidentielle-2022.json';
import { sourceById } from '../../lib/data';
export function GET() {
  const source =
    sourceById('cnccfp-comptes-presidentielle-2022').url + '#page=35';
  const rows = comptes.map((c) =>
    [
      2022,
      c.candidat,
      c.depensesDeclarees,
      c.depensesRetenues,
      c.remboursement,
      source,
    ].join(';'),
  );
  return new Response(
    [
      'scrutin;candidat;depenses_declarees_eur;depenses_retenues_eur;remboursement_eur;source',
      ...rows,
      '',
    ].join('\r\n'),
    { headers: { 'Content-Type': 'text/csv; charset=utf-8' } },
  );
}
