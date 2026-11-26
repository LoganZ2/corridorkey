import { createPublicClient, createWalletClient, defineChain, http } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const OUSD = '0x20c0000000000000000000006a37da5c996874be';
const CELO_NATIVE = '0x0000000000000000000000000000000000000000';
const CELO_USDT = '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e';

const tempoChain = defineChain({
  id: 4217,
  name: 'Tempo',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.tempo.xyz'] } },
});

async function executeRelayLeg({ walletClient, publicClient, address, destCurrency, amountBaseUnits, label }) {
  console.log(`\n=== Bridging ${label} (${Number(amountBaseUnits) / 1e6} OUSD -> Celo) ===`);
  const quoteRes = await fetch('https://api.relay.link/quote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: address,
      recipient: address,
      originChainId: 4217,
      destinationChainId: 42220,
      originCurrency: OUSD,
      destinationCurrency: destCurrency,
      amount: amountBaseUnits,
      tradeType: 'EXACT_INPUT',
    }),
  });
  const quote = await quoteRes.json();
  if (!quoteRes.ok || !quote.steps) {
    throw new Error(`Relay quote failed: ${JSON.stringify(quote)}`);
  }
  console.log('Quote out:', quote.details?.currencyOut?.amountFormatted, quote.details?.currencyOut?.currency?.symbol);

  let checkEndpoint = null;
  for (const step of quote.steps) {
    for (const item of step.items || []) {
      const txData = item.data;
      console.log(`Sending step [${step.id}] to ${txData.to}...`);
      const hash = await walletClient.sendTransaction({
        to: txData.to,
        data: txData.data,
        value: BigInt(txData.value || '0'),
        gas: txData.gas ? BigInt(txData.gas) : undefined,
        maxFeePerGas: txData.maxFeePerGas ? BigInt(txData.maxFeePerGas) : undefined,
        maxPriorityFeePerGas: txData.maxPriorityFeePerGas ? BigInt(txData.maxPriorityFeePerGas) : undefined,
      });
      console.log(`Step [${step.id}] txHash:`, hash);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Step [${step.id}] mined status:`, receipt.status);
      if (item.check?.endpoint) checkEndpoint = item.check.endpoint;
    }
  }

  if (checkEndpoint) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const st = await fetch(`https://api.relay.link${checkEndpoint}`).then((r) => r.json());
      console.log(`Intent status [${i + 1}]:`, st.status, st.txHashes ? st.txHashes : '');
      if (st.status === 'success' || st.status === 'failure' || st.status === 'refund') {
        if (st.status !== 'success') throw new Error(`Relay intent failed: ${JSON.stringify(st)}`);
        return st;
      }
    }
  }
}

async function main() {
  const pk = process.env.ALTANA_ADMIN_PK;
  if (!pk) throw new Error('Missing ALTANA_ADMIN_PK');
  const account = privateKeyToAccount(pk);
  const publicClient = createPublicClient({ chain: tempoChain, transport: http('https://rpc.tempo.xyz') });
  const walletClient = createWalletClient({ account, chain: tempoChain, transport: http('https://rpc.tempo.xyz') });

  await executeRelayLeg({
    walletClient,
    publicClient,
    address: account.address,
    destCurrency: CELO_NATIVE,
    amountBaseUnits: '1700000',
    label: 'CELO',
  });

  await executeRelayLeg({
    walletClient,
    publicClient,
    address: account.address,
    destCurrency: CELO_USDT,
    amountBaseUnits: '250000',
    label: 'USDT',
  });

  // Verify Celo Mainnet arrival!
  const balData = '0x70a08231000000000000000000000000' + account.address.slice(2).toLowerCase();
  const [cNat, cUsdt] = await Promise.all([
    fetch('https://forno.celo.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [account.address, 'latest'] }),
    }).then((r) => r.json()),
    fetch('https://forno.celo.org', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_call', params: [{ to: CELO_USDT, data: balData }, 'latest'] }),
    }).then((r) => r.json()),
  ]);
  console.log('\n=== CELO MAINNET BALANCES AFTER BRIDGE ===');
  console.log('CELO:', (Number(BigInt(cNat.result || '0x0')) / 1e18).toFixed(4));
  console.log('USD₮:', (Number(BigInt(cUsdt.result && cUsdt.result !== '0x' ? cUsdt.result : '0x0')) / 1e6).toFixed(4));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
