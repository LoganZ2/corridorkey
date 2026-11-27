import { fromDataSuffix } from '@celo/attribution-tags';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isAddress } from 'viem';
import { describe, expect, it } from 'vitest';
import mainnetProofs from '../src/data/mainnetProofs.json';
import {
  buildCorridorQuote,
  buildTaggedTransferCalldata,
  buildX402ReceiptSpec,
  CELO_CONTRACTS,
  CORRIDORS,
  evaluateSessionPolicy,
  getAttributionSuffixHex,
  LOOPS_ATTRIBUTION_TAG,
} from '../src/engine/corridorEngine';
import type { SessionPolicyConfig } from '../src/types';

const basePolicy: SessionPolicyConfig = {
  sessionKeyAddress: '0x7a9E2f184B09cF32e41B69d4C33a89E2b9104c1A',
  dailySpendCapUsdt: 5.0,
  spentTodayUsdt: 0.0,
  expiryUnix: 1900000000,
  revoked: false,
  allowedTargets: [
    { label: 'Textile LimitOrderReactor', address: CELO_CONTRACTS.TEXTILE_REACTOR },
    { label: 'Celo USDT', address: CELO_CONTRACTS.USDT },
  ],
};

describe('CorridorKey ERC-8021 Attribution & Textile FX Engine', () => {
  it('encodes and decodes official Loops House ERC-8021 tag celo_4217c9fa0403 cleanly', () => {
    const suffix = getAttributionSuffixHex();
    const decoded = fromDataSuffix(suffix);
    expect(decoded).not.toBeNull();
    expect(decoded?.codes).toContain(LOOPS_ATTRIBUTION_TAG);
  });

  it('appends ERC-8021 attribution suffix cleanly onto ERC-20 transfer calldata', () => {
    const calldata = buildTaggedTransferCalldata(
      '0x62B98f4a22325120585118543f91bB707784C520',
      1_500_000n,
    );
    expect(calldata.startsWith('0xa9059cbb')).toBe(true); // ERC-20 transfer selector
    const decoded = fromDataSuffix(calldata);
    expect(decoded?.codes).toContain('celo_4217c9fa0403');
  });

  it('produces live Textile FX quotes across all 5 active Celo Mainnet corridors', () => {
    expect(CORRIDORS).toHaveLength(5);
    for (const c of CORRIDORS) {
      const q = buildCorridorQuote(c.id, 10);
      expect(q.ratePerUsdt).toBeGreaterThan(1);
      expect(q.buyAmountLocal).toBeCloseTo(10 * q.ratePerUsdt, 4);
      expect(q.availableDepthUsdt).toBeGreaterThan(0);
    }
  });

  it('builds a valid Celo x402 HTTP 402 payment specification for FX receipts', () => {
    const spec = buildX402ReceiptSpec('USDT_cNGN', 2.0);
    expect(spec.httpStatus).toBe(402);
    expect(spec.paymentRequirements.network).toBe('eip155:42220');
    expect(spec.paymentRequirements.asset).toBe(CELO_CONTRACTS.USDT);
    expect(spec.quoteSnapshot.attributionTag).toBe('celo_4217c9fa0403');
  });
});

