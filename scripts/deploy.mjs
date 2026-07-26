// Deploy DemoUSD + ConfidentialUSD (cUSD wrapper) + SendLinkEscrow to live Sepolia.
import { ethers } from 'ethers';
import {
  provider, deployer, artifact, readDeployments, writeDeployments,
  etherscanAddr, etherscanTx, fmtUsd,
} from './lib/nox.mjs';

async function deployOne(wallet, name, args = []) {
  const art = artifact(name);
  const factory = new ethers.ContractFactory(art.abi, art.bytecode, wallet);
  const c = await factory.deploy(...args);
  const tx = c.deploymentTransaction();
  await c.waitForDeployment();
  const addr = await c.getAddress();
  console.log(`  ${name.padEnd(16)} ${addr}  (deploy tx ${tx.hash})`);
  return { address: addr, txHash: tx.hash, contract: c };
}

async function main() {
  const p = provider();
  const w = deployer(p);
  const bal0 = await p.getBalance(w.address);
  console.log('Deployer :', w.address);
  console.log('Balance  :', ethers.formatEther(bal0), 'ETH\n');

  const d = readDeployments();
  d.deployer = w.address;
  d.contracts = d.contracts || {};

  console.log('Deploying...');
  const demo = await deployOne(w, 'DemoUSD');
  const cusd = await deployOne(w, 'ConfidentialUSD', [demo.address]);
  const escrow = await deployOne(w, 'SendLinkEscrow', [cusd.address]);

  d.contracts.DemoUSD = { address: demo.address, deployTx: demo.txHash, underlyingDecimals: 6 };
  d.contracts.ConfidentialUSD = { address: cusd.address, deployTx: cusd.txHash, underlying: demo.address, name: 'Confidential USD', symbol: 'cUSD' };
  d.contracts.SendLinkEscrow = { address: escrow.address, deployTx: escrow.txHash, token: cusd.address };
  d.noxProtocol = '0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf';
  d.deployedAt = new Date().toISOString();
  writeDeployments(d);

  // Sanity read-back.
  const demoR = new ethers.Contract(demo.address, artifact('DemoUSD').abi, p);
  const cusdR = new ethers.Contract(cusd.address, artifact('ConfidentialUSD').abi, p);
  console.log('\nRead-back:');
  console.log('  DemoUSD symbol/decimals:', await demoR.symbol(), Number(await demoR.decimals()));
  console.log('  DemoUSD deployer bal   :', fmtUsd(await demoR.balanceOf(w.address)));
  console.log('  cUSD symbol/underlying :', await cusdR.symbol(), await cusdR.underlying());

  const bal1 = await p.getBalance(w.address);
  console.log('\nGas spent:', ethers.formatEther(bal0 - bal1), 'ETH  |  remaining:', ethers.formatEther(bal1), 'ETH');
  console.log('\nExplorer:');
  console.log('  DemoUSD       ', etherscanAddr(demo.address));
  console.log('  ConfidentialUSD', etherscanAddr(cusd.address));
  console.log('  SendLinkEscrow', etherscanAddr(escrow.address));
  console.log('\ndeployments.json written.');
}

main().catch((e) => { console.error('DEPLOY FAILED:', e); process.exit(1); });
