import { beforeEach, describe, expect, it } from 'vitest';
import {
  getOfficialProfileId,
  getPlayerNickname,
  normalizePlayerNickname,
  savePlayerNickname,
} from '../../net/official-profile';

describe('official profile identity', () => {
  beforeEach(() => localStorage.clear());

  it('creates and reuses one opaque browser profile id', () => {
    const first = getOfficialProfileId();
    expect(first).toMatch(/^[a-f0-9-]{16,64}$/i);
    expect(getOfficialProfileId()).toBe(first);
  });

  it('replaces malformed stored identifiers', () => {
    localStorage.setItem('voxelhorizon_official_profile_v1', 'not-a-profile');
    expect(getOfficialProfileId()).not.toBe('not-a-profile');
  });

  it('normalizes and persists a valid nickname', () => {
    expect(normalizePlayerNickname('  星海   旅人 ')).toBe('星海 旅人');
    expect(savePlayerNickname('星海旅人')).toBe(true);
    expect(getPlayerNickname()).toBe('星海旅人');
  });

  it('rejects blank and oversized nicknames', () => {
    expect(normalizePlayerNickname(' ')).toBeNull();
    expect(normalizePlayerNickname('一二三四五六七八九十一二三四五六七')).toBeNull();
  });
});
