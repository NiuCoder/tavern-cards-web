import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'public/js/tutorial.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/css/style.css'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

class FakeClassList {
  constructor(el) { this.el = el; }
  _parts() {
    return (this.el.className || '').split(/\s+/).filter(Boolean);
  }
  _set(parts) { this.el.className = parts.join(' '); }
  add(name) {
    const parts = this._parts();
    if (!parts.includes(name)) parts.push(name);
    this._set(parts);
  }
  remove(name) { this._set(this._parts().filter((p) => p !== name)); }
  contains(name) { return this._parts().includes(name); }
  toggle(name, force) {
    if (force === true) this.add(name);
    else if (force === false) this.remove(name);
    else if (this.contains(name)) this.remove(name);
    else this.add(name);
  }
}

class FakeEl {
  constructor(id, tag = 'div') {
    this.id = id;
    this.tagName = tag.toUpperCase();
    this.className = '';
    this.classList = new FakeClassList(this);
    this.attributes = {};
    this.children = [];
    this.listeners = {};
    this.style = {};
    this.disabled = false;
    this._text = '';
    this._html = '';
    this.dataset = {};
    this.width = 80;
    this.height = 40;
  }
  get textContent() { return this._text; }
  set textContent(v) {
    this._text = v == null ? '' : String(v);
    this._html = this._text;
    this.children = [];
  }
  get innerHTML() { return this._html; }
  set innerHTML(v) {
    this._html = v == null ? '' : String(v);
    this._text = this._html;
    this.children = [];
  }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k) ? this.attributes[k] : null; }
  hasAttribute(k) { return Object.prototype.hasOwnProperty.call(this.attributes, k); }
  removeAttribute(k) { delete this.attributes[k]; }
  appendChild(child) {
    this.children.push(child);
    if (child.nodeType === 3) this._text += child.data;
    else if (child.tagName === 'BR') this._text += '\n';
    else this._text += child.textContent || '';
    return child;
  }
  addEventListener(type, fn) {
    (this.listeners[type] ||= []).push(fn);
  }
  click() {
    for (const fn of this.listeners.click || []) fn({ stopPropagation() {}, preventDefault() {} });
  }
  focus() { this.focused = true; }
  getBoundingClientRect() {
    return { top: 10, left: 10, width: this.width, height: this.height, bottom: 10 + this.height, right: 10 + this.width };
  }
}

function createStorage(map, throwsOn) {
  const store = map || new Map();
  return {
    store,
    getItem(key) {
      if (throwsOn && throwsOn.has('get')) throw new Error('blocked');
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      if (throwsOn && throwsOn.has('set')) throw new Error('blocked');
      store.set(String(key), String(value));
    },
    removeItem(key) {
      if (throwsOn && throwsOn.has('remove')) throw new Error('blocked');
      store.delete(key);
    }
  };
}

function loadGuide(options = {}) {
  const throwsOn = options.throwsOn || null;
  const store = options.store || new Map();
  const localStorage = createStorage(store, throwsOn);
  const elements = {};
  const ids = [
    'tutorial-panel', 'tutorial-title', 'tutorial-body', 'tutorial-step-indicator',
    'btn-tutorial', 'btn-tutorial-skip', 'btn-tutorial-prev', 'btn-tutorial-next',
    'btn-new-game', 'player-hand-row', 'player-board-row', 'btn-hero-power', 'btn-end-turn'
  ];
  for (const id of ids) {
    const tag = id.startsWith('btn-') ? 'button' : 'div';
    elements[id] = new FakeEl(id, tag);
  }
  elements['tutorial-panel'].classList.add('hidden');
  elements['tutorial-panel'].setAttribute('hidden', '');

  const document = {
    body: new FakeEl('body', 'body'),
    getElementById(id) { return elements[id] || (id === 'tutorial-spotlight' ? elements[id] : null); },
    createElement(tag) {
      const node = new FakeEl('', tag);
      if (tag === 'div') {
        // spotlight created later; register when id assigned
      }
      const orig = Object.getOwnPropertyDescriptor(FakeEl.prototype, 'id') || null;
      return node;
    },
    createTextNode(text) { return { nodeType: 3, data: String(text), textContent: String(text) }; },
    addEventListener() {}
  };

  // Intercept spotlight creation
  const origCreate = document.createElement.bind(document);
  document.createElement = function (tag) {
    const node = new FakeEl('', tag);
    if (tag === 'div') {
      Object.defineProperty(node, 'id', {
        get() { return this._id || ''; },
        set(v) {
          this._id = v;
          if (v) elements[v] = node;
        },
        configurable: true
      });
    }
    return node;
  };

  const windowObj = {
    localStorage,
    document,
    addEventListener() {}
  };
  windowObj.window = windowObj;
  windowObj.globalThis = windowObj;

  vm.createContext(windowObj);
  vm.runInContext(source, windowObj);
  const Guide = windowObj.TutorialGuide;
  Guide._state.bound = false;
  Guide._state.initialized = false;
  Guide.resetForTests();
  Guide._state.bound = false;
  return { Guide, elements, localStorage, store, document, windowObj };
}

