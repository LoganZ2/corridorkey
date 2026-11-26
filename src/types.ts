export type CorridorId = 'USDT_cNGN' | 'USDT_wBRL' | 'USDT_wARS' | 'USDT_wCOP' | 'USDT_IDRX';

export interface CorridorConfig {
  id: CorridorId;
  code: string;
  currencyName: string;
  city: string;
  country: string;
  buyToken: `0x${string}`;
  decimals: number;
  tickerId: string;
  sampleContractor: string;
  sampleRole: string;
  sampleRecipient: `0x${string}`;
}

export interface CorridorQuote {
  corridor: CorridorConfig;
  sellAmountUsdt: number;
  ratePerUsdt: number;
  buyAmountLocal: number;
  feeUsdt: number;
  availableDepthUsdt: number;
  spreadBps: number;
  source: 'TEXTILE_LIVE_SNAPSHOT' | 'TEXTILE_LIVE_API';
}

export interface SessionPolicyConfig {
  sessionKeyAddress: `0x${string}`;
  dailySpendCapUsdt: number;
  spentTodayUsdt: number;
  expiryUnix: number;
  revoked: boolean;
  allowedTargets: Array<{ label: string; address: `0x${string}` }>;
}

export type PolicyVerdict = 'PERMITTED' | 'BLOCKED_REVOKED' | 'BLOCKED_SPEND_CAP' | 'BLOCKED_ALLOWLIST' | 'BLOCKED_EXPIRED';

export interface PolicyCheckResult {
  verdict: PolicyVerdict;
  allowed: boolean;
  errorCode?: string;
  summary: string;
  attributionTag: string;
  encodedCalldataPreview: `0x${string}`;
  checks: Array<{
    name: string;
    passed: boolean;
    detail: string;
  }>;
}

export interface MainnetTxProof {
  step: string;
  track: 'ALTANA' | 'TEXTILE_FX' | 'ERC_8004' | 'X402';
  status: 'CONFIRMED' | 'READY_AWAITING_FAUCET';
  txHash?: `0x${string}`;
  explorerUrl?: string;
  attributionTagged: boolean;
  detail: string;
}

export interface CeloLiveStatus {
  connected: boolean;
  blockNumber: number;
  agentWallet: `0x${string}`;
  celoBalance: number;
  usdtBalance: number;
  hasKeyStoreCode: boolean;
  erc8004Balance: number;
  latencyMs: number;
}
