import {
  h, icon, setTitle, fmt, busy, toast, onLeave, errorBlock, spinnerBlock, mount, openModal, confirmDialog, screenHeader, navigate, chip,
} from '../ui.js';
import { post } from '../api.js';
import { store, refreshState, loadGameData, setState } from '../store.js';
import { mountBase } from './engine.js';
import {
  idx, buildOptions, upgradeInfo, refundFor, buildingHp, costText, stopflowOptions, shortDrugName,
} from './logic.js';
import { resourceBar } from './home.js';

const CAT_ICONS = {
  core: 'castle', wall: 'shield', tower: 'shieldcheck', battery: 'pill', support: 'drop', resource: 'atp', lab: 'flask', special: 'map',
};
const CAT_COLORS = {
  core: '#6a1b9a', wall: '#8d6e63', tower: '#1565c0', battery: '#c2185b', support: '#0277bd', resource: '#ad6800', lab: '#2e7d32', special: '#d84315',
};

function catSwatch(def) {
  return h('span', { class: 'swatch', style: { background: CAT_COLORS[def.cat] || '#666' }, 'aria-hidden': 'true' }, icon(CAT_ICONS[def.cat] || 'build', { size: 22 }));
}

function rxEditor(gd, initial) {
  const chosen = new Set(initial || []);
  const boxes = (gd.units || []).map((u) => {
    const input = h('input', { type: 'checkbox', value: u.key });
    input.checked = chosen.has(u.key);
    return { key: u.key, input, el: h('label', { class: 'check' }, input, h('span', null, h('strong', null, u.real || u.name), h('br'), h('small', { class: 'muted' }, u.name))) };
  });
  const el = h('fieldset', { class: 'field', style: 'border:0;padding:0;margin:0' },
    h('legend', { class: 'field-label' }, 'Prescription: which germs should this battery fire at?'),
    h('p', { class: 'field-hint mb-1' }, 'The battery only shoots the germs you tick. Every shot costs ATP from your defence pool, and the wrong drug breeds resistance. Choose like a doctor.'),
    h('div', { class: 'check-list' }, boxes.map((b) => b.el)),
    h('div', { class: 'row mt-1' },
      h('button', { type: 'button', class: 'btn btn-small btn-ghost', onclick: () => boxes.forEach((b) => { b.input.checked = false; }) }, 'Clear all')));
  return { el, get value() { return boxes.filter((b) => b.input.checked).map((b) => b.key); } };
}

function drugPicker(gd, state, initial) {
  const drugs = (state.drugs || []).map((k) => idx(gd).drugs.get(k)).filter(Boolean);
  const sel = h('select', { class: 'input', id: 'drug-pick' },
    drugs.map((d) => {
      const o = h('option', { value: d.key }, `${d.name} - ${d.cls}`);
      if (d.key === initial) o.selected = true;
      return o;
    }));
  const info = h('p', { class: 'field-hint' });
  const paint = () => {
    const d = idx(gd).drugs.get(sel.value);
    if (!d) { info.textContent = ''; return; }
    const r = (state.resistance || {})[d.key] || 0;
    info.textContent = `${d.atp} ATP per shot${d.broad ? ', broad-spectrum' : ''}. Resistance at your base: ${r}%.`;
  };
  sel.addEventListener('change', paint);
  paint();
  const el = h('label', { class: 'field', for: 'drug-pick' }, h('span', { class: 'field-label' }, 'Drug loaded in this battery'), sel, info,
    drugs.length ? null : h('p', { class: 'muted' }, 'You have no drugs unlocked.'));
  return { el, get value() { return sel.value; }, empty: drugs.length === 0 };
}

