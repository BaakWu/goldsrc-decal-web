// core_pipeline_test.mjs -- end-to-end core pipeline in Node:
// synthesize a white-background "logo" ImageData, run recommend -> mask ->
// palette -> WAD, then validate the WAD header and decode it back.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const core = await import(new URL("../decal-core.js", import.meta.url).href);
const C = core.default || core;

function assert(cond, msg) { if (!cond) { console.error("FAIL: " + msg); process.exit(1); } }

// 96x96 white background with a red 40x40 square in the center.
const w = 96, h = 96;
const data = new Uint8Array(w * h * 4);
for (let p = 0; p < w * h; p++) data[p * 4] = 255, data[p * 4 + 1] = 255, data[p * 4 + 2] = 255, data[p * 4 + 3] = 255;
const cx = w >> 1, cy = h >> 1, r = 20;
for (let y = cy - r; y < cy + r; y++)
  for (let x = cx - r; x < cx + r; x++) {
    const i = (y * w + x) * 4;
    data[i] = 220; data[i + 1] = 40; data[i + 2] = 40;
  }
const id = { width: w, height: h, data };

const rec = C.recommend(id);
assert(rec.strategy === "white", `expected white strategy, got ${rec.strategy}`);
console.log("recommend ->", rec);

const [tw, th] = C.pickSize(w, h, 10752);
assert(tw % 16 === 0 && th % 16 === 0, "top mip not multiple of 16");
assert(tw * th <= 10752, "top mip over maxpixels");
console.log("pickSize ->", [tw, th]);

// mask for top mip (simulate same data at tw x th by nearest scaling)
function downsample(id, tw, th) {
  const d = new Uint8Array(tw * th * 4);
  for (let y = 0; y < th; y++)
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(id.width - 1, Math.round(x * id.width / tw));
      const sy = Math.min(id.height - 1, Math.round(y * id.height / th));
      const si = (sy * id.width + sx) * 4, di = (y * tw + x) * 4;
      d[di] = id.data[si]; d[di+1] = id.data[si+1]; d[di+2] = id.data[si+2]; d[di+3] = 255;
    }
  return { width: tw, height: th, data: d };
}
const top = downsample(id, tw, th);
const keep = C.backgroundMask(top, "white", null);
let kept = 0; for (let p = 0; p < keep.length; p++) if (keep[p]) kept++;
const ratio = kept / (tw * th);
assert(ratio > 0.15 && ratio < 0.85, `kept ratio out of range: ${ratio}`);
console.log(`backgroundMask -> kept ${kept}/${tw*th} = ${(100*ratio).toFixed(1)}%`);

// palette build
const colors = [];
for (let p = 0; p < keep.length; p++) if (keep[p])
  colors.push([top.data[p*4], top.data[p*4+1], top.data[p*4+2]]);
const uniq = Array.from(new Set(colors.map(c => c.join(",")))).map(s => s.split(",").map(Number));
let real = uniq.length > 255 ? C.medianCut(colors, 255) : uniq.slice(0, 255);
while (real.length < 255) real.push([0, 0, 0]);
const palette = real.concat([[0, 0, 255]]); // transparent: 255 reserved
assert(palette.length === 256, "palette must be 256");
assert(palette[255].join() === "0,0,255", "palette[255] must be the reserved blue");

const lookup = new Map(real.map((c, i) => [c.join(","), i]));
const mips = [];
for (let m = 0; m < 4; m++) {
  const mw = tw >> m, mh = th >> m;
  const mid = downsample(id, mw, mh);
  const mk = C.backgroundMask(mid, "white", null);
  const idx = new Uint8Array(mw * mh);
  for (let p = 0; p < idx.length; p++) {
    if (!mk[p]) { idx[p] = 255; continue; }
    const c = [mid.data[p*4], mid.data[p*4+1], mid.data[p*4+2]];
    idx[p] = lookup.has(c.join(",")) ? lookup.get(c.join(",")) : C.nearest(real, c);
  }
  mips.push(idx);
}
const wadBuf = C.buildWad("{tempdecal", tw, th, mips, palette);
const wad = Buffer.from(wadBuf);
assert(wad.subarray(0, 4).toString() === "WAD3", "WAD signature");
const numlumps = wad.readUInt32LE(4);
const lumpdir = wad.readUInt32LE(8);
assert(numlumps === 1, `numlumps should be 1, got ${numlumps}`);
assert(wad.length === lumpdir + 32, "lumpdir should point at entry (file = 12 + tex + 32)");
assert(wad[lumpdir + 12] === 0x43, `lump type should be 'C', got ${String.fromCharCode(wad[lumpdir+12])}`);
const tex = wad.subarray(12, lumpdir);
const texW = tex.readUInt32LE(16), texH = tex.readUInt32LE(20);
assert(texW === tw && texH === th, `texture dims ${texW}x${texH} != ${tw}x${th}`);
const sumMip = (tw>>0)*(th>>0) + (tw>>1)*(th>>1) + (tw>>2)*(th>>2) + (tw>>3)*(th>>3);
const palCount = tex.readUInt16LE(40 + sumMip);
assert(palCount === 256, `palette count should be 256, got ${palCount}`);
console.log(`buildWad -> ${wad.length}B  ${tw}x${th}  numlumps=${numlumps}  type='C'  palette=256`);

console.log("OK  core pipeline produced a structurally-valid WAD3");
process.exit(0);
