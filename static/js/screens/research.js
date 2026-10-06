import { h, icon, setTitle, screenHeader, tabs, busy, confirmDialog, toast, mount, spinnerBlock, errorBlock, chip, fmt } from '../ui.js';
import { post } from '../api.js';
import { loadGameData, refreshState, setState, store } from '../store.js';
import { researchStatus, buildingName, costText, idx, unitName } from './logic.js';
import { resourceBar } from './home.js';

const LABS = [
  { id: 'pharmacy_lab', label: 'Pharmacy Lab', icon: 'pill', intro: 'New drugs for your batteries. Each drug only works on the germs in its spectrum - check the Guide matrix.' },
  { id: 'vaccine_lab', label: 'Vaccine Lab', icon: 'syringe', intro: 'Vaccines give strong but partial protection: vaccinated germs arrive weaker and drain less fluid. None of them gives complete or lifelong immunity.' },
  { id: 'peyers_patch', label: "Peyer's Patch", icon: 'shield', intro: 'Adaptive immunity. T helper cells activate macrophages; memory builds up after your base beats the same germ again and again.' },
];

export async function render(root) {
  setTitle('Research');
  root.append(spinnerBlock());
  let gd;
  try {
    [gd] = await Promise.all([loadGameData(), refreshState()]);
  } catch (e) {
    mount(root, errorBlock(e, () => location.reload()));
    return;
  }
  root.replaceChildren();
  const resHost = h('div');
  let res = null;
  const paintRes = () => {
    if (res) res.stop();
    res = resourceBar(store.state);
    mount(resHost, res.el);
  };
  root.append(screenHeader('Research', { subtitle: 'Spend ATP and nutrients to unlock drugs, vaccines and immune upgrades.', back: '#/home' }), resHost);
  paintRes();
  const tabHost = h('div', { class: 'mt-2' });
  root.append(tabHost);
  let current = 'pharmacy_lab';

  function card(item) {
    const st = researchStatus(gd, store.state, item);
    const vacc = item.kind === 'vaccine' ? gd.vaccines[item.germ] : null;
    const btn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !st.ok }, icon(st.owned ? 'check' : 'flask', { size: 18 }), st.owned ? 'Researched' : 'Research');
    btn.addEventListener('click', () => busy(btn, async () => {
      if (!(await confirmDialog(`Research ${item.name} for ${costText(item.cost)}?`, { title: 'Start research', okLabel: 'Research' }))) return;
      try {
        const s = await post('/api/research', { key: item.key });
        setState(s);
        toast(`${item.name} is ready.`, 'ok');
        paintRes();
        draw();
      } catch { /* toast shown */ }
    }));
    const kind = item.kind === 'drug' ? 'New drug' : item.kind === 'vaccine' ? 'Vaccine' : 'Upgrade';
    let detail = item.desc || '';
    if (item.kind === 'drug') {
      const d = idx(gd).drugs.get(item.key);
      if (d) detail = `${d.cls}. Unlocks the ${d.name.split(' (')[0]} battery.`;
    }
    if (vacc) detail = `About ${vacc.efficacy}% protection against ${unitName(gd, item.germ)}. ${vacc.note || ''}`;
    return h('div', { class: `card${st.owned ? ' soft' : ''}` },
      h('div', { class: 'row between' }, h('strong', null, item.name), chip(kind)),
      h('p', { class: 'muted small' }, detail),
      h('p', { class: 'small mb-1' }, st.owned ? 'Done.' : costText(item.cost)),
      st.reason && !st.owned ? h('p', { class: 'small mb-1', style: 'color:var(--warn)' }, icon('lock', { size: 16 }), ' ', st.reason) : null,
      btn);
  }

  function draw() {
    tabHost.replaceChildren();
    tabs(tabHost, LABS.map((lab) => ({
      id: lab.id, label: lab.label, icon: lab.icon,
      render: (panel) => {
        const items = (gd.research || []).filter((r) => r.lab === lab.id);
        panel.append(h('p', { class: 'muted' }, lab.intro),
          h('div', { class: 'grid-cards' }, items.map(card)));
        if (!items.length) panel.append(h('p', { class: 'muted' }, `Nothing to research in the ${buildingName(gd, lab.id)} yet.`));
      },
    })), { active: current, onChange: (id) => { current = id; }, label: 'Labs' });
  }
  draw();
  root.append(h('p', { class: 'muted small mt-2' }, `Owned drugs: ${(store.state.drugs || []).length} • Researched items: ${fmt((store.state.research || []).length)}`));
}
