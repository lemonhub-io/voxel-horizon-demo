<template>
  <div id="ship-screen" class="screen">
    <div class="ship-frame panel">
      <div class="ship-head"><span>星舰 · 「拂晓之羽」</span><em>STARSHIP SYSTEMS</em><div class="inv-close" @click="$emit('close')">Esc 关闭</div></div>
      <div id="ship-comps">
        <div v-for="(c, key) in ship.comps" :key="key" class="comp-card" :class="c.broken ? 'broken' : 'ok'">
          <div class="cc-name">{{ c.name }}</div>
          <div class="cc-status">{{ c.broken ? '● 受损 // DAMAGED' : '● 在线 // ONLINE' }}</div>
          <div class="cc-req">
            <template v-if="c.broken">
              <span v-for="([id, n], i) in c.req" :key="i" :style="{ color: inventory.count(id) >= n ? '#9be564' : '#ff5c5c' }">
                <img :src="icon(id)" style="width:18px;height:18px;vertical-align:-4px"> {{ ITEMS[id]?.name }} {{ inventory.count(id) }}/{{ n }}
              </span>
            </template>
            <template v-else>{{ c.desc }}</template>
          </div>
          <button v-if="c.broken" class="btn sm" :class="inventory.canAfford(c.req) ? 'primary' : 'disabled'" @click="$emit('repair', key)">修复</button>
        </div>
      </div>
      <div class="ship-fuel-row">
        <label>启动燃料</label>
        <div class="bar big"><div class="bar-fill fuel" :style="{ width: ship.fuel + '%' }"></div></div>
        <span>{{ Math.round(ship.fuel) }}%</span>
        <button class="btn sm" :class="{ disabled: inventory.count('launch_fuel') < 1 || ship.fuel >= 100 }" @click="$emit('refuel')">加注燃料</button>
      </div>
      <div class="ship-actions"><button class="btn primary" :class="{ disabled: !ship.canLaunch }" @click="$emit('launch')">起飞 // LAUNCH</button></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useShipStore } from '../stores/shipStore';
import { useInventoryStore } from '../stores/inventoryStore';
import { ITEMS } from '../config';

defineEmits(['close', 'repair', 'refuel', 'launch']);
const ship = useShipStore();
const inventory = useInventoryStore();
function icon(id: string) { return (window as unknown as { game: { atlas: { icon(id: string): string } } }).game?.atlas?.icon(id) || ''; }
</script>
