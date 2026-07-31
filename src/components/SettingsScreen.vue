<template>
  <div id="settings-screen" class="screen opts-screen" style="z-index:200">
    <div class="opts-frame panel">
      <header class="opts-head">
        <div>
          <div class="p-kicker">系统设置 // OPTIONS</div>
          <p class="opts-lead">调整音频、操控、画质与系统行为。改动会立即生效并自动保存。</p>
        </div>
        <button type="button" class="btn sm" @click="$emit('back')">返回</button>
      </header>

      <nav class="opts-tabs" role="tablist" aria-label="设置分类">
        <button
          v-for="t in tabs"
          :key="t.id"
          type="button"
          role="tab"
          class="opts-tab"
          :class="{ active: tab === t.id }"
          :aria-selected="tab === t.id"
          @click="tab = t.id"
        >
          {{ t.label }}
          <em>{{ t.en }}</em>
        </button>
      </nav>

      <div class="opts-body">
        <section v-show="tab === 'audio'" class="opts-pane" role="tabpanel">
          <div class="opts-row">
            <div class="opts-meta">
              <label>总音量</label>
              <p>全局输出增益，影响音乐与音效。</p>
            </div>
            <div class="opts-control">
              <input type="range" :value="settings.master" min="0" max="100" @input="onNum('master', $event)">
              <span>{{ settings.master }}%</span>
            </div>
          </div>
          <div class="opts-row">
            <div class="opts-meta">
              <label>音乐音量</label>
              <p>环境与探索配乐。</p>
            </div>
            <div class="opts-control">
              <input type="range" :value="settings.music" min="0" max="100" @input="onNum('music', $event)">
              <span>{{ settings.music }}%</span>
            </div>
          </div>
          <div class="opts-row">
            <div class="opts-meta">
              <label>音效音量</label>
              <p>采集、交互、警报等反馈音。</p>
            </div>
            <div class="opts-control">
              <input type="range" :value="settings.sfx" min="0" max="100" @input="onNum('sfx', $event)">
              <span>{{ settings.sfx }}%</span>
            </div>
          </div>
          <div class="opts-actions-inline">
            <button type="button" class="btn sm" @click="muteAll">静音全部</button>
            <button type="button" class="btn sm" @click="restoreAudio">恢复推荐音量</button>
          </div>
        </section>

        <section v-show="tab === 'controls'" class="opts-pane" role="tabpanel">
          <div class="opts-row">
            <div class="opts-meta">
              <label>鼠标灵敏度</label>
              <p>视角转动速度（键鼠）。当前倍率 ×{{ (settings.sens / 100).toFixed(2) }}</p>
            </div>
            <div class="opts-control">
              <input type="range" :value="settings.sens" min="20" max="200" @input="onNum('sens', $event)">
              <span>{{ settings.sens }}</span>
            </div>
          </div>
          <div class="opts-row">
            <div class="opts-meta">
              <label>触控灵敏度</label>
              <p>移动端滑动视角速度。当前倍率 ×{{ (settings.touchSens / 100).toFixed(2) }}</p>
            </div>
            <div class="opts-control">
              <input type="range" :value="settings.touchSens" min="20" max="200" @input="onNum('touchSens', $event)">
              <span>{{ settings.touchSens }}</span>
            </div>
          </div>
          <div class="opts-row">
            <div class="opts-meta">
              <label>视野 FOV</label>
              <p>水平视野角度。偏低更沉浸，偏高更利于观察。</p>
            </div>
            <div class="opts-control">
              <input type="range" :value="settings.fov" min="60" max="100" @input="onNum('fov', $event)">
              <span>{{ settings.fov }}°</span>
            </div>
          </div>
          <div class="opts-row opts-row--toggle">
            <div class="opts-meta">
              <label for="set-invert">飞行反转 Y 轴</label>
              <p>飞船模式下上下视角与鼠标/触控方向相反。</p>
            </div>
            <div class="opts-control">
              <label class="opts-switch">
                <input id="set-invert" type="checkbox" :checked="settings.invert" @change="onBool('invert', $event)">
                <span class="opts-switch-ui" aria-hidden="true"></span>
                <span class="opts-switch-txt">{{ settings.invert ? '开启' : '关闭' }}</span>
              </label>
            </div>
          </div>
          <div class="opts-row opts-row--toggle">
            <div class="opts-meta">
              <label for="set-crosshair">显示准星</label>
              <p>步行模式下的采集准星与热度/喷气条。</p>
            </div>
            <div class="opts-control">
              <label class="opts-switch">
                <input id="set-crosshair" type="checkbox" :checked="settings.showCrosshair" @change="onBool('showCrosshair', $event)">
                <span class="opts-switch-ui" aria-hidden="true"></span>
                <span class="opts-switch-txt">{{ settings.showCrosshair ? '开启' : '关闭' }}</span>
              </label>
            </div>
          </div>
        </section>

        <section v-show="tab === 'graphics'" class="opts-pane" role="tabpanel">
          <div class="opts-row">
            <div class="opts-meta">
              <label>渲染距离</label>
              <p>可见区块半径。更高更远，但更耗性能。</p>
            </div>
            <div class="opts-control">
              <select :value="settings.dist" @change="onNum('dist', $event)">
                <option value="3">近 · 流畅</option>
                <option value="4">中 · 推荐</option>
                <option value="5">远</option>
                <option value="6">极远 · 高配</option>
              </select>
              <span>{{ distLabel }}</span>
            </div>
          </div>
          <div class="opts-row opts-row--toggle">
            <div class="opts-meta">
              <label for="set-postfx">电影级后处理</label>
              <p>环境光遮蔽、辉光与景深等。关闭可提升帧率。</p>
            </div>
            <div class="opts-control">
              <label class="opts-switch">
                <input id="set-postfx" type="checkbox" :checked="settings.postFx" @change="onBool('postFx', $event)">
                <span class="opts-switch-ui" aria-hidden="true"></span>
                <span class="opts-switch-txt">{{ settings.postFx ? '开启' : '关闭' }}</span>
              </label>
            </div>
          </div>
          <div class="opts-row opts-row--toggle">
            <div class="opts-meta">
              <label for="set-gpumesh">GPU 驱动网格</label>
              <p>实验性：用 GPU 构建区块网格。切换后会重建已加载区块。</p>
            </div>
            <div class="opts-control">
              <label class="opts-switch">
                <input id="set-gpumesh" type="checkbox" :checked="settings.gpuMesh" @change="onBool('gpuMesh', $event)">
                <span class="opts-switch-ui" aria-hidden="true"></span>
                <span class="opts-switch-txt">{{ settings.gpuMesh ? '开启' : '关闭' }}</span>
              </label>
            </div>
          </div>
          <div class="opts-row opts-row--toggle">
            <div class="opts-meta">
              <label for="set-fps">显示帧率</label>
              <p>在 HUD 右上角显示实时 FPS，便于调优画质。</p>
            </div>
            <div class="opts-control">
              <label class="opts-switch">
                <input id="set-fps" type="checkbox" :checked="settings.showFps" @change="onBool('showFps', $event)">
                <span class="opts-switch-ui" aria-hidden="true"></span>
                <span class="opts-switch-txt">{{ settings.showFps ? '开启' : '关闭' }}</span>
              </label>
            </div>
          </div>
          <div class="opts-hint">性能建议：移动设备或卡顿时可先关后处理，再降渲染距离。</div>
        </section>

        <section v-show="tab === 'system'" class="opts-pane" role="tabpanel">
          <div class="opts-row opts-row--toggle">
            <div class="opts-meta">
              <label for="set-autosave">自动存档</label>
              <p>单机探索时按间隔写入本地 OPFS。联机模式不会写本地档。</p>
            </div>
            <div class="opts-control">
              <label class="opts-switch">
                <input id="set-autosave" type="checkbox" :checked="settings.autoSave" @change="onBool('autoSave', $event)">
                <span class="opts-switch-ui" aria-hidden="true"></span>
                <span class="opts-switch-txt">{{ settings.autoSave ? '开启' : '关闭' }}</span>
              </label>
            </div>
          </div>
          <div class="opts-row" :class="{ 'opts-row--disabled': !settings.autoSave }">
            <div class="opts-meta">
              <label>自动存档间隔</label>
              <p>两次自动存档之间的秒数。</p>
            </div>
            <div class="opts-control">
              <input
                type="range"
                :value="settings.autoSaveSec"
                min="30"
                max="300"
                step="15"
                :disabled="!settings.autoSave"
                @input="onNum('autoSaveSec', $event)"
              >
              <span>{{ settings.autoSaveSec }}s</span>
            </div>
          </div>

          <div class="opts-card">
            <div class="opts-card-title">数据管理</div>
            <p class="opts-card-desc">恢复默认仅影响本机设置；清除存档会删除全部本地进度槽。</p>
            <div class="opts-card-actions">
              <button type="button" class="btn sm" @click="resetDefaults">恢复默认设置</button>
              <button type="button" class="btn sm danger" @click="requestWipe">
                {{ wipeArmed ? '再次确认清除存档' : '清除全部存档' }}
              </button>
            </div>
            <p v-if="wipeArmed" class="opts-warn" role="status">将删除全部本地存档槽，此操作不可撤销。再点一次执行。</p>
            <p v-if="statusMsg" class="opts-status" role="status">{{ statusMsg }}</p>
          </div>

          <div class="opts-card opts-card--soft">
            <div class="opts-card-title">关于本机</div>
            <ul class="opts-facts">
              <li><span>存档位置</span><em>浏览器 OPFS · 最多 10 槽</em></li>
              <li><span>设置存储</span><em>localStorage</em></li>
              <li><span>渲染后端</span><em>WebGPU · Three.js r185</em></li>
              <li><span>联机权威</span><em>官方 DO / 房主本机</em></li>
            </ul>
          </div>
        </section>
      </div>

      <footer class="opts-foot">
        <span class="opts-foot-hint">设置已自动保存</span>
        <button type="button" class="btn sm primary" @click="$emit('back')">完成</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { getActiveGame } from '../runtime/game-runtime';
