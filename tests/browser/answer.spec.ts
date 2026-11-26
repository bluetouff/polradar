import { expect, test } from '@playwright/test';

const revision = '867cd0601aa35c3dd18b62ef554cf76b2624b433';
const education = 'Que propose Jean-Luc Mélenchon pour les élèves par classe ?';
const measureTitle =
  'Réduire le nombre d’élèves par classe et abroger le « choc des savoirs »';
const programme =
  'https://melenchon2027.fr/programme/livre/le-gout-du-futur-aux-nouvelles-frontieres-de-l-humanite/chapitre2';
const locator =
  'Chapitre 2, « Reconstruire une école globale pour l’égalité et l’émancipation », point sur le nombre d’élèves par classe';

test('la demande explicite conserve le lien versionné et le passage vérifiable', async ({
  page,
  baseURL,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        async writeText(reference: string) {
          document.documentElement.dataset.copiedReference = reference;
        },
      },
    });
  });
  const requests: string[] = [];
  const posted: unknown[] = [];
  page.on('request', (request) => requests.push(request.url()));
  // Preview n’installe pas le service Go. La réponse reproduit la fiche publique.
  await page.route('**/api/v1/reponse', async (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().headers()['content-type']).toBe('application/json');
    posted.push(route.request().postDataJSON());
    await route.fulfill({
      json: {
        versionContrat: 1,
        corpusVerifieLe: '2026-11-25',
        revisionDuSite: revision,
        revisionDuService: revision,
        sansResultat: false,
        donnees: {
          etat: 'documente',
          intention: 'proposition',
          titre: 'Propositions documentées',
          explication:
            'Les propositions ci-dessous sont accompagnées de leur source.',
          couverture: {
            perimetre: 'Corpus des propositions',
            total: 1,
            limite: 3,
            url: '/mesures/',
          },
          liens: [
            { libelle: 'Parcourir les mesures', url: '/mesures/' },
            { libelle: 'Lien externe de recette', url: 'https://example.org/' },
          ],
          resultats: [
            {
              id: 'melenchon-education-2',
              titre: measureTitle,
              auteur: 'Jean-Luc Mélenchon',
              statut: 'campagne',
              url: 'https://polradar.fr/mesures/melenchon-education-2/#version-3',
              resume:
                'Le programme donne la priorité à la maternelle et aux réseaux d’éducation prioritaire (REP).',
              sources: [
                {
                  id: 'lfi-school',
                  document: 'L’Avenir en commun : éducation et savoirs',
                  url:
                    programme +
                    '#:~:text=R%C3%A9duire%20partout%20les%20effectifs%20par%20classe',
                  passage: locator,
                  publication: '2026-11-06',
                  consultation: '2026-11-24',
                },
                {
                  id: 'lfi-school',
                  document: 'L’Avenir en commun : éducation et savoirs',
                  url: programme + '#:~:text=choc%20des%20savoirs',
                  passage:
                    'Même section, point sur l’abrogation du « choc des savoirs »',
                  publication: '2026-11-06',
                  consultation: '2026-11-24',
                },
              ],
              chiffres: [],
            },
          ],
        },
      },
    });
  });

  await page.goto('/');
  const homeQuery = page.getByRole('searchbox', {
    name: 'Que voulez-vous comprendre ?',
  });
  await homeQuery.fill(education);
  await homeQuery.press('Enter');
  await expect(page).toHaveURL(/\/demander\/$/);
  await expect(
    page.getByRole('searchbox', { name: 'Votre question' }),
  ).toHaveValue(education);
  expect(posted).toHaveLength(0);
  await expect(
    page.getByText(
      'Votre question est envoyée au serveur Polradar au moment de la demande.',
    ),
  ).toBeVisible();
  await page.getByRole('searchbox').press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Propositions documentées' }),
  ).toBeFocused();
  expect(posted).toEqual([{ question: education }]);
  expect(
    requests.every((value) => {
      const sent = new URL(value);
      return (
        sent.origin === baseURL && !sent.searchParams.has('q') && !sent.hash
      );
    }),
  ).toBe(true);
  await expect(page.getByText(locator, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: measureTitle })).toHaveAttribute(
    'href',
    '/mesures/melenchon-education-2/#version-3',
  );
  const firstSource = page
    .getByRole('link', { name: /L’Avenir en commun/ })
    .first();
  await expect(firstSource).toHaveAttribute('rel', 'noopener noreferrer');
  await page
    .getByRole('button', { name: /Copier la référence de L’Avenir en commun/ })
    .first()
    .click();
  await expect(page.getByText('Référence copiée.')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute(
    'data-copied-reference',
    new RegExp(locator),
  );
  await page.getByText('Autre source', { exact: true }).click();
  await expect(
    page.getByText(
      'Même section, point sur l’abrogation du « choc des savoirs »',
    ),
  ).toBeVisible();
  await page.getByText('Couverture et édition', { exact: true }).click();
  await expect(page.getByText(revision.slice(0, 12))).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Signaler une erreur' }),
  ).toHaveAttribute('href', '/methode/#signaler-erreur');
  await expect(
    page.getByRole('link', { name: 'Lien externe de recette' }),
  ).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    320,
  );
  await page.goBack();
  await expect(homeQuery).toBeVisible();
  expect(posted).toEqual([{ question: education }]);
});

