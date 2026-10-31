import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { initResearch, assistSnapshotValid } from '../public/research.js';

function setup() {
  const nodes = new Map();
  const node = () => ({ value: '', textContent: '', disabled: false, open: false, files: [], classList: { add() {}, toggle() {}, remove() {} }, listeners: {},
    addEventListener(name, fn) { this.listeners[name] = fn; }, showModal() { this.open = true; }, close() { this.open = false; this.listeners.close?.(); } });
  const get = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
  const modal = node();
  globalThis.document = { getElementById: get, createElement: () => modal, body: { appendChild() {} } };
  globalThis.FileReader = class { readAsDataURL() { this.result = 'data:text/markdown;base64,b3JpZ2luYWw='; this.onload(); } };
  const pending = [], shown = [], notices = [];
  const state = { personaId: 1, draft: { id: 7, content: 'old' }, dirty: false, personas: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }] };
  let saveOK = true;
  const ui = initResearch({ state, api: (path, options) => new Promise((resolve, reject) => pending.push({ path, options, resolve, reject })),
    setDraft: d => shown.push(d), loadHistory: async () => {}, toast: text => notices.push(text), currentPersona: () => state.personas.find(p => p.id === state.personaId), esc: text => text,
    ensureSaved: async () => saveOK, canSwitchDraft: () => !state.dirty });
  return { ui, pending, shown, state, get, modal, notices, setSaveOK: value => { saveOK = value; } };
}
const skill = (markdown, version = 1) => ({ skill: { markdown, version, hasPrevious: true } });
const tick = () => new Promise(resolve => setImmediate(resolve));

test('pasted Markdown preserves Unicode and formatting and imports before generating in one action', async () => {
  const c = setup();
  globalThis.FileReader = class {
    async readAsDataURL(file) { this.result = `data:text/markdown;base64,${Buffer.from(await file.arrayBuffer()).toString('base64')}`; this.onload(); }
  };
  const text = '# 研究 📝\n\n保留 **证据** 与限定条件。\n';
  c.get('researchPaste').value = text;
  c.get('researchPaste').oninput();
  assert.equal(c.get('researchGenerate').disabled, false);
  const task = c.get('researchGenerate').onclick();
  await tick();
  const request = c.pending.shift();
  assert.match(request.path, /research-import$/);
  assert.equal(Buffer.from(request.options.body.base64, 'base64').toString('utf8'), text);
  request.resolve({ source: { id: 41, text, warnings: [] } });
  await tick();
  const generate = c.pending.shift();
  assert.equal(generate.options.body.source_id, 41);
  generate.resolve({ draft: { id: 42, content: 'article' } });
  await task;
  assert.equal(c.shown[0].id, 42);
});

test('editing pasted content invalidates a previous source and over-limit text never imports', async () => {
  const c = setup();
  c.get('researchPaste').value = 'x'.repeat(60001);
  c.get('researchPaste').oninput();
  assert.equal(c.get('researchGenerate').disabled, true);
  await c.get('researchGenerate').onclick();
  assert.equal(c.pending.length, 0);
  c.get('researchPaste').value = 'new'; c.get('researchPaste').oninput();
  c.ui.reset();
  assert.equal(c.get('researchPaste').value, '');
  assert.equal(c.get('researchGenerate').disabled, true);
});

test('Skill saving is bound to its editing session; late A save cannot write B rules or version', async () => {
  const c = setup();
  const openA = c.ui.openSkill(1); c.pending.shift().resolve(skill('A rules')); await openA;
  c.get('researchSkillEditor').value = 'A edited';
  const saveA = c.get('researchRuleSave').onclick();
  const saving = c.pending.shift();
  assert.equal(c.get('researchRulePrevious').disabled, true);
  assert.equal(c.get('researchRuleDefault').disabled, true);
  c.get('researchRuleCancel').onclick();
  const openB = c.ui.openSkill(2); c.pending.shift().resolve(skill('B rules', 1)); await openB;
  saving.resolve(skill('A edited', 2)); await saveA;
  assert.equal(c.get('researchSkillEditor').value, 'B rules');
  assert.equal(c.modal.open, true);
  c.get('researchSkillEditor').value = 'B edited';
  const saveB = c.get('researchRuleSave').onclick();
  const req = c.pending.shift();
  assert.equal(req.path, '/personas/2/writing-skill');
  assert.equal(req.options.body.version, 1);
  assert.equal(req.options.body.markdown, 'B edited');
  req.resolve(skill('B edited', 2)); await saveB;
});