describe('newbie tutorial', () => {
  it('has seven Chinese steps covering required topics', () => {
    const { Guide } = loadGuide();
    assert.equal(Guide.STEPS.length, 7);
    const blob = Guide.STEPS.map((s) => s.title + s.body).join('\n');
    for (const word of ['胜利', '职业', '推荐套牌', '标准酒馆', '起手换牌', '法力', '绿色光晕', '嘲讽', '冲锋', '突袭', '英雄技能', '武器', '结束回合', '组牌工坊', '幸运币']) {
      assert.ok(blob.includes(word), `missing ${word}`);
    }
    assert.match(blob, /不必先去「组牌工坊」/);
    assert.match(blob, /换完牌后都由你先行动/);
    assert.match(blob, /确认起手 · 开始对决/);
  });

  it('auto-opens on first visit when storage is empty', () => {
    const { Guide, elements } = loadGuide();
    Guide.init({ skipFocus: true });
    assert.equal(Guide.isOpen(), true);
    assert.equal(Guide.getIndex(), 0);
    assert.equal(elements['tutorial-title'].textContent, '胜利目标');
    assert.ok(!elements['tutorial-panel'].classList.contains('hidden'));
    assert.equal(elements['tutorial-step-indicator'].textContent, '第 1 / 7 步');
    assert.equal(elements['btn-tutorial-prev'].disabled, true);
    assert.equal(elements['btn-tutorial-next'].textContent, '下一步');
  });

  it('does not auto-open after completion, but header can reopen', () => {
    const store = new Map([['hs_tavern_guide_v1', '1']]);
    const { Guide, elements } = loadGuide({ store });
    Guide.init({ skipFocus: true });
    assert.equal(Guide.isOpen(), false);
    assert.ok(elements['tutorial-panel'].classList.contains('hidden'));
    elements['btn-tutorial'].click();
    assert.equal(Guide.isOpen(), true);
    assert.equal(Guide.getIndex(), 0);
    assert.equal(elements['tutorial-title'].textContent, '胜利目标');
  });

  it('supports next, previous, complete, and skip', () => {
    const { Guide, elements, store } = loadGuide();
    Guide.init({ skipFocus: true });
    Guide.next();
    assert.equal(Guide.getIndex(), 1);
    assert.equal(elements['tutorial-title'].textContent, '选职业、默认套牌和难度');
    assert.equal(elements['btn-tutorial-prev'].disabled, false);
    Guide.prev();
    assert.equal(Guide.getIndex(), 0);
    assert.equal(elements['btn-tutorial-prev'].disabled, true);

    for (let i = 0; i < 6; i++) Guide.next();
    assert.equal(Guide.getIndex(), 6);
    assert.equal(elements['btn-tutorial-next'].textContent, '完成');
    elements['btn-tutorial-next'].click();
    assert.equal(Guide.isOpen(), false);
    assert.equal(store.get('hs_tavern_guide_v1'), '1');

    const second = loadGuide();
    second.Guide.init({ skipFocus: true });
    second.elements['btn-tutorial-skip'].click();
    assert.equal(second.Guide.isOpen(), false);
    assert.equal(second.store.get('hs_tavern_guide_v1'), '1');
    assert.equal(second.store.has('hs_tavern_wins'), false);
    assert.equal(second.store.has('hs_tavern_decks_v2'), false);
  });

  it('does not rewrite existing save keys', () => {
    const store = new Map([
      ['hs_tavern_wins', '7'],
      ['hs_tavern_decks_v2', '{"mage":[]}']
    ]);
    const { Guide, store: out } = loadGuide({ store });
    Guide.init({ skipFocus: true });
    Guide.skip();
    assert.equal(out.get('hs_tavern_wins'), '7');
    assert.equal(out.get('hs_tavern_decks_v2'), '{"mage":[]}');
    assert.equal(out.get('hs_tavern_guide_v1'), '1');
  });

  it('stays usable when localStorage throws', () => {
    const throwsOn = new Set(['get', 'set', 'remove']);
    const { Guide, elements } = loadGuide({ throwsOn });
    assert.doesNotThrow(() => Guide.init({ skipFocus: true }));
    assert.equal(Guide.isOpen(), true);
    assert.doesNotThrow(() => Guide.skip());
    assert.equal(Guide.isOpen(), false);
    assert.equal(Guide.isComplete(), true);

    const again = loadGuide({ throwsOn });
    assert.doesNotThrow(() => again.Guide.init({ skipFocus: true }));
    assert.equal(again.Guide.isOpen(), true, 'without durable storage, guide may show again next load');
    assert.doesNotThrow(() => again.elements['btn-tutorial'].click());
    assert.equal(again.Guide.isOpen(), true);
  });

  it('header markup and CSS are mobile-friendly', () => {
    assert.match(indexHtml, /id="btn-tutorial"/);
    assert.match(indexHtml, /aria-label="新手引导"/);
    assert.match(indexHtml, /id="tutorial-panel"/);
    assert.match(indexHtml, /aria-modal="false"/);
    assert.match(indexHtml, /src="js\/tutorial\.js"/);
    assert.ok(indexHtml.indexOf('js/tutorial.js') < indexHtml.indexOf('js/game.js'));

    assert.match(css, /\.tutorial-panel\s*\{/);
    assert.match(css, /z-index:\s*80/);
    assert.match(css, /pointer-events:\s*none/);
    assert.match(css, /max-height:\s*min\(42vh,\s*22rem\)/);
    assert.match(css, /min-height:\s*44px/);
    assert.match(css, /@media \(min-width: 640px\)/);
    assert.ok(!css.includes('pointer-events: none') || /tutorial-panel[\s\S]*pointer-events:\s*none/.test(css));
    // card itself must accept taps
    assert.match(css, /\.tutorial-panel-card\s*\{[\s\S]*pointer-events:\s*auto/);
    assert.match(css, /overflow-y:\s*auto/);
  });

  it('does not touch Game state or write the original save keys', () => {
    assert.doesNotMatch(source, /\bGame\./);
    assert.doesNotMatch(source, /localStorage\.(get|set|remove)Item\([^)]*hs_tavern_wins/);
    assert.doesNotMatch(source, /localStorage\.(get|set|remove)Item\([^)]*hs_tavern_decks_v2/);
    assert.match(source, /STORAGE_KEY = 'hs_tavern_guide_v1'/);
  });
});
