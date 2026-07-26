import {
  CONFIDENTIAL_USD_ABI, SEND_LINK_ESCROW_ABI, DEMO_USD_ABI, NOX_PROTOCOL_ABI, SEPOLIA,
  type NoxSendContracts,
} from '@noxsend/core';
import deployments from '../../deployments.json';

// Single source of truth: our OWN deployed addresses come from the repo-root
// deployments.json (written by scripts/deploy.mjs) — no hardcoded duplicates.
// NEXT_PUBLIC_* env vars override for alternate deployments; zero-config still works
// because deployments.json is committed.
export const CONTRACTS: NoxSendContracts = {
  confidentialUSD: process.env.NEXT_PUBLIC_CONFIDENTIAL_USD || deployments.contracts.ConfidentialUSD.address,
  sendLinkEscrow: process.env.NEXT_PUBLIC_SEND_LINK_ESCROW || deployments.contracts.SendLinkEscrow.address,
  underlying: process.env.NEXT_PUBLIC_UNDERLYING || deployments.contracts.DemoUSD.address,
};

export const NETWORK = SEPOLIA;
export const ABIS = { CONFIDENTIAL_USD_ABI, SEND_LINK_ESCROW_ABI, DEMO_USD_ABI, NOX_PROTOCOL_ABI };

export function shortAddr(a?: string): string {
  return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
}
