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
import { computed, onMounted, ref } from 'vue';
import { OFFICIAL_ROOM_ID, type OfficialStatus, type PublicRoomInfo } from '../net/protocol';
import { NetClient } from '../net/NetClient';

const props = defineProps<{
  joining?: boolean;
}>();

const emit = defineEmits<{
  back: [];
  join: [payload: { roomId: string }];
  'join-official': [];
}>();

const rooms = ref<PublicRoomInfo[]>([]);
const official = ref<OfficialStatus | null>(null);
const loading = ref(false);
const loadingOfficial = ref(false);
const error = ref('');
const officialError = ref('');
const selectedId = ref('');
const joinKind = ref<'host' | 'official' | null>(null);

const joining = computed(() => !!props.joining);
const joiningOfficial = computed(() => joining.value && joinKind.value === 'official');
const joiningHost = computed(() => joining.value && joinKind.value === 'host');

const officialFull = computed(() => {
  const o = official.value;
  return !!o && o.playerCount >= o.maxPlayers;
});

const hostRooms = computed(() => rooms.value.filter((room) => room.mode !== 'official' && room.roomId !== OFFICIAL_ROOM_ID));

const canJoinSelected = computed(() => {
  const r = hostRooms.value.find((x) => x.roomId === selectedId.value);
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
  if (room.mode === 'official' || room.roomId === OFFICIAL_ROOM_ID || room.playerCount >= room.maxPlayers) return;
  selectedId.value = room.roomId;
}

async function refreshOfficial(): Promise<void> {
  loadingOfficial.value = true;
  officialError.value = '';
  try {
    const client = new NetClient();
    official.value = await client.getOfficialStatus();
  } catch (e) {
    // The public-list endpoint also carries the official entry. Preserve that
    // fallback if the dedicated status request is temporarily unavailable.
    if (!official.value) {
      officialError.value = e instanceof Error ? e.message : '无法连接官方服';
      official.value = null;
    }
  } finally {
    loadingOfficial.value = false;
  }
}

async function refresh(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const client = new NetClient();
    rooms.value = await client.listPublicRooms();
    const listedOfficial = rooms.value.find((room) => room.mode === 'official' || room.roomId === OFFICIAL_ROOM_ID);
    if (listedOfficial && !official.value) {
      official.value = {
        ...listedOfficial,
        wsPath: `/ws?room=${encodeURIComponent(listedOfficial.roomId)}`,
        mode: 'official',
      };
      officialError.value = '';
    }
    if (selectedId.value) {
      const still = hostRooms.value.find((r) => r.roomId === selectedId.value && r.playerCount < r.maxPlayers);
      if (!still) selectedId.value = '';
    }
    if (!selectedId.value) {
      const prefer = hostRooms.value.find((r) => r.playerCount > 0 && r.playerCount < r.maxPlayers);
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
  joinKind.value = 'host';
  emit('join', { roomId: selectedId.value });
}

function joinOfficial(): void {
  if (joining.value || officialFull.value || officialError.value) return;
  joinKind.value = 'official';
  emit('join-official');
}

onMounted(() => {
  void refreshOfficial();
  void refresh();
});
</script>