test('late Skill opens and responses after cancel are ignored; repeated save/restore cannot race', async () => {
  const c = setup();
  const a = c.ui.openSkill(1), reqA = c.pending.shift();
  const b = c.ui.openSkill(2), reqB = c.pending.shift();
  reqB.resolve(skill('B')); await b; reqA.resolve(skill('A')); await a;
  assert.equal(c.get('researchSkillEditor').value, 'B');
  const save = c.get('researchRuleSave').onclick(), reqSave = c.pending.shift();
  await c.get('researchRuleDefault').onclick();
  assert.equal(c.pending.length, 0);
  c.get('researchRuleCancel').onclick(); reqSave.resolve(skill('B updated', 2)); await save;
  assert.equal(c.modal.open, false);
  assert.equal(c.get('researchSkillEditor').value, 'B');
});

async function importSource(c) {
  c.get('researchFile').files = [{ name: 'x.md', size: 8 }];
  const importing = c.get('researchFile').onchange(); await tick();
  c.pending.shift().resolve({ source: { id: 10, text: 'original', warnings: [] } }); await importing;
}
test('import responses cannot reuse sources after account change or a newer import', async () => {
  const c = setup();
  c.get('researchFile').files = [{ name: 'x.md', size: 8 }];
  const importing = c.get('researchFile').onchange(); await tick(); const req = c.pending.shift();
  c.state.personaId = 2; c.ui.reset();
  req.resolve({ source: { id: 10, text: 'A material', warnings: [] } }); await importing;
  assert.equal(c.get('researchGenerate').disabled, true);
  await c.get('researchGenerate').onclick();
  assert.equal(c.pending.length, 0);
});
test('generation first saves existing text; failed/pending saves do not start generation', async () => {
  const c = setup(); await importSource(c); c.setSaveOK(false);
  await c.get('researchGenerate').onclick();
  assert.equal(c.pending.length, 0);
  assert.match(c.get('researchStatus').textContent, /尚未保存成功/);
});
test('late generation preserves edited, switched, and newly imported contexts, while an unchanged context opens the completed draft', async () => {
  for (const change of ['text', 'dirty', 'draft', 'account', 'import', 'none']) {
    const c = setup(); await importSource(c);
    const running = c.get('researchGenerate').onclick(); await tick();
    const req = c.pending.shift();
    if (change === 'text') c.state.draft.content = 'new unsaved text';
    if (change === 'dirty') c.state.dirty = true;
    if (change === 'draft') c.state.draft = { id: 8, content: 'other' };
    if (change === 'account') c.state.personaId = 2;
    if (change === 'import') c.ui.reset();
    req.resolve({ draft: { id: 99, content: 'generated' } }); await running;
    assert.equal(c.shown.length, change === 'none' ? 1 : 0, change);
    if (change === 'text') assert.equal(c.state.draft.content, 'new unsaved text');
  }
});

test('selection menu input and assist surfaces ignore outer mouseup; deferred selection ignores changed draft', () => {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const start = source.indexOf("document.addEventListener('mouseup', (event)");
  const end = source.indexOf('/* 同一句话', start);
  const timers = []; let callback, selectionReads = 0, hides = 0;
  const el = { selMenu: { contains: x => x === 'input', classList: { add: () => hides++ } }, slashMenu: { contains: x => x === 'slash' }, assistPop: { contains: x => x === 'assist' }, content: { contains: () => false } };
  const state = { mode: 'read', draft: { id: 1, content: 'source' } };
  vm.runInNewContext(source.slice(start, end), { document: { addEventListener: (name, fn) => { callback = fn; } }, el, state, setTimeout: fn => timers.push(fn), window: { getSelection: () => { selectionReads++; return { rangeCount: 0 }; } } });
  for (const target of ['input', 'slash', 'assist']) callback({ target });
  assert.equal(timers.length, 0);
  callback({ target: 'content' }); state.draft.content = 'changed'; timers.shift()();
  assert.equal(selectionReads, 0);
  assert.equal(hides, 0);
});

