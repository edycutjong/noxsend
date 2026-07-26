// Network + contract configuration. The gateway/subgraph/protocol values match
// @iexec-nox/handle's built-in Sepolia config; contract addresses come from your deployment.

export interface NoxNetwork {
  chainId: number;
  name: string;
  rpcUrl: string;
  gatewayUrl: string;
  subgraphUrl: string;
  /** NoxCompute protocol contract (ACL + proof validation). */
  noxProtocol: string;
  explorer: string;
}

export const SEPOLIA: NoxNetwork = {
  chainId: 11155111,
  name: 'sepolia',
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  gatewayUrl: 'https://gateway-testnets.noxprotocol.dev',
  subgraphUrl:
    'https://thegraph.ethereum-sepolia-testnet.noxprotocol.io/api/subgraphs/id/9CsccKwvgYFo72zZeU4k4wj2NEBLdWhVE3EUandgmzgo',
  // CANONICAL INFRA: iExec Nox protocol contract on Sepolia (fixed by the network, not ours to deploy).
  noxProtocol: '0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf',
  explorer: 'https://sepolia.etherscan.io',
};

export const NETWORKS: Record<number, NoxNetwork> = { [SEPOLIA.chainId]: SEPOLIA };

export function getNetwork(chainId: number): NoxNetwork {
  const n = NETWORKS[chainId];
  if (!n) {
    const supported = Object.keys(NETWORKS).join(', ');
    throw new Error(`Unsupported chainId ${chainId}. Supported: ${supported}.`);
  }
  return n;
}

export interface NoxSendContracts {
  /** Confidential wrapper token (cUSD). */
  confidentialUSD: string;
  /** Claim-link escrow. */
  sendLinkEscrow: string;
  /** Underlying ERC-20 (DemoUSD or Circle USDC). */
  underlying: string;
}

export interface NoxSendConfig {
  network: NoxNetwork;
  contracts: NoxSendContracts;
}

export function explorerTx(net: NoxNetwork, hash: string): string {
  return `${net.explorer}/tx/${hash}`;
}
export function explorerAddress(net: NoxNetwork, address: string): string {
  return `${net.explorer}/address/${address}`;
}

/** Circle USDC on Ethereum Sepolia — the documented primary asset (demo defaults to DemoUSD). */
export const CIRCLE_USDC_SEPOLIA = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
