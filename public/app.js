/* 前端逻辑：登录 → 简报 → 三个方向 → 流式成稿 → 历史 */
import { initResearch, assistSnapshotValid } from './research.js';
import { buildSelectionMap, findRawSelection } from './selection-map.js';
import { variantIsStale } from './content-fingerprint.js';

const $ = (id) => document.getElementById(id);
const el = {
  auth: $('authScreen'), app: $('app'), authForm: $('authForm'), authTabs: $('authTabs'),
  authError: $('authError'), authSubmit: $('authSubmit'), userName: $('userName'),
  logout: $('logoutBtn'), llmChip: $('llmChip'), history: $('history'), newBtn: $('newBtn'),
  briefForm: $('briefForm'), briefHint: $('briefHint'), topicsBtn: $('topicsBtn'),
  platformSel: $('platformSel'), toneSel: $('toneSel'),
  topicsCard: $('topicsCard'), topics: $('topics'), retopicsBtn: $('retopicsBtn'),
  contentCard: $('contentCard'), content: $('content'), contentTitle: $('contentTitle'),
  counter: $('counter'), copyBtn: $('copyBtn'), downloadBtn: $('downloadBtn'),
  steps: $('steps'), toast: $('toast'), briefCard: $('briefCard'), inheritNote: $('inheritNote'),
  personaList: $('personaList'), personaMoreBtn: $('personaMoreBtn'), personaSummary: $('personaSummary'),
  newPersonaBtn: $('newPersonaBtn'),
  personaModal: $('personaModal'), personaForm: $('personaForm'), personaError: $('personaError'),
  personaModalTitle: $('personaModalTitle'), personaDeleteBtn: $('personaDeleteBtn'),
  accountNav: $('accountNav'), personaSaveHint: $('personaSaveHint'),
  personaCancelBtn: $('personaCancelBtn'), personaCloseBtn: $('personaCloseBtn'),
  personaSaveBtn: $('personaSaveBtn'),
  personaPlatform: $('personaPlatform'), personaTone: $('personaTone'),
  onboardCard: $('onboardCard'), onboardBtn: $('onboardBtn'), skipOnboardBtn: $('skipOnboardBtn'),
  editor: $('editor'), editorBar: $('editorBar'),
  cuesPane: $('cuesPane'), cuesOverall: $('cuesOverall'), cueList: $('cueList'),
  cuesRunBtn: $('cuesRunBtn'), copyCuesBtn: $('copyCuesBtn'), prompterBtn: $('prompterBtn'),
  matKind: $('matKind'), matTitle: $('matTitle'), matBody: $('matBody'), matTags: $('matTags'),
  matSaveBtn: $('matSaveBtn'), matList: $('matList'), matHint: $('matHint'), matError: $('matError'),
  illusBtn: $('illusBtn'), illusBar: $('illusBar'), illusChip: $('illusChip'),
  illusHint: $('illusHint'), illusList: $('illusList'),
  illusPlanBtn: $('illusPlanBtn'), illusRunBtn: $('illusRunBtn'),
  briefCard: $('briefCard'), main: $('main'),
  creditChip: $('creditChip'), planModal: $('planModal'), planClose: $('planClose'),
  planPeriod: $('planPeriod'), planNow: $('planNow'), planBreakdown: $('planBreakdown'),
  planCards: $('planCards'), planNote: $('planNote'),
  payBox: $('payBox'), payTitle: $('payTitle'), payCancel: $('payCancel'), payQr: $('payQr'),
  payChannels: $('payChannels'), payHint: $('payHint'),
  poolBox: $('poolBox'), poolNote: $('poolNote'), poolToggle: $('poolToggle'), poolList: $('poolList'),
  metricsModal: $('metricsModal'), metricsClose: $('metricsClose'), metricsDate: $('metricsDate'),
  metricsFields: $('metricsFields'), metricsNote: $('metricsNote'), metricsSave: $('metricsSave'),
  insightsModal: $('insightsModal'), insightsClose: $('insightsClose'),
  insightsBody: $('insightsBody'), insightsNote: $('insightsNote'), insightsLink: $('insightsLink'), headStick: document.querySelector('.head-stick'),
  editBtn: $('editBtn'), backReadBtn: $('backReadBtn'), modeNow: $('modeNow'), toolHint: $('toolHint'),
  confirmBtn: $('confirmBtn'), confirmMenu: $('confirmMenu'),
  exportBtn: $('exportBtn'), exportMenu: $('exportMenu'), copyHint: $('copyHint'),
  multiBtn: $('multiBtn'), multiBar: $('multiBar'), multiPick: $('multiPick'),
  multiHint: $('multiHint'), multiRunBtn: $('multiRunBtn'), verTabs: $('verTabs'),
  prompter: $('prompter'), pStage: $('pStage'), pScroll: $('pScroll'), pBody: $('pBody'),
  pPlay: $('pPlay'), pSpeedVal: $('pSpeedVal'), pSizeVal: $('pSizeVal'), pProgress: $('pProgress'),
  pCues: $('pCues'), pMirror: $('pMirror'), pRestart: $('pRestart'), pClose: $('pClose'),
  saveBtn: $('saveBtn'), saveState: $('saveState'), learnBtn: $('learnBtn'),
  reviewBtn: $('reviewBtn'), reviewBox: $('reviewBox'), reviewVerdict: $('reviewVerdict'),
  reviewSummary: $('reviewSummary'), reviewList: $('reviewList'),
  reviewApplyAll: $('reviewApplyAll'), reviewClose: $('reviewClose'),
  reviewFlags: $('reviewFlags'), reviewRisk: $('reviewRisk'),
  selMenu: $('selMenu'), slashMenu: $('slashMenu'), slashItems: $('slashItems'), slashInput: $('slashInput'),
  assistPop: $('assistPop'), assistTitle: $('assistTitle'), assistBody: $('assistBody'),
  assistClose: $('assistClose'), assistRetry: $('assistRetry'),
  assistInsert: $('assistInsert'), assistReplace: $('assistReplace'),
  ideas: $('ideas'), ideasList: $('ideasList'), ideasRefresh: $('ideasRefresh'), ideasNote: $('ideasNote'),
  hotRef: $('hotRef'),
  historyFilter: $('historyFilter'), cntActive: $('cntActive'), cntArchived: $('cntArchived'),
  historyFoot: $('historyFoot'), archiveDoneBtn: $('archiveDoneBtn'),
  sectionPick: $('sectionPick'), sectionChips: $('sectionChips'),
  sectionModal: $('sectionModal'), sectionModalClose: $('sectionModalClose'),
  sectionModalSub: $('sectionModalSub'), manageSectionsBtn: $('manageSectionsBtn'),
  sectionList: $('sectionList'), sectionPreset: $('sectionPreset'),
  sectionAddBtn: $('sectionAddBtn'), sectionForm: $('sectionForm'), sectionName: $('sectionName'),
  sectionPurpose: $('sectionPurpose'), sectionGuide: $('sectionGuide'), sectionError: $('sectionError'),
  fieldRows: $('fieldRows'), fieldAddBtn: $('fieldAddBtn'), sectionInputs: $('sectionInputs'),
  sectionSaveBtn: $('sectionSaveBtn'), sectionCancelBtn: $('sectionCancelBtn'),
  inheritRow: $('inheritRow'), inheritFacts: $('inheritFacts'),
  editParamsBtn: $('editParamsBtn'), paramGrid: $('paramGrid'),
  paramReset: $('paramReset'), resetParamsBtn: $('resetParamsBtn'),
  viewNav: $('viewNav'), writeView: $('writeView'), hotView: $('hotView'),
  hotRun: $('hotRun'), hotMeta: $('hotMeta'), hotSources: $('hotSources'),
  hotMatches: $('hotMatches'), hotIntro: $('hotIntro'),
  boardList: $('boardList'), boardFilter: $('boardFilter'), boardRefresh: $('boardRefresh'),
  manualInput: $('manualInput'), manualRun: $('manualRun'),
  styleSection: $('styleSection'), sampleList: $('sampleList'), digestBox: $('digestBox'),
  rebuildDigestBtn: $('rebuildDigestBtn'), styleHint: $('styleHint'),
};

const state = {
  user: null, meta: null, draft: null, streaming: false, busy: false,
  personas: [], personaId: null, editingId: null, skipOnboard: false,
  mode: 'read', dirty: false, assist: null, ideaFailed: new Set(),
  view: 'write', boards: null, paramsUnlocked: false,
  sections: [], sectionId: null, editingSection: null, presets: [], sectionPersonaId: null,
  showArchived: false, counts: { active: 0, archived: 0, activeDone: 0 },
};

const currentPersona = () => state.personas.find((p) => p.id === state.personaId) || null;
const researchUi = initResearch({ state, api, setDraft, loadHistory, toast, currentPersona, esc,
  ensureSaved: async () => { await flushSave(); return !saving && !state.dirty; },
  canSwitchDraft: () => !saving && !state.dirty,
});

const PERSONA_FIELDS = [
  'name', 'platform', 'tone', 'content_focus', 'audience', 'problem', 'notes',
  'creator_age', 'creator_gender', 'creator_industry', 'creator_role', 'creator_traits',
];

/* 个人人设的一行摘要：32 岁 · 女 · 互联网 / 产品经理 */
function creatorLine(p) {
  const age = String(p.creator_age || '').trim();
  const job = [p.creator_industry, p.creator_role].filter(Boolean).join(' / ');
  return [age ? (/^\d+$/.test(age) ? `${age} 岁` : age) : '', p.creator_gender, job]
    .filter(Boolean).join(' · ');
}

/* ---------------- 网络 ---------------- */
async function api(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 402 = 额度/套餐拦下来了。这一刻正是最愿意付费的时候，
    // 所以不只是抛错，还广播出去把用量面板顶到人面前
    if (res.status === 402) {
      window.dispatchEvent(new CustomEvent('cw-quota', { detail: { message: data.error, quota: data.quota } }));
    }
    throw new Error(data.error || `请求失败（${res.status}）`);
  }
  // 花过钱的请求顺手刷新余额，不用等下次开面板
  if (options.method && options.method !== 'GET') loadPlan?.();
  return data;
}

/* ---------------- 启动 ---------------- */
(async function boot() {
  // 从落地页带 ?signup=1 过来的，直接停在注册页
  if (new URLSearchParams(location.search).get('signup')) {
    document.querySelector('#authTabs [data-mode="register"]')?.click();
  }
  const [{ user }, meta] = await Promise.all([api('/me'), api('/meta')]);
  state.meta = meta;
  fillSelects(meta);
  showLlm(meta.llm);
  user ? enterApp(user) : el.auth.classList.remove('hidden');
})().catch((e) => toast(e.message));

function fillSelects({ platforms, tones }) {
  const platformOpts = platforms
    .map((p) => `<option value="${p.key}" data-length="${p.length}">${p.label}</option>`).join('');
  const toneOpts = tones
    .map((t) => `<option value="${esc(t.key)}" title="${esc(t.hint)}">${esc(t.key)}</option>`).join('');
  el.platformSel.innerHTML = platformOpts;
  el.personaPlatform.innerHTML = platformOpts;
  el.toneSel.innerHTML = toneOpts;
  el.personaTone.innerHTML = toneOpts;
  syncLength();
  el.platformSel.addEventListener('change', syncLength);
}

function syncLength() {
  const opt = el.platformSel.selectedOptions[0];
  if (opt) el.briefForm.length.value = opt.dataset.length;
}

function showLlm(llm) {
  el.llmChip.textContent = llm.live ? `${llm.label} · ${llm.model}` : llm.label;
  el.llmChip.classList.toggle('warn', !llm.live);
  el.llmChip.title = llm.live
    ? `当前模型通道：${llm.provider} / ${llm.model}`
    : '未检测到模型密钥，当前为演示模式：流程完整，内容是本地模板。在 .env 中配置密钥后自动切换。';
}

/* ---------------- 登录 / 注册 ---------------- */
let authMode = 'login';

el.authTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (!tab) return;
  authMode = tab.dataset.mode;
  [...el.authTabs.children].forEach((t) => t.classList.toggle('active', t === tab));
  el.authSubmit.textContent = authMode === 'login' ? '登录' : '注册并进入';
  el.authForm.password.autocomplete = authMode === 'login' ? 'current-password' : 'new-password';
  el.authError.textContent = '';
});

el.authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.authError.textContent = '';
  const fd = new FormData(el.authForm);
  await busy(el.authSubmit, async () => {
    try {
      const { user } = await api(`/auth/${authMode}`, {
        method: 'POST',
        body: { username: fd.get('username'), password: fd.get('password') },
      });
      el.auth.classList.add('hidden');
      el.authForm.reset();
      enterApp(user);
    } catch (err) {
      el.authError.textContent = err.message;
    }
  });
});

el.logout.addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST' });
  location.reload();
});

async function enterApp(user) {
  state.user = user;
  el.userName.textContent = user.username;
  el.app.classList.remove('hidden');
  await loadPersonas();
  applyPersonaDefaults();
  loadSections(state.personaId);
  loadHistory();
  loadIdeas();
  loadPool();          // 侧栏一进来就该看到攒了多少选题
  loadPlan();
}

/* ---------------- 账号设定 ---------------- */
/* 刷新后停在原来的账号。不记的话每次回来都跳回第一个，
   多账号的人一刷新就得重新选，还容易在错的账号下开始写。 */
const PERSONA_KEY = 'lastPersona';
const rememberPersona = () => {
  try { localStorage.setItem(PERSONA_KEY, state.personaId == null ? '' : String(state.personaId)); } catch { /* 隐私模式 */ }
};

async function loadPersonas(preferId) {
  const { personas } = await api('/personas');
  state.personas = personas;
  if (preferId !== undefined) state.personaId = preferId;
  else if (!personas.some((p) => p.id === state.personaId)) {
    let saved;
    try { saved = localStorage.getItem(PERSONA_KEY); } catch { saved = null; }
    // 空串是"全部创作"，和"没存过"要分开；存的账号可能已经被删了，删了就回落到第一个
    const hit = saved === '' ? null
      : saved != null && personas.some((p) => p.id === Number(saved)) ? Number(saved)
        : undefined;
    state.personaId = hit === undefined ? (personas[0]?.id ?? null) : hit;
  }
  rememberPersona();
  renderPersonaBar();
}

function renderPersonaBar() {
  const list = state.personas;
  const p = currentPersona();

  // 头像：拿名字第一个字做字母标
  const avatarOf = (x) => `<span class="persona-avatar">${esc(x.name?.[0] || '·')}</span>`;

  const row = (x) => {
    const on = x.id === state.personaId;
    return `<button type="button" class="persona-row ${on ? 'on' : ''}" data-persona="${x.id}">
      ${avatarOf(x)}
      <span class="persona-name">
        <b>${esc(x.name)}</b>
        <span class="persona-focus"><span class="pf-tag">${esc(platformLabel(x.platform))}</span>${
  on ? esc(x.content_focus || '') : ''}</span>
      </span>
      ${on ? '<span class="persona-gear" data-edit="1" title="编辑账号设定">⚙</span>' : ''}
    </button>`;
  };

  el.personaList.innerHTML = list.map(row).join('')
    + `<button type="button" class="persona-row ${state.personaId ? '' : 'on'}" data-persona="">
        <span class="persona-avatar">全</span>
        <span class="persona-name"><b>全部创作</b>
          <span class="persona-focus">${list.length ? '不限账号，新建时不带账号语境' : '还没有账号设定'}</span>
        </span>
      </button>`;

  el.personaMoreBtn.classList.toggle('hidden', !p);
  el.personaSummary.innerHTML = p ? [
    ['内容定位', p.content_focus], ['目标用户', p.audience],
    ['解决的问题', p.problem], ['备注', p.notes],
    ['个人人设', [creatorLine(p), p.creator_traits].filter(Boolean).join('\n')],
    [`语气档案（学了 ${p.sample_count || 0} 篇）`, p.style_digest],
  ].filter(([, v]) => v).map(([k, v]) =>
    `<div class="persona-field${k.startsWith('语气') ? ' digest' : ''}"><b>${k}</b>${esc(v)}</div>`).join('') : '';
  el.personaSummary.classList.toggle('hidden', !p || !state.personaOpen);

  const noPersonas = list.length === 0;
  el.onboardCard.classList.toggle('hidden', !noPersonas || state.skipOnboard);
  el.briefCard.classList.toggle('hidden', noPersonas && !state.skipOnboard);

  el.inheritNote.textContent = p
    ? `本篇按账号「${p.name}」的设定创作`
    : '未绑定账号 · 本篇不带账号语境';
  el.inheritNote.classList.toggle('free', !p);
  researchUi.reset();
}


/* 切换账号 = 切换创作语境：重置简报默认值并按账号过滤历史 */
el.personaList.addEventListener('click', (e) => {
  if (e.target.closest('[data-edit]')) { editCurrentPersona(); return; }
  const btn = e.target.closest('[data-persona]');
  if (!btn || state.streaming) return;
  const v = btn.dataset.persona;
  const next = v === '' ? null : Number(v);
  if (next === state.personaId) return;
  state.personaId = next;
  rememberPersona();
  resetBrief();
  renderPersonaBar();
  loadHistory();
  if (state.view === 'hot') { el.hotMatches.innerHTML = ''; openHot(); }
});

function resetBrief() {
  closeAssist();
  state.draft = null;
  goStep(1);
  el.briefForm.reset();
  state.pendingHotspot = null;
  el.hotRef.classList.add('hidden');
  applyPersonaDefaults();
  el.sectionInputs.classList.add('hidden');
  el.sectionInputs.innerHTML = '';
  loadSections(state.personaId);
  loadIdeas();
  loadPool();
}

/* ---------------- 简报参数：默认跟账号走 ---------------- */

/* 把账号设定填进表单，并回到「只展示」状态 */
function applyPersonaDefaults() {
  const p = currentPersona();
  const f = el.briefForm;
  if (p) {
    f.platform.value = p.platform;
    f.tone.value = p.tone;
    f.audience.value = p.audience || '';
  }
  syncLength();
  lockParams(!p ? false : true);
}

