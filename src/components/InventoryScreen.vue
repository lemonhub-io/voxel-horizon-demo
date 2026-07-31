<template>
  <div id="inv-screen" class="screen" @mousedown.self="$emit('close')">
    <div class="inv-frame panel">
      <div class="inv-tabs">
        <div
          v-for="t in tabs"
          :key="t.key"
          class="inv-tab"
          :class="{ active: store.tab === t.key }"
          @click="store.tab = t.key"
        >
          {{ t.label }} <em>{{ t.en }}</em>
        </div>
        <div class="inv-close">Tab / Esc 关闭</div>
      </div>

      <div v-show="store.tab === 'items'" class="inv-body">
        <div class="inv-left">
          <div class="inv-sec-title">远行者装备舱 <em>EXOSUIT</em></div>
          <div id="inv-grid" class="grid">
            <div
v-for="(s, i) in store.slots" :key="i" class="slot" :class="{ selected: isSel('slots', i) }"
              @mouseenter="showTip(s, $event)" @mousemove="moveTip($event)" @mouseleave="hideTip()" @click="onSlotClick('slots', i, s)"
              @touchstart.passive="onTouchStart('slots', i, s, $event)" @touchmove.passive="onTouchMove($event)" @touchend.passive="onTouchEnd('slots', i, s)" @touchcancel.passive="onTouchCancel">
              <img v-if="s" :src="icon(s.id)" :class="{ hidden: !s }"><span class="cnt">{{ s && s.n > 1 ? s.n : '' }}</span>
            </div>
          </div>
          <div class="inv-sec-title">快捷栏 <em>QUICK ACCESS</em></div>
          <div id="inv-hotbar" class="grid">
            <div
