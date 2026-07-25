import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { SlotItem, Recipe } from '../types';
import { ITEMS, RECIPES } from '../config';

export const useInventoryStore = defineStore('inventory', () => {
  const slots = ref<(SlotItem | null)[]>(new Array(24).fill(null));
  const hotbar = ref<(SlotItem | null)[]>(new Array(9).fill(null));
  const sel = ref(0);
  const units = ref(0);
  const open = ref(false);
  const tab = ref('items');
  const drag = ref<SlotItem | null>(null);
  const selRecipe = ref<Recipe | null>(null);

  const selected = computed(() => hotbar.value[sel.value]);

  function count(id: string): number {
    let n = 0;
    for (const s of slots.value) if (s && s.id === id) n += s.n;
    for (const s of hotbar.value) if (s && s.id === id) n += s.n;
    return n;
  }

  function stackMax(id: string): number { return ITEMS[id]?.stack || 64; }

  return { slots, hotbar, sel, units, open, tab, drag, selRecipe, selected, count, stackMax };
});
