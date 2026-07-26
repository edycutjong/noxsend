const { expect } = require("chai");
const { ethers } = require("hardhat");

// Unit tests for ConfidentialUSD (cUSD) — the 1:1 confidential ERC-20 -> ERC-7984 wrapper.
//
// The wrap / unwrap / confidentialTransfer paths require the live Nox TEE and are proven by the
// live `npm run e2e` on Sepolia. The contract's own code, however, is entirely its constructor
// (everything else is inherited from the audited Nox `ERC20ToERC7984Wrapper`). The constructor only
// writes storage (name / symbol / contractURI / underlying) — no TEE calls — so it deploys and is
// asserted here in-process, covering the one function ConfidentialUSD actually defines.
describe("ConfidentialUSD", function () {
  let cusd, demo, demoAddr;

  beforeEach(async function () {
    demo = await (await ethers.getContractFactory("DemoUSD")).deploy();
    await demo.waitForDeployment();
    demoAddr = await demo.getAddress();

    cusd = await (await ethers.getContractFactory("ConfidentialUSD")).deploy(demoAddr);
    await cusd.waitForDeployment();
  });

  it("constructor wires the name/symbol", async function () {
    expect(await cusd.name()).to.equal("Confidential USD");
    expect(await cusd.symbol()).to.equal("cUSD");
  });

  it("holds the underlying ERC-20 it wraps 1:1", async function () {
    expect(await cusd.underlying()).to.equal(demoAddr);
  });

  it("mirrors the underlying's 6 decimals (USDC-compatible)", async function () {
    expect(await cusd.decimals()).to.equal(6);
    expect(await cusd.decimals()).to.equal(await demo.decimals());
  });
});
