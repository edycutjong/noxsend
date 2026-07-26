'use client';

import { useEffect, useState } from 'react';
import { parseClaimLink } from '@noxsend/core';
import { useNox, explorerTx } from '@/hooks/useNox';
import { ConnectButton } from '@/components/ConnectButton';
import { LockIcon } from '@/components/SealedAmount';

export default function ClaimPage() {
  const nox = useNox();
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [claimed, setClaimed] = useState<string | null>(null);

  // Read the secret from the URL fragment — it never reaches a server.
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      setSecret(parseClaimLink(window.location.href));
    }
  }, []);

  const claim = async () => {
    if (!secret) return;
    setErr(null);
    nox.setBusy('claim');
    try {
      const c = await nox.client();
      const hash = await c.claim(secret);
      setClaimed(hash);
      nox.pushTx('Claimed private payment', hash);
      await nox.refreshBalance();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || String(e));
    } finally {
      nox.setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-2xl font-bold">Claim a private payment</h1>

      {secret ? (
        <div className="glass p-6">
          <p className="text-mid">
            You&apos;ve received a private payment. The amount is sealed until you claim it.
          </p>
          <div className="my-4 flex items-center gap-2">
            <span className="pill-sealed animate-shimmer"><LockIcon /> •••• cUSD</span>
            <span className="chip">secret in URL fragment (never sent to a server)</span>
          </div>
          {!nox.connected ? (
            <ConnectButton />
          ) : claimed ? (
            <div className="rounded-xl border border-primary/40 bg-primary/10 p-4 text-sm">
              Claimed. <a className="text-primary-bright underline" href={explorerTx(claimed)} target="_blank" rel="noreferrer">View tx ↗</a>
              <br />Decrypt your balance on the Send page to see it — only you can.
            </div>
          ) : (
            <button className="btn btn-primary w-full" disabled={!!nox.busy} onClick={claim}>
              {nox.busy === 'claim' ? 'Claiming…' : 'Connect &amp; claim to your wallet'}
            </button>
          )}
          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
        </div>
      ) : (
        <CreateLink />
      )}
    </div>
  );
}

function CreateLink() {
  const nox = useNox();
  const [amount, setAmount] = useState('');
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const create = async () => {
    setErr(null);
    setLink(null);
    nox.setBusy('link');
    try {
      const c = await nox.client();
      const baseUrl = window.location.origin;
      const res = await c.createClaimLink(amount.trim(), { baseUrl, expiryDays: 7 });
      setLink(res.link);
      nox.pushTx(`Created claim link (${amount} cUSD)`, res.txHash);
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || String(e));
    } finally {
      nox.setBusy(null);
    }
  };

  return (
    <div className="glass p-6">
      <span className="label">Send to someone without a wallet</span>
      {!nox.connected ? (
        <ConnectButton />
      ) : (
        <>
          <div className="flex gap-2">
            <input className="field" placeholder="120.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <button className="btn btn-primary" disabled={!amount || !!nox.busy} onClick={create}>
              {nox.busy === 'link' ? 'Booking…' : 'Create link'}
            </button>
          </div>
          <p className="mt-2 text-xs text-mid">
            Uses a time-bound operator grant to the escrow (auto-revoked right after funding). The
            recipient claims by secret; you can reclaim after 7 days if unclaimed.
          </p>
          {link && (
            <div className="mt-4 space-y-2">
              <div className="chip w-full justify-between gap-2 overflow-hidden">
                <span className="truncate">{link}</span>
                <button className="text-primary-bright" onClick={() => navigator.clipboard.writeText(link)}>copy</button>
              </div>
              <p className="text-xs text-mid">Share this link privately — anyone with it can claim.</p>
            </div>
          )}
          {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
        </>
      )}
    </div>
  );
}
