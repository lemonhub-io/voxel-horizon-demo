// ============================================================
// inventory.ts — Inventory data management (no DOM)
// UI rendering handled by Vue InventoryScreen component
// ============================================================

import { U } from './utils';
import { ITEMS, RECIPES } from './config';
import type { Game, SlotItem, Recipe, InventorySaveData } from './types';
import { useInventoryStore } from './stores/inventoryStore';

export class Inventory {
  g: Game;
  slots: (SlotItem | null)[];
  hotbar: (SlotItem | null)[];
  sel: number;
  units: number;
  open: boolean;
  tab: string;
  drag: SlotItem | null;
  selRecipe: Recipe | null;

  constructor(game: Game) {
    this.g = game;
    this.slots = new Array(24).fill(null);
    this.hotbar = new Array(9).fill(null);
    this.sel = 0;
    this.units = 0;
    this.open = false;
    this.tab = 'items';
    this.drag = null;
    this.selRecipe = null;
  }

  stackMax(id: string): number { return ITEMS[id]?.stack || 64; }

  add(id: string, n: number): number {
    let left = n;
    const tryFill = (arr: (SlotItem | null)[]): void => {
      for (let i = 0; i < arr.length && left > 0; i++) {
        const s = arr[i];
        if (s && s.id === id && s.n < this.stackMax(id)) {
          const t = Math.min(left, this.stackMax(id) - s.n);
          s.n += t; left -= t;
        }
      }
      for (let i = 0; i < arr.length && left > 0; i++) {
        if (!arr[i]) {
          const t = Math.min(left, this.stackMax(id));
          arr[i] = { id, n: t }; left -= t;
        }
      }
    };
    tryFill(this.hotbar);
    tryFill(this.slots);
    this.syncStore();
    return n - left;
  }

  count(id: string): number {
    let n = 0;
    for (const s of this.slots) if (s && s.id === id) n += s.n;
    for (const s of this.hotbar) if (s && s.id === id) n += s.n;
    return n;
  }

  consume(id: string, n: number): boolean {
    if (this.count(id) < n) return false;
    let left = n;
    const eat = (arr: (SlotItem | null)[]): void => {
      for (let i = 0; i < arr.length && left > 0; i++) {
        const s = arr[i];
        if (s && s.id === id) {
          const t = Math.min(left, s.n);
          s.n -= t; left -= t;
          if (s.n <= 0) arr[i] = null;
        }
      }
    };
    eat(this.slots);
    eat(this.hotbar);
    this.syncStore();
    return true;
  }

  canAfford(req: [string, number][]): boolean { return req.every(([id, n]) => this.count(id) >= n); }
  pay(req: [string, number][]): boolean {
    if (!this.canAfford(req)) return false;
    for (const [id, n] of req) this.consume(id, n);
    return true;
  }

  selected(): SlotItem | null { return this.hotbar[this.sel]; }

  useItem(id: string): boolean {
    const def = ITEMS[id];
    if (!def.use || this.count(id) < 1) return false;
    const p = this.g.player;
    if (def.use === 'hazard') p.hazard = Math.min(100, p.hazard + (def.useAmt || 0));
    if (def.use === 'ls') p.ls = Math.min(100, p.ls + (def.useAmt || 0));
    if (def.use === 'hp') p.hp = Math.min(100, p.hp + (def.useAmt || 0));
    this.consume(id, 1);
    this.g.audio.useItem();
    this.g.hud.notify(`已使用 ${def.name}`, 'success');
    return true;
  }

  craft(r: Recipe): void {
    if (!this.canAfford(r.req)) { this.g.audio.uiDeny(); return; }
    this.pay(r.req);
    this.add(r.id, r.out);
    this.g.audio.craft();
    this.g.hud.notify(`合成成功：${ITEMS[r.id].name} ×${r.out}`, 'success');
    this.g.milestones.addStat('crafted', 1);
  }

  toggle(force?: boolean): void {
    const want = force !== undefined ? force : !this.open;
    if (want === this.open) return;
    this.open = want;
    if (want) {
      this.g.audio.uiOpen();
      this.syncStore();
      this.g.exitPointerLock();
    } else {
      this.g.audio.uiClose();
      if (this.drag) { this.add(this.drag.id, this.drag.n); this.drag = null; }
      this.g.requestPointerLock();
    }
  }

  /** Sync engine state → Pinia store so Vue components react */
  syncStore(): void {
    const s = useInventoryStore();
    s.slots = this.slots.map(s => s ? { ...s } : null);
    s.hotbar = this.hotbar.map(s => s ? { ...s } : null);
    s.sel = this.sel;
    s.units = this.units;
    s.open = this.open;
    s.tab = this.tab;
    s.drag = this.drag ? { ...this.drag } : null;
    s.selRecipe = this.selRecipe;
  }

  serialize(): InventorySaveData {
    return { slots: this.slots, hotbar: this.hotbar, sel: this.sel, units: this.units };
  }
  deserialize(d: InventorySaveData): void {
    if (!d) return;
    this.slots = d.slots.map(s => s ? { ...s } : null);
    while (this.slots.length < 24) this.slots.push(null);
    this.hotbar = d.hotbar.map(s => s ? { ...s } : null);
    while (this.hotbar.length < 9) this.hotbar.push(null);
    this.sel = d.sel || 0;
    this.units = d.units || 0;
    this.syncStore();
  }
}
