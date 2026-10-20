import { Component, ElementRef, input, viewChild } from '@angular/core';

/**
 * Pane with a numbered header (`panelActions` slot on the right), an optional fixed-height `panelStatus` line,
 * an optional fixed-height `panelToolbar` row, a scrolling body (exposed as `bodyRef`), and an optional `panelFooter` strip.
 * Fixed row heights keep side-by-side panes aligned.
 */
@Component({
  selector: 'app-panel',
  template: `
    <section class="flex h-full min-h-0 flex-col bg-white">
      <div class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-5">
        <div class="flex items-center gap-3">
          @if (badge()) {
            <span class="rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">{{ badge() }}</span>
          }
          <h2 class="text-base font-semibold">{{ heading() }}</h2>
        </div>
        <div class="flex items-center gap-2"><ng-content select="[panelActions]" /></div>
      </div>
      <div class="h-9 shrink-0 truncate border-b border-slate-100 px-5 text-xs leading-9 text-slate-500 empty:hidden"><ng-content select="[panelStatus]" /></div>
      <div class="flex h-12 shrink-0 items-center border-b border-slate-100 bg-slate-50 px-5 empty:hidden"><ng-content select="[panelToolbar]" /></div>
      <div #body class="min-h-0 flex-1 overflow-auto p-5"><ng-content /></div>
      <div class="shrink-0 border-t border-slate-100 px-5 py-2 text-xs text-slate-500 empty:hidden"><ng-content select="[panelFooter]" /></div>
    </section>
  `,
  host: { class: 'block h-full min-h-0' },
})
export class PanelComponent {
  readonly heading = input.required<string>();
  readonly badge = input('');
  readonly bodyRef = viewChild.required<ElementRef<HTMLElement>>('body');
}
