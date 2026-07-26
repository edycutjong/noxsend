// NoxSendClient — the "add private send in ~10 lines" surface over @iexec-nox/handle + ethers.
// Framework-agnostic (Node/CLI). The Next.js dApp calls these same ethers-based helpers via
// web/lib/nox.ts; both share amounts/handles/secret/acl/abis from this package.
import { Contract, ZeroHash, keccak256, getBytes, AbiCoder, type Signer } from 'ethers';
import { CONFIDENTIAL_USD_ABI, DEMO_USD_ABI, SEND_LINK_ESCROW_ABI, NOX_PROTOCOL_ABI } from './abis.js';
import type { NoxSendConfig } from './config.js';
import { toBaseUnits } from './amounts.js';
import { generateSecret, secretHash as hashSecret, buildClaimLink, expiryFromNow } from './secret.js';

const RETRYABLE = /not yet computed|not a viewer|access denied|not authorized|does not exist|rpc error|status: 40[34]|fetch failed|network request failed/i;

async function withRetry<T>(fn: () => Promise<T>, attempts = 18, delayMs = 4000): Promise<T> {
  let last: unknown;
  for (let i = 1; i <= attempts; i++) {
    try { return await fn(); }
    catch (e) {
      last = e;
      if (i === attempts || !RETRYABLE.test((e as Error)?.message || '')) throw e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}

export interface HandleClientLike {
  encryptInput(value: bigint, solidityType: string, applicationContract: string): Promise<{ handle: string; handleProof: string }>;
  decrypt(handle: string): Promise<{ value: bigint; solidityType: string }>;
  publicDecrypt(handle: string): Promise<{ value: bigint; solidityType: string; decryptionProof: string }>;
  viewACL(handle: string): Promise<unknown>;
}

export interface ClaimLinkResult {
  secret: string;
  secretHash: string;
  link: string;
  expiry: number;
  txHash: string;
}

export class NoxSendClient {
  readonly signer: Signer;
  readonly handle: HandleClientLike;
  readonly config: NoxSendConfig;
  readonly cUSD: Contract;
  readonly escrow: Contract;
  readonly underlying: Contract;
  readonly nox: Contract;

  constructor(signer: Signer, handle: HandleClientLike, config: NoxSendConfig) {
    this.signer = signer;
    this.handle = handle;
    this.config = config;
    this.cUSD = new Contract(config.contracts.confidentialUSD, CONFIDENTIAL_USD_ABI as unknown as string[], signer);
    this.escrow = new Contract(config.contracts.sendLinkEscrow, SEND_LINK_ESCROW_ABI as unknown as string[], signer);
    this.underlying = new Contract(config.contracts.underlying, DEMO_USD_ABI as unknown as string[], signer);
    this.nox = new Contract(config.network.noxProtocol, NOX_PROTOCOL_ABI as unknown as string[], signer);
  }

  get address(): Promise<string> {
    return this.signer.getAddress();
  }

  private get cUSDAddress(): string {
    return this.config.contracts.confidentialUSD;
  }

  /** Wrap `amount` (human units) of the underlying ERC-20 into cUSD (approve + wrap). */
  async wrap(amount: string | number): Promise<string> {
    const to = await this.address;
    const units = toBaseUnits(amount);
    await (await this.underlying.approve(this.cUSDAddress, units)).wait();
    const tx = await this.cUSD.wrap(to, units);
    await tx.wait();
    return tx.hash;
  }

  /** Read + decrypt a confidential balance (defaults to the signer). Uninitialized => 0n. */
  async decryptBalance(address?: string): Promise<bigint> {
    const who = address ?? (await this.address);
    const h: string = await this.cUSD.confidentialBalanceOf(who);
    if (h === ZeroHash) return 0n;
    const { value } = await withRetry(() => this.handle.decrypt(h));
    return value;
  }

  async balanceHandle(address?: string): Promise<string> {
    return this.cUSD.confidentialBalanceOf(address ?? (await this.address));
  }

  /** Encrypt an amount and privately transfer it. Calldata carries only a 32-byte handle. */
  async sendPrivate(to: string, amount: string | number): Promise<string> {
    const { handle, handleProof } = await this.handle.encryptInput(toBaseUnits(amount), 'uint256', this.cUSDAddress);
    const tx = await this.cUSD['confidentialTransfer(address,bytes32,bytes)'](to, handle, handleProof);
    await tx.wait();
    return tx.hash;
  }

  /**
   * Create a claim link via the operator-pull escrow. Grants the escrow a time-bound operator
   * (until the link expiry), funds the link, then revokes the operator (minimal authority window).
   * Returns the secret-bearing URL. The amount is encrypted-bound to the escrow.
   */
  async createClaimLink(amount: string | number, opts: { baseUrl: string; expiryDays?: number; autoRevoke?: boolean }): Promise<ClaimLinkResult> {
    const secret = generateSecret();
    const secretHash = hashSecret(secret);
    const expiry = expiryFromNow(opts.expiryDays ?? 7);
    const escrow = this.config.contracts.sendLinkEscrow;
    // 1) time-bound operator grant so the escrow can pull exactly at createLink time
    await (await this.cUSD.setOperator(escrow, expiry)).wait();
    // 2) encrypt bound to the escrow, then book the link
    const { handle, handleProof } = await this.handle.encryptInput(toBaseUnits(amount), 'uint256', escrow);
    const tx = await this.escrow.createLink(secretHash, expiry, handle, handleProof);
    await tx.wait();
    // 3) revoke the operator immediately — the funds are already escrowed
    if (opts.autoRevoke !== false) await (await this.cUSD.setOperator(escrow, 0)).wait();
    return { secret, secretHash, link: buildClaimLink(opts.baseUrl, secret), expiry, txHash: tx.hash };
  }

  /** Claim a link by its secret; funds go to `to` (defaults to the signer). */
  async claim(secret: string, to?: string): Promise<string> {
    const dest = to ?? (await this.address);
    const tx = await this.escrow.claim(secret, dest);
    await tx.wait();
    return tx.hash;
  }

  /** After expiry, the original sender refunds themselves. */
  async reclaim(secret: string): Promise<string> {
    const tx = await this.escrow.reclaim(keccak256(getBytes(secret)));
    await tx.wait();
    return tx.hash;
  }

  /** Grant a viewer (auditor) decrypt access on one handle — selective disclosure. */
  async grantViewer(handle: string, viewer: string): Promise<string> {
    const tx = await this.nox.addViewer(handle, viewer);
    await tx.wait();
    return tx.hash;
  }

  async isViewer(handle: string, account: string): Promise<boolean> {
    return this.nox.isViewer(handle, account);
  }
  async isAllowed(handle: string, account: string): Promise<boolean> {
    return this.nox.isAllowed(handle, account);
  }
  async viewACL(handle: string): Promise<unknown> {
    return this.handle.viewACL(handle);
  }

  /** Two-step unwrap: burn `amount` -> TEE public-decrypt -> finalize with the decryption proof. */
  async unwrap(amount: string | number): Promise<{ requestId: string; burnTx: string; finalizeTx: string; amount: bigint }> {
    const from = await this.address;
    const { handle, handleProof } = await this.handle.encryptInput(toBaseUnits(amount), 'uint256', this.cUSDAddress);
    const burn = await this.cUSD['unwrap(address,address,bytes32,bytes)'](from, from, handle, handleProof);
    const rc = await burn.wait();
    const parsed = rc.logs.map((l: any) => { try { return this.cUSD.interface.parseLog(l); } catch { return null; } }).find((x: any) => x?.name === 'UnwrapRequested');
    if (!parsed) throw new Error('UnwrapRequested event not found');
    const requestId: string = parsed.args[1];
    const pub = await withRetry(() => this.handle.publicDecrypt(requestId));
    const fin = await this.cUSD.finalizeUnwrap(requestId, pub.decryptionProof);
    await fin.wait();
    return { requestId, burnTx: burn.hash, finalizeTx: fin.hash, amount: pub.value };
  }
}
