import { fromDataSuffix } from '@celo/attribution-tags';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createPublicClient, erc721Abi, http } from 'viem';
import { celo } from 'viem/chains';

const RPC_URL = process.env.CELO_RPC_URL || 'https://forno.celo.org';
const client = createPublicClient({ chain: celo, transport: http(RPC_URL) });

const manifest = JSON.parse(
  readFileSync(resolve(import.meta.dirname, '..', 'public', 'agent.json'), 'utf8'),
);

const { agentWallet, erc8004Registry, erc8004AgentId, attributionTag, verifiedTransactions } =
  manifest.celo;

async function main() {
  console.log(`Verifying CorridorKey proofs against Celo Mainnet (${RPC_URL})\n`);

  const [blockNumber, owner] = await Promise.all([
    client.getBlockNumber(),
    client.readContract({
      address: erc8004Registry,
      abi: erc721Abi,
      functionName: 'ownerOf',
      args: [BigInt(erc8004AgentId)],
    }),
  ]);

  if (owner.toLowerCase() !== agentWallet.toLowerCase()) {
    throw new Error(`ERC-8004 #${erc8004AgentId} owner mismatch: got ${owner}`);
  }
  console.log(
    `[OK] Celo Mainnet block #${blockNumber} · ERC-8004 Agent #${erc8004AgentId} owned by ${owner}`,
  );

  const entries = Object.entries(verifiedTransactions);
  let taggedCount = 0;

  for (const [label, hash] of entries) {
    const [receipt, tx] = await Promise.all([
      client.getTransactionReceipt({ hash }),
      client.getTransaction({ hash }),
    ]);

    if (receipt.status !== 'success') {
      throw new Error(`Tx ${label} (${hash}) reverted!`);
    }

    const decoded = fromDataSuffix(tx.input);
    const hasTag = Boolean(decoded?.codes?.includes(attributionTag));
    if (hasTag) taggedCount += 1;

    console.log(
      `[OK] ${label.padEnd(22)} block=${receipt.blockNumber} status=${receipt.status} erc8021=${hasTag ? attributionTag : 'n/a'} tx=${hash}`,
    );
  }

  console.log(
    `\nVerified ${entries.length}/${entries.length} Celo Mainnet transactions (${taggedCount} carrying ERC-8021 tag ${attributionTag}).`,
  );
}

main().catch((err) => {
  console.error('Verification failed:', err.message);
  process.exit(1);
});
