// =========================================================================
    // 1. Web Audio API 炉石风味合成音效引擎
    // =========================================================================
    const SoundFX = (() => {
      let ctx = null;
      let muted = false;

      function ensureCtx() {
        if (muted) return null;
        if (!ctx) {
          const AudioCtx = window.AudioContext || window.webkitAudioContext;
          if (AudioCtx) ctx = new AudioCtx();
        }
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
        return ctx;
      }

      function tone(freq, endFreq, duration, type = 'sine', gainVal = 0.14, delay = 0) {
        const ac = ensureCtx();
        if (!ac) return;
        const now = ac.currentTime + delay;
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        if (endFreq !== freq) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
        }
        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(gainVal, now + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
        osc.connect(gain);
        gain.connect(ac.destination);
        osc.start(now);
        osc.stop(now + duration + 0.02);
      }

      function noiseBurst(duration = 0.14, gainVal = 0.12, filterFreq = 900) {
        const ac = ensureCtx();
        if (!ac) return;
        const bufferSize = Math.floor(ac.sampleRate * duration);
        const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        const src = ac.createBufferSource();
        src.buffer = buffer;
        const filter = ac.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = filterFreq;
        const gain = ac.createGain();
        gain.gain.setValueAtTime(gainVal, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + duration);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(ac.destination);
        src.start();
      }

      return {
        toggleMute() {
          muted = !muted;
          if (!muted) ensureCtx();
          return muted;
        },
        cardDraw() {
          noiseBurst(0.09, 0.08, 1800);
          tone(420, 680, 0.09, 'triangle', 0.06);
        },
        manaGem() {
          tone(587, 880, 0.16, 'sine', 0.12);
          tone(880, 1175, 0.18, 'triangle', 0.08, 0.05);
        },
        secretPlay() {
          tone(660, 990, 0.22, 'sine', 0.11);
          tone(990, 1320, 0.25, 'triangle', 0.1, 0.1);
        },
        secretTrigger() {
          [587, 784, 1046, 1397].forEach((f, i) => tone(f, f * 1.04, 0.22, 'triangle', 0.13, i * 0.06));
        },
        discoverOpen() {
          [440, 554, 659, 880].forEach((f, i) => tone(f, f, 0.24, 'sine', 0.1, i * 0.07));
        },
        summon(isLegendary = false) {
          noiseBurst(0.16, 0.14, 320);
          tone(160, 75, 0.22, 'sawtooth', 0.15);
          if (isLegendary) {
            [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
              tone(f, f * 1.02, 0.36, 'triangle', 0.12, idx * 0.08);
            });
          }
        },
        attackHit(heavy = false) {
          noiseBurst(heavy ? 0.25 : 0.15, heavy ? 0.22 : 0.15, heavy ? 260 : 520);
          tone(heavy ? 130 : 210, 48, heavy ? 0.26 : 0.16, 'square', 0.16);
        },
        spellFire() {
          noiseBurst(0.24, 0.16, 650);
          tone(520, 140, 0.25, 'sawtooth', 0.13);
        },
        spellFrost() {
          tone(1200, 1950, 0.18, 'sine', 0.12);
          tone(1600, 920, 0.22, 'triangle', 0.1, 0.06);
        },
        heal() {
          tone(523, 659, 0.18, 'sine', 0.11);
          tone(659, 784, 0.22, 'sine', 0.11, 0.09);
        },
        shieldBreak() {
          tone(1450, 620, 0.22, 'triangle', 0.15);
          noiseBurst(0.14, 0.12, 2600);
        },
        errorWarn() {
          tone(210, 165, 0.16, 'sawtooth', 0.11);
        },
        turnStart() {
          tone(440, 554.37, 0.18, 'triangle', 0.12);
          tone(554.37, 659.25, 0.25, 'triangle', 0.13, 0.11);
        },
        victory() {
          [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
            tone(f, f, 0.35, 'triangle', 0.14, i * 0.11);
          });
        },
        defeat() {
          [392, 349.23, 311.13, 261.63].forEach((f, i) => {
            tone(f, f * 0.96, 0.38, 'sawtooth', 0.11, i * 0.15);
          });
        }
      };
    })();

    // =========================================================================
    // 2. HTML5 Canvas 粒子、弹道与贝塞尔瞄准线引擎 + DOM 物理冲撞动画
    // =========================================================================
    const FXEngine = (() => {
      const canvas = document.getElementById('fx-canvas');
      const ctx = canvas.getContext('2d');
      let particles = [];
      let projectiles = [];
      let aimLine = null;
      let rafId = null;

      function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      }

      function spawnBurst(x, y, color = '#f59e0b', count = 22, speed = 5.5) {
        for (let i = 0; i < count; i++) {
          const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
          const vel = (0.35 + Math.random() * 0.85) * speed;
          particles.push({
            x, y,
            vx: Math.cos(angle) * vel,
            vy: Math.sin(angle) * vel - 0.8,
            radius: 2.5 + Math.random() * 4.5,
            alpha: 1,
            decay: 0.022 + Math.random() * 0.02,
            color
          });
        }
      }

      function shootProjectile(x1, y1, x2, y2, color = '#fb923c', durationMs = 280, onArrive = null) {
        projectiles.push({
          x1, y1, x2, y2,
          color,
          start: performance.now(),
          duration: durationMs,
          onArrive
        });
      }

      function setAimLine(line) {
        aimLine = line;
      }

      function drawArrowHead(x, y, angle, color) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(15, 0);
        ctx.lineTo(-10, -10);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-10, 10);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.restore();
      }

      function tick(now) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (aimLine) {
          const { x1, y1, x2, y2, color } = aimLine;
          const cx = (x1 + x2) / 2;
          const cy = Math.min(y1, y2) - Math.min(90, Math.hypot(x2 - x1, y2 - y1) * 0.25);

          ctx.save();
          ctx.beginPath();
          ctx.setLineDash([11, 7]);
          ctx.lineDashOffset = -(now * 0.065);
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(cx, cy, x2, y2);
          ctx.lineWidth = 4.5;
          ctx.strokeStyle = color || '#ef4444';
          ctx.shadowColor = color || '#ef4444';
          ctx.shadowBlur = 14;
          ctx.stroke();
          ctx.restore();

          const angle = Math.atan2(y2 - cy, x2 - cx);
          drawArrowHead(x2, y2, angle, color || '#ef4444');

          ctx.save();
          ctx.beginPath();
          ctx.arc(x2, y2, 18, 0, Math.PI * 2);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = color || '#ef4444';
          ctx.stroke();
          ctx.restore();
        }

        for (let i = projectiles.length - 1; i >= 0; i--) {
          const p = projectiles[i];
          const t = Math.min(1, (now - p.start) / p.duration);
          const ease = 1 - Math.pow(1 - t, 2);
          const curX = p.x1 + (p.x2 - p.x1) * ease;
          const curY = p.y1 + (p.y2 - p.y1) * ease - Math.sin(t * Math.PI) * 36;

          particles.push({
            x: curX + (Math.random() - 0.5) * 6,
            y: curY + (Math.random() - 0.5) * 6,
            vx: (Math.random() - 0.5) * 1.2,
            vy: (Math.random() - 0.5) * 1.2,
            radius: 4 + Math.random() * 4,
            alpha: 0.85,
            decay: 0.06,
            color: p.color
          });

          ctx.save();
          ctx.beginPath();
          ctx.arc(curX, curY, 9, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 18;
          ctx.fill();
          ctx.restore();

          if (t >= 1) {
            spawnBurst(p.x2, p.y2, p.color, 24, 6);
            if (typeof p.onArrive === 'function') p.onArrive();
            projectiles.splice(i, 1);
          }
        }

        for (let i = particles.length - 1; i >= 0; i--) {
          const pt = particles[i];
          pt.x += pt.vx;
          pt.y += pt.vy;
          pt.vy += 0.09;
          pt.alpha -= pt.decay;
          if (pt.alpha <= 0) {
            particles.splice(i, 1);
            continue;
          }
          ctx.save();
          ctx.globalAlpha = Math.max(0, pt.alpha);
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
          ctx.fillStyle = pt.color;
          ctx.shadowColor = pt.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();
        }

        rafId = requestAnimationFrame(tick);
      }

      function start() {
        resize();
        if (rafId) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
      }

      return { resize, start, spawnBurst, shootProjectile, setAimLine };
    })();

    // =========================================================================
    // 3. 英雄肖像、地下城首领、被动宝藏与多图层 SVG 卡牌原画系统
    // =========================================================================
    const PORTRAITS = {
      mage: "assets/portraits/mage.jpg",
      paladin: "assets/portraits/paladin.jpg",
      hunter: "assets/portraits/hunter.jpg",
      lich: "assets/portraits/lich.jpg",
      dragon: "assets/portraits/dragon.jpg"
    };

    const HERO_CLASSES = {
      mage: {
        id: 'mage',
        name: '大法师艾琳',
        title: '奥术法师',
        portrait: PORTRAITS.mage,
        pillColor: 'bg-blue-950/90 border-blue-400 text-blue-200',
        auraStyle: '',
        skillName: '火焰冲击',
        skillIcon: '🔥',
        skillCost: 2,
        skillNeedsTarget: true,
        skillDesc: '英雄技能：对任意目标造成 1 点伤害。'
      },
      paladin: {
        id: 'paladin',
        name: '圣光统帅洛萨',
        title: '圣殿骑士',
        portrait: PORTRAITS.paladin,
        pillColor: 'bg-amber-950/90 border-amber-400 text-amber-200',
        auraStyle: 'inset 0 0 16px rgba(250, 204, 21, 0.38)',
        skillName: '白银援军',
        skillIcon: '🛡️',
        skillCost: 2,
        skillNeedsTarget: false,
        skillDesc: '英雄技能：召唤一个 1/1 的白银之手新兵。'
      },
      hunter: {
        id: 'hunter',
        name: '荒野游侠雷恩',
        title: '丛林猎手',
        portrait: PORTRAITS.hunter,
        pillColor: 'bg-emerald-950/90 border-emerald-400 text-emerald-200',
        auraStyle: 'inset 0 0 16px rgba(34, 197, 94, 0.35)',
        skillName: '稳固射击',
        skillIcon: '🏹',
        skillCost: 2,
        skillNeedsTarget: false,
        skillDesc: '英雄技能：对敌方英雄造成 2 点伤害。'
      }
    };

    const DUNGEON_BOSSES = [
      {
        stage: 1,
        name: '暗影游侠·希尔瓦',
        portrait: PORTRAITS.hunter,
        hp: 26,
        armor: 2,
        skillIcon: '🏹',
        skillTitle: '暗影冷箭（2费：对敌方英雄造成 2 点伤害）',
        mode: 'hunter'
      },
      {
        stage: 2,
        name: '冰冠女巫·辛达苟萨',
        portrait: PORTRAITS.lich,
        hp: 35,
        armor: 5,
        skillIcon: '❄️',
        skillTitle: '凛冬吐息（2费：随机冻结一个敌人并造成 1 点伤害）',
        mode: 'frost'
      },
      {
        stage: 3,
        name: '黑曜龙王·奈法利斯',
        portrait: PORTRAITS.dragon,
        hp: 45,
        armor: 8,
        skillIcon: '🔥',
        skillTitle: '灭世龙息（2费：随机对敌人造成 2 点伤害并获得 2 点护甲）',
        mode: 'dragon'
      }
    ];

    const PASSIVE_TREASURES = [
      {
        id: 'orb_of_khadgar',
        name: '卡德加的占卜宝珠',
        icon: '🔮',
        desc: '被动宝藏：你的所有法术牌法力值消耗减少 (1) 点。'
      },
      {
        id: 'silver_horn',
        name: '白银远征军号角',
        icon: '📯',
        desc: '被动宝藏：每当你召唤一个随从，使其永久获得 +1/+1。'
      },
      {
        id: 'tree_of_life',
        name: '世界之树嫩枝',
        icon: '🌿',
        desc: '被动宝藏：英雄最大生命值 +10，且在你的回合开始时恢复 2 点生命值。'
      },
      {
        id: 'astral_crystal',
        name: '星界充能水晶',
        icon: '💎',
        desc: '被动宝藏：对战开始时额外拥有 1 颗法力水晶，且起手多抽 1 张牌。'
      },
      {
        id: 'stormwind_banner',
        name: '暴风城皇家战旗',
        icon: '🚩',
        desc: '被动宝藏：你的英雄技能法力值消耗变为 (1) 点，且每回合可使用两次！'
      }
    ];

    // 多图层精致奇幻矢量插画生成器（支持 7 种奇幻视觉主题纹章）
    function makeCardArt(bg1, bg2, symbol, accent = '#fde68a', motif = 'arcane') {
      let patternSvg = '';
      if (motif === 'fire') {
        patternSvg = `
          <path d="M50 8 Q78 38 66 72 Q50 92 34 72 Q22 38 50 8 Z" fill="${accent}" opacity="0.22"/>
          <circle cx="50" cy="52" r="28" fill="none" stroke="${accent}" stroke-width="2" opacity="0.35"/>
          <path d="M15 88 L50 32 L85 88 Z" fill="${accent}" opacity="0.14"/>
        `;
      } else if (motif === 'frost') {
        patternSvg = `
          <polygon points="50,6 62,38 94,50 62,62 50,94 38,62 6,50 38,38" fill="${accent}" opacity="0.24"/>
          <polygon points="50,18 78,50 50,82 22,50" fill="none" stroke="#ffffff" stroke-width="2" opacity="0.4"/>
        `;
      } else if (motif === 'holy') {
        patternSvg = `
          <line x1="50" y1="0" x2="50" y2="100" stroke="${accent}" stroke-width="10" opacity="0.22"/>
          <line x1="0" y1="48" x2="100" y2="48" stroke="${accent}" stroke-width="10" opacity="0.22"/>
          <circle cx="50" cy="48" r="32" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.45"/>
        `;
      } else if (motif === 'beast') {
        patternSvg = `
          <path d="M18 18 L82 82 M36 12 L88 64 M12 36 L64 88" stroke="${accent}" stroke-width="4.5" stroke-linecap="round" opacity="0.24"/>
          <polygon points="0,100 28,58 55,84 78,48 100,100" fill="#000000" opacity="0.32"/>
        `;
      } else if (motif === 'mech') {
        patternSvg = `
          <circle cx="50" cy="50" r="34" fill="none" stroke="${accent}" stroke-width="6" stroke-dasharray="10 7" opacity="0.34"/>
          <circle cx="50" cy="50" r="20" fill="none" stroke="${accent}" stroke-width="2" opacity="0.45"/>
        `;
      } else if (motif === 'shadow') {
        patternSvg = `
          <ellipse cx="50" cy="50" rx="40" ry="22" transform="rotate(32 50 50)" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.35"/>
          <ellipse cx="50" cy="50" rx="40" ry="22" transform="rotate(-32 50 50)" fill="none" stroke="${accent}" stroke-width="2.5" opacity="0.35"/>
        `;
      } else {
        patternSvg = `
          <circle cx="50" cy="48" r="35" fill="none" stroke="${accent}" stroke-width="2.2" stroke-dasharray="6 4" opacity="0.42"/>
          <polygon points="50,14 80,68 20,68" fill="none" stroke="${accent}" stroke-width="1.6" opacity="0.32"/>
          <polygon points="50,82 80,28 20,28" fill="none" stroke="${accent}" stroke-width="1.6" opacity="0.32"/>
        `;
      }
      return `
        <div class="w-full h-full relative flex items-center justify-center overflow-hidden" style="background: radial-gradient(circle at 50% 35%, ${bg1} 0%, ${bg2} 95%);">
          <svg class="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${patternSvg}
          </svg>
          <div class="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/15 to-transparent pointer-events-none"></div>
          <span class="relative z-10 text-xl sm:text-2xl drop-shadow-[0_3px_6px_rgba(0,0,0,0.92)]">${symbol}</span>
        </div>
      `;
    }

    const CARD_DB = {
      coin: {
        id: 'coin', name: '幸运币', type: 'spell', cost: 0, rarity: 'common',
        art: makeCardArt('#eab308', '#422006', '🪙', '#fef08a', 'holy'),
        desc: '在本回合中，获得一颗临时法力水晶。',
        collectible: false
      },
      arcane_missiles: {
        id: 'arcane_missiles', name: '奥术飞弹', type: 'spell', cost: 1, rarity: 'common',
        baseDmg: 3, isMissile: true,
        art: makeCardArt('#9333ea', '#1e1b4b', '☄️', '#e9d5ff', 'arcane'),
        desc: '造成 $3$ 点伤害，随机分配到所有敌人身上。',
        collectible: true
      },
      elven_archer: {
        id: 'elven_archer', name: '精灵弓箭手', type: 'minion', cost: 1, atk: 1, hp: 1, rarity: 'common',
        battlecryTarget: 'any', battlecryDmg: 1,
        art: makeCardArt('#16a34a', '#052e16', '🏹', '#bbf7d0', 'beast'),
        desc: '战吼：造成 1 点伤害。',
        collectible: true
      },
      argent_squire: {
        id: 'argent_squire', name: '银色侍从', type: 'minion', cost: 1, atk: 1, hp: 1, rarity: 'common',
        keywords: ['divineShield'],
        art: makeCardArt('#f59e0b', '#451a03', '✨', '#fef9c3', 'holy'),
        desc: '圣盾。',
        collectible: true
      },
      goldshire_footman: {
        id: 'goldshire_footman', name: '闪金镇步兵', type: 'minion', cost: 1, atk: 1, hp: 2, rarity: 'common',
        keywords: ['taunt'],
        art: makeCardArt('#64748b', '#0f172a', '🛡️', '#e2e8f0', 'holy'),
        desc: '嘲讽。',
        collectible: true
      },
      mana_wyrm: {
        id: 'mana_wyrm', name: '奥术浮龙', type: 'minion', cost: 1, atk: 1, hp: 3, rarity: 'common',
        passive: 'spellBuffAtk',
        art: makeCardArt('#3b82f6', '#172554', '🐉', '#93c5fd', 'arcane'),
        desc: '每当你施放一个法术，便获得 +1 攻击力。',
        collectible: true
      },
      primordial_glyph: {
        id: 'primordial_glyph', name: '远古雕文', type: 'spell', cost: 2, rarity: 'rare',
        discoverPool: 'spell', discoverDiscount: 2,
        art: makeCardArt('#a855f7', '#2e1065', '🔯', '#f3e8ff', 'arcane'),
        desc: '发现一张法术牌，其法力值消耗减少 (2) 点。',
        collectible: true
      },
      explosive_trap: {
        id: 'explosive_trap', name: '爆炸陷阱', type: 'spell', cost: 2, rarity: 'common',
        secretType: 'onHeroAttackedAoe2', secretColor: 'bg-emerald-500 border-emerald-200',
        art: makeCardArt('#15803d', '#14532d', '🧨', '#86efac', 'fire'),
        desc: '奥秘：当你的英雄受到攻击时，对所有敌人造成 $2$ 点伤害。',
        collectible: true
      },
      frostbolt: {
        id: 'frostbolt', name: '寒冰箭', type: 'spell', cost: 2, rarity: 'common',
        targetType: 'any', baseDmg: 3, freezeTarget: true,
        art: makeCardArt('#0ea5e9', '#082f49', '❄️', '#bae6fd', 'frost'),
        desc: '对一个角色造成 $3$ 点伤害，并使其冻结。',
        collectible: true
      },
      loot_hoarder: {
        id: 'loot_hoarder', name: '战利品贮藏者', type: 'minion', cost: 2, atk: 2, hp: 1, rarity: 'common',
        deathrattle: 'draw1',
        art: makeCardArt('#ca8a04', '#292524', '💰', '#fde047', 'mech'),
        desc: '亡语：抽一张牌。',
        collectible: true
      },
      kobold_geomancer: {
        id: 'kobold_geomancer', name: '狗头人地卜师', type: 'minion', cost: 2, atk: 2, hp: 2, rarity: 'common',
        spellPower: 1,
        art: makeCardArt('#9333ea', '#3b0764', '🕯️', '#f3e8ff', 'arcane'),
        desc: '法术伤害 +1。',
        collectible: true
      },
      explosive_sheep: {
        id: 'explosive_sheep', name: '自爆绵羊', type: 'minion', cost: 2, atk: 1, hp: 1, rarity: 'common',
        deathrattle: 'aoeAllMinions2',
        art: makeCardArt('#ef4444', '#450a0a', '💣', '#fecaca', 'mech'),
        desc: '亡语：对所有随从造成 2 点伤害。',
        collectible: true
      },
      stonehill_defender: {
        id: 'stonehill_defender', name: '石丘防御者', type: 'minion', cost: 3, atk: 1, hp: 4, rarity: 'rare',
        keywords: ['taunt'], discoverPool: 'taunt',
        art: makeCardArt('#0d9488', '#134e4a', '🐢', '#99f6e4', 'holy'),
        desc: '嘲讽。战吼：发现一张具有嘲讽的随从牌。',
        collectible: true
      },
      emperor_cobra: {
        id: 'emperor_cobra', name: '帝王眼镜蛇', type: 'minion', cost: 3, atk: 2, hp: 3, rarity: 'rare',
        keywords: ['poisonous'],
        art: makeCardArt('#65a30d', '#14532d', '🐍', '#bef264', 'beast'),
        desc: '剧毒（消灭任何受到该随从伤害的随从）。',
        collectible: true
      },
      acolyte_of_pain: {
        id: 'acolyte_of_pain', name: '苦痛侍僧', type: 'minion', cost: 3, atk: 1, hp: 3, rarity: 'common',
        passive: 'drawOnDamage',
        art: makeCardArt('#6366f1', '#1e1b4b', '⛓️', '#c7d2fe', 'shadow'),
        desc: '每当该随从受到伤害时，抽一张牌。',
        collectible: true
      },
      mirror_entity: {
        id: 'mirror_entity', name: '镜像实体', type: 'spell', cost: 3, rarity: 'common',
        secretType: 'onEnemyMinionCopy', secretColor: 'bg-pink-500 border-pink-200',
        art: makeCardArt('#db2777', '#500724', '🪞', '#fbcfe8', 'arcane'),
        desc: '奥秘：当敌方打出一张随从牌后，召唤一个它的复制。',
        collectible: true
      },
      ice_barrier: {
        id: 'ice_barrier', name: '寒冰护体', type: 'spell', cost: 3, rarity: 'common',
        secretType: 'onHeroAttackedArmor8', secretColor: 'bg-pink-500 border-pink-200',
        art: makeCardArt('#38bdf8', '#0c4a6e', '🧊', '#e0f2fe', 'frost'),
        desc: '奥秘：当你的英雄受到攻击时，立即获得 8 点护甲值。',
        collectible: true
      },
      fiery_war_axe: {
        id: 'fiery_war_axe', name: '炽炎战斧', type: 'weapon', cost: 3, atk: 3, durability: 2, icon: '🪓', rarity: 'common',
        art: makeCardArt('#dc2626', '#3f1111', '🪓', '#fca5a5', 'fire'),
        desc: '装备一把 3/2 的战斧，英雄可亲自攻击。',
        collectible: true
      },
      arcane_intellect: {
        id: 'arcane_intellect', name: '奥术智慧', type: 'spell', cost: 3, rarity: 'common',
        drawCards: 2,
        art: makeCardArt('#4f46e5', '#1e1b4b', '📘', '#c7d2fe', 'arcane'),
        desc: '抽两张牌。',
        collectible: true
      },
      harvest_golem: {
        id: 'harvest_golem', name: '麦田傀儡', type: 'minion', cost: 3, atk: 2, hp: 3, rarity: 'common',
        deathrattle: 'summonDamagedGolem',
        art: makeCardArt('#d97706', '#3f2e12', '⚙️', '#fef08a', 'mech'),
        desc: '亡语：召唤一个 2/1 的损坏的傀儡。',
        collectible: true
      },
      shattered_sun: {
        id: 'shattered_sun', name: '破碎残阳祭司', type: 'minion', cost: 3, atk: 3, hp: 2, rarity: 'common',
        battlecryTarget: 'friendlyMinion', battlecryBuff: [1, 1],
        art: makeCardArt('#eab308', '#451a03', '☀️', '#fef9c3', 'holy'),
        desc: '战吼：使一个友方随从获得 +1/+1。',
        collectible: true
      },
      wolfrider: {
        id: 'wolfrider', name: '狼骑兵', type: 'minion', cost: 3, atk: 3, hp: 1, rarity: 'common',
        keywords: ['charge'],
        art: makeCardArt('#65a30d', '#1a2e05', '🐺', '#d9f99d', 'beast'),
        desc: '冲锋。',
        collectible: true
      },
      astral_mystic: {
        id: 'astral_mystic', name: '星界秘术师', type: 'minion', cost: 4, atk: 3, hp: 3, rarity: 'epic',
        discoverPool: 'legendary',
        art: makeCardArt('#7c3aed', '#1e1b4b', '🌌', '#ddd6fe', 'arcane'),
        desc: '战吼：发现一张传说或史诗品质的强力卡牌！',
        collectible: true
      },
      fireball: {
        id: 'fireball', name: '火球术', type: 'spell', cost: 4, rarity: 'rare',
        targetType: 'any', baseDmg: 6,
        art: makeCardArt('#ea580c', '#431407', '🔥', '#fed7aa', 'fire'),
        desc: '对一个目标造成 $6$ 点伤害。',
        collectible: true
      },
      polymorph: {
        id: 'polymorph', name: '变形术', type: 'spell', cost: 4, rarity: 'rare',
        targetType: 'anyMinion', morphSheep: true,
        art: makeCardArt('#ec4899', '#500724', '🐑', '#fbcfe8', 'arcane'),
        desc: '使一个随从变形成为 1/1 的绵羊。',
        collectible: true
      },
      senjin_shieldmasta: {
        id: 'senjin_shieldmasta', name: '森金持盾卫士', type: 'minion', cost: 4, atk: 3, hp: 5, rarity: 'common',
        keywords: ['taunt'],
        art: makeCardArt('#0d9488', '#042f2e', '🗿', '#99f6e4', 'beast'),
        desc: '嘲讽。',
        collectible: true
      },
      truesilver_champion: {
        id: 'truesilver_champion', name: '真银圣剑', type: 'weapon', cost: 4, atk: 4, durability: 2, icon: '🗡️', healOnAtk: 2, rarity: 'rare',
        art: makeCardArt('#3b82f6', '#1e293b', '🗡️', '#dbeafe', 'holy'),
        desc: '每当你的英雄攻击时，为其恢复 2 点生命值。',
        collectible: true
      },
      spellbreaker: {
        id: 'spellbreaker', name: '破法者', type: 'minion', cost: 4, atk: 4, hp: 3, rarity: 'rare',
        battlecryTarget: 'anyMinion', battlecrySilence: true,
        art: makeCardArt('#e11d48', '#4c0519', '🔇', '#fecdd3', 'arcane'),
        desc: '战吼：沉默一个随从，消除其所有效果。',
        collectible: true
      },
      holy_nova: {
        id: 'holy_nova', name: '神圣新星', type: 'spell', cost: 4, rarity: 'common',
        baseDmg: 2, holyNova: true,
        art: makeCardArt('#facc15', '#713f12', '🌟', '#fef9c3', 'holy'),
        desc: '对所有敌人造成 $2$ 点伤害，为所有友方恢复 2 点生命。',
        collectible: true
      },
      doomhammer: {
        id: 'doomhammer', name: '雷霆战锤', type: 'weapon', cost: 5, atk: 2, durability: 6, icon: '🔨', windfury: true, rarity: 'epic',
        art: makeCardArt('#0284c7', '#172554', '🔨', '#bae6fd', 'frost'),
        desc: '风怒（英雄每回合可挥舞战锤攻击两次！）。',
        collectible: true
      },
      zilliax: {
        id: 'zilliax', name: '奇利亚斯', type: 'minion', cost: 5, atk: 3, hp: 2, rarity: 'legendary',
        keywords: ['divineShield', 'taunt', 'lifesteal', 'rush'],
        art: makeCardArt('#f59e0b', '#3b0764', '💠', '#fef08a', 'mech'),
        desc: '圣盾，嘲讽，吸血，突袭（完美团结精准模块）。',
        collectible: true
      },
      azure_drake: {
        id: 'azure_drake', name: '碧蓝幼龙', type: 'minion', cost: 5, atk: 4, hp: 4, rarity: 'rare',
        spellPower: 1, battlecryDraw: 1,
        art: makeCardArt('#2563eb', '#0f172a', '🐲', '#bfdbfe', 'arcane'),
        desc: '法术伤害 +1。战吼：抽一张牌。',
        collectible: true
      },
      sludge_belcher: {
        id: 'sludge_belcher', name: '淤泥喷射者', type: 'minion', cost: 5, atk: 3, hp: 5, rarity: 'rare',
        keywords: ['taunt'], deathrattle: 'summonSlime',
        art: makeCardArt('#4d7c0f', '#14532d', '🧪', '#bef264', 'shadow'),
        desc: '嘲讽。亡语：召唤一个 1/2 并具有嘲讽的泥浆怪。',
        collectible: true
      },
      argent_commander: {
        id: 'argent_commander', name: '银色指挥官', type: 'minion', cost: 6, atk: 4, hp: 2, rarity: 'rare',
        keywords: ['charge', 'divineShield'],
        art: makeCardArt('#f59e0b', '#78350f', '🏇', '#fef3c7', 'holy'),
        desc: '冲锋，圣盾。',
        collectible: true
      },
      siphon_soul: {
        id: 'siphon_soul', name: '暗影虹吸', type: 'spell', cost: 6, rarity: 'rare',
        targetType: 'anyMinion', destroyMinionHeal: 3,
        art: makeCardArt('#7e22ce', '#2e1065', '🩸', '#f3e8ff', 'shadow'),
        desc: '消灭一个随从，为你的英雄恢复 3 点生命值。',
        collectible: true
      },
      flamestrike: {
        id: 'flamestrike', name: '烈焰风暴', type: 'spell', cost: 7, rarity: 'epic',
        baseDmg: 4, aoeEnemyMinions: true,
        art: makeCardArt('#dc2626', '#450a0a', '🌋', '#fed7aa', 'fire'),
        desc: '对所有敌方随从造成 $4$ 点伤害。',
        collectible: true
      },
      dr_boom: {
        id: 'dr_boom', name: '砰砰博士', type: 'minion', cost: 7, atk: 7, hp: 7, rarity: 'legendary',
        battlecryBoomBots: true,
        art: makeCardArt('#ea580c', '#1c1917', '🤖', '#fdba74', 'mech'),
        desc: '战吼：召唤两个 1/1 的砰砰机器人（亡语随机炸 1-4 血）。',
        collectible: true
      },
      lich_king: {
        id: 'lich_king', name: '巫妖王阿尔萨斯', type: 'minion', cost: 8, atk: 8, hp: 8, rarity: 'legendary',
        keywords: ['taunt'], endTurnDKCard: true,
        art: makeCardArt('#0284c7', '#082f49', '👑', '#bae6fd', 'frost'),
        desc: '嘲讽。回合结束时，随机将一张超模【死亡骑士牌】置入你的手牌！',
        collectible: true
      },
      ragnaros: {
        id: 'ragnaros', name: '炎魔之王拉格纳萨', type: 'minion', cost: 8, atk: 8, hp: 8, rarity: 'legendary',
        cantAttack: true, endTurnSnipe: 8,
        art: makeCardArt('#ef4444', '#450a0a', '☄️', '#fde047', 'fire'),
        desc: '无法攻击。回合结束时，随机对一个敌人造成 8 点伤害！',
        collectible: true
      },

      // 巫妖王专属衍生死亡骑士神卡
      dk_death_coil: {
        id: 'dk_death_coil', name: '凋零缠绕', type: 'spell', cost: 1, rarity: 'legendary',
        targetType: 'any', baseDmg: 4, drawCards: 1,
        art: makeCardArt('#10b981', '#022c22', '💀', '#a7f3d0', 'shadow'),
        desc: '死骑牌：对一个目标造成 $4$ 点伤害，并抽一张牌。',
        collectible: false
      },
      dk_army_buff: {
        id: 'dk_army_buff', name: '反魔法护罩', type: 'spell', cost: 2, rarity: 'legendary',
        buffAllFriendly: [2, 2],
        art: makeCardArt('#06b6d4', '#083344', '🛡️', '#cffafe', 'frost'),
        desc: '死骑牌：使你的所有随从获得 +2/+2 与圣盾！',
        collectible: false
      },
      dk_frostmourne: {
        id: 'dk_frostmourne', name: '霜之哀伤', type: 'weapon', cost: 3, atk: 5, durability: 2, icon: '❄️', healOnAtk: 3, rarity: 'legendary',
        art: makeCardArt('#38bdf8', '#0f172a', '⚔️', '#e0f2fe', 'frost'),
        desc: '死骑神剑：5/2 武器，每次挥剑攻击恢复 3 点生命值。',
        collectible: false
      },

      // 战场召唤衍生物
      silver_recruit: {
        id: 'silver_recruit', name: '白银新兵', type: 'minion', cost: 1, atk: 1, hp: 1, rarity: 'common',
        art: makeCardArt('#eab308', '#422006', '⚔️', '#fef9c3', 'holy'),
        desc: '白银之手新兵。', collectible: false
      },
      damaged_golem: {
        id: 'damaged_golem', name: '损坏的傀儡', type: 'minion', cost: 1, atk: 2, hp: 1, rarity: 'common',
        art: makeCardArt('#a16207', '#292524', '🔩', '#fde047', 'mech'),
        desc: '零件散落的傀儡。', collectible: false
      },
      slime_taunt: {
        id: 'slime_taunt', name: '剧毒泥浆怪', type: 'minion', cost: 1, atk: 1, hp: 2, rarity: 'common',
        keywords: ['taunt'],
        art: makeCardArt('#3f6212', '#14532d', '🟢', '#bef264', 'shadow'),
        desc: '嘲讽。', collectible: false
      },
      sheep_token: {
        id: 'sheep_token', name: '绵羊', type: 'minion', cost: 1, atk: 1, hp: 1, rarity: 'common',
        art: makeCardArt('#f8fafc', '#475569', '🐑', '#ffffff', 'beast'),
        desc: '咩～', collectible: false
      },
      boom_bot: {
        id: 'boom_bot', name: '砰砰机器人', type: 'minion', cost: 1, atk: 1, hp: 1, rarity: 'common',
        deathrattle: 'boomBotBlast',
        art: makeCardArt('#ea580c', '#292524', '🧨', '#fed7aa', 'mech'),
        desc: '亡语：随机对一个敌人造成 1-4 点伤害。', collectible: false
      }
    };

    function getRecommendedCardIds(heroId) {
      if (heroId === 'mage') {
        return [
          'arcane_missiles', 'mana_wyrm', 'mana_wyrm', 'elven_archer',
          'primordial_glyph', 'primordial_glyph', 'frostbolt', 'frostbolt',
          'kobold_geomancer', 'arcane_intellect', 'mirror_entity', 'ice_barrier',
          'stonehill_defender', 'astral_mystic', 'fireball', 'fireball',
          'polymorph', 'azure_drake', 'zilliax', 'flamestrike',
          'lich_king', 'ragnaros'
        ];
      }
      if (heroId === 'paladin') {
        return [
          'argent_squire', 'argent_squire', 'goldshire_footman', 'loot_hoarder',
          'stonehill_defender', 'stonehill_defender', 'acolyte_of_pain', 'harvest_golem',
          'shattered_sun', 'shattered_sun', 'truesilver_champion', 'truesilver_champion',
          'senjin_shieldmasta', 'spellbreaker', 'holy_nova', 'zilliax',
          'sludge_belcher', 'argent_commander', 'siphon_soul', 'dr_boom',
          'lich_king', 'ragnaros'
        ];
      }
      return [
        'arcane_missiles', 'elven_archer', 'argent_squire', 'explosive_trap',
        'explosive_trap', 'frostbolt', 'loot_hoarder', 'emperor_cobra',
        'fiery_war_axe', 'fiery_war_axe', 'wolfrider', 'wolfrider',
        'harvest_golem', 'astral_mystic', 'fireball', 'spellbreaker',
        'doomhammer', 'zilliax', 'argent_commander', 'argent_commander',
        'dr_boom', 'lich_king'
      ];
    }

    let uidSeed = 1;
    function createCardInstance(cardId, costOverride = null) {
      const tpl = CARD_DB[cardId];
      return {
        uid: 'c_' + (uidSeed++),
        cardId: tpl.id,
        cost: costOverride !== null ? Math.max(0, costOverride) : tpl.cost
      };
    }

    function createMinionInstance(cardId, owner) {
      const tpl = CARD_DB[cardId];
      const kw = tpl.keywords || [];
      let bonusAtk = 0;
      let bonusHp = 0;
      if (owner === 'player' && Game.activeTreasures.includes('silver_horn')) {
        bonusAtk = 1;
        bonusHp = 1;
      }
      const charge = kw.includes('charge');
      const rush = kw.includes('rush');
      const windfury = kw.includes('windfury');
      return {
        uid: 'm_' + (uidSeed++),
        owner,
        cardId: tpl.id,
        name: tpl.name,
        atk: tpl.atk + bonusAtk,
        baseAtk: tpl.atk,
        hp: tpl.hp + bonusHp,
        maxHp: tpl.hp + bonusHp,
        taunt: kw.includes('taunt'),
        divineShield: kw.includes('divineShield'),
        lifesteal: kw.includes('lifesteal'),
        poisonous: kw.includes('poisonous'),
        windfury,
        charge,
        rush,
        summonedThisTurn: true,
        frozen: false,
        silenced: false,
        cantAttack: Boolean(tpl.cantAttack),
        endTurnSnipe: tpl.endTurnSnipe || 0,
        endTurnDKCard: Boolean(tpl.endTurnDKCard),
        spellPower: tpl.spellPower || 0,
        passive: tpl.passive || null,
        deathrattle: tpl.deathrattle || null,
        exhausted: !(charge || rush),
        attacksLeft: windfury ? 2 : 1
      };
    }

    // =========================================================================
    // 4. 游戏全局状态机（含组牌工坊与地下城连战状态）
    // =========================================================================
    const Game = {
      heroClass: 'mage',
      difficulty: 'normal', // 'normal' | 'heroic' | 'dungeon'
      turnOrder: 'first',
      wins: 0,

      // 组牌工坊自定义套牌
      customDecks: {},
      builderDraft: [],
      builderFilter: 'all',

      // 地下城闯关进度
      dungeonStage: 0, // 0, 1, 2
      activeTreasures: [],

      phase: 'mulligan', // 'mulligan' | 'player' | 'discover' | 'enemy' | 'gameover'
      turnNumber: 1,
      cardsPlayedCount: 0,
      mulliganChoices: [],
      historyItems: [],

      selectedHandUid: null,
      pendingAction: null,
      isDragging: false,

      player: null,
      enemy: null
    };

    function loadSavedData() {
      try {
        const savedWins = localStorage.getItem('hs_tavern_wins');
        if (savedWins) Game.wins = Math.max(0, parseInt(savedWins, 10) || 0);
        const savedDecks = localStorage.getItem('hs_tavern_decks_v2');
        if (savedDecks) Game.customDecks = JSON.parse(savedDecks) || {};
      } catch (e) {}
    }

    function savePersistentData() {
      try {
        localStorage.setItem('hs_tavern_wins', String(Game.wins));
        localStorage.setItem('hs_tavern_decks_v2', JSON.stringify(Game.customDecks));
      } catch (e) {}
    }

    function buildDeckFromList(cardIds, applySpellOrb = false) {
      const deck = cardIds.map(cid => {
        const tpl = CARD_DB[cid];
        const discount = (applySpellOrb && tpl.type === 'spell') ? 1 : 0;
        return createCardInstance(cid, Math.max(0, tpl.cost - discount));
      });
      for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
      }
      return deck;
    }

    function getPlayerDeckCardIds(heroId) {
      const custom = Game.customDecks[heroId];
      if (Array.isArray(custom) && custom.length === 22 && custom.every(id => CARD_DB[id])) {
        return [...custom];
      }
      return getRecommendedCardIds(heroId);
    }

    function createParticipant(isPlayer) {
      let maxHp = 30;
      let startArmor = 0;
      let startMana = 0;
      let bossCfg = null;

      if (isPlayer) {
        if (Game.activeTreasures.includes('tree_of_life')) maxHp += 10;
        if (Game.activeTreasures.includes('astral_crystal')) startMana = 1;
      } else {
        if (Game.difficulty === 'heroic') {
          maxHp = 40;
          startArmor = 5;
        } else if (Game.difficulty === 'dungeon') {
          bossCfg = DUNGEON_BOSSES[Game.dungeonStage] || DUNGEON_BOSSES[0];
          maxHp = bossCfg.hp;
          startArmor = bossCfg.armor;
        }
      }

      const cardList = isPlayer
        ? getPlayerDeckCardIds(Game.heroClass)
        : getRecommendedCardIds(bossCfg && bossCfg.mode === 'hunter' ? 'hunter' : 'mage');

      return {
        isPlayer,
        bossCfg,
        hp: maxHp,
        maxHp,
        armor: startArmor,
        atk: 0,
        frozen: false,
        attacksDoneThisTurn: 0,
        heroPowerUsesThisTurn: 0,
        mana: startMana,
        maxMana: startMana,
        fatigue: 0,
        weapon: null,
        secrets: [], // [{ cardId, secretType, name, color }]
        deck: buildDeckFromList(cardList, isPlayer && Game.activeTreasures.includes('orb_of_khadgar')),
        hand: [],
        board: []
      };
    }

    // =========================================================================
    // 5. UI 辅助工具：日志、左侧历史行动条、悬停高清大卡预览、物理冲撞动画
    // =========================================================================
    function addLog(msg, tone = 'info', icon = '⚔️') {
      const list = document.getElementById('battle-log-list');
      const div = document.createElement('div');
      const colorMap = {
        player: 'border-sky-500/60 bg-sky-950/40 text-sky-100',
        enemy: 'border-red-500/60 bg-red-950/40 text-red-100',
        event: 'border-amber-500/60 bg-amber-950/40 text-amber-100',
        info: 'border-stone-700 bg-stone-900/70 text-stone-300'
      };
      div.className = `p-1.5 rounded border-l-2 ${colorMap[tone] || colorMap.info} leading-snug`;
      div.textContent = msg;
      list.prepend(div);
      while (list.children.length > 50) list.removeChild(list.lastChild);

      // 更新左侧炉石动作历史磁贴栏
      if (tone === 'player' || tone === 'enemy' || tone === 'event') {
        Game.historyItems.unshift({ msg, tone, icon });
        if (Game.historyItems.length > 7) Game.historyItems.pop();
        renderHistoryStrip();
      }
    }

    function renderHistoryStrip() {
      const strip = document.getElementById('history-strip');
      strip.innerHTML = '';
      Game.historyItems.forEach(item => {
        const tile = document.createElement('div');
        const border = item.tone === 'player' ? 'border-sky-400 bg-sky-950/90' : item.tone === 'enemy' ? 'border-red-400 bg-red-950/90' : 'border-amber-400 bg-amber-950/90';
        tile.className = `w-8 h-8 rounded-lg border-2 ${border} flex items-center justify-center text-sm cursor-help shadow transition hover:scale-110`;
        tile.textContent = item.icon;
        tile.title = item.msg;
        strip.appendChild(tile);
      });
    }

    function showCardZoom(tpl, currentCost = null, sp = 0) {
      const box = document.getElementById('card-zoom-preview');
      if (!tpl || window.innerWidth < 768) {
        box.classList.add('hidden');
        return;
      }
      const costVal = currentCost !== null ? currentCost : tpl.cost;
      const rarityName = tpl.rarity === 'legendary' ? '★ 传说卡牌' : tpl.rarity === 'epic' ? '◆ 史诗卡牌' : tpl.rarity === 'rare' ? '● 稀有卡牌' : '普通卡牌';
      box.innerHTML = `
        <div class="hs-card-frame rounded-2xl border-2 ${tpl.rarity === 'legendary' ? 'border-amber-400' : tpl.rarity === 'epic' ? 'border-purple-400' : tpl.rarity === 'rare' ? 'border-sky-400' : 'border-stone-400'} p-2.5 shadow-2xl">
          <div class="flex items-center justify-between mb-1">
            <span class="w-8 h-8 rounded-full mana-crystal-orb border-2 border-sky-100 text-white font-black text-base flex items-center justify-center">${costVal}</span>
            <span class="text-[11px] font-bold text-amber-200">${rarityName}</span>
          </div>
          <div class="h-28 rounded-xl overflow-hidden border-2 border-amber-700/70 shadow-inner">${tpl.art}</div>
          <div class="hs-ribbon py-1 px-2 rounded my-1.5 text-center font-fantasy font-black text-amber-100 text-sm">${tpl.name}</div>
          <div class="hs-parchment rounded-lg p-2.5 text-xs font-semibold text-center leading-relaxed min-h-[64px] flex items-center justify-center">
            <div>${formatCardDesc(tpl, sp, true)}</div>
          </div>
          ${tpl.type !== 'spell' ? `
            <div class="flex justify-between items-center mt-2 px-1">
              <span class="px-2.5 py-0.5 rounded-full atk-sword-orb text-stone-950 font-black text-xs border border-amber-950">⚔️ ${tpl.atk}</span>
              <span class="text-[11px] text-amber-200/80 font-bold">${tpl.type === 'minion' ? '随从' : '武器'}</span>
              <span class="px-2.5 py-0.5 rounded-full ${tpl.type === 'minion' ? 'hp-blood-orb text-white border-red-950' : 'bg-stone-600 text-white border-stone-300'} font-black text-xs border">${tpl.type === 'minion' ? `❤️ ${tpl.hp}` : `🛡️ ${tpl.durability}`}</span>
            </div>
          ` : ''}
        </div>
      `;
      box.classList.remove('hidden');
      box.classList.add('flex');
    }

    function hideCardZoom() {
      const box = document.getElementById('card-zoom-preview');
      box.classList.add('hidden');
      box.classList.remove('flex');
    }

    let toastTimer = null;
    function showSpeechToast(text) {
      const el = document.getElementById('speech-toast');
      el.textContent = text;
      el.classList.remove('opacity-0');
      el.classList.add('opacity-100');
      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(() => {
        el.classList.remove('opacity-100');
        el.classList.add('opacity-0');
      }, 1800);
    }

    function getEntityElement(targetId) {
      if (targetId === 'player-hero') return document.getElementById('player-hero-el');
      if (targetId === 'enemy-hero') return document.getElementById('enemy-hero-el');
      return document.querySelector(`[data-entity-uid="${targetId}"]`);
    }

    function getEntityCenter(targetId) {
      const el = getEntityElement(targetId);
      if (!el) return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }

    // 真实 DOM 飞扑碰撞与受击闪红动画
    function animateLunge(attackerId, defenderId, onImpact) {
      const atkEl = getEntityElement(attackerId);
      const defEl = getEntityElement(defenderId);
      if (!atkEl || !defEl) {
        onImpact();
        return;
      }
      const r1 = atkEl.getBoundingClientRect();
      const r2 = defEl.getBoundingClientRect();
      const dx = (r2.left + r2.width / 2 - (r1.left + r1.width / 2)) * 0.72;
      const dy = (r2.top + r2.height / 2 - (r1.top + r1.height / 2)) * 0.72;

      atkEl.style.zIndex = '90';
      atkEl.style.transform = `translate(${dx}px, ${dy}px) scale(1.16)`;

      setTimeout(() => {
        defEl.classList.add('hit-flash');
        atkEl.style.transform = '';
        atkEl.style.zIndex = '';
        onImpact();
      }, 175);
    }

    function spawnFloatingText(targetId, text, styleClass = 'bg-red-600 text-white border-red-200') {
      const pos = getEntityCenter(targetId);
      const badge = document.createElement('div');
      badge.className = `floating-badge px-2.5 py-0.5 rounded-full font-extrabold text-xs sm:text-sm border-2 shadow-xl ${styleClass}`;
      badge.style.left = `${pos.x}px`;
      badge.style.top = `${pos.y}px`;
      badge.textContent = text;
      document.body.appendChild(badge);
      setTimeout(() => badge.remove(), 1100);
    }

    function triggerBoardShake() {
      const arena = document.getElementById('board-arena');
      arena.classList.remove('shake-anim');
      void arena.offsetWidth;
      arena.classList.add('shake-anim');
    }

    function getSpellPower(side) {
      return side.board.reduce((sum, m) => sum + (m.silenced ? 0 : (m.spellPower || 0)), 0);
    }

    function formatCardDesc(tpl, sp, darkText = false) {
      return tpl.desc.replace(/\$(\d+)\$/g, (_, baseStr) => {
        const base = parseInt(baseStr, 10);
        const total = base + sp;
        if (sp > 0) {
          return `<strong class="${darkText ? 'text-emerald-700' : 'text-emerald-300'} underline font-black">*${total}*</strong>`;
        }
        return `${base}`;
      });
    }

    function getEnemyBossName() {
      if (Game.enemy && Game.enemy.bossCfg) return Game.enemy.bossCfg.name;
      return '黑曜龙王';
    }

    // =========================================================================
    // 6. 核心伤害、吸血、剧毒、苦痛抽牌、奥秘触发与亡语结算引擎
    // =========================================================================
    function drawCard(side, silent = false) {
      if (Game.phase === 'gameover') return;
      const who = side.isPlayer ? '你' : getEnemyBossName();
      const heroTargetId = side.isPlayer ? 'player-hero' : 'enemy-hero';

      if (side.deck.length === 0) {
        side.fatigue += 1;
        addLog(`⚠️ ${who}牌库已空！受到 ${side.fatigue} 点疲劳伤害！`, 'event', '💀');
        dealDamageToHero(side, side.fatigue);
        checkGameOver();
        return;
      }

      const card = side.deck.shift();
      if (side.hand.length >= 10) {
        const tpl = CARD_DB[card.cardId];
        addLog(`🔥 ${who}手牌已满，【${tpl.name}】被爆牌销毁！`, 'event', '🔥');
        spawnFloatingText(heroTargetId, `爆牌: ${tpl.name}`, 'bg-amber-700 text-amber-100 border-amber-300');
        return;
      }

      side.hand.push(card);
      if (!silent) SoundFX.cardDraw();
    }

    function dealDamageToHero(side, amount, sourceSide = null, hasLifesteal = false) {
      if (amount <= 0) return 0;
      const targetId = side.isPlayer ? 'player-hero' : 'enemy-hero';
      const pos = getEntityCenter(targetId);
      FXEngine.spawnBurst(pos.x, pos.y, '#ef4444', 18, 5);

      let rem = amount;
      if (side.armor > 0) {
        const absorbed = Math.min(side.armor, rem);
        side.armor -= absorbed;
        rem -= absorbed;
      }
      side.hp -= rem;
      spawnFloatingText(targetId, `-${amount}`, 'bg-red-600 text-white border-red-200');
      if (amount >= 5) triggerBoardShake();

      if (hasLifesteal && sourceSide) {
        healTarget(null, true, sourceSide, amount);
      }
      return amount;
    }

    function healTarget(targetObj, isHero, side, amount) {
      if (amount <= 0) return;
      SoundFX.heal();
      if (isHero) {
        const before = side.hp;
        side.hp = Math.min(side.maxHp, side.hp + amount);
        const gained = side.hp - before;
        const tid = side.isPlayer ? 'player-hero' : 'enemy-hero';
        const pos = getEntityCenter(tid);
        FXEngine.spawnBurst(pos.x, pos.y, '#4ade80', 14, 4);
        if (gained > 0) spawnFloatingText(tid, `+${gained}`, 'bg-emerald-600 text-white border-emerald-200');
      } else {
        const before = targetObj.hp;
        targetObj.hp = Math.min(targetObj.maxHp, targetObj.hp + amount);
        const gained = targetObj.hp - before;
        const pos = getEntityCenter(targetObj.uid);
        FXEngine.spawnBurst(pos.x, pos.y, '#4ade80', 14, 4);
        if (gained > 0) spawnFloatingText(targetObj.uid, `+${gained}`, 'bg-emerald-600 text-white border-emerald-200');
      }
    }

    function dealDamageToMinion(minion, amount, opts = {}) {
      if (amount <= 0) return 0;
      const pos = getEntityCenter(minion.uid);
      if (minion.divineShield) {
        minion.divineShield = false;
        SoundFX.shieldBreak();
        FXEngine.spawnBurst(pos.x, pos.y, '#fde047', 20, 5.5);
        spawnFloatingText(minion.uid, '圣盾抵消', 'bg-yellow-500 text-stone-950 border-yellow-100');
        addLog(`✨ 【${minion.name}】的圣盾抵消了伤害！`, 'info', '✨');
        return 0;
      }

      minion.hp -= amount;
      FXEngine.spawnBurst(pos.x, pos.y, '#ef4444', 16, 4.8);
      spawnFloatingText(minion.uid, `-${amount}`, 'bg-red-600 text-white border-red-200');

      // 苦痛侍僧受伤抽牌
      if (!minion.silenced && minion.passive === 'drawOnDamage') {
        const ownerSide = minion.owner === 'player' ? Game.player : Game.enemy;
        addLog(`⛓️ 【${minion.name}】受到伤害，触发抽一张牌！`, 'event', '📘');
        drawCard(ownerSide);
      }

      // 剧毒一击必杀
      if (opts.poisonous && minion.hp > 0) {
        minion.hp = 0;
        spawnFloatingText(minion.uid, '☠️ 剧毒必杀!', 'bg-lime-600 text-stone-950 border-lime-200');
        addLog(`☠️ 剧毒生效，直接消灭【${minion.name}】！`, 'event', '☠️');
      }

      // 吸血恢复英雄生命
      if (opts.lifesteal && opts.sourceSide) {
        healTarget(null, true, opts.sourceSide, amount);
      }
      return amount;
    }

    function applyDamageByDescriptor(desc, amount, opts = {}) {
      if (desc.kind === 'player-hero') dealDamageToHero(Game.player, amount, opts.sourceSide, opts.lifesteal);
      else if (desc.kind === 'enemy-hero') dealDamageToHero(Game.enemy, amount, opts.sourceSide, opts.lifesteal);
      else if (desc.kind === 'minion') dealDamageToMinion(desc.minion, amount, opts);
    }

    // 检查并触发英雄被攻击类奥秘（爆炸陷阱、寒冰护体）
    function checkHeroAttackedSecrets(defenderSide, attackerSide) {
      if (defenderSide.secrets.length === 0) return;
      const triggered = [];
      for (let i = defenderSide.secrets.length - 1; i >= 0; i--) {
        const sec = defenderSide.secrets[i];
        if (sec.secretType === 'onHeroAttackedArmor8') {
          defenderSide.secrets.splice(i, 1);
          defenderSide.armor += 8;
          triggered.push(sec);
          const tid = defenderSide.isPlayer ? 'player-hero' : 'enemy-hero';
          spawnFloatingText(tid, '❓寒冰护体 +8甲!', 'bg-sky-500 text-stone-950 border-white');
          addLog(`❓ 奥秘揭晓！【寒冰护体】触发，立即获得 8 点护甲！`, 'event', '🧊');
        } else if (sec.secretType === 'onHeroAttackedAoe2') {
          defenderSide.secrets.splice(i, 1);
          triggered.push(sec);
          const dmg = 2 + getSpellPower(defenderSide);
          triggerBoardShake();
          showSpeechToast('❓ 奥秘触发：爆炸陷阱！');
          addLog(`❓ 奥秘揭晓！【爆炸陷阱】引爆，对所有敌人造成 ${dmg} 点伤害！`, 'event', '🧨');
          dealDamageToHero(attackerSide, dmg);
          [...attackerSide.board].forEach(m => dealDamageToMinion(m, dmg));
          resolveDeaths();
        }
      }
      if (triggered.length > 0) SoundFX.secretTrigger();
    }

    // 检查并触发对手召唤随从时的奥秘（镜像实体）
    function checkMinionPlayedSecrets(summonerSide, oppSide, summonedMinion) {
      const idx = oppSide.secrets.findIndex(s => s.secretType === 'onEnemyMinionCopy');
      if (idx === -1 || oppSide.board.length >= 7) return;
      oppSide.secrets.splice(idx, 1);
      SoundFX.secretTrigger();
      const copy = createMinionInstance(summonedMinion.cardId, oppSide.isPlayer ? 'player' : 'enemy');
      copy.atk = summonedMinion.atk;
      copy.hp = summonedMinion.hp;
      copy.maxHp = summonedMinion.maxHp;
      oppSide.board.push(copy);
      showSpeechToast(`❓ 奥秘触发：镜像实体复制了【${summonedMinion.name}】！`);
      addLog(`❓ 奥秘揭晓！【镜像实体】召唤了【${summonedMinion.name}】的镜像复制！`, 'event', '🪞');
    }

    function resolveDeaths() {
      for (let loop = 0; loop < 5; loop++) {
        const deadPlayer = Game.player.board.filter(m => m.hp <= 0);
        const deadEnemy = Game.enemy.board.filter(m => m.hp <= 0);
        if (deadPlayer.length === 0 && deadEnemy.length === 0) break;

        Game.player.board = Game.player.board.filter(m => m.hp > 0);
        Game.enemy.board = Game.enemy.board.filter(m => m.hp > 0);

        const allDead = [...deadPlayer, ...deadEnemy];
        for (const m of allDead) {
          addLog(`💀 【${m.name}】阵亡。`, 'info', '💀');
          if (!m.silenced && m.deathrattle) {
            triggerDeathrattle(m);
          }
        }
      }
      checkGameOver();
    }

    function triggerDeathrattle(minion) {
      const ownerSide = minion.owner === 'player' ? Game.player : Game.enemy;
      const oppSide = minion.owner === 'player' ? Game.enemy : Game.player;

      if (minion.deathrattle === 'draw1') {
        addLog(`💀 亡语触发：【${minion.name}】抽一张牌。`, 'event', '💰');
        drawCard(ownerSide);
      } else if (minion.deathrattle === 'summonDamagedGolem') {
        if (ownerSide.board.length < 7) {
          ownerSide.board.push(createMinionInstance('damaged_golem', minion.owner));
          addLog(`⚙️ 亡语触发：召唤了 2/1 的【损坏的傀儡】。`, 'event', '⚙️');
        }
      } else if (minion.deathrattle === 'summonSlime') {
        if (ownerSide.board.length < 7) {
          ownerSide.board.push(createMinionInstance('slime_taunt', minion.owner));
          addLog(`🧪 亡语触发：召唤了 1/2 嘲讽【剧毒泥浆怪】。`, 'event', '🧪');
        }
      } else if (minion.deathrattle === 'aoeAllMinions2') {
        SoundFX.spellFire();
        triggerBoardShake();
        addLog(`💣 【自爆绵羊】爆炸！对全场所有随从造成 2 点伤害！`, 'event', '💣');
        [...Game.player.board, ...Game.enemy.board].forEach(other => {
          dealDamageToMinion(other, 2);
        });
      } else if (minion.deathrattle === 'boomBotBlast') {
        const dmg = 1 + Math.floor(Math.random() * 4);
        const candidates = [
          { kind: oppSide.isPlayer ? 'player-hero' : 'enemy-hero' },
          ...oppSide.board.filter(x => x.hp > 0).map(x => ({ kind: 'minion', minion: x }))
        ];
        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        SoundFX.spellFire();
        applyDamageByDescriptor(pick, dmg);
        const targetLabel = pick.kind === 'minion' ? `【${pick.minion.name}】` : (oppSide.isPlayer ? '你的英雄' : getEnemyBossName());
        addLog(`🧨 砰砰机器人爆炸，对${targetLabel}造成 ${dmg} 点伤害！`, 'event', '🧨');
      }
    }

    function silenceMinion(minion) {
      minion.silenced = true;
      minion.taunt = false;
      minion.divineShield = false;
      minion.lifesteal = false;
      minion.poisonous = false;
      minion.windfury = false;
      minion.rush = false;
      minion.frozen = false;
      minion.spellPower = 0;
      minion.passive = null;
      minion.deathrattle = null;
      minion.endTurnSnipe = 0;
      minion.endTurnDKCard = false;
      minion.cantAttack = false;
      minion.attacksLeft = Math.min(1, minion.attacksLeft);
      const tpl = CARD_DB[minion.cardId];
      if (minion.atk > tpl.atk) minion.atk = tpl.atk;
      if (minion.maxHp > tpl.hp) {
        minion.maxHp = tpl.hp;
        minion.hp = Math.min(minion.hp, minion.maxHp);
      }
      spawnFloatingText(minion.uid, '沉默!', 'bg-purple-700 text-white border-purple-300');
    }

    // =========================================================================
    // 7. 【发现（Discover）】弹窗与【地下城宝藏】三选一结算
    // =========================================================================
    function openDiscoverCardModal(poolType, costDiscount = 0) {
      const prevPhase = Game.phase;
      Game.phase = 'discover';
      SoundFX.discoverOpen();

      let candidates = Object.values(CARD_DB).filter(c => c.collectible);
      if (poolType === 'spell') {
        candidates = candidates.filter(c => c.type === 'spell');
      } else if (poolType === 'taunt') {
        candidates = candidates.filter(c => c.type === 'minion' && (c.keywords || []).includes('taunt'));
      } else if (poolType === 'legendary') {
        candidates = candidates.filter(c => c.rarity === 'legendary' || c.rarity === 'epic');
      }

      // 随机洗出 3 张不重复卡牌
      const shuffled = [...candidates].sort(() => Math.random() - 0.5).slice(0, 3);

      const modal = document.getElementById('discover-modal');
      document.getElementById('discover-badge').textContent = '✨ 奥术发现 (Discover)';
      document.getElementById('discover-title').textContent = costDiscount > 0 ? `挑选一张法术（法力消耗 -${costDiscount}）` : '挑选一张卡牌置入你的手牌';
      document.getElementById('discover-subtitle').textContent = '根据当前战局选择最理想的一张支援手牌';

      const grid = document.getElementById('discover-options');
      grid.innerHTML = '';

      shuffled.forEach(tpl => {
        const finalCost = Math.max(0, tpl.cost - costDiscount);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hs-card-frame rounded-2xl border-2 border-amber-400 hover:border-yellow-200 p-3 text-left transition hover:-translate-y-2 hover:shadow-[0_0_25px_rgba(250,204,21,0.65)] flex flex-col justify-between';
        btn.innerHTML = `
          <div class="w-full flex items-center justify-between mb-1.5">
            <span class="w-8 h-8 rounded-full mana-crystal-orb border-2 border-white text-white font-black text-base flex items-center justify-center">${finalCost}</span>
            <span class="text-xs font-bold text-amber-300">${tpl.rarity === 'legendary' ? '★ 传说' : tpl.rarity === 'epic' ? '◆ 史诗' : tpl.rarity === 'rare' ? '● 稀有' : '普通'}</span>
          </div>
          <div class="w-full h-28 rounded-xl overflow-hidden border-2 border-amber-700/70 mb-2">${tpl.art}</div>
          <div class="w-full hs-ribbon py-1 px-2 rounded text-center font-fantasy font-black text-amber-100 text-sm mb-1.5">${tpl.name}</div>
          <div class="w-full hs-parchment rounded-lg p-2.5 text-xs font-semibold text-center leading-snug min-h-[56px] flex items-center justify-center">
            <div>${formatCardDesc(tpl, getSpellPower(Game.player), true)}</div>
          </div>
          <div class="w-full flex justify-between items-center mt-2 text-xs font-black">
            ${tpl.type !== 'spell' ? `<span class="px-2 py-0.5 rounded-full atk-sword-orb text-stone-950">⚔️ ${tpl.atk}</span>` : '<span></span>'}
            <span class="text-amber-200">点击收入手牌</span>
            ${tpl.type === 'minion' ? `<span class="px-2 py-0.5 rounded-full hp-blood-orb text-white">❤️ ${tpl.hp}</span>` : tpl.type === 'weapon' ? `<span class="px-2 py-0.5 rounded-full bg-stone-600 text-white">🛡️ ${tpl.durability}</span>` : '<span></span>'}
          </div>
        `;
        btn.addEventListener('click', () => {
          SoundFX.cardDraw();
          if (Game.player.hand.length < 10) {
            Game.player.hand.push(createCardInstance(tpl.id, finalCost));
            addLog(`✨ 你通过【发现】选择了【${tpl.name}】置入手牌！`, 'player', '✨');
          } else {
            showSpeechToast('手牌已满 10 张，无法置入更多卡牌！');
          }
          modal.classList.add('hidden');
          Game.phase = prevPhase === 'discover' ? 'player' : prevPhase;
          renderAll();
        });
        grid.appendChild(btn);
      });

      modal.classList.remove('hidden');
    }

    function openDungeonTreasureModal() {
      Game.phase = 'discover';
      SoundFX.victory();

      const available = PASSIVE_TREASURES.filter(t => !Game.activeTreasures.includes(t.id));
      const choices = [...available].sort(() => Math.random() - 0.5).slice(0, 3);

      const modal = document.getElementById('discover-modal');
      document.getElementById('discover-badge').textContent = `🏰 地下城第 ${Game.dungeonStage} 层突破！`;
      document.getElementById('discover-title').textContent = '选择一件远古被动宝藏';
      document.getElementById('discover-subtitle').textContent = `永久强化本轮地下城征程，下一战对手：【${DUNGEON_BOSSES[Game.dungeonStage].name}】`;

      const grid = document.getElementById('discover-options');
      grid.innerHTML = '';

      choices.forEach(tr => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'hs-card-frame rounded-2xl border-2 border-amber-400 hover:border-emerald-300 p-4 text-center transition hover:-translate-y-2 hover:shadow-[0_0_25px_rgba(52,211,153,0.65)] flex flex-col items-center justify-between gap-3';
        btn.innerHTML = `
          <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-purple-900/60 border-2 border-amber-300 flex items-center justify-center text-4xl shadow-lg">${tr.icon}</div>
          <div class="font-fantasy font-black text-base text-amber-200">${tr.name}</div>
          <div class="hs-parchment rounded-xl p-3 text-xs font-semibold leading-relaxed w-full">${tr.desc}</div>
          <span class="px-4 py-1 rounded-full bg-amber-500 text-stone-950 font-black text-xs">装备宝藏 · 进入下一层</span>
        `;
        btn.addEventListener('click', () => {
          Game.activeTreasures.push(tr.id);
          modal.classList.add('hidden');
          startCurrentBattle();
        });
        grid.appendChild(btn);
      });

      modal.classList.remove('hidden');
    }

    function checkGameOver() {
      if (Game.phase === 'gameover') return true;
      const pDead = Game.player.hp <= 0;
      const eDead = Game.enemy.hp <= 0;
      if (!pDead && !eDead) return false;

      clearPendingSelection();
      hideCardZoom();

      // 地下城闯关连战推进逻辑
      if (eDead && !pDead && Game.difficulty === 'dungeon' && Game.dungeonStage < DUNGEON_BOSSES.length - 1) {
        Game.wins += 1;
        savePersistentData();
        Game.dungeonStage += 1;
        renderAll();
        setTimeout(openDungeonTreasureModal, 450);
        return true;
      }

      Game.phase = 'gameover';
      renderAll();

      const modal = document.getElementById('gameover-modal');
      const icon = document.getElementById('gameover-icon');
      const title = document.getElementById('gameover-title');
      const desc = document.getElementById('gameover-desc');

      if (eDead && !pDead) {
        Game.wins += 1;
        savePersistentData();
        SoundFX.victory();
        icon.textContent = '🏆';
        title.textContent = Game.difficulty === 'dungeon' ? '制霸地下城！' : '璀璨胜利！';
        title.className = 'font-fantasy text-2xl sm:text-3xl font-black text-amber-300 mb-2';
        desc.textContent = Game.difficulty === 'dungeon'
          ? '不可思议！你连克三大地下城首领，夺得了酒馆最高传奇荣耀！'
          : `精彩绝伦的博弈！你击败了${getEnemyBossName()}，酒馆全员为你欢呼干杯！`;
      } else if (pDead && eDead) {
        SoundFX.defeat();
        icon.textContent = '⚖️';
        title.textContent = '同归于尽！';
        title.className = 'font-fantasy text-2xl sm:text-3xl font-black text-sky-300 mb-2';
        desc.textContent = '双方英雄在烈焰中同时倒下，这是一场载入酒馆史册的平局！';
      } else {
        SoundFX.defeat();
        icon.textContent = '💀';
        title.textContent = '惜败退场';
        title.className = 'font-fantasy text-2xl sm:text-3xl font-black text-red-400 mb-2';
        desc.textContent = `${getEnemyBossName()}略胜一筹，前往【组牌工坊】微调法力曲线再战一局吧！`;
      }

      document.getElementById('stat-turns').textContent = String(Game.turnNumber);
      document.getElementById('stat-cards').textContent = String(Game.cardsPlayedCount);
      document.getElementById('stat-wins').textContent = String(Game.wins);
      document.getElementById('score-badge').textContent = `胜场: ${Game.wins}`;
      modal.classList.remove('hidden');
      return true;
    }

    // =========================================================================
    // 8. 合法目标计算（含突袭当回合仅能打随从的精准判定）与出牌/攻击执行
    // =========================================================================
    function getHeroPowerCost(side) {
      if (side.isPlayer && Game.activeTreasures.includes('stormwind_banner')) return 1;
      return HERO_CLASSES[Game.heroClass].skillCost;
    }

    function getMaxHeroPowerUses(side) {
      if (side.isPlayer && Game.activeTreasures.includes('stormwind_banner')) return 2;
      return 1;
    }

    function getValidAttackTargets(enemySide, attackerMinion = null) {
      const onlyMinions = Boolean(attackerMinion && attackerMinion.summonedThisTurn && attackerMinion.rush && !attackerMinion.charge);
      const taunts = enemySide.board.filter(m => m.taunt && m.hp > 0);
      if (taunts.length > 0) {
        return taunts.map(m => m.uid);
      }
      if (onlyMinions) {
        return enemySide.board.map(m => m.uid);
      }
      const heroId = enemySide.isPlayer ? 'player-hero' : 'enemy-hero';
      return [heroId, ...enemySide.board.map(m => m.uid)];
    }

    function getValidTargetsForCard(tpl, side, oppSide) {
      const targetSpec = tpl.targetType || tpl.battlecryTarget;
      if (!targetSpec) return [];
      const pHero = side.isPlayer ? 'player-hero' : 'enemy-hero';
      const eHero = oppSide.isPlayer ? 'player-hero' : 'enemy-hero';

      if (targetSpec === 'any') {
        return [eHero, pHero, ...oppSide.board.map(m => m.uid), ...side.board.map(m => m.uid)];
      }
      if (targetSpec === 'anyMinion') {
        return [...oppSide.board.map(m => m.uid), ...side.board.map(m => m.uid)];
      }
      if (targetSpec === 'friendlyMinion') {
        return side.board.map(m => m.uid);
      }
      return [];
    }

    function findTargetDescriptorById(targetId) {
      if (targetId === 'player-hero') return { kind: 'player-hero', side: Game.player, id: 'player-hero', label: '你的英雄' };
      if (targetId === 'enemy-hero') return { kind: 'enemy-hero', side: Game.enemy, id: 'enemy-hero', label: getEnemyBossName() };
      const pm = Game.player.board.find(m => m.uid === targetId);
      if (pm) return { kind: 'minion', minion: pm, side: Game.player, id: pm.uid, label: `【${pm.name}】` };
      const em = Game.enemy.board.find(m => m.uid === targetId);
      if (em) return { kind: 'minion', minion: em, side: Game.enemy, id: em.uid, label: `【${em.name}】` };
      return null;
    }

    function clearPendingSelection() {
      Game.selectedHandUid = null;
      Game.pendingAction = null;
      Game.isDragging = false;
      FXEngine.setAimLine(null);
      document.getElementById('targeting-banner').classList.add('hidden');
      document.getElementById('play-drop-hint').classList.add('hidden');
    }

    function canMinionAttack(m, oppSide) {
      if (m.exhausted || m.frozen || m.cantAttack || m.atk <= 0 || m.attacksLeft <= 0) return false;
      if (m.summonedThisTurn && m.rush && !m.charge && oppSide.board.length === 0) return false;
      return true;
    }

    function canHeroAttack(side) {
      const totalAtk = side.atk + (side.weapon ? side.weapon.atk : 0);
      const maxSwings = (side.weapon && side.weapon.windfury) ? 2 : 1;
      return totalAtk > 0 && !side.frozen && side.attacksDoneThisTurn < maxSwings;
    }

    function canPlayCardNow(card, side, oppSide) {
      if (card.cost > side.mana) return false;
      const tpl = CARD_DB[card.cardId];
      if (tpl.type === 'minion' && side.board.length >= 7) return false;
      if (tpl.secretType) {
        if (side.secrets.length >= 3 || side.secrets.some(s => s.cardId === tpl.id)) return false;
      }
      if (tpl.type === 'spell' && tpl.targetType && getValidTargetsForCard(tpl, side, oppSide).length === 0) return false;
      return true;
    }

    function hasAnyPlayableAction() {
      if (Game.phase !== 'player') return false;
      const p = Game.player;
      if (p.hand.some(c => canPlayCardNow(c, p, Game.enemy))) return true;
      const heroCfg = HERO_CLASSES[Game.heroClass];
      if (p.heroPowerUsesThisTurn < getMaxHeroPowerUses(p) && p.mana >= getHeroPowerCost(p)) {
        if (!(heroCfg.id === 'paladin' && p.board.length >= 7)) return true;
      }
      if (canHeroAttack(p)) return true;
      if (p.board.some(m => canMinionAttack(m, Game.enemy))) return true;
      return false;
    }

    function onHandCardClick(cardUid) {
      if (Game.phase !== 'player') return;
      const p = Game.player;
      const card = p.hand.find(c => c.uid === cardUid);
      if (!card) return;
      const tpl = CARD_DB[card.cardId];

      if (Game.selectedHandUid === cardUid && (!Game.pendingAction || Game.pendingAction.validTargets.length === 0)) {
        executePlayCard(p, Game.enemy, cardUid, null);
        return;
      }

      clearPendingSelection();

      if (card.cost > p.mana) {
        SoundFX.errorWarn();
        showSpeechToast('我没有足够的法力值！');
        renderAll();
        return;
      }
      if (tpl.type === 'minion' && p.board.length >= 7) {
        SoundFX.errorWarn();
        showSpeechToast('战场上随从已经满了（最多 7 个）！');
        renderAll();
        return;
      }
      if (tpl.secretType && (p.secrets.length >= 3 || p.secrets.some(s => s.cardId === tpl.id))) {
        SoundFX.errorWarn();
        showSpeechToast('同名奥秘已挂载或奥秘栏已满！');
        renderAll();
        return;
      }

      const validTargets = getValidTargetsForCard(tpl, p, Game.enemy);
      if (tpl.type === 'spell' && tpl.targetType && validTargets.length === 0) {
        SoundFX.errorWarn();
        showSpeechToast('场上没有有效的法术目标！');
        renderAll();
        return;
      }

      Game.selectedHandUid = cardUid;
      if (validTargets.length > 0) {
        Game.pendingAction = {
          kind: 'card',
          cardUid,
          validTargets
        };
        const banner = document.getElementById('targeting-banner');
        document.getElementById('targeting-text').textContent = `正在使用【${tpl.name}】：请点击高亮目标`;
        banner.classList.remove('hidden');
      } else {
        document.getElementById('play-drop-hint').classList.remove('hidden');
      }
      renderAll();
    }

    function executePlayCard(side, oppSide, cardUid, targetId) {
      const idx = side.hand.findIndex(c => c.uid === cardUid);
      if (idx === -1) return;
      const card = side.hand[idx];
      const tpl = CARD_DB[card.cardId];
      if (!canPlayCardNow(card, side, oppSide)) return;

      side.mana -= card.cost;
      side.hand.splice(idx, 1);
      if (side.isPlayer) Game.cardsPlayedCount += 1;
      const who = side.isPlayer ? '你' : getEnemyBossName();
      const tone = side.isPlayer ? 'player' : 'enemy';
      const sp = getSpellPower(side);

      clearPendingSelection();
      hideCardZoom();

      // 法术联动奥术浮龙 +1 攻
      if (tpl.type === 'spell') {
        side.board.forEach(m => {
          if (!m.silenced && m.passive === 'spellBuffAtk') {
            m.atk += 1;
            spawnFloatingText(m.uid, '+1 攻', 'bg-sky-600 text-white border-sky-200');
          }
        });
      }

      // 奥秘挂载
      if (tpl.secretType) {
        SoundFX.secretPlay();
        side.secrets.push({
          cardId: tpl.id,
          secretType: tpl.secretType,
          name: tpl.name,
          color: tpl.secretColor || 'bg-pink-500 border-pink-200'
        });
        addLog(`❓ ${who}挂上了一道神秘的【奥秘】！`, tone, '❓');
        renderAll();
        return;
      }

      // 装备武器
      if (tpl.type === 'weapon') {
        SoundFX.summon(tpl.rarity === 'legendary');
        side.weapon = {
          name: tpl.name,
          atk: tpl.atk,
          durability: tpl.durability,
          icon: tpl.icon || '⚔️',
          healOnAtk: tpl.healOnAtk || 0,
          windfury: Boolean(tpl.windfury)
        };
        addLog(`⚔️ ${who}装备了武器【${tpl.name}】(${tpl.atk}/${tpl.durability})。`, tone, tpl.icon || '⚔️');
        renderAll();
        return;
      }

      // 召唤随从
      if (tpl.type === 'minion') {
        SoundFX.summon(tpl.rarity === 'legendary');
        const minion = createMinionInstance(tpl.id, side.isPlayer ? 'player' : 'enemy');
        side.board.push(minion);
        addLog(`📣 ${who}召唤了【${tpl.name}】(${minion.atk}/${minion.hp})。`, tone, '🛡️');
        renderAll();

        const spawnPos = getEntityCenter(minion.uid);
        if (tpl.rarity === 'legendary') {
          FXEngine.spawnBurst(spawnPos.x, spawnPos.y, '#f59e0b', 36, 7);
        }

        if (tpl.battlecryDraw) {
          for (let d = 0; d < tpl.battlecryDraw; d++) drawCard(side);
        }
        if (tpl.battlecryBoomBots) {
          for (let b = 0; b < 2; b++) {
            if (side.board.length < 7) {
              side.board.push(createMinionInstance('boom_bot', side.isPlayer ? 'player' : 'enemy'));
            }
          }
          addLog(`🤖 砰砰博士召唤了两个【砰砰机器人】！`, 'event', '🤖');
        }
        if (targetId) {
          const desc = findTargetDescriptorById(targetId);
          if (desc) {
            if (tpl.battlecryDmg) {
              SoundFX.attackHit(false);
              applyDamageByDescriptor(desc, tpl.battlecryDmg);
              addLog(`🏹 【${tpl.name}】战吼对${desc.label}造成 ${tpl.battlecryDmg} 点伤害。`, 'event', '🏹');
            }
            if (tpl.battlecryBuff && desc.kind === 'minion') {
              desc.minion.atk += tpl.battlecryBuff[0];
              desc.minion.hp += tpl.battlecryBuff[1];
              desc.minion.maxHp += tpl.battlecryBuff[1];
              SoundFX.heal();
              spawnFloatingText(desc.id, `+${tpl.battlecryBuff[0]}/+${tpl.battlecryBuff[1]}`, 'bg-amber-500 text-stone-950 border-amber-100');
              addLog(`☀️ 【${tpl.name}】使${desc.label}获得 +1/+1。`, 'event', '☀️');
            }
            if (tpl.battlecrySilence && desc.kind === 'minion') {
              silenceMinion(desc.minion);
              addLog(`🔇 【${tpl.name}】沉默了${desc.label}！`, 'event', '🔇');
            }
          }
        }

        // 检查对手【镜像实体】奥秘
        checkMinionPlayedSecrets(side, oppSide, minion);

        resolveDeaths();
        renderAll();

        // 战吼发现（玩家弹出三选一，AI 自动随机选一张）
        if (tpl.discoverPool && Game.phase !== 'gameover') {
          if (side.isPlayer) {
            openDiscoverCardModal(tpl.discoverPool, tpl.discoverDiscount || 0);
          } else if (side.hand.length < 10) {
            const pool = Object.values(CARD_DB).filter(c => c.collectible && (tpl.discoverPool === 'taunt' ? (c.keywords || []).includes('taunt') : c.rarity === 'legendary'));
            const pick = pool[Math.floor(Math.random() * pool.length)];
            if (pick) side.hand.push(createCardInstance(pick.id));
          }
        }
        return;
      }

      // 普通与特殊法术牌结算
      if (tpl.id === 'coin') {
        SoundFX.manaGem();
        side.mana = Math.min(10, side.mana + 1);
        addLog(`🪙 ${who}使用【幸运币】，本回合获得 1 颗法力水晶。`, tone, '🪙');
        renderAll();
        return;
      }

      if (tpl.discoverPool) {
        addLog(`🔯 ${who}施放【${tpl.name}】，开启奥术发现！`, tone, '🔯');
        if (side.isPlayer) {
          openDiscoverCardModal(tpl.discoverPool, tpl.discoverDiscount || 0);
        } else if (side.hand.length < 10) {
          const spells = Object.values(CARD_DB).filter(c => c.collectible && c.type === 'spell');
          const pick = spells[Math.floor(Math.random() * spells.length)];
          if (pick) side.hand.push(createCardInstance(pick.id, Math.max(0, pick.cost - (tpl.discoverDiscount || 0))));
        }
        renderAll();
        return;
      }

      if (tpl.buffAllFriendly) {
        SoundFX.heal();
        side.board.forEach(m => {
          m.atk += tpl.buffAllFriendly[0];
          m.hp += tpl.buffAllFriendly[1];
          m.maxHp += tpl.buffAllFriendly[1];
          m.divineShield = true;
          spawnFloatingText(m.uid, '+2/+2 圣盾', 'bg-cyan-500 text-stone-950 border-white');
        });
        addLog(`🛡️ ${who}施放【${tpl.name}】，全体友方随从获得 +2/+2 与圣盾！`, tone, '🛡️');
        renderAll();
        return;
      }

      if (tpl.destroyMinionHeal && targetId) {
        const desc = findTargetDescriptorById(targetId);
        if (desc && desc.kind === 'minion') {
          SoundFX.spellFire();
          desc.minion.hp = 0;
          spawnFloatingText(desc.id, '🩸 虹吸消灭!', 'bg-purple-700 text-white border-purple-200');
          healTarget(null, true, side, tpl.destroyMinionHeal);
          addLog(`🩸 ${who}施放【暗影虹吸】消灭了${desc.label}，并恢复 ${tpl.destroyMinionHeal} 点生命！`, tone, '🩸');
          resolveDeaths();
        }
        renderAll();
        return;
      }

      if (tpl.drawCards && !tpl.baseDmg) {
        SoundFX.manaGem();
        addLog(`📘 ${who}施放【${tpl.name}】，抽 ${tpl.drawCards} 张牌。`, tone, '📘');
        for (let i = 0; i < tpl.drawCards; i++) drawCard(side);
        renderAll();
        return;
      }

      if (tpl.isMissile) {
        const totalMissiles = tpl.baseDmg + sp;
        addLog(`☄️ ${who}施放【奥术飞弹】，发射 ${totalMissiles} 枚飞弹！`, tone, '☄️');
        const fromPos = getEntityCenter(side.isPlayer ? 'player-hero' : 'enemy-hero');
        for (let m = 0; m < totalMissiles; m++) {
          setTimeout(() => {
            if (Game.phase === 'gameover') return;
            const pool = [
              { kind: oppSide.isPlayer ? 'player-hero' : 'enemy-hero', id: oppSide.isPlayer ? 'player-hero' : 'enemy-hero' },
              ...oppSide.board.filter(x => x.hp > 0).map(x => ({ kind: 'minion', minion: x, id: x.uid }))
            ];
            const pick = pool[Math.floor(Math.random() * pool.length)];
            const toPos = getEntityCenter(pick.id);
            SoundFX.spellFire();
            FXEngine.shootProjectile(fromPos.x, fromPos.y, toPos.x, toPos.y, '#c084fc', 220, () => {
              applyDamageByDescriptor(pick, 1);
              resolveDeaths();
              renderAll();
            });
          }, m * 145);
        }
        renderAll();
        return;
      }

      if (tpl.morphSheep && targetId) {
        const desc = findTargetDescriptorById(targetId);
        if (desc && desc.kind === 'minion') {
          SoundFX.spellFrost();
          const b = desc.side.board;
          const mIdx = b.findIndex(x => x.uid === desc.id);
          if (mIdx !== -1) {
            const oldName = b[mIdx].name;
            const sheep = createMinionInstance('sheep_token', desc.side.isPlayer ? 'player' : 'enemy');
            b[mIdx] = sheep;
            renderAll();
            spawnFloatingText(sheep.uid, '咩～ 1/1', 'bg-pink-600 text-white border-pink-200');
            addLog(`🐑 ${who}施放【变形术】，将【${oldName}】变成了 1/1 的绵羊！`, tone, '🐑');
            return;
          }
        }
        renderAll();
        return;
      }

      if (tpl.holyNova) {
        const dmg = tpl.baseDmg + sp;
        SoundFX.heal();
        triggerBoardShake();
        addLog(`🌟 ${who}施放【神圣新星】，对所有敌人造成 ${dmg} 点伤害并为友方恢复 2 点生命！`, tone, '🌟');
        dealDamageToHero(oppSide, dmg);
        [...oppSide.board].forEach(m => dealDamageToMinion(m, dmg));
        healTarget(null, true, side, 2);
        side.board.forEach(m => healTarget(m, false, side, 2));
        resolveDeaths();
        renderAll();
        return;
      }

      if (tpl.aoeEnemyMinions) {
        const dmg = tpl.baseDmg + sp;
        SoundFX.spellFire();
        triggerBoardShake();
        addLog(`🌋 ${who}施放【${tpl.name}】，对所有敌方随从造成 ${dmg} 点伤害！`, tone, '🌋');
        [...oppSide.board].forEach(m => dealDamageToMinion(m, dmg));
        resolveDeaths();
        renderAll();
        return;
      }

      if (tpl.baseDmg && targetId) {
        const desc = findTargetDescriptorById(targetId);
        if (desc) {
          const dmg = tpl.baseDmg + sp;
          const fromPos = getEntityCenter(side.isPlayer ? 'player-hero' : 'enemy-hero');
          const toPos = getEntityCenter(desc.id);
          const color = tpl.freezeTarget ? '#38bdf8' : tpl.id === 'dk_death_coil' ? '#10b981' : '#f97316';
          if (tpl.freezeTarget) SoundFX.spellFrost();
          else SoundFX.spellFire();

          addLog(`🔥 ${who}对${desc.label}施放【${tpl.name}】，造成 ${dmg} 点伤害${tpl.freezeTarget ? '并冻结' : ''}！`, tone, '🔥');
          FXEngine.shootProjectile(fromPos.x, fromPos.y, toPos.x, toPos.y, color, 250, () => {
            applyDamageByDescriptor(desc, dmg);
            if (tpl.freezeTarget) {
              if (desc.kind === 'minion') desc.minion.frozen = true;
              else desc.side.frozen = true;
            }
            if (tpl.drawCards) {
              for (let d = 0; d < tpl.drawCards; d++) drawCard(side);
            }
            resolveDeaths();
            renderAll();
          });
        }
        renderAll();
      }
    }

    function onHeroPowerClick() {
      if (Game.phase !== 'player') return;
      const p = Game.player;
      const cfg = HERO_CLASSES[Game.heroClass];
      const cost = getHeroPowerCost(p);
      const maxUses = getMaxHeroPowerUses(p);

      if (p.heroPowerUsesThisTurn >= maxUses) {
        SoundFX.errorWarn();
        showSpeechToast('本回合英雄技能使用次数已用尽！');
        return;
      }
      if (p.mana < cost) {
        SoundFX.errorWarn();
        showSpeechToast('法力值不足，无法使用英雄技能！');
        return;
      }
      if (cfg.id === 'paladin' && p.board.length >= 7) {
        SoundFX.errorWarn();
        showSpeechToast('战场随从已满，无法召唤新兵！');
        return;
      }

      clearPendingSelection();

      if (cfg.skillNeedsTarget) {
        const validTargets = ['enemy-hero', 'player-hero', ...Game.enemy.board.map(m => m.uid), ...p.board.map(m => m.uid)];
        Game.pendingAction = { kind: 'heropower', validTargets };
        document.getElementById('targeting-text').textContent = `英雄技能【${cfg.skillName}】：请选择目标`;
        document.getElementById('targeting-banner').classList.remove('hidden');
        renderAll();
        return;
      }

      p.mana -= cost;
      p.heroPowerUsesThisTurn += 1;
      if (cfg.id === 'paladin') {
        SoundFX.summon(false);
        p.board.push(createMinionInstance('silver_recruit', 'player'));
        addLog(`🛡️ 你使用【白银援军】，召唤了白银新兵。`, 'player', '🛡️');
      } else if (cfg.id === 'hunter') {
        const fromPos = getEntityCenter('player-hero');
        const toPos = getEntityCenter('enemy-hero');
        SoundFX.spellFire();
        addLog(`🏹 你使用【稳固射击】，对${getEnemyBossName()}造成 2 点伤害！`, 'player', '🏹');
        FXEngine.shootProjectile(fromPos.x, fromPos.y, toPos.x, toPos.y, '#22c55e', 240, () => {
          dealDamageToHero(Game.enemy, 2);
          checkGameOver();
          renderAll();
        });
      }
      renderAll();
    }

    function executeHeroPowerTargeted(targetId) {
      const p = Game.player;
      const cost = getHeroPowerCost(p);
      if (p.heroPowerUsesThisTurn >= getMaxHeroPowerUses(p) || p.mana < cost) return;
      const desc = findTargetDescriptorById(targetId);
      if (!desc) return;

      p.mana -= cost;
      p.heroPowerUsesThisTurn += 1;
      clearPendingSelection();

      const fromPos = getEntityCenter('player-hero');
      const toPos = getEntityCenter(desc.id);
      SoundFX.spellFire();
      addLog(`🔥 你使用【火焰冲击】，对${desc.label}造成 1 点伤害。`, 'player', '🔥');
      FXEngine.shootProjectile(fromPos.x, fromPos.y, toPos.x, toPos.y, '#fb923c', 230, () => {
        applyDamageByDescriptor(desc, 1);
        resolveDeaths();
        renderAll();
      });
      renderAll();
    }

    function initiateAttackFrom(attackerId) {
      if (Game.phase !== 'player') return;
      const p = Game.player;
      let atkMinion = null;

      if (attackerId === 'player-hero') {
        if (!canHeroAttack(p)) {
          if (p.frozen) showSpeechToast('角色已被冻结，本回合无法攻击！');
          else showSpeechToast('你的英雄本回合攻击次数已用尽！');
          return;
        }
      } else {
        atkMinion = p.board.find(x => x.uid === attackerId);
        if (!atkMinion) return;
        if (!canMinionAttack(atkMinion, Game.enemy)) {
          SoundFX.errorWarn();
          if (atkMinion.cantAttack) showSpeechToast('该随从无法主动发起攻击！');
          else if (atkMinion.frozen) showSpeechToast('随从已被冻结，无法攻击！');
          else if (atkMinion.summonedThisTurn && atkMinion.rush && Game.enemy.board.length === 0) {
            showSpeechToast('具有【突袭】的随从登场首回合只能攻击敌方随从！');
          } else if (atkMinion.exhausted) showSpeechToast('随从刚登场需要准备一回合（突袭/冲锋除外）！');
          else showSpeechToast('该随从本回合攻击次数已用尽！');
          return;
        }
      }

      clearPendingSelection();
      const validTargets = getValidAttackTargets(Game.enemy, atkMinion);
      Game.pendingAction = {
        kind: 'attack',
        sourceUid: attackerId,
        validTargets
      };
      document.getElementById('targeting-text').textContent = atkMinion && atkMinion.summonedThisTurn && atkMinion.rush && !atkMinion.charge
        ? '【突袭】激活：请选择要攻击的敌方随从'
        : '请选择要攻击的敌方目标';
      document.getElementById('targeting-banner').classList.remove('hidden');
      renderAll();
    }

    function executeAttack(attackerSide, defenderSide, attackerId, targetId, onComplete = null) {
      const isHeroAttacker = attackerId === 'player-hero' || attackerId === 'enemy-hero';
      const atkMinion = isHeroAttacker ? null : attackerSide.board.find(m => m.uid === attackerId);
      const valid = getValidAttackTargets(defenderSide, atkMinion);

      if (!valid.includes(targetId)) {
        if (attackerSide.isPlayer) {
          SoundFX.errorWarn();
          if (atkMinion && atkMinion.summonedThisTurn && atkMinion.rush && !atkMinion.charge && targetId === 'enemy-hero') {
            showSpeechToast('【突袭】随从登场当回合不能攻击敌方英雄！');
          } else {
            showSpeechToast('你必须先攻击具有嘲讽的随从！');
          }
        }
        if (onComplete) onComplete();
        return false;
      }

      clearPendingSelection();

      animateLunge(attackerId, targetId, () => {
        // 如果攻击目标是敌方英雄，先结算防御方的奥秘（如爆炸陷阱可能直接炸死进攻随从！）
        if (targetId === 'player-hero' || targetId === 'enemy-hero') {
          checkHeroAttackedSecrets(defenderSide, attackerSide);
          if (Game.phase === 'gameover') {
            if (onComplete) onComplete();
            return;
          }
          // 若攻击随从已被爆炸陷阱炸死，则中止后续命中
          if (!isHeroAttacker && (!atkMinion || atkMinion.hp <= 0 || !attackerSide.board.includes(atkMinion))) {
            renderAll();
            if (onComplete) onComplete();
            return;
          }
        }

        const targetDesc = findTargetDescriptorById(targetId);
        if (!targetDesc) {
          if (onComplete) onComplete();
          return;
        }

        const tone = attackerSide.isPlayer ? 'player' : 'enemy';

        if (isHeroAttacker) {
          const totalAtk = attackerSide.atk + (attackerSide.weapon ? attackerSide.weapon.atk : 0);
          if (totalAtk <= 0) {
            if (onComplete) onComplete();
            return;
          }
          attackerSide.attacksDoneThisTurn += 1;

          if (attackerSide.weapon && attackerSide.weapon.healOnAtk) {
            healTarget(null, true, attackerSide, attackerSide.weapon.healOnAtk);
          }

          SoundFX.attackHit(totalAtk >= 4);
          const who = attackerSide.isPlayer ? '你的英雄' : getEnemyBossName();
          if (targetDesc.kind === 'minion') {
            const defM = targetDesc.minion;
            addLog(`⚔️ ${who}劈砍${targetDesc.label}！`, tone, '⚔️');
            dealDamageToMinion(defM, totalAtk);
            if (defM.atk > 0) dealDamageToHero(attackerSide, defM.atk);
          } else {
            addLog(`⚔️ ${who}直击敌方英雄，造成 ${totalAtk} 点伤害！`, tone, '⚔️');
            dealDamageToHero(defenderSide, totalAtk);
          }

          if (attackerSide.weapon) {
            attackerSide.weapon.durability -= 1;
            if (attackerSide.weapon.durability <= 0) {
              addLog(`🔨 武器【${attackerSide.weapon.name}】耐久耗尽碎裂。`, 'info', '🔨');
              attackerSide.weapon = null;
            }
          }
        } else if (atkMinion) {
          atkMinion.attacksLeft -= 1;
          SoundFX.attackHit(atkMinion.atk >= 5);

          if (targetDesc.kind === 'minion') {
            const defM = targetDesc.minion;
            addLog(`⚔️ 【${atkMinion.name}】与${targetDesc.label}激烈交锋！`, tone, '⚔️');
            const dmgToDef = atkMinion.atk;
            const dmgToAtk = defM.atk;
            dealDamageToMinion(defM, dmgToDef, {
              lifesteal: !atkMinion.silenced && atkMinion.lifesteal,
              poisonous: !atkMinion.silenced && atkMinion.poisonous,
              sourceSide: attackerSide
            });
            if (dmgToAtk > 0) {
              dealDamageToMinion(atkMinion, dmgToAtk, {
                lifesteal: !defM.silenced && defM.lifesteal,
                poisonous: !defM.silenced && defM.poisonous,
                sourceSide: defenderSide
              });
            }
          } else {
            addLog(`⚔️ 【${atkMinion.name}】攻击${targetDesc.label}，造成 ${atkMinion.atk} 点伤害！`, tone, '⚔️');
            dealDamageToHero(
              defenderSide,
              atkMinion.atk,
              attackerSide,
              !atkMinion.silenced && atkMinion.lifesteal
            );
          }
        }

        resolveDeaths();
        renderAll();
        if (onComplete) onComplete();
      });

      return true;
    }

    function onEntityInteract(entityId) {
      if (Game.phase !== 'player') return;

      if (Game.pendingAction) {
        const act = Game.pendingAction;
        if (act.validTargets.includes(entityId)) {
          if (act.kind === 'card') {
            executePlayCard(Game.player, Game.enemy, act.cardUid, entityId);
          } else if (act.kind === 'heropower') {
            executeHeroPowerTargeted(entityId);
          } else if (act.kind === 'attack') {
            executeAttack(Game.player, Game.enemy, act.sourceUid, entityId);
          }
          return;
        }
        if (act.kind === 'attack' && (entityId === 'enemy-hero' || Game.enemy.board.some(m => m.uid === entityId))) {
          const srcM = Game.player.board.find(x => x.uid === act.sourceUid);
          SoundFX.errorWarn();
          if (srcM && srcM.summonedThisTurn && srcM.rush && !srcM.charge && entityId === 'enemy-hero') {
            showSpeechToast('【突袭】随从登场当回合不能攻击敌方英雄！');
          } else {
            showSpeechToast('你必须先攻击具有嘲讽的随从！');
          }
          return;
        }
        if (entityId === 'player-hero' || Game.player.board.some(m => m.uid === entityId)) {
          initiateAttackFrom(entityId);
          return;
        }
        clearPendingSelection();
        renderAll();
        return;
      }

      if (Game.selectedHandUid) {
        executePlayCard(Game.player, Game.enemy, Game.selectedHandUid, null);
        return;
      }

      if (entityId === 'player-hero' || Game.player.board.some(m => m.uid === entityId)) {
        initiateAttackFrom(entityId);
      }
    }

    // =========================================================================
    // 9. 回合流转、巫妖王赐牌、大罗斯炎爆与智能首领 AI 引擎
    // =========================================================================
    function processEndOfTurnEffects(activeSide, oppSide, callback) {
      // 1. 巫妖王回合末赐予死亡骑士神卡
      const lichKings = activeSide.board.filter(m => !m.silenced && m.endTurnDKCard && m.hp > 0);
      lichKings.forEach(() => {
        if (activeSide.hand.length < 10) {
          const dkPool = ['dk_death_coil', 'dk_army_buff', 'dk_frostmourne'];
          const pickId = dkPool[Math.floor(Math.random() * dkPool.length)];
          activeSide.hand.push(createCardInstance(pickId));
          SoundFX.spellFrost();
          const tid = activeSide.isPlayer ? 'player-hero' : 'enemy-hero';
          spawnFloatingText(tid, `👑 获得【${CARD_DB[pickId].name}】`, 'bg-cyan-600 text-white border-cyan-100');
          addLog(`👑 【巫妖王阿尔萨斯】赐予了一张死亡骑士神卡！`, 'event', '👑');
        }
      });

      // 2. 炎魔之王回合末 8 伤陨石轰击
      const snipers = activeSide.board.filter(m => !m.silenced && m.endTurnSnipe > 0 && m.hp > 0);
      if (snipers.length === 0) {
        renderAll();
        callback();
        return;
      }
      let idx = 0;
      function nextSnipe() {
        if (idx >= snipers.length || Game.phase === 'gameover') {
          callback();
          return;
        }
        const rag = snipers[idx++];
        const pool = [
          { kind: oppSide.isPlayer ? 'player-hero' : 'enemy-hero', id: oppSide.isPlayer ? 'player-hero' : 'enemy-hero', label: oppSide.isPlayer ? '你的英雄' : getEnemyBossName() },
          ...oppSide.board.filter(m => m.hp > 0).map(m => ({ kind: 'minion', minion: m, id: m.uid, label: `【${m.name}】` }))
        ];
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const fromPos = getEntityCenter(rag.uid);
        const toPos = getEntityCenter(pick.id);
        SoundFX.spellFire();
        addLog(`☄️ “让火焰净化一切！”【${rag.name}】轰击${pick.label}造成 ${rag.endTurnSnipe} 点伤害！`, 'event', '☄️');
        FXEngine.shootProjectile(fromPos.x, fromPos.y, toPos.x, toPos.y, '#ef4444', 330, () => {
          triggerBoardShake();
          applyDamageByDescriptor(pick, rag.endTurnSnipe);
          resolveDeaths();
          renderAll();
          setTimeout(nextSnipe, 300);
        });
      }
      nextSnipe();
    }

    function refreshSideForNewTurn(side) {
      side.maxMana = Math.min(10, side.maxMana + 1);
      side.mana = side.maxMana;
      side.heroPowerUsesThisTurn = 0;
      side.attacksDoneThisTurn = 0;
      side.board.forEach(m => {
        m.exhausted = false;
        m.summonedThisTurn = false;
        m.attacksLeft = m.windfury && !m.silenced ? 2 : 1;
      });
    }

    function thawSideAfterTurn(side) {
      if (side.frozen && side.attacksDoneThisTurn === 0) side.frozen = false;
      side.board.forEach(m => {
        const fullSwings = m.windfury && !m.silenced ? 2 : 1;
        if (m.frozen && m.attacksLeft === fullSwings) m.frozen = false;
      });
    }

    function startPlayerTurn() {
      if (Game.phase === 'gameover') return;
      Game.phase = 'player';
      SoundFX.turnStart();
      refreshSideForNewTurn(Game.player);

      // 地下城宝藏【世界之树嫩枝】：回合开始自动恢复 2 点生命
      if (Game.activeTreasures.includes('tree_of_life')) {
        healTarget(null, true, Game.player, 2);
      }

      drawCard(Game.player);
      addLog(`🌟 === 第 ${Game.turnNumber} 回合：你的回合 (${Game.player.mana} 法力) ===`, 'player', '🌟');
      showSpeechToast(`第 ${Game.turnNumber} 回合 · 你的回合`);
      renderAll();
    }

    function endPlayerTurn() {
      if (Game.phase !== 'player') return;
      clearPendingSelection();
      hideCardZoom();
      thawSideAfterTurn(Game.player);
      Game.phase = 'enemy';
      renderAll();

      processEndOfTurnEffects(Game.player, Game.enemy, () => {
        if (checkGameOver()) return;
        setTimeout(runEnemyTurn, 500);
      });
    }

    function runEnemyTurn() {
      if (Game.phase === 'gameover') return;
      const ai = Game.enemy;
      const pl = Game.player;
      const bossName = getEnemyBossName();
      refreshSideForNewTurn(ai);
      drawCard(ai);
      addLog(`🐉 === ${bossName}的回合 (${ai.mana} 法力) ===`, 'enemy', '🐉');
      renderAll();
      if (checkGameOver()) return;

      const stepDelay = 620;

      function aiStep() {
        if (Game.phase === 'gameover') return;

        // 1. 出牌决策
        const playable = ai.hand.filter(c => {
          if (!canPlayCardNow(c, ai, pl)) return false;
          const tpl = CARD_DB[c.cardId];
          if (tpl.type === 'weapon' && ai.weapon && ai.weapon.durability >= 2) return false;
          if ((tpl.morphSheep || tpl.destroyMinionHeal) && pl.board.filter(m => m.atk >= 4 || m.taunt || m.endTurnSnipe || m.endTurnDKCard).length === 0) return false;
          if (tpl.aoeEnemyMinions && pl.board.length < 2) return false;
          if (tpl.holyNova && pl.board.length === 0 && pl.hp > 10) return false;
          return true;
        });

        if (playable.length > 0) {
          playable.sort((a, b) => {
            if (a.cardId === 'coin') return -1;
            if (b.cardId === 'coin') return 1;
            return b.cost - a.cost;
          });
          const chosen = playable[0];
          const tpl = CARD_DB[chosen.cardId];
          let chosenTarget = null;

          const validTargets = getValidTargetsForCard(tpl, ai, pl);
          if (validTargets.length > 0) {
            if (tpl.battlecryBuff) {
              const bestFriend = [...ai.board].sort((x, y) => y.atk - x.atk)[0];
              chosenTarget = bestFriend ? bestFriend.uid : null;
            } else if (tpl.morphSheep || tpl.battlecrySilence || tpl.destroyMinionHeal) {
              const scary = [...pl.board].sort((x, y) => (y.atk + y.hp + (y.taunt ? 4 : 0) + (y.endTurnSnipe ? 8 : 0)) - (x.atk + x.hp))[0];
              chosenTarget = scary ? scary.uid : validTargets[0];
            } else if (tpl.baseDmg || tpl.battlecryDmg) {
              const dmg = (tpl.baseDmg || tpl.battlecryDmg || 1) + (tpl.type === 'spell' ? getSpellPower(ai) : 0);
              if (pl.hp + pl.armor <= dmg && validTargets.includes('player-hero')) {
                chosenTarget = 'player-hero';
              } else {
                const killable = pl.board.filter(m => !m.divineShield && m.hp <= dmg).sort((x, y) => y.atk - x.atk)[0];
                if (killable) chosenTarget = killable.uid;
                else if (pl.board.length > 0 && tpl.freezeTarget) {
                  chosenTarget = [...pl.board].sort((x, y) => y.atk - x.atk)[0].uid;
                } else {
                  chosenTarget = validTargets.includes('player-hero') ? 'player-hero' : validTargets[0];
                }
              }
            }
          }

          executePlayCard(ai, pl, chosen.uid, chosenTarget);
          if (!checkGameOver()) setTimeout(aiStep, stepDelay);
          return;
        }

        // 2. 首领专属英雄技能
        if (ai.heroPowerUsesThisTurn < 1 && ai.mana >= 2) {
          ai.mana -= 2;
          ai.heroPowerUsesThisTurn += 1;
          const bossMode = ai.bossCfg ? ai.bossCfg.mode : 'dragon';

          if (bossMode === 'hunter') {
            const fromPos = getEntityCenter('enemy-hero');
            const toPos = getEntityCenter('player-hero');
            SoundFX.spellFire();
            addLog(`🏹 ${bossName}使用【暗影冷箭】，对你的英雄造成 2 点伤害！`, 'enemy', '🏹');
            FXEngine.shootProjectile(fromPos.x, fromPos.y, toPos.x, toPos.y, '#10b981', 240, () => {
              dealDamageToHero(pl, 2);
              if (!checkGameOver()) {
                renderAll();
                setTimeout(aiStep, stepDelay);
              }
            });
            renderAll();
            return;
          }

          if (bossMode === 'frost') {
            const pool = [
              ...pl.board.filter(m => m.hp > 0).map(m => ({ kind: 'minion', minion: m, id: m.uid, label: `【${m.name}】` })),
              { kind: 'player-hero', id: 'player-hero', label: '你的英雄' }
            ];
            const pick = pool[0];
            const fromPos = getEntityCenter('enemy-hero');
            const toPos = getEntityCenter(pick.id);
            SoundFX.spellFrost();
            addLog(`❄️ ${bossName}使用【凛冬吐息】，冻结${pick.label}并造成 1 点伤害！`, 'enemy', '❄️');
            FXEngine.shootProjectile(fromPos.x, fromPos.y, toPos.x, toPos.y, '#38bdf8', 250, () => {
              applyDamageByDescriptor(pick, 1);
              if (pick.kind === 'minion') pick.minion.frozen = true;
              else pl.frozen = true;
              resolveDeaths();
              renderAll();
              if (!checkGameOver()) setTimeout(aiStep, stepDelay);
            });
            renderAll();
            return;
          }

          // 默认黑曜龙王技能（地下城最终战强化为2伤+2甲，标准模式1伤+1甲）
          const powerVal = (Game.difficulty === 'dungeon' && Game.dungeonStage === 2) ? 2 : 1;
          ai.armor += powerVal;
          const pool = [
            { kind: 'player-hero', id: 'player-hero', label: '你的英雄' },
            ...pl.board.filter(m => m.hp > 0).map(m => ({ kind: 'minion', minion: m, id: m.uid, label: `【${m.name}】` }))
          ];
          const pick = pool[Math.floor(Math.random() * pool.length)];
          const fromPos = getEntityCenter('enemy-hero');
          const toPos = getEntityCenter(pick.id);
          SoundFX.spellFire();
          addLog(`🔥 ${bossName}使用【熔岩龙息】，获得 ${powerVal} 点护甲并对${pick.label}造成 ${powerVal} 点伤害！`, 'enemy', '🔥');
          FXEngine.shootProjectile(fromPos.x, fromPos.y, toPos.x, toPos.y, '#ea580c', 250, () => {
            applyDamageByDescriptor(pick, powerVal);
            resolveDeaths();
            renderAll();
            if (!checkGameOver()) setTimeout(aiStep, stepDelay);
          });
          renderAll();
          return;
        }

        // 3. 随从与英雄物理冲撞攻击
        const readyMinion = ai.board.find(m => canMinionAttack(m, pl));
        const heroReady = canHeroAttack(ai);
        if (readyMinion || heroReady) {
          const attackerId = readyMinion ? readyMinion.uid : 'enemy-hero';
          const atkVal = readyMinion ? readyMinion.atk : (ai.atk + (ai.weapon ? ai.weapon.atk : 0));
          const validTargets = getValidAttackTargets(pl, readyMinion);

          if (validTargets.length > 0) {
            const totalBoardDmg = ai.board.filter(m => canMinionAttack(m, pl) && !(m.summonedThisTurn && m.rush && !m.charge)).reduce((s, m) => s + m.atk * m.attacksLeft, 0) + (canHeroAttack(ai) ? (ai.atk + (ai.weapon ? ai.weapon.atk : 0)) : 0);
            let targetId = validTargets[0];

            if (validTargets.includes('player-hero') && totalBoardDmg >= pl.hp + pl.armor) {
              targetId = 'player-hero';
            } else {
              const minionTargets = validTargets
                .filter(id => id !== 'player-hero')
                .map(id => pl.board.find(m => m.uid === id))
                .filter(Boolean);

              if (minionTargets.length > 0) {
                const cleanKill = minionTargets.find(m => !m.divineShield && (m.hp <= atkVal || (readyMinion && readyMinion.poisonous)) && (!readyMinion || m.atk < readyMinion.hp));
                const highThreat = minionTargets.find(m => m.taunt || m.atk >= 4 || m.spellPower > 0 || m.endTurnSnipe > 0 || m.endTurnDKCard);
                if (cleanKill) targetId = cleanKill.uid;
                else if (highThreat) targetId = highThreat.uid;
                else if (validTargets.includes('player-hero')) targetId = 'player-hero';
                else targetId = minionTargets[0].uid;
              }
            }

            executeAttack(ai, pl, attackerId, targetId, () => {
              if (!checkGameOver()) setTimeout(aiStep, 380);
            });
            return;
          }
        }

        // 4. 敌方回合结束
        thawSideAfterTurn(ai);
        processEndOfTurnEffects(ai, pl, () => {
          if (checkGameOver()) return;
          Game.turnNumber += 1;
          setTimeout(startPlayerTurn, 420);
        });
      }

      setTimeout(aiStep, stepDelay);
    }

    // =========================================================================
    // 10. 开局流程、起手调度与套牌构筑工坊（Deck Builder）
    // =========================================================================
    function initNewMatch() {
      Game.dungeonStage = 0;
      Game.activeTreasures = [];
      startCurrentBattle();
    }

    function startCurrentBattle() {
      clearPendingSelection();
      hideCardZoom();
      Game.turnNumber = 1;
      Game.cardsPlayedCount = 0;
      Game.phase = 'mulligan';
      Game.mulliganChoices = [];
      Game.historyItems = [];
      renderHistoryStrip();

      Game.player = createParticipant(true);
      Game.enemy = createParticipant(false);

      document.getElementById('battle-log-list').innerHTML = '';
      document.getElementById('gameover-modal').classList.add('hidden');
      document.getElementById('newgame-modal').classList.add('hidden');
      document.getElementById('deckbuilder-modal').classList.add('hidden');
      document.getElementById('discover-modal').classList.add('hidden');

      const extraDraw = Game.activeTreasures.includes('astral_crystal') ? 1 : 0;
      const startCount = (Game.turnOrder === 'second' ? 4 : 3) + extraDraw;
      const enemyStart = Game.turnOrder === 'second' ? 3 : 4;
      for (let i = 0; i < startCount; i++) drawCard(Game.player, true);
      for (let i = 0; i < enemyStart; i++) drawCard(Game.enemy, true);
      if (Game.turnOrder === 'first') {
        Game.enemy.hand.push(createCardInstance('coin'));
      }

      renderMulliganModal();
      renderAll();
    }

    function renderMulliganModal() {
      const modal = document.getElementById('mulligan-modal');
      const container = document.getElementById('mulligan-cards');
      const tag = document.getElementById('mulligan-order-tag');
      const bossSuffix = Game.difficulty === 'dungeon' ? ` · 地下城第 ${Game.dungeonStage + 1}/3 关【${getEnemyBossName()}】` : '';
      tag.textContent = (Game.turnOrder === 'second' ? '🪙 后手开局（确认后额外获赠 0 费幸运币）' : '⚡ 先手开局') + bossSuffix;

      container.innerHTML = '';
      Game.player.hand.forEach((card, idx) => {
        const tpl = CARD_DB[card.cardId];
        const marked = Game.mulliganChoices.includes(idx);
        const cardEl = document.createElement('div');
        cardEl.className = `hs-card-frame relative w-28 sm:w-32 h-42 sm:h-48 rounded-xl border-2 ${marked ? 'border-red-500 opacity-75' : 'border-amber-400'} p-1.5 flex flex-col justify-between cursor-pointer transition hover:scale-105 shadow-xl`;
        cardEl.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="w-6 h-6 rounded-full mana-crystal-orb border border-sky-100 text-white font-black text-xs flex items-center justify-center">${card.cost}</span>
            <span class="text-[10px] text-amber-200 font-semibold">${tpl.type === 'minion' ? '随从' : tpl.type === 'weapon' ? '武器' : '法术'}</span>
          </div>
          <div class="h-16 rounded-lg overflow-hidden border border-amber-700/60 my-1">${tpl.art}</div>
          <div class="hs-ribbon py-0.5 px-1 rounded font-bold text-[11px] text-amber-100 truncate">${tpl.name}</div>
          <div class="hs-parchment rounded p-1 text-[10px] font-semibold leading-tight line-clamp-2 h-8 flex items-center justify-center"><div>${formatCardDesc(tpl, 0, true)}</div></div>
          <div class="flex justify-between items-center text-xs font-extrabold mt-0.5">
            ${tpl.type !== 'spell' ? `<span class="px-1.5 rounded-full atk-sword-orb text-stone-950">⚔️${tpl.atk}</span>` : '<span></span>'}
            ${tpl.type === 'minion' ? `<span class="px-1.5 rounded-full hp-blood-orb text-white">❤️${tpl.hp}</span>` : tpl.type === 'weapon' ? `<span class="px-1.5 rounded-full bg-stone-600 text-white">🛡️${tpl.durability}</span>` : '<span></span>'}
          </div>
          ${marked ? `<div class="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center"><span class="px-2.5 py-1 rounded-full bg-red-600 text-white font-black text-xs border border-red-200 shadow-lg">❌ 替换此牌</span></div>` : ''}
        `;
        cardEl.addEventListener('click', () => {
          SoundFX.cardDraw();
          if (Game.mulliganChoices.includes(idx)) {
            Game.mulliganChoices = Game.mulliganChoices.filter(i => i !== idx);
          } else {
            Game.mulliganChoices.push(idx);
          }
          renderMulliganModal();
        });
        container.appendChild(cardEl);
      });

      modal.classList.remove('hidden');
    }

    function confirmMulligan() {
      if (Game.phase !== 'mulligan') return;
      SoundFX.manaGem();
      const p = Game.player;
      const toReplace = [...Game.mulliganChoices].sort((a, b) => b - a);
      const returnedCards = [];

      for (const idx of toReplace) {
        const [removed] = p.hand.splice(idx, 1);
        if (removed) returnedCards.push(removed);
      }
      for (let i = 0; i < returnedCards.length; i++) {
        if (p.deck.length > 0) p.hand.push(p.deck.shift());
      }
      returnedCards.forEach(rc => {
        const pos = Math.floor(Math.random() * (p.deck.length + 1));
        p.deck.splice(pos, 0, rc);
      });

      if (Game.turnOrder === 'second') {
        const coinCost = 0;
        p.hand.push(createCardInstance('coin', coinCost));
      }

      document.getElementById('mulligan-modal').classList.add('hidden');
      addLog(`🍺 对决打响！你是【${HERO_CLASSES[Game.heroClass].name}】，迎战【${getEnemyBossName()}】！`, 'event', '🍺');
      startPlayerTurn();
    }

    // 组牌工坊渲染与交互
    function openDeckBuilder() {
      Game.builderDraft = getPlayerDeckCardIds(Game.heroClass);
      renderDeckBuilder();
      document.getElementById('deckbuilder-modal').classList.remove('hidden');
    }

    function renderDeckBuilder() {
      const poolGrid = document.getElementById('builder-pool-grid');
      const deckList = document.getElementById('builder-deck-list');
      const counter = document.getElementById('builder-deck-counter');
      const curveBox = document.getElementById('builder-mana-curve');

      counter.textContent = `${Game.builderDraft.length} / 22`;
      counter.className = `px-2.5 py-0.5 rounded-full text-xs font-extrabold ${Game.builderDraft.length === 22 ? 'bg-emerald-800 text-emerald-100 border border-emerald-400' : 'bg-amber-900/80 text-amber-200 border border-amber-500'}`;

      // 统计每张牌已选张数
      const counts = {};
      Game.builderDraft.forEach(cid => { counts[cid] = (counts[cid] || 0) + 1; });

      // 法力曲线柱状图 (1..7+)
      const buckets = [0, 0, 0, 0, 0, 0, 0];
      Game.builderDraft.forEach(cid => {
        const cost = CARD_DB[cid].cost;
        const bIdx = Math.min(6, Math.max(0, cost - 1));
        buckets[bIdx] += 1;
      });
      const maxBucket = Math.max(4, ...buckets);
      curveBox.innerHTML = '';
      ['1', '2', '3', '4', '5', '6', '7+'].forEach((lbl, i) => {
        const hPct = Math.round((buckets[i] / maxBucket) * 100);
        const col = document.createElement('div');
        col.className = 'flex-1 flex flex-col items-center justify-end h-full';
        col.innerHTML = `
          <div class="text-[9px] text-sky-300 font-bold leading-none mb-0.5">${buckets[i] || ''}</div>
          <div class="w-full bg-gradient-to-t from-blue-700 to-sky-400 rounded-t transition-all" style="height: ${Math.max(4, hPct)}%"></div>
          <div class="text-[9px] text-stone-400 mt-0.5">${lbl}</div>
        `;
        curveBox.appendChild(col);
      });

      // 渲染左侧收藏池
      poolGrid.innerHTML = '';
      Object.values(CARD_DB)
        .filter(c => c.collectible)
        .filter(c => {
          if (Game.builderFilter === 'all') return true;
          const f = parseInt(Game.builderFilter, 10);
          if (f === 1) return c.cost <= 1;
          if (f === 6) return c.cost >= 6;
          return c.cost === f;
        })
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
        .forEach(tpl => {
          const owned = counts[tpl.id] || 0;
          const limit = tpl.rarity === 'legendary' ? 1 : 2;
          const full = owned >= limit || Game.builderDraft.length >= 22;

          const card = document.createElement('div');
          card.className = `hs-card-frame p-2 rounded-xl border-2 ${owned > 0 ? 'border-amber-400' : 'border-stone-700'} flex flex-col justify-between gap-1 cursor-pointer transition hover:scale-[1.03] ${full && owned >= limit ? 'opacity-65' : ''}`;
          card.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="w-6 h-6 rounded-full mana-crystal-orb text-white font-black text-xs flex items-center justify-center border border-sky-200">${tpl.cost}</span>
              <span class="px-1.5 py-0.5 rounded bg-stone-950 text-[10px] font-bold ${owned > 0 ? 'text-emerald-300' : 'text-stone-400'}">${owned}/${limit}</span>
            </div>
            <div class="h-14 rounded-lg overflow-hidden border border-amber-800/60">${tpl.art}</div>
            <div class="hs-ribbon py-0.5 px-1 rounded text-center font-bold text-amber-100 text-xs truncate">${tpl.name}</div>
            <div class="hs-parchment rounded p-1.5 text-[10px] font-semibold text-center leading-tight min-h-[38px] flex items-center justify-center"><div>${formatCardDesc(tpl, 0, true)}</div></div>
            <div class="flex justify-between text-[10px] font-extrabold text-amber-200 pt-0.5">
              <span>${tpl.type === 'minion' ? `⚔️${tpl.atk} ❤️${tpl.hp}` : tpl.type === 'weapon' ? `⚔️${tpl.atk} 🛡️${tpl.durability}` : '✨ 法术'}</span>
              <span>${tpl.rarity === 'legendary' ? '★传说' : tpl.rarity === 'epic' ? '史诗' : tpl.rarity === 'rare' ? '稀有' : '普通'}</span>
            </div>
          `;
          card.addEventListener('click', () => {
            if (Game.builderDraft.length >= 22) {
              SoundFX.errorWarn();
              showSpeechToast('套牌已满 22 张！可点击右侧卡牌移除后再添加。');
              return;
            }
            if (owned >= limit) {
              SoundFX.errorWarn();
              showSpeechToast(limit === 1 ? '传说卡牌每套牌限带 1 张！' : '同名卡牌每套牌最多携带 2 张！');
              return;
            }
            SoundFX.cardDraw();
            Game.builderDraft.push(tpl.id);
            renderDeckBuilder();
          });
          poolGrid.appendChild(card);
        });

      // 渲染右侧已选条形清单
      deckList.innerHTML = '';
      Object.keys(counts)
        .map(cid => CARD_DB[cid])
        .sort((a, b) => a.cost - b.cost || a.name.localeCompare(b.name))
        .forEach(tpl => {
          const qty = counts[tpl.id];
          const row = document.createElement('div');
          row.className = 'flex items-center justify-between px-2 py-1 rounded bg-stone-900 hover:bg-red-950/60 border border-stone-700 cursor-pointer transition';
          row.title = '点击移除 1 张';
          row.innerHTML = `
            <div class="flex items-center gap-2 truncate">
              <span class="w-5 h-5 rounded-full mana-crystal-orb text-white font-black text-[10px] flex items-center justify-center shrink-0">${tpl.cost}</span>
              <span class="font-semibold text-amber-100 truncate">${tpl.name}</span>
            </div>
            <span class="text-amber-300 font-black ml-2">${tpl.rarity === 'legendary' ? '★' : qty > 1 ? `×${qty}` : '×1'}</span>
          `;
          row.addEventListener('click', () => {
            const removeIdx = Game.builderDraft.indexOf(tpl.id);
            if (removeIdx !== -1) {
              SoundFX.cardDraw();
              Game.builderDraft.splice(removeIdx, 1);
              renderDeckBuilder();
            }
          });
          deckList.appendChild(row);
        });
    }

    // =========================================================================
    // 11. DOM 全量高颜值响应式渲染（英雄肖像、奥秘球、宝藏栏、棋子、羊皮纸手牌）
    // =========================================================================
    function renderAll() {
      const p = Game.player;
      const e = Game.enemy;
      if (!p || !e) return;

      const heroCfg = HERO_CLASSES[Game.heroClass];
      const sp = getSpellPower(p);
      const validSet = new Set(Game.pendingAction ? Game.pendingAction.validTargets : []);

      // 顶栏状态徽章
      document.getElementById('turn-badge').textContent = `第 ${Game.turnNumber} 回合`;
      document.getElementById('difficulty-badge').textContent = Game.difficulty === 'dungeon'
        ? `🏰 地下城 ${Game.dungeonStage + 1}/3`
        : Game.difficulty === 'heroic' ? '🐉 英雄黑龙' : '🍺 标准酒馆';
      document.getElementById('score-badge').textContent = `胜场: ${Game.wins}`;
      document.getElementById('dungeon-stage-label').textContent = Game.difficulty === 'dungeon' ? `地下城第 ${Game.dungeonStage + 1} 层` : '敌方牌库';

      // 我方职业与法强徽标
      const classPill = document.getElementById('player-class-pill');
      classPill.textContent = heroCfg.title;
      classPill.className = `px-2 py-0.5 rounded border text-[11px] font-semibold ${heroCfg.pillColor}`;

      const spPill = document.getElementById('spell-power-pill');
      if (sp > 0) {
        spPill.textContent = `✨ 法伤 +${sp}`;
        spPill.classList.remove('hidden');
      } else {
        spPill.classList.add('hidden');
      }

      // 渲染已获得的地下城被动宝藏小徽章
      const trBar = document.getElementById('player-treasures-bar');
      trBar.innerHTML = '';
      Game.activeTreasures.forEach(tid => {
        const tr = PASSIVE_TREASURES.find(x => x.id === tid);
        if (!tr) return;
        const badge = document.createElement('span');
        badge.className = 'w-5 h-5 rounded-full bg-amber-900/90 border border-amber-400 flex items-center justify-center text-xs cursor-help shadow';
        badge.textContent = tr.icon;
        badge.title = `${tr.name}：${tr.desc}`;
        trBar.appendChild(badge);
      });

      const tipEl = document.getElementById('status-tip-text');
      if (Game.phase === 'enemy') tipEl.textContent = `🐉 ${getEnemyBossName()}正在运筹出牌...`;
      else if (Game.pendingAction) tipEl.textContent = '🎯 请点击发光边框的有效目标（按 Esc 取消）';
      else if (Game.selectedHandUid) tipEl.textContent = '✨ 再次点击该卡牌或点击战场中央即可打出';
      else tipEl.textContent = '💡 悬停卡牌可看大图，点击或拖拽绿光牌与随从行动';

      // 敌方手牌扇形卡背
      const eBacks = document.getElementById('enemy-hand-backs');
      eBacks.innerHTML = '';
      for (let i = 0; i < e.hand.length; i++) {
        const b = document.createElement('div');
        b.className = 'w-5 h-7 sm:w-6 sm:h-8 rounded bg-gradient-to-br from-amber-600 via-red-900 to-stone-950 border border-amber-300/80 shadow flex items-center justify-center text-[9px]';
        b.textContent = '🌀';
        eBacks.appendChild(b);
      }
      document.getElementById('enemy-mana-text').textContent = `${e.mana}/${e.maxMana}`;
      document.getElementById('enemy-hand-count').textContent = String(e.hand.length);
      document.getElementById('enemy-deck-count').textContent = String(e.deck.length);

      // 敌方首领肖像与技能动态更新
      const enemyImg = document.getElementById('enemy-hero-img');
      const desiredEnemySrc = e.bossCfg ? e.bossCfg.portrait : PORTRAITS.dragon;
      if (enemyImg.getAttribute('src') !== desiredEnemySrc) enemyImg.setAttribute('src', desiredEnemySrc);
      document.getElementById('enemy-hero-name').textContent = getEnemyBossName();
      document.getElementById('enemy-skill-icon').textContent = e.bossCfg ? e.bossCfg.skillIcon : '🔥';
      document.getElementById('enemy-hp-skill').title = e.bossCfg ? e.bossCfg.skillTitle : '敌方英雄技能：熔岩龙息（2费：造成1点伤害并获得1点护甲）';
      renderHeroBox(e, 'enemy', validSet.has('enemy-hero'), false);

      // 我方英雄肖像与技能更新
      const playerImg = document.getElementById('player-hero-img');
      if (playerImg.getAttribute('src') !== heroCfg.portrait) playerImg.setAttribute('src', heroCfg.portrait);
      document.getElementById('player-hero-name').textContent = heroCfg.name;
      document.getElementById('player-hero-aura').style.boxShadow = heroCfg.auraStyle;
      const pHeroSelected = Boolean(Game.pendingAction && Game.pendingAction.kind === 'attack' && Game.pendingAction.sourceUid === 'player-hero');
      renderHeroBox(p, 'player', validSet.has('player-hero'), pHeroSelected);

      // 英雄技能按钮
      const hpBtn = document.getElementById('btn-hero-power');
      const hpCost = getHeroPowerCost(p);
      const hpMax = getMaxHeroPowerUses(p);
      document.getElementById('hero-power-icon').textContent = heroCfg.skillIcon;
      document.getElementById('hero-power-label').textContent = heroCfg.skillName;
      document.getElementById('hero-power-cost').textContent = String(hpCost);
      hpBtn.title = `${heroCfg.skillDesc}（当前消耗 ${hpCost} 费）`;
      const hpReady = Game.phase === 'player' && p.heroPowerUsesThisTurn < hpMax && p.mana >= hpCost && !(heroCfg.id === 'paladin' && p.board.length >= 7);
      hpBtn.classList.toggle('ready-glow', hpReady);
      hpBtn.classList.toggle('opacity-45', p.heroPowerUsesThisTurn >= hpMax);
      hpBtn.classList.toggle('selected-glow', Boolean(Game.pendingAction && Game.pendingAction.kind === 'heropower'));

      // 法力水晶宝石槽
      document.getElementById('player-mana-text').textContent = `${p.mana}/${p.maxMana}`;
      document.getElementById('player-deck-count').textContent = String(p.deck.length);
      document.getElementById('player-hand-count').textContent = String(p.hand.length);
      const gemsBox = document.getElementById('player-mana-gems');
      gemsBox.innerHTML = '';
      const previewCost = Game.selectedHandUid ? (p.hand.find(c => c.uid === Game.selectedHandUid)?.cost || 0) : 0;
      for (let i = 0; i < 10; i++) {
        const gem = document.createElement('span');
        if (i < p.mana) {
          const isPreviewSpend = previewCost > 0 && i >= p.mana - previewCost;
          gem.className = `w-3 h-3 rounded-sm rotate-45 border ${isPreviewSpend ? 'bg-amber-300 border-white animate-pulse' : 'mana-crystal-orb border-sky-100'}`;
        } else if (i < p.maxMana) {
          gem.className = 'w-3 h-3 rounded-sm rotate-45 bg-stone-800 border border-sky-800/70';
        } else {
          gem.className = 'w-2.5 h-2.5 rounded-sm rotate-45 bg-stone-900/50 border border-stone-800';
        }
        gemsBox.appendChild(gem);
      }

      // 结束回合按钮状态
      const endBtn = document.getElementById('btn-end-turn');
      if (Game.phase !== 'player') {
        endBtn.textContent = '对手回合';
        endBtn.className = 'absolute right-0 sm:right-1 -translate-y-0.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-fantasy font-black text-xs sm:text-sm tracking-wider border-2 bg-stone-700 text-stone-400 border-stone-500 cursor-not-allowed';
      } else if (!hasAnyPlayableAction()) {
        endBtn.textContent = '回合结束 ✓';
        endBtn.className = 'absolute right-0 sm:right-1 -translate-y-0.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-fantasy font-black text-xs sm:text-sm tracking-wider border-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 border-emerald-100 ready-glow transition active:scale-95';
      } else {
        endBtn.textContent = '结束回合';
        endBtn.className = 'absolute right-0 sm:right-1 -translate-y-0.5 px-4 sm:px-5 py-1.5 sm:py-2 rounded-full font-fantasy font-black text-xs sm:text-sm tracking-wider border-2 bg-amber-500 hover:bg-amber-400 text-stone-950 border-amber-200 shadow-xl transition active:scale-95';
      }

      renderBoardRow(e.board, document.getElementById('enemy-board-row'), false, validSet);
      renderBoardRow(p.board, document.getElementById('player-board-row'), true, validSet);
      renderPlayerHand(p, sp);
    }

    function renderHeroBox(side, prefix, isValidTarget, isSelected) {
      const heroEl = document.getElementById(`${prefix}-hero-el`);
      const hpEl = document.getElementById(`${prefix}-hero-hp`);
      const armorEl = document.getElementById(`${prefix}-hero-armor`);
      const atkEl = document.getElementById(`${prefix}-hero-atk`);
      const frozenEl = document.getElementById(`${prefix}-hero-frozen`);
      const secretsRow = document.getElementById(`${prefix}-secrets-row`);

      hpEl.textContent = String(side.hp);
      hpEl.className = `absolute -bottom-1.5 -right-2 w-7 h-7 sm:w-8 sm:h-8 rounded-full hp-blood-orb ${side.hp < side.maxHp ? 'text-amber-200' : 'text-white'} font-extrabold text-xs sm:text-sm flex items-center justify-center border-2 border-red-950`;

      if (side.armor > 0) {
        armorEl.textContent = `🛡️${side.armor}`;
        armorEl.classList.remove('hidden');
        armorEl.classList.add('flex');
      } else {
        armorEl.classList.add('hidden');
        armorEl.classList.remove('flex');
      }

      const totalAtk = side.atk + (side.weapon ? side.weapon.atk : 0);
      if (totalAtk > 0) {
        atkEl.textContent = String(totalAtk);
        atkEl.classList.remove('hidden');
        atkEl.classList.add('flex');
      } else {
        atkEl.classList.add('hidden');
        atkEl.classList.remove('flex');
      }

      // 头顶奥秘宝球渲染
      secretsRow.innerHTML = '';
      side.secrets.forEach(sec => {
        const orb = document.createElement('span');
        orb.className = `w-5 h-5 rounded-full ${sec.color} border-2 text-stone-950 font-black text-[11px] flex items-center justify-center shadow-lg cursor-help`;
        orb.textContent = '?';
        orb.title = side.isPlayer ? `已挂载奥秘：【${sec.name}】` : '敌方奥秘：触发特定条件时揭晓！';
        secretsRow.appendChild(orb);
      });

      frozenEl.classList.toggle('hidden', !side.frozen);
      const ready = side.isPlayer && Game.phase === 'player' && canHeroAttack(side) && !Game.pendingAction;
      heroEl.classList.toggle('ready-glow', ready);
      heroEl.classList.toggle('valid-target-glow', isValidTarget);
      heroEl.classList.toggle('selected-glow', isSelected);

      const wSlot = document.getElementById(`${prefix}-weapon-slot`);
      if (prefix === 'player') {
        const wIcon = document.getElementById('player-weapon-icon');
        const wAtk = document.getElementById('player-weapon-atk');
        const wDur = document.getElementById('player-weapon-dur');
        if (side.weapon) {
          wSlot.className = 'w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-b from-stone-800 to-stone-950 border-2 border-amber-400 relative flex items-center justify-center shadow-lg';
          wSlot.title = `${side.weapon.name} (${side.weapon.atk}/${side.weapon.durability})${side.weapon.windfury ? ' · 风怒' : ''}`;
          wIcon.textContent = side.weapon.icon;
          wIcon.classList.remove('opacity-35');
          wAtk.textContent = String(side.weapon.atk);
          wDur.textContent = String(side.weapon.durability);
          wAtk.classList.replace('hidden', 'flex');
          wDur.classList.replace('hidden', 'flex');
        } else {
          wSlot.className = 'w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-stone-900/90 border-2 border-dashed border-stone-600 relative flex items-center justify-center shadow-inner';
          wSlot.title = '武器栏：打出武器牌后英雄可亲自发起攻击';
          wIcon.textContent = '⚔️';
          wIcon.classList.add('opacity-35');
          wAtk.classList.replace('flex', 'hidden');
          wDur.classList.replace('flex', 'hidden');
        }
      } else {
        if (side.weapon) {
          wSlot.classList.replace('hidden', 'flex');
          document.getElementById('enemy-weapon-icon').textContent = side.weapon.icon || '🪓';
          document.getElementById('enemy-weapon-atk').textContent = String(side.weapon.atk);
          document.getElementById('enemy-weapon-dur').textContent = String(side.weapon.durability);
        } else {
          wSlot.classList.replace('flex', 'hidden');
        }
      }
    }

    function renderBoardRow(minions, container, isFriendly, validSet) {
      container.innerHTML = '';
      if (minions.length === 0) {
        const emptyHint = document.createElement('div');
        emptyHint.className = 'text-[11px] text-amber-950/60 font-bold tracking-wider pointer-events-none';
        emptyHint.textContent = isFriendly ? '— 我方战线（最多 7 名随从）—' : '— 敌方战线 —';
        container.appendChild(emptyHint);
        return;
      }

      const oppSide = isFriendly ? Game.enemy : Game.player;

      minions.forEach(m => {
        const tpl = CARD_DB[m.cardId];
        const ready = isFriendly && Game.phase === 'player' && canMinionAttack(m, oppSide) && !Game.pendingAction;
        const isRushOnly = ready && m.summonedThisTurn && m.rush && !m.charge;
        const isSelected = Boolean(Game.pendingAction && Game.pendingAction.kind === 'attack' && Game.pendingAction.sourceUid === m.uid);
        const isValid = validSet.has(m.uid);

        const el = document.createElement('div');
        el.dataset.entityUid = m.uid;
        el.className = `minion-token relative w-[68px] h-[84px] sm:w-[84px] sm:h-[102px] bg-stone-900 cursor-pointer select-none flex flex-col justify-between ${m.taunt ? 'taunt-shield' : ''} ${isRushOnly ? 'rush-glow' : ready ? 'ready-glow' : ''} ${isSelected ? 'selected-glow' : ''} ${isValid ? 'valid-target-glow' : ''}`;

        const badges = [];
        if (!m.silenced && m.deathrattle) badges.push('💀');
        if (!m.silenced && m.spellPower > 0) badges.push('✨');
        if (!m.silenced && m.lifesteal) badges.push('🩸');
        if (!m.silenced && m.poisonous) badges.push('☠️');
        if (!m.silenced && (m.endTurnSnipe > 0 || m.endTurnDKCard)) badges.push('⚡');
        if (m.silenced) badges.push('🔇');

        el.innerHTML = `
          <div class="absolute inset-0 overflow-hidden rounded-[inherit]">${tpl.art}</div>
          ${m.windfury && !m.silenced ? `<div class="absolute -inset-1 windfury-ring rounded-[inherit] pointer-events-none"></div>` : ''}
          ${m.divineShield ? `<div class="absolute inset-0 divine-shield-overlay rounded-[inherit] pointer-events-none"></div>` : ''}
          ${m.frozen ? `<div class="absolute inset-0 frozen-overlay rounded-[inherit] pointer-events-none"></div>` : ''}
          ${m.exhausted && !m.cantAttack ? `<span class="zzz-anim absolute -top-2 right-0 text-[11px] font-black text-sky-200 drop-shadow pointer-events-none">Zzz</span>` : ''}
          ${tpl.rarity === 'legendary' ? `<span class="absolute -top-2.5 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-[9px] font-black text-stone-950 border border-white shadow whitespace-nowrap">🐉传说</span>` : ''}
          <div class="relative z-10 mt-auto bg-gradient-to-t from-black/90 via-black/75 to-transparent px-1 py-0.5 text-center rounded-b-[inherit]">
            <div class="text-[9px] sm:text-[10px] font-bold text-amber-100 truncate">${m.name}</div>
            ${badges.length > 0 ? `<div class="text-[9px] leading-none">${badges.join('')}</div>` : ''}
          </div>
          <div class="z-20 absolute -bottom-1.5 -left-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full ${m.atk > m.baseAtk ? 'bg-emerald-400 text-stone-950' : 'atk-sword-orb text-stone-950'} font-extrabold text-xs flex items-center justify-center border-2 border-amber-950">${m.atk}</div>
          <div class="z-20 absolute -bottom-1.5 -right-1.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full hp-blood-orb ${m.hp < m.maxHp ? 'text-amber-200' : m.maxHp > tpl.hp ? 'ring-2 ring-emerald-300 text-white' : 'text-white'} font-extrabold text-xs flex items-center justify-center border-2 border-red-950">${m.hp}</div>
        `;

        el.addEventListener('mouseenter', () => showCardZoom(tpl, null, getSpellPower(Game.player)));
        el.addEventListener('mouseleave', hideCardZoom);

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onEntityInteract(m.uid);
        });

        if (isFriendly) {
          el.addEventListener('pointerdown', (ev) => {
            if (Game.phase !== 'player' || !canMinionAttack(m, oppSide)) return;
            initiateAttackFrom(m.uid);
            Game.isDragging = true;
            const c = getEntityCenter(m.uid);
            FXEngine.setAimLine({ x1: c.x, y1: c.y, x2: ev.clientX, y2: ev.clientY, color: '#ef4444' });
          });
        }

        container.appendChild(el);
      });
    }

    function renderPlayerHand(p, sp) {
      const row = document.getElementById('player-hand-row');
      row.innerHTML = '';
      const total = p.hand.length;

      const rarityBorder = {
        common: 'border-stone-400',
        rare: 'border-sky-400',
        epic: 'border-purple-400',
        legendary: 'border-amber-400'
      };
      const rarityGem = {
        common: 'bg-stone-300',
        rare: 'bg-sky-400',
        epic: 'bg-purple-500',
        legendary: 'bg-amber-400'
      };

      p.hand.forEach((card, idx) => {
        const tpl = CARD_DB[card.cardId];
        const canAfford = Game.phase === 'player' && canPlayCardNow(card, p, Game.enemy);
        const isSelected = Game.selectedHandUid === card.uid;
        const discounted = card.cost < tpl.cost;

        const mid = (total - 1) / 2;
        const deg = total > 1 ? (idx - mid) * Math.min(3.4, 20 / total) : 0;
        const yOff = Math.abs(idx - mid) * 2.5;

        const el = document.createElement('div');
        el.dataset.cardUid = card.uid;
        el.style.transform = `translateY(${yOff}px) rotate(${deg}deg)`;
        el.style.zIndex = String(10 + idx);
        el.className = `hand-card hs-card-frame relative w-[92px] sm:w-[116px] h-[132px] sm:h-[164px] rounded-xl border-2 ${rarityBorder[tpl.rarity] || 'border-stone-400'} p-1 sm:p-1.5 flex flex-col justify-between cursor-pointer shrink-0 ${canAfford ? 'ready-glow' : ''} ${isSelected ? 'card-selected' : ''}`;

        el.innerHTML = `
          ${tpl.rarity === 'legendary' ? `<div class="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 text-[8px] font-black text-stone-950 border border-white shadow z-20">★传说</div>` : ''}
          <div class="flex items-center justify-between relative z-10">
            <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full mana-crystal-orb border border-sky-100 ${discounted ? 'text-emerald-300' : 'text-white'} font-black text-[11px] sm:text-xs flex items-center justify-center">${card.cost}</span>
            <span class="w-2.5 h-2.5 rounded-full ${rarityGem[tpl.rarity] || 'bg-stone-300'} border border-black/60 shadow"></span>
          </div>
          <div class="h-11 sm:h-14 rounded-lg overflow-hidden border border-amber-700/70 my-0.5 shadow-inner">${tpl.art}</div>
          <div class="hs-ribbon py-0.5 px-1 rounded text-[9px] sm:text-[10px] font-bold text-amber-100 text-center truncate leading-tight">${tpl.name}</div>
          <div class="hs-parchment rounded px-1 py-0.5 text-[8.5px] sm:text-[9.5px] font-semibold text-center leading-tight line-clamp-2 h-7 sm:h-8 flex items-center justify-center">
            <div>${formatCardDesc(tpl, sp, true)}</div>
          </div>
          <div class="flex items-center justify-between text-[10px] sm:text-xs font-black mt-0.5">
            ${tpl.type !== 'spell' ? `<span class="w-5 h-5 rounded-full atk-sword-orb text-stone-950 flex items-center justify-center border border-amber-950">${tpl.atk}</span>` : '<span></span>'}
            <span class="text-[8px] sm:text-[9px] text-amber-200/80">${tpl.secretType ? '奥秘' : tpl.type === 'minion' ? '随从' : tpl.type === 'weapon' ? '武器' : '法术'}</span>
            ${tpl.type === 'minion' ? `<span class="w-5 h-5 rounded-full hp-blood-orb text-white flex items-center justify-center border border-red-950">${tpl.hp}</span>` : tpl.type === 'weapon' ? `<span class="w-5 h-5 rounded-full bg-stone-600 text-white flex items-center justify-center border border-stone-300">${tpl.durability}</span>` : '<span></span>'}
          </div>
          ${isSelected && (!Game.pendingAction || Game.pendingAction.validTargets.length === 0) ? `<div class="absolute -top-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-emerald-500 text-stone-950 font-black text-[10px] whitespace-nowrap shadow-lg border border-white">点击打出</div>` : ''}
        `;

        el.addEventListener('mouseenter', () => showCardZoom(tpl, card.cost, sp));
        el.addEventListener('mouseleave', hideCardZoom);

        el.addEventListener('click', (ev) => {
          ev.stopPropagation();
          onHandCardClick(card.uid);
        });

        el.addEventListener('pointerdown', (ev) => {
          if (!canAfford) return;
          Game.isDragging = true;
          onHandCardClick(card.uid);
          const rect = el.getBoundingClientRect();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          if (Game.pendingAction && Game.pendingAction.validTargets.length > 0) {
            FXEngine.setAimLine({ x1: cx, y1: cy, x2: ev.clientX, y2: ev.clientY, color: '#38bdf8' });
          }
        });

        row.appendChild(el);
      });
    }

    function populateCodexModal() {
      const grid = document.getElementById('codex-card-grid');
      grid.innerHTML = '';
      Object.values(CARD_DB)
        .filter(c => c.collectible || c.id.startsWith('dk_'))
        .sort((a, b) => a.cost - b.cost)
        .forEach(tpl => {
          const card = document.createElement('div');
          card.className = 'hs-card-frame p-2 rounded-xl border border-amber-700/50 flex flex-col justify-between gap-1';
          card.innerHTML = `
            <div class="flex items-center justify-between">
              <span class="w-5 h-5 rounded-full mana-crystal-orb text-white font-bold text-[10px] flex items-center justify-center">${tpl.cost}</span>
              <span class="text-[10px] text-amber-300 font-bold">${tpl.id.startsWith('dk_') ? '👑死骑衍生' : tpl.rarity === 'legendary' ? '★传说' : tpl.rarity === 'epic' ? '史诗' : tpl.rarity === 'rare' ? '稀有' : '普通'}</span>
            </div>
            <div class="h-14 rounded-lg overflow-hidden border border-amber-800/60">${tpl.art}</div>
            <div class="hs-ribbon py-0.5 px-1 rounded text-center font-bold text-amber-100 text-xs truncate">${tpl.name}</div>
            <div class="hs-parchment rounded p-1.5 text-[10px] font-semibold text-center leading-snug min-h-[42px] flex items-center justify-center"><div>${formatCardDesc(tpl, 0, true)}</div></div>
            <div class="text-[10px] font-bold text-amber-200/80 flex justify-between pt-0.5">
              <span>${tpl.secretType ? '奥秘' : tpl.type === 'minion' ? '随从' : tpl.type === 'weapon' ? '武器' : '法术'}</span>
              <span>${tpl.type === 'minion' ? `⚔️${tpl.atk} ❤️${tpl.hp}` : tpl.type === 'weapon' ? `⚔️${tpl.atk} 🛡️${tpl.durability}` : ''}</span>
            </div>
          `;
          grid.appendChild(card);
        });
    }

    // =========================================================================
    // 12. 全局事件绑定（拖拽释放、快捷键、组牌工坊、彩蛋机关）
    // =========================================================================
    function bindEvents() {
      window.addEventListener('resize', () => FXEngine.resize());

      window.addEventListener('pointermove', (ev) => {
        if (!Game.pendingAction) {
          FXEngine.setAimLine(null);
          return;
        }
        let origin = { x: window.innerWidth / 2, y: window.innerHeight - 90 };
        if (Game.pendingAction.kind === 'attack') {
          origin = getEntityCenter(Game.pendingAction.sourceUid);
        } else if (Game.pendingAction.kind === 'heropower') {
          origin = getEntityCenter('player-hero');
        }
        const color = Game.pendingAction.kind === 'attack' ? '#ef4444' : '#38bdf8';
        FXEngine.setAimLine({ x1: origin.x, y1: origin.y, x2: ev.clientX, y2: ev.clientY, color });
      });

      window.addEventListener('pointerup', (ev) => {
        if (!Game.isDragging) return;
        Game.isDragging = false;
        const under = document.elementFromPoint(ev.clientX, ev.clientY);
        if (!under) return;

        const entityEl = under.closest('[data-entity-uid]');
        const isEnemyHero = Boolean(under.closest('#enemy-hero-el'));
        const isPlayerHero = Boolean(under.closest('#player-hero-el'));

        if (Game.pendingAction) {
          if (isEnemyHero) onEntityInteract('enemy-hero');
          else if (isPlayerHero && Game.pendingAction.sourceUid !== 'player-hero') onEntityInteract('player-hero');
          else if (entityEl && entityEl.dataset.entityUid !== Game.pendingAction.sourceUid) {
            onEntityInteract(entityEl.dataset.entityUid);
          }
          return;
        }

        if (Game.selectedHandUid && under.closest('#board-arena')) {
          executePlayCard(Game.player, Game.enemy, Game.selectedHandUid, null);
        }
      });

      window.addEventListener('keydown', (ev) => {
        if (ev.key === 'Escape') {
          clearPendingSelection();
          hideCardZoom();
          renderAll();
        }
      });

      document.getElementById('enemy-hero-el').addEventListener('click', (ev) => {
        ev.stopPropagation();
        onEntityInteract('enemy-hero');
      });

      const pHeroEl = document.getElementById('player-hero-el');
      pHeroEl.addEventListener('click', (ev) => {
        ev.stopPropagation();
        onEntityInteract('player-hero');
      });
      pHeroEl.addEventListener('pointerdown', (ev) => {
        if (Game.phase !== 'player' || !canHeroAttack(Game.player)) return;
        initiateAttackFrom('player-hero');
        Game.isDragging = true;
        const c = getEntityCenter('player-hero');
        FXEngine.setAimLine({ x1: c.x, y1: c.y, x2: ev.clientX, y2: ev.clientY, color: '#ef4444' });
      });

      document.getElementById('btn-hero-power').addEventListener('click', (ev) => {
        ev.stopPropagation();
        onHeroPowerClick();
      });
      document.getElementById('btn-end-turn').addEventListener('click', (ev) => {
        ev.stopPropagation();
        endPlayerTurn();
      });
      document.getElementById('btn-cancel-target').addEventListener('click', (ev) => {
        ev.stopPropagation();
        clearPendingSelection();
        renderAll();
      });

      document.getElementById('board-arena').addEventListener('click', () => {
        if (Game.phase === 'player' && Game.selectedHandUid && !Game.pendingAction) {
          executePlayCard(Game.player, Game.enemy, Game.selectedHandUid, null);
        } else if (Game.pendingAction) {
          clearPendingSelection();
          renderAll();
        }
      });
      document.getElementById('play-drop-hint').addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (Game.selectedHandUid) executePlayCard(Game.player, Game.enemy, Game.selectedHandUid, null);
      });

      document.getElementById('prop-brazier').addEventListener('click', (ev) => {
        ev.stopPropagation();
        SoundFX.spellFire();
        const r = ev.currentTarget.getBoundingClientRect();
        FXEngine.spawnBurst(r.left + 14, r.top + 14, '#fb923c', 18, 4.5);
      });
      document.getElementById('prop-gem').addEventListener('click', (ev) => {
        ev.stopPropagation();
        SoundFX.manaGem();
        const r = ev.currentTarget.getBoundingClientRect();
        FXEngine.spawnBurst(r.left + 14, r.top + 14, '#38bdf8', 18, 4.5);
      });
      document.getElementById('prop-mug').addEventListener('click', (ev) => {
        ev.stopPropagation();
        SoundFX.heal();
        const r = ev.currentTarget.getBoundingClientRect();
        FXEngine.spawnBurst(r.left + 14, r.top + 14, '#fde047', 16, 4);
        showSpeechToast('🍺 干杯！愿炉石指引你的神抽！');
      });

      document.getElementById('btn-confirm-mulligan').addEventListener('click', confirmMulligan);

      // 职业/模式/先后手弹窗
      document.getElementById('btn-new-game').addEventListener('click', () => {
        document.getElementById('newgame-modal').classList.remove('hidden');
      });
      document.getElementById('btn-close-newgame').addEventListener('click', () => {
        document.getElementById('newgame-modal').classList.add('hidden');
      });

      document.querySelectorAll('.hero-pick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          Game.heroClass = btn.dataset.hero;
          document.querySelectorAll('.hero-pick-btn').forEach(b => {
            const active = b.dataset.hero === Game.heroClass;
            b.className = `hero-pick-btn p-3 rounded-xl ${active ? 'bg-sky-950/70 border-amber-400' : 'bg-stone-800/80 border-stone-700'} border-2 text-left transition flex flex-col gap-1.5`;
          });
        });
      });
      document.querySelectorAll('.diff-pick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          Game.difficulty = btn.dataset.diff;
          document.querySelectorAll('.diff-pick-btn').forEach(b => {
            const active = b.dataset.diff === Game.difficulty;
            b.className = `diff-pick-btn py-2 px-2.5 rounded-lg text-xs font-bold border ${active ? 'bg-amber-700 text-white border-amber-400' : 'bg-stone-800 text-stone-300 border-stone-700'}`;
          });
        });
      });
      document.querySelectorAll('.order-pick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          Game.turnOrder = btn.dataset.order;
          document.querySelectorAll('.order-pick-btn').forEach(b => {
            const active = b.dataset.order === Game.turnOrder;
            b.className = `order-pick-btn py-1.5 px-2 rounded-lg text-xs font-bold border ${active ? 'bg-amber-700 text-white border-amber-400' : 'bg-stone-800 text-stone-300 border-stone-700'}`;
          });
        });
      });

      document.getElementById('btn-start-match').addEventListener('click', initNewMatch);

      // 组牌工坊绑定
      document.getElementById('btn-deck-builder').addEventListener('click', openDeckBuilder);
      document.getElementById('btn-close-deckbuilder').addEventListener('click', () => {
        document.getElementById('deckbuilder-modal').classList.add('hidden');
      });
      document.getElementById('btn-auto-deck').addEventListener('click', () => {
        SoundFX.manaGem();
        Game.builderDraft = getRecommendedCardIds(Game.heroClass);
        renderDeckBuilder();
      });
      document.getElementById('btn-clear-deck').addEventListener('click', () => {
        SoundFX.cardDraw();
        Game.builderDraft = [];
        renderDeckBuilder();
      });
      document.getElementById('btn-save-deck').addEventListener('click', () => {
        if (Game.builderDraft.length !== 22) {
          SoundFX.errorWarn();
          showSpeechToast(`套牌需要恰好 22 张卡牌（当前 ${Game.builderDraft.length}/22），也可点“智能推荐满编”！`);
          return;
        }
        Game.customDecks[Game.heroClass] = [...Game.builderDraft];
        savePersistentData();
        SoundFX.victory();
        showSpeechToast('✅ 专属套牌已保存，立即开启新对局！');
        initNewMatch();
      });
      document.querySelectorAll('.mana-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          Game.builderFilter = btn.dataset.manaFilter;
          document.querySelectorAll('.mana-filter-btn').forEach(b => {
            const active = b.dataset.manaFilter === Game.builderFilter;
            b.className = `mana-filter-btn px-2.5 py-0.5 rounded-full ${active ? 'bg-amber-600 text-white font-bold' : 'bg-stone-800 text-stone-300'}`;
          });
          renderDeckBuilder();
        });
      });

      // 图鉴与战报抽屉
      document.getElementById('btn-codex').addEventListener('click', () => {
        document.getElementById('codex-modal').classList.remove('hidden');
      });
      document.getElementById('btn-close-codex').addEventListener('click', () => {
        document.getElementById('codex-modal').classList.add('hidden');
      });

      const logDrawer = document.getElementById('battle-log-drawer');
      document.getElementById('btn-log-toggle').addEventListener('click', () => {
        const isHidden = logDrawer.classList.contains('hidden');
        if (isHidden) {
          logDrawer.className = 'fixed right-0 top-11 bottom-0 flex flex-col w-64 bg-stone-950/95 border-l border-amber-600/60 z-[45] shadow-2xl';
        } else {
          logDrawer.className = 'hidden';
        }
      });
      document.getElementById('btn-close-log').addEventListener('click', () => {
        logDrawer.className = 'hidden';
      });

      document.getElementById('btn-sound-toggle').addEventListener('click', (ev) => {
        const isMuted = SoundFX.toggleMute();
        ev.currentTarget.textContent = isMuted ? '🔇' : '🔊';
      });

      document.getElementById('btn-play-again').addEventListener('click', initNewMatch);
      document.getElementById('btn-change-hero-end').addEventListener('click', () => {
        document.getElementById('gameover-modal').classList.add('hidden');
        document.getElementById('newgame-modal').classList.remove('hidden');
      });
    }

    window.onload = () => {
      document.getElementById('pick-img-mage').src = PORTRAITS.mage;
      document.getElementById('pick-img-paladin').src = PORTRAITS.paladin;
      document.getElementById('pick-img-hunter').src = PORTRAITS.hunter;
      loadSavedData();
      FXEngine.start();
      populateCodexModal();
      bindEvents();
      initNewMatch();
      if (window.TutorialGuide) TutorialGuide.init({ skipFocus: true });
    };
