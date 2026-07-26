// NoxSend end-to-end proof on LIVE Ethereum Sepolia. Zero mock data. Re-runnable (delta asserts).
// Flow: wrap -> decrypt -> private send -> recipient decrypt -> auditor addViewer ->
//       claim-link (operator-pull createLink) -> claim -> reclaim -> 2-step unwrap.
import { ethers } from 'ethers';
import {
  provider, deployer, artifact, readDeployments, handleClient, usd, fmtUsd, etherscanTx,
  decryptWithRetry, publicDecryptWithRetry, readBalance, demoActors,
} from './lib/nox.mjs';

const line = (s = '') => console.log(s);
const step = (n, s) => console.log(`\n=== [${n}] ${s} ===`);
const expect = (cond, msg) => { if (!cond) throw new Error('ASSERT FAILED: ' + msg); };

async function main() {
  const p = provider();
  const alice = deployer(p);
  const { landlord, bob, auditor, stranger } = demoActors(p);
  const d = readDeployments();
  const demo = new ethers.Contract(d.contracts.DemoUSD.address, artifact('DemoUSD').abi, alice);
  const cusd = new ethers.Contract(d.contracts.ConfidentialUSD.address, artifact('ConfidentialUSD').abi, alice);
  const escrow = new ethers.Contract(d.contracts.SendLinkEscrow.address, artifact('SendLinkEscrow').abi, alice);
  const nox = new ethers.Contract(d.noxProtocol, ['function isViewer(bytes32,address) view returns (bool)'], p);
  const cusdAddr = await cusd.getAddress();
  const escrowAddr = await escrow.getAddress();

  line(`Alice ${alice.address} | Landlord ${landlord.address} | Bob ${bob.address} | Auditor ${auditor.address}`);
  line(`cUSD ${cusdAddr} | Escrow ${escrowAddr}`);

  step('0', 'Fund Landlord + Bob with a little Sepolia ETH (only if low)');
  for (const [name, w, amt] of [['Landlord', landlord, '0.004'], ['Bob', bob, '0.0025']]) {
    if ((await p.getBalance(w.address)) < ethers.parseEther('0.0015')) {
      const tx = await alice.sendTransaction({ to: w.address, value: ethers.parseEther(amt) }); await tx.wait();
      line(`  funded ${name} ${amt} ETH`);
    } else line(`  ${name} already funded`);
  }

  const aliceHC = await handleClient(alice);
  const landlordHC = await handleClient(landlord);
  const bobHC = await handleClient(bob);
  const auditorHC = await handleClient(auditor);

  // 1. WRAP
  step('1', 'Alice wraps 5,000 dUSD -> cUSD (amount public ONCE, at the wrapper boundary)');
  const aliceBal0 = await readBalance(aliceHC, cusd, alice.address);
  {
    let tx = await demo.approve(cusdAddr, usd(5000)); await tx.wait();
    tx = await cusd.wrap(alice.address, usd(5000)); const rc = await tx.wait();
    line(`  wrap tx ${etherscanTx(tx.hash)} (gas ${rc.gasUsed})`);
    const bal = await readBalance(aliceHC, cusd, alice.address);
    line(`  Alice cUSD balance (decrypted by Alice): ${fmtUsd(bal)} (was ${fmtUsd(aliceBal0)})`);
    expect(bal - aliceBal0 === usd(5000), `wrap +5000, got +${fmtUsd(bal - aliceBal0)}`);
  }

  // 2. PRIVATE SEND
  step('2', 'Alice privately sends 1,850 cUSD to Landlord (encryptInput -> confidentialTransfer)');
  const landlordBal0 = await readBalance(landlordHC, cusd, landlord.address);
  {
    const t0 = Date.now();
    const { handle, handleProof } = await aliceHC.encryptInput(usd(1850), 'uint256', cusdAddr);
    line(`  encryptInput -> handle ${handle} (${Date.now() - t0}ms)`);
    const tx = await cusd['confidentialTransfer(address,bytes32,bytes)'](landlord.address, handle, handleProof);
    const rc = await tx.wait();
    line(`  confidentialTransfer tx ${etherscanTx(tx.hash)} (gas ${rc.gasUsed})`);
    const plain1850 = usd(1850).toString(16).padStart(64, '0');
    line(`  calldata leaks "1850e6"? ${tx.data.includes(plain1850)}  (must be false)`);
    line(`  calldata carries the 32-byte handle? ${tx.data.toLowerCase().includes(handle.slice(2).toLowerCase())}  (true)`);
    expect(!tx.data.includes(plain1850), 'plaintext amount must not appear in calldata');
  }

  // 3. RECIPIENT DECRYPT
  step('3', 'Landlord decrypts their OWN balance (viewer-gated, EIP-712 signed)');
  const landlordBalHandle = await cusd.confidentialBalanceOf(landlord.address);
  {
    const bal = await readBalance(landlordHC, cusd, landlord.address);
    line(`  Landlord balance handle ${landlordBalHandle}`);
    line(`  Landlord decrypts: ${fmtUsd(bal)} (was ${fmtUsd(landlordBal0)})`);
    expect(bal - landlordBal0 === usd(1850), `recipient +1850, got +${fmtUsd(bal - landlordBal0)}`);
  }

  // 4. AUDITOR SELECTIVE DISCLOSURE
  step('4', 'Landlord grants Auditor viewer access (addViewer) — selective disclosure');
  {
    const addViewer = new ethers.Contract(d.noxProtocol, ['function addViewer(bytes32,address)'], landlord);
    const tx = await addViewer.addViewer(landlordBalHandle, auditor.address); await tx.wait();
    line(`  addViewer tx ${etherscanTx(tx.hash)}`);
    const auditorCan = await nox.isViewer(landlordBalHandle, auditor.address);
    const strangerCan = await nox.isViewer(landlordBalHandle, stranger.address);
    line(`  isViewer(auditor)=${auditorCan}  isViewer(stranger)=${strangerCan}  (stranger stays false)`);
    expect(auditorCan && !strangerCan, 'auditor viewer, stranger not');
    const dec = await decryptWithRetry(auditorHC, landlordBalHandle, { label: 'auditor' });
    line(`  Auditor decrypts Landlord balance: ${fmtUsd(dec.value)} (granted); stranger cannot.`);
  }

  // 5-6. CLAIM LINK (operator-pull: setOperator -> createLink -> revoke)
  step('5', 'Alice funds a claim link for Bob: 120 cUSD (time-bound operator -> createLink -> revoke)');
  const secret = ethers.hexlify(ethers.randomBytes(32));
  const secretHash = ethers.keccak256(ethers.getBytes(secret));
  {
    const expiry = Math.floor(Date.now() / 1000) + 7 * 24 * 3600;
    let tx = await cusd.setOperator(escrowAddr, expiry); await tx.wait();
    line(`  setOperator(escrow, expiry) tx ${etherscanTx(tx.hash)} (time-bound, revoked below)`);
    // amount encrypted-bound to the ESCROW (proof app == escrow)
    const { handle, handleProof } = await aliceHC.encryptInput(usd(120), 'uint256', escrowAddr);
    tx = await escrow.createLink(secretHash, expiry, handle, handleProof);
    const rc = await tx.wait();
    const created = rc.logs.map((l) => { try { return escrow.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === 'LinkCreated');
    line(`  createLink tx ${etherscanTx(tx.hash)} (gas ${rc.gasUsed})`);
    line(`  escrow booked LinkCreated? ${!!created}`);
    expect(!!created, 'escrow must book the claim');
    tx = await cusd.setOperator(escrowAddr, 0); await tx.wait();
    line(`  setOperator(escrow, 0) revoke tx ${etherscanTx(tx.hash)}  (minimal authority window)`);
    expect(!(await cusd.isOperator(alice.address, escrowAddr)), 'operator must be revoked');
  }
  step('6', 'Bob claims the link with the secret');
  const bobBal0 = await readBalance(bobHC, cusd, bob.address);
  {
    const tx = await escrow.connect(bob).claim(secret, bob.address); await tx.wait();
    line(`  claim tx ${etherscanTx(tx.hash)}`);
    const bal = await readBalance(bobHC, cusd, bob.address);
    line(`  Bob decrypts his balance: ${fmtUsd(bal)} (was ${fmtUsd(bobBal0)})`);
    expect(bal - bobBal0 === usd(120), `claim +120, got +${fmtUsd(bal - bobBal0)}`);
  }

  // 7. RECLAIM
  step('7', 'Reclaim: Alice funds a short-lived link, lets it expire, refunds herself');
  {
    const s2 = ethers.hexlify(ethers.randomBytes(32));
    const h2 = ethers.keccak256(ethers.getBytes(s2));
    const expiry = (await p.getBlock('latest')).timestamp + 4; // LINK expiry (short, for reclaim)
    const opUntil = Math.floor(Date.now() / 1000) + 900; // OPERATOR window (long enough to mine createLink)
    let tx = await cusd.setOperator(escrowAddr, opUntil); await tx.wait();
    const enc = await aliceHC.encryptInput(usd(150), 'uint256', escrowAddr);
    tx = await escrow.createLink(h2, expiry, enc.handle, enc.handleProof); await tx.wait();
    await (await cusd.setOperator(escrowAddr, 0)).wait();
    line(`  funded short link (expiry ${expiry}); waiting for expiry...`);
    for (let i = 0; i < 30; i++) { if ((await p.getBlock('latest')).timestamp > expiry) break; await new Promise((r) => setTimeout(r, 3000)); }
    tx = await escrow.reclaim(h2); await tx.wait();
    const status = await escrow.claimStatus(h2);
    line(`  reclaim tx ${etherscanTx(tx.hash)}  refunded=${status[2]}`);
    expect(status[2], 'reclaim must mark refunded');
  }

  // 8. TWO-STEP UNWRAP (specific amount so re-runs stay clean)
  step('8', 'Landlord unwraps 1,850 cUSD -> dUSD: two-step (burn -> TEE public-decrypt -> finalize)');
  {
    const demoBefore = await demo.balanceOf(landlord.address);
    const enc = await landlordHC.encryptInput(usd(1850), 'uint256', cusdAddr);
    const cusdL = cusd.connect(landlord);
    let tx = await cusdL['unwrap(address,address,bytes32,bytes)'](landlord.address, landlord.address, enc.handle, enc.handleProof);
    let rc = await tx.wait();
    const req = rc.logs.map((l) => { try { return cusd.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === 'UnwrapRequested');
    const reqId = req.args[1];
    line(`  step1 unwrap(burn) tx ${etherscanTx(tx.hash)}  requestId ${reqId.slice(0, 18)}...`);
    const pub = await publicDecryptWithRetry(aliceHC, reqId);
    line(`  step2 TEE public-decrypt -> ${fmtUsd(pub.value)} dUSD, proof ${pub.decryptionProof.slice(0, 18)}...`);
    tx = await cusdL.finalizeUnwrap(reqId, pub.decryptionProof); rc = await tx.wait();
    line(`  step3 finalizeUnwrap tx ${etherscanTx(tx.hash)} (gas ${rc.gasUsed})`);
    const demoAfter = await demo.balanceOf(landlord.address);
    line(`  Landlord dUSD ${fmtUsd(demoBefore)} -> ${fmtUsd(demoAfter)}  (released against the proof)`);
    expect(demoAfter - demoBefore === usd(1850), `unwrap +1850 dUSD, got +${fmtUsd(demoAfter - demoBefore)}`);
  }

  line(`\nALL STEPS GREEN. Deployer ETH remaining: ${ethers.formatEther(await p.getBalance(alice.address))}`);
  line('Zero mock data: every number came from the live Nox gateway + Sepolia contracts.');
}
main().catch((e) => { console.error('\nE2E FAILED:', e?.message || e); if (e?.cause) console.error('cause:', e.cause?.message || e.cause); process.exit(1); });
