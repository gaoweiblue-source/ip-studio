import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { checkHeadings, withHeadingReview } from '../server/heading-review.js';

test('normal Markdown hierarchy, sibling headings and returning to a parent pass', () => {
  assert.equal(checkHeadings('# 文稿\n## 一、开篇\n### 细节\n## 二、建议\n### 细节').flags.length, 0);
  assert.equal(checkHeadings('## 开篇\n### 细节\n## 结尾').flags.length, 0);
});
test('missing parents, repeated primary headings and invalid levels are reported', () => {
  const result = checkHeadings('### 开篇\n# 主标题\n# 另一个主标题\n#### 跳级\n####### 过深');
  assert.equal(result.flags.length, 4);
  assert.match(result.flags[0].what, /第 1 行/);
  assert.ok(result.flags.every(flag => flag.locatable));
});
test('Chinese numbered siblings cannot restart one two three in the same chapter', () => {
  const result = checkHeadings('## 一、开篇\n## 二、分析\n## 三、建议\n## 一、总结\n## 二、执行\n## 三、复盘');
  assert.equal(result.flags.length, 3);
  assert.match(result.flags[0].what, /重复或倒退/);
});
test('each parent chapter can have its own numbered children', () => {
  assert.equal(checkHeadings('## 一、准备\n### 1. 材料\n### 2. 工具\n## 二、执行\n### 1. 开始\n### 2. 完成').flags.length, 0);
  assert.equal(checkHeadings('一、准备\n（一）材料\n（二）工具\n二、执行\n（一）开始\n（二）完成').flags.length, 0);
});
test('short plain numbered headings are checked but marked as uncertain', () => {
  const result = checkHeadings('一、准备\n二、执行\n三、完成\n一、再开始');
  assert.equal(result.flags.length, 1);
  assert.match(result.flags[0].what, /疑似标题/);
  assert.match(result.flags[0].suggestion, /独立列表可忽略/);
});
test('parenthesized Arabic and Chinese numbering and larger Chinese numbers work', () => {
  assert.equal(checkHeadings('## （1）准备\n## （2）执行\n## （1）完成').flags.length, 1);
  assert.equal(checkHeadings('## （一）准备\n## （二）执行\n## （一）完成').flags.length, 1);
  assert.equal(checkHeadings('## 九、准备\n## 十、执行\n## 十一、完成').flags.length, 0);
});
test('code fences, indented code, hashtags, quotes and long numbered paragraphs are skipped', () => {
  const text = '```markdown\n# 示例\n# 示例\n####### 示例\n```\n~~~~\n## 一、示例\n## 一、示例\n~~~~\n    # 代码\n#话题标签\n> # 引用\n1. 这是一段正文。\n1. 这是另一段正文。';
  assert.equal(checkHeadings(text).count, 0);
});
test('a shorter or different fence does not prematurely close a code block', () => {
  assert.equal(checkHeadings('````\n```\n~~~~\n# 示例\n# 示例\n````\n## 正文').count, 1);
});
test('empty and ordinary prose pass without requiring headings', () => {
  assert.equal(checkHeadings('').count, 0);
  assert.match(checkHeadings('普通正文，无需标题。').summary, /无须强制添加/);
});
test('format findings do not masquerade as legal risk or replace model findings', () => {
  const review = { verdict: 'ok', risk: '无', summary: '语言正常', flags: [{ dimension: '事实存疑' }], issues: [] };
  const result = withHeadingReview(review, '## 开篇\n#### 跳级');
  assert.equal(result.verdict, 'minor');
  assert.equal(result.risk, '无');
  assert.equal(result.flags.length, 2);
  assert.equal(review.flags.length, 1);
  assert.equal(result.headings.issueCount, 1);
});
test('the existing review pipeline checks the text being reviewed, with no extra model request', async () => {
  const source = readFileSync(new URL('../server/routes.js', import.meta.url), 'utf8');
  let requests = 0;
  const ctx = vm.createContext({ withHeadingReview,
    withRetry: fn => fn(), generateJSON: async () => { requests++; return { verdict: 'ok', summary: '语言正常', issues: [], flags: [] }; },
    REVIEW_SYSTEM: '', REVIEW_SCHEMA: {}, REVIEW_DIMENSIONS: [], reviewUser: () => '',
  });
  vm.runInContext(source.slice(source.indexOf('async function reviewText('), source.indexOf('const mockReview =')), ctx);
  const result = await ctx.reviewText({ content: 'old content' }, '## 新正文\n#### 新跳级', null, []);
  assert.equal(result.headings.issueCount, 1);
  assert.equal(requests, 1);
});
