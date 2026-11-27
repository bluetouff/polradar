import { sourceById, versions } from './data';
import { digitalLawAsOf, digitalLawSections } from './digital-law-data';
import { voteCasePath } from './legislative-votes.mjs';
import { budgetAssessments } from './visual-data';
import { voteCases } from './votes-data';
import { questions, type QuestionProposalRelation } from './questions';

export type DocumentaryNode = { id: string; type: string; url: string };
type Reference = { id: string; url: string; passage: string };
const endOfLifeQuestion = 'sante-aide-a-mourir';
const endOfLifeLaw = 'loi-2026-794';
const endOfLifeBallot = 'VTANR5L17V8280';
type Relation =
  | Omit<QuestionProposalRelation, 'id'>
  | {
      type:
        | 'version-precedente'
        | 'rapprochement-scrutin'
        | 'comparaison-droit'
        | 'poste-budgetaire';
      origin: DocumentaryNode;
      target: DocumentaryNode;
      qualification: string;
      justification: string;
      date: { type: string; value: string } | null;
      sources: Reference[];
    };

const versionById = new Map(versions.map((version) => [version.id, version]));
const versionsByMeasure = new Map<
  string,
  Map<number, (typeof versions)[number]>
>();
for (const version of versions) {
  let history = versionsByMeasure.get(version.measureId);
  if (!history) {
    history = new Map();
    versionsByMeasure.set(version.measureId, history);
  }
  history.set(version.number, version);
}

function versionNode(id: string): DocumentaryNode {
  const version = versionById.get(id);
  if (!version)
    throw new Error(
      `Version absente dans les relations documentaires (${id}).`,
    );
  return {
    id,
    type: 'version',
    url: `/mesures/${version.measureId}/#version-${version.number}`,
  };
}

