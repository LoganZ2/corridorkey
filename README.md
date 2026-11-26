# CorridorKey — Session-Keyed Stablecoin Payroll & FX Settlement on Celo Mainnet

**Built for Loops House — Agents Open for Business (Celo Mainnet)**
Entering **Stablecoin Corridors (Textile FX)** + **Altana Smart Agentic Wallets**.

- **Live Web App:** https://loganz2.github.io/corridorkey/
- **ERC-8004 Agent Manifest:** https://loganz2.github.io/corridorkey/agent.json
- **Agent Smart Wallet (Celo Mainnet):** `0x04801c703843Bf51a112Fa4dC8A7B2Bb4d0D1176` ([Celoscan](https://celoscan.io/address/0x04801c703843Bf51a112Fa4dC8A7B2Bb4d0D1176) · [Altana KeyStore Explorer](https://explorer.altana.network/wallet/0x04801c703843Bf51a112Fa4dC8A7B2Bb4d0D1176))
- **ERC-8004 Agent Identity:** **Agent `#10153`** on Celo Mainnet (`0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`)
- **ERC-8021 Attribution Tag:** `celo_4217c9fa0403`

---

## Verified Celo Mainnet Transactions (All 5/5 Confirmed On-Chain)

| Proof | Track | Celo Mainnet Tx Hash | What It Proves |
| --- | --- | --- | --- |
| **01 · Altana Wallet Init & Session Grant** | Altana | [`0x64d49807…74a03`](https://celoscan.io/tx/0x64d49807b39f3e8b7a0c3163ea568ec34437b4a94446c02db916bb81e7e74a03) & [`0x6a5fceac…9f11a`](https://celoscan.io/tx/0x6a5fceac429dbf173e98de0eab6415762141e939acf74fca99de2e08aa49f11a) | Grants scoped session key (`0xEE55…2f56`) on Celo KeyStore (`0x83b3…d27c`) with `$5 USD₮/day` cap, contract allowlist, 24h expiry & `celo_4217c9fa0403` tag |
| **02 · ERC-8004 Identity NFT (`#10153`)** | All Tracks | [`0x8d9dacd4…9e179`](https://celoscan.io/tx/0x8d9dacd435725f5032fc9d5fedaa9ea18119eb17feeb848b4f5889fe77b9e179) | Registers CorridorKey on Celo Mainnet ERC-8004 `AgentIdentity` (`0x8004A169…a432`) |
| **03 · In-Policy Session Execution** | Altana | [`0x95bc39ff…d8823`](https://celoscan.io/tx/0x95bc39ff3370817c03eae93be64676e8131d74bc559461efbf00f15ea4cd8823) | Scoped session executes `0.01 USD₮ → celopg.eth` (`0x017F…5CbBe`); testing `10 USD₮ > $5 cap` reverts with `spend_limit_exceeded` |
| **04 · `revokeSession()` & Agent Halt** | Altana | [`0xc0541f30…8cbe6`](https://celoscan.io/tx/0xc0541f30b86153e7db0762eed1a1d5dfdf779dde476d79b3f8f04aa423e8cbe6) | Revokes session key on Celo KeyStore in 1 tx; subsequent agent execution attempt rejected on-chain (`Key hash 0xd15da6… is unknown`) |
| **05 · Tagged Textile FX Swap + External Payout** | Textile FX | Swap [`0x06b28895…3531a`](https://celoscan.io/tx/0x06b28895531ed6a0a878cc9bebab4e8264158690a48b278a9df9323c3433531a) · Payout [`0xecac2ca0…1d5b20`](https://celoscan.io/tx/0xecac2ca0b5df4bb095056963e02d37336b0f5cc1fa3d83e1cea4bad9d81d5b20) | Converts **`1.00 USD₮ → 1,438.62 cNGN`** via Textile LimitOrderReactor (`0xa9AA…35b3`, RFQ `rfq_hvUsbR8lQNTSa8de`, verified ERC-8021 suffix) & delivers `1,438.62 cNGN` to official external recipient **`celopg.eth`** |

---

## Problem & Named User
Solo software studios (**ZKY Studio**) pay global open-source contributors across Nigeria (`cNGN`), Brazil (`wBRL`), Argentina (`wARS`), Colombia (`wCOP`), and Indonesia (`IDRX`) from a single `USD₮` treasury. Handing an AI payroll agent an unrestricted EOA key risks full treasury drain, while manual FX quotes waste time.

## Architecture
1. **Non-Custodial Altana Smart Agentic Wallet (`@altananetwork/sdk`):** Owner holds the admin key and grants the payroll agent a scoped session key (`grantSession`) enforced on-chain in Celo's KeyStore (`$5 USD₮/day` cap, contract allowlist, 24h expiry, 1-tx `revokeSession()` kill switch).
2. **Keyless Textile FX RFQ v2 (`api.textilecredit.com`):** Quotes live rates across 5 Celo Mainnet corridors, signs EIP-712 `TakerControl` proofs, appends `celo_4217c9fa0403` via `@celo/attribution-tags`, executes on `LimitOrderReactor`, and delivers local stablecoins directly to external recipients (`celopg.eth`).
3. **ERC-8004 On-Chain Agent Identity (`#10153`):** Discoverable on Celo Mainnet `AgentIdentity` registry.
4. **Celo x402 Compliance Receipt Rail (`api.x402.celo.org`):** Machine-readable HTTP 402 payment spec allowing external agents to pay `0.01 USD₮` for verified FX compliance receipts.

## Commands
```bash
npm install
npm run typecheck
npm test
npm run build
```
