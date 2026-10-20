import { Component } from '@angular/core';
import { SplitPaneComponent } from './split-pane.component';

/**
 * Full-height page shell: `shellHeader` on top, a resizable `config` | `main` split in the middle
 * (both keep a minimum width) and an optional `shellFooter` status bar.
 */
@Component({
  selector: 'app-shell',
  imports: [SplitPaneComponent],
  template: `
    <div class="flex h-screen min-w-[360px] flex-col bg-slate-50 text-slate-900">
      <header class="shrink-0 border-b border-slate-200 bg-white px-6 py-3"><ng-content select="[shellHeader]" /></header>
      <div class="min-h-0 flex-1">
        <app-split-pane [startSize]="340" [minStart]="260" [minEnd]="728" handleLabel="Resize configuration panel">
          <aside paneStart class="h-full bg-white"><ng-content select="[config]" /></aside>
          <main paneEnd class="h-full"><ng-content select="[main]" /></main>
        </app-split-pane>
      </div>
      <footer class="shrink-0 border-t border-slate-200 bg-white px-6 py-1.5 text-xs text-slate-500 empty:hidden"><ng-content select="[shellFooter]" /></footer>
    </div>
  `,
})
export class AppShellComponent {}
