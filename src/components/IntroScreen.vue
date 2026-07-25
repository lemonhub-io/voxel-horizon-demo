<template>
  <div id="intro-screen" @click="$emit('skip')">
    <div id="intro-lines">
      <div v-for="(line, i) in lines" :key="i" class="il" :class="line.cls">{{ line.text }}</div>
    </div>
    <div class="intro-skip">单击跳过</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ lines: { text: string; cls?: string }[] }>();
defineEmits(['skip']);
</script>
