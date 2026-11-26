import { sourceCommit } from '../../../scripts/release-revision.mjs';
import { meta, sourceById, versions } from '../../lib/data';
import { digitalLawAsOf, digitalLawSections } from '../../lib/digital-law-data';
import { voteCasePath } from '../../lib/legislative-votes.mjs';
import { budgetAssessments } from '../../lib/visual-data';
import { voteCases } from '../../lib/votes-data';
import { questions, type QuestionProposalRelation } from '../../lib/questions';

type Node = { id: string; type: string; url: string };
type Reference = { id: string; url: string; passage: string };
type Relation =
  | Omit<QuestionProposalRelation, 'id'>
  | {
      type:
        | 'version-precedente'
        | 'rapprochement-scrutin'
        | 'comparaison-droit'
        | 'poste-budgetaire';
      origin: Node;
      target: Node;
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

function versionNode(id: string): Node {
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

export function GET() {
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

  return Response.json({
    version: 1,
    sourceCommit,
    edition: meta.edition,
    relations,
  });
}
