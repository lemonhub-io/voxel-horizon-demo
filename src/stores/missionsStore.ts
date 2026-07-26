import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { MissionDef } from '../types';

export const useMissionsStore = defineStore('missions', () => {
  const idx = ref(0);
  const scannerUnlocked = ref(false);
  const shelterCount = ref(0);
  const launched = ref(false);
  const defs = ref<MissionDef[]>([]);
  const sodiumUsed = ref(0);
  const oxygenUsed = ref(0);

  const current = computed(() => defs.value[idx.value] || null);

  return { idx, scannerUnlocked, shelterCount, launched, defs, sodiumUsed, oxygenUsed, current };
});
