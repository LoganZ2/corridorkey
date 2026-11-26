import { useEffect, useMemo, useState } from 'react';
import mainnetProofs from './data/mainnetProofs.json';
import {
  buildCorridorQuote,
  buildX402ReceiptSpec,
  CELO_CONTRACTS,
  CORRIDORS,
  evaluateSessionPolicy,
  LOOPS_ATTRIBUTION_TAG,
} from './engine/corridorEngine';
import { fetchCeloMainnetStatus } from './services/celoLiveClient';
import type {
  CeloLiveStatus,
  CorridorId,
  MainnetTxProof,
  SessionPolicyConfig,
} from './types';

type DeskView = 'DISPATCH' | 'POLICY_LAB' | 'X402' | 'PROOFS';

interface DispatchedReceipt {
  id: string;
  at: string;
  contractor: string;
  corridorId: CorridorId;
  sellUsdt: number;
  buyLocal: string;
  recipient: string;
  tag: string;
  calldataSuffix: string;
}

const AGENT_WALLET = mainnetProofs.agentWallet as `0x${string}`;

export function App() {
  const [view, setView] = useState<DeskView>('DISPATCH');
  const [celoLive, setCeloLive] = useState<CeloLiveStatus | null>(null);
  const [corridorId, setCorridorId] = useState<CorridorId>('USDT_cNGN');
  const [amountUsdt, setAmountUsdt] = useState<number>(1.5);
  const [recipient, setRecipient] = useState<string>(CORRIDORS[0].sampleRecipient);
  const [targetContract, setTargetContract] = useState<`0x${string}`>(
    CELO_CONTRACTS.TEXTILE_REACTOR,
  );
  const [dailyCapUsdt, setDailyCapUsdt] = useState<number>(5.0);
  const [spentTodayUsdt, setSpentTodayUsdt] = useState<number>(0.0);
  const [revoked, setRevoked] = useState<boolean>(false);
  const [expired, setExpired] = useState<boolean>(false);
  const [receipts, setReceipts] = useState<DispatchedReceipt[]>([]);

  useEffect(() => {
    void fetchCeloMainnetStatus(AGENT_WALLET).then(setCeloLive);
  }, []);

  const quote = useMemo(
    () => buildCorridorQuote(corridorId, amountUsdt),
    [corridorId, amountUsdt],
  );

  const policy: SessionPolicyConfig = useMemo(() => {
    const baseNow = Math.floor(Date.now() / 1000);
    return {
      sessionKeyAddress:
        (mainnetProofs.sessionKeyAddress as `0x${string}` | null) ??
        '0x7a9E2f184B09cF32e41B69d4C33a89E2b9104c1A',
      dailySpendCapUsdt: dailyCapUsdt,
      spentTodayUsdt,
      expiryUnix: expired ? baseNow - 600 : baseNow + 24 * 3600,
      revoked,
      allowedTargets: [
        { label: 'Textile LimitOrderReactor', address: CELO_CONTRACTS.TEXTILE_REACTOR },
        { label: 'Celo USD₮', address: CELO_CONTRACTS.USDT },
        ...CORRIDORS.map((c) => ({ label: `Celo ${c.code}`, address: c.buyToken })),
      ],
    };
  }, [dailyCapUsdt, spentTodayUsdt, revoked, expired]);

  const policyResult = useMemo(
    () =>
      evaluateSessionPolicy({
        policy,
        targetContract,
        recipient: (recipient.startsWith('0x') && recipient.length === 42
          ? recipient
          : CORRIDORS[0].sampleRecipient) as `0x${string}`,
        amountUsdt,
      }),
    [policy, targetContract, recipient, amountUsdt],
  );

  const x402Spec = useMemo(
    () => buildX402ReceiptSpec(corridorId, amountUsdt),
    [corridorId, amountUsdt],
  );

  const allQuotes = useMemo(
    () => CORRIDORS.map((c) => buildCorridorQuote(c.id, amountUsdt)),
    [amountUsdt],
  );

  const handleDispatch = () => {
    if (!policyResult.allowed) return;
    setSpentTodayUsdt((s) => Number((s + amountUsdt).toFixed(4)));
    setReceipts((prev) => [
      {
        id: `CK-${Date.now().toString(16).toUpperCase().slice(-6)}`,
        at: new Date().toISOString().slice(11, 19) + ' UTC',
        contractor: quote.corridor.sampleContractor,
        corridorId: quote.corridor.id,
        sellUsdt: quote.sellAmountUsdt,
        buyLocal: `${quote.buyAmountLocal.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${quote.corridor.code}`,
        recipient,
        tag: LOOPS_ATTRIBUTION_TAG,
        calldataSuffix: policyResult.encodedCalldataPreview.slice(-46),
      },
      ...prev,
    ]);
  };

  const applyScenario = (mode: 'VALID' | 'CAP' | 'ALLOWLIST' | 'REVOKED') => {
    setExpired(false);
    if (mode === 'VALID') {
      setRevoked(false);
      setAmountUsdt(1.5);
      setTargetContract(CELO_CONTRACTS.TEXTILE_REACTOR);
    } else if (mode === 'CAP') {
      setRevoked(false);
      setAmountUsdt(12.0);
      setTargetContract(CELO_CONTRACTS.TEXTILE_REACTOR);
    } else if (mode === 'ALLOWLIST') {
      setRevoked(false);
      setAmountUsdt(1.0);
      setTargetContract('0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF');
    } else if (mode === 'REVOKED') {
      setRevoked(true);
      setAmountUsdt(1.0);
      setTargetContract(CELO_CONTRACTS.TEXTILE_REACTOR);
    }
  };

  const confirmedCount = (mainnetProofs.proofs as MainnetTxProof[]).filter(
    (p) => p.status === 'CONFIRMED',
  ).length;

  return (
    <div className="ck-shell">
      {/* LEFT VERTICAL ALTANA CUSTODY STACK */}
      <aside className="vault-spine" aria-label="Altana Smart Agentic Wallet Custody Stack">
        <div>
          <div className="vault-top-tag">
            <span>ALTANA × CELO VAULT</span>
            <span className="celo-pill">CHAIN 42220</span>
          </div>

          <div className="live-rpc-bar">
            <div className="rpc-row">
              <span>
                <span className="dot-live" />
                {celoLive?.connected
                  ? `FORNO LIVE (${celoLive.latencyMs}ms)`
                  : 'CONNECTING CELO…'}
              </span>
              <span style={{ color: '#fcff52' }}>
                {celoLive?.blockNumber ? `#${celoLive.blockNumber.toLocaleString()}` : '—'}
              </span>
            </div>
            <div className="rpc-row" style={{ color: '#94a3b8' }}>
              <span>BALANCES</span>
              <span>
                {celoLive
                  ? `${celoLive.celoBalance.toFixed(3)} CELO · ${celoLive.usdtBalance.toFixed(2)} USD₮`
                  : '—'}
              </span>
            </div>
          </div>

          {/* 4-Layer Altana Custody Stack */}
          <div className="custody-stack">
            <div className="stack-node">
              <div className="node-step">
                <span>01 · HUMAN TREASURY OWNER</span>
                <span style={{ color: '#94a3b8' }}>ADMIN KEY</span>
              </div>
              <div className="node-title">ZKY Studio Owner Signer</div>
              <div className="node-sub">
                Never shared with AI agent. Grants &amp; revokes scoped session keys in 1 tx.
              </div>
            </div>

            <div className="stack-arrow">↓ grantSession()</div>

            <div className="stack-node altana-active">
              <div className="node-step">
                <span>02 · ALTANA SMART WALLET</span>
                <span style={{ color: '#5b82f6' }}>EIP-7702</span>
              </div>
              <div className="node-title">
                {AGENT_WALLET.slice(0, 10)}…{AGENT_WALLET.slice(-8)}
              </div>
              <div className="node-sub">
                KeyStore: {CELO_CONTRACTS.ALTANA_KEYSTORE.slice(0, 10)}…d27c
              </div>
            </div>

            <div className="stack-arrow">↓ onchain policy check</div>

            <div className={`stack-node ${revoked ? 'session-revoked' : 'session-ok'}`}>
              <div className="node-step">
                <span>03 · SCOPED SESSION KEY</span>
                <span style={{ color: revoked ? '#f87171' : '#10b981' }}>
                  {revoked ? 'REVOKED' : 'ACTIVE'}
                </span>
              </div>
              <div className="node-title">
                Cap: ${spentTodayUsdt.toFixed(2)} / ${dailyCapUsdt.toFixed(2)} USD₮
              </div>
              <div className="node-sub">
                Allowlist: Textile Reactor + 5 Celo Local Stablecoins · 24h TTL
              </div>
              <button
                type="button"
                className={`kill-switch-btn ${revoked ? 'restore' : ''}`}
                onClick={() => setRevoked((r) => !r)}
              >
                {revoked
                  ? 'RESTORE SESSION KEY (RE-GRANT)'
                  : 'REVOKE SESSION (KILL SWITCH)'}
              </button>
            </div>

            <div className="stack-arrow">↓ ERC-8004 + ERC-8021</div>

            <div className="stack-node">
              <div className="node-step">
                <span>04 · TRUST &amp; ATTRIBUTION</span>
                <span style={{ color: '#fcff52' }}>VERIFIED</span>
              </div>
              <div className="node-title">Tag: {LOOPS_ATTRIBUTION_TAG}</div>
              <div className="node-sub">
                ERC-8004 Registry: 0x8004…a432 · On-chain NFTs:{' '}
                {celoLive ? celoLive.erc8004Balance : 0}
              </div>
            </div>
          </div>
        </div>

        <div className="vault-links">
          <a
            className="vault-link"
            href={`https://celoscan.io/address/${AGENT_WALLET}`}
            target="_blank"
            rel="noreferrer"
          >
            CELOSCAN ↗
          </a>
          <a
            className="vault-link"
            href={`https://explorer.altana.network/wallet/${AGENT_WALLET}`}
            target="_blank"
            rel="noreferrer"
          >
            KEYSTORE ↗
          </a>
          <a
            className="vault-link"
            href="https://8004scan.io/"
            target="_blank"
            rel="noreferrer"
          >
            8004SCAN ↗
          </a>
          <a
            className="vault-link"
            href="https://app.textilecredit.com/"
            target="_blank"
            rel="noreferrer"
          >
            TEXTILE FX ↗
          </a>
        </div>
      </aside>

      {/* RIGHT SWISS CLEARING HOUSE DISPATCH LEDGER */}
      <main className="clearing-desk">
        <div className="desk-folio">
          <span>CELO MAINNET (42220) · AGENTS OPEN FOR BUSINESS</span>
          <span>ALTANA SMART WALLET × TEXTILE FX × X402</span>
          <span>NAMED USER: ZKY STUDIO CROSS-BORDER PAYROLL</span>
        </div>

        <header className="desk-masthead">
          <div>
            <h1 className="desk-title">CorridorKey</h1>
            <p className="desk-subtitle">
              Session-keyed autonomous stablecoin payroll &amp; local-currency FX settlement desk.
              Convert USD₮ via Textile FX into cNGN, wBRL, wARS, wCOP &amp; IDRX under strict
              on-chain Altana KeyStore spend caps, allowlists, and one-transaction revocation.
            </p>
          </div>
          <div className="tag-stamp">
            <div>ERC-8021 ATTRIBUTION</div>
            <div style={{ fontSize: 13 }}>{LOOPS_ATTRIBUTION_TAG}</div>
          </div>
        </header>

        {/* 4-Cell Dispatch KPI Strip */}
        <section className="ck-kpis">
          <div className="ck-kpi">
            <div className="ck-kpi-label">Live Textile FX Corridors</div>
            <div className="ck-kpi-val">5 ACTIVE</div>
            <div className="ck-kpi-sub">cNGN · wBRL · wARS · wCOP · IDRX</div>
          </div>
          <div className="ck-kpi">
            <div className="ck-kpi-label">Active Corridor Rate</div>
            <div className="ck-kpi-val">
              1 USD₮ = {quote.ratePerUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
              {quote.corridor.code}
            </div>
            <div className="ck-kpi-sub">
              Depth: ${quote.availableDepthUsdt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </div>
          <div className="ck-kpi">
            <div className="ck-kpi-label">Session Policy State</div>
            <div
              className="ck-kpi-val"
              style={{ color: policyResult.allowed ? '#059669' : '#dc2626' }}
            >
              {policyResult.allowed ? 'PERMITTED' : policyResult.errorCode?.replace('ALTANA_', '')}
            </div>
            <div className="ck-kpi-sub">
              Remaining cap: ${Math.max(0, dailyCapUsdt - spentTodayUsdt).toFixed(2)} USD₮
            </div>
          </div>
          <div className="ck-kpi">
            <div className="ck-kpi-label">Celo Mainnet Proofs</div>
            <div className="ck-kpi-val">
              {confirmedCount} / {mainnetProofs.proofs.length} ON-CHAIN
            </div>
            <div className="ck-kpi-sub">Altana KeyStore + ERC-8004 + Textile</div>
          </div>
        </section>

        {/* 4-View Ruled Tabs */}
        <nav className="ck-tabs" aria-label="CorridorKey Desk Views">
          <button
            type="button"
            className={`ck-tab ${view === 'DISPATCH' ? 'active' : ''}`}
            onClick={() => setView('DISPATCH')}
          >
            <span>01 CORRIDOR PAYROLL</span>
            <span>5 FX</span>
          </button>
          <button
            type="button"
            className={`ck-tab ${view === 'POLICY_LAB' ? 'active' : ''}`}
            onClick={() => setView('POLICY_LAB')}
          >
            <span>02 SESSION &amp; REVOKE LAB</span>
            <span>ALTANA</span>
          </button>
          <button
            type="button"
            className={`ck-tab ${view === 'X402' ? 'active' : ''}`}
            onClick={() => setView('X402')}
          >
            <span>03 X402 RECEIPT RAIL</span>
            <span>402</span>
          </button>
          <button
            type="button"
            className={`ck-tab ${view === 'PROOFS' ? 'active' : ''}`}
            onClick={() => setView('PROOFS')}
          >
            <span>04 MAINNET AUDIT PROOFS</span>
            <span>CELO</span>
          </button>
        </nav>

        {/* VIEW 01: CORRIDOR PAYROLL DISPATCH */}
        {view === 'DISPATCH' && (
          <section className="dispatch-grid">
            <div className="panel-box">
              <h3>
                <span>LIVE TEXTILE FX CORRIDORS (CELO MAINNET)</span>
                <span>RFQ V2 · KEYLESS</span>
              </h3>
              <table className="corridor-table">
                <thead>
                  <tr>
                    <th>Corridor &amp; Contributor</th>
                    <th>Rate / USD₮</th>
                    <th>Est. Payout</th>
                    <th>Depth</th>
                  </tr>
                </thead>
                <tbody>
                  {allQuotes.map((q) => (
                    <tr
                      key={q.corridor.id}
                      className={q.corridor.id === corridorId ? 'active-corridor' : ''}
                      onClick={() => {
                        setCorridorId(q.corridor.id);
                        setRecipient(q.corridor.sampleRecipient);
                      }}
                    >
                      <td>
                        <div style={{ fontWeight: 700 }}>
                          USD₮ → {q.corridor.code} ({q.corridor.city})
                        </div>
                        <div style={{ fontSize: 10.5, color: '#52555e' }}>
                          {q.corridor.sampleContractor} · {q.corridor.sampleRole}
                        </div>
                      </td>
                      <td>{q.ratePerUsdt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      <td style={{ fontWeight: 600 }}>
                        {q.buyAmountLocal.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                        {q.corridor.code}
                      </td>
                      <td>
                        ${q.availableDepthUsdt >= 1000 ? `${(q.availableDepthUsdt / 1000).toFixed(0)}K` : q.availableDepthUsdt.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 14 }}>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    fontWeight: 700,
                    marginBottom: 6,
                  }}
                >
                  DISPATCHED PAYROLL RECEIPTS ({receipts.length})
                </div>
                {receipts.length === 0 ? (
                  <div style={{ fontSize: 12, color: '#52555e', fontFamily: 'var(--font-mono)' }}>
                    Select a contractor corridor and dispatch an in-policy FX payout to generate an
                    ERC-8021 tagged settlement receipt.
                  </div>
                ) : (
                  receipts.map((r) => (
                    <div key={r.id} className="proof-card" style={{ marginTop: 6, padding: 9 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                        <span>
                          ✓ {r.id} · {r.contractor}
                        </span>
                        <span style={{ color: '#059669' }}>{r.buyLocal}</span>
                      </div>
                      <div style={{ fontSize: 10.5, color: '#52555e', marginTop: 2 }}>
                        {r.at} · Sold ${r.sellUsdt.toFixed(2)} USD₮ · Tag {r.tag} · Recipient{' '}
                        {r.recipient.slice(0, 10)}…
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Wire Slip */}
            <div className="panel-box">
              <h3>
                <span>FOREIGN EXCHANGE WIRE TICKET</span>
                <span>{quote.corridor.id}</span>
              </h3>

              <div className="form-grid">
                <div className="field">
                  <label htmlFor="ck-amt">Treasury Amount (USD₮)</label>
                  <input
                    id="ck-amt"
                    type="number"
                    min={0.05}
                    step={0.5}
                    value={amountUsdt}
                    onChange={(e) => setAmountUsdt(Math.max(0.01, Number(e.target.value) || 0.01))}
                  />
                </div>
                <div className="field">
                  <label htmlFor="ck-cap">Session Daily Cap (USD₮)</label>
                  <input
                    id="ck-cap"
                    type="number"
                    min={1}
                    step={1}
                    value={dailyCapUsdt}
                    onChange={(e) => setDailyCapUsdt(Math.max(1, Number(e.target.value) || 1))}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="ck-rec">External Recipient Wallet (Outside Team)</label>
                  <input
                    id="ck-rec"
                    type="text"
                    value={recipient}
                    onChange={(e) => setRecipient(e.target.value)}
                  />
                </div>
              </div>

              <div className="wire-summary">
                <div className="wire-row">
                  <span>Contractor</span>
                  <strong>{quote.corridor.sampleContractor}</strong>
                </div>
                <div className="wire-row">
                  <span>Textile FX Quote</span>
                  <strong>
                    {quote.buyAmountLocal.toLocaleString(undefined, { maximumFractionDigits: 2 })}{' '}
                    {quote.corridor.code}
                  </strong>
                </div>
                <div className="wire-row">
                  <span>Textile Protocol Fee</span>
                  <span>${quote.feeUsdt.toFixed(4)} USD₮</span>
                </div>
                <div className="wire-row">
                  <span>Settlement Target</span>
                  <span>LimitOrderReactor (0xa9AA…35b3)</span>
                </div>
                <div className="wire-row">
                  <span>ERC-8021 Suffix</span>
                  <strong>{LOOPS_ATTRIBUTION_TAG}</strong>
                </div>
              </div>

              <div className={`verdict-banner ${policyResult.allowed ? 'ok' : 'blocked'}`}>
                <strong>
                  {policyResult.allowed
                    ? '✓ ALTANA SESSION POLICY: PERMITTED'
                    : `✕ BLOCKED ON-CHAIN: ${policyResult.errorCode}`}
                </strong>
                <div style={{ marginTop: 3 }}>{policyResult.summary}</div>
              </div>

              <button
                type="button"
                className="btn-primary"
                disabled={!policyResult.allowed}
                onClick={handleDispatch}
              >
                {policyResult.allowed
                  ? `DISPATCH ${quote.buyAmountLocal.toFixed(2)} ${quote.corridor.code} VIA SESSION KEY`
                  : 'EXECUTION HALTED BY ALTANA KEYSTORE POLICY'}
              </button>

              <pre className="code-block">
                {`ERC-8021 TAGGED CALLDATA (${LOOPS_ATTRIBUTION_TAG}):\n${policyResult.encodedCalldataPreview}`}
              </pre>
            </div>
          </section>
        )}

        {/* VIEW 02: SESSION POLICY & REVOKE KILL-SWITCH LAB */}
        {view === 'POLICY_LAB' && (
          <section>
            <div className="scenario-bar">
              <button
                type="button"
                className={`scenario-btn ${policyResult.verdict === 'PERMITTED' ? 'active' : ''}`}
                onClick={() => applyScenario('VALID')}
              >
                <strong>01 · VALID PAYROLL</strong>
                <br />
                $1.50 USD₮ → Textile Reactor
              </button>
              <button
                type="button"
                className={`scenario-btn ${policyResult.verdict === 'BLOCKED_SPEND_CAP' ? 'active' : ''}`}
                onClick={() => applyScenario('CAP')}
              >
                <strong>02 · SPEND CAP BREACH</strong>
                <br />
                $12.00 &gt; $5.00 Daily Limit
              </button>
              <button
                type="button"
                className={`scenario-btn ${policyResult.verdict === 'BLOCKED_ALLOWLIST' ? 'active' : ''}`}
                onClick={() => applyScenario('ALLOWLIST')}
              >
                <strong>03 · ROGUE CONTRACT</strong>
                <br />
                Call 0xDeaD…beeF Blocked
              </button>
              <button
                type="button"
                className={`scenario-btn ${policyResult.verdict === 'BLOCKED_REVOKED' ? 'active' : ''}`}
                onClick={() => applyScenario('REVOKED')}
              >
                <strong>04 · REVOKE KILL SWITCH</strong>
                <br />
                revokeSession() Stops Agent
              </button>
            </div>

            <div className="panel-box" style={{ marginTop: 14 }}>
              <h3>
                <span>ALTANA KEYSTORE ENFORCEMENT INSPECTOR (0x83b3…d27c)</span>
                <span>VERDICT: {policyResult.verdict}</span>
              </h3>

              <div className={`verdict-banner ${policyResult.allowed ? 'ok' : 'blocked'}`} style={{ marginTop: 0, marginBottom: 10 }}>
                <strong>{policyResult.summary}</strong>
              </div>

              {policyResult.checks.map((c) => (
                <div key={c.name} className="check-row">
                  <div>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ color: '#52555e', marginTop: 2 }}>{c.detail}</div>
                  </div>
                  <span className={c.passed ? 'badge-pass' : 'badge-fail'}>
                    {c.passed ? 'PASS' : 'REVERT'}
                  </span>
                </div>
              ))}

              <pre className="code-block">
{`// Exact @altananetwork/sdk Celo Mainnet policy configuration
const client = createClient({ chains: [CELO], appCode: "${LOOPS_ATTRIBUTION_TAG}" });
const session = await client.grantSession({
  wallet,
  signer: adminSigner,
  sessionSigner,
  permissions: {
    calls: [{ to: "${CELO_CONTRACTS.TEXTILE_REACTOR}" }, { to: "${CELO_CONTRACTS.USDT}" }],
    spend: [{ limit: ${BigInt(Math.round(dailyCapUsdt * 1e6))}n, period: "day", token: "${CELO_CONTRACTS.USDT}" }],
  },
  expiry: ${policy.expiryUnix},
});
// Instant 1-tx on-chain kill switch:
await client.revokeSession({ wallet, signer: adminSigner, session });`}
              </pre>
            </div>
          </section>
        )}

        {/* VIEW 03: CELO X402 FX RECEIPT RAIL */}
        {view === 'X402' && (
          <section className="panel-box" style={{ marginTop: 16 }}>
            <h3>
              <span>CELO NATIVE X402 FACILITATOR (api.x402.celo.org)</span>
              <span>HTTP 402 → EIP-3009 / PERMIT2</span>
            </h3>
            <p style={{ marginTop: 0, fontSize: 13 }}>
              External AI agents and accounting bots can purchase signed Textile FX rate &amp;
              compliance payroll receipts over HTTP 402 using{' '}
              <code>client.fetchWithX402({'{ session, url }'})</code> from an Altana session key —
              settled gaslessly by Celo&apos;s hosted facilitator (<code>{x402Spec.treasury}</code>
              ).
            </p>
            <pre className="code-block">{JSON.stringify(x402Spec, null, 2)}</pre>
          </section>
        )}

        {/* VIEW 04: CELO MAINNET ON-CHAIN AUDIT PROOFS */}
        {view === 'PROOFS' && (
          <section style={{ marginTop: 14 }}>
            <div className="panel-box">
              <h3>
                <span>CELO MAINNET VERIFICATION LEDGER (CHAIN 42220)</span>
                <span>AGENT: {AGENT_WALLET}</span>
              </h3>
              {(mainnetProofs.proofs as MainnetTxProof[]).map((p) => (
                <div key={p.step} className="proof-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <strong>{p.step}</strong>
                    <span className={p.status === 'CONFIRMED' ? 'badge-pass' : 'badge-fail'}>
                      {p.status}
                    </span>
                  </div>
                  <div style={{ color: '#52555e', marginTop: 4 }}>{p.detail}</div>
                  {p.txHash && (
                    <div style={{ marginTop: 5 }}>
                      Tx:{' '}
                      <a href={p.explorerUrl} target="_blank" rel="noreferrer" style={{ color: '#1d4ed8' }}>
                        {p.txHash}
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
