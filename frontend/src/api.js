const BASE = '/api';

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}`);
  return res.json();
}

export const fetchState     = ()             => req('GET',    '/state');
export const createBet      = (data)         => req('POST',   '/bets', data);
export const resolveBet     = (id, outcome)  => req('PATCH',  `/bets/${id}/resolve`, { outcome });
export const counterBet     = (betId, cb)    => req('POST',   `/bets/${betId}/counter`, cb);
export const flameBet       = (id)           => req('PATCH',  `/bets/${id}/flame`);
export const updateProfile  = (user, data)   => req('PUT',    `/profiles/${user}`, data);
export const resetCredits   = (amounts)      => req('PUT',    '/credits', amounts);
export const createCategory = (cat)          => req('POST',   '/categories', cat);
export const deleteCategory = (id)           => req('DELETE', `/categories/${id}`);

export const setAccountPin    = (user, pin)        => req('POST',   `/profiles/${user}/pin`, { pin });
export const verifyAccountPin = (user, pin)        => req('POST',   `/profiles/${user}/pin/verify`, { pin });
export const removeAccountPin = (user, currentPin) => req('DELETE', `/profiles/${user}/pin`, { currentPin });

export const deltaCredits = (user, delta) => req('PATCH', `/credits/${user}`, { delta });

export const commentBet     = (id, comment)         => req('PATCH',  `/bets/${id}/comment`, { comment });
export const addReaction    = (id, bettor, emoji)    => req('POST',   `/bets/${id}/reaction`, { bettor, emoji });
export const removeReaction = (id, bettor)           => req('DELETE', `/bets/${id}/reaction/${bettor}`);
