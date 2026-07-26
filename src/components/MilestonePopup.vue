<template>
  <div v-if="m" id="milestone-pop">
    <div class="ms-line"></div>
    <div class="ms-kicker">{{ m.kicker }}</div>
    <div class="ms-title">{{ m.title }}</div>
    <div class="ms-sub">{{ m.sub }}</div>
    <div class="ms-line"></div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ m: { kicker: string; title: string; sub: string } | undefined }>();
</script>
