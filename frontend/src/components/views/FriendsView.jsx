import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import * as api from '../../api.js';
import { useLang } from '../../i18n.js';
import { useToast } from '../../Toast.jsx';
import { COLORS } from '../Atoms.jsx';

function timeAgo(ts, t) {
  if (!ts || Number(ts) === 0) return null;
  const diff = Date.now() - Number(ts);
  if (diff < 0) return null;
  const m = Math.floor(diff / 60000);
  if (m < 1)  return t('picker.now');
  if (m < 60) return t('picker.ago_min', { n: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('picker.ago_h',   { n: h });
  const d = Math.floor(h / 24);
  if (d < 30) return t('picker.ago_d',   { n: d });
  return t('picker.ago_mo', { n: Math.floor(d / 30) });
}

function Avatar({ p, size = 44 }) {
  const color = COLORS[p?.color_key] || '#5b8af0';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `${color}33`, border: `2px solid ${color}66`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: Math.round(size * 0.5), overflow: 'hidden', flexShrink: 0,
      color: '#fff',
    }}>
      {p?.avatar_url
        ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
        : (p?.avatar || '?')}
    </div>
  );
}

function SharedGroupsChips({ groups, onClick, max = 3 }) {
  if (!groups?.length) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
      {groups.slice(0, max).map(g => (
        <span key={g.id}
          onClick={() => onClick?.(g.id)}
          title={g.name}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '3px 8px', borderRadius: 999,
            background: 'var(--gold)12', border: '1px solid var(--gold)33',
            fontSize: 10, color: 'var(--gold)', fontWeight: 600,
            cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap',
            maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{g.emoji} {g.name}</span>
      ))}
      {groups.length > max && (
        <span style={{ fontSize: 10, color: 'var(--mut)', padding: '3px 4px' }}>
          +{groups.length - max}
        </span>
      )}
    </div>
  );
}

