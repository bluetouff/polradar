import { agenda } from '../../lib/visual-data';
import { candidates, sources } from '../../lib/data';
export function GET() {
  return new Response(
    JSON.stringify({
      ...agenda,
      candidates: candidates.filter(
        (c) =>
          agenda.events.some((e) => e.candidate === c.id) ||
          agenda.sourceChecks.some((s) => s.candidate === c.id),
      ),
      sources: sources.filter(
        (s) =>
          agenda.events.some(
            (e) => e.source === s.id || e.additionalSources?.includes(s.id),
          ) || agenda.sourceChecks.some((entry) => entry.source === s.id),
      ),
    }),
    { headers: { 'Content-Type': 'application/json; charset=utf-8' } },
  );
}
