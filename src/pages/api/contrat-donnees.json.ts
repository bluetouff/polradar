export function GET() {
  return Response.json({
    version: 1,
    collections: {
      corpus: 1,
      dossiers: 1,
      territoires: 1,
      sondages: 1,
      economie: 1,
      agenda: 1,
      budgets: 1,
      marches: 1,
    },
  });
}
