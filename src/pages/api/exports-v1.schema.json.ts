export function GET() {
  return Response.json({
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    required: [
      'version',
      'edition',
      'revision',
      'contrat',
      'archive',
      'licence',
      'jeux',
    ],
    properties: {
      version: { const: 1 },
      edition: { type: 'string', format: 'date' },
      revision: { type: 'string', format: 'uri' },
      contrat: { type: 'string', format: 'uri' },
      sourceCommit: { type: ['string', 'null'], pattern: '^[a-f0-9]{40}$' },
      archive: { type: ['string', 'null'], format: 'uri' },
      licence: { type: 'object', required: ['originaux', 'texte', 'tiers'] },
      jeux: {
        type: 'array',
        items: {
          type: 'object',
          required: ['id', 'url', 'description'],
          properties: {
            id: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            description: { type: 'string' },
          },
        },
      },
    },
  });
}
