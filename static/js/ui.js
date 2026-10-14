const ICONS = {
  home: '<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  build: '<rect x="3" y="4" width="8" height="6" rx="1"/><rect x="13" y="4" width="8" height="6" rx="1"/><rect x="8" y="14" width="8" height="6" rx="1"/><path d="M3 17h3M18 17h3"/>',
  germ: '<circle cx="12" cy="12" r="5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/><circle cx="10.5" cy="11" r=".6"/><circle cx="13.5" cy="13" r=".6"/>',
  campaign: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h3"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 21h8M9 17h6"/>',
  clan: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M15 14.5c3 0 6 2 6 5"/>',
  flask: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7M8 11h7"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  shieldcheck: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  bars: '<path d="M5 20V12M12 20V5M19 20v-9"/>',
  classroom: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M12 16v4M8 20h8M7 9h6M7 12h4"/>',
  sliders: '<path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12"/><circle cx="16" cy="6" r="2"/><circle cx="10" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>',
  atp: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  leaf: '<path d="M5 19c0-9 6-14 15-14 0 9-5 15-14 15"/><path d="M5 19l7-7"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 21h16"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  warn: '<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4M6 12h10"/>',
  pill: '<path d="M10.5 3.5a5 5 0 0 1 7 7l-7 7a5 5 0 0 1-7-7z"/><path d="M7 7l7 7"/>',
  syringe: '<path d="M18 2l4 4M20 4l-4 4M14 6l4 4-9 9H5v-4z"/><path d="M10 10l2 2M7.5 12.5l2 2"/>',
  castle: '<path d="M4 21V8h3V5h2v3h2V5h2v3h2V5h2v3h3v13z"/><path d="M10 21v-5h4v5"/>',
  fullscreen: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  worm: '<path d="M3 15c2-4 4-4 6 0s4 4 6 0 4-4 6 0"/><circle cx="20.5" cy="14" r=".7"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 13a8 8 0 0 0 14.9 3"/><path d="M5 3v5h5M19 21v-5h-5"/>',
  map: '<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z"/><path d="M9 4v14M15 6v14"/>',
  qr: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.5M14 20.5h.5M17.5 17.5H21V21h-3.5z"/>',
  child: '<circle cx="12" cy="6" r="3"/><path d="M8 21v-6l-2-3 3-2h6l3 2-2 3v6"/>',
  adult: '<circle cx="12" cy="5" r="2.5"/><path d="M9 21v-8H7l1-5h8l1 5h-2v8"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
};

export function icon(name, opts = {}) {
  const size = opts.size || 22;
  const filled = name === 'atp' || name === 'star' || name === 'play' || name === 'drop';
  const span = document.createElement('span');
  span.className = 'icon' + (opts.className ? ' ' + opts.className : '');
  const body = ICONS[name] || ICONS.info;
  span.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false">${body}</svg>`;
  if (opts.label) {
    span.setAttribute('role', 'img');
    span.setAttribute('aria-label', opts.label);
  } else {
    span.setAttribute('aria-hidden', 'true');
  }
  return span;
}

