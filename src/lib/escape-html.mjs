export const escapeHtml = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (s) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        s
      ],
  );

// XML 1.0 permits fewer characters than JavaScript strings can hold.
export const escapeXml = (value) =>
  escapeHtml(
    String(value).replace(
      /[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu,
      '\uFFFD',
    ),
  );
