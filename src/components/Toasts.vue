<template>
  <div id="toasts">
    <div v-for="t in toasts" :key="t.id" class="toast" :class="{ fade: false }">
      <img :src="icon(t.itemId)"><span>{{ t.name }}</span><span class="tc">+{{ t.n }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getGameIcon } from '../runtime/game-runtime';

defineProps<{ toasts: { id: string; itemId: string; name: string; n: number }[] }>();
function icon(id: string) { return getGameIcon(id); }
</script>
