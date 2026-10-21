import hljs from 'highlight.js/lib/core';
import markdown from 'highlight.js/lib/languages/markdown';
import xml from 'highlight.js/lib/languages/xml';

hljs.registerLanguage('xml', xml);
hljs.registerLanguage('markdown', markdown);

export type CodeLanguage = 'markdown' | 'xml';

/** Returns HTML in which every token is wrapped in a `hljs-*` span; the source text is escaped by highlight.js. */
export function highlightCode(source: string, language: CodeLanguage): string {
  return hljs.highlight(source, { language, ignoreIllegals: true }).value;
}
