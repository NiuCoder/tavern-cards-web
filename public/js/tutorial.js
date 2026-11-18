/**
 * 炉石酒馆：新手引导
 * 仅使用 localStorage 键 hs_tavern_guide_v1 记录是否完成/跳过。
 * 不读写 hs_tavern_wins / hs_tavern_decks_v2，不修改 Game 状态。
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'hs_tavern_guide_v1';
  var STEPS = [
    {
      id: 'goal',
      title: '胜利目标',
      spotlight: null,
      body: '把对方英雄的生命降到 0，你就赢了；如果双方同时倒下，则是平局。标准对局里双方都是 30 点生命。\n\n第一次打开游戏会直接开始一局：默认职业是奥术法师（大法师艾琳）、标准酒馆难度、先手，并使用该职业自带的 22 张推荐套牌，不必先去「组牌工坊」。想换英雄或模式，点顶栏「换职/新局」。若选择地下城闯关，需要连续击败 3 名首领，前两关胜利后可以三选一获得一件被动宝藏。'
    },
    {
      id: 'setup',
      title: '选职业、默认套牌和难度',
      spotlight: 'btn-new-game',
      body: '三位英雄都已配好推荐套牌，选好就可以开战：\n\n• 大法师艾琳（奥术法师）：英雄技能「火焰冲击」，花费 2 点法力，对你指定的任意目标造成 1 点伤害。\n• 圣光统帅洛萨（圣殿骑士）：「白银援军」，花费 2 点法力，召唤一个 1/1 的白银之手新兵。\n• 荒野游侠雷恩（丛林猎手）：「稳固射击」，花费 2 点法力，对敌方英雄造成 2 点伤害。\n\n难度可选「标准酒馆」（对手 30 血）、「英雄黑龙」（对手 40 血并带 5 点护甲）或「地下城闯关」。先后手只影响起手牌数量和幸运币：先手抽 3 张，后手抽 4 张，确认换牌后后手会得到一张 0 费「幸运币」。无论先手后手，换完牌后都由你先行动。'
    },
    {
      id: 'mulligan',
      title: '起手换牌',
      spotlight: null,
      body: '对局开始时会进入「起手换牌阶段」。点击不想留的牌，牌面上会标「替换此牌」，再点一次可取消标记。点「确认起手 · 开始对决！」后，被标记的牌会放回牌库并洗匀，同时补上等量新牌；也可以一张都不换。\n\n确认之后你会再抽 1 张牌，第一回合拥有 1 点法力。本引导不会挡住换牌或选择职业，可以边看边操作。'
    },
    {
      id: 'mana',
      title: '法力、可打出的手牌和目标',
      spotlight: 'player-hand-row',
      body: '每个你的回合开始时，法力上限会增加 1 点（最多 10 点）并回满。费用足够、当前可以打出的手牌会带绿色光晕。\n\n点击一张发光的手牌：如果这张牌需要目标，画面上方会出现提示，请再点击被高亮的随从或英雄；可用提示条上的「取消」或键盘 Esc 取消。不需要目标的牌，再点击一次这张牌，或点击战场中央的打出提示即可出牌。法力不够时会提示「我没有足够的法力值！」。随从场上最多 7 个。'
    },
    {
      id: 'minions',
      title: '随从攻击、召唤等待和嘲讽',
      spotlight: 'player-board-row',
      body: '普通随从刚召唤的这一回合不能攻击，需要等到下一回合。带「冲锋」的随从当回合就可以攻击敌方随从或英雄；带「突袭」的随从当回合只能攻击随从，如果对面没有随从，这一回合无法出手。\n\n敌方有「嘲讽」随从时，必须先攻击这些嘲讽，不能绕过去打英雄或其他随从。轮到你可以攻击时，先点自己的随从，再点高亮的目标。'
    },
    {
      id: 'hero',
      title: '英雄技能和武器',
      spotlight: 'btn-hero-power',
      body: '英雄技能默认每回合只能使用 1 次，通常花费 2 点法力，按钮就在你的英雄旁边。艾琳的「火焰冲击」点技能后再选目标；洛萨和雷恩的技能点一下就会生效。\n\n如果打出了武器，点击你的英雄再点击目标即可攻击，伤害是英雄攻击力加上武器攻击力。武器有耐久，每攻击一次耐久减 1，降到 0 会损坏。带「风怒」的武器一回合可以攻击两次。'
    },
    {
      id: 'endturn',
      title: '结束回合',
      spotlight: 'btn-end-turn',
      body: '这一回合想出的牌和攻击都完成后，点击棋盘右侧的「结束回合」，就会轮到对手行动。如果你已经没有可打出的牌、也没有可发动的攻击或技能，这个按钮会变成更醒目的绿色，提醒你可以结束回合。\n\n对手行动结束后会回到你的回合，法力再增加 1 点（直到 10）。以后可以随时在顶栏点「新手引导」再看一遍。祝你旗开得胜！'
    }
  ];

  var state = {
    index: 0,
    open: false,
    dismissedThisSession: false,
    bound: false,
    initialized: false
  };

  function storageAvailable() {
    try {
      var probe = '__tcw_guide_probe__';
      root.localStorage.setItem(probe, '1');
      root.localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  }

  function readDone() {
    try {
      return root.localStorage.getItem(STORAGE_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function writeDone() {
    state.dismissedThisSession = true;
    try {
      root.localStorage.setItem(STORAGE_KEY, '1');
      return true;
    } catch (err) {
      return false;
    }
  }

  function el(id) {
    var doc = root.document;
    return doc && doc.getElementById ? doc.getElementById(id) : null;
  }

  function setHidden(node, hidden) {
    if (!node) return;
    if (hidden) {
      node.classList.add('hidden');
      node.setAttribute('hidden', '');
    } else {
      node.classList.remove('hidden');
      node.removeAttribute('hidden');
    }
  }

  function isPanelOpen() {
    var panel = el('tutorial-panel');
    if (!panel) return state.open;
    return !panel.classList.contains('hidden') && !panel.hasAttribute('hidden') && state.open;
  }

  function render() {
    var panel = el('tutorial-panel');
    if (!panel) return;

    var step = STEPS[state.index] || STEPS[0];
    var title = el('tutorial-title');
    var body = el('tutorial-body');
    var indicator = el('tutorial-step-indicator');
    var prev = el('btn-tutorial-prev');
    var next = el('btn-tutorial-next');

    if (title) title.textContent = step.title;
    if (body) {
      body.textContent = '';
      var parts = step.body.split('\n');
      parts.forEach(function (line, i) {
        if (i > 0) body.appendChild(root.document.createElement('br'));
        body.appendChild(root.document.createTextNode(line));
      });
    }
    if (indicator) indicator.textContent = '第 ' + (state.index + 1) + ' / ' + STEPS.length + ' 步';

    if (prev) {
      prev.disabled = state.index <= 0;
      prev.setAttribute('aria-disabled', prev.disabled ? 'true' : 'false');
    }
    if (next) {
      var last = state.index >= STEPS.length - 1;
      next.textContent = last ? '完成' : '下一步';
      next.setAttribute('data-action', last ? 'complete' : 'next');
    }

    setHidden(panel, !state.open);
    panel.setAttribute('aria-hidden', state.open ? 'false' : 'true');
    updateSpotlight(state.open ? step.spotlight : null);
  }

  function ensureSpotlight() {
    var doc = root.document;
    if (!doc || !doc.body) return null;
    var spot = el('tutorial-spotlight');
    if (spot) return spot;
    spot = doc.createElement('div');
    spot.id = 'tutorial-spotlight';
    spot.className = 'tutorial-spotlight hidden';
    spot.setAttribute('aria-hidden', 'true');
    doc.body.appendChild(spot);
    return spot;
  }

  function updateSpotlight(targetId) {
    var spot = ensureSpotlight();
    if (!spot) return;
    if (!targetId) {
      setHidden(spot, true);
      return;
    }
    var target = el(targetId);
    if (!target) {
      setHidden(spot, true);
      return;
    }
    var rect;
    try {
      rect = target.getBoundingClientRect();
    } catch (err) {
      setHidden(spot, true);
      return;
    }
    if (!rect || rect.width < 4 || rect.height < 4) {
      setHidden(spot, true);
      return;
    }
    var pad = 6;
    spot.style.top = Math.max(0, rect.top - pad) + 'px';
    spot.style.left = Math.max(0, rect.left - pad) + 'px';
    spot.style.width = (rect.width + pad * 2) + 'px';
    spot.style.height = (rect.height + pad * 2) + 'px';
    setHidden(spot, false);
  }

  function open(opts) {
    opts = opts || {};
    state.index = typeof opts.index === 'number' ? Math.max(0, Math.min(STEPS.length - 1, opts.index)) : 0;
    state.open = true;
    render();
    var next = el('btn-tutorial-next');
    if (next && typeof next.focus === 'function' && !opts.skipFocus) {
      try { next.focus(); } catch (err) {}
    }
  }

  function close() {
    state.open = false;
    render();
  }

  function next() {
    if (!state.open) return;
    if (state.index >= STEPS.length - 1) {
      complete();
      return;
    }
    state.index += 1;
    render();
  }

  function prev() {
    if (!state.open) return;
    if (state.index <= 0) return;
    state.index -= 1;
    render();
  }

  function skip() {
    writeDone();
    close();
  }

  function complete() {
    writeDone();
    close();
  }

  function shouldAutoOpen() {
    if (state.dismissedThisSession) return false;
    return !readDone();
  }

  function onResize() {
    if (state.open) {
      var step = STEPS[state.index];
      updateSpotlight(step && step.spotlight);
    }
  }

  function bind() {
    if (state.bound) return;
    state.bound = true;

    var openBtn = el('btn-tutorial');
    var skipBtn = el('btn-tutorial-skip');
    var prevBtn = el('btn-tutorial-prev');
    var nextBtn = el('btn-tutorial-next');
    var panel = el('tutorial-panel');

    if (openBtn) {
      openBtn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        open({ fromUser: true });
      });
    }
    if (skipBtn) {
      skipBtn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        skip();
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        prev();
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', function (ev) {
        if (ev && ev.stopPropagation) ev.stopPropagation();
        next();
      });
    }
    if (panel) {
      panel.addEventListener('keydown', function (ev) {
        if (!ev || !state.open) return;
        if (ev.key === 'ArrowRight') {
          ev.preventDefault();
          next();
        } else if (ev.key === 'ArrowLeft') {
          ev.preventDefault();
          prev();
        }
      });
    }

    if (root.addEventListener) {
      root.addEventListener('resize', onResize);
    }
  }

  function init(opts) {
    opts = opts || {};
    bind();
    if (!state.initialized) {
      state.initialized = true;
      if (opts.forceOpen || shouldAutoOpen()) {
        open({ skipFocus: !!opts.skipFocus, index: 0 });
      } else {
        state.open = false;
        render();
      }
    } else if (opts.forceOpen) {
      open({ skipFocus: !!opts.skipFocus, index: 0 });
    }
    return TutorialGuide;
  }

  function resetForTests() {
    state.index = 0;
    state.open = false;
    state.dismissedThisSession = false;
    state.initialized = false;
    // keep bound as-is if DOM reused; tests may set bound false
  }

  var TutorialGuide = {
    STORAGE_KEY: STORAGE_KEY,
    STEPS: STEPS,
    init: init,
    open: open,
    close: close,
    next: next,
    prev: prev,
    skip: skip,
    complete: complete,
    isOpen: isPanelOpen,
    isComplete: function () {
      return state.dismissedThisSession || readDone();
    },
    storageAvailable: storageAvailable,
    readDone: readDone,
    getIndex: function () { return state.index; },
    resetForTests: resetForTests,
    _state: state
  };

  root.TutorialGuide = TutorialGuide;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TutorialGuide;
  }

  if (root.document && root.document.addEventListener) {
    root.document.addEventListener('DOMContentLoaded', function () {
      bind();
    });
    if (root.addEventListener) {
      root.addEventListener('load', function () {
        init({ skipFocus: true });
      });
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
