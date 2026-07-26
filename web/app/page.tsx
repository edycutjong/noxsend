'use client';

import { useState } from 'react';
import { useNox, explorerTx } from '@/hooks/useNox';
import { SealedAmount, LockIcon } from '@/components/SealedAmount';
import { ConnectButton } from '@/components/ConnectButton';
import { shortAddr } from '@/lib/contracts';

export default function Home() {
  const nox = useNox();
  const [err, setErr] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<void>) => {
    setErr(null);
    nox.setBusy(label);
    try {
      await fn();
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || String(e));
    } finally {
      nox.setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <Hero />

      {!nox.connected ? (
        <div className="glass flex flex-col items-center gap-4 p-10 text-center">
          <p className="text-mid">Connect the wallet you already use. Nothing is installed or modified.</p>
          <ConnectButton />
        </div>
      ) : (
        <>
          {err && (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {err}
            </div>
          )}
          <div className="grid gap-6 md:grid-cols-2">
            <BalanceCard run={run} />
            <SendCard run={run} />
          </div>
          <WrapDrawer run={run} />
          <DisclosureCard run={run} />
          <ActivityStrip />
        </>
      )}
    </div>
  );
}

function Hero() {
  return (
    <section className="pt-2">
      <h1 className="font-display text-3xl font-bold leading-tight sm:text-4xl">
        Etherscan sees <span className="brand-gradient">32 bytes</span>.
        <br />
        Your landlord sees <span className="text-primary-bright">nothing</span>.
      </h1>
      <p className="mt-3 max-w-2xl text-mid">
        Private send for the wallet you already have. Wrap USDC into confidential cUSD (ERC-7984),
        send with the amount encrypted end-to-end inside Intel TDX via iExec Nox, and reveal it only
        to whom you choose. Live on Ethereum Sepolia — zero mock data.
      </p>
    </section>
  );
}

function BalanceCard({ run }: { run: (l: string, f: () => Promise<void>) => Promise<void> }) {
  const nox = useNox();
  return (
    <div className="glass p-6">
      <div className="mb-3 flex items-center justify-between">
        <span className="label mb-0">Confidential balance</span>
        <span className="chip"><LockIcon className="text-accent-bright" /> cUSD</span>
      </div>
      <div className="mb-5 min-h-[2.5rem]">
        <SealedAmount value={nox.balance} loading={nox.balanceLoading} format={nox.formatUsd} />
      </div>
      <div className="flex gap-2">
        {nox.balance === null ? (
          <button className="btn btn-primary flex-1" disabled={!!nox.busy} onClick={() => run('decrypt', nox.refreshBalance)}>
            {nox.busy === 'decrypt' ? 'Signing…' : 'Decrypt (only you can)'}
          </button>
        ) : (
          <>
            <button className="btn btn-ghost flex-1" onClick={nox.sealBalance}>Seal</button>
            <button className="btn btn-ghost flex-1" disabled={!!nox.busy} onClick={() => run('decrypt', nox.refreshBalance)}>
              Refresh
            </button>
          </>
        )}
      </div>
      <p className="mt-3 text-xs text-mid">
        Decryption is a viewer-gated, EIP-712-signed request to the Nox TEE gateway — no one else can read it.
      </p>
    </div>
  );
}

function SendCard({ run }: { run: (l: string, f: () => Promise<void>) => Promise<void> }) {
  const nox = useNox();
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const disabled = !to || !amount || !!nox.busy;

  const send = () =>
    run('send', async () => {
      const c = await nox.client();
      const hash = await c.sendPrivate(to.trim(), amount.trim());
      nox.pushTx(`Private send ${amount} cUSD → ${shortAddr(to)}`, hash);
      setAmount('');
      await nox.refreshBalance();
    });

  return (
    <div className="glass p-6">
      <span className="label">Private send</span>
      <div className="space-y-3">
        <div>
          <label className="label">Recipient</label>
          <input className="field" placeholder="0x… address" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label className="label">Amount (cUSD)</label>
          <input className="field" placeholder="1850.00" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <button className="btn btn-primary w-full" disabled={disabled} onClick={send}>
          <LockIcon /> {nox.busy === 'send' ? 'Encrypting → sending…' : 'Send privately'}
        </button>
      </div>
      <p className="mt-3 text-xs text-mid">
        The amount is encrypted by the gateway before it ever touches the chain — the transaction
        calldata carries only a 32-byte handle.
      </p>
    </div>
  );
}

