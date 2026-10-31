/* API 处理函数 */
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import {
  Admins, DATA_DIR, Drafts, MATERIAL_KINDS, Materials, Personas, Pool,
  Evals, Orders, Quota, Samples, Sections, Usage, Users, Variants,
} from './db.js';
import {
  HttpError, adminCookie, adminLogin, adminSetupNeeded, clearAdminCookie, clearCookie,
  createAdmin, currentAdmin, currentUser, login, publicAdmin, publicUser,
  register, sessionCookie, startAdminSession, startSession, validateCredentials,
} from './auth.js';
import { PROVIDER, generateJSON, generateText, providerInfo, streamText } from './llm.js';
import { withHeadingReview } from './heading-review.js';
import { ASSEMBLY, PRINCIPLE, PROMPT_DOCS, STAGES } from './promptdocs.js';
import { costOf, loadPricing, priceOf } from './pricing.js';
import { pickVariant, scoreText, scoreTopics, summarize } from './abtest.js';
import { QuotaError, assertQuota, consume, snapshot } from './quota.js';
import { PACKS, PLANS, creditsFor, explain, planOf } from './plans.js';
import { createPayment, newTradeNo, payInfo, queryOrder, verifyNotify } from './pay.js';
import { conf, save as saveSetting, status as settingsStatus } from './settings.js';
import { hasKey } from './secrets.js';

loadPricing();
import { mockContent, mockTopics } from './mock.js';
import { enrichSummaries, fetchBoards, parseManual, riskOf, screenItems } from './hotspots.js';
import { generate, imageInfo } from './images.js';
import { contentFingerprint } from '../public/content-fingerprint.js';
import {
  CONTENT_SYSTEM, DEFAULT_PLATFORM, DEFAULT_TONE, PLATFORMS, TONES,
  ASSIST_ACTIONS, ASSIST_SYSTEM, COMPOSE_ACTIONS, DIGEST_SYSTEM, GENDERS,
  ARTICLE_SUMMARY_SYSTEM, HOTSPOT_SCHEMA, HOTSPOT_SYSTEM,
  CUES_SCHEMA, CUES_SYSTEM, REVIEW_DIMENSIONS, TONE_TAGS, REVIEW_SCHEMA, REVIEW_SYSTEM, SECTION_PRESETS,
  ADAPT_SYSTEM, adaptUser,
  ILLUS_SCHEMA, ILLUS_SYSTEM, illusUser,
  SUBJECTS_SCHEMA, SUBJECTS_SYSTEM, TOPICS_SCHEMA, TOPICS_SYSTEM,
  articleSummaryUser, assistUser, composeUser, contentUser, cuesUser, digestUser,
  hotspotUser, platformSpec, reviewUser, subjectsUser, topicsUser,
} from './prompts.js';

const json = (res, status, body, headers = {}) => {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(payload);
};

const requireUser = (req) => {
  const user = currentUser(req);
  if (!user) throw new HttpError(401, '请先登录');
  return user;
};

/* 本篇未填的字段，继承所选账号设定 */
function normalizeForm(body = {}, persona = null) {
  const subject = String(body.subject ?? '').trim();
  if (!subject) throw new HttpError(400, '请填写题材');
  if (subject.length > 200) throw new HttpError(400, '题材请控制在 200 字以内');

  const fallbackPlatform = PLATFORMS[persona?.platform] ? persona.platform : DEFAULT_PLATFORM;
  const fallbackTone = TONES[persona?.tone] ? persona.tone : DEFAULT_TONE;
  const platform = PLATFORMS[body.platform] ? body.platform : fallbackPlatform;
  const tone = TONES[body.tone] ? body.tone : fallbackTone;
  const length = Math.min(4000, Math.max(150, Number(body.length) || platformSpec(platform).length));

  return {
    subject,
    platform,
    tone,
    audience: String(body.audience ?? '').trim().slice(0, 120),
    keywords: String(body.keywords ?? '').trim().slice(0, 300),
    length,
  };
}

/* ---------------- 账号设定 ---------------- */

function normalizePersona(body = {}) {
  const name = String(body.name ?? '').trim();
  if (!name) throw new HttpError(400, '请填写账号名称');
  if (name.length > 40) throw new HttpError(400, '账号名称请控制在 40 字以内');

  const text = (v, max) => String(v ?? '').trim().slice(0, max);
  return {
    name,
    platform: PLATFORMS[body.platform] ? body.platform : DEFAULT_PLATFORM,
    tone: TONES[body.tone] ? body.tone : DEFAULT_TONE,
    content_focus: text(body.content_focus, 500),
    audience: text(body.audience, 500),
    problem: text(body.problem, 500),
    notes: text(body.notes, 800),
    // 个人人设：全部选填，留空即不写进提示词
    creator_age: text(body.creator_age, 20),
    creator_gender: GENDERS.includes(body.creator_gender) ? body.creator_gender : '',
    creator_industry: text(body.creator_industry, 60),
    creator_role: text(body.creator_role, 60),
    creator_traits: text(body.creator_traits, 300),
  };
}

export async function handlePersonaList(req, res) {
  const user = requireUser(req);
  json(res, 200, { personas: Personas.list(user.id) });
}

export async function handlePersonaCreate(req, res, body) {
  const user = requireUser(req);
  if (Personas.list(user.id).length >= 20) throw new HttpError(400, '账号数量已达上限（20 个）');
  json(res, 200, { persona: Personas.create(user.id, normalizePersona(body)) });
}

export async function handlePersonaUpdate(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.update(Number(params.id), user.id, normalizePersona(body));
  if (!persona) throw new HttpError(404, '账号不存在');
  json(res, 200, { persona });
}

export async function handlePersonaDelete(req, res, body, params) {
  const user = requireUser(req);
  if (!Personas.remove(Number(params.id), user.id)) throw new HttpError(404, '账号不存在');
  json(res, 200, { ok: true });
}

/* 语气锚点：档案已经蒸馏过，这里只取最近两篇原文做语感参考 */
const styleSamples = (persona, userId) =>
  (persona?.id && persona.style_digest)
    ? Samples.list(persona.id, userId, { withContent: true, limit: 2 })
    : [];

/* 取出当前用户的账号；personaId 为空表示不绑定账号 */
function resolvePersona(userId, personaId) {
  if (personaId === undefined || personaId === null || personaId === '') return null;
  const persona = Personas.byId(Number(personaId), userId);
  if (!persona) throw new HttpError(404, '账号不存在');
  return persona;
}

/* ---------------- 账号 ---------------- */

export async function handleRegister(req, res, body) {
  const { username, password } = body || {};
  const bad = validateCredentials(username, password);
  if (bad) throw new HttpError(400, bad);
  const user = register(username.trim(), password);
  json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(startSession(user)) });
}

export async function handleLogin(req, res, body) {
  const { username, password } = body || {};
  if (!username || !password) throw new HttpError(400, '请输入用户名和密码');
  const user = login(String(username).trim(), String(password));
  json(res, 200, { user: publicUser(user) }, { 'Set-Cookie': sessionCookie(startSession(user)) });
}

export async function handleLogout(req, res) {
  json(res, 200, { ok: true }, { 'Set-Cookie': clearCookie() });
}

export async function handleMe(req, res) {
  const user = currentUser(req);
  json(res, 200, { user: user ? publicUser(user) : null });
}

export async function handleMeta(req, res) {
  json(res, 200, {
    platforms: Object.entries(PLATFORMS).map(([key, v]) => ({ key, label: v.label, length: v.length })),
    tones: Object.entries(TONES).map(([key, hint]) => ({ key, hint })),
    llm: providerInfo(),
  });
}

/* ---------------- 管理后台 ---------------- */

function requireAdmin(req) {
  const admin = currentAdmin(req);
  if (!admin) throw new HttpError(401, '请先用管理员账号登录');
  return admin;
}

/* ---- 管理员登录 ---- */

export async function handleAdminSession(req, res) {
  const admin = currentAdmin(req);
  json(res, 200, {
    admin: admin ? publicAdmin(admin) : null,
    needsSetup: adminSetupNeeded(),
  });
}

/* 首次设置：只在一个管理员都没有的时候开放 */
export async function handleAdminSetup(req, res, body) {
  if (!adminSetupNeeded()) throw new HttpError(403, '管理员已存在，无法再次初始化');
  const { username, password } = body || {};
  // 先查长度，免得报出前台那套「至少 6 位」和后台表单写的 8 位对不上
  if (String(password || '').length < 8) throw new HttpError(400, '管理员密码至少 8 位');
  const bad = validateCredentials(username, password);
  if (bad) throw new HttpError(400, bad);

  const admin = createAdmin(String(username).trim(), String(password));
  json(res, 200, { admin: publicAdmin(admin) },
    { 'Set-Cookie': adminCookie(startAdminSession(admin)) });
}

export async function handleAdminLogin(req, res, body) {
  const { username, password } = body || {};
  if (!username || !password) throw new HttpError(400, '请输入用户名和密码');
  const admin = adminLogin(String(username).trim(), String(password));
  json(res, 200, { admin: publicAdmin(admin) },
    { 'Set-Cookie': adminCookie(startAdminSession(admin)) });
}

export async function handleAdminLogout(req, res) {
  json(res, 200, { ok: true }, { 'Set-Cookie': clearAdminCookie() });
}

export async function handleAdminOverview(req, res, body, params, url) {
  requireAdmin(req);
  const days = Math.min(90, Math.max(1, Number(url?.searchParams.get('days')) || 7));
  const since = new Date(Date.now() - days * 86400000).toISOString();

  const usageByUser = new Map(Usage.byUser(since).map((u) => [u.user_id, u]));
  const users = Users.overview().map((u) => ({
    ...u,
    calls: usageByUser.get(u.id)?.calls || 0,
    tokens: usageByUser.get(u.id)?.tokens || 0,
    last_call_at: usageByUser.get(u.id)?.last_at || null,
  }));

  const totals = Usage.totals(since);
  json(res, 200, {
    days,
    llm: providerInfo(),
    admins: Admins.list(),
    users,
    totals: {
      calls: totals.calls || 0,
      okCalls: totals.ok_calls || 0,
      inputTokens: totals.input_tokens || 0,
      outputTokens: totals.output_tokens || 0,
      avgMs: Math.round(totals.avg_ms || 0),
    },
    byFeature: Usage.byFeature(since),
    byDay: Usage.byDay(since),
    errors: Usage.recentErrors(15),
    cost: costReport(since),
  });
}

/* 成本估算。**只是估算**——单价会调、有阶梯、有免费额度，
   所以每一行都标出用了哪个单价、是不是精确匹配到型号，算不出来的如实写"未计价"。 */