v-for="(s, i) in store.hotbar" :key="i" class="slot" :class="{ selected: isSel('hotbar', i) }"
              @mouseenter="showTip(s, $event)" @mousemove="moveTip($event)" @mouseleave="hideTip()" @click="onSlotClick('hotbar', i, s)"
              @touchstart.passive="onTouchStart('hotbar', i, s, $event)" @touchmove.passive="onTouchMove($event)" @touchend.passive="onTouchEnd('hotbar', i, s)" @touchcancel.passive="onTouchCancel">
              <img v-if="s" :src="icon(s.id)" :class="{ hidden: !s }"><span class="cnt">{{ s && s.n > 1 ? s.n : '' }}</span>
            </div>
          </div>
        </div>
        <div class="inv-right">
          <div v-if="detailItem" class="item-card">
            <div class="ic-head"><img :src="icon(detailItem.id)"><div><h3>{{ ITEMS[detailItem.id]?.name }}</h3><div class="ic-type">{{ ITEMS[detailItem.id]?.type }} · 持有 {{ store.count(detailItem.id) }}</div></div></div>
            <div class="ic-desc">{{ ITEMS[detailItem.id]?.desc }}</div>
            <div class="ic-actions"><button v-if="ITEMS[detailItem.id]?.use" class="btn sm" :class="{ disabled: store.count(detailItem.id) < 1 }" @click="useFromDetail()">使用</button></div>
          </div>
          <div v-else class="detail-empty">选择一件物品查看详情</div>
        </div>
      </div>

      <div v-show="store.tab === 'craft'" class="inv-body">
        <div class="inv-left"><div id="recipe-list">
          <div v-for="(r, i) in RECIPES" :key="i" class="recipe-row" :class="{ locked: !store.canAfford(r.req), sel: store.selRecipe === r }" @click="store.selRecipe = r">
            <img :src="icon(r.id)"><div><div class="rr-name">{{ ITEMS[r.id]?.name }}{{ r.out > 1 ? ' ×' + r.out : '' }}</div></div><span class="rr-cat">{{ r.cat }}</span>
          </div>
        </div></div>
        <div class="inv-right">
          <div v-if="store.selRecipe" class="item-card">
            <div class="ic-head"><img :src="icon(store.selRecipe.id)"><div><h3>{{ ITEMS[store.selRecipe.id]?.name }}{{ store.selRecipe.out > 1 ? ' ×' + store.selRecipe.out : '' }}</h3><div class="ic-type">{{ ITEMS[store.selRecipe.id]?.type }}</div></div></div>
            <div class="ic-desc">{{ store.selRecipe.desc }}<br><br>{{ ITEMS[store.selRecipe.id]?.desc }}</div>
            <div style="margin-top:10px">
              <div v-for="([id, n], j) in store.selRecipe.req" :key="j" class="req-row"><img :src="icon(id)"><span>{{ ITEMS[id]?.name }}</span><span class="have" :class="{ ok: store.count(id) >= n, no: store.count(id) < n }">{{ store.count(id) }} / {{ n }}</span></div>
            </div>
            <div class="ic-actions"><button class="btn primary" :class="{ disabled: !store.canAfford(store.selRecipe.req) }" @click="$emit('craft', store.selRecipe)">合成 // CRAFT</button></div>
          </div>
          <div v-else class="detail-empty">选择一个配方</div>
        </div>
      </div>

      <div v-show="store.tab === 'disc'" class="inv-body">
        <div class="inv-left">
          <div class="inv-sec-title">已发现星球</div>
          <div v-for="p in discoveries.planets" :key="p.name" class="disc-row">
            <div class="d-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c2.3 2.2 3.5 4.9 3.5 8S14.3 17.8 12 20c-2.3-2.2-3.5-4.9-3.5-8S9.7 6.2 12 4"/></svg></div><div>{{ p.name }}<div style="font-size:11px;opacity:.6">{{ p.climate }}</div></div><div class="d-sub">{{ p.visited }}次着陆</div>
          </div>
          <div class="inv-sec-title">旅程里程碑</div>
          <div v-for="def in MILESTONE_DEFS" :key="def.key" class="mile-row">
            <b>{{ def.name }}</b> {{ tier(def, milestones.stats[def.key] || 0) >= def.tiers.length ? '(满级)' : '等级 ' + tier(def, milestones.stats[def.key] || 0) }}<span class="m-prog">{{ Math.floor(milestones.stats[def.key] || 0) }} / {{ def.tiers[Math.min(tier(def, milestones.stats[def.key] || 0), def.tiers.length - 1)] }} {{ def.unit }}</span>
          </div>
        </div>
        <div class="inv-right">
          <div class="inv-sec-title">已分析物种 / 植物</div>
          <div v-if="discoveries.entries.length === 0" class="detail-empty">使用分析目镜 [F] 记录生物与植物</div>
          <div v-for="e in discoveries.entries" :key="e.key" class="disc-row">
            <div class="d-ico">
              <svg v-if="e.kind === '生物'" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1m0-14.2-2.1 2.1m-8.6 8.6-2.1 2.1"/></svg>
              <svg v-else-if="e.kind === '植物'" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21V10m0 5c-4 0-6-2.5-6-6 4 0 6 2.5 6 6Zm0-2c0-4 2-6 6-6 0 4-2 6-6 6Z"/></svg>
              <svg v-else viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 9-8 9-8-9z"/><path d="m4 12 8 3 8-3"/></svg>
            </div>
            <div>{{ e.name }}</div>
            <div class="d-sub">{{ e.kind }} · {{ e.planet }}<br><span class="unit-gain">+{{ e.units }}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2 8 10-8 10L4 12z"/><path d="m12 7 4 5-4 5-4-5z"/></svg></span></div>
          </div>
        </div>
      </div>
    </div>

    <!-- PC hover tooltip -->
    <div v-if="tip.visible" class="inv-tip" :style="tipStyle">
      <div class="it-head"><img :src="icon(tip.id)"><div><b>{{ ITEMS[tip.id]?.name }}</b><div class="it-type">{{ ITEMS[tip.id]?.type }} · 持有 {{ store.count(tip.id) }}</div></div></div>
      <div class="it-desc">{{ ITEMS[tip.id]?.desc }}</div>
      <div class="it-hint" :class="{ use: !!ITEMS[tip.id]?.use }">{{ ITEMS[tip.id]?.use ? '可使用 · 点击选择' : '点击查看详情' }}</div>
    </div>

    <!-- Mobile long-press / double-tap detail popover -->
    <div v-if="modalItem" class="inv-modal" @click.self="onModalBackdropClose" @touchstart.self.passive="onModalBackdropClose">
      <div class="inv-modal-card item-card panel">
        <div class="ic-head"><img :src="icon(modalItem.id)"><div><h3>{{ ITEMS[modalItem.id]?.name }}</h3><div class="ic-type">{{ ITEMS[modalItem.id]?.type }} · 持有 {{ store.count(modalItem.id) }}</div></div></div>
        <div class="ic-desc">{{ ITEMS[modalItem.id]?.desc }}</div>
        <div class="ic-actions">
          <button v-if="ITEMS[modalItem.id]?.use" class="btn primary" :class="{ disabled: store.count(modalItem.id) < 1 }" @click="useFromModal()">使用</button>
          <button class="btn" @click="closeModal()">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onBeforeUnmount } from 'vue';
import { useInventoryStore } from '../stores/inventoryStore';
import { useGameStore } from '../stores/gameStore';
import { useMilestonesStore } from '../stores/milestonesStore';
import { ITEMS, RECIPES, MILESTONE_DEFS } from '../config';
import type { SlotItem, MilestoneDef } from '../types';
import { getGameIcon } from '../runtime/game-runtime';

const emit = defineEmits(['close', 'use-item', 'craft']);

// Pointer-capability probe — hover tooltips on precise pointers (mouse),
// long-press / double-tap popover on coarse pointers (touch). Hybrid devices
// get both. Detected locally (not via the engine) so it works before the
// game initializes; accounts for touchscreens that also report a fine pointer.
const hasFinePointer =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(pointer: fine)').matches
    : false;

