<template>
  <div id="model-load-error" class="screen" role="alertdialog" aria-modal="true" aria-labelledby="model-load-error-title">
    <div class="model-load-error__panel panel">
      <div class="pc-kicker">REMOTE ASSET CHECK FAILED</div>
      <h2 id="model-load-error-title">远程模型加载失败</h2>
      <p>以下资源无法加载。继续游戏时，对应模型不会显示。</p>
      <ul class="model-load-error__list">
        <li v-for="failure in failures" :key="failure">{{ failure }}</li>
      </ul>
      <div class="model-load-error__actions">
        <button class="btn" @click="$emit('continue')">仍然进入游戏</button>
        <button class="btn danger" @click="$emit('report-exit')">退出并报告错误</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{ failures: string[] }>();
defineEmits(['continue', 'report-exit']);
</script>