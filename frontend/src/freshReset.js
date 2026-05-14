// Shared "fresh account" helpers. The admin "full reset" wipes server-side
// trophies AND bumps users.fresh_reset_at, which the client uses as a signal
// to wipe per-device LS flags so the onboarding tour + secret-trophy easter
// eggs replay from scratch on the target's next /me load.

export const FRESH_ACCOUNT_LS_KEYS = [
  'bc_egg_dice_popped_v2', 'bc_egg_dice_rolled',
  'bc_egg_coin_popped_v2', 'bc_egg_coin_flipped',
  'bc_egg_ice_popped_v2',
  'bc_egg_phoenix_popped_v2',
  'bc_egg_streak_tip_shown',
  'bc_onboarding_done',
  'bc_settings_intro_seen',
];

const ACK_KEY = 'bc_fresh_reset_ack';

export function wipeFreshAccountFlags() {
  for (const k of FRESH_ACCOUNT_LS_KEYS) {
    try { localStorage.removeItem(k); } catch {}
  }
}

// Returns true if the user's server-side fresh_reset_at is newer than the
// locally-acknowledged value. Wipes the LS flags and stores the new ack so
// each bump fires exactly once per device.
export function applyFreshResetIfNeeded(user) {
  const serverAt = Number(user?.fresh_reset_at || 0);
  if (!serverAt) return false;
  let ack = 0;
  try { ack = Number(localStorage.getItem(ACK_KEY) || 0); } catch {}
  if (serverAt <= ack) return false;
  wipeFreshAccountFlags();
  try { localStorage.setItem(ACK_KEY, String(serverAt)); } catch {}
  return true;
}
