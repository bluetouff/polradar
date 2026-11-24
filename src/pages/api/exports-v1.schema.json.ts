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
          required: ['id', 'url', 'description', 'droits'],
          properties: {
            id: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            description: { type: 'string' },
            unite: { type: 'string' },
            provenance: { type: 'string' },
            droits: {
              type: 'object',
              required: ['libelle', 'url', 'perimetre'],
              properties: {
                libelle: { type: 'string' },
                url: { type: ['string', 'null'], format: 'uri' },
                perimetre: { type: 'string' },
              },
            },
            limites: { type: 'string' },
            champs: { type: 'array', items: { type: 'string' } },
            documentation: { type: 'string', format: 'uri' },
            format: { const: 'application/json' },
            edition: { type: 'string', format: 'date' },
          },
        },
      },
    },
  });
}
