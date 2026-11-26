// 把原始截图处理成站点用的图片源文件（1920 宽、JPEG q90），放进 src/assets/games/<slug>/。
// 构建时 Astro 会再转成 AVIF + WebP 并生成尺寸属性，所以这里不用手动压 WebP。
//
// 用法：
//   node scripts/prepare-images.mjs --slug dorm-blitz --in <原始截图目录> cover=game/dorm-03.png 01=game/dorm-05.png ...
//   node scripts/prepare-images.mjs --og <封面图>            # 生成 1200×630 的默认分享图
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const args = process.argv.slice(2);
const opts = {};
const pairs = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const k = args[i].slice(2);
    const v = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
    opts[k] = v;
  } else {
    const [name, file] = args[i].split('=');
    if (!name || !file) throw new Error(`参数要写成 名字=文件：${args[i]}`);
    pairs.push([name, file]);
  }
}

async function toJpg(src, dest, width, quality = 90) {
  await mkdir(path.dirname(dest), { recursive: true });
  const info = await sharp(src).resize({ width, withoutEnlargement: true }).jpeg({ quality, mozjpeg: true }).toFile(dest);
  console.log(`${path.relative(root, dest)}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
  return info;
}

if (opts.og) {
  // 默认分享图：封面裁成 1200×630，压暗一点，叠上站名
  const dest = path.join(root, 'src/assets/og/default.jpg');
  const overlay = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
      <rect width="1200" height="630" fill="#05080d" opacity="0.55"/>
      <g fill="none" stroke="#8dff6e" stroke-width="4">
        <path d="M48 92V48h44"/><path d="M1108 48h44v44"/><path d="M1152 538v44h-44"/><path d="M92 582H48v-44"/>
      </g>
      <text x="96" y="190" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="96" font-weight="700" fill="#eaf2ff">我做的游戏</text>
      <text x="100" y="252" font-family="Consolas, Menlo, monospace" font-size="34" fill="#4dd4ff">shirogame.top</text>
    </svg>`,
  );
  await mkdir(path.dirname(dest), { recursive: true });
  const info = await sharp(opts.og)
    .resize(1200, 630, { fit: 'cover' })
    .composite([{ input: overlay }])
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(dest);
  console.log(`${path.relative(root, dest)}  ${info.width}x${info.height}  ${(info.size / 1024).toFixed(0)} KB`);
} else {
  if (!opts.slug || !opts.in || pairs.length === 0) {
    console.error('用法：--slug <slug> --in <原始目录> cover=文件 01=文件 ...');
    process.exit(2);
  }
  for (const [name, file] of pairs) {
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`图片名只能用小写字母、数字和连字符：${name}`);
    await toJpg(path.resolve(opts.in, file), path.join(root, 'src/assets/games', opts.slug, `${name}.jpg`), 1920);
  }
}
