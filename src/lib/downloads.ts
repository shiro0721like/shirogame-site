/**
 * 下载清单：全站唯一的版本来源。
 * downloads.json 在构建时导入并校验，页面里不出现任何硬编码的版本号。
 */
import raw from '../data/downloads.json';

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  channel: string;
  /** 字节 */
  size: number;
  sha256: string;
  /** 指向 R2 的直链；为空表示该版本已下架 */
  url: string;
  notes?: string;
}

export interface GameDownloads {
  name: string;
  latest: string;
  /** 最新在前 */
  releases: Release[];
}

export type Downloads = Record<string, GameDownloads>;

const DOWNLOADS = raw as unknown as Downloads;

export const DOWNLOAD_BASE = 'https://dl.shirogame.top';

/** 构建期校验：清单写错直接让构建失败，而不是把错版本号发出去。 */
function validate(data: Downloads): Downloads {
  for (const [key, g] of Object.entries(data)) {
    if (!/^[a-z0-9-]+$/.test(key)) {
      throw new Error(`downloads.json：key「${key}」只能用小写字母、数字和连字符`);
    }
    if (g.releases.length === 0) {
      if (g.latest) throw new Error(`downloads.json[${key}]：releases 为空时 latest 也必须为空`);
      continue;
    }
    if (g.latest !== g.releases[0].version) {
      throw new Error(
        `downloads.json[${key}]：latest「${g.latest}」必须等于 releases[0].version「${g.releases[0].version}」（最新在前）`,
      );
    }
    const seen = new Set<string>();
    for (const r of g.releases) {
      if (seen.has(r.version)) {
        throw new Error(`downloads.json[${key}]：版本「${r.version}」重复`);
      }
      seen.add(r.version);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
        throw new Error(`downloads.json[${key}] ${r.version}：date 必须是 YYYY-MM-DD`);
      }
      if (r.url) {
        const u = new URL(r.url);
        if (u.origin !== DOWNLOAD_BASE) {
          throw new Error(`downloads.json[${key}] ${r.version}：url 必须指向 ${DOWNLOAD_BASE}，不能用 r2.dev`);
        }
        if (!u.pathname.startsWith(`/${key}/${r.version}/`)) {
          throw new Error(
            `downloads.json[${key}] ${r.version}：url 路径必须是 /${key}/${r.version}/<文件名>，实际是 ${u.pathname}`,
          );
        }
      }
    }
  }
  return data;
}

export const downloads: Downloads = validate(DOWNLOADS);

export function getDownloads(downloadId: string): GameDownloads | undefined {
  return downloads[downloadId];
}
