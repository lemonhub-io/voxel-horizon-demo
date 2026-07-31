<template>
  <div v-if="info" id="planet-card">
    <div class="pc-inner panel">
      <div class="pc-kicker">行星探测数据 // PLANETARY SCAN</div>
      <div class="pc-name">{{ info.name }}</div>
      <div class="pc-grid">
        <div class="pc-item"><label>气候</label><span>{{ info.climate }}</span></div>
        <div class="pc-item"><label>植物</label><span>{{ info.flora }}</span></div>
        <div class="pc-item"><label>动物</label><span>{{ info.fauna }}</span></div>
        <div class="pc-item"><label>风暴</label><span>{{ info.storm }}</span></div>
      </div>
      <div class="pc-res">
        <div
          v-for="r in info.res"
          :key="r"
          class="res-chip"
          :style="{ borderColor: ITEMS[r]?.col || '#fff', color: ITEMS[r]?.col || '#fff' }"
        >
          {{ ITEMS[r]?.name }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ITEMS } from '../config';
defineProps<{ info: { name: string; climate: string; flora: string; fauna: string; storm: string; res: string[] } | null }>();
</script>
