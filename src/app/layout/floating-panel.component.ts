import { Component, ElementRef, HostListener, OnDestroy, inject, input, output, signal } from '@angular/core';
import { ZIndexService } from './z-index.service';

type ResizeEdge = 'e' | 's' | 'w' | 'se' | 'sw';

const MIN_WIDTH = 320;
const MIN_HEIGHT = 200;
const VIEWPORT_MARGIN = 8;

/**
 * Floating window that can be dragged by its title bar and resized from its edges and bottom corners.
 * Content goes in the default slot; extra title-bar controls go in `floatingActions`.
 */
@Component({
  selector: 'app-floating-panel',
  template: `
    <section
      class="floating-panel"
      role="dialog"
      [attr.aria-label]="heading()"
      [style.left.px]="x()"
      [style.top.px]="y()"
      [style.width.px]="width()"
      [style.height.px]="height()"
      [style.z-index]="zIndex()"
      (pointerdown)="bringToFront()"
    >
      <header class="floating-panel-bar" (pointerdown)="startDrag($event)">
        <h2 class="floating-panel-title">{{ heading() }}</h2>
        <div class="flex items-center gap-2" (pointerdown)="$event.stopPropagation()">
          <ng-content select="[floatingActions]" />
          <button type="button" class="floating-panel-close" aria-label="Close panel" (click)="closed.emit()">×</button>
        </div>
      </header>
      <div class="floating-panel-body"><ng-content /></div>
      @for (edge of edges; track edge) {
        <div class="floating-panel-handle floating-panel-handle-{{ edge }}" (pointerdown)="startResize($event, edge)"></div>
      }
    </section>
  `,
})
export class FloatingPanelComponent implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zIndexService = inject(ZIndexService);
  protected readonly zIndex = signal(this.zIndexService.next());

  protected bringToFront(): void {
    if (!this.zIndexService.isTop(this.zIndex())) this.zIndex.set(this.zIndexService.next());
  }

  readonly heading = input.required<string>();
  readonly closed = output<void>();

  protected readonly edges: ResizeEdge[] = ['e', 's', 'w', 'se', 'sw'];
  protected readonly x = signal(Math.max(VIEWPORT_MARGIN, window.innerWidth - 760));
  protected readonly y = signal(96);
  protected readonly width = signal(Math.min(720, window.innerWidth - 2 * VIEWPORT_MARGIN));
  protected readonly height = signal(Math.min(520, window.innerHeight - 2 * VIEWPORT_MARGIN));

  private stopGesture?: () => void;

  protected startDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX - this.x();
    const startY = event.clientY - this.y();
    this.track((move) => {
      this.x.set(this.clamp(move.clientX - startX, VIEWPORT_MARGIN - this.width() + 80, window.innerWidth - 80));
      this.y.set(this.clamp(move.clientY - startY, 0, window.innerHeight - 40));
    });
  }

  protected startResize(event: PointerEvent, edge: ResizeEdge): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const origin = { x: this.x(), y: this.y(), width: this.width(), height: this.height(), px: event.clientX, py: event.clientY };
    this.track((move) => {
      const dx = move.clientX - origin.px;
      const dy = move.clientY - origin.py;
      if (edge.includes('e')) this.width.set(Math.max(MIN_WIDTH, origin.width + dx));
      if (edge.includes('s')) this.height.set(Math.max(MIN_HEIGHT, origin.height + dy));
      if (edge.includes('w')) {
        const width = Math.max(MIN_WIDTH, origin.width - dx);
        this.width.set(width);
        this.x.set(origin.x + origin.width - width);
      }
    });
  }

  // Keeps the panel reachable if the browser window shrinks.
  @HostListener('window:resize')
  protected onWindowResize(): void {
    this.x.set(this.clamp(this.x(), VIEWPORT_MARGIN - this.width() + 80, window.innerWidth - 80));
    this.y.set(this.clamp(this.y(), 0, window.innerHeight - 40));
  }

  ngOnDestroy(): void {
    this.stopGesture?.();
  }

  private track(onMove: (event: PointerEvent) => void): void {
    this.stopGesture?.();
    const root = this.host.nativeElement.ownerDocument;
    root.body.classList.add('floating-panel-active');
    const end = (): void => {
      root.removeEventListener('pointermove', onMove);
      root.removeEventListener('pointerup', end);
      root.removeEventListener('pointercancel', end);
      root.body.classList.remove('floating-panel-active');
      this.stopGesture = undefined;
    };
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
    this.stopGesture = end;
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), Math.max(min, max));
  }
}
