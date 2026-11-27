---
title: 宿舍火并
titleEn: Dorm Blitz
slug: dorm-blitz
status: released
tagline: 一款可以随开随玩的沙雕第一人称枪战小游戏。
cover: ../../assets/games/dorm-blitz/cover.jpg
screenshots:
  - src: ../../assets/games/dorm-blitz/01.jpg
    alt: 宿舍地图：楼间空地上，「隔壁老王」「二楼老李」「小卖部老板」站在武器刷新圈旁，地上有掉落的武器
  - src: ../../assets/games/dorm-blitz/02.jpg
    alt: 农场谷仓地图：红色谷仓前的草地上，三名角色分散站位，命中处弹出伤害数字 12
  - src: ../../assets/games/dorm-blitz/03.jpg
    alt: 沙丘峡谷地图：土黄色岩壁和粗柱之间，「隔壁老王」「301阿杰」分立两侧，地面有掩体和武器刷新圈
  - src: ../../assets/games/dorm-blitz/04.jpg
    alt: 集装箱码头地图：黄昏下的集装箱与门式起重机前，「上铺」「隔壁老王」「二楼老李」站成一排
  - src: ../../assets/games/dorm-blitz/05.jpg
    alt: 地下车库地图：近处的「二楼老李」被击中弹出血色伤害数字，身后是「上铺」「隔壁老王」「301阿杰」
  - src: ../../assets/games/dorm-blitz/06.jpg
    alt: 轨道空间站地图：深蓝色星空下，「上铺」残血站在甲板上，右侧是「301阿杰」和一排蓝色舷窗
platform: [Windows]
genre: 第一人称射击
players: 2-8 人在线
tech: [Three.js, TypeScript, Electron, WebSocket]
firstRelease: 2026-11-24
updated: 2026-11-26
downloadId: dorm-blitz
order: 1
---

3D 低多边形第一人称联机枪战游戏。使用房间码进局，在地图中随时更换你的武器，每 45 秒轮换一次全局规则，先到 15 杀的人获得胜利。

## 玩法

- **房间码直连**：房主创建房间，把 4 位房间码发出去，其他人输码进房。2–8 人。
- **50+ 特色武器**：激光枪、等离子炮、回旋镖、鱼叉、烟花发射器、传送枪、咸鱼、法棍、披萨飞盘……地图上有 17 个武器刷新点，走过去按 `E` 拾取，8 秒后刷新。
- **30+ 轮换规则**：毒圈、子弹雨、外星突击、天黑请闭眼、木头人、枪打出头鸟等，每 45 秒全场换一条，顶部有倒计时和播报。
- **8 张随机地图**：每建一个新房间随机刷一张，见下面的「地图」。
- **对局规则**：先到 15 杀获胜，8 秒后重开；击杀回 25 血；死了 2 秒复活，手上的武器会掉在原地，可以抢。
- **操作**：`WASD` 移动，`Shift` 疾跑，`空格` 跳跃/二段跳，左键射击，右键开镜，`R` 换弹，`E` 拾取，`Tab` 计分板，`Esc` 释放鼠标。`F2` 切画质，`F3` 看网络面板。

## 地图

宿舍、沙丘峡谷、轨道空间站、废弃工厂、集装箱码头、屋顶街区、地下车库、农场谷仓。

## 技术

- 渲染：Three.js，全部是程序化几何体，没有模型、贴图和音频素材。
- 同步：服务端权威 60Hz 模拟，快照 30Hz，客户端预测与回滚，命中做延迟补偿。
- 协议：WebSocket + JSON。
- 客户端：TypeScript；桌面端是 Electron 壳。

## 联机与更新

- **同一 Wi-Fi**：客户端会自动发现房主，直接进房。
- **异地**：走固定地址 `https://dorm.shirogame.top`。
- **游戏内容热更新**：玩家连谁的服务器就加载谁的构建，房主重开服务器后，玩家进大厅会自动换新版，不用重发安装包。
- **桌面壳更新**：有新版本时，客户端内会提示下载。

<aside class="callout callout--warn">
<span class="callout-title">已知限制（不是 bug）</span>
<ul>
<li>安装包没有做代码签名。Windows SmartScreen 第一次运行会拦一次，点“更多信息 → 仍要运行”即可。</li>
<li>校园网可能无法直连同一网络里的房主，这时走固定地址。</li>
</ul>
</aside>

## 设计思路

<p><s style="color: var(--muted)">战斗爽！</s>欢笑！</p>

