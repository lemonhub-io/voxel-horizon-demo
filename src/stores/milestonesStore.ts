import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useMilestonesStore = defineStore('milestones', () => {
  const stats = ref<Record<string, number>>({
    walk: 0, mined: 0, scans: 0, placed: 0, warps: 0, crafted: 0, survive: 0
  });
  const awarded = ref<Record<string, number>>({});

  return { stats, awarded };
});
