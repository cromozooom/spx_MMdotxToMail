import TurndownService from 'turndown';

export const WORD_STYLE_MAP = [
  // Headings & Titles
  "p[style-name='Heading 1'] => h1:fresh",
  "p[style-name='Heading 2'] => h2:fresh",
  "p[style-name='Heading 3'] => h3:fresh",
  "p[style-name='Heading 4'] => h4:fresh",
  "p[style-name='Heading 5'] => h5:fresh",
  "p[style-name='Heading 6'] => h6:fresh",
  "p[style-name='Heading 7'] => h6:fresh",
  "p[style-name='Title'] => h1.document-title:fresh",
  "p[style-name='Subtitle'] => p.document-subtitle:fresh",

  // Structure & Quotes
  "p[style-name='Normal'] => p:fresh",
  "p[style-name='No Spacing'] => p:fresh",
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote.intense:fresh",
  "p[style-name='List Paragraph'] => p:fresh",

  // Inline Formatting & Character Styles
  "r[style-name='Strong'] => strong",
  "r[style-name='Emphasis'] => em",
  "r[style-name='Subtle Emphasis'] => em.subtle",
  "r[style-name='Intense Emphasis'] => strong > em",
  "r[style-name='Book Title'] => cite",
  "r[style-name='Subtle Reference'] => span.subtle-ref",
  "r[style-name='Intense Reference'] => span.intense-ref",
];

const turndown = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  emDelimiter: '*',
});

turndown.addRule('documentSubtitle', {
  filter: (node) => node.nodeName === 'P' && node.classList.contains('document-subtitle'),
  replacement: (content) => `\n\n*${content.trim()}*\n\n`,
});

// Character styles Markdown has no syntax for are kept as classed spans so the email theme can style them.
const STYLE_SPAN_BY_SELECTOR: [(node: HTMLElement) => boolean, string][] = [
  [(node) => node.nodeName === 'EM' && node.classList.contains('subtle'), 'subtle'],
  [(node) => node.nodeName === 'CITE', 'book-title'],
  [(node) => node.nodeName === 'SPAN' && node.classList.contains('subtle-ref'), 'subtle-ref'],
  [(node) => node.nodeName === 'SPAN' && node.classList.contains('intense-ref'), 'intense-ref'],
];

turndown.addRule('wordCharacterStyle', {
  filter: (node) => STYLE_SPAN_BY_SELECTOR.some(([matches]) => matches(node)),
  replacement: (content, node) => {
    const cls = STYLE_SPAN_BY_SELECTOR.find(([matches]) => matches(node))![1];
    return `<span class="${cls}">${content}</span>`;
  },
});

export function convertWordHtmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}
