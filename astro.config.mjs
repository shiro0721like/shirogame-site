import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// 纯静态输出：只有 HTML/CSS/JS/图片。构建过程不读取任何密钥。
export default defineConfig({
  site: 'https://shirogame.top',
  trailingSlash: 'ignore',
  output: 'static',
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/404'),
    }),
  ],
  build: {
    // 站点本身没有客户端路由，样式保持外链，便于长期缓存
    inlineStylesheets: 'never',
  },
});
