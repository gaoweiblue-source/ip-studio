import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { DatabaseSync } from 'node:sqlite';
import JSZip from 'jszip';
import { assistSnapshotValid } from '../public/research.js';

mkdirSync(resolve('.local'), { recursive: true });
const dir = mkdtempSync(resolve('.local/research-test-'));
process.env.DB_PATH = resolve(dir, 'unit.db');
const { parseResearch, LIMITS, DEFAULT_SKILL } = await import('../server/research.js');
const b64 = text => Buffer.from(text).toString('base64');
const project = resolve('.');

test('Markdown preserves every character and rejects invalid encoding, empty, oversized or unsupported files', async () => {
  const text = '# 研究\n\n证据：样本 23，结论仅限本样本。\n';
  assert.equal((await parseResearch('研究.md', b64(text))).text, text);
  for (const [filename, encoded] of [['x.doc', b64(text)], ['x.md', '/w=='], ['x.md', b64(' ')], ['x.md', b64('a'.repeat(60001))], ['x.md', 'a===']]) {
    await assert.rejects(parseResearch(filename, encoded));
  }
  await assert.rejects(parseResearch('large.md', Buffer.alloc(LIMITS.fileBytes, 65).toString('base64')), /研究正文超出/);
  await assert.rejects(parseResearch('large.md', Buffer.alloc(LIMITS.fileBytes + 1, 65).toString('base64')), /超过 5 MB/);
});

async function docx(text) {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
test('DOCX extracts text with explicit lossy-format warning and rejects corrupt / expanded files', async () => {
  const parsed = await parseResearch('research.docx', (await docx('研究结论与证据')).toString('base64'));
  assert.match(parsed.text, /研究结论与证据/);
  assert.match(parsed.warnings[0], /复杂表格/);
  await assert.rejects(parseResearch('bad.docx', b64('not zip')), /损坏/);
  const zip = new JSZip(); zip.file('bomb', Buffer.alloc(21 * 1024 * 1024));
  await assert.rejects(parseResearch('big.docx', (await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })).toString('base64')), /解压后超过/);
});

test('assist snapshots reject changed text, switched drafts and changed selected substring', () => {
  const a = { draftId: 1, snapshot: 'abc abc', target: { start: 4, end: 7, text: 'abc' } };
  assert.equal(assistSnapshotValid(a, { id: 1, content: 'abc abc' }), true);
  assert.equal(assistSnapshotValid(a, { id: 2, content: 'abc abc' }), false);
  assert.equal(assistSnapshotValid(a, { id: 1, content: 'abc xyz' }), false);
  assert.equal(assistSnapshotValid({ ...a, target: { start: 0, end: 2, text: 'abc' } }, { id: 1, content: a.snapshot }), false);
  const versioned = { ...a, version: 'zhihu', snapshot: 'xxxxabc abc' };
  const draft = { id: 1, content: '原平台正文', variants: { zhihu: { content: 'xxxxabc abc' } } };
  assert.equal(assistSnapshotValid(versioned, draft), true);
  assert.equal(assistSnapshotValid(versioned, { ...draft, variants: { zhihu: { content: 'xxxxabc xyz' } } }), false);
});

