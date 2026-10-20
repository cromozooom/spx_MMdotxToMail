import { DEFAULT_EMAIL_CLIENT, PreviewPalette, applyPreviewMode } from './email-preview-mode';

const palette: PreviewPalette = {
  pageBackground: '#f1f5f9',
  contentBackground: '#ffffff',
  otherBackgrounds: ['#f8fafc'],
};

const html = `<!doctype html><html><head><title>t</title></head>
<body style="word-spacing:normal;background-color:#f1f5f9;">
<div style="background:#ffffff;background-color:#ffffff;"><p style="color:#1e293b;background:transparent">Hi</p>
<blockquote style="background-color:#f8fafc">Q</blockquote></div></body></html>`;

describe('applyPreviewMode', () => {
  it('defaults to Outlook', () => {
    expect(DEFAULT_EMAIL_CLIENT).toBe('outlook');
  });

  it('leaves light and Gmail output untouched (Gmail is a container filter)', () => {
    expect(applyPreviewMode(html, 'light', palette)).toBe(html);
    expect(applyPreviewMode(html, 'gmail', palette)).toBe(html);
  });

  it('adds media query rules and a dark body class for Apple Mail without filters', () => {
    const output = applyPreviewMode(html, 'apple', palette);
    const doc = new DOMParser().parseFromString(output, 'text/html');

    expect(doc.body.classList.contains('dark')).toBe(true);
    const css = doc.head.querySelector('style')?.textContent ?? '';
    expect(css).toContain('@media (prefers-color-scheme: dark)');
    expect(css).toContain('body.dark');
    expect(css).not.toContain('filter');
  });

  it('tags elements and injects Outlook vendor overrides without filters', () => {
    const output = applyPreviewMode(html, 'outlook', palette);
    const doc = new DOMParser().parseFromString(output, 'text/html');
    const css = doc.head.querySelector('style')?.textContent ?? '';

    expect(doc.querySelector('div')?.getAttribute('data-ogsb')).toBe('#ffffff');
    expect(doc.body.getAttribute('data-ogsb')).toBe('#f1f5f9');
    expect(doc.querySelector('p')?.getAttribute('data-ogsc')).toBe('#1e293b');
    expect(doc.querySelector('p')?.hasAttribute('data-ogsb')).toBe(false);
    expect(css).toContain('[data-ogsb="#ffffff" i]');
    expect(css).toContain('#2d2d2d');
    expect(css).toContain('#1e1e1e');
    expect(css).toContain('[data-ogsc] h1');
    expect(css).not.toContain('filter');
  });
});
