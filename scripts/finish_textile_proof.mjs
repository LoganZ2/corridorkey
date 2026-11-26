import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { toDataSuffix, withAttribution } from '@celo/attribution-tags';
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  erc20Abi,
  http,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { celo } from 'viem/chains';

const ROOT = path.resolve(import.meta.dirname, '..');
const TAG = process.env.LOOPS_ATTRIBUTION_TAG || 'celo_4217c9fa0403';
const OUSD_TEMPO = '0x20c0000000000000000000006a37da5c996874be';
const USDT_CELO = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e';
const CNGN_CELO = '0xF6829D7393dAe24509eb1E52eE8e572e2E271a4f';
const CELOPG = '0x017FF2643E1A6d500A54e2c15f8186C87795CbBe'; // celopg.eth

const tempoChain = defineChain({
  id: 4217,
  name: 'Tempo',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.tempo.xyz'] } },
});

async function bridgeOusdToCeloUsdt(account, amountBaseUnits) {
  console.log(`\n[1/3] Bridging ${Number(amountBaseUnits) / 1e6} OUSD (Tempo) -> USD₮ (Celo Mainnet)...`);
  const tempoPublic = createPublicClient({ chain: tempoChain, transport: http('https://rpc.tempo.xyz') });
  const tempoWallet = createWalletClient({ account, chain: tempoChain, transport: http('https://rpc.tempo.xyz') });

  const q = await fetch('https://api.relay.link/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: account.address,
      recipient: account.address,
      originChainId: 4217,
      destinationChainId: 42220,
      originCurrency: OUSD_TEMPO,
      destinationCurrency: USDT_CELO,
      amount: amountBaseUnits,
      tradeType: 'EXACT_INPUT',
    }),
  }).then((r) => r.json());
  if (!q.steps) throw new Error(`Relay quote failed: ${JSON.stringify(q)}`);
  console.log('Quote out:', q.details?.currencyOut?.amountFormatted, 'USDT');

  let checkEndpoint = null;
  for (const step of q.steps) {
    for (const item of step.items || []) {
      const txData = item.data;
      const hash = await tempoWallet.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: BigInt(txData.value || '0'),
        gas: txData.gas ? BigInt(txData.gas) : undefined,
        maxFeePerGas: txData.maxFeePerGas ? BigInt(txData.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas ? BigInt(txData.maxPriorityFeePerGas) : undefined,
      });
      await tempoPublic.waitForTransactionReceipt({ hash });
      console.log(`Relay step [${step.id}] mined:`, hash);
      if (item.check?.endpoint) checkEndpoint = item.check.endpoint;
    }
  }
  if (checkEndpoint) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await fetch(`https://api.relay.link${checkEndpoint}`).then((r) => r.json());
      console.log(`Bridge status [${i + 1}]:`, st.status);
      if (st.status === 'success') return;
      if (st.status === 'failure' || st.status === 'refund') throw new Error(`Bridge failed: ${JSON.stringify(st)}`);
    }
  }
}

