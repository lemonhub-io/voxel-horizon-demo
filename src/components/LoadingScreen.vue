<template>
  <div id="loading-screen" class="screen">
    <div class="load-box">
      <div class="pc-kicker">正在进入行星大气层</div>
      <div class="load-name">{{ planetName }}</div>
      <div class="load-sub">{{ subtitle }}</div>
      <div class="bar big"><div class="bar-fill acc" :style="{ width: progress + '%' }"></div></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ planetName: string; subtitle: string; progress: number }>();
</script>
