/* Deterministic checks: never rewrite the author's text or call an LLM. */
const CN = '一二三四五六七八九十百零〇两';
function numberOf(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  let total = 0, digit = 0;
  for (const char of value) {
    if (char === '十' || char === '百') { total += (digit || 1) * (char === '十' ? 10 : 100); digit = 0; }
    else digit = digits[char];
  }
  return total + digit;
}

function numbering(title) {
  const patterns = [
    [new RegExp(`^([${CN}]+)[、.．]\\s*(.+)$`), '中文', 0],
    [new RegExp(`^[（(]([${CN}]+)[）)]\\s*(.+)$`), '中文括号', 1],
    [/^(\d+)[.．、](?!\d)\s*(.+)$/, '数字', 2],
    [/^[（(](\d+)[）)]\s*(.+)$/, '数字括号', 3],
  ];
  for (const [pattern, style, depth] of patterns) {
    const match = title.match(pattern);
    if (match) return { value: numberOf(match[1]), style, depth };
  }
  return null;
}

export function checkHeadings(text) {
  const flags = [];
  const stack = [];
  const sequences = new Map();
  let fence = null, previous = 0, roots = 0, markdownLevel = 1, count = 0;
  const report = (line, quote, what, suggestion) => flags.push({
    dimension: '标题层级与编号', level: '中', quote, locatable: true,
    what: `第 ${line} 行：${what}`, suggestion,
  });

  for (const [index, raw] of String(text).split(/\r?\n/).entries()) {
    const marker = raw.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (fence) {
      if (marker && marker[1][0] === fence.char && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
      continue;
    }
    if (marker) { fence = { char: marker[1][0], length: marker[1].length }; continue; }
    const heading = raw.match(/^ {0,3}(#+)(?:[ \t]+|$)(.*)$/);
    const title = heading ? heading[2].replace(/[ \t]+#+[ \t]*$/, '').trim() : raw.trim();
    const numbered = numbering(title);
    if (!heading && (!numbered || /^\s{4}|^\t/.test(raw) || title.length > 60 || /[。！？!?；;]/.test(title))) continue;
    const line = index + 1;
    const level = heading ? heading[1].length : markdownLevel + 1 + numbered.depth;
    count++;
    if (heading) {
      if (level > 6) {
        report(line, raw, '标题超过六级。', 'Markdown 最多支持六级标题，请减少 # 并确认所属上级。');
        continue;
      }
      if ((!previous && level > 2) || (previous && level > previous + 1)) {
        report(line, raw, previous ? `从 ${previous} 级跳到 ${level} 级，缺少中间层级。` : `首个标题为 ${level} 级，缺少上级标题。`,
          '补充缺少的上级标题，或将该标题调整为紧接上级的层级。');
      }
      if (level === 1 && ++roots > 1) report(line, raw, '正文重复使用一级标题。', '保留一个全文主标题，将章节标题调整为二级或更低层级。');
      previous = level;
      markdownLevel = level;
    }
    stack.length = level;
    const parent = stack.slice(0, level - 1).join('/');
    if (numbered) {
      const key = `${parent}|${level}|${numbered.style}`;
      const last = sequences.get(key);
      if (last !== undefined && numbered.value <= last) {
        report(line, raw, `同一章节同级${heading ? '标题' : '疑似标题'}编号重复或倒退（${last} → ${numbered.value}）。`,
          `${heading ? '' : '先确认这些短编号行是否为标题；若只是独立列表可忽略。'}同一父章节的同级标题应继续编号，不同章节可重新从一开始。`);
      }
      sequences.set(key, Math.max(last ?? 0, numbered.value));
    }
    stack[level - 1] = line;
  }
  return { count, flags, summary: flags.length ? `标题层级与编号：发现 ${flags.length} 处需确认的问题。`
    : count ? '标题层级与编号：检查通过。' : '标题层级与编号：未发现可检查的标题，无须强制添加。' };
}

export function withHeadingReview(review, text) {
  const headings = checkHeadings(text);
  return {
    ...review,
    verdict: headings.flags.length && review.verdict === 'ok' ? 'minor' : review.verdict,
    summary: [review.summary, headings.summary].filter(Boolean).join(' '),
    flags: [...headings.flags, ...(review.flags || [])],
    headings: { count: headings.count, issueCount: headings.flags.length },
  };
}
