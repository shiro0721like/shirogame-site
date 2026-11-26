# shirogame-site

`shirogame.top` 的站点源码：我做的游戏的陈列窗 + 下载站。纯静态，Astro 生成，托管在 Cloudflare Pages；安装包放 **GitHub Releases**（公开仓库 `shiro0721like/dorm-blitz-releases`），匿名可直接下载。

游戏仓库是另一个项目（`D:\cmdproject\game4`），这里只放站点。`dorm.shirogame.top` 是游戏服，不属于这个仓库，也不要在这里改它的任何配置。

## 本地开发

```bash
npm ci
npm run dev       # http://localhost:4321
npm run build     # 输出 dist/
npm run preview   # 本地看 dist/
```

构建过程不读任何密钥。`dist/` 里只有 HTML/CSS/JS/图片。

## 目录

```
src/
├── content/games/<slug>.md      每款作品一个文件（介绍、截图、下载入口都从这里来）
├── content/changelog/*.md       开发日志，一条一个文件
├── data/downloads.json          ★ 唯一的版本来源：版本号、日期、大小、SHA-256、直链
├── assets/games/<slug>/*.jpg    封面和截图的源图（构建时转成 AVIF/WebP）
├── pages/                       首页、/games/、/games/<slug>/、/downloads/、/changelog/、/about/、404
└── styles/tokens.css            品牌色（来自游戏本体的 src/styles.css）
```

页面里**没有硬编码的版本号**。`downloads.json` 写错（比如 `latest` 和 `releases[0]` 对不上、tag 不是 `v<version>`、文件名里没有版本号）会让构建直接失败。

## 加一款新游戏

1. 新建 `src/content/games/<slug>.md`，`slug` 用小写字母和连字符，frontmatter 照 `dorm-blitz.md` 填。文案没想好就写 `TODO(文案)`，页面会显示成占位块。
2. 截图放进 `src/assets/games/<slug>/`，用脚本处理成 1920 宽的源图：
   ```bash
   node scripts/prepare-images.mjs --slug <slug> --in <原始截图目录> cover=封面.png 01=截图1.png 02=截图2.png
   ```
   再在 md 的 `cover` / `screenshots` 里引用这些文件。
3. `src/data/downloads.json` 加一个 key（和 md 里的 `downloadId` 一致）：
   ```json
   "<slug>": { "name": "游戏名", "latest": "", "releases": [] }
   ```
4. 提交。Pages 自动部署，详情页和下载页会出现，下载区显示“暂未发布”。

首页按 `order` 排序，最小的那款显示成大卡，其余进网格——不用改布局代码。

## 发一个新版本

在**游戏仓库**里打包、在 **GitHub** 上发 Release，在**站点仓库**里改清单。

```bash
# 1. 游戏仓库：改 package.json 的 version，指定安装包将来的下载地址，然后打包
set DORM_UPDATE_URL=https://github.com/shiro0721like/dorm-blitz-releases/releases/download/v0.1.1/dorm-blitz-Setup-0.1.1.exe
npm run build && npm run desktop:dist

# 2. 把打出来的 exe 改成 ASCII 名字（中文名会变成一长串 %E5%AE%BF…）
#    "release\宿舍火并 Setup 0.1.1.exe" → dorm-blitz-Setup-0.1.1.exe

# 3. GitHub → 仓库 dorm-blitz-releases → Releases → Draft a new release
#    Tag 填 v0.1.1，标题写游戏名+版本，把 exe 拖进附件 → Publish

# 4. 站点仓库：算大小和 SHA-256，写进 downloads.json（只改清单）
npm run release:add -- "D:\cmdproject\game4\release\dorm-blitz-Setup-0.1.1.exe" --slug dorm-blitz --version 0.1.1 --notes "更新说明"

# 5. 提交站点仓库 → Pages 自动部署
```

- 文件名规范：`<slug>-Setup-<version>.exe`（安装版）、`<slug>-Portable-<version>.exe`（便携版）、`<slug>-<version>.zip`。脚本会检查文件名里有没有版本号。
- 现在 electron-builder 打出来的是 `宿舍火并 Setup 0.1.0.exe`（用的是 productName），上传前要重命名成 ASCII；想省事可以在游戏仓库的 electron-builder 配置里加 `"artifactName": "dorm-blitz-Setup-${version}.${ext}"`。
- **tag 必须是 `v<version>`**，且和 `downloads.json` 里的 `version` 对得上（构建期会校验）。
- **同一个版本号不要重新打包复用**：GitHub 的 Release 附件一旦发布就带长缓存，换了内容会互相打架。要重打就升版本号、开新 Release。
- 历史版本只追加，不删记录。不想再提供下载的旧版本，把 `url` 置空，页面会显示「已下架」；GitHub 上的旧 Release **不要删**，删了旧链接变 404，手上旧版客户端的更新检查会失败。
- `DORM_UPDATE_URL` 必须和 `downloads.json` 里的 `url` 是同一个地址，否则客户端“提示的版本”和“下载到的版本”会对不上。
- 不需要任何密钥、不需要 wrangler：上传就是浏览器里点 Release，这样构建过程也保持零 secret。

## 首次部署（只做一次）

1. 新建 GitHub 仓库并推送。
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git，选这个仓库：
   - Framework preset：Astro
   - Build command：`npm run build`，Build output directory：`dist`
   - 环境变量：`NODE_VERSION=22`
3. Pages 项目 → Custom domains：绑定 `shirogame.top` 和 `www.shirogame.top`。
4. 下载不需要额外配置：安装包在公开仓库 `shiro0721like/dorm-blitz-releases` 的 Release 里，站点只是链接过去。确认那个仓库是 **Public**，否则匿名访问会 404。
5. 按“发一个新版本”在 GitHub 发 Release。
6. 统计只开 Cloudflare Web Analytics（无 cookie），不要再接第三方统计脚本。

`dorm.shirogame.top` 的 DNS 记录和 Tunnel 路由**保持原样**，不要给根域或 `*` 加 Tunnel 路由。对外只发 `shirogame.top`，不要传播 `*.pages.dev` 链接（国内访问不稳）。

## 截图

`src/assets/games/<slug>/` 里的图是**真实游戏画面**，不是渲染的概念图。想重拍：

```bash
# 游戏仓库里先起服务器（3000）和 Vite（5173）
node_modules/electron/dist/electron.exe <站点仓库>/scripts/capture/shots.cjs --game-dir=<游戏仓库> --out=<临时目录> --mode=game
```

脚本会用游戏自带的 Electron 开真实房间，让几个机器人站到镜头前交火，再逐张截图。挑好之后用 `prepare-images.mjs` 处理进仓库。原始截图（`_raw/`）体积大，不进 git。

## 还没填的文案

站内所有 `TODO(文案)` 都是留给站主的，补完删掉占位即可：

- [ ] 首页：站点一句话定位（`src/pages/index.astro` 里改）
- [ ] 每款作品的 `tagline`（md 的 frontmatter）
- [ ] 作品正文里的“设计思路”“踩过的坑”
- [ ] 关于页：自我介绍、联系方式
- [ ] 首页/关于页的描述文案不合意的话，在 `src/data/site.ts` 改

## 不要做的事

- 不提交安装包（`*.exe`、`release/` 已在 `.gitignore`，GitHub 单文件 100MB 硬限）。
- 不把大文件放 Pages（单文件 25MiB 上限）。
- 不写后端、不加数据库、不加登录。
- 不引第三方 UI 框架或动画库。
- 不改 `dorm.shirogame.top` 的任何配置。
