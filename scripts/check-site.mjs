// 站点自检：爬全站，检查死链、四个宽度的横向溢出、图片尺寸、文字对比度，并出整页截图。
// 零依赖：用系统自带的 Edge/Chrome 无头模式（CDP）。
//
//   npm run preview            # 先起本地服务（默认 http://localhost:4321）
//   node scripts/check-site.mjs [--base http://localhost:4321] [--shots <目录>] [--browser <浏览器路径>]
//
// 有问题的话退出码为 1。
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const args = {};
for (let i = 0; i < process.argv.length - 2; i++) {
  const a = process.argv[i + 2];
  if (!a.startsWith('--')) continue;
  const [k, v] = a.replace(/^--/, '').split('=');
  if (v !== undefined) {
    args[k] = v;
  } else {
    const next = process.argv[i + 3];
    args[k] = next && !next.startsWith('--') ? (i++, next) : true;
  }
}
const BASE = (args.base ?? 'http://localhost:4321').replace(/\/$/, '');
const ORIGIN = new URL(BASE).origin;
const SHOTS = args.shots ? path.resolve(args.shots) : null;
const BROWSERS = [
  args.browser,
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean);
const WIDTHS = [375, 768, 1280, 1440];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const note = (s) => problems.push(s);

// ---------- 1. 爬链接 ----------
const pages = [];
const seen = new Set();
const assets = new Map();
const external = new Set();
const queue = ['/'];

function normalize(href, from) {
  const u = new URL(href, ORIGIN + from);
  if (u.origin !== ORIGIN) return null;
  u.hash = '';
  return u.pathname + u.search;
}

while (queue.length) {
  const p = queue.shift();
  if (seen.has(p)) continue;
  seen.add(p);
  const res = await fetch(ORIGIN + p);
  if (res.status !== 200) {
    note(`页面 ${p} 返回 ${res.status}`);
    continue;
  }
  const type = res.headers.get('content-type') ?? '';
  if (!type.includes('text/html')) {
    assets.set(p, res.status);
    continue;
  }
  pages.push(p);
  const html = await res.text();
  const refs = new Set();
  for (const re of [/href="([^"]+)"/g, /src="([^"]+)"/g]) for (const m of html.matchAll(re)) refs.add(m[1].replaceAll('&amp;', '&'));
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) for (const part of m[1].split(',')) refs.add(part.trim().split(/\s+/)[0]);
  for (const ref of refs) {
    if (/^(mailto:|tel:|javascript:)/.test(ref) || ref === '') continue;
    if (ref.startsWith('//') || /^https?:\/\//.test(ref)) {
      if (!ref.startsWith(ORIGIN)) external.add(ref);
      continue;
    }
    const n = normalize(ref, p);
    if (!n || n === '/') {
      if (!n) external.add(ref);
      else if (!seen.has('/')) queue.push('/');
      continue;
    }
    if (/\.[a-z0-9]+$/i.test(n)) {
      if (!assets.has(n)) assets.set(n, 0);
    } else if (!seen.has(n)) {
      queue.push(n.endsWith('/') ? n : n + '/');
    }
  }
}
for (const p of ['/robots.txt', '/sitemap-index.xml', '/favicon.svg', '/404']) {
  const n = pages.includes(p) || assets.has(p) ? null : p;
  if (n) assets.set(n, 0);
}

// robots / sitemap / _redirects 里的本域地址也检查
for (const extra of ['/robots.txt', '/sitemap-index.xml']) {
  try {
    const text = await (await fetch(ORIGIN + extra)).text();
    for (const m of text.matchAll(/https?:\/\/[^\s<"]+/g)) {
      const u = new URL(m[0]);
      if (u.origin === ORIGIN) {
        const n = u.pathname + u.search;
        if (!seen.has(n) && !assets.has(n)) assets.set(n, 0);
      }
    }
  } catch {}
}

for (const [a, status] of assets) {
  if (status === 200) continue;
  const res = await fetch(ORIGIN + a, { method: 'HEAD' }).catch(() => null);
  const code = res?.status ?? 0;
  assets.set(a, code);
  // /404.html 在预览服务里按 /404 返回 200，在 Cloudflare Pages 上直接访问也是 200；两种都算正常
  if (a === '/404' ? code !== 200 && code !== 404 : code !== 200) note(`资源 ${a} 返回 ${code || '失败'}`);
}
console.log(`爬到 ${pages.length} 个页面、${assets.size} 个资源，全部返回 200。`);
if (external.size) console.log(`站外链接（未检查）：${[...external].join('  ')}`);

// ---------- 2. 起浏览器 ----------
const browser = await (async () => {
  let lastErr = null;
  for (const b of BROWSERS) {
    try {
      const dir = await mkdtemp(path.join(tmpdir(), 'site-check-'));
      const proc = spawn(
        b,
        [
          '--headless=new',
          '--remote-debugging-port=0',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-extensions',
          '--hide-scrollbars',
          '--force-device-scale-factor=1',
          `--user-data-dir=${dir}`,
          'about:blank',
        ],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      const wsUrl = await new Promise((resolve, reject) => {
        let buf = '';
        const fail = (e) => {
          clearTimeout(timer);
          reject(e);
        };
        const timer = setTimeout(() => fail(new Error('浏览器启动超时')), 15000);
        proc.stderr.on('data', (d) => {
          buf += d.toString();
          const m = buf.match(/ws:\/\/[^\s]+/);
          if (m) {
            clearTimeout(timer);
            resolve(m[0]);
          }
        });
        proc.on('error', fail);
        proc.on('exit', () => fail(new Error('浏览器提前退出')));
      });
      return { proc, wsUrl, dir };
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`找不到可用的 Edge/Chrome（${lastErr?.message ?? '?'}），请用 --browser=<路径> 指定`);
})();

const ws = new WebSocket(browser.wsUrl);
await new Promise((r, j) => {
  ws.onopen = r;
  ws.onerror = j;
});
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const { resolve, reject } = pending.get(m.id);
    pending.delete(m.id);
    if (m.error) reject(new Error(m.error.message));
    else resolve(m.result);
  }
};
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, sessionId }));
  });

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
  return r.result.value;
};

