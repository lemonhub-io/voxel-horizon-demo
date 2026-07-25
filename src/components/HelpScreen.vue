<template>
  <div id="help-screen" class="screen">
    <div class="help-box panel">
      <div class="p-kicker">操作手册 // MANUAL</div>
      <div class="help-grid">
        <div><span class="kbd">W A S D</span> 移动</div><div><span class="kbd">Shift</span> 冲刺</div>
        <div><span class="kbd">空格</span> 跳跃 / 按住喷气背包</div><div><span class="kbd">鼠标左键</span> 激光采集 / 攻击</div>
        <div><span class="kbd">鼠标右键</span> 放置方块 / 使用物品</div><div><span class="kbd">1-9 / 滚轮</span> 快捷栏</div>
        <div><span class="kbd">E</span> 交互 / 进入飞船</div><div><span class="kbd">Tab</span> 背包 · 合成 · 发现</div>
        <div><span class="kbd">C</span> 扫描脉冲(标记资源)</div><div><span class="kbd">F</span> 分析目镜</div>
        <div><span class="kbd">Z</span> 补充生命维持(消耗氧)</div><div><span class="kbd">X</span> 补充危险防护(消耗钠)</div>
        <div><span class="kbd">T</span> 手电</div><div><span class="kbd">Esc</span> 暂停</div>
        <div class="help-wide">飞行模式：鼠标转向 · <span class="kbd">W/S</span> 油门 · <span class="kbd">空格</span> 加力 · <span class="kbd">E</span> 降落 · <span class="kbd">J</span> 跃迁(需跃迁电池)</div>
      </div>
      <div class="help-flow">旅程指引：补充防护(钠·黄色荧光植物) → 校准工具(铁尘·岩石) → 生命维持(氧·红色呼吸花) → 合成金属镀层修复推进器 → 碳纳米管修复脉冲引擎 → 双氢合成启动燃料 → 起飞 → 建造庇护所 · 扫描生物 · 合成跃迁电池 → 跃迁新星球</div>
      <div class="set-actions"><button class="btn sm" @click="$emit('back')">返回</button></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineEmits(['back']);
</script>
