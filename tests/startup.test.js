import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { initResearch, assistSnapshotValid } from '../public/research.js';
import { buildSelectionMap, findRawSelection } from '../public/selection-map.js';
import { variantIsStale } from '../public/content-fingerprint.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8')
  .replace(/^import .*from '\.\/research\.js';\r?\n/m, '')
  .replace(/^import .*from '\.\/selection-map\.js';\r?\n/m, '')
  .replace(/^import .*from '\.\/content-fingerprint\.js';\r?\n/m, '');

// Exercise the entire actual module and research initializer, with DOM operations
// represented in memory. This is startup verification, not browser rendering QA.
function setup(user) {
  const nodes = new Map();
  function node(id = '') {
    const classes = new Set();
    const element = {
      id, value: '', textContent: '', style: {}, dataset: {}, disabled: false, open: false,
      selectedOptions: [], children: [], files: [], listeners: {},
      classList: { add: (...v) => v.forEach(x => classes.add(x)), remove: (...v) => v.forEach(x => classes.delete(x)),
        contains: x => classes.has(x), toggle(x, on = !classes.has(x)) { on ? classes.add(x) : classes.delete(x); } },
      addEventListener(name, fn) { this.listeners[name] = fn; },
      querySelector: () => node(), querySelectorAll: () => [], appendChild() {}, prepend() {},
      setAttribute() {}, removeAttribute() {}, focus() {}, contains() { return false; },
      showModal() { this.open = true; }, close() { this.open = false; },
    };
    Object.defineProperty(element, 'innerHTML', { get() { return this.markup || ''; }, set(value) { this.markup = value; register(value); } });
    element.parentElement = { style: {}, prepend() {} };
    return element;
  }
  function register(markup) {
    for (const match of markup.matchAll(/\bid="([^"]+)"/g)) if (!nodes.has(match[1])) nodes.set(match[1], node(match[1]));
  }
  register(html);
  for (const id of ['authScreen', 'app']) nodes.get(id).classList.add('hidden');
  const brief = nodes.get('briefForm');
  for (const name of ['subject', 'platform', 'tone', 'audience', 'length', 'keywords']) brief[name] = node();
  const document = { getElementById: id => nodes.get(id) || null, createElement: () => node(),
    querySelector: () => node(), querySelectorAll: () => [], addEventListener() {}, body: node(), documentElement: node() };
  const requests = [];
  const meta = { platforms: [], tones: [], llm: { label: 'test', live: false } };
  const context = vm.createContext({
    document, initResearch, assistSnapshotValid, buildSelectionMap, findRawSelection, variantIsStale, console, URLSearchParams,
    location: { search: '' }, navigator: {}, localStorage: { getItem: () => null, setItem() {} },
    window: { addEventListener() {}, innerWidth: 1000, innerHeight: 800 },
    IntersectionObserver: class { observe() {} },
    getComputedStyle: () => ({ getPropertyValue: () => '66px' }),
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    fetch: async path => {
      requests.push(path);
      let data = {};
      if (path === '/api/me') data = { user };
      else if (path === '/api/meta') data = meta;
      else if (path === '/api/personas') data = { personas: [] };
      else if (path.startsWith('/api/drafts')) data = { drafts: [], counts: { active: 0, archived: 0, activeDone: 0 } };
      else if (path.startsWith('/api/pool')) data = { pool: [] };
      else if (path.startsWith('/api/plan')) data = { quota: null };
      return { ok: true, json: async () => data };
    },
  });
  return { context, nodes, document, requests };
}

for (const user of [null, { id: 1, username: 'startup-fixture' }]) {
  test(`complete frontend bootstrap reaches ${user ? 'the app' : 'the login screen'} without early-reference errors`, async () => {
    const c = setup(user);
    const previousDocument = globalThis.document;
    globalThis.document = c.document;
    try {
      vm.runInContext(app, c.context, { filename: 'public/app.js' });
      await new Promise(resolve => setImmediate(resolve));
      assert.ok(c.requests.includes('/api/me'));
      assert.ok(c.requests.includes('/api/meta'));
      assert.equal(c.nodes.get(user ? 'app' : 'authScreen').classList.contains('hidden'), false);
      assert.equal(c.nodes.get('toast').textContent, '');
    } finally { globalThis.document = previousDocument; }
  });
}