function costReport(since) {
  const rows = Usage.byModel(since).map((r) => {
    const c = costOf(r);
    const p = priceOf(r.model);
    return {
      ...r,
      yuan: c ? +c.yuan.toFixed(2) : null,
      demo: String(r.provider || '').toLowerCase() === 'mock',
      price: p ? `${p.price} 元 / ${p.per === 1 ? '' : p.per}${p.unit}` : '',
      free: p?.free || '',
      exact: p?.exact ?? false,
      note: p?.note || '',
    };
  });
  const total = rows.reduce((n, r) => n + (r.yuan || 0), 0);
  return {
    rows,
    total: +total.toFixed(2),
    unpriced: rows.filter((r) => r.yuan === null).length,
    note: '按各家官网公示单价估算，未扣免费额度；真实账单以服务商控制台为准。',
  };
}

/* 每个功能实际发给模型的 system 提示词，只读展示 */
const PROMPT_CATALOG = () => [
  { key: 'topics', label: '选题方向', where: '创作第一步：题材 → 三个方向',
    system: TOPICS_SYSTEM, schema: TOPICS_SCHEMA },
  { key: 'content', label: '成稿', where: '创作第二步：选定方向 → 完整文案（流式）',
    system: CONTENT_SYSTEM },
  { key: 'assist', label: '划词改写 / 续写', where: '编辑器里选中文字或按 /',
    system: ASSIST_SYSTEM,
    extra: {
      改写动作: Object.fromEntries(Object.entries(ASSIST_ACTIONS).map(([k, v]) => [v.label, v.instruction])),
      续写动作: Object.fromEntries(Object.entries(COMPOSE_ACTIONS).map(([k, v]) => [v.label, v.instruction])),
    } },
  { key: 'review', label: '成稿检查', where: '出稿后自动跑 + 工具栏「检查」',
    system: REVIEW_SYSTEM, schema: REVIEW_SCHEMA },
  { key: 'subjects', label: '题材推荐', where: '创作简报里的三条推荐题材',
    system: SUBJECTS_SYSTEM, schema: SUBJECTS_SCHEMA },
  { key: 'hotspot', label: '热点比对', where: '热点板块：榜单 × 账号定位',
    system: HOTSPOT_SYSTEM, schema: HOTSPOT_SCHEMA },
  { key: 'summary', label: '原文概要', where: '热点命中后压缩抓到的原文',
    system: ARTICLE_SUMMARY_SYSTEM },
  { key: 'digest', label: '语气档案', where: '「喂给账号学习」后蒸馏写作习惯',
    system: DIGEST_SYSTEM },
  { key: 'cues', label: '口播提示', where: '成稿后切段并标语气/重读/停顿/表情/动作',
    system: CUES_SYSTEM, schema: CUES_SCHEMA },
];

export async function handleAdminPrompts(req, res) {
  requireAdmin(req);
  json(res, 200, {
    prompts: PROMPT_CATALOG(),
    note: '这些是各功能发给模型的 system 提示词。账号设定、个人人设、语气档案、栏目、平台规范等是逐次拼进 user 消息的，不在这里。',
  });
}

/* ---------------- 内容栏目 ---------------- */

const SECTION_MAX = 12;

const SECTION_FIELD_MAX = 8;

function normalizeSection(body = {}) {
  const name = String(body.name ?? '').trim();
  if (!name) throw new HttpError(400, '请填写栏目名');
  if (name.length > 20) throw new HttpError(400, '栏目名请控制在 20 字以内');
  const text = (v, n) => String(v ?? '').trim().slice(0, n);

  // 每个栏目自己声明要作者提供哪些素材
  const seen = new Set();
  const fields = (Array.isArray(body.fields) ? body.fields : [])
    .map((f) => ({
      label: text(f?.label, 30),
      hint: text(f?.hint, 80),
      required: Boolean(f?.required),
    }))
    .filter((f) => {
      if (!f.label || seen.has(f.label)) return false;
      seen.add(f.label);
      return true;
    })
    .slice(0, SECTION_FIELD_MAX);

  return { name, purpose: text(body.purpose, 300), guide: text(body.guide, 600), fields };
}

/* 只收这个栏目声明过的字段，必填的不能空 */
function normalizeInputs(section, raw) {
  const fields = Array.isArray(section?.fields) ? section.fields : [];
  if (!fields.length) return null;
  const src = raw && typeof raw === 'object' ? raw : {};
  const out = {};
  for (const f of fields) {
    const value = String(src[f.label] ?? '').trim().slice(0, 1500);
    if (f.required && !value) throw new HttpError(400, `「${section.name}」需要先填写：${f.label}`);
    if (value) out[f.label] = value;
  }
  return Object.keys(out).length ? out : null;
}

export async function handleSectionList(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');
  json(res, 200, { sections: Sections.list(persona.id, user.id), presets: SECTION_PRESETS });
}

export async function handleSectionCreate(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');
  if (Sections.list(persona.id, user.id).length >= SECTION_MAX) {
    throw new HttpError(400, `栏目数量已达上限（${SECTION_MAX} 个）`);
  }
  Sections.create(user.id, persona.id, normalizeSection(body));
  json(res, 200, { sections: Sections.list(persona.id, user.id) });
}

export async function handleSectionUpdate(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');
  if (!Sections.update(Number(params.sectionId), user.id, normalizeSection(body))) {
    throw new HttpError(404, '栏目不存在');
  }
  json(res, 200, { sections: Sections.list(persona.id, user.id) });
}

export async function handleSectionDelete(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');
  if (!Sections.remove(Number(params.sectionId), user.id)) throw new HttpError(404, '栏目不存在');
  json(res, 200, { sections: Sections.list(persona.id, user.id) });
}

/* 栏目必须属于这个账号，否则不认 */
function resolveSection(userId, personaId, sectionId) {
  if (!sectionId) return null;
  const section = Sections.byId(Number(sectionId), userId);
  if (!section || section.persona_id !== personaId) throw new HttpError(404, '栏目不存在');
  return {
    id: section.id, name: section.name, purpose: section.purpose,
    guide: section.guide, fields: section.fields,
  };
}

/* ---------------- 热点板块 ---------------- */

/* 只拿榜单，不做分析——用于展示原始榜单和源状态 */
export async function handleBoards(req, res, body, params, url) {
  requireUser(req);
  const boards = await fetchBoards({ force: url?.searchParams.get('force') === '1' });
  json(res, 200, boards);
}

export async function handleHotspotRead(req, res, body, params) {
  const user = requireUser(req);
  const saved = Personas.hotspots(Number(params.id), user.id);
  if (saved === undefined) throw new HttpError(404, '账号不存在');
  json(res, 200, { hotspots: saved });
}

export async function handleHotspotAnalyze(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');

  // 手动粘贴的榜单优先，其次抓全网
  const manual = String(body?.manual || '').trim();
  let items;
  let sources;
  if (manual) {
    items = parseManual(manual);
    if (items.length < 3) throw new HttpError(400, '至少粘 3 条热点，一行一条');
    sources = [{ key: 'manual', label: '手动粘贴', ok: true, count: items.length }];
  } else {
    const boards = await fetchBoards({ force: body?.force === true });
    items = boards.items;
    sources = boards.sources;
  }

  // 不适合蹭的先在代码层挡掉，模型根本看不到，不指望它自觉
  const { kept, blocked } = screenItems(items);
  if (kept.length < 3) throw new HttpError(502, '过滤完剩下的热点太少了，换个时间再试');

  const matches = await analyzeHotspots(persona, kept, { feature: '热点比对', userId: user.id });
  matches.matches = await attachSummaries(matches.matches, user.id);
  const payload = {
    at: new Date().toISOString(),
    sources,
    total: items.length,
    screened: blocked.length,
    screenedSample: blocked.slice(0, 6).map((b) => ({ title: b.title, risk: b.risk })),
    ...matches,
  };
  Personas.setHotspots(persona.id, user.id, payload);
  json(res, 200, { hotspots: payload });
}

async function analyzeHotspots(persona, items, meta = {}) {
  const result = await withRetry(async () => {
    const data = await generateJSON({
      meta,
      system: HOTSPOT_SYSTEM,
      user: hotspotUser(persona, items),
      schema: HOTSPOT_SCHEMA,
      mock: () => mockHotspots(persona, items),
    });
    if (!data || !Array.isArray(data.matches)) throw new HttpError(502, '返回结构不对');
    return data;
  }, '热点比对失败，请再试一次');

  const matches = result.matches.slice(0, 5).map((m) => {
    const origin = resolveItem(items, m);
    return {
      angle: String(m.angle || '').trim(),
      subject: String(m.subject || '').trim(),
      strength: ['强', '中', '弱'].includes(m.strength) ? m.strength : '中',
      caution: String(m.caution || '').trim(),
      origin,
    };
  }).filter((m) => (
    m.origin && m.angle && m.subject
    && m.strength !== '弱'            // 模型自己都说弱的，多半是凑数
    && !riskOf(m.origin.title)        // 漏网的再挡一次
  ));

  return { matches, note: String(result.note || '').trim() };
}

/* 给命中的几条补原文概要：榜单自带的直接用，否则best-effort 抓原文，抓不到就如实说没有 */
async function attachSummaries(matches, userId) {
  const enriched = await enrichSummaries(
    matches.map((m) => m.origin),
    async (title, body) => {
      const out = await generateText({
        meta: { feature: '原文概要', userId },
        system: ARTICLE_SUMMARY_SYSTEM,
        user: articleSummaryUser(title, body),
        mock: () => `演示模式：这里会是《${title.slice(0, 14)}》的原文概要`,
      });
      const text = String(out || '').trim();
      return text === '无' || text.length < 12 ? '' : text;
    },
  );
  return matches.map((m, i) => ({ ...m, origin: enriched[i] || m.origin }));
}

/* 模型给的编号可能偏一位，标题是逐字抄的更可靠——两者互相校验 */
function resolveItem(items, m) {
  const byIndex = items[Number(m.index) - 1];
  const title = String(m.source_title || '').trim();
  if (byIndex && (!title || byIndex.title === title)) return byIndex;
  const exact = items.find((it) => it.title === title);
  if (exact) return exact;
  const loose = title && items.find((it) => it.title.includes(title) || title.includes(it.title));
  return loose || byIndex || null;
}

const mockHotspots = (persona, items) => ({
  matches: items.slice(0, 2).map((it, i) => ({
    index: i + 1,
    source_title: it.title,
    angle: `演示模式：这里会说清「${it.title.slice(0, 12)}…」和「${persona.name}」之间的那座桥`,
    subject: `从${it.title.slice(0, 10)}说起，聊聊${persona.content_focus || persona.name}`,
    strength: i === 0 ? '强' : '中',
    caution: i === 0 ? '' : '演示模式：这里会提示需要注意的分寸',
  })),
  note: '演示模式：配置模型密钥后，这里是对今天榜单的真实判断',
});

/* ---------------- 题材推荐 ---------------- */

