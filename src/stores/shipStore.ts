import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ShipComponent } from '../types';

export const useShipStore = defineStore('ship', () => {
  const comps = ref<Record<string, ShipComponent>>({
    thruster: { name: '起飞推进器', broken: true, req: [['metal_plate', 1], ['ferrite', 20]], desc: '突破重力井的主推进器。' },
    pulse: { name: '脉冲引擎', broken: true, req: [['nanotube', 1], ['sodium', 15]], desc: '大气层内巡航引擎。' }
  });
  const fuel = ref(0);
  const flying = ref(false);
  const speed = ref(0);
  const throttle = ref(0.4);
  const yaw = ref(0);
  const pitch = ref(0);
  const landing = ref(false);
  const open = ref(false);

  const repaired = computed(() => !comps.value.thruster.broken && !comps.value.pulse.broken);
  const canLaunch = computed(() => repaired.value && fuel.value >= 25);

  return { comps, fuel, flying, speed, throttle, yaw, pitch, landing, open, repaired, canLaunch };
});
