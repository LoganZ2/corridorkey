import { toDataSuffix } from '@celo/attribution-tags';
import { encodeFunctionData, erc20Abi, getAddress, isAddress, parseUnits } from 'viem';
import textileSnapshot from '../data/textileSnapshot.json';
import type {
  CorridorConfig,
  CorridorId,
  CorridorQuote,
  PolicyCheckResult,
  SessionPolicyConfig,
} from '../types';

export const LOOPS_ATTRIBUTION_TAG = 'celo_4217c9fa0403';
export const CELO_CHAIN_ID = 42220;

export const CELO_CONTRACTS = {
  USDT: '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e' as `0x${string}`,
  USDC: '0xcebA9300f2b948710d2653dD7B07f33A8B32118C' as `0x${string}`,
  TEXTILE_REACTOR: '0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3' as `0x${string}`,
  ALTANA_KEYSTORE: '0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c' as `0x${string}`,
  ERC8004_REGISTRY: '0x8004A169FB4a3325136EB29fA0ceB6D2e539a432' as `0x${string}`,
  X402_TREASURY: '0xd465892607f121ce3224fbb9D138A6bf3A219A20' as `0x${string}`,
};

export const CORRIDORS: CorridorConfig[] = [
  {
    id: 'USDT_cNGN',
    code: 'cNGN',
    currencyName: 'Nigerian Naira',
    city: 'Lagos',
    country: 'Nigeria',
    buyToken: '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f',
    decimals: 6,
    tickerId: 'USDT_NGN',
    sampleContractor: 'Chinedu Okafor',
    sampleRole: 'Smart Contract QA Contributor',
    // Official Celo Public Goods (celopg.eth) independent external recipient
    sampleRecipient: '0x017FF2643E1A6d500A54e2c15f8186C87795CbBe',
  },
  {
    id: 'USDT_wBRL',
    code: 'wBRL',
    currencyName: 'Brazilian Real',
    city: 'São Paulo',
    country: 'Brazil',
    buyToken: '0xD76f5Faf6888e24D9F04Bf92a0c8B921FE4390e0',
    decimals: 18,
    tickerId: 'USDT_WBRL',
    sampleContractor: 'Camila Ferreira',
    sampleRole: 'Frontend Design Systems Contractor',
    sampleRecipient: '0x017FF2643E1A6d500A54e2c15f8186C87795CbBe',
  },
  {
    id: 'USDT_wARS',
    code: 'wARS',
    currencyName: 'Argentine Peso',
    city: 'Buenos Aires',
    country: 'Argentina',
    buyToken: '0x0DC4F92879B7670e5f4e4e6e3c801D229129D90D',
    decimals: 18,
    tickerId: 'USDT_WARS',
    sampleContractor: 'Mateo Álvarez',
    sampleRole: 'Protocol Indexing Engineer',
    sampleRecipient: '0x017FF2643E1A6d500A54e2c15f8186C87795CbBe',
  },
  {
    id: 'USDT_wCOP',
    code: 'wCOP',
    currencyName: 'Colombian Peso',
    city: 'Bogotá',
    country: 'Colombia',
    buyToken: '0x8a1D45e102e886510e891d2Ec656a708991e2D76',
    decimals: 18,
    tickerId: 'USDT_COP',
    sampleContractor: 'Valeria Rojas',
    sampleRole: 'Technical Documentation Writer',
    sampleRecipient: '0x017FF2643E1A6d500A54e2c15f8186C87795CbBe',
  },
  {
    id: 'USDT_IDRX',
    code: 'IDRX',
    currencyName: 'Indonesian Rupiah',
    city: 'Jakarta',
    country: 'Indonesia',
    buyToken: '0x18Bc5bcC660cf2B9cE3cd51a404aFe1a0cBD3C22',
    decimals: 2,
    tickerId: 'USDT_IDR',
    sampleContractor: 'Raka Pratama',
    sampleRole: 'DevOps & RPC Reliability Engineer',
    sampleRecipient: '0x017FF2643E1A6d500A54e2c15f8186C87795CbBe',
  },
];

interface RawPreview {
  status?: string;
  sellAmount?: string;
  buyAmount?: string;
  feeAmount?: string;
  availableSellAmount?: string;
}

interface RawTicker {
  ticker_id: string;
  last_price: string;
  bid: string;
  ask: string;
}

