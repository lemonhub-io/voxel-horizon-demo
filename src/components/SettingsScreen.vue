<template>
  <div id="settings-screen" class="screen" style="z-index:200">
    <div class="set-box panel">
      <div class="p-kicker">系统设置 // OPTIONS</div>
      <div class="set-row"><label>总音量</label><input type="range" :value="settings.master" @input="update('master', +$event.target.value)" min="0" max="100"><span>{{ settings.master }}</span></div>
      <div class="set-row"><label>音乐音量</label><input type="range" :value="settings.music" @input="update('music', +$event.target.value)" min="0" max="100"><span>{{ settings.music }}</span></div>
      <div class="set-row"><label>音效音量</label><input type="range" :value="settings.sfx" @input="update('sfx', +$event.target.value)" min="0" max="100"><span>{{ settings.sfx }}</span></div>
      <div class="set-row"><label>鼠标灵敏度</label><input type="range" :value="settings.sens" @input="update('sens', +$event.target.value)" min="20" max="200"><span>{{ settings.sens }}</span></div>
      <div class="set-row"><label>视野 FOV</label><input type="range" :value="settings.fov" @input="update('fov', +$event.target.value)" min="60" max="100"><span>{{ settings.fov }}</span></div>
      <div class="set-row"><label>渲染距离</label>
        <select :value="settings.dist" @change="update('dist', +$event.target.value)"><option value="3">近 (流畅)</option><option value="4">中 (推荐)</option><option value="5">远</option><option value="6">极远 (高配)</option></select><span></span>
      </div>
      <div class="set-row"><label>飞行反转Y轴</label><input type="checkbox" :checked="settings.invert" @change="update('invert', $event.target.checked)"><span></span></div>
      <div class="set-actions"><button class="btn sm danger" @click="$emit('wipe')">清除存档</button><button class="btn sm" @click="$emit('back')">返回</button></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useGameStore } from '../stores/gameStore';
import type { Settings } from '../types';

defineEmits(['back', 'wipe']);
const game = useGameStore();
const settings = game.settings;

function update(key: keyof Settings, value: number | boolean) {
  (settings as Record<string, unknown>)[key] = value;
}
</script>
