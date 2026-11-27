import { expect, test, type Download } from '@playwright/test';

async function downloaded(file: Download) {
  const parts: Buffer[] = [];
  for await (const part of (await file.createReadStream())!)
    parts.push(Buffer.from(part));
  return Buffer.concat(parts);
}

test('un dossier d’enquête garde des versions, des notes locales et un export réimportable', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  await page.goto('/mesures/melenchon-education-2/#version-3');
  await page.getByRole('button', { name: 'Ajouter à un dossier' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Nom du nouveau dossier').fill('École et retraites');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Référence enregistrée');
  await page.getByRole('link', { name: 'Mes dossiers', exact: true }).click();
  await page
    .getByLabel('Notes personnelles', { exact: true })
    .fill('Texte <section> confidentiel');
  await page
    .getByRole('button', { name: 'Enregistrer le nom et les notes' })
    .click();
  await expect(page.locator('#investigations-status')).toHaveText(
    'Nom et notes enregistrés.',
  );
  await page.reload();
  await expect(
    page.getByLabel('Notes personnelles', { exact: true }),
  ).toHaveValue('Texte <section> confidentiel');
  await expect(page.locator('#investigation-references a')).toHaveAttribute(
    'href',
    '/mesures/melenchon-education-2/#version-3',
  );
  const json = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON', exact: true }).click();
  const exported = await downloaded(await json);
  expect(JSON.parse(exported.toString('utf8')).dossiers[0].notes).toBe('');
  await page.getByLabel('Inclure les notes personnelles').check();
  const html = page.waitForEvent('download');
  await page.getByRole('button', { name: 'HTML', exact: true }).click();
  const print = (await downloaded(await html)).toString('utf8');
  expect(print).toContain('Texte &lt;section&gt; confidentiel');
  expect(print).toContain('Content-Security-Policy');
  const picker = page.getByLabel('Importer un dossier Polradar en JSON');
  const importer = page.getByRole('button', {
    name: 'Importer sur cet appareil',
  });
  await picker.setInputFiles({
    name: 'version-absente.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"version":2,"dossiers":[]}'),
  });
  await importer.click();
  await expect(page.locator('#investigations-status')).toContainText(
    'Version de dossier incompatible',
  );
  await picker.setInputFiles({
    name: 'enquete.json',
    mimeType: 'application/json',
    buffer: exported,
  });
  await importer.click();
  await expect(page.locator('#investigations-status')).toContainText(
    'Dossier importé',
  );
  await expect(
    page.getByLabel('Notes personnelles', { exact: true }),
  ).toHaveValue('');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  expect(requests.every((address) => new URL(address).origin === baseURL)).toBe(
    true,
  );
});

test('un dossier de preuves met en regard une question, une version et un passage original', async ({
  page,
  request,
}) => {
  await page.goto('/mesures/melenchon-education-2/');
  const proof = page.locator('#preuves');
  await page
    .getByRole('link', { name: /Explorer le dossier de preuves/ })
    .click();
  await expect(
    proof.getByRole('heading', { name: 'Dossier de preuves' }),
  ).toBeVisible();
  await proof.getByRole('link', { name: /Questions et propositions/ }).click();
  await expect(
    proof.getByText('Réponse documentée', { exact: true }).first(),
  ).toBeVisible();
  const evidence = await (
    await request.get('/api/relations-documentaires.json')
  ).json();
  const row = evidence.relations.find(
    (relation: { qualification: string; versionCitee: string }) =>
      relation.qualification === 'reponse' &&
      relation.versionCitee === 'melenchon-education-2-v3',
  );
  expect(row.sources[0].passage).toBeTruthy();
  await expect(
    proof.locator('#preuve-question-proposition').getByRole('link').first(),
  ).toBeVisible();
});

