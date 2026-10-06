import { h, icon, setTitle, screenHeader, tabs, chip, emptyBlock } from '../ui.js';
import { loadGameData, loadGuide } from '../store.js';
import { idx, shortDrugName } from './logic.js';

const TABS = [
  { id: 'play', label: 'How to play', icon: 'play' },
  { id: 'germs', label: 'Germs', icon: 'germ' },
  { id: 'buildings', label: 'Defences', icon: 'castle' },
  { id: 'drugs', label: 'Drugs', icon: 'pill' },
  { id: 'matrix', label: 'Drug matrix', icon: 'bars' },
  { id: 'vaccines', label: 'Vaccines', icon: 'syringe' },
  { id: 'changes', label: 'What changed', icon: 'info' },
  { id: 'refs', label: 'References', icon: 'book' },
];

export async function render(root, params) {
  setTitle('Guide');
  const [gd, guide] = await Promise.all([loadGameData(), loadGuide()]);
  const g = guide || {};
  root.append(screenHeader('Guide', { subtitle: 'The medicine behind the game.', back: '#/home' }),
    h('div', { class: 'callout disclaimer' }, icon('info'), h('p', { class: 'mb-0' }, g.disclaimer || 'Simplified for the game; reviewed by faculty before release; not clinical advice.')));
  const host = h('div', { class: 'mt-2' });
  root.append(host);
  const render = {
    play: (p) => {
      if (g.intro) p.append(h('p', { class: 'prose' }, g.intro));
      if (Array.isArray(g.howToPlay)) p.append(h('ol', { class: 'prose' }, g.howToPlay.map((s) => h('li', null, s))));
      if (Array.isArray(g.rules)) {
        p.append(h('h2', null, 'The medical rules'));
        p.append(h('div', { class: 'grid-cards' }, g.rules.map((r) => h('div', { class: 'card guide-card' },
          h('h3', { class: 'mt-0' }, r.title), h('p', null, h('strong', null, 'In the game: '), r.game), h('p', { class: 'mb-0' }, h('strong', null, 'Teaching point: '), r.teaching)))));
      }
    },
    germs: (p) => {
      p.append(h('div', { class: 'guide-grid grid-cards' }, gd.units.map((u) => {
        const grp = gd.groups[u.group] || {};
        const extra = (g.units || {})[u.key] || {};
        return h('div', { class: 'card guide-card' },
          h('div', { class: 'row between' }, h('h3', { class: 'mt-0 mb-0' }, u.name), chip(grp.name || u.group, { color: grp.color })),
          h('p', { class: 'muted small' }, h('em', null, u.real), u.deployable ? ` • ${u.space} army space` : ' • cannot be deployed'),
          h('p', null, h('strong', null, 'In the game: '), u.ability),
          extra.mechanism ? h('p', null, h('strong', null, 'Mechanism: '), extra.mechanism) : null,
          extra.clinical ? h('p', null, h('strong', null, 'Clinical: '), extra.clinical) : null,
          h('p', { class: 'mb-0' }, h('strong', null, 'Weak against: '), extra.treatment || u.weak));
      })));
    },
    buildings: (p) => {
      p.append(h('div', { class: 'grid-cards' }, gd.buildings.map((b) => {
        const extra = (g.buildings || {})[b.key] || {};
        return h('div', { class: 'card guide-card' }, h('h3', { class: 'mt-0' }, b.name), h('p', null, b.desc),
          extra.biology ? h('p', { class: 'muted small mb-0' }, h('strong', null, 'Biology: '), extra.biology) : null);
      })));
    },
    drugs: (p) => {
      p.append(h('div', { class: 'grid-cards' }, gd.drugs.map((d) => {
        const extra = (g.drugs || {})[d.key] || {};
        return h('div', { class: 'card guide-card', style: { borderTop: `6px solid ${d.color}` } },
          h('h3', { class: 'mt-0' }, d.name), h('p', { class: 'muted small' }, `${d.cls} • flora damage per shot: ${d.collateral}`),
          extra.mechanism ? h('p', null, h('strong', null, 'How it works: '), extra.mechanism) : null,
          extra.uses ? h('p', null, h('strong', null, 'Used for: '), extra.uses) : null,
          extra.cautions ? h('p', { class: 'mb-0' }, h('strong', null, 'Cautions: '), extra.cautions) : null);
      })));
    },
    matrix: (p) => {
      const cols = gd.matrixColumns || [];
      const legend = gd.matrixLegend || {};
      const pctMap = gd.matrixPct || {};
      const notes = gd.matrixNotes || {};
      const cell = (unit, col) => {
        const L = ((gd.matrix || {})[unit] || {})[col] || '-';
        const pct = (pctMap[unit] || {})[col];
        const note = notes[`${unit}.${col}`] || null;
        const cls = L === '-' ? 'cell cell-dash' : `cell cell-${L}`;
        return h('td', { title: note || legend[L] || '' }, h('span', { class: cls }, L, pct !== undefined && L !== 'Y' ? h('sup', null, `${pct}%`) : null, note ? h('sup', null, '*') : null));
      };
      p.append(h('p', { class: 'muted' }, 'Which drug battery can hurt which germ. Hover or tap a starred cell for the note. Simplified for the game - check current national guidelines for patients.'));
      p.append(h('div', { class: 'matrix-wrap' }, h('table', { class: 'matrix' },
        h('thead', null, h('tr', null, h('th', null, 'Germ'), cols.map((c) => h('th', null, shortDrugName(gd, c))))),
        h('tbody', null, gd.units.map((u) => h('tr', null, h('th', null, u.name), cols.map((c) => cell(u.key, c))))))));
      p.append(h('h3', null, 'Legend'), h('div', { class: 'legend' }, Object.entries(legend).map(([k, v]) =>
        h('div', { class: 'legend-item' }, h('span', { class: k === '-' ? 'cell cell-dash' : `cell cell-${k}` }, k), h('span', null, v)))));
      const nlist = Object.entries(notes);
      if (nlist.length) {
        p.append(h('h3', null, 'Notes'), h('ul', { class: 'prose' }, nlist.map(([k, v]) => {
          const [u, d] = k.split('.');
          const un = (idx(gd).units.get(u) || {}).name || u;
          return h('li', null, h('strong', null, d ? `${un} / ${shortDrugName(gd, d)}: ` : `${un}: `), v);
        })));
      }
    },
    vaccines: (p) => {
      p.append(h('p', { class: 'muted' }, 'Vaccines in the game give strong but partial protection: vaccinated germs arrive with less health and drain less fluid. None of them gives complete or lifelong immunity.'));
      p.append(h('div', { class: 'grid-cards' }, Object.entries(gd.vaccines).map(([germ, v]) => h('div', { class: 'card guide-card' },
        h('h3', { class: 'mt-0' }, (idx(gd).units.get(germ) || {}).name || germ), h('p', null, h('strong', null, `About ${v.efficacy}% protection. `), v.note),
        (g.vaccines || {})[germ] ? h('p', { class: 'muted small mb-0' }, g.vaccines[germ]) : null))));
      p.append(h('p', { class: 'muted small mt-2' }, `Herd immunity: when ${gd.herd.coverageFullPct}% or more of a clan is vaccinated, every member's base gets indirect protection worth up to ${gd.herd.indirectSharePct}% of the vaccine effect.`));
    },
    changes: (p) => {
      const list = Array.isArray(g.corrections) ? g.corrections : [];
      if (!list.length) { p.append(emptyBlock('No corrections listed.')); return; }
      p.append(h('p', { class: 'muted' }, 'Version 1.2 corrects errors and gaps found in the original development plan (v1.1) after a medical and technical review.'));
      p.append(h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
        h('thead', null, h('tr', null, h('th', null, 'Area'), h('th', null, 'Plan v1.1 said'), h('th', null, 'Now'), h('th', null, 'Why'))),
        h('tbody', null, list.map((c) => h('tr', null, h('td', null, h('strong', null, c.area)), h('td', null, c.plan), h('td', null, c.now), h('td', { class: 'small' }, c.why)))))));
    },
    refs: (p) => {
      if (Array.isArray(g.references)) p.append(h('ol', { class: 'prose small' }, g.references.map((r) => h('li', null, r))));
      if (g.credits) p.append(h('h3', null, 'Credits'), h('p', { class: 'prose' }, g.credits));
    },
  };
  tabs(host, TABS.map((t) => ({ ...t, render: (panel) => render[t.id](panel) })),
    { active: params.tab, onChange: (id) => history.replaceState(null, '', `#/guide/${id}`), label: 'Guide sections' });
}
