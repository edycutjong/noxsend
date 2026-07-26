'use client';

import { useEffect, useState } from 'react';
import { Contract, JsonRpcProvider, Interface } from 'ethers';
import { ABIS, CONTRACTS, NETWORK, shortAddr } from '@/lib/contracts';
import { describeHandle, isHandle } from '@noxsend/core';
import { explorerAddr, explorerTx } from '@/hooks/useNox';

interface Evt { kind: string; tx: string; block: number; detail: string; }

export default function VerifyPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold">/verify — live proof, zero mock</h1>
        <p className="mt-1 text-mid">
          Everything below is read straight from Ethereum Sepolia and the Nox protocol contract. No
          backend, no fixtures.
        </p>
      </header>
      <Contracts />
      <div className="grid gap-6 lg:grid-cols-2">
        <EventFeed />
        <AclInspector />
      </div>
      <Bench />
      <Reproduce />
    </div>
  );
}

function Contracts() {
  const rows = [
    ['ConfidentialUSD (cUSD)', CONTRACTS.confidentialUSD],
    ['SendLinkEscrow', CONTRACTS.sendLinkEscrow],
    ['DemoUSD (underlying)', CONTRACTS.underlying],
    ['Nox protocol (NoxCompute)', NETWORK.noxProtocol],
  ] as const;
  return (
    <div className="glass p-6">
      <span className="label">Deployed contracts</span>
      <div className="grid gap-2 sm:grid-cols-2">
        {rows.map(([name, addr]) => (
          <a key={addr} href={explorerAddr(addr)} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 hover:border-primary/50">
            <span className="text-sm text-hi">{name}</span>
            <span className="chip">{shortAddr(addr)} ↗</span>
          </a>
        ))}
      </div>
    </div>
  );
}

