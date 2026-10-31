/* Map rendered visible text back to the original Markdown source. */
const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function collectInline(source, base, output, tokens = []) {
  for (let i = 0; i < source.length;) {
    if (source[i] === '`') {
      const end = source.indexOf('`', i + 1);
      if (end > i) {
        const token = { start: base + i, end: base + end + 1, innerStart: base + i + 1, innerEnd: base + end };
        collectInline(source.slice(i + 1, end), base + i + 1, output, [...tokens, token]);
        i = end + 1;
        continue;
      }
    }
    if (source.startsWith('**', i)) {
      const end = source.indexOf('**', i + 2);
      if (end > i + 1) {
        const token = { start: base + i, end: base + end + 2, innerStart: base + i + 2, innerEnd: base + end };
        collectInline(source.slice(i + 2, end), base + i + 2, output, [...tokens, token]);
        i = end + 2;
        continue;
      }
    }
    if (source[i] === '*' && (i === 0 || /[\s(]/.test(source[i - 1]))) {
      const end = source.indexOf('*', i + 1);
      if (end > i + 1) {
        const token = { start: base + i, end: base + end + 1, innerStart: base + i + 1, innerEnd: base + end };
        collectInline(source.slice(i + 1, end), base + i + 1, output, [...tokens, token]);
        i = end + 1;
        continue;
      }
    }
    output.push({ ch: source[i], start: base + i, end: base + i + 1, tokens });
    i++;
  }
}

function normalizedMap(chars) {
  const text = [];
  const offsets = [];
  let whitespace = false;
  for (const item of chars) {
    if (/\s/.test(item.ch)) {
      if (!whitespace) {
        text.push(' ');
        offsets.push(item);
      }
      whitespace = true;
      continue;
    }
    text.push(item.ch);
    offsets.push(item);
    whitespace = false;
  }
  while (text[0] === ' ') { text.shift(); offsets.shift(); }
  while (text[text.length - 1] === ' ') { text.pop(); offsets.pop(); }
  return { text: text.join(''), offsets };
}

/**
 * The renderer currently supports headings, lists, quotes, bold, italic and
 * inline code. Markdown markers are deliberately omitted from the map because
 * the browser never includes them in a rendered-text selection.
 */
export function buildSelectionMap(source) {
  const raw = String(source ?? '');
  const chars = [];
  let offset = 0;
  for (const line of raw.split('\n')) {
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    const unordered = line.match(/^(\s*[-*+]\s+)(.*)$/);
    const ordered = line.match(/^(\s*\d+[.、)]\s+)(.*)$/);
    const quote = line.match(/^(\s*>\s?)(.*)$/);
    const block = heading || unordered || ordered || quote
      ? { start: offset, end: offset + line.length, innerStart: offset + (heading ? heading[1].length + 1 : (unordered || ordered || quote)[1].length), innerEnd: offset + line.length }
      : null;
    if (heading) collectInline(heading[2], block.innerStart, chars, [block]);
    else if (unordered) collectInline(unordered[2], block.innerStart, chars, [block]);
    else if (ordered) collectInline(ordered[2], block.innerStart, chars, [block]);
    else if (quote) collectInline(quote[2], block.innerStart, chars, [block]);
    else if (!/^(---|\*\*\*|___)\s*$/.test(line)) collectInline(line, offset, chars);
    if (line.length && offset + line.length < raw.length) chars.push({ ch: '\n', start: offset + line.length, end: offset + line.length + 1 });
    offset += line.length + 1;
  }
  return normalizedMap(chars);
}

export function findRawSelection(source, visibleText, approximate = 0) {
  const raw = String(source ?? '');
  const map = buildSelectionMap(raw);
  const needle = normalize(visibleText);
  if (!needle || !map.text) return null;
  const hits = [];
  for (let i = map.text.indexOf(needle); i !== -1; i = map.text.indexOf(needle, i + 1)) hits.push(i);
  if (!hits.length) return null;
  const at = hits.reduce((best, i) => Math.abs(i - approximate) < Math.abs(best - approximate) ? i : best, hits[0]);
  const first = map.offsets[at];
  const last = map.offsets[at + needle.length - 1];
  let start = first.start;
  let end = last.end;
  const sameBlock = first.tokens[0] && last.tokens[0] && first.tokens[0] === last.tokens[0];
  const sameInnerToken = first.tokens.length && last.tokens.length
    && first.tokens[first.tokens.length - 1] === last.tokens[last.tokens.length - 1];
  if (sameBlock && !sameInnerToken) {
    const firstInline = first.tokens[1];
    const lastInline = last.tokens[last.tokens.length - 1];
    if (firstInline) start = firstInline.start;
    if (lastInline && lastInline !== first.tokens[0]) end = lastInline.end;
  } else if (!sameInnerToken) {
    if (first.tokens.length) start = first.tokens[0].start;
    if (last.tokens.length) end = last.tokens[last.tokens.length - 1].end;
  }
  return { start, end, text: raw.slice(start, end), visibleText: needle };
}
