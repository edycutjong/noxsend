// Deterministic demo seed. Emits fixtures/demo-state.json + fixtures/amounts.csv so the video,
// README and screenshots never drift. On-chain setup (the public "before" transfer + a standing
// claim link) runs only with SEED_LIVE=1 (keeps the default run free). Idempotent.
import { ethers } from 'ethers';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  provider, deployer, demoActors, artifact, readDeployments, handleClient, usd, ROOT, etherscanTx,
} from './lib/nox.mjs';

const AMOUNTS = { wrap: 5000, rent: 1850, coffee: 120, refund: 150 };

async function main() {
  const p = provider();
  const alice = deployer(p);
  const { landlord, bob, auditor } = demoActors(p);
  const d = readDeployments();

  const state = {
    network: 'sepolia',
    chainId: 11155111,
    generatedAt: new Date().toISOString(),
    contracts: d.contracts,
    noxProtocol: d.noxProtocol,
    actors: {
      alice: { role: 'sender/payer', address: alice.address },
      landlord: { role: 'recipient (has wallet)', address: landlord.address },
      bob: { role: 'no-wallet friend (claim link)', address: bob.address },
      auditor: { role: 'selective disclosure viewer', address: auditor.address },
    },
    amounts: AMOUNTS,
    note: 'Actors derive from DEMO_MNEMONIC (throwaway, in .env). Alice = the deployer.',
  };

  if (process.env.SEED_LIVE === '1') {
    const demo = new ethers.Contract(d.contracts.DemoUSD.address, artifact('DemoUSD').abi, alice);
    const cusd = new ethers.Contract(d.contracts.ConfidentialUSD.address, artifact('ConfidentialUSD').abi, alice);
    const escrow = new ethers.Contract(d.contracts.SendLinkEscrow.address, artifact('SendLinkEscrow').abi, alice);
    const escrowAddr = await escrow.getAddress();
    const hc = await handleClient(alice);

    // "Before" exhibit: a PUBLIC dUSD transfer (the naked payslip we contrast against).
    let tx = await demo.transfer(landlord.address, usd(AMOUNTS.rent)); await tx.wait();
    state.beforeExhibitTx = tx.hash;
    console.log('public "before" transfer:', etherscanTx(tx.hash));

    // A standing claim link for Bob.
    const secret = ethers.hexlify(ethers.randomBytes(32));
    const secretHash = ethers.keccak256(ethers.getBytes(secret));
    const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    tx = await cusd.setOperator(escrowAddr, expiry); await tx.wait();
    const enc = await hc.encryptInput(usd(AMOUNTS.coffee), 'uint256', escrowAddr);
    tx = await escrow.createLink(secretHash, expiry, enc.handle, enc.handleProof); await tx.wait();
    await (await cusd.setOperator(escrowAddr, 0)).wait();
    state.claimLink = { secret, secretHash, amount: AMOUNTS.coffee, createTx: tx.hash };
    console.log('claim link created; secret:', secret);
  } else {
    console.log('(dry run — set SEED_LIVE=1 to also fund on-chain demo state)');
  }

  mkdirSync(join(ROOT, 'fixtures'), { recursive: true });
  writeFileSync(join(ROOT, 'fixtures', 'demo-state.json'), JSON.stringify(state, null, 2) + '\n');
  const csv = 'label,amount,decimals\n' + Object.entries(AMOUNTS).map(([k, v]) => `${k},${v},6`).join('\n') + '\n';
  writeFileSync(join(ROOT, 'fixtures', 'amounts.csv'), csv);
  console.log('Wrote fixtures/demo-state.json + fixtures/amounts.csv');
}
main().catch((e) => { console.error('SEED FAILED:', e?.message || e); process.exit(1); });
