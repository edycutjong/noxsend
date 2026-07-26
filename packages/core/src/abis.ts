// Minimal human-readable ABIs for the NoxSend contracts + the Nox protocol ACL surface.
// Encrypted types (euint256 / externalEuint256 / ebool) are bytes32 on the wire.

export const CONFIDENTIAL_USD_ABI = [
  // metadata
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function underlying() view returns (address)',
  // confidential balance
  'function confidentialBalanceOf(address account) view returns (bytes32)',
  'function confidentialTotalSupply() view returns (bytes32)',
  // wrap / unwrap
  'function wrap(address to, uint256 amount) returns (bytes32)',
  'function unwrap(address from, address to, bytes32 amount) returns (bytes32)',
  'function unwrap(address from, address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)',
  'function finalizeUnwrap(bytes32 unwrapRequestId, bytes decryptedAmountAndProof)',
  // transfers
  'function confidentialTransfer(address to, bytes32 encryptedAmount, bytes inputProof) returns (bytes32)',
  'function confidentialTransfer(address to, bytes32 amount) returns (bytes32)',
  'function confidentialTransferAndCall(address to, bytes32 encryptedAmount, bytes inputProof, bytes data) returns (bytes32)',
  // operators (used only by the opt-in standing-order tier)
  'function setOperator(address operator, uint48 until)',
  'function isOperator(address holder, address spender) view returns (bool)',
  // events
  'event ConfidentialTransfer(address indexed from, address indexed to, bytes32 indexed amount)',
  'event UnwrapRequested(address indexed to, bytes32 unwrapAmount)',
  'event UnwrapFinalized(address indexed to, bytes32 indexed unwrapRequestId, uint256 amount)',
] as const;

export const SEND_LINK_ESCROW_ABI = [
  'function cUSD() view returns (address)',
  'function createLink(bytes32 secretHash, uint48 expiry, bytes32 encAmount, bytes inputProof)',
  'function claim(bytes32 secret, address to)',
  'function reclaim(bytes32 secretHash)',
  'function claimFrom(bytes32 secretHash) view returns (address)',
  'function claimExpiry(bytes32 secretHash) view returns (uint48)',
  'function claimStatus(bytes32 secretHash) view returns (bool exists, bool claimed, bool refunded)',
  'function claimAmount(bytes32 secretHash) view returns (bytes32)',
  'event LinkCreated(bytes32 indexed secretHash, address indexed from, uint48 expiry)',
  'event LinkClaimed(bytes32 indexed secretHash, address indexed to)',
  'event LinkReclaimed(bytes32 indexed secretHash, address indexed to)',
] as const;

export const DEMO_USD_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function faucet()',
  'function mint(address to, uint256 amount)',
  'function FAUCET_AMOUNT() view returns (uint256)',
] as const;

// The NoxCompute protocol contract: ACL reads/writes used by the /verify inspector + auditor grant.
export const NOX_PROTOCOL_ABI = [
  'function isViewer(bytes32 handle, address viewer) view returns (bool)',
  'function isAllowed(bytes32 handle, address account) view returns (bool)',
  'function isPubliclyDecryptable(bytes32 handle) view returns (bool)',
  'function addViewer(bytes32 handle, address viewer)',
  'function allow(bytes32 handle, address account)',
  'function allowPublicDecryption(bytes32 handle)',
  'event ViewerAdded(address indexed granter, address indexed viewer, bytes32 indexed handle)',
  'event Allowed(address indexed granter, address indexed account, bytes32 indexed handle)',
] as const;
