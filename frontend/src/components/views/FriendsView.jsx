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
            <div style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 17, fontWeight: 700,
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
  const [leaderboard, setLeaderboard] = useState([]);   // [{ id, trophyPoints, wins, h2hWon, h2hLost, h2hTotal, ... }]
  const [reqIncoming, setReqIncoming] = useState([]);
  const [reqOutgoing, setReqOutgoing] = useState([]);
  const [discover,   setDiscover]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [query,      setQuery]      = useState('');
  const [inviting,   setInviting]   = useState(null);
  const [busyIds,    setBusyIds]    = useState(new Set());
  const [openProfile, setOpenProfile] = useState(null);  // friend object whose profile is open

  const setBusy = (id, busy) => setBusyIds(prev => {
    const next = new Set(prev);
    busy ? next.add(id) : next.delete(id);
    return next;
  });

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [f, r, d, lb] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getFriendDiscover(),
        api.getFriendsLeaderboard().catch(() => ({ rows: [] })),
      ]);
      setFriends(f);
      setLeaderboard(lb.rows || []);
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
        position: 'relative', padding: '6px 0 14px',
        background: 'transparent',
        color: active ? 'var(--txt)' : 'var(--dim)',
        border: 'none', borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
        marginBottom: -1, cursor: 'pointer', fontFamily: "'Manrope',sans-serif",
        fontSize: 11, fontWeight: 600, letterSpacing: '.22em', textTransform: 'uppercase',
        whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 8,
        transition: 'all .18s',
      }}>
        <span>{label}</span>
        {count > 0 && (
          <span style={{
            display: 'inline-block', minWidth: 6, height: 6, borderRadius: 999,
            background: id === 'requests' ? 'var(--red)' : 'var(--gold)',
            marginLeft: 2,
          }}/>
        )}
      </button>
    );
  };

  // Quick lookup of leaderboard stats by user id, used to enrich friend rows.
  const lbById = useMemo(() => {
    const m = {};
    for (const r of leaderboard) m[r.id] = r;
    return m;
  }, [leaderboard]);

  // Card renders a friend row. When `lb` (leaderboard data) is present
  // the row shows trophy points + h2h vs me + becomes tappable for the
  // FriendProfileModal. Otherwise it's the plain card used by
  // requests/discover tabs (no extra meta).
  const Card = ({ p, children, lb, rank, onOpen }) => (
    <div
      onClick={onOpen ? () => onOpen(p) : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 14px', marginBottom: 10,
        background: 'var(--card)', border: '1px solid var(--brd)',
        borderRadius: 14,
        cursor: onOpen ? 'pointer' : 'default',
        WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
        transition: 'border-color .15s ease, background .15s ease',
      }}
      onMouseEnter={onOpen ? (e) => { e.currentTarget.style.borderColor = 'var(--gold)55'; } : undefined}
      onMouseLeave={onOpen ? (e) => { e.currentTarget.style.borderColor = 'var(--brd)'; } : undefined}
    >
      {/* Leaderboard rank badge — only shown when there's a ranked context */}
      {rank != null && (
        <div style={{
          width: 26, height: 26, borderRadius: '50%',
          background: rank === 1 ? 'var(--gold)22'
                    : rank === 2 ? '#c0c4d022'
                    : rank === 3 ? '#b8733322'
                    : 'transparent',
          border: `1px solid ${rank === 1 ? 'var(--gold)' : rank === 2 ? '#c0c4d0' : rank === 3 ? '#b87333' : 'var(--brd)'}55`,
          color:  rank === 1 ? 'var(--gold)' : rank === 2 ? '#c0c4d0' : rank === 3 ? '#b87333' : 'var(--mut)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 700,
          flexShrink: 0,
        }}>{rank}</div>
      )}
      <Avatar p={p} size={48}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: "'Cormorant Garamond',serif", fontSize: 16, fontWeight: 700,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.name}</span>
          {lb?.trophyPoints > 0 && (
            <span style={{
              flexShrink: 0,
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 8px', borderRadius: 999,
              background: 'var(--gold)18', border: '1px solid var(--gold)44',
              color: 'var(--gold)',
              fontFamily: "'Manrope',sans-serif", fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
            }}>
              <span style={{fontSize:11}}>🏆</span> {lb.trophyPoints}
            </span>
          )}
        </div>
        {/* h2h record vs me, if any bets played together */}
        {lb?.h2hTotal > 0 && (
          <div style={{
            fontFamily: "'Manrope',sans-serif", fontSize: 11, fontWeight: 600,
            marginTop: 4, letterSpacing: '.04em',
          }}>
            <span style={{ color: 'var(--grn)' }}>{lb.h2hWon}W</span>
            <span style={{ color: 'var(--mut)', margin: '0 4px' }}>·</span>
            <span style={{ color: 'var(--red)' }}>{lb.h2hLost}L</span>
            <span style={{ color: 'var(--mut)', marginLeft: 6, fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase' }}>
              {t('friends.h2h_label')}
            </span>
          </div>
        )}
        <SharedGroupsChips groups={p.shared_groups} onClick={onSwitchToGroup}/>
        {p.last_interaction > 0 && !lb && (
          <div style={{ fontSize: 10, color: 'var(--mut)', marginTop: 6, letterSpacing: 0.3 }}>
            ⏱ {timeAgo(p.last_interaction, t)}
          </div>
        )}
      </div>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}
      >
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
      fontFamily: "'Manrope',sans-serif", fontSize: 11, fontWeight: 700,
      letterSpacing: 0.5, whiteSpace: 'nowrap',
      opacity: disabled ? 0.6 : 1,
    }}>{label}</button>
  );

  return (
    <div className="sUp" style={{ paddingBottom: isDesktop ? 32 : 96 }}>
      <div style={{ marginBottom: 32, paddingTop: isDesktop ? 16 : 8 }}>
        <div className="bc-meta" style={{ marginBottom: 10 }}>— Cerchia</div>
        <div className="bc-hero" style={{ fontSize: isDesktop ? 54 : 38 }}>{t('friends.title')}</div>
        <div style={{ fontSize: 13, color: 'var(--dim)', lineHeight: 1.6, marginTop: 14, maxWidth: 520 }}>
          {t('friends.subtitle_v2')}
        </div>
      </div>

      <div style={{
        display: 'flex', gap: 24, borderBottom: '1px solid var(--rule)',
        marginBottom: 4, overflowX: 'auto',
      }}>
        <TabBtn id="friends"  label={t('friends.tab_friends')}  count={friends.length}/>
        <TabBtn id="requests" label={t('friends.tab_requests')} count={incomingCount}/>
        <TabBtn id="discover" label={t('friends.tab_discover')} count={discover.length}/>
      </div>

      {(tab !== 'requests' && (tab === 'friends' ? friends.length : discover.length) > 4) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 2px', marginTop: 18, marginBottom: 4,
          borderBottom: '1px solid var(--brd)',
        }}>
          <span style={{ color: 'var(--dim)', fontSize: 14 }}>🔍</span>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('friends.search')}
            style={{
              flex: 1, border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--txt)',
              fontFamily: "'Manrope',sans-serif", fontSize: 14, letterSpacing: '.01em',
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
                fontFamily: "'Manrope',sans-serif", fontSize: 12, fontWeight: 700,
              }}>{t('friends.empty_cta')}</button>
            </div>
          )}
          {/* Sort filtered friends by leaderboard trophy points (desc),
              keeping anyone missing from the leaderboard at the bottom. */}
          {[...filtered].sort((a, b) => {
            const pa = lbById[a.id]?.trophyPoints ?? 0;
            const pb = lbById[b.id]?.trophyPoints ?? 0;
            return pb - pa;
          }).map((f, i) => (
            <Card
              key={f.id}
              p={f}
              lb={lbById[f.id]}
              rank={filtered.length > 1 ? i + 1 : null}
              onOpen={(p) => setOpenProfile(p)}
            >
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

      {openProfile && (
        <FriendProfileModal
          friend={openProfile}
          onClose={() => setOpenProfile(null)}
          onSwitchToGroup={onSwitchToGroup}
          t={t}
        />
      )}
    </div>
  );
}

// ─── Friend profile modal ──────────────────────────────────────────────
// Tap on a friend's row → this modal opens. Shows their trophy collection
// (grouped by tier), joint stats vs me (h2h W:L, total stake moved, best
// shared bet), and a "Crea bet con [nome]" CTA.
function FriendProfileModal({ friend, onClose, onSwitchToGroup, t }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    api.getFriendProfile(friend.id)
      .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
      .catch(e => { if (!cancelled) { setError(e?.message || 'error'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [friend.id]);

  // Lock body scroll while open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const TIER_COLOR = (level) =>
      level >= 4 ? 'var(--gold)'
    : level >= 2 ? '#c0c4d0'
    : level >= 1 ? '#b87333'
    : 'var(--mut)';

  return createPortal((
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(8, 6, 18, 0.78)',
        backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bIn"
        style={{
          width: '100%', maxWidth: 480,
          maxHeight: 'calc(100dvh - 32px)', overflowY: 'auto',
          background: 'var(--surf)',
          border: '1px solid var(--rule)', borderRadius: 14,
          boxShadow: '0 30px 80px rgba(0,0,0,.55)',
          padding: '24px 22px 22px',
          paddingBottom: 'calc(22px + env(safe-area-inset-bottom))',
        }}
      >
        {/* Header: avatar + name + close */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
          <Avatar p={friend} size={56}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bc-meta" style={{ fontSize: 9 }}>— {t('friends.profile_label')}</div>
            <div style={{
              fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
              fontSize: 24, fontWeight: 700, color: 'var(--txt)',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              marginTop: 2,
            }}>{friend.name}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--dim)', fontSize: 22, padding: '4px 8px',
            WebkitTapHighlightColor: 'transparent',
          }}>✕</button>
        </div>

        {loading && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--dim)', fontSize: 12 }}>
            {t('friends.profile_loading')}
          </div>
        )}

        {error && !loading && (
          <div style={{
            padding: 16, borderRadius: 10,
            border: '1px solid var(--red)44', background: 'var(--red)10',
            color: 'var(--red)', fontSize: 12, textAlign: 'center',
          }}>{t('friends.profile_err')}</div>
        )}

        {data && !loading && (
          <>
            {/* Top row: trophy points + bets won */}
            <div style={{
              display: 'flex', gap: 12,
              padding: '14px 0', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--rule)',
              marginBottom: 18,
            }}>
              {[
                {l: t('friends.profile_trophies'), v: data.trophyPoints, c: 'var(--gold)'},
                {l: t('friends.profile_wins'),     v: data.progress?.wins?.current ?? 0, c: 'var(--grn)'},
              ].map((s, i) => (
                <div key={s.l} style={{
                  flex: 1, textAlign: 'center',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--rule)',
                }}>
                  <div className="bc-num" style={{ fontSize: 28, color: s.c, lineHeight: 1 }}>{s.v}</div>
                  <div className="bc-meta" style={{ fontSize: 8, marginTop: 6 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Joint vs me */}
            {data.vsMe.total > 0 && (
              <div style={{ marginBottom: 18 }}>
                <div className="bc-meta" style={{ marginBottom: 10 }}>— {t('friends.profile_vsme_title')}</div>
                <div style={{
                  display: 'flex', gap: 14, alignItems: 'baseline',
                  padding: '12px 14px', borderRadius: 10,
                  border: '1px solid var(--brd)', background: 'var(--card)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: "'Playfair Display',serif", fontSize: 22, fontWeight: 700,
                    }}>
                      <span style={{ color: 'var(--grn)' }}>{data.vsMe.iWon}</span>
                      <span style={{ color: 'var(--mut)', margin: '0 6px', fontSize: 14 }}>–</span>
                      <span style={{ color: 'var(--red)' }}>{data.vsMe.iLost}</span>
                    </div>
                    <div className="bc-meta" style={{ fontSize: 8, marginTop: 4 }}>{t('friends.profile_record')}</div>
                  </div>
                  <div style={{ flexShrink: 0, textAlign: 'right' }}>
                    <div className="bc-num" style={{ fontSize: 18, color: 'var(--gold)' }}>
                      {data.vsMe.totalStake}<span style={{ fontSize: 10, marginLeft: 2 }}>₡</span>
                    </div>
                    <div className="bc-meta" style={{ fontSize: 8, marginTop: 4 }}>{t('friends.profile_total_stake')}</div>
                  </div>
                </div>
                {data.vsMe.bestBet && (
                  <div style={{
                    marginTop: 10, padding: '10px 14px',
                    borderLeft: '3px solid var(--gold)',
                    background: 'var(--gold)08',
                    fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
                    fontSize: 14, color: 'var(--txt)',
                  }}>
                    {t('friends.profile_best_bet')}: “{data.vsMe.bestBet.title}”
                    <span style={{ marginLeft: 8, color: 'var(--gold)', fontStyle: 'normal', fontWeight: 700 }}>
                      +{data.vsMe.bestBet.potential_win - data.vsMe.bestBet.stake}₡
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Trophy collection — grouped by category */}
            <div className="bc-meta" style={{ marginBottom: 10 }}>— {t('friends.profile_trophies_title')}</div>
            {(() => {
              const byId = {};
              for (const u of data.unlocked) {
                if (!byId[u.achievement_id] || byId[u.achievement_id] < u.level) {
                  byId[u.achievement_id] = u.level;
                }
              }
              const unlockedIds = Object.keys(byId);
              if (unlockedIds.length === 0) {
                return (
                  <div style={{
                    padding: '14px 0', fontSize: 12, color: 'var(--mut)',
                    textAlign: 'center', fontStyle: 'italic',
                  }}>{t('friends.profile_no_trophies')}</div>
                );
              }
              return (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {data.catalog
                    .filter(a => byId[a.id] != null)
                    .map(a => {
                      const lvl = byId[a.id];
                      const color = TIER_COLOR(lvl);
                      return (
                        <div key={a.id} title={`${t('trophies.' + a.id)} · Lv ${lvl}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '6px 10px', borderRadius: 999,
                          border: `1px solid ${color}55`,
                          background: `${color}12`,
                          fontFamily: "'Manrope',sans-serif", fontSize: 11, fontWeight: 700,
                          color,
                        }}>
                          <span style={{ fontSize: 14 }}>{a.icon}</span>
                          <span>Lv {lvl}</span>
                        </div>
                      );
                    })}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  ), document.body);
}
