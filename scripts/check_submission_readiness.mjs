// Fails (exit 1) if the submission is missing anything graded. Run before shipping.
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), 'utf8') : null);

let fails = 0;
const check = (ok, label, hint = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${ok || !hint ? '' : `  — ${hint}`}`);
  if (!ok) fails++;
};

// Deployments
const dep = read('deployments.json');
const d = dep ? JSON.parse(dep) : null;
check(!!d?.contracts?.ConfidentialUSD?.address, 'ConfidentialUSD deployed', 'run npm run deploy');
check(!!d?.contracts?.SendLinkEscrow?.address, 'SendLinkEscrow deployed');
check(!!d?.contracts?.DemoUSD?.address, 'DemoUSD deployed');

// feedback.md — graded, >= 12 findings
const fb = read('feedback.md') || '';
const findings = (fb.match(/^### \d+\./gm) || []).length;
check(findings >= 12, `feedback.md has >= 12 findings (${findings})`, 'add more dated findings');

// README essentials
const rd = read('README.md') || '';
check(/install/i.test(rd), 'README has install steps');
check(/npm (run )?(test|e2e|deploy)/i.test(rd), 'README documents usage commands');
check(/test/i.test(rd) && /\b(1\d\d|[2-9]\d)\b/.test(rd), 'README states a test count');
check(!/(youtube\.com\/watch\?v=REPLACE|<video-link>|TODO-VIDEO)/i.test(rd), 'README has no video placeholder');

// Secrets hygiene
const gi = read('.gitignore') || '';
check(/^\.env$/m.test(gi), '.env is gitignored');

// Core tests present
check(existsSync(join(ROOT, 'packages/core/tests')), '@noxsend/core tests present');

// Fixtures
check(existsSync(join(ROOT, 'fixtures/demo-state.json')), 'fixtures/demo-state.json present', 'run npm run seed');

console.log(`\n${fails === 0 ? 'READY ✅' : `NOT READY — ${fails} check(s) failing`}`);
process.exit(fails === 0 ? 0 : 1);
