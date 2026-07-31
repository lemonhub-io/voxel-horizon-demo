<template>
  <div id="help-screen" class="screen opts-screen" style="z-index:200">
    <div class="opts-frame panel help-frame">
      <header class="opts-head">
        <div>
          <div class="p-kicker">操作手册 // MANUAL</div>
          <p class="opts-lead">远征者生存、探索、飞船与联机指南。可按分类浏览，或搜索关键词。</p>
        </div>
        <button type="button" class="btn sm" @click="$emit('back')">返回</button>
      </header>

      <div class="help-toolbar">
        <input
          v-model="query"
          class="help-search"
          type="search"
          placeholder="搜索：采集、跃迁、联机…"
          maxlength="32"
          autocomplete="off"
        >
        <span v-if="query" class="help-search-meta">{{ filteredCount }} 条匹配</span>
      </div>

      <nav class="opts-tabs" role="tablist" aria-label="手册分类">
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

      <div class="opts-body help-body">
        <!-- 键鼠 -->
        <section v-show="tab === 'keys'" class="opts-pane" role="tabpanel">
          <div class="help-section-title">基础操作</div>
          <div class="help-bind-grid">
            <div v-for="b in filterBinds(keyBinds)" :key="b.keys + b.action" class="help-bind">
              <div class="help-bind-keys">
                <span v-for="k in b.keys" :key="k" class="kbd">{{ k }}</span>
              </div>
              <div class="help-bind-text">
                <strong>{{ b.action }}</strong>
                <p v-if="b.note">{{ b.note }}</p>
              </div>
            </div>
          </div>
          <div class="help-section-title">飞行模式</div>
          <div class="help-bind-grid">
            <div v-for="b in filterBinds(flightBinds)" :key="b.keys + b.action" class="help-bind">
              <div class="help-bind-keys">
                <span v-for="k in b.keys" :key="k" class="kbd">{{ k }}</span>
              </div>
              <div class="help-bind-text">
                <strong>{{ b.action }}</strong>
                <p v-if="b.note">{{ b.note }}</p>
              </div>
            </div>
          </div>
          <p v-if="query && filterBinds(keyBinds).length + filterBinds(flightBinds).length === 0" class="help-empty">无匹配键位</p>
        </section>

        <!-- 触控 -->
        <section v-show="tab === 'touch'" class="opts-pane" role="tabpanel">
          <div class="help-section-title">触控布局</div>
          <div class="help-bind-grid">
            <div v-for="b in filterBinds(touchBinds)" :key="b.keys + b.action" class="help-bind">
              <div class="help-bind-keys">
                <span v-for="k in b.keys" :key="k" class="kbd">{{ k }}</span>
              </div>
              <div class="help-bind-text">
                <strong>{{ b.action }}</strong>
                <p v-if="b.note">{{ b.note }}</p>
              </div>
            </div>
          </div>
          <div class="help-callout">
            双击左侧摇杆可切换冲刺。右侧区域：短点放置/交互，长按激光采集。飞行时右侧功能键切换为加力、降落与跃迁。
          </div>
        </section>

        <!-- 生存 -->
        <section v-show="tab === 'survive'" class="opts-pane" role="tabpanel">
          <div class="help-cards">
            <article v-for="c in filterCards(surviveCards)" :key="c.title" class="help-card">
              <h3>{{ c.title }}</h3>
              <p>{{ c.body }}</p>
              <ul v-if="c.bullets?.length">
                <li v-for="(line, i) in c.bullets" :key="i">{{ line }}</li>
              </ul>
            </article>
          </div>
          <div class="help-flow">
            <div class="help-flow-title">推荐起步顺序</div>
            <ol class="help-steps">
              <li v-for="(s, i) in startSteps" :key="i">{{ s }}</li>
            </ol>
          </div>
        </section>

        <!-- 探索 -->
        <section v-show="tab === 'explore'" class="opts-pane" role="tabpanel">
          <div class="help-cards">
            <article v-for="c in filterCards(exploreCards)" :key="c.title" class="help-card">
              <h3>{{ c.title }}</h3>
              <p>{{ c.body }}</p>
              <ul v-if="c.bullets?.length">
                <li v-for="(line, i) in c.bullets" :key="i">{{ line }}</li>
              </ul>
            </article>
          </div>
        </section>

        <!-- 飞船 -->
        <section v-show="tab === 'ship'" class="opts-pane" role="tabpanel">
          <div class="help-cards">
            <article v-for="c in filterCards(shipCards)" :key="c.title" class="help-card">
              <h3>{{ c.title }}</h3>
              <p>{{ c.body }}</p>
              <ul v-if="c.bullets?.length">
                <li v-for="(line, i) in c.bullets" :key="i">{{ line }}</li>
              </ul>
            </article>
          </div>
        </section>

        <!-- 联机 -->
        <section v-show="tab === 'mp'" class="opts-pane" role="tabpanel">
          <div class="help-cards">
            <article v-for="c in filterCards(mpCards)" :key="c.title" class="help-card">
              <h3>{{ c.title }}</h3>
              <p>{{ c.body }}</p>
              <ul v-if="c.bullets?.length">
                <li v-for="(line, i) in c.bullets" :key="i">{{ line }}</li>
              </ul>
            </article>
          </div>
        </section>

        <!-- 资源与合成 -->
        <section v-show="tab === 'craft'" class="opts-pane" role="tabpanel">
          <div class="help-cards">
            <article v-for="c in filterCards(craftCards)" :key="c.title" class="help-card">
              <h3>{{ c.title }}</h3>
              <p>{{ c.body }}</p>
              <ul v-if="c.bullets?.length">
                <li v-for="(line, i) in c.bullets" :key="i">{{ line }}</li>
              </ul>
            </article>
          </div>
          <div class="help-section-title">常见资源</div>
          <div class="help-res-grid">
            <div v-for="r in filterRes(resources)" :key="r.name" class="help-res">
              <strong>{{ r.name }}</strong>
              <span>{{ r.use }}</span>
              <em>{{ r.where }}</em>
            </div>
          </div>
        </section>
      </div>

      <footer class="opts-foot">
        <span class="opts-foot-hint">Esc / 返回 关闭手册</span>
        <button type="button" class="btn sm primary" @click="$emit('back')">完成</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';

