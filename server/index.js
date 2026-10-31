/* HTTP 服务：静态资源 + /api 路由。零框架依赖。 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { loadEnv } from './env.js';
import { fromRoot } from './paths.js';

loadEnv();

const { HttpError } = await import('./auth.js');
const R = await import('./routes.js');
const Research = await import('./research-routes.js');
const { providerInfo, setUsageSink } = await import('./llm.js');
const { DATA_DIR, Usage } = await import('./db.js');

// 每次模型调用落一条用量记录，供管理后台统计
setUsageSink((e) => {
  try { Usage.record(e); } catch (err) { console.warn('[usage]', err.message); }
});

const PUBLIC_DIR = fromRoot('public');
const PORT = Number(process.env.PORT) || 5177;
const MAX_BODY = 256 * 1024;

const ROUTES = [
  ['GET', /^\/api\/personas\/(?<id>\d+)\/writing-skill$/, Research.handleSkillGet],
  ['PUT', /^\/api\/personas\/(?<id>\d+)\/writing-skill$/, Research.handleSkillSave],
  ['POST', /^\/api\/personas\/(?<id>\d+)\/research-import$/, Research.handleImport],
  ['POST', /^\/api\/personas\/(?<id>\d+)\/research-generate$/, Research.handleGenerate],
  ['GET', /^\/api\/research-sources\/(?<id>\d+)$/, Research.handleSource],
  ['GET', /^\/api\/research-sources\/(?<id>\d+)\/original$/, Research.handleOriginal],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/research-assist$/, Research.handleResearchAssist],
  ['PUT', /^\/api\/drafts\/(?<id>\d+)\/research-title$/, Research.handleResearchTitle],
  ['POST', /^\/api\/auth\/register$/, R.handleRegister],
  ['POST', /^\/api\/auth\/login$/, R.handleLogin],
  ['POST', /^\/api\/auth\/logout$/, R.handleLogout],
  ['GET', /^\/api\/me$/, R.handleMe],
  ['GET', /^\/api\/meta$/, R.handleMeta],
  ['GET', /^\/api\/personas$/, R.handlePersonaList],
  ['POST', /^\/api\/personas$/, R.handlePersonaCreate],
  ['PUT', /^\/api\/personas\/(?<id>\d+)$/, R.handlePersonaUpdate],
  ['DELETE', /^\/api\/personas\/(?<id>\d+)$/, R.handlePersonaDelete],
  ['GET', /^\/api\/personas\/(?<id>\d+)\/sections$/, R.handleSectionList],
  ['POST', /^\/api\/personas\/(?<id>\d+)\/sections$/, R.handleSectionCreate],
  ['PUT', /^\/api\/personas\/(?<id>\d+)\/sections\/(?<sectionId>\d+)$/, R.handleSectionUpdate],
  ['DELETE', /^\/api\/personas\/(?<id>\d+)\/sections\/(?<sectionId>\d+)$/, R.handleSectionDelete],
  ['GET', /^\/api\/personas\/(?<id>\d+)\/samples$/, R.handleSampleList],
  ['POST', /^\/api\/personas\/(?<id>\d+)\/samples$/, R.handleSampleCreate],
  ['DELETE', /^\/api\/personas\/(?<id>\d+)\/samples\/(?<sampleId>\d+)$/, R.handleSampleDelete],
  ['POST', /^\/api\/personas\/(?<id>\d+)\/digest$/, R.handleDigestRebuild],
  ['GET', /^\/api\/admin\/session$/, R.handleAdminSession],
  ['POST', /^\/api\/admin\/setup$/, R.handleAdminSetup],
  ['POST', /^\/api\/admin\/login$/, R.handleAdminLogin],
  ['POST', /^\/api\/admin\/logout$/, R.handleAdminLogout],
  ['GET', /^\/api\/admin\/overview$/, R.handleAdminOverview],
  ['GET', /^\/api\/admin\/prompts$/, R.handleAdminPrompts],
  ['GET', /^\/api\/admin\/settings$/, R.handleSettingsList],
  ['POST', /^\/api\/admin\/settings$/, R.handleSettingsSave],
  ['GET', /^\/api\/admin\/settings\/check$/, R.handleSettingsCheck],
  ['GET', /^\/api\/admin\/variants$/, R.handlePromptVariantList],
  ['POST', /^\/api\/admin\/variants$/, R.handlePromptVariantSave],
  ['PUT', /^\/api\/admin\/variants\/(?<vid>\d+)$/, R.handlePromptVariantSave],
  ['DELETE', /^\/api\/admin\/variants\/(?<vid>\d+)$/, R.handlePromptVariantDelete],
  ['GET', /^\/api\/admin\/eval\/cases$/, R.handleEvalCases],
  ['POST', /^\/api\/admin\/eval\/cases$/, R.handleEvalCaseAdd],
  ['DELETE', /^\/api\/admin\/eval\/cases\/(?<cid>\d+)$/, R.handleEvalCaseDelete],
  ['POST', /^\/api\/admin\/eval\/run$/, R.handleEvalRun],
  ['GET', /^\/api\/admin\/eval\/batches$/, R.handleEvalBatches],
  ['GET', /^\/api\/admin\/eval\/(?<batch>[\w-]+)$/, R.handleEvalResult],
  ['POST', /^\/api\/admin\/eval\/(?<batch>[\w-]+)\/vote$/, R.handleEvalVote],
  ['GET', /^\/api\/hotspots$/, R.handleBoards],
  ['GET', /^\/api\/personas\/(?<id>\d+)\/hotspots$/, R.handleHotspotRead],
  ['POST', /^\/api\/personas\/(?<id>\d+)\/hotspots$/, R.handleHotspotAnalyze],
  ['GET', /^\/api\/personas\/(?<id>\d+)\/subjects$/, R.handleSubjectList],
  ['POST', /^\/api\/personas\/(?<id>\d+)\/subjects$/, R.handleSubjectGenerate],
  ['POST', /^\/api\/drafts\/topics$/, R.handleTopics],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/topics$/, R.handleRetopics],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/content$/, R.handleContent],
  ['PUT', /^\/api\/drafts\/(?<id>\d+)\/content$/, R.handleSaveContent],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/assist$/, R.handleAssist],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/review$/, R.handleReview],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/cues$/, R.handleCues],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/variants$/, R.handleVariant],
  ['PUT', /^\/api\/drafts\/(?<id>\d+)\/variants\/(?<platform>\w+)$/, R.handleVariantSave],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/illus$/, R.handleIllus],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/illus\/(?<i>\d+)\/image$/, R.handleIllusImage],
  ['DELETE', /^\/api\/drafts\/(?<id>\d+)\/variants\/(?<platform>\w+)$/, R.handleVariantDelete],
  ['GET', /^\/api\/images$/, R.handleImageInfo],
  ['GET', /^\/api\/prompt-docs$/, R.handlePromptDocs],
  ['GET', /^\/api\/personas\/(?<id>\d+)\/materials$/, R.handleMaterialList],
  ['POST', /^\/api\/personas\/(?<id>\d+)\/materials$/, R.handleMaterialCreate],
  ['PUT', /^\/api\/materials\/(?<mid>\d+)$/, R.handleMaterialUpdate],
  ['DELETE', /^\/api\/materials\/(?<mid>\d+)$/, R.handleMaterialDelete],
  ['GET', /^\/api\/pool$/, R.handlePoolList],
  ['POST', /^\/api\/pool$/, R.handlePoolCreate],
  ['PUT', /^\/api\/pool\/(?<pid>\d+)$/, R.handlePoolUpdate],
  ['DELETE', /^\/api\/pool\/(?<pid>\d+)$/, R.handlePoolDelete],
  ['GET', /^\/api\/metrics$/, R.handleMetricsMeta],
  ['GET', /^\/api\/pricing$/, R.handlePricing],
  ['GET', /^\/api\/plan$/, R.handlePlanInfo],
  ['POST', /^\/api\/plan$/, R.handlePlanChange],
  ['GET', /^\/api\/pay$/, R.handlePayInfo],
  ['POST', /^\/api\/pay\/order$/, R.handleOrderCreate],
  ['GET', /^\/api\/pay\/order\/(?<no>\w+)$/, R.handleOrderStatus],
  ['POST', /^\/api\/pay\/notify\/(?<channel>\w+)$/, R.handlePayNotify],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/metrics$/, R.handleMetricsSave],
  ['GET', /^\/api\/insights$/, R.handleReview2],
  ['GET', /^\/api\/drafts$/, R.handleList],
  ['GET', /^\/api\/drafts\/(?<id>\d+)$/, R.handleGet],
  ['POST', /^\/api\/drafts\/(?<id>\d+)\/archive$/, R.handleArchive],
  ['POST', /^\/api\/drafts\/archive-done$/, R.handleArchiveDone],
  ['DELETE', /^\/api\/drafts\/(?<id>\d+)$/, R.handleDelete],
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const path = url.pathname;

  if (path.startsWith('/image/')) {
    await serveOwned(path, '/image/', 'images', req, res);
    return;
  }

  if (path.startsWith('/api/')) {
    const match = ROUTES.find(([method, re]) => method === req.method && re.test(path));
    if (!match) return R.json(res, 404, { error: '接口不存在' });

    const params = path.match(match[1]).groups || {};
    try {
      // 支付回调要原文验签，不能先被 JSON.parse 吃掉
      const raw = req.method === 'POST' && /^\/api\/pay\/notify\//.test(path);
      const upload = req.method === 'POST' && /^\/api\/personas\/\d+\/research-import$/.test(path);
      const body = raw || req.method === 'GET' || req.method === 'DELETE' ? {} : await readJSON(req, upload ? 7 * 1024 * 1024 : MAX_BODY);
      await match[2](req, res, body, params, url);
    } catch (err) {
      // QuotaError 自带 402；别把它当 500，前端要靠状态码识别"该升级了"
      const status = err instanceof HttpError ? err.status : (err?.status || 500);
      if (status >= 500) console.error('[api]', path, err);
      if (res.headersSent) { res.end(); return; }
      R.json(res, status, { error: R.describe(err), ...(err?.info ? { quota: err.info } : {}) });
    }
    return;
  }

  /* 根路径按登录状态分流：没登录看落地页，登录了直接进应用。
     用 cookie 在服务端判断而不是前端跳转——前端跳会先闪一下落地页，
     每天用的人每天看一次那个闪烁。 */
  if (path === '/') {
    const { currentUser } = await import('./auth.js');
    await serveStatic(currentUser(req) ? '/index.html' : '/landing.html', res);
    return;
  }

  await serveStatic(path, res);
});