/* 缓存里的先给出来，页面打开不必等模型 */
export async function handleSubjectList(req, res, body, params) {
  const user = requireUser(req);
  const id = Number(params.id);
  const ideas = Personas.ideas(id, user.id);
  if (ideas === null) throw new HttpError(404, '账号不存在');
  json(res, 200, { ideas: mergeHotIdeas(id, user.id, ideas) });
}

/* 匹配度高的热点直接顶进推荐题材前排——用户不必先去热点板块翻一遍 */
const HOT_IDEA_MAX = 2;

function mergeHotIdeas(personaId, userId, ideas) {
  const saved = Personas.hotspots(personaId, userId);
  const fresh = saved?.matches?.length
    && Date.now() - new Date(saved.at).getTime() < 24 * 3600 * 1000;
  if (!fresh) return ideas.map((i) => ({ ...i, kind: 'idea' }));

  const rank = { 强: 0, 中: 1 };
  const hot = [...saved.matches]
    .sort((a, b) => (rank[a.strength] ?? 9) - (rank[b.strength] ?? 9))
    .slice(0, HOT_IDEA_MAX)
    .map((m) => ({
      kind: 'hot',
      subject: m.subject,
      reason: m.angle,
      strength: m.strength,
      hotspot: {
        title: m.origin?.title || '',
        url: m.origin?.url || '',
        platform: m.origin?.platform || '',
        summary: m.origin?.summary || '',
        summarySource: m.origin?.summarySource || 'none',
        angle: m.angle,
      },
    }));

  const used = new Set(hot.map((h) => h.subject));
  const rest = ideas.filter((i) => !used.has(i.subject)).map((i) => ({ ...i, kind: 'idea' }));
  return [...hot, ...rest].slice(0, 3);
}

export async function handleSubjectGenerate(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');
  const ideas = await generateIdeas(persona, user.id);
  json(res, 200, { ideas: mergeHotIdeas(persona.id, user.id, ideas) });
}

async function generateIdeas(persona, userId) {
  const used = Drafts.usedSubjects(userId, persona.id);
  // 当前挂着的推荐也算"提过的"，换一批才不会换汤不换药
  const pending = (Personas.ideas(persona.id, userId) || []).map((i) => ({ subject: i.subject, title: '' }));

  const seen = new Set([...used, ...pending].map((u) => u.subject.trim()));

  const ideas = await withRetry(async () => {
    const data = await generateJSON({
      meta: { feature: '题材推荐', userId },
      system: SUBJECTS_SYSTEM,
      user: subjectsUser(persona, [...used, ...pending]),
      schema: SUBJECTS_SCHEMA,
      mock: () => mockIdeas(persona, used.length),
    });
    const list = (Array.isArray(data) ? data : data?.ideas || data?.题材 || [])
      .map((i) => ({
        subject: String(i?.subject || i?.题材 || '').trim(),
        reason: String(i?.reason || i?.理由 || '').trim(),
      }))
      .filter((i) => i.subject && !seen.has(i.subject))
      .slice(0, 3);
    if (!list.length) throw new HttpError(502, '没有拿到新题材');
    return list;
  }, '没能想出新题材，稍后再试试');

  Personas.setIdeas(persona.id, userId, ideas);
  return ideas;
}

/* 演示模式：按已写过的条数换一组措辞，保证「换一批」不会自己撞自己 */
const MOCK_IDEA_SHAPES = [
  ['里最容易被忽略的那一步', '新手最常卡在这里'],
  ['上我踩过的三个坑', '亲历型内容更可信'],
  ['被问得最多的一个问题', '直接回应读者疑问'],
  ['里那条被高估的建议', '反常识角度容易出彩'],
  ['第一个月最该做的事', '给刚入门的人一条路径'],
  ['里最省力的一套做法', '怕麻烦的人最需要'],
];

const mockIdeas = (persona, n) => {
  const topic = persona.content_focus || persona.name;
  return {
    ideas: [0, 1, 2].map((i) => {
      const [tail, why] = MOCK_IDEA_SHAPES[(n + i) % MOCK_IDEA_SHAPES.length];
      return { subject: `${topic}${tail}`, reason: `演示模式：${why}（已避开 ${n} 条写过的）` };
    }),
  };
};

/* 用掉的推荐从缓存里划掉，下次不会再出现 */
function consumeIdea(persona, userId, subject) {
  const ideas = Personas.ideas(persona.id, userId) || [];
  const left = ideas.filter((i) => i.subject.trim() !== subject.trim());
  if (left.length !== ideas.length) Personas.setIdeas(persona.id, userId, left);
}

/* 前端传回来的热点原样信任不得，逐字段收一遍 */
function normalizeHotspot(h) {
  if (!h || typeof h !== 'object') return null;
  const text = (v, n) => String(v ?? '').trim().slice(0, n);
  const title = text(h.title, 200);
  if (!title) return null;
  const url = text(h.url, 500);
  return {
    title,
    url: /^https?:\/\//.test(url) ? url : '',
    platform: text(h.platform, 40),
    summary: text(h.summary, 400),
    summarySource: ['board', 'article', 'none'].includes(h.summarySource) ? h.summarySource : 'none',
    angle: text(h.angle, 300),
  };
}

/* ---------------- 第一步：三个话题方向 ---------------- */

export async function handleTopics(req, res, body) {
  const user = requireUser(req);
  const persona = resolvePersona(user.id, body?.persona_id);
  const section = persona ? resolveSection(user.id, persona.id, body?.section_id) : null;
  const inputs = normalizeInputs(section, body?.inputs);
  const form = normalizeForm(body, persona);
  const draft = Drafts.create(user.id, form, persona, normalizeHotspot(body?.hotspot), section, inputs);

  let topics;
  try {
    const ctx = { ...form, hotspot: normalizeHotspot(body?.hotspot), section, inputs };
    topics = await generateTopics(ctx, persona, [], styleSamples(persona, user.id),
      { feature: '选题方向', userId: user.id });
  } catch (err) {
    Drafts.remove(draft.id, user.id);   // 失败就别在历史里留一条空记录
    throw err;
  }

  if (persona) consumeIdea(persona, user.id, form.subject);
  Drafts.setTopics(draft.id, user.id, topics, persona);
  json(res, 200, { draft: Drafts.byId(draft.id, user.id) });
}

export async function handleRetopics(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  // 换一批 = 重新开始：若账号还在，用它最新的设定；账号已删则沿用创作时的快照
  const persona = (draft.persona_id && Personas.byId(draft.persona_id, user.id)) || draft.persona;
  const topics = await generateTopics(draft, persona, draft.topics, styleSamples(persona, user.id),
    { feature: '选题方向·换一批', userId: user.id });
  Drafts.setTopics(draft.id, user.id, topics, persona);
  json(res, 200, { draft: Drafts.byId(draft.id, user.id) });
}

async function generateTopics(form, persona = null, avoid = [], samples = [], meta = {}) {
  const extra = avoid.length
    ? `\n\n以下方向已经出过，请给出与它们明显不同的新角度：\n${avoid.map((t) => `- ${t.title}（${t.angle}）`).join('\n')}`
    : '';

  // 偶发的格式跑偏重试一次就能好，不必让用户自己点重来
  const topics = await withRetry(async (attempt) => {
    const v = pickVariant('topics', TOPICS_SYSTEM);
    const data = await generateJSON({
      meta: { ...meta, variant: v.name },
      system: v.system,
      user: topicsUser(form, persona, samples) + extra
        + (attempt ? '\n\n上一次的返回不完整。请严格按 schema 输出恰好 3 个方向，每个方向的字段都要填满。' : ''),
      schema: TOPICS_SCHEMA,
      mock: () => mockTopics(form),
    });

    const list = (Array.isArray(data) ? data : data?.topics || data?.方向 || [])
      .slice(0, 3)
      .map((t) => ({
        label: String(t?.label || t?.标签 || '').trim().slice(0, 8),
        title: String(t?.title || t?.标题 || '').trim(),
        angle: String(t?.angle || t?.切入角度 || '').trim(),
        hook: String(t?.hook || t?.开篇钩子 || '').trim(),
        outline: (Array.isArray(t?.outline) ? t.outline : Array.isArray(t?.内容骨架) ? t.内容骨架 : [])
          .map((x) => String(x).trim()).filter(Boolean),
        audience_fit: String(t?.audience_fit || t?.适配读者 || '').trim(),
      }))
      .filter((t) => t.title && t.outline.length);

    if (list.length < 3) throw new HttpError(502, `模型只给出了 ${list.length} 个完整方向`);

    // 标签重了就等于没分类——这是读者一眼看差异的抓手，重复的宁可留空回落到「方向 N」
    const used = new Set();
    for (const t of list) {
      if (!t.label || used.has(t.label)) { t.label = ''; continue; }
      used.add(t.label);
    }
    return list;
  }, '生成话题方向失败，请再试一次');

  return topics;
}

/* 结构化生成偶发失败时重试一次；两次都不行才把错误抛给用户 */
/* 结构化生成偶发失败时重试一次；两次都不行才把错误抛给用户。
 *
 * 但**客户端错误不重试也不包装**：额度不够重试一百次也不会好，
 * 而包成 502「生成失败」会让人以为是服务出问题，跑去反复点重试——
 * 每点一次都是一次真实调用。这类错误要原样透出去。 */
const isClientError = (e) => {
  const s = e?.status ?? (e instanceof HttpError ? e.status : 0);
  return s >= 400 && s < 500;
};

async function withRetry(fn, message) {
  try {
    return await fn(0);
  } catch (first) {
    if (isClientError(first)) throw first;
    console.warn('[retry]', describe(first));
    try {
      return await fn(1);
    } catch (second) {
      if (isClientError(second)) throw second;
      throw new HttpError(502, `${message}（${describe(second)}）`);
    }
  }
}

/* ---------------- 第二步：流式生成完整文案 ---------------- */

export async function handleContent(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  const index = Number(body?.index);
  const topic = draft.topics[index];
  if (!topic) throw new HttpError(400, '请选择一个话题方向');

  // 按题材召回素材库里相关的几条——素材是"唯一可信的事实来源"那条规则的弹药
  const recalled = recallMaterials(user.id, draft.persona_id,
    `${draft.subject} ${topic.title} ${topic.angle} ${(topic.outline || []).join(' ')}`);
  if (recalled.length) Materials.markUsed(recalled.map((m) => m.id), user.id);
  const contentVariant = pickVariant('content', CONTENT_SYSTEM);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  send('start', { title: topic.title });
  Drafts.setContent(draft.id, user.id, {
    chosen: index, title: topic.title, content: '', status: 'writing',
  });

  try {
    const content = await streamText({
      meta: { feature: '成稿', userId: user.id, variant: contentVariant.name },
      system: contentVariant.system,
      user: contentUser(draft, topic, draft.persona, styleSamples(draft.persona, user.id), recalled),
      onDelta: (text) => send('delta', { text }),
      mock: () => mockContent(draft, topic),
      signal: controller.signal,
    });
    Drafts.setContent(draft.id, user.id, {
      chosen: index, title: topic.title, content, status: 'done',
    });
    send('done', { draft: Drafts.byId(draft.id, user.id) });
  } catch (err) {
    if (!controller.signal.aborted) send('error', { message: describe(err) });
  } finally {
    res.end();
  }
}