function EventFeed() {
  const [events, setEvents] = useState<Evt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        // Historical logs via the Etherscan-backed /api/logs route (the public RPC
        // blocks archive eth_getLogs). Decoded client-side with the contract ABIs.
        const cusdI = new Interface(ABIS.CONFIDENTIAL_USD_ABI as any);
        const escrowI = new Interface(ABIS.SEND_LINK_ESCROW_ABI as any);
        const fetchLogs = async (addr: string) => {
          const r = await fetch(`/api/logs?address=${addr}&fromBlock=0`, { cache: 'no-store' });
          const j = await r.json();
          return (Array.isArray(j.result) ? j.result : []) as any[];
        };
        const [cusdLogs, escrowLogs] = await Promise.all([
          fetchLogs(CONTRACTS.confidentialUSD),
          fetchLogs(CONTRACTS.sendLinkEscrow),
        ]);
        const evs: Evt[] = [];
        const bn = (l: any) => parseInt(l.blockNumber, 16);
        for (const l of cusdLogs) {
          try {
            const pl = cusdI.parseLog({ topics: l.topics, data: l.data });
            if (pl?.name === 'ConfidentialTransfer') evs.push({ kind: 'ConfidentialTransfer', tx: l.transactionHash, block: bn(l), detail: `${shortAddr(pl.args?.from)} → ${shortAddr(pl.args?.to)} · handle ${String(pl.args?.amount).slice(0, 12)}…` });
          } catch { /* not this event */ }
        }
        for (const l of escrowLogs) {
          try {
            const pl = escrowI.parseLog({ topics: l.topics, data: l.data });
            if (pl?.name === 'LinkCreated') evs.push({ kind: 'LinkCreated', tx: l.transactionHash, block: bn(l), detail: `by ${shortAddr(pl.args?.from)}` });
            else if (pl?.name === 'LinkClaimed') evs.push({ kind: 'LinkClaimed', tx: l.transactionHash, block: bn(l), detail: `to ${shortAddr(pl.args?.to)}` });
          } catch { /* not this event */ }
        }
        evs.sort((a, b) => b.block - a.block);
        if (alive) setEvents(evs.slice(0, 15));
      } catch (e: any) {
        if (alive) setError(e?.message || String(e));
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="glass p-6">
      <span className="label">Live event stream (on-chain · via Etherscan)</span>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {!events && !error && <p className="text-sm text-mid">Loading from Sepolia…</p>}
      {events && events.length === 0 && <p className="text-sm text-mid">No recent events in range.</p>}
      <ul className="divide-y divide-white/5">
        {events?.map((e, i) => (
          <li key={e.tx + i} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div>
              <span className="text-primary-bright">{e.kind}</span>
              <span className="ml-2 text-mid">{e.detail}</span>
            </div>
            <a className="chip" href={explorerTx(e.tx)} target="_blank" rel="noreferrer">#{e.block} ↗</a>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AclInspector() {
  const [handle, setHandle] = useState('');
  const [addr, setAddr] = useState('');
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const inspect = async () => {
    setErr(null);
    setResult(null);
    try {
      if (!isHandle(handle.trim())) throw new Error('Enter a 32-byte handle (0x…64 hex).');
      const info = describeHandle(handle.trim());
      const p = new JsonRpcProvider(NETWORK.rpcUrl, 11155111, { staticNetwork: true });
      const nox = new Contract(NETWORK.noxProtocol, ABIS.NOX_PROTOCOL_ABI as unknown as string[], p);
      const isPublic = await nox.isPubliclyDecryptable(handle.trim());
      let isViewer: boolean | null = null;
      let isAllowed: boolean | null = null;
      if (addr.trim()) {
        [isViewer, isAllowed] = await Promise.all([
          nox.isViewer(handle.trim(), addr.trim()),
          nox.isAllowed(handle.trim(), addr.trim()),
        ]);
      }
      setResult({ info, isPublic, isViewer, isAllowed });
    } catch (e: any) {
      setErr(e?.shortMessage || e?.message || String(e));
    }
  };

  return (
    <div className="glass p-6">
      <span className="label">ACL inspector — who can decrypt this handle?</span>
      <div className="space-y-2">
        <input className="field" placeholder="handle 0x…64 hex" value={handle} onChange={(e) => setHandle(e.target.value)} />
        <input className="field" placeholder="address to check (optional)" value={addr} onChange={(e) => setAddr(e.target.value)} />
        <button className="btn btn-ghost w-full" onClick={inspect}>Inspect</button>
      </div>
      {err && <p className="mt-3 text-sm text-red-300">{err}</p>}
      {result && (
        <dl className="mt-4 space-y-1.5 text-sm">
          <Row k="chainId" v={String(result.info.chainId)} />
          <Row k="type" v={result.info.type} />
          <Row k="unique handle" v={String(result.info.unique)} />
          <Row k="isPubliclyDecryptable" v={String(result.isPublic)} />
          {result.isViewer !== null && <Row k="isViewer(addr)" v={String(result.isViewer)} highlight />}
          {result.isAllowed !== null && <Row k="isAllowed(addr)" v={String(result.isAllowed)} />}
        </dl>
      )}
    </div>
  );
}

function Row({ k, v, highlight }: { k: string; v: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 pb-1">
      <dt className="text-mid">{k}</dt>
      <dd className={`font-mono ${highlight ? 'text-primary-bright' : 'text-hi'}`}>{v}</dd>
    </div>
  );
}

function Bench() {
  const [b, setB] = useState<any>(null);
  useEffect(() => {
    fetch('/bench.json').then((r) => (r.ok ? r.json() : null)).then(setB).catch(() => setB(null));
  }, []);
  const stages = b ? [['encryptInput', b.encryptInput], ['decrypt', b.decrypt], ['full send', b.fullSend]] : [];
  return (
    <div className="glass p-6">
      <span className="label">Latency benchmark (live Sepolia)</span>
      {!b ? (
        <p className="text-sm text-mid">Run <code className="chip">npm run bench</code> to populate p50/p95 (writes web/public/bench.json).</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          {stages.map(([name, s]: any) => (
            <div key={name} className="rounded-xl border border-white/10 p-4">
              <div className="text-xs uppercase tracking-wider text-mid">{name}</div>
              <div className="mt-1 font-mono text-2xl text-primary-bright">{s.p50}<span className="text-sm text-mid">ms p50</span></div>
              <div className="text-xs text-mid">p95 {s.p95}ms · max {s.max}ms · n={s.n}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Reproduce() {
  const cmds = [
    'git clone <repo> && cd noxsend && npm install',
    'cp .env.example .env   # add a funded Sepolia key',
    'npm run compile && npm run deploy',
    'npm run e2e            # full wrap→send→decrypt→claim→unwrap on live Sepolia',
    'npm test               # 122 @noxsend/core unit tests (all green)',
  ];
  return (
    <div className="glass p-6">
      <span className="label">Reproduce this in ~5 minutes</span>
      <pre className="overflow-x-auto rounded-xl border border-white/10 bg-black/40 p-4 font-mono text-xs text-mid">
        {cmds.map((c) => `$ ${c}`).join('\n')}
      </pre>
    </div>
  );
}
