<template>
  <div id="mp-lobby-screen" class="screen">
    <div class="mp-frame panel">
      <div class="p-kicker">公开联机 // PUBLIC SESSION</div>
      <p class="mp-lead">
        加入临时公开分片，与其他远行者同星探索。服务端<strong>不托管存档</strong>，离开后会话进度不保留。
      </p>

      <div class="mp-name-row">
        <label for="mp-name">呼号</label>
        <input
          id="mp-name"
          v-model="localName"
          maxlength="16"
          placeholder="远行者"
          autocomplete="off"
          spellcheck="false"
        >
      </div>

      <div class="mp-toolbar">
        <div class="mp-sec-title">公开分片 <em>SHARDS</em></div>
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
          <div class="mp-id">{{ shardLabel(room.roomId) }}</div>
          <div class="mp-info">
            <div class="mp-planet">{{ room.planetName || '待生成星域' }}</div>
            <div class="mp-meta">
              {{ room.roomId }} · 气候索引 {{ room.palIdx }}
              <span v-if="room.playerCount > 0"> · 种子 {{ shortSeed(room.seed) }}</span>
            </div>
          </div>
          <div class="mp-count" :class="{ hot: room.playerCount > 0, full: room.playerCount >= room.maxPlayers }">
            <span class="mp-count-num">{{ room.playerCount }}</span>
            <span class="mp-count-max">/ {{ room.maxPlayers }}</span>
          </div>
        </div>
        <div v-if="!loading && rooms.length === 0 && !error" class="mp-empty">暂无可用分片</div>
      </div>

      <div class="mp-note">
        <span class="mp-note-tag">注意</span>
        库存、任务与飞船修复仍为本地；仅同步位置与地形编辑。满员分片将无法加入。
      </div>

      <div class="set-actions mp-actions">
        <button class="btn sm" type="button" @click="$emit('back')">返回</button>
        <div class="mp-actions-right">
          <button
            class="btn sm"
            type="button"
            :disabled="joining || !canJoinSelected"
            @click="joinSelected"
          >
            加入所选
          </button>
          <button class="btn sm primary" type="button" :disabled="joining || !hasOpenRoom" @click="joinAuto">
            {{ joining ? '连接中…' : '快速加入' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { PublicRoomInfo } from '../net/protocol';
import { NetClient } from '../net/NetClient';

const props = defineProps<{
  displayName?: string;
  joining?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  join: [payload: { roomId?: string; name: string }];
}>();

const localName = ref((props.displayName || '远行者').slice(0, 16));
const rooms = ref<PublicRoomInfo[]>([]);
const loading = ref(false);
const error = ref('');
const selectedId = ref('');

const joining = computed(() => !!props.joining);

const hasOpenRoom = computed(() => rooms.value.some((r) => r.playerCount < r.maxPlayers));
const canJoinSelected = computed(() => {
  const r = rooms.value.find((x) => x.roomId === selectedId.value);
  return !!r && r.playerCount < r.maxPlayers;
});

watch(
  () => props.displayName,
  (v) => {
    if (v) localName.value = v.slice(0, 16);
  },
);

function shardLabel(roomId: string): string {
  const m = /^public-(\d+)$/.exec(roomId);
  return m ? String(Number(m[1]) + 1) : '?';
}

function shortSeed(seed: number): string {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
}

function selectRoom(room: PublicRoomInfo): void {
  if (room.playerCount >= room.maxPlayers) return;
  selectedId.value = room.roomId;
}

function nameOrDefault(): string {
  const n = localName.value.trim();
  return (n || '远行者').slice(0, 16);
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
      const prefer = rooms.value.find((r) => r.playerCount > 0 && r.playerCount < r.maxPlayers)
        || rooms.value.find((r) => r.playerCount < r.maxPlayers);
      if (prefer) selectedId.value = prefer.roomId;
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '无法拉取公开分片';
    rooms.value = [];
  } finally {
    loading.value = false;
  }
}

function joinAuto(): void {
  if (joining.value || !hasOpenRoom.value) return;
  emit('join', { name: nameOrDefault() });
}

function joinSelected(): void {
  if (joining.value || !canJoinSelected.value) return;
  emit('join', { roomId: selectedId.value, name: nameOrDefault() });
}

onMounted(() => {
  void refresh();
});
</script>
