// check_inline.js -- syntax-checks every inline <script> block in index.html
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const htmlPath = join(testDir, "..", "index.html");
const src = readFileSync(htmlPath, "utf8");
const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
let count = 0, i = 0, fail = 0;
for (const m of src.matchAll(re)) {
  i++;
  try {
    new Function(m[1]);
    console.log(`inline block ${i}: syntax OK (${m[1].length} chars)`);
  } catch (e) {
    fail++;
    console.error(`inline block ${i}: SYNTAX ERROR\n${e.message}`);
  }
  count++;
}
if (count === 0) console.error("ERROR: no inline <script> blocks found");
process.exit(fail ? 1 : 0);