function lockParams(locked) {
  state.paramsUnlocked = !locked;
  el.inheritRow.classList.toggle('hidden', !locked);
  el.paramGrid.classList.toggle('hidden', locked);
  el.paramReset.classList.toggle('hidden', locked || !currentPersona());
  if (locked) renderInherited();
}

function renderInherited() {
  const f = el.briefForm;
  const p = currentPersona();
  const platform = f.platform.selectedOptions[0]?.textContent || '';
  const facts = [
    ['发布平台', platform],
    ['风格调性', f.tone.value],
    ['目标读者', f.audience.value || (p?.audience || '')],
    ['目标字数', f.length.value ? `约 ${f.length.value} 字` : ''],
  ];
  el.inheritFacts.innerHTML = facts.map(([k, v]) => `
    <span class="inherited-fact"><b>${k}</b>${v
      ? `<span>${esc(v)}</span>`
      : '<span class="empty">未设定</span>'}</span>`).join('');
}

el.editParamsBtn.addEventListener('click', () => {
  lockParams(false);
  el.briefForm.platform.focus();
});

el.resetParamsBtn.addEventListener('click', () => {
  applyPersonaDefaults();
  toast('已恢复账号设定');
});

/* ---------------- 题材推荐 ---------------- */

/* 缓存里有就直接显示；空了就自动补一批（挑走一条后也会自动补齐）。
   自动失败过的账号本次会话不再自动重试，避免没配密钥时反复打扰。 */
async function loadIdeas() {
  const persona = currentPersona();
  el.ideas.classList.toggle('hidden', !persona);
  if (!persona) return;

  el.ideasList.innerHTML = '';
  try {
    const { ideas } = await api(`/personas/${persona.id}/subjects`);
    if (ideas.length >= 3) { renderIdeas(ideas); return; }
    if (state.ideaFailed.has(persona.id)) {
      // 补不满就先把有的显示出来，别让用户对着空白
      if (ideas.length) renderIdeas(ideas);
      else ideaState('点「换一批」让 AI 想几个');
      return;
    }
    if (ideas.length) renderIdeas(ideas);   // 先显示热点那几条，常规的在后面补进来
    await refreshIdeas({ auto: true });
  } catch (err) {
    ideaState(err.message, true);
  }
}

async function refreshIdeas({ auto = false } = {}) {
  const persona = currentPersona();
  if (!persona) return;
  el.ideasList.innerHTML = '<div class="idea-skeleton"></div>'.repeat(3);
  el.ideasRefresh.disabled = true;
  try {
    const { ideas } = await api(`/personas/${persona.id}/subjects`, { method: 'POST', body: {} });
    state.ideaFailed.delete(persona.id);
    renderIdeas(ideas);
  } catch (err) {
    if (auto) state.ideaFailed.add(persona.id);
    ideaState(err.message, true);
  } finally {
    el.ideasRefresh.disabled = false;
  }
}

function renderIdeas(ideas) {
  state.ideas = ideas;
  el.ideasList.innerHTML = ideas.map((i, n) => {
    const hot = i.kind === 'hot' ? i.hotspot : null;
    return `
    <button type="button" class="idea ${hot ? 'from-hot' : ''}" data-idea="${n}">
      ${hot ? `<span class="idea-tag">🔥 热点 · ${esc(hot.platform)}${i.strength ? ` · 关联${esc(i.strength)}` : ''}</span>` : ''}
      <span class="idea-save" data-save-idea="${n}" title="存进选题池，以后再写">＋</span>
      <b>${esc(i.subject)}</b>
      ${i.reason ? `<span>${esc(i.reason)}</span>` : ''}
      ${hot ? `<span class="idea-origin">原文：${esc(hot.title)}</span>` : ''}
      ${hot && hot.summary ? `<span class="idea-summary">${esc(hot.summary)}</span>` : ''}
      ${hot && !hot.summary ? '<span class="idea-summary muted">抓不到原文概要，动笔前请点开原文看一眼</span>' : ''}
    </button>`;
  }).join('');
  el.ideasNote.textContent = ideas.some((i) => i.kind === 'hot')
    ? '热点优先，其余是这个号还没写过的'
    : '这个号还没写过的';
}

function ideaState(text, isError = false) {
  el.ideasList.innerHTML = `<div class="ideas-state${isError ? ' error' : ''}">${esc(text)}</div>`;
}

el.ideasList.addEventListener('click', (e) => {
  // 「＋」存进选题池，点卡片本身才是现在就写
  const save = e.target.closest('[data-save-idea]');
  if (save) {
    e.stopPropagation();
    const i = state.ideas?.[Number(save.dataset.saveIdea)];
    if (i) addPool(i.subject, i.kind === 'hot' ? '热点' : '推荐', i.reason || '');
    return;
  }
  const btn = e.target.closest('button[data-idea]');
  if (!btn) return;
  const idea = state.ideas?.[Number(btn.dataset.idea)];
  if (!idea) return;
  useSubject(idea.subject, idea.hotspot || null);
});

/* 选定题材（可能挂着一条热点，一起带进创作） */
function useSubject(subject, hotspot) {
  $('legacyBrief').open = true;
  state.pendingHotspot = hotspot;
  el.briefForm.subject.value = subject;
  el.briefForm.subject.focus();
  el.briefForm.subject.setSelectionRange(subject.length, subject.length);
  el.hotRef.classList.toggle('hidden', !hotspot);
  if (hotspot) {
    el.hotRef.innerHTML = `
      <span class="hot-ref-tag">🔥 借势热点</span>
      <span class="hot-ref-title">${hotspot.url
        ? `<a href="${esc(hotspot.url)}" target="_blank" rel="noopener noreferrer">${esc(hotspot.title)}</a>`
        : esc(hotspot.title)}</span>
      ${hotspot.summary
        ? `<span class="hot-ref-summary">${esc(hotspot.summary)}</span>`
        : '<span class="hot-ref-summary muted">没抓到原文概要，成稿里只会写到「最近大家在讨论」的程度</span>'}
      <button type="button" class="icon-btn" id="hotRefClear" title="不借势这条">×</button>`;
  }
}

el.ideasRefresh.addEventListener('click', () => refreshIdeas());

el.hotRef.addEventListener('click', (e) => {
  if (!e.target.closest('#hotRefClear')) return;
  state.pendingHotspot = null;
  el.hotRef.classList.add('hidden');
  toast('已取消借势，本篇按普通题材写');
});

el.newPersonaBtn.addEventListener('click', () => openPersonaModal(null));
el.onboardBtn.addEventListener('click', () => openPersonaModal(null));
/* 编辑当前账号。入口是账号行上的齿轮——原来那个独立的「编辑」按钮
   已经跟下拉一起去掉了，别再留一个指向 null 的监听。 */
function editCurrentPersona() {
  const p = currentPersona();
  if (p) openPersonaModal(p);
}
el.skipOnboardBtn.addEventListener('click', () => {
  state.skipOnboard = true;
  renderPersonaBar();
  $('legacyBrief').open = true;
  el.briefForm.subject.focus();
});

/* 账号设定的板块。加一个新板块 = 这里加一条 + index.html 里加一个 data-panel 块。
   needsSaved 的板块要先有账号才有意义——素材、样本都挂在 persona id 上。 */
const ACCOUNT_TABS = [
  { key: 'basic', label: '基本设定', hint: '这个号是谁、写给谁' },
  { key: 'persona', label: '个人人设', hint: '第一人称用谁的口吻' },
  { key: 'material', label: '素材库', hint: '你的真实经历与数据', needsSaved: true },
  { key: 'style', label: '语气样本', hint: '喂成稿学你的语感', needsSaved: true },
];

function renderAccountNav() {
  const saved = Boolean(state.editingId);
  el.accountNav.innerHTML = ACCOUNT_TABS.map((t) => {
    const off = t.needsSaved && !saved;
    return `<button type="button" data-tab="${esc(t.key)}"${off ? ' disabled' : ''}
      title="${off ? '先保存账号再设置这一项' : esc(t.hint)}">${esc(t.label)}<i>${
  off ? '先保存账号' : esc(t.hint)}</i></button>`;
  }).join('');
  showAccountTab(ACCOUNT_TABS.some((t) => t.key === state.accountTab
    && !(t.needsSaved && !saved)) ? state.accountTab : 'basic');
}

function showAccountTab(key) {
  state.accountTab = key;
  document.querySelectorAll('.acc-panel').forEach((n) => n.classList.toggle('hidden', n.dataset.panel !== key));
  el.accountNav.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.tab === key));
  el.accountNav.closest('.acc-body')?.querySelector('.acc-main')?.scrollTo({ top: 0 });
}

el.accountNav.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b && !b.disabled) showAccountTab(b.dataset.tab);
});

function openPersonaModal(persona) {
  // 同一个账号来回开关记住停在哪个板块；换了账号就回到基本设定，
  // 否则打开另一个号直接落在「语气样本」上会以为走错地方了
  if (state.editingId !== (persona?.id ?? null)) state.accountTab = 'basic';
  state.editingId = persona?.id ?? null;
  el.personaModalTitle.textContent = persona ? `账号设定 · ${persona.name}` : '新建账号设定';
  el.personaError.textContent = '';
  el.personaSaveHint.textContent = persona ? '' : '先填名称并保存，才能设置素材库和语气样本';
  el.personaDeleteBtn.classList.toggle('hidden', !persona);
  const f = el.personaForm;
  f.reset();
  if (persona) {
    for (const k of PERSONA_FIELDS) f[k].value = persona[k] ?? '';
  }
  el.personaModal.classList.remove('hidden');
  document.body.classList.add('no-scroll');
  renderAccountNav();
  loadSamples(persona?.id ?? null);
  mat.editing = null;
  loadMaterials(persona?.id ?? null);
  setTimeout(() => f.name.focus(), 30);
}

const closePersonaModal = () => {
  el.personaModal.classList.add('hidden');
  document.body.classList.remove('no-scroll');
  loadSections(state.personaId);          // 栏目可能刚被增删，简报那边要跟上
};
el.personaCancelBtn.addEventListener('click', closePersonaModal);
el.personaCloseBtn.addEventListener('click', closePersonaModal);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.sectionModal.classList.contains('hidden')) closeSectionManager();
  else if (!el.personaModal.classList.contains('hidden')) closePersonaModal();
});

el.personaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  el.personaError.textContent = '';
  const body = Object.fromEntries(new FormData(el.personaForm).entries());
  const id = state.editingId;
  await busy(el.personaSaveBtn, async () => {
    try {
      const { persona } = await api(id ? `/personas/${id}` : '/personas', {
        method: id ? 'PUT' : 'POST', body,
      });
      state.skipOnboard = false;

      // 新建之后**留在页面上**：素材库、样本都要有账号 id 才能设，
      // 这会儿关掉等于逼人再点开一次，左边那几个板块也就白解锁了
      if (!id) {
        state.editingId = persona.id;
        el.personaModalTitle.textContent = `账号设定 · ${persona.name}`;
        el.personaSaveHint.textContent = '已创建 —— 左边的素材库、语气样本现在可以设了';
        el.personaDeleteBtn.classList.remove('hidden');
        renderAccountNav();
              loadSamples(persona.id);
        loadMaterials(persona.id);
        await loadPersonas(persona.id);
        resetBrief();
        loadHistory();
        toast('账号已创建，之后的创作都会带上这份设定');
        return;
      }

      closePersonaModal();
      await loadPersonas(persona.id);
      loadIdeas();
      loadHistory();
      toast('账号设定已更新');
    } catch (err) {
      el.personaError.textContent = err.message;
    }
  });
});

el.personaDeleteBtn.addEventListener('click', async () => {
  const p = currentPersona();
  if (!p) return;
  const n = p.draft_count || 0;
  if (!await ask.confirm({
    title: `删除账号「${p.name}」？`,
    body: n ? `其下 ${n} 条创作会保留在「全部创作」里。` : '',
    ok: '删除', danger: true,
  })) return;
  await api(`/personas/${p.id}`, { method: 'DELETE' });
  closePersonaModal();
  await loadPersonas(undefined);
  resetBrief();
  loadHistory();
  toast('账号已删除');
});

/* ---------------- 第一步：三个方向 ---------------- */
el.briefForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const body = Object.fromEntries(new FormData(el.briefForm).entries());
  body.persona_id = state.personaId ?? '';
  if (state.pendingHotspot) body.hotspot = state.pendingHotspot;
  if (state.sectionId) {
    const missing = missingRequired();
    if (missing.length) {
      hint(`先补上：${missing.join('、')}`, true);
      el.sectionInputs.querySelector('textarea[data-input]')?.focus();
      return;
    }
    body.section_id = state.sectionId;
    const inputs = collectSectionInputs();
    if (inputs) body.inputs = inputs;
  }
  const p = currentPersona();
  hint(p ? `正在以「${p.name}」的定位拆解题材…` : '正在拆解题材，生成三个差异化方向…');

  await busy(el.topicsBtn, async () => {
    try {
      const { draft } = await api('/drafts/topics', { method: 'POST', body });
      hint('');
      setDraft(draft);
      loadHistory();
      loadIdeas();
    } catch (err) {
      hint(err.message, true);
    }
  });
});

el.retopicsBtn.addEventListener('click', async () => {
  if (!state.draft) return;
  await busy(el.retopicsBtn, async () => {
    try {
      const { draft } = await api(`/drafts/${state.draft.id}/topics`, { method: 'POST', body: {} });
      setDraft(draft);
    } catch (err) {
      toast(err.message);
    }
  });
});

el.newBtn.addEventListener('click', () => {
  if (state.streaming) return;
  resetBrief();
  renderHistory();
  el.briefForm.subject.focus();
});

/* ---------------- 渲染方向 ---------------- */
function setDraft(draft) {
  closeAssist();
  state.draft = draft;
  researchUi.showDraft(draft);
  const back = el.contentCard.querySelector('.step-back');
  back.dataset.goto = draft.research ? '1' : '2';
  back.textContent = draft.research ? '← 导入新材料' : '← 换方向';
  fillBrief(draft);
  renderTopics(draft);

  el.reviewBox.classList.add('hidden');
  state.review = null;
  renderCues(null);
  ver.current = '';                    // 换草稿了，回到原文
  state.multiOpen = false;
  state.illusOpen = false;
  renderIllusBar();
  renderMultiBar();
  renderVersionTabs();
  // 打开一篇旧稿时直接落到它已经走到的那一步
  if (draft.content) {
    el.contentTitle.textContent = draft.title || '完整文案';
    setMode('read');
    renderContent();
    goStep(3, { done: true });
  } else {
    goStep(draft.topics?.length ? 2 : 1);
  }
  renderHistory();
}

function fillBrief(d) {
  if (d.persona) {
    el.inheritNote.textContent = `本稿基于账号「${d.persona.name}」的设定创作`;
    el.inheritNote.classList.remove('free');
  } else {
    el.inheritNote.textContent = '本稿未绑定账号';
    el.inheritNote.classList.add('free');
  }
  const f = el.briefForm;
  f.subject.value = d.subject;
  f.platform.value = d.platform;
  f.tone.value = d.tone;
  f.audience.value = d.audience || d.persona?.audience || '';
  f.keywords.value = d.keywords || '';
  f.length.value = d.length;
  state.sectionId = d.section_id ?? null;
  renderSectionChips();
  renderSectionInputs(d.inputs || {});
  lockParams(true);
}

/* 一个方向一横条：左边是"这是什么"，右边是"怎么写"。
   原来三个窄长条并排，每条 900 多像素高，读起来要上下扫三趟，也没法横向比较。 */
function renderTopics(draft) {
  el.topics.innerHTML = draft.topics.map((t, i) => `
    <div class="topic ${draft.chosen === i ? 'chosen' : ''}">
      <div class="topic-main">
        <span class="topic-tag">
          <b>${i + 1}</b>${esc(t.label || `方向 ${i + 1}`)}
        </span>
        <h3>${esc(t.title)}</h3>
        <p class="angle"><b>差异</b>${esc(t.angle)}</p>
        <p class="hook">${esc(t.hook)}</p>
        ${t.audience_fit ? `<p class="fit">适合：${esc(t.audience_fit)}</p>` : ''}
        <button class="btn ${draft.chosen === i ? 'ghost' : 'primary'} small" data-index="${i}">
          ${draft.chosen === i ? '重新生成这篇' : '用这个方向写'}
        </button>
      </div>
      <div class="topic-outline">
        <b>结构</b>
        <ul>${t.outline.map((o) => `<li>${esc(o)}</li>`).join('')}</ul>
      </div>
    </div>`).join('');
}

el.topics.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-index]');
  if (btn && !state.streaming) generate(Number(btn.dataset.index));
});