const requests = [];
let failUpstream = false;
const fake = createServer(async (req, res) => {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); requests.push(body);
  if (failUpstream) { res.writeHead(503); res.end('fixture unavailable'); return; }
  if (body.stream) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.end(`data: ${JSON.stringify({ choices: [{ delta: { content: '根据原文改写的结果' } }] })}\n\ndata: ${JSON.stringify({ choices: [], usage: { prompt_tokens: 120, completion_tokens: 30 } })}\n\ndata: [DONE]\n\n`);
  } else {
    const content = { title: '研究给出的有限结论', titles: ['备选标题一', '备选标题二'], outline: ['证据', '边界'], content: '## 结论\n\n样本 23，仅限本样本。', warnings: ['需人工核对引用'] };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }], usage: { prompt_tokens: 100, completion_tokens: 50 } }));
  }
});
fake.listen(0, '127.0.0.1'); await once(fake, 'listening');
const children = [];
after(async () => { for (const child of children) { child.kill(); await once(child, 'exit').catch(() => {}); } await new Promise(r => fake.close(r)); });
async function start(provider = 'openai') {
  const reservation = createServer(); reservation.listen(0, '127.0.0.1'); await once(reservation, 'listening');
  const port = reservation.address().port; await new Promise(r => reservation.close(r));
  const database = resolve(dir, `${provider}.db`);
  const child = spawn(process.execPath, ['server/index.js'], { cwd: project, env: { ...process.env, DB_PATH: database, PORT: String(port), LLM_PROVIDER: provider, OPENAI_API_KEY: provider === 'openai' ? 'fake-local-test-only' : '', ANTHROPIC_API_KEY: '', ANTHROPIC_AUTH_TOKEN: '', OPENAI_MODEL: 'local-fixture-model', OPENAI_BASE_URL: `http://127.0.0.1:${fake.address().port}/v1` }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  children.push(child);
  let output = ''; child.stdout.on('data', d => output += d); child.stderr.on('data', d => output += d);
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(output);
    try { const response = await fetch(`${base}/api/meta`); if (response.ok) break; } catch {}
    await new Promise(r => setTimeout(r, 30));
    if (i === 99) throw new Error(`Server not ready: ${output}`);
  }
  async function request(path, { method = 'GET', body, cookie } = {}) {
    const res = await fetch(`${base}/api${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const text = await res.text(); let data; try { data = JSON.parse(text); } catch { data = text; }
    return { status: res.status, data, cookie: res.headers.get('set-cookie')?.split(';')[0], text };
  }
  return { request, database, base };
}

test('HTTP research workflow isolates users and accounts, keeps original, uses latest Skill, and never charges native points', async () => {
  const { request, database } = await start();
  const a = await request('/auth/register', { method: 'POST', body: { username: 'writer1', password: 'pass1234' } });
  const b = await request('/auth/register', { method: 'POST', body: { username: 'writer2', password: 'pass1234' } });
  const call = (path, method = 'GET', body) => request(path, { method, body, cookie: a.cookie });
  const p = (await call('/personas', 'POST', { name: '研究账号', platform: 'gongzhonghao', tone: 'professional', audience: '产品经理读者', notes: '固定设定' })).data.persona;
  const other = (await call('/personas', 'POST', { name: '另一账号' })).data.persona;
  const skillPath = `/personas/${p.id}/writing-skill`;
  assert.equal((await request(skillPath)).status, 401);
  assert.equal((await request(skillPath, { cookie: b.cookie })).status, 404);
  assert.equal((await call(skillPath)).data.skill.markdown, DEFAULT_SKILL);
  let skill = (await call(skillPath, 'PUT', { version: 0, markdown: '# 自定义规则\n保留边界 UNIQUE_RULE' })).data.skill;
  assert.equal(skill.version, 1);
  assert.equal((await call(skillPath, 'PUT', { version: 0, markdown: 'conflict' })).status, 409);
  assert.equal((await call(`/personas/${other.id}/writing-skill`)).data.skill.version, 0);
  skill = (await call(skillPath, 'PUT', { version: 1, restore: 'previous' })).data.skill;
  assert.equal(skill.markdown, DEFAULT_SKILL);
  skill = (await call(skillPath, 'PUT', { version: 2, restore: 'previous' })).data.skill;
  assert.match(skill.markdown, /UNIQUE_RULE/);
  const original = '# 研究原文\n样本 23，仅限本样本。UNIQUE_SOURCE';
  const source = (await call(`/personas/${p.id}/research-import`, 'POST', { filename: 'study.md', base64: b64(original) })).data.source;
  assert.equal(source.text, original);
  assert.equal((await request(`/research-sources/${source.id}`, { cookie: b.cookie })).status, 404);
  assert.equal((await call(`/personas/${other.id}/research-generate`, 'POST', { source_id: source.id })).status, 400);
  const before = (await call('/plan')).data.quota.used;
  const generated = await call(`/personas/${p.id}/research-generate`, 'POST', { source_id: source.id, skipQuota: true });
  assert.equal(generated.status, 200, generated.text);
  const d = generated.data.draft;
  assert.equal(d.research.skillVersion, 3);
  assert.equal(d.audience, '产品经理读者');
  assert.equal(d.platform, 'gongzhonghao');
  assert.ok(d.title && d.content);
  assert.match(requests.at(-1).messages[0].content, /UNIQUE_RULE/);
  assert.match(requests.at(-1).messages[1].content, /UNIQUE_SOURCE/);
  assert.equal((await call(`/research-sources/${source.id}/original`)).text, original);
  const assistPath = `/drafts/${d.id}/research-assist`;
  const assistBody = { kind: 'rewrite', selection: '样本 23', instruction: '更简洁 TEMP_ONLY', before: '', after: '' };
  assert.equal((await request(assistPath, { method: 'POST', cookie: b.cookie, body: assistBody })).status, 404);
  skill = (await call(skillPath, 'PUT', { version: 3, markdown: '# 新规则\nLATEST_RULE' })).data.skill;
  const assist = await call(assistPath, 'POST', assistBody);
  assert.match(assist.text, /event: done/);
  assert.match(requests.at(-1).messages[0].content, /LATEST_RULE/);
  assert.match(requests.at(-1).messages[1].content, /UNIQUE_SOURCE/);
  assert.doesNotMatch((await call(skillPath)).data.skill.markdown, /TEMP_ONLY/);
  assert.equal((await call(`/drafts/${d.id}`)).data.draft.content, d.content);
  assert.match((await call(assistPath, 'POST', { kind: 'rewrite', action: 'shorten', selection: '样本 23' })).text, /event: done/);
  const afterPlan = (await call('/plan')).data;
  assert.equal(afterPlan.quota.used, before);
  assert.equal(afterPlan.breakdown.some(r => r.feature.includes('自有API')), false);
  const databaseView = new DatabaseSync(database);
  const events = databaseView.prepare('SELECT * FROM usage_events').all();
  assert.equal(events.length, 3);
  assert.ok(events.every(e => e.user_id === a.data.user.id && e.billing_policy === 'research-api' && e.units === 150));
  assert.equal((await call(`/drafts/${d.id}/content`, 'PUT', { content: '手动修改后的正文' })).status, 200);
  assert.equal((await call(`/research-sources/${source.id}`)).data.source.text, original);
  failUpstream = true;
  const failed = await call(`/personas/${p.id}/research-generate`, 'POST', { source_id: source.id });
  assert.equal(failed.status, 500);
  assert.equal((await call('/drafts')).data.drafts.length, 1);
  assert.match((await call(assistPath, 'POST', assistBody)).text, /event: error/);
  failUpstream = false;
  assert.equal((await call('/plan')).data.quota.used, before);
  // Native assist still charges normally, and browser skipQuota cannot change it.
  const native = await call(`/drafts/${d.id}/assist`, 'POST', { kind: 'rewrite', action: 'shorten', selection: '正文', skipQuota: true });
  assert.match(native.text, /event: done/);
  assert.equal((await call('/plan')).data.quota.used, before + 1);
  databaseView.prepare('UPDATE users SET used = 150 WHERE id = ?').run(a.data.user.id);
  assert.equal((await call(`/drafts/${d.id}/assist`, 'POST', { kind: 'rewrite', action: 'shorten', selection: '正文', skipQuota: true })).text.includes('额度不够'), true);
  assert.match((await call(assistPath, 'POST', assistBody)).text, /event: done/);
  assert.equal((await call('/plan')).data.quota.used, 150);
  await call(`/personas/${p.id}`, 'DELETE');
  assert.equal((await call(`/research-sources/${source.id}`)).data.source.text, original);
  assert.equal((await call(`/research-sources/${source.id}/original`)).text, original);
  assert.match((await call(assistPath, 'POST', assistBody)).text, /event: done/);
  assert.match(requests.at(-1).messages[0].content, /UNIQUE_RULE/);
  assert.equal((await call(`/drafts/${d.id}`)).data.draft.content, '手动修改后的正文');
  assert.doesNotMatch(JSON.stringify(generated.data), /fake-local-test-only/);
  databaseView.close();
});

test('missing API refuses generation and rewrite while import and Skill save remain usable', async () => {
  const { request, database } = await start('mock');
  const login = await request('/auth/register', { method: 'POST', body: { username: 'writer3', password: 'pass1234' } });
  const call = (path, method = 'GET', body) => request(path, { method, body, cookie: login.cookie });
  const p = (await call('/personas', 'POST', { name: '没有API' })).data.persona;
  const source = (await call(`/personas/${p.id}/research-import`, 'POST', { filename: 'x.md', base64: b64('原研究') })).data.source;
  const result = await call(`/personas/${p.id}/research-generate`, 'POST', { source_id: source.id });
  assert.equal(result.status, 503);
  assert.match(result.data.error, /\.env/);
  assert.equal((await call('/drafts')).data.drafts.length, 0);
  const seed = (await call('/drafts/topics', 'POST', { subject: 'mock seed', persona_id: p.id })).data.draft;
  const databaseView = new DatabaseSync(database);
  databaseView.prepare('UPDATE drafts SET research_json = ? WHERE id = ?').run(JSON.stringify({ sourceId: source.id, skillVersion: 0, skillMarkdown: DEFAULT_SKILL }), seed.id);
  databaseView.close();
  const noAssist = await call(`/drafts/${seed.id}/research-assist`, 'POST', { kind: 'rewrite', selection: '原文', instruction: '缩写' });
  assert.equal(noAssist.status, 503);
  assert.match(noAssist.data.error, /\.env/);
  assert.equal((await call(`/personas/${p.id}/writing-skill`, 'PUT', { version: 0, restore: 'default' })).status, 200);
  const large = await call(`/personas/${p.id}/research-import`, 'POST', { filename: 'x.md', base64: b64('x'.repeat(300000)) });
  assert.equal(large.status, 413);
  const generic = await call('/drafts/topics', 'POST', { subject: 'x'.repeat(300000) });
  assert.equal(generic.status, 413);
});

test('saving a platform rewrite updates only that version and rejects stale edits', async () => {
  const { request, database } = await start();
  const owner = await request('/auth/register', { method: 'POST', body: { username: 'variant-owner', password: 'pass1234' } });
  const other = await request('/auth/register', { method: 'POST', body: { username: 'variant-other', password: 'pass1234' } });
  const call = (path, method = 'GET', body, cookie = owner.cookie) => request(path, { method, body, cookie });
  const persona = (await call('/personas', 'POST', { name: '版本账号' })).data.persona;

  const db = new DatabaseSync(database);
  const now = new Date().toISOString();
  const inserted = db.prepare(`INSERT INTO drafts
    (user_id, subject, platform, tone, title, content, status, persona_id, persona_json,
     variants_json, illus_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'done', ?, ?, ?, ?, ?, ?)`).run(
    owner.data.user.id, '版本测试', 'gongzhonghao', 'professional', '标题',
    '公众号原文', persona.id, JSON.stringify(persona),
    JSON.stringify({ zhihu: { content: '知乎版本正文', chars: 6, fromChars: 5, from: 'gongzhonghao' } }),
    JSON.stringify({ zhihu: { look: 'old', items: [] } }), now, now,
  );
  const draftId = Number(inserted.lastInsertRowid);
  db.close();

  assert.equal((await call(`/drafts/${draftId}/variants/zhihu`, 'PUT',
    { content: '越权修改', previous: '知乎版本正文' }, other.cookie)).status, 404);
  const stale = await call(`/drafts/${draftId}/variants/zhihu`, 'PUT',
    { content: '旧结果', previous: '已经被别处修改' });
  assert.equal(stale.status, 409);

  const saved = await call(`/drafts/${draftId}/variants/zhihu`, 'PUT',
    { content: '知乎版本修改后', previous: '知乎版本正文' });
  assert.equal(saved.status, 200, saved.text);
  assert.equal(saved.data.draft.content, '公众号原文');
  assert.equal(saved.data.draft.variants.zhihu.content, '知乎版本修改后');
  assert.equal(saved.data.draft.variants.zhihu.chars, 7);
  assert.equal(saved.data.draft.illus?.zhihu, undefined);
});
