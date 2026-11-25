import type { APIRoute } from 'astro';
import { sourceCommit } from '../../../scripts/release-revision.mjs';
import {
  questionCoverage,
  coverageByTheme,
  questionCoverageWithdrawals,
} from '../../lib/question-coverage';

export const GET: APIRoute = () =>
  Response.json({
    version: 1,
    sourceCommit,
    unit: 'couple question-candidature',
    examinedScope:
      'Candidature active dont au moins un passage a été relié à la question ou dont une pièce a été explicitement relue pour cette question.',
    states: {
      mesure:
        'Proposition de campagne reliée à une publication de programme ou assimilée',
      declaration:
        'Déclaration publique documentée sans publication de programme reliée',
      orientation: 'Orientation sans dispositif précis',
      parti: 'Document collectif relié, avec attribution distincte',
      revue: 'Document examiné sans proposition reliée à la question',
      'a-examiner': 'Aucun passage ni examen ciblé enregistré',
    },
    documentTypeUnit:
      'couples avec au moins un document du type indiqué, catégories cumulables',
    excludedWithdrawals: questionCoverageWithdrawals,
    questions: questionCoverage,
    themes: coverageByTheme,
  });
