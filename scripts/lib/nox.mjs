// Shared helpers for the standalone (ESM) NoxSend scripts.
// Contracts are compiled by Hardhat; we load the artifacts and talk to live Sepolia via ethers.
import 'dotenv/config';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { ethers } from 'ethers';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(__dirname, '..', '..');

export const RPC = process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
export const CHAIN_ID = 11155111;
// CANONICAL INFRA: iExec Nox protocol contract on Sepolia (fixed by the network, not ours to deploy).
export const NOX_PROTOCOL = (process.env.NOX_PROTOCOL_ADDRESS || '0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf');

const rawPk = process.env.DEPLOYER_PRIVATE_KEY || '';
export const DEPLOYER_PK = rawPk ? (rawPk.startsWith('0x') ? rawPk : '0x' + rawPk) : '';

export function provider() {
  return new ethers.JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
}

export function deployer(p = provider()) {
  if (!DEPLOYER_PK) throw new Error('DEPLOYER_PRIVATE_KEY missing in .env');
  return new ethers.Wallet(DEPLOYER_PK, p);
}

export function artifact(name) {
  const path = join(ROOT, 'artifacts', 'contracts', `${name}.sol`, `${name}.json`);
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function deploymentsPath() {
  return join(ROOT, 'deployments.json');
}

export function readDeployments() {
  const p = deploymentsPath();
  if (!existsSync(p)) return { chainId: CHAIN_ID, network: 'sepolia', contracts: {} };
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function writeDeployments(d) {
  writeFileSync(deploymentsPath(), JSON.stringify(d, null, 2) + '\n');
}

export function etherscanTx(hash) {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}
export function etherscanAddr(addr) {
  return `https://sepolia.etherscan.io/address/${addr}`;
}

// Lazily import the ESM-only Nox handle SDK.
export async function handleClient(signer) {
  const { createEthersHandleClient } = await import('@iexec-nox/handle');
  return createEthersHandleClient(signer);
}

export const ZERO_HANDLE = '0x' + '0'.repeat(64);

// The gateway's ACL view lags the chain by a few seconds after a tx (indexer catch-up),
// and the TEE needs a moment to compute a fresh handle. Both surface as retryable errors.
const RETRYABLE = /not yet computed|not a viewer|access denied|not authorized|does not exist|rpc error|status: 403|status: 404|fetch failed|network request failed/i;

export async function decryptWithRetry(client, handle, { label = 'decrypt', attempts = 18, delayMs = 4000 } = {}) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try { return await client.decrypt(handle); }
    catch (e) {
      last = e;
      if (i === attempts || !RETRYABLE.test(e?.message || '')) throw e;
      process.stdout.write(`    (${label}: gateway/TEE catching up, retry ${i}/${attempts})   \r`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

export async function publicDecryptWithRetry(client, handle, { attempts = 18, delayMs = 4000 } = {}) {
  let last;
  for (let i = 1; i <= attempts; i++) {
    try { return await client.publicDecrypt(handle); }
    catch (e) {
      last = e;
      if (i === attempts || !RETRYABLE.test(e?.message || '')) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

// Deterministic demo actors from a DEDICATED throwaway mnemonic (never the public test mnemonic,
// which gets swept on Sepolia). Alice = the deployer (holds dUSD + ETH).
export function demoActors(p) {
  const phrase = process.env.DEMO_MNEMONIC || 'salmon banner pull inherit obey run shy treat embody joke rubber connect';
  const m = ethers.Mnemonic.fromPhrase(phrase);
  const at = (i) => new ethers.Wallet(ethers.HDNodeWallet.fromMnemonic(m, `m/44'/60'/0'/0/${i}`).privateKey, p);
  return { landlord: at(1), bob: at(2), auditor: at(3), stranger: at(4) };
}

// Read a confidential balance, treating the uninitialized (all-zero) handle as 0.
export async function readBalance(client, cusd, addr) {
  const handle = await cusd.confidentialBalanceOf(addr);
  if (handle === ZERO_HANDLE) return 0n;
  const { value } = await decryptWithRetry(client, handle, { label: `bal(${addr.slice(0, 8)})` });
  return value;
}

export const USDC_DECIMALS = 6;
export const usd = (n) => ethers.parseUnits(String(n), USDC_DECIMALS);
export const fmtUsd = (v) => ethers.formatUnits(v, USDC_DECIMALS);

// Pinned Circle USDC on Ethereum Sepolia (documented primary asset; demo uses DemoUSD so
// judges are never blocked by a dry Circle faucet). Re-verify at build from circle.com/developers.
export const CIRCLE_USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