/* ---------------- 第二步：流式成稿 ---------------- */
async function generate(index) {
  const draft = state.draft;
  const topic = draft.topics[index];
  state.streaming = true;
  goStep(3);
  setMode('read');
  closeAssist();

  el.contentTitle.textContent = topic.title;
  el.content.innerHTML = '<span class="cursor"></span>';
  el.counter.textContent = '生成中…';
  el.contentCard.classList.remove('hidden');
  el.contentCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.topics.querySelectorAll('button').forEach((b) => { b.disabled = true; });

  let text = '';
  try {
    const res = await fetch(`/api/drafts/${draft.id}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index }),
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '生成失败');

    await readSSE(res, (event, data) => {
      if (event === 'delta') {
        text += data.text;
        el.content.innerHTML = markdown(text) + '<span class="cursor"></span>';
        el.counter.textContent = `${countChars(text)} 字 · 生成中`;
      } else if (event === 'done') {
        state.draft = data.draft;
        renderContent();
        markSteps(3, true);      // 只更新步骤条状态；已经在第三步了，不用再切一次
        loadHistory();
        runReview();          // 出稿后自动过一遍错字和通顺性
      } else if (event === 'error') {
        throw new Error(data.message);
      }
    });
  } catch (err) {
    el.counter.textContent = '';
    el.content.innerHTML = `<p style="color:var(--danger)">生成中断：${esc(err.message)}</p>`
      + (text ? markdown(text) : '');
  } finally {
    state.streaming = false;
    el.topics.querySelectorAll('button').forEach((b) => { b.disabled = false; });
    renderTopics(state.draft);
  }
}

async function readSSE(res, onEvent) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const blocks = buf.split('\n\n');
    buf = blocks.pop() || '';
    for (const block of blocks) {
      let event = 'message';
      let data = '';
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        else if (line.startsWith('data:')) data += line.slice(5).trim();
      }
      if (data) onEvent(event, JSON.parse(data));
    }
  }
}

/* ---------------- 历史 ---------------- */
async function loadHistory() {
  try {
    const q = new URLSearchParams();
    if (state.personaId !== null) q.set('persona_id', state.personaId);
    if (state.showArchived) q.set('archived', '1');
    const { drafts, counts } = await api(`/drafts${q.toString() ? `?${q}` : ''}`);
    state.list = drafts;
    state.counts = counts;
    renderHistory();
  } catch { /* 未登录或网络异常时静默 */ }
}

el.historyFilter.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-arch]');
  if (!btn || state.streaming) return;
  state.showArchived = btn.dataset.arch === '1';
  [...el.historyFilter.children].forEach((b) => b.classList.toggle('on', b === btn));
  loadHistory();
});

el.archiveDoneBtn.addEventListener('click', async () => {
  const n = state.counts.activeDone;
  if (!n) return;
  if (!await ask.confirm({ title: `把 ${n} 篇已完成的创作收进归档？`, body: '随时可以在「已归档」里恢复。', ok: '归档' })) return;
  await busy(el.archiveDoneBtn, async () => {
    try {
      const { archived } = await api('/drafts/archive-done', {
        method: 'POST',
        body: { persona_id: state.personaId === null ? '' : state.personaId },
      });
      toast(`已归档 ${archived} 篇`);
      loadHistory();
    } catch (err) { toast(err.message); }
  });
});

function renderHistory() {
  const list = state.list || [];
  el.cntActive.textContent = state.counts.active || '';
  el.cntArchived.textContent = state.counts.archived || '';
  el.historyFoot.classList.toggle('hidden', state.showArchived || !state.counts.activeDone);
  el.archiveDoneBtn.textContent = `把 ${state.counts.activeDone} 篇已完成的收起来`;

  if (!list.length) {
    const p = currentPersona();
    el.history.innerHTML = state.showArchived
      ? '<div class="empty">归档里还是空的<br />在「进行中」把不再需要的收起来</div>'
      : `<div class="empty">${p ? `「${esc(p.name)}」还没有创作记录` : '还没有创作记录'}<br />从右边填写题材开始</div>`;
    return;
  }
  const STATUS = { topics: '待选方向', writing: '生成中', done: '已完成' };
  const showTag = state.personaId === null;
  el.history.innerHTML = list.map((d) => {
    const owner = state.personas.find((p) => p.id === d.persona_id);
    const tag = showTag ? `<span class="persona-tag">${esc(owner ? owner.name : '无账号')}</span>` : '';
    return `
    <div class="history-item ${state.draft?.id === d.id ? 'active' : ''} ${d.archived_at ? 'archived' : ''}" data-id="${d.id}">
      <div class="acts">
        <button data-arch-id="${d.id}" data-to="${d.archived_at ? '0' : '1'}"
          title="${d.archived_at ? '恢复到进行中' : '归档'}">${d.archived_at ? '↩' : '📥'}</button>
        <button class="del" data-del="${d.id}" title="删除">×</button>
      </div>
      <h4>${esc(d.title || d.subject)}</h4>
      <p>${tag}<span>${esc(platformLabel(d.platform))}</span><span>·</span><span>${STATUS[d.status] || d.status}</span></p>
    </div>`;
  }).join('');
}

el.history.addEventListener('click', async (e) => {
  const arch = e.target.closest('button[data-arch-id]');
  if (arch) {
    e.stopPropagation();
    try {
      await api(`/drafts/${arch.dataset.archId}/archive`, {
        method: 'POST', body: { archived: arch.dataset.to === '1' },
      });
      toast(arch.dataset.to === '1' ? '已归档' : '已恢复');
      loadHistory();
    } catch (err) { toast(err.message); }
    return;
  }

  const del = e.target.closest('button[data-del]');
  if (del) {
    e.stopPropagation();
    const id = Number(del.dataset.del);
    if (!await ask.confirm({ title: '删除这条创作记录？', ok: '删除', danger: true })) return;
    await api(`/drafts/${id}`, { method: 'DELETE' });
    if (state.draft?.id === id) el.newBtn.click();
    loadHistory();
    return;
  }
  const item = e.target.closest('.history-item');
  if (!item || state.streaming) return;
  const { draft } = await api(`/drafts/${item.dataset.id}`);
  if (draft.persona_id && draft.persona_id !== state.personaId
      && state.personas.some((p) => p.id === draft.persona_id)) {
    state.personaId = draft.persona_id;
    renderPersonaBar();
    loadHistory();
  }
  setDraft(draft);
});

const platformLabel = (key) =>
  state.meta?.platforms.find((p) => p.key === key)?.label || key;

/* ---------------- 复制 / 下载 ---------------- */
/* 复制和下载都要跟着**当前正在看的版本**走。
   切到微博版却复制出公众号原文，这个功能最后一步就废了。 */
/* 复制/下载按钮的文案。要在三个时机都刷：切版本、首次渲染正文、出完图之后——
   出了图按钮还写着"下载 .md"，人就不知道图会不会带上。 */
function updateActionLabels() {
  const other = Boolean(ver.current);
  const hasImg = (illOf()?.items || []).some((it) => it.image);
  el.copyBtn.textContent = other ? `复制${currentLabel()}版` : '复制';
  el.downloadBtn.textContent = `${other ? `下载${currentLabel()}版` : '下载'}${hasImg ? '图文' : ' .md'}`;
  el.copyBtn.title = hasImg ? '正文 + 配图一起复制（富文本）' : '复制正文';
  if (el.copyHint) {
    el.copyHint.textContent = `${other ? `${currentLabel()}版` : '正文'}${
      hasImg ? '；连图一起（富文本）' : ''}`;
  }
}

function currentText() {
  return (ver.current ? state.draft?.variants?.[ver.current]?.content : state.draft?.content) || '';
}
const currentLabel = () => (ver.current ? platformLabel(ver.current) : '');

/* 把图读成 data URI。
   剪贴板里放图片链接是没用的——指向 localhost 且要登录态，
   粘到公众号编辑器那边取不到。只有把字节本身塞进去才带得走。 */
async function inlineImages(items) {
  const out = new Map();
  await Promise.all(items.filter((it) => it.image).map(async (it) => {
    try {
      const res = await fetch(`/image/${it.image.file}?v=${encodeURIComponent(it.image.at)}`);
      if (!res.ok) return;
      const blob = await res.blob();
      const uri = await new Promise((ok, no) => {
        const r = new FileReader();
        r.onload = () => ok(r.result);
        r.onerror = no;
        r.readAsDataURL(blob);
      });
      out.set(it.i, uri);
    } catch { /* 单张读不到就跳过，别让整次复制失败 */ }
  }));
  return out;
}

/* 带图的富文本。和阅读区用的是同一套插图逻辑，只是图换成了 data URI */
async function richHtml(text) {
  const store = illOf();
  const items = (store?.items || []).filter((it) => it.at >= 0);
  if (!items.length) return { html: markdown(text), imgs: 0 };

  const uris = await inlineImages(items);
  const fig = (it) => {
    const uri = uris.get(it.i);
    if (!uri) return '';
    return `<figure style="margin:22px 0"><img src="${uri}" alt="${esc(it.alt)}" style="max-width:100%">`
      + (it.alt ? `<figcaption style="font-size:13px;color:#888;text-align:center;margin-top:6px">${esc(it.alt)}</figcaption>` : '')
      + '</figure>';
  };

  const cuts = items.map((it) => {
    const end = text.indexOf('\n', it.at + it.anchor.length);
    return { at: end < 0 ? text.length : end, it };
  }).sort((a, b) => a.at - b.at);

  let html = '';
  let from = 0;
  for (const c of cuts) { html += markdown(text.slice(from, c.at)) + fig(c.it); from = c.at; }
  return { html: html + markdown(text.slice(from)), imgs: uris.size };
}

el.copyBtn.addEventListener('click', () => busy(el.copyBtn, async () => {
  const text = currentText();
  if (!text) return;
  const label = ver.current ? `「${currentLabel()}」版本` : '';
  try {
    const { html, imgs } = await richHtml(text);
    if (imgs && window.ClipboardItem) {
      // 同时写两种格式：富文本编辑器取 HTML（带图），纯文本处取 markdown
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([text], { type: 'text/plain' }),
      })]);
      toast(`已复制${label}，带 ${imgs} 张图`);
      return;
    }
    await navigator.clipboard.writeText(text);
    toast(imgs ? `已复制${label}（这个浏览器带不了图，用「下载图文包」）` : `已复制${label || '到剪贴板'}`);
  } catch {
    toast('复制失败，请手动选中文本');
  }
}));

let forceFormat = '';        // 菜单里明确选的格式；空 = 按有没有图自动决定
const downloadAs = (fmt) => { forceFormat = fmt; el.downloadBtn.click(); };

el.downloadBtn.addEventListener('click', () => busy(el.downloadBtn, async () => {
  const d = state.draft;
  const text = currentText();
  if (!text) return;
  const base = (d.title || d.subject).slice(0, 40).replace(/[\\/:*?"<>|]/g, '')
    + (ver.current ? `-${currentLabel()}` : '');

  const want = forceFormat; forceFormat = '';
  const got = want === 'md' ? false : (want === 'html' || (illOf()?.items || []).some((it) => it.image));
  // 有图就存成自包含的 .html——图嵌在文件里，浏览器打开全选复制，
  // 任何富文本编辑器都能接。存 .md 等于把图丢了。
  const { html, imgs } = got ? await richHtml(text) : { html: '', imgs: 0 };
  // 明确点了「下载图文」但一张图都没出，也照样给 html——用户选的是格式，不是条件

  const [body, mime, ext] = (imgs || want === 'html')
    ? [`<!doctype html><meta charset="utf-8"><title>${esc(base)}</title>`
      + '<body style="max-width:720px;margin:40px auto;padding:0 20px;'
      + 'font:16px/1.8 -apple-system,\'PingFang SC\',sans-serif;color:#1a1a1a">'
      + html, 'text/html;charset=utf-8', 'html']
    : [text, 'text/markdown;charset=utf-8', 'md'];

  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `${base}.${ext}`;      // 文件名带平台，几个版本一起下载才分得清
  a.click();
  URL.revokeObjectURL(url);
  if (imgs) toast(`已下载，含 ${imgs} 张图（浏览器打开后全选复制即可粘进编辑器）`);
}));

/* ---------------- 小工具 ---------------- */
/* 三步各占一屏，一次只显示一张卡。
   以前三张堆着往下滚，到第三步时前两步还杵在上面——既长又分不清现在在哪一步。 */
function goStep(n, { done = false } = {}) {
  state.step = n;
  el.main.dataset.step = n;      // 宽度按步骤走，见 .main[data-step]
  el.briefCard.classList.toggle('hidden', n !== 1);
  el.topicsCard.classList.toggle('hidden', n !== 2);
  el.contentCard.classList.toggle('hidden', n !== 3);
  markSteps(n, done);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* 哪几步现在能点。往回走随便走，往前只能走到已经有内容的那一步 */
function reachable(n) {
  if (n === 1) return true;
  if (n === 2) return Boolean(state.draft?.topics?.length);
  return Boolean(state.draft?.content);
}

function markSteps(current, done = false) {
  renderCreationSteps();
  [...el.steps.children].forEach((li) => {
    const n = Number(li.dataset.step);
    li.classList.toggle('active', n === current);
    li.classList.toggle('done', n < current || (done && n === current));
    li.classList.toggle('reachable', n !== current && reachable(n));
  });
}

function renderCreationSteps() {
  const research = state.step === 3 ? Boolean(state.draft?.research)
    : state.step === 1 && !$('legacyBrief').open;
  el.steps.children[0].innerHTML = `<b>1</b> ${research ? '导入研究材料' : '确定选题'}`;
  el.steps.children[1].classList.toggle('hidden', research);
  el.steps.children[2].innerHTML = `<b>${research ? '2' : '3'}</b> 编辑与确认`;
}
$('legacyBrief').addEventListener('toggle', renderCreationSteps);

el.steps.addEventListener('click', (e) => {
  const li = e.target.closest('.step');
  const n = Number(li?.dataset.step);
  if (!n || n === state.step || state.streaming || !reachable(n)) return;
  goStep(n, { done: n === 3 });
});

/* 卡片里的「← 改题材」「← 换方向」 */
document.addEventListener('click', (e) => {
  const b = e.target.closest('.step-back[data-goto]');
  if (b && !state.streaming) goStep(Number(b.dataset.goto));
});

function hint(text, isError = false) {
  el.briefHint.textContent = text;
  el.briefHint.classList.toggle('error', isError);
}

let toastTimer;
function toast(message) {
  el.toast.textContent = message;
  el.toast.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.toast.classList.add('hidden'), 2600);
}

/* 同一时刻只允许一个提交在飞行中，防止重复点击生成重复记录 */
async function busy(btn, fn) {
  if (state.busy) return;
  state.busy = true;
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> 处理中';
  try { await fn(); } finally { state.busy = false; btn.disabled = false; btn.innerHTML = label; }
}

const countChars = (s) => s.replace(/\s/g, '').length;

// Function declarations are available during the early research UI bootstrap.
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* 极简 Markdown 渲染：先转义再套标签，够用且安全 */
function markdown(src) {
  const lines = esc(src).split('\n');
  const out = [];
  let list = null;

  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const openList = (tag) => { if (list !== tag) { closeList(); out.push(`<${tag}>`); list = tag; } };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }

    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { closeList(); const n = h[1].length; out.push(`<h${n}>${inline(h[2])}</h${n}>`); continue; }

    if (/^(---|\*\*\*|___)\s*$/.test(line)) { closeList(); out.push('<hr />'); continue; }

    const ul = line.match(/^\s*[-*+]\s+(.*)$/);
    if (ul) { openList('ul'); out.push(`<li>${inline(ul[1])}</li>`); continue; }

    const ol = line.match(/^\s*\d+[.、)]\s+(.*)$/);
    if (ol) { openList('ol'); out.push(`<li>${inline(ol[1])}</li>`); continue; }

    const bq = line.match(/^&gt;\s?(.*)$/);
    if (bq) { closeList(); out.push(`<blockquote>${inline(bq[1])}</blockquote>`); continue; }

    closeList();
    out.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return out.join('');
}

const inline = (s) => s
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');

/* ==================================================================
 * 成稿编辑器：阅读/编辑双模式、划词改 AI、/ 唤起续写
 * 正文的唯一真相是 state.draft.content（Markdown 原文）
 * ================================================================== */

const ASSIST_ACTIONS = [
  { key: 'expand', label: '扩写' },
  { key: 'professional', label: '专业点' },
  { key: 'casual', label: '轻松点' },
  { key: 'shorten', label: '缩写' },
  { key: 'example', label: '举个例子' },
  { key: 'simplify', label: '更好懂' },
];

const COMPOSE_ACTIONS = [
  { key: 'continue', label: '续写这一段' },
  { key: 'opening', label: '写个开头' },
  { key: 'heading', label: '加个小标题' },
  { key: 'ending', label: '写个结尾' },
];

function renderContent() {
  const text = state.draft?.content || '';
  el.content.innerHTML = withIllus(text);   // 有配图就把图插进去
  updateActionLabels();
  if (el.editor.value !== text) el.editor.value = text;
  el.counter.textContent = `${countChars(text)} 字`;
}

// Measure a detached-from-flow copy so typing never collapses the live document.
function resizeEditor() {
  const mirror = el.editor.cloneNode(false);
  mirror.removeAttribute('id');
  mirror.removeAttribute('name');
  mirror.setAttribute('aria-hidden', 'true');
  mirror.tabIndex = -1;
  const style = getComputedStyle(el.editor);
  Object.assign(mirror.style, {
    position: 'fixed', top: '0', left: '-100000px', visibility: 'hidden',
    width: `${el.editor.getBoundingClientRect().width}px`, height: '0',
    minHeight: '0', maxHeight: 'none', overflow: 'hidden', pointerEvents: 'none',
  });
  mirror.value = el.editor.value;
  document.body.appendChild(mirror);
  const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
  el.editor.style.height = `${Math.max(360, mirror.scrollHeight + border)}px`;
  mirror.remove();
}

function setMode(mode) {
  if (state.streaming) return;
  if (state.mode === 'edit' && mode !== 'edit') flushSave();   // 离开编辑就落盘
  state.mode = mode;
  const editing = mode === 'edit';
  const cueing = mode === 'cue';
  el.content.classList.toggle('hidden', editing || cueing);
  el.editor.classList.toggle('hidden', !editing);
  el.editorBar.classList.toggle('hidden', !editing);
  el.cuesPane.classList.toggle('hidden', !cueing);
  syncModeUi(mode);
  hideMenus();
  if (!editing && !cueing) renderContent();
  if (editing) {
    el.editor.value = state.draft?.content || '';
    resizeEditor();
    el.editor.focus();
  }
  if (cueing) renderCues(state.draft?.cues);
}


/* ---------------- 保存 ---------------- */
let saveTimer;
let saving = false;

function markDirty() {
  state.dirty = true;
  el.saveState.textContent = '未保存';
  el.saveState.className = 'save-state dirty';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flushSave, 1200);
}

async function flushSave() {
  clearTimeout(saveTimer);
  if (saving || !state.dirty || !state.draft) return;
  const current = state.draft;
  const content = current.content;
  const id = current.id;
  saving = true;
  let saved = false;
  state.dirty = false;
  el.saveState.textContent = '保存中…';
  el.saveState.className = 'save-state';
  try {
    const { draft } = await api(`/drafts/${id}/content`, { method: 'PUT', body: { content } });
    saved = true;
    if (state.draft !== current) return;
    // A save response must never replace text typed while the request was in flight.
    const latest = current.content;
    const changed = latest !== content;
    state.draft = { ...draft, content: changed ? latest : draft.content };
    state.dirty = state.dirty || changed;
    if (state.mode === 'cue') renderCues(null);
    el.saveState.textContent = state.dirty ? '未保存' : '已保存';
    el.saveState.className = state.dirty ? 'save-state dirty' : 'save-state saved';
    loadHistory();
  } catch (err) {
    if (state.draft !== current) return;
    state.dirty = true;
    el.saveState.textContent = `保存失败：${err.message}`;
    el.saveState.className = 'save-state dirty';
  } finally {
    saving = false;
    if (saved && state.dirty) {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(flushSave, 0);
    }
  }
}

el.saveBtn.addEventListener('click', flushSave);
window.addEventListener('beforeunload', (e) => {
  if (state.dirty) { e.preventDefault(); e.returnValue = ''; }
});

el.editor.addEventListener('compositionend', () => setTimeout(detectSlash, 0));

el.editor.addEventListener('input', () => {
  if (!state.draft) return;
  state.draft.content = el.editor.value;
  el.counter.textContent = `${countChars(el.editor.value)} 字`;
  resizeEditor();
  markDirty();
  detectSlash();
});

/* ---------------- 划词菜单 ---------------- */

function hideMenus() {
  el.selMenu.classList.add('hidden');
  el.slashMenu.classList.add('hidden');
  state.slashAt = null;
}

/* 光标在 textarea 里的屏幕坐标：用一个同款式的镜像元素量出来 */
function caretRect(ta, index) {
  const cs = getComputedStyle(ta);
  const mirror = document.createElement('div');
  const copy = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'wordSpacing',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'boxSizing'];
  copy.forEach((k) => { mirror.style[k] = cs[k]; });
  Object.assign(mirror.style, {
    position: 'absolute', top: '0', left: '0', visibility: 'hidden',
    whiteSpace: 'pre-wrap', overflowWrap: 'break-word', width: `${ta.clientWidth}px`,
  });
  mirror.textContent = ta.value.slice(0, index);
  const marker = document.createElement('span');
  marker.textContent = ta.value.slice(index) || '.';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const box = ta.getBoundingClientRect();
  const top = box.top + marker.offsetTop - ta.scrollTop;
  const left = box.left + marker.offsetLeft - ta.scrollLeft;
  mirror.remove();
  return { top, left, bottom: top + (parseFloat(cs.lineHeight) || 22) };
}

function placeMenu(node, point) {
  node.classList.remove('hidden');
  const box = node.getBoundingClientRect();
  const left = Math.min(Math.max(8, point.left), window.innerWidth - box.width - 8);
  const spaceBelow = window.innerHeight - point.bottom;
  const top = spaceBelow > box.height + 12 ? point.bottom + 6 : point.top - box.height - 6;
  node.style.left = `${left}px`;
  node.style.top = `${Math.max(8, top)}px`;
}

function openSelMenu(point, target) {
  state.selTarget = target;
  el.selMenu.innerHTML = ASSIST_ACTIONS
    .map((a) => `<button data-action="${a.key}">${a.label}</button>`).join('')
    + (state.draft?.research ? '<label class="research-custom-label">自定义改写要求<input id="researchSelectionInstruction" maxlength="2000" placeholder="如：更简洁，保留数据与限制条件" /></label><button type="button" data-research-custom>按要求改写</button>' : '');
  placeMenu(el.selMenu, point);
}

/* 编辑模式：选区偏移直接可用 */
function editorSelection() {
  const { selectionStart: start, selectionEnd: end } = el.editor;
  if (end - start < 2) return null;
  return { start, end, text: el.editor.value.slice(start, end) };
}

['mouseup', 'keyup'].forEach((evt) => el.editor.addEventListener(evt, (e) => {
  if (evt === 'keyup' && !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  const sel = editorSelection();
  if (!sel) { el.selMenu.classList.add('hidden'); return; }
  openSelMenu(caretRect(el.editor, sel.end), sel);
}));

/* 阅读模式：把渲染文本里的选区反查回 Markdown 原文的偏移 */
document.addEventListener('mouseup', (event) => {
  if ([el.selMenu, el.slashMenu, el.assistPop].some(node => node.contains(event.target))) return;
  if (state.mode !== 'read' || !state.draft?.content) return;
  const draft = state.draft, snapshot = draft.content;
  setTimeout(() => {
    if (state.mode !== 'read' || state.draft !== draft || state.draft.content !== snapshot) return;
    const selection = window.getSelection();
    if (!selection.rangeCount || selection.isCollapsed) { el.selMenu.classList.add('hidden'); return; }
    const range = selection.getRangeAt(0);
    if (!el.content.contains(range.commonAncestorContainer)) return;
    const text = selection.toString().trim();
    if (text.length < 2) return;

    const target = locateInRaw(text, range);
    if (!target) { toast('无法定位这段选区，请重新选择或稍微扩大范围'); return; }
    openSelMenu(range.getBoundingClientRect(), target);
  }, 0);
});

/* 同一句话可能出现多次：用它在渲染文本里的相对位置挑最接近的那处。
   第一优先是可见文字到 Markdown 的映射，精确原文查找只作为兼容兜底。 */
function locateInRaw(text, range) {
  const raw = currentText();
  const map = buildSelectionMap(raw);
  const probe = document.createRange();
  probe.selectNodeContents(el.content);
  probe.setEnd(range.startContainer, range.startOffset);
  const ratio = probe.toString().length / (el.content.innerText.length || 1);
  const mapped = findRawSelection(raw, text, ratio * map.text.length);
  if (mapped) return mapped;

  const hits = [];
  for (let i = raw.indexOf(text); i !== -1; i = raw.indexOf(text, i + 1)) hits.push(i);
  if (!hits.length) return null;

  let start = hits[0];
  if (hits.length > 1) {
    const guess = ratio * raw.length;
    start = hits.reduce((best, i) => (Math.abs(i - guess) < Math.abs(best - guess) ? i : best), hits[0]);
  }
  return { start, end: start + text.length, text };
}

el.selMenu.addEventListener('click', (e) => {
  if (e.target.closest('[data-research-custom]')) {
    const instruction = $('researchSelectionInstruction')?.value.trim();
    if (!instruction) return;
    const target = state.selTarget;
    hideMenus();
    runAssist({ instruction, kind: 'rewrite', target }, instruction);
    return;
  }
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const label = ASSIST_ACTIONS.find((a) => a.key === action).label;
  hideMenus();
  runAssist({ action, kind: 'rewrite', target: state.selTarget }, label);
});

/* ---------------- / 唤起续写 ---------------- */

/* 半角和全角斜杠都认（中文输入法全角状态下打出来的是／） */
const SLASH_KEYS = ['/', '\uFF0F'];
/* 只在这些字符后面不触发：URL、路径、分数——中文标点和汉字后面都要能唤起 */
const SLASH_BLOCKERS = /[A-Za-z0-9:/\uFF0F]/;

function detectSlash() {
  if (state.mode !== 'edit') return;
  const pos = el.editor.selectionStart;
  const value = el.editor.value;
  if (!SLASH_KEYS.includes(value[pos - 1])) {
    if (state.slashAt !== null && state.slashAt !== undefined) hideMenus();
    return;
  }
  const prev = value[pos - 2];
  if (prev && SLASH_BLOCKERS.test(prev)) return;
  state.slashAt = pos - 1;
  el.slashItems.innerHTML = COMPOSE_ACTIONS
    .map((a) => `<button data-compose="${a.key}">${a.label}</button>`).join('');
  el.slashInput.value = '';
  placeMenu(el.slashMenu, caretRect(el.editor, pos));
}

function consumeSlash() {
  if (state.slashAt === null || state.slashAt === undefined) return el.editor.selectionStart;
  const at = state.slashAt;
  const value = el.editor.value;
  el.editor.value = value.slice(0, at) + value.slice(at + 1);   // 去掉那个 / 或 ／
  state.draft.content = el.editor.value;
  state.slashAt = null;
  markDirty();
  return at;
}

el.slashItems.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-compose]');
  if (!btn) return;
  const key = btn.dataset.compose;
  const label = COMPOSE_ACTIONS.find((a) => a.key === key).label;
  const at = consumeSlash();
  hideMenus();
  runAssist({ action: key, kind: 'compose', target: { start: at, end: at, text: '' } }, label);
});

el.slashInput.addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const instruction = el.slashInput.value.trim();
  if (!instruction) return;
  const at = consumeSlash();
  hideMenus();
  runAssist({ instruction, kind: 'compose', target: { start: at, end: at, text: '' } }, instruction);
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!el.slashMenu.classList.contains('hidden') || !el.selMenu.classList.contains('hidden')) hideMenus();
  else if (!el.assistPop.classList.contains('hidden')) closeAssist();
});

document.addEventListener('mousedown', (e) => {
  if (el.selMenu.contains(e.target) || el.slashMenu.contains(e.target)) return;
  hideMenus();
});

/* ---------------- AI 结果浮层 ---------------- */

async function runAssist(req, label) {
  const draft = state.draft;
  if (!draft || !req.target) return;
  const version = ver.current;
  const raw = currentText();
  if (raw.slice(req.target.start, req.target.end) !== req.target.text) { toast('选区已改变，请重新选中文字'); return; }
  closeAssist();
  const request = { ...req, label, text: '', draftId: draft.id, snapshot: raw, controller: new AbortController(), version };
  state.assist = request;
  $('assistSaveRule').classList.toggle('hidden', !draft.research);
  $('assistSaveRule').disabled = true;

  el.assistTitle.textContent = `AI · ${label}`;
  el.assistBody.textContent = '';
  el.assistBody.innerHTML = '<span class="cursor"></span>';
  el.assistPop.classList.remove('hidden');
  el.assistReplace.disabled = true;
  el.assistInsert.disabled = true;
  el.assistReplace.textContent = req.kind === 'compose' ? '插入到光标处' : '替换原文';
  el.assistInsert.classList.toggle('hidden', req.kind === 'compose');
  positionAssist();

  const { start, end, text } = req.target;
  const body = {
    kind: req.kind === 'compose' ? 'compose' : 'rewrite',
    action: req.action,
    instruction: req.instruction,
    selection: text,
    before: raw.slice(Math.max(0, start - 600), start),
    after: raw.slice(end, end + 600),
  };

  try {
    const res = await fetch(`/api/drafts/${draft.id}/${draft.research ? 'research-assist' : 'assist'}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: request.controller.signal,
    });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || '请求失败');

    let out = '';
    await readSSE(res, (event, data) => {
      if (state.assist !== request) return;
      if (event === 'delta') {
        out += data.text;
        el.assistBody.textContent = out;
        el.assistBody.innerHTML = `${esc(out)}<span class="cursor"></span>`;
      } else if (event === 'done') {
        out = (data.text || out).trim();
        el.assistBody.textContent = out;
      } else if (event === 'error') {
        throw new Error(data.message);
      }
    });
    if (state.assist !== request) return;
    if (!assistSnapshotValid(request, state.draft) || request.version !== ver.current) throw new Error('稿件或正文已改变，请关闭结果并重新选择文字。');
    state.assist.text = out.trim();
    $('assistSaveRule').disabled = !state.assist.text;
    el.assistReplace.disabled = !state.assist.text;
    el.assistInsert.disabled = !state.assist.text;
  } catch (err) {
    if (state.assist !== request || request.controller.signal.aborted) return;
    el.assistBody.innerHTML = `<span class="err">${esc(err.message)}</span>`;
  }
}