async function readJSON(req, maxBytes = MAX_BODY) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw new HttpError(413, '请求体过大，请拆分文件或缩短输入后重试。');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new HttpError(400, '请求体不是合法 JSON'); }
}

/* 用户自己的媒体文件：路径里的 owner 必须就是当前登录用户，别人的文件一律 403 */
const MEDIA_TYPES = {
  wav: 'audio/wav', mp3: 'audio/mpeg',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  bmp: 'image/bmp', svg: 'image/svg+xml',
  mp4: 'video/mp4', webm: 'video/webm',
};

async function serveOwned(path, prefix, dir, req, res) {
  const { currentUser } = await import('./auth.js');
  const user = currentUser(req);
  if (!user) { res.writeHead(401).end('Unauthorized'); return; }

  const rel = decodeURIComponent(path.slice(prefix.length));   // 查询串已被 URL 解析剥掉
  const [owner, name] = rel.split('/');
  if (String(owner) !== String(user.id) || !/^[\w.-]+$/.test(name || '')) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  try {
    const data = await readFile(join(DATA_DIR, dir, String(user.id), name));
    res.writeHead(200, {
      'Content-Type': MEDIA_TYPES[name.split('.').pop()] || 'application/octet-stream',
      'Content-Length': data.length,
      'Cache-Control': 'private, max-age=3600',
    });
    res.end(data);
  } catch {
    res.writeHead(404).end('Not Found');
  }
}

async function serveStatic(path, res) {
  // 后台和提示词说明书都是独立入口，不走单页应用那套回落
  if (path === '/admin' || path === '/admin/') path = '/admin.html';
  if (path === '/prompts' || path === '/prompts/') path = '/prompts.html';
  if (path === '/app' || path === '/app/') path = '/index.html';
  // 营销落地页。走单独入口，投放链接指这里；/ 上那版是产品说明，两套动线互不影响
  if (path === '/start' || path === '/start/') path = '/promo.html';

  const rel = normalize(path === '/' ? '/index.html' : path).replace(/^(\.\.[/\\])+/, '');
  const file = join(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403).end('Forbidden'); return; }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  } catch {
    // 单页应用：未知路径回落到首页
    try {
      const html = await readFile(join(PUBLIC_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'] });
      res.end(html);
    } catch {
      res.writeHead(404).end('Not Found');
    }
  }
}

server.listen(PORT, () => {
  const info = providerInfo();
  console.log(`\n  文案工坊 已启动  →  http://localhost:${PORT}`);
  console.log(`  模型通道：${info.label}${info.live ? `（${info.model}）` : ' —— 复制 .env.example 为 .env 并填入密钥即可接入真实模型'}\n`);
});
