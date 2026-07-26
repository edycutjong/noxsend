import { describe, it, expect } from 'vitest';
import {
  SEPOLIA, NETWORKS, getNetwork, explorerTx, explorerAddress, CIRCLE_USDC_SEPOLIA,
} from '../src/config.js';

describe('SEPOLIA network config', () => {
  it('has chainId 11155111', () => expect(SEPOLIA.chainId).toBe(11155111));
  it('points at the Nox testnet gateway', () => expect(SEPOLIA.gatewayUrl).toBe('https://gateway-testnets.noxprotocol.dev'));
  it('pins the NoxCompute protocol address', () => expect(SEPOLIA.noxProtocol.toLowerCase()).toBe('0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf'));
  it('has a subgraph url', () => expect(SEPOLIA.subgraphUrl).toMatch(/^https:\/\/thegraph\./));
  it('uses the etherscan explorer', () => expect(SEPOLIA.explorer).toBe('https://sepolia.etherscan.io'));
});

describe('getNetwork', () => {
  it('resolves Sepolia', () => expect(getNetwork(11155111)).toBe(SEPOLIA));
  it('throws for an unsupported chain', () => expect(() => getNetwork(1)).toThrow(/Unsupported/));
  it('is registered in NETWORKS', () => expect(NETWORKS[11155111]).toBe(SEPOLIA));
});

describe('explorer helpers', () => {
  it('builds a tx url', () => expect(explorerTx(SEPOLIA, '0xabc')).toBe('https://sepolia.etherscan.io/tx/0xabc'));
  it('builds an address url', () => expect(explorerAddress(SEPOLIA, '0xdef')).toBe('https://sepolia.etherscan.io/address/0xdef'));
});

describe('pinned assets', () => {
  it('Circle USDC Sepolia is a 20-byte address', () => expect(CIRCLE_USDC_SEPOLIA).toMatch(/^0x[0-9a-fA-F]{40}$/));
});
