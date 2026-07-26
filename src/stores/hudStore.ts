import { defineStore } from 'pinia';
import { ref } from 'vue';

interface Toast { id: string; itemId: string; name: string; n: number; timer?: ReturnType<typeof setTimeout> }
interface Notification { id: string; text: string; kind: string; timer?: ReturnType<typeof setTimeout> }
interface Milestone { kicker: string; title: string; sub: string }
interface MarkerData { id: string; type: string; x: number; y: number; z: number; ttl: number }

export const useHudStore = defineStore('hud', () => {
  const alertText = ref('');
  const alertOn = ref(false);
  const flightHudOn = ref(false);
  const interactKey = ref('');
  const interactText = ref('');
  const interactProgress = ref(0);
  const toasts = ref<Toast[]>([]);
  const notifications = ref<Notification[]>([]);
  const milestones = ref<Milestone[]>([]);
  const planetCardInfo = ref<{ name: string; climate: string; flora: string; fauna: string; storm: string; res: string[] } | null>(null);
  const missionTitle = ref('');
  const missionDesc = ref('');
  const missionCur = ref(0);
  const missionMax = ref(0);
  const markers = ref<MarkerData[]>([]);

  function addToast(itemId: string, n: number) {
    const existing = toasts.value.find(t => t.itemId === itemId);
    if (existing) {
      existing.n += n;
      if (existing.timer) clearTimeout(existing.timer);
      existing.timer = setTimeout(() => removeToast(existing.id), 1800);
      return;
    }
    const id = Date.now().toString();
    const toast: Toast = { id, itemId, name: itemId, n };
    toast.timer = setTimeout(() => removeToast(id), 1800);
    toasts.value.push(toast);
  }
  function removeToast(id: string) {
    const idx = toasts.value.findIndex(t => t.id === id);
    if (idx !== -1) toasts.value.splice(idx, 1);
  }

  function addNotification(text: string, kind: string = 'info') {
    const id = Date.now().toString();
    const notif: Notification = { id, text, kind };
    notif.timer = setTimeout(() => removeNotification(id), 5200);
    notifications.value.push(notif);
    if (notifications.value.length > 5) {
      const removed = notifications.value.shift();
      if (removed?.timer) clearTimeout(removed.timer);
    }
  }
  function removeNotification(id: string) {
    const idx = notifications.value.findIndex(n => n.id === id);
    if (idx !== -1) notifications.value.splice(idx, 1);
  }

  function pushMilestone(kicker: string, title: string, sub: string) {
    milestones.value.push({ kicker, title, sub });
    setTimeout(() => milestones.value.shift(), 3700);
  }

  function showPlanetCard(info: { name: string; climate: string; flora: string; fauna: string; storm: string; res: string[] }) {
    planetCardInfo.value = info;
    setTimeout(() => { planetCardInfo.value = null; }, 6000);
  }

  function addMarker(type: string, x: number, y: number, z: number, ttl: number) {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    markers.value.push({ id, type, x, y, z, ttl });
    setTimeout(() => removeMarker(id), ttl * 1000);
  }
  function removeMarker(id: string) {
    const idx = markers.value.findIndex(m => m.id === id);
    if (idx !== -1) markers.value.splice(idx, 1);
  }
  function clearMarkers() {
    markers.value = [];
  }

  return {
    alertText, alertOn, flightHudOn, interactKey, interactText, interactProgress,
    toasts, notifications, milestones, planetCardInfo,
    missionTitle, missionDesc, missionCur, missionMax, markers,
    addToast, removeToast, addNotification, removeNotification,
    pushMilestone, showPlanetCard, addMarker, removeMarker, clearMarkers
  };
});
