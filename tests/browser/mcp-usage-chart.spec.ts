import { expect, test } from '@playwright/test';

const route = '/mcp/statistiques/';
const api = '**/api/mcp-stats.json';
const zero = { success: 0, empty: 0, error: 0 };
const report = {
  status: 'available',
  since: '2026-12-31',
  through: '2027-01-01',
  days: [
    { date: '2026-12-31', success: 3, empty: 1, error: 0 },
    { date: '2027-01-01', success: 0, empty: 1, error: 1 },
  ],
  tools: [
    { name: 'polradar_search', success: 2, empty: 2, error: 1 },
    { name: 'polradar_measure', ...zero },
    { name: 'polradar_corpus', ...zero },
    { name: 'polradar_candidates', ...zero },
    { name: 'polradar_donnees', success: 1, empty: 0, error: 0 },
  ],
};

test('le HTML initial et le chargement ne publient aucun zéro provisoire', async ({
  page,
  request,
}) => {
  const html = await (await request.get(route)).text();
  expect(html).not.toContain('Aucun appel enregistré');
  let unblock!: () => void;
  const gate = new Promise<void>((resolve) => {
    unblock = resolve;
  });
  await page.route(api, async (handler) => {
    await gate;
    await handler.fulfill({ json: report });
  });
  try {
    await page.goto(route);
    await expect(page.getByRole('status')).toContainText('Chargement');
    await expect(page.locator('[data-panels]')).toHaveCount(0);
  } finally {
    unblock();
  }
  await expect(page.locator('[data-total]')).toHaveText('6');
});

test('le détail facultatif conserve une catégorie pour les erreurs non qualifiées', async ({
  page,
}) => {
  await page.route(api, (handler) =>
    handler.fulfill({
      json: {
        ...report,
        days: [
          report.days[0],
          {
            ...report.days[1],
            error: 3,
            invalidArguments: 1,
            dataUnavailable: 1,
          },
        ],
      },
    }),
  );
  await page.goto(route);
  const detail = page.getByText('Détail des erreurs enregistrées', {
    exact: true,
  });
  await detail.focus();
  await page.keyboard.press('Enter');
  const list = page.locator('[data-error-counts]');
  await expect(list.locator('dt')).toHaveText([
    'Arguments invalides',
    'Données indisponibles',
    'Sans catégorie publiée',
  ]);
  await expect(list.locator('dd')).toHaveText(['1', '1', '1']);
  await expect(page.locator('[data-total]')).toHaveText('8');
});

test('les appels MCP sont comptés une seule fois et consultables au clavier sur mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 850 });
  await page.route(api, (handler) => handler.fulfill({ json: report }));
  await page.goto(route);
  const panel = page.locator('[data-mcp-usage]');
  await expect(panel.locator('[data-total]')).toHaveText('6');
  await expect(panel.locator('[data-legend] b')).toHaveText(['3', '2', '1']);
  await expect(panel.locator('[data-plot] > g')).toHaveCount(2);
  await expect(panel.locator('[data-period]')).toContainText('2026');
  await expect(panel.locator('[data-period]')).toContainText('2027');
  const dataTool = panel
    .locator('summary')
    .filter({ hasText: 'Sondages, économie, agenda et budgets' });
  await expect(dataTool.locator('strong')).toHaveText('1 appel');
  const summary = panel.getByText('Voir les chiffres par jour', {
    exact: true,
  });
  await summary.focus();
  await page.keyboard.press('Enter');
  const rows = panel.getByRole('table').locator('tbody tr');
  await expect(rows).toHaveCount(2);
  await expect(rows.first().locator('time')).toHaveAttribute(
    'datetime',
    '2027-01-01',
  );
  await expect(rows.first().getByRole('cell')).toHaveText(['0', '1', '1']);
  await expect(panel.locator('[data-tools] details')).toHaveCount(
    report.tools.length,
  );
  await expect(
    panel.getByText('Réponse avec preuves', { exact: true }),
  ).toHaveCount(0);
  await expect(panel.getByText('Non renseigné', { exact: true })).toHaveCount(
    6,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test('le nouvel outil apparaît quand le rapport du service le contient', async ({
  page,
}) => {
  await page.route(api, (handler) =>
    handler.fulfill({
      json: {
        ...report,
        days: [{ ...report.days[0], success: 4 }, report.days[1]],
        tools: [
          ...report.tools,
          { name: 'polradar_answer', ...zero, success: 1 },
        ],
      },
    }),
  );
  await page.goto(route);
  const panel = page.locator('[data-mcp-usage]');
  await expect(panel.locator('[data-total]')).toHaveText('7');
  await expect(
    panel
      .locator('summary')
      .filter({ hasText: 'Réponse avec preuves' })
      .locator('strong'),
  ).toHaveText('1 appel');
});

test('zéro observé, absence de relevé et journée manquante ont des rendus distincts', async ({
  page,
}) => {
  let data: unknown = {
    ...report,
    since: report.through,
    days: [{ date: report.through, ...zero }],
    tools: [],
  };
  let status = 200;
  await page.route(api, (handler) => handler.fulfill({ status, json: data }));
  await page.goto(route);
  const panel = page.locator('[data-mcp-usage]');
  await expect(panel.locator('[data-zero]')).toBeVisible();
  await expect(panel.getByText('Non renseigné', { exact: true })).toHaveCount(
    11,
  );
  for (const failure of [
    { status: 200, data: { ...report, days: report.days.slice(1) } },
    {
      status: 200,
      data: {
        ...report,
        days: [
          report.days[0],
          { ...report.days[1], invalidArguments: 1, dataUnavailable: 1 },
        ],
      },
    },
    {
      status: 200,
      data: {
        ...report,
        tools: report.tools.map((tool) => ({ ...tool, error: 8 })),
      },
    },
    { status: 200, data: { status: 'unavailable' } },
    { status: 503, data: { status: 'unavailable' } },
  ]) {
    status = failure.status;
    data = failure.data;
    await page.reload();
    await expect(panel.getByRole('status')).toContainText('indisponibles');
    await expect(panel.locator('[data-panels]')).toBeHidden();
  }
});
