'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAccount, useConnectorClient } from 'wagmi';
import type { Eip1193Provider } from 'ethers';
import type { NoxSendClient } from '@noxsend/core';
import { formatDisplay } from '@noxsend/core';
import { makeNoxClient } from '@/lib/nox';
import { NETWORK } from '@/lib/contracts';

export interface TxItem { label: string; hash: string; ts: number; }

interface NoxState {
  address?: string;
  connected: boolean;
  client: () => Promise<NoxSendClient>;
  balance: bigint | null; // decrypted, or null if sealed/unknown
  balanceLoading: boolean;
  refreshBalance: () => Promise<void>;
  sealBalance: () => void;
  txs: TxItem[];
  pushTx: (label: string, hash: string) => void;
  busy: string | null;
  setBusy: (s: string | null) => void;
  formatUsd: (v: bigint) => string;
}

const Ctx = createContext<NoxState | null>(null);

export function NoxProvider({ children }: { children: ReactNode }) {
  const { address, isConnected, connector } = useAccount();
  const { data: connectorClient } = useConnectorClient();
  const clientRef = useRef<NoxSendClient | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [txs, setTxs] = useState<TxItem[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const client = useCallback(async () => {
    // Rebuild if account changed; cache otherwise.
    const c = clientRef.current;
    if (c && (await c.address).toLowerCase() === address?.toLowerCase()) return c;
    const eip1193 = (await connector?.getProvider()) as Eip1193Provider;
    if (!eip1193) throw new Error('No injected wallet provider');
    const nc = await makeNoxClient(eip1193);
    clientRef.current = nc;
    return nc;
  }, [address, connector]);

  const refreshBalance = useCallback(async () => {
    setBalanceLoading(true);
    try {
      const c = await client();
      setBalance(await c.decryptBalance());
    } finally {
      setBalanceLoading(false);
    }
  }, [client]);

  const sealBalance = useCallback(() => setBalance(null), []);
  const pushTx = useCallback((label: string, hash: string) => {
    setTxs((prev) => [{ label, hash, ts: Date.now() }, ...prev].slice(0, 12));
  }, []);

  const value = useMemo<NoxState>(
    () => ({
      address,
      connected: isConnected,
      client,
      balance,
      balanceLoading,
      refreshBalance,
      sealBalance,
      txs,
      pushTx,
      busy,
      setBusy,
      formatUsd: (v: bigint) => formatDisplay(v, 'cUSD'),
    }),
    [address, isConnected, client, balance, balanceLoading, refreshBalance, sealBalance, txs, pushTx, busy, connectorClient],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNox(): NoxState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNox must be used within NoxProvider');
  return v;
}

export const explorerTx = (hash: string) => `${NETWORK.explorer}/tx/${hash}`;
export const explorerAddr = (a: string) => `${NETWORK.explorer}/address/${a}`;
