// Browser-path verification for the new "black" strategy.
// Decal-core.js is consumed by index.html via self.Core, so we emulate that.
global.self = {};
require("../decal-core.js");
const C = self.Core;

function assert(c, m) { if (!c) { console.error("FAIL: " + m); process.exit(1); } }

function make(fill, logo) {
  const w = 96, h = 96;
  const data = new Uint8Array(w * h * 4);
  for (let p = 0; p < w * h; p++) { data[p*4]=fill[0]; data[p*4+1]=fill[1]; data[p*4+2]=fill[2]; data[p*4+3]=255; }
  for (let y = 28; y < 68; y++) for (let x = 28; x < 68; x++) {
    const i = (y * w + x) * 4; const c = logo;
    data[i]=c[0]; data[i+1]=c[1]; data[i+2]=c[2];
  }
  return { width: w, height: h, data };
}

// 1) black bg + red logo -> recommend "black"
const recB = C.recommend(make([10, 10, 10], [220, 40, 40]));
assert(recB.strategy === "black", "expected black, got " + recB.strategy);
console.log("1. recommend(black bg)  ->", recB.strategy, "conf " + recB.conf);

// 2) white bg + red logo -> still "white" (regression)
const recW = C.recommend(make([255, 255, 255], [220, 40, 40]));
assert(recW.strategy === "white", "expected white, got " + recW.strategy);
console.log("2. recommend(white bg) ->", recW.strategy, "conf " + recW.conf);

// 3) black mask drops the near-black background, keeps the logo
const bi = make([10, 10, 10], [220, 40, 40]);
const keepB = C.backgroundMask(bi, "black", null);
let kept = 0; for (const k of keepB) kept += k;
const ratio = kept / (96 * 96);
assert(ratio > 0.1 && ratio < 0.9, "kept ratio out of range: " + ratio);
// top-left corner (pure background) must be cut, center (logo) must be kept
assert(keepB[0] === 0, "corner should be treated as background/cut");
assert(keepB[(48 * 96 + 48)] === 1, "center logo pixel should be kept");
console.log(`3. black mask         -> kept ${kept}/9216 = ${(100*ratio).toFixed(1)}%, corner cut, center kept`);

// 4) makeIsBg boundary behavior
assert(C.makeIsBg("black", null)(0, 0, 0) === true,   "0,0,0 should be bg");
assert(C.makeIsBg("black", null)(20, 20, 20) === true, "20,20,20 boundary should be bg");
assert(C.makeIsBg("black", null)(21, 0, 0) === false,  "21 on one channel should not be bg");
assert(C.makeIsBg("black", null)(220, 40, 40) === false, "logo red should not be bg");
console.log("4. makeIsBg(black)     -> boundary + logo checks pass");

console.log("\nAll black-strategy assertions passed (browser self.Core path).");