function positionAssist() {
  const anchor = el.contentCard.getBoundingClientRect();
  const box = el.assistPop.getBoundingClientRect();
  el.assistPop.style.left = `${Math.max(8, Math.min(anchor.right - box.width, window.innerWidth - box.width - 8))}px`;
  el.assistPop.style.top = `${Math.max(8, Math.min(window.innerHeight - box.height - 8, anchor.top + 60))}px`;
}

function closeAssist() {
  state.assist?.controller?.abort();
  el.assistPop.classList.add('hidden');
  state.assist = null;
}

el.assistClose.addEventListener('click', closeAssist);
el.assistRetry.addEventListener('click', () => {
  const a = state.assist;
  if (a && (!assistSnapshotValid(a, state.draft) || a.version !== ver.current)) { toast('稿件或正文已改变，请重新选择文字'); closeAssist(); return; }
  if (a) runAssist({ action: a.action, kind: a.kind, instruction: a.instruction, target: a.target }, a.label);
});

el.assistReplace.addEventListener('click', () => applyAssist('replace'));
el.assistInsert.addEventListener('click', () => applyAssist('after'));

async function applyAssist(how) {
  const a = state.assist;
  if (!a?.text) return;
  if (!assistSnapshotValid(a, state.draft) || a.version !== ver.current) { toast('稿件或正文已改变，请重新选择文字'); closeAssist(); return; }
  const { start, end } = a.target;
  const raw = a.version ? state.draft.variants?.[a.version]?.content : state.draft.content;
  if (typeof raw !== 'string') { toast('当前版本已经不存在，请重新选择'); closeAssist(); return; }

  const next = how === 'replace' && a.kind !== 'compose'
    ? raw.slice(0, start) + a.text + raw.slice(end)
    : a.kind === 'compose'
      ? insertAt(raw, start, a.text)
      : insertAt(raw, end, a.text);

  if (a.version) {
    try {
      const { draft } = await api(`/drafts/${a.draftId}/variants/${encodeURIComponent(a.version)}`, {
        method: 'PUT',
        body: { content: next, previous: raw },
      });
      if (state.draft?.id !== a.draftId) {
        closeAssist();
        toast('改写已保存到原平台版本');
        return;
      }
      state.draft = draft;
      renderVersionTabs();
      renderIllusBar();
      if (ver.current === a.version) showVersion();
    } catch (err) {
      toast(`版本保存失败：${err.message}`);
      return;
    }
  } else {
    state.draft.content = next;
    renderContent();
    markDirty();
  }
  closeAssist();
  toast(how === 'replace' && a.kind !== 'compose' ? '已替换' : '已插入');
}

/* 插入时补足空行，避免和上下文粘在一起 */
function insertAt(raw, at, text) {
  const before = raw.slice(0, at);
  const after = raw.slice(at);
  const lead = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : '';
  const tail = after && !after.startsWith('\n\n') ? (after.startsWith('\n') ? '\n' : '\n\n') : '';
  return before + lead + text + tail + after;
}

/* ==================================================================
 * 语气学习：用户确认后，把这篇成稿喂给账号
 * ================================================================== */

el.learnBtn.addEventListener('click', async () => {
  const draft = state.draft;
  if (!draft?.content?.trim()) return;
  if (!draft.persona_id) {
    toast('这篇没有绑定账号，先在侧栏选一个账号再创作');
    return;
  }
  const persona = state.personas.find((p) => p.id === draft.persona_id);
  const name = persona?.name || draft.persona?.name || '该账号';
  if (!await ask.confirm({
    title: `把这篇喂给账号「${name}」学语气？`,
    body: '之后这个号的选题和成稿都会模仿它的语感。可以随时在账号设定里删掉样本。',
    ok: '喂进去',
  })) return;

  await flushSave();
  await busy(el.learnBtn, async () => {
    try {
      const { digest } = await api(`/personas/${draft.persona_id}/samples`, {
        method: 'POST', body: { draft_id: draft.id },
      });
      await loadPersonas(state.personaId);
      toast(digest ? '学好了，语气档案已更新' : '已加入样本');
    } catch (err) {
      toast(err.message);
    }
  });
});

/* ---------------- 账号设定里的样本管理 ---------------- */

async function loadSamples(personaId) {
  el.styleSection.classList.toggle('hidden', !personaId);
  if (!personaId) return;
  el.sampleList.innerHTML = '';
  el.digestBox.innerHTML = '';
  try {
    const { samples, digest } = await api(`/personas/${personaId}/samples`);
    renderSamples(samples, digest);
  } catch (err) {
    el.styleHint.textContent = err.message;
  }
}

function renderSamples(samples, digest) {
  el.sampleList.innerHTML = samples.map((s) => `
    <div class="sample-row">
      <span class="name">${esc(s.title || '未命名样本')}</span>
      <span class="meta">${s.length} 字</span>
      <button class="del" data-sample="${s.id}" title="删除">×</button>
    </div>`).join('');
  el.digestBox.innerHTML = digest
    ? `<b>学到的语气档案</b>${esc(digest)}`
    : '';
  el.styleHint.textContent = samples.length
    ? `已学 ${samples.length} 篇`
    : '在成稿页点「喂给账号学习」即可添加';
  el.rebuildDigestBtn.classList.toggle('hidden', !samples.length);
}

el.sampleList.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-sample]');
  if (!btn || !state.editingId) return;
  if (!await ask.confirm({ title: '删除这篇样本？', body: '语气档案会用剩下的样本重新学一遍。', ok: '删除', danger: true })) return;
  await busy(btn, async () => {
    try {
      const { samples, digest } = await api(`/personas/${state.editingId}/samples/${btn.dataset.sample}`, { method: 'DELETE' });
      renderSamples(samples, digest);
      loadPersonas(state.personaId);
    } catch (err) { toast(err.message); }
  });
});

el.rebuildDigestBtn.addEventListener('click', async () => {
  if (!state.editingId) return;
  await busy(el.rebuildDigestBtn, async () => {
    try {
      const { digest } = await api(`/personas/${state.editingId}/digest`, { method: 'POST', body: {} });
      const { samples } = await api(`/personas/${state.editingId}/samples`);
      renderSamples(samples, digest);
      loadPersonas(state.personaId);
      toast('语气档案已重新学习');
    } catch (err) { toast(err.message); }
  });
});

