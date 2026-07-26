// Focused proof of the reclaim path (post-expiry sender refund) on live Sepolia.
import { ethers } from 'ethers';
import { provider, deployer, artifact, readDeployments, handleClient, usd, etherscanTx } from './lib/nox.mjs';

async function main() {
  const p = provider();
  const alice = deployer(p);
  const d = readDeployments();
  const cusd = new ethers.Contract(d.contracts.ConfidentialUSD.address, artifact('ConfidentialUSD').abi, alice);
  const escrow = new ethers.Contract(d.contracts.SendLinkEscrow.address, artifact('SendLinkEscrow').abi, alice);
  const escrowAddr = await escrow.getAddress();
  const hc = await handleClient(alice);

  const s = ethers.hexlify(ethers.randomBytes(32));
  const h = ethers.keccak256(ethers.getBytes(s));
  const expiry = (await p.getBlock('latest')).timestamp + 4;
  const opUntil = Math.floor(Date.now() / 1000) + 900;

  let tx = await cusd.setOperator(escrowAddr, opUntil); await tx.wait();
  const enc = await hc.encryptInput(usd(150), 'uint256', escrowAddr);
  tx = await escrow.createLink(h, expiry, enc.handle, enc.handleProof); await tx.wait();
  console.log('createLink tx', etherscanTx(tx.hash), '(link expiry', expiry, ')');
  await (await cusd.setOperator(escrowAddr, 0)).wait();

  console.log('waiting for expiry...');
  for (let i = 0; i < 30; i++) { if ((await p.getBlock('latest')).timestamp > expiry) break; await new Promise((r) => setTimeout(r, 3000)); }

  tx = await escrow.reclaim(h); await tx.wait();
  const status = await escrow.claimStatus(h);
  console.log('reclaim tx', etherscanTx(tx.hash), '-> exists/claimed/refunded =', status[0], status[1], status[2]);
  if (!status[2]) throw new Error('refunded flag not set');
  console.log('RECLAIM GREEN. remaining ETH:', ethers.formatEther(await p.getBalance(alice.address)));
}
main().catch((e) => { console.error('RECLAIM FAILED:', e?.message || e); process.exit(1); });
