import { NextResponse } from 'next/server';

// Server-side proxy for historical event logs. The public Sepolia RPC blocks
// archive eth_getLogs; Etherscan's logs API serves the same on-chain data with
// an API key. The key stays server-side (never shipped to the browser).
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address');
  const fromBlock = searchParams.get('fromBlock') || '0';
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: 'valid address required', result: [] }, { status: 400 });
  }
  const key = process.env.ETHERSCAN_API_KEY || '';
  const url = `https://api.etherscan.io/v2/api?chainid=11155111&module=logs&action=getLogs` +
    `&address=${address}&fromBlock=${fromBlock}&toBlock=latest&page=1&offset=200&apikey=${key}`;
  try {
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    const result = Array.isArray(j.result) ? j.result : [];
    return NextResponse.json({ result }, { headers: { 'cache-control': 's-maxage=30' } });
  } catch (e: any) {
    return NextResponse.json({ result: [], error: e?.message || 'fetch failed' });
  }
}
