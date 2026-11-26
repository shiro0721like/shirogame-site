/** 格式化与标签映射：纯函数，页面和组件共用。 */

export type Status = 'released' | 'beta' | 'prototype' | 'paused';

export const STATUS_LABEL: Record<Status, string> = {
  released: '已发布',
  beta: '测试版',
  prototype: '原型',
  paused: '已暂停',
};

const CHANNEL_LABEL: Record<string, string> = {
  stable: '稳定版',
  beta: '测试版',
  rc: '候选版',
};

export function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel] ?? channel;
}

/** 字节数 → 人读的大小。安装包统一按 MB 显示，和文件管理器一致。 */
export function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  const digits = i >= 2 ? 1 : 0;
  return `${n.toFixed(digits)} ${units[i]}`;
}

/** 从文件名推断分发形态：安装版 / 便携版 / 压缩包。 */
export function fileKind(url: string): string {
  const name = url.split('/').pop() ?? '';
  if (/-Setup-/.test(name)) return '安装版';
  if (/-Portable-/.test(name)) return '便携版';
  if (/\.zip$/i.test(name)) return '压缩包';
  if (/\.msi$/i.test(name)) return '安装包';
  return '文件';
}

export function fileName(url: string): string {
  return url.split('/').pop() ?? url;
}

export function shortSha(sha: string): string {
  return sha.length > 16 ? `${sha.slice(0, 12)}…` : sha;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** YYYY-MM-DD → 中文日期；格式不对就原样返回。 */
export function formatDate(date: string): string {
  const m = DATE_RE.exec(date);
  return m ? `${m[1]} 年 ${Number(m[2])} 月 ${Number(m[3])} 日` : date;
}

export function isValidDate(date: string): boolean {
  return DATE_RE.test(date);
}
