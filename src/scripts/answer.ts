import { documentaryAnswer } from './answer-results';

const form = document.querySelector<HTMLFormElement>('#answer-form')!;
const input = document.querySelector<HTMLInputElement>('#answer-question')!;
const search = document.querySelector<HTMLAnchorElement>('#answer-search')!;
const answer = documentaryAnswer();

function updateLocalLink(question: string) {
  search.hash = question
    ? new URLSearchParams({ q: question.slice(0, 200) }).toString()
    : '';
}
const prefill = new URLSearchParams(location.hash.slice(1)).get('q');
if (prefill !== null) {
  input.value = prefill.trim().slice(0, input.maxLength);
  history.replaceState(history.state, '', location.pathname + location.search);
  updateLocalLink(input.value);
}
function applyQuestion() {
  updateLocalLink(input.value.trim());
  answer.clear();
}
input.addEventListener('input', applyQuestion);
for (const button of form.querySelectorAll<HTMLButtonElement>(
  '[data-example]',
)) {
  button.addEventListener('click', () => {
    input.value = button.dataset.example ?? '';
    applyQuestion();
    input.focus();
  });
}
form.addEventListener('submit', (event) => {
  event.preventDefault();
  void answer.lookup(input.value.trim());
});
form.hidden = false;
