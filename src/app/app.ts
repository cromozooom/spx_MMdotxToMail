import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { DotxStarterService } from './dotx-starter.service';
import {
  DEFAULT_EMAIL_CLIENT,
  EmailClient,
  GMAIL_FILTER,
  GMAIL_IFRAME_BACKGROUND,
  PreviewMode,
  PreviewPalette,
  applyPreviewMode,
} from './email-preview-mode';

type PreviewClient = 'default' | EmailClient;
import { AppShellComponent } from './layout/app-shell.component';
import { PanelComponent } from './layout/panel.component';
import { SplitPaneComponent } from './layout/split-pane.component';
import type { Editor } from '@milkdown/core';
import {
  DEFAULT_THEME,
  DEFAULT_THEME_REVISION,  DEFAULT_THEME_LIBRARY,
  DocumentTheme,
  ThemeStyleName,
  parseDocumentTheme,
  parseThemeLibrary,
  themeLibraryJson,
} from './theme-library';
import { convertWordHtmlToMarkdown, WORD_STYLE_MAP } from './word-document';

const initialMarkdown = `# Hello {fullName}

We're excited to welcome you to **{company}**.

## Heading 2

### Heading 3

#### Heading 4

##### Heading 5

###### Heading 6

A normal paragraph with **strong**, *emphasis* and ***intense emphasis*** text.

> A quote block.

- First bullet
- Second bullet

1. First step
2. Second step

Your contact email is {email}.

Best,
The team`;

