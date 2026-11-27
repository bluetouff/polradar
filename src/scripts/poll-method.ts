import { pollNoticeLabel } from '../lib/features.mjs';
import { pollMethodFacts, pollUncertainty } from '../lib/poll-method';
import type { DocumentedPoll } from '../lib/data';
import { anchor, date, el } from './ui';

export function renderPollMethod(
  frame: HTMLElement,
  poll: DocumentedPoll,
  sources: { id: string; url: string }[],
) {
  const notice = frame.querySelector<HTMLAnchorElement>('[data-poll-notice]')!;
  const sourceUrl = (id: string) =>
    sources.find((source) => source.id === id)!.url;
  notice.href = sourceUrl(poll.noticeSource) + '#page=' + poll.noticePage;
  notice.querySelector('span')!.textContent =
    `${pollNoticeLabel(poll)}, page ${poll.noticePage} ↗`;

  const question = poll.question?.status === 'verifiee' ? poll.question : null;
  const verified = frame.querySelector<HTMLElement>('[data-poll-question]')!;
  verified.hidden = !question;
  frame.querySelector<HTMLElement>('[data-poll-unverified]')!.hidden =
    Boolean(question);
  if (question) {
    verified.querySelector('blockquote')!.textContent = question.wording;
    verified.querySelector('[data-poll-base]')!.textContent = question.base;
    const link = verified.querySelector<HTMLAnchorElement>(
      '[data-poll-question-link]',
    )!;
    link.href = sourceUrl(question.sourceId) + '#page=' + question.page;
    link.textContent = `Questionnaire, p. ${question.page}`;
    verified.querySelector('[data-poll-checked]')!.textContent =
      `Vérifié le ${date(question.checked)}.`;
    const equivalence = verified.querySelector<HTMLElement>(
      '[data-poll-equivalence]',
    )!;
    equivalence.hidden = !question.equivalence;
    equivalence.textContent = question.equivalence?.reason ?? '';
  }

  const facts = pollMethodFacts(poll, date).map(
    ({ label, value, link, wide }) => {
      const row = el('div', undefined, wide ? 'poll-fact-wide' : undefined);
      const detail = el('dd', value);
      if (link) {
        const reference = anchor(link.label, link.href);
        reference.rel = 'noreferrer';
        detail.append(' ', reference);
      }
      row.append(el('dt', label), detail);
      return row;
    },
  );
  frame.querySelector('.poll-method-grid')!.replaceChildren(...facts);
  frame.querySelector('[data-poll-uncertainty]')!.textContent =
    pollUncertainty(poll);

  const publications = frame.querySelector<HTMLElement>(
    '[data-poll-documents]',
  )!;
  const documents = poll.publicationDocuments ?? [];
  publications.hidden = !documents.length;
  const rows = documents.map((doc) => {
    const row = el('li');
    const link = anchor(`${doc.label} · ${doc.publisher}`, doc.url);
    link.rel = 'noreferrer';
    const stamp = el('span');
    if (doc.date) {
      const time = el('time', date(doc.date));
      time.dateTime = doc.date;
      stamp.append(time);
    }
    if (doc.localTime) stamp.append(' à ' + doc.localTime);
    if (doc.page) stamp.append((doc.date ? ' · ' : '') + 'p. ' + doc.page);
    row.append(link, stamp);
    return row;
  });
  publications.querySelector('ul')!.replaceChildren(...rows);
  const report = frame.querySelector<HTMLAnchorElement>('[data-poll-report]')!;
  report.hidden = !poll.resultSource;
  if (poll.resultSource) {
    report.href = sourceUrl(poll.resultSource) + '#page=' + poll.resultPage;
    report.textContent = `Résultats de l’institut, page ${poll.resultPage} ↗`;
  } else {
    report.removeAttribute('href');
  }
  frame.querySelector<HTMLElement>('.poll-file-sources')!.hidden =
    publications.hidden && report.hidden;
  return notice.href;
}
