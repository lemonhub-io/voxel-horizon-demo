<template>
  <div id="save-screen" class="screen">
    <div class="save-frame panel">
      <div class="p-kicker">存档管理 // SAVE SLOTS</div>
      <div class="save-list">
        <div v-for="(slot, i) in slots" :key="i" class="save-slot" :class="{ active: i === currentSlot, empty: !slot }" @click="$emit('load', i)">
          <div class="save-id">{{ i + 1 }}</div>
          <template v-if="slot">
            <div class="save-info">
              <div class="save-planet">{{ slot.planetName }}</div>
              <div class="save-meta">
                {{ slot.climate ? slot.climate + ' · ' : '' }}{{ formatTime(slot.playTime) }} · HP {{ Math.round(slot.playerHp) }}
                <span v-if="slot.timestamp" class="save-date"> · {{ formatDate(slot.timestamp) }}</span>
              </div>
            </div>
            <button class="btn sm danger" @click.stop="$emit('delete', i)">删除</button>
          </template>
          <template v-else>
            <div class="save-info">
              <div class="save-empty">空存档位</div>
            </div>
          </template>
        </div>
      </div>
      <div class="set-actions">
        <button class="btn sm" @click="$emit('back')">返回</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SaveSlotMeta } from '../types';
import { U } from '../utils';

defineProps<{
  slots: (SaveSlotMeta | null)[];
  currentSlot: number;
}>();

defineEmits(['load', 'delete', 'back']);

function formatTime(s: number): string {
  return U.fmtTime(s);
}

function formatDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}
</script>
