import { defineStore } from 'pinia';
import { ref } from 'vue';

export const usePlayerStore = defineStore('player', () => {
  const hp = ref(100);
  const hazard = ref(25);
  const ls = ref(80);
  const jetFuel = ref(100);
  const inShip = ref(false);
  const dead = ref(false);
  const heat = ref(0);
  const overheated = ref(0);
  const mineProgress = ref(0);
  const visor = ref(false);
  const flashOn = ref(false);
  const onGround = ref(false);
  const inWater = ref(false);
  const headInWater = ref(false);
  const sheltered = ref(false);
  const scanCd = ref(0);

  return {
    hp, hazard, ls, jetFuel, inShip, dead, heat, overheated,
    mineProgress, visor, flashOn, onGround, inWater, headInWater,
    sheltered, scanCd
  };
});