/* ---------------- 编辑器：手工保存 ---------------- */

export async function handleSaveContent(req, res, body, params) {
  const user = requireUser(req);
  const content = String(body?.content ?? '');
  if (content.length > 60000) throw new HttpError(400, '正文过长');
  if (!Drafts.saveContent(Number(params.id), user.id, content)) throw new HttpError(404, '记录不存在');
  json(res, 200, { draft: Drafts.byId(Number(params.id), user.id) });
}

/* ---------------- 成稿检查：错字与通顺性 ---------------- */

export async function handleReview(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  const text = String(body?.content ?? draft.content ?? '').trim();
  if (!text) throw new HttpError(400, '还没有正文可检查');
  if (text.length > 20000) throw new HttpError(400, '正文过长，请分段检查');

  // 检查要看到账号设定、平台规范、语气档案和借势的热点，才谈得上"符合度"
  const persona = (draft.persona_id && Personas.byId(draft.persona_id, user.id)) || draft.persona;
  json(res, 200, {
    review: await reviewText(draft, text, persona, styleSamples(persona, user.id),
      { feature: '成稿检查', userId: user.id }),
  });
}

async function reviewText(draft, text, persona, samples, meta = {}) {
  const data = await withRetry(async () => {
    const out = await generateJSON({
      meta,
      system: REVIEW_SYSTEM,
      user: reviewUser(draft, text, persona, samples),
      schema: REVIEW_SCHEMA,
      mock: () => mockReview(text, draft),
    });
    if (!out || !Array.isArray(out.issues)) throw new HttpError(502, '返回结构不对');
    return out;
  }, '检查失败，请再试一次');

  // quote 必须能在原文里一字不差地找到，否则没法安全替换——找不到的直接丢掉
  const seen = new Set();
  const issues = data.issues
    .map((it) => ({
      quote: String(it.quote || ''),
      type: String(it.type || '语句不通'),
      fix: String(it.fix || ''),
      why: String(it.why || '').trim(),
    }))
    .filter((it) => {
      if (!it.quote || !it.fix || it.quote === it.fix) return false;
      if (!text.includes(it.quote)) return false;
      if (seen.has(it.quote)) return false;
      seen.add(it.quote);
      return true;
    })
    .map((it) => ({ ...it, count: text.split(it.quote).length - 1 }));

  // flags 不做替换，所以 quote 对不上也留着（可能是整篇性的问题），只是标记一下
  const LEVELS = ['高', '中', '低'];

  // 实测模型会拿「低」这一档凑数，而且常写成「符合……但……」——先承认没问题再硬找茬。
  // 提示词里已经说过不要这样，但它还是会；所以在代码层把这两类丢掉。
  // 注意 (?<![不未没]) —— 「不符合平台规范，但…」是真问题，不能被当成凑数丢掉
  const PADDING = /((?<![不未没])符合|未涉及|不存在|没有明显|无明显|不涉及)[^，。；]{0,14}[，,、]?\s*(但|不过)/;

  const flags = (Array.isArray(data.flags) ? data.flags : [])
    .map((f) => ({
      dimension: REVIEW_DIMENSIONS.includes(f.dimension) ? f.dimension : '账号调性',
      level: LEVELS.includes(f.level) ? f.level : '中',
      quote: String(f.quote || '').trim(),
      what: String(f.what || '').trim(),
      suggestion: String(f.suggestion || '').trim(),
    }))
    .filter((f) => f.what && f.level !== '低' && !PADDING.test(f.what))
    .map((f) => ({ ...f, locatable: Boolean(f.quote) && text.includes(f.quote) }))
    .sort((a, b) => LEVELS.indexOf(a.level) - LEVELS.indexOf(b.level))
    .slice(0, 12);

  const padded = (Array.isArray(data.flags) ? data.flags : []).length - flags.length;

  const verdict = ['ok', 'minor', 'bad'].includes(data.verdict) ? data.verdict : (issues.length ? 'minor' : 'ok');
  const risk = flags.find((f) => f.level === '高') ? '高'
    : flags.length ? '中' : '无';

  return withHeadingReview({
    verdict,
    risk,
    summary: String(data.summary || '').trim(),
    issues,
    flags,
    padded,                                        // 被判定为凑数而丢掉的提示条数
    dropped: data.issues.length - issues.length,   // 原文里对不上的，如实告诉前端
    at: new Date().toISOString(),
  }, text);
}

const mockReview = (text, draft) => ({
  verdict: 'minor',
  summary: '演示模式：配置模型密钥后，这里是语言与调性风险的真实检查结果',
  issues: text.length > 30
    ? [{ quote: text.slice(10, 24), type: '语句不通', fix: text.slice(10, 24), why: '演示模式占位' }]
    : [],
  flags: [
    { dimension: '平台调性', level: '中', quote: '',
      what: `演示模式：这里会对照${platformSpec(draft?.platform).label}的写作规范给出符合度判断`,
      suggestion: '配置模型密钥后生效' },
    { dimension: '法律风险', level: '低', quote: '',
      what: '演示模式：这里会查广告法绝对化用语、功效承诺等风险',
      suggestion: '配置模型密钥后生效' },
  ],
});

/* ---------------- 口播提示 ---------------- */

export async function handleCues(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');
  const text = String(draft.content || '').trim();
  if (!text) throw new HttpError(400, '还没有正文');
  if (text.length > 12000) throw new HttpError(400, '正文过长，请分段生成');

  const persona = (draft.persona_id && Personas.byId(draft.persona_id, user.id)) || draft.persona;

  const data = await withRetry(async () => {
    const out = await generateJSON({
      meta: { feature: '口播提示', userId: user.id },
      system: CUES_SYSTEM,
      user: cuesUser(draft, persona, text),
      schema: CUES_SCHEMA,
      mock: () => mockCues(text),
    });
    if (!out || !Array.isArray(out.cues) || !out.cues.length) throw new HttpError(502, '没有拿到提示');
    return out;
  }, '生成口播提示失败，请再试一次');

  // quote 必须能在正文里找到，否则对不上位置；重读词也必须真的在这段里
  const cues = data.cues.map((c) => {
    const quote = String(c.quote || '');
    const stress = (Array.isArray(c.stress) ? c.stress : [])
      .map((w) => String(w).trim())
      .filter((w) => w && quote.includes(w))
      .slice(0, 4);
    return {
      quote,
      emotion: String(c.emotion || '').trim(),
      tone_tag: TONE_TAGS.includes(c.tone_tag) ? c.tone_tag : '日常',
      stress,
      pause: String(c.pause || '').trim(),
      expression: String(c.expression || '').trim(),
      gesture: String(c.gesture || '').trim(),
      locatable: Boolean(quote) && text.includes(quote),
    };
  }).filter((c) => c.quote && c.locatable);

  if (!cues.length) throw new HttpError(502, '提示和正文对不上，请再试一次');

  const covered = cues.reduce((n, c) => n + c.quote.length, 0);
  const payload = {
    overall: {
      tone: String(data.overall?.tone || '').trim(),
      pace: String(data.overall?.pace || '').trim(),
      note: String(data.overall?.note || '').trim(),
    },
    cues,
    coverage: Math.min(100, Math.round((covered / text.length) * 100)),
    dropped: data.cues.length - cues.length,
    at: new Date().toISOString(),
  };
  Drafts.setCues(draft.id, user.id, payload);
  json(res, 200, { cues: payload });
}

const mockCues = (text) => {
  const lines = text.split('\n').map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('---')).slice(0, 3);
  return {
    overall: { tone: '演示模式：这里会给整体情绪基调', pace: '演示模式：这里会给语速节奏建议', note: '' },
    cues: lines.map((l, i) => ({
      quote: l,
      emotion: i === 0 ? '演示模式：开场用什么情绪' : '平述',
      stress: [],
      pause: i === 0 ? '演示模式：这里会标停顿' : '',
      expression: i === 0 ? '演示模式：这里会标表情' : '',
      gesture: '',
    })),
  };
};

/* ---------------- 编辑器：划词改写 / 唤起续写 ---------------- */

export async function handleAssist(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  const clip = (v, n) => String(v ?? '').slice(0, n);
  const selection = clip(body?.selection, 4000);
  const before = clip(body?.before, 1500);
  const after = clip(body?.after, 1500);

  // 账号还在就用最新设定，否则退回创作时的快照
  const persona = (draft.persona_id && Personas.byId(draft.persona_id, user.id)) || draft.persona;
  const samples = styleSamples(persona, user.id);

  let instruction;
  let user_prompt;
  if (body?.kind === 'compose') {
    instruction = COMPOSE_ACTIONS[body.action]?.instruction
      || clip(body?.instruction, 500).trim();
    if (!instruction) throw new HttpError(400, '请说明要写什么');
    user_prompt = composeUser(draft, persona, samples, { instruction, before, after });
  } else {
    const action = ASSIST_ACTIONS[body?.action];
    if (!action) throw new HttpError(400, '不支持的操作');
    if (!selection.trim()) throw new HttpError(400, '请先选中一段文字');
    instruction = action.instruction;
    user_prompt = assistUser(draft, persona, samples, { instruction, selection, before, after });
  }

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const text = await streamText({
      meta: { feature: body?.kind === 'compose' ? '编辑器续写' : '划词改写', userId: user.id },
      system: ASSIST_SYSTEM,
      user: user_prompt,
      onDelta: (t) => send('delta', { text: t }),
      mock: () => mockAssist(body, selection),
      signal: controller.signal,
    });
    send('done', { text });
  } catch (err) {
    if (!controller.signal.aborted) send('error', { message: describe(err) });
  } finally {
    res.end();
  }
}

const mockAssist = (body, selection) => {
  const label = ASSIST_ACTIONS[body?.action]?.label || COMPOSE_ACTIONS[body?.action]?.label || '自定义指令';
  return body?.kind === 'compose'
    ? `（演示模式 · ${label}）这里会由大模型按账号语气就地续写一段。配置模型密钥后生效。`
    : `（演示模式 · ${label}）${selection}`;
};

/* ---------------- 语气学习 ---------------- */

const DIGEST_MAX_SAMPLES = 6;
const DIGEST_MAX_CHARS = 3000;

export async function handleSampleList(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');
  json(res, 200, {
    samples: Samples.list(persona.id, user.id),
    digest: persona.style_digest,
    updated_at: persona.style_updated_at,
  });
}

