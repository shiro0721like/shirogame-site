// 把同一张地图的截图拼成一张联系表（每张最多 12 格），方便挑选。
// 用法：node scripts/capture/sheet.cjs <目录> <文件名前缀> <输出.png>
const path = require('node:path');
const fs = require('node:fs');
const sharp = require('sharp');

const [dir, prefix, out] = process.argv.slice(2);
if (!dir || !prefix || !out) {
  console.error('用法：node scripts/capture/sheet.cjs <目录> <前缀> <输出.png>');
  process.exit(2);
}

const files = fs
  .readdirSync(dir)
  .filter((f) => f.startsWith(prefix) && f.endsWith('.png'))
  .sort()
  .slice(0, MAX);
const TW = 480;
const TH = 270;
const COLS = 4;
const MAX = 12;

(async () => {
  const tiles = await Promise.all(
    files.map((f, i) =>
      sharp(path.join(dir, f))
        .resize(TW, TH, { fit: 'cover' })
        .composite([
          {
            input: Buffer.from(
              `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="28"><rect width="120" height="28" fill="#05080d" fill-opacity="0.8"/><text x="8" y="20" font-family="Consolas, monospace" font-size="18" fill="#8dff6e">${f.replace('.png', '').replace(prefix, '')}</text></svg>`,
            ),
            left: 8,
            top: 8,
          },
        ])
        .png()
        .toBuffer(),
    ),
  );
  const rows = Math.ceil(tiles.length / COLS);
  await sharp({
    create: { width: TW * COLS, height: TH * rows, channels: 3, background: '#05080d' },
  })
    .composite(tiles.map((input, i) => ({ input, left: (i % COLS) * TW, top: Math.floor(i / COLS) * TH })))
    .png()
    .toFile(out);
  console.log(out, files.join(' '));
})();
