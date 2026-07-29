<template>
  <div id="pause-screen" class="screen">
    <div class="pause-box panel">
      <div class="p-kicker">系统暂停 // STANDBY</div>
      <button class="btn t-btn" @click="$emit('resume')">继续探索</button>
      <button class="btn t-btn" @click="$emit('save')">保存进度</button>
      <button class="btn t-btn" @click="$emit('help')">操作手册</button>
      <button class="btn t-btn" @click="$emit('settings')">系统设置</button>
      <button class="btn t-btn" @click="$emit('quit')">返回标题</button>
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div id="pause-stats" v-html="statsHtml"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { useMilestonesStore } from '../stores/milestonesStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { U } from '../utils';

defineEmits(['resume', 'save', 'help', 'settings', 'quit']);
const game = useGameStore();
const milestones = useMilestonesStore();
const inventory = useInventoryStore();

const statsHtml = computed(() => {
  const st = milestones.stats;
  return `星球：${game.planetName} · ${game.palette.climate}<br>` +
    `游玩时长：${U.fmtTime(game.playTime)} · 行走 ${Math.round(st.walk || 0)}m<br>` +
    `采集 ${st.mined || 0} · 建造 ${st.placed || 0} · 分析 ${st.scans || 0} · 跃迁 ${st.warps || 0}<br>` +
    `记录点数：${inventory.units}`;
});
</script>
