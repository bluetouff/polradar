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
      parlement: 1,
      senat: 1,
      'parlement-europeen': 1,
      sources: 1,
      droit: 1,
      verifications: 1,
      breves: 1,
      financements: 1,
      arcom: 1,
      graphiques: 1,
    },
  });
}
