<template>
  <div id="mp-lobby-screen" class="screen">
    <div class="mp-frame panel">
      <div class="p-kicker">公开联机 // PUBLIC SESSION</div>
      <p class="mp-lead">
        房主用<strong>本机世界</strong>开放联机，地图与玩家状态由房主托管；云端仅负责房间列表与消息中继，
        <strong>不保存存档</strong>。后加入的玩家会从房主同步当前地图编辑。
      </p>

      <div class="mp-toolbar">
        <div class="mp-sec-title">公开房间 <em>HOST ROOMS</em></div>
        <button class="btn sm" type="button" :disabled="loading" @click="refresh">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>

      <div v-if="error" class="mp-error" role="alert">{{ error }}</div>

      <div class="mp-list">
        <div
          v-for="room in rooms"
          :key="room.roomId"
          class="mp-slot"
          :class="{ full: room.playerCount >= room.maxPlayers, selected: selectedId === room.roomId }"
          @click="selectRoom(room)"
        >
          <div class="mp-id">{{ shortId(room.roomId) }}</div>
          <div class="mp-info">
            <div class="mp-planet">{{ room.planetName || '未知星域' }}</div>
            <div class="mp-meta">
              {{ room.roomId }} · 气候 {{ room.palIdx }}
              <span v-if="room.live"> · 种子 {{ shortSeed(room.seed) }}</span>
            </div>
          </div>
          <div class="mp-count" :class="{ hot: room.playerCount > 0, full: room.playerCount >= room.maxPlayers }">
            <span class="mp-count-num">{{ room.playerCount }}</span>
            <span class="mp-count-max">/ {{ room.maxPlayers }}</span>
          </div>
        </div>
        <div v-if="!loading && rooms.length === 0 && !error" class="mp-empty">
          暂无房主开放的公开房间 · 可先单机开始再「开放联机」
        </div>
      </div>

      <div class="mp-note">
        <span class="mp-note-tag">说明</span>
        开放联机：在单机游戏中暂停菜单点击「开放联机」。加入：从此列表选择房间，将加载房主当前地图。
      </div>

      <div class="set-actions mp-actions">
        <button class="btn sm" type="button" @click="$emit('back')">返回</button>
        <div class="mp-actions-right">
          <button
            class="btn sm primary"
            type="button"
            :disabled="joining || !canJoinSelected"
            @click="joinSelected"
          >
            {{ joining ? '连接中…' : '加入所选房间' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import type { PublicRoomInfo } from '../net/protocol';
import { NetClient } from '../net/NetClient';

const props = defineProps<{
  joining?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  join: [payload: { roomId: string }];
}>();

const rooms = ref<PublicRoomInfo[]>([]);
const loading = ref(false);
const error = ref('');
const selectedId = ref('');

const joining = computed(() => !!props.joining);

const canJoinSelected = computed(() => {
  const r = rooms.value.find((x) => x.roomId === selectedId.value);
  return !!r && r.playerCount < r.maxPlayers && r.live !== false;
});

function shortId(roomId: string): string {
  const m = /^room-(.+)$/i.exec(roomId);
  return (m?.[1] || roomId).slice(0, 4).toUpperCase();
}

function shortSeed(seed: number): string {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
}

function selectRoom(room: PublicRoomInfo): void {
  if (room.playerCount >= room.maxPlayers) return;
  selectedId.value = room.roomId;
}

async function refresh(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const client = new NetClient();
    rooms.value = await client.listPublicRooms();
    if (selectedId.value) {
      const still = rooms.value.find((r) => r.roomId === selectedId.value && r.playerCount < r.maxPlayers);
      if (!still) selectedId.value = '';
    }
    if (!selectedId.value) {
      const prefer = rooms.value.find((r) => r.playerCount > 0 && r.playerCount < r.maxPlayers);
      if (prefer) selectedId.value = prefer.roomId;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法拉取公开房间';
    rooms.value = [];
  } finally {
    loading.value = false;
  }
}

function joinSelected(): void {
  if (joining.value || !canJoinSelected.value) return;
  emit('join', { roomId: selectedId.value });
}

onMounted(() => {
  void refresh();
});
</script>
