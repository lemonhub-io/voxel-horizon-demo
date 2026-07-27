<template>
  <div id="hotbar">
    <div
v-for="(item, i) in items" :key="i" class="hb-slot" :class="{ sel: i === sel }"
         @click="onTap(i)" @touchend.prevent="onTap(i)">
      <span class="key">{{ i + 1 }}</span>
      <img v-if="item" :src="icon(item.id)" :class="{ hidden: !item }">
      <span class="cnt">{{ item && item.n > 1 ? item.n : '' }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SlotItem } from '../types';
import { useInventoryStore } from '../stores/inventoryStore';

defineProps<{ items: (SlotItem | null)[]; sel: number }>();

const inv = useInventoryStore();

function icon(id: string) { return (window as unknown as { game: { atlas: { icon(id: string): string } } }).game?.atlas?.icon(id) || ''; }

function onTap(i: number): void {
  inv.sel = i;
}
</script>
