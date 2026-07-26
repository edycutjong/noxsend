const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

// Unit tests for SendLinkEscrow — the novel claim-link escrow.
//
// The confidential token + TEE proof validation cannot run on a bare Hardhat node, so we inject a
// stateless MockNoxCompute at the address the Nox library hardcodes for chainid 31337 (via
// hardhat_setCode) and pass a MockERC7984 as the cUSD token. This exercises the escrow's on-chain
// ORCHESTRATION (state machine, guards, events, fund flow) in-process; the actual confidential math
// is proven by the live `npm run e2e` on Sepolia. See contracts/mocks/*.
const NOX_COMPUTE_ADDR = "0x75C6AF4430cc474b1bb9b8540b7E46D6f8e1C685";

// The euint256 handle's raw bytes32 doubles as its plaintext value in the mock token.
const AMOUNT = 100_000000n; // 100 dUSD (6 decimals)
const ENC_AMOUNT = ethers.zeroPadValue(ethers.toBeHex(AMOUNT), 32); // externalEuint256, bytes32
const INPUT_PROOF = "0x"; // mock ignores; real proof is gateway-signed

async function installMockNox() {
  const mock = await (await ethers.getContractFactory("MockNoxCompute")).deploy();
  await mock.waitForDeployment();
  const code = await ethers.provider.getCode(await mock.getAddress());
  await ethers.provider.send("hardhat_setCode", [NOX_COMPUTE_ADDR, code]);
}

async function futureExpiry(secs = 3600) {
  return BigInt(await time.latest()) + BigInt(secs);
}

