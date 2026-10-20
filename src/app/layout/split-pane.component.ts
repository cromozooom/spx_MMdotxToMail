import { Component, ElementRef, computed, inject, input, signal } from '@angular/core';

const HANDLE_SIZE = 3;
const KEYBOARD_STEP = 24;

/**
 * Two resizable panes side by side. Project content with `paneStart` and `paneEnd`.
 * Without `startSize` both panes share the space equally until the handle is moved.
 * When the container is narrower than both minimum widths it scrolls horizontally.
 */
@Component({
  selector: 'app-split-pane',
  template: `
    <div class="h-full w-full overflow-x-auto overflow-y-hidden">
      <div
        #grid
        class="grid h-full"
        [style.grid-template-columns]="columns()"
        [style.min-width.px]="minStart() + minEnd() + handleSize"
      >
        <div class="min-h-0 min-w-0 overflow-auto"><ng-content select="[paneStart]" /></div>
        <div
          role="separator"
          aria-orientation="vertical"
          tabindex="0"
          [attr.aria-label]="handleLabel()"
          class="split-handle group relative cursor-col-resize touch-none outline-none"
          [class.split-handle-active]="dragging()"
          (pointerdown)="startDrag($event)"
          (pointermove)="drag($event)"
          (pointerup)="endDrag($event)"
          (pointercancel)="endDrag($event)"
          (keydown)="onKeydown($event)"
          (dblclick)="reset()"
        ></div>
        <div class="min-h-0 min-w-0 overflow-auto"><ng-content select="[paneEnd]" /></div>
      </div>
    </div>
  `,
  host: { class: 'block h-full min-h-0 w-full' },
})
export class SplitPaneComponent {
  readonly startSize = input<number | null>(null);
  readonly minStart = input(280);
  readonly minEnd = input(320);
  readonly handleLabel = input('Resize panels');

  protected readonly handleSize = HANDLE_SIZE;
  protected readonly dragging = signal(false);
  private readonly dragSize = signal<number | null>(null);
  protected readonly columns = computed(() => {
    const size = this.dragSize() ?? this.startSize();
    const start = size === null ? `minmax(${this.minStart()}px, 1fr)` : `${size}px`;
    return `${start} ${HANDLE_SIZE}px minmax(${this.minEnd()}px, 1fr)`;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private dragOffset = 0;

  protected startDrag(event: PointerEvent): void {
    const handle = event.currentTarget as HTMLElement;
    this.dragOffset = event.clientX - this.startPane(handle).getBoundingClientRect().right;
    handle.setPointerCapture(event.pointerId);
    this.dragging.set(true);
    event.preventDefault();
  }

  protected drag(event: PointerEvent): void {
    if (!this.dragging()) return;
    const left = this.startPane(event.currentTarget as HTMLElement).getBoundingClientRect().left;
    this.setSize(event.clientX - this.dragOffset - left);
  }

  protected endDrag(event: PointerEvent): void {
    if (!this.dragging()) return;
    (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId);
    this.dragging.set(false);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const current = this.startPane(event.currentTarget as HTMLElement).getBoundingClientRect().width;
    this.setSize(current + (event.key === 'ArrowRight' ? KEYBOARD_STEP : -KEYBOARD_STEP));
    event.preventDefault();
  }

  protected reset(): void {
    this.dragSize.set(null);
  }

  private startPane(handle: HTMLElement): HTMLElement {
    return handle.previousElementSibling as HTMLElement;
  }

  private setSize(value: number): void {
    const total = this.host.nativeElement.getBoundingClientRect().width;
    const max = Math.max(this.minStart(), total - this.minEnd() - HANDLE_SIZE);
    this.dragSize.set(Math.min(max, Math.max(this.minStart(), value)));
  }
}
