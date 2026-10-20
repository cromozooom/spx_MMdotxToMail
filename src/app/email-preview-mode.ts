import { ensureAccessibleDarkColor } from './dark-colors';

export const PREVIEW_MODES = ['light', 'gmail', 'apple', 'outlook'] as const;
export type PreviewMode = (typeof PREVIEW_MODES)[number];
export type EmailClient = Exclude<PreviewMode, 'light'>;

export const EMAIL_CLIENTS: { id: EmailClient; label: string }[] = [
  { id: 'gmail', label: 'Gmail (Inverted)' },
  { id: 'apple', label: 'Apple Mail (Media Query)' },
  { id: 'outlook', label: 'Outlook (Vendor Overrides)' },
];

export const DEFAULT_EMAIL_CLIENT: EmailClient = 'outlook';

/** Gmail is simulated on the iframe container; the email HTML itself is left untouched. */
export const GMAIL_FILTER = 'invert(0.92) hue-rotate(180deg)';
export const GMAIL_IFRAME_BACKGROUND = '#121212';

export interface PreviewPalette {
  /** Outer email background, e.g. `#f1f5f9`. */
  pageBackground: string;
  /** Content card background, e.g. `#ffffff`. */
  contentBackground: string;
  /** Any other light backgrounds used by styles (quotes, ...). */
  otherBackgrounds: string[];
}

const TRANSPARENT = /^(?:transparent|none|inherit|initial|unset)$/i;
const BACKGROUND_DECLARATION = /(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/i;
const COLOR_DECLARATION = /(?:^|;)\s*color\s*:\s*([^;]+)/i;

const APPLE = { page: '#121212', content: '#1e1e1e', other: '#2a2a2a', text: '#e5e5e5' };
const OUTLOOK = { page: '#1e1e1e', content: '#2d2d2d', text: '#ffffff' };

export function isDarkMode(mode: PreviewMode): boolean {
  return mode !== 'light';
}

/** Returns the HTML to load into the preview iframe for the given mode. Gmail and light return it unchanged. */
export function applyPreviewMode(html: string, mode: PreviewMode, palette: PreviewPalette): string {
  if (mode === 'apple') return rewrite(html, (doc) => applyAppleMail(doc, palette));
  if (mode === 'outlook') return rewrite(html, (doc) => applyOutlook(doc, palette));
  return html;
}

function rewrite(html: string, transform: (doc: Document) => void): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  transform(doc);
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

function injectStyle(doc: Document, css: string): void {
  const style = doc.createElement('style');
  style.dataset['previewMode'] = 'true';
  style.textContent = css;
  doc.head.append(style);
}

function backgroundSelector(scope: string, color: string): string {
  return `${scope} [style*="background-color:${color}" i], ${scope} [style*="background-color: ${color}" i]`;
}

function applyAppleMail(doc: Document, palette: PreviewPalette): void {
  const colorScheme = doc.createElement('meta');
  colorScheme.name = 'color-scheme';
  colorScheme.content = 'light dark';
  doc.head.append(colorScheme);

  // Every distinct inline text colour gets a computed accessible counterpart. Elements are tagged with an index
  // instead of matching on the inline style, because `color:#x` is also a substring of `background-color:#x`.
  const textRules = new Map<string, number>();
  const counterparts: string[] = [];
  for (const element of Array.from(doc.querySelectorAll<HTMLElement>('[style]'))) {
    const declared = COLOR_DECLARATION.exec(element.getAttribute('style') ?? '')?.[1].trim();
    if (!declared || TRANSPARENT.test(declared)) continue;
    const key = declared.toLowerCase();
    if (!textRules.has(key)) {
      // The lightest dark surface is the worst case for contrast, so passing there passes everywhere.
      const dark = ensureAccessibleDarkColor(declared, APPLE.other);
      if (!dark) continue;
      textRules.set(key, counterparts.push(dark) - 1);
    }
    element.setAttribute('data-dark-text', String(textRules.get(key)));
  }

  // The same rules are emitted for the real media query and for `body.dark`, which the preview toggles
  // because an iframe cannot be forced into prefers-color-scheme: dark.
  const rules = (scope: 'body' | 'body.dark'): string =>
    [
      `${scope}{background-color:${APPLE.page} !important;color:${APPLE.text} !important}`,
      `${backgroundSelector(scope, palette.pageBackground)}{background-color:${APPLE.page} !important}`,
      `${backgroundSelector(scope, palette.contentBackground)}{background-color:${APPLE.content} !important}`,
      ...palette.otherBackgrounds.map(
        (color) => `${backgroundSelector(scope, color)}{background-color:${APPLE.other} !important}`,
      ),
      `${['p', 'li', 'td', 'span', 'strong', 'em', 'b', 'i', 'blockquote', 'cite'].map((tag) => `${scope} ${tag}`).join(',')}{color:${APPLE.text} !important}`,
      ...counterparts.map((color, index) => `${scope} [data-dark-text="${index}"]{color:${color} !important}`),
    ].join('\n');

  injectStyle(doc, `@media (prefers-color-scheme: dark){\n${rules('body')}\n}\n${rules('body.dark')}`);
  doc.body.classList.add('dark');
}

function applyOutlook(doc: Document, palette: PreviewPalette): void {
  // Outlook.com tags elements whose colors it rewrites; the preview does the same so the vendor selectors match.
  for (const element of Array.from(doc.querySelectorAll<HTMLElement>('[style], [bgcolor]'))) {
    const style = element.getAttribute('style') ?? '';
    const background = BACKGROUND_DECLARATION.exec(style)?.[1].trim() ?? element.getAttribute('bgcolor')?.trim();
    const color = COLOR_DECLARATION.exec(style)?.[1].trim();
    if (background && !TRANSPARENT.test(background) && !/url\(/i.test(background)) {
      element.setAttribute('data-ogsb', background);
    }
    if (color && !TRANSPARENT.test(color)) element.setAttribute('data-ogsc', color);
  }
  doc.body.setAttribute('data-ogsb', doc.body.getAttribute('data-ogsb') ?? palette.pageBackground);
  doc.body.setAttribute('data-ogsc', doc.body.getAttribute('data-ogsc') ?? '#000000');

  const textTags = ['p', 'td', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  const textSelectors = ['[data-ogsc]', ...textTags.map((tag) => `[data-ogsc] ${tag}`)].join(',');
  const backgroundFor = (colors: string[], dark: string): string =>
    colors.map((color) => `[data-ogsb="${color}" i]`).join(',') + `{background-color:${dark} !important}`;

  injectStyle(
    doc,
    [
      `[data-ogsb]{background-color:${OUTLOOK.content} !important}`,
      backgroundFor(['#ffffff', palette.contentBackground], OUTLOOK.content),
      backgroundFor(['#f1f5f9', palette.pageBackground], OUTLOOK.page),
      `${textSelectors}{color:${OUTLOOK.text} !important}`,
    ].join('\n'),
  );
}