export function buildCorridorQuote(
  corridorId: CorridorId,
  sellAmountUsdt: number,
): CorridorQuote {
  const corridor = CORRIDORS.find((c) => c.id === corridorId) ?? CORRIDORS[0];
  const previews = textileSnapshot.previews as Record<string, RawPreview>;
  const tickers = textileSnapshot.tickers as RawTicker[];

  const prev = previews[corridor.id];
  const ticker = tickers.find((t) => t.ticker_id === corridor.tickerId);

  const previewBuyRaw = prev?.buyAmount ? Number(prev.buyAmount) : 0;
  const previewRate =
    previewBuyRaw > 0
      ? previewBuyRaw / 10 ** corridor.decimals
      : Number(ticker?.last_price ?? 1);

  const safeSell = Math.max(0.01, Number(sellAmountUsdt) || 0.01);
  const feeBps = prev?.feeAmount ? (Number(prev.feeAmount) / 1_000_000) * 10_000 : 2.0;
  const feeUsdt = (safeSell * feeBps) / 10_000;
  const buyAmountLocal = safeSell * previewRate;
  const availableDepthUsdt = prev?.availableSellAmount
    ? Number(prev.availableSellAmount) / 1_000_000
    : 5000;

  const bid = Number(ticker?.bid ?? 0);
  const ask = Number(ticker?.ask ?? 0);
  const spreadBps =
    bid > 0 && ask > bid ? ((ask - bid) / ((ask + bid) / 2)) * 10_000 : 5.5;

  return {
    corridor,
    sellAmountUsdt: safeSell,
    ratePerUsdt: previewRate,
    buyAmountLocal,
    feeUsdt,
    availableDepthUsdt,
    spreadBps,
    source: 'TEXTILE_LIVE_SNAPSHOT',
  };
}

export function getAttributionSuffixHex(tag = LOOPS_ATTRIBUTION_TAG): `0x${string}` {
  return toDataSuffix(tag) as `0x${string}`;
}

export function buildTaggedTransferCalldata(
  recipient: `0x${string}`,
  amountRaw: bigint,
  tag = LOOPS_ATTRIBUTION_TAG,
): `0x${string}` {
  const safeRecipient = isAddress(recipient.toLowerCase())
    ? getAddress(recipient.toLowerCase())
    : ('0x000000000000000000000000000000000000dEaD' as `0x${string}`);
  const baseData = encodeFunctionData({
    abi: erc20Abi,
    functionName: 'transfer',
    args: [safeRecipient, amountRaw],
  });
  const suffix = getAttributionSuffixHex(tag).slice(2);
  return `${baseData}${suffix}` as `0x${string}`;
}