describe('CorridorKey Altana Smart Wallet Session Policy Engine', () => {
  it('PERMITS an in-policy Textile FX payroll transaction within spend cap & allowlist', () => {
    const res = evaluateSessionPolicy({
      policy: basePolicy,
      targetContract: CELO_CONTRACTS.TEXTILE_REACTOR,
      recipient: CORRIDORS[0].sampleRecipient,
      amountUsdt: 1.5,
      nowUnix: 1800000000,
    });
    expect(res.allowed).toBe(true);
    expect(res.verdict).toBe('PERMITTED');
    expect(res.checks.every((c) => c.passed)).toBe(true);
  });

  it('BLOCKS execution when cumulative USD₮ spend breaches the daily session cap', () => {
    const res = evaluateSessionPolicy({
      policy: { ...basePolicy, spentTodayUsdt: 4.0 },
      targetContract: CELO_CONTRACTS.TEXTILE_REACTOR,
      recipient: CORRIDORS[0].sampleRecipient,
      amountUsdt: 2.0,
      nowUnix: 1800000000,
    });
    expect(res.allowed).toBe(false);
    expect(res.verdict).toBe('BLOCKED_SPEND_CAP');
    expect(res.errorCode).toBe('ALTANA_SPEND_LIMIT_EXCEEDED');
  });

  it('BLOCKS calls to any contract outside the Altana session allowlist', () => {
    const res = evaluateSessionPolicy({
      policy: basePolicy,
      targetContract: '0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF',
      recipient: CORRIDORS[0].sampleRecipient,
      amountUsdt: 1.0,
      nowUnix: 1800000000,
    });
    expect(res.allowed).toBe(false);
    expect(res.verdict).toBe('BLOCKED_ALLOWLIST');
    expect(res.errorCode).toBe('ALTANA_CALL_NOT_PERMITTED');
  });

  it('BLOCKS immediately after revokeSession() kill switch is triggered', () => {
    const res = evaluateSessionPolicy({
      policy: { ...basePolicy, revoked: true },
      targetContract: CELO_CONTRACTS.TEXTILE_REACTOR,
      recipient: CORRIDORS[0].sampleRecipient,
      amountUsdt: 0.5,
      nowUnix: 1800000000,
    });
    expect(res.allowed).toBe(false);
    expect(res.verdict).toBe('BLOCKED_REVOKED');
    expect(res.errorCode).toBe('ALTANA_SESSION_REVOKED');
  });

  it('BLOCKS execution once the session expiry timestamp has elapsed', () => {
    const res = evaluateSessionPolicy({
      policy: { ...basePolicy, expiryUnix: 1700000000 },
      targetContract: CELO_CONTRACTS.TEXTILE_REACTOR,
      recipient: CORRIDORS[0].sampleRecipient,
      amountUsdt: 0.5,
      nowUnix: 1800000000,
    });
    expect(res.allowed).toBe(false);
    expect(res.verdict).toBe('BLOCKED_EXPIRED');
    expect(res.errorCode).toBe('ALTANA_SESSION_EXPIRED');
  });

  it('prioritizes revocation kill-switch verdict even when spend cap is simultaneously breached', () => {
    const res = evaluateSessionPolicy({
      policy: { ...basePolicy, revoked: true, spentTodayUsdt: 4.9 },
      targetContract: CELO_CONTRACTS.TEXTILE_REACTOR,
      recipient: CORRIDORS[0].sampleRecipient,
      amountUsdt: 2.0,
      nowUnix: 1800000000,
    });
    expect(res.allowed).toBe(false);
    expect(res.verdict).toBe('BLOCKED_REVOKED');
    expect(res.errorCode).toBe('ALTANA_SESSION_REVOKED');
  });
});

describe('CorridorKey Mainnet Proof Bundle & ERC-8004 Manifest Integrity', () => {
  it('normalizes lowercase recipient addresses cleanly when encoding tagged ERC-20 transfer calldata', () => {
    const lowerRecipient = '0x017ff2643e1a6d500a54e2c15f8186c87795cbbe' as `0x${string}`;
    const calldata = buildTaggedTransferCalldata(lowerRecipient, 10_000n);
    expect(calldata.startsWith('0xa9059cbb')).toBe(true);
    expect(fromDataSuffix(calldata)?.codes).toContain(LOOPS_ATTRIBUTION_TAG);
  });

  it('generates valid Celo x402 payment requirements for every corridor', () => {
    for (const c of CORRIDORS) {
      const spec = buildX402ReceiptSpec(c.id, 1.0);
      expect(spec.httpStatus).toBe(402);
      expect(spec.paymentRequirements.network).toBe('eip155:42220');
      expect(spec.paymentRequirements.maxAmountRequired).toBe('10000');
      expect(spec.quoteSnapshot.estimatedLocalPayout).toContain(c.code);
    }
  });

  it('keeps public/agent.json ERC-8004 manifest synchronized with verified Celo Mainnet proofs', () => {
    const manifestPath = resolve(import.meta.dirname, '..', 'public', 'agent.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

    expect(manifest.type).toBe('https://eips.ethereum.org/EIPS/eip-8004#registration-v1');
    expect(manifest.celo.chainId).toBe(42220);
    expect(manifest.celo.erc8004AgentId).toBe(mainnetProofs.erc8004AgentId);
    expect(manifest.celo.agentWallet).toBe(mainnetProofs.agentWallet);
    expect(manifest.celo.attributionTag).toBe(LOOPS_ATTRIBUTION_TAG);
    expect(Object.keys(manifest.celo.verifiedTransactions)).toHaveLength(7);

    for (const txHash of Object.values(manifest.celo.verifiedTransactions) as string[]) {
      expect(txHash).toMatch(/^0x[a-f0-9]{64}$/);
    }
  });

  it('stores valid checksummed Celo contract addresses and confirmed hashes in mainnetProofs.json', () => {
    expect(isAddress(mainnetProofs.agentWallet)).toBe(true);
    expect(isAddress(mainnetProofs.altanaKeyStore)).toBe(true);
    expect(isAddress(mainnetProofs.erc8004Registry)).toBe(true);
    expect(isAddress(mainnetProofs.textileReactor)).toBe(true);
    expect(isAddress(mainnetProofs.externalRecipient)).toBe(true);
    expect(mainnetProofs.proofs).toHaveLength(5);
    for (const proof of mainnetProofs.proofs) {
      expect(proof.status).toBe('CONFIRMED');
      expect(proof.txHash).toMatch(/^0x[a-f0-9]{64}$/);
      expect(proof.attributionTagged).toBe(true);
    }
  });
});
