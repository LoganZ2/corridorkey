import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const htmlPath = path.join(ROOT, 'docs', '_icon.html');
const pngPath = path.join(ROOT, 'public', 'corridorkey-icon.png');
fs.mkdirSync(path.join(ROOT, 'public'), { recursive: true });

const html = `<!doctype html>
<html>
<head><meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; width: 512px; height: 512px; overflow: hidden; background: #0a0b0d; }
  .box {
    width: 512px; height: 512px; box-sizing: border-box;
    border: 18px solid #fcff52; background: #0a0b0d;
    display: flex; flex-direction: column; justify-content: space-between; padding: 38px 40px;
  }
  .top { font: 700 22px/1 'Menlo', monospace; color: #5b82f6; letter-spacing: 0.14em; display: flex; justify-content: space-between; }
  .mid { font: 400 215px/0.86 Georgia, serif; color: #f6f5f0; letter-spacing: -0.04em; }
  .mid span { color: #fcff52; }
  .bot { display: flex; justify-content: space-between; font: 700 20px/1 'Menlo', monospace; }
  .pill { background: #fcff52; color: #0a0b0d; padding: 8px 12px; }
  .pill2 { border: 2px solid #10b981; color: #10b981; padding: 6px 12px; }
</style>
</head>
<body>
  <div class="box">
    <div class="top"><span>CELO 42220</span><span>ERC-8021</span></div>
    <div class="mid">C<span>K</span></div>
    <div class="bot"><span class="pill">FX CORRIDOR</span><span class="pill2">ALTANA</span></div>
  </div>
</body>
</html>`;

fs.writeFileSync(htmlPath, html);
execFileSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new',
  '--disable-gpu',
  '--window-size=512,512',
  `--screenshot=${pngPath}`,
  `file://${htmlPath}`,
]);
fs.unlinkSync(htmlPath);
console.log('Generated 512x512 CorridorKey icon:', pngPath);