const themeStorageKey = 'dotx-mailmerge.theme-library.v1';
const previewStorageKey = 'dotx-mailmerge.preview-mode.v1';
const defaultRevisionKey = 'dotx-mailmerge.default-theme-revision';

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
  imports: [AppShellComponent, PanelComponent, SplitPaneComponent],
  template: `
    <app-shell>
      <div shellHeader class="flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Dotx Mailmerge</p>
          <h1 class="mt-1 text-xl font-bold tracking-tight">Document to email</h1>
        </div>
        <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Proof of concept</span>
      </div>

      <div config class="space-y-5 p-5">
        <section class="space-y-3">
          <h2 class="text-base font-semibold">Theme</h2>
          <div class="flex flex-col gap-2">
            <label for="theme-select" class="text-sm font-medium text-slate-600">Active theme</label>
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
            <button type="button" class="format-button" (click)="downloadDotx()">Download .dotx</button>
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
          </div>
        </section>

        <section class="space-y-3">
          <h2 class="text-base font-semibold">Appearance</h2>
          <div class="flex flex-col gap-2">
            <span id="color-scheme-label" class="text-sm font-medium text-slate-600">App color scheme</span>
            <div role="group" aria-labelledby="color-scheme-label" class="grid grid-cols-2 gap-2">
              <button
                type="button"
                class="format-button"
                [class.format-button-active]="!isDark()"
                [attr.aria-pressed]="!isDark()"
                (click)="setColorScheme('light')"
              >Light</button>
              <button
                type="button"
                class="format-button"
                [class.format-button-active]="isDark()"
                [attr.aria-pressed]="isDark()"
                (click)="setColorScheme('dark')"
              >Dark</button>
            </div>
          </div>
        </section>

        <p class="text-sm leading-6 text-slate-600">
          Upload a Word document, refine its contents, and preview an email-ready HTML version.
          Use placeholders such as <code class="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">&#123;fullName&#125;</code>,
          <code class="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">&#123;email&#125;</code>, and
          <code class="rounded bg-slate-200 px-1.5 py-0.5 text-slate-800">&#123;company&#125;</code>.
        </p>

        @if (errorMessage()) {
          <div role="alert" class="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {{ errorMessage() }}
          </div>
        }
      </div>

      <app-split-pane main handleLabel="Resize editor and preview" [minStart]="360" [minEnd]="360">
          <app-panel paneStart badge="01" heading="Import and edit">
              <label panelActions class="cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Choose .docx
                <input class="sr-only" type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" (change)="onFileSelected($event)">
              </label>
            <div panelStatus>
              @if (sourceFile()) {
                Imported from <span class="font-medium text-slate-700">{{ sourceFile() }}</span>
              } @else {
                Start with the sample, or choose a .docx file to import its text.
              }
            </div>
            <div>
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
            </div>
            <div panelFooter class="flex gap-2">
              <span class="rounded bg-slate-100 px-2 py-0.5">Markdown editor</span>
              <span class="rounded bg-slate-100 px-2 py-0.5">GFM</span>
            </div>
          </app-panel>

          <app-panel paneEnd badge="02" heading="Email preview">
            <div panelActions class="flex items-center gap-2">
              @if (previewReady()) {
                <span class="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Compiled</span>
              } @else {
                <span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Waiting for content</span>
              }
              <button type="button" class="format-button" [disabled]="isCompiling()" (click)="buildEmail()">
                {{ isCompiling() ? 'Building…' : 'New sample data' }}
              </button>
            </div>
            <div panelStatus>
              @if (mergeData(); as data) {
                Sample merge data:
                <span class="font-medium text-slate-700">{{ data['fullName'] }}</span>
                · {{ data['email'] }} · {{ data['company'] }}
              } @else {
                The preview updates as you edit. Use "New sample data" to generate a fresh set of Faker values.
              }
            </div>
            <div class="flex h-full min-h-0 flex-col gap-3">
              <div role="toolbar" aria-label="Email client preview" class="flex flex-wrap items-center gap-2">
                @for (option of previewClientOptions; track option.client) {
                  <button
                    type="button"
                    class="format-button"
                    [class.format-button-active]="emailClient() === option.client"
                    [attr.aria-pressed]="emailClient() === option.client"
                    (click)="setEmailClient(option.client)"
                  >{{ option.label }}</button>
                }
                <span class="text-xs text-slate-500">
                  {{ isDark() ? 'Dark mode as rendered by this client' : 'Switch the app to Dark to emulate client dark modes' }}
                </span>
              </div>
              <div class="preview-stage min-h-0 flex-1 rounded-lg bg-slate-100 p-4">
                <div
                  class="mx-auto flex h-full min-h-80 max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-sm"
                  [style.filter]="previewMode() === 'gmail' ? gmailFilter : null"
                  [style.background-color]="previewMode() === 'apple' || previewMode() === 'outlook' ? '#121212' : null"
                >
                  <iframe
                    #previewFrame
                    title="Compiled email preview"
                    class="w-full flex-1 border-0"
                    [style.background-color]="previewMode() === 'gmail' ? gmailIframeBackground : null"
                    [class.hidden]="!previewReady()"
                    sandbox=""
                  ></iframe>
                  @if (!previewReady()) {
                    <div class="flex min-h-80 items-center justify-center px-8 text-center text-sm text-slate-500">
                      Your compiled email will appear here.
                    </div>
                  }
                </div>
              </div>
            </div>
          </app-panel>
      </app-split-pane>

      <span shellFooter>
        Documents are processed in your browser. This POC supports text and basic formatting; verify the final HTML in your target email clients before sending.
      </span>
    </app-shell>
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
  protected readonly colorScheme = signal<'light' | 'dark'>('light');
  protected readonly emailClient = signal<PreviewClient>(DEFAULT_EMAIL_CLIENT);
  // The app-level scheme and the selected client combine: only a real client emulates its dark mode.
  protected readonly previewMode = computed<PreviewMode>(() => {
    const client = this.emailClient();
    return this.colorScheme() === 'dark' && client !== 'default' ? client : 'light';
  });
  protected readonly isDark = computed(() => this.colorScheme() === 'dark');
  protected readonly gmailFilter = GMAIL_FILTER;
  protected readonly gmailIframeBackground = GMAIL_IFRAME_BACKGROUND;
  protected readonly previewClientOptions: { client: PreviewClient; label: string }[] = [
    { client: 'default', label: 'Default' },
    { client: 'gmail', label: 'Gmail' },
    { client: 'apple', label: 'Apple Mail' },
    { client: 'outlook', label: 'Outlook' },
  ];

  private compiledHtml = '';

  private editor?: Editor;
  private editorThemeStyle?: HTMLStyleElement;
  private commandRunners?: Record<ToolbarCommand, (payload?: number) => boolean>;
  private pendingMarkdown = initialMarkdown;
  private observer?: MutationObserver;
  private previewTimer?: ReturnType<typeof setTimeout>;

  private schedulePreview(): void {
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => void this.buildEmail(true), 300);
  }

  private readonly dotxStarter = inject(DotxStarterService);

  constructor() {
    this.loadThemeLibrary();
    this.loadPreviewPreferences();
  }

  protected setEmailClient(client: PreviewClient): void {
    this.emailClient.set(client);
    this.onPreviewModeChanged();
  }

  protected setColorScheme(scheme: 'light' | 'dark'): void {
    this.colorScheme.set(scheme);
    this.onPreviewModeChanged();
  }

  private onPreviewModeChanged(): void {
    document.documentElement.classList.toggle('app-dark', this.colorScheme() === 'dark');
    try {
      localStorage.setItem(
        previewStorageKey,
        JSON.stringify({ colorScheme: this.colorScheme(), emailClient: this.emailClient() }),
      );
    } catch {
      // Preferences are optional; the preview still works without storage.
    }
    this.renderPreview();
  }

  private loadPreviewPreferences(): void {
    try {
      const stored = JSON.parse(localStorage.getItem(previewStorageKey) ?? 'null') as {
        colorScheme?: unknown;
        emailClient?: unknown;
      } | null;
      if (stored?.colorScheme === 'light' || stored?.colorScheme === 'dark') this.colorScheme.set(stored.colorScheme);
      const client = this.previewClientOptions.find(({ client: id }) => id === stored?.emailClient);
      if (client) this.emailClient.set(client.client);
    } catch {
      // Ignore unreadable preferences and keep the defaults.
    }
    document.documentElement.classList.toggle('app-dark', this.colorScheme() === 'dark');
  }

  // Replacing srcdoc discards the previous document, so switching modes never accumulates iframes or listeners.
  private renderPreview(): void {
    if (!this.previewFrame || !this.compiledHtml) return;

    this.previewFrame.nativeElement.srcdoc = applyPreviewMode(
      this.compiledHtml,
      this.previewMode(),
      this.createPreviewPalette(this.activeTheme()),
    );
  }

  private createPreviewPalette(theme: DocumentTheme): PreviewPalette {
    const { emailBackground, contentBackground } = theme.colors;
    const others = Object.values(theme.styles)
      .map(({ backgroundColor }) => backgroundColor)
      .filter((color) => color !== 'transparent' && color !== emailBackground && color !== contentBackground);
    return {
      pageBackground: emailBackground,
      contentBackground,
      otherBackgrounds: [...new Set(others)],
    };
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
      this.observer = new MutationObserver(() => this.schedulePreview());
      this.observer.observe(this.editorRoot.nativeElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
      });
      await this.buildEmail(true);
    } catch (error) {
      this.showError('The Markdown editor could not be initialized.', error);
    }
  }

  async ngOnDestroy(): Promise<void> {
    this.observer?.disconnect();
    clearTimeout(this.previewTimer);
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

  protected async downloadDotx(): Promise<void> {
    try {
      await this.dotxStarter.downloadStarterDotx(this.activeTheme());
    } catch (error) {
      this.showError('The Word template could not be generated.', error);
    }
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
        localStorage.setItem(defaultRevisionKey, DEFAULT_THEME_REVISION);
        this.persistThemeLibrary();
        return;
      }

      const library = parseThemeLibrary(JSON.parse(stored));
      const themes = library.themes;
      if (localStorage.getItem(defaultRevisionKey) !== DEFAULT_THEME_REVISION) {
        const index = themes.findIndex(({ id }) => id === DEFAULT_THEME.id);
        if (index >= 0) themes[index] = DEFAULT_THEME;
        else themes.unshift(DEFAULT_THEME);
        localStorage.setItem(defaultRevisionKey, DEFAULT_THEME_REVISION);
      }
      this.themes.set(themes);
      this.selectedThemeId.set(library.selectedThemeId);
      this.persistThemeLibrary();
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
    return `${editorRule}\n${styleRules}\n${this.createListLayoutCss('.milkdown-editor')}`;
  }

  // Shared by the editor and the email so lists look identical (Tailwind's reset removes markers in the editor).
  private createListLayoutCss(scope: string): string {
    return [
      `${scope} ul{list-style-type:disc;padding-left:24px}`,
      `${scope} ol{list-style-type:decimal;padding-left:24px}`,
      `${scope} ul ul{list-style-type:circle}`,
      `${scope} li p{margin-top:0;margin-bottom:0}`,
    ].join('\n');
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

    return `${this.createThemeStyleRules(theme, rules)}\n${this.createListLayoutCss('.email-content')}`.replace(
      /<\/style/gi,
      '<\\/style',
    );
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

      this.compiledHtml = result.html;
      this.mergeData.set(mergeData);
      this.previewReady.set(true);
      this.renderPreview();
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
