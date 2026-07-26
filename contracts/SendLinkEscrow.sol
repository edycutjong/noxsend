// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";

/**
 * @title SendLinkEscrow
 * @notice Claim-link escrow for wallet-less recipients — "private Venmo, self-custodial".
 *
 * Funding uses the documented ERC-7984 operator-pull pattern (the same shape as the official
 * ConfidentialSwap example): the sender grants a TIME-BOUND operator to this escrow, then calls
 * {createLink} with an amount encrypted-bound to this contract. The escrow validates the input
 * proof (gaining transient ACL access to the handle), pulls the encrypted amount via
 * `confidentialTransferFrom`, and persists it under `keccak256(secret)`.
 *
 * We use operator-pull rather than a `confidentialTransferAndCall` push because in this SDK an
 * {IERC7984Receiver} hook is NOT granted ACL rights over the pushed handle, so it cannot persist
 * the amount (`Nox.allowThis` reverts with `UnauthorizedSender`). See feedback.md.
 *
 * The operator grant is time-bound (set `until` = the link expiry) and one-tap revocable
 * (`cUSD.setOperator(escrow, 0)`); direct NoxSend sends still take zero operator authority.
 *
 * - `claim(secret, to)`   — anyone with the secret redeems the encrypted amount to `to`.
 * - `reclaim(secretHash)` — after expiry, the original sender refunds themselves.
 *
 * `expiry` is intentionally plaintext (public metadata by design); the amount stays encrypted.
 */
contract SendLinkEscrow {
    IERC7984 public immutable cUSD;

    struct Claim {
        euint256 amount; // encrypted amount handle held for this link
        address from; // sender (for post-expiry reclaim)
        uint48 expiry; // plaintext expiry (public by design)
        bool claimed;
        bool refunded;
    }

    mapping(bytes32 secretHash => Claim) private _claims;

    event LinkCreated(bytes32 indexed secretHash, address indexed from, uint48 expiry);
    event LinkClaimed(bytes32 indexed secretHash, address indexed to);
    event LinkReclaimed(bytes32 indexed secretHash, address indexed to);

    error ClaimAlreadyExists(bytes32 secretHash);
    error NoSuchClaim(bytes32 secretHash);
    error AlreadySettled(bytes32 secretHash);
    error LinkExpired(bytes32 secretHash);
    error LinkNotYetExpired(bytes32 secretHash);
    error NotOriginalSender(address caller);

    constructor(IERC7984 cUSD_) {
        cUSD = cUSD_;
    }

    /**
     * @notice Book a claim link. The caller must first grant this escrow a time-bound operator:
     *         `cUSD.setOperator(escrow, expiry)`. `encAmount`/`inputProof` must be produced by
     *         `encryptInput(amount, 'uint256', <this escrow address>)`.
     */
    function createLink(
        bytes32 secretHash,
        uint48 expiry,
        externalEuint256 encAmount,
        bytes calldata inputProof
    ) external {
        require(_claims[secretHash].from == address(0), ClaimAlreadyExists(secretHash));

        // Validate the gateway proof: grants THIS contract transient ACL access to the handle.
        euint256 amount = Nox.fromExternal(encAmount, inputProof);
        // Let the token use the handle for the pull, then pull from the sender's balance.
        Nox.allowTransient(amount, address(cUSD));
        euint256 received = cUSD.confidentialTransferFrom(msg.sender, address(this), amount);
        // Persist access so we can transfer it out on claim/reclaim.
        Nox.allowThis(received);

        _claims[secretHash] = Claim({
            amount: received,
            from: msg.sender,
            expiry: expiry,
            claimed: false,
            refunded: false
        });
        emit LinkCreated(secretHash, msg.sender, expiry);
    }

    /// @notice Redeem a link with its secret preimage; the encrypted amount goes to `to`.
    function claim(bytes32 secret, address to) external {
        bytes32 secretHash = keccak256(abi.encodePacked(secret));
        Claim storage c = _claims[secretHash];
        require(c.from != address(0), NoSuchClaim(secretHash));
        require(!c.claimed && !c.refunded, AlreadySettled(secretHash));
        require(block.timestamp <= c.expiry, LinkExpired(secretHash));

        c.claimed = true;
        euint256 amount = c.amount;
        Nox.addViewer(amount, to); // let the claimee decrypt exactly what they received
        Nox.allowTransient(amount, address(cUSD));
        cUSD.confidentialTransfer(to, amount);

        emit LinkClaimed(secretHash, to);
    }

    /// @notice After expiry, the original sender refunds themselves.
    function reclaim(bytes32 secretHash) external {
        Claim storage c = _claims[secretHash];
        require(c.from != address(0), NoSuchClaim(secretHash));
        require(!c.claimed && !c.refunded, AlreadySettled(secretHash));
        require(block.timestamp > c.expiry, LinkNotYetExpired(secretHash));
        require(msg.sender == c.from, NotOriginalSender(msg.sender));

        c.refunded = true;
        euint256 amount = c.amount;
        Nox.allowTransient(amount, address(cUSD));
        cUSD.confidentialTransfer(c.from, amount);

        emit LinkReclaimed(secretHash, c.from);
    }

    // ============ Views ============

    function claimFrom(bytes32 secretHash) external view returns (address) {
        return _claims[secretHash].from;
    }

    function claimExpiry(bytes32 secretHash) external view returns (uint48) {
        return _claims[secretHash].expiry;
    }

    function claimStatus(bytes32 secretHash)
        external
        view
        returns (bool exists, bool claimed, bool refunded)
    {
        Claim storage c = _claims[secretHash];
        return (c.from != address(0), c.claimed, c.refunded);
    }

    /// @notice The encrypted amount handle booked for a link (viewer-gated to decrypt).
    function claimAmount(bytes32 secretHash) external view returns (euint256) {
        return _claims[secretHash].amount;
    }
}
