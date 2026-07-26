import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Palette, Settings, Discoveries, PlanetInfo } from '../types';
import { PALETTES } from '../config';

export const useGameStore = defineStore('game', () => {
  const state = ref('title');
  const seed = ref(0);
  const palIdx = ref(0);
  const palette = ref<Palette>(PALETTES[0]);
  const planetName = ref('');
  const stormActive = ref(false);
  const stormFactor = ref(0);
  const playTime = ref(0);
  const time = ref(0);
  const loadProgress = ref(0);
  const introLines = ref<{ text: string; cls?: string }[]>([]);
  const discoveries = ref<Discoveries>({ planets: [], entries: [] });
  const settings = ref<Settings>({ master: 80, music: 60, sfx: 90, sens: 100, fov: 78, dist: 4, invert: false });

  const uiOpen = computed(() => {
    return state.value === 'pause' || state.value === 'dead';
  });

  function planetInfo(): PlanetInfo {
    const pal = palette.value;
    return {
      name: planetName.value,
      climate: pal.climate,
      flora: pal.floraLevel,
      fauna: '0 种',
      storm: pal.stormLevel,
      res: ['ferrite', 'carbon', 'sodium', 'dihydrogen', 'oxygen', 'copper']
    };
  }

  return {
    state, seed, palIdx, palette, planetName, stormActive, stormFactor,
    playTime, time, loadProgress, introLines, discoveries, settings,
    uiOpen, planetInfo
  };
});
