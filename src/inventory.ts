// ============================================================
// inventory.ts — Inventory, crafting, item management
// ============================================================

import { U } from './utils';
import { ITEMS, RECIPES } from './config';
import type { Game, SlotItem, Recipe, InventorySaveData } from './types';

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
  selSlot: number | null;
  elGrid!: HTMLElement;
  elHot!: HTMLElement;
  elDetail!: HTMLElement;
  elHotbar!: HTMLElement;
  elRecipes!: HTMLElement;
  elRecipeDetail!: HTMLElement;
  tooltip!: HTMLElement;
  ghost!: HTMLElement;
  slotEls!: HTMLDivElement[];
  hotEls!: HTMLDivElement[];

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
    this.selSlot = null;
  }

  stackMax(id: string): number { return ITEMS[id].stack || 64; }

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
    this.refresh();
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
    this.refresh();
    return true;
  }

  canAfford(req: [string, number][]): boolean { return req.every(([id, n]) => this.count(id) >= n); }
  pay(req: [string, number][]): boolean {
    if (!this.canAfford(req)) return false;
    for (const [id, n] of req) this.consume(id, n);
    return true;
  }

  selected(): SlotItem | null { return this.hotbar[this.sel]; }

  bindUI(): void {
    const g = this.g;
    this.elGrid = document.getElementById('inv-grid')!;
    this.elHot = document.getElementById('inv-hotbar')!;
    this.elDetail = document.getElementById('item-detail')!;
    this.elHotbar = document.getElementById('hotbar')!;
    this.elRecipes = document.getElementById('recipe-list')!;
    this.elRecipeDetail = document.getElementById('recipe-detail')!;
    this.tooltip = document.getElementById('tooltip')!;
    this.ghost = document.getElementById('drag-ghost')!;

    for (let i = 0; i < 9; i++) {
      const d = document.createElement('div');
      d.className = 'hb-slot';
      d.innerHTML = `<span class="key">${i + 1}</span><img class="hidden"><span class="cnt"></span>`;
      this.elHotbar.appendChild(d);
    }

    const mkSlot = (arr: (SlotItem | null)[], i: number, parent: HTMLElement): HTMLDivElement => {
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML = '<img class="hidden"><span class="cnt"></span>';
      d.addEventListener('mousedown', (e: MouseEvent) => this.slotClick(arr, i, e));
      d.addEventListener('mouseenter', (e: MouseEvent) => { this.showTip(arr[i], e); g.audio.uiHover(); });
      d.addEventListener('mousemove', (e: MouseEvent) => this.moveTip(e));
      d.addEventListener('mouseleave', () => this.hideTip());
      parent.appendChild(d);
      return d;
    };
    this.slotEls = [];
    this.hotEls = [];
    for (let i = 0; i < 24; i++) this.slotEls.push(mkSlot(this.slots, i, this.elGrid));
    for (let i = 0; i < 9; i++) this.hotEls.push(mkSlot(this.hotbar, i, this.elHot));

    document.querySelectorAll<HTMLElement>('.inv-tab').forEach(t => {
      t.addEventListener('click', () => { this.setTab(t.dataset.tab!); g.audio.uiClick(); });
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (this.drag) {
        this.ghost.style.left = e.clientX + 'px';
        this.ghost.style.top = e.clientY + 'px';
      }
    });
    this.renderRecipes();
  }

  setTab(tab: string): void {
    this.tab = tab;
    document.querySelectorAll<HTMLElement>('.inv-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    document.getElementById('inv-body-items')!.classList.toggle('hidden', tab !== 'items');
    document.getElementById('inv-body-craft')!.classList.toggle('hidden', tab !== 'craft');
    document.getElementById('inv-body-disc')!.classList.toggle('hidden', tab !== 'disc');
    if (tab === 'craft') this.renderRecipes();
    if (tab === 'disc') this.g.hud.renderDiscoveries();
  }

  slotClick(arr: (SlotItem | null)[], i: number, e: MouseEvent): void {
    e.preventDefault();
    const g = this.g;
    if (!this.drag) {
      const s = arr[i];
      if (!s) return;
      if (e.shiftKey) {
        const other = arr === this.slots ? this.hotbar : this.slots;
        let left = s.n;
        for (let j = 0; j < other.length && left > 0; j++) {
          if (other[j] && other[j]!.id === s.id && other[j]!.n < this.stackMax(s.id)) {
            const t = Math.min(left, this.stackMax(s.id) - other[j]!.n);
            other[j]!.n += t; left -= t;
          }
        }
        for (let j = 0; j < other.length && left > 0; j++) {
          if (!other[j]) { other[j] = { id: s.id, n: left }; left = 0; }
        }
        arr[i] = left > 0 ? { id: s.id, n: left } : null;
        g.audio.uiClick();
        this.refresh();
        return;
      }
      if (e.button === 2) {
        const half = Math.ceil(s.n / 2);
        this.drag = { id: s.id, n: half };
        s.n -= half;
        if (s.n <= 0) arr[i] = null;
      } else {
        this.drag = s;
        arr[i] = null;
      }
      g.audio.uiClick();
      this.showGhost();
    } else {
      const s = arr[i];
      if (!s) {
        if (e.button === 2) {
          arr[i] = { id: this.drag.id, n: 1 };
          this.drag.n--;
          if (this.drag.n <= 0) this.drag = null;
        } else {
          arr[i] = this.drag;
          this.drag = null;
        }
      } else if (s.id === this.drag.id) {
        const t = Math.min(this.drag.n, this.stackMax(s.id) - s.n);
        s.n += t;
        this.drag.n -= t;
        if (this.drag.n <= 0) this.drag = null;
      } else {
        const tmp = arr[i];
        arr[i] = this.drag;
        this.drag = tmp;
      }
      g.audio.uiClick();
      this.showGhost();
    }
    this.refresh();
    this.showDetail(arr[i]);
  }

  showGhost(): void {
    if (this.drag) {
      this.ghost.classList.remove('hidden');
      (this.ghost.querySelector('img') as HTMLImageElement).src = this.g.atlas.icon(this.drag.id);
      (this.ghost.querySelector('span')!).textContent = this.drag.n > 1 ? String(this.drag.n) : '';
    } else this.ghost.classList.add('hidden');
  }

  showTip(s: SlotItem | null, e: MouseEvent): void {
    if (!s || this.drag) return this.hideTip();
    const def = ITEMS[s.id];
    this.tooltip.innerHTML = `<b>${def.name} ×${s.n}</b><span class="tt-type">${def.type}</span>${def.desc}`;
    this.tooltip.classList.remove('hidden');
    this.moveTip(e);
  }
  moveTip(e: MouseEvent): void {
    this.tooltip.style.left = Math.min(e.clientX + 16, innerWidth - 260) + 'px';
    this.tooltip.style.top = Math.min(e.clientY + 16, innerHeight - 120) + 'px';
  }
  hideTip(): void { this.tooltip.classList.add('hidden'); }

  showDetail(s: SlotItem | null): void {
    if (!s) { this.elDetail.innerHTML = '选择一件物品查看详情'; this.elDetail.className = 'detail-empty'; return; }
    const def = ITEMS[s.id];
    this.elDetail.className = 'item-card';
    let actions = '';
    if (def.use) actions += `<button class="btn sm" data-use="${s.id}">使用</button>`;
    this.elDetail.innerHTML = `
      <div class="ic-head"><img src="${this.g.atlas.icon(s.id)}"><div><h3>${def.name}</h3><div class="ic-type">${def.type} · 持有 ${this.count(s.id)}</div></div></div>
      <div class="ic-desc">${def.desc}</div>
      <div class="ic-actions">${actions}</div>`;
    const useBtn = this.elDetail.querySelector<HTMLElement>('[data-use]');
    if (useBtn) useBtn.addEventListener('click', () => { this.useItem(s.id); this.showDetail(this.count(s.id) > 0 ? { id: s.id, n: this.count(s.id) } : null); });
  }

  useItem(id: string): boolean {
    const def = ITEMS[id];
    if (!def.use || this.count(id) < 1) return false;
    const p = this.g.player;
    if (def.use === 'hazard') p.hazard = Math.min(100, p.hazard + def.useAmt!);
    if (def.use === 'ls') p.ls = Math.min(100, p.ls + def.useAmt!);
    if (def.use === 'hp') p.hp = Math.min(100, p.hp + def.useAmt!);
    this.consume(id, 1);
    this.g.audio.useItem();
    this.g.hud.notify(`已使用 ${def.name}`, 'success');
    return true;
  }

  refresh(): void {
    const g = this.g;
    const fill = (el: HTMLDivElement, s: SlotItem | null): void => {
      const img = el.querySelector('img') as HTMLImageElement;
      const cnt = el.querySelector('.cnt')!;
      if (s) {
        img.src = g.atlas.icon(s.id);
        img.classList.remove('hidden');
        cnt.textContent = s.n > 1 ? String(s.n) : '';
      } else {
        img.classList.add('hidden');
        cnt.textContent = '';
      }
    };
    if (this.slotEls) {
      this.slotEls.forEach((el, i) => fill(el, this.slots[i]));
      this.hotEls.forEach((el, i) => fill(el, this.hotbar[i]));
    }
    const hb = this.elHotbar ? this.elHotbar.children : [];
    for (let i = 0; i < hb.length; i++) {
      const el = hb[i] as HTMLDivElement;
      const s = this.hotbar[i];
      const img = el.querySelector('img') as HTMLImageElement;
      const cnt = el.querySelector('.cnt')!;
      if (s) {
        img.src = g.atlas.icon(s.id);
        img.classList.remove('hidden');
        cnt.textContent = s.n > 1 ? String(s.n) : '';
      } else {
        img.classList.add('hidden');
        cnt.textContent = '';
      }
      el.classList.toggle('sel', i === this.sel);
    }
    if (this.tab === 'craft' && this.open) this.renderRecipes();
    document.getElementById('units-val')!.textContent = String(this.units);
  }

  renderRecipes(): void {
    if (!this.elRecipes) return;
    this.elRecipes.innerHTML = '';
    for (const r of RECIPES) {
      const def = ITEMS[r.id];
      const ok = this.canAfford(r.req);
      const d = document.createElement('div');
      d.className = 'recipe-row' + (ok ? '' : ' locked') + (this.selRecipe === r ? ' sel' : '');
      d.innerHTML = `<img src="${this.g.atlas.icon(r.id)}"><div><div class="rr-name">${def.name}${r.out > 1 ? ' ×' + r.out : ''}</div></div><span class="rr-cat">${r.cat}</span>`;
      d.addEventListener('click', () => { this.selRecipe = r; this.g.audio.uiClick(); this.renderRecipes(); this.renderRecipeDetail(); });
      d.addEventListener('mouseenter', () => this.g.audio.uiHover());
      this.elRecipes.appendChild(d);
    }
  }

  renderRecipeDetail(): void {
    const r = this.selRecipe;
    if (!r) { this.elRecipeDetail.innerHTML = '选择一个配方'; this.elRecipeDetail.className = 'detail-empty'; return; }
    const def = ITEMS[r.id];
    this.elRecipeDetail.className = 'item-card';
    let reqHtml = '';
    for (const [id, n] of r.req) {
      const have = this.count(id);
      reqHtml += `<div class="req-row"><img src="${this.g.atlas.icon(id)}"><span>${ITEMS[id].name}</span><span class="have ${have >= n ? 'ok' : 'no'}">${have} / ${n}</span></div>`;
    }
    const ok = this.canAfford(r.req);
    this.elRecipeDetail.innerHTML = `
      <div class="ic-head"><img src="${this.g.atlas.icon(r.id)}"><div><h3>${def.name}${r.out > 1 ? ' ×' + r.out : ''}</h3><div class="ic-type">${def.type}</div></div></div>
      <div class="ic-desc">${r.desc}<br><br>${def.desc}</div>
      <div style="margin-top:10px">${reqHtml}</div>
      <div class="ic-actions"><button class="btn primary ${ok ? '' : 'disabled'}" id="btn-craft">合成 // CRAFT</button></div>`;
    const btn = this.elRecipeDetail.querySelector('#btn-craft')!;
    btn.addEventListener('click', () => this.craft(r));
  }

  craft(r: Recipe): void {
    if (!this.canAfford(r.req)) { this.g.audio.uiDeny(); return; }
    this.pay(r.req);
    this.add(r.id, r.out);
    this.g.audio.craft();
    this.g.hud.notify(`合成成功：${ITEMS[r.id].name} ×${r.out}`, 'success');
    this.g.milestones.addStat('crafted', 1);
    this.renderRecipes();
    this.renderRecipeDetail();
  }

  toggle(force?: boolean): void {
    const want = force !== undefined ? force : !this.open;
    if (want === this.open) return;
    this.open = want;
    document.getElementById('inv-screen')!.classList.toggle('hidden', !want);
    if (want) {
      this.g.audio.uiOpen();
      this.refresh();
      this.g.exitPointerLock();
    } else {
      this.g.audio.uiClose();
      this.hideTip();
      if (this.drag) { this.add(this.drag.id, this.drag.n); this.drag = null; this.showGhost(); }
      this.g.requestPointerLock();
    }
  }

  serialize(): InventorySaveData {
    return { slots: this.slots, hotbar: this.hotbar, sel: this.sel, units: this.units };
  }
  deserialize(d: InventorySaveData | undefined): void {
    if (!d) return;
    this.slots = d.slots.map(s => s ? { ...s } : null);
    while (this.slots.length < 24) this.slots.push(null);
    this.hotbar = d.hotbar.map(s => s ? { ...s } : null);
    while (this.hotbar.length < 9) this.hotbar.push(null);
    this.sel = d.sel || 0;
    this.units = d.units || 0;
  }
}
