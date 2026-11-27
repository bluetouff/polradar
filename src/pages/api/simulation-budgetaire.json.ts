import { nationalBudget } from '../../lib/national-budget-data';

export function GET() {
  return Response.json(nationalBudget);
}
