import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { highlightCode } from './code-highlight';
import { prettyPrintMarkup } from './pretty-print';
import { StyledSpanClass, STYLED_SPAN_CLASSES, createStyledSpanPlugins } from './styled-span';
import { BlockAlign, MarginSide, createBlockLayoutPlugins } from './block-layout';
import { isTourDone, startTour } from './app-tour';
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
import { FloatingPanelComponent } from './layout/floating-panel.component';
import { PanelComponent } from './layout/panel.component';
import { SplitPaneComponent } from './layout/split-pane.component';
import type { Editor } from '@milkdown/core';
import type { EditorView } from '@milkdown/prose/view';
import { NgOptionTemplateDirective, NgSelectComponent } from '@ng-select/ng-select';
import { FormsModule } from '@angular/forms';
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

Also <span class="subtle">subtle emphasis</span>, a <span class="book-title">book title</span>, a <span class="subtle-ref">subtle reference</span> and an <span class="intense-ref">intense reference</span>.
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
const appThemeStorageKey = 'dotx-mailmerge.app-theme.v1';

type AppTheme = 'light' | 'dark' | 'system';
type PipelineStepId = 'markdown' | 'mjml' | 'html';
const defaultRevisionKey = 'dotx-mailmerge.default-theme-revision';

type ToolbarCommand =
  | 'heading'
  | 'paragraph'
  | 'blockquote'
  | 'bulletList'
  | 'orderedList'
  | 'codeBlock'
  | 'strong'
  | 'emphasis'
  | 'strike';

interface GalleryStyle {
  id: string;
  label: string;
  kind: 'block' | 'list' | 'char';
  value: string;
  html: string;
}