/* ==================================================================
 * 热点板块：抓全网榜单 → 和账号定位比对 → 给出可蹭的点和选题
 * ================================================================== */

el.viewNav.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-view]');
  if (btn) setView(btn.dataset.view);
});

function setView(view) {
  state.view = view;
  el.writeView.classList.toggle('hidden', view !== 'write');
  el.hotView.classList.toggle('hidden', view !== 'hot');
  [...el.viewNav.children].forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'hot') openHot();
}

/* 进热点板块：先把上次的结果和缓存的榜单摆出来，不自动烧一次模型调用 */
async function openHot() {
  const persona = currentPersona();
  if (!persona) {
    el.hotMatches.innerHTML = '<div class="hot-note">先在左边选一个账号，热点才有比对的对象。</div>';
    el.hotRun.disabled = true;
    return;
  }
  el.hotRun.disabled = false;
  el.hotIntro.textContent =
    `抓取全网榜单，和「${persona.name}」的定位逐条比对，只留下这个号真能接得住的，并给出蹭点和选题建议。`;

  try {
    const { hotspots } = await api(`/personas/${persona.id}/hotspots`);
    renderHotspots(hotspots);
  } catch { /* 读缓存失败就当没有 */ }

  if (!state.boards) loadBoards();
}

async function loadBoards(force = false) {
  el.boardList.innerHTML = '<div class="ideas-state">正在抓取榜单…</div>';
  try {
    state.boards = await api(`/hotspots${force ? '?force=1' : ''}`);
    renderBoards();
    renderSources(state.boards.sources);
  } catch (err) {
    el.boardList.innerHTML = `<div class="ideas-state error">${esc(err.message)}</div>`;
  }
}

function renderSources(sources = []) {
  el.hotSources.innerHTML = (sources || []).map((s) => `
    <span class="source-pill ${s.ok ? 'ok' : 'bad'}" title="${esc(s.error || '')}">
      ${s.ok ? '●' : '○'} ${esc(s.label)}${s.ok ? ` ${s.count}` : ' 抓取失败'}
    </span>`).join('');
}