test('les références de comparaison conservent la sélection utile au dossier', async ({
  page,
}) => {
  await page.goto(
    '/comparer/?question=climat-production-nucleaire&c=lepen,lisnard&utm_source=exemple',
  );
  await expect(page.locator('.comparison-card')).toHaveCount(2);
  await page.getByRole('button', { name: 'Ajouter à un dossier' }).click();
  await page.getByLabel('Nom du nouveau dossier').fill('Énergie');
  await page.getByRole('button', { name: 'Ajouter', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('Référence enregistrée');
  await page.getByRole('link', { name: 'Mes dossiers', exact: true }).click();
  const reference = page.locator('#investigation-references a');
  await expect(reference).toHaveAttribute(
    'href',
    '/comparer/#comparaison?question=climat-production-nucleaire&c=lepen%2Clisnard',
  );
  await reference.click();
  await expect(page.locator('.comparison-card')).toHaveCount(2);
});

test('l’observatoire filtre par auteur et garde les dates d’intervention et de publication', async ({
  page,
  request,
}) => {
  await page.goto('/debats/');
  await page.getByLabel('Auteur').selectOption('Marine Le Pen');
  await expect(page.locator('.debate-row:visible').first()).toContainText(
    'Marine Le Pen',
  );
  expect(await page.locator('.debate-row:visible').count()).toBeGreaterThan(0);
  await expect(
    page.locator('.debate-row:visible[data-author="Édouard Philippe"]'),
  ).toHaveCount(0);
  const data = await (await request.get('/api/debats.json')).json();
  expect(new Set(data.items.map((row: { id: string }) => row.id)).size).toBe(
    data.items.length,
  );
  const passages = data.items.filter(
    (row: { version: string; source: { id: string } }) =>
      row.version === 'glucksmann-construction-sociale-v2' &&
      row.source.id === 'lci-restos-debat-16-novembre',
  );
  expect(passages).toHaveLength(2);
  expect(passages[0].source.passage).not.toBe(passages[1].source.passage);
  const replay = data.items.find(
    (row: { source: { id: string } }) =>
      row.source.id === 'lepen-reims-lci-salaires-2026',
  );
  expect(replay.date).toBe('2026-11-25');
  expect(replay.source.published).toBe('2026-11-26');
  expect(replay.source.url).toContain('t=487s');
});

test('le droit sur l’aide à mourir et le vote nominatif sont accessibles dans les preuves', async ({
  page,
  request,
}) => {
  await page.goto('/questions/sante-aide-a-mourir/');
  const proof = page.locator('#preuves');
  await proof.getByRole('link', { name: /Scrutins et votes/ }).click();
  await expect(proof).toContainText(
    'Marine Le Pen contre et Gabriel Attal pour',
  );
  await expect(
    proof.getByRole('link', { name: /Adoption définitive à l’Assemblée/ }),
  ).toHaveAttribute(
    'href',
    'https://www.assemblee-nationale.fr/dyn/17/scrutins/8280',
  );
  await proof.getByRole('link', { name: /Droit en vigueur/ }).click();
  await expect(
    proof.getByRole('link', { name: /Loi du 18 août 2026/ }),
  ).toBeVisible();
  const graph = await (
    await request.get('/api/relations-documentaires.json')
  ).json();
  const rows = graph.relations.filter(
    (row: { origin: { id: string } }) =>
      row.origin.id === 'sante-aide-a-mourir',
  );
  expect(rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'rapprochement-scrutin',
        date: { type: 'seance', value: '2026-07-15' },
      }),
      expect.objectContaining({
        type: 'comparaison-droit',
        date: { type: 'promulgation', value: '2026-08-18' },
      }),
    ]),
  );
});

test('le scénario budgétaire donne le calcul publié avec son unité et affiche séparément les annonces', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/economie/simulateur-budgetaire/');
  await page.getByLabel('Variation des recettes').fill('0.3');
  await page.getByLabel('Variation des dépenses').fill('-0.2');
  await page
    .getByRole('button', { name: 'Calculer l’effet sur le solde' })
    .click();
  await expect(page.locator('#national-budget-result')).toContainText(
    '-4,6 % du PIB',
  );
  const example = await (
    await request.get('/api/simulation-budgetaire.json')
  ).json();
  const next = page.waitForEvent('download');
  await page
    .getByRole('button', { name: 'Exporter le scénario en JSON' })
    .click();
  const exported = JSON.parse((await downloaded(await next)).toString('utf8'));
  expect(exported.values).toEqual(example.items[1].examples[2].values);
  expect(exported.resultUnit).toBe('% du PIB');
  await page
    .getByLabel('Candidature', { exact: true })
    .selectOption('asselineau');
  await expect(page.locator('[data-budget-amount]:visible')).toHaveCount(1);
  await expect(page.locator('[data-budget-amount]:visible')).toContainText(
    'Période non précisée',
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
});
