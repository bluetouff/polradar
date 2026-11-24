// SPDX-License-Identifier: MIT
// Copyright (c) 2026 bluetouff
/** Search public measures without an account. The response retains sources and edition metadata. */
export async function rechercherMesures(query, limit = 5) {
  if (typeof query !== 'string' || !query.trim() || [...query].length > 120)
    throw new RangeError('Recherche attendue : 1 à 120 caractères.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 20)
    throw new RangeError('La limite doit être comprise entre 1 et 20.');
  const url = new URL('https://polradar.fr/api/v1/mesures');
  url.searchParams.set('query', query.trim());
  url.searchParams.set('limit', String(limit));
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new Error(
      'API Polradar indisponible (HTTP ' + response.status + ').',
    );
  const result = await response.json();
  if (result?.versionContrat !== 1 || !Array.isArray(result.donnees?.resultats))
    throw new Error('Format de réponse Polradar inconnu.');
  return result;
}
