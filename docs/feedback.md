# NoxSend — SDK / Protocol Feedback for iExec Nox

Findings while building NoxSend (real deploy on Ethereum Sepolia) against
`@iexec-nox/handle@0.1.0-beta.13`, `@iexec-nox/nox-confidential-contracts@0.2.2`,
`@iexec-nox/nox-protocol-contracts@0.2.4`. Every item is something we actually hit; the
repros are copy-pasteable. Dated during the build (2026-07-11 → 2026-07-12).

Legend: 🟢 works well / worth keeping · 🟠 friction / worth a doc note · 🔴 bug or contract-shape gap.

---

### 1. 🟢 Handle Gateway is genuinely self-serve — no API key, no signup, no allowlist
**2026-07-11.** The single biggest de-risking finding for us. `createEthersHandleClient(wallet)`
auto-resolves the Sepolia config and `encryptInput` succeeds with only a funded EOA:
```
POST https://gateway-testnets.noxprotocol.dev/v0/secrets?chain_id=11155111  -> 200
{ handle: 0x0000aa36a723..., proof: 0x... (137 bytes) }   // ~1.4s
```
No `Authorization` header on `encryptInput`; the only auth is the gateway signing its *own*
responses (TEE attestation the SDK verifies). Please keep this and say it loudly in the docs —
teams assume a gateway means an account.

### 2. 🔴 `IERC7984Receiver` hook is NOT granted ACL access to the received amount — `confidentialTransferAndCall` escrows can't persist funds
**2026-07-11.** `contracts/interfaces/IERC7984Receiver.sol` says: *"NOTE: The `amount` handle is
accessible to this contract via the ACL."* In practice it is **not**. Inside
`onConfidentialTransferReceived`, calling `Nox.allowThis(amount)` reverts:
```
UnauthorizedSender(0x…escrow)   // selector 0x3fcc3f17, from NoxCompute.allow -> onlyAllowed(handle)
```
Tracing `ERC7984Base._transferAndCall`: the transferred handle produced by `Nox.select(...)` is
transiently allowed to the **token** (`address(this)`), never to the receiver `to`. So a receiver
cannot persist the amount and therefore cannot pay it out later. This breaks the natural
"push-funded claim escrow" pattern. We had to fall back to the operator-pull shape
(`setOperator` → `createLink` → `confidentialTransferFrom` → `allowThis`). Either (a) grant the
receiver transient access to `amount` before the hook, or (b) fix the interface NOTE.

