import { Injectable } from '@angular/core';

const BASE_Z_INDEX = 40;

/** Hands out ever-increasing z-indexes so the most recently focused floating panel sits on top. */
@Injectable({ providedIn: 'root' })
export class ZIndexService {
  private current = BASE_Z_INDEX;

  next(): number {
    return ++this.current;
  }

  /** True when `zIndex` is already the topmost value handed out. */
  isTop(zIndex: number): boolean {
    return zIndex === this.current;
  }
}
