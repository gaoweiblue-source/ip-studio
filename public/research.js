/* Research UI uses the existing draft editor; rules are always saved explicitly. */
export function initResearch({ state, api, setDraft, loadHistory, toast, currentPersona, esc, ensureSaved, canSwitchDraft }) {
  const $ = id => document.getElementById(id);
  let imported = null, importTicket = 0, generating = false;
  const modal = document.createElement('dialog');
  modal.className = 'research-dialog';
  modal.innerHTML = `<h2 id="researchDialogTitle">写作 Skill</h2><p id="researchDialogNote"></p><textarea id="researchSkillEditor" rows="18" maxlength="20000" aria-label="Markdown 写作规则"></textarea><p id="researchSkillStatus" role="status"></p><div class="actions"><button class="btn ghost" id="researchRulePrevious">恢复上一版</button><button class="btn ghost" id="researchRuleDefault">恢复默认</button><button class="btn ghost" id="researchRuleCancel">取消</button><button class="btn primary" id="researchRuleSave">保存规则</button></div>`;
  document.body.appendChild(modal);
  let editing = null, skillTicket = 0;
  const invalidateSkill = () => { editing = null; skillTicket++; };
  const closeSkill = () => { invalidateSkill(); modal.close(); };
  modal.addEventListener('close', () => { if (!modal.open) invalidateSkill(); });
  modal.addEventListener('cancel', invalidateSkill);
  async function openSkill(personaId = state.personaId, instruction = '') {
    if (!personaId) { toast('请先创建并保存账号设定，再编辑写作 Skill'); return; }
    const ticket = ++skillTicket;
    editing = null;
    try {
      const { skill } = await api(`/personas/${personaId}/writing-skill`);
      if (ticket !== skillTicket) return;
      editing = { personaId, version: skill.version, hasPrevious: skill.hasPrevious, saving: false };
      $('researchSkillEditor').value = skill.markdown + (instruction ? `\n\n## 长期补充规则\n\n- ${instruction}` : '');
      $('researchDialogTitle').textContent = instruction ? '预览并编辑长期规则' : '写作 Skill';
      $('researchDialogNote').textContent = `账号「${state.personas.find(p => p.id === personaId)?.name || personaId}」· 当前 v${skill.version}。保存后下次生成和 API 改写生效，已有稿件保持原样。`;
      $('researchRulePrevious').disabled = !skill.hasPrevious;
      $('researchRuleDefault').disabled = false;
      $('researchRuleSave').disabled = false;
      $('researchSkillStatus').textContent = instruction ? '本次要求尚未保存，请确认它适合今后所有文章，再点击保存规则。' : '';
      if (!modal.open) modal.showModal();
    } catch (error) { if (ticket === skillTicket) toast(error.message); }
  }
  $('researchRuleCancel').onclick = closeSkill;
  async function saveSkill(restore) {
    const session = editing;
    if (!session || session.saving) return;
    session.saving = true;
    ['researchRuleSave', 'researchRulePrevious', 'researchRuleDefault'].forEach(id => { $(id).disabled = true; });
    try {
      const { skill } = await api(`/personas/${session.personaId}/writing-skill`, { method: 'PUT', body: { version: session.version, markdown: $('researchSkillEditor').value, ...(restore ? { restore } : {}) } });
      if (editing !== session || !modal.open) return;
      session.version = skill.version;
      session.hasPrevious = skill.hasPrevious;
      $('researchSkillEditor').value = skill.markdown;
      $('researchRulePrevious').disabled = !skill.hasPrevious;
      $('researchSkillStatus').textContent = `已保存 v${skill.version}，下次生成或改写使用新规则。`;
      if (!restore) { closeSkill(); toast(`写作 Skill v${skill.version} 已保存`); }
    } catch (error) { if (editing === session && modal.open) $('researchSkillStatus').textContent = error.message; }
    finally {
      session.saving = false;
      if (editing === session && modal.open) {
        $('researchRuleSave').disabled = false;
        $('researchRuleDefault').disabled = false;
        $('researchRulePrevious').disabled = !session.hasPrevious;
      }
    }
  }
  $('researchRuleSave').onclick = () => saveSkill();
  $('researchRulePrevious').onclick = () => saveSkill('previous');
  $('researchRuleDefault').onclick = () => saveSkill('default');
  $('researchSkill').onclick = () => openSkill();
  $('accountWritingSkill').onclick = () => openSkill(state.editingId);
  $('assistSaveRule').onclick = () => {
    const a = state.assist;
    if (a && state.draft?.research) openSkill(state.draft.persona_id, a.instruction || a.label);
  };

  function reset() {
    importTicket++; imported = null;
    $('researchFile').value = '';
    $('researchPaste').value = '';
    $('researchPreview').classList.add('hidden');
    $('researchGenerate').disabled = true;
    $('researchStatus').textContent = currentPersona() ? '使用当前账号的读者、语气和平台，无需重复填写。' : '请先在侧栏选择或创建一个账号。';
  }
  async function importFile(file) {
    const personaId = state.personaId, ticket = ++importTicket;
    imported = null; $('researchGenerate').disabled = true;
    if (!file) return;
    if (!personaId) { toast('先在侧栏选择一个账号，再导入材料'); return; }
    if (file.size > 5 * 1024 * 1024) { $('researchStatus').textContent = '文件超过 5 MB，请拆分后重新导入。'; return; }
    $('researchStatus').textContent = '正在提取并保留研究原文…';
    try {
      const base64 = await new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = () => reject(new Error('文件读取失败，请重新选择文件')); r.readAsDataURL(file); });
      const { source } = await api(`/personas/${personaId}/research-import`, { method: 'POST', body: { filename: file.name, base64 } });
      if (ticket !== importTicket || state.personaId !== personaId) return;
      imported = source;
      $('researchText').textContent = source.text;
      $('researchWarnings').textContent = source.warnings.join('\n');
      $('researchPreview').classList.remove('hidden');
      $('researchPreview').open = source.warnings.length > 0;
      $('researchStatus').textContent = `已保留 ${file.name}，共 ${source.text.length} 字符。${source.warnings.length ? '请先核对解析提示与原文。' : '可以生成文章。'}`;
      $('researchGenerate').disabled = false;
    } catch (error) { if (ticket === importTicket) $('researchStatus').textContent = error.message; }
  }
  $('researchFile').onchange = () => {
    $('researchPaste').value = '';
    return importFile($('researchFile').files[0]);
  };
  $('researchPaste').oninput = () => {
    importTicket++; imported = null;
    $('researchFile').value = '';
    $('researchPreview').classList.add('hidden');
    const text = $('researchPaste').value;
    $('researchGenerate').disabled = generating || !text.trim() || text.length > 60000;
    $('researchStatus').textContent = text.length > 60000 ? '内容超过 6 万字符，请拆分后重试；不会截断内容。'
      : text.trim() ? '已输入研究内容，点击生成文章和标题即可。' : '请选择文件或粘贴 Markdown 内容。';
  };
  $('researchGenerate').onclick = async () => {
    if (generating) return;
    const pasted = $('researchPaste').value;
    if (pasted.trim() && !imported) {
      if (pasted.length > 60000) { $('researchStatus').textContent = '内容超过 6 万字符，请拆分后重试。'; return; }
      await importFile(new File([pasted], '粘贴研究材料.md', { type: 'text/markdown;charset=utf-8' }));
      if (!imported) { $('researchGenerate').disabled = !$('researchPaste').value.trim() || $('researchPaste').value.length > 60000; return; }
    }
    if (!imported || generating) return;
    const s = imported, personaId = state.personaId, oldId = state.draft?.id, ticket = importTicket;
    generating = true; $('researchGenerate').disabled = true;
    try {
      if (!await ensureSaved()) { $('researchStatus').textContent = '当前稿件尚未保存成功，请先保存稿件，再生成文章。'; return; }
      if (state.personaId !== personaId || state.draft?.id !== oldId || ticket !== importTicket) return;
      const previousDraft = state.draft, contentSnapshot = state.draft?.content;
      $('researchStatus').textContent = '正在按账号设定与最新写作 Skill 生成文章和标题…';
      const { draft } = await api(`/personas/${personaId}/research-generate`, { method: 'POST', body: { source_id: s.id } });
      await loadHistory();
      if (state.personaId === personaId && state.draft === previousDraft && state.draft?.content === contentSnapshot && canSwitchDraft() && ticket === importTicket && imported === s) { setDraft(draft); toast('文章已生成，可编辑确认；原材料已独立保留'); }
      else toast('研究文章已生成并保存到原账号历史，请从历史打开');
      if (ticket === importTicket) $('researchStatus').textContent = '文章已生成，已保存在历史中。';
    } catch (error) { if (ticket === importTicket) $('researchStatus').textContent = error.message; }
    finally { generating = false; $('researchGenerate').disabled = !imported && (!$('researchPaste').value.trim() || $('researchPaste').value.length > 60000); }
  };
  let infoTicket = 0;
  async function showDraft(draft) {
    const ticket = ++infoTicket, data = draft.research;
    $('researchInfo').classList.toggle('hidden', !data);
    if (!data) return;
    $('researchInfoBody').innerHTML = `<p>来源：${esc(data.sourceName)} · Skill v${data.skillVersion} · ${esc(data.provider?.model || '')} · ${esc(data.generatedAt || '')}</p><p>${esc((data.warnings || []).join('\n'))}</p><label>文章标题<input id="researchTitleEdit" maxlength="200" value="${esc(draft.title)}" /></label><button type="button" class="btn ghost small" id="researchTitleSave">保存标题</button><p>备选标题：${esc((data.titles || []).join(' / '))}</p><details><summary>结构及本次使用的写作规则</summary><pre>${esc((data.outline || []).join('\n'))}\n\n${esc(data.skillMarkdown || '')}</pre></details><details><summary>独立保存的研究原文</summary><p id="researchSavedWarnings"></p><a href="/api/research-sources/${data.sourceId}/original">下载原文件</a><pre id="researchSavedText">正在读取…</pre></details>`;
    $('researchTitleSave').onclick = async () => {
      const title = $('researchTitleEdit').value.trim();
      try {
        await api(`/drafts/${draft.id}/research-title`, { method: 'PUT', body: { title } });
        if (state.draft?.id === draft.id) { state.draft.title = title; $('contentTitle').textContent = title; }
        loadHistory(); toast('标题已保存');
      } catch (error) { toast(error.message); }
    };
    try {
      const { source } = await api(`/research-sources/${data.sourceId}`);
      if (ticket !== infoTicket) return;
      $('researchSavedText').textContent = source.text;
      $('researchSavedWarnings').textContent = source.warnings.join('\n');
    } catch (error) { if (ticket === infoTicket) $('researchSavedText').textContent = error.message; }
  }
  return { reset, showDraft, openSkill };
}

export function assistSnapshotValid(assist, draft) {
  const current = assist?.version
    ? draft?.variants?.[assist.version]?.content
    : draft?.content;
  return Boolean(assist && draft && typeof current === 'string'
    && assist.draftId === draft.id && assist.snapshot === current
    && current.slice(assist.target.start, assist.target.end) === assist.target.text);
}