function buildRelations() {
  const relations: (Relation & { id: string })[] = [];
  const seen = new Set<string>();
  function add(relation: Relation, expectedId?: string) {
    const { type, origin, target, justification, sources } = relation;
    const id = `${type}:${origin.id}:${target.id}`;
    if (
      (expectedId && expectedId !== id) ||
      seen.has(id) ||
      !justification.trim() ||
      !sources.length
    )
      throw new Error(`Relation documentaire incomplète ou en double (${id}).`);
    seen.add(id);
    relations.push({ id, ...relation });
  }

  for (const question of questions) {
    for (const { id, ...relation } of question.relations) add(relation, id);
  }

  const endOfLife = questions.find(({ id }) => id === endOfLifeQuestion)!;
  const endOfLifeNode = {
    id: endOfLife.id,
    type: 'question',
    url: endOfLife.href,
  };
  const lawUrl = 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000054706877';
  add({
    type: 'comparaison-droit',
    origin: endOfLifeNode,
    target: { id: endOfLifeLaw, type: 'droit-en-vigueur', url: lawUrl },
    qualification: 'mise-en-regard-editoriale',
    justification:
      'La loi du 18 août 2026 crée le droit à l’aide à mourir. Son article 4 définit les conditions d’accès dans le code de la santé publique.',
    date: { type: 'promulgation', value: '2026-08-18' },
    sources: [
      {
        id: endOfLifeLaw,
        url: lawUrl,
        passage: 'Journal officiel du 19 août 2026 · articles 2 et 4',
      },
    ],
  });
  const ballotUrl = 'https://www.assemblee-nationale.fr/dyn/17/scrutins/8280';
  add({
    type: 'rapprochement-scrutin',
    origin: endOfLifeNode,
    target: { id: endOfLifeBallot, type: 'scrutin', url: ballotUrl },
    qualification: 'meme-objet',
    justification:
      'En lecture définitive, le relevé enregistre Marine Le Pen contre et Gabriel Attal pour. L’Assemblée adopte le texte par 291 voix contre 241, avec 29 abstentions.',
    date: { type: 'seance', value: '2026-07-15' },
    sources: [
      {
        id: endOfLifeBallot,
        url: ballotUrl,
        passage:
          'Scrutin n° 8280 · synthèse et répartition des votes par groupe',
      },
    ],
  });

  for (const version of versions) {
    const previous = versionsByMeasure
      .get(version.measureId)
      ?.get(version.number - 1);
    if (!previous) continue;
    add({
      type: 'version-precedente',
      origin: versionNode(version.id),
      target: versionNode(previous.id),
      qualification: version.kind,
      justification: 'Deux versions consécutives de la même fiche.',
      date: version.recordedAt
        ? { type: 'enregistrement', value: version.recordedAt }
        : null,
      sources: version.snapshot.sourceRefs.map((reference) => {
        const source = sourceById(reference.sourceId);
        return {
          id: source.id,
          url: reference.fragment
            ? source.url.split('#')[0] + '#' + reference.fragment
            : source.url,
          passage: reference.locator,
        };
      }),
    });
  }

  for (const dossier of voteCases) {
    for (const ballot of dossier.ballots) {
      add({
        type: 'rapprochement-scrutin',
        origin: versionNode(dossier.versionId),
        target: {
          id: ballot.id,
          type: 'scrutin',
          url: voteCasePath(dossier.id),
        },
        qualification: ballot.link.relation,
        justification: ballot.link.context,
        date: { type: 'seance', value: ballot.date },
        sources: [
          {
            id: ballot.id,
            url: ballot.rollCall.url,
            passage: ballot.rollCall.locator,
          },
        ],
      });
    }
  }

  for (const section of digitalLawSections) {
    for (const item of section.cases) {
      const references = new Map(
        item.rules
          .flatMap((rule) => rule.refs)
          .map((ref) => [
            JSON.stringify([ref.sourceId, ref.label]),
            { id: ref.sourceId, url: ref.url, passage: ref.label },
          ]),
      );
      for (const change of item.changes) {
        add({
          type: 'comparaison-droit',
          origin: versionNode(change.versionId),
          target: { id: item.id, type: 'droit-en-vigueur', url: item.href },
          qualification: 'mise-en-regard-editoriale',
          justification: change.body,
          date: { type: 'droit-verifie-le', value: digitalLawAsOf },
          sources: [...references.values()],
        });
      }
    }
  }

  for (const budget of budgetAssessments) {
    for (const target of budget.targets) {
      const references = [budget.source, ...(budget.additionalSources ?? [])];
      const linked =
        versionById
          .get(target.versionId)
          ?.snapshot.sourceRefs.filter((reference) =>
            references.includes(reference.sourceId),
          ) ?? [];
      add({
        type: 'poste-budgetaire',
        origin: versionNode(target.versionId),
        target: {
          id: budget.id,
          type: 'montant',
          url: `/budget-programmes/#${budget.id}`,
        },
        qualification: budget.status,
        justification: target.locator,
        date: budget.reviewedOn
          ? { type: 'relecture', value: budget.reviewedOn }
          : null,
        sources: linked.map(({ sourceId }) => ({
          id: sourceId,
          url: sourceById(sourceId).url,
          passage: target.locator,
        })),
      });
    }
  }

  return relations;
}

export const documentaryRelations = buildRelations();
export type DocumentaryRelation = (typeof documentaryRelations)[number];

const relationsByNode = new Map<string, DocumentaryRelation[]>();
for (const relation of documentaryRelations) {
  for (const id of [relation.origin.id, relation.target.id]) {
    const related = relationsByNode.get(id) ?? [];
    related.push(relation);
    relationsByNode.set(id, related);
  }
}

export function relationsFor(ids: readonly string[]) {
  return [...new Set(ids.flatMap((id) => relationsByNode.get(id) ?? []))];
}

const labels = new Map<string, string>([
  [endOfLifeLaw, 'Loi du 18 août 2026 relative au droit à l’aide à mourir'],
  [
    endOfLifeBallot,
    'Adoption définitive à l’Assemblée nationale · scrutin n° 8280',
  ],
  ...questions.map((question) => [question.id, question.title] as const),
  ...versions.map((version) => [version.id, version.snapshot.title] as const),
  ...voteCases.flatMap((dossier) =>
    dossier.ballots.map((ballot) => [ballot.id, ballot.title] as const),
  ),
  ...digitalLawSections.flatMap((section) =>
    section.cases.map((item) => [item.id, item.label] as const),
  ),
  ...budgetAssessments.map((entry) => [entry.id, entry.label] as const),
]);

export function documentaryLabel(node: DocumentaryNode) {
  return labels.get(node.id) ?? node.id;
}
