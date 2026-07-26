// solidity-coverage config.
// Skip test-only mocks (they stand in for the Nox TEE precompile and confidential token so the
// escrow's on-chain logic can run in-process) and vendored Nox/OpenZeppelin libraries. Coverage
// therefore reflects ONLY the project's own novel contracts in contracts/.
module.exports = {
  skipFiles: ["mocks"],
};
