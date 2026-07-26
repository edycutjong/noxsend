// Etherscan source verification for the deployed contracts.
// Runs `hardhat verify` for each contract when ETHERSCAN_API_KEY is set; otherwise prints a clear TODO.
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const d = JSON.parse(readFileSync(join(ROOT, 'deployments.json'), 'utf8'));
const key = process.env.ETHERSCAN_API_KEY;

const targets = [
  { name: 'DemoUSD', address: d.contracts.DemoUSD.address, args: [] },
  { name: 'ConfidentialUSD', address: d.contracts.ConfidentialUSD.address, args: [d.contracts.DemoUSD.address] },
  { name: 'SendLinkEscrow', address: d.contracts.SendLinkEscrow.address, args: [d.contracts.ConfidentialUSD.address] },
];

if (!key) {
  console.log('No ETHERSCAN_API_KEY in .env — skipping automated verification.');
  console.log('TODO: add a key to .env, then run `npm run verify:contracts`. Commands that will run:');
  for (const t of targets) console.log(`  npx hardhat verify --network sepolia ${t.address} ${t.args.join(' ')}`.trim());
  process.exit(0);
}

for (const t of targets) {
  console.log(`\nVerifying ${t.name} @ ${t.address} ...`);
  try {
    execSync(`npx hardhat verify --network sepolia ${t.address} ${t.args.join(' ')}`.trim(), { cwd: ROOT, stdio: 'inherit' });
  } catch {
    console.log(`  (${t.name} verify failed or already verified — continuing)`);
  }
}
