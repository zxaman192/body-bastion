import { toast } from './ui.js';

const TOKEN_KEY = 'bb.token';
const TIMEOUT_MS = 30000;

let memoryToken = null;
let unauthorizedHandler = null;

export class ApiError extends Error {
  constructor(status, detail, data) {
    super(detail || `Request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail || `Request failed (${status})`;
    this.data = data;
  }
}

export function getToken() {
  try {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) return t;
  } catch { /* storage blocked */ }
  return memoryToken;
}

export function setToken(token) {
  memoryToken = token || null;
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* storage blocked: keep the in-memory copy */ }
}

export function clearToken() {
  setToken(null);
}

export function onUnauthorized(fn) {
  unauthorizedHandler = fn;
}

export function formatDetail(detail, status) {
  if (!detail) return status ? `Request failed (${status})` : 'Request failed';
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => {
      if (typeof d === 'string') return d;
      const loc = Array.isArray(d.loc) ? d.loc.filter((x) => x !== 'body').join('.') : '';
      return loc ? `${loc}: ${d.msg || 'invalid'}` : (d.msg || JSON.stringify(d));
    }).join('; ');
  }
  if (typeof detail === 'object') return detail.message || detail.msg || JSON.stringify(detail);
  return String(detail);
}

function headersFor({ groupToken, json, accept } = {}) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  headers.Accept = accept || 'application/json';
  if (groupToken) {
    headers['X-Group-Token'] = groupToken;
  } else {
    const t = getToken();
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  return headers;
}

async function rawFetch(method, path, body, opts = {}) {
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeout || TIMEOUT_MS) : null;
  const init = {
    method,
    headers: headersFor({ groupToken: opts.groupToken, json: body !== undefined, accept: opts.accept }),
    cache: 'no-store',
    credentials: 'same-origin',
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  if (ctrl) init.signal = ctrl.signal;
  try {
    return await fetch(path, init);
  } catch (e) {
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const msg = e && e.name === 'AbortError'
      ? 'The server took too long to answer. Please try again.'
      : offline ? 'You are offline. Check your connection and try again.' : 'Network error: could not reach the server.';
    throw new ApiError(0, msg, null);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function handleError(res, path, opts) {
  let data = null;
  let detail = null;
  try {
    const text = await res.text();
    if (text) {
      try {
        data = JSON.parse(text);
        detail = formatDetail(data && data.detail !== undefined ? data.detail : data, res.status);
      } catch {
        detail = text.length < 300 ? text : null;
      }
    }
  } catch { /* body unreadable */ }
  if (!detail) detail = res.status === 404 ? 'Not found' : res.status >= 500 ? 'Server error. Please try again in a moment.' : `Request failed (${res.status})`;
  const err = new ApiError(res.status, detail, data);
  const isAuthCall = path.startsWith('/api/auth/login') || path.startsWith('/api/auth/register');
  if (res.status === 401 && !opts.groupToken && !isAuthCall) {
    clearToken();
    if (unauthorizedHandler) {
      try { unauthorizedHandler(err); } catch { /* ignore */ }
    }
    if (!opts.silent) toast('Your session has ended. Please log in again.', 'warn');
    throw err;
  }
  if (!opts.silent) toast(detail, 'error');
  throw err;
}

export async function api(method, path, body, opts = {}) {
  let res;
  try {
    res = await rawFetch(method, path, body, opts);
  } catch (e) {
    if (!opts.silent) toast(e.detail || e.message, 'error');
    throw e;
  }
  if (!res.ok) return handleError(res, path, opts);
  if (res.status === 204) return null;
  const type = res.headers.get('content-type') || '';
  if (type.includes('application/json')) return res.json();
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

export const get = (path, opts) => api('GET', path, undefined, opts);
export const post = (path, body = {}, opts) => api('POST', path, body, opts);
export const del = (path, body, opts) => api('DELETE', path, body, opts);

export async function download(path, filename, opts = {}) {
  let res;
  try {
    res = await rawFetch('GET', path, undefined, { ...opts, accept: 'text/csv, application/octet-stream, */*' });
  } catch (e) {
    if (!opts.silent) toast(e.detail || e.message, 'error');
    throw e;
  }
  if (!res.ok) return handleError(res, path, opts);
  const blob = await res.blob();
  let name = filename;
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  if (m && m[1]) {
    try { name = decodeURIComponent(m[1]); } catch { name = m[1]; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'export.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  return true;
}

export async function fetchJsonFile(path) {
  const res = await fetch(path, { cache: 'no-cache', credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(res.status, `Could not load ${path} (${res.status})`, null);
  return res.json();
}