const CHECK = `(() => {
  const vw = document.documentElement.clientWidth;
  const out = { vw, scrollWidth: document.documentElement.scrollWidth, overflow: [], img: [], low: [], todo: document.querySelectorAll('.todo').length };
  const label = (el) => el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\\s+/).join('.') : '');
  for (const el of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed') continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      let p = el.parentElement, clipped = false;
      while (p && p !== document.body) {
        if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) { clipped = true; break; }
        p = p.parentElement;
      }
      if (!clipped) out.overflow.push(label(el) + ' [' + Math.round(r.left) + ',' + Math.round(r.right) + ']');
    }
  }
  for (const img of document.images) {
    if (!img.hasAttribute('width') || !img.hasAttribute('height')) out.img.push('缺尺寸属性: ' + img.currentSrc.split('/').pop());
    else if (img.complete && img.naturalWidth === 0) out.img.push('加载失败: ' + img.currentSrc);
  }
  const parse = (c) => {
    const m = c.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] };
  };
  const lum = (c) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const bgOf = (el) => {
    const layers = [];
    let p = el;
    while (p) {
      const c = parse(getComputedStyle(p).backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 0.99) break; }
      p = p.parentElement;
    }
    let base = { r: 5, g: 8, b: 13 };
    for (const c of layers.reverse()) base = { r: c.r * c.a + base.r * (1 - c.a), g: c.g * c.a + base.g * (1 - c.a), b: c.b * c.a + base.b * (1 - c.a) };
    return base;
  };
  const done = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n;
  while ((n = walker.nextNode())) {
    const text = n.textContent.trim();
    const el = n.parentElement;
    if (!text || !el || done.has(el)) continue;
    if (el.closest('script, style, .sr-only, dialog:not([open]), template')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    if (!el.getClientRects().length) continue;
    done.add(el);
    const fg = parse(cs.color);
    if (!fg) continue;
    const bg = bgOf(el);
    const l1 = lum(fg), l2 = lum(bg);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
    if (ratio < (large ? 3 : 4.5)) out.low.push(label(el) + ' 「' + text.slice(0, 16) + '」 ' + ratio.toFixed(2) + ':1');
  }
  return out;
})()`;

if (SHOTS) await mkdir(SHOTS, { recursive: true });

for (const p of pages) {
  console.log(`\n${p}`);
  for (const w of WIDTHS) {
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: 900, deviceScaleFactor: 1, mobile: w < 768 }, sessionId);
    await send('Page.navigate', { url: ORIGIN + p }, sessionId);
    for (let i = 0; i < 60; i++) {
      await sleep(150);
      if (await evaluate("document.readyState === 'complete' && location.pathname + location.search === " + JSON.stringify(p))) break;
    }
    await evaluate("document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')); 'ok'");
    await evaluate('Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; })))).then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))');
    await evaluate("window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }); 'ok'");
    await sleep(250);
    const r = await evaluate(CHECK);
    const tag = `  ${String(w).padStart(4)}px`;
    if (r.scrollWidth > r.vw) note(`${p} @${w}px 页面横向溢出（scrollWidth ${r.scrollWidth} > ${r.vw}）`);
    for (const o of r.overflow) note(`${p} @${w}px 元素超出视口：${o}`);
    for (const o of r.img) note(`${p} @${w}px 图片${o}`);
    for (const o of r.low) note(`${p} @${w}px 对比度不足：${o}`);
    console.log(`${tag}  溢出 ${r.overflow.length}  图片问题 ${r.img.length}  对比度不足 ${r.low.length}  TODO 占位 ${r.todo}`);
    if (SHOTS) {
      await evaluate("window.scrollTo({ top: 0, behavior: 'instant' }); 'ok'");
      await sleep(300);
      await evaluate('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))');
      const { cssContentSize } = await send('Page.getLayoutMetrics', {}, sessionId);
      const shot = await send(
        'Page.captureScreenshot',
        { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: Math.min(Math.ceil(cssContentSize.height), 12000), scale: 1 } },
        sessionId,
      );
      const name = (p === '/' ? 'index' : p.replace(/^\//, '').replace(/\/$/, '').replaceAll('/', '-')) + `-${w}.png`;
      await writeFile(path.join(SHOTS, name), Buffer.from(shot.data, 'base64'));
    }
  }
}

ws.close();
browser.proc.kill();
await rm(browser.dir, { recursive: true, force: true }).catch(() => {});

console.log('');
if (problems.length) {
  console.log(`发现 ${problems.length} 个问题：`);
  for (const s of [...new Set(problems)]) console.log('  - ' + s);
  process.exit(1);
}
console.log('自检通过：没有死链、没有横向溢出、图片都有尺寸且能加载、文字对比度都达标。');
process.exit(0);
