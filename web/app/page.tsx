'use client';

/*
  NoxSend landing — "Cipher Noir".
  Design: editorial display scale + one signature interactive moment (CipherCard:
  a real amount scrambling into a 32-byte handle behind a lock, PUBLIC/YOU toggle).
  All on-chain logic lives in useNox / lib — untouched by this presentational layer.
*/

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useNox, explorerTx } from '@/hooks/useNox';
import { SealedAmount, LockIcon } from '@/components/SealedAmount';
import { ConnectButton } from '@/components/ConnectButton';
import { shortAddr } from '@/lib/contracts';

const GITHUB_URL = 'https://github.com/edycutjong/noxsend';
const CUSD_ADDRESS = '0x82C281D7403e44d61968c2F49751a56877468991';
const CUSD_ETHERSCAN = `https://sepolia.etherscan.io/address/${CUSD_ADDRESS}`;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(m.matches);
    const on = () => setReduced(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return reduced;
}

export default function Home() {
  const nox = useNox();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return;
    const els = Array.from(document.querySelectorAll('.reveal'));
    const io = new IntersectionObserver((ents) => ents.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [nox.connected]);

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
    <div className="space-y-14 sm:space-y-20">
      {!nox.connected ? (
        <>
          <Hero />
          <ProofSection />
          <FlowStrip />
          <RealSection />
          <Faq />
          <FinalCta />
        </>
      ) : (
        <div className="space-y-6">
          <Hero compact />
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
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────── Hero ─────────────────────────── */

function Hero({ compact = false }: { compact?: boolean }) {
  return (
    <section className={compact ? 'pt-1' : 'pt-4 sm:pt-8'}>
      <div className="grid items-center gap-8 lg:grid-cols-[1.05fr_.95fr]">
        <div>
          <div className="hero-in flex flex-wrap gap-2" style={{ ['--d' as any]: '0ms' }}>
            <span className="chip chip-live"><span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-bright" /> Live on Sepolia</span>
            <span className="chip">ERC-7984 · Intel TDX</span>
            <span className="chip">Zero mock data</span>
          </div>

          <h1 className="hero-in mt-5 font-display text-[2.6rem] font-bold leading-[1.02] tracking-tight sm:text-6xl" style={{ ['--d' as any]: '80ms' }}>
            Etherscan sees<br />
            <span className="font-mono text-[2.1rem] text-primary-bright sm:text-5xl">32 bytes</span>.
            <br />
            Your landlord sees <span className="brand-gradient">nothing</span>.
          </h1>

          <p className="hero-in mt-5 max-w-xl text-base leading-relaxed text-mid sm:text-lg" style={{ ['--d' as any]: '180ms' }}>
            Private send for the wallet you already have. Wrap USDC into confidential cUSD (ERC-7984),
            send with the amount encrypted end-to-end inside Intel TDX via iExec Nox, and reveal it only
            to whom you choose.
          </p>

          {!compact && (
            <div className="hero-in mt-7 flex flex-wrap items-center gap-3" style={{ ['--d' as any]: '300ms' }}>
              <ConnectButton />
              <Link href="/verify" className="btn btn-ghost btn-lg lift">Watch it live on-chain →</Link>
            </div>
          )}
          {!compact && (
            <p className="hero-in mt-3 text-xs text-low" style={{ ['--d' as any]: '360ms' }}>
              MetaMask or Rabby · Ethereum Sepolia · read-only until you act · nothing installed or modified
            </p>
          )}
        </div>

        <div className="hero-in" style={{ ['--d' as any]: '240ms' }}>
          <CipherCard />
        </div>
      </div>
    </section>
  );
}

/* The signature interactive: one private send, seen two ways. */
function CipherCard() {
  const reduced = usePrefersReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const [handle, setHandle] = useState('9f3a··2b1c');
  const userToggled = useRef(false);

  // auto-alternate PUBLIC ⇄ YOU until the user takes over
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => {
      if (!userToggled.current) setRevealed((v) => !v);
    }, 3600);
    return () => clearInterval(id);
  }, [reduced]);

  // live "encryption" scramble on the visible handle chars while sealed
  useEffect(() => {
    if (reduced || revealed) return;
    const hex = '0123456789abcdef';
    const rnd = () => Array.from({ length: 4 }, () => hex[Math.floor(Math.random() * 16)]).join('');
    const id = setInterval(() => setHandle(`${rnd()}··${rnd()}`), 70);
    return () => clearInterval(id);
  }, [reduced, revealed]);

  const set = (v: boolean) => { userToggled.current = true; setRevealed(v); };

  return (
    <div className="cipher scanline">
      <div className="mb-4 flex items-center justify-between">
        <span className="eyebrow">Private send · preview</span>
        <div className="seg" role="tablist" aria-label="Whose view">
          <button role="tab" aria-selected={!revealed} data-on={!revealed} onClick={() => set(false)}>Public</button>
          <button role="tab" aria-selected={revealed} data-on={revealed} onClick={() => set(true)}>You</button>
        </div>
      </div>

      <div className="cipher-row">
        <div className="min-w-0">
          <div className="text-xs text-low">to</div>
          <div className="truncate font-mono text-sm text-mid">0x71C7…9f2</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-low">amount</div>
          {revealed ? (
            <div className="cipher-amt animate-unseal text-hi">$1,850.00</div>
          ) : (
            <div className="cipher-amt text-accent-bright" aria-label="encrypted handle">0x{handle}</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs transition ${revealed ? 'bg-primary/15 text-primary-bright' : 'bg-accent/15 text-accent-bright'}`}>
          <LockIcon />
          {revealed ? 'Decrypted — viewer-gated (only you)' : 'Sealed — Etherscan sees a 32-byte handle'}
        </span>
      </div>

      <p className="mt-4 border-t border-white/5 pt-3 text-xs leading-relaxed text-mid">
        Same transaction, two views. The chain — and your landlord — only ever see the handle on the left.
        The value is decryptable solely by the recipient and anyone you explicitly grant.
      </p>
    </div>
  );
}

/* ─────────────────────────── Proof (social proof, counted up) ─────────────────────────── */

function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(reduced ? to : 0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (reduced) { setN(to); return; }
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const io = new IntersectionObserver((ents) => {
      if (!ents[0].isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const dur = 1100;
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        setN(Math.round(to * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, reduced]);
  return <span ref={ref}>{n}{suffix}</span>;
}

function ProofSection() {
  return (
    <section className="glass reveal p-6 sm:p-7">
      <span className="kicker">Verify every claim yourself — zero mock</span>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="stat lift"><span className="stat-num">Live</span><span className="text-xs text-mid">on Ethereum Sepolia</span></div>
        <div className="stat lift"><span className="stat-num"><CountUp to={148} /></span><span className="text-xs text-mid">tests passing</span></div>
        <div className="stat lift"><span className="stat-num"><CountUp to={100} suffix="%" /></span><span className="text-xs text-mid">contract coverage</span></div>
        <div className="stat lift"><span className="stat-num">TDX</span><span className="text-xs text-mid">ERC-7984 · Intel TDX</span></div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Link href="/verify" className="btn btn-primary lift">Open /verify</Link>
        <a className="btn btn-ghost lift" href={GITHUB_URL} target="_blank" rel="noreferrer">View on GitHub ↗</a>
        <a className="btn btn-ghost lift" href="/pitch" target="_blank" rel="noreferrer">Pitch deck ↗</a>
        <a className="btn btn-ghost lift" href={CUSD_ETHERSCAN} target="_blank" rel="noreferrer">Verified cUSD contract ↗</a>
      </div>
      <p className="mt-3 text-xs text-mid">
        <span className="font-mono">/verify</span> streams live Sepolia events and a live ACL inspector — zero mock.
        Every on-chain step has a real proof tx in the README.
      </p>
    </section>
  );
}

/* ─────────────────────────── The one flow ─────────────────────────── */

function FlowStrip() {
  const steps = [
    { n: '1', title: 'Wrap USDC → cUSD', body: 'Deposit the USDC you already hold. Get confidential cUSD 1:1 (ERC-7984), redeemable.' },
    { n: '2', title: 'Private send', body: 'The amount is encrypted before it hits the chain — calldata carries only a 32-byte handle.' },
    { n: '3', title: 'Reveal to whom you choose', body: 'Recipient decrypts via viewer ACL. Grant an auditor if you say so — no one else can read it.' },
    { n: '4', title: 'Claim-link · unwrap', body: 'Wallet-less recipients get a claim link. Redeem cUSD back to USDC, proof-gated.' },
  ];
  return (
    <section>
      <span className="kicker reveal">The one flow — narrow and deep</span>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.n} className="glass reveal lift flex flex-col gap-3 p-5" style={{ ['--d' as any]: `${i * 80}ms` }}>
            <div className="flex items-center gap-3">
              <span className="step-num">{s.n}</span>
              <span className="font-display text-sm font-semibold text-hi">{s.title}</span>
            </div>
            <p className="text-xs leading-relaxed text-mid">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── "Why this is real" (honest credibility, not fake testimonials) ─────────────────────────── */

function RealSection() {
  const cards = [
    { k: 'On real infra', t: 'Not a stub', b: 'Runs against the live Nox Handle Gateway inside Intel TDX on Ethereum Sepolia. Wrap, send, grant, claim and unwrap each land a real proof transaction.' },
    { k: 'On your wallet', t: 'Nothing modified', b: 'The MetaMask/Rabby you already have and the USDC you already hold — untouched. Privacy lives inside cUSD, added around them, never inside them.' },
    { k: 'Honest by design', t: 'Amount-privacy, stated plainly', b: 'Addresses stay public and wrap/unwrap is visible at the boundary. We say so on the page, in the README and in the demo. No overclaiming.' },
  ];
  return (
    <section>
      <span className="kicker reveal">Why judges can trust it</span>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map((c, i) => (
          <div key={c.t} className="glass reveal lift flex flex-col gap-2 p-5" style={{ ['--d' as any]: `${i * 80}ms` }}>
            <span className="eyebrow">{c.k}</span>
            <span className="font-display text-lg font-semibold text-hi">{c.t}</span>
            <p className="text-sm leading-relaxed text-mid">{c.b}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── FAQ ─────────────────────────── */

function Faq() {
  const items = [
    { q: 'Do I need a new wallet or a new chain?', a: 'No. NoxSend uses the MetaMask or Rabby you already have, and the USDC you already hold — neither is modified. It runs on Ethereum Sepolia via the wagmi injected connector.' },
    { q: 'Is the amount really hidden?', a: 'Yes. The amount is encrypted by the Nox Handle Gateway inside Intel TDX before it ever touches the chain — the transaction calldata carries only a 32-byte handle, not the value. Etherscan sees 32 bytes.' },
    { q: 'Is this a mock or a demo stub?', a: 'No. It is live on Ethereum Sepolia against the real Nox Handle Gateway, zero mock data. Wrap, private send, auditor grant, claim-link and unwrap each have a real proof transaction — open /verify to watch events stream live.' },
    { q: 'Who can see my balance and transfers?', a: 'Only you, by default. Decryption is a viewer-gated, EIP-712-signed request to the Nox TEE gateway. The recipient can decrypt via the viewer ACL, and you can grant an auditor with a single addViewer call — no one else can read it.' },
    { q: "What's the honest limitation?", a: 'Amount-privacy only. Sender and recipient addresses stay public, and wrap/unwrap amounts are visible at the wrapper boundary. Privacy lives inside cUSD. It uses a pinned beta SDK (@iexec-nox/handle) and trusts Intel TDX + iExec gateway liveness.' },
    { q: 'How does a recipient without a wallet get paid?', a: 'Via a claim link — a self-custodial escrow (SendLinkEscrow) funded by a time-bound operator grant that auto-revokes right after funding. If it is never claimed, you can reclaim it after expiry.' },
  ];
  return (
    <section>
      <span className="kicker reveal">How it works · FAQ</span>
      <div className="grid gap-3">
        {items.map((it, i) => (
          <details key={it.q} className="faq reveal" style={{ ['--d' as any]: `${i * 60}ms` }}>
            <summary>
              <span className="text-sm font-medium">{it.q}</span>
              <span className="faq-caret text-mid" aria-hidden>▾</span>
            </summary>
            <div className="faq-body">{it.a}</div>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── Final CTA ─────────────────────────── */

function FinalCta() {
  return (
    <section className="cta-band reveal">
      <span className="eyebrow justify-center">Ready when you are</span>
      <h2 className="mx-auto mt-3 max-w-2xl font-display text-3xl font-bold leading-tight sm:text-4xl">
        Send a number only the right people can read.
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-mid">
        Connect the wallet you already use — read-only until you act. Then watch the amount turn into a
        32-byte handle, live on Sepolia.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ConnectButton />
        <Link href="/verify" className="btn btn-ghost btn-lg lift">See live proof →</Link>
      </div>
    </section>
  );
}

/* ─────────────────────────── Connected dApp (logic unchanged) ─────────────────────────── */

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
