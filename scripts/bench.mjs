// Benchmark the Nox flow stages on live Sepolia and print p50/p95/min/max.
// Gateway stages (encryptInput, decrypt) are free; a few full on-chain send cycles measure the
// chain-confirm stage. Writes fixtures/bench.json for the README.
import { ethers } from 'ethers';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  provider, deployer, artifact, readDeployments, handleClient, usd, ROOT, decryptWithRetry,
} from './lib/nox.mjs';

const N_GATEWAY = Number(process.env.BENCH_N || 25);
const N_CHAIN = Number(process.env.BENCH_CHAIN_N || 3);

function stats(xs) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p) => s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
  const sum = s.reduce((a, b) => a + b, 0);
  return { n: s.length, min: s[0], p50: q(50), p95: q(95), max: s[s.length - 1], mean: Math.round(sum / s.length) };
}
const row = (label, st) => `${label.padEnd(26)} n=${String(st.n).padEnd(3)} min=${st.min}  p50=${st.p50}  p95=${st.p95}  max=${st.max}  (ms)`;

async function main() {
  const p = provider();
  const alice = deployer(p);
  const d = readDeployments();
  const cusd = new ethers.Contract(d.contracts.ConfidentialUSD.address, artifact('ConfidentialUSD').abi, alice);
  const cusdAddr = await cusd.getAddress();
  const hc = await handleClient(alice);

  console.log(`Benchmark on Sepolia — gateway N=${N_GATEWAY}, chain cycles N=${N_CHAIN}\n`);

  // Stage 1: encryptInput latency (gateway round-trip, no tx)
  const enc = [];
  for (let i = 0; i < N_GATEWAY; i++) {
    const t = Date.now();
    await hc.encryptInput(usd(1 + i), 'uint256', cusdAddr);
    enc.push(Date.now() - t);
    process.stdout.write(`  encryptInput ${i + 1}/${N_GATEWAY}\r`);
  }
  const encStats = stats(enc);
  console.log(' '.repeat(30) + '\r' + row('encryptInput (gateway)', encStats));

  // Stage 2: decrypt latency (gateway round-trip on Alice's own balance)
  const balHandle = await cusd.confidentialBalanceOf(alice.address);
  const dec = [];
  for (let i = 0; i < N_GATEWAY; i++) {
    const t = Date.now();
    await decryptWithRetry(hc, balHandle, { attempts: 6, delayMs: 2000 });
    dec.push(Date.now() - t);
    process.stdout.write(`  decrypt ${i + 1}/${N_GATEWAY}\r`);
  }
  const decStats = stats(dec);
  console.log(' '.repeat(30) + '\r' + row('decrypt (gateway)', decStats));

  // Stage 3: full private-send cycle (encrypt -> tx confirm -> decrypt), few iterations
  const chain = [];
  for (let i = 0; i < N_CHAIN; i++) {
    const t = Date.now();
    const { handle, handleProof } = await hc.encryptInput(usd(1), 'uint256', cusdAddr);
    const tx = await cusd['confidentialTransfer(address,bytes32,bytes)'](alice.address, handle, handleProof);
    await tx.wait();
    chain.push(Date.now() - t);
    process.stdout.write(`  full send cycle ${i + 1}/${N_CHAIN}\r`);
  }
  const chainStats = stats(chain);
  console.log(' '.repeat(30) + '\r' + row('full send (enc+confirm)', chainStats));

  mkdirSync(join(ROOT, 'fixtures'), { recursive: true });
  const out = { network: 'sepolia', at: new Date().toISOString(), encryptInput: encStats, decrypt: decStats, fullSend: chainStats };
  writeFileSync(join(ROOT, 'fixtures', 'bench.json'), JSON.stringify(out, null, 2) + '\n');
  console.log('\nWrote fixtures/bench.json');
}
main().catch((e) => { console.error('BENCH FAILED:', e?.message || e); process.exit(1); });
