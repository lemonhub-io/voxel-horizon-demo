<template>
  <div id="hotbar">
    <button v-for="(item, i) in items" :key="i" type="button" class="hb-slot" :class="{ sel: i === sel }" :aria-label="`选择快捷栏 ${i + 1}`" @pointerup.stop="selectSlot(i)">
      <span class="key">{{ i + 1 }}</span>
      <img v-if="item" :src="icon(item.id)" :class="{ hidden: !item }">
      <span class="cnt">{{ item && item.n > 1 ? item.n : '' }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { SlotItem } from '../types';
import { useInventoryStore } from '../stores/inventoryStore';

defineProps<{ items: (SlotItem | null)[]; sel: number }>();
const inventory = useInventoryStore();

function icon(id: string) { return window.game?.atlas.icon(id) || ''; }
function selectSlot(index: number) { inventory.sel = index; }
</script>