import { DEFAULT_SETTINGS } from '../config';
import { Save } from '../save';
import type { Settings } from '../types';

const emit = defineEmits<{ back: []; wipe: [] }>();

const game = useGameStore();
const settings = game.settings;

const tabs = [
  { id: 'audio', label: '音频', en: 'AUDIO' },
  { id: 'controls', label: '操控', en: 'CONTROLS' },
  { id: 'graphics', label: '画面', en: 'GRAPHICS' },
  { id: 'system', label: '系统', en: 'SYSTEM' },
] as const;

type TabId = (typeof tabs)[number]['id'];
const tab = ref<TabId>('audio');
const wipeArmed = ref(false);
const statusMsg = ref('');
let wipeTimer: ReturnType<typeof setTimeout> | undefined;
let statusTimer: ReturnType<typeof setTimeout> | undefined;

const distLabel = computed(() => {
  const map: Record<number, string> = { 3: '近', 4: '中', 5: '远', 6: '极远' };
  return map[settings.dist] || String(settings.dist);
});

function persist(): void {
  const engine = getActiveGame();
  if (engine) {
    Object.assign(engine.settings, settings);
    engine.applySettings();
    Save.saveSettings(engine.settings);
  } else {
    Save.saveSettings({ ...settings });
  }
}

function update<K extends keyof Settings>(key: K, value: Settings[K]): void {
  settings[key] = value;
  persist();
}

