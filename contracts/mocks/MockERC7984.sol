// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {euint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/**
 * @title MockERC7984
 * @notice Test-only, in-process stand-in for the confidential cUSD token.
 *
 * Implements just the two proofless ERC-7984 overloads that `SendLinkEscrow` invokes
 * (`confidentialTransferFrom(address,address,euint256)` and `confidentialTransfer(address,euint256)`).
 * On a local Hardhat node there is no TEE, so encrypted `euint256` handles carry no ciphertext — this
 * mock simply treats each handle's raw `bytes32` as its plaintext value, letting balances move
 * observably so unit tests can make meaningful assertions about the escrow's fund flow.
 *
 * NOT the product token (the real one is `ConfidentialUSD`, an audited Nox `ERC20ToERC7984Wrapper`).
 * Excluded from coverage via `.solcover.js` (`skipFiles`).
 */
contract MockERC7984 {
    /// Plaintext-equivalent balance keyed by account (handle raw value == amount, test-only).
    mapping(address account => uint256 rawBalance) public balanceOfRaw;

    // Last-call recorders so tests can assert who moved funds where.
    address public lastFrom;
    address public lastTo;
    uint256 public lastAmountRaw;

    /// Test helper: credit a raw balance (stands in for wrap()/faucet in production).
    function mintRaw(address account, uint256 amount) external {
        balanceOfRaw[account] += amount;
    }

    function confidentialTransferFrom(address from, address to, euint256 amount)
        external
        returns (euint256)
    {
        uint256 v = uint256(euint256.unwrap(amount));
        balanceOfRaw[from] -= v;
        balanceOfRaw[to] += v;
        lastFrom = from;
        lastTo = to;
        lastAmountRaw = v;
        return amount; // "received" handle == the pulled amount handle
    }

    function confidentialTransfer(address to, euint256 amount) external returns (euint256) {
        uint256 v = uint256(euint256.unwrap(amount));
        balanceOfRaw[msg.sender] -= v;
        balanceOfRaw[to] += v;
        lastFrom = msg.sender;
        lastTo = to;
        lastAmountRaw = v;
        return amount;
    }
}