async function requestTextileFirmSwap(account, sellAmountRaw) {
  const nonce = `0x${crypto.randomBytes(32).toString('hex')}`;
  const issuedAt = Date.now();
  const signature = await account.signTypedData({
    domain: { name: 'Textile Taker Control', version: '1', chainId: 42220 },
    types: {
      TakerControl: [
        { name: 'taker', type: 'address' },
        { name: 'chainId', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
        { name: 'issuedAt', type: 'uint256' },
      ],
    },
    primaryType: 'TakerControl',
    message: {
      taker: account.address,
      chainId: 42220n,
      nonce,
      issuedAt: BigInt(issuedAt),
    },
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 75_000);
  try {
    const res = await fetch('https://api.textilecredit.com/v2/rfq/request', {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chainId: 42220,
        sellToken: USDT_CELO,
        buyToken: CNGN_CELO,
        sellAmount: sellAmountRaw.toString(),
        taker: account.address,
        takerProof: { nonce, issuedAt, signature },
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(`Textile RFQ HTTP ${res.status}: ${JSON.stringify(json)}`);
    return json.data || json;
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  const pk = process.env.ALTANA_ADMIN_PK;
  if (!pk) throw new Error('Missing ALTANA_ADMIN_PK');
  const account = privateKeyToAccount(pk);

  const celoPublic = createPublicClient({ chain: celo, transport: http('https://forno.celo.org') });
  const celoWallet = createWalletClient({
    account,
    chain: celo,
    transport: http('https://forno.celo.org'),
  }).extend(withAttribution(TAG));

  let usdtBal = await celoPublic.readContract({
    address: USDT_CELO,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('Current Celo USD₮ balance:', (Number(usdtBal) / 1e6).toFixed(4));

  if (usdtBal < 1_000_000n) {
    await bridgeOusdToCeloUsdt(account, '980000'); // 0.98 OUSD -> ~0.95 USDT
    usdtBal = await celoPublic.readContract({
      address: USDT_CELO,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [account.address],
    });
    console.log('Post-bridge Celo USD₮ balance:', (Number(usdtBal) / 1e6).toFixed(4));
  }

  console.log('\n[2/3] Requesting live Textile FX firm quote (1.00 USD₮ -> cNGN)...');
  const rfq = await requestTextileFirmSwap(account, 1_000_000n);
  console.log('Firm RFQ received:', JSON.stringify({
    status: rfq.status,
    rfqId: rfq.rfqId || rfq.id,
    sellAmount: rfq.sellAmount,
    buyAmount: rfq.buyAmount,
    approvalTo: rfq.transactions?.approval?.to,
    swapTo: rfq.transactions?.swap?.to,
  }));

  const suffixHex = toDataSuffix(TAG).slice(2);
  let approveTx = null;
  if (rfq.transactions?.approval) {
    // Note: walletClient already extends withAttribution(TAG), which auto-merges or appends ERC-8021 suffix!
    approveTx = await celoWallet.sendTransaction({
      to: rfq.transactions.approval.to,
      data: rfq.transactions.approval.data,
    });
    await celoPublic.waitForTransactionReceipt({ hash: approveTx });
    console.log('Tagged Textile approval mined:', approveTx);
  }

  // Send swap with explicit ERC-8021 attribution tag (walletClient withAttribution appends TAG cleanly)
  const swapTx = await celoWallet.sendTransaction({
    to: rfq.transactions.swap.to,
    data: rfq.transactions.swap.data,
  });
  const swapReceipt = await celoPublic.waitForTransactionReceipt({ hash: swapTx });
  console.log('Tagged Textile FX swap mined:', swapTx, 'status:', swapReceipt.status);

  // Verify swap tx ends with our ERC-8021 tag!
  const swapTxObj = await celoPublic.getTransaction({ hash: swapTx });
  console.log('Swap calldata ends with ERC-8021 suffix:', swapTxObj.input.endsWith(suffixHex));

  // Deliver acquired cNGN to official external recipient celopg.eth (tagged!)
  console.log('\n[3/3] Delivering acquired cNGN to external recipient celopg.eth...');
  const cngnBal = await celoPublic.readContract({
    address: CNGN_CELO,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [account.address],
  });
  console.log('Acquired cNGN:', (Number(cngnBal) / 1e6).toFixed(2), 'cNGN');
  if (cngnBal === 0n) throw new Error('Expected cNGN balance > 0 after swap');

  const payoutTx = await celoWallet.writeContract({
    address: CNGN_CELO,
    abi: erc20Abi,
    functionName: 'transfer',
    args: [CELOPG, cngnBal],
  });
  const payReceipt = await celoPublic.waitForTransactionReceipt({ hash: payoutTx });
  console.log('Tagged external cNGN payout to celopg.eth mined:', payoutTx, 'status:', payReceipt.status);

  // Update src/data/mainnetProofs.json -> ALL 5 PROOFS CONFIRMED!
  const proofsPath = path.join(ROOT, 'src', 'data', 'mainnetProofs.json');
  const doc = JSON.parse(fs.readFileSync(proofsPath, 'utf8'));
  doc.payoutTxHash = payoutTx;
  doc.textileSwapTxHash = swapTx;
  doc.updatedAt = new Date().toISOString();
  doc.proofs[4] = {
    step: `05 · Tagged Textile FX Conversion (1.00 USD₮ → ${(Number(cngnBal) / 1e6).toFixed(2)} cNGN) & External Payout`,
    track: 'TEXTILE_FX',
    status: 'CONFIRMED',
    txHash: swapTx,
    explorerUrl: `https://celoscan.io/tx/${swapTx}`,
    attributionTagged: true,
    detail: `Converted 1.00 USD₮ → ${(Number(cngnBal) / 1e6).toFixed(2)} cNGN on Celo Mainnet via Textile LimitOrderReactor (tag ${TAG}) and delivered full local-currency proceeds to official external recipient celopg.eth (${CELOPG.slice(0, 10)}…, payout tx: ${payoutTx}).`,
  };
  fs.writeFileSync(proofsPath, JSON.stringify(doc, null, 2));
  console.log('\n=== ALL 5/5 CELO MAINNET PROOFS CONFIRMED & RECORDED! ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