export function brandMark(size = 40) {
  const span = document.createElement('span');
  span.className = 'brand-mark';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 512 512" width="${size}" height="${size}" focusable="false">
<path d="M112 120V88h44v28h34V88h44v28h44V88h44v28h34V88h44v32l0 140c0 92-66 160-144 196-78-36-144-104-144-196z" fill="#c2185b"/>
<path d="M112 120V88h44v28h34V88h44v28h44V88h44v28h34V88h44v32" fill="none" stroke="#7a0f3a" stroke-width="10" stroke-linejoin="round"/>
<path d="M190 176h132v58H190v58h132v42h-66" fill="none" stroke="#7a0f3a" stroke-width="50" stroke-linecap="round" stroke-linejoin="round"/>
<path d="M190 176h132v58H190v58h132v42h-66" fill="none" stroke="#ffd2bf" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/>
<circle cx="256" cy="376" r="32" fill="#ffc94a" stroke="#7a0f3a" stroke-width="10"/></svg>`;
  return span;
}

function setProp(el, key, value) {
  if (value === null || value === undefined || value === false) {
    if (key === 'disabled' || key === 'checked' || key === 'hidden' || key === 'selected') el[key] = false;
    return;
  }
  if (key === 'class' || key === 'className') {
    el.className = Array.isArray(value) ? value.filter(Boolean).join(' ') : value;
  } else if (key === 'text') {
    el.textContent = String(value);
  } else if (key === 'html') {
    el.innerHTML = value;
  } else if (key === 'style') {
    if (typeof value === 'string') el.setAttribute('style', value);
    else for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('--')) el.style.setProperty(k, v);
      else el.style[k] = v;
    }
  } else if (key.startsWith('on') && typeof value === 'function') {
    el.addEventListener(key.slice(2).toLowerCase(), value);
  } else if (key === 'value' || key === 'checked' || key === 'disabled' || key === 'selected' || key === 'hidden' || key === 'indeterminate') {
    el[key] = value;
  } else if (value === true) {
    el.setAttribute(key, '');
  } else {
    el.setAttribute(key, String(value));
  }
}

export function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false || c === true) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
  return el;
}

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props && (typeof props !== 'object' || props instanceof Node || Array.isArray(props))) {
    children.unshift(props);
  } else if (props) {
    for (const [k, v] of Object.entries(props)) setProp(el, k, v);
  }
  return append(el, children);
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

export function mount(el, ...children) {
  clear(el);
  return append(el, children);
}

const NF = (() => {
  try { return new Intl.NumberFormat('en-IN'); } catch { return null; }
})();

export function fmt(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '-';
  const v = Math.trunc(Number(n));
  return NF ? NF.format(v) : String(v);
}

export function fmtDate(value) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  try {
    return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function fmtDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}h ${String(mm).padStart(2, '0')}m`;
  if (mm > 0) return `${mm}m ${String(ss).padStart(2, '0')}s`;
  return `${ss}s`;
}

export function starsEl(n, max = 3, label) {
  const count = Math.max(0, Math.min(max, Number(n) || 0));
  const wrap = h('span', { class: 'stars', role: 'img', 'aria-label': label || `${count} of ${max} stars` });
  for (let i = 0; i < max; i++) {
    const s = icon('star', { size: 20, className: i < count ? 'on' : 'off' });
    wrap.appendChild(s);
  }
  return wrap;
}

let toastHost = null;
function ensureToastHost() {
  if (toastHost && document.body.contains(toastHost)) return toastHost;
  toastHost = document.getElementById('toasts');
  if (!toastHost) {
    toastHost = h('div', { id: 'toasts', class: 'toasts', 'aria-live': 'polite', 'aria-atomic': 'false' });
    document.body.appendChild(toastHost);
  }
  return toastHost;
}