export async function handleSampleCreate(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');

  let title = String(body?.title ?? '').trim().slice(0, 120);
  let content = String(body?.content ?? '').trim();
  let draftId = null;

  // 直接喂一篇创作记录
  if (body?.draft_id) {
    const draft = Drafts.byId(Number(body.draft_id), user.id);
    if (!draft) throw new HttpError(404, '记录不存在');
    if (!draft.content.trim()) throw new HttpError(400, '这篇还没有正文');
    draftId = draft.id;
    title = title || draft.title || draft.subject;
    content = draft.content;
  }

  if (content.replace(/\s/g, '').length < 100) throw new HttpError(400, '样本太短了，至少 100 字才学得出语气');
  if (content.length > 20000) throw new HttpError(400, '样本过长，请截取代表性的一篇');
  if (Samples.list(persona.id, user.id, { limit: 100 }).length >= 30) {
    throw new HttpError(400, '样本数量已达上限（30 篇），请先删掉一些');
  }

  Samples.create(user.id, persona.id, { draftId, title, content });
  const digest = await rebuildDigest(persona, user.id);
  json(res, 200, {
    persona: Personas.byId(persona.id, user.id),
    samples: Samples.list(persona.id, user.id),
    digest,
  });
}

export async function handleSampleDelete(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');
  if (!Samples.remove(Number(params.sampleId), user.id)) throw new HttpError(404, '样本不存在');

  const left = Samples.list(persona.id, user.id, { limit: 1 });
  const digest = left.length ? await rebuildDigest(persona, user.id) : '';
  if (!left.length) Personas.setDigest(persona.id, user.id, '');
  json(res, 200, { samples: Samples.list(persona.id, user.id), digest });
}

export async function handleDigestRebuild(req, res, body, params) {
  const user = requireUser(req);
  const persona = Personas.byId(Number(params.id), user.id);
  if (!persona) throw new HttpError(404, '账号不存在');
  if (!Samples.list(persona.id, user.id, { limit: 1 }).length) {
    throw new HttpError(400, '还没有样本可学');
  }
  json(res, 200, { digest: await rebuildDigest(persona, user.id) });
}

/* 把样本重新蒸馏成语气档案 —— 每次增删样本后都重算，保证档案和样本一致 */
async function rebuildDigest(persona, userId) {
  const samples = Samples.list(persona.id, userId, { withContent: true, limit: DIGEST_MAX_SAMPLES })
    .map((s) => ({ title: s.title, content: s.content.slice(0, DIGEST_MAX_CHARS) }));
  if (!samples.length) return '';

  const digest = await generateText({
    meta: { feature: '语气档案', userId },
    system: DIGEST_SYSTEM,
    user: digestUser(samples),
    mock: () => mockDigest(samples.length),
  });

  const cleaned = String(digest).trim().slice(0, 4000);
  Personas.setDigest(persona.id, userId, cleaned);
  return cleaned;
}

const mockDigest = (n) => [
  `- 演示模式：这里会由大模型从 ${n} 篇样本里总结出可复制的写作习惯`,
  '- 例如：段落多为 1-3 行，几乎不写超过 5 行的长段',
  '- 例如：开头常用一个具体场景，而不是抛结论',
  '- 配置模型密钥后，这份档案会变成真实的语气总结',
].join('\n');

/* ---------------- 历史 ---------------- */

export async function handleList(req, res, body, params, url) {
  const user = requireUser(req);
  // persona_id 不传 = 全部；'none' = 未绑定账号的；数字 = 该账号下的
  const raw = url?.searchParams.get('persona_id');
  const scope = raw === null || raw === '' ? {}
    : { personaId: raw === 'none' ? null : Number(raw) };
  const archived = url?.searchParams.get('archived') === '1';

  json(res, 200, {
    drafts: Drafts.list(user.id, { ...scope, archived }),
    counts: Drafts.counts(user.id, scope.personaId),
  });
}

/* ---------------- 归档 ---------------- */

export async function handleArchive(req, res, body, params) {
  const user = requireUser(req);
  const archived = body?.archived !== false;
  if (!Drafts.setArchived(Number(params.id), user.id, archived)) throw new HttpError(404, '记录不存在');
  json(res, 200, { draft: Drafts.byId(Number(params.id), user.id) });
}

/* 把当前范围内所有「已完成」的一次性收起来 */
export async function handleArchiveDone(req, res, body) {
  const user = requireUser(req);
  const raw = body?.persona_id;
  const personaId = raw === undefined || raw === '' || raw === null
    ? undefined
    : (raw === 'none' ? null : Number(raw));
  const n = Drafts.archiveDone(user.id, personaId);
  json(res, 200, { archived: n, counts: Drafts.counts(user.id, personaId) });
}

export async function handleGet(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');
  json(res, 200, { draft });
}

export async function handleDelete(req, res, body, params) {
  const user = requireUser(req);
  if (!Drafts.remove(Number(params.id), user.id)) throw new HttpError(404, '记录不存在');
  json(res, 200, { ok: true });
}

export function describe(err) {
  if (err instanceof HttpError) return err.message;
  const raw = String(err?.message || err);
  if (/401|authentication|api key/i.test(raw)) return '模型密钥无效或未配置，请检查 .env';
  if (/429|rate/i.test(raw)) return '触发上游限流，请稍后再试';
  if (/ENOTFOUND|ECONNREFUSED|fetch failed/i.test(raw)) return `无法连接模型服务（${PROVIDER}），请检查网络或 BASE_URL`;
  return raw.slice(0, 300);
}

export { json };

/* ==================================================================
 * 配图文件：出图结果落盘与清理
 * ================================================================== */

async function saveImage(userId, draftId, index, out) {
  const dir = resolvePath(DATA_DIR, 'images', String(userId));
  await mkdir(dir, { recursive: true });
  const name = `${draftId}-${index}.${out.ext}`;
  await writeFile(resolvePath(dir, name), out.buffer);
  await Promise.all(['png', 'jpg', 'webp', 'svg'].filter((e) => e !== out.ext)
    .map((e) => rm(resolvePath(dir, `${draftId}-${index}.${e}`), { force: true }).catch(() => {})));
  return `${userId}/${name}`;
}

export async function dropImageFiles(userId, draftId) {
  const dir = resolvePath(DATA_DIR, 'images', String(userId));
  try {
    const names = await readdir(dir);
    await Promise.all(names.filter((n) => n.startsWith(`${draftId}-`))
      .map((n) => rm(resolvePath(dir, n), { force: true })));
  } catch { /* 目录不存在就没什么可删的 */ }
}

export async function handleImageInfo(req, res) {
  requireUser(req);
  json(res, 200, { image: imageInfo() });
}

export async function handlePromptDocs(req, res) {
  json(res, 200, { stages: STAGES, principle: PRINCIPLE, assembly: ASSEMBLY, prompts: PROMPT_DOCS() });
}

/* ==================================================================
 * 多平台版本
 *
 * 一份账号设定、一篇成稿，出多个平台的版本。
 * 走的是**适配改写**而不是各平台各生成一遍——后者会让同一件事在不同平台
 * 变成不同的故事（事实、例子、数字各说各的），读者一对照就露馅，
 * 也和"栏目素材是唯一可信事实来源"那条直接冲突。
 * ================================================================== */

export async function handleVariant(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  const text = String(draft.content || '').trim();
  if (!text) throw new HttpError(400, '还没有正文');
  if (text.length > 12000) throw new HttpError(400, '正文过长');

  const to = String(body?.platform || '');
  if (!PLATFORMS[to]) throw new HttpError(400, '不认识这个平台');
  const from = PLATFORMS[draft.platform] ? draft.platform : DEFAULT_PLATFORM;
  if (to === from) throw new HttpError(400, '这就是原文的平台，不用再改一遍');

  const persona = (draft.persona_id && Personas.byId(draft.persona_id, user.id)) || draft.persona;

  const out = await withRetry(async () => {
    const t = await generateText({
      meta: { feature: '多平台适配', userId: user.id },
      system: ADAPT_SYSTEM,
      user: adaptUser(draft, persona, text, from, to),
      mock: () => `演示模式：这里会是「${PLATFORMS[to].label}」版本的正文。\n\n`
        + '真实模式下，事实层和原文完全一致，只重排结构、调语气、增删详略。',
    });
    const clean = String(t || '').trim();
    if (clean.length < 40) throw new HttpError(502, '没有拿到改写结果');
    return clean;
  }, '改写失败，请再试一次');

  const variants = { ...(draft.variants || {}) };
  variants[to] = {
    content: out,
    chars: out.length,
    // 记下改写时依据的原稿快照；正文后来变过就提示这版需要重做。
    fromChars: text.length,
    fromFingerprint: contentFingerprint(draft.content),
    from,
    at: new Date().toISOString(),
  };
  Drafts.setVariants(draft.id, user.id, variants);
  json(res, 200, { platform: to, variant: variants[to] });
}

export async function handleVariantSave(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  const platform = String(params.platform || '');
  const current = draft.variants?.[platform];
  if (!current) throw new HttpError(404, '这个平台版本还没生成');

  const content = String(body?.content ?? '');
  if (content.length > 60000) throw new HttpError(400, '正文过长');
  if (body?.previous !== undefined && String(body.previous) !== current.content) {
    throw new HttpError(409, '这个版本刚刚被修改过，请重新选择文字');
  }

  const variants = {
    ...draft.variants,
    [platform]: {
      ...current,
      content,
      chars: content.length,
      editedAt: new Date().toISOString(),
    },
  };
  Drafts.setVariants(draft.id, user.id, variants);

  /* Illustrations were positioned against the old version text. */
  if (draft.illus && Object.hasOwn(draft.illus, platform)) {
    const illus = { ...draft.illus };
    delete illus[platform];
    Drafts.setIllus(draft.id, user.id, illus);
  }

  json(res, 200, { draft: Drafts.byId(draft.id, user.id), variant: variants[platform] });
}

export async function handleVariantDelete(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');
  const variants = { ...(draft.variants || {}) };
  delete variants[String(params.platform)];
  Drafts.setVariants(draft.id, user.id, variants);
  json(res, 200, { ok: true });
}

/* ==================================================================
 * 图文配图
 *
 * 一篇 2-5 张，且提示词里明确要求**不画具体的人**——
 * 公众号插图本来就该是概念图和场景图，绕开人物，一致性问题就不存在。
 *
 * 配图挂在**版本**上（原文 or 某个平台版本）：公众号要配图，微博通常不需要，
 * 两边该插几张、插在哪也不一样。
 * ================================================================== */

/* 版本 key：'' = 原文；否则是平台 key。存 JSON 时用 '__main__' 占位，
   因为空字符串当对象键读起来太容易看错 */
const verKey = (v) => (v ? String(v) : '__main__');

function versionText(draft, v) {
  if (!v) return { text: String(draft.content || ''), platform: draft.platform };
  const hit = draft.variants?.[v];
  return { text: String(hit?.content || ''), platform: v };
}

