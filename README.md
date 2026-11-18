# 炉石酒馆：奥术纪元 2.0 (Tavern Cards Web)

基于纯前端构建的奇幻策略卡牌对战网页游戏（致敬《炉石传说》经典玩法与酒馆视觉体验）。

- **仓库地址**：`https://github.com/NiuCoder/tavern-cards-web`
- **在线预览 (Cloudflare Workers)**：`https://tavern-cards-web.nickenabler.workers.dev`
- **备选预览 (GitHub Pages)**：`https://niucoder.github.io/tavern-cards-web/`（需在仓库启用 Pages）

## 核心特性

1. **三大职业与专属套牌**：
   - **奥术法师（大法师艾琳）**：技能【火焰冲击】（2费点伤1），擅长【远古雕文】发现减费法术、【寒冰护体/镜像实体】奥秘与高额法强清场。
   - **圣殿骑士（圣光统帅洛萨）**：技能【白银援军】（2费召1/1新兵），擅长圣盾铺场、【石丘防御者】发现嘲讽、【奇利亚斯】磁力吸血与真银圣剑。
   - **丛林猎手（荒野游侠雷恩）**：技能【稳固射击】（2费对敌英雄打2），擅长【爆炸陷阱】奥秘、【雷霆战锤】风怒双砍、剧毒与冲锋抢血。
2. **完整炉石机制实现**：
   - 支持 **起手调度（Mulligan）**、先手3牌/后手4牌+幸运币、每回合1-10颗法力水晶递增、爆牌与疲劳伤害。
   - 支持 **发现（Discover 三选一）**、**奥秘（Secrets 触发揭晓）**、**战吼**、**亡语**、**嘲讽**、**圣盾**、**突袭**、**冲锋**、**风怒**、**吸血**、**剧毒**、**冻结**、**沉默**、**法术伤害+1** 以及 **巫妖王死骑衍生牌**。
3. **自由组牌工坊 & 地下城 Roguelike 闯关**：
   - **组牌工坊**：内置法力曲线实时分布图，支持按费用筛选并自由构筑 22 张专属套牌（本地持久化保存）。
   - **地下城三连战**：连续挑战【暗影游侠·希尔瓦】、【冰冠女巫·辛达苟萨】、【黑曜龙王·奈法利斯】，每关胜利后可三选一装备强力**远古被动宝藏**。
4. **新手引导**：首次进入会以中文分步说明胜利目标、职业与默认套牌、起手换牌和基本操作，可跳过或随时在顶栏重新打开；完成后不会改动已有胜场和套牌存档。

## 目录结构

```text
├── public/
│   ├── index.html              # 主入口页面（模块化引用 CSS/JS 与原画资源）
│   ├── standalone.html         # 单文件自包含版本（也可直接访问 /standalone）
│   ├── css/style.css           # 立体羊皮纸卡框、沙盘棋盘与动画样式
│   ├── js/game.js              # 核心状态机、卡牌数据库、Canvas 粒子弹道与 Web Audio 音效引擎
│   └── assets/portraits/       # 英雄与首领原画肖像
├── wrangler.jsonc              # Cloudflare Workers Static Assets 部署配置
├── package.json                # wrangler 开发依赖与部署脚本
└── .github/workflows/
    └── deploy-pages.yml        # GitHub Pages 自动部署流水线
```

## 本地预览与 Cloudflare 部署

游戏是纯静态前端，无需构建。在仓库根目录安装依赖后：

```bash
npm install
npx wrangler dev      # 本地预览
npx wrangler deploy   # 部署到 https://tavern-cards-web.nickenabler.workers.dev
```

推送到 `main` 后，GitHub Pages 工作流会发布 `public/` 目录（需先在仓库启用 Pages）。
