'use client';

import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { sepolia } from 'wagmi/chains';
import { shortAddr } from '@/lib/contracts';

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const injected = connectors.find((c) => c.id === 'injected') ?? connectors[0];

  if (!isConnected) {
    return (
      <button className="btn btn-primary" disabled={isPending} onClick={() => injected && connect({ connector: injected })}>
        {isPending ? 'Connecting…' : 'Connect MetaMask'}
      </button>
    );
  }

  if (chainId !== sepolia.id) {
    return (
      <button className="btn btn-ghost text-amber-300" onClick={() => switchChain({ chainId: sepolia.id })}>
        Switch to Sepolia
      </button>
    );
  }

  return (
    <button className="btn btn-ghost" onClick={() => disconnect()} title="Disconnect">
      <span className="h-2 w-2 rounded-full bg-primary shadow-glow" />
      <span className="font-mono text-sm">{shortAddr(address)}</span>
    </button>
  );
}