function InviteToGroupModal({ friend, groups, onInvite, onClose }) {
  const { t } = useLang();
  const sharedIds = useMemo(() => new Set((friend.shared_groups || []).map(g => g.id)), [friend.shared_groups]);
  const eligible = useMemo(() => groups.filter(g => {
    if (sharedIds.has(g.id)) return false;
    const isOwner   = g.role === 'owner';
    const canManage = isOwner || (g.role === 'co-admin' && g.permissions?.manage_members === true);
    return canManage;
  }), [groups, sharedIds]);
  const [busy, setBusy] = useState(null);

  const invite = async g => {
    setBusy(g.id);
    try { await onInvite(g.id); } finally { setBusy(null); }
  };

  return createPortal(
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9100, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} className="bIn" style={{
        background: 'var(--surf)', border: '1px solid var(--brd)',
        borderRadius: 18, width: '100%', maxWidth: 440,
        maxHeight: 'calc(100dvh - 32px)', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,.6)', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 16px', borderBottom: '1px solid var(--brd)',
        }}>
          <Avatar p={friend} size={42}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, color: 'var(--dim)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {t('friends.invite_title')}
            </div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 700,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {friend.name}
            </div>
          </div>
          <button onClick={onClose} style={{
            background: 'transparent', border: '1px solid var(--brd)', borderRadius: 10,
            color: 'var(--dim)', padding: '5px 11px', cursor: 'pointer',
            fontSize: 12, fontWeight: 600,
          }}>✕</button>
        </div>

        <div style={{ padding: 16, overflowY: 'auto', flex: 1 }}>
          {eligible.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '32px 12px',
              color: 'var(--dim)', fontSize: 13, lineHeight: 1.5,
            }}>{t('friends.no_eligible')}</div>
          ) : (
            <>
              <div style={{
                fontSize: 11, color: 'var(--dim)', letterSpacing: 1.5,
                textTransform: 'uppercase', fontWeight: 700, marginBottom: 10,
              }}>{t('friends.pick_group')}</div>
              {eligible.map(g => (
                <button key={g.id}
                  onClick={() => invite(g)}
                  disabled={busy !== null}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 14px', marginBottom: 8,
                    background: 'var(--card)', border: '1px solid var(--brd)',
                    borderRadius: 12, cursor: busy ? 'wait' : 'pointer',
                    color: 'var(--txt)', textAlign: 'left',
                  }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 11,
                    background: 'var(--gold)15', border: '1px solid var(--gold)44',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, flexShrink: 0,
                  }}>{g.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{g.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--dim)', marginTop: 2 }}>
                      👥 {g.member_count} · {g.role === 'owner' ? '★ owner' : '☆ co-admin'}
                    </div>
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--gold)' }}>
                    {busy === g.id ? '…' : '➤'}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function FriendsView({ groups, user, onSwitchToGroup, isDesktop }) {
  const { t }   = useLang();
  const toast   = useToast();
  const [tab, setTab]           = useState('friends'); // 'friends' | 'requests' | 'discover'
  const [friends,    setFriends]    = useState([]);
  const [reqIncoming, setReqIncoming] = useState([]);
  const [reqOutgoing, setReqOutgoing] = useState([]);
  const [discover,   setDiscover]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [query,      setQuery]      = useState('');
  const [inviting,   setInviting]   = useState(null);
  const [busyIds,    setBusyIds]    = useState(new Set());

  const setBusy = (id, busy) => setBusyIds(prev => {
    const next = new Set(prev);
    busy ? next.add(id) : next.delete(id);
    return next;
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [f, r, d] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getFriendDiscover(),
      ]);
      setFriends(f);
      setReqIncoming(r.incoming || []);
      setReqOutgoing(r.outgoing || []);
      setDiscover(d);
    } catch (e) { setError(e?.error || 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Active dataset for the current tab + search filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filter = list => q ? list.filter(p => (p.name || '').toLowerCase().includes(q)) : list;
    if (tab === 'friends')  return filter(friends);
    if (tab === 'requests') return { incoming: filter(reqIncoming), outgoing: filter(reqOutgoing) };
    return filter(discover);
  }, [tab, friends, reqIncoming, reqOutgoing, discover, query]);

  const handleSend = async id => {
    setBusy(id, true);
    try {
      const result = await api.sendFriendRequest(id);
      if (result.friended) {
        toast.success(t('friends.toast_paired'));
      } else {
        toast.success(t('friends.toast_sent'));
      }
      load();
    } catch (e) {
      const msg = e?.message === 'already_friends'  ? t('friends.toast_already')
                : e?.message === 'already_requested' ? t('friends.toast_dup')
                : t('friends.toast_err');
      toast.error(msg);
    } finally { setBusy(id, false); }
  };

  const handleRespond = async (id, accept) => {
    setBusy(id, true);
    try {
      await api.respondFriendReq(id, accept);
      toast.success(accept ? t('friends.toast_accepted') : t('friends.toast_rejected'));
      load();
    } catch (e) { toast.error(t('friends.toast_err')); }
    finally { setBusy(id, false); }
  };

  const handleCancel = async id => {
    setBusy(id, true);
    try { await api.cancelFriendReq(id); load(); }
    catch { toast.error(t('friends.toast_err')); }
    finally { setBusy(id, false); }
  };

  const handleRemoveFriend = async friend => {
    if (!window.confirm(t('friends.remove_confirm', { name: friend.name }))) return;
    setBusy(friend.id, true);
    try {
      await api.removeFriend(friend.id);
      toast.info(t('friends.toast_removed'));
      load();
    } catch (e) { toast.error(t('friends.toast_err')); }
    finally { setBusy(friend.id, false); }
  };

  const handleInvite = async groupId => {
    try {
      await api.inviteFriend(groupId, inviting.id);
      toast.success(t('friends.invited_ok', { name: inviting.name }));
      setInviting(null);
      load();
    } catch (e) {
      const msg = e?.message === 'already_member' ? t('friends.err_already')
                : e?.message === 'group_full'      ? t('friends.err_full')
                : t('friends.err_generic');
      toast.error(msg);
    }
  };

  const incomingCount = reqIncoming.length;
  const TabBtn = ({ id, label, count }) => {
    const active = tab === id;
    return (
      <button onClick={() => setTab(id)} style={{
        flex: 1, position: 'relative', padding: '10px 8px',
        background: active ? 'var(--gold)18' : 'transparent',
        color: active ? 'var(--gold)' : 'var(--dim)',
        border: 'none', borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
        cursor: 'pointer', fontFamily: "'Syne',sans-serif",
        fontSize: 12, fontWeight: 700, letterSpacing: 0.3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'all .18s',
      }}>
        <span>{label}</span>
        {count > 0 && (
          <span style={{
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: id === 'requests' && !active ? 'var(--gold)' : (active ? 'var(--gold)' : 'var(--gold)33'),
            color: id === 'requests' && !active ? '#07060f' : (active ? '#07060f' : 'var(--gold)'),
            fontSize: 10, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{count}</span>
        )}
      </button>
    );
  };

  const Card = ({ p, children }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 14px', marginBottom: 10,
      background: 'var(--card)', border: '1px solid var(--brd)',
      borderRadius: 14,
    }}>
      <Avatar p={p} size={48}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 700,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{p.name}</div>
        <SharedGroupsChips groups={p.shared_groups} onClick={onSwitchToGroup}/>
        {p.last_interaction > 0 && (
          <div style={{ fontSize: 10, color: 'var(--mut)', marginTop: 6, letterSpacing: 0.3 }}>
            ⏱ {timeAgo(p.last_interaction, t)}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {children}
      </div>
    </div>
  );

  const goldBtn = (label, onClick, disabled, kind = 'primary') => (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '7px 12px', borderRadius: 10,
      background: kind === 'primary' ? 'var(--gold)22' : kind === 'danger' ? 'var(--red)1a' : 'transparent',
      border: `1px solid ${kind === 'primary' ? 'var(--gold)55' : kind === 'danger' ? 'var(--red)44' : 'var(--brd)'}`,
      color: kind === 'primary' ? 'var(--gold)' : kind === 'danger' ? 'var(--red)' : 'var(--dim)',
      cursor: disabled ? 'wait' : 'pointer',
      fontFamily: "'Syne',sans-serif", fontSize: 11, fontWeight: 700,
      letterSpacing: 0.5, whiteSpace: 'nowrap',
      opacity: disabled ? 0.6 : 1,
    }}>{label}</button>
  );

  return (
    <div className="sUp" style={{ paddingBottom: isDesktop ? 32 : 96 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{
          fontFamily: "'Playfair Display',serif", fontSize: isDesktop ? 32 : 24,
          fontWeight: 900, letterSpacing: -0.5, marginBottom: 4,
        }}>👥 {t('friends.title')}</h1>
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5 }}>
          {t('friends.subtitle_v2')}
        </div>
      </div>

      <div style={{
        display: 'flex', background: 'var(--card)', border: '1px solid var(--brd)',
        borderRadius: 12, overflow: 'hidden', marginBottom: 14,
      }}>
        <TabBtn id="friends"  label={t('friends.tab_friends')}  count={friends.length}/>
        <TabBtn id="requests" label={t('friends.tab_requests')} count={incomingCount}/>
        <TabBtn id="discover" label={t('friends.tab_discover')} count={discover.length}/>
      </div>

      {(tab !== 'requests' && (tab === 'friends' ? friends.length : discover.length) > 4) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 14px', marginBottom: 14,
          background: 'var(--card)', border: '1px solid var(--brd)',
          borderRadius: 12,
        }}>
          <span style={{ color: 'var(--dim)', fontSize: 14 }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('friends.search')}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--txt)',
              fontFamily: "'Syne',sans-serif", fontSize: 13,
            }}
          />
        </div>
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--dim)', fontSize: 12 }}>
          {t('friends.loading')}
        </div>
      )}

      {!loading && error && (
        <div style={{ padding: 16, borderRadius: 12,
          border: '1px solid var(--red)44', background: 'var(--red)10',
          color: 'var(--red)', fontSize: 12, textAlign: 'center' }}>
          {t('friends.err_load')}
          <button onClick={load} style={{
            display: 'block', margin: '10px auto 0',
            padding: '7px 14px', borderRadius: 10,
            background: 'transparent', border: '1px solid var(--red)',
            color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
          }}>{t('photo.retry')}</button>
        </div>
      )}

      {/* ── AMICI ─────────────────────────────────────────── */}
      {!loading && !error && tab === 'friends' && (
        <>
          {friends.length === 0 && (
            <div style={{
              padding: '48px 16px', textAlign: 'center',
              border: '1px dashed var(--brd)', borderRadius: 16, color: 'var(--dim)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--txt)', marginBottom: 6 }}>
                {t('friends.empty_friends_title')}
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5, maxWidth: 320, margin: '0 auto' }}>
                {t('friends.empty_friends_body')}
              </div>
              <button onClick={() => setTab('discover')} style={{
                marginTop: 16, padding: '8px 18px', borderRadius: 10,
                background: 'var(--gold)22', border: '1px solid var(--gold)55',
                color: 'var(--gold)', cursor: 'pointer',
                fontFamily: "'Syne',sans-serif", fontSize: 12, fontWeight: 700,
              }}>{t('friends.empty_cta')}</button>
            </div>
          )}
          {filtered.map(f => (
            <Card key={f.id} p={f}>
              {goldBtn(t('friends.invite_short'), () => setInviting(f), busyIds.has(f.id))}
              {goldBtn(t('friends.remove'),       () => handleRemoveFriend(f), busyIds.has(f.id), 'danger')}
            </Card>
          ))}
        </>
      )}

      {/* ── RICHIESTE ─────────────────────────────────────── */}
      {!loading && !error && tab === 'requests' && (
        <>
          {(filtered.incoming.length === 0 && filtered.outgoing.length === 0) && (
            <div style={{
              padding: '48px 16px', textAlign: 'center',
              border: '1px dashed var(--brd)', borderRadius: 16, color: 'var(--dim)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                {t('friends.empty_requests')}
              </div>
            </div>
          )}

          {filtered.incoming.length > 0 && (
            <>
              <div style={{
                fontSize: 11, color: 'var(--dim)', letterSpacing: 1.5,
                textTransform: 'uppercase', fontWeight: 700, marginBottom: 8,
              }}>{t('friends.section_incoming')} ({filtered.incoming.length})</div>
              {filtered.incoming.map(p => (
                <Card key={p.id} p={p}>
                  {goldBtn(t('friends.accept'), () => handleRespond(p.id, true), busyIds.has(p.id))}
                  {goldBtn(t('friends.reject'), () => handleRespond(p.id, false), busyIds.has(p.id), 'ghost')}
                </Card>
              ))}
            </>
          )}

          {filtered.outgoing.length > 0 && (
            <>
              <div style={{
                fontSize: 11, color: 'var(--dim)', letterSpacing: 1.5,
                textTransform: 'uppercase', fontWeight: 700, margin: '14px 0 8px',
              }}>{t('friends.section_outgoing')} ({filtered.outgoing.length})</div>
              {filtered.outgoing.map(p => (
                <Card key={p.id} p={p}>
                  <div style={{ fontSize: 10, color: 'var(--dim)', textAlign: 'center' }}>
                    {t('friends.pending')}
                  </div>
                  {goldBtn(t('friends.cancel'), () => handleCancel(p.id), busyIds.has(p.id), 'ghost')}
                </Card>
              ))}
            </>
          )}
        </>
      )}

      {/* ── TROVA ─────────────────────────────────────────── */}
      {!loading && !error && tab === 'discover' && (
        <>
          {filtered.length === 0 && (
            <div style={{
              padding: '48px 16px', textAlign: 'center',
              border: '1px dashed var(--brd)', borderRadius: 16, color: 'var(--dim)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔭</div>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                {t('friends.empty_discover')}
              </div>
            </div>
          )}
          {filtered.map(p => (
            <Card key={p.id} p={p}>
              {goldBtn('＋ ' + t('friends.send_request'), () => handleSend(p.id), busyIds.has(p.id))}
            </Card>
          ))}
        </>
      )}

      {inviting && (
        <InviteToGroupModal
          friend={inviting}
          groups={groups}
          onInvite={handleInvite}
          onClose={() => setInviting(null)}
        />
      )}
    </div>
  );
}
