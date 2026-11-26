// 一次性截图脚本：用游戏仓库自带的 Electron 打开真实游戏页面并截图（只读，不改游戏仓库）。
//
// 前置：在游戏仓库里启动服务器（3000）和 Vite（5173）。
// 用法：
//   <游戏仓库>/node_modules/electron/dist/electron.exe scripts/capture/shots.cjs
//     --game-dir=D:/cmdproject/game4 --out=<输出目录> --mode=preview|game [--maps=dorm,canyon]
//
//   preview：渲染 8 张地图的三个机位（地图预览页）
//   game：   开一个真实房间，机器人站到镜头前交火，截带 HUD 的游戏内画面
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  }),
);
const GAME_DIR = args['game-dir'];
const OUT = args.out;
const MODE = args.mode || 'preview';
const ONLY = args.maps ? args.maps.split(',') : null;
if (!GAME_DIR || !OUT) {
  console.error('need --game-dir and --out');
  process.exit(2);
}

const WebSocket = require(path.join(GAME_DIR, 'node_modules/ws'));

const W = 1920;
const H = 1080;
const GAME = 'http://localhost:3000';
const VITE = 'http://localhost:5173';
const MAPS = ['dorm', 'canyon', 'space', 'rooftop', 'harbor', 'farm', 'factory', 'dungeon'];
const CAMS = {
  hero: 'cam=62,36,70&look=0,4,0&fov=52',
  eye: 'cam=0,3.0,58&look=0,7,0&fov=72',
  top: 'cam=0,118,0.01&look=0,0,0&fov=40',
};
const HUMAN = '舍长';
const BOT_NAMES = ['隔壁老王', '301阿杰', '二楼老李', '小卖部老板'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

app.setPath('userData', path.join(OUT, '_profile'));
// 每张图用完就销毁窗口；不拦着的话销毁第一个窗口时 Electron 就会自动退出
app.on('window-all-closed', () => {});
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.commandLine.appendSwitch('lang', 'zh-CN');

function mkWindow() {
  return new BrowserWindow({
    width: W,
    height: H,
    useContentSize: true,
    show: false,
    frame: false,
    backgroundColor: '#000000',
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
}

async function waitFor(fn, timeout = 20000, step = 200) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - start > timeout) throw new Error('timeout');
    await sleep(step);
  }
}

async function save(win, file) {
  const img = await win.webContents.capturePage();
  const size = img.getSize();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, img.toPNG());
  console.log('shot', path.basename(file), `${size.width}x${size.height}`);
}

// ---------- ws 机器人 ----------
function connect() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3000/ws');
    const bot = { ws, id: '', welcome: null, snap: null, seq: 0, waiter: null };
    ws.on('message', (raw) => {
      const m = JSON.parse(raw.toString());
      if (m.t === 'welcome') {
        bot.id = m.id;
        bot.welcome = m;
        if (bot.waiter) bot.waiter(m);
      }
      if (m.t === 'snap') bot.snap = m;
    });
    ws.on('open', () => resolve(bot));
    ws.on('error', reject);
    setTimeout(() => reject(new Error('ws timeout')), 8000);
  });
}

const send = (bot, msg) => {
  try {
    bot.ws.send(JSON.stringify(msg));
  } catch {}
};

function enter(bot, msg) {
  return new Promise((resolve, reject) => {
    bot.waiter = resolve;
    setTimeout(() => reject(new Error('welcome timeout')), 8000);
    send(bot, msg);
  });
}

async function createRoom(name) {
  const bot = await connect();
  const w = await enter(bot, { t: 'create', name });
  return { bot, code: w.code, mapId: w.mapId };
}

// 房间的地图是随机的（避开最近 3 个），多开几次直到抽到想要的图
async function findRoomOn(mapId) {
  for (let i = 0; i < 80; i++) {
    const r = await createRoom('上铺');
    if (r.mapId === mapId) return r;
    r.bot.ws.close();
    await sleep(80);
  }
  throw new Error('no room on map ' + mapId);
}

