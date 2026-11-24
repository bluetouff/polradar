import type { Graphic } from './chart-publication';
import { escapeHtml as esc } from './escape-html.mjs';
import { wrapLabel } from './proposal-view.mjs';

interface Line {
  name: string;
  reading: string;
  value?: number | null;
}
interface Card {
  title: string;
  desk: string;
  date: string;
  lines: Line[];
  note: string;
  sources: Graphic['sources'];
  page: string;
  scale?: number;
}

export function studioCard({
  title,
  desk,
  date,
  lines,
  note,
  sources,
  page,
  scale,
}: Card): Graphic {
  const width = 640;
  let y = 45;
  function linesAt(
    value: string,
    limit: number,
    size: number,
    color: string,
    weight = 450,
  ) {
    const rows: string[] = wrapLabel(value, limit);
    return rows
      .map((part) => {
        const baseline = y;
        y += Math.ceil(size * 1.38);
        return (
          '<text x="34" y="' +
          baseline +
          '" fill="' +
          color +
          '" font-size="' +
          size +
          '" font-weight="' +
          weight +
          '">' +
          esc(part) +
          '</text>'
        );
      })
      .join('');
  }
  let body = linesAt(desk, 47, 17, '#9adce0', 600);
  y += 11;
  body += linesAt(title, 29, 29, 'white', 650);
  body += linesAt(date, 52, 17, '#cee4e8');
  const headerEnd = y + 8;
  y += 49;
  for (const line of lines) {
    body += linesAt(line.name, 47, 20, '#163848', 650);
    body += linesAt(line.reading, 58, 16, '#3c5c68');
    if (
      scale !== undefined &&
      typeof line.value === 'number' &&
      line.value >= 0 &&
      scale > 0
    ) {
      const bar = Math.max(0, Math.min(1, line.value / scale)) * 572;
      body +=
        '<rect x="34" y="' +
        (y - 10) +
        '" width="572" height="6" rx="3" fill="#d4e4e6"/>' +
        (bar > 0
          ? '<rect x="34" y="' +
            (y - 10) +
            '" width="' +
            bar.toFixed(3) +
            '" height="6" rx="3" fill="#277e87"/>'
          : '');
      y += 9;
    }
    y += 21;
  }
  body += '<path d="M34 ' + (y - 16) + 'h572" stroke="#afc8cb"/>';
  y += 10;
  body += linesAt(note, 63, 15, '#365864');
  y += 6;
  body += linesAt(
    'Polradar · ' +
      (sources.length === 1
        ? sources[0].label
        : 'Références détaillées dans la légende'),
    61,
    15,
    '#245b68',
    600,
  );
  const height = y + 14;
  const alt = [
    title,
    desk,
    date,
    ...lines.map((line) => line.name + ' : ' + line.reading),
    note,
  ].join('. ');
  return {
    width,
    height,
    title,
    alt,
    sources,
    dateLabel: date,
    page,
    svg:
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' +
      width +
      ' ' +
      height +
      '" width="' +
      width +
      '" height="' +
      height +
      '" role="img" aria-labelledby="titre description"><title id="titre">' +
      esc(title) +
      '</title><desc id="description">' +
      esc(alt) +
      '</desc><defs><linearGradient id="teinte" x2="1" y2=".5"><stop stop-color="#102a3b"/><stop offset="1" stop-color="#18515c"/></linearGradient></defs><rect width="' +
      width +
      '" height="' +
      height +
      '" rx="16" fill="#f1f6f6"/><path d="M16 0h608q16 0 16 16v' +
      (headerEnd - 16) +
      'H0V16Q0 0 16 0" fill="url(#teinte)"/><g font-family="system-ui, sans-serif">' +
      body +
      '</g></svg>',
  };
}
