import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentFingerprint, variantIsStale } from '../public/content-fingerprint.js';

test('source fingerprint ignores only surrounding whitespace and detects content changes', () => {
  const source = '第一段\n\n第二段';
  assert.equal(contentFingerprint(source), contentFingerprint(`\n${source}\n`));
  assert.notEqual(contentFingerprint(source), contentFingerprint('第一段\n\n第三段'));
  assert.notEqual(contentFingerprint('甲'), contentFingerprint('乙'));
});

test('new versions compare fingerprints instead of character counts', () => {
  const source = '同样的字数甲乙';
  const variant = { fromFingerprint: contentFingerprint(source), fromChars: source.length };
  assert.equal(variantIsStale(variant, source), false);
  assert.equal(variantIsStale(variant, '同样的字数丙丁'), true);
});

test('legacy versions compare trimmed source length to avoid whitespace false positives', () => {
  assert.equal(variantIsStale({ fromChars: 4 }, '正文内容\n'), false);
  assert.equal(variantIsStale({ fromChars: 4 }, '修改后'), true);
});