@Component({
  selector: 'app-root',
  imports: [AppShellComponent, PanelComponent, SplitPaneComponent, FloatingPanelComponent, NgSelectComponent, NgOptionTemplateDirective, FormsModule],
  template: `
    <app-shell>
      <div shellHeader class="flex items-center justify-between">
        <h1 class="m-0"><a href="./" aria-label="sPX_MMdotXToMail home" class="brand">s<span class="brand-accent">PX</span>_MMdotXToMail</a></h1>
        <div class="flex items-center gap-4">
          <label for="color-theme" class="theme-control">
            <span>Theme</span>
            <select id="color-theme" aria-label="Color theme" (change)="onAppThemeSelected($event)">
              @for (option of appThemeOptions; track option.value) {
                <option [value]="option.value" [selected]="option.value === appTheme()">{{ option.label }}</option>
              }
            </select>
          </label>
          <button id="tour-help" type="button" class="format-button" (click)="startTour()">Help</button>
        </div>
      </div>

      <div config id="tour-config" class="space-y-5 p-5">
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
            <div role="group" aria-label="Theme JSON" class="btn-group w-full">
              <button id="tour-download-json" type="button" class="format-button flex-1" (click)="downloadTheme()">Download JSON</button>
              <label id="tour-upload-json" class="format-button flex-1 cursor-pointer text-center">
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
            <button id="tour-download-dotx" type="button" class="format-button" (click)="downloadDotx()">Download .dotx</button>
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
          <app-panel #editorPanel id="tour-editor" paneStart badge="01" heading="Import and edit">
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
            <div
              panelToolbar
              role="toolbar"
              aria-label="Text formatting"
              class="flex min-w-0 flex-1 flex-nowrap items-center gap-2 overflow-x-auto"
            >
                <button
                  type="button"
                  class="format-button shrink-0"
                  title="Open the styles gallery"
                  [attr.aria-expanded]="stylesOpen()"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="stylesOpen.set(!stylesOpen())"
                >Styles</button>
                <label class="sr-only" for="block-style">Paragraph style</label>
                <ng-select
                  #blockStyleSelect
                  id="block-style"
                  class="block-style-select"
                  aria-label="Paragraph style"
                  [items]="blockStyleOptions"
                  bindLabel="label"
                  bindValue="value"
                  [clearable]="false"
                  [searchable]="false"
                  [appendTo]="'body'"
                  placeholder="Style"
                  [ngModel]="dropdownValue()"
                  [disabled]="!editorReady()"
                  (change)="onBlockStyleChanged($event?.value)"
                >
                  <ng-template ng-option-tmp let-item="item">
                    <div class="style-option milkdown-editor" [innerHTML]="item.html"></div>
                  </ng-template>
                </ng-select>
                <ng-select
                  id="block-align"
                  class="align-select"
                  aria-label="Text alignment"
                  [items]="alignOptions"
                  bindLabel="label"
                  bindValue="value"
                  [clearable]="false"
                  [searchable]="false"
                  [appendTo]="'body'"
                  [ngModel]="currentAlign()"
                  [disabled]="!editorReady()"
                  (change)="onAlignChanged($event?.value)"
                ></ng-select>
                <ng-select
                  id="block-line-height"
                  class="line-height-select"
                  aria-label="Line height"
                  title="Line height"
                  [items]="lineHeightOptions"
                  bindLabel="label"
                  bindValue="value"
                  [clearable]="true"
                  [searchable]="false"
                  [appendTo]="'body'"
                  placeholder="Line height"
                  [ngModel]="currentLineHeight()"
                  [disabled]="!editorReady()"
                  (change)="onLineHeightChanged($event?.value)"
                  (clear)="onLineHeightChanged(null)"
                ></ng-select>
                <div role="group" aria-label="Indent" class="btn-group">
                <button
                  type="button"
                  aria-label="Decrease indent"
                  title="Decrease indent (10px)"
                  class="format-button"
                  [disabled]="!editorReady() || currentIndent() === 0"
                  (mousedown)="$event.preventDefault()"
                  (click)="changeIndent(-1)"
                >⇤</button>
                <button
                  type="button"
                  aria-label="Increase indent"
                  title="Increase indent (10px)"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="changeIndent(1)"
                >⇥</button>
                </div>
                <div role="group" aria-label="Block spacing" class="btn-group">
                <div role="group" aria-label="Margin side" class="segmented shrink-0">
                  <button
                    type="button"
                    title="Adjust the margin above the block"
                    [class.selected]="marginSide() === 'top'"
                    [attr.aria-pressed]="marginSide() === 'top'"
                    [disabled]="!editorReady()"
                    (mousedown)="$event.preventDefault()"
                    (click)="marginSide.set('top')"
                  >Top</button>
                  <button
                    type="button"
                    title="Adjust the margin below the block"
                    [class.selected]="marginSide() === 'bottom'"
                    [attr.aria-pressed]="marginSide() === 'bottom'"
                    [disabled]="!editorReady()"
                    (mousedown)="$event.preventDefault()"
                    (click)="marginSide.set('bottom')"
                  >Bottom</button>
                </div>
                <button
                  type="button"
                  aria-label="Decrease margin"
                  [title]="'Decrease ' + marginSide() + ' margin (10px)'"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="changeMargin(-1)"
                >▼</button>
                <button
                  type="button"
                  aria-label="Increase margin"
                  [title]="'Increase ' + marginSide() + ' margin (10px)'"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="changeMargin(1)"
                >▲</button>
                </div>
                <button
                  type="button"
                  aria-label="Clear styles"
                  title="Clear all styles from the selected block"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  (click)="clearStyles()"
                >Clear</button>
                <div role="group" aria-label="Lists" class="btn-group">
                <button
                  type="button"
                  aria-label="Bulleted list"
                  title="Bulleted list"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  [class.format-button-active]="isActive('bullet')"
                  [attr.aria-pressed]="isActive('bullet')"
                  (click)="applyListStyle('bulletList')"
                >ul</button>
                <button
                  type="button"
                  aria-label="Numbered list"
                  title="Numbered list"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  [class.format-button-active]="isActive('ordered')"
                  [attr.aria-pressed]="isActive('ordered')"
                  (click)="applyListStyle('orderedList')"
                >ol</button>
                </div>
                <div role="group" aria-label="Character styles" class="btn-group">
                <button
                  type="button"
                  aria-label="Strong (bold)"
                  title="Strong (bold)"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  [class.format-button-active]="isActive('strong')"
                  [attr.aria-pressed]="isActive('strong')"
                  (click)="applyCharacterStyle('strong')"
                ><strong>B</strong></button>
                <button
                  type="button"
                  aria-label="Emphasis (italic)"
                  title="Emphasis (italic)"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  [class.format-button-active]="isActive('emphasis')"
                  [attr.aria-pressed]="isActive('emphasis')"
                  (click)="applyCharacterStyle('emphasis')"
                ><em>I</em></button>
                <button
                  type="button"
                  aria-label="Strikethrough"
                  title="Strikethrough"
                  class="format-button"
                  [disabled]="!editorReady()"
                  (mousedown)="$event.preventDefault()"
                  [class.format-button-active]="isActive('strike')"
                  [attr.aria-pressed]="isActive('strike')"
                  (click)="applyCharacterStyle('strike')"
                ><s>S</s></button>
                </div>
            </div>
            <div #editorRoot class="milkdown-editor min-h-80 rounded-lg border border-slate-200 px-4 py-3"></div>
            <div panelFooter class="flex gap-2">
              <span class="rounded bg-slate-100 px-2 py-0.5">Markdown editor</span>
              <span class="rounded bg-slate-100 px-2 py-0.5">GFM</span>
            </div>
          </app-panel>

          <app-panel #previewPanel id="tour-preview" paneEnd badge="02" heading="Email preview">
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
            <div panelToolbar class="flex min-w-0 flex-1 flex-nowrap items-center gap-3 overflow-x-auto">
              <div role="group" aria-label="Email client preview" class="segmented shrink-0">
                @for (option of previewClientOptions; track option.client) {
                  <button
                    type="button"
                    [class.selected]="emailClient() === option.client"
                    [attr.aria-pressed]="emailClient() === option.client"
                    (click)="setEmailClient(option.client)"
                  >{{ option.label }}</button>
                }
              </div>
              <div role="group" aria-label="Preview width" class="segmented shrink-0">
                @for (option of viewportOptions; track option.value) {
                  <button
                    type="button"
                    [class.selected]="previewViewport() === option.value"
                    [attr.aria-pressed]="previewViewport() === option.value"
                    [title]="option.title"
                    (click)="previewViewport.set(option.value)"
                  >{{ option.label }}</button>
                }
              </div>
              <button
                id="tour-pipeline"
                type="button"
                class="shrink-0 whitespace-nowrap text-xs font-medium underline decoration-dotted underline-offset-2 hover:text-[var(--brand)]"
                [attr.aria-expanded]="pipelineOpen()"
                (click)="pipelineOpen.set(!pipelineOpen())"
              >How it's built</button>
              <label class="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-slate-600">
                <input type="checkbox" [checked]="syncScroll()" (change)="onSyncScrollChanged($event)">
                Sync scroll
              </label>
              <span class="shrink-0 whitespace-nowrap text-xs text-slate-500">
                {{ isDark() ? 'Dark mode as rendered by this client' : 'Switch the app to Dark to emulate client dark modes' }}
              </span>
            </div>
            <div class="preview-stage min-h-full rounded-lg bg-slate-100 p-4">
              <div
                class="mx-auto overflow-hidden rounded-lg bg-white shadow-sm transition-[max-width] duration-200"
                [style.max-width.px]="previewViewport() === 'mobile' ? 375 : 760"
                [style.filter]="previewMode() === 'gmail' ? gmailFilter : null"
                [style.background-color]="previewMode() === 'apple' || previewMode() === 'outlook' ? '#121212' : null"
              >
                <iframe
                  #previewFrame
                  title="Compiled email preview"
                  class="block w-full border-0"
                  scrolling="no"
                  [style.background-color]="previewMode() === 'gmail' ? gmailIframeBackground : null"
                  [class.hidden]="!previewReady()"
                  sandbox="allow-same-origin"
                  (load)="fitPreviewFrame()"
                ></iframe>
                @if (!previewReady()) {
                  <div class="flex min-h-80 items-center justify-center px-8 text-center text-sm text-slate-500">
                    Your compiled email will appear here.
                  </div>
                }
              </div>
            </div>
          </app-panel>
      </app-split-pane>

      <span shellFooter>
        Documents are processed in your browser. This POC supports text and basic formatting; verify the final HTML in your target email clients before sending.
      </span>
    </app-shell>

      @if (stylesOpen()) {
        <app-floating-panel heading="Styles" (closed)="stylesOpen.set(false)">
          <div floatingActions role="group" aria-label="Gallery layout" class="segmented">
            <button type="button" [class.selected]="stylesLayout() === 'grid'" [attr.aria-pressed]="stylesLayout() === 'grid'" (click)="stylesLayout.set('grid')">Grid</button>
            <button type="button" [class.selected]="stylesLayout() === 'list'" [attr.aria-pressed]="stylesLayout() === 'list'" (click)="stylesLayout.set('list')">List</button>
          </div>
          <div class="styles-gallery milkdown-editor" [class.styles-list]="stylesLayout() === 'list'" role="list" aria-label="Styles gallery">
            @for (item of styleGallery; track item.id) {
              <button
                type="button"
                role="listitem"
                class="style-tile"
                [title]="'Apply ' + item.label"
                (mousedown)="$event.preventDefault()"
                (click)="applyGalleryStyle(item)"
              >
                <span class="style-tile-label">{{ item.label }}</span>
                <span class="style-tile-preview" [innerHTML]="item.html"></span>
              </button>
            }
          </div>
        </app-floating-panel>
      }

      @if (pipelineOpen()) {
        <app-floating-panel heading="How the email is built" (closed)="pipelineOpen.set(false)">
          <button floatingActions type="button" class="format-button" (click)="copyPipelineStep()">
            {{ copied() ? 'Copied' : 'Copy' }}
          </button>
          <div class="flex h-full min-h-0 flex-col">
            <div role="tablist" aria-label="Conversion steps" class="segmented m-3 shrink-0 self-start">
              @for (step of pipelineSteps; track step.id) {
                <button
                  type="button"
                  role="tab"
                  [class.selected]="pipelineStep() === step.id"
                  [attr.aria-selected]="pipelineStep() === step.id"
                  (click)="pipelineStep.set(step.id)"
                >{{ step.label }}</button>
              }
            </div>
            <p class="shrink-0 px-3 pb-2 text-xs leading-5 text-slate-500">{{ currentPipelineStep().description }}</p>
            <pre class="pipeline-code"><code class="hljs" [innerHTML]="highlightedSource()"></code></pre>
          </div>
        </app-floating-panel>
      }
  `,
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('blockStyleSelect') private blockStyleSelect?: NgSelectComponent;
  @ViewChild('editorRoot', { static: true }) private editorRoot!: ElementRef<HTMLDivElement>;
  @ViewChild('previewFrame') private previewFrame?: ElementRef<HTMLIFrameElement>;
  @ViewChild('editorPanel') private editorPanel?: PanelComponent;
  @ViewChild('previewPanel') private previewPanel?: PanelComponent;

  protected readonly syncScroll = signal(true);
  private scrollCleanup: (() => void)[] = [];

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
  protected readonly appThemeOptions: { value: AppTheme; label: string }[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
  ];
  protected readonly appTheme = signal<AppTheme>('system');
  private readonly systemDark = signal(false);
  protected readonly colorScheme = computed<'light' | 'dark'>(() => {
    const theme = this.appTheme();
    return theme === 'system' ? (this.systemDark() ? 'dark' : 'light') : theme;
  });
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

  protected readonly previewViewport = signal<'desktop' | 'mobile'>('desktop');
  protected readonly viewportOptions: { value: 'desktop' | 'mobile'; label: string; title: string }[] = [
    { value: 'desktop', label: 'Desktop', title: 'Wide email layout (760px)' },
    { value: 'mobile', label: 'Mobile', title: 'Phone-width email layout (375px)' },
  ];
  protected readonly stylesOpen = signal(false);
  protected readonly currentBlockStyle = signal<string | null>('paragraph');
  protected readonly activeFormats = signal<ReadonlySet<string>>(new Set());
  protected readonly alignOptions: { value: BlockAlign; label: string }[] = [
    { value: 'left', label: 'Left' },
    { value: 'center', label: 'Center' },
    { value: 'right', label: 'Right' },
    { value: 'justify', label: 'Justify' },
  ];
  protected readonly currentAlign = signal<BlockAlign>('left');
  protected readonly currentIndent = signal(0);
  protected readonly marginSide = signal<MarginSide>('top');

  protected changeMargin(direction: 1 | -1): void {
    if (!this.editor) return;
    this.blockLayout?.changeMargin(this.editor, this.marginSide(), direction);
    this.syncBlockStyle();
  }
  protected readonly lineHeightOptions = [1, 1.15, 1.25, 1.5, 1.75, 2, 2.25, 3, 4].map((value) => ({
    value,
    label: String(value),
  }));
  protected readonly currentLineHeight = signal<number | null>(null);

  // Picking a value overrides the theme's line height; clearing the select falls back to the theme.
  protected onLineHeightChanged(value: number | null | undefined): void {
    if (!this.editor) return;
    this.blockLayout?.setLineHeight(this.editor, value ?? null);
    this.syncBlockStyle();
  }
  private blockLayout?: Awaited<ReturnType<typeof createBlockLayoutPlugins>>;

  protected onAlignChanged(value: BlockAlign | undefined): void {
    if (!value || !this.editor) return;
    this.blockLayout?.setAlign(this.editor, value);
    this.syncBlockStyle();
  }

  protected changeIndent(direction: 1 | -1): void {
    if (!this.editor) return;
    this.blockLayout?.changeIndent(this.editor, direction);
    this.syncBlockStyle();
  }

  protected clearStyles(): void {
    if (!this.editor) return;
    this.liftOutOfBlockquote();
    this.blockLayout?.clearBlockStyles(this.editor);
    this.syncBlockStyle();
  }
  protected readonly blockStyleOptions: { value: string; label: string; kind: 'block' | 'char'; html: string }[] = [
    { value: 'paragraph', label: 'Paragraph', kind: 'block', html: '<p>Paragraph</p>' },
    { value: 'heading-1', label: 'Heading 1', kind: 'block', html: '<h1>Heading 1</h1>' },
    { value: 'heading-2', label: 'Heading 2', kind: 'block', html: '<h2>Heading 2</h2>' },
    { value: 'heading-3', label: 'Heading 3', kind: 'block', html: '<h3>Heading 3</h3>' },
    { value: 'heading-4', label: 'Heading 4', kind: 'block', html: '<h4>Heading 4</h4>' },
    { value: 'heading-5', label: 'Heading 5', kind: 'block', html: '<h5>Heading 5</h5>' },
    { value: 'heading-6', label: 'Heading 6', kind: 'block', html: '<h6>Heading 6</h6>' },
    { value: 'quote', label: 'Quote', kind: 'block', html: '<blockquote>Quote</blockquote>' },
    { value: 'code', label: 'Code block', kind: 'block', html: '<pre><code>Code block</code></pre>' },
    { value: 'subtle', label: 'Subtle Emphasis', kind: 'char', html: '<p><span class="subtle">Subtle Emphasis</span></p>' },
    { value: 'intense', label: 'Intense Emphasis', kind: 'char', html: '<p><strong><em>Intense Emphasis</em></strong></p>' },
    { value: 'book-title', label: 'Book Title', kind: 'char', html: '<p><cite>Book Title</cite></p>' },
    { value: 'subtle-ref', label: 'Subtle Reference', kind: 'char', html: '<p><span class="subtle-ref">Subtle Reference</span></p>' },
    { value: 'intense-ref', label: 'Intense Reference', kind: 'char', html: '<p><span class="intense-ref">Intense Reference</span></p>' },
  ];
  // Only real span styles take over the dropdown; bold + italic is plain formatting on the block.
  private static readonly dropdownCharStyles = ['subtle', 'book-title', 'subtle-ref', 'intense-ref'];
  // A character style at the cursor takes over the dropdown; otherwise it shows the block type.
  protected readonly dropdownValue = computed(() => {
    const formats = this.activeFormats();
    return App.dropdownCharStyles.find((style) => formats.has(style)) ?? this.currentBlockStyle();
  });
  private getEditorView?: () => EditorView | undefined;
  private liftCommand?: (state: EditorView['state'], dispatch: EditorView['dispatch']) => boolean;
  private readonly onSelectionChange = (): void => this.syncBlockStyle();
  protected readonly stylesLayout = signal<'grid' | 'list'>('grid');
  protected readonly styleGallery: GalleryStyle[] = [
    { id: 'paragraph', label: 'Paragraph', kind: 'block', value: 'paragraph', html: '<p>Normal text</p>' },
    { id: 'title', label: 'Title', kind: 'block', value: 'title', html: '<h1 class="document-title">Title</h1>' },
    { id: 'subtitle', label: 'Subtitle', kind: 'block', value: 'subtitle', html: '<p class="document-subtitle">Subtitle</p>' },
    { id: 'h1', label: 'Heading 1', kind: 'block', value: 'heading-1', html: '<h1>Heading 1</h1>' },
    { id: 'h2', label: 'Heading 2', kind: 'block', value: 'heading-2', html: '<h2>Heading 2</h2>' },
    { id: 'h3', label: 'Heading 3', kind: 'block', value: 'heading-3', html: '<h3>Heading 3</h3>' },
    { id: 'h4', label: 'Heading 4', kind: 'block', value: 'heading-4', html: '<h4>Heading 4</h4>' },
    { id: 'h5', label: 'Heading 5', kind: 'block', value: 'heading-5', html: '<h5>Heading 5</h5>' },
    { id: 'h6', label: 'Heading 6', kind: 'block', value: 'heading-6', html: '<h6>Heading 6</h6>' },
    { id: 'quote', label: 'Quote', kind: 'block', value: 'quote', html: '<blockquote>Quote</blockquote>' },
    { id: 'intense-quote', label: 'Intense Quote', kind: 'block', value: 'intense-quote', html: '<blockquote class="intense">Intense quote</blockquote>' },
    { id: 'bullet', label: 'Bulleted list', kind: 'list', value: 'bulletList', html: '<ul><li>List item</li></ul>' },
    { id: 'ordered', label: 'Numbered list', kind: 'list', value: 'orderedList', html: '<ol><li>List item</li></ol>' },
    { id: 'strong', label: 'Strong', kind: 'char', value: 'strong', html: '<strong>Strong</strong>' },
    { id: 'emphasis', label: 'Emphasis', kind: 'char', value: 'emphasis', html: '<em>Emphasis</em>' },
    { id: 'subtle', label: 'Subtle Emphasis', kind: 'char', value: 'subtle', html: '<span class="subtle">Subtle Emphasis</span>' },
    { id: 'intense', label: 'Intense Emphasis', kind: 'char', value: 'intense', html: '<strong><em>Intense Emphasis</em></strong>' },
    { id: 'book-title', label: 'Book Title', kind: 'char', value: 'book-title', html: '<cite>Book Title</cite>' },
    { id: 'subtle-ref', label: 'Subtle Reference', kind: 'char', value: 'subtle-ref', html: '<span class="subtle-ref">Subtle Reference</span>' },
    { id: 'intense-ref', label: 'Intense Reference', kind: 'char', value: 'intense-ref', html: '<span class="intense-ref">Intense Reference</span>' },
  ];
  protected readonly pipelineOpen = signal(false);
  protected readonly pipelineStep = signal<PipelineStepId>('markdown');
  protected readonly copied = signal(false);
  protected readonly pipelineSteps: { id: PipelineStepId; label: string; description: string }[] = [
    {
      id: 'markdown',
      label: '1 · Markdown',
      description:
        'What you typed or imported from Word. Word styles were mapped to Markdown (headings, quotes, lists, emphasis). {placeholders} are still unresolved.',
    },
    {
      id: 'mjml',
      label: '2 · MJML',
      description:
        'The Markdown rendered to HTML, merged with this sample data and wrapped in MJML tags using the active theme (colours, fonts, spacing).',
    },
    {
      id: 'html',
      label: '3 · HTML',
      description:
        'The final email HTML produced by compiling the MJML: table-based layout with inline styles, ready to send. Client dark-mode previews are not included here.',
    },
  ];
  protected readonly currentPipelineStep = computed(
    () => this.pipelineSteps.find(({ id }) => id === this.pipelineStep()) ?? this.pipelineSteps[0],
  );
  private readonly pipelineSources = signal<Record<PipelineStepId, string>>({ markdown: '', mjml: '', html: '' });
  protected readonly pipelineSource = computed(() => this.pipelineSources()[this.pipelineStep()]);
  // MJML and the final email are both XML-like markup.
  protected readonly highlightedSource = computed(() => {
    const source = this.pipelineSource();
    if (!source) return 'Nothing compiled yet. Edit the document or click "New sample data".';
    return highlightCode(source, this.pipelineStep() === 'markdown' ? 'markdown' : 'xml');
  });

  private compiledHtml = '';

  private editor?: Editor;
  private editorThemeStyle?: HTMLStyleElement;
  private commandRunners?: Record<ToolbarCommand, (payload?: number) => boolean>;
  private toggleStyledSpan?: (cls: StyledSpanClass) => unknown;
  private pendingMarkdown = initialMarkdown;
  private observer?: MutationObserver;
  private previewTimer?: ReturnType<typeof setTimeout>;

  private schedulePreview(): void {
    clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => void this.buildEmail(true), 300);
  }

  private readonly dotxStarter = inject(DotxStarterService);
  private readonly systemQuery =
    typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : undefined;
  private readonly onSystemSchemeChange = (event: MediaQueryListEvent): void => {
    this.systemDark.set(event.matches);
    this.onPreviewModeChanged();
  };

  constructor() {
    this.loadThemeLibrary();
    this.systemDark.set(this.systemQuery?.matches ?? false);
    this.systemQuery?.addEventListener('change', this.onSystemSchemeChange);
    this.loadPreviewPreferences();
  }

  protected onSyncScrollChanged(event: Event): void {
    this.syncScroll.set((event.currentTarget as HTMLInputElement).checked);
  }

  // The iframe is sized to its content so the panel body is the only scroller, which makes it syncable.
  protected fitPreviewFrame(): void {
    const frame = this.previewFrame?.nativeElement;
    const root = frame?.contentDocument?.documentElement;
    if (!frame || !root) return;

    frame.style.height = `${Math.ceil(root.getBoundingClientRect().height)}px`;
  }

  private setUpScrollSync(): void {
    const editorBody = this.editorPanel?.bodyRef().nativeElement;
    const previewBody = this.previewPanel?.bodyRef().nativeElement;
    if (!editorBody || !previewBody) return;

    // A programmatic scroll echoes back as a scroll event, but the mirrored target is then already within 1px, so it settles.
    const mirror = (from: HTMLElement, to: HTMLElement) => () => {
      if (!this.syncScroll()) return;
      const fromRange = from.scrollHeight - from.clientHeight;
      const toRange = to.scrollHeight - to.clientHeight;
      if (fromRange <= 0 || toRange <= 0) return;

      const target = (from.scrollTop / fromRange) * toRange;
      if (Math.abs(to.scrollTop - target) > 1) to.scrollTop = target;
    };
    const onEditorScroll = mirror(editorBody, previewBody);
    const onPreviewScroll = mirror(previewBody, editorBody);
    editorBody.addEventListener('scroll', onEditorScroll, { passive: true });
    previewBody.addEventListener('scroll', onPreviewScroll, { passive: true });
    this.scrollCleanup.push(
      () => editorBody.removeEventListener('scroll', onEditorScroll),
      () => previewBody.removeEventListener('scroll', onPreviewScroll),
    );

    const frame = this.previewFrame?.nativeElement;
    if (frame && typeof ResizeObserver === 'function') {
      let width = frame.clientWidth;
      let frameRequest = 0;
      const observer = new ResizeObserver(() => {
        if (frame.clientWidth === width) return;
        width = frame.clientWidth;
        // Resizing inside the callback would trigger "ResizeObserver loop" errors, so defer to the next frame.
        cancelAnimationFrame(frameRequest);
        frameRequest = requestAnimationFrame(() => this.fitPreviewFrame());
      });
      observer.observe(frame);
      this.scrollCleanup.push(() => observer.disconnect(), () => cancelAnimationFrame(frameRequest));
    }
  }

  protected setEmailClient(client: PreviewClient): void {
    this.emailClient.set(client);
    this.onPreviewModeChanged();
  }

  protected onAppThemeSelected(event: Event): void {
    const select = event.currentTarget;
    if (!(select instanceof HTMLSelectElement)) return;
    const option = this.appThemeOptions.find(({ value }) => value === select.value);
    if (!option) return;

    this.appTheme.set(option.value);
    this.onPreviewModeChanged();
  }

  private onPreviewModeChanged(): void {
    document.documentElement.classList.toggle('app-dark', this.isDark());
    try {
      localStorage.setItem(appThemeStorageKey, this.appTheme());
      localStorage.setItem(previewStorageKey, JSON.stringify({ emailClient: this.emailClient() }));
    } catch {
      // Preferences are optional; the preview still works without storage.
    }
    this.renderPreview();
  }

  private loadPreviewPreferences(): void {
    try {
      const theme = this.appThemeOptions.find(({ value }) => value === localStorage.getItem(appThemeStorageKey));
      if (theme) this.appTheme.set(theme.value);
      const stored = JSON.parse(localStorage.getItem(previewStorageKey) ?? 'null') as {
        emailClient?: unknown;
      } | null;
      const client = this.previewClientOptions.find(({ client: id }) => id === stored?.emailClient);
      if (client) this.emailClient.set(client.client);
    } catch {
      // Ignore unreadable preferences and keep the defaults.
    }
    document.documentElement.classList.toggle('app-dark', this.isDark());
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

  protected startTour(): void {
    startTour();
  }

  async ngAfterViewInit(): Promise<void> {
    this.setUpScrollSync();
    if (!isTourDone()) setTimeout(() => startTour(), 600);
    try {
      const [{ Editor, defaultValueCtx, rootCtx, editorViewCtx }, commonmarkModule, gfmModule, { nord }, { lift }] =
        await Promise.all([
          import('@milkdown/core'),
          import('@milkdown/preset-commonmark'),
          import('@milkdown/preset-gfm'),
          import('@milkdown/theme-nord'),
          import('@milkdown/prose/commands'),
        ]);
      const { commonmark } = commonmarkModule;
      const styledSpans = await createStyledSpanPlugins();
      this.blockLayout = await createBlockLayoutPlugins();
      this.toggleStyledSpan = (cls) => this.editor && styledSpans.toggle(this.editor, cls);
      this.liftCommand = lift;
      this.getEditorView = () => this.editor?.action((ctx) => ctx.get(editorViewCtx));
      this.commandRunners = {
        heading: (level) => commonmarkModule.wrapInHeadingCommand.run(level ?? 1),
        paragraph: () => commonmarkModule.turnIntoTextCommand.run(),
        codeBlock: () => commonmarkModule.createCodeBlockCommand.run(),
        blockquote: () => commonmarkModule.wrapInBlockquoteCommand.run(),
        bulletList: () => commonmarkModule.wrapInBulletListCommand.run(),
        orderedList: () => commonmarkModule.wrapInOrderedListCommand.run(),
        strong: () => commonmarkModule.toggleStrongCommand.run(),
        emphasis: () => commonmarkModule.toggleEmphasisCommand.run(),
        strike: () => gfmModule.toggleStrikethroughCommand.run(),
      };
      this.editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, this.editorRoot.nativeElement);
          ctx.set(defaultValueCtx, this.pendingMarkdown);
        })
        .config(nord)
        .use(this.blockLayout.plugins)
        .use(gfmModule.gfm)
        .use(styledSpans.plugins)
        .create();
      this.applyThemeToEditor();
      this.editorReady.set(true);
      document.addEventListener('selectionchange', this.onSelectionChange);
      this.syncBlockStyle();
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
    document.removeEventListener('selectionchange', this.onSelectionChange);
    this.systemQuery?.removeEventListener('change', this.onSystemSchemeChange);
    this.scrollCleanup.forEach((cleanup) => cleanup());
    this.scrollCleanup = [];
    clearTimeout(this.previewTimer);(this.previewTimer);
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
      const parsed = parseDocumentTheme(JSON.parse(await file.text()));
      const nextThemes = [...this.themes()];
      if (nextThemes.length >= 50) throw new Error('The theme library is limited to 50 themes.');

      // Uploads always add a new theme; a clashing id or name gets a numeric suffix instead of overwriting.
      const ids = new Set(nextThemes.map(({ id }) => id));
      const names = new Set(nextThemes.map(({ name }) => name));
      let theme = parsed;
      for (let copy = 2; ids.has(theme.id) || names.has(theme.name); copy++) {
        theme = { ...parsed, id: `${parsed.id}-${copy}`, name: `${parsed.name.slice(0, 50)} (${copy})` };
      }
      nextThemes.push(theme);
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
      ['.milkdown-editor span.subtle', 'subtleEmphasis'],
      ['.milkdown-editor strong em, .milkdown-editor em strong', 'intenseEmphasis'],
      ['.milkdown-editor cite, .milkdown-editor span.book-title', 'cite'],
      ['.milkdown-editor span.subtle-ref', 'subtleReference'],
      ['.milkdown-editor span.intense-ref', 'intenseReference'],
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
      ['.email-content span.subtle', 'subtleEmphasis'],
      ['.email-content strong em, .email-content em strong', 'intenseEmphasis'],
      ['.email-content cite, .email-content span.book-title', 'cite'],
      ['.email-content span.subtle-ref', 'subtleReference'],
      ['.email-content span.intense-ref', 'intenseReference'],
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
        // Plain bold/italic only emit what differs from the paragraph, so nesting (em > strong) keeps both effects.
        const inline = styleName === 'strong' || styleName === 'emphasis';
        const base = theme.styles.paragraph as unknown as Record<string, string>;
        const declarations = Object.entries(style)
          .filter(([property, value]) => !inline || base[property] !== value)
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
    if (style === 'subtitle') {
      this.applyCharacterStyle('emphasis');
      return;
    }

    const target = this.normalizeBlockStyle(style);
    if (!target || target === this.currentBlockStyle()) return;

    // Switching block type replaces the block (quotes are unwrapped first); inline marks are untouched.
    if (target !== 'quote') this.liftOutOfBlockquote();

    if (target === 'paragraph') {
      this.runToolbarCommand('paragraph');
    } else if (target === 'quote') {
      this.runToolbarCommand('blockquote');
    } else if (target === 'code') {
      this.runToolbarCommand('codeBlock');
    } else {
      this.runToolbarCommand('heading', Number(target.slice('heading-'.length)));
    }
    this.syncBlockStyle();
  }

  private normalizeBlockStyle(style: string): string | null {
    if (style === 'title') return 'heading-1';
    if (style === 'intense-quote') return 'quote';
    if (style === 'heading-7') return 'heading-6';
    return this.blockStyleOptions.some((option) => option.kind === 'block' && option.value === style) ? style : null;
  }

  private liftOutOfBlockquote(): void {
    const view = this.getEditorView?.();
    if (!view || !this.liftCommand) return;
    while (this.blockquoteDepth(view) > 0 && this.liftCommand(view.state, view.dispatch)) {
      // keep lifting until the selection is no longer inside a blockquote
    }
  }

  private blockquoteDepth(view: EditorView): number {
    const { $from } = view.state.selection;
    let depth = 0;
    for (let d = $from.depth; d > 0; d--) {
      if ($from.node(d).type.name === 'blockquote') depth++;
    }
    return depth;
  }

  // Reads the block under the cursor so the style dropdown mirrors it.
  protected syncBlockStyle(): void {
    const view = this.getEditorView?.();
    if (!view || !this.editorRoot.nativeElement.contains(view.dom)) return;
    const { $from } = view.state.selection;
    const parent = $from.parent;
    let style: string | null = null;
    if (parent.type.name === 'heading') {
      style = `heading-${parent.attrs['level']}`;
    } else if (parent.type.name === 'code_block') {
      style = 'code';
    } else if (this.blockquoteDepth(view) > 0) {
      style = 'quote';
    } else if (parent.type.name === 'paragraph') {
      style = 'paragraph';
    }
    this.currentBlockStyle.set(style);
    const align = parent.attrs['align'];
    this.currentAlign.set(align === 'center' || align === 'right' || align === 'justify' ? align : 'left');
    this.currentIndent.set(Number(parent.attrs['indent'] ?? 0));
    this.currentLineHeight.set(parent.attrs['lineHeight'] ?? null);
    this.syncActiveFormats(view);
  }

  protected isActive(format: string): boolean {
    return this.activeFormats().has(format);
  }

  // Collects the inline marks and list types at the selection so toolbar buttons can show as pressed.
  private syncActiveFormats(view: EditorView): void {
    const { state } = view;
    const { $from, from, to, empty } = state.selection;
    const active = new Set<string>();

    const hasMark = (name: string, cls?: string): boolean => {
      const markType = state.schema.marks[name];
      if (!markType) return false;
      const matches = (mark: { type: unknown; attrs: Record<string, unknown> }) =>
        mark.type === markType && (cls === undefined || mark.attrs['cls'] === cls);
      if (empty) return (state.storedMarks ?? $from.marks()).some(matches);
      let found = false;
      state.doc.nodesBetween(from, to, (node) => {
        if (node.isText && node.marks.some(matches)) found = true;
      });
      return found;
    };

    if (hasMark('strong')) active.add('strong');
    if (hasMark('emphasis')) active.add('emphasis');
    if (hasMark('strike_through')) active.add('strike');
    if (active.has('strong') && active.has('emphasis')) active.add('intense');
    for (const cls of STYLED_SPAN_CLASSES) {
      if (hasMark('styledSpan', cls)) active.add(cls);
    }
    for (let d = $from.depth; d > 0; d--) {
      const name = $from.node(d).type.name;
      if (name === 'bullet_list') active.add('bullet');
      if (name === 'ordered_list') active.add('ordered');
    }
    this.activeFormats.set(active);
  }

  protected onBlockStyleChanged(value: string | undefined): void {
    const option = this.blockStyleOptions.find((item) => item.value === value);
    if (option?.kind === 'char') {
      this.applyCharacterStyle(option.value as 'intense' | StyledSpanClass);
      // The model may not change (e.g. Intense Emphasis), so reset what the select displays.
      this.blockStyleSelect?.writeValue(this.dropdownValue());
    } else if (value) {
      this.applyBlockStyle(value);
    }
    this.getEditorView?.()?.focus();
  }

  protected applyGalleryStyle(item: GalleryStyle): void {
    if (item.kind === 'block') {
      this.applyBlockStyle(item.value);
    } else if (item.kind === 'list') {
      this.applyListStyle(item.value as 'bulletList' | 'orderedList');
    } else {
      this.applyCharacterStyle(item.value as 'strong' | 'emphasis' | 'intense' | StyledSpanClass);
    }
  }

  protected applyListStyle(style: 'bulletList' | 'orderedList'): void {
    this.runToolbarCommand(style);
  }

  protected applyCharacterStyle(style: 'strong' | 'emphasis' | 'strike' | 'intense' | StyledSpanClass): void {
    if (style === 'intense') {
      const bothActive = this.isActive('strong') && this.isActive('emphasis');
      if (bothActive || !this.isActive('strong')) this.runToolbarCommand('strong');
      if (bothActive || !this.isActive('emphasis')) this.runToolbarCommand('emphasis');
      return;
    }

    if (style !== 'strong' && style !== 'emphasis' && style !== 'strike') {
      this.toggleStyledSpan?.(style);
      this.getEditorView?.() && this.syncBlockStyle();
      return;
    }

    this.runToolbarCommand(style);
  }

  private runToolbarCommand(command: ToolbarCommand, payload?: number): void {
    if (!this.editor || !this.commandRunners) return;

    this.commandRunners[command](payload);
    this.syncBlockStyle();
    // Stored marks on an empty block don't fire selectionchange, so re-read once the transaction has settled.
    requestAnimationFrame(() => this.syncBlockStyle());
  }

  protected onFileSelected(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;

    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    void this.importDocument(file);
  }

  protected async copyPipelineStep(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.pipelineSource());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      // Clipboard access can be denied; the text is still selectable in the panel.
    }
  }

  protected async buildEmail(reuseMergeData = false): Promise<void> {
    if (!this.editor) {
      this.errorMessage.set('The Markdown editor is not ready yet. Please try again.');
      return;
    }

    this.isCompiling.set(true);
    this.errorMessage.set('');

    try {
      const [{ getHTML, getMarkdown }, { faker }, { default: mjml2html }] = await Promise.all([
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
      this.pipelineSources.set({
        markdown: this.editor.action(getMarkdown()),
        mjml: prettyPrintMarkup(mjml),
        html: prettyPrintMarkup(result.html),
      });
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