export async function handleIllus(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  const v = String(body?.version || '');
  if (v && !draft.variants?.[v]) throw new HttpError(400, '这个平台版本还没生成');
  const { text, platform } = versionText(draft, v);
  if (!text.trim()) throw new HttpError(400, '这一版还没有正文');

  const persona = (draft.persona_id && Personas.byId(draft.persona_id, user.id)) || draft.persona;

  const data = await withRetry(async () => {
    const out = await generateJSON({
      meta: { feature: '图文配图', userId: user.id },
      system: ILLUS_SYSTEM,
      user: illusUser(draft, persona, text, platform),
      schema: ILLUS_SCHEMA,
      mock: () => ({
        look: '演示模式：这里会给整篇统一的视觉风格',
        items: [{ anchor: text.slice(0, 14), prompt: '演示模式：这里会是画面提示词', alt: '演示配图' }],
      }),
    });
    if (!out || !Array.isArray(out.items) || !out.items.length) throw new HttpError(502, '没有拿到配图方案');
    return out;
  }, '生成配图方案失败，请再试一次');

  // anchor 必须能在正文里找到，找不到就插不了——和口播提示的 quote 一个道理
  const seen = new Set();
  const items = data.items.map((it) => {
    const anchor = String(it.anchor || '').trim();
    const at = anchor ? text.indexOf(anchor) : -1;
    return { anchor, at, prompt: String(it.prompt || '').trim(), alt: String(it.alt || '').trim().slice(0, 20) };
  }).filter((it) => {
    if (it.at < 0 || !it.prompt || seen.has(it.at)) return false;   // 同一个位置只插一张
    seen.add(it.at);
    return true;
  }).sort((a, b) => a.at - b.at)
    .map((it, i) => ({ ...it, i, image: null }));

  if (!items.length) throw new HttpError(502, '配图位置和正文对不上，请再试一次');

  // 张数按字数硬卡。提示词里写了"宁可少插"，但实测 281 字的微博也给了 3 张——
  // 插图是给长文换气用的，短文里每隔两段一张只会打断阅读。
  // 大致每 450 字一张，至少 1 张，最多 5 张；超出的从后面砍（前面的位置更重要）。
  const cap = Math.max(1, Math.min(5, Math.round(text.length / 450)));
  const kept = items.slice(0, cap).map((it, i) => ({ ...it, i }));

  const store = { ...(draft.illus || {}) };
  const before = store[verKey(v)];
  store[verKey(v)] = {
    look: String(data.look || '').trim(),
    version: v,
    dropped: data.items.length - kept.length,
    capped: items.length > cap ? { asked: items.length, cap } : null,
    items: kept.map((it) => {
      // 提示词没变的位子，已经出过的图留着，别白花钱
      const old = before?.items?.find((o) => o.prompt === it.prompt);
      return old?.image ? { ...it, image: old.image } : it;
    }),
    at: new Date().toISOString(),
  };
  Drafts.setIllus(draft.id, user.id, store);
  json(res, 200, { version: v, illus: store[verKey(v)], image: imageInfo() });
}

export async function handleIllusImage(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  const v = String(body?.version || '');
  const store = draft.illus?.[verKey(v)];
  const idx = Number(params.i);
  const item = store?.items?.[idx];
  if (!item) throw new HttpError(400, '这个配图位不存在');
  if (!item.prompt) throw new HttpError(400, '这一张还没有画面提示词');

  const info = imageInfo();
  assertQuota(user.id, '图文配图', 1);
  const prompt = store.look ? `${item.prompt}。整体风格：${store.look}` : item.prompt;
  const started = Date.now();
  let out;
  try {
    // 文章插图用横图，竖图在正文里会把一屏占满
    out = await generate({ prompt, ratio: 'landscape' });
    Usage.record({
      userId: user.id, feature: '图文配图', provider: info.provider, model: info.model,
      ok: true, ms: Date.now() - started, units: 1, unit: '张',
    });
    consume(user.id, '图文配图', 1);
  } catch (err) {
    Usage.record({
      userId: user.id, feature: '图文配图', provider: info.provider, model: info.model,
      ok: false, ms: Date.now() - started, error: String(err?.message || err),
    });
    throw new HttpError(502, `出图失败：${describe(err)}`);
  }

  const file = await saveImage(user.id, draft.id, `${verKey(v)}-${idx}`, out);
  const image = { file, mime: out.mime, bytes: out.buffer.length, at: new Date().toISOString() };
  const next = { ...store, items: store.items.map((it, i) => (i === idx ? { ...it, image } : it)) };
  Drafts.setIllus(draft.id, user.id, { ...(draft.illus || {}), [verKey(v)]: next });
  json(res, 200, { version: v, index: idx, image });
}

/* ==================================================================
 * 素材库
 *
 * 产品里最硬的一条规则是"栏目素材是全篇唯一可信的事实来源，不许编造"。
 * 但素材原来每篇现填、填完就丢。存下来之后：写作时按题材召回相关的几条，
 * 拼进 user 消息——素材越厚，能写的真东西越多，编造的余地越小。
 * ================================================================== */


/* 按题材召回素材。
 *
 * 刻意**不做向量检索**：素材是几十到几百条的量级，标题/标签/正文的字面重合
 * 已经够用，而且结果可解释——用户能看懂"为什么是这几条"。
 * 上限 6 条：再多会挤占正文该占的上下文，模型也开始硬塞。 */
export function recallMaterials(userId, personaId, text, limit = 6) {
  if (!personaId) return [];
  const all = Materials.list(userId, personaId);
  if (!all.length) return [];

  // 中文没有空格分词，按 2 字滑窗取词——够粗但对"AI组织变革"这类词组够用
  const src = String(text || '');
  const grams = new Set();
  for (let i = 0; i < src.length - 1; i += 1) {
    const g = src.slice(i, i + 2);
    if (/[\u4e00-\u9fa5A-Za-z0-9]{2}/.test(g)) grams.add(g);
  }
  if (!grams.size) return [];

  const scored = all.map((m) => {
    const hay = `${m.title} ${m.tags} ${m.body.slice(0, 300)}`;
    let hit = 0;
    for (const g of grams) if (hay.includes(g)) hit += 1;
    // 标签命中权重高一些——标签是作者自己标的，比正文里的偶然重合可信
    const tagHit = m.tags ? [...grams].filter((g) => m.tags.includes(g)).length : 0;
    return { m, score: hit + tagHit * 2 };
  }).filter((x) => x.score >= 3);          // 太低的分是噪声，宁可不给

  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.m);
}

export async function handleMaterialList(req, res, body, params) {
  const user = requireUser(req);
  const personaId = params.id ? Number(params.id) : null;
  if (personaId && !Personas.byId(personaId, user.id)) throw new HttpError(404, '账号不存在');
  json(res, 200, { materials: Materials.list(user.id, personaId), kinds: MATERIAL_KINDS });
}

const cleanMaterial = (b) => ({
  kind: MATERIAL_KINDS.includes(b?.kind) ? b.kind : MATERIAL_KINDS[0],
  title: String(b?.title || '').trim().slice(0, 80),
  body: String(b?.body || '').trim().slice(0, 4000),
  tags: String(b?.tags || '').trim().slice(0, 200),
});

export async function handleMaterialCreate(req, res, body, params) {
  const user = requireUser(req);
  const personaId = Number(params.id);
  if (!Personas.byId(personaId, user.id)) throw new HttpError(404, '账号不存在');
  const m = cleanMaterial(body);
  if (!m.title) throw new HttpError(400, '给这条素材起个标题');
  if (!m.body) throw new HttpError(400, '素材内容不能为空——空的素材帮不上写作');
  json(res, 200, { material: Materials.create(user.id, personaId, m) });
}

export async function handleMaterialUpdate(req, res, body, params) {
  const user = requireUser(req);
  const m = cleanMaterial(body);
  if (!m.title || !m.body) throw new HttpError(400, '标题和内容都不能为空');
  const out = Materials.update(Number(params.mid), user.id, m);
  if (!out) throw new HttpError(404, '素材不存在');
  json(res, 200, { material: out });
}

export async function handleMaterialDelete(req, res, body, params) {
  const user = requireUser(req);
  if (!Materials.remove(Number(params.mid), user.id)) throw new HttpError(404, '素材不存在');
  json(res, 200, { ok: true });
}

/* ==================================================================
 * 选题池与排期
 *
 * 热点里看到的机会、推荐里想留的题材，不当场写就丢了。
 * 池子负责"攒"，plan_date 负责"排到哪天"——空 = 只在池子里。
 * 刻意不做完整日历：自媒体的排期粒度就是"这周写哪几条"。
 * ================================================================== */

export async function handlePoolList(req, res, body, params, url) {
  const user = requireUser(req);
  const raw = url?.searchParams.get('persona');
  const personaId = raw ? Number(raw) : null;
  json(res, 200, { pool: Pool.list(user.id, personaId) });
}

export async function handlePoolCreate(req, res, body) {
  const user = requireUser(req);
  const subject = String(body?.subject || '').trim().slice(0, 200);
  if (!subject) throw new HttpError(400, '题材不能为空');
  const personaId = body?.persona_id ? Number(body.persona_id) : null;
  if (personaId && !Personas.byId(personaId, user.id)) throw new HttpError(404, '账号不存在');
  json(res, 200, {
    item: Pool.create(user.id, personaId, {
      subject,
      note: String(body?.note || '').trim().slice(0, 500),
      source: String(body?.source || '手动').slice(0, 20),
      plan_date: cleanDate(body?.plan_date),
    }),
  });
}

/* 日期只收 YYYY-MM-DD，别的一律当空——排期字段被塞进奇怪的值，后面排序就乱了 */
const cleanDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');

export async function handlePoolUpdate(req, res, body, params) {
  const user = requireUser(req);
  const patch = {};
  if (body?.subject !== undefined) patch.subject = String(body.subject).trim().slice(0, 200);
  if (body?.note !== undefined) patch.note = String(body.note).trim().slice(0, 500);
  if (body?.plan_date !== undefined) patch.plan_date = cleanDate(body.plan_date);
  if (body?.status !== undefined) patch.status = ['idea', 'planned', 'done'].includes(body.status) ? body.status : 'idea';
  const out = Pool.update(Number(params.pid), user.id, patch);
  if (!out) throw new HttpError(404, '这条不存在');
  json(res, 200, { item: out });
}

export async function handlePoolDelete(req, res, body, params) {
  const user = requireUser(req);
  if (!Pool.remove(Number(params.pid), user.id)) throw new HttpError(404, '这条不存在');
  json(res, 200, { ok: true });
}

