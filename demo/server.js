import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { createPage } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

/** Demo slot content */
const DEMO_SLOTS = [
  {
    name: 'hero',
    delay: 300,
    html: `<div style="padding:1.75rem 2rem;background:#1e1d1a;border:1px solid #2a2926;border-radius:6px;">
      <h1 style="margin:0;font-size:1.75rem;font-weight:600;color:#e8e4dc;letter-spacing:-0.02em;">Dashboard</h1>
      <p style="margin:0.5rem 0 0;color:#7a766c;font-size:0.875rem;">Welcome back, developer.</p>
    </div>`,
  },
  {
    name: 'metrics',
    delay: 800,
    html: `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.75rem;">
      <div style="padding:1.25rem;background:#1e1d1a;border-radius:6px;border:1px solid #2a2926;">
        <div style="color:#7a766c;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Requests</div>
        <div style="color:#e8e4dc;font-size:1.75rem;font-weight:600;margin-top:0.25rem;letter-spacing:-0.02em;">24.5k</div>
        <div style="color:#6db870;font-size:0.75rem;margin-top:0.25rem;">↑ 12%</div>
      </div>
      <div style="padding:1.25rem;background:#1e1d1a;border-radius:6px;border:1px solid #2a2926;">
        <div style="color:#7a766c;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Latency</div>
        <div style="color:#e8e4dc;font-size:1.75rem;font-weight:600;margin-top:0.25rem;letter-spacing:-0.02em;">42ms</div>
        <div style="color:#6db870;font-size:0.75rem;margin-top:0.25rem;">↓ 8%</div>
      </div>
      <div style="padding:1.25rem;background:#1e1d1a;border-radius:6px;border:1px solid #2a2926;">
        <div style="color:#7a766c;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.04em;">Uptime</div>
        <div style="color:#e8e4dc;font-size:1.75rem;font-weight:600;margin-top:0.25rem;letter-spacing:-0.02em;">99.9%</div>
        <div style="color:#6db870;font-size:0.75rem;margin-top:0.25rem;">Stable</div>
      </div>
    </div>`,
  },
  {
    name: 'chart',
    delay: 1500,
    html: `<div style="padding:1.25rem;background:#1e1d1a;border-radius:6px;border:1px solid #2a2926;">
      <h3 style="color:#b5b0a6;margin:0 0 0.75rem;font-size:0.8125rem;font-weight:500;">Traffic (24h)</h3>
      <div style="display:flex;align-items:end;gap:3px;height:100px;">
        <div style="flex:1;background:#c9a96e;border-radius:2px 2px 0 0;height:60%;opacity:0.8;"></div>
        <div style="flex:1;background:#c9a96e;border-radius:2px 2px 0 0;height:80%;opacity:0.85;"></div>
        <div style="flex:1;background:#c9a96e;border-radius:2px 2px 0 0;height:45%;opacity:0.7;"></div>
        <div style="flex:1;background:#c9a96e;border-radius:2px 2px 0 0;height:90%;opacity:0.9;"></div>
        <div style="flex:1;background:#c9a96e;border-radius:2px 2px 0 0;height:70%;opacity:0.8;"></div>
        <div style="flex:1;background:#c9a96e;border-radius:2px 2px 0 0;height:100%;"></div>
        <div style="flex:1;background:#c9a96e;border-radius:2px 2px 0 0;height:55%;opacity:0.75;"></div>
        <div style="flex:1;background:#c9a96e;border-radius:2px 2px 0 0;height:85%;opacity:0.85;"></div>
      </div>
    </div>`,
  },
  {
    name: 'footer',
    delay: 2200,
    html: `<div style="padding:0.75rem 0;border-top:1px solid #2a2926;color:#504d46;font-size:0.75rem;display:flex;justify-content:space-between;">
      <span>stream-slots v0.1.0</span>
      <span>Declarative Partial Updates</span>
    </div>`,
  },
];

/**
 * Streams a page, filling slots with staggered delays.
 */
function streamSlots(res, slots) {
  const slotEntries = slots.map((s) => ({
    name: s.name,
    fallback: `<div style="color:#504d46;font-size:0.8125rem;padding:1rem;">Loading ${s.name}...</div>`,
  }));
  const page = createPage({
    title: 'stream-slots demo',
    head: '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet"><style>*{margin:0;box-sizing:border-box}body{font-family:Inter,system-ui,sans-serif;background:#0e0d0b;color:#e8e4dc;padding:1.5rem;display:flex;flex-direction:column;gap:1rem;}</style>',
    slots: slotEntries,
  });

  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Transfer-Encoding': 'chunked',
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });

  const stream = page.stream();
  Readable.fromWeb(stream).pipe(res);

  // Fill each slot after its delay
  slots.forEach((slot) => {
    setTimeout(() => {
      try {
        page.fill(slot.name, slot.html);
      } catch {
        // Stream may have been closed
      }
    }, slot.delay);
  });

  // Close after the last slot fills + a small buffer
  const maxDelay = Math.max(...slots.map((s) => s.delay));
  setTimeout(() => {
    try {
      page.close();
    } catch {
      // Already closed
    }
  }, maxDelay + 200);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Serve playground HTML
  if (url.pathname === '/' && req.method === 'GET') {
    const htmlPath = path.join(__dirname, 'playground.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  // Serve CSS
  if (url.pathname === '/styles.css' && req.method === 'GET') {
    const cssPath = path.join(__dirname, 'public', 'styles.css');
    const css = fs.readFileSync(cssPath, 'utf-8');
    res.writeHead(200, { 'Content-Type': 'text/css; charset=utf-8' });
    res.end(css);
    return;
  }

  // Built-in demo stream
  if (url.pathname === '/stream-demo' && req.method === 'GET') {
    streamSlots(res, DEMO_SLOTS);
    return;
  }

  // Custom stream via GET with base64 config
  if (url.pathname === '/custom-stream' && req.method === 'GET') {
    const config = url.searchParams.get('config');
    if (!config) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end('Missing config query parameter');
      return;
    }
    try {
      const slots = JSON.parse(Buffer.from(config, 'base64url').toString());
      streamSlots(res, slots);
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'text/plain' });
      res.end(`Invalid config: ${err.message}`);
    }
    return;
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n  ⚡ stream-slots playground`);
  console.log(`  → http://localhost:${PORT}\n`);
  console.log(`  Demo stream:  http://localhost:${PORT}/stream-demo`);
  console.log(`  Playground:   http://localhost:${PORT}\n`);
});
