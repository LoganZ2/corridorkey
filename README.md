# CorridorKey — Session-Keyed Stablecoin Payroll & FX Settlement on Celo Mainnet

**Built for Loops House — Agents Open for Business (Celo Mainnet)**
Entering **Stablecoin Corridors (Textile FX)** + **Altana Smart Agentic Wallets**.

- **Agent Smart Wallet (Celo Mainnet):** `0x04801c703843Bf51a112Fa4dC8A7B2Bb4d0D1176`
- **ERC-8021 Attribution Tag:** `celo_4217c9fa0403`
- **ERC-8004 Identity Registry (Celo Mainnet):** `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
- **Altana KeyStore (Celo Mainnet):** `0x83b30935f36d6ccf9B1ec3b5E47F2866b97cd27c`
- **Textile LimitOrderReactor (Celo Mainnet):** `0xa9AA0a64769cBed4d3B1Ceb4Df01CdE915C235b3`

## Problem & Named User
Solo software studios (e.g., ZKY Studio) pay global open-source contributors across Nigeria (`cNGN`), Brazil (`wBRL`), Argentina (`wARS`), Colombia (`wCOP`), and Indonesia (`IDRX`) from a single `USD₮` treasury. Giving an AI payroll agent an unrestricted EOA private key risks total treasury drain; manual FX conversion on every contractor invoice wastes hours.

## Architecture
1. **Non-Custodial Altana Smart Agentic Wallet (`@altananetwork/sdk`):** Owner retains custody and grants the payroll agent a scoped on-chain session key (`grantSession`) with a `$5 USD₮/day` spend cap, contract allowlist (`Textile LimitOrderReactor`, `USD₮`, local stablecoins), 24h expiry, and 1-transaction `revokeSession()` kill switch.
2. **Keyless Textile FX RFQ v2 (`api.textilecredit.com`):** Quotes live rates across 5 Celo Mainnet corridors (`USD₮ → cNGN / wBRL / wARS / wCOP / IDRX`), signs EIP-712 `TakerControl` proofs, appends `celo_4217c9fa0403` via `@celo/attribution-tags`, settles on-chain, and delivers local stablecoins to an external recipient.
3. **ERC-8004 On-Chain Agent Identity:** Registers CorridorKey on Celo Mainnet's `AgentIdentity` ERC-721 registry (`public/agent.json`).
4. **Celo x402 Compliance Receipt Rail (`api.x402.celo.org`):** Machine-readable HTTP 402 payment spec enabling external agents to pay `0.01 USD₮` for verified FX compliance receipts.

## Commands
```bash
npm install
npm run typecheck
npm test
npm run build
# Execute live Celo Mainnet session grant, ERC-8004, tagged Textile FX swap & revoke:
npm run agent:setup
```