/* ==================================================================
 * 发布数据回填与复盘
 *
 * 整条链路原来到"导出"就断了——哪篇火了、哪个方向表现好、
 * 哪种开头留存高，一概不知。语气档案只学了"你怎么写"，没学"什么有效"。
 *
 * 回填刻意做得很轻：发完手填几个数字就行。指望自动抓平台数据不现实
 * （没有开放接口，爬取违反条款），而几个数字的手工成本远低于它带来的信息。
 * ================================================================== */

const METRIC_FIELDS = ['views', 'likes', 'comments', 'shares', 'follows'];
const METRIC_LABELS = { views: '阅读/播放', likes: '点赞', comments: '评论', shares: '转发/收藏', follows: '涨粉' };

export async function handleMetricsSave(req, res, body, params) {
  const user = requireUser(req);
  const draft = Drafts.byId(Number(params.id), user.id);
  if (!draft) throw new HttpError(404, '记录不存在');

  const metrics = {};
  for (const k of METRIC_FIELDS) {
    const v = Number(body?.[k]);
    if (Number.isFinite(v) && v >= 0) metrics[k] = Math.round(v);
  }
  const note = String(body?.note || '').trim().slice(0, 300);
  if (note) metrics.note = note;

  const published = /^\d{4}-\d{2}-\d{2}$/.test(String(body?.published_at || ''))
    ? String(body.published_at) : (draft.published_at || new Date().toISOString().slice(0, 10));

  // 全空就是撤销回填，存 null 而不是一个空对象——复盘时才好过滤
  const empty = !METRIC_FIELDS.some((k) => k in metrics) && !note;
  Drafts.setMetrics(draft.id, user.id, empty ? null : metrics, empty ? '' : published);
  json(res, 200, { metrics: empty ? null : metrics, published_at: empty ? '' : published });
}

export async function handleMetricsMeta(req, res) {
  requireUser(req);
  json(res, 200, { fields: METRIC_FIELDS.map((k) => ({ key: k, label: METRIC_LABELS[k] })) });
}

/* 复盘：按维度分组比中位数。
 *
 * 用**中位数不用平均数**——自媒体数据长尾极重，一条爆款能把平均值拉到毫无参考价值。
 * 样本少于 3 条的维度不给结论，只报数量：两三条数据得出的"规律"是噪声。 */
export async function handleReview2(req, res, body, params, url) {
  const user = requireUser(req);
  const raw = url?.searchParams.get('persona');
  const personaId = raw ? Number(raw) : undefined;
  const rows = Drafts.withMetrics(user.id, personaId);

  const sections = Object.fromEntries(
    (personaId ? Sections.list(personaId, user.id) : []).map((s) => [s.id, s.name]),
  );

  const items = rows.map((r) => {
    let m = null;
    let topics = [];
    try { m = JSON.parse(r.metrics_json); } catch { /* 脏数据跳过 */ }
    try { topics = JSON.parse(r.topics_json) || []; } catch { /* 同上 */ }
    const chosen = topics.find?.((t) => t?.chosen) || topics[0] || null;
    return {
      id: r.id,
      title: r.title || r.subject,
      platform: r.platform,
      section: sections[r.section_id] || '',
      label: chosen?.label || '',
      published_at: r.published_at,
      metrics: m,
    };
  }).filter((x) => x.metrics);

  const median = (nums) => {
    const a = nums.filter((n) => Number.isFinite(n)).sort((x, y) => x - y);
    if (!a.length) return null;
    const i = Math.floor(a.length / 2);
    return a.length % 2 ? a[i] : Math.round((a[i - 1] + a[i]) / 2);
  };

  const group = (key) => {
    const buckets = new Map();
    for (const it of items) {
      const k = it[key];
      if (!k) continue;
      if (!buckets.has(k)) buckets.set(k, []);
      buckets.get(k).push(it);
    }
    return [...buckets.entries()].map(([name, list]) => ({
      name,
      count: list.length,
      // 样本太少不给中位数——两三条数据得出的"规律"是噪声
      views: list.length >= 3 ? median(list.map((x) => x.metrics.views)) : null,
      likes: list.length >= 3 ? median(list.map((x) => x.metrics.likes)) : null,
    })).sort((a, b) => (b.views ?? -1) - (a.views ?? -1));
  };

  json(res, 200, {
    total: items.length,
    items: items.slice(0, 40),
    byPlatform: group('platform'),
    bySection: group('section'),
    byLabel: group('label'),
    note: items.length < 6
      ? `只回填了 ${items.length} 篇，还看不出规律——攒到十几篇再看。`
      : '用中位数不是平均数：自媒体数据长尾重，一条爆款会把平均值拉到没有参考价值。样本少于 3 篇的维度不给结论。',
  });
}

/* ==================================================================
 * 提示词 A/B 与 eval（管理后台）
 *
 * A/B 的意义全在"记下每次用了哪个变体"上——没有这一列，
 * 换提示词就只是"感觉好像好点"。
 *
 * eval 的打分刻意分两层：确定性指标（客观、可复现、不花钱）+ 盲测人工对比。
 * **不用大模型当裁判**——这个项目一路的结论是模型在"给点评价"的压力下
 * 一定会顺着说，让它评自己的输出，得到的是和气不是信号。
 * ================================================================== */

/* 能做 A/B 的功能。只列真正值得试的那几个——
   每加一个都要在调用处接上分流，不是所有提示词都值得这个复杂度。 */
export const AB_FEATURES = [
  { key: 'topics', label: '选题方向', builtin: () => TOPICS_SYSTEM, kind: 'json' },
  { key: 'content', label: '成稿', builtin: () => CONTENT_SYSTEM, kind: 'text' },
];

export async function handlePromptVariantList(req, res, body, params, url) {
  requireAdmin(req);
  const feature = url?.searchParams.get('feature') || '';
  json(res, 200, {
    features: AB_FEATURES.map((f) => ({ key: f.key, label: f.label, builtin: f.builtin() })),
    variants: Variants.list(feature),
  });
}

const cleanVariant = (b) => ({
  feature: AB_FEATURES.some((f) => f.key === b?.feature) ? b.feature : '',
  name: String(b?.name || '').trim().slice(0, 40),
  system: String(b?.system || '').trim(),
  weight: Math.max(0, Math.min(20, Math.round(Number(b?.weight) || 1))),
  active: Boolean(b?.active),
  note: String(b?.note || '').trim().slice(0, 300),
});

export async function handlePromptVariantSave(req, res, body, params) {
  requireAdmin(req);
  const v = cleanVariant(body);
  if (!v.feature) throw new HttpError(400, '不认识这个功能');
  if (!v.name) throw new HttpError(400, '给变体起个名字');
  if (v.system.length < 40) throw new HttpError(400, '提示词太短了，确认粘完整了吗');
  json(res, 200, {
    variant: params.vid ? Variants.update(Number(params.vid), v) : Variants.create(v),
  });
}

export async function handlePromptVariantDelete(req, res, body, params) {
  requireAdmin(req);
  if (!Variants.remove(Number(params.vid))) throw new HttpError(404, '变体不存在');
  json(res, 200, { ok: true });
}

/* ---------------- eval 用例 ---------------- */

export async function handleEvalCases(req, res, body, params, url) {
  requireAdmin(req);
  json(res, 200, { cases: Evals.cases(url?.searchParams.get('feature') || '') });
}

export async function handleEvalCaseAdd(req, res, body) {
  requireAdmin(req);
  const feature = AB_FEATURES.some((f) => f.key === body?.feature) ? body.feature : '';
  if (!feature) throw new HttpError(400, '不认识这个功能');
  const title = String(body?.title || '').trim().slice(0, 80);
  if (!title) throw new HttpError(400, '给用例起个名字');
  json(res, 200, { case: Evals.addCase({ feature, title, input: body?.input || {} }) });
}

export async function handleEvalCaseDelete(req, res, body, params) {
  requireAdmin(req);
  if (!Evals.removeCase(Number(params.cid))) throw new HttpError(404, '用例不存在');
  json(res, 200, { ok: true });
}

/* ---------------- 跑一批 ---------------- */

/* 每个用例 × 每个变体（含内置）跑一次。
   串行跑——并发一上来，模型侧限流和本地日志都变难看，而 eval 本来就不赶时间。 */
export async function handleEvalRun(req, res, body) {
  requireAdmin(req);
  const feature = AB_FEATURES.find((f) => f.key === body?.feature);
  if (!feature) throw new HttpError(400, '不认识这个功能');

  const cases = Evals.cases(feature.key);
  if (!cases.length) throw new HttpError(400, '这个功能还没有用例');

  const pool = [
    { id: null, name: '内置', system: feature.builtin() },
    ...Variants.list(feature.key).map((v) => ({ id: v.id, name: v.name, system: v.system })),
  ];
  if (pool.length < 2) throw new HttpError(400, '只有内置一份提示词，没什么可比的——先加个变体');

  const batch = `${feature.key}-${Date.now().toString(36)}`;
  let done = 0;
  let failed = 0;

  for (const c of cases) {
    let input = {};
    try { input = JSON.parse(c.input_json); } catch { /* 脏数据当空 */ }

    for (const v of pool) {
      const started = Date.now();
      try {
        // eslint-disable-next-line no-await-in-loop
        const { output, scores } = await runOne(feature, v, input);
        Evals.addRun({
          batch, caseId: c.id, variantId: v.id, variantName: v.name,
          output, scores, ms: Date.now() - started,
        });
        done += 1;
      } catch (err) {
        Evals.addRun({
          batch, caseId: c.id, variantId: v.id, variantName: v.name,
          ms: Date.now() - started, error: String(err?.message || err).slice(0, 300),
        });
        failed += 1;
      }
    }
  }

  json(res, 200, { batch, done, failed, cases: cases.length, variants: pool.length });
}

/* 单次执行 + 确定性打分。
   eval 走的是和线上同一套 user 消息拼装——否则测的就不是线上那个东西了。 */
async function runOne(feature, variant, input) {
  const form = {
    subject: String(input.subject || '').slice(0, 200),
    platform: PLATFORMS[input.platform] ? input.platform : DEFAULT_PLATFORM,
    tone: input.tone || DEFAULT_TONE,
    audience: input.audience || '',
    keywords: input.keywords || '',
    length: input.length || 0,
  };
  const persona = input.persona || null;

  if (feature.key === 'topics') {
    const data = await generateJSON({
      meta: { feature: 'eval·选题方向', variant: variant.name },
      system: variant.system,
      user: topicsUser(form, persona, []),
      schema: TOPICS_SCHEMA,
      mock: () => mockTopics(form),
    });
    return { output: JSON.stringify(data, null, 2), scores: scoreTopics(data) };
  }

  // 成稿：用例里得带一个方向，没有就用一个最小的占位方向
  const topic = input.topic || {
    title: form.subject, angle: '直接展开', hook: '', outline: ['开场', '主体', '收尾'], audience_fit: '',
  };
  const text = await generateText({
    meta: { feature: 'eval·成稿', variant: variant.name },
    system: variant.system,
    user: contentUser(form, topic, persona, [], []),
    mock: () => mockContent(form, topic),
  });
  return { output: text, scores: scoreText(text, { platform: form.platform }) };
}

