#!/usr/bin/env node
// Usage: node backend/scripts/smoke.js https://betcouple.onrender.com email password
// Esegue invarianti critiche contro l'app live. Exit 0 = OK, exit 1 = FAIL.

const baseUrl  = process.argv[2];
const email    = process.argv[3];
const password = process.argv[4];
if (!baseUrl || !email || !password) {
  console.error('Usage: node smoke.js <baseUrl> <email> <password>');
  process.exit(1);
}

let pass = 0, fail = 0;
const log = (ok, name, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
  ok ? pass++ : fail++;
};

async function main() {
  // 1. Login
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!loginRes.ok) { log(false, 'login', `status ${loginRes.status}`); return; }
  const { token, user } = await loginRes.json();
  log(true, 'login');

  const auth = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  // 2. /api/state ritorna profiles non vuoto
  const stateRes = await fetch(`${baseUrl}/api/state`, { headers: auth });
  const state = await stateRes.json();
  log(Object.keys(state.profiles || {}).length >= 1, 'state.profiles non vuoto', `${Object.keys(state.profiles || {}).length} profilo/i`);
  log(typeof state.credits?.[user.id] === 'number', 'state.credits include lo user corrente', `balance: ${state.credits?.[user.id]}`);

  // 3. SECURITY: createBet con potentialWin manipolato deve essere ricalcolato
  const groupsRes = await fetch(`${baseUrl}/api/groups`, { headers: auth });
  const groups = await groupsRes.json();
  if (!groups[0]) { log(false, 'no groups'); return; }
  const gid = groups[0].id;

  const hackRes = await fetch(`${baseUrl}/api/bets?groupId=${encodeURIComponent(gid)}`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      title: 'smoke-test-hack-' + Date.now(),
      quota: 2.0,
      stake: 1,
      potentialWin: 99999,  // tentativo di manipolazione
      category: 'altro',
      isSecret: false,
      isCounterable: false,
    }),
  });
  if (hackRes.ok) {
    const newBet = await hackRes.json();
    // Refetch state e cerca la bet creata
    const newState = await fetch(`${baseUrl}/api/state?groupId=${encodeURIComponent(gid)}`, { headers: auth }).then(r => r.json());
    const created = (newState.bets || []).find(b => b.id === newBet.id);
    if (created) {
      const expectedWin = Math.round(created.stake * created.quota);
      log(created.potentialWin === expectedWin, 'bet.potentialWin server-recomputed', `got ${created.potentialWin}, expected ${expectedWin}`);
      // cleanup: cancella la bet di test (window 60s)
      await fetch(`${baseUrl}/api/bets/${created.id}?groupId=${encodeURIComponent(gid)}`, { method: 'DELETE', headers: auth });
    } else {
      log(false, 'bet creata non trovata in state');
    }
  } else {
    log(false, 'createBet hack', `status ${hackRes.status}`);
  }

  // 4. /api/auth/me funziona
  const meRes = await fetch(`${baseUrl}/api/auth/me`, { headers: auth });
  log(meRes.ok && (await meRes.json()).id === user.id, '/api/auth/me ok');

  // 5. resolveActiveRoom: chiamata a /api/bets senza groupId in query non rompe
  const noGidRes = await fetch(`${baseUrl}/api/bets/nonexistent/comment`, {
    method: 'PATCH', headers: auth, body: JSON.stringify({ comment: 'x' })
  });
  log(noGidRes.status !== 500, 'route con resolveActiveRoom non 500 senza groupId');

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