function WrapDrawer({ run }: { run: (l: string, f: () => Promise<void>) => Promise<void> }) {
  const nox = useNox();
  const [open, setOpen] = useState(false);
  const [wrapAmt, setWrapAmt] = useState('');
  const [unwrapAmt, setUnwrapAmt] = useState('');

  const wrap = () =>
    run('wrap', async () => {
      const c = await nox.client();
      const hash = await c.wrap(wrapAmt.trim());
      nox.pushTx(`Wrap ${wrapAmt} USDC → cUSD`, hash);
      setWrapAmt('');
      await nox.refreshBalance();
    });
  const unwrap = () =>
    run('unwrap', async () => {
      const c = await nox.client();
      const r = await c.unwrap(unwrapAmt.trim());
      nox.pushTx(`Unwrap ${unwrapAmt} cUSD (2-step, proof-gated)`, r.finalizeTx);
      setUnwrapAmt('');
      await nox.refreshBalance();
    });

  return (
    <div className="glass p-6">
      <button className="flex w-full items-center justify-between" onClick={() => setOpen((v) => !v)}>
        <span className="label mb-0">Wrap / Unwrap (USDC ⇄ cUSD, 1:1)</span>
        <span className="chip">{open ? 'hide' : 'show'}</span>
      </button>
      {open && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">Wrap USDC → cUSD</label>
            <div className="flex gap-2">
              <input className="field" placeholder="5000.00" value={wrapAmt} onChange={(e) => setWrapAmt(e.target.value)} />
              <button className="btn btn-primary" disabled={!wrapAmt || !!nox.busy} onClick={wrap}>
                {nox.busy === 'wrap' ? '…' : 'Wrap'}
              </button>
            </div>
            <p className="mt-2 text-xs text-mid">Amount is public once, at the wrapper boundary.</p>
          </div>
          <div>
            <label className="label">Unwrap cUSD → USDC</label>
            <div className="flex gap-2">
              <input className="field" placeholder="1850.00" value={unwrapAmt} onChange={(e) => setUnwrapAmt(e.target.value)} />
              <button className="btn btn-ghost" disabled={!unwrapAmt || !!nox.busy} onClick={unwrap}>
                {nox.busy === 'unwrap' ? 'burn → proof → finalize…' : 'Unwrap'}
              </button>
            </div>
            <p className="mt-2 text-xs text-mid">Two-step: burn → TEE decryption proof → finalize.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function DisclosureCard({ run }: { run: (l: string, f: () => Promise<void>) => Promise<void> }) {
  const nox = useNox();
  const [auditor, setAuditor] = useState('');

  const grant = () =>
    run('grant', async () => {
      const c = await nox.client();
      const handle = await c.balanceHandle();
      const hash = await c.grantViewer(handle, auditor.trim());
      nox.pushTx(`Grant auditor ${shortAddr(auditor)} viewer access`, hash);
      setAuditor('');
    });

  return (
    <div className="glass p-6">
      <span className="label">Selective disclosure — grant an auditor</span>
      <div className="flex gap-2">
        <input className="field" placeholder="Auditor 0x… address" value={auditor} onChange={(e) => setAuditor(e.target.value)} />
        <button className="btn btn-ghost" disabled={!auditor || !!nox.busy} onClick={grant}>
          {nox.busy === 'grant' ? 'Granting…' : 'Grant viewer'}
        </button>
      </div>
      <p className="mt-3 text-xs text-amber-300/80">
        Note: viewer grants let one address decrypt this handle. Admin-level grants are irrevocable by
        design (revocation would be false security) — NoxSend grants decrypt-only viewers here.
      </p>
    </div>
  );
}

function ActivityStrip() {
  const nox = useNox();
  if (nox.txs.length === 0) return null;
  return (
    <div className="glass p-6">
      <span className="label">Explorer honesty strip — every action, live on Sepolia</span>
      <ul className="divide-y divide-white/5">
        {nox.txs.map((t) => (
          <li key={t.hash} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="text-hi">{t.label}</span>
            <a className="chip hover:text-primary-bright" href={explorerTx(t.hash)} target="_blank" rel="noreferrer">
              {t.hash.slice(0, 10)}… ↗
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
