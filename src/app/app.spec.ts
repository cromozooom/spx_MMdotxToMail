import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { DEFAULT_THEME, parseDocumentTheme, parseThemeLibrary, themeLibraryJson } from './theme-library';
import { convertWordHtmlToMarkdown, WORD_STYLE_MAP } from './word-document';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the conversion workspace', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('sPX_MMdotXToMail');
    expect(compiled.textContent).toContain('Choose .docx');
    expect(compiled.textContent).toContain('New sample data');
    expect(compiled.querySelector('[role="toolbar"]')).toBeTruthy();
    expect(compiled.querySelector('[aria-label="Paragraph style"]')).toBeTruthy();
    expect(compiled.querySelector('[aria-label="Strong (bold)"]')).toBeTruthy();
    // Block-ish styles such as Intense Emphasis live in the style dropdown, not as toolbar buttons.
    expect(compiled.querySelector('[aria-label="Intense Emphasis"]')).toBeNull();
    expect(compiled.querySelector('[aria-label="Numbered list"]')).toBeTruthy();
    expect(compiled.querySelector('[aria-label="Active theme"]')).toBeTruthy();
    expect(compiled.textContent).toContain('Download JSON');
    expect(compiled.textContent).toContain('Upload JSON');
  });

  it('should map the standard Word paragraph and character styles', () => {
    expect(WORD_STYLE_MAP).toContain("p[style-name='Heading 7'] => h6:fresh");
    expect(WORD_STYLE_MAP).toContain("p[style-name='Title'] => h1.document-title:fresh");
    expect(WORD_STYLE_MAP).toContain("p[style-name='List Paragraph'] => p:fresh");
    expect(WORD_STYLE_MAP).toContain("r[style-name='Intense Emphasis'] => strong > em");
    expect(WORD_STYLE_MAP).toContain("r[style-name='Intense Reference'] => span.intense-ref");
  });

  it('should convert mapped Word HTML to Milkdown-compatible Markdown', () => {
    const markdown = convertWordHtmlToMarkdown(
      '<h1 class="document-title">Title</h1><p class="document-subtitle">Subtitle</p>' +
        '<blockquote class="intense"><p>A quote</p></blockquote>' +
        '<p><strong>Strong</strong> <em class="subtle">Subtle</em> ' +
        '<strong><em>Intense</em></strong> <cite>Book</cite> ' +
        '<span class="subtle-ref">Reference</span></p>' +
        '<ol><li>List item</li></ol>',
    );

    expect(markdown).toContain('# Title');
    expect(markdown).toContain('*Subtitle*');
    expect(markdown).toContain('> A quote');
    expect(markdown).toContain('**Strong**');
    expect(markdown).toContain('<span class="subtle">Subtle</span>');
    expect(markdown).toContain('***Intense***');
    expect(markdown).toContain('<span class="book-title">Book</span>');
    expect(markdown).toContain('<span class="subtle-ref">Reference</span>');
    expect(markdown).toContain('1.  List item');
  });

  it('should load customized typography from a theme JSON object', () => {
    const customTheme = parseDocumentTheme({
      ...DEFAULT_THEME,
      id: 'brand-email',
      name: 'Brand Email',
      styles: {
        ...DEFAULT_THEME.styles,
        paragraph: {
          ...DEFAULT_THEME.styles.paragraph,
          fontFamily: 'Georgia, serif',
          fontSize: '18px',
          fontWeight: '600',
          letterSpacing: '0.04em',
        },
      },
    });

    expect(customTheme.styles.paragraph).toMatchObject({
      fontFamily: 'Georgia, serif',
      fontSize: '18px',
      fontWeight: '600',
      letterSpacing: '0.04em',
    });
  });

  it('should reject unsafe theme ids and fall back for invalid CSS values', () => {
    expect(() => parseDocumentTheme({ ...DEFAULT_THEME, id: 'bad;theme' })).toThrow(
      'Theme id must use lowercase letters, numbers, and hyphens.',
    );
    const theme = parseDocumentTheme({
      ...DEFAULT_THEME,
      styles: {
        ...DEFAULT_THEME.styles,
        paragraph: {
          ...DEFAULT_THEME.styles.paragraph,
          fontSize: 'url(javascript:alert(1))',
        },
      },
    });
    expect(theme.styles.paragraph.fontSize).toBe(DEFAULT_THEME.styles.paragraph.fontSize);
  });

  it('should parse box properties on quotes and ignore unsafe borders', () => {
    const theme = parseDocumentTheme({
      ...DEFAULT_THEME,
      styles: {
        ...DEFAULT_THEME.styles,
        quote: {
          ...DEFAULT_THEME.styles.quote,
          marginLeft: '24px',
          paddingLeft: '20px',
          borderLeft: '6px dashed #ff0000',
        },
        intenseQuote: { ...DEFAULT_THEME.styles.intenseQuote, borderLeft: 'url(x)', paddingLeft: 'calc(1px)' },
      },
    });

    expect(theme.styles.quote).toMatchObject({ marginLeft: '24px', paddingLeft: '20px', borderLeft: '6px dashed #ff0000' });
    expect(theme.styles.intenseQuote.borderLeft).toBe(DEFAULT_THEME.styles.intenseQuote.borderLeft);
    expect(theme.styles.intenseQuote.paddingLeft).toBe(DEFAULT_THEME.styles.intenseQuote.paddingLeft);
    expect(theme.styles.paragraph.borderLeft).toBeUndefined();
  });

  it('should serialize and validate a theme library with its selected theme', () => {
    const customTheme = parseDocumentTheme({ ...DEFAULT_THEME, id: 'custom', name: 'Custom' });
    const json = themeLibraryJson([DEFAULT_THEME, customTheme], customTheme.id);

    expect(parseThemeLibrary(JSON.parse(json))).toEqual({
      themes: [DEFAULT_THEME, customTheme],
      selectedThemeId: 'custom',
    });
    expect(() => parseThemeLibrary(JSON.parse(json.replace('"selectedThemeId": "custom"', '"selectedThemeId": "missing"'))))
      .toThrow('Selected theme is missing from the library.');
  });
});
