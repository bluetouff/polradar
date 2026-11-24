import { attributionLabel, collectiveLabel } from '../lib/attribution.mjs';
import { catalogue } from './catalogue';
import { el, anchor, icon, date, corpus } from './ui';
import { normalize } from '../lib/features.mjs';
import type { Engagement, Corpus } from '../lib/data';
import { scopes, sourceKinds, sourceIcons } from '../lib/labels';
function directory<T>(
  id: string,
  load: () => Promise<T[]>,
  text: (row: T) => string,
  card: (row: T) => HTMLElement,
) {
  catalogue({
    form: document.querySelector<HTMLFormElement>('#' + id + '-filters')!,
    results: document.getElementById(id)!,
    count: document.getElementById(id + '-count')!,
    load,
    card,
    select: (rows, params) => {
      const q = normalize(params.get('q') || '');
      return q ? rows.filter((row) => normalize(text(row)).includes(q)) : rows;
    },
  });
}
function external(label: string, url: string) {
  const a = anchor(label, url);
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}
if (document.getElementById('sources-list')) {
  type Source = Corpus['sources'][number];
  directory<Source>(
    'sources-list',
    async () => (await corpus()).sources,
    (s) => [s.title, s.url, s.previousUrl, sourceKinds[s.kind]].join(' '),
    (s) => {
      const card = el('article', undefined, 'source-card'),
        h = el('h2'),
        dl = el('dl');
      h.append(external(s.title + ' ↗', s.url));
      for (const [label, value] of [
        ['Publication', s.published],
        ['Consultation', s.checked],
        ...(s.updated ? [['Mise à jour du document', s.updated]] : []),
      ]) {
        const div = el('div');
        div.append(
          el('dt', label!),
          el(
            'dd',
            value
              ? date(value)
              : label === 'Publication' && s.publishedYear
                ? s.publishedYear
                : 'Date non indiquée',
          ),
        );
        if (label === 'Publication' && s.publicationReference)
          div.lastElementChild?.append(
            ' · ',
            external('Notice de l’éditeur ↗', s.publicationReference),
          );
        dl.append(div);
      }
      const kind = el(
        'span',
        sourceKinds[s.kind],
        s.kind === 'archive' ? 'tag archive' : 'tag',
      );
      kind.prepend(icon(sourceIcons[s.kind]));
      card.append(kind, h, el('p', new URL(s.url).hostname), dl);
      if (s.previousUrl) {
        const details = el('details');
        details.append(
          el('summary', 'Référence précédente'),
          external(new URL(s.previousUrl).hostname + ' ↗', s.previousUrl),
        );
        card.append(details);
      }
      return card;
    },
  );
}
if (document.getElementById('engagement-list')) {
  let data: Corpus;
  const dossier = (e: Engagement) =>
    data.candidates.find((c) => c.id === e.candidate)!.name;
  const author = (e: Engagement) => attributionLabel(e, dossier(e));
  const theme = (e: Engagement) =>
    data.themes.find((t) => t.id === e.theme)!.label;
  directory<Engagement>(
    'engagement-list',
    async () => {
      data = await corpus();
      return data.engagements.filter((e) => e.scope !== 'archive');
    },
    (e) => [author(e), dossier(e), theme(e), e.title, ...e.bullets].join(' '),
    (e) => {
      const card = el('article', undefined, 'engagement-card'),
        meta = el('div', undefined, 'card-meta'),
        subject = anchor(' ' + theme(e), '/themes/' + e.theme + '/'),
        h = el('h3'),
        footer = el('div', undefined, 'engagement-author');
      const url = '/engagements/' + e.id + '/';
      subject.prepend(icon(e.theme));
      meta.append(subject, el('span', scopes[e.scope], 'tag'));
      h.append(anchor(e.title, url));
      const link = anchor('Lire la fiche ↗', url);
      link.setAttribute('aria-label', 'Lire la fiche ' + e.title);
      footer.append(
        collectiveLabel(e)
          ? el('strong', author(e))
          : anchor(author(e), '/candidats/' + e.candidate + '/'),
        link,
      );
      card.append(meta, h, el('p', e.bullets[0]), footer);
      return card;
    },
  );
}
