import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
function setup() {
  const node = () => ({ classList: { toggle() {} }, style: {}, value: '', focus() {} });
  const el = Object.fromEntries(['content', 'editor', 'counter', 'editorBar', 'cuesPane', 'saveState'].map(k => [k, node()]));
  const heights = [];
  el.editor.style = new Proxy({}, { set(target, key, value) { if (key === 'height') heights.push(value); target[key] = value; return true; } });
  el.editor.getBoundingClientRect = () => ({ width: 600 });
  el.editor.cloneNode = () => ({ ...node(), removeAttribute() {}, setAttribute() {}, remove() {}, scrollHeight: 1500 });
  const state = { draft: { id: 1, content: 'old' }, mode: 'edit', dirty: false };
  const pending = [];
  const timers = [];
  const ctx = vm.createContext({ el, state, heights, pending, timers,
    document: { body: { appendChild() {} } },
    getComputedStyle: () => ({ borderTopWidth: '1', borderBottomWidth: '1' }),
    withIllus: text => `<p>${text}</p>`, countChars: text => text.length,
    updateActionLabels() {}, syncModeUi() {}, hideMenus() {}, renderCues() {}, loadHistory() {},
    clearTimeout() {}, setTimeout: fn => timers.push(fn),
    api: (path, options) => new Promise((resolve, reject) => pending.push({ path, options, resolve, reject })),
  });
  vm.runInContext(source.slice(source.indexOf('function renderContent()'), source.indexOf('/* ---------------- 保存')), ctx);
  vm.runInContext('let saveTimer; let saving = false;\n' + source.slice(source.indexOf('async function flushSave()'), source.indexOf("el.saveBtn.addEventListener")), ctx);
  return ctx;
}

test('returning to preview renders current unsaved text immediately', () => {
  const ctx = setup();
  ctx.state.draft.content = 'new text';
  vm.runInContext("setMode('read')", ctx);
  assert.equal(ctx.el.content.innerHTML, '<p>new text</p>');
});

test('height measurement never collapses the live editor', () => {
  const ctx = setup();
  vm.runInContext('resizeEditor()', ctx);
  assert.deepEqual(ctx.heights, ['1502px']);
});

test('save requests serialize and preserve input typed during a request', async () => {
  const ctx = setup();
  ctx.state.dirty = true;
  const first = vm.runInContext('flushSave()', ctx);
  ctx.state.draft.content = 'latest';
  ctx.state.dirty = true;
  await vm.runInContext('flushSave()', ctx);
  assert.equal(ctx.pending.length, 1);
  ctx.pending[0].resolve({ draft: { id: 1, content: 'old' } });
  await first;
  assert.equal(ctx.state.draft.content, 'latest');
  assert.equal(ctx.state.dirty, true);
  const next = ctx.timers.pop()();
  assert.equal(ctx.pending[1].options.body.content, 'latest');
  ctx.pending[1].resolve({ draft: { id: 1, content: 'latest' } });
  await next;
  assert.equal(ctx.state.dirty, false);
  assert.equal(ctx.el.saveState.textContent, '已保存');
});

test('a response from a previous draft does not replace the current draft', async () => {
  const ctx = setup();
  ctx.state.dirty = true;
  const request = vm.runInContext('flushSave()', ctx);
  ctx.state.draft = { id: 2, content: 'another draft' };
  ctx.pending[0].resolve({ draft: { id: 1, content: 'old' } });
  await request;
  assert.equal(ctx.state.draft.id, 2);
  assert.equal(ctx.state.draft.content, 'another draft');
});

test('failed saves remain dirty for a manual retry without a retry loop', async () => {
  const ctx = setup();
  ctx.state.dirty = true;
  const request = vm.runInContext('flushSave()', ctx);
  ctx.pending[0].reject(new Error('offline'));
  await request;
  assert.equal(ctx.state.dirty, true);
  assert.equal(ctx.el.saveState.textContent, '保存失败：offline');
  assert.equal(ctx.timers.length, 0);
});