export async function render(root, params) {
  setTitle('Edit base');
  root.append(spinnerBlock());
  let gd;
  try {
    [gd] = await Promise.all([loadGameData(), refreshState()]);
  } catch (e) {
    mount(root, errorBlock(e, () => navigate(location.hash)));
    return;
  }
  if (!params.isCurrent()) return;
  root.replaceChildren();
  const I = idx(gd);
  let selected = null;
  let view = null;

  const resHost = h('div');
  const baseHost = h('div', { class: 'baseview-host', role: 'application', 'aria-label': 'Gut base map. Tap a building site to build or upgrade.' });
  const coreHost = h('div');
  const policyHost = h('div');
  const listHost = h('div');
  let res = null;

  root.append(
    screenHeader('Edit base', { subtitle: 'Tap a site on the map (or in the list below) to build, upgrade, set a prescription or remove.', back: '#/home' }),
    resHost,
    h('div', { class: 'mt-2' }, baseHost),
    h('div', { class: 'grid-2 mt-2' }, coreHost, policyHost),
    h('section', { class: 'section', 'aria-labelledby': 'sites-h' }, h('h2', { id: 'sites-h' }, icon('map'), 'All building sites'), listHost));

  function S() { return store.state; }
  function layout() { return (S().base && S().base.layout) || {}; }
  function coreLevel() { return (S().base && S().base.core_level) || 1; }

  async function act(path, body, okMsg) {
    try {
      const s = await post(path, body);
      setState(s);
      if (okMsg) toast(okMsg, 'ok', 2500);
      paint();
      return true;
    } catch {
      return false;
    }
  }

  function paintResources() {
    if (res) res.stop();
    res = resourceBar(S());
    mount(resHost, res.el);
  }
  onLeave(root, () => { if (res) res.stop(); });

  function paintCore() {
    const lv = coreLevel();
    const info = upgradeInfo(gd, S(), 'CORE') || { maxed: true };
    const nextLv = lv + 1;
    const unlocks = [];
    if (!info.maxed) {
      const st = gd.core.storage || [];
      const as = gd.core.armySpace || [];
      if (st[nextLv - 1]) unlocks.push(`storage ${fmt(st[lv - 1])} -> ${fmt(st[nextLv - 1])}`);
      if (as[nextLv - 1]) unlocks.push(`army space ${as[lv - 1]} -> ${as[nextLv - 1]}`);
      for (const d of gd.buildings || []) {
        const a = (d.maxCount || [])[lv - 1] || 0;
        const b = (d.maxCount || [])[nextLv - 1] || 0;
        if (b > a) unlocks.push(`${d.name} ${a} -> ${b}`);
      }
    }
    const btn = h('button', { class: 'btn btn-primary', type: 'button', disabled: !info.ok }, icon('plus', { size: 18 }),
      info.maxed ? 'Maximum level' : `Upgrade to level ${nextLv}`);
    btn.addEventListener('click', () => busy(btn, async () => {
      const ok = await confirmDialog(`Upgrade the Bone Marrow Core to level ${nextLv} for ${costText(info.cost)}?`, { title: 'Upgrade the core', okLabel: 'Upgrade' });
      if (ok) await act('/api/base/upgrade', { site: 'CORE' }, `Bone Marrow Core is now level ${nextLv}.`);
    }));
    mount(coreHost, h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, icon('castle'), ` Bone Marrow Core: level ${lv}`)),
      h('p', { class: 'muted small' }, 'The core sets how many of each building you may have, your storage cap and your army size. Other buildings cannot be upgraded above the core level.'),
      info.maxed ? h('p', null, 'Your core is at the highest level.') : h('div', null,
        h('p', { class: 'mb-1' }, h('strong', null, 'Next level: '), costText(info.cost)),
        unlocks.length ? h('p', { class: 'small' }, 'Unlocks: ', unlocks.join('; '), '.') : null,
        info.reason ? h('p', { class: 'small', style: 'color:var(--danger)' }, info.reason) : null),
      btn));
  }

  function paintPolicy() {
    const cur = (S().base && S().base.policy && S().base.policy.stopflow_at) || 0;
    const sel = h('select', { class: 'input', id: 'policy-sel' }, stopflowOptions().map((o) => {
      const opt = h('option', { value: String(o.value) }, o.label);
      if (o.value === cur) opt.selected = true;
      return opt;
    }));
    const save = h('button', { class: 'btn', type: 'button' }, icon('check', { size: 18 }), 'Save policy');
    save.addEventListener('click', () => busy(save, () => act('/api/base/policy', { stopflow_at: Number(sel.value) }, 'Stop-Flow policy saved.')));
    const sf = gd.stopflow || {};
    mount(policyHost, h('div', { class: 'card' },
      h('div', { class: 'card-head' }, h('h2', null, icon('drop'), ' Auto Stop-Flow (loperamide)')),
      h('p', { class: 'small muted' },
        `While you are offline your base defends itself. Stop-Flow cuts fluid loss to ${sf.drainPct || 60}% for ${Math.round((sf.duration || 80) / 10)} seconds and pauses peristalsis, but it traps invasive germs (Shigella, Amoeba, C. difficile) inside the gut, where they get stronger. It is never given to young children with diarrhoea. The policy fires at most once per defence.`),
      h('label', { class: 'field', for: 'policy-sel' }, h('span', { class: 'field-label' }, 'Use Stop-Flow automatically'), sel),
      h('div', { class: 'mt-1' }, save)));
  }

  function paintList() {
    const lay = layout();
    const blocks = (gd.map.zones || []).map((z) => {
      const sites = (gd.map.sites || []).filter((s) => s.zone === z.key);
      return h('div', { class: 'zone-block' },
        h('h3', null, h('span', { class: 'zone-dot', style: { background: z.color } }), z.name),
        h('div', { class: 'site-grid' }, sites.map((s) => {
          const e = lay[s.id];
          const def = e ? I.buildings.get(e.b) : null;
          return h('button', {
            type: 'button', class: `site-btn${e ? '' : ' empty-site'}${selected === s.id ? ' selected' : ''}`,
            'aria-label': `Site ${s.id}: ${def ? `${def.name} level ${e.lv || 1}` : `empty ${s.kind} site`}`,
            onclick: () => openSite(s.id),
          },
          h('span', { class: 'site-id' }, `${s.id} - ${s.kind}`),
          h('span', { class: 'site-b' }, def ? `${def.name} (lv ${def.key === 'core' ? coreLevel() : e.lv || 1})` : 'Empty'),
          def && def.key === 'drug_battery' ? h('span', { class: 'small muted' }, `${shortDrugName(gd, e.drug)} - ${(e.rx || []).length} germs`) : null);
        })));
    });
    mount(listHost, ...blocks);
  }

  function paint() {
    paintResources();
    paintCore();
    paintPolicy();
    paintList();
    if (view && view.update) {
      try { view.update(layout(), { coreLevel: coreLevel(), highlightSites: selected ? [selected] : [], showRanges: true }); } catch (e) { console.error(e); }
    }
  }

  function buildSheet(siteId, site) {
    const opts = buildOptions(gd, S(), siteId);
    const zone = I.zones.get(site.zone);
    const body = h('div', { class: 'stack' },
      h('p', { class: 'muted mb-0' }, `Empty ${site.kind} site in the ${zone ? zone.name.toLowerCase() : site.zone}.`));
    const m = openModal({ title: `Build at ${siteId}`, body, actions: [{ label: 'Close', value: null }] });
    if (!opts.length) {
      body.append(h('p', null, 'Nothing can be built on this kind of site.'));
      return;
    }
    const list = h('div', { class: 'option-list' });
    for (const o of opts) {
      const btn = h('button', { type: 'button', class: 'btn btn-small btn-primary', disabled: !o.ok, 'aria-label': `Build ${o.def.name}` }, 'Build');
      btn.addEventListener('click', async () => {
        if (o.def.key === 'drug_battery') {
          m.close(null);
          batteryBuildSheet(siteId, o);
          return;
        }
        await busy(btn, async () => {
          const ok = await act('/api/base/build', { site: siteId, b: o.def.key }, `${o.def.name} built.`);
          if (ok) m.close(true);
        });
      });
      list.append(h('div', { class: `option${o.ok ? '' : ' disabled'}` },
        catSwatch(o.def),
        h('div', { class: 'grow' },
          h('strong', null, o.def.name),
          h('p', null, o.def.desc || ''),
          h('div', { class: 'row mt-1' },
            h('span', { class: 'cost' }, costText(o.cost)),
            chip(`${o.count}/${o.max} built`, { className: o.count >= o.max ? 'warn' : '' })),
          o.reason ? h('p', { style: 'color:var(--danger)' }, o.reason) : null),
        btn));
    }
    body.append(list);
  }

  function batteryBuildSheet(siteId, o) {
    const picker = drugPicker(gd, S(), (S().drugs || [])[0]);
    const rx = rxEditor(gd, []);
    const m = openModal({
      title: `Build a ${o.def.name} at ${siteId}`,
      className: 'wide',
      body: h('div', { class: 'stack' }, h('p', { class: 'mb-0' }, `Cost: ${costText(o.cost)}.`), picker.el, rx.el),
      actions: [
        { label: 'Cancel', value: null },
        {
          label: 'Build battery', kind: 'primary', disabled: picker.empty,
          onClick: async (btn) => {
            let ok = false;
            await busy(btn, async () => { ok = await act('/api/base/build', { site: siteId, b: 'drug_battery', drug: picker.value, rx: rx.value }, 'Drug battery built.'); });
            return ok ? true : false;
          },
        },
      ],
    });
    return m;
  }

  function batterySheet(siteId, entry) {
    const picker = drugPicker(gd, S(), entry.drug);
    const rx = rxEditor(gd, entry.rx || []);
    openModal({
      title: `Battery ${siteId}: drug and prescription`,
      className: 'wide',
      body: h('div', { class: 'stack' }, picker.el, rx.el),
      actions: [
        { label: 'Cancel', value: null },
        {
          label: 'Save', kind: 'primary', disabled: picker.empty,
          onClick: async (btn) => {
            let ok = false;
            await busy(btn, async () => { ok = await act('/api/base/battery', { site: siteId, drug: picker.value, rx: rx.value }, 'Battery updated.'); });
            return ok ? true : false;
          },
        },
      ],
    });
  }

  function buildingSheet(siteId, entry) {
    const def = I.buildings.get(entry.b);
    if (!def) return;
    const isCore = def.key === 'core';
    const lv = isCore ? coreLevel() : entry.lv || 1;
    const up = upgradeInfo(gd, S(), siteId);
    const body = h('div', { class: 'stack' },
      h('div', { class: 'row' }, catSwatch(def),
        h('div', { class: 'grow' }, h('strong', null, `${def.name} - level ${lv}`), h('div', { class: 'small muted' }, `Site ${siteId} - ${fmt(buildingHp(gd, def, lv))} HP`))),
      h('p', { class: 'mb-0' }, def.desc || ''));
    if (def.key === 'drug_battery') {
      const d = I.drugs.get(entry.drug);
      body.append(h('div', { class: 'card soft' },
        h('p', { class: 'mb-0' }, h('strong', null, 'Drug: '), d ? d.name : 'none'),
        h('p', { class: 'mb-0' }, h('strong', null, 'Prescribed for: '),
          (entry.rx || []).length ? entry.rx.map((k) => (I.units.get(k) || {}).real || k).join(', ') : 'nobody yet (the battery stays idle)')));
    }
    if (up && !up.maxed) {
      body.append(h('p', { class: 'mb-0' }, h('strong', null, `Upgrade to level ${up.nextLv}: `), costText(up.cost),
        up.reason ? h('span', { style: 'color:var(--danger)' }, ` - ${up.reason}`) : null));
    } else if (up && up.maxed) {
      body.append(h('p', { class: 'muted mb-0' }, 'Maximum level reached.'));
    }
    const actions = [{ label: 'Close', value: null }];
    if (!isCore) {
      const refund = refundFor(gd, def);
      actions.push({
        label: 'Remove', kind: 'danger', icon: 'trash',
        onClick: async (btn) => {
          const sure = await confirmDialog(`Remove the ${def.name} at ${siteId}? You get back ${costText(refund)}.`, { title: 'Remove building', okLabel: 'Remove', danger: true });
          if (!sure) return false;
          let ok = false;
          await busy(btn, async () => { ok = await act('/api/base/remove', { site: siteId }, `${def.name} removed.`); });
          return ok ? true : false;
        },
      });
    }
    if (def.key === 'drug_battery') {
      actions.push({ label: 'Drug and prescription', icon: 'pill', onClick: () => { setTimeout(() => batterySheet(siteId, entry), 0); return true; } });
    }
    if (up && !up.maxed) {
      actions.push({
        label: `Upgrade to ${up.nextLv}`, kind: 'primary', icon: 'plus', disabled: !up.ok,
        onClick: async (btn) => {
          let ok = false;
          await busy(btn, async () => { ok = await act('/api/base/upgrade', { site: siteId }, `${def.name} upgraded to level ${up.nextLv}.`); });
          return ok ? true : false;
        },
      });
    }
    openModal({ title: def.name, body, actions });
  }

  function openSite(siteId) {
    const site = I.sites.get(siteId);
    if (!site) return;
    selected = siteId;
    paintList();
    if (view) {
      try {
        if (view.focusSite) view.focusSite(siteId);
        if (view.update) view.update(layout(), { coreLevel: coreLevel(), highlightSites: [siteId], showRanges: true });
      } catch (e) { console.error(e); }
    }
    const entry = layout()[siteId];
    if (entry) buildingSheet(siteId, entry);
    else buildSheet(siteId, site);
  }

  paint();
  view = await mountBase(baseHost, {
    gd,
    layout: layout(),
    coreLevel: coreLevel(),
    editable: true,
    onSiteTap: (id) => openSite(id),
    highlightSites: [],
    showRanges: true,
  }, params.isCurrent);
  if (view) onLeave(root, () => view.destroy && view.destroy());
}
