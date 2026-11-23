import { budgetAssessments, programmeBudgets } from '../../lib/visual-data';
import { sources } from '../../lib/data';
export function GET() {
  const ids = new Set(
    budgetAssessments.flatMap((e) => [
      e.source,
      ...(e.additionalSources ?? []),
    ]),
  );
  return Response.json({
    version: 1,
    checked: programmeBudgets.checked,
    entries: budgetAssessments,
    sources: sources.filter((s) => ids.has(s.id)),
  });
}
