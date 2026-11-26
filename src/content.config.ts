import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** YAML 里不加引号的 2026-11-26 会被解析成 Date，这里统一成 YYYY-MM-DD 字符串。 */
const dateStr = z.preprocess(
  (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '日期要写成 YYYY-MM-DD'),
);

/**
 * 作品：每款游戏一个 Markdown 文件，文件名即 slug（要和 frontmatter 里的 slug 一致）。
 */
const games = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/games' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      titleEn: z.string().optional(),
      slug: z.string(),
      status: z.enum(['released', 'beta', 'prototype', 'paused']),
      tagline: z.string(), // 一句话，<= 24 字；没想好就写 TODO(文案)
      cover: image(),
      screenshots: z.array(z.object({ src: image(), alt: z.string() })).default([]),
      platform: z.array(z.string()),
      genre: z.string(),
      players: z.string(),
      tech: z.array(z.string()).default([]),
      firstRelease: dateStr,
      updated: dateStr,
      downloadId: z.string(), // 关联 downloads.json 的 key
      order: z.number().default(99), // 首页排序，小的在前
    }),
});

/**
 * 开发日志：一条一个 Markdown 文件，文件名即锚点 id。
 */
const changelog = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/changelog' }),
  schema: z.object({
    date: dateStr,
    title: z.string(),
    summary: z.string(),
    game: z.string().optional(), // 关联作品的 slug
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { games, changelog };
