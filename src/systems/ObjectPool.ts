/**
 * Generic object pool to reduce GC pressure from frequent create/destroy cycles.
 * Inspired by phaser3-object-pooling reference (Phaser.GameObjects.Group pattern),
 * adapted for our custom entity classes that aren't pure Phaser GameObjects.
 */

export interface Poolable {
  readonly poolActive: boolean;
  deactivate(): void;
}

export class ObjectPool<T extends Poolable> {
  private inactive: T[] = [];
  private _active: T[] = [];
  private factory: () => T;
  private resetFn: (item: T) => void;

  constructor(factory: () => T, resetFn?: (item: T) => void) {
    this.factory = factory;
    this.resetFn = resetFn ?? (() => {});
  }

  get active(): readonly T[] { return this._active; }
  get totalSize(): number { return this._active.length + this.inactive.length; }
  get activeCount(): number { return this._active.length; }

  spawn(): T {
    let item = this.inactive.pop();
    if (!item) {
      item = this.factory();
    } else {
      this.resetFn(item);
    }
    this._active.push(item);
    return item;
  }

  release(item: T): void {
    const idx = this._active.indexOf(item);
    if (idx >= 0) {
      this._active.splice(idx, 1);
    }
    item.deactivate();
    this.inactive.push(item);
  }

  releaseAll(): void {
    for (const item of this._active) {
      item.deactivate();
      this.inactive.push(item);
    }
    this._active.length = 0;
  }

  prune(): void {
    const stillActive: T[] = [];
    for (const item of this._active) {
      if (item.poolActive) {
        stillActive.push(item);
      } else {
        this.inactive.push(item);
      }
    }
    this._active = stillActive;
  }

  destroyAll(destroyFn: (item: T) => void): void {
    for (const item of this._active) destroyFn(item);
    for (const item of this.inactive) destroyFn(item);
    this._active.length = 0;
    this.inactive.length = 0;
  }
}
