# 项目约定

- `public/`：浏览器静态界面，无构建步骤；`server/`：Node HTTP/API 服务。
- 正式本地入口为 `http://localhost:5177/`，不得随迭代更换。
- `REQUIREMENTS.md`：用户需求摘要；`ISSUES.md`：问题原因、修复及验收记录，关联 GitHub Issue。
- `docs/requirements/REQ-YYYYMMDD-<slug>.md`：二开需求与设计草案，记录已收到的约束、建议及未决事项；未确认不得视为开发授权。保留历史，不作为临时文件清理。
- `tests/`：使用 Node 内置测试运行器的回归检查，按功能命名 `*.test.js`。
- `server/heading-review.js`：标题层级规则及结果合并；不读取数据库或调用模型。
- `public/selection-map.js`：阅读模式可见文字到 Markdown 原文偏移的映射；不改写正文，跨格式与段落选择依赖此层。
- `public/content-fingerprint.js`：多平台版本所用原稿的稳定指纹与旧数据兼容判断；服务端生成时写入，前台只读比较。
- Markdown 标题层级检查允许无标题、从二级开始、回升及同级；报告向下跳级、重复一级标题、超过六级。跳过代码块，不自动修改正文。具体规则与验收见 README 的标题层级检查段。
- 补充用户确认范围：检查同一父章节内同级标题编号重复或倒退，覆盖“一、”“（一）”“1.”等格式；跨父章节可重新编号。普通编号行可能是列表，结果提示人工确认，不自动改写。
- 临时材料放所属工作区 `work/`，不提交运行数据、密钥或临时产物。
- 修改后执行相关 `node --test`、JavaScript 语法检查和 `git diff --check`。
- 本地 commit 使用英文 Conventional Commits；push 和部署需明确授权。纯修复提交不单独发版。
- 桌面控制须遵守用户事先确认要求；非视觉检查不得声称完成视觉验收。

## 研究转文初版实施约定

- 已批准需求：`docs/requirements/REQ-20261028-research-to-article.md` revision 0.4，2026-10-28 用户选择 1，采用 GPT-6.1 Sol / high。
- 权威目录保持当前项目；隔离 checkout 为 `C:/Users/Kairos/Documents/其他项目/ip-studio`，仅开发测试，正式入口仍为 5177。
- 新增 `server/research*.js` 为研究转文、来源与应用内 Skill 服务；`public/research*.js`/样式承载新增交互，尽量复用现编辑界面。具体实现可按同职责调整。
- `server/research.js`：文件解析/大小约束、独立原文件与文本、账号 Skill 数据；`server/research-routes.js`：受登录/归属保护的研究 API。`public/research.js`：导入、规则编辑会话、来源/标题与生成状态；选区确认仍在原编辑器。
- `tests/research.test.js`：使用 `.local/` 隔离数据库和本机假模型上游验证解析/API/积分；`tests/research-ui.test.js`：无桌面环境验证菜单、规则会话及请求过期保护。测试不得读取正式 `.env` 或调用付费模型。
- `.local/` 为本项目隔离测试数据库、fixture、日志、集成基线和备份，不提交；可重建日志完成后清理，基线与备份保留至验收。
- 隔离副本不复制 .env 或真实数据，测试使用 mock 与临时配置；集成时保留正式配置、数据及其他未提交修改。
- 一名写入负责人，最多一名只读复核；不操作桌面，不调用付费模型，不自动 commit/push/发版。

## 分阶段研究改写实施

- 2026-10-29 用户明确“在此开发”，批准已展示的 REQ-20261029-structure-first revision0.3 方案，在当前聊天串行实施，不另建聊天。模型由当前运行环境控制，不把文档记录当作已切换模型。
- 新增 server/research-prompts.js 管共用上下文与阶段合同，server/research-workflow.js 管持久阶段和并发版本；public/research-workflow.js 管结构选择/混搭与阶段结果。原 server/prompts.js 旧提示词和原创作线不得改变。
- tests/*workflow*.test.js 覆盖真实阶段门控、来源/结构/正文版本与旧线兼容；临时基线继续放.local，正式入口5177不变。
