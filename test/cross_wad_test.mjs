// cross_wad_test.mjs
// Validates that the JS WAD3 encoder (decal-core.js) produces byte-identical
// output to the Python WAD3 writer (tools/goldsrc_decal.py) for the same
// mip + palette inputs. Image resampling differs between canvas and PIL, so
// this test fixes the mip bytes and the palette and compares the raw .wad.
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));   // ...\goldsrc-decal-web\test
const root = resolve(__dirname, "..");                        // ...\goldsrc-decal-web
const repos = resolve(__dirname, "..", "..");                  // ...\repos
const core = await import(new URL("../decal-core.js", import.meta.url).href);
const C = core.default || core;

// Fixed test inputs
const w = 64, h = 64;               // multiples of 16
const name = "{test";
const palette = [];
for (let i = 0; i < 255; i++) palette.push([i & 255, (i * 7) & 255, 255 - (i & 255)]);
palette.push([0, 0, 255]);          // reserved index 255

// 4 mips of size (w>>m) x (h>>m), filled with a simple index pattern
const mips = [];
for (let m = 0; m < 4; m++) {
  const mw = w >> m, mh = h >> m;
  const idx = new Uint8Array(mw * mh);
  for (let p = 0; p < idx.length; p++) idx[p] = (p * 31 + m) & 255;
  mips.push(idx);
}

// --- JS build ---
const wadBuf = C.buildWad(name, w, h, mips, palette);
const wad = Buffer.from(wadBuf);
const tmp = mkdtempSync(join(tmpdir(), "goldsrc-"));
const jsPath = join(tmp, "js.wad");
writeFileSync(jsPath, wad);

// --- Python build (import the writer from tools/goldsrc_decal.py) ---
const pySrc = join(repos, "goldsrc-decal", "tools", "goldsrc_decal.py");
const metaPath = join(tmp, "meta.json");
const pyPath = join(tmp, "py.wad");
const driver = [
  'import sys, json, importlib.util',
  'saved_argv = sys.argv',
  'sys.argv = [sys.argv[0]]',
  'try:',
  `    spec = importlib.util.spec_from_file_location("gd", r"${pySrc}")`,
  '    gd = importlib.util.module_from_spec(spec); spec.loader.exec_module(gd)',
  'finally:',
  '    sys.argv = saved_argv',
  `meta = json.load(open(r"${metaPath}"))`,
  'w = meta["w"]; h = meta["h"]; name = meta["name"]',
  'palette = [tuple(c) for c in meta["palette"]]',
  'mips = [bytes(b) for b in meta["mips"]]',
  'out = gd.build_wad(name, w, h, mips, palette)',
  `open(r"${pyPath}", "wb").write(out)`,
  'print(len(out))',
  ].join("\n");
  writeFileSync(metaPath, JSON.stringify({
  w, h, name,
  palette: palette.map(c => c),
  mips: mips.map(b => Array.from(b)),
}));

try {
  const out = execFileSync("py", ["-c", driver], { encoding: "utf8" });
} catch (e) {
  console.error("Python driver failed:\n" + (e.stdout || "") + (e.stderr || e.message));
  process.exit(2);
}

const pyWad = readFileSync(pyPath);
const jsWad = readFileSync(jsPath);

if (pyWad.length !== jsWad.length) {
  console.error(`LENGTH MISMATCH: py=${pyWad.length} js=${jsWad.length}`);
  process.exit(1);
}
if (!pyWad.equals(jsWad)) {
  // Find first differing byte
  let i = 0;
  while (i < pyWad.length && pyWad[i] === jsWad[i]) i++;
  console.error(`BYTE MISMATCH at offset ${i}`);
  const dump = (b, n) => b.slice(Math.max(0, i - 8), i + 24).toString("hex");
  console.error("py:", dump(pyWad));
  console.error("js:", dump(jsWad));
  process.exit(1);
}

console.log(`OK  byte-identical: ${w}x${h} name=${name} palette=${palette.length} wad=${wad.length}B`);
process.exit(0);
