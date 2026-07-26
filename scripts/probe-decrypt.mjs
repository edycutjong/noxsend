// Diagnose the decrypt 403 "not a viewer": lag vs admin-is-not-gateway-viewer.
import { ethers } from 'ethers';
import { provider, deployer, artifact, readDeployments, handleClient, fmtUsd } from './lib/nox.mjs';

async function tryDecrypt(hc, handle, tag) {
  const t0 = Date.now();
  try {
    const r = await hc.decrypt(handle);
    console.log(`  [${tag}] OK ${fmtUsd(r.value)} (${Date.now() - t0}ms)`);
    return true;
  } catch (e) {
    console.log(`  [${tag}] FAIL ${(e?.message || e).slice(0, 90)} (${Date.now() - t0}ms)`);
    return false;
  }
}

async function main() {
  const p = provider();
  const alice = deployer(p);
  const d = readDeployments();
  const cusd = new ethers.Contract(d.contracts.ConfidentialUSD.address, artifact('ConfidentialUSD').abi, alice);
  const nox = new ethers.Contract(d.noxProtocol, ['function isViewer(bytes32,address) view returns (bool)', 'function isAllowed(bytes32,address) view returns (bool)'], p);
  const noxW = new ethers.Contract(d.noxProtocol, ['function addViewer(bytes32,address)'], alice);

  const handle = await cusd.confidentialBalanceOf(alice.address);
  console.log('alice balance handle:', handle);
  console.log('on-chain isAllowed(alice):', await nox.isAllowed(handle, alice.address));
  console.log('on-chain isViewer(alice):', await nox.isViewer(handle, alice.address));

  const hc = await handleClient(alice);

  console.log('\nAttempt A: decrypt now (tests lag)');
  if (await tryDecrypt(hc, handle, 'now')) return console.log('\n=> Was LAG. Retrying on 403 fixes it.');

  console.log('\nAttempt B: wait 20s then decrypt (more lag budget)');
  await new Promise((r) => setTimeout(r, 20000));
  if (await tryDecrypt(hc, handle, '+20s')) return console.log('\n=> Was LAG (needed ~20s of indexer catch-up).');

  console.log('\nAttempt C: explicit addViewer(handle, alice) then decrypt');
  const tx = await noxW.addViewer(handle, alice.address); await tx.wait();
  console.log('  addViewer mined:', tx.hash);
  await new Promise((r) => setTimeout(r, 8000));
  if (await tryDecrypt(hc, handle, 'post-addViewer')) return console.log('\n=> Gateway needs explicit addViewer, NOT just admin/allow. Design impact!');

  console.log('\n=> Still failing after addViewer — deeper issue.');
}
main().catch((e) => { console.error(e); process.exit(1); });
