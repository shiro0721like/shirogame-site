import { getCollection, type CollectionEntry } from 'astro:content';

export type GameEntry = CollectionEntry<'games'>;
export type LogEntry = CollectionEntry<'changelog'>;

/** 文案占位：站主还没写的地方统一标 TODO(文案)，页面渲染成醒目的占位块。 */
export function isTodo(text: string | undefined): boolean {
  return !!text && /^\s*TODO\b/i.test(text);
}

/** 全部作品，按 order 升序，同 order 按最近更新时间倒序。 */
export async function getGames(): Promise<GameEntry[]> {
  const games = await getCollection('games');
  for (const g of games) {
    if (g.data.slug !== g.id) {
      throw new Error(
        `src/content/games/${g.id}.md：frontmatter 的 slug「${g.data.slug}」必须和文件名「${g.id}」一致`,
      );
    }
  }
  return games.sort(
    (a, b) => a.data.order - b.data.order || b.data.updated.localeCompare(a.data.updated),
  );
}

/** 开发日志，按时间倒序。 */
export async function getLogs(): Promise<LogEntry[]> {
  const logs = await getCollection('changelog');
  return logs.sort((a, b) => b.data.date.localeCompare(a.data.date) || b.id.localeCompare(a.id));
}
