import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const OUT = path.join(ROOT, 'docs', 'screenshots');
fs.mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const p = (req.url || '/').split('?')[0];
      const rel = p === '/' ? 'index.html' : p.replace(/^\/+/, '');
      const full = path.join(DIST, rel);
      if (fs.existsSync(full) && fs.statSync(full).isFile()) {
        res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
        fs.createReadStream(full).pipe(res);
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

async function waitForDevTools(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('Timed out waiting for Chrome');
}

class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 0;
    this.pending = new Map();
    this.events = [];
  }
  async connect() {
    await new Promise((res, rej) => {
      this.ws.addEventListener('open', res, { once: true });
      this.ws.addEventListener('error', rej, { once: true });
    });
    this.ws.addEventListener('message', (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && this.pending.has(m.id)) {
        const { res, rej } = this.pending.get(m.id);
        this.pending.delete(m.id);
        m.error ? rej(new Error(m.error.message)) : res(m.result);
      } else if (m.method) {
        this.events.push(m);
      }
    });
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((res, rej) => {
      this.pending.set(id, { res, rej });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async eval(expression) {
    const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    return r.result?.value;
  }
  async shot(name) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(data, 'base64'));
    console.log('Saved:', name);
  }
  close() { this.ws.close(); }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { server, port } = await startServer();
  const cdpPort = 9337;
  const userDataDir = `/tmp/corridorkey-cdp-${Date.now()}`;
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--disable-gpu', '--no-sandbox',
    `--remote-debugging-port=${cdpPort}`, `--user-data-dir=${userDataDir}`,
    '--window-size=1440,900', 'about:blank',
  ], { stdio: 'ignore' });

  try {
    const cdp = new CDP(await waitForDevTools(cdpPort));
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 2, mobile: false });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${port}/` });
    await sleep(3000);

    const rpcText = await cdp.eval(`document.querySelector('.live-rpc-bar')?.textContent || ''`);
    console.log('Live Celo RPC bar:', rpcText.trim());
    await cdp.shot('01-corridor-dispatch.png');

    // Click dispatch button to create a live receipt
    await cdp.eval(`document.querySelector('.btn-primary')?.click();`);
    await sleep(350);

    // Go to Tab 02 Session Policy & Revoke Lab and click Revoke Kill Switch scenario
    await cdp.eval(`Array.from(document.querySelectorAll('.ck-tab')).find(b => b.textContent.includes('SESSION'))?.click();`);
    await sleep(350);
    await cdp.eval(`Array.from(document.querySelectorAll('.scenario-btn')).find(b => b.textContent.includes('REVOKE'))?.click();`);
    await sleep(350);
    await cdp.shot('02-revoke-killswitch.png');

    // Tab 03 x402
    await cdp.eval(`Array.from(document.querySelectorAll('.ck-tab')).find(b => b.textContent.includes('X402'))?.click();`);
    await sleep(350);
    await cdp.shot('03-x402-receipt.png');

    // Tab 04 Mainnet Proofs
    await cdp.eval(`Array.from(document.querySelectorAll('.ck-tab')).find(b => b.textContent.includes('PROOFS'))?.click();`);
    await sleep(350);
    await cdp.shot('04-mainnet-proofs.png');

    const errs = cdp.events.filter(
      (e) => (e.method === 'Runtime.consoleAPICalled' && e.params?.type === 'error') ||
             e.method === 'Runtime.exceptionThrown' ||
             (e.method === 'Log.entryAdded' && e.params?.entry?.level === 'error'),
    );
    console.log('Console/Runtime errors:', errs.length);
    if (errs.length > 0) {
      console.error(JSON.stringify(errs, null, 2));
      process.exitCode = 1;
    }
    cdp.close();
  } finally {
    chrome.kill('SIGTERM');
    server.close();
    await sleep(350);
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
