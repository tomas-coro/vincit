import React, { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '../../api.js';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import { COLORS } from '../Atoms.jsx';
import { validatePassword } from '../../passwordPolicy.js';

const S = {
  card:    { background: 'var(--card)', border: '1px solid var(--brd)', borderRadius: 14, padding: 14, marginBottom: 12 },
  label:   { fontSize: 10, color: 'var(--dim)', letterSpacing: 2, textTransform: 'uppercase', fontWeight: 700 },
  small:   { fontSize: 11, color: 'var(--mut)' },
  pre:     { background: 'var(--inp)', color: 'var(--txt)', borderRadius: 8, padding: 10, fontSize: 11, fontFamily: 'monospace', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' },
  btn:     (variant) => ({
    padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
    fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
    background: variant === 'danger' ? 'var(--red)1a' : variant === 'ghost' ? 'transparent' : 'var(--gold)22',
    border: `1px solid ${variant === 'danger' ? 'var(--red)44' : variant === 'ghost' ? 'var(--brd)' : 'var(--gold)55'}`,
    color: variant === 'danger' ? 'var(--red)' : variant === 'ghost' ? 'var(--dim)' : 'var(--gold)',
  }),
};

function Avatar({ p, size = 36 }) {
  const color = COLORS[p?.colorKey || p?.color_key] || '#5b8af0';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}33`, border: `2px solid ${color}66`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.5), overflow: 'hidden', flexShrink: 0,
    }}>
      {p?.avatar_url ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/> : (p?.avatar || '?')}
    </div>
  );
}

export default function AdminView({ isDesktop }) {
  const { t }   = useLang();
  const toast   = useToast();
  const [tab, setTab] = useState('users'); // 'users' | 'groups' | 'integrity'

  // ── Shared data ──────────────────────────────────────────────────────
  const [users,     setUsers]     = useState([]);
  const [groups,    setGroups]    = useState([]);
  const [integrity, setIntegrity] = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [query,     setQuery]     = useState('');
  const [selectedId,  setSelectedId]  = useState(null);
  const [detail,      setDetail]      = useState(null);
  const [busy,        setBusy]        = useState(false);
  const [pwNew, setPwNew] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, g, i] = await Promise.all([
        api.adminUsers().catch(() => []),
        api.adminGroups().catch(() => []),
        api.adminIntegrity().catch(() => null),
      ]);
      setUsers(u); setGroups(g); setIntegrity(i);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // When a user is selected, fetch the detail by-email lookup so we get
  // groups, bets, friends in a single round-trip.
  useEffect(() => {
    if (!selectedId) { setDetail(null); return; }
    const u = users.find(x => x.id === selectedId);
    if (!u?.email) return;
    api.adminUserByEmail(u.email).then(setDetail).catch(() => setDetail(null));
  }, [selectedId, users]);

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(u =>
      (u.email || '').toLowerCase().includes(q) ||
      (u.name  || '').toLowerCase().includes(q));
  }, [users, query]);

  // ── Actions ─────────────────────────────────────────────────────────
  const wrap = (fn, okMsg) => async (...args) => {
    setBusy(true);
    try { await fn(...args); toast.success(okMsg || 'OK ✓'); refresh(); }
    catch (e) { console.error(e); toast.error(e?.message || 'errore'); }
    finally { setBusy(false); }
  };

  const deleteUser  = wrap(async id => {
    if (!window.confirm('Cancellare DEFINITIVAMENTE questo account?\n\nVerranno eliminati: bets, crediti, achievements, reazioni, gruppi, amicizie. Non recuperabile.')) {
      throw new Error('cancelled');
    }
    await api.adminDeleteUser(id);
    setSelectedId(null);
  }, 'Account eliminato');

  const clearLegacy = wrap(async id => api.adminClearLegacy(id), 'Legacy room_id pulito');
  const addToGroup  = wrap(async (gid, uid) => api.adminAddToGroup(gid, uid), 'Aggiunto al gruppo ✓');
  const removeFromGroup = wrap(async (gid, uid) => api.adminRemoveFromGroup(gid, uid), 'Rimosso dal gruppo');
  const regenCode   = wrap(async gid => {
    const r = await api.adminRegenCode(gid);
    toast.success(`Nuovo codice: ${r.invite_code}`);
  });
  const setPassword = wrap(async (uid, pw) => {
    const policyErr = validatePassword(pw);
    if (policyErr) throw new Error(t(`pw.${policyErr.replace('password_', '')}`));
    await api.adminSetPassword(uid, pw);
    setPwNew('');
  }, 'Password aggiornata ✓');

  // ── Render ──────────────────────────────────────────────────────────
  const TabBtn = ({ id, label }) => {
    const active = tab === id;
    return (
      <button onClick={() => { setTab(id); setSelectedId(null); }} style={{
        flex: 1, padding: '10px 12px',
        background: active ? 'var(--gold)18' : 'transparent',
        color: active ? 'var(--gold)' : 'var(--dim)',
        border: 'none', borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
        cursor: 'pointer', fontFamily: "'Syne',sans-serif",
        fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
      }}>{label}</button>
    );
  };

  if (loading && !users.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)' }}>caricamento…</div>;
  }

  return (
    <div className="sUp" style={{ paddingBottom: isDesktop ? 32 : 96 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: isDesktop ? 32 : 24, fontWeight: 900, letterSpacing: -0.5, marginBottom: 4 }}>
          🛠 Admin
        </h1>
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
          Pannello di controllo riservato. Le azioni sono immediate e non recuperabili — pensaci due volte.
        </div>
      </div>

      <div style={{
        display: 'flex', background: 'var(--card)', border: '1px solid var(--brd)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 14,
      }}>
        <TabBtn id="users"     label={`Utenti (${users.length})`}/>
        <TabBtn id="groups"    label={`Gruppi (${groups.length})`}/>
        <TabBtn id="integrity" label={`Integrità${integrity ? ` (${(integrity.dangling_room_ids?.length||0) + (integrity.duplicate_names?.length||0) + (integrity.orphan_user_groups?.length||0) + (integrity.duplicate_emails?.length||0)})` : ''}`}/>
      </div>

      {/* ── UTENTI ─────────────────────────────────────────── */}
      {tab === 'users' && !selectedId && (
        <>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 14px', marginBottom: 14,
            background: 'var(--card)', border: '1px solid var(--brd)',
            borderRadius: 12,
          }}>
            <span style={{ color: 'var(--dim)' }}>🔍</span>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Cerca per email o nome…"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', color: 'var(--txt)', fontFamily: "'Syne',sans-serif", fontSize: 13 }}/>
          </div>

          {filteredUsers.map(u => {
            const flagged = u.legacy_room_id && u.legacy_room_exists === false;
            return (
              <div key={u.id} onClick={() => setSelectedId(u.id)}
                style={{ ...S.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, position: 'relative' }}>
                <Avatar p={u} size={42}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.name} {u.is_admin && <span style={{ fontSize: 10, color: 'var(--gold)' }}>★ admin</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {u.email}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--mut)', marginTop: 4, letterSpacing: 0.5 }}>
                    👥{u.group_count} · 🎲{u.bets_created} · 🤝{u.friend_count} {u.friend_requests_in > 0 && `· in:${u.friend_requests_in}`} · {Math.round(u.credits ?? 0)}₡
                  </div>
                </div>
                {flagged && (
                  <span title="users.room_id punta a un gruppo cancellato"
                    style={{ position: 'absolute', top: 8, right: 8, fontSize: 10, color: 'var(--red)' }}>⚠ orfano</span>
                )}
              </div>
            );
          })}
        </>
      )}

      {/* User detail */}
      {tab === 'users' && selectedId && (() => {
        const u = users.find(x => x.id === selectedId);
        if (!u) return null;
        const myGroups = groups; // any group for force-add
        const userGroupIds = new Set((detail?.groups || []).map(g => g.id));
        // Other accounts that collide on lowercase email (the "reset doesn't reach" trap)
        const emailSiblings = users.filter(o =>
          o.id !== u.id && (o.email || '').toLowerCase() === (u.email || '').toLowerCase()
        );

        return (
          <>
            <button onClick={() => setSelectedId(null)} style={S.btn('ghost')}>← indietro</button>

            <div style={{ ...S.card, marginTop: 14, display: 'flex', alignItems: 'center', gap: 14 }}>
              <Avatar p={u} size={56}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 19, fontWeight: 700 }}>{u.name}</div>
                <div style={{ fontSize: 12, color: 'var(--dim)' }}>{u.email}</div>
                <div style={{ fontSize: 10, color: 'var(--mut)', marginTop: 4, fontFamily: 'monospace' }}>{u.id}</div>
              </div>
            </div>

            {emailSiblings.length > 0 && (
              <div style={{ ...S.card, borderColor: 'var(--red)55', background: 'var(--red)0d' }}>
                <div style={{ ...S.label, color: 'var(--red)' }}>⚠ Email duplicata</div>
                <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, marginBottom: 10 }}>
                  Altri {emailSiblings.length} account hanno questa stessa email. Il login va a quello che il DB restituisce per primo — potrebbe non essere quello su cui stai impostando la password. Cancella quelli sbagliati o imposta la password sul record giusto.
                </div>
                {emailSiblings.map(s => (
                  <div key={s.id} onClick={() => setSelectedId(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0',
                      borderBottom: '1px solid var(--brd)33', cursor: 'pointer' }}>
                    <Avatar p={s} size={32}/>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{s.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--dim)' }}>
                        <code style={{ color: 'var(--gold)' }}>{s.email}</code> · creato {new Date(Number(s.created_at)).toLocaleDateString()}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--mut)', fontFamily: 'monospace' }}>{s.id.slice(0, 12)}…</div>
                    </div>
                    <span style={{ color: 'var(--gold)', fontSize: 11 }}>apri →</span>
                  </div>
                ))}
              </div>
            )}

            {u.legacy_room_id && (
              <div style={S.card}>
                <div style={S.label}>Legacy room_id</div>
                <div style={{ fontSize: 12, marginTop: 6, marginBottom: 8, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {u.legacy_room_id} {u.legacy_room_exists === false && <span style={{ color: 'var(--red)' }}>(non esiste)</span>}
                </div>
                <button onClick={() => clearLegacy(u.id)} disabled={busy} style={S.btn()}>Cancella riferimento</button>
              </div>
            )}

            <div style={S.card}>
              <div style={S.label}>Gruppi di cui è membro</div>
              {(detail?.groups || []).length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--mut)', marginTop: 8 }}>nessun gruppo</div>
              )}
              {(detail?.groups || []).map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--brd)33' }}>
                  <span style={{ fontSize: 18 }}>{g.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{g.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--mut)' }}>{g.role} · codice {g.invite_code}</div>
                  </div>
                  <button onClick={() => removeFromGroup(g.id, u.id)} disabled={busy} style={S.btn('danger')}>Rimuovi</button>
                </div>
              ))}
            </div>

            <div style={S.card}>
              <div style={S.label}>Aggiungi a un gruppo</div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, marginBottom: 10 }}>
                Forza l'iscrizione · niente codice invito.
              </div>
              {myGroups.filter(g => !userGroupIds.has(g.id)).map(g => (
                <button key={g.id} onClick={() => addToGroup(g.id, u.id)} disabled={busy}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', marginBottom: 6,
                    background: 'transparent', border: '1px dashed var(--brd)',
                    borderRadius: 10, cursor: busy ? 'wait' : 'pointer',
                    color: 'var(--txt)', textAlign: 'left',
                  }}>
                  <span style={{ fontSize: 16 }}>{g.emoji}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{g.name}</span>
                  <span style={{ fontSize: 10, color: 'var(--mut)' }}>👥{g.member_count} · {g.invite_code}</span>
                  <span style={{ color: 'var(--gold)' }}>＋</span>
                </button>
              ))}
            </div>

            {(() => {
              const pwErr = validatePassword(pwNew);
              const hasInput = pwNew.length > 0;
              return (
                <div style={S.card}>
                  <div style={S.label}>Imposta password</div>
                  <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, marginBottom: 10 }}>
                    Bypass del flusso "dimentica password". {t('pw.hint')}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={pwNew} onChange={e => setPwNew(e.target.value)} type="text"
                      placeholder="nuova password"
                      style={{ flex: 1, background: 'var(--inp)', border: `1px solid ${hasInput && pwErr ? 'var(--red)55' : hasInput ? 'var(--grn)55' : 'var(--brd)'}`, borderRadius: 8, color: 'var(--txt)', padding: '8px 10px', fontFamily: "'Syne',sans-serif", fontSize: 13, outline: 'none' }}/>
                    <button onClick={() => setPassword(u.id, pwNew)} disabled={busy || !!pwErr} style={S.btn()}>
                      Applica
                    </button>
                  </div>
                  {hasInput && (
                    <div style={{
                      marginTop: 8, fontSize: 11, fontWeight: 600,
                      color: pwErr ? 'var(--red)' : 'var(--grn)',
                    }}>
                      {pwErr ? t(`pw.${pwErr.replace('password_', '')}`) : t('pw.ok')}
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ ...S.card, borderColor: 'var(--red)44' }}>
              <div style={{ ...S.label, color: 'var(--red)' }}>Danger zone</div>
              <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, marginBottom: 10 }}>
                Cancella l'account e ogni traccia (bet, crediti, achievements, reazioni, amicizie, gruppi).
              </div>
              <button onClick={() => deleteUser(u.id)} disabled={busy} style={S.btn('danger')}>
                Elimina account
              </button>
            </div>

            {detail && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--dim)', fontSize: 12 }}>JSON grezzo</summary>
                <pre style={S.pre}>{JSON.stringify(detail, null, 2)}</pre>
              </details>
            )}
          </>
        );
      })()}

      {/* ── GRUPPI ─────────────────────────────────────────── */}
      {tab === 'groups' && (
        <>
          {groups.map(g => (
            <div key={g.id} style={S.card}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>{g.emoji}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{g.name}</div>
                  <div style={{ fontSize: 10, color: 'var(--mut)', fontFamily: 'monospace' }}>{g.id}</div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', fontSize: 11, color: 'var(--dim)', marginBottom: 10 }}>
                <span>codice <code style={{ background: 'var(--inp)', padding: '2px 6px', borderRadius: 4, color: 'var(--gold)' }}>{g.invite_code}</code></span>
                <span>· 👥{g.member_count}</span>
                <span>· 🎲{g.bet_count}</span>
              </div>
              <button onClick={() => regenCode(g.id)} disabled={busy} style={S.btn()}>
                Rigenera codice
              </button>
            </div>
          ))}
        </>
      )}

      {/* ── INTEGRITÀ ──────────────────────────────────────── */}
      {tab === 'integrity' && integrity && (
        <>
          <div style={{ ...S.card, borderColor: integrity.duplicate_emails?.length ? 'var(--red)55' : 'var(--brd)' }}>
            <div style={{ ...S.label, color: integrity.duplicate_emails?.length ? 'var(--red)' : 'var(--dim)' }}>
              Email duplicate
            </div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, marginBottom: 10 }}>
              Stessa email su più account (es. 'Anna@x' e 'anna@x'). Causa il classico bug "reimposto la password ma lei non riesce a entrare" — la reset arriva a un record diverso da quello su cui atterra il login.
            </div>
            {(!integrity.duplicate_emails || integrity.duplicate_emails.length === 0) && (
              <div style={{ fontSize: 12, color: 'var(--grn)' }}>✓ nessuno</div>
            )}
            {(integrity.duplicate_emails || []).map(d => (
              <div key={d.lemail} style={{ padding: '8px 0', borderBottom: '1px solid var(--brd)33' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--red)' }}>{d.lemail} ({d.n} account)</div>
                {d.users.map(u => (
                  <div key={u.id} onClick={() => { setTab('users'); setSelectedId(u.id); }}
                    style={{ fontSize: 11, color: 'var(--dim)', cursor: 'pointer', marginTop: 6, padding: '4px 0' }}>
                    · <code style={{ color: 'var(--gold)' }}>{u.email}</code> · {u.name}
                    <span style={{ color: 'var(--mut)', fontFamily: 'monospace', fontSize: 10, marginLeft: 6 }}>
                      {u.id.slice(0, 12)}…
                    </span>
                    {u.room_id && <span style={{ color: 'var(--mut)', marginLeft: 6 }}>· room {u.room_id.slice(0,8)}…</span>}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={S.label}>Legacy room_id orfani</div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, marginBottom: 10 }}>
              users.room_id punta a un gruppo cancellato. Causa "fantasmi" nello state legacy.
            </div>
            {integrity.dangling_room_ids.length === 0 && <div style={{ fontSize: 12, color: 'var(--grn)' }}>✓ nessuno</div>}
            {integrity.dangling_room_ids.map(r => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--brd)33' }}>
                <div style={{ flex: 1, fontSize: 12 }}>
                  <div>{r.name} · <span style={{ color: 'var(--dim)' }}>{r.email}</span></div>
                  <div style={{ fontSize: 10, color: 'var(--mut)', fontFamily: 'monospace' }}>→ {r.room_id}</div>
                </div>
                <button onClick={() => clearLegacy(r.id)} disabled={busy} style={S.btn()}>Pulisci</button>
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={S.label}>Nomi duplicati</div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, marginBottom: 10 }}>
              Più account con lo stesso nome (possibile doppione di un utente).
            </div>
            {integrity.duplicate_names.length === 0 && <div style={{ fontSize: 12, color: 'var(--grn)' }}>✓ nessuno</div>}
            {integrity.duplicate_names.map(d => (
              <div key={d.lname} style={{ padding: '8px 0', borderBottom: '1px solid var(--brd)33' }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{d.lname} ({d.n})</div>
                {d.users.map(u => (
                  <div key={u.id} onClick={() => { setTab('users'); setSelectedId(u.id); }} style={{ fontSize: 11, color: 'var(--dim)', cursor: 'pointer', marginTop: 4 }}>
                    · {u.email} <span style={{ color: 'var(--mut)', fontFamily: 'monospace', fontSize: 10 }}>{u.id.slice(0, 12)}…</span>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div style={S.card}>
            <div style={S.label}>user_groups orfani</div>
            <div style={{ fontSize: 11, color: 'var(--mut)', marginTop: 4, marginBottom: 10 }}>
              Membri di gruppi che non esistono più (o per utenti cancellati).
            </div>
            {integrity.orphan_user_groups.length === 0
              ? <div style={{ fontSize: 12, color: 'var(--grn)' }}>✓ nessuno</div>
              : <pre style={S.pre}>{JSON.stringify(integrity.orphan_user_groups, null, 2)}</pre>}
          </div>
        </>
      )}
    </div>
  );
}