// ---------- 地图预览 ----------
async function runPreview() {
  const win = mkWindow();
  for (const map of MAPS) {
    if (ONLY && !ONLY.includes(map)) continue;
    for (const [name, cam] of Object.entries(CAMS)) {
      await win.loadURL(`${VITE}/preview.html?map=${map}&${cam}&markers=0&stairs=0&seed=12345`);
      await waitFor(() => win.webContents.executeJavaScript('window.__previewReady === true'));
      await win.webContents.executeJavaScript("document.getElementById('hud').style.display='none'");
      await sleep(500);
      await save(win, path.join(OUT, '_raw', 'preview', `${map}-${name}.png`));
    }
  }
  win.destroy();
}

// ---------- 真实对局 ----------
// 机器人走到玩家视线前方、左右错开，面向玩家开火。坐标和朝向全部来自服务端快照。
function driveBots(bots) {
  const timers = bots.map((bot, i) =>
    setInterval(() => {
      const s = bot.snap;
      if (!s) return;
      const me = s.players.find((p) => p.id === bot.id);
      const human = s.players.find((p) => p.n === HUMAN);
      if (!me) return;
      const t = Date.now() / 1000;
      let f = 1;
      let r = 0;
      let fire = false;
      let yaw = me.yaw + 0.01;
      let pitch = 0;
      let jump = false;
      if (human && human.alive && me.alive) {
        const d = 6 + (i % 3) * 3;
        const side = (i % 2 ? 1 : -1) * (2.5 + i * 1.2);
        const fx = -Math.sin(human.yaw);
        const fz = -Math.cos(human.yaw);
        const rx = Math.cos(human.yaw);
        const rz = -Math.sin(human.yaw);
        const dx = human.x + fx * d + rx * side - me.x;
        const dz = human.z + fz * d + rz * side - me.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 2.5) {
          yaw = Math.atan2(-dx, -dz);
          jump = dist > 6 && (t + i) % 1.6 < 0.05;
        } else {
          yaw = Math.atan2(-(human.x - me.x), -(human.z - me.z));
          pitch = -0.04;
          r = Math.sin(t * 2.2 + i * 1.7) > 0 ? 1 : -1;
          fire = (t + i * 0.37) % 3 < 2;
          jump = (t + i) % 2.4 < 0.05;
        }
      }
      send(bot, {
        t: 'input',
        seq: ++bot.seq,
        f,
        r,
        yaw,
        pitch,
        jump,
        fire,
        reload: false,
        pickup: false,
      });
    }, 33),
  );
  return () => timers.forEach(clearInterval);
}

