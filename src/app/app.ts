import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, signal } from '@angular/core';
import type { Editor } from '@milkdown/core';
import TurndownService from 'turndown';

const initialMarkdown = `# Hello {fullName}

We're excited to welcome you to **{company}**.

Your contact email is {email}.

Best,
The team`;

const turndown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' });

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
          <span class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">Proof of concept</span>
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
  styles: [
    `
      .milkdown-editor {
        background: #fff;
      }

      .milkdown-editor .editor {
        min-height: 19rem;
        outline: none;
      }

      .milkdown-editor p {
        margin: 0.75rem 0;
      }

      .milkdown-editor h1,
      .milkdown-editor h2,
      .milkdown-editor h3 {
        margin: 1rem 0 0.5rem;
        font-weight: 700;
      }
    `,
  ],
})
export class App implements AfterViewInit, OnDestroy {
  @ViewChild('editorRoot', { static: true }) private editorRoot!: ElementRef<HTMLDivElement>;
  @ViewChild('previewFrame') private previewFrame?: ElementRef<HTMLIFrameElement>;

  protected readonly sourceFile = signal('');
  protected readonly errorMessage = signal('');
  protected readonly isCompiling = signal(false);
  protected readonly previewReady = signal(false);
  protected readonly mergeData = signal<Record<string, string> | null>(null);

  private editor?: Editor;
  private pendingMarkdown = initialMarkdown;

  async ngAfterViewInit(): Promise<void> {
    try {
      const [{ Editor, defaultValueCtx, rootCtx }, { commonmark }, { gfm }, { nord }] = await Promise.all([
        import('@milkdown/core'),
        import('@milkdown/preset-commonmark'),
        import('@milkdown/preset-gfm'),
        import('@milkdown/theme-nord'),
      ]);
      this.editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, this.editorRoot.nativeElement);
          ctx.set(defaultValueCtx, this.pendingMarkdown);
        })
        .config(nord)
        .use(commonmark)
        .use(gfm)
        .create();
    } catch (error) {
      this.showError('The Markdown editor could not be initialized.', error);
    }
  }

  async ngOnDestroy(): Promise<void> {
    await this.editor?.destroy();
  }

  protected onFileSelected(event: Event): void {
    const input = event.currentTarget;
    if (!(input instanceof HTMLInputElement)) return;

    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    void this.importDocument(file);
  }

  protected async buildEmail(): Promise<void> {
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
      const mergeData: Record<string, string> = {
        fullName: faker.person.fullName(),
        email: faker.internet.email(),
        company: faker.company.name(),
      };
      const mergedHtml = contentHtml.replace(/\{([a-zA-Z][a-zA-Z0-9]*)\}/g, (placeholder, key: string) => {
        const value = mergeData[key];
        return value === undefined ? placeholder : this.escapeHtml(value);
      });
      const mjml = `
        <mjml>
          <mj-head>
            <mj-attributes>
              <mj-text font-family="Arial, sans-serif" font-size="16px" line-height="1.6" color="#1e293b" />
            </mj-attributes>
          </mj-head>
          <mj-body background-color="#f1f5f9">
            <mj-section background-color="#ffffff" padding="32px 24px">
              <mj-column>
                <mj-text>${mergedHtml}</mj-text>
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
      const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
      const markdown = turndown.turndown(value);

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
