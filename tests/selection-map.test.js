import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSelectionMap, findRawSelection } from '../public/selection-map.js';

test('maps rendered bold and inline-code text without requiring exact Markdown text', () => {
  const raw = 'DeepSeek **公告三件事**：`V4-Pro` 正式版转正';
  const map = buildSelectionMap(raw);
  assert.equal(map.text, 'DeepSeek 公告三件事：V4-Pro 正式版转正');
  assert.equal(findRawSelection(raw, '公告三件事：V4-Pro').text, '**公告三件事**：`V4-Pro`');
  assert.equal(findRawSelection(raw, '公告三件事').text, '公告三件事');
  assert.equal(findRawSelection(raw, 'V4-Pro').text, 'V4-Pro');
});

test('maps selections across paragraphs, headings and list boundaries', () => {
  const raw = '## 标题内容\n\n第一段有**重点**。\n\n- 第二段。';
  assert.equal(
    findRawSelection(raw, '标题内容 第一段有重点。 第二段。').text,
    '## 标题内容\n\n第一段有**重点**。\n\n- 第二段。',
  );
  assert.equal(findRawSelection(raw, '第一段有重点。').text, '第一段有**重点**。');
  const heading = '## 标题 **重点** 结尾';
  assert.equal(findRawSelection(heading, '重点 结尾').text, '**重点** 结尾');
});

test('uses approximate position to choose among repeated visible phrases', () => {
  const raw = '**重复**中间文字\n\n**重复**';
  const first = findRawSelection(raw, '重复', 0);
  const second = findRawSelection(raw, '重复', 12);
  assert.equal(first.start, 2);
  assert.ok(second.start > first.start);
});

test('normalizes whitespace and keeps the raw range usable for replacement', () => {
  const raw = '第一段  **重点**\n\n\n第二段';
  const found = findRawSelection(raw, '第一段 重点 第二段');
  assert.equal(found.text, '第一段  **重点**\n\n\n第二段');
  assert.equal(raw.slice(found.start, found.end), found.text);
});