export function evaluateSessionPolicy(params: {
  policy: SessionPolicyConfig;
  targetContract: `0x${string}`;
  recipient: `0x${string}`;
  amountUsdt: number;
  nowUnix?: number;
}): PolicyCheckResult {
  const { policy, targetContract, recipient, amountUsdt } = params;
  const nowUnix = params.nowUnix ?? Math.floor(Date.now() / 1000);
  const normalizedTarget = targetContract.toLowerCase();
  const isTargetAllowed = policy.allowedTargets.some(
    (t) => t.address.toLowerCase() === normalizedTarget,
  );
  const isWithinCap = policy.spentTodayUsdt + amountUsdt <= policy.dailySpendCapUsdt + 1e-9;
  const isNotExpired = nowUnix < policy.expiryUnix;
  const isNotRevoked = !policy.revoked;

  const rawUsdt = parseUnits(Math.max(0.0001, amountUsdt).toFixed(6), 6);
  const encodedCalldataPreview = buildTaggedTransferCalldata(recipient, rawUsdt);

  const checks = [
    {
      name: 'Altana KeyStore Active (Not Revoked)',
      passed: isNotRevoked,
      detail: isNotRevoked
        ? `Session ${policy.sessionKeyAddress.slice(0, 10)}… active in KeyStore 0x83b3…d27c`
        : 'REVERT: Session key revoked via revokeSession() on Celo KeyStore — agent halted.',
    },
    {
      name: 'On-Chain Contract Allowlist',
      passed: isTargetAllowed,
      detail: isTargetAllowed
        ? `Target ${targetContract.slice(0, 10)}… matches scoped contract allowlist.`
        : `REVERT: Target ${targetContract.slice(0, 10)}… is NOT in session allowlist (CallNotPermitted).`,
    },
    {
      name: 'Daily USD₮ Spend Cap',
      passed: isWithinCap,
      detail: isWithinCap
        ? `$${(policy.spentTodayUsdt + amountUsdt).toFixed(2)} / $${policy.dailySpendCapUsdt.toFixed(2)} USD₮ daily budget.`
        : `REVERT: $${(policy.spentTodayUsdt + amountUsdt).toFixed(2)} exceeds $${policy.dailySpendCapUsdt.toFixed(2)} daily cap (SpendLimitExceeded).`,
    },
    {
      name: 'Session Expiry Window',
      passed: isNotExpired,
      detail: isNotExpired
        ? `Valid until ${new Date(policy.expiryUnix * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC.`
        : 'REVERT: Session expiry timestamp elapsed (SessionExpired).',
    },
  ];

  if (!isNotRevoked) {
    return {
      verdict: 'BLOCKED_REVOKED',
      allowed: false,
      errorCode: 'ALTANA_SESSION_REVOKED',
      summary: 'Agent execution stopped on-chain: session key was revoked in Altana KeyStore.',
      attributionTag: LOOPS_ATTRIBUTION_TAG,
      encodedCalldataPreview,
      checks,
    };
  }
  if (!isNotExpired) {
    return {
      verdict: 'BLOCKED_EXPIRED',
      allowed: false,
      errorCode: 'ALTANA_SESSION_EXPIRED',
      summary: 'Agent execution stopped on-chain: session expiry window has elapsed.',
      attributionTag: LOOPS_ATTRIBUTION_TAG,
      encodedCalldataPreview,
      checks,
    };
  }
  if (!isTargetAllowed) {
    return {
      verdict: 'BLOCKED_ALLOWLIST',
      allowed: false,
      errorCode: 'ALTANA_CALL_NOT_PERMITTED',
      summary: 'Agent execution blocked: target contract is outside the granted session allowlist.',
      attributionTag: LOOPS_ATTRIBUTION_TAG,
      encodedCalldataPreview,
      checks,
    };
  }
  if (!isWithinCap) {
    return {
      verdict: 'BLOCKED_SPEND_CAP',
      allowed: false,
      errorCode: 'ALTANA_SPEND_LIMIT_EXCEEDED',
      summary: 'Agent execution blocked: cumulative USD₮ spend would breach the daily cap.',
      attributionTag: LOOPS_ATTRIBUTION_TAG,
      encodedCalldataPreview,
      checks,
    };
  }

  return {
    verdict: 'PERMITTED',
    allowed: true,
    summary: `All 4 Altana KeyStore gates passed. Ready for tagged Textile FX settlement (${LOOPS_ATTRIBUTION_TAG}).`,
    attributionTag: LOOPS_ATTRIBUTION_TAG,
    encodedCalldataPreview,
    checks,
  };
}

export function buildX402ReceiptSpec(corridorId: CorridorId, amountUsdt: number) {
  const quote = buildCorridorQuote(corridorId, amountUsdt);
  return {
    facilitatorUrl: 'https://api.x402.celo.org',
    treasury: CELO_CONTRACTS.X402_TREASURY,
    httpStatus: 402,
    paymentRequirements: {
      scheme: 'exact',
      network: 'eip155:42220',
      maxAmountRequired: '10000', // 0.01 USDT per verified FX compliance receipt
      asset: CELO_CONTRACTS.USDT,
      payTo: '0x04801c703843Bf51a112Fa4dC8A7B2Bb4d0D1176',
      resource: `/api/x402/fx-receipt?corridor=${corridorId}&amount=${amountUsdt}`,
      description: `Signed Textile FX & ERC-8021 payroll compliance receipt (${quote.corridor.code})`,
      extra: {
        name: 'Tether USD',
        version: '1',
        assetTransferMethod: 'eip3009',
      },
    },
    quoteSnapshot: {
      corridor: corridorId,
      ratePerUsdt: Number(quote.ratePerUsdt.toFixed(4)),
      estimatedLocalPayout: `${quote.buyAmountLocal.toFixed(2)} ${quote.corridor.code}`,
      attributionTag: LOOPS_ATTRIBUTION_TAG,
    },
  };
}
