// "How it works" cards: at most three short steps the first time a player opens a mode, folded
// into a one-line link afterwards so experienced players are not slowed down.
import { h, icon } from './ui.js';
import { pref, setPref } from './store.js';
import { termify } from './glossary.js';

export function howItWorks(key, title, steps, { extra = null } = {}) {
  const prefKey = `how.${key}`;
  const wrap = h('div', { class: 'how-wrap' });
  const open = () => {
    const ok = h('button', { class: 'btn btn-small btn-primary', type: 'button' }, icon('check', { size: 16 }), 'Got it');
    ok.addEventListener('click', () => { setPref(prefKey, true); closed(); });
    wrap.replaceChildren(h('section', { class: 'card how-card', 'aria-label': title },
      h('p', { class: 'kicker' }, 'How it works'),
      h('h2', { class: 'mt-0' }, title),
      h('ol', { class: 'how-steps' }, steps.slice(0, 3).map(([t, d]) => {
        const p = h('span');
        p.append(termify(d));
        return h('li', null, h('strong', null, t), ' ', p);
      })),
      extra,
      h('div', { class: 'btn-group' }, ok)));
  };
  const closed = () => {
    const again = h('button', { class: 'linkbtn', type: 'button' }, icon('info', { size: 16 }), `How ${title.toLowerCase().replace(/^how /, '')} works`);
    again.addEventListener('click', open);
    wrap.replaceChildren(h('p', { class: 'how-again' }, again));
  };
  if (pref(prefKey, false)) closed();
  else open();
  return wrap;
}
