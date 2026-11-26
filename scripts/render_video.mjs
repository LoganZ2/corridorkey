import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const SHOTS = path.join(ROOT, 'docs', 'screenshots');
const TMP = `/tmp/corridorkey-video-${Date.now()}`;
fs.mkdirSync(TMP, { recursive: true });

const SCENES = [
  {
    id: '01',
    img: '01-corridor-dispatch.png',
    kicker: '01 / 04 · ALTANA SMART WALLET × TEXTILE FX ON CELO MAINNET',
    caption: 'CorridorKey — Session-Keyed Stablecoin Payroll Across 5 Live Celo FX Corridors',
    narration:
      'Meet CorridorKey, a session-keyed autonomous stablecoin payroll and cross-border FX settlement desk running live on Celo Mainnet. Built for solo studios paying international contributors from a single U S D T treasury, CorridorKey connects live Textile F X corridors across Nigerian Naira, Brazilian Real, Argentine Peso, Colombian Peso, and Indonesian Rupiah directly to an Altana Smart Agentic Wallet tagged with our E R C 8021 attribution code.',
  },
  {
    id: '02',
    img: '02-revoke-killswitch.png',
    kicker: '02 / 04 · ON-CHAIN SESSION POLICY, SPEND CAP & REVOKE KILL SWITCH',
    caption: 'Altana KeyStore Enforcement — Spend Cap Rejection & One-Tx Revocation Halts the Agent',
    narration:
      'Rather than handing an A I agent an unrestricted treasury private key, the owner grants a scoped Altana session key with a five dollar daily U S D T spend cap, a strict contract allowlist, and twenty-four hour expiry. On Celo Mainnet, we verified both an in-policy session transfer and a live spend limit exceeded rejection when attempting ten dollars. Calling revoke session removes the key from Celo KeyStore in a single transaction, immediately halting the agent on-chain with an unknown key hash error.',
  },
  {
    id: '03',
    img: '04-mainnet-proofs.png',
    kicker: '03 / 04 · ALL 5 / 5 VERIFIED CELO MAINNET PROOFS (ERC-8004 #10153 + TEXTILE FX)',
    caption: '1.00 USD₮ → 1,438.62 cNGN Textile FX Swap Delivered to External celopg.eth',
    narration:
      'Every requirement for both the Altana Smart Agentic Wallets track and the Stablecoin Corridors track is confirmed live on Celo Mainnet: Altana KeyStore session grant, E R C 8004 Agent Identity N F T number ten thousand one hundred fifty-three, in-policy session execution, one-transaction revocation, and a live E R C 8021 tagged Textile F X conversion of one U S D T into one thousand four hundred thirty-eight point six two c N G N delivered directly to official external recipient celo p g dot eth.',
  },
  {
    id: '04',
    img: '03-x402-receipt.png',
    kicker: '04 / 04 · CELO X402 COMPLIANCE RECEIPT RAIL',
    caption: 'HTTP 402 Pay-Per-Receipt Spec for External Agents on api.x402.celo.org',
    narration:
      'CorridorKey also exposes a machine-readable Celo x 402 compliance receipt specification so external accounting agents can settle zero point zero one U S D T per verified foreign exchange payroll receipt over H T T P 402. CorridorKey brings non-custodial session-key safety and instant local-currency stablecoin settlement to real global teams on Celo.',
  },
];

function probeDuration(filePath) {
  const out = execFileSync('/opt/homebrew/bin/ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
  ], { encoding: 'utf8' });
  return parseFloat(out.trim());
}

function renderSlide(scene) {
  const b64 = fs.readFileSync(path.join(SHOTS, scene.img)).toString('base64');
  const htmlPath = path.join(TMP, `slide-${scene.id}.html`);
  const pngPath = path.join(TMP, `slide-${scene.id}.png`);
  const html = `<!doctype html>
<html>
<head><meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; width: 1920px; height: 1080px; overflow: hidden; background: #0a0b0d; }
  .frame { width: 1920px; height: 1080px; display: flex; flex-direction: column; }
  .stage { flex: 1; display: flex; align-items: center; justify-content: center; padding: 16px 32px 10px; }
  .stage img { max-width: 100%; max-height: 954px; border: 2px solid #252932; }
  .bar {
    height: 96px; background: #101216; border-top: 3px solid #fcff52;
    display: flex; align-items: center; justify-content: space-between; padding: 0 40px;
  }
  .kicker { font: 700 15px/1 'Menlo', monospace; color: #fcff52; letter-spacing: 0.11em; }
  .cap { font: 600 25px/1.18 Georgia, serif; color: #f6f5f0; margin-top: 6px; }
  .badge { font: 700 19px/1 'Menlo', monospace; color: #0a0b0d; background: #fcff52; padding: 10px 16px; }
</style>
</head>
<body>
  <div class="frame">
    <div class="stage"><img src="data:image/png;base64,${b64}" /></div>
    <div class="bar">
      <div><div class="kicker">${scene.kicker}</div><div class="cap">${scene.caption}</div></div>
      <div class="badge">CORRIDORKEY · CELO 42220</div>
    </div>
  </div>
</body>
</html>`;
  fs.writeFileSync(htmlPath, html);
  execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--disable-gpu', '--window-size=1920,1080',
    `--screenshot=${pngPath}`, `file://${htmlPath}`,
  ], { stdio: 'ignore' });
  return pngPath;
}

const segs = [];
for (const s of SCENES) {
  const slide = renderSlide(s);
  const aiff = path.join(TMP, `s-${s.id}.aiff`);
  const wav = path.join(TMP, `s-${s.id}.wav`);
  const mp4 = path.join(TMP, `s-${s.id}.mp4`);
  execFileSync('say', ['-v', 'Daniel', '-r', '186', '-o', aiff, s.narration]);
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', aiff, '-ar', '44100', '-ac', '2', wav], { stdio: 'ignore' });
  const dur = (probeDuration(wav) + 0.5).toFixed(2);
  execFileSync('/opt/homebrew/bin/ffmpeg', [
    '-y', '-loop', '1', '-i', slide, '-i', wav,
    '-c:v', 'libx264', '-tune', 'stillimage', '-pix_fmt', 'yuv420p', '-r', '30',
    '-c:a', 'aac', '-b:a', '160k', '-t', dur, '-shortest', mp4,
  ], { stdio: 'ignore' });
  segs.push(mp4);
  console.log(`Rendered scene ${s.id} (${dur}s)`);
}

const list = path.join(TMP, 'concat.txt');
fs.writeFileSync(list, segs.map((f) => `file '${f}'`).join('\n'));
const out = path.join(ROOT, 'docs', 'corridorkey-demo.mp4');
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', out,
], { stdio: 'ignore' });

console.log(`FINAL VIDEO: ${out} (${probeDuration(out).toFixed(1)}s, ${(fs.statSync(out).size / 1048576).toFixed(2)} MB)`);
fs.rmSync(TMP, { recursive: true, force: true });
