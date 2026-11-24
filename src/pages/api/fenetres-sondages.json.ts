import calendar from '../../data/fenetres-sondages.json';

export function GET() {
  return Response.json(calendar);
}
