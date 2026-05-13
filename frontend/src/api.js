const BASE = '/api';

const getToken = () => localStorage.getItem('bc_token');
export const getActiveGroupId = () => {
  const raw = localStorage.getItem('bc_active_group');
  if (raw == null) return null;
  try { return JSON.parse(raw); } catch { return raw; }
};
export const setActiveGroupId = (id) => id
  ? localStorage.setItem('bc_active_group', JSON.stringify(id))
  : localStorage.removeItem('bc_active_group');

function withGroupId(path) {
  const gid = getActiveGroupId();
  if (!gid) return path;
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}groupId=${encodeURIComponent(gid)}`;
}

async function req(method, path, body, opts = {}) {
  const token = opts.token ?? getToken();
  const r = await fetch(BASE + withGroupId(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw Object.assign(new Error(err.error || `${method} ${path} → ${r.status}`), { status: r.status, data: err });
  }
  return r.json();
}

// Auth
export const register        = d           => req('POST',  '/auth/register', d);
export const login           = (email, pw) => req('POST',  '/auth/login', { email, password: pw });
export const joinRoom        = code        => req('POST',  '/auth/join', { code });
export const getMe           = ()          => req('GET',   '/auth/me');
export const updateProfile   = d           => req('PATCH', '/auth/profile', d);
export const forgotPassword  = email       => req('POST',  '/auth/forgot-password', { email });
export const resetPassword   = (token, password) => req('POST', '/auth/reset-password', { token, password });

// State
export const fetchState     = ()             => req('GET',    '/state');

// Groups
export const getMyGroups    = ()             => req('GET',    '/groups');
export const getGroupMembers = (id)          => req('GET',    `/groups/${id}/members`);
export const createGroup    = (data)         => req('POST',   '/groups', data);
export const renameGroup    = (id, data)     => req('PATCH',  `/groups/${id}`, data);
export const joinGroup      = (code)         => req('POST',   '/groups/join', { code });
export const leaveGroup          = (groupId)         => req('DELETE', `/groups/${groupId}/leave`);
export const deleteGroup         = (groupId)         => req('DELETE', `/groups/${groupId}`);
export const kickMember          = (groupId, userId) => req('DELETE', `/groups/${groupId}/members/${userId}`);
export const regenerateCode      = (groupId)         => req('POST',   `/groups/${groupId}/regenerate-code`);
export const promoteMember       = (groupId, userId) => req('PATCH',  `/groups/${groupId}/members/${userId}/promote`);
export const setMemberRole       = (groupId, userId, role)        => req('PATCH', `/groups/${groupId}/members/${userId}/role`, { role });
export const setMemberPermissions = (groupId, userId, permissions) => req('PATCH', `/groups/${groupId}/members/${userId}/permissions`, { permissions });
export const updateGroupSettings = (groupId, data)   => req('PATCH',  `/groups/${groupId}/settings`, data);
export const inviteFriend        = (groupId, userId) => req('POST',   `/groups/${groupId}/invite-member`, { userId });

// Friends (explicit friendships)
export const getFriends         = ()             => req('GET',    '/friends');
export const getFriendRequests  = ()             => req('GET',    '/friends/requests');
export const getFriendDiscover  = ()             => req('GET',    '/friends/discover');
export const sendFriendRequest  = (userId)       => req('POST',   '/friends/request', { userId });
export const respondFriendReq   = (userId, accept) => req('POST', '/friends/respond', { userId, accept });
export const cancelFriendReq    = (userId)       => req('POST',   '/friends/cancel', { userId });
export const removeFriend       = (userId)       => req('DELETE', `/friends/${userId}`);
export const getFriendsLeaderboard = ()          => req('GET',    '/friends/leaderboard');
export const getFriendProfile   = (userId)       => req('GET',    `/friends/${userId}/profile`);

// Bets
export const createBet      = (data)         => req('POST',   '/bets', data);
export const resolveBet     = (id, outcome, opts = {}) => req('PATCH',  `/bets/${id}/resolve`, { outcome, ...opts });
export const withdrawResolve= (id)           => req('POST',   `/bets/${id}/withdraw-resolve`);
export const counterBet     = (betId, cb)    => req('POST',   `/bets/${betId}/counter`, cb);
export const flameBet       = (id)           => req('PATCH',  `/bets/${id}/flame`);
export const createCategory = (cat)          => req('POST',   '/categories', cat);
export const deleteCategory = (id)           => req('DELETE', `/categories/${id}`);
export const deltaCredits   = (user, delta)  => req('PATCH',  `/credits/${user}`, { delta });

export const cancelBet      = (id)           => req('DELETE', `/bets/${id}`);
export const acceptBet      = (id, body={})   => req('POST',   `/bets/${id}/accept`, body);
export const rejectBet      = (id)           => req('POST',   `/bets/${id}/reject`);
export const editBet        = (id, data)     => req('PATCH',  `/bets/${id}/edit`, data);
export const editAllowed    = (id, ids)      => req('PATCH',  `/bets/${id}/allowed-members`, { ids });
export const resetAll       = ()             => req('POST',   '/bets/reset');
export const resetAllTest   = ()             => req('POST',   '/bets/test-reset');
export const commentBet     = (id, comment)  => req('PATCH',  `/bets/${id}/comment`, { comment });
export const addReaction         = (id, emoji)   => req('POST',   `/bets/${id}/reaction`,         { emoji });
export const addReactionPhoto    = (id, dataUrl) => req('POST',   `/bets/${id}/reaction/photo`,   { dataUrl });
// Toggle-off helpers — clear only the column the user touched. The legacy
// `removeReaction` is kept for older clients but the UI now uses these.
export const removeReactionEmoji = (id)          => req('DELETE', `/bets/${id}/reaction/emoji`);
export const removeReactionPhoto = (id)          => req('DELETE', `/bets/${id}/reaction/photo`);
export const removeReaction      = (id, bettor)  => req('DELETE', `/bets/${id}/reaction/${bettor}`);

export const getNotifPrefs  = (user)        => req('GET',  `/push/prefs/${user}`);
export const saveNotifPrefs = (prefs)       => req('POST', '/push/prefs', prefs);

// Admin (super-user) — backed by /api/admin/*, gated on is_admin in JWT.
export const adminUsers          = ()                       => req('GET',  '/admin/users');
export const adminUserByEmail    = (email)                  => req('GET',  `/admin/users/by-email/${encodeURIComponent(email)}`);
export const adminIntegrity      = ()                       => req('GET',  '/admin/integrity');
export const adminGroups         = ()                       => req('GET',  '/admin/groups');
export const adminDeleteUser     = (id)                     => req('DELETE', `/admin/users/${id}`);
export const adminClearLegacy    = (id)                     => req('PATCH', `/admin/users/${id}/clear-legacy-room`);
export const adminAddToGroup     = (groupId, userId)        => req('POST',  `/admin/groups/${groupId}/add-member`, { userId });
export const adminRemoveFromGroup= (groupId, userId)        => req('DELETE', `/admin/groups/${groupId}/members/${userId}`);
export const adminRegenCode      = (groupId)                => req('POST',  `/admin/groups/${groupId}/regenerate-code`);
export const adminSetPassword    = (userId, password)       => req('POST',  `/admin/users/${userId}/set-password`, { password });
export const adminNukeStatus     = ()                       => req('GET',  '/admin/nuke-status');
export const adminNuke           = ()                       => req('POST', '/admin/nuke', { confirm: 'NUKE' });

export const getAchievements = ()           => req('GET',  '/achievements');
export const unlockSecretAchievement = (id) => req('POST', `/achievements/secret/${id}/unlock`);
export const resetMyAchievements = ()       => req('DELETE', '/achievements/mine');

// Comment thread under a bet — everyone in the room can read & post.
export const getBetMessages   = (betId)         => req('GET',    `/bets/${betId}/messages`);
export const postBetMessage   = (betId, body)   => req('POST',   `/bets/${betId}/messages`, { body });
export const deleteBetMessage = (betId, msgId)  => req('DELETE', `/bets/${betId}/messages/${msgId}`);

export const listTemplates   = ()           => req('GET',    '/templates');
export const createTemplate  = (data)       => req('POST',   '/templates', data);
export const updateTemplate  = (id, data)   => req('PATCH',  `/templates/${id}`, data);
export const deleteTemplate  = (id)         => req('DELETE', `/templates/${id}`);

// Avatar image upload (dataUrl = "data:image/jpeg;base64,..."). Optional token override
// for the one-shot call right after register (token not yet in localStorage).
export const uploadAvatar = (dataUrl, opts) => req('POST',   '/auth/avatar', { dataUrl }, opts);
export const deleteAvatar = ()              => req('DELETE', '/auth/avatar');
