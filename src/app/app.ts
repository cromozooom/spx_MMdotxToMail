import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, signal } from '@angular/core';
import type { Editor } from '@milkdown/core';
import {
  DEFAULT_THEME,
  DEFAULT_THEME_LIBRARY,
  DocumentTheme,
  ThemeStyleName,
  parseDocumentTheme,
  parseThemeLibrary,
  themeLibraryJson,
} from './theme-library';
import { convertWordHtmlToMarkdown, WORD_STYLE_MAP } from './word-document';

const initialMarkdown = `# Hello {fullName}

We're excited to welcome you to **{company}**.

Your contact email is {email}.

Best,
The team`;

const themeStorageKey = 'dotx-mailmerge.theme-library.v1';

type ToolbarCommand =
  | 'heading'
  | 'paragraph'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'strong'
  | 'emphasis';

@Component({
  selector: 'app-root',
  imports: [],
  template: `
    <main class="min-h-screen bg-slate-50 text-slate-900">
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p class="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Dotx Mailmerge</p>
            <h1 class="mt-1 text-2xl font-bold tracking-tight">Document to email</h1>
          </div>
          <div class="flex flex-wrap items-center justify-end gap-2">
            <label for="theme-select" class="text-sm font-medium text-slate-600">Theme</label>
            <select
              id="theme-select"
              aria-label="Active theme"
              class="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700"
              (change)="onThemeSelected($event)"
            >
              @for (theme of themes(); track theme.id) {
                <option [value]="theme.id" [selected]="theme.id === selectedThemeId()">{{ theme.name }}</option>
              }
            </select>
            <button type="button" class="format-button" (click)="downloadTheme()">Download JSON</button>
            <label class="format-button cursor-pointer">
              Upload JSON
              <input
                #themeFileInput
                class="sr-only"
                type="file"
                accept=".json,application/json"
                (change)="onThemeFileSelected($event)"
              >
            </label>
            <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Proof of concept</span>
          </div>
        </div>
      </header>

      <div class="mx-auto max-w-7xl px-6 py-8">
        <p class="mb-6 max-w-3xl text-sm leading-6 text-slate-600">
          Upload a Word document, refine its contents, add sample merge data, and preview an email-ready HTML version.
          Use placeholders such as <code class="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">&#123;fullName&#125;</code>,
          <code class="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">&#123;email&#125;</code>, and
          <code class="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">&#123;company&#125;</code>.
        </p>

        @if (errorMessage()) {
          <div role="alert" class="mb-6 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {{ errorMessage() }}
          </div>
        }

        <section class="grid gap-5 lg:grid-cols-2">
          <article class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 1</p>
                <h2 class="mt-1 text-lg font-semibold">Import and edit</h2>
              </div>
              <label class="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Choose .docx
                <input class="sr-only" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" (change)="onFileSelected($event)">
              </label>
            </div>
            <div class="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
              @if (sourceFile()) {
                Imported from <span class="font-medium text-slate-700">{{ sourceFile() }}</span>
              } @else {
                Start with the sample, or choose a .docx file to import its text.
              }
            </div>
            <div class="p-5">
              <div
                role="toolbar"
                aria-label="Text formatting"
                class="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
              >
                <label class="sr-only" for="block-style">Paragraph style</label>
                <select
                  id="block-style"
                  aria-label="Paragraph style"
                  class="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-700"
                  [disabled]="!editorReady()"
                  (change)="onBlockStyleSelected($event)"
                >
                  <option value="paragraph">Paragraph</option>
                  <option value="title">Title</option>
                  <option value="subtitle">Subtitle</option>
                  <option value="heading-1">Heading 1</option>
                  <option value="heading-2">Heading 2</option>
                  <option value="heading-3">Heading 3</option>
                  <option value="heading-4">Heading 4</option>
                  <option value="heading-5">Heading 5</option>
                  <option value="heading-6">Heading 6</option>
                  <option value="heading-7">Heading 7 (level 6)</option>
                  <option value="quote">Quote</option>
                  <option value="intense-quote">Intense Quote</option>
                </select>
                <span aria-hidden="true" class="h-6 border-l border-slate-300"></span>
                <button
                  type="button"
                  aria-label="Bulleted list"
                  title="Bulleted list"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyListStyle('bulletList')"
                >&#8226; List</button>
                <button
                  type="button"
                  aria-label="Numbered list"
                  title="Numbered list"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyListStyle('orderedList')"
                >1. List</button>
                <span aria-hidden="true" class="h-6 border-l border-slate-300"></span>
                <button
                  type="button"
                  aria-label="Strong (bold)"
                  title="Strong (bold)"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyCharacterStyle('strong')"
                ><strong>B</strong></button>
                <button
                  type="button"
                  aria-label="Emphasis (italic)"
                  title="Emphasis (italic)"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyCharacterStyle('emphasis')"
                ><em>I</em></button>
                <button
                  type="button"
                  aria-label="Subtle Emphasis"
                  title="Subtle Emphasis"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyCharacterStyle('emphasis')"
                ><em class="text-slate-500">Subtle</em></button>
                <button
                  type="button"
                  aria-label="Intense Emphasis"
                  title="Intense Emphasis"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyCharacterStyle('intense')"
                ><strong><em>B+I</em></strong></button>
                <button
                  type="button"
                  aria-label="Book Title"
                  title="Book Title (italic in Markdown)"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyCharacterStyle('emphasis')"
                ><cite>Book</cite></button>
                <button
                  type="button"
                  aria-label="Subtle Reference"
                  title="Subtle Reference (italic in Markdown)"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyCharacterStyle('emphasis')"
                >Subtle ref.</button>
                <button
                  type="button"
                  aria-label="Intense Reference"
                  title="Intense Reference (italic in Markdown)"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="applyCharacterStyle('emphasis')"
                >Intense ref.</button>
              </div>
              <div #editorRoot class="milkdown-editor min-h-80 rounded-lg border border-slate-200 px-4 py-3"></div>
              <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex flex-wrap gap-2 text-xs text-slate-600">
                  <span class="rounded bg-slate-100 px-2 py-1">Markdown editor</span>
                  <span class="rounded bg-slate-100 px-2 py-1">GFM</span>
                </div>
                <button type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50" [disabled]="isCompiling()" (click)="buildEmail()">
                  {{ isCompiling() ? 'Building preview…' : 'Merge & preview' }}
                </button>
              </div>
            </div>
          </article>

          <article class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <p class="text-xs font-semibold uppercase tracking-wider text-slate-500">Step 2</p>
                <h2 class="mt-1 text-lg font-semibold">Email preview</h2>
              </div>
              @if (previewReady()) {
                <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Compiled</span>
              } @else {
                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Waiting for content</span>
              }
            </div>
            <div class="border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
              @if (mergeData(); as data) {
                Sample merge data:
                <span class="font-medium text-slate-700">{{ data['fullName'] }}</span>
                · {{ data['email'] }} · {{ data['company'] }}
              } @else {
                A fresh set of Faker values is generated each time you build the preview.
              }
            </div>
            <div class="bg-slate-100 p-5">
              <div class="mx-auto min-h-80 max-w-2xl overflow-hidden rounded-lg bg-white shadow-sm">
                <iframe #previewFrame title="Compiled email preview" class="min-h-80 w-full border-0" [class.hidden]="!previewReady()" sandbox=""></iframe>
                @if (!previewReady()) {
                  <div class="flex min-h-80 items-center justify-center px-8 text-center text-sm text-slate-500">
                    Your compiled email will appear here.
                  </div>
                }
              </div>
            </div>
          </article>
        </section>

        <footer class="mt-6 text-xs leading-5 text-slate-500">
          Documents are processed in your browser. This POC supports text and basic formatting; verify the final HTML in your target email clients before sending.
        </footer>
      </div>
    </main>
  `,
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('editorRoot', { static: true }) private editorRoot!: ElementRef<HTMLDivElement>;
  @ViewChild('previewFrame') private previewFrame?: ElementRef<HTMLIFrameElement>;

  protected readonly sourceFile = signal('');
  protected readonly errorMessage = signal('');
  protected readonly isCompiling = signal(false);
  protected readonly previewReady = signal(false);
  protected readonly editorReady = signal(false);
  protected readonly mergeData = signal<Record<string, string> | null>(null);
  protected readonly themes = signal<DocumentTheme[]>(DEFAULT_THEME_LIBRARY);
  protected readonly selectedThemeId = signal(DEFAULT_THEME.id);
  protected readonly activeTheme = computed(
    () => this.themes().find(({ id }) => id === this.selectedThemeId()) ?? DEFAULT_THEME,
  );

  private editor?: Editor;
  private editorThemeStyle?: HTMLStyleElement;
  private commandRunners?: Record<ToolbarCommand, (payload?: number) => boolean>;
  private pendingMarkdown = initialMarkdown;

  constructor() {
    this.loadThemeLibrary();
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      const [{ Editor, defaultValueCtx, rootCtx }, commonmarkModule, { gfm }, { nord }] = await Promise.all([
        import('@milkdown/core'),
        import('@milkdown/preset-commonmark'),
        import('@milkdown/preset-gfm'),
        import('@milkdown/theme-nord'),
      ]);
      const { commonmark } = commonmarkModule;
      this.commandRunners = {
        heading: (level) => commonmarkModule.wrapInHeadingCommand.run(level ?? 1),
        paragraph: () => commonmarkModule.turnIntoTextCommand.run(),
        blockquote: () => commonmarkModule.wrapInBlockquoteCommand.run(),
        bulletList: () => commonmarkModule.wrapInBulletListCommand.run(),
        orderedList: () => commonmarkModule.wrapInOrderedListCommand.run(),
        strong: () => commonmarkModule.toggleStrongCommand.run(),
        emphasis: () => commonmarkModule.toggleEmphasisCommand.run(),
      };
      this.editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, this.editorRoot.nativeElement);
          ctx.set(defaultValueCtx, this.pendingMarkdown);
        })
        .config(nord)
        .use(commonmark)
        .use(gfm)
        .create();
      this.applyThemeToEditor();
      this.editorReady.set(true);
    } catch (error) {
      this.showError('The Markdown editor could not be initialized.', error);
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.editor?.destroy();
    this.editorThemeStyle?.remove();
  }

  protected onThemeSelected(event: Event): void {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;

    const theme = this.themes().find(({ id }) => id === select.value);
    if (!theme) {
      this.errorMessage.set('The selected theme is not available in the theme library.');
      return;
    }

    this.selectedThemeId.set(theme.id);
    this.errorMessage.set('');
    this.persistThemeLibrary();
    this.applyThemeToEditor();
    if (this.previewReady()) void this.buildEmail(true);
  }

  protected downloadTheme(): void {
    const blob = new Blob([JSON.stringify(this.activeTheme(), null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.activeTheme().id}.theme.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  protected onThemeFileSelected(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;

    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    void this.importTheme(file);
  }

  private async importTheme(file: File): Promise<void> {
    try {
      const theme = parseDocumentTheme(JSON.parse(await file.text()));
      const existingIndex = this.themes().findIndex(({ id }) => id === theme.id);
      const nextThemes = [...this.themes()];

      if (existingIndex === -1) {
        if (nextThemes.length >= 50) throw new Error('The theme library is limited to 50 themes.');
        nextThemes.push(theme);
      } else {
        nextThemes[existingIndex] = theme;
      }

      this.themes.set(nextThemes);
      this.selectedThemeId.set(theme.id);
      this.persistThemeLibrary();
      this.applyThemeToEditor();
      this.errorMessage.set('');
      if (this.previewReady()) await this.buildEmail(true);
    } catch (error) {
      this.showError('The theme JSON could not be imported.', error);
    }
  }

  private loadThemeLibrary(): void {
    try {
      const stored = localStorage.getItem(themeStorageKey);
      if (stored === null) {
        this.persistThemeLibrary();
        return;
      }

      const library = parseThemeLibrary(JSON.parse(stored));
      this.themes.set(library.themes);
      this.selectedThemeId.set(library.selectedThemeId);
    } catch (error) {
      this.showError('The saved theme library could not be loaded. The default theme is active.', error);
    }
  }

  private persistThemeLibrary(): void {
    try {
      localStorage.setItem(themeStorageKey, themeLibraryJson(this.themes(), this.selectedThemeId()));
    } catch (error) {
      this.showError('The theme library could not be saved to local storage.', error);
    }
  }

  private applyThemeToEditor(): void {
    if (!this.editorThemeStyle) {
      this.editorThemeStyle = document.createElement('style');
      this.editorThemeStyle.dataset['theme'] = 'milkdown';
      document.head.append(this.editorThemeStyle);
    }
    this.editorThemeStyle.textContent = this.createEditorThemeCss(this.activeTheme());
  }

  private createEditorThemeCss(theme: DocumentTheme): string {
    const rules: [string, ThemeStyleName][] = [
      ['.milkdown-editor p', 'paragraph'],
      ['.milkdown-editor h1', 'heading1'],
      ['.milkdown-editor h2', 'heading2'],
      ['.milkdown-editor h3', 'heading3'],
      ['.milkdown-editor h4', 'heading4'],
      ['.milkdown-editor h5', 'heading5'],
      ['.milkdown-editor h6', 'heading6'],
      ['.milkdown-editor .document-title', 'title'],
      ['.milkdown-editor .document-subtitle', 'subtitle'],
      ['.milkdown-editor blockquote', 'quote'],
      ['.milkdown-editor blockquote.intense', 'intenseQuote'],
      ['.milkdown-editor ul, .milkdown-editor ol, .milkdown-editor li', 'list'],
      ['.milkdown-editor strong', 'strong'],
      ['.milkdown-editor em', 'emphasis'],
      ['.milkdown-editor strong em', 'intenseEmphasis'],
      ['.milkdown-editor cite', 'cite'],
      ['.milkdown-editor .subtle-ref', 'subtleReference'],
      ['.milkdown-editor .intense-ref', 'intenseReference'],
    ];

    const editorRule = `.milkdown-editor,.milkdown-editor .editor{background-color:${theme.colors.editorBackground};color:${theme.colors.editorForeground}}`;
    const styleRules = this.createThemeStyleRules(theme, rules);
    return `${editorRule}\n${styleRules}`;
  }

  private createEmailThemeCss(theme: DocumentTheme): string {
    const rules: [string, ThemeStyleName][] = [
      ['.email-content p', 'paragraph'],
      ['.email-content h1', 'heading1'],
      ['.email-content h2', 'heading2'],
      ['.email-content h3', 'heading3'],
      ['.email-content h4', 'heading4'],
      ['.email-content h5', 'heading5'],
      ['.email-content h6', 'heading6'],
      ['.email-content .document-title', 'title'],
      ['.email-content .document-subtitle', 'subtitle'],
      ['.email-content blockquote', 'quote'],
      ['.email-content blockquote.intense', 'intenseQuote'],
      ['.email-content ul, .email-content ol, .email-content li', 'list'],
      ['.email-content strong', 'strong'],
      ['.email-content em', 'emphasis'],
      ['.email-content strong em', 'intenseEmphasis'],
      ['.email-content cite', 'cite'],
      ['.email-content .subtle-ref', 'subtleReference'],
      ['.email-content .intense-ref', 'intenseReference'],
    ];

    return this.createThemeStyleRules(theme, rules).replace(/<\/style/gi, '<\\/style');
  }

  private createThemeStyleRules(theme: DocumentTheme, rules: [string, ThemeStyleName][]): string {
    return rules
      .map(([selector, styleName]) => {
        const style = theme.styles[styleName];
        const declarations = Object.entries(style)
          .map(([property, value]) => `${this.toKebabCase(property)}:${value}`)
          .join(';');
        return `${selector}{${declarations}}`;
      })
      .join('\n');
  }

  private toKebabCase(value: string): string {
    return value.replace(/[A-Z]/g, (character) => `-${character.toLowerCase()}`);
  }

  protected applyBlockStyle(style: string): void {
    if (style === 'paragraph') {
      this.runToolbarCommand('paragraph');
    } else if (style === 'title' || style === 'heading-1') {
      this.runToolbarCommand('heading', 1);
    } else if (style === 'subtitle') {
      this.applyCharacterStyle('emphasis');
    } else if (style === 'quote' || style === 'intense-quote') {
      this.runToolbarCommand('blockquote');
    } else if (style.startsWith('heading-')) {
      const headingLevel = Number(style.slice('heading-'.length));
      if (headingLevel >= 2 && headingLevel <= 6) {
        this.runToolbarCommand('heading', headingLevel);
      } else if (headingLevel === 7) {
        this.runToolbarCommand('heading', 6);
      }
    }
  }

  protected onBlockStyleSelected(event: Event): void {
    const select = event.currentTarget;
    if (select instanceof HTMLSelectElement) {
      this.applyBlockStyle(select.value);
    }
  }

  protected applyListStyle(style: 'bulletList' | 'orderedList'): void {
    this.runToolbarCommand(style);
  }

  protected applyCharacterStyle(style: 'strong' | 'emphasis' | 'intense'): void {
    if (style === 'intense') {
      this.runToolbarCommand('strong');
      this.runToolbarCommand('emphasis');
      return;
    }

    this.runToolbarCommand(style);
  }

  private runToolbarCommand(command: ToolbarCommand, payload?: number): void {
    if (!this.editor || !this.commandRunners) return;

    this.commandRunners[command](payload);
  }

  protected onFileSelected(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;

    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    void this.importDocument(file);
  }

  protected async buildEmail(reuseMergeData = false): Promise<void> {
    if (!this.editor) {
      this.errorMessage.set('The Markdown editor is not ready yet. Please try again.');
      return;
    }

    this.isCompiling.set(true);
    this.errorMessage.set('');

    try {
      const [{ getHTML }, { faker }, { default: mjml2html }] = await Promise.all([
        import('@milkdown/utils'),
        import('@faker-js/faker'),
        import('mjml-browser'),
      ]);
      const contentHtml = this.editor.action(getHTML());
      const mergeData = reuseMergeData && this.mergeData()
        ? this.mergeData()!
        : {
            fullName: faker.person.fullName(),
            email: faker.internet.email(),
            company: faker.company.name(),
          };
      const mergedHtml = contentHtml.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (placeholder, key: string) => {
        const value = mergeData[key];
        return value === undefined ? placeholder : this.escapeHtml(value);
      });
      const theme = this.activeTheme();
      const body = theme.styles.paragraph;
      const mjml = `
        <mjml>
          <mj-head>
            <mj-attributes>
              <mj-text
                font-family="${body.fontFamily}"
                font-size="${body.fontSize}"
                font-weight="${body.fontWeight}"
                letter-spacing="${body.letterSpacing === 'normal' ? '0px' : body.letterSpacing}"
                line-height="${body.lineHeight}"
                color="${body.color}"
              />
            </mj-attributes>
            <mj-style inline="inline">${this.createEmailThemeCss(theme)}</mj-style>
          </mj-head>
          <mj-body background-color="${theme.colors.emailBackground}">
            <mj-section background-color="${theme.colors.contentBackground}" padding="32px 24px">
              <mj-column>
                <mj-text css-class="email-content">${mergedHtml}</mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>`;
      const result = await mjml2html(mjml);

      if (result.errors.length > 0) {
        throw new Error(result.errors.map(({ message }) => message).join('\n'));
      }

      this.mergeData.set(mergeData);
      this.previewReady.set(true);
      if (this.previewFrame) {
        this.previewFrame.nativeElement.srcdoc = result.html;
      }
    } catch (error) {
      this.showError('The email preview could not be built.', error);
    } finally {
      this.isCompiling.set(false);
    }
  }

  private async importDocument(file: File): Promise<void> {
    this.errorMessage.set('');
    if (!file.name.toLowerCase().endsWith('.docx')) {
      this.errorMessage.set('Please select a .docx file.');
      return;
    }

    try {
      const [{ default: mammoth }, { replaceAll }] = await Promise.all([
        import('mammoth'),
        import('@milkdown/utils'),
      ]);
      const { value } = await mammoth.convertToHtml(
        { arrayBuffer: await file.arrayBuffer() },
        { styleMap: WORD_STYLE_MAP },
      );
      const markdown = convertWordHtmlToMarkdown(value);

      if (this.editor) {
        this.editor.action(replaceAll(markdown));
      } else {
        this.pendingMarkdown = markdown;
      }

      this.sourceFile.set(file.name);
      this.previewReady.set(false);
      this.mergeData.set(null);
    } catch (error) {
      this.showError('The selected Word document could not be imported.', error);
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character] ?? character;
    });
  }

  private showError(message: string, error: unknown): void {
    console.error(message, error);
    this.errorMessage.set(error instanceof Error ? `${message} ${error.message}` : message);
  }
}
