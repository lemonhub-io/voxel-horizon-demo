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
    expect(MP_PROTOCOL_VERSION).toBe(1);
  });

  it('rejects garbage', () => {
    expect(decodeMsg('not-json')).toBeNull();
    expect(decodeMsg('{}')).toBeNull();
  });
});
