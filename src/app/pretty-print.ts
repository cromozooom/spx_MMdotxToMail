const INLINE_TAGS = new Set(['a', 'b', 'strong', 'i', 'em', 'u', 'span', 'cite', 'small', 'sub', 'sup', 'code', 'br']);
const VOID_TAGS = new Set(['meta', 'link', 'br', 'img', 'hr', 'input', 'col']);
const RAW_TEXT_TAGS = ['style', 'script', 'mj-style'];

const TOKEN = new RegExp(
  [
    '<!--[\\s\\S]*?-->',
    `<(${RAW_TEXT_TAGS.join('|')})\\b[^>]*>[\\s\\S]*?</\\1>`,
    '<![^>]*>',
    '</?[a-zA-Z][^>]*>',
    '[^<]+',
    '<',
  ].join('|'),
  'g',
);

const tagName = (token: string) => /^<\/?([a-zA-Z][\w:-]*)/.exec(token)?.[1].toLowerCase() ?? '';
const isTag = (token: string) => /^<\/?[a-zA-Z]/.test(token);
const isClosing = (token: string) => token.startsWith('</');
const isSelfContained = (token: string) => token.endsWith('/>') || VOID_TAGS.has(tagName(token));
const squash = (token: string) => token.replace(/\s+/g, ' ');

function formatCss(css: string, indent: string): string[] {
  const lines = css
    .replace(/\s+/g, ' ')
    .replace(/\{/g, ' {\n')
    .replace(/;\s*/g, ';\n')
    .replace(/\s*\}\s*/g, '\n}\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  let depth = 0;
  return lines.map((line) => {
    if (line.startsWith('}')) depth = Math.max(0, depth - 1);
    const formatted = `${indent}${'  '.repeat(depth)}${line}`;
    if (line.endsWith('{')) depth++;
    return formatted;
  });
}

function formatRawTextElement(token: string, indent: string): string[] {
  const open = /^<[^>]*>/.exec(token)![0];
  const close = /<\/[^>]*>$/.exec(token)![0];
  const body = token.slice(open.length, token.length - close.length);
  return [`${indent}${squash(open)}`, ...formatCss(body, `${indent}  `), `${indent}${close}`];
}

/** Puts every element on its own line, indented by depth; text-only elements such as `<p>Hi <b>x</b></p>` stay on one line. */
export function prettyPrintMarkup(source: string): string {
  const tokens = source.match(TOKEN) ?? [];
  const lines: string[] = [];
  let depth = 0;
  const pad = () => '  '.repeat(depth);

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (!token.startsWith('<') || token === '<') {
      const text = squash(token).trim();
      if (text) lines.push(`${pad()}${text}`);
      continue;
    }

    if (RAW_TEXT_TAGS.some((name) => token.toLowerCase().startsWith(`<${name}`)) && !isClosing(token)) {
      lines.push(...formatRawTextElement(token, pad()));
      continue;
    }

    if (!isTag(token)) {
      lines.push(`${pad()}${squash(token)}`);
      continue;
    }

    const name = tagName(token);

    if (isClosing(token)) {
      depth = Math.max(0, depth - 1);
      lines.push(`${pad()}${token}`);
      continue;
    }

    if (isSelfContained(token)) {
      lines.push(`${pad()}${squash(token)}`);
      continue;
    }

    let end = i + 1;
    while (end < tokens.length && (!isTag(tokens[end]) || INLINE_TAGS.has(tagName(tokens[end])))) end++;
    if (end < tokens.length && isClosing(tokens[end]) && tagName(tokens[end]) === name) {
      const inner = tokens.slice(i + 1, end).map(squash).join('').trim();
      lines.push(`${pad()}${squash(token)}${inner}${tokens[end]}`);
      i = end;
      continue;
    }

    lines.push(`${pad()}${squash(token)}`);
    depth++;
  }

  return lines.join('\n');
}