describe("SendLinkEscrow", function () {
  let escrow, token, escrowAddr, tokenAddr;
  let sender, recipient, stranger;

  const secret = ethers.encodeBytes32String("secret-link-1");
  const secretHash = ethers.keccak256(secret); // == keccak256(abi.encodePacked(bytes32 secret))
  const unknownHash = ethers.keccak256(ethers.encodeBytes32String("never-created"));

  beforeEach(async function () {
    [, sender, recipient, stranger] = await ethers.getSigners();
    await installMockNox();

    token = await (await ethers.getContractFactory("MockERC7984")).deploy();
    await token.waitForDeployment();
    tokenAddr = await token.getAddress();

    escrow = await (await ethers.getContractFactory("SendLinkEscrow")).deploy(tokenAddr);
    await escrow.waitForDeployment();
    escrowAddr = await escrow.getAddress();

    await token.mintRaw(sender.address, AMOUNT * 10n); // fund the sender for operator-pull
  });

  async function createLink() {
    const expiry = await futureExpiry();
    await escrow.connect(sender).createLink(secretHash, expiry, ENC_AMOUNT, INPUT_PROOF);
    return expiry;
  }

  it("exposes the immutable cUSD token", async function () {
    expect(await escrow.cUSD()).to.equal(tokenAddr);
  });

  // ---------------- createLink ----------------

  it("createLink books the link, pulls funds via operator-pull, and emits LinkCreated", async function () {
    const expiry = await futureExpiry();
    await expect(escrow.connect(sender).createLink(secretHash, expiry, ENC_AMOUNT, INPUT_PROOF))
      .to.emit(escrow, "LinkCreated")
      .withArgs(secretHash, sender.address, expiry);

    expect(await escrow.claimFrom(secretHash)).to.equal(sender.address);
    expect(await escrow.claimExpiry(secretHash)).to.equal(expiry);
    expect(await escrow.claimAmount(secretHash)).to.equal(ENC_AMOUNT);

    const [exists, claimed, refunded] = await escrow.claimStatus(secretHash);
    expect(exists).to.equal(true);
    expect(claimed).to.equal(false);
    expect(refunded).to.equal(false);

    // Funds pulled from the sender into the escrow.
    expect(await token.balanceOfRaw(escrowAddr)).to.equal(AMOUNT);
    expect(await token.balanceOfRaw(sender.address)).to.equal(AMOUNT * 9n);
    expect(await token.lastFrom()).to.equal(sender.address);
    expect(await token.lastTo()).to.equal(escrowAddr);
    expect(await token.lastAmountRaw()).to.equal(AMOUNT);
  });

  it("createLink reverts when the link already exists (ClaimAlreadyExists)", async function () {
    await createLink();
    await expect(
      escrow.connect(sender).createLink(secretHash, await futureExpiry(), ENC_AMOUNT, INPUT_PROOF)
    )
      .to.be.revertedWithCustomError(escrow, "ClaimAlreadyExists")
      .withArgs(secretHash);
  });

  // ---------------- claim ----------------

  it("claim redeems the encrypted amount to the recipient and emits LinkClaimed", async function () {
    await createLink();

    // Anyone holding the secret can redeem — here a third party triggers it for the recipient.
    await expect(escrow.connect(stranger).claim(secret, recipient.address))
      .to.emit(escrow, "LinkClaimed")
      .withArgs(secretHash, recipient.address);

    const [, claimed, refunded] = await escrow.claimStatus(secretHash);
    expect(claimed).to.equal(true);
    expect(refunded).to.equal(false);

    expect(await token.balanceOfRaw(recipient.address)).to.equal(AMOUNT);
    expect(await token.balanceOfRaw(escrowAddr)).to.equal(0n);
  });

  it("claim reverts for an unknown secret (NoSuchClaim)", async function () {
    await expect(escrow.claim(secret, recipient.address))
      .to.be.revertedWithCustomError(escrow, "NoSuchClaim")
      .withArgs(secretHash);
  });

  it("claim reverts on double-claim (AlreadySettled)", async function () {
    await createLink();
    await escrow.claim(secret, recipient.address);
    await expect(escrow.claim(secret, recipient.address))
      .to.be.revertedWithCustomError(escrow, "AlreadySettled")
      .withArgs(secretHash);
  });

  it("claim reverts after a reclaim settled the link (AlreadySettled)", async function () {
    const expiry = await createLink();
    await time.increaseTo(Number(expiry) + 1);
    await escrow.connect(sender).reclaim(secretHash);
    await expect(escrow.claim(secret, recipient.address))
      .to.be.revertedWithCustomError(escrow, "AlreadySettled")
      .withArgs(secretHash);
  });

  it("claim reverts after expiry (LinkExpired)", async function () {
    const expiry = await createLink();
    await time.increaseTo(Number(expiry) + 1);
    await expect(escrow.claim(secret, recipient.address))
      .to.be.revertedWithCustomError(escrow, "LinkExpired")
      .withArgs(secretHash);
  });

  // ---------------- reclaim ----------------

  it("reclaim refunds the original sender after expiry and emits LinkReclaimed", async function () {
    const expiry = await createLink();
    expect(await token.balanceOfRaw(sender.address)).to.equal(AMOUNT * 9n);

    await time.increaseTo(Number(expiry) + 1);
    await expect(escrow.connect(sender).reclaim(secretHash))
      .to.emit(escrow, "LinkReclaimed")
      .withArgs(secretHash, sender.address);

    const [, claimed, refunded] = await escrow.claimStatus(secretHash);
    expect(claimed).to.equal(false);
    expect(refunded).to.equal(true);

    // Sender made whole; escrow drained.
    expect(await token.balanceOfRaw(sender.address)).to.equal(AMOUNT * 10n);
    expect(await token.balanceOfRaw(escrowAddr)).to.equal(0n);
  });

  it("reclaim reverts for an unknown link (NoSuchClaim)", async function () {
    await expect(escrow.connect(sender).reclaim(unknownHash))
      .to.be.revertedWithCustomError(escrow, "NoSuchClaim")
      .withArgs(unknownHash);
  });

  it("reclaim reverts before expiry (LinkNotYetExpired)", async function () {
    await createLink();
    await expect(escrow.connect(sender).reclaim(secretHash))
      .to.be.revertedWithCustomError(escrow, "LinkNotYetExpired")
      .withArgs(secretHash);
  });

  it("reclaim reverts when caller is not the original sender (NotOriginalSender)", async function () {
    const expiry = await createLink();
    await time.increaseTo(Number(expiry) + 1);
    await expect(escrow.connect(stranger).reclaim(secretHash))
      .to.be.revertedWithCustomError(escrow, "NotOriginalSender")
      .withArgs(stranger.address);
  });

  it("reclaim reverts on double-reclaim (AlreadySettled)", async function () {
    const expiry = await createLink();
    await time.increaseTo(Number(expiry) + 1);
    await escrow.connect(sender).reclaim(secretHash);
    await expect(escrow.connect(sender).reclaim(secretHash))
      .to.be.revertedWithCustomError(escrow, "AlreadySettled")
      .withArgs(secretHash);
  });

  it("reclaim reverts after the link was already claimed (AlreadySettled)", async function () {
    await createLink();
    await escrow.claim(secret, recipient.address);
    await expect(escrow.connect(sender).reclaim(secretHash))
      .to.be.revertedWithCustomError(escrow, "AlreadySettled")
      .withArgs(secretHash);
  });

  // ---------------- views ----------------

  it("view getters return zero/false for an unknown link", async function () {
    expect(await escrow.claimFrom(unknownHash)).to.equal(ethers.ZeroAddress);
    expect(await escrow.claimExpiry(unknownHash)).to.equal(0);
    expect(await escrow.claimAmount(unknownHash)).to.equal(ethers.ZeroHash);
    const [exists, claimed, refunded] = await escrow.claimStatus(unknownHash);
    expect(exists).to.equal(false);
    expect(claimed).to.equal(false);
    expect(refunded).to.equal(false);
  });
});
