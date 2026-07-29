import { describe, expect, it } from 'vitest';
import { animFromKey, animToKey, decodeMsg, encodeMsg, MP_PROTOCOL_VERSION } from '../../net/protocol';

describe('mp protocol', () => {
  it('round-trips pose message', () => {
    const raw = encodeMsg({
      t: 'pose',
      id: 'abc',
      seq: 3,
      x: 1,
      y: 2,
      z: 3,
      yaw: 0.1,
      pitch: -0.2,
      anim: 1,
      flags: 0,
    });
    const msg = decodeMsg(raw);
    expect(msg).toEqual({
      t: 'pose',
      id: 'abc',
      seq: 3,
      x: 1,
      y: 2,
      z: 3,
      yaw: 0.1,
      pitch: -0.2,
      anim: 1,
      flags: 0,
    });
  });

  it('maps anim keys', () => {
    expect(animFromKey('run')).toBe(2);
    expect(animToKey(2)).toBe('run');
    expect(MP_PROTOCOL_VERSION).toBe(2);
  });

  it('round-trips host state_snapshot (late-join restore)', () => {
    const raw = encodeMsg({
      t: 'state_snapshot',
      seed: 42,
      palIdx: 1,
      planetName: '泽界',
      time: 0.4,
      edits: [{ cx: 0, cz: 0, idx: 12, id: 3 }],
      players: [{ id: 'host-1', x: 1, y: 2, z: 3, yaw: 0, pitch: 0, anim: 0, flags: 0 }],
      hostId: 'host-1',
    });
    const msg = decodeMsg(raw);
    expect(msg).toMatchObject({
      t: 'state_snapshot',
      seed: 42,
      planetName: '泽界',
      hostId: 'host-1',
      edits: [{ cx: 0, cz: 0, idx: 12, id: 3 }],
    });
  });

  it('rejects garbage', () => {
    expect(decodeMsg('not-json')).toBeNull();
    expect(decodeMsg('{}')).toBeNull();
  });
});