defineEmits(['back']);

interface BindRow {
  keys: string[];
  action: string;
  note?: string;
}

interface HelpCard {
  title: string;
  body: string;
  bullets?: string[];
}

interface ResRow {
  name: string;
  use: string;
  where: string;
}

const isTouch =
  typeof document !== 'undefined' && document.body.classList.contains('touch-device');

const tabs = [
  { id: 'keys', label: '键鼠', en: 'KEYS' },
  { id: 'touch', label: '触控', en: 'TOUCH' },
  { id: 'survive', label: '生存', en: 'SURVIVE' },
  { id: 'explore', label: '探索', en: 'EXPLORE' },
  { id: 'ship', label: '飞船', en: 'SHIP' },
  { id: 'craft', label: '资源', en: 'CRAFT' },
  { id: 'mp', label: '联机', en: 'ONLINE' },
] as const;

type TabId = (typeof tabs)[number]['id'];
const tab = ref<TabId>(isTouch ? 'touch' : 'keys');
const query = ref('');

const keyBinds: BindRow[] = [
  { keys: ['W', 'A', 'S', 'D'], action: '移动', note: '相对视角方向行走' },
  { keys: ['Shift'], action: '冲刺', note: '消耗体力节奏更快' },
  { keys: ['空格'], action: '跳跃 / 喷气', note: '按住启用喷气背包' },
  { keys: ['鼠标左键'], action: '激光采集 / 攻击' },
  { keys: ['鼠标右键'], action: '放置方块 / 使用物品' },
  { keys: ['1–9', '滚轮'], action: '切换快捷栏' },
  { keys: ['E'], action: '交互 / 进入飞船' },
  { keys: ['Tab'], action: '背包 · 合成 · 发现' },
  { keys: ['C'], action: '扫描脉冲', note: '短时标记附近资源' },
  { keys: ['F'], action: '分析目镜', note: '扫描生物与植物获得记录点数' },
  { keys: ['Z'], action: '补充生命维持', note: '消耗氧气' },
  { keys: ['X'], action: '补充危险防护', note: '消耗钠' },
  { keys: ['T'], action: '手电' },
  { keys: ['Esc'], action: '暂停菜单' },
];

const flightBinds: BindRow[] = [
  { keys: ['鼠标'], action: '转向' },
  { keys: ['W', 'S'], action: '油门加减' },
  { keys: ['空格'], action: '加力推进' },
  { keys: ['E'], action: '降落', note: '接近地面时着陆' },
  { keys: ['J'], action: '超光速跃迁', note: '需要跃迁电池' },
];

const touchBinds: BindRow[] = [
  { keys: ['左侧摇杆'], action: '移动' },
  { keys: ['双击摇杆'], action: '切换冲刺' },
  { keys: ['跳跃键'], action: '跳跃 / 喷气', note: '按住喷气' },
  { keys: ['右侧拖拽'], action: '旋转视角' },
  { keys: ['长按右侧'], action: '激光采集 / 攻击' },
  { keys: ['轻点右侧'], action: '放置 / 进飞船' },
  { keys: ['扫描'], action: '扫描脉冲' },
  { keys: ['目镜'], action: '分析目镜' },
  { keys: ['背包'], action: '物品 · 合成 · 发现' },
  { keys: ['暂停'], action: '菜单' },
  { keys: ['跃迁'], action: '飞行跃迁', note: '需跃迁电池' },
];

const surviveCards: HelpCard[] = [
  {
    title: '生命维持与危险防护',
    body: '生命维持（氧气）与危险防护（环境抗性）会随时间与环境消耗。耗尽时会持续掉血。',
    bullets: [
      'Z 消耗氧补充生命维持；X 消耗钠补充防护',
      '红色呼吸花 → 氧；黄色荧光植物 → 钠',
      '风暴与极端气候会加速防护消耗',
    ],
  },
  {
    title: '庇护与环境',
    body: '站在庇护结构附近可减缓环境压力。夜间与风暴更危险，注意回血与补给。',
    bullets: ['建造简易掩体可创造安全区', '水中行动会受阻并改变视野', '手电在洞穴与夜间很有用'],
  },
  {
    title: '死亡与重生',
    body: '生命归零后可在死亡界面重新苏醒。物品保留；尽快补齐氧与钠再出发。',
  },
];

