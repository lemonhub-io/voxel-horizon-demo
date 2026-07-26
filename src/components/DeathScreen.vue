<template>
  <div id="death-screen" class="screen">
    <div class="death-box">
      <div class="d-title">信号丢失</div>
      <div class="d-sub">远行者生命体征中断（{{ cause || '未知原因' }}）—— 正在重构…</div>
      <button class="btn t-btn" @click="$emit('respawn')">重新苏醒</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ cause?: string }>();
defineEmits(['respawn']);
</script>
