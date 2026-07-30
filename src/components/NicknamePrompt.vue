<template>
  <div class="nickname-prompt" role="dialog" aria-modal="true" aria-labelledby="nickname-title">
    <form class="nickname-card panel" @submit.prevent="confirm">
      <div class="nickname-kicker">IDENTITY INITIALIZATION</div>
      <h2 id="nickname-title">设定旅行者昵称</h2>
      <p>这是你在本设备上的游戏身份。请输入 2–16 个字符后继续。</p>
      <label for="nickname-input">昵称</label>
      <input
        id="nickname-input"
        v-model="value"
        maxlength="16"
        autocomplete="nickname"
        autofocus
        placeholder="例如：星海旅人"
      >
      <p v-if="error" class="nickname-error" role="alert">{{ error }}</p>
      <button class="btn primary nickname-confirm" type="submit">确认并进入</button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { normalizePlayerNickname } from '../net/official-profile';

const emit = defineEmits<{ confirm: [nickname: string] }>();
const value = ref('');
const error = ref('');

function confirm(): void {
  const nickname = normalizePlayerNickname(value.value);
  if (!nickname) {
    error.value = '昵称需为 2–16 个字符，且不能包含控制字符。';
    return;
  }
  emit('confirm', nickname);
}
</script>
