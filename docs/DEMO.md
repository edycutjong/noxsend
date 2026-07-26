# DEMO — NoxSend (exact steps + expected outputs)

Two ways to see it: (A) the headless live proof (fastest, undeniable), (B) the dApp.

## A. Headless live proof (~2 min, zero mock)

```bash
npm install && cp .env.example .env  # add a funded Sepolia key
npm run e2e
```

Expected (abridged) — every line is a real Sepolia tx / real gateway response:

```
[1] Alice wraps 5,000 dUSD -> cUSD           Alice decrypts: +5,000.00 cUSD
[2] Alice privately sends 1,850 to Landlord
      calldata leaks "1850e6"? false          <-- the amount is NOT in calldata
      calldata carries the 32-byte handle? true
[3] Landlord decrypts their OWN balance       +1,850.00 received
[4] Landlord grants Auditor viewer access     isViewer(auditor)=true  isViewer(stranger)=false
      Auditor decrypts Landlord balance        = Landlord's balance   (stranger cannot)
[5] Claim link 120 cUSD (operator -> createLink -> revoke)   LinkCreated=true
[6] Bob claims                                +120.00 to Bob
[7] Reclaim (post-expiry)                     refunded=true
[8] Two-step unwrap 1,850                     dUSD +1,850.00  (released against the proof)
ALL STEPS GREEN.
```

> The **deltas** above and the two `[2]` calldata booleans are invariant on every run; absolute
> balances accumulate because the run replays against the same live contracts. The exact figures
> from the recorded pass are in [`docs/proof/e2e.log`](proof/e2e.log).

## B. The dApp (`cd web && npm run dev`)

1. **Connect** MetaMask/Rabby on Sepolia (top-right). Nothing is installed or modified.
2. **Balance card** — shows `•••• cUSD` (a shimmering sealed pill). Click **Decrypt** → sign the
   EIP-712 request → the number unseals *for you only*.
3. **Wrap/Unwrap drawer** — Wrap 5,000 dUSD → cUSD (get dUSD from the DemoUSD faucet). Unwrap shows the
   2-step burn → TEE proof → finalize.
4. **Private send** — enter a recipient + `1850`, hit **Send privately**. Open the tx on Etherscan
   (activity strip link): the calldata is `confidentialTransfer(to, 0x…handle, proof)` — no amount.
5. **Selective disclosure** — paste an auditor address, **Grant viewer**. They can now decrypt that
   handle; no one else can.
6. **/claim** — create a claim link for a wallet-less friend (copy the `…/claim#<secret>` URL), or open
   a received link and **Claim**.
7. **/verify** — the judge page: deployed contracts (Etherscan-linked), a **live** Sepolia event stream,
   an **ACL inspector** (paste a handle → `isViewer`/`isAllowed`/type/chainId), and the latency bench.

## The one devastating query
Open two Etherscan tabs: a plain USDC `transfer` (amount in cleartext, forever) vs this real NoxSend
[`confidentialTransfer`](https://sepolia.etherscan.io/tx/0xb03d69a2709e0095572659bdaa0c103c551b1dc2d80c13acdaf39a9ac84bcf1c)
(calldata = a single 32-byte handle, no amount). "Read me the amount." You can't — and the e2e
*asserts* it: `expect(!tx.data.includes("1850e6"))` fails the whole run if the plaintext ever leaks
(`scripts/e2e.mjs:67`).

## Video script — exact ≤4:00 beat sheet

| Time | Beat | On screen | Say |
|---|---|---|---|
| **0:00–0:25** | **★ THE MAGIC MOMENT** | Two Etherscan tabs side by side: a normal USDC `transfer` (amount `1,850`, cleartext) vs the NoxSend [`confidentialTransfer`](https://sepolia.etherscan.io/tx/0xb03d69a2709e0095572659bdaa0c103c551b1dc2d80c13acdaf39a9ac84bcf1c) (calldata = one 32-byte handle) | "Left: a rent payment, public forever. Right: the same payment through NoxSend. **Read me the amount on the right. You can't.**" |
| 0:25–1:00 | Connect + wrap | Real MetaMask connects on Sepolia; wrap 5,000 dUSD → cUSD; tx hash on screen | "Same wallet, nothing installed. USDC wrapped 1:1 into confidential cUSD." |
| 1:00–1:45 | Private send | Enter Landlord + `1850` → **Send privately**; open the tx on Etherscan live; point at the handle in calldata | "The amount is encrypted inside Intel TDX. Etherscan sees 32 bytes." |
| 1:45–2:20 | Decrypt + selective disclosure | Landlord signs → balance unseals *for them only*; **Grant auditor** on ONE payment; `/verify` ACL panel shows `isViewer(auditor)=true`, stranger `false` | "The recipient decrypts. An auditor — only if you say so. No one else." |
| 2:20–2:55 | Claim link | Create a 120 cUSD claim link for wallet-less Bob → open link → **Claim** | "No wallet? A claim link. Private Venmo, self-custodial." |
| 2:55–3:30 | Two-step unwrap | Unwrap 1,850 → burn → TEE decryption proof → finalize | "Real dollars only come back against a TEE decryption proof." |
| 3:30–4:00 | `/verify` | Live Sepolia event stream + latency bench + Etherscan-linked contracts | "Wallet unmodified. Token unmodified. Privacy added. That's Nox." |