function renderBoards() {
  const boards = state.boards;
  if (!boards) return;
  const groups = [...new Set(boards.items.map((i) => i.platform))];
  if (el.boardFilter.options.length !== groups.length + 1) {
    el.boardFilter.innerHTML = `<option value="">全部平台（${boards.items.length} 条）</option>`
      + groups.map((g) => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
  }
  const pick = el.boardFilter.value;
  const rows = boards.items.filter((i) => !pick || i.platform === pick);

  el.boardList.innerHTML = rows.map((it, i) => `
    <div class="board-row">
      <span class="no">${i + 1}</span>
      <span class="plat">${esc(it.platform)}</span>
      ${it.url
        ? `<a href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">${esc(it.title)}</a>`
        : `<span style="flex:1">${esc(it.title)}</span>`}
      <span class="heat">${formatHeat(it.heat)}</span>
    </div>`).join('');

  const when = new Date(boards.at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  el.hotMeta.textContent = `榜单更新于 ${when}`;
}

el.boardFilter.addEventListener('change', renderBoards);
el.boardRefresh.addEventListener('click', () => loadBoards(true));

const formatHeat = (n) => (!n ? '' : n >= 10000 ? `${(n / 10000).toFixed(1)} 万` : String(n));

/* ---------------- 比对 ---------------- */

el.hotRun.addEventListener('click', () => runHotspots({}));
el.manualRun.addEventListener('click', () => {
  const manual = el.manualInput.value.trim();
  if (!manual) { toast('先粘一份榜单'); return; }
  runHotspots({ manual });
});

async function runHotspots(body) {
  const persona = currentPersona();
  if (!persona) return;
  el.hotMatches.innerHTML = '<div class="idea-skeleton"></div><div class="idea-skeleton"></div>';
  await busy(body.manual ? el.manualRun : el.hotRun, async () => {
    try {
      const { hotspots } = await api(`/personas/${persona.id}/hotspots`, { method: 'POST', body });
      renderHotspots(hotspots);
      if (!body.manual) loadBoards();
    } catch (err) {
      el.hotMatches.innerHTML = `<div class="hot-note">${esc(err.message)}</div>`;
    }
  });
}

function renderHotspots(hot) {
  if (!hot) { el.hotMatches.innerHTML = ''; return; }
  renderSources(hot.sources);

  const when = new Date(hot.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  const screened = hot.screened
    ? `　·　已挡掉 ${hot.screened} 条不适合蹭的<span class="screened-peek" title="${esc((hot.screenedSample || []).map((b) => `${b.risk}：${b.title}`).join('\n'))}">（看类型）</span>`
    : '';
  const head = `<div class="hint" style="margin-bottom:4px">${when} 比对了 ${hot.total} 条热点${screened}</div>`;

  if (!hot.matches.length) {
    el.hotMatches.innerHTML = head
      + `<div class="hot-note">${esc(hot.note || '这一轮榜单里没有适合这个号蹭的热点。硬蹭不如不蹭，等下一轮。')}</div>`;
    return;
  }

  state.hotMatches = hot.matches;
  el.hotMatches.innerHTML = head + hot.matches.map((m, idx) => {
    const o = m.origin || {};
    return `
    <article class="match ${m.strength === '强' ? 'strong' : ''}">
      <div class="match-top">
        <span class="badge">${esc(o.platform || '')}</span>
        <span class="badge s-${esc(m.strength)}">关联度 ${esc(m.strength)}</span>
        ${o.heat ? `<span class="badge">热度 ${formatHeat(o.heat)}</span>` : ''}
      </div>

      <div class="match-block">
        <b>原文章</b>
        <p>${o.url
          ? `<a href="${esc(o.url)}" target="_blank" rel="noopener noreferrer">${esc(o.title)}</a>`
          : esc(o.title)}</p>
        ${o.summary
          ? `<p class="origin-summary">${esc(o.summary)}<em>${SUMMARY_SOURCE[o.summarySource] || ''}</em></p>`
          : '<p class="origin-summary muted">抓不到原文概要（平台反爬或需要 JS），动笔前请点开原文核实</p>'}
      </div>

      <div class="match-block">
        <b>蹭热点的点</b>
        <p>${esc(m.angle)}</p>
      </div>

      <div class="match-block">
        <b>选题建议</b>
        <p>${esc(m.subject)}</p>
      </div>

      ${m.caution ? `<div class="match-block caution"><b>注意分寸</b><p>${esc(m.caution)}</p></div>` : ''}

      <button class="btn primary small" data-match="${esc(String(idx))}">
        用这个题材去创作
      </button>
    </article>`;
  }).join('');
}

/* 一键把选题带回创作简报 */
el.hotMatches.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-match]');
  if (!btn) return;
  const m = state.hotMatches?.[Number(btn.dataset.match)];
  if (!m) return;
  setView('write');
  resetBrief();
  useSubject(m.subject, {
    title: m.origin?.title || '', url: m.origin?.url || '',
    platform: m.origin?.platform || '', summary: m.origin?.summary || '',
    summarySource: m.origin?.summarySource || 'none', angle: m.angle,
  });
  toast('已带回创作简报，成稿会引用这条热点');
});

/* ==================================================================
 * 成稿检查：让模型回头看一遍错字和通顺性，逐条采纳
 * ================================================================== */

const VERDICT_LABEL = { ok: '没发现问题', minor: '有几处小毛病', bad: '大面积不通顺' };
const SUMMARY_SOURCE = { board: '　来源：榜单摘要', article: '　来源：抓取原文后概括' };

el.reviewBtn.addEventListener('click', () => runReview());
el.reviewClose.addEventListener('click', () => el.reviewBox.classList.add('hidden'));

async function runReview({ silent = false } = {}) {
  const draft = state.draft;
  if (!draft?.content?.trim()) return;
  await flushSave();

  if (!silent) {
    el.reviewBox.classList.remove('hidden', 'ok', 'minor', 'bad');
    el.reviewVerdict.className = 'review-verdict';
    el.reviewVerdict.textContent = '检查中';
    el.reviewSummary.textContent = '正在通读全文…';
    el.reviewList.innerHTML = '';
    el.reviewApplyAll.classList.add('hidden');
  }

  await busy(el.reviewBtn, async () => {
    try {
      const { review } = await api(`/drafts/${draft.id}/review`, {
        method: 'POST', body: { content: draft.content },
      });
      state.review = review;
      renderReview(review);
    } catch (err) {
      el.reviewBox.classList.remove('hidden');
      el.reviewVerdict.className = 'review-verdict bad';
      el.reviewVerdict.textContent = '检查失败';
      el.reviewSummary.textContent = err.message;
      el.reviewList.innerHTML = '';
    }
  });
}

function renderReview(review) {
  const worst = review.risk === '高' ? 'bad' : review.risk === '中' ? 'minor' : review.verdict;
  el.reviewBox.classList.remove('hidden', 'ok', 'minor', 'bad');
  el.reviewBox.classList.add(worst);
  el.reviewVerdict.className = `review-verdict ${review.verdict}`;
  el.reviewVerdict.textContent = VERDICT_LABEL[review.verdict] || review.verdict;

  const hasRisk = review.risk && review.risk !== '无';
  el.reviewRisk.classList.toggle('hidden', !hasRisk);
  if (hasRisk) {
    el.reviewRisk.className = `review-risk lv-${review.risk}`;
    el.reviewRisk.textContent = `风险 ${review.risk}`;
  }
  renderFlags(review.flags || []);

  const notes = [
    review.dropped ? `${review.dropped} 条在原文里对不上` : '',
    review.padded ? `${review.padded} 条凑数提示` : '',
  ].filter(Boolean);
  el.reviewSummary.textContent = (review.summary || '')
    + (notes.length ? `　（已忽略：${notes.join('、')}）` : '');

  el.reviewApplyAll.classList.toggle('hidden', review.issues.length < 2);
  el.reviewList.innerHTML = review.issues.map((it, i) => `
    <div class="issue" data-issue="${i}">
      <div class="issue-top">
        <span class="issue-type">${esc(it.type)}</span>
        <span class="issue-why">${esc(it.why)}</span>
        ${it.count > 1 ? `<span class="issue-why">· 原文出现 ${it.count} 次，只改第一处</span>` : ''}
      </div>
      <div class="issue-diff">
        <div class="from">${esc(it.quote)}</div>
        <div class="to">${esc(it.fix)}</div>
      </div>
      <div class="issue-actions">
        <button class="btn primary small" data-apply="${i}">采纳</button>
        <button class="btn ghost small" data-skip="${i}">忽略</button>
      </div>
    </div>`).join('');
}

function renderFlags(flags) {
  el.reviewFlags.innerHTML = flags.map((f) => `
    <div class="flag lv-${esc(f.level)}">
      <div class="flag-top">
        <span class="flag-dim">${esc(f.dimension)}</span>
        <span class="flag-level">${esc(f.level)}</span>
      </div>
      <p class="flag-what">${esc(f.what)}</p>
      ${f.quote ? `<p class="flag-quote">「${esc(f.quote)}」${f.locatable ? '' : '<em>（原文里没精确匹配到，位置仅供参考）</em>'}</p>` : ''}
      <p class="flag-fix">建议：${esc(f.suggestion)}</p>
    </div>`).join('');
}

el.reviewList.addEventListener('click', (e) => {
  const apply = e.target.closest('button[data-apply]');
  const skip = e.target.closest('button[data-skip]');
  const row = e.target.closest('.issue');
  if (!row) return;
  if (apply) applyIssue(Number(apply.dataset.apply), row);
  else if (skip) row.classList.add('done');
});

el.reviewApplyAll.addEventListener('click', () => {
  const rows = [...el.reviewList.querySelectorAll('.issue:not(.done)')];
  let n = 0;
  for (const row of rows) if (applyIssue(Number(row.dataset.issue), row, true)) n++;
  renderContent();
  markDirty();
  toast(n ? `已采纳 ${n} 处` : '没有可采纳的修改');
  if (n) scheduleRecheck();
});

/* 采纳之后重新检测。
 *
 * 但**不是每采纳一条就查一次**——一条一条点的时候会连着发好几次请求，
 * 每次都是一次模型调用。所以攒 2.5 秒：停手了才查，中间再点就重新计时。
 * 期间先把结果标成"过期"，免得人对着一份已经不准的清单继续操作。 */
let recheckTimer = 0;

function scheduleRecheck() {
  clearTimeout(recheckTimer);
  el.reviewBox.classList.add('stale');
  el.reviewSummary.textContent = '正文已改，正在重新检测…';
  recheckTimer = setTimeout(async () => {
    try {
      await flushSave();        // 先落盘，否则查的还是旧正文
      await runReview({ silent: true });
    } finally {
      // 结果回来了才解封——请求还在飞的时候列表里还是旧数据
      el.reviewBox.classList.remove('stale');
    }
  }, 2500);
}

/* 只替换第一处：同一片段可能在文中出现多次，全替换风险太大 */
function applyIssue(index, row, batch = false) {
  const issue = state.review?.issues[index];
  if (!issue || !state.draft) return false;
  const raw = state.draft.content;
  if (!raw.includes(issue.quote)) {
    row.classList.add('done');
    if (!batch) toast('原文已经改过，这条对不上了');
    return false;
  }
  state.draft.content = raw.replace(issue.quote, issue.fix);
  row.classList.add('done');
  if (!batch) {
    renderContent();
    markDirty();
    toast('已采纳');
    scheduleRecheck();
  }
  return true;
}

/* ==================================================================
 * 内容栏目：账号下的几条内容线，创作时选一条
 * ================================================================== */

async function loadSections(personaId, { forPicker = true } = {}) {
  if (!personaId) {
    state.sections = [];
    el.sectionPick.classList.add('hidden');
    return;
  }
  try {
    const { sections, presets } = await api(`/personas/${personaId}/sections`);
    state.sections = sections;
    state.presets = presets;
    if (forPicker) renderSectionChips();
  } catch { /* 账号不在了就静默 */ }
}

function renderSectionChips() {
  const list = state.sections;
  const persona = currentPersona();
  el.sectionPick.classList.toggle('hidden', !persona);
  if (!persona) { state.sectionId = null; return; }
  if (!list.some((s) => s.id === state.sectionId)) {
    state.sectionId = null;
    el.sectionInputs.classList.add('hidden');
    el.sectionInputs.innerHTML = '';
  }

  el.sectionChips.innerHTML = [
    `<button type="button" class="section-chip ${state.sectionId === null ? 'on' : ''}" data-section=""
      title="不指定栏目，按账号的通用定位写">常规创作</button>`,
    ...list.map((s) => `
      <button type="button" class="section-chip ${state.sectionId === s.id ? 'on' : ''}"
        data-section="${s.id}" title="${esc(s.purpose || '')}">
        ${esc(s.name)}${s.draft_count ? `<span class="n">${s.draft_count}</span>` : ''}
      </button>`),
  ].join('');
}

el.sectionChips.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-section]');
  if (!btn) return;
  state.sectionId = btn.dataset.section ? Number(btn.dataset.section) : null;
  renderSectionChips();
  renderSectionInputs();
});

/* 选中的栏目要什么素材，就在简报里问什么 */
function renderSectionInputs(values = {}) {
  const section = state.sections.find((s) => s.id === state.sectionId);
  const fields = section?.fields || [];
  el.sectionInputs.classList.toggle('hidden', !fields.length);
  // 必须清空：留在 DOM 里的隐藏输入框会被 FormData 收走，
  // 之前还带 required，整个表单会被卡住且不给任何提示
  if (!fields.length) { el.sectionInputs.innerHTML = ''; return; }

  el.sectionInputs.innerHTML = `
    <div class="section-inputs-head">
      <b>「${esc(section.name)}」需要你提供</b>
      <span>模型只会用你在这里填的，不会自己编</span>
    </div>
    ${fields.map((f) => `
      <label>
        <span class="lab">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}
          ${f.hint ? `<em>${esc(f.hint)}</em>` : ''}</span>
        <textarea data-input="${esc(f.label)}" rows="2" maxlength="1500"
          >${esc(values[f.label] || '')}</textarea>
      </label>`).join('')}`;
}

function collectSectionInputs() {
  const out = {};
  el.sectionInputs.querySelectorAll('textarea[data-input]').forEach((t) => {
    const v = t.value.trim();
    if (v) out[t.dataset.input] = v;
  });
  return Object.keys(out).length ? out : null;
}

/* 必填的没填就别发请求，省一次调用 */
function missingRequired() {
  const section = state.sections.find((s) => s.id === state.sectionId);
  const values = collectSectionInputs() || {};
  return (section?.fields || []).filter((f) => f.required && !values[f.label]).map((f) => f.label);
}

/* ---------------- 账号设定里的栏目管理 ---------------- */

el.manageSectionsBtn.addEventListener('click', () => openSectionManager());

async function openSectionManager() {
  const persona = currentPersona();
  if (!persona) { toast('先选一个账号'); return; }
  state.sectionPersonaId = persona.id;
  el.sectionModalSub.textContent = `账号「${persona.name}」`;
  closeSectionForm();
  el.sectionList.innerHTML = '';
  el.sectionModal.classList.remove('hidden');
  await loadSections(persona.id, { forPicker: false });
  renderSectionManager();
}

function closeSectionManager() {
  el.sectionModal.classList.add('hidden');
  renderSectionChips();          // 增删过就同步到简报那排
  renderSectionInputs(collectSectionInputs() || {});
}

el.sectionModalClose.addEventListener('click', closeSectionManager);
el.sectionModal.addEventListener('click', (e) => {
  if (e.target === el.sectionModal) closeSectionManager();
});

function renderSectionManager() {
  el.sectionList.innerHTML = state.sections.map((s) => `
    <div class="section-row" data-row="${s.id}">
      <div class="info">
        <span class="nm">${esc(s.name)}</span>
        ${s.purpose ? `<span class="ps">${esc(s.purpose)}</span>` : ''}
      </div>
      ${s.draft_count ? `<span class="cnt">${s.draft_count} 篇</span>` : ''}
      <button type="button" data-edit="${s.id}">编辑</button>
      <button type="button" class="del" data-delsec="${s.id}" title="删除">×</button>
    </div>`).join('');

  const used = new Set(state.sections.map((s) => s.name));
  el.sectionPreset.innerHTML = '<option value="">自定义栏目…</option>'
    + state.presets.filter((p) => !used.has(p.name))
      .map((p) => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join('');
}

el.sectionAddBtn.addEventListener('click', () => {
  const preset = state.presets.find((p) => p.name === el.sectionPreset.value);
  openSectionForm(preset ? { ...preset } : { name: '', purpose: '', guide: '' });
});

el.sectionList.addEventListener('click', async (e) => {
  const pid = state.sectionPersonaId;
  const edit = e.target.closest('button[data-edit]');
  const del = e.target.closest('button[data-delsec]');
  if (edit) {
    const s = state.sections.find((x) => x.id === Number(edit.dataset.edit));
    if (s) openSectionForm(s, s.id);
    return;
  }
  if (!del) return;
  const s = state.sections.find((x) => x.id === Number(del.dataset.delsec));
  if (!await ask.confirm({
    title: `删除栏目「${s?.name}」？`,
    body: s?.draft_count ? `其下 ${s.draft_count} 篇创作会保留。` : '',
    ok: '删除', danger: true,
  })) return;
  try {
    const { sections } = await api(`/personas/${pid}/sections/${del.dataset.delsec}`, { method: 'DELETE' });
    state.sections = sections;
    renderSectionManager();
  } catch (err) { toast(err.message); }
});

function openSectionForm(values, id = null) {
  state.editingSection = id;
  el.sectionName.value = values.name || '';
  el.sectionPurpose.value = values.purpose || '';
  el.sectionGuide.value = values.guide || '';
  renderFieldRows(values.fields || []);
  el.sectionError.textContent = '';
  el.sectionForm.classList.remove('hidden');
  el.sectionName.focus();
}

function renderFieldRows(fields) {
  el.fieldRows.innerHTML = fields.map((f) => fieldRowHtml(f)).join('');
}

const fieldRowHtml = (f = {}) => `
  <div class="field-row">
    <input type="text" class="lbl" value="${esc(f.label || '')}" maxlength="30" placeholder="要什么，如：你的背景经历" />
    <input type="text" class="hnt" value="${esc(f.hint || '')}" maxlength="80" placeholder="给自己的提示（选填）" />
    <label class="req-box"><input type="checkbox" ${f.required ? 'checked' : ''} />必填</label>
    <button type="button" class="del" title="删掉这项">×</button>
  </div>`;

el.fieldAddBtn.addEventListener('click', () => {
  if (el.fieldRows.children.length >= 8) { toast('一个栏目最多 8 项素材'); return; }
  el.fieldRows.insertAdjacentHTML('beforeend', fieldRowHtml());
  el.fieldRows.lastElementChild.querySelector('.lbl').focus();
});

el.fieldRows.addEventListener('click', (e) => {
  if (e.target.closest('.del')) e.target.closest('.field-row').remove();
});

const collectFields = () => [...el.fieldRows.querySelectorAll('.field-row')]
  .map((row) => ({
    label: row.querySelector('.lbl').value.trim(),
    hint: row.querySelector('.hnt').value.trim(),
    required: row.querySelector('input[type="checkbox"]').checked,
  }))
  .filter((f) => f.label);

function closeSectionForm() {
  state.editingSection = null;
  el.sectionForm.classList.add('hidden');
}

el.sectionCancelBtn.addEventListener('click', closeSectionForm);

el.sectionSaveBtn.addEventListener('click', async () => {
  const personaId = state.sectionPersonaId;
  if (!personaId) return;
  const body = {
    name: el.sectionName.value.trim(),
    purpose: el.sectionPurpose.value.trim(),
    guide: el.sectionGuide.value.trim(),
    fields: collectFields(),
  };
  const id = state.editingSection;
  await busy(el.sectionSaveBtn, async () => {
    try {
      const { sections } = await api(
        id ? `/personas/${personaId}/sections/${id}` : `/personas/${personaId}/sections`,
        { method: id ? 'PUT' : 'POST', body },
      );
      state.sections = sections;
      renderSectionManager();
      closeSectionForm();
    } catch (err) {
      el.sectionError.textContent = err.message;
    }
  });
});

/* ==================================================================
 * 口播提示：语气 / 重读 / 停顿 / 表情 / 动作
 * 单独一层，正文保持干净
 * ================================================================== */

el.cuesRunBtn.addEventListener('click', runCues);

async function runCues() {
  const draft = state.draft;
  if (!draft?.content?.trim()) { toast('还没有正文'); return; }
  await flushSave();

  el.cueList.innerHTML = '<div class="idea-skeleton"></div>'.repeat(3);
  await busy(el.cuesRunBtn, async () => {
    try {
      const { cues } = await api(`/drafts/${draft.id}/cues`, { method: 'POST', body: {} });
      state.draft.cues = cues;
      renderCues(cues);
    } catch (err) {
      el.cueList.innerHTML = `<div class="ideas-state error">${esc(err.message)}</div>`;
    }
  });
}

function renderCues(cues) {
  el.cuesRunBtn.textContent = cues ? '重新生成' : '生成口播提示';
  el.copyCuesBtn.classList.toggle('hidden', !cues);
  el.prompterBtn.classList.toggle('hidden', !cues);

  if (!cues) {
    el.cuesOverall.innerHTML = '';
    el.cueList.innerHTML = '';
    return;
  }

  const o = cues.overall || {};
  el.cuesOverall.innerHTML = [
    ['整体基调', o.tone], ['语速节奏', o.pace], ['出镜提醒', o.note],
  ].filter(([, v]) => v)
    .map(([k, v]) => `<div class="row"><b>${k}</b><span>${esc(v)}</span></div>`).join('')
    + (cues.coverage < 60
      ? `<div class="cues-note">只覆盖了正文约 ${cues.coverage}%——标题、标签这类不念的内容会跳过</div>` : '');

  el.cueList.innerHTML = cues.cues.map((c, i) => {
    const marks = [
      c.emotion ? ['emotion', '语气', c.emotion] : null,
      c.stress?.length ? ['stress', '重读', c.stress.join('、')] : null,
      c.pause ? ['pause', '停顿', c.pause] : null,
      c.expression ? ['exp', '表情', c.expression] : null,
      c.gesture ? ['ges', '动作', c.gesture] : null,
    ].filter(Boolean);

    return `
    <div class="cue" data-cue="${i}">
      <div class="cue-text">${highlightStress(c.quote, c.stress)}</div>
      <div class="cue-marks">${marks
        .map(([cls, k, v]) => `<span class="cue-mark ${cls}"><b>${k}</b>${esc(v)}</span>`).join('')}</div>
    </div>`;
  }).join('');
}

/* 把要重读的词标出来（先转义再替换，避免把标签打散） */
function highlightStress(quote, stress = []) {
  let html = esc(quote);
  for (const word of stress) {
    const safe = esc(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (safe) html = html.replace(new RegExp(safe, 'g'), (m) => `<mark>${m}</mark>`);
  }
  return html;
}

/* 导出成可以直接照着念的稿子 */
el.copyCuesBtn.addEventListener('click', async () => {
  const cues = state.draft?.cues;
  if (!cues) return;
  const o = cues.overall || {};
  const head = [
    `【整体基调】${o.tone || '—'}`,
    `【语速节奏】${o.pace || '—'}`,
    o.note ? `【出镜提醒】${o.note}` : null,
  ].filter(Boolean).join('\n');

  const body = cues.cues.map((c) => {
    const marks = [
      c.emotion ? `语气：${c.emotion}` : null,
      c.stress?.length ? `重读：${c.stress.join('、')}` : null,
      c.pause ? `停顿：${c.pause}` : null,
      c.expression ? `表情：${c.expression}` : null,
      c.gesture ? `动作：${c.gesture}` : null,
    ].filter(Boolean).join('　');
    return `${c.quote}\n（${marks}）`;
  }).join('\n\n');

  try {
    await navigator.clipboard.writeText(`${head}\n\n${'—'.repeat(20)}\n\n${body}\n`);
    toast('口播稿已复制');
  } catch {
    toast('复制失败，请手动选中');
  }
});

/* ==================================================================
 * 提词器：把口播提示切好的段落全屏滚动播出来
 * ================================================================== */

const PROMPTER_DEFAULTS = { speed: 40, size: 40, cues: true, mirror: false };

const prompter = {
  raf: null,
  playing: false,
  offset: 0,
  last: 0,
  max: 0,
  wakeLock: null,
  cfg: { ...PROMPTER_DEFAULTS },
};

function loadPrompterCfg() {
  try {
    const saved = JSON.parse(localStorage.getItem('cw.prompter') || 'null');
    if (saved) prompter.cfg = { ...PROMPTER_DEFAULTS, ...saved };
  } catch { /* 用默认值 */ }
}

const savePrompterCfg = () => localStorage.setItem('cw.prompter', JSON.stringify(prompter.cfg));

el.prompterBtn.addEventListener('click', openPrompter);

function openPrompter() {
  const cues = state.draft?.cues;
  if (!cues?.cues?.length) { toast('先生成口播提示'); return; }
  loadPrompterCfg();

  el.pBody.innerHTML = cues.cues.map((c) => {
    const marks = [
      c.emotion ? ['语气', c.emotion] : null,
      c.pause ? ['停顿', c.pause] : null,
      c.expression ? ['表情', c.expression] : null,
      c.gesture ? ['动作', c.gesture] : null,
    ].filter(Boolean);
    return `
    <div class="pseg">
      <div class="pseg-text">${highlightStress(c.quote, c.stress)}</div>
      ${marks.length ? `<div class="pseg-cues">${marks
        .map(([k, v]) => `<span><b>${k}</b> ${esc(v)}</span>`).join('')}</div>` : ''}
    </div>`;
  }).join('');

  el.prompter.classList.remove('hidden');
  applyPrompterCfg();
  resetPrompter();
  requestWakeLock();
  // 布局稳定后再量高度
  setTimeout(measurePrompter, 60);
}

function applyPrompterCfg() {
  const { size, cues, mirror, speed } = prompter.cfg;
  el.pBody.style.fontSize = `${size}px`;
  el.prompter.classList.toggle('no-cues', !cues);
  el.prompter.classList.toggle('mirrored', mirror);
  applyTransform();
  el.pCues.classList.toggle('on', cues);
  el.pCues.textContent = cues ? '提示 开' : '提示 关';
  el.pMirror.classList.toggle('on', mirror);
  el.pSpeedVal.textContent = speed;
  el.pSizeVal.textContent = size;
  measurePrompter();
}

/* 手动挪动画面：播放中也能用，挪完接着按新位置滚 */
function nudge(delta) {
  prompter.offset = clamp(prompter.offset + delta, 0, prompter.max);
  applyTransform();
  updateProgress();
}

/* 一行的高度 —— .pseg-text 的 line-height 是 1.55 */
const lineStep = () => Math.round(prompter.cfg.size * 1.55);

/* 滚动位移和镜像必须写在同一个 transform 里：
   行内 transform 会整个覆盖 CSS 里的规则，分开写镜像就没了 */
function applyTransform() {
  const flip = prompter.cfg.mirror ? ' scaleX(-1)' : '';
  el.pBody.style.transform = `translateY(${-prompter.offset}px)${flip}`;
}

/* 滚到最后一段能停在阅读线上就够了，不用把整块留白都滚完 */
function measurePrompter() {
  const last = el.pBody.lastElementChild;
  prompter.max = last
    ? Math.max(0, last.offsetTop + last.offsetHeight - el.pStage.clientHeight * 0.32)
    : 0;
  updateProgress();
}

function resetPrompter() {
  pausePrompter();
  prompter.offset = 0;
  applyTransform();
  updateProgress();
}

function updateProgress() {
  const pct = prompter.max ? Math.min(100, Math.round((prompter.offset / prompter.max) * 100)) : 0;
  el.pProgress.textContent = `${pct}%`;
}

function playPrompter() {
  if (prompter.playing) return;
  prompter.playing = true;
  prompter.last = performance.now();
  el.pPlay.textContent = '❚❚ 暂停';
  const step = (now) => {
    if (!prompter.playing) return;
    const dt = (now - prompter.last) / 1000;
    prompter.last = now;
    prompter.offset = Math.min(prompter.max, prompter.offset + prompter.cfg.speed * dt);
    applyTransform();
    updateProgress();
    if (prompter.offset >= prompter.max) { pausePrompter(); return; }
    prompter.raf = requestAnimationFrame(step);
  };
  prompter.raf = requestAnimationFrame(step);
}

function pausePrompter() {
  prompter.playing = false;
  if (prompter.raf) cancelAnimationFrame(prompter.raf);
  prompter.raf = null;
  el.pPlay.textContent = '▶ 开始';
}

const togglePrompter = () => (prompter.playing ? pausePrompter() : playPrompter());

function closePrompter() {
  pausePrompter();
  el.prompter.classList.add('hidden');
  releaseWakeLock();
}

/* 录制时别让屏幕睡过去 */
async function requestWakeLock() {
  try { prompter.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* 不支持就算了 */ }
}
function releaseWakeLock() {
  try { prompter.wakeLock?.release(); } catch { /* 忽略 */ }
  prompter.wakeLock = null;
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

function bump(key, delta, lo, hi) {
  prompter.cfg[key] = clamp(prompter.cfg[key] + delta, lo, hi);
  savePrompterCfg();
  applyPrompterCfg();
}

el.pPlay.addEventListener('click', togglePrompter);
el.pRestart.addEventListener('click', resetPrompter);
el.pClose.addEventListener('click', closePrompter);
el.pCues.addEventListener('click', () => {
  prompter.cfg.cues = !prompter.cfg.cues;
  savePrompterCfg();
  applyPrompterCfg();
});
el.pMirror.addEventListener('click', () => {
  prompter.cfg.mirror = !prompter.cfg.mirror;
  savePrompterCfg();
  applyPrompterCfg();
});
el.prompter.addEventListener('click', (e) => {
  const speed = e.target.closest('button[data-speed]');
  const size = e.target.closest('button[data-size]');
  if (speed) bump('speed', Number(speed.dataset.speed) * 5, 10, 200);
  if (size) bump('size', Number(size.dataset.size) * 4, 20, 96);
});

/* 点画面本身也能播放/暂停，录制时不用去够按钮 */
el.pStage.addEventListener('click', togglePrompter);

window.addEventListener('resize', () => {
  if (!el.prompter.classList.contains('hidden')) measurePrompter();
});

const PROMPTER_KEYS = [
  ' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End',
  '[', ']', '【', '】', '+', '=', '-', 'r', 'R', 'm', 'M', 'c', 'C', 'Escape',
];

document.addEventListener('keydown', (e) => {
  if (el.prompter.classList.contains('hidden')) return;
  if (!PROMPTER_KEYS.includes(e.key)) return;
  e.preventDefault();

  const page = Math.round(el.pStage.clientHeight * 0.8);
  switch (e.key) {
    // 上下键直接挪画面：念快了往回一点，念慢了往前赶一点
    case 'ArrowUp': nudge(-lineStep()); break;
    case 'ArrowDown': nudge(lineStep()); break;
    case 'PageUp': nudge(-page); break;
    case 'PageDown': nudge(page); break;
    case 'Home': nudge(-prompter.max); break;
    case 'End': nudge(prompter.max); break;

    // 速度挪到中括号上，腾出上下键
    case '[': case '【': bump('speed', -5, 10, 200); break;
    case ']': case '】': bump('speed', 5, 10, 200); break;

    case ' ': togglePrompter(); break;
    case '+': case '=': bump('size', 4, 20, 96); break;
    case '-': bump('size', -4, 20, 96); break;
    case 'r': case 'R': resetPrompter(); break;
    case 'm': case 'M': el.pMirror.click(); break;
    case 'c': case 'C': el.pCues.click(); break;
    case 'Escape': closePrompter(); break;
    default: break;
  }
});

/* 滚轮也能挪，录制时手边有鼠标就不用找键盘 */
el.pStage.addEventListener('wheel', (e) => {
  e.preventDefault();
  nudge(e.deltaY);
}, { passive: false });

/* ==================================================================
 * 多平台版本
 *
 * 一份账号设定、一篇成稿，出多个平台的版本。
 * 后端走的是"适配改写"而不是各平台各生成一遍——事实层不动，只重排结构和语气。
 * 前端这边：勾平台 → 一个一个生成（失败就停）→ 版本之间切着看。
 * ================================================================== */

const ver = { current: '' };          // '' = 原文；否则是平台 key

el.multiBtn.addEventListener('click', () => {
  if (!state.draft?.content) { toast('先生成正文'); return; }
  state.multiOpen = !state.multiOpen;
  renderMultiBar();
});

function renderMultiBar() {
  const open = Boolean(state.multiOpen && state.draft?.content);
  el.multiBar.classList.toggle('hidden', !open);
  if (!open) return;

  const own = state.draft.platform;
  const made = state.draft.variants || {};
  el.multiPick.innerHTML = (state.meta?.platforms || [])
    .filter((p) => p.key !== own)     // 账号自己的平台就是原文，不用再改一遍
    .map((p) => {
      const got = made[p.key];
      return `<label class="${got ? 'done' : ''}">
        <input type="checkbox" value="${esc(p.key)}"${got ? '' : ' checked'}>
        ${esc(p.label)}<em>${got ? '已生成 · 勾上重做' : `${p.length}字`}</em>
      </label>`;
    }).join('');
  el.multiHint.textContent = `原文是「${platformLabel(own)}」版本，事实层不会改，只重排结构和语气`;
}

el.multiRunBtn.addEventListener('click', async () => {
  const picked = [...el.multiPick.querySelectorAll('input:checked')].map((i) => i.value);
  if (!picked.length) { toast('先勾几个平台'); return; }

  await busy(el.multiRunBtn, async () => {
    let done = 0;
    for (const key of picked) {
      el.multiHint.textContent = `正在改写「${platformLabel(key)}」…（${done + 1}/${picked.length}）`;
      try {
        // eslint-disable-next-line no-await-in-loop
        const { variant } = await api(`/drafts/${state.draft.id}/variants`,
          { method: 'POST', body: { platform: key } });
        state.draft.variants = { ...(state.draft.variants || {}), [key]: variant };
        done += 1;
        renderVersionTabs();
      } catch (err) {
        // 一个一个来，失败就停——每次都是一次模型调用，不闷头烧
        el.multiHint.textContent = `「${platformLabel(key)}」失败：${err.message}`;
        toast(`${platformLabel(key)} 失败，先停下了`);
        return;
      }
    }
    renderMultiBar();
    renderVersionTabs();
    el.multiHint.textContent = `好了，生成了 ${done} 个版本`;
    toast(`${done} 个平台版本已生成`);
  });
});

/* 版本切换条。原文和各平台版本平级放，不做主次之分——
   发哪个平台哪个就是正文，没有"正本"这回事。 */
function renderVersionTabs() {
  const made = state.draft?.variants || {};
  const keys = Object.keys(made);
  el.verTabs.classList.toggle('hidden', !keys.length || !state.draft?.content);
  if (!keys.length) { ver.current = ''; return; }

  const own = state.draft.platform;
  const nowChars = (state.draft.content || '').length;
  const tab = (key, label, chars, stale) => `<button data-ver="${esc(key)}"
    class="${ver.current === key ? 'on' : ''}${stale ? ' stale' : ''}"
    ${stale ? 'title="正文在这一版之后改过，内容可能对不上了——重做一次"' : ''}>${esc(label)}<i>${
  stale ? '需重做' : `${chars}字`}</i></button>`;

  el.verTabs.innerHTML = tab('', `${platformLabel(own)}（原文）`, nowChars, false)
    + keys.map((k) => tab(k, platformLabel(k), made[k].chars,
      // 优先比对生成时保存的正文指纹；旧数据回落到裁剪后的长度。
      variantIsStale(made[k], state.draft.content))).join('');
}

el.verTabs.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-ver]');
  if (!b) return;
  ver.current = b.dataset.ver;
  renderVersionTabs();
  renderIllusBar();          // 配图是挂在版本上的，切版本就换一套
  showVersion();
});

/* 切版本只换阅读区的内容——编辑、口播那些始终针对原文，
   否则"编辑的是哪一版"会变成一笔糊涂账 */
function showVersion() {
  const made = state.draft?.variants || {};
  const text = ver.current ? made[ver.current]?.content : state.draft?.content;
  el.content.innerHTML = withIllus(text || '');
  el.counter.textContent = `${(text || '').length} 字`;
  const other = Boolean(ver.current);
  updateActionLabels();
  // 检查/学习/多平台都以原文为准；看别的版本时禁掉，别让人以为在对当前这版操作。
  // 配图是按版本来的，所以不禁。
  [el.reviewBtn, el.learnBtn, el.multiBtn].forEach((b) => { b.disabled = other; });
  el.multiBtn.title = other ? '多平台版本从原文改写，先切回原文' : '把这篇改成其它平台的版本';
  el.cuesPane?.classList.toggle('hidden', other || state.mode !== 'cue');
}

/* ==================================================================
 * 图文配图
 *
 * 配图挂在**版本**上：公众号要配图，微博通常不需要，
 * 两边该插几张、插在哪也不一样。所以切版本 = 换一套配图。
 * ================================================================== */

const ill = { info: null };
const verOf = () => (ver.current || '__main__');
const illOf = () => state.draft?.illus?.[verOf()] || null;

el.illusBtn.addEventListener('click', async () => {
  const text = ver.current ? state.draft?.variants?.[ver.current]?.content : state.draft?.content;
  if (!text) { toast('这一版还没有正文'); return; }
  state.illusOpen = !state.illusOpen;
  if (!state.illusOpen) { renderIllusBar(); showVersion(); return; }
  try { ill.info = (await api('/images')).image; } catch { /* 通道信息拿不到不影响 */ }
  if (!illOf()) await planIllus();
  else renderIllusBar();
});

async function planIllus() {
  await busy(el.illusPlanBtn, async () => {
    try {
      const { illus, image } = await api(`/drafts/${state.draft.id}/illus`,
        { method: 'POST', body: { version: ver.current } });
      state.draft.illus = { ...(state.draft.illus || {}), [verOf()]: illus };
      if (image) ill.info = image;
      renderIllusBar();
      showVersion();
    } catch (err) { toast(err.message); }
  });
}
el.illusPlanBtn.addEventListener('click', planIllus);

function renderIllusBar() {
  const open = Boolean(state.illusOpen);
  el.illusBar.classList.toggle('hidden', !open);
  if (!open) return;
  const store = illOf();
  el.illusChip.textContent = ill.info?.label || '';
  el.illusChip.classList.toggle('warn', ill.info && !ill.info.live);
  if (!store) { el.illusHint.textContent = '正在排版位…'; el.illusList.innerHTML = ''; return; }

  const done = store.items.filter((i) => i.image).length;
  el.illusHint.textContent = `${store.items.length} 张 · 已出 ${done}`
    + (store.capped ? ` · 模型给了 ${store.capped.asked} 个位置，按字数砍到 ${store.capped.cap}` : '')
    + (store.look ? ` · ${store.look}` : '');

  el.illusList.innerHTML = store.items.map((it) => `
    <div class="illus-row">
      ${it.image
    ? `<img src="/image/${esc(it.image.file)}?v=${encodeURIComponent(it.image.at)}" alt="">`
    : '<div class="ph">未出图</div>'}
      <div class="body">
        <div class="where">插在「${esc(it.anchor.slice(0, 16))}…」之后${it.alt ? ` · 图注：${esc(it.alt)}` : ''}</div>
        <textarea data-ill="${it.i}" rows="2">${esc(it.prompt)}</textarea>
      </div>
      <button class="mini" data-illimg="${it.i}">${it.image ? '重出' : '出这张'}</button>
    </div>`).join('');
}

el.illusList.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-illimg]');
  if (b) makeIllus(Number(b.dataset.illimg), b);
});

/* 改提示词只存在本地，等点出图时才带过去——避免每敲一下就打一次接口 */
el.illusList.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.ill === undefined) return;
  const store = illOf();
  if (store) store.items[Number(t.dataset.ill)].prompt = t.value;
});

async function makeIllus(i, btn) {
  const label = btn?.textContent;
  if (btn) { btn.disabled = true; btn.textContent = '出图中…'; }
  try {
    const { image } = await api(`/drafts/${state.draft.id}/illus/${i}/image`,
      { method: 'POST', body: { version: ver.current } });
    const store = illOf();
    store.items[i] = { ...store.items[i], image };
    renderIllusBar();
    showVersion();
    updateActionLabels();
    return true;
  } catch (err) {
    el.illusHint.textContent = `第 ${i + 1} 张：${err.message}`;
    return false;
  } finally {
    if (btn && btn.isConnected) { btn.disabled = false; btn.textContent = label; }
  }
}

/* 一张一张来，失败就停——出图按张计费 */
el.illusRunBtn.addEventListener('click', async () => {
  const store = illOf();
  const todo = (store?.items || []).filter((i) => !i.image);
  if (!todo.length) { toast('每张都出过了'); return; }
  if (ill.info?.live && !await ask.confirm({ title: `要出 ${todo.length} 张图`, body: '按张计费。', ok: '开始出图' })) return;
  await busy(el.illusRunBtn, async () => {
    for (const it of todo) {
      el.illusHint.textContent = `正在出第 ${it.i + 1} 张…`;
      // eslint-disable-next-line no-await-in-loop
      if (!await makeIllus(it.i, null)) { toast(`第 ${it.i + 1} 张失败，先停下了`); return; }
    }
    renderIllusBar();
  });
});

/* 把插图插进正文：按 anchor 在原文里的位置切开，逐段拼。
   在**渲染后的 HTML** 上找插入点不可靠（markdown 会改结构），
   所以先在纯文本上切，再分段渲染。 */
function withIllus(text) {
  const store = illOf();
  const items = (store?.items || []).filter((it) => it.at >= 0);
  if (!items.length) return markdown(text);

  const fig = (it) => (it.image
    ? `<figure class="illus"><img src="/image/${esc(it.image.file)}?v=${encodeURIComponent(it.image.at)}" alt="${esc(it.alt)}">${
      it.alt ? `<figcaption>${esc(it.alt)}</figcaption>` : ''}</figure>`
    : `<figure class="illus empty">第 ${it.i + 1} 张还没出图 · ${esc(it.alt || it.prompt.slice(0, 24))}</figure>`);

  // anchor 是"这一段的开头"，图要插在这一段**之后**——找到该段的段末换行
  const cuts = items.map((it) => {
    const end = text.indexOf('\n', it.at + it.anchor.length);
    return { at: end < 0 ? text.length : end, it };
  }).sort((a, b) => a.at - b.at);

  let out = '';
  let from = 0;
  for (const c of cuts) {
    out += markdown(text.slice(from, c.at)) + fig(c.it);
    from = c.at;
  }
  return out + markdown(text.slice(from));
}


/* 吸顶状态：贴到顶了才给分隔线和投影，没贴住时保持干净。
   用 IntersectionObserver 而不是 scroll 事件——后者每帧都要算，这里只需要知道"越界了没有"。 */
if (el.headStick) {
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;pointer-events:none';
  el.headStick.parentElement.style.position = 'relative';
  el.headStick.parentElement.prepend(sentinel);
  new IntersectionObserver(([e]) => {
    el.headStick.classList.toggle('stuck', !e.isIntersecting);
  }, {
    // 和 CSS 里的 --topbar-h 保持一致，别在两个地方各写一个数
    rootMargin: `-${getComputedStyle(document.documentElement).getPropertyValue('--topbar-h').trim() || '66px'} 0px 0px 0px`,
    threshold: 0,
  }).observe(sentinel);
}


/* ==================================================================
 * 三动作工具条：修改 / 确认 / 导出
 *
 * 之前一排八个按钮平铺，等于把八个决定同时摆在人面前。
 * 现在只问一件事：这稿你是要改、认了、还是拿走？
 * 认了之后再问"接下来做什么"，拿走之前再问"要什么格式"——一次一个决定。
 * ================================================================== */

const closeMenus = () => {
  [el.confirmMenu, el.exportMenu].forEach((m) => m?.classList.add('hidden'));
};

function toggleMenu(menu) {
  const open = menu.classList.contains('hidden');
  closeMenus();
  if (open) menu.classList.remove('hidden');
}

el.confirmBtn.addEventListener('click', (e) => { e.stopPropagation(); syncConfirmMenu(); toggleMenu(el.confirmMenu); });
el.exportBtn.addEventListener('click', (e) => { e.stopPropagation(); toggleMenu(el.exportMenu); });
document.addEventListener('click', (e) => { if (!e.target.closest('.menu-wrap')) closeMenus(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });

/* 菜单打开前先把不可用的项灰掉，并说明为什么——比点了没反应强 */
function syncConfirmMenu() {
  const onVariant = Boolean(ver.current);
  const has = (a) => el.confirmMenu.querySelector(`[data-act="${a}"]`);
  // 口播、学习、多平台都针对原文；配图是按版本来的
  for (const a of ['cues', 'multi', 'learn', 'review']) {
    const b = has(a);
    b.disabled = onVariant;
    b.title = onVariant ? '这几项都针对原文，先切回原文版本' : '';
  }
  has('archive').disabled = Boolean(state.draft?.archived_at);
}

el.confirmMenu.addEventListener('click', async (e) => {
  const b = e.target.closest('button[data-act]');
  if (!b || b.disabled) return;
  closeMenus();
  const act = b.dataset.act;
  if (act === 'cues') { setMode('cue'); if (!state.draft?.cues) el.cuesRunBtn.click(); return; }
  if (act === 'multi') { state.multiOpen = true; renderMultiBar(); return; }
  if (act === 'illus') { el.illusBtn.click(); return; }
  if (act === 'learn') { el.learnBtn.click(); return; }
  if (act === 'review') { el.reviewBtn.click(); return; }
  if (act === 'metrics') { openMetrics(); return; }
  if (act === 'archive') await archiveCurrent();
});

async function archiveCurrent() {
  if (!state.draft?.id) return;
  try {
    await api(`/drafts/${state.draft.id}/archive`, { method: 'POST', body: { archived: true } });
    state.draft.archived_at = new Date().toISOString();
    toast('已归档，可以在「已归档」里找回');
    loadHistory();
  } catch (err) { toast(err.message); }
}

el.exportMenu.addEventListener('click', (e) => {
  const b = e.target.closest('button[data-fmt]');
  if (!b) return;
  closeMenus();
  const fmt = b.dataset.fmt;
  if (fmt === 'copy') el.copyBtn.click();
  else if (fmt === 'pdf') exportPdf();
  else downloadAs(fmt);          // md / html
});

/* PDF 走浏览器打印。
   自己生成 PDF 字节流要嵌中文字体，体积和复杂度都不划算；
   交给浏览器排版，中文断行和图片都是对的，用户在弹窗里选「另存为 PDF」。 */
function exportPdf() {
  el.toolHint.textContent = '打印窗口里选「目标：另存为 PDF」';
  setTimeout(() => { window.print(); }, 60);
  setTimeout(() => { el.toolHint.textContent = ''; }, 6000);
}

/* ---------------- 模式：修改 / 返回阅读 ---------------- */

el.editBtn.addEventListener('click', () => setMode('edit'));
el.backReadBtn.addEventListener('click', () => setMode('read'));

/* 模式变了就更新工具条的样子——哪个按钮该出现、指示器写什么 */
function syncModeUi(mode) {
  const reading = mode === 'read';
  const editing = mode === 'edit';
  el.editBtn.classList.toggle('hidden', !reading);
  el.backReadBtn.classList.toggle('hidden', reading);
  el.modeNow.classList.toggle('hidden', reading);
  el.modeNow.textContent = editing ? '编辑中' : mode === 'cue' ? '口播' : '';
  // 保存只在编辑时有意义，跟着模式露出/收起
  el.saveBtn.classList.toggle('hidden', !editing);
  el.saveState.classList.toggle('hidden', !editing);
}


/* 完整设定默认折起来——侧栏是长期占屏的东西，平时用不着把整份设定摊在那儿 */
el.personaMoreBtn.addEventListener('click', () => {
  state.personaOpen = !state.personaOpen;
  el.personaMoreBtn.setAttribute('aria-expanded', String(state.personaOpen));
  el.personaMoreBtn.firstChild.textContent = state.personaOpen ? '收起完整设定 ' : '展开完整设定 ';
  el.personaSummary.classList.toggle('hidden', !state.personaOpen);
});

/* ==================================================================
 * 素材库
 *
 * 存的是作者的真实经历、数据、案例——写作时按题材召回，
 * 拼进 user 消息，和栏目素材同属"唯一可信的事实来源"那一层。
 * 素材越厚，能写的真东西越多，模型编造的余地越小。
 * ================================================================== */

const mat = { list: [], kinds: [], editing: null };

async function loadMaterials(personaId) {
  if (!personaId) { mat.list = []; renderMaterials(); return; }
  try {
    const { materials, kinds } = await api(`/personas/${personaId}/materials`);
    mat.list = materials;
    mat.kinds = kinds;
    if (!el.matKind.options.length) {
      el.matKind.innerHTML = kinds.map((k) => `<option>${esc(k)}</option>`).join('');
    }
  } catch { mat.list = []; }
  renderMaterials();
}

function renderMaterials() {
  el.matList.innerHTML = mat.list.map((m) => (mat.editing === m.id ? `
    <div class="mat-item editing" data-mat="${m.id}">
      <div class="mat-head">
        <select data-f="kind">${mat.kinds.map((k) =>
    `<option${k === m.kind ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>
        <input data-f="title" value="${esc(m.title)}" maxlength="80">
      </div>
      <textarea data-f="body" rows="3" maxlength="4000">${esc(m.body)}</textarea>
      <div class="mat-add-foot">
        <input data-f="tags" value="${esc(m.tags)}" maxlength="200" placeholder="标签，逗号分隔">
        <button class="mini" data-save="${m.id}">保存</button>
        <button class="mini" data-cancel="1">取消</button>
      </div>
    </div>` : `
    <div class="mat-item" data-mat="${m.id}">
      <div class="mat-head">
        <span class="mat-kind">${esc(m.kind)}</span>
        <b>${esc(m.title)}</b>
        ${m.used_count ? `<span class="mat-used">用过 ${m.used_count} 次</span>` : ''}
        <span class="mat-acts">
          <button class="mini" data-edit="${m.id}">改</button>
          <button class="mini" data-del="${m.id}">删</button>
        </span>
      </div>
      <p>${esc(m.body)}</p>
      ${m.tags ? `<div class="mat-tags">${m.tags.split(/[,，]/).filter(Boolean)
    .map((t) => `<span>${esc(t.trim())}</span>`).join('')}</div>` : ''}
    </div>`)).join('');

  const used = mat.list.filter((m) => m.used_count).length;
  el.matHint.textContent = mat.list.length
    ? `共 ${mat.list.length} 条，其中 ${used} 条被写进过稿子。写作时按题材自动召回最相关的几条，用不上的不会硬塞。`
    : '还没有素材。存几条真实的经历、数据、案例——这是模型唯一能拿来写"真东西"的来源。';
}

el.matSaveBtn.addEventListener('click', () => busy(el.matSaveBtn, async () => {
  el.matError.textContent = '';
  const body = {
    kind: el.matKind.value, title: el.matTitle.value.trim(),
    body: el.matBody.value.trim(), tags: el.matTags.value.trim(),
  };
  if (!body.title || !body.body) { el.matError.textContent = '标题和内容都要填'; return; }
  try {
    await api(`/personas/${state.editingId}/materials`, { method: 'POST', body });
    el.matTitle.value = ''; el.matBody.value = ''; el.matTags.value = '';
    await loadMaterials(state.editingId);
    toast('已存进素材库');
  } catch (err) { el.matError.textContent = err.message; }
}));

el.matList.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.dataset.edit) { mat.editing = Number(t.dataset.edit); renderMaterials(); return; }
  if (t.dataset.cancel) { mat.editing = null; renderMaterials(); return; }
  if (t.dataset.del) {
    const m = mat.list.find((x) => x.id === Number(t.dataset.del));
    if (!await ask.confirm({ title: `删掉素材「${m?.title}」？`, ok: '删除', danger: true })) return;
    try { await api(`/materials/${t.dataset.del}`, { method: 'DELETE' }); await loadMaterials(state.editingId); } catch (err) { toast(err.message); }
    return;
  }
  if (t.dataset.save) {
    const box = t.closest('[data-mat]');
    const f = (n) => box.querySelector(`[data-f="${n}"]`).value.trim();
    try {
      await api(`/materials/${t.dataset.save}`, { method: 'PUT',
        body: { kind: f('kind'), title: f('title'), body: f('body'), tags: f('tags') } });
      mat.editing = null;
      await loadMaterials(state.editingId);
      toast('已更新');
    } catch (err) { toast(err.message); }
  }
});

