// Claim-link secrets. A 32-byte secret is generated client-side; the escrow stores only
// keccak256(secret). The link carries the secret in the URL FRAGMENT (#...), which browsers
// never send to a server — so the claim secret stays off every wire and log.
import { keccak256, randomBytes, hexlify, AbiCoder, getBytes } from 'ethers';

const HEX32 = /^0x[0-9a-fA-F]{64}$/;

export function generateSecret(): string {
  return hexlify(randomBytes(32));
}

export function secretHash(secret: string): string {
  if (!HEX32.test(secret)) throw new Error('secret must be a 32-byte hex string');
  // Solidity: keccak256(abi.encodePacked(bytes32 secret)) == keccak256 of the 32 raw bytes.
  return keccak256(getBytes(secret));
}

/** Build a claim URL with the secret in the fragment (never sent to a server). */
export function buildClaimLink(baseUrl: string, secret: string): string {
  if (!HEX32.test(secret)) throw new Error('secret must be a 32-byte hex string');
  const noFrag = baseUrl.indexOf('#') >= 0 ? baseUrl.slice(0, baseUrl.indexOf('#')) : baseUrl;
  const base = noFrag.endsWith('/') ? noFrag.slice(0, -1) : noFrag;
  return `${base}/claim#${secret}`;
}

/** Extract the secret from a claim URL fragment. Returns null if absent/malformed. */
export function parseClaimLink(url: string): string | null {
  const hash = url.includes('#') ? url.slice(url.indexOf('#') + 1) : '';
  const secret = hash.startsWith('0x') ? hash : hash ? `0x${hash}` : '';
  return HEX32.test(secret) ? secret.toLowerCase() : null;
}

/** ABI-encode the escrow booking payload passed as `data` in confidentialTransferAndCall. */
export function encodeClaimData(secretHash_: string, expiry: number | bigint): string {
  if (!HEX32.test(secretHash_)) throw new Error('secretHash must be a 32-byte hex string');
  const exp = BigInt(expiry);
  if (exp < 0n || exp > 2n ** 48n - 1n) throw new Error('expiry out of uint48 range');
  return AbiCoder.defaultAbiCoder().encode(['bytes32', 'uint48'], [secretHash_, exp]);
}

export function decodeClaimData(data: string): { secretHash: string; expiry: number } {
  const [h, e] = AbiCoder.defaultAbiCoder().decode(['bytes32', 'uint48'], data);
  return { secretHash: h, expiry: Number(e) };
}

/** Default expiry: `days` from now, as a unix timestamp (seconds). */
export function expiryFromNow(days = 7, now = Date.now()): number {
  return Math.floor(now / 1000) + Math.round(days * 24 * 3600);
}
