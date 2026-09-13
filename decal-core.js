/* decal-core.js -- pure (DOM-free) Core logic + WAD3 encoder.
 *
 * Shared by the browser (index.html) and (optionally) Node (for tests).
 *
 * UMD-ish export:
 *   browser:  window.Core = { ... }
 *   node:     module.exports = { ... }
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.Core = api;
})(typeof self !== "undefined" ? self : this, function () {

  // ------------------------------------------------------------ background
  function makeIsBg(kind, bg) {
    switch (kind) {
      case "white": return (r, g, b) => r >= 235 && g >= 235 && b >= 235;
      case "blue":  return (r, g, b) => b >= r && b >= g && (r + g + b) < 720 && Math.max(r, g, b) >= 40;
      case "custom":{ const [tr, tg, tb] = bg, tol = 50;
        return (r, g, b) => Math.abs(r - tr) < tol && Math.abs(g - tg) < tol && Math.abs(b - tb) < tol; }
      default:      return (r, g, b) => (r >= 235 && g >= 235 && b >= 235) || (b >= r && b >= g && (r + g + b) < 720);
    }
  }

  // id: { width, height, data: Uint8Array/Array (RGBA) }
  // Returns Uint8Array keep (1 = opaque / part of logo).
  function backgroundMask(id, kind, bg) {
    const w = id.width, h = id.height, d = id.data;
    const isbg = makeIsBg(kind, bg);
    const bgpx = new Uint8Array(w * h);
    for (let i = 0, p = 0; p < bgpx.length; i += 4, p++)
      bgpx[p] = isbg(d[i], d[i + 1], d[i + 2]) ? 1 : 0;
    const seen = new Uint8Array(w * h);
    const q = new Int32Array(w * h);
    let head = 0, tail = 0;
    const push = p => { if (bgpx[p] && !seen[p]) { seen[p] = 1; q[tail++] = p; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (head < tail) {
      const i = q[head++], x = i % w, y = (i / w) | 0;
      if (x > 0     && bgpx[i - 1] && !seen[i - 1]) { seen[i - 1] = 1; q[tail++] = i - 1; }
      if (x < w - 1 && bgpx[i + 1] && !seen[i + 1]) { seen[i + 1] = 1; q[tail++] = i + 1; }
      if (y > 0     && bgpx[i - w] && !seen[i - w]) { seen[i - w] = 1; q[tail++] = i - w; }
      if (y < h - 1 && bgpx[i + w] && !seen[i + w]) { seen[i + w] = 1; q[tail++] = i + w; }
    }
    const keep = new Uint8Array(w * h);
    for (let p = 0; p < keep.length; p++) keep[p] = seen[p] ? 0 : 1;
    return keep;
  }

  function alphaMask(id) {
    const n = id.width * id.height, keep = new Uint8Array(n);
    for (let i = 3, p = 0; p < n; i += 4, p++) keep[p] = id.data[i] >= 128 ? 1 : 0;
    return keep;
  }

  // ------------------------------------------------------------ recommendation
  function borderStats(id) {
    const w = id.width, h = id.height, d = id.data;
    const step = Math.max(1, Math.floor(Math.min(w, h) / 24));
    const px = [];
    const at = (x, y) => { const i = (y * w + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
    for (let x = 0; x < w; x += step) { px.push(at(x, 0), at(x, h - 1)); }
    for (let y = 0; y < h; y += step) { px.push(at(0, y), at(w - 1, y)); }
    const mean = [0, 1, 2].map(k => Math.floor(px.reduce((s, c) => s + c[k], 0) / px.length));
    const sd = [0, 1, 2].map(k => {
      const m = px.reduce((s, c) => s + c[k], 0) / px.length;
      return Math.round(Math.sqrt(px.reduce((s, c) => s + (c[k] - m) ** 2, 0) / px.length));
    });
    return { mean, sd };
  }

  function hasAlpha(id) {
    for (let i = 3; i < id.data.length; i += 4) if (id.data[i] < 255) return true;
    return false;
  }

  function recommend(id) {
    if (hasAlpha(id)) return { strategy: "alpha", bg: null, conf: 0.95 };
    const { mean, sd } = borderStats(id);
    const uniform = Math.max(...sd) <= 24;
    if (uniform) {
      if (mean[0] >= 235 && mean[1] >= 235 && mean[2] >= 235)
        return { strategy: "white", bg: null, conf: 0.90, mean };
      if (mean[2] >= mean[0] && mean[2] >= mean[1] && (mean[0] + mean[1] + mean[2]) < 720 && Math.max(...mean) >= 40)
        return { strategy: "blue", bg: null, conf: 0.85, mean };
      return { strategy: "bg", bg: mean, conf: 0.80, mean };
    }
    return { strategy: "white", bg: null, conf: 0.6 };
  }

  // ------------------------------------------------------------ size + palette
  function pickSize(w, h, maxpx) {
    const snap = v => Math.max(16, Math.round(v / 16) * 16);
    let tw = snap(w), th = snap(h);
    while (tw * th > maxpx) {
      const s = Math.sqrt(maxpx / (tw * th));
      tw = Math.max(16, Math.floor(tw * s / 16) * 16);
      th = Math.max(16, Math.floor(th * s / 16) * 16);
      if (tw <= 16 && th <= 16) break;
    }
    return [tw, th];
  }

  function maxRange(bucket, axis) {
    let lo = 255, hi = 0;
    for (const c of bucket) { if (c[axis] < lo) lo = c[axis]; if (c[axis] > hi) hi = c[axis]; }
    return hi - lo;
  }

  function medianCut(colors, maxc) {
    let buckets = [colors.slice()];
    while (buckets.length < maxc) {
      let best = -1, bestN = 1;
      for (let bi = 0; bi < buckets.length; bi++)
        if (buckets[bi].length > bestN) { best = bi; bestN = buckets[bi].length; }
      if (best < 0) break;
      const b = buckets[best];
      let axis = 0, maxR = -1;
      for (let a = 0; a < 3; a++) { const r = maxRange(b, a); if (r > maxR) { maxR = r; axis = a; } }
      b.sort((p, q) => p[axis] - q[axis]);
      const half = b.length >> 1;
      buckets.splice(best, 1, b.slice(0, half), b.slice(half));
    }
    return buckets.map(b => [
      Math.round(b.reduce((s, c) => s + c[0], 0) / b.length),
      Math.round(b.reduce((s, c) => s + c[1], 0) / b.length),
      Math.round(b.reduce((s, c) => s + c[2], 0) / b.length),
    ]);
  }

  function nearest(pal, c) {
    let best = 0, bd = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const d = (c[0] - pal[i][0]) ** 2 + (c[1] - pal[i][1]) ** 2 + (c[2] - pal[i][2]) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  // ------------------------------------------------------------ WAD3 writer
  function wname(s) {
    const b = new Uint8Array(16);
    for (let i = 0; i < s.length && i < 16; i++) b[i] = s.charCodeAt(i) & 0xff;
    return b;
  }

  // Builds the full .wad ArrayBuffer.  palette length must be 256.
  function buildWad(name, w, h, mips, palette) {
    const offs = [];
    let pos = 40;
    for (let m = 0; m < 4; m++) { offs.push(pos); if (m < 3) pos += (w >> m) * (h >> m); }

    let texSize = 40;
    for (const m of mips) texSize += m.length;
    texSize += 2 + palette.length * 3;
    while (texSize % 4) texSize++;

    const buf = new ArrayBuffer(texSize);
    const view = new DataView(buf);
    const u8 = new Uint8Array(buf);
    let o = 0;
    const w32 = v => { view.setUint32(o, v >>> 0, true); o += 4; };

    u8.set(wname(name), o); o += 16;
    w32(w); w32(h);
    for (const off of offs) w32(off);
    for (const m of mips) { u8.set(m, o); o += m.length; }
    view.setUint16(o, 256, true); o += 2;
    for (const [r, g, b] of palette) { u8[o++] = r & 255; u8[o++] = g & 255; u8[o++] = b & 255; }
    while (o < texSize) u8[o++] = 0;
    const tex = new Uint8Array(buf, 0, texSize);

    const total = 12 + texSize + 32;
    const wad = new Uint8Array(total);
    const dv = new DataView(wad.buffer);
    for (let i = 0; i < 4; i++) wad[i] = "WAD3".charCodeAt(i);
    dv.setUint32(4, 1, true);               // numlumps
    dv.setUint32(8, 12 + texSize, true);     // lumpdir_offset
    wad.set(tex, 12);
    const ld = 12 + texSize;                 // lump dir entry
    dv.setUint32(ld, 12, true);              // filepos
    dv.setUint32(ld + 4, texSize, true);     // disksize
    dv.setUint32(ld + 8, texSize, true);     // size
    wad[ld + 12] = 0x43;                     // 'C'
    wad[ld + 13] = 0; wad[ld + 14] = 0; wad[ld + 15] = 0;
    wad.set(wname(name), ld + 16);
    return wad.buffer;
  }

  return {
    makeIsBg, backgroundMask, alphaMask,
    borderStats, hasAlpha, recommend,
    pickSize, maxRange, medianCut, nearest,
    wname, buildWad,
  };
});