test('un manque documentaire puis une panne laissent une recherche locale utilisable', async ({
  page,
}) => {
  const question = 'Quelle décision porte sur les vols habités vers Neptune ?';
  await page.route('**/api/v1/reponse', async (route) => {
    if (route.request().postDataJSON().question === question) {
      await route.fulfill({
        json: {
          versionContrat: 1,
          corpusVerifieLe: '2026-11-25',
          revisionDuSite: revision,
          sansResultat: true,
          donnees: {
            etat: 'sans-resultat',
            titre: 'Propositions documentées',
            explication:
              'Les propositions indexées ne contiennent pas cette expression.',
            couverture: {
              perimetre: 'Corpus des propositions',
              total: 0,
              limite: 3,
              url: '/mesures/',
            },
            resultats: [],
            liens: [{ libelle: 'Explorer les thèmes', url: '/themes/' }],
          },
        },
      });
    } else {
      // Une édition statique peut précéder l’installation du service compatible.
      await route.fulfill({
        status: 405,
        contentType: 'application/json',
        body: '{}',
      });
    }
  });
  await page.goto('/demander/');
  await page.getByRole('searchbox').fill(question);
  await page.getByRole('button', { name: 'Obtenir la réponse' }).click();
  await expect(
    page.getByRole('heading', { name: 'Aucun document retrouvé' }),
  ).toBeFocused();
  await expect(
    page.getByRole('link', { name: 'Explorer les thèmes' }),
  ).toHaveAttribute('href', '/themes/');
  await expect(page.locator('#answer-results li')).toHaveCount(0);

  const example = 'Quelles sont les propositions numériques de Juan Branco ?';
  await page.getByRole('button', { name: example }).click();
  await expect(page.getByRole('searchbox')).toHaveValue(example);
  await expect(page.locator('#answer-panel')).toBeHidden();
  await page.getByRole('searchbox').press('Enter');
  await expect(
    page.getByRole('heading', { name: 'Réponse documentaire indisponible' }),
  ).toBeFocused();
  await page
    .getByRole('link', { name: 'Rechercher dans ce navigateur' })
    .click();
  await expect(page).toHaveURL(/\/recherche\/#q=/);
  await expect(page.getByRole('searchbox')).toHaveValue(example);
});

test('la réponse documentaire indique la version citée et la version courante', async ({
  page,
}) => {
  const id = 'branco-salaires-enseignants-debut-carriere';
  const base = `/mesures/${id}/`;
  await page.route('**/api/v1/reponse', (route) =>
    route.fulfill({
      json: {
        donnees: {
          etat: 'partiel',
          explication: 'La comparaison conserve la version citée.',
          resultats: [
            {
              id,
              titre: 'Juan Branco · Salaire de début de carrière',
              url: base + '#version-1',
              relation: {
                qualification: 'reponse',
                statut: 'version-depassee',
                versionCitee: id + '-v1',
                versionCourante: id + '-v2',
                regleVersion: 'version-citee',
                justification:
                  'Le programme donne le montant de début de carrière.',
              },
              sources: [
                {
                  id: 'branco-voie-pdf',
                  document: 'La Voie, programme intégral',
                  url: 'https://ruches.org/projet-1784217879253.pdf#page=37',
                  passage: 'Page 37 du PDF',
                },
              ],
            },
          ],
        },
      },
    }),
  );
  await page.goto('/demander/');
  await page
    .getByRole('searchbox')
    .fill(
      'Compare Juan Branco et Nicolas Dupont-Aignan sur les salaires des enseignants.',
    );
  await page.getByRole('button', { name: 'Obtenir la réponse' }).click();
  await expect(
    page.getByText('Réponse à la question', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('.answer-relation')).toContainText(
    'Version citée antérieure',
  );
  await expect(
    page.getByRole('link', {
      name: 'Juan Branco · Salaire de début de carrière',
    }),
  ).toHaveAttribute('href', base + '#version-1');
  await expect(
    page.getByRole('link', { name: 'Lire la version actuelle' }),
  ).toHaveAttribute('href', base + '#version-2');
  await expect(page.getByText('Page 37 du PDF', { exact: true })).toBeVisible();
});

test('les liens du catalogue gardent le parcours utilisable sans JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto(new URL('/recherche/', baseURL).href);
    await page.getByRole('link', { name: 'Demander à Polradar' }).click();
    await expect(
      page.getByRole('heading', { name: 'Demander à Polradar' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Obtenir la réponse' }),
    ).toHaveCount(0);
    await page.getByRole('link', { name: 'Catalogue et filtres' }).click();
    await expect(
      page.getByRole('heading', { name: 'Catalogue sans JavaScript' }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});