function assistContext() {
  const source = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const node = () => ({ textContent: '', innerHTML: '', disabled: false, classList: { add() {}, remove() {}, toggle() {} } });
  const el = Object.fromEntries(['assistTitle', 'assistBody', 'assistPop', 'assistReplace', 'assistInsert'].map(id => [id, node()]));
  const pending = [], saves = [], notices = [], rules = node();
  const state = { draft: { id: 1, content: 'first selected last', variants: { zhihu: { content: '版本 first selected last' } }, research: { sourceId: 1 } } };
  const ver = { current: '' };
  const ctx = vm.createContext({ el, state, pending, saves, notices, ver, AbortController, assistSnapshotValid,
    currentText: () => (ver.current ? state.draft.variants[ver.current].content : state.draft.content),
    $: () => rules, positionAssist() {}, esc: text => text, toast: text => notices.push(text),
    renderContent() {}, renderVersionTabs() {}, renderIllusBar() {}, showVersion() {}, markDirty() { state.dirty = true; },
    fetch: (path, options) => new Promise(resolve => pending.push({ path, options, resolve })),
    api: (path, options) => new Promise(resolve => saves.push({ path, options, resolve })),
    readSSE: async (res, callback) => { for (const [event, data] of res.events) callback(event, data); },
  });
  vm.runInContext(source.slice(source.indexOf('async function runAssist('), source.indexOf('function positionAssist(')), ctx);
  vm.runInContext(source.slice(source.indexOf('function closeAssist()'), source.indexOf("el.assistClose.addEventListener")), ctx);
  const applyStart = source.indexOf('async function applyAssist(');
  vm.runInContext(source.slice(applyStart, source.indexOf('/* ==================================================================', applyStart)), ctx);
  ctx.req = { kind: 'rewrite', instruction: '简洁', target: { start: 6, end: 14, text: 'selected' } };
  const finish = (request, text) => request.resolve({ ok: true, events: [['delta', { text }], ['done', { text }]] });
  return { ctx, finish, pending, saves, el, state, ver, notices };
}
test('assist streams preview only; explicit confirmation replaces the exact selection', async () => {
  const c = assistContext();
  const call = vm.runInContext("runAssist(req, '自定义')", c.ctx);
  assert.match(c.pending[0].path, /research-assist$/);
  c.finish(c.pending.shift(), 'replacement'); await call;
  assert.equal(c.state.draft.content, 'first selected last');
  vm.runInContext("applyAssist('replace')", c.ctx);
  assert.equal(c.state.draft.content, 'first replacement last');
  assert.equal(c.state.dirty, true);
});

test('assist on a platform version locates, validates and saves that version only', async () => {
  const c = assistContext();
  c.ver.current = 'zhihu';
  c.ctx.req = { kind: 'rewrite', instruction: '简洁', target: { start: 9, end: 17, text: 'selected' } };
  const call = vm.runInContext("runAssist(req, '自定义')", c.ctx);
  const request = c.pending.shift();
  assert.equal(JSON.parse(request.options.body).before, '版本 first ');
  c.finish(request, 'replacement');
  await call;
  const applying = vm.runInContext("applyAssist('replace')", c.ctx);
  const save = c.saves.shift();
  assert.equal(save.path, '/drafts/1/variants/zhihu');
  assert.equal(save.options.method, 'PUT');
  assert.equal(save.options.body.previous, '版本 first selected last');
  save.resolve({ draft: {
    ...c.state.draft,
    variants: { zhihu: { content: '版本 first replacement last' } },
  } });
  await applying;
  assert.equal(c.state.draft.content, 'first selected last');
  assert.equal(c.state.draft.variants.zhihu.content, '版本 first replacement last');
  assert.equal(c.state.dirty, undefined);
});

test('late assist returns cannot overwrite another request, a closed preview or edited/switched text', async () => {
  for (const change of ['new-request', 'closed', 'text', 'draft']) {
    const c = assistContext();
    const first = vm.runInContext("runAssist(req, 'first')", c.ctx), firstRequest = c.pending.shift();
    let second;
    if (change === 'new-request') second = vm.runInContext("runAssist(req, 'second')", c.ctx);
    if (change === 'closed') vm.runInContext('closeAssist()', c.ctx);
    if (change === 'text') c.state.draft.content = 'changed during request';
    if (change === 'draft') c.state.draft = { id: 2, content: 'other draft' };
    c.finish(firstRequest, 'stale'); await first;
    assert.notEqual(c.state.assist?.text, 'stale', change);
    if (second) { c.finish(c.pending.shift(), 'current'); await second; assert.equal(c.state.assist.text, 'current'); }
    else if (change !== 'closed') {
      vm.runInContext("applyAssist('replace')", c.ctx);
      assert.equal(c.state.draft.content, change === 'text' ? 'changed during request' : 'other draft');
    }
  }
});
