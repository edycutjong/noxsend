#!/usr/bin/env -S npx tsx
// noxsend — drive the whole NoxSend flow headless, over @noxsend/core.
// Usage: npx tsx packages/cli/src/index.ts <command> [args]   (or: npm run cli -- <command>)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { JsonRpcProvider, Wallet } from 'ethers';
import { createEthersHandleClient } from '@iexec-nox/handle';
import { NoxSendClient, SEPOLIA, formatDisplay, type NoxSendConfig, type HandleClientLike } from '@noxsend/core';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const RPC = process.env.SEPOLIA_RPC_URL || SEPOLIA.rpcUrl;
const rawPk = process.env.DEPLOYER_PRIVATE_KEY || process.env.PRIVATE_KEY || '';
const PK = rawPk.startsWith('0x') ? rawPk : rawPk ? '0x' + rawPk : '';

function loadConfig(): NoxSendConfig {
  const d = JSON.parse(readFileSync(join(ROOT, 'deployments.json'), 'utf8'));
  return {
    network: SEPOLIA,
    contracts: {
      confidentialUSD: d.contracts.ConfidentialUSD.address,
      sendLinkEscrow: d.contracts.SendLinkEscrow.address,
      underlying: d.contracts.DemoUSD.address,
    },
  };
}

async function makeClient(): Promise<NoxSendClient> {
  if (!PK) throw new Error('Set DEPLOYER_PRIVATE_KEY (or PRIVATE_KEY) in .env');
  const provider = new JsonRpcProvider(RPC, 11155111, { staticNetwork: true });
  const wallet = new Wallet(PK, provider);
  const handle = (await createEthersHandleClient(wallet)) as unknown as HandleClientLike;
  return new NoxSendClient(wallet, handle, loadConfig());
}

const fmt = (v: bigint) => formatDisplay(v, 'cUSD');

const HELP = `noxsend — private send over iExec Nox (Sepolia)

  balance [address]         decrypt a confidential cUSD balance (free)
  wrap <amount>             wrap underlying ERC-20 -> cUSD
  send <to> <amount>        private send (encrypted amount)
  unwrap <amount>           two-step proof-gated unwrap -> ERC-20
  link <amount>             create a claim link (prints the secret URL)
  claim <secret> [to]       claim a link by its secret
  grant <handle> <auditor>  addViewer (selective disclosure)
`;

async function main() {
  const [cmd, ...args] = process.argv.slice(2);
  if (!cmd || cmd === 'help' || cmd === '--help') return console.log(HELP);
  const nox = await makeClient();

  switch (cmd) {
    case 'balance': {
      const v = await nox.decryptBalance(args[0]);
      console.log(fmt(v));
      break;
    }
    case 'wrap':
      console.log('wrap tx', await nox.wrap(args[0]));
      break;
    case 'send':
      console.log('send tx', await nox.sendPrivate(args[0], args[1]));
      break;
    case 'unwrap': {
      const r = await nox.unwrap(args[0]);
      console.log('unwrapped', fmt(r.amount), 'finalize tx', r.finalizeTx);
      break;
    }
    case 'link': {
      const r = await nox.createClaimLink(args[0], { baseUrl: process.env.APP_URL || 'https://noxsend.app' });
      console.log('link  ', r.link);
      console.log('secret', r.secret);
      console.log('tx    ', r.txHash);
      break;
    }
    case 'claim':
      console.log('claim tx', await nox.claim(args[0], args[1]));
      break;
    case 'grant':
      console.log('grant tx', await nox.grantViewer(args[0], args[1]));
      break;
    default:
      console.log('Unknown command:', cmd, '\n\n' + HELP);
      process.exit(1);
  }
}
main().catch((e) => { console.error('Error:', e?.shortMessage || e?.message || e); process.exit(1); });