/* ---------------- 结果与盲测 ---------------- */

export async function handleEvalBatches(req, res) {
  requireAdmin(req);
  json(res, 200, { batches: Evals.batches() });
}

export async function handleEvalResult(req, res, body, params) {
  requireAdmin(req);
  const runs = Evals.runs(String(params.batch));
  if (!runs.length) throw new HttpError(404, '没有这一批');

  const votes = Evals.votes(String(params.batch));
  const tally = new Map();
  for (const v of votes) {
    if (!v.winner) continue;
    const r = runs.find((x) => x.id === v.winner);
    if (r) tally.set(r.variant_name, (tally.get(r.variant_name) || 0) + 1);
  }

  json(res, 200, {
    batch: params.batch,
    summary: summarize(runs),
    votes: { total: votes.length, ties: votes.filter((v) => !v.winner).length, tally: [...tally] },
    // 盲测用：按用例分组，前端隐去变体名
    cases: [...new Map(runs.map((r) => [r.case_id, r.case_title])).entries()]
      .map(([id, title]) => ({ id, title, runs: runs.filter((r) => r.case_id === id) })),
  });
}

export async function handleEvalVote(req, res, body, params) {
  requireAdmin(req);
  Evals.vote({
    batch: String(params.batch),
    caseId: Number(body?.case_id) || 0,
    leftId: Number(body?.left) || 0,
    rightId: Number(body?.right) || 0,
    winner: Number(body?.winner) || 0,
  });
  json(res, 200, { ok: true });
}

/* ==================================================================
 * 套餐与用量（面向用户）
 * ================================================================== */

export async function handlePlanInfo(req, res) {
  const user = requireUser(req);
  const q = snapshot(user.id);

  // 本周期花在哪了。折算成点数——用户理解的是点，不是 token 和字符
  const rows = Usage.myUsage(user.id, q.period).map((r) => {
    const units = r.unit === 'token' ? r.tokens : r.units;
    return {
      feature: r.feature,
      calls: r.calls,
      units: Math.round(units || 0),
      unit: r.unit || '次',
      credits: creditsFor(r.feature, units || 0),
    };
  }).filter((r) => r.credits > 0).sort((a, b) => b.credits - a.credits);

  json(res, 200, {
    quota: q,
    breakdown: rows,
    explain: explain(q.left, planOf(q.plan)),
    plans: Object.values(PLANS).map((p) => ({
      key: p.key, label: p.label, price: p.price, credits: p.credits, note: p.note, blocked: p.blocked,
    })),
    packs: Object.values(PACKS),
  });
}

/* 换套餐 / 买加购包。
 *
 * **这里还没有接支付**——现在是直接改状态。上线前必须换成"下单 → 支付回调 → 再改状态"，
 * 否则任何人都能把自己改成 Max。留成独立接口就是为了到时候只换这一处的实现。 */
export async function handlePlanChange(req, res, body) {
  const user = requireUser(req);
  if (process.env.ALLOW_SELF_UPGRADE !== '1') {
    throw new HttpError(403, '还没接支付，暂时不能自助改套餐');
  }
  if (body?.pack) {
    const pack = PACKS[body.pack];
    if (!pack) throw new HttpError(400, '没有这个加购包');
    Quota.addPack(user.id, pack.credits);
  } else {
    if (!PLANS[body?.plan]) throw new HttpError(400, '没有这个套餐');
    Quota.setPlan(user.id, body.plan);
  }
  json(res, 200, { quota: snapshot(user.id) });
}

/* ==================================================================
 * 下单与支付回调
 *
 * 几条错了就会丢钱的规则，都落在代码里：
 *   1. **订单是唯一真相**：用户套餐由订单驱动，回调只负责把订单标成已付，
 *      开通是"订单变成 paid"的副作用。不允许回调直接改用户套餐。
 *   2. **金额从服务端算**：前端只传买什么，价格查表得来。信任前端传的金额 = 一分钱买 Max。
 *   3. **发货幂等**：回调会重复推送（微信最多 15 次），靠 markPaid 的
 *      `WHERE status='pending'` 去重——第二次 changes 为 0 就跳过发货。
 *   4. **验签失败一律丢弃**：不验签等于任何人都能伪造"支付成功"。
 * ================================================================== */

export async function handlePayInfo(req, res) {
  const user = requireUser(req);
  json(res, 200, { pay: payInfo(), orders: Orders.listByUser(user.id, 10) });
}

export async function handleOrderCreate(req, res, body) {
  const user = requireUser(req);
  const channel = ['wechat', 'alipay'].includes(body?.channel) ? body.channel : 'mock';

  // 价格一律从服务端的表里查——信任前端传来的金额，等于一分钱买 Max
  const kind = body?.pack ? 'pack' : 'plan';
  const item = kind === 'pack' ? PACKS[body.pack] : PLANS[body.plan];
  if (!item) throw new HttpError(400, '没有这个商品');
  if (!item.price) throw new HttpError(400, '免费档不用下单');

  const no = newTradeNo();
  const amount = Math.round(item.price * 100);      // 分。用整数，浮点算钱迟早出事
  Orders.create({ no, userId: user.id, kind, sku: item.key, amount, channel: payInfo().provider === 'mock' ? 'mock' : channel });

  let pay;
  try {
    pay = await createPayment({ channel, no, amount, subject: `文案工坊 · ${item.label}` });
  } catch (err) {
    Orders.close(no);
    throw new HttpError(502, `下单失败：${describe(err)}`);
  }
  json(res, 200, { no, amount, label: item.label, ...pay });
}

/* 回调。两家的响应格式不同，但逻辑是同一套。 */
export async function handlePayNotify(req, res, body, params, url) {
  const channel = String(params.channel);
  const raw = await readRawBody(req);
  const hit = verifyNotify(channel, { headers: req.headers, rawBody: raw, query: url?.searchParams });

  // 验签不过 = 伪造，直接丢。不回 200，免得对方以为收下了
  if (!hit) { res.writeHead(400).end('bad sign'); return; }

  const order = Orders.byNo(hit.no);
  // 金额不符也当伪造——回调里的数字不可信，必须和自己落的库比
  if (!order || (hit.amount != null && Number(hit.amount) !== order.amount)) {
    res.writeHead(400).end('mismatch');
    return;
  }

  // markPaid 只在 pending 时命中；重复推送第二次就走不进发货
  if (Orders.markPaid(hit.no, hit.tradeNo, hit.raw)) grant(order);

  // 两家都认这种"收到了别再推了"的响应
  if (channel === 'alipay') { res.writeHead(200).end('success'); return; }
  res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"code":"SUCCESS"}');
}

/* 发货：按订单类型开通。单独一个函数，因为它必须只被 markPaid 成功后调用。 */
function grant(order) {
  if (order.kind === 'pack') {
    const pack = PACKS[order.sku];
    if (pack) Quota.addPack(order.user_id, pack.credits);
  } else if (PLANS[order.sku]) {
    Quota.setPlan(order.user_id, order.sku);
  }
  Orders.markGranted(order.out_trade_no);
}

/* 前端轮询订单状态。回调可能丢，所以这里也是补偿的入口。 */
export async function handleOrderStatus(req, res, body, params) {
  const user = requireUser(req);
  const order = Orders.byNo(String(params.no));
  if (!order || order.user_id !== user.id) throw new HttpError(404, '订单不存在');

  // 还没收到回调时主动查一次——不能只等推送
  if (order.status === 'pending') {
    try {
      const q = await queryOrder(order.channel, order.out_trade_no);
      if (q?.paid && Orders.markPaid(order.out_trade_no, q.tradeNo || '', 'query')) {
        grant(order);
      }
    } catch { /* 查单失败不影响返回当前状态 */ }
  }
  json(res, 200, { order: Orders.byNo(order.out_trade_no), quota: snapshot(user.id) });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 512 * 1024) { reject(new Error('回调体过大')); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/* ==================================================================
 * 支付配置管理（管理后台）
 *
 * 商户私钥能以你的名义签名收款，所以这一块比别的配置管得严：
 *   - 加密入库，密钥留在环境变量（只拿到 DB 文件解不开）
 *   - **接口永远不返回原文**，只回"已配置 · ****1234"
 *   - env 里配了的，后台不给改——生产可以完全锁死在环境变量里
 * ================================================================== */

export async function handleSettingsList(req, res) {
  const admin = requireAdmin(req);
  json(res, 200, {
    fields: settingsStatus(),
    encrypted: hasKey(),
    warn: hasKey() ? '' : '没有设置 SECRET_KEY，敏感项的加密形同虚设。'
      + '生产环境务必设一个随机的长字符串，并且不要和数据库放在一起备份。',
    admin: admin.username,
  });
}

export async function handleSettingsSave(req, res, body) {
  const admin = requireAdmin(req);
  const key = String(body?.key || '');
  try {
    saveSetting(key, body?.value, admin.username);
  } catch (err) {
    throw new HttpError(400, String(err?.message || err));
  }
  json(res, 200, { fields: settingsStatus() });
}

/* 连通性自检。填完不试一下，第一次真实支付才发现配错，那时候是用户在等着付钱。 */
export async function handleSettingsCheck(req, res) {
  requireAdmin(req);
  const info = payInfo();
  const checks = [];

  const notify = conf('PAY_NOTIFY_BASE');
  checks.push({
    name: '回调地址',
    ok: /^https:\/\/[^/]+/.test(notify),
    detail: notify ? `${notify}/api/pay/notify/…` : '没填',
    hint: '必须是公网可达的 https 域名——回调打不进来就永远收不到"已支付"',
  });

  for (const ch of info.channels) {
    checks.push({
      name: ch.label,
      ok: ch.ready,
      detail: ch.ready ? '凭据齐全' : '缺少必填项',
      hint: ch.ready ? '还需要真实下单一次才能确认签名正确' : '',
    });
  }

  checks.push({
    name: '加密密钥',
    ok: hasKey(),
    detail: hasKey() ? '已设置 SECRET_KEY' : '未设置',
    hint: '没有它，数据库里的私钥等于明文',
  });

  json(res, 200, { provider: info.provider, live: info.live, checks });
}

/* 落地页要显示价格，但它是公开页面——不能要求登录。
   只回价格，不回任何用户数据。 */
export async function handlePricing(req, res) {
  json(res, 200, {
    plans: Object.values(PLANS).map((p) => ({
      key: p.key, label: p.label, price: p.price, credits: p.credits, note: p.note,
    })),
    packs: Object.values(PACKS).map((p) => ({
      key: p.key, label: p.label, price: p.price, credits: p.credits, pack: true,
      note: '不随月度清零。',
    })),
  });
}
