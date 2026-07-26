import { describe, it, expect } from 'vitest';
import { keccak256, getBytes } from 'ethers';
import {
  generateSecret, secretHash, buildClaimLink, parseClaimLink,
  encodeClaimData, decodeClaimData, expiryFromNow,
} from '../src/secret.js';

describe('generateSecret', () => {
  it('is a 32-byte hex string', () => expect(generateSecret()).toMatch(/^0x[0-9a-f]{64}$/));
  it('is unique across calls', () => expect(generateSecret()).not.toBe(generateSecret()));
});

describe('secretHash', () => {
  const secret = '0x' + '11'.repeat(32);
  it('matches keccak256(getBytes(secret)) — Solidity abi.encodePacked(bytes32)', () =>
    expect(secretHash(secret)).toBe(keccak256(getBytes(secret))));
  it('is deterministic', () => expect(secretHash(secret)).toBe(secretHash(secret)));
  it('differs for different secrets', () => expect(secretHash(secret)).not.toBe(secretHash('0x' + '22'.repeat(32))));
  it('rejects a non-32-byte input', () => expect(() => secretHash('0x1234')).toThrow());
});

describe('buildClaimLink / parseClaimLink', () => {
  const secret = '0x' + 'ab'.repeat(32);
  it('builds a /claim#secret url', () => expect(buildClaimLink('https://noxsend.app', secret)).toBe(`https://noxsend.app/claim#${secret}`));
  it('strips a trailing slash', () => expect(buildClaimLink('https://noxsend.app/', secret)).toBe(`https://noxsend.app/claim#${secret}`));
  it('strips an existing fragment', () => expect(buildClaimLink('https://noxsend.app#old', secret)).toBe(`https://noxsend.app/claim#${secret}`));
  it('rejects a bad secret', () => expect(() => buildClaimLink('https://x', '0x00')).toThrow());

  it('parses the secret back from a link', () => expect(parseClaimLink(buildClaimLink('https://noxsend.app', secret))).toBe(secret));
  it('parses a fragment without 0x prefix', () => expect(parseClaimLink('https://x/claim#' + 'cd'.repeat(32))).toBe('0x' + 'cd'.repeat(32)));
  it('lowercases the parsed secret', () => expect(parseClaimLink('https://x/claim#0x' + 'AB'.repeat(32))).toBe('0x' + 'ab'.repeat(32)));
  it('returns null when no fragment', () => expect(parseClaimLink('https://x/claim')).toBeNull());
  it('returns null on a malformed fragment', () => expect(parseClaimLink('https://x/claim#nope')).toBeNull());
});

describe('encodeClaimData / decodeClaimData', () => {
  const h = '0x' + 'cd'.repeat(32);
  it('roundtrips secretHash + expiry', () => {
    const encoded = encodeClaimData(h, 1893456000);
    expect(decodeClaimData(encoded)).toEqual({ secretHash: h, expiry: 1893456000 });
  });
  it('accepts bigint expiry', () => expect(decodeClaimData(encodeClaimData(h, 100n)).expiry).toBe(100));
  it('rejects negative expiry', () => expect(() => encodeClaimData(h, -1)).toThrow());
  it('rejects expiry beyond uint48', () => expect(() => encodeClaimData(h, 2 ** 48)).toThrow());
  it('rejects a bad secretHash', () => expect(() => encodeClaimData('0x00', 100)).toThrow());
});

describe('expiryFromNow', () => {
  const now = 1_700_000_000_000; // fixed ms
  it('adds 7 days by default', () => expect(expiryFromNow(7, now)).toBe(Math.floor(now / 1000) + 7 * 86400));
  it('adds a custom number of days', () => expect(expiryFromNow(1, now)).toBe(Math.floor(now / 1000) + 86400));
  it('supports fractional days', () => expect(expiryFromNow(0.5, now)).toBe(Math.floor(now / 1000) + 43200));
});