const store = useInventoryStore();
const game = useGameStore();
const milestones = useMilestonesStore();
const discoveries = game.discoveries;
const detailItem = ref<SlotItem | null>(null);

const tabs = [
  { key: 'items', label: '物品', en: 'INVENTORY' },
  { key: 'craft', label: '合成', en: 'CRAFTING' },
  { key: 'disc', label: '发现', en: 'DISCOVERIES' }
];

function icon(id: string) { return getGameIcon(id); }
function tier(def: MilestoneDef, val: number) { let t = 0; for (const th of def.tiers) if (val >= th) t++; return t; }

// --- Detail panel selection (right side) ---
const detailKey = ref('');
function isSel(arr: 'slots' | 'hotbar', i: number): boolean { return detailKey.value === arr + ':' + i; }
function selectSlot(arr: 'slots' | 'hotbar', i: number, s: SlotItem | null): void {
  detailItem.value = s;
  detailKey.value = s ? arr + ':' + i : '';
}
function useFromDetail(): void {
  if (!detailItem.value) return;
  if (store.count(detailItem.value.id) < 1) return;
  emit('use-item', detailItem.value.id);
}

// --- PC hover tooltip ---
const tip = reactive({ visible: false, x: 0, y: 0, id: '' });
const tipLeftSide = computed(() => tip.x > (typeof innerWidth !== 'undefined' ? innerWidth : 9999) - 260);
const tipStyle = computed(() => ({
  left: (tipLeftSide.value ? tip.x - 250 : tip.x + 14) + 'px',
  top: (tip.y + 14) + 'px'
}));
function showTip(s: SlotItem | null, e: MouseEvent): void {
  if (!hasFinePointer || !s) return;
  tip.id = s.id; tip.x = e.clientX; tip.y = e.clientY; tip.visible = true;
}
function moveTip(e: MouseEvent): void { if (tip.visible) { tip.x = e.clientX; tip.y = e.clientY; } }
function hideTip(): void { tip.visible = false; }

// --- Slot click (mouse) ---
function onSlotClick(arr: 'slots' | 'hotbar', i: number, s: SlotItem | null): void {
  if (!hasFinePointer) return;        // touch handles selection via touchend
  selectSlot(arr, i, s);
}

// --- Mobile long-press / double-tap popover ---
const modalItem = ref<SlotItem | null>(null);
let pressTimer: ReturnType<typeof setTimeout> | undefined;
let pressPos = { x: 0, y: 0 };
let moved = false;
let lastTap = 0;
/** Ignore backdrop close for a short window after open (mobile ghost mouse/click). */
let ignoreBackdropCloseUntil = 0;

function openModal(s: SlotItem): void {
  modalItem.value = s;
  ignoreBackdropCloseUntil = Date.now() + 350;
}
function closeModal(): void { modalItem.value = null; }
function onModalBackdropClose(): void {
  if (Date.now() < ignoreBackdropCloseUntil) return;
  closeModal();
}
function useFromModal(): void {
  if (!modalItem.value) return;
  if (store.count(modalItem.value.id) < 1) return;
  emit('use-item', modalItem.value.id);
  closeModal();
}

function onTouchStart(arr: 'slots' | 'hotbar', i: number, s: SlotItem | null, e: TouchEvent): void {
  if (!s) return;
  const t = e.touches[0];
  if (!t) return;
  moved = false;
  pressPos = { x: t.clientX, y: t.clientY };
  pressTimer = setTimeout(() => {
    pressTimer = undefined;
    openModal(s);
    if (navigator.vibrate) navigator.vibrate(15);
  }, 500);
}
function onTouchMove(e: TouchEvent): void {
  const t = e.touches[0];
  if (!t) {
    // odd path delivered an empty touches list — bail and cancel any press
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = undefined; }
    moved = true;
    return;
  }
  if (Math.abs(t.clientX - pressPos.x) > 10 || Math.abs(t.clientY - pressPos.y) > 10) {
    moved = true;
    if (pressTimer) { clearTimeout(pressTimer); pressTimer = undefined; }
  }
}
function onTouchEnd(arr: 'slots' | 'hotbar', i: number, s: SlotItem | null): void {
  if (pressTimer) {
    clearTimeout(pressTimer);
    pressTimer = undefined;
    if (!moved) {
      const now = Date.now();
      if (now - lastTap < 320) {
        if (!s) return;
        openModal(s);
        lastTap = 0;
      } else { lastTap = now; selectSlot(arr, i, s); }
    }
  }
}
// touchcancel should never fire openModal on a half-completed press
function onTouchCancel(): void {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = undefined; }
  moved = false;
}

// Pending long-press timer must not fire after the inventory screen unmounts
// (e.g. closed mid-press); otherwise it could openModal on a stale instance.
onBeforeUnmount(() => {
  if (pressTimer) { clearTimeout(pressTimer); pressTimer = undefined; }
  moved = false;
  lastTap = 0;
  tip.visible = false;
});

defineExpose({ detailItem });
</script>
