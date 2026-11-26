// 发新版本：算好大小和 SHA-256，写进 src/data/downloads.json。只改清单，不上传。
//
//   node scripts/new-release.mjs <安装包路径> --slug dorm-blitz --version 0.1.1
//     [--date 2026-12-01] [--channel stable] [--notes "更新说明"] [--url 直链] [--dry-run]
//
// 文件名规范：<slug>-Setup-<version>.exe / <slug>-Portable-<version>.exe / <slug>-<version>.zip
// 直链默认：https://github.com/shiro0721like/dorm-blitz-releases/releases/download/v<version>/<文件名>
// 发布方式：在 GitHub 上建 Release，tag 用 v<version>，把 exe 作为附件传上去。
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const JSON_PATH = path.join(root, 'src/data/downloads.json');
const BASE = 'https://github.com/shiro0721like/dorm-blitz-releases/releases/download';

const argv = process.argv.slice(2);
const file = argv.find((a) => !a.startsWith('--'));
const opts = {};
for (let i = 0; i < argv.length; i++) {
  if (!argv[i].startsWith('--')) continue;
  const k = argv[i].slice(2);
  const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
  opts[k] = v;
}

function usage(msg) {
  console.error(msg ? `错误：${msg}` : '');
  console.error('用法：node scripts/new-release.mjs <安装包路径> --slug <slug> --version <x.y.z> [--date] [--channel] [--notes] [--url] [--dry-run]');
  process.exit(1);
}

if (!file) usage('缺少安装包路径');
if (!opts.slug) usage('缺少 --slug');
if (!opts.version || !/^\d+\.\d+\.\d+$/.test(opts.version)) usage('--version 必须是 x.y.z');

const name = path.basename(file);
if (!name.includes(`-${opts.version}.`)) {
  usage(`文件名「${name}」里没有版本号 ${opts.version}。规范：<slug>-Setup-<version>.exe，改完文件名再跑。`);
}

const st = await stat(file).catch(() => null);
if (!st) usage(`找不到文件：${file}`);

const hash = createHash('sha256');
for await (const chunk of createReadStream(file)) hash.update(chunk);
const sha256 = hash.digest('hex');
const size = st.size;
const today = new Date();
const date =
  opts.date ??
  `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
const url = opts.url ?? `${BASE}/v${opts.version}/${encodeURIComponent(name)}`;

const json = JSON.parse(await readFile(JSON_PATH, 'utf8'));
const game = json[opts.slug];
if (!game) usage(`downloads.json 里没有「${opts.slug}」。先加一款作品，再发版本。`);
if (game.releases.some((r) => r.version === opts.version)) {
  usage(`downloads.json 里已经有 ${opts.slug} ${opts.version}。同一个版本号不要复用，换一个版本号。`);
}

const release = {
  version: opts.version,
  date,
  channel: opts.channel ?? 'stable',
  size,
  sha256,
  url,
  notes: opts.notes ?? '',
};
const next = structuredClone(json);
next[opts.slug].releases.unshift(release);
next[opts.slug].latest = opts.version;

console.log(`${name}`);
console.log(`  大小     ${size} 字节（${(size / 1024 / 1024).toFixed(1)} MB）`);
console.log(`  SHA-256  ${sha256}`);
console.log(`  日期     ${date}   渠道 ${release.channel}`);
console.log(`  直链     ${url}`);

if (opts['dry-run']) {
  console.log('\n--dry-run：没有写入文件。');
} else {
  await writeFile(JSON_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8');
  console.log(`\n已写入 ${path.relative(root, JSON_PATH)}。`);
}

console.log('\n下一步：');
console.log(`  1. 去 ${BASE.replace('/releases/download', '/releases/new')} 建 Release：tag 填 v${opts.version}，把 ${name} 作为附件上传，然后 Publish。`);
console.log('  2. 游戏仓库打包时把 DORM_UPDATE_URL 设成上面同一个直链，保证“提示的版本”和“下载到的版本”一致。');
if (!opts['dry-run']) console.log('  3. 提交站点仓库，Pages 会自动部署。');
