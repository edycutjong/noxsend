// Coverage gate for NoxSend's OWN Solidity contracts.
//
// Parses solidity-coverage's Istanbul output (coverage.json at repo root) and FAILS (exit 1) if any
// of the project's own contracts is below 100% on ANY metric (statements / branches / functions /
// lines). "Own contracts" = top-level contracts/*.sol only — contracts/mocks/** and any test/harness
// files are excluded (mocks are already skipped in .solcover.js and never appear here).
//
// A genuine 0/0 metric (e.g. a constructor-only contract with no branches) counts as 100% (pass):
// there is nothing to cover, so it cannot be "uncovered".
//
// Run `npm run coverage` first, or use `npm run coverage:check` which chains both.

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const COVERAGE_JSON = join(ROOT, 'coverage.json');

const METRICS = ['statements', 'branches', 'functions', 'lines'];

// Only top-level contracts/*.sol (no subdirectories -> excludes contracts/mocks/**).
function isOwnContract(relPath) {
  return /^contracts\/[^/]+\.sol$/.test(relPath.replace(/\\/g, '/'));
}

// Count "covered / total" for a hit-count map. Statement/function/line maps are { id: hits };
// the branch map is { id: [hits, hits, ...] }. 0/0 is reported as 100%.
function ratioFromCountMap(map) {
  let total = 0;
  let covered = 0;
  for (const v of Object.values(map || {})) {
    total += 1;
    if (v > 0) covered += 1;
  }
  return { covered, total };
}

function ratioFromBranchMap(map) {
  let total = 0;
  let covered = 0;
  for (const arr of Object.values(map || {})) {
    for (const hits of arr) {
      total += 1;
      if (hits > 0) covered += 1;
    }
  }
  return { covered, total };
}

function pct({ covered, total }) {
  return total === 0 ? 100 : (covered / total) * 100;
}

function fmtPct(r) {
  const p = pct(r);
  const s = Number.isInteger(p) ? String(p) : p.toFixed(2);
  return `${s.padStart(6)}% (${r.covered}/${r.total})`;
}

function die(msg) {
  console.error(`\n❌ coverage:check ERROR — ${msg}\n`);
  process.exit(1);
}

if (!existsSync(COVERAGE_JSON)) {
  die(
    `coverage report not found at ${COVERAGE_JSON}.\n` +
      `   Run \`npm run coverage\` first (or \`npm run coverage:check\`, which runs it for you).`
  );
}

let data;
try {
  data = JSON.parse(readFileSync(COVERAGE_JSON, 'utf8'));
} catch (e) {
  die(`could not parse ${COVERAGE_JSON}: ${e.message}`);
}

const ownFiles = Object.keys(data).filter(isOwnContract).sort();
if (ownFiles.length === 0) {
  die('no own contracts (contracts/*.sol) found in the coverage report — did coverage run?');
}

const rows = [];
let failed = false;

for (const file of ownFiles) {
  const d = data[file];
  const r = {
    statements: ratioFromCountMap(d.s),
    functions: ratioFromCountMap(d.f),
    branches: ratioFromBranchMap(d.b),
    lines: ratioFromCountMap(d.l),
  };
  const ok = METRICS.every((m) => pct(r[m]) >= 100);
  if (!ok) failed = true;
  rows.push({ file, r, ok });
}

// ---- Report ----
const nameW = Math.max(12, ...ownFiles.map((f) => f.replace('contracts/', '').length));
const head =
  'File'.padEnd(nameW) +
  ' | ' +
  '% Stmts'.padStart(16) +
  ' | ' +
  '% Branch'.padStart(16) +
  ' | ' +
  '% Funcs'.padStart(16) +
  ' | ' +
  '% Lines'.padStart(16) +
  ' | ' +
  'Gate';
const bar = '-'.repeat(head.length);

console.log('\nCoverage gate — own contracts (must be 100% on all metrics; 0/0 = 100%)\n');
console.log(head);
console.log(bar);
for (const { file, r, ok } of rows) {
  console.log(
    file.replace('contracts/', '').padEnd(nameW) +
      ' | ' +
      fmtPct(r.statements).padStart(16) +
      ' | ' +
      fmtPct(r.branches).padStart(16) +
      ' | ' +
      fmtPct(r.functions).padStart(16) +
      ' | ' +
      fmtPct(r.lines).padStart(16) +
      ' | ' +
      (ok ? 'PASS' : 'FAIL')
  );
}
console.log(bar);

if (failed) {
  console.error('\n❌ FAIL — one or more own contracts are below 100% coverage.\n');
  process.exit(1);
}
console.log(`\n✅ PASS — all ${rows.length} own contracts at 100% (statements/branches/functions/lines).\n`);
process.exit(0);
