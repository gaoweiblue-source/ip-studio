/* 数据层：node:sqlite（Node 22 内置），零外部依赖 */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fromRoot } from './paths.js';

const DB_PATH = process.env.DB_PATH ? resolve(process.env.DB_PATH) : fromRoot('data/app.db');
mkdirSync(dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

/* 音频等附属文件跟数据库放一起，DB_PATH 换到哪它们就跟到哪 */
export const DATA_DIR = dirname(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    pass_hash   TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token       TEXT    PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL
  );

  /* 账号设定：一个账号 = 一套稳定的定位，其下的创作都继承它 */
  CREATE TABLE IF NOT EXISTS personas (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT    NOT NULL,
    platform       TEXT    NOT NULL,
    tone           TEXT    NOT NULL,
    content_focus  TEXT    NOT NULL DEFAULT '',
    audience       TEXT    NOT NULL DEFAULT '',
    problem        TEXT    NOT NULL DEFAULT '',
    notes          TEXT    NOT NULL DEFAULT '',
    /* 个人人设：博主本人的情况，决定第一人称的口吻与取材 */
    creator_age      TEXT  NOT NULL DEFAULT '',
    creator_gender   TEXT  NOT NULL DEFAULT '',
    creator_industry TEXT  NOT NULL DEFAULT '',
    creator_role     TEXT  NOT NULL DEFAULT '',
    creator_traits   TEXT  NOT NULL DEFAULT '',
    /* 语气学习与题材推荐的缓存 */
    style_digest     TEXT  NOT NULL DEFAULT '',
    style_updated_at TEXT  NOT NULL DEFAULT '',
    subject_ideas    TEXT  NOT NULL DEFAULT '[]',
    hotspot_json     TEXT  NOT NULL DEFAULT 'null',
    created_at     TEXT    NOT NULL,
    updated_at     TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_personas_user ON personas(user_id, id DESC);

  /* 内容栏目：一个账号下的几条内容线，比如「来时路」「生活日常」
     单独建表而不是塞进 personas 的 JSON 字段，是为了后面能给栏目挂自己的样本、推荐、配额 */
  CREATE TABLE IF NOT EXISTS sections (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id  INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    purpose     TEXT    NOT NULL DEFAULT '',
    guide       TEXT    NOT NULL DEFAULT '',
    fields_json TEXT    NOT NULL DEFAULT '[]',
    sort        INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_sections_persona ON sections(persona_id, sort, id);

  /* 语气样本：用户确认后喂给账号学习的成稿，蒸馏成 personas.style_digest */
  CREATE TABLE IF NOT EXISTS style_samples (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id  INTEGER NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    draft_id    INTEGER,
    title       TEXT    NOT NULL DEFAULT '',
    content     TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_samples_persona ON style_samples(persona_id, id DESC);

  /* 一次创作 = 一条 draft：题材 -> 三个方向 -> 选定方向 -> 完整文案 */
  CREATE TABLE IF NOT EXISTS drafts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    subject      TEXT    NOT NULL,
    platform     TEXT    NOT NULL,
    tone         TEXT    NOT NULL,
    audience     TEXT    NOT NULL DEFAULT '',
    keywords     TEXT    NOT NULL DEFAULT '',
    length       INTEGER NOT NULL DEFAULT 800,
    topics_json  TEXT    NOT NULL DEFAULT '[]',
    chosen       INTEGER,
    title        TEXT    NOT NULL DEFAULT '',
    content      TEXT    NOT NULL DEFAULT '',
    status       TEXT    NOT NULL DEFAULT 'topics',  -- topics | writing | done
    persona_id   INTEGER REFERENCES personas(id) ON DELETE SET NULL,
    persona_json TEXT    NOT NULL DEFAULT 'null',     -- 创作当时的账号设定快照
    hotspot_json TEXT    NOT NULL DEFAULT 'null',     -- 借势的热点（标题/链接/概要/蹭点）
    section_id   INTEGER REFERENCES sections(id) ON DELETE SET NULL,
    section_json TEXT    NOT NULL DEFAULT 'null',     -- 创作当时的栏目快照
    inputs_json  TEXT    NOT NULL DEFAULT 'null',     -- 作者为该栏目填的素材
    archived_at  TEXT    NOT NULL DEFAULT '',          -- 非空即已归档
    cues_json    TEXT    NOT NULL DEFAULT 'null',       -- 口播提示（语气/重读/停顿/表情/动作）
    variants_json TEXT   NOT NULL DEFAULT 'null',       -- 多平台版本：{平台key: {content, at}}
    illus_json   TEXT    NOT NULL DEFAULT 'null',       -- 图文配图：{版本key: {look, items[]}}
    created_at   TEXT    NOT NULL,
    updated_at   TEXT    NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_drafts_user ON drafts(user_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

/* 已有数据库的增量迁移 */
{
  const sectionCols = new Set(db.prepare('PRAGMA table_info(sections)').all().map((c) => c.name));
  if (sectionCols.size && !sectionCols.has('fields_json')) {
    db.exec("ALTER TABLE sections ADD COLUMN fields_json TEXT NOT NULL DEFAULT '[]'");
  }

  const personaCols = new Set(db.prepare('PRAGMA table_info(personas)').all().map((c) => c.name));
  for (const col of ['creator_age', 'creator_gender', 'creator_industry', 'creator_role', 'creator_traits',
                     'style_digest', 'style_updated_at']) {
    if (!personaCols.has(col)) db.exec(`ALTER TABLE personas ADD COLUMN ${col} TEXT NOT NULL DEFAULT ''`);
  }
  if (!personaCols.has('subject_ideas')) {
    db.exec("ALTER TABLE personas ADD COLUMN subject_ideas TEXT NOT NULL DEFAULT '[]'");
  }
  if (!personaCols.has('hotspot_json')) {
    db.exec("ALTER TABLE personas ADD COLUMN hotspot_json TEXT NOT NULL DEFAULT 'null'");
  }

  const cols = new Set(db.prepare('PRAGMA table_info(drafts)').all().map((c) => c.name));
  if (!cols.has('persona_id')) db.exec('ALTER TABLE drafts ADD COLUMN persona_id INTEGER REFERENCES personas(id) ON DELETE SET NULL');
  if (!cols.has('persona_json')) db.exec("ALTER TABLE drafts ADD COLUMN persona_json TEXT NOT NULL DEFAULT 'null'");
  if (!cols.has('hotspot_json')) db.exec("ALTER TABLE drafts ADD COLUMN hotspot_json TEXT NOT NULL DEFAULT 'null'");
  if (!cols.has('section_id')) db.exec('ALTER TABLE drafts ADD COLUMN section_id INTEGER REFERENCES sections(id) ON DELETE SET NULL');
  if (!cols.has('section_json')) db.exec("ALTER TABLE drafts ADD COLUMN section_json TEXT NOT NULL DEFAULT 'null'");
  if (!cols.has('inputs_json')) db.exec("ALTER TABLE drafts ADD COLUMN inputs_json TEXT NOT NULL DEFAULT 'null'");
  if (!cols.has('archived_at')) db.exec("ALTER TABLE drafts ADD COLUMN archived_at TEXT NOT NULL DEFAULT ''");
  if (!cols.has('cues_json')) db.exec("ALTER TABLE drafts ADD COLUMN cues_json TEXT NOT NULL DEFAULT 'null'");
  if (!cols.has('variants_json')) db.exec("ALTER TABLE drafts ADD COLUMN variants_json TEXT NOT NULL DEFAULT 'null'");
  if (!cols.has('illus_json')) db.exec("ALTER TABLE drafts ADD COLUMN illus_json TEXT NOT NULL DEFAULT 'null'");
}
db.exec(`
  /* 素材库：作者自己的真实经历、数据、案例、金句。
     产品里最硬的一条规则是"素材是全篇唯一可信的事实来源"，
     但素材原来每篇现填、填完就丢——存下来才能复利。 */
  CREATE TABLE IF NOT EXISTS materials (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id  INTEGER REFERENCES personas(id) ON DELETE CASCADE,
    kind        TEXT    NOT NULL DEFAULT '经历',
    title       TEXT    NOT NULL,
    body        TEXT    NOT NULL DEFAULT '',
    tags        TEXT    NOT NULL DEFAULT '',
    used_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT    NOT NULL,
    updated_at  TEXT    NOT NULL
  );

  /* 选题池：热点里看到的机会、推荐里想留的题材，不当场写也不丢。
     plan_date 空 = 只在池子里；有值 = 排到那天。 */
  CREATE TABLE IF NOT EXISTS topic_pool (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    persona_id  INTEGER REFERENCES personas(id) ON DELETE CASCADE,
    subject     TEXT    NOT NULL,
    note        TEXT    NOT NULL DEFAULT '',
    source      TEXT    NOT NULL DEFAULT '手动',
    plan_date   TEXT    NOT NULL DEFAULT '',
    draft_id    INTEGER REFERENCES drafts(id) ON DELETE SET NULL,
    status      TEXT    NOT NULL DEFAULT 'idea',
    created_at  TEXT    NOT NULL
  );
`);
db.exec(`
  /* 提示词变体：同一个功能可以挂多份 system，按权重分流。
     不改代码就能试新提示词，而且每次调用都记下用的哪一份——
     没有这个记录，A/B 就只是"换了个提示词然后感觉好像好点"。 */
  CREATE TABLE IF NOT EXISTS prompt_variants (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    feature    TEXT    NOT NULL,
    name       TEXT    NOT NULL,
    system     TEXT    NOT NULL,
    weight     INTEGER NOT NULL DEFAULT 1,
    active     INTEGER NOT NULL DEFAULT 0,
    note       TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL
  );

  /* eval 用例：固定的输入，用来横向比不同变体。
     input_json 存这个功能需要的全部输入（题材、账号设定快照…）。 */
  CREATE TABLE IF NOT EXISTS eval_cases (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    feature    TEXT    NOT NULL,
    title      TEXT    NOT NULL,
    input_json TEXT    NOT NULL DEFAULT '{}',
    created_at TEXT    NOT NULL
  );

  /* eval 结果：一个用例 × 一个变体 = 一条。
     scores_json 是确定性指标（字数、格式痕迹、护栏命中…），
     verdict 是盲测里人工选的胜者，两者分开存——一个是客观量，一个是主观判断。 */
  CREATE TABLE IF NOT EXISTS eval_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    batch       TEXT    NOT NULL,
    case_id     INTEGER NOT NULL REFERENCES eval_cases(id) ON DELETE CASCADE,
    variant_id  INTEGER,
    variant_name TEXT   NOT NULL DEFAULT '内置',
    output      TEXT    NOT NULL DEFAULT '',
    scores_json TEXT    NOT NULL DEFAULT '{}',
    ms          INTEGER NOT NULL DEFAULT 0,
    error       TEXT    NOT NULL DEFAULT '',
    created_at  TEXT    NOT NULL
  );

  /* 盲测：一个用例下两个变体两两对比，人工选一个。
     winner 存 variant_id，平局存 0。 */
  CREATE TABLE IF NOT EXISTS eval_votes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    batch      TEXT    NOT NULL,
    case_id    INTEGER NOT NULL,
    left_id    INTEGER NOT NULL,
    right_id   INTEGER NOT NULL,
    winner     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT    NOT NULL
  );
`);
/* 套餐与配额。
   托管密钥的 SaaS 里这不是商业功能，是安全底线——没有它，一个用户能把平台的 key 跑爆。 */
{
  const cols = new Set(db.prepare('PRAGMA table_info(users)').all().map((c) => c.name));
  if (!cols.has('plan')) db.exec("ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free'");
  // 当前计费周期（YYYY-MM）与本周期已用点数。跨月自动重置，不需要定时任务
  if (!cols.has('period')) db.exec("ALTER TABLE users ADD COLUMN period TEXT NOT NULL DEFAULT ''");
  if (!cols.has('used')) db.exec('ALTER TABLE users ADD COLUMN used INTEGER NOT NULL DEFAULT 0');
  // 加购包点数池：单独一个池子，不跟月度额度一起清零——买了就是买了（历史列名沿用 avatar_credits）
  if (!cols.has('avatar_credits')) db.exec('ALTER TABLE users ADD COLUMN avatar_credits INTEGER NOT NULL DEFAULT 0');
}

db.exec(`
  /* 订单。支付里唯一不能马虎的地方，几条硬规则都体现在字段上：
     - 订单是唯一真相：用户套餐由订单驱动，不由回调直接改
     - out_trade_no 是幂等键：回调会重复推送，靠它去重
     - amount 落库：回调里的金额必须和这里比对，不能信任回调带来的数字
     - raw 存回调原文：对账和纠纷时唯一的凭据 */
  CREATE TABLE IF NOT EXISTS orders (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    out_trade_no  TEXT    NOT NULL UNIQUE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind          TEXT    NOT NULL,              -- plan | pack
    sku           TEXT    NOT NULL,              -- pro / max / 加购包 key …
    amount        INTEGER NOT NULL,              -- 分。用整数，浮点算钱迟早出事
    channel       TEXT    NOT NULL,              -- wechat | alipay | mock
    status        TEXT    NOT NULL DEFAULT 'pending',  -- pending | paid | granted | closed
    trade_no      TEXT    NOT NULL DEFAULT '',   -- 渠道侧交易号
    paid_at       TEXT    NOT NULL DEFAULT '',
    granted_at    TEXT    NOT NULL DEFAULT '',
    raw           TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL
  );
`);
db.exec('CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, id DESC)');

db.exec(`
  /* 运行时配置。敏感项加密存（见 secrets.js），非敏感项明文。
     env 里配了的一律以 env 为准——生产可以完全锁死在环境变量里，后台只填空缺。 */
  CREATE TABLE IF NOT EXISTS settings (
    k          TEXT PRIMARY KEY,
    v          TEXT NOT NULL DEFAULT '',
    secret     INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    updated_by TEXT NOT NULL DEFAULT ''
  );
`);

db.exec('CREATE INDEX IF NOT EXISTS idx_variants_feature ON prompt_variants(feature, active)');
db.exec('CREATE INDEX IF NOT EXISTS idx_runs_batch ON eval_runs(batch, case_id)');

/* 调用时用了哪个变体——A/B 的全部意义都在这一列上 */
{
  const cols = new Set(db.prepare('PRAGMA table_info(usage_events)').all().map((c) => c.name));
  if (cols.size && !cols.has('variant')) db.exec("ALTER TABLE usage_events ADD COLUMN variant TEXT NOT NULL DEFAULT ''");
}

db.exec('CREATE INDEX IF NOT EXISTS idx_materials_persona ON materials(user_id, persona_id, id DESC)');
db.exec('CREATE INDEX IF NOT EXISTS idx_pool_persona ON topic_pool(user_id, persona_id, id DESC)');

/* 发布数据：回填之后才能知道"什么有效"，语气档案只学了"你怎么写" */
{
  const cols = new Set(db.prepare('PRAGMA table_info(drafts)').all().map((c) => c.name));
  if (!cols.has('metrics_json')) db.exec("ALTER TABLE drafts ADD COLUMN metrics_json TEXT NOT NULL DEFAULT 'null'");
  if (!cols.has('published_at')) db.exec("ALTER TABLE drafts ADD COLUMN published_at TEXT NOT NULL DEFAULT ''");
}

/* 计费量。原来只记了 tokens，配图的张数等非 token 单位全传 0，
   于是"花了多少钱"根本算不出来——先把量存下来。 */
{
  const cols = new Set(db.prepare('PRAGMA table_info(usage_events)').all().map((c) => c.name));
  if (cols.size && !cols.has('units')) db.exec('ALTER TABLE usage_events ADD COLUMN units REAL NOT NULL DEFAULT 0');
  if (cols.size && !cols.has('unit')) db.exec("ALTER TABLE usage_events ADD COLUMN unit TEXT NOT NULL DEFAULT ''");
}

db.exec('CREATE INDEX IF NOT EXISTS idx_drafts_persona ON drafts(user_id, persona_id, id DESC)');

const now = () => new Date().toISOString();

/* ---------- admins（独立于业务用户的管理员） ---------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    username    TEXT    NOT NULL UNIQUE,
    pass_hash   TEXT    NOT NULL,
    created_at  TEXT    NOT NULL,
    last_login  TEXT    NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    token       TEXT    PRIMARY KEY,
    admin_id    INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    expires_at  INTEGER NOT NULL
  );
`);

export const Admins = {
  count() {
    return db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  },
  create(username, passHash) {
    const info = db.prepare('INSERT INTO admins (username, pass_hash, created_at) VALUES (?, ?, ?)')
      .run(username, passHash, now());
    return this.byId(Number(info.lastInsertRowid));
  },
  byName(username) {
    return db.prepare('SELECT * FROM admins WHERE username = ?').get(username) || null;
  },
  byId(id) {
    return db.prepare('SELECT * FROM admins WHERE id = ?').get(id) || null;
  },
  touch(id) {
    db.prepare('UPDATE admins SET last_login = ? WHERE id = ?').run(now(), id);
  },
  list() {
    return db.prepare('SELECT id, username, created_at, last_login FROM admins ORDER BY id')
      .all().map((r) => ({ ...r }));
  },
};

export const AdminSessions = {
  create(token, adminId, ttlMs) {
    db.prepare('INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?, ?, ?)')
      .run(token, adminId, Date.now() + ttlMs);
  },
  admin(token) {
    if (!token) return null;
    const row = db.prepare('SELECT * FROM admin_sessions WHERE token = ?').get(token);
    if (!row) return null;
    if (Number(row.expires_at) < Date.now()) { this.destroy(token); return null; }
    return Admins.byId(row.admin_id);
  },
  destroy(token) {
    db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
  },
  sweep() {
    db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?').run(Date.now());
  },
};

/* ---------- usage_events（用量埋点） ---------- */
db.exec(`
  CREATE TABLE IF NOT EXISTS usage_events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER,
    feature       TEXT    NOT NULL,
    provider      TEXT    NOT NULL DEFAULT '',
    model         TEXT    NOT NULL DEFAULT '',
    variant       TEXT    NOT NULL DEFAULT '',
    ok            INTEGER NOT NULL DEFAULT 1,
    ms            INTEGER NOT NULL DEFAULT 0,
    input_tokens  INTEGER NOT NULL DEFAULT 0,
    output_tokens INTEGER NOT NULL DEFAULT 0,
    units         REAL    NOT NULL DEFAULT 0,
    unit          TEXT    NOT NULL DEFAULT '',
    error         TEXT    NOT NULL DEFAULT '',
    created_at    TEXT    NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_usage_time ON usage_events(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_usage_user ON usage_events(user_id, created_at DESC);
`);

if (!db.prepare('PRAGMA table_info(usage_events)').all().some(c => c.name === 'billing_policy')) {
  db.exec("ALTER TABLE usage_events ADD COLUMN billing_policy TEXT NOT NULL DEFAULT 'native'");
}
export const Usage = {
  record(e) {
    db.prepare(`
      INSERT INTO usage_events
        (user_id, feature, provider, model, ok, ms, input_tokens, output_tokens,
         units, unit, variant, error, created_at, billing_policy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      e.userId ?? null, e.feature, e.provider || '', e.model || '',
      e.ok ? 1 : 0, Math.round(e.ms || 0),
      e.inputTokens || 0, e.outputTokens || 0,
      // 计费量：配图按张、大模型按 token
      Number(e.units) || 0, e.unit || '',
      e.variant || '',
      String(e.error || '').slice(0, 200), now(), e.billingPolicy || 'native',
    );
  },

  totals(sinceIso) {
    return db.prepare(`
      SELECT COUNT(*) AS calls,
             SUM(ok) AS ok_calls,
             SUM(input_tokens) AS input_tokens,
             SUM(output_tokens) AS output_tokens,
             AVG(ms) AS avg_ms
      FROM usage_events WHERE created_at >= ?
    `).get(sinceIso);
  },

  /* 某个用户本周期的消耗明细。用户看的是"我的钱花在哪了"，
     所以按功能分组，不按模型——他不关心是 deepseek 还是万相。 */
  myUsage(userId, periodPrefix) {
    return db.prepare(`
      SELECT feature, COUNT(*) AS calls, SUM(units) AS units, MAX(unit) AS unit,
             SUM(input_tokens + output_tokens) AS tokens
      FROM usage_events
      WHERE user_id = ? AND ok = 1 AND created_at LIKE ? AND billing_policy = 'native'
      GROUP BY feature ORDER BY calls DESC
    `).all(userId, `${periodPrefix}%`).map((r) => ({ ...r }));
  },

  /* 按模型汇总计费量——算钱要落到具体型号上，功能名不够 */
  byModel(sinceIso) {
    return db.prepare(`
      SELECT feature, model, provider,
             COUNT(*) AS calls,
             SUM(units) AS units,
             MAX(unit) AS unit,
             SUM(input_tokens) AS input_tokens,
             SUM(output_tokens) AS output_tokens
      FROM usage_events WHERE created_at >= ? AND ok = 1
      GROUP BY feature, model ORDER BY calls DESC
    `).all(sinceIso).map((r) => ({ ...r }));
  },

  byFeature(sinceIso) {
    return db.prepare(`
      SELECT feature,
             COUNT(*) AS calls,
             SUM(ok) AS ok_calls,
             SUM(input_tokens) AS input_tokens,
             SUM(output_tokens) AS output_tokens,
             CAST(AVG(ms) AS INTEGER) AS avg_ms
      FROM usage_events WHERE created_at >= ?
      GROUP BY feature ORDER BY calls DESC
    `).all(sinceIso).map((r) => ({ ...r }));
  },

  byDay(sinceIso) {
    return db.prepare(`
      SELECT substr(created_at, 1, 10) AS day,
             COUNT(*) AS calls,
             SUM(input_tokens + output_tokens) AS tokens
      FROM usage_events WHERE created_at >= ?
      GROUP BY day ORDER BY day ASC
    `).all(sinceIso).map((r) => ({ ...r }));
  },

  byUser(sinceIso) {
    return db.prepare(`
      SELECT user_id,
             COUNT(*) AS calls,
             SUM(input_tokens + output_tokens) AS tokens,
             MAX(created_at) AS last_at
      FROM usage_events WHERE created_at >= ? AND user_id IS NOT NULL
      GROUP BY user_id
    `).all(sinceIso).map((r) => ({ ...r }));
  },

  recentErrors(limit = 20) {
    return db.prepare(`
      SELECT feature, model, error, created_at FROM usage_events
      WHERE ok = 0 ORDER BY id DESC LIMIT ?
    `).all(limit).map((r) => ({ ...r }));
  },
};

/* ---------- users ---------- */
export const Users = {
  create(username, passHash) {
    const info = db.prepare(
      'INSERT INTO users (username, pass_hash, created_at) VALUES (?, ?, ?)'
    ).run(username, passHash, now());
    return this.byId(Number(info.lastInsertRowid));
  },
  byName(username) {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) || null;
  },
  byId(id) {
    return db.prepare('SELECT * FROM users WHERE id = ?').get(id) || null;
  },
  /* 管理后台用：每个用户的资产盘点 */
  overview() {
    return db.prepare(`
      SELECT u.id, u.username, u.created_at,
             (SELECT COUNT(*) FROM personas p WHERE p.user_id = u.id) AS personas,
             (SELECT COUNT(*) FROM sections s WHERE s.user_id = u.id) AS sections,
             (SELECT COUNT(*) FROM drafts d WHERE d.user_id = u.id) AS drafts,
             (SELECT COUNT(*) FROM drafts d WHERE d.user_id = u.id AND d.status = 'done') AS done_drafts,
             (SELECT COUNT(*) FROM style_samples ss WHERE ss.user_id = u.id) AS samples,
             (SELECT MAX(d.updated_at) FROM drafts d WHERE d.user_id = u.id) AS last_draft_at
      FROM users u ORDER BY u.id ASC
    `).all().map((r) => ({ ...r }));
  },
};

/* ---------- sessions ---------- */
export const Sessions = {
  create(token, userId, ttlMs) {
    db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
      .run(token, userId, Date.now() + ttlMs);
  },
  user(token) {
    if (!token) return null;
    const row = db.prepare('SELECT * FROM sessions WHERE token = ?').get(token);
    if (!row) return null;
    if (Number(row.expires_at) < Date.now()) { this.destroy(token); return null; }
    return Users.byId(row.user_id);
  },
  destroy(token) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  },
  sweep() {
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
  },
};

/* ---------- personas（账号设定） ---------- */
export const PERSONA_FIELDS = [
  'name', 'platform', 'tone', 'content_focus', 'audience', 'problem', 'notes',
  'creator_age', 'creator_gender', 'creator_industry', 'creator_role', 'creator_traits',
];
const COLS = PERSONA_FIELDS.join(', ');
const PLACEHOLDERS = PERSONA_FIELDS.map(() => '?').join(', ');
const SETTERS = PERSONA_FIELDS.map((k) => `${k} = ?`).join(', ');

export const Personas = {
  create(userId, f) {
    const t = now();
    const info = db.prepare(`
      INSERT INTO personas (user_id, ${COLS}, created_at, updated_at)
      VALUES (?, ${PLACEHOLDERS}, ?, ?)
    `).run(userId, ...PERSONA_FIELDS.map((k) => f[k]), t, t);
    return this.byId(Number(info.lastInsertRowid), userId);
  },
  update(id, userId, f) {
    const changes = db.prepare(`
      UPDATE personas SET ${SETTERS}, updated_at = ? WHERE id = ? AND user_id = ?
    `).run(...PERSONA_FIELDS.map((k) => f[k]), now(), id, userId).changes;
    return changes ? this.byId(id, userId) : null;
  },
  byId(id, userId) {
    return db.prepare('SELECT * FROM personas WHERE id = ? AND user_id = ?').get(id, userId) || null;
  },
  list(userId) {
    return db.prepare(`
      SELECT p.*,
             (SELECT COUNT(*) FROM drafts d WHERE d.persona_id = p.id) AS draft_count,
             (SELECT COUNT(*) FROM style_samples s WHERE s.persona_id = p.id) AS sample_count
      FROM personas p WHERE p.user_id = ? ORDER BY p.id ASC
    `).all(userId).map((r) => ({ ...r }));
  },
  /* 题材推荐缓存：避免每次打开页面都去问一次模型 */
  setIdeas(id, userId, ideas) {
    db.prepare('UPDATE personas SET subject_ideas = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(ideas), id, userId);
  },
  ideas(id, userId) {
    const row = db.prepare('SELECT subject_ideas FROM personas WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) return null;
    try { const v = JSON.parse(row.subject_ideas); return Array.isArray(v) ? v : []; } catch { return []; }
  },
  setVoice(id, userId, voiceId) {
    db.prepare('UPDATE personas SET voice_id = ?, voice_at = ? WHERE id = ? AND user_id = ?')
      .run(voiceId, voiceId ? now() : '', id, userId);
  },
  setHotspots(id, userId, payload) {
    db.prepare('UPDATE personas SET hotspot_json = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(payload), id, userId);
  },
  hotspots(id, userId) {
    const row = db.prepare('SELECT hotspot_json FROM personas WHERE id = ? AND user_id = ?').get(id, userId);
    if (!row) return undefined;
    try { return JSON.parse(row.hotspot_json); } catch { return null; }
  },
  setDigest(id, userId, digest) {
    db.prepare('UPDATE personas SET style_digest = ?, style_updated_at = ? WHERE id = ? AND user_id = ?')
      .run(digest, now(), id, userId);
  },
  remove(id, userId) {
    return db.prepare('DELETE FROM personas WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};

/* ---------- sections（内容栏目） ---------- */
export const Sections = {
  create(userId, personaId, f) {
    const t = now();
    const next = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS n FROM sections WHERE persona_id = ?')
      .get(personaId).n;
    const info = db.prepare(`
      INSERT INTO sections (user_id, persona_id, name, purpose, guide, fields_json, sort, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, personaId, f.name, f.purpose, f.guide, JSON.stringify(f.fields || []), next, t, t);
    return this.byId(Number(info.lastInsertRowid), userId);
  },
  update(id, userId, f) {
    const changed = db.prepare(`
      UPDATE sections SET name = ?, purpose = ?, guide = ?, fields_json = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(f.name, f.purpose, f.guide, JSON.stringify(f.fields || []), now(), id, userId).changes;
    return changed ? this.byId(id, userId) : null;
  },
  byId(id, userId) {
    const row = db.prepare('SELECT * FROM sections WHERE id = ? AND user_id = ?').get(id, userId);
    return row ? hydrateSection(row) : null;
  },
  list(personaId, userId) {
    return db.prepare(`
      SELECT s.*, (SELECT COUNT(*) FROM drafts d WHERE d.section_id = s.id) AS draft_count
      FROM sections s WHERE s.persona_id = ? AND s.user_id = ?
      ORDER BY s.sort ASC, s.id ASC
    `).all(personaId, userId).map(hydrateSection);
  },
  remove(id, userId) {
    return db.prepare('DELETE FROM sections WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};

function hydrateSection(row) {
  let fields = [];
  try { const v = JSON.parse(row.fields_json); if (Array.isArray(v)) fields = v; } catch { /* 脏数据当空 */ }
  const { fields_json, ...rest } = row;
  return { ...rest, fields };
}

/* ---------- 运行时配置 ---------- */
export const Settings = {
  all() {
    return db.prepare('SELECT * FROM settings').all().map((r) => ({ ...r }));
  },
  get(k) {
    return db.prepare('SELECT v, secret FROM settings WHERE k = ?').get(k) || null;
  },
  set(k, v, secret, by) {
    db.prepare(`
      INSERT INTO settings (k, v, secret, updated_at, updated_by) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(k) DO UPDATE SET v = excluded.v, secret = excluded.secret,
        updated_at = excluded.updated_at, updated_by = excluded.updated_by
    `).run(k, v, secret ? 1 : 0, now(), by || '');
  },
  remove(k) {
    return db.prepare('DELETE FROM settings WHERE k = ?').run(k).changes > 0;
  },
};

/* ---------- 订单 ---------- */
export const Orders = {
  create(o) {
    db.prepare(`
      INSERT INTO orders (out_trade_no, user_id, kind, sku, amount, channel, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(o.no, o.userId, o.kind, o.sku, o.amount, o.channel, now());
    return this.byNo(o.no);
  },
  byNo(no) {
    return db.prepare('SELECT * FROM orders WHERE out_trade_no = ?').get(no) || null;
  },
  listByUser(userId, limit = 20) {
    return db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .all(userId, limit).map((r) => ({ ...r }));
  },
  /* 标记已支付。**只有 pending 能变 paid**——回调重复推送时第二次就不会命中，
     changes 为 0 说明已经处理过，调用方据此跳过发货。 */
  markPaid(no, tradeNo, raw) {
    return db.prepare(`
      UPDATE orders SET status = 'paid', trade_no = ?, paid_at = ?, raw = ?
      WHERE out_trade_no = ? AND status = 'pending'
    `).run(tradeNo || '', now(), String(raw || '').slice(0, 4000), no).changes > 0;
  },
  markGranted(no) {
    db.prepare("UPDATE orders SET status = 'granted', granted_at = ? WHERE out_trade_no = ?").run(now(), no);
  },
  close(no) {
    return db.prepare("UPDATE orders SET status = 'closed' WHERE out_trade_no = ? AND status = 'pending'")
      .run(no).changes > 0;
  },
};

/* ---------- 套餐与配额 ---------- */
export const Quota = {
  /* 读用户的配额状态，顺手处理跨月重置。
     用"读的时候比对周期"而不是定时任务——单机部署没有调度器，
     而且定时任务漏跑一次就会给用户多送一个月额度。 */
  state(userId, period) {
    const u = db.prepare('SELECT plan, period, used, avatar_credits FROM users WHERE id = ?').get(userId);
    if (!u) return null;
    if (u.period !== period) {
      db.prepare('UPDATE users SET period = ?, used = 0 WHERE id = ?').run(period, userId);
      return { ...u, period, used: 0 };
    }
    return u;
  },
  consume(userId, credits, fromPack = 0) {
    if (fromPack) db.prepare('UPDATE users SET avatar_credits = MAX(0, avatar_credits - ?) WHERE id = ?').run(fromPack, userId);
    if (credits) db.prepare('UPDATE users SET used = used + ? WHERE id = ?').run(credits, userId);
  },
  setPlan(userId, plan) {
    db.prepare('UPDATE users SET plan = ? WHERE id = ?').run(plan, userId);
  },
  addPack(userId, credits) {
    db.prepare('UPDATE users SET avatar_credits = avatar_credits + ? WHERE id = ?').run(credits, userId);
  },
};

/* ---------- prompt_variants / eval ---------- */
export const Variants = {
  list(feature) {
    const where = feature ? 'WHERE feature = ?' : '';
    return db.prepare(`SELECT * FROM prompt_variants ${where} ORDER BY feature, id`)
      .all(...(feature ? [feature] : [])).map((r) => ({ ...r }));
  },
  byId(id) {
    return db.prepare('SELECT * FROM prompt_variants WHERE id = ?').get(id) || null;
  },
  /* 生效中的变体。权重为 0 的等于关掉，但记录还在 */
  active(feature) {
    return db.prepare('SELECT * FROM prompt_variants WHERE feature = ? AND active = 1 AND weight > 0 ORDER BY id')
      .all(feature).map((r) => ({ ...r }));
  },
  create(v) {
    const info = db.prepare(`
      INSERT INTO prompt_variants (feature, name, system, weight, active, note, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(v.feature, v.name, v.system, v.weight ?? 1, v.active ? 1 : 0, v.note || '', now());
    return this.byId(Number(info.lastInsertRowid));
  },
  update(id, v) {
    db.prepare('UPDATE prompt_variants SET name = ?, system = ?, weight = ?, active = ?, note = ? WHERE id = ?')
      .run(v.name, v.system, v.weight ?? 1, v.active ? 1 : 0, v.note || '', id);
    return this.byId(id);
  },
  remove(id) {
    return db.prepare('DELETE FROM prompt_variants WHERE id = ?').run(id).changes > 0;
  },
};

export const Evals = {
  cases(feature) {
    const where = feature ? 'WHERE feature = ?' : '';
    return db.prepare(`SELECT * FROM eval_cases ${where} ORDER BY id DESC`)
      .all(...(feature ? [feature] : [])).map((r) => ({ ...r }));
  },
  caseById(id) {
    return db.prepare('SELECT * FROM eval_cases WHERE id = ?').get(id) || null;
  },
  addCase(c) {
    const info = db.prepare('INSERT INTO eval_cases (feature, title, input_json, created_at) VALUES (?, ?, ?, ?)')
      .run(c.feature, c.title, JSON.stringify(c.input || {}), now());
    return this.caseById(Number(info.lastInsertRowid));
  },
  removeCase(id) {
    return db.prepare('DELETE FROM eval_cases WHERE id = ?').run(id).changes > 0;
  },
  addRun(r) {
    const info = db.prepare(`
      INSERT INTO eval_runs (batch, case_id, variant_id, variant_name, output, scores_json, ms, error, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(r.batch, r.caseId, r.variantId ?? null, r.variantName || '内置',
      r.output || '', JSON.stringify(r.scores || {}), Math.round(r.ms || 0), r.error || '', now());
    return Number(info.lastInsertRowid);
  },
  runs(batch) {
    return db.prepare(`
      SELECT r.*, c.title AS case_title, c.feature
      FROM eval_runs r JOIN eval_cases c ON c.id = r.case_id
      WHERE r.batch = ? ORDER BY r.case_id, r.id
    `).all(batch).map((r) => ({ ...r }));
  },
  batches(limit = 20) {
    return db.prepare(`
      SELECT batch, MIN(created_at) AS at, COUNT(*) AS runs,
             COUNT(DISTINCT case_id) AS cases, COUNT(DISTINCT variant_name) AS variants
      FROM eval_runs GROUP BY batch ORDER BY at DESC LIMIT ?
    `).all(limit).map((r) => ({ ...r }));
  },
  vote(v) {
    db.prepare('INSERT INTO eval_votes (batch, case_id, left_id, right_id, winner, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(v.batch, v.caseId, v.leftId, v.rightId, v.winner || 0, now());
  },
  votes(batch) {
    return db.prepare('SELECT * FROM eval_votes WHERE batch = ?').all(batch).map((r) => ({ ...r }));
  },
};

/* ---------- materials（素材库） ---------- */
export const MATERIAL_KINDS = ['经历', '数据', '案例', '金句', '观察'];

export const Materials = {
  create(userId, personaId, m) {
    const t = now();
    const info = db.prepare(`
      INSERT INTO materials (user_id, persona_id, kind, title, body, tags, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, personaId, m.kind, m.title, m.body || '', m.tags || '', t, t);
    return this.byId(Number(info.lastInsertRowid), userId);
  },
  update(id, userId, m) {
    const changes = db.prepare(`
      UPDATE materials SET kind = ?, title = ?, body = ?, tags = ?, updated_at = ?
      WHERE id = ? AND user_id = ?
    `).run(m.kind, m.title, m.body || '', m.tags || '', now(), id, userId).changes;
    return changes ? this.byId(id, userId) : null;
  },
  byId(id, userId) {
    return db.prepare('SELECT * FROM materials WHERE id = ? AND user_id = ?').get(id, userId) || null;
  },
  list(userId, personaId) {
    return db.prepare(`
      SELECT * FROM materials WHERE user_id = ? AND persona_id IS ? ORDER BY id DESC
    `).all(userId, personaId ?? null).map((r) => ({ ...r }));
  },
  remove(id, userId) {
    return db.prepare('DELETE FROM materials WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
  /* 用过的记一笔——哪些素材真的被写进过稿子，界面上能看出来 */
  markUsed(ids, userId) {
    if (!ids.length) return;
    const stmt = db.prepare('UPDATE materials SET used_count = used_count + 1 WHERE id = ? AND user_id = ?');
    for (const id of ids) stmt.run(id, userId);
  },
};

/* ---------- topic_pool（选题池与排期） ---------- */
export const Pool = {
  create(userId, personaId, t) {
    const info = db.prepare(`
      INSERT INTO topic_pool (user_id, persona_id, subject, note, source, plan_date, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, personaId, t.subject, t.note || '', t.source || '手动', t.plan_date || '', now());
    return this.byId(Number(info.lastInsertRowid), userId);
  },
  byId(id, userId) {
    return db.prepare('SELECT * FROM topic_pool WHERE id = ? AND user_id = ?').get(id, userId) || null;
  },
  list(userId, personaId) {
    return db.prepare(`
      SELECT * FROM topic_pool WHERE user_id = ? AND persona_id IS ?
      ORDER BY (plan_date = '') ASC, plan_date ASC, id DESC
    `).all(userId, personaId ?? null).map((r) => ({ ...r }));
  },
  update(id, userId, patch) {
    const cur = this.byId(id, userId);
    if (!cur) return null;
    db.prepare('UPDATE topic_pool SET subject = ?, note = ?, plan_date = ?, status = ?, draft_id = ? WHERE id = ? AND user_id = ?')
      .run(patch.subject ?? cur.subject, patch.note ?? cur.note,
        patch.plan_date ?? cur.plan_date, patch.status ?? cur.status,
        patch.draft_id ?? cur.draft_id, id, userId);
    return this.byId(id, userId);
  },
  remove(id, userId) {
    return db.prepare('DELETE FROM topic_pool WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};

/* ---------- style_samples（语气样本） ---------- */
export const Samples = {
  create(userId, personaId, { draftId = null, title = '', content }) {
    const info = db.prepare(`
      INSERT INTO style_samples (user_id, persona_id, draft_id, title, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, personaId, draftId, title, content, now());
    return db.prepare('SELECT * FROM style_samples WHERE id = ?').get(Number(info.lastInsertRowid));
  },
  /* 列表默认不带正文，避免把全文塞进接口响应 */
  list(personaId, userId, { withContent = false, limit = 50 } = {}) {
    const cols = withContent ? '*' : 'id, draft_id, title, created_at, LENGTH(content) AS length';
    return db.prepare(`
      SELECT ${cols} FROM style_samples WHERE persona_id = ? AND user_id = ?
      ORDER BY id DESC LIMIT ?
    `).all(personaId, userId, limit).map((r) => ({ ...r }));
  },
  remove(id, userId) {
    return db.prepare('DELETE FROM style_samples WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};

/* ---------- drafts ---------- */
export const Drafts = {
  create(userId, f, persona = null, hotspot = null, section = null, inputs = null) {
    const t = now();
    const info = db.prepare(`
      INSERT INTO drafts (user_id, subject, platform, tone, audience, keywords, length,
                          topics_json, status, persona_id, persona_json, hotspot_json,
                          section_id, section_json, inputs_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, '[]', 'topics', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, f.subject, f.platform, f.tone, f.audience, f.keywords, f.length,
           persona?.id ?? null, JSON.stringify(persona), JSON.stringify(hotspot),
           section?.id ?? null, JSON.stringify(section), JSON.stringify(inputs), t, t);
    return this.byId(Number(info.lastInsertRowid), userId);
  },
  setTopics(id, userId, topics, persona) {
    db.prepare(`UPDATE drafts SET topics_json = ?, chosen = NULL, title = '', content = '',
                status = 'topics', persona_json = ?, updated_at = ? WHERE id = ? AND user_id = ?`)
      .run(JSON.stringify(topics), JSON.stringify(persona ?? null), now(), id, userId);
  },
  setContent(id, userId, { chosen, title, content, status }) {
    db.prepare(`UPDATE drafts SET chosen = ?, title = ?, content = ?, status = ?, updated_at = ?
                WHERE id = ? AND user_id = ?`)
      .run(chosen, title, content, status, now(), id, userId);
  },
  /* 用户在编辑器里手工改写后的保存 —— 正文变了，口播提示就作废 */
  saveContent(id, userId, content) {
    // 正文变了：口播提示、平台版本、配图都基于旧正文，一起作废
    return db.prepare(`UPDATE drafts SET content = ?, status = 'done',
                       cues_json = 'null', variants_json = 'null', illus_json = 'null', updated_at = ?
                       WHERE id = ? AND user_id = ?`)
      .run(content, now(), id, userId).changes > 0;
  },

  setCues(id, userId, cues) {
    db.prepare('UPDATE drafts SET cues_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(cues), now(), id, userId);
  },

  setIllus(id, userId, illus) {
    db.prepare('UPDATE drafts SET illus_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(illus), now(), id, userId);
  },

  setMetrics(id, userId, metrics, publishedAt) {
    db.prepare('UPDATE drafts SET metrics_json = ?, published_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(metrics), publishedAt || '', now(), id, userId);
  },

  /* 复盘用：只取已回填数据的稿子，带上分类维度 */
  withMetrics(userId, personaId) {
    const byPersona = personaId !== undefined && personaId !== null;
    return db.prepare(`
      SELECT id, subject, title, platform, section_id, topics_json, metrics_json, published_at, created_at
      FROM drafts
      WHERE user_id = ? AND metrics_json != 'null' ${byPersona ? 'AND persona_id = ?' : ''}
      ORDER BY published_at DESC, id DESC LIMIT 200
    `).all(...(byPersona ? [userId, personaId] : [userId])).map((r) => ({ ...r }));
  },

  setVariants(id, userId, variants) {
    db.prepare('UPDATE drafts SET variants_json = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(JSON.stringify(variants), now(), id, userId);
  },

  byId(id, userId) {
    const row = db.prepare('SELECT * FROM drafts WHERE id = ? AND user_id = ?').get(id, userId);
    return row ? hydrate(row) : null;
  },
  /* personaId: undefined = 全部；null = 未绑定账号的；数字 = 指定账号下的
     archived: false = 只看进行中（默认）；true = 只看已归档 */
  list(userId, { personaId, archived = false, limit = 200 } = {}) {
    const byPersona = personaId !== undefined;
    const sql = `
      SELECT id, subject, platform, tone, title, status, persona_id, section_id,
             archived_at, created_at, updated_at
      FROM drafts
      WHERE user_id = ?
        ${byPersona ? 'AND persona_id IS ?' : ''}
        AND archived_at ${archived ? '<> ' : '= '}''
      ORDER BY id DESC LIMIT ?
    `;
    const args = byPersona ? [userId, personaId, limit] : [userId, limit];
    return db.prepare(sql).all(...args).map((r) => ({ ...r }));
  },

  /* 两个视图各有多少条，用来在侧栏显示计数 */
  counts(userId, personaId) {
    const byPersona = personaId !== undefined;
    const sql = `
      SELECT
        SUM(CASE WHEN archived_at = '' THEN 1 ELSE 0 END) AS active,
        SUM(CASE WHEN archived_at <> '' THEN 1 ELSE 0 END) AS archived,
        SUM(CASE WHEN archived_at = '' AND status = 'done' THEN 1 ELSE 0 END) AS active_done
      FROM drafts WHERE user_id = ? ${byPersona ? 'AND persona_id IS ?' : ''}
    `;
    const row = db.prepare(sql).get(...(byPersona ? [userId, personaId] : [userId]));
    return { active: row.active || 0, archived: row.archived || 0, activeDone: row.active_done || 0 };
  },

  setArchived(id, userId, archived) {
    return db.prepare('UPDATE drafts SET archived_at = ?, updated_at = ? WHERE id = ? AND user_id = ?')
      .run(archived ? now() : '', now(), id, userId).changes > 0;
  },

  /* 批量归档：把某个范围内已完成的一次性收起来 */
  archiveDone(userId, personaId) {
    const byPersona = personaId !== undefined;
    const sql = `
      UPDATE drafts SET archived_at = ?, updated_at = ?
      WHERE user_id = ? ${byPersona ? 'AND persona_id IS ?' : ''}
        AND archived_at = '' AND status = 'done'
    `;
    const t = now();
    const args = byPersona ? [t, t, userId, personaId] : [t, t, userId];
    return db.prepare(sql).run(...args).changes;
  },
  /* 这个账号写过什么：题材 + 标题，用来让推荐避开重复 */
  usedSubjects(userId, personaId, limit = 60) {
    return db.prepare(`
      SELECT subject, title FROM drafts
      WHERE user_id = ? AND persona_id IS ? ORDER BY id DESC LIMIT ?
    `).all(userId, personaId, limit).map((r) => ({ ...r }));
  },
  remove(id, userId) {
    return db.prepare('DELETE FROM drafts WHERE id = ? AND user_id = ?').run(id, userId).changes > 0;
  },
};

function hydrate(row) {
  let topics = [];
  let persona = null;
  let hotspot = null;
  let section = null;
  let inputs = null;
  let cues = null;
  let variants = null;
  let illus = null;
  let metrics = null;
  try { topics = JSON.parse(row.topics_json); } catch { /* 容错：脏数据当作空 */ }
  try { persona = JSON.parse(row.persona_json); } catch { /* 同上 */ }
  try { hotspot = JSON.parse(row.hotspot_json); } catch { /* 同上 */ }
  try { section = JSON.parse(row.section_json); } catch { /* 同上 */ }
  try { inputs = JSON.parse(row.inputs_json); } catch { /* 同上 */ }
  try { cues = JSON.parse(row.cues_json); } catch { /* 同上 */ }
  try { variants = JSON.parse(row.variants_json); } catch { /* 同上 */ }
  try { metrics = JSON.parse(row.metrics_json); } catch { /* 同上 */ }
  try { illus = JSON.parse(row.illus_json); } catch { /* 同上 */ }
  const {
    topics_json, persona_json, hotspot_json, section_json,
    inputs_json, cues_json, variants_json, illus_json,
    metrics_json, research_json, user_id, ...rest
  } = row;
  return {
    ...rest, topics, persona, hotspot, section, inputs, cues, variants, illus, metrics,
    research: research_json ? JSON.parse(research_json) : null,
  };
}
