import { computed, onMounted, ref, type Ref } from 'vue';
import { MultiplayerApi } from '../net/MultiplayerApi';
import { OFFICIAL_ROOM_ID, type OfficialStatus, type PublicRoomInfo } from '../net/protocol';

export function useMultiplayerLobby(joining: Readonly<Ref<boolean>>, api = new MultiplayerApi()) {
  const rooms = ref<PublicRoomInfo[]>([]);
  const official = ref<OfficialStatus | null>(null);
  const loading = ref(false);
  const loadingOfficial = ref(false);
  const error = ref('');
  const officialError = ref('');
  const selectedId = ref('');
  const joinKind = ref<'host' | 'official' | null>(null);

  const joiningOfficial = computed(() => joining.value && joinKind.value === 'official');
  const joiningHost = computed(() => joining.value && joinKind.value === 'host');
  const officialFull = computed(() => {
    const entry = official.value;
    return !!entry && entry.playerCount >= entry.maxPlayers;
  });
  const hostRooms = computed(() =>
    rooms.value.filter((room) => room.mode !== 'official' && room.roomId !== OFFICIAL_ROOM_ID),
  );
  const canJoinSelected = computed(() => {
    const room = hostRooms.value.find((entry) => entry.roomId === selectedId.value);
    return !!room && room.playerCount < room.maxPlayers && room.live !== false;
  });

  function selectRoom(room: PublicRoomInfo): void {
    if (room.mode === 'official' || room.roomId === OFFICIAL_ROOM_ID || room.playerCount >= room.maxPlayers) return;
    selectedId.value = room.roomId;
  }

  async function refreshOfficial(): Promise<void> {
    loadingOfficial.value = true;
    officialError.value = '';
    try {
      official.value = await api.getOfficialStatus();
    } catch (cause) {
      // The list endpoint includes the same entry, so retain that fallback when
      // only the status endpoint is briefly unavailable.
      if (!official.value) {
        officialError.value = cause instanceof Error ? cause.message : '无法连接官方服';
      }
    } finally {
      loadingOfficial.value = false;
    }
  }

  async function refresh(): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      rooms.value = await api.listPublicRooms();
      const listedOfficial = rooms.value.find(
        (room) => room.mode === 'official' || room.roomId === OFFICIAL_ROOM_ID,
      );
      if (listedOfficial && !official.value) {
        official.value = {
          ...listedOfficial,
          wsPath: `/ws?room=${encodeURIComponent(listedOfficial.roomId)}`,
          mode: 'official',
        };
        officialError.value = '';
      }
      if (selectedId.value) {
        const selected = hostRooms.value.find(
          (room) => room.roomId === selectedId.value && room.playerCount < room.maxPlayers,
        );
        if (!selected) selectedId.value = '';
      }
      if (!selectedId.value) {
        const preferred = hostRooms.value.find(
          (room) => room.playerCount > 0 && room.playerCount < room.maxPlayers,
        );
        if (preferred) selectedId.value = preferred.roomId;
      }
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '无法拉取公开房间';
      rooms.value = [];
    } finally {
      loading.value = false;
    }
  }

  function prepareHostJoin(): string | null {
    if (joining.value || !canJoinSelected.value) return null;
    joinKind.value = 'host';
    return selectedId.value;
  }

  function prepareOfficialJoin(): boolean {
    if (joining.value || officialFull.value || officialError.value) return false;
    joinKind.value = 'official';
    return true;
  }

  onMounted(() => {
    void refreshOfficial();
    void refresh();
  });

  return {
    rooms,
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
  };
}
