const OFFICIAL_PROFILE_KEY = 'voxelhorizon_official_profile_v1';
const PLAYER_NICKNAME_KEY = 'voxelhorizon_player_nickname_v1';
const PROFILE_ID_RE = /^[a-f0-9-]{16,64}$/i;
let sessionNickname: string | null = null;

function newProfileId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

/**
 * Stable anonymous identity for the official server. It is intentionally not
 * shown to other players and is only used to locate this browser's R2 profile.
 */
export function getOfficialProfileId(): string {
  try {
    const existing = localStorage.getItem(OFFICIAL_PROFILE_KEY);
    if (existing && PROFILE_ID_RE.test(existing)) return existing;
    const id = newProfileId();
    localStorage.setItem(OFFICIAL_PROFILE_KEY, id);
    return id;
  } catch {
    // Private-mode storage can fail; the current session still gets an ID.
    return newProfileId();
  }
}

/** Return a normalized nickname or null when it is missing/invalid. */
export function normalizePlayerNickname(value: string): string | null {
  const nickname = value.trim().replace(/\s+/g, ' ');
  const length = Array.from(nickname).length;
  const hasControl = Array.from(nickname).some((char) => {
    const code = char.charCodeAt(0);
    return code < 32 || code === 127;
  });
  if (length < 2 || length > 16 || hasControl) return null;
  return nickname;
}

export function getPlayerNickname(): string | null {
  try {
    const stored = localStorage.getItem(PLAYER_NICKNAME_KEY);
    const nickname = stored ? normalizePlayerNickname(stored) : null;
    return nickname || sessionNickname;
  } catch {
    return sessionNickname;
  }
}

/** Persist a validated nickname, falling back to the current browser session. */
export function savePlayerNickname(value: string): boolean {
  const nickname = normalizePlayerNickname(value);
  if (!nickname) return false;
  sessionNickname = nickname;
  try {
    localStorage.setItem(PLAYER_NICKNAME_KEY, nickname);
  } catch {
    // Private-mode storage can fail; sessionNickname still unblocks this visit.
  }
  return true;
}
