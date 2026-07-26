import { BrowserProvider, type Eip1193Provider } from 'ethers';
import { createEthersHandleClient } from '@iexec-nox/handle';
import { NoxSendClient, type NoxSendConfig, type HandleClientLike } from '@noxsend/core';
import { CONTRACTS, NETWORK } from './contracts';

// Build a NoxSendClient from a wagmi injected EIP-1193 provider, using the proven ethers path.
export async function makeNoxClient(eip1193: Eip1193Provider): Promise<NoxSendClient> {
  const provider = new BrowserProvider(eip1193);
  const signer = await provider.getSigner();
  const handle = (await createEthersHandleClient(signer)) as unknown as HandleClientLike;
  const config: NoxSendConfig = { network: NETWORK, contracts: CONTRACTS };
  return new NoxSendClient(signer, handle, config);
}