export function toast(message, kind = 'info', ms) {
  if (typeof document === 'undefined') return;
  const host = ensureToastHost();
  const duration = ms || (kind === 'error' ? 6000 : 3500);
  const iconName = kind === 'error' ? 'warn' : kind === 'ok' ? 'check' : kind === 'warn' ? 'warn' : 'info';
  const el = h('div', { class: `toast toast-${kind}`, role: kind === 'error' ? 'alert' : 'status' },
    icon(iconName, { size: 20 }), h('span', { class: 'toast-msg' }, String(message)),
    h('button', { class: 'toast-x', type: 'button', 'aria-label': 'Dismiss', onclick: () => remove() }, icon('close', { size: 16 })));
  let timer = null;
  const remove = () => {
    clearTimeout(timer);
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  };
  host.appendChild(el);
  while (host.children.length > 4) host.firstChild.remove();
  timer = setTimeout(remove, duration);
  return remove;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const openModals = [];

export function openModal({ title, body, actions, dismissible = true, className = '', labelledBy, onClose } = {}) {
  const previous = document.activeElement;
  const titleId = 'm' + Math.random().toString(36).slice(2, 9);
  let resolveFn;
  const result = new Promise((r) => { resolveFn = r; });
  let closed = false;
  const panel = h('div', { class: `modal ${className}`, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': labelledBy || titleId, tabindex: '-1' });
  const backdrop = h('div', { class: 'modal-backdrop' }, panel);
  const header = h('div', { class: 'modal-head' },
    h('h2', { id: titleId, class: 'modal-title' }, title || ''),
    dismissible ? h('button', { class: 'icon-btn modal-x', type: 'button', 'aria-label': 'Close', onclick: () => close(null) }, icon('close')) : null);
  const content = h('div', { class: 'modal-body' });
  if (body !== undefined && body !== null) append(content, [typeof body === 'string' ? h('p', null, body) : body]);
  const footer = h('div', { class: 'modal-actions' });
  panel.append(header, content, footer);

  function close(value) {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey, true);
    const i = openModals.indexOf(api);
    if (i >= 0) openModals.splice(i, 1);
    backdrop.classList.add('leaving');
    setTimeout(() => backdrop.remove(), 160);
    if (!openModals.length) document.body.classList.remove('modal-open');
    if (onClose) {
      try { onClose(value); } catch { /* ignore */ }
    }
    if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
      try { previous.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
    resolveFn(value);
  }

  function setActions(list) {
    clear(footer);
    for (const a of list || []) {
      const btn = h('button', {
        type: 'button',
        class: `btn ${a.kind ? 'btn-' + a.kind : ''}`,
        disabled: !!a.disabled,
        onclick: async () => {
          if (a.onClick) {
            const r = await a.onClick(btn);
            if (r === false) return;
            if (r !== undefined && r !== true) { close(r); return; }
          }
          close(a.value !== undefined ? a.value : a.label);
        },
      }, a.icon ? icon(a.icon, { size: 18 }) : null, a.label);
      if (a.id) btn.dataset.action = a.id;
      footer.appendChild(btn);
    }
    footer.hidden = !(list && list.length);
  }

  function onKey(e) {
    if (openModals[openModals.length - 1] !== api) return;
    if (e.key === 'Escape' && dismissible) {
      e.preventDefault();
      close(null);
    } else if (e.key === 'Tab') {
      const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null || el === document.activeElement);
      if (!items.length) { e.preventDefault(); panel.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop && dismissible) close(null);
  });
  setActions(actions === undefined ? [{ label: 'Close', value: null }] : actions);
  document.addEventListener('keydown', onKey, true);
  document.body.appendChild(backdrop);
  document.body.classList.add('modal-open');
  const api = { el: panel, body: content, footer, result, close, setActions, setTitle: (t) => { header.firstChild.textContent = t; } };
  openModals.push(api);
  requestAnimationFrame(() => {
    const target = panel.querySelector('[autofocus]') || panel.querySelector('.modal-body ' + FOCUSABLE) || panel.querySelector('.modal-actions .btn') || panel;
    try { target.focus({ preventScroll: true }); } catch { /* ignore */ }
  });
  return api;
}

export function modal(opts) {
  return openModal(opts).result;
}

export function closeAllModals() {
  for (const m of [...openModals]) m.close(null);
}

export function confirmDialog(message, { title = 'Are you sure?', okLabel = 'OK', cancelLabel = 'Cancel', danger = false, typed = null } = {}) {
  const body = h('div', null);
  append(body, [typeof message === 'string' ? h('p', null, message) : message]);
  let input = null;
  if (typed) {
    input = h('input', { type: 'text', class: 'input', autocomplete: 'off', spellcheck: 'false', 'aria-label': `Type ${typed} to confirm` });
    body.append(h('label', { class: 'field' }, h('span', { class: 'field-label' }, `Type "${typed}" to confirm`), input));
  }
  const m = openModal({
    title,
    body,
    actions: [
      { label: cancelLabel, value: false },
      { label: okLabel, value: true, kind: danger ? 'danger' : 'primary', id: 'ok', disabled: !!typed },
    ],
  });
  if (input) {
    const okBtn = m.footer.querySelector('[data-action="ok"]');
    input.addEventListener('input', () => { okBtn.disabled = input.value.trim() !== typed; });
    setTimeout(() => input.focus(), 30);
  }
  return m.result.then((v) => v === true);
}

export function promptDialog(message, { title = 'Enter a value', label = '', value = '', placeholder = '', okLabel = 'OK', type = 'text', multiline = false, required = false } = {}) {
  const input = multiline
    ? h('textarea', { class: 'input', rows: '3', placeholder, 'aria-label': label || title })
    : h('input', { class: 'input', type, placeholder, 'aria-label': label || title, autocomplete: type === 'password' ? 'current-password' : 'off' });
  input.value = value;
  const body = h('div', null, message ? h('p', null, message) : null,
    h('label', { class: 'field' }, label ? h('span', { class: 'field-label' }, label) : null, input));
  const m = openModal({
    title,
    body,
    actions: [
      { label: 'Cancel', value: null },
      { label: okLabel, kind: 'primary', onClick: () => {
        if (required && !input.value.trim()) { input.focus(); return false; }
        return { value: input.value };
      } },
    ],
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      if (required && !input.value.trim()) return;
      m.close({ value: input.value });
    }
  });
  setTimeout(() => input.focus(), 30);
  return m.result.then((r) => (r && typeof r === 'object' ? r.value : null));
}

let loaderCount = 0;
let loaderEl = null;
export function showLoader(text = 'Loading...') {
  loaderCount++;
  if (!loaderEl) {
    loaderEl = h('div', { class: 'loader-overlay', role: 'status', 'aria-live': 'polite' },
      h('div', { class: 'loader-box' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', { class: 'loader-text' }, text)));
  } else {
    loaderEl.querySelector('.loader-text').textContent = text;
  }
  if (!loaderEl.isConnected) document.body.appendChild(loaderEl);
}

export function hideLoader() {
  loaderCount = Math.max(0, loaderCount - 1);
  if (loaderCount === 0 && loaderEl) loaderEl.remove();
}

export async function withLoader(promiseOrFn, text) {
  showLoader(text);
  try {
    return await (typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn);
  } finally {
    hideLoader();
  }
}

export function spinnerBlock(text = 'Loading...') {
  return h('div', { class: 'block-loader', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('span', null, text));
}

export async function busy(btn, fn) {
  if (btn.disabled) return undefined;
  btn.disabled = true;
  btn.classList.add('is-busy');
  btn.setAttribute('aria-busy', 'true');
  try {
    return await fn();
  } finally {
    btn.disabled = false;
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
  }
}

let tabSeq = 0;
export function tabs(container, items, { active, onChange, label = 'Sections' } = {}) {
  const id = 'tabs' + (++tabSeq);
  const list = h('div', { class: 'tabs', role: 'tablist', 'aria-label': label });
  const panel = h('div', { class: 'tab-panel', role: 'tabpanel', id: id + '-panel', tabindex: '0' });
  const buttons = new Map();
  let current = null;
  let renderToken = 0;
  function select(tabId, focus = false) {
    const item = items.find((t) => t.id === tabId) || items[0];
    if (!item) return;
    current = item.id;
    for (const [tid, b] of buttons) {
      const on = tid === current;
      b.setAttribute('aria-selected', on ? 'true' : 'false');
      b.tabIndex = on ? 0 : -1;
      b.classList.toggle('active', on);
    }
    panel.setAttribute('aria-labelledby', `${id}-${current}`);
    clear(panel);
    const token = ++renderToken;
    const out = item.render(panel, () => token === renderToken);
    if (out && typeof out.catch === 'function') out.catch((e) => { if (token === renderToken) panel.append(errorBlock(e)); });
    if (focus) buttons.get(current).focus();
    if (onChange) onChange(current);
  }
  items.forEach((t, i) => {
    const b = h('button', {
      type: 'button', role: 'tab', class: 'tab', id: `${id}-${t.id}`, 'aria-controls': id + '-panel',
      onclick: () => select(t.id),
      onkeydown: (e) => {
        let j = null;
        if (e.key === 'ArrowRight') j = (i + 1) % items.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + items.length) % items.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = items.length - 1;
        if (j !== null) { e.preventDefault(); select(items[j].id, true); }
      },
    }, t.icon ? icon(t.icon, { size: 18 }) : null, t.label);
    buttons.set(t.id, b);
    list.appendChild(b);
  });
  container.append(list, panel);
  select(active && items.some((t) => t.id === active) ? active : items[0] && items[0].id);
  return { select, get current() { return current; }, panel };
}

export function errorBlock(err, retry) {
  const msg = err && err.detail ? err.detail : err && err.message ? err.message : String(err || 'Something went wrong');
  return h('div', { class: 'callout callout-danger', role: 'alert' },
    icon('warn'), h('div', null, h('strong', null, 'Could not load this. '), h('span', null, msg),
      retry ? h('div', { class: 'mt-1' }, h('button', { class: 'btn btn-small', type: 'button', onclick: retry }, icon('refresh', { size: 16 }), 'Try again')) : null));
}

export function emptyBlock(text, iconName = 'info') {
  return h('div', { class: 'empty' }, icon(iconName, { size: 28 }), h('p', null, text));
}

const leaveHooks = new Map();
export function onLeave(root, fn) {
  if (!leaveHooks.has(root)) leaveHooks.set(root, []);
  leaveHooks.get(root).push(fn);
}

export function runLeave(root) {
  const list = leaveHooks.get(root);
  leaveHooks.delete(root);
  if (!list) return;
  for (const fn of list.reverse()) {
    try { fn(); } catch (e) { console.error(e); }
  }
}

let leaveGuard = null;
export function setLeaveGuard(fn) { leaveGuard = fn || null; }
export function getLeaveGuard() { return leaveGuard; }

export function navigate(hash, { replace = false } = {}) {
  const target = hash.startsWith('#') ? hash : '#' + hash;
  if (location.hash === target) {
    window.dispatchEvent(new CustomEvent('bb:rerender'));
    return;
  }
  if (replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new CustomEvent('bb:rerender'));
  } else {
    location.hash = target;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: 'display:none' });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied to clipboard', 'ok', 2000);
    return true;
  } catch {
    const ta = h('textarea', { style: 'position:fixed;opacity:0;left:-1000px' });
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    toast(ok ? 'Copied to clipboard' : 'Copy failed: select and copy the text manually', ok ? 'ok' : 'warn', 2500);
    return ok;
  }
}

export function svgFromString(str) {
  if (!str || typeof str !== 'string') return null;
  const doc = new DOMParser().parseFromString(str, 'image/svg+xml');
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
  for (const s of [...svg.querySelectorAll('script, foreignObject')]) s.remove();
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    for (const attr of [...el.attributes]) {
      const n = attr.name.toLowerCase();
      if (n.startsWith('on') || ((n === 'href' || n === 'xlink:href') && /^\s*javascript:/i.test(attr.value))) el.removeAttribute(attr.name);
    }
  }
  const node = document.importNode(svg, true);
  node.setAttribute('role', 'img');
  return node;
}

export function chip(text, { color, className = '', title } = {}) {
  const el = h('span', { class: `chip ${className}`, title: title || null }, color ? h('span', { class: 'chip-dot', style: { background: color } }) : null, text);
  return el;
}

export function meter(pct, { label, kind = '', valueText } = {}) {
  const v = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
  return h('div', { class: 'meter-wrap' },
    label ? h('div', { class: 'meter-label' }, h('span', null, label), h('span', { class: 'meter-value' }, valueText || `${v}%`)) : null,
    h('div', { class: `meter ${kind}`, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(v), 'aria-label': label || 'Progress' },
      h('div', { class: 'meter-fill', style: { width: v + '%' } })));
}

export function screenHeader(title, { subtitle, back, actions } = {}) {
  return h('div', { class: 'screen-head' },
    back ? h('a', { class: 'icon-btn', href: back, 'aria-label': 'Back' }, icon('back')) : null,
    h('div', { class: 'screen-head-text' }, h('h1', null, title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
    actions ? h('div', { class: 'screen-head-actions' }, actions) : null);
}

export function setTitle(t) {
  document.title = t ? `${t} - Body Bastion` : 'Body Bastion';
}
