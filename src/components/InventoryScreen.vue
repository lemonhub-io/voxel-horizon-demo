<template>
  <div id="inv-screen" class="screen" @mousedown.self="$emit('close')">
    <div class="inv-frame panel">
      <div class="inv-tabs">
        <div v-for="t in tabs" :key="t.key" class="inv-tab" :class="{ active: store.tab === t.key }" @click="store.tab = t.key">{{ t.label }} <em>{{ t.en }}</em></div>
        <div class="inv-close">Tab / Esc 关闭</div>
      </div>

      <div v-show="store.tab === 'items'" class="inv-body">
        <div class="inv-left">
          <div class="inv-sec-title">远行者装备舱 <em>EXOSUIT</em></div>
          <div id="inv-grid" class="grid">
            <div v-for="(s, i) in store.slots" :key="i" class="slot" @mousedown="$emit('slot-click', 'slots', i, $event)" @mouseenter="$emit('slot-hover', s, $event)" @mouseleave="$emit('slot-leave')">
              <img v-if="s" :src="icon(s.id)" :class="{ hidden: !s }"><span class="cnt">{{ s && s.n > 1 ? s.n : '' }}</span>
            </div>
          </div>
          <div class="inv-sec-title">快捷栏 <em>QUICK ACCESS</em></div>
          <div id="inv-hotbar" class="grid">
            <div v-for="(s, i) in store.hotbar" :key="i" class="slot" @mousedown="$emit('slot-click', 'hotbar', i, $event)" @mouseenter="$emit('slot-hover', s, $event)" @mouseleave="$emit('slot-leave')">
              <img v-if="s" :src="icon(s.id)" :class="{ hidden: !s }"><span class="cnt">{{ s && s.n > 1 ? s.n : '' }}</span>
            </div>
          </div>
        </div>
        <div class="inv-right">
          <div v-if="detailItem" class="item-card">
            <div class="ic-head"><img :src="icon(detailItem.id)"><div><h3>{{ ITEMS[detailItem.id]?.name }}</h3><div class="ic-type">{{ ITEMS[detailItem.id]?.type }} · 持有 {{ store.count(detailItem.id) }}</div></div></div>
            <div class="ic-desc">{{ ITEMS[detailItem.id]?.desc }}</div>
            <div class="ic-actions"><button v-if="ITEMS[detailItem.id]?.use" class="btn sm" @click="$emit('use-item', detailItem!.id)">使用</button></div>
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
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useInventoryStore } from '../stores/inventoryStore';
import { useGameStore } from '../stores/gameStore';
import { useMilestonesStore } from '../stores/milestonesStore';
import { ITEMS, RECIPES, MILESTONE_DEFS } from '../config';
import type { SlotItem, MilestoneDef } from '../types';

defineEmits(['close', 'slot-click', 'slot-hover', 'slot-leave', 'use-item', 'craft']);

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

function icon(id: string) { return window.game?.atlas.icon(id) || ''; }
function tier(def: MilestoneDef, val: number) { let t = 0; for (const th of def.tiers) if (val >= th) t++; return t; }

defineExpose({ detailItem });
</script>
