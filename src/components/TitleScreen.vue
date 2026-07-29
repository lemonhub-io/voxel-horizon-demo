<template>
  <div id="title-screen">
    <canvas id="title-stars" ref="starsCanvas"></canvas>
    <div class="title-planet"></div>
    <div class="title-haze"></div>
    <div class="title-content">
      <div class="t-kicker">远征协议 0x2F // EXPEDITION</div>
      <h1>方界<span>深空</span></h1>
      <div class="t-sub">VOXEL HORIZON — 体素星球 · 无尽苍穹</div>
      <div class="t-menu">
        <button class="btn t-btn" @click="$emit('new-game')">新的旅程</button>
        <button v-if="hasSave" class="btn t-btn" @click="$emit('continue')">继续旅程</button>
        <button class="btn t-btn" @click="$emit('public-mp')">公开联机</button>
        <button class="btn t-btn" @click="$emit('saves')">存档管理</button>
        <button class="btn t-btn" @click="$emit('help')">操作手册</button>
        <button class="btn t-btn" @click="$emit('settings')">系统设置</button>
      </div>
      <div class="t-seed"><label>星球种子(可选)</label><input v-model="seed" maxlength="16" placeholder="随机"></div>
      <div class="t-mp-hint">公开联机 · 房主本机托管 · 云端仅列表与中继</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';

defineProps<{ hasSave: boolean }>();
defineEmits(['new-game', 'continue', 'public-mp', 'saves', 'help', 'settings']);
const seed = ref('');
defineExpose({ seed });

const starsCanvas = ref<HTMLCanvasElement | null>(null);
let animId = 0;
let resizeStars: (() => void) | null = null;

onMounted(() => {
  const cvs = starsCanvas.value;
  if (!cvs) return;
  const ctx = cvs.getContext('2d')!;
  const stars: { x: number; y: number; r: number; p: number; s: number }[] = [];
  resizeStars = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    cvs.width = Math.round(innerWidth * dpr);
    cvs.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars.length = 0;
    for (let i = 0; i < 240; i++) stars.push({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() * 1.4 + 0.3, p: Math.random() * 6.28, s: 0.5 + Math.random() * 2 });
  };
  resizeStars();
  addEventListener('resize', resizeStars);
  const draw = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    const t = performance.now() / 1000;
    for (const s of stars) {
      const a = 0.35 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = `rgba(220,238,248,${a})`;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    animId = requestAnimationFrame(draw);
  };
  draw();
});

onBeforeUnmount(() => {
  cancelAnimationFrame(animId);
  if (resizeStars) removeEventListener('resize', resizeStars);
});
</script>
