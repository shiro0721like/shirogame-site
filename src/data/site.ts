/** 全站通用信息。站名、域名、导航都在这里改。 */
export const SITE = {
  name: 'shirogame',
  title: 'shirogame',
  /** 首页与未单独写 description 的页面用的一句话 */
  description: '我做的游戏的陈列窗与下载站：作品介绍、截图、下载、版本记录与开发日志。',
  gameServer: {
    label: '宿舍火并 · 游戏服',
    url: 'https://dorm.shirogame.top',
  },
} as const;

export const NAV = [
  { href: '/games/', label: '游戏' },
  { href: '/downloads/', label: '下载' },
  { href: '/changelog/', label: '日志' },
  { href: '/about/', label: '关于' },
] as const;
