<template>
  <div id="mp-lobby-screen" class="screen">
    <div class="mp-frame panel">
      <div class="p-kicker">联机大厅 // MULTIPLAYER</div>
      <p class="mp-lead">
        <strong>官方星域</strong>由云端 DO 裁决方块，地图 edits 写入 R2，可随时再进恢复。
        <strong>公开房间</strong>仍由房主本机托管，云端只做列表与中继。
      </p>

      <div class="mp-official">
        <div class="mp-sec-title">官方星域 <em>OFFICIAL</em></div>
        <div v-if="officialError" class="mp-error" role="alert">{{ officialError }}</div>
        <div v-else-if="official" class="mp-slot official" :class="{ full: officialFull }">
          <div class="mp-id">官</div>
          <div class="mp-info">
            <div class="mp-planet">{{ official.planetName || '官方星域' }}</div>
            <div class="mp-meta">
              {{ official.roomId }} · 气候 {{ official.palIdx }}
              <span v-if="official.live"> · DO + R2</span>
              <span v-if="official.editChunks != null"> · 编辑块 {{ official.editChunks }}</span>
            </div>
          </div>
          <div class="mp-count" :class="{ hot: official.playerCount > 0, full: officialFull }">
            <span class="mp-count-num">{{ official.playerCount }}</span>
            <span class="mp-count-max">/ {{ official.maxPlayers }}</span>
          </div>
        </div>
        <div v-else-if="loadingOfficial" class="mp-empty">正在查询官方服…</div>
        <button
          class="btn sm primary mp-official-btn"
          type="button"
          :disabled="joining || loadingOfficial || !!officialError || officialFull"
          @click="joinOfficial"
        >
          {{ joiningOfficial ? '连接中…' : '进入官方星域' }}
        </button>
      </div>

      <div class="mp-toolbar">
        <div class="mp-sec-title">公开房间 <em>HOST ROOMS</em></div>
        <button class="btn sm" type="button" :disabled="loading" @click="refresh">
          {{ loading ? '刷新中…' : '刷新' }}
        </button>
      </div>

      <div v-if="error" class="mp-error" role="alert">{{ error }}</div>

      <div class="mp-list">
        <div
          v-for="room in hostRooms"
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
        <div v-if="!loading && hostRooms.length === 0 && !error" class="mp-empty">
          暂无房主开放的公开房间 · 可先单机开始再「开放联机」
        </div>
      </div>

      <div class="mp-note">
        <span class="mp-note-tag">说明</span>
        官方：服务端权威 + R2 存档。公开房：暂停菜单「开放联机」由本机当房主。
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
            {{ joiningHost ? '连接中…' : '加入所选房间' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useMultiplayerLobby } from '../composables/useMultiplayerLobby';

const props = defineProps<{
  joining?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  join: [payload: { roomId: string }];
  'join-official': [];
}>();

const joining = computed(() => !!props.joining);
const {
  official,
  loading,
  loadingOfficial,
  error,
  officialError,
  selectedId,
  joiningOfficial,
  joiningHost,
  officialFull,
  hostRooms,
  canJoinSelected,
  selectRoom,
  refresh,
  prepareHostJoin,
  prepareOfficialJoin,
} = useMultiplayerLobby(joining);

function shortId(roomId: string): string {
  const m = /^room-(.+)$/i.exec(roomId);
  return (m?.[1] || roomId).slice(0, 4).toUpperCase();
}

function shortSeed(seed: number): string {
  return (seed >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
}

function joinSelected(): void {
  const roomId = prepareHostJoin();
  if (roomId) emit('join', { roomId });
}

function joinOfficial(): void {
  if (prepareOfficialJoin()) emit('join-official');
}
</script>
