# 项目约定

- `public/`：浏览器静态界面，无构建步骤；`server/`：Node HTTP/API 服务。
- 正式本地入口为 `http://localhost:5177/`，不得随迭代更换。
- `REQUIREMENTS.md`：用户需求摘要；`ISSUES.md`：问题原因、修复及验收记录，关联 GitHub Issue。
- `tests/`：使用 Node 内置测试运行器的回归检查，按功能命名 `*.test.js`。
- 临时材料放所属工作区 `work/`，不提交运行数据、密钥或临时产物。
- 修改后执行相关 `node --test`、JavaScript 语法检查和 `git diff --check`。
- 本地 commit 使用英文 Conventional Commits；push 和部署需明确授权。纯修复提交不单独发版。
- 桌面控制须遵守用户事先确认要求；非视觉检查不得声称完成视觉验收。
