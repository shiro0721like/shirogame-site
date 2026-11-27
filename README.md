# shirogame-site

`shirogame.top` 的站点源码：作品陈列、下载中心、开发日志。纯静态，Astro 生成，托管在 Cloudflare Pages。

- 线上：<https://shirogame.top>
- 技术栈：Astro 5、TypeScript、Sharp

## 本地开发

```bash
npm ci
npm run dev      # http://localhost:4321
npm run build    # 输出 dist/
npm run preview  # 本地预览构建产物
```

## 内容在哪

- `src/content/games/<slug>.md`：每款作品的介绍与截图
- `src/content/changelog/*.md`：开发日志
- `src/data/downloads.json`：版本号、日期、大小、SHA-256、下载直链（页面里不硬编码版本号）
- `src/pages/`、`src/components/`、`src/styles/`：页面、组件与样式

改内容不需要动页面代码；`downloads.json` 写错会让构建直接失败。