### 3. 🟠 `isViewer` returns true for admins (admin ⊇ viewer) — undocumented and load-bearing
**2026-07-11.** `modules/ACL.sol`:
```solidity
function isViewer(bytes32 h, address a) ... {
  return isPublicHandle(h) || $.isPubliclyDecryptable[h] || $.viewers[h][a] || $.admins[h][a];
}
```
This is *why* a recipient can decrypt their balance at all: `ERC7984` only does
`allowThis + allow(owner)` on a new balance (admin), never `addViewer`. So "admin implies
decryptable". It's correct, but nothing in the guides states admin ⊇ viewer, and it changes how you
reason about `addViewer` (it's specifically for decrypt-*only* third parties like an auditor).
Please document the role lattice explicitly.

### 4. 🔴 Gateway ACL view lags the chain — decrypt 403 "not a viewer" for seconds after the grant tx
**2026-07-11.** Immediately after a mint/transfer/`addViewer` tx is *mined*, `decrypt` fails:
```
Unexpected response from Handle Gateway (status: 403, {"error":"rpc","message":"RPC error: Access denied: not a viewer"})
```
…even though on-chain `isViewer(handle, me) == true` in the same block. Waiting ~5–20s and retrying
succeeds (verified: same handle returned `5000.0` on retry). Two asks: (a) make the gateway read ACL
at chain head to remove the race, and (b) the SDK only retries `NotYetComputedHandleError` (404) —
please also retry/anticipate the 403 "not a viewer" indexer-lag case, or document the required
client-side backoff. We had to widen our own retry to cover it.

### 5. 🟠 The `nox-hardhat-plugin` package name in ecosystem links is wrong; the real one needs Docker + Hardhat 3
**2026-07-11.** `npm i nox-hardhat-plugin` → 404. The real package is
`@iexec-nox/nox-hardhat-plugin` (0.1.0). It's a Hardhat **3** plugin that spins up the full
offchain stack (KMS, ingestor, runner, gateway, NATS, S3) via **Docker Compose** for *local* e2e.
Great for local, but it (a) hard-conflicts on peers with `@nomicfoundation/hardhat-toolbox`
(toolbox wants Hardhat 2), and (b) is unnecessary if you test against live Sepolia. A one-line doc
note ("for live-testnet builds you don't need the plugin; point the SDK at chainId 11155111") would
save time.

### 6. 🟠 Protocol contracts require solc `^0.8.35`, which tooling calls "not fully supported"
**2026-07-11.** `sdk/Nox.sol` and `modules/*.sol` are `pragma solidity ^0.8.35`, while
`nox-confidential-contracts` are `^0.8.28`. Compiling the whole graph forces `0.8.35`, and Hardhat 2
prints *"Solidity 0.8.35 is not fully supported yet … stack traces might not work"*. It compiles and
deploys fine, but pinning the confidential contracts and the protocol SDK to the same, widely-tooled
pragma (or documenting the required solc) would smooth onboarding.

### 7. 🟠 `ERC20ToERC7984Wrapper` constructor arg order is easy to get wrong
**2026-07-11.** Intuition (from the ERC-7984 name) is `ERC7984(name,symbol,uri)` + a separate
`wrapper(underlying)`. The real ctor is one call:
```solidity
constructor(string name, string symbol, string contractURI, IERC20 underlying)
```
A short snippet in the wrapper guide would help; we only got it right by reading
`extensions/ERC20ToERC7984Wrapper.sol`.

### 8. 🟢 `finalizeUnwrap` ⇄ SDK `publicDecrypt` compose cleanly
**2026-07-12.** The two-step unwrap is a pleasure: `unwrap()` emits `UnwrapRequested(to, reqId)` with
`reqId` already `allowPublicDecryption`'d; SDK `publicDecrypt(reqId)` returns
`{ value, decryptionProof }`; that `decryptionProof` plugs straight into
`finalizeUnwrap(reqId, proof)`. Verified end-to-end on Sepolia (dUSD released against the proof).
Nice design — the "protocol needs a decryption proof to release real dollars" story is real.

### 9. 🟠 `validateInputProof` binds `appInProof == msg.sender` — the applicationContract must be the calling contract
**2026-07-12.** `modules/Compute.sol` requires the proof's app field to equal the *contract that calls
`fromExternal`*. So an amount you'll feed to `escrow.createLink` must be
`encryptInput(amount,'uint256', <escrow address>)`, not the token address. Obvious in hindsight,
but a "what does `applicationContract` bind to?" note in the `encryptInput` docs would prevent an
`InvalidProof("App mismatch")` head-scratch.

### 10. 🟠 `encryptInput` only supports `bool, uint16, uint256, int16, int256`
**2026-07-11.** From `methods/encryptInput.js` (`NOX_SUPPORTED_TYPES`). The public `SolidityType` union
lists ~100 types, so the runtime `Unsupported Solidity type for encryption` error is the only signal.
Worth surfacing the supported set in the type system or docs.

### 11. 🟠 SDK is ESM-only (`"type":"module"`) — friction with CommonJS Hardhat configs
**2026-07-11.** `@iexec-nox/handle` is ESM-only, so `require()` from a CJS `hardhat.config.js` fails.
We kept Hardhat for compile/verify and ran all SDK-touching flows (deploy/e2e/seed/bench) as
standalone ESM scripts. A note recommending ESM Hardhat configs (or a CJS entry) would help.

### 12. 🟠 Two `confidentialTransfer` overloads collide under ethers overload resolution
**2026-07-12.** `confidentialTransfer(address,bytes32,bytes)` (external+proof) and
`confidentialTransfer(address,bytes32)` (euint256) both take `bytes32`, so ethers needs the explicit
signature string (`cusd['confidentialTransfer(address,bytes32,bytes)'](...)`) to disambiguate.
Minor, but worth a copy-paste example.

### 13. 🟢 `create*HandleClient` config auto-resolution is great
**2026-07-11.** `NETWORK_CONFIGS[11155111]` already carries gateway + subgraph + the protocol address
(`0x24ef…77bf`), so zero-config works on Sepolia. The default `smartContractAddress` matching the
published protocol address is a nice touch.

### 14. 🟠 `finalizeUnwrap` reverts are opaque without stack traces
**2026-07-12.** Because of #6, a failed `finalizeUnwrap`/`fromExternal` surfaces as a bare
`CALL_EXCEPTION` with only a 4-byte selector. We decoded selectors by hand
(`0x3fcc3f17 → UnauthorizedSender(address)`). Shipping an errors ABI / a `Nox.decodeError(data)`
helper would materially improve DX.

### 15. 🟢 Handles are self-describing (chainId + type + uniqueness in the header)
**2026-07-12.** Being able to read `chainId`, solidity type, and the "unique" attribute straight out of
the 32-byte handle (we reimplemented this in `@noxsend/core/handles`) is very handy for client-side
validation before a call. Consider exporting these decoders from the SDK.

---

## Tooling touchpoints used
- **Context7 / docs corpus:** built the full flow against the Nox dev docs (JS SDK + Solidity library
  reference) — the worked `ConfidentialSwap` operator example was what unblocked our claim-link escrow.
- **Contracts Wizard (cdefi-wizard.iex.ec):** noted for scaffolding; our two contracts are thin enough
  (a 4-line wrapper + one escrow) that we wrote them directly against the library `.d.ts`/`.sol`.

## Net
The confidential-token core (wrap → encrypt → transfer → viewer-gated decrypt → proof-gated unwrap)
is solid and shipped **zero-mock on live Sepolia**. The sharp edges are all in DX/observability
(#2, #4, #14) and docs (#3, #6, #7, #9). #2 is the only one that changed our architecture.
