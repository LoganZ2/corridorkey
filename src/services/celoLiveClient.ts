import { encodeFunctionData, erc20Abi, erc721Abi } from 'viem';
import { CELO_CONTRACTS } from '../engine/corridorEngine';
import type { CeloLiveStatus } from '../types';

export const CELO_PUBLIC_RPC = 'https://forno.celo.org';

async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(CELO_PUBLIC_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Celo RPC HTTP ${res.status}`);
  const json = (await res.json()) as { result?: T; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result as T;
}

export async function fetchCeloMainnetStatus(
  agentWallet: `0x${string}`,
): Promise<CeloLiveStatus> {
  const t0 = performance.now();
  try {
    const usdtData = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [agentWallet],
    });
    const erc8004Data = encodeFunctionData({
      abi: erc721Abi,
      functionName: 'balanceOf',
      args: [agentWallet],
    });

    const [blockHex, celoHex, usdtHex, walletCode, erc8004Hex] = await Promise.all([
      rpcCall<string>('eth_blockNumber', []),
      rpcCall<string>('eth_getBalance', [agentWallet, 'latest']),
      rpcCall<string>('eth_call', [{ to: CELO_CONTRACTS.USDT, data: usdtData }, 'latest']),
      rpcCall<string>('eth_getCode', [agentWallet, 'latest']),
      rpcCall<string>('eth_call', [{ to: CELO_CONTRACTS.ERC8004_REGISTRY, data: erc8004Data }, 'latest']),
    ]);

    return {
      connected: true,
      blockNumber: Number(BigInt(blockHex || '0x0')),
      agentWallet,
      celoBalance: Number(BigInt(celoHex || '0x0')) / 1e18,
      usdtBalance: Number(BigInt(usdtHex && usdtHex !== '0x' ? usdtHex : '0x0')) / 1e6,
      hasKeyStoreCode: Boolean(walletCode && walletCode.length > 2),
      erc8004Balance: Number(BigInt(erc8004Hex && erc8004Hex !== '0x' ? erc8004Hex : '0x0')),
      latencyMs: Math.round(performance.now() - t0),
    };
  } catch {
    return {
      connected: false,
      blockNumber: 0,
      agentWallet,
      celoBalance: 0,
      usdtBalance: 0,
      hasKeyStoreCode: false,
      erc8004Balance: 0,
      latencyMs: Math.round(performance.now() - t0),
    };
  }
}