const exploreCards: HelpCard[] = [
  {
    title: '扫描与标记',
    body: 'C 键扫描脉冲可短暂标出附近资源点；地图边缘菱形标记指示方向与距离。',
  },
  {
    title: '分析目镜',
    body: 'F 打开目镜，对准生物/植物并按住左键完成分析，获得记录点数与发现条目。',
    bullets: ['已分析物种可在背包「发现」页查看', '不同星球生态不同，值得多跃迁'],
  },
  {
    title: '任务系统',
    body: '左上角任务卡会引导采集、建造、分析与跃迁等目标。完成可推进旅程。',
  },
  {
    title: '里程碑',
    body: '行走、采集、建造、跃迁等行为累积里程碑等级，会弹出成就提示。',
  },
];

const shipCards: HelpCard[] = [
  {
    title: '修复「拂晓之羽」',
    body: '坠毁后推进器与脉冲引擎通常受损。靠近飞船按 E 打开面板查看需求。',
    bullets: [
      '金属镀层等材料可修复推进器',
      '碳纳米管等材料可修复脉冲引擎',
      '全部在线后才能起飞',
    ],
  },
  {
    title: '燃料与起飞',
    body: '启动燃料由双氢等资源合成。加注至足够后选择「登舰起飞」。',
  },
  {
    title: '跃迁新星球',
    body: '飞行中按 J（或触控跃迁）消耗跃迁电池，进入超光速并抵达新行星。',
    bullets: ['跃迁电池在合成台制作', '每次跃迁都会生成新的气候与生态'],
  },
];

const craftCards: HelpCard[] = [
  {
    title: '背包与合成',
    body: 'Tab 打开背包。合成页显示配方与材料是否足够；可从详情直接使用补给品。',
  },
  {
    title: '建造',
    body: '将可放置物放在快捷栏，右键放置。庇护所与平台是站稳脚跟的关键。',
  },
  {
    title: '记录点数',
    body: '分析与探索获得的记录点数体现在 HUD 右上角，用于衡量发现进度。',
  },
];

const mpCards: HelpCard[] = [
  {
    title: '官方星域',
    body: '云端 Durable Object 裁决方块修改，地图编辑异步归档到 R2，可随时重连恢复。',
  },
  {
    title: '公开联机',
    body: '由房主浏览器托管世界权威，云端仅负责房间列表与中继。房主离线则会话结束。',
    bullets: [
      '单机中暂停菜单可「开放联机」',
      '公开联机不写本地游戏存档',
      '请先在本机设定旅行者昵称',
    ],
  },
  {
    title: '礼仪与同步',
    body: '其他玩家以远程角色显示。大规模改建时留意延迟；重要进度建议单机另存。',
  },
];

const startSteps = [
  '采集钠（黄植）补充防护，采集氧（红花）维持生命',
  '开采岩石获取铁尘，校准工具并开始基础合成',
  '合成修复材料，修好飞船推进器与脉冲引擎',
  '合成启动燃料并起飞，再建庇护所巩固据点',
  '扫描生物、合成跃迁电池，跃迁探索新星球',
];

const resources: ResRow[] = [
  { name: '钠', use: '危险防护', where: '黄色荧光植物' },
  { name: '氧', use: '生命维持', where: '红色呼吸花' },
  { name: '铁尘 / 铁', use: '工具与镀层', where: '岩石、矿脉' },
  { name: '碳', use: '燃料与合成', where: '植物、有机矿' },
  { name: '双氢', use: '启动燃料', where: '蓝晶类资源' },
  { name: '铜', use: '电路与高级件', where: '矿脉扫描点' },
];

const q = computed(() => query.value.trim().toLowerCase());

function matchText(...parts: (string | undefined)[]): boolean {
  const needle = q.value;
  if (!needle) return true;
  return parts.some(p => (p || '').toLowerCase().includes(needle));
}

function filterBinds(list: BindRow[]): BindRow[] {
  return list.filter(b => matchText(b.action, b.note, ...b.keys));
}

function filterCards(list: HelpCard[]): HelpCard[] {
  return list.filter(c => matchText(c.title, c.body, ...(c.bullets || [])));
}

function filterRes(list: ResRow[]): ResRow[] {
  return list.filter(r => matchText(r.name, r.use, r.where));
}

const filteredCount = computed(() => {
  if (!q.value) return 0;
  return (
    filterBinds(keyBinds).length +
    filterBinds(flightBinds).length +
    filterBinds(touchBinds).length +
    filterCards(surviveCards).length +
    filterCards(exploreCards).length +
    filterCards(shipCards).length +
    filterCards(craftCards).length +
    filterCards(mpCards).length +
    filterRes(resources).length
  );
});
</script>
