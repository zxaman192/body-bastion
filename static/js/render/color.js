const cache = new Map();

export function parseHex(hex) {
  if (Array.isArray(hex)) return hex;
  let h = String(hex || '#888888').trim();
  if (h[0] === '#') h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [136, 136, 136];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex(c) {
  const v = (x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + v(c[0]) + v(c[1]) + v(c[2]);
}

export function mix(a, b, t) {
  const key = 'm' + a + b + t;
  let r = cache.get(key);
  if (r) return r;
  const ca = parseHex(a), cb = parseHex(b);
  r = toHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
  cache.set(key, r);
  return r;
}

export function shade(hex, amt) {
  return amt >= 0 ? mix(hex, '#ffffff', amt) : mix(hex, '#000000', -amt);
}

export function rgba(hex, a) {
  const key = 'a' + hex + a;
  let r = cache.get(key);
  if (r) return r;
  const c = parseHex(hex);
  r = `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  cache.set(key, r);
  return r;
}

export function luminance(hex) {
  const c = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function readableOn(hex) {
  return luminance(hex) > 0.45 ? '#1d1426' : '#ffffff';
}

export function hpColor(frac) {
  if (frac > 0.6) return '#3ccf6e';
  if (frac > 0.3) return '#f2c230';
  return '#ef4f4f';
}
