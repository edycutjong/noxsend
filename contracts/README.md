# NoxSend — Contracts

Solidity sources for NoxSend, compiled with **solc 0.8.35** via Hardhat. Privacy is layered on
**unmodified** ERC-20s using the audited [iExec Nox](https://docs.iex.ec) confidential-token library
(`@iexec-nox/nox-confidential-contracts`, `@iexec-nox/nox-protocol-contracts`) — the protocol itself is
never touched.

All three are **live and source-verified on Ethereum Sepolia** (chainId `11155111`):

| Contract | File | Sepolia address (verified) | Role |
|---|---|---|---|
| **ConfidentialUSD** (cUSD) | [`ConfidentialUSD.sol`](./ConfidentialUSD.sol) | [`0x82C281…8991`](https://sepolia.etherscan.io/address/0x82C281D7403e44d61968c2F49751a56877468991#code) | 1:1 confidential ERC-7984 wrapper |
| **SendLinkEscrow** | [`SendLinkEscrow.sol`](./SendLinkEscrow.sol) | [`0xF1Df76…7F62`](https://sepolia.etherscan.io/address/0xF1Df763b425e20c16c039d80Ef1309c5a4A47f62#code) | claim-link escrow for wallet-less recipients |
| **DemoUSD** (dUSD) | [`DemoUSD.sol`](./DemoUSD.sol) | [`0x486c4B…735C`](https://sepolia.etherscan.io/address/0x486c4B8009ACf0BfE26268512F27200e48BD735C#code) | unmodified underlying ERC-20 (USDC stand-in, faucet) |

Nox protocol (unmodified, deployed by iExec): [`0x24ef36…77bf`](https://sepolia.etherscan.io/address/0x24ef36ec5b626d7dcd09a98f3083c2758f0f77bf) — ACL + TEE proof validation.

---

## ConfidentialUSD.sol — the wrapper (`cUSD`)

A 1:1, redeemable confidential wrapper around an unmodified ERC-20. The entire contract *is* its
constructor — `wrap` / `unwrap` / `finalizeUnwrap` / `confidentialTransfer` / `confidentialTransferAndCall`
/ ACL are all inherited from the audited `ERC20ToERC7984Wrapper`. Balances and amounts are encrypted
`euint256` handles processed inside the Nox TEE; the underlying ERC-20 is held 1:1 and released only
against a valid TEE decryption proof via the **two-step unwrap** (`unwrap` → `finalizeUnwrap`).

## DemoUSD.sol — the underlying (`dUSD`)

A plain, **unmodified** ERC-20 mirroring USDC's 6 decimals, used as the wrapped asset so judges are
never blocked by a dry Circle faucet — a real deployed ERC-20, not mock data. `faucet()` mints 1,000 dUSD
to any caller. Swap for real Circle Sepolia USDC in production; the wrapper is asset-agnostic.

## SendLinkEscrow.sol — claim links ("private Venmo, self-custodial")

Escrow that lets a sender fund a link redeemable by a wallet-less recipient with a secret.

- **Funding uses the operator-pull pattern** (not a `confidentialTransferAndCall` push): the sender grants
  a **time-bound, one-tap-revocable** operator (`cUSD.setOperator(escrow, expiry)`), then calls
  `createLink` with an amount `encryptInput`-bound to this escrow. The escrow validates the input proof
  (`Nox.fromExternal` → transient ACL), pulls via `confidentialTransferFrom`, and persists the handle
  under `keccak256(secret)` with `Nox.allowThis`.
  > Why pull, not push: in this SDK an `IERC7984Receiver` hook is **not** granted ACL over the pushed
  > handle, so a push-funded escrow can't persist funds (`Nox.allowThis` reverts `UnauthorizedSender`).
  > See `../docs/feedback.md`. Direct NoxSend sends still take **zero** operator authority.
- `claim(secret, to)` — anyone with the secret redeems the encrypted amount; `addViewer(amount, to)` lets
  the claimee decrypt exactly what they received.
- `reclaim(secretHash)` — after `expiry` (plaintext, public by design), the original sender refunds.

**Amounts stay encrypted throughout**; only `expiry` and claim/refund status are public.

---

## Build & verify

```bash
npm run compile            # solc 0.8.35 (auto-downloaded)
npm run test:contracts     # Hardhat contract tests (DemoUSD)
npm run deploy             # deploy DemoUSD + cUSD + SendLinkEscrow to Sepolia
npm run verify:contracts   # Etherscan source-verify (needs ETHERSCAN_API_KEY in .env)
```

License: MIT.