// 镜手：隐藏窗口里拿不到真正的指针锁，就在页面里把 pointerLockElement 指到画布（游戏自己的输入逻辑不变），
// 然后按服务端快照把镜头转向最近的机器人、开火、左右横移。画面仍是游戏实时渲染出来的。
const SENS = 0.0022;
function startPilot(wc, bots) {
  const js = (code) => wc.executeJavaScript(code).catch(() => {});
  js(`(() => {
    const c = document.querySelector('#game canvas');
    Object.defineProperty(document, 'pointerLockElement', { configurable: true, get: () => c });
    document.dispatchEvent(new Event('pointerlockchange'));
    // 真锁定后这条提示会自己消失，这里补一下
    const hint = document.querySelector('.lock-hint');
    if (hint) hint.style.display = 'none';
    window.__shot = {
      look(dx, dy) { document.dispatchEvent(new MouseEvent('mousemove', { movementX: dx, movementY: dy, bubbles: true })); },
      fire(on) {
        if (on) c.dispatchEvent(new MouseEvent('mousedown', { button: 0, bubbles: true }));
        else window.dispatchEvent(new MouseEvent('mouseup', { button: 0, bubbles: true }));
      },
    };
  })()`);

  let strafe = 'KeyD';
  const keys = setInterval(() => {
    wc.sendInputEvent({ type: 'keyUp', keyCode: strafe });
    if (strafe === 'KeyD') strafe = 'KeyA';
    else if (strafe === 'KeyA') strafe = '';
    else strafe = 'KeyD';
    if (strafe) wc.sendInputEvent({ type: 'keyDown', keyCode: strafe });
    if (Math.random() < 0.3) wc.sendInputEvent({ type: 'keyDown', keyCode: 'Space' });
  }, 1300);

  let firing = false;
  const aim = setInterval(async () => {
    const snap = bots.map((b) => b.snap).filter((s) => s && s.players)[0];
    if (!snap) return;
    const human = snap.players.find((p) => p.n === HUMAN);
    if (!human || !human.alive) {
      if (firing) {
        await js('window.__shot.fire(false)');
        firing = false;
      }
      return;
    }
    const ids = new Set(bots.map((b) => b.id));
    const targets = snap.players.filter((p) => ids.has(p.id) && p.alive);
    if (targets.length === 0) return;
    let best = targets[0];
    for (const p of targets) {
      if (Math.hypot(p.x - human.x, p.z - human.z) < Math.hypot(best.x - human.x, best.z - human.z)) best = p;
    }
    const dist = Math.hypot(best.x - human.x, best.z - human.z);
    const wantYaw = Math.atan2(-(best.x - human.x), -(best.z - human.z));
    const dy = Math.atan2(Math.sin(wantYaw - human.yaw), Math.cos(wantYaw - human.yaw));
    const wantPitch = Math.atan2(best.y + 1.0 - (human.y + 1.6), Math.max(dist, 1));
    const dp = wantPitch - human.pitch;
    if (Math.abs(dy) > 0.02 || Math.abs(dp) > 0.02) {
      await js(`window.__shot.look(${(-dy * 0.6) / SENS}, ${(-dp * 0.6) / SENS})`);
    }
    const shouldFire = Math.abs(dy) < 0.12 && dist < 26 && (Date.now() / 1000) % 4 < 2.2;
    if (shouldFire !== firing) {
      await js(`window.__shot.fire(${shouldFire})`);
      firing = shouldFire;
    }
  }, 90);

  return () => {
    clearInterval(keys);
    clearInterval(aim);
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'KeyA' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'KeyD' });
    wc.sendInputEvent({ type: 'keyUp', keyCode: 'Space' });
    void js('window.__shot.fire(false)');
  };
}

async function runGame() {
  for (const map of MAPS) {
    if (ONLY && !ONLY.includes(map)) continue;
    const room = await findRoomOn(map);
    console.log('room', room.code, room.mapId);

    const win = mkWindow();
    const wc = win.webContents;
    await win.loadURL(`${GAME}/?room=${room.code}`);
    await waitFor(() => wc.executeJavaScript("!!document.querySelector('#m-name')"));
    await wc.executeJavaScript(`(() => {
      const n = document.querySelector('#m-name');
      n.value = ${JSON.stringify(HUMAN)};
      n.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('#m-code').value = ${JSON.stringify(room.code)};
    })()`);
    // 菜单出现时 WebSocket 可能还没连上，点了也没用：等一下再点，没进房就重点
    await sleep(1500);
    const inGame = () =>
      wc.executeJavaScript("getComputedStyle(document.getElementById('hud')).display !== 'none'");
    for (let attempt = 0; attempt < 6 && !(await inGame()); attempt++) {
      await wc.executeJavaScript("document.querySelector('#m-join').click()");
      await sleep(2500);
    }
    await waitFor(inGame, 10000);
    console.log('hud visible');

    const bots = [room.bot];
    for (const name of BOT_NAMES) {
      const b = await connect();
      try {
        await enter(b, { t: 'join', code: room.code, name });
        bots.push(b);
      } catch (e) {
        console.log('bot join fail', name, e.message);
        b.ws.close();
      }
    }
    const stopBots = driveBots(bots);
    await sleep(1500);
    const stopPilot = startPilot(wc, bots);
    await sleep(5000);

    for (let n = 0; n < 12; n++) {
      await sleep(2000);
      await save(win, path.join(OUT, '_raw', 'game', `${map}-${String(n + 1).padStart(2, '0')}.png`));
    }
    stopPilot();
    stopBots();
    for (const b of bots) b.ws.close();
    win.destroy();
    await sleep(400);
  }
}

app.whenReady().then(async () => {
  try {
    fs.mkdirSync(OUT, { recursive: true });
    if (MODE === 'preview') await runPreview();
    else await runGame();
    console.log('done');
  } catch (e) {
    console.error('FAILED', e);
    process.exitCode = 1;
  } finally {
    app.quit();
  }
});