/* ==================================================================
 * 选题池与排期
 *
 * 热点里看到的机会、推荐里想留的题材，不当场写就丢了。
 * 池子负责"攒"，日期负责"排到哪天"——空日期就只是待选。
 * 刻意不做完整日历：自媒体的排期粒度就是"这周写哪几条"。
 * ================================================================== */

const pool = { list: [], open: false };
const today = () => new Date().toISOString().slice(0, 10);

async function loadPool() {
  try {
    const q = state.personaId ? `?persona=${state.personaId}` : '';
    pool.list = (await api(`/pool${q}`)).pool;
  } catch { pool.list = []; }
  renderPool();
}

function renderPool() {
  const undone = pool.list.filter((x) => x.status !== 'done');
  const due = undone.filter((x) => x.plan_date && x.plan_date <= today()).length;
  el.poolNote.textContent = pool.list.length
    ? `${undone.length} 条待写${due ? ` · ${due} 条到期` : ''}`
    : '空的';
  el.poolToggle.textContent = pool.open ? '收起 ▴' : '展开 ▾';
  el.poolList.classList.toggle('hidden', !pool.open);
  if (!pool.open) return;

  el.poolList.innerHTML = (pool.list.length ? pool.list.map((x) => {
    const overdue = x.plan_date && x.plan_date <= today() && x.status !== 'done';
    return `
    <div class="pool-row ${overdue ? 'today' : ''} ${x.status === 'done' ? 'done' : ''}" data-pool="${x.id}">
      <span class="src">${esc(x.source)}</span>
      <span class="subj" title="${esc(x.note || '')}">${esc(x.subject)}</span>
      <input type="date" value="${esc(x.plan_date)}" data-date="${x.id}" title="排到哪天，留空就只是待选">
      <button class="mini" data-write="${x.id}">写这条</button>
      <button class="mini" data-poolrm="${x.id}">删</button>
    </div>`;
  }).join('') : '<div class="pool-empty">还没攒选题。热点板块里看到能蹭的、推荐题材里想留的，都可以先存进来。</div>')
    + `<div class="pool-add">
        <input id="poolInput" placeholder="想到什么先记一条，回车存入">
        <button class="btn ghost small" type="button" id="poolAddBtn">存入</button>
      </div>`;
}

