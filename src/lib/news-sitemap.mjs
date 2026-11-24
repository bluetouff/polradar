const xml = (value) =>
  value.replace(
    /[<>&"']/g,
    (c) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[c],
  );
export function newsSitemap(articles, today) {
  const previousDay = new Date(Date.parse(today + 'T12:00:00Z') - 86400000)
    .toISOString()
    .slice(0, 10);
  const items = articles
    .filter((a) => a.day === today || a.day === previousDay)
    .sort((a, b) => b.day.localeCompare(a.day) || a.path.localeCompare(b.path))
    .slice(0, 1000);
  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">' +
    items
      .map(
        (a) =>
          '<url><loc>https://polradar.fr' +
          xml(a.path) +
          '</loc><news:news><news:publication><news:name>Polradar</news:name><news:language>fr</news:language></news:publication><news:publication_date>' +
          a.day +
          '</news:publication_date><news:title>' +
          xml(a.title) +
          '</news:title></news:news></url>',
      )
      .join('') +
    '</urlset>\n'
  );
}
