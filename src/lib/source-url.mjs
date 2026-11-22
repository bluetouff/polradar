// Also used when the browser resolves a version against the public corpus.
export function isPublicSourceUrl(value) {
  if (
    typeof value !== 'string' ||
    value.length > 1500 ||
    !/^[^\u0000-\u0020\u007f\\]+$/.test(value)
  )
    return false;
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/\.$/, '');
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      host.includes('.') &&
      !/^[\d.]+$/.test(host) &&
      !host.includes(':') &&
      !/\.(local|internal|localhost)$/.test(host)
    );
  } catch {
    return false;
  }
}