el.poolToggle.addEventListener('click', () => { pool.open = !pool.open; renderPool(); });

async function addPool(subject, source = '手动', note = '') {
  if (!subject.trim()) return;
  try {
    await api('/pool', { method: 'POST', body: { subject, source, note, persona_id: state.personaId } });
    pool.open = true;
    await loadPool();
    toast('已存进选题池');
  } catch (err) { toast(err.message); }
}

el.poolList.addEventListener('click', async (e) => {
  const t = e.target;
  if (t.id === 'poolAddBtn') { await addPool($('poolInput').value); return; }
  if (t.dataset.poolrm) {
    try { await api(`/pool/${t.dataset.poolrm}`, { method: 'DELETE' }); await loadPool(); } catch (err) { toast(err.message); }
    return;
  }
  if (t.dataset.write) {
    // 「写这条」= 把题材填进简报并标记为已用，不自动生成——生成要花钱，让人自己按
    const x = pool.list.find((i) => i.id === Number(t.dataset.write));
    if (!x) return;
    goStep(1);
    el.briefForm.subject.value = x.subject;
    el.briefForm.subject.focus();
    try { await api(`/pool/${x.id}`, { method: 'PUT', body: { status: 'done' } }); await loadPool(); } catch { /* 标记失败不影响填入 */ }
  }
});

el.poolList.addEventListener('change', async (e) => {
  if (!e.target.dataset.date) return;
  try {
    await api(`/pool/${e.target.dataset.date}`, { method: 'PUT', body: { plan_date: e.target.value } });
    await loadPool();
  } catch (err) { toast(err.message); }
});

el.poolList.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.id === 'poolInput') { e.preventDefault(); addPool(e.target.value); }
});

/* ==================================================================
 * 发布数据回填与复盘
 *
 * 产品原来到"导出"就断了。回填几个数字，才能回答"什么有效"——
 * 语气档案学的是"你怎么写"，这个学的是"哪种写法数据好"。
 * ================================================================== */

let metricFields = [];

async function openMetrics() {
  if (!state.draft?.id) return;
  if (!metricFields.length) {
    try { metricFields = (await api('/metrics')).fields; } catch { return; }
  }
  const m = state.draft.metrics || {};
  el.metricsDate.value = state.draft.published_at || new Date().toISOString().slice(0, 10);
  el.metricsNote.value = m.note || '';
  el.metricsFields.innerHTML = metricFields.map((f) => `
    <label>${esc(f.label)}
      <input type="number" min="0" data-metric="${esc(f.key)}"
        value="${m[f.key] ?? ''}" placeholder="留空不记">
    </label>`).join('');
  el.metricsModal.classList.remove('hidden');
}

el.metricsClose.addEventListener('click', () => el.metricsModal.classList.add('hidden'));
el.metricsSave.addEventListener('click', () => busy(el.metricsSave, async () => {
  const body = { published_at: el.metricsDate.value, note: el.metricsNote.value };
  el.metricsFields.querySelectorAll('[data-metric]').forEach((i) => {
    if (i.value !== '') body[i.dataset.metric] = Number(i.value);
  });
  try {
    const out = await api(`/drafts/${state.draft.id}/metrics`, { method: 'POST', body });
    state.draft.metrics = out.metrics;
    state.draft.published_at = out.published_at;
    el.metricsModal.classList.add('hidden');
    toast(out.metrics ? '已记下' : '已撤销这次回填');
  } catch (err) { toast(err.message); }
}));

/* ---------------- 复盘 ---------------- */

el.insightsLink.addEventListener('click', (e) => { e.preventDefault(); el.metricsModal.classList.add('hidden'); openInsights(); });
el.insightsClose.addEventListener('click', () => el.insightsModal.classList.add('hidden'));

async function openInsights() {
  el.insightsModal.classList.remove('hidden');
  el.insightsBody.innerHTML = '<div class="idea-skeleton"></div>'.repeat(2);
  try {
    const q = state.personaId ? `?persona=${state.personaId}` : '';
    const d = await api(`/insights${q}`);
    el.insightsNote.textContent = `已回填 ${d.total} 篇`;

    const table = (title, rows, hint) => `
      <section class="ins-block">
        <h3>${esc(title)}<em>${esc(hint)}</em></h3>
        ${rows.length ? `<table class="admin-table">
          <thead><tr><th>${esc(title)}</th><th class="num">篇数</th>
            <th class="num">阅读中位数</th><th class="num">点赞中位数</th></tr></thead>
          <tbody>${rows.map((r) => `<tr>
            <td>${esc(r.name)}</td>
            <td class="num">${r.count}</td>
            <td class="num">${r.views ?? '<span class="dim">样本不足</span>'}</td>
            <td class="num">${r.likes ?? '<span class="dim">—</span>'}</td>
          </tr>`).join('')}</tbody>
        </table>` : '<p class="hint">还没有可分组的数据。</p>'}
      </section>`;

    el.insightsBody.innerHTML = `<p class="hint ins-note">${esc(d.note)}</p>`
      + table('平台', d.byPlatform, '同一篇发不同平台，表现差很多')
      + table('栏目', d.bySection, '哪个栏目的读者最买账')
      + table('方向类型', d.byLabel, '反常识 / 方法拆解 / 个人经历…哪类更吃香')
      + `<section class="ins-block"><h3>明细<em>最近 40 篇</em></h3>
          <table class="admin-table"><thead><tr>
            <th>标题</th><th>发布</th><th class="num">阅读</th><th class="num">点赞</th><th>备注</th>
          </tr></thead><tbody>${d.items.map((x) => `<tr>
            <td>${esc(x.title)}</td>
            <td class="mono">${esc(x.published_at || '')}</td>
            <td class="num">${x.metrics.views ?? '—'}</td>
            <td class="num">${x.metrics.likes ?? '—'}</td>
            <td>${esc(x.metrics.note || '')}</td>
          </tr>`).join('')}</tbody></table>
        </section>`;
  } catch (err) {
    el.insightsBody.innerHTML = `<p class="hint error">${esc(err.message)}</p>`;
  }
}

/* ==================================================================
 * 用量与套餐
 *
 * 顶栏常驻余额，撞到 402 之前就该知道快没了。
 * 浮层要说清三件事：还剩多少、花在哪了、升级能多什么。
 * ================================================================== */

const plan = { data: null };

async function loadPlan() {
  try {
    plan.data = await api('/plan');
    renderCreditChip();
  } catch { /* 拿不到就不显示，不影响别的 */ }
}

function renderCreditChip() {
  const q = plan.data?.quota;
  if (!q) { el.creditChip.classList.add('hidden'); return; }
  el.creditChip.classList.remove('hidden');
  const ratio = q.total ? q.left / q.total : 0;
  el.creditChip.innerHTML = `${esc(q.label)} · 剩 <b>${q.left.toLocaleString()}</b>`;
  // 低于 15% 变红——这时候提醒还来得及，撞到 402 才说就晚了
  el.creditChip.classList.toggle('low', ratio < 0.15);
  el.creditChip.title = ratio < 0.15 ? '额度快用完了，点开看看' : '点开看用量与套餐';
}

el.creditChip.addEventListener('click', openPlan);
el.planClose.addEventListener('click', () => el.planModal.classList.add('hidden'));

async function openPlan(focus) {
  el.planModal.classList.remove('hidden');
  closePay();
  el.planBreakdown.innerHTML = '<div class="idea-skeleton"></div>';
  await loadPlan();
  const d = plan.data;
  if (!d) return;
  const q = d.quota;

  el.planPeriod.textContent = `${q.period} · 下月 1 号重置`;

  const pct = q.total ? Math.max(0, Math.min(100, (q.left / q.total) * 100)) : 0;
  el.planNow.innerHTML = `
    <div class="row">
      <span class="big">${q.left.toLocaleString()}</span>
      <span class="of">/ ${q.total.toLocaleString()} 点剩余</span>
      <span class="grow"></span>
      <span class="of">${esc(q.label)}${q.price ? ` · ${q.price} 元/月` : ''}</span>
    </div>
    <div class="plan-bar ${pct < 15 ? 'low' : ''}"><div style="width:${pct}%"></div></div>
    <p class="eq">${d.explain.length
    ? `还能写 <b>${d.explain.map((x) => `${x.n} ${x.what}`).join('</b>，或 <b>')}</b>（各是全部额度都用在这一项上）`
    : '额度已经用完，下月 1 号重置。'}
    </p>`;

  el.planBreakdown.innerHTML = d.breakdown.length ? d.breakdown.map((r) => `
    <div class="use-row">
      <span class="f">${esc(r.feature)}</span>
      <span class="amt">${r.calls} 次 · ${r.units.toLocaleString()} ${esc(r.unit)}</span>
      <span class="cr">${r.credits.toLocaleString()} 点</span>
    </div>`).join('') : '<p class="hint">这个月还没有消耗。</p>';

  const card = (p, isPack) => `
    <div class="plan-card ${!isPack && p.key === q.plan ? 'on' : ''}">
      <h4>${esc(p.label)}</h4>
      <div class="price">${p.price ? `${p.price}<em> 元${isPack ? '' : '/月'}</em>` : '免费'}</div>
      <div class="cr">${p.credits.toLocaleString()} 点</div>
      <p class="note">${esc(p.note || '')}</p>
      ${!isPack && p.key === q.plan
    ? '<button class="btn ghost small" disabled>当前套餐</button>'
    : `<button class="btn ${isPack ? 'ghost' : 'primary'} small"
         data-${isPack ? 'pack' : 'plan'}="${esc(p.key)}">${isPack ? '购买' : '换到这档'}</button>`}
    </div>`;

  el.planCards.innerHTML = d.plans.map((p) => card(p, false)).join('');
  el.planNote.textContent = '点数按实际消耗扣。写稿很便宜，出图是大头——明细里能看出钱花在哪。';

  if (focus) el.planModal.querySelector('.modal-body').scrollTo({ top: 260, behavior: 'smooth' });
}

/* 换套餐 / 买包。**还没接支付**——后端默认拒绝，这里如实说，不做假成功 */
/* 点套餐 = 下单，不再直接改状态。开通是"订单支付成功"的副作用。 */
el.planModal.addEventListener('click', (e) => {
  const b = e.target.closest('[data-plan]');
  if (!b) return;
  const card = b.closest('.plan-card');
  const label = card?.querySelector('h4')?.textContent || '';
  startPay('plan', b.dataset.plan, label);
});

/* 撞到 402 时把用量面板顶出来。
   普通 toast 说一句"额度不够"然后消失，人不知道该干什么——
   这一刻正是他最愿意付费的时候，得把选项摆在面前。 */
window.addEventListener('cw-quota', (e) => {
  toast(e.detail?.message || '额度不够了');
  openPlan(true);
});

/* ==================================================================
 * 支付
 *
 * 扫码 + **轮询订单状态**。回调可能丢（网络、我们这边宕一下），
 * 所以不能只等推送——前端每 3 秒问一次，服务端在被问到时也会主动查单补偿。
 * ================================================================== */

const pay = { info: null, order: null, timer: 0, channel: 'wechat' };

el.payCancel.addEventListener('click', closePay);

function closePay() {
  clearInterval(pay.timer);
  pay.timer = 0;
  pay.order = null;
  el.payBox.classList.add('hidden');
}

async function startPay(kind, sku, label) {
  if (!pay.info) {
    try { pay.info = (await api('/pay')).pay; } catch { toast('支付未就绪'); return; }
  }
  closePay();
  el.payBox.classList.remove('hidden');
  el.payTitle.textContent = `购买 ${label}`;
  el.payQr.textContent = '正在下单…';
  el.payHint.textContent = '';

  // 渠道按钮。没配好商户号的置灰——点了也只会失败，不如直说
  el.payChannels.innerHTML = pay.info.channels.map((c) => `
    <button type="button" data-ch="${esc(c.key)}" class="${c.key === pay.channel ? 'on' : ''}"
      ${c.ready || !pay.info.live ? '' : 'disabled title="这个渠道还没配置商户号"'}>${esc(c.label)}</button>`).join('');

  try {
    const o = await api('/pay/order', { method: 'POST',
      body: { [kind === 'pack' ? 'pack' : 'plan']: sku, channel: pay.channel } });
    pay.order = o;
    renderQr(o);
    watchOrder(o.no);
  } catch (err) {
    el.payQr.textContent = '';
    el.payHint.textContent = err.message;
  }
}

function renderQr(o) {
  if (o.mock) {
    // 演示模式没有真二维码，给一个直接点的按钮把回调打过去——
    // 走的是和真实回调**完全同一条**服务端路径，包括验签和幂等
    el.payQr.innerHTML = `<div>演示模式<br>不会真的扣款<br><br>
      <button class="btn primary small" id="mockPaid">模拟支付成功</button></div>`;
    el.payQr.querySelector('#mockPaid').addEventListener('click', async () => {
      await fetch(`/api/pay/notify/mock?no=${encodeURIComponent(o.no)}&amount=${o.amount}&token=${encodeURIComponent(o.mockToken)}`,
        { method: 'POST', body: '' });
    });
  } else {
    // 真实渠道返回的是二维码内容串，用第三方库渲染会引依赖——
    // 这里直接给链接文本 + 提示用手机扫。上线前可以换成本地生成的 SVG 二维码
    el.payQr.innerHTML = `<div style="word-break:break-all;font-size:10px">${esc(o.codeUrl || '')}</div>`;
  }
  el.payHint.innerHTML = `订单 <code>${esc(o.no)}</code> · ${(o.amount / 100).toFixed(2)} 元
    <br><span class="pay-wait">等待支付…</span>`;
}

el.payChannels.addEventListener('click', (e) => {
  const b = e.target.closest('[data-ch]');
  if (!b || b.disabled) return;
  pay.channel = b.dataset.ch;
  const o = pay.order;
  if (o) startPay(o.kind || 'plan', o.sku, el.payTitle.textContent.replace('购买 ', ''));
});

/* 轮询。3 秒一次，5 分钟不成就停——一直转下去只会白耗请求 */
function watchOrder(no) {
  let n = 0;
  pay.timer = setInterval(async () => {
    n += 1;
    if (n > 100) { clearInterval(pay.timer); el.payHint.innerHTML = '等太久了，付好了可以关掉重开这个页面。'; return; }
    try {
      const { order, quota } = await api(`/pay/order/${no}`);
      if (order.status === 'granted' || order.status === 'paid') {
        clearInterval(pay.timer);
        plan.data = { ...plan.data, quota };
        renderCreditChip();
        closePay();
        await openPlan();
        toast('支付成功，已开通');
      }
    } catch { /* 网络抖一下不算失败，下次再问 */ }
  }, 3000);
}
