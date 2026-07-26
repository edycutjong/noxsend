// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title MockNoxCompute
 * @notice Test-only, in-process stand-in for the Nox TEE precompile (NoxCompute).
 *
 * The real precompile validates gateway-signed input proofs and runs confidential computations
 * inside an iExec Nox TEE — neither is reproducible on a local Hardhat node. The `Nox` library
 * hardcodes the precompile address `0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685` for the local dev
 * chain (chainid 31337); tests deploy this contract and inject its runtime code at that address via
 * `hardhat_setCode`, so `SendLinkEscrow`'s on-chain ORCHESTRATION (state machine, guards, events,
 * access-control calls) can be exercised deterministically.
 *
 * The ACL/proof calls are intentionally no-ops here — the confidential math is proven separately by
 * the live `npm run e2e` on Sepolia. This contract is NOT part of the product and is excluded from
 * coverage via `.solcover.js` (`skipFiles`). It is deliberately stateless so `hardhat_setCode`
 * (which does not run a constructor) yields a fully functional injected contract.
 */
contract MockNoxCompute {
    event ProofValidated(bytes32 indexed handle, address indexed owner);
    event Allowed(bytes32 indexed handle, address indexed account);
    event ViewerAdded(bytes32 indexed handle, address indexed viewer);

    /// Matches INoxCompute.validateInputProof(bytes32,address,bytes,TEEType) — enum ABI-encodes as uint8.
    function validateInputProof(bytes32 handle, address owner, bytes calldata, uint8) external {
        emit ProofValidated(handle, owner);
    }

    function allow(bytes32 handle, address account) external {
        emit Allowed(handle, account);
    }

    function allowTransient(bytes32 handle, address account) external {
        emit Allowed(handle, account);
    }

    function disallowTransient(bytes32, address) external {}

    function addViewer(bytes32 handle, address viewer) external {
        emit ViewerAdded(handle, viewer);
    }
}