function onNum(key: keyof Settings, e: Event): void {
  const el = e.target as HTMLInputElement | HTMLSelectElement;
  let n = +el.value;
  if (key === 'autoSaveSec') n = Math.max(30, Math.min(300, n));
  if (key === 'dist') n = Math.max(3, Math.min(6, n));
  update(key, n as Settings[typeof key]);
}

function onBool(key: keyof Settings, e: Event): void {
  const el = e.target as HTMLInputElement;
  update(key, el.checked as Settings[typeof key]);
}

function muteAll(): void {
  update('master', 0);
  flash('已静音');
}

function restoreAudio(): void {
  update('master', DEFAULT_SETTINGS.master);
  update('music', DEFAULT_SETTINGS.music);
  update('sfx', DEFAULT_SETTINGS.sfx);
  flash('已恢复推荐音量');
}

function resetDefaults(): void {
  Object.assign(settings, { ...DEFAULT_SETTINGS });
  persist();
  wipeArmed.value = false;
  flash('已恢复默认设置');
}

function requestWipe(): void {
  if (!wipeArmed.value) {
    wipeArmed.value = true;
    if (wipeTimer) clearTimeout(wipeTimer);
    wipeTimer = setTimeout(() => { wipeArmed.value = false; }, 4000);
    return;
  }
  wipeArmed.value = false;
  emit('wipe');
}

function flash(msg: string): void {
  statusMsg.value = msg;
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { statusMsg.value = ''; }, 2400);
}

onBeforeUnmount(() => {
  if (wipeTimer) clearTimeout(wipeTimer);
  if (statusTimer) clearTimeout(statusTimer);
});
</script>
