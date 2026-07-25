<template>
  <div id="notify-stack">
    <div v-for="n in notifications" :key="n.id" class="notice" :class="n.kind">
      <span class="n-kicker">{{ kickers[n.kind] || kickers.info }}</span>{{ n.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ notifications: { id: string; text: string; kind: string }[] }>();
const kickers: Record<string, string> = { info: '信息 // INFO', success: '完成 // DONE', warn: '注意 // CAUTION', danger: '警报 // ALERT' };
</script>
