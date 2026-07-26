// Focused proof of the TWO-STEP unwrap on live Sepolia: burn -> TEE public-decrypt -> finalize.
import { ethers } from 'ethers';
import { provider, deployer, demoActors, artifact, readDeployments, handleClient, usd, fmtUsd, etherscanTx, publicDecryptWithRetry } from './lib/nox.mjs';

async function main() {
  const p = provider();
  const { landlord } = demoActors(p);
  const d = readDeployments();
  const demo = new ethers.Contract(d.contracts.DemoUSD.address, artifact('DemoUSD').abi, p);
  const cusd = new ethers.Contract(d.contracts.ConfidentialUSD.address, artifact('ConfidentialUSD').abi, landlord);
  const cusdAddr = await cusd.getAddress();
  const hc = await handleClient(landlord);

  console.log('Landlord', landlord.address, 'ETH', ethers.formatEther(await p.getBalance(landlord.address)));
  const demoBefore = await demo.balanceOf(landlord.address);
  console.log('Landlord dUSD before:', fmtUsd(demoBefore));

  const enc = await hc.encryptInput(usd(1850), 'uint256', cusdAddr);
  let tx = await cusd['unwrap(address,address,bytes32,bytes)'](landlord.address, landlord.address, enc.handle, enc.handleProof);
  let rc = await tx.wait();
  const req = rc.logs.map((l) => { try { return cusd.interface.parseLog(l); } catch { return null; } }).find((x) => x?.name === 'UnwrapRequested');
  const reqId = req.args[1];
  console.log('step1 unwrap(burn) tx', etherscanTx(tx.hash), 'requestId', reqId.slice(0, 18) + '...');

  const pub = await publicDecryptWithRetry(hc, reqId);
  console.log('step2 TEE public-decrypt ->', fmtUsd(pub.value), 'dUSD, proof', pub.decryptionProof.slice(0, 18) + '...');

  tx = await cusd.finalizeUnwrap(reqId, pub.decryptionProof); rc = await tx.wait();
  console.log('step3 finalizeUnwrap tx', etherscanTx(tx.hash), '(gas', rc.gasUsed + ')');

  const demoAfter = await demo.balanceOf(landlord.address);
  console.log('Landlord dUSD after :', fmtUsd(demoAfter), ` (+${fmtUsd(demoAfter - demoBefore)})`);
  if (demoAfter - demoBefore !== usd(1850)) throw new Error('expected +1850 dUSD');
  console.log('UNWRAP GREEN. Landlord ETH left:', ethers.formatEther(await p.getBalance(landlord.address)));
}
main().catch((e) => { console.error('UNWRAP FAILED:', e?.message || e); if (e?.cause) console.error(e.cause); process.exit(1); });
