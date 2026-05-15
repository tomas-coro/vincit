import React, { useState, useEffect } from 'react';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';
import { useToast } from '../../Toast.jsx';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

const EMOJI_OPTIONS = ['🎲','🔥','❤️','🏆','⚡','🎯','👥','🎪','🃏','🌙',
                       '🎉','🎮','🍻','⚽','🎵','💪','🤝','🎭','🎨','🌟'];

const PERMS = ['manage_members','manage_credits','moderate_bets','manage_categories','reset_season','manage_settings'];
const PERM_ICONS = {
  manage_members:'👥', manage_credits:'💰', moderate_bets:'🛡',
  manage_categories:'🏷', reset_season:'🏆', manage_settings:'⚙️',
};

export default function GroupInfoModal({ group, userId, onClose, onLeft, onDeleted, onRenamed, isAdmin=false, can }) {
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  const toast = useToast();

  const [members,        setMembers]        = useState([]);
  const [copied,         setCopied]         = useState(false);
  const [editing,        setEditing]        = useState(false);
  const [editName,       setEditName]       = useState('');
  const [editEmoji,      setEditEmoji]      = useState('🎲');
  const [editThreshold,  setEditThreshold]  = useState(20);
  const [saving,         setSaving]         = useState(false);
  const [leaving,        setLeaving]        = useState(false);
  const [deleting,       setDeleting]       = useState(false);

  useEffect(() => {
    if (!group) return;
    api.getGroupMembers(group.id).then(setMembers).catch(console.error);
  }, [group?.id]);

  if (!group) return null;

  const isOwner = isAdmin;

  const copyCode = () => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(group.invite_code)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
    } else {
      prompt('Copy the code:', group.invite_code);
    }
  };

  // Native share sheet on mobile, clipboard fallback on desktop / older
  // browsers. The link carries the invite code as ?join= so the recipient
  // lands logged-in straight onto the join-attempt path.
  const shareLink = async () => {
    const origin = (typeof window !== 'undefined' && window.location)
      ? window.location.origin : '';
    const url = `${origin}/?join=${encodeURIComponent(group.invite_code || '')}`;
    const text = t('group_info.share_link_msg', {
      name: group.name || '',
      emoji: group.emoji || '🎲',
      url,
    });
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: group.name || 'Vincit', text, url });
        return;
      }
    } catch { /* user cancelled share — fall through to copy */ }
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast.success(t('group_info.share_link_copied'));
    } else {
      prompt('Copy the link:', url);
    }
  };

  // Render-friendly expiry label.  Returns { text, tone: 'ok'|'warn'|'bad'|'muted' }.
  const expiryInfo = (() => {
    const exp = group.invite_expires_at;
    if (exp == null) return { text: t('group_info.no_expiry'), tone: 'muted' };
    const ms = Number(exp) - Date.now();
    if (ms <= 0) return { text: t('group_info.expired_label'), tone: 'bad' };
    const oneHour = 60 * 60 * 1000;
    const oneDay  = 24 * oneHour;
    if (ms < oneHour) return { text: t('group_info.expires_soon'), tone: 'warn' };
    if (ms < oneDay)  return { text: t('group_info.expires_in_hours', { n: Math.ceil(ms / oneHour) }), tone: 'warn' };
    if (ms < 2 * oneDay) return { text: t('group_info.expires_in_day'), tone: 'warn' };
    return { text: t('group_info.expires_in_days', { n: Math.floor(ms / oneDay) }), tone: 'ok' };
  })();
  const expiryColor = {
    ok: 'var(--dim)', warn: 'var(--gold)', bad: 'var(--red)', muted: 'var(--mut)',
  }[expiryInfo.tone];

  const startEdit = () => {
    setEditName(group.name);
    setEditEmoji(group.emoji || '🎲');
    setEditThreshold(group.acceptance_threshold ?? 20);
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    if (!editName.trim()) return;
    setSaving(true);
    try {
      await api.renameGroup(group.id, { name: editName.trim(), emoji: editEmoji });
      await api.updateGroupSettings(group.id, { acceptance_threshold: Number(editThreshold) });
      onRenamed?.({ ...group, name: editName.trim(), emoji: editEmoji, acceptance_threshold: Number(editThreshold) });
      setEditing(false);
    } catch (e) { console.error(e); }
    finally { setSaving(false); }
  };

  const handleKick = async (member) => {
    if (!window.confirm(t('group_info.kick_confirm', { name: member.name }))) return;
    try {
      await api.kickMember(group.id, member.id);
      setMembers(ms => ms.filter(m => m.id !== member.id));
    } catch (e) { console.error(e); }
  };

  const handlePromote = async (member) => {
    if (!window.confirm(t('group_info.promote_confirm', { name: member.name }))) return;
    try {
      await api.promoteMember(group.id, member.id);
      setMembers(ms => ms.map(m => ({
        ...m,
        role: m.id === member.id ? 'owner' : (m.id === userId ? 'member' : m.role),
      })));
    } catch (e) { console.error(e); }
  };

  const handleSetRole = async (member, role) => {
    try {
      await api.setMemberRole(group.id, member.id, role);
      setMembers(ms => ms.map(m => m.id === member.id ? { ...m, role, permissions: role === 'co-admin' ? (m.permissions || {}) : {} } : m));
    } catch (e) { console.error(e); toast.error(t('app.err_role')); }
  };

  const handleTogglePermission = async (member, perm, value) => {
    const next = { ...(member.permissions || {}), [perm]: value };
    setMembers(ms => ms.map(m => m.id === member.id ? { ...m, permissions: next } : m));
    try {
      await api.setMemberPermissions(group.id, member.id, next);
    } catch (e) {
      console.error(e);
      toast.error(t('app.err_perms'));
      // revert
      setMembers(ms => ms.map(m => m.id === member.id ? { ...m, permissions: member.permissions || {} } : m));
    }
  };

  const handleRegenCode = async () => {
    if (!window.confirm(t('group_info.regen_confirm'))) return;
    try {
      const res = await api.regenerateCode(group.id);
      onRenamed?.({ ...group, invite_code: res.invite_code, invite_expires_at: res.invite_expires_at });
    } catch (e) { console.error(e); }
  };

  const handleLeave = async () => {
    if (!window.confirm(t('group_info.leave_confirm'))) return;
    setLeaving(true);
    try {
      await api.leaveGroup(group.id);
      onLeft?.();
    } catch (e) {
      const msg = e?.data?.error;
      toast.error(msg === 'Transfer ownership before leaving'
        ? t('group_info.leave_err')
        : (msg || t('app.error_cancel'))
      );
    } finally { setLeaving(false); }
  };

  const handleDelete = async () => {
    if (!window.confirm(t('group_info.delete_confirm1'))) return;
    if (!window.confirm(t('group_info.delete_confirm2'))) return;
    setDeleting(true);
    try {
      await api.deleteGroup(group.id);
      onDeleted?.();
    } catch { toast.error(t('group_info.delete_err')); }
    finally { setDeleting(false); }
  };

  const S = {
    btn: { fontFamily:"'Manrope',sans-serif", fontSize:13, fontWeight:600,
           cursor:'pointer', transition:'all .18s', borderRadius:10, border:'none' },
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(15,11,35,.78)',
      backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
      display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:100 }}>
      <div className="sUp" style={{
        background:'var(--surf)', borderRadius:'12px 12px 0 0',
        width:'100%', maxWidth:480, padding:'30px 26px 40px',
        borderTop:'1px solid var(--rule)', maxHeight:'88vh', overflowY:'auto',
        boxShadow:'0 -20px 60px rgba(0,0,0,.4)',
      }}>
        {editing ? (
          <div style={{ marginBottom:20 }}>
            <div style={{ fontSize:14, fontWeight:600, marginBottom:14 }}>
              {t('group_info.edit_title')}
            </div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:12 }}>
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setEditEmoji(e)} style={{
                  fontSize:20, padding:'4px 7px', borderRadius:8, cursor:'pointer',
                  border:`1px solid ${editEmoji===e?'var(--gold)':'var(--brd)'}`,
                  background: editEmoji===e ? 'var(--gold)22' : 'transparent',
                }}>{e}</button>
              ))}
            </div>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder={t('group_info.name_ph')}
              maxLength={40}
              style={{ width:'100%', background:'var(--inp)', border:'1px solid var(--brd)',
                color:'var(--txt)', borderRadius:10, padding:'10px 14px',
                fontFamily:"'Manrope',sans-serif", fontSize:14, outline:'none', marginBottom:12,
                boxSizing:'border-box' }}
            />
            {isOwner && (
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:11, color:'var(--dim)', marginBottom:4 }}>
                  {t('group_info.acceptance_threshold')}
                </div>
                <input
                  type="number"
                  min={1}
                  max={9999}
                  value={editThreshold}
                  onChange={e => setEditThreshold(e.target.value)}
                  style={{ width:'100%', background:'var(--inp)', border:'1px solid var(--brd)',
                    color:'var(--txt)', borderRadius:10, padding:'10px 14px',
                    fontFamily:"'Manrope',sans-serif", fontSize:14, outline:'none', marginBottom:4,
                    boxSizing:'border-box' }}
                />
                <div style={{ fontSize:11, color:'var(--dim)' }}>
                  {t('group_info.threshold_hint')}
                </div>
              </div>
            )}
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setEditing(false)} style={{
                ...S.btn, flex:1, padding:'10px',
                background:'transparent', border:'1px solid var(--brd)', color:'var(--dim)',
              }}>{t('group_info.cancel')}</button>
              <button onClick={handleSaveEdit}
                disabled={saving || !editName.trim()} style={{
                  ...S.btn, flex:1, padding:'10px',
                  background:'var(--gold)', color:'#07060f',
                  opacity: (saving || !editName.trim()) ? 0.5 : 1,
                }}>
                {saving ? '...' : t('group_info.save')}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', marginBottom:20 }}>
              <div style={{ fontFamily:"'Cormorant Garamond',serif", fontSize:20, fontWeight:700 }}>
                {group.emoji} {group.name}
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                {isOwner && (
                  <button onClick={startEdit} style={{
                    background:'transparent', border:'none',
                    color:'var(--dim)', fontSize:16, cursor:'pointer', lineHeight:1,
                  }}>✏️</button>
                )}
                <button onClick={onClose} style={{
                  background:'transparent', border:'none',
                  color:'var(--dim)', fontSize:20, cursor:'pointer', lineHeight:1,
                }}>✕</button>
              </div>
            </div>

            {/* Invite code */}
            <div style={{ background:'var(--card)', borderRadius:12, padding:'16px 14px',
              border:'1px solid var(--brd)', marginBottom:16, textAlign:'center' }}>
              <div style={{ fontSize:9, color:'var(--dim)', letterSpacing:2,
                textTransform:'uppercase', marginBottom:10 }}>
                {t('group_info.invite_label')}
              </div>
              <div style={{ fontFamily:'monospace', fontSize:34, fontWeight:700,
                color:'var(--gold)', letterSpacing:8, marginBottom:14, userSelect:'all' }}>
                {group.invite_code ?? '—'}
              </div>
              <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={copyCode} style={{
                  ...S.btn, padding:'8px 20px',
                  border:'1px solid var(--gold)',
                  background: copied ? 'var(--gold)' : 'transparent',
                  color:      copied ? '#07060f'     : 'var(--gold)',
                }}>
                  {copied ? t('group_info.copied') : t('group_info.copy')}
                </button>
                <button onClick={shareLink} disabled={expiryInfo.tone === 'bad'} style={{
                  ...S.btn, padding:'8px 18px',
                  border:'1px solid var(--gold)',
                  background:'var(--gold)', color:'#1a1530',
                  opacity: expiryInfo.tone === 'bad' ? 0.4 : 1,
                  cursor: expiryInfo.tone === 'bad' ? 'not-allowed' : 'pointer',
                }}>
                  🔗 {t('group_info.share_link')}
                </button>
                {isOwner && (
                  <button onClick={handleRegenCode} style={{
                    ...S.btn, padding:'8px 14px',
                    border:'1px solid var(--brd)',
                    background:'transparent', color:'var(--dim)',
                  }}>
                    {t('group_info.regen_code')}
                  </button>
                )}
              </div>
              <div style={{ fontSize:11, color: expiryColor, marginTop:10, fontWeight: expiryInfo.tone === 'bad' || expiryInfo.tone === 'warn' ? 700 : 500 }}>
                {expiryInfo.text}
              </div>
              <div style={{ fontSize:11, color:'var(--dim)', marginTop:4 }}>
                {t('group_info.invite_hint')}
              </div>
            </div>

            {/* Members */}
            <div style={{ fontSize:9, color:'var(--dim)', letterSpacing:2,
              textTransform:'uppercase', marginBottom:10 }}>
              {t('group_info.members')} ({members.length})
            </div>
            {members.map(m => (
              <div key={m.id} style={{ borderBottom:'1px solid var(--brd)22', padding:'10px 0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  {m.avatar_url
                    ? <img src={m.avatar_url} alt="" style={{ width:32, height:32, borderRadius:'50%', objectFit:'cover' }}/>
                    : <span style={{ fontSize:22, lineHeight:1 }}>{m.avatar || '😊'}</span>}
                  <span style={{ flex:1, fontSize:14, fontWeight:600,
                    color: m.id === userId ? 'var(--gold)' : 'var(--txt)' }}>
                    {m.name}
                  </span>
                  {m.role === 'owner' && (
                    <span style={{ fontSize:10, color:'var(--gold)',
                      border:'1px solid var(--gold)44', borderRadius:20, padding:'2px 8px' }}>
                      {t('group_info.owner_badge')}
                    </span>
                  )}
                  {m.role === 'co-admin' && (
                    <span style={{ fontSize:10, color:'var(--blu)',
                      border:'1px solid var(--blu)55', borderRadius:20, padding:'2px 8px' }}>
                      {t('group_info_perms.coadmin_badge')}
                    </span>
                  )}
                  {isOwner && m.id !== userId && (
                    <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                      {m.role === 'member' && (
                        <button onClick={() => handleSetRole(m, 'co-admin')} style={{
                          ...S.btn, padding:'4px 10px', fontSize:11,
                          background:'transparent', border:'1px solid var(--blu)55', color:'var(--blu)',
                        }}>{t('group_info_perms.promote_coadmin')}</button>
                      )}
                      {m.role === 'co-admin' && (
                        <button onClick={() => handleSetRole(m, 'member')} style={{
                          ...S.btn, padding:'4px 10px', fontSize:11,
                          background:'transparent', border:'1px solid var(--mut)', color:'var(--dim)',
                        }}>{t('group_info_perms.demote_coadmin')}</button>
                      )}
                      <button onClick={() => handlePromote(m)} style={{
                        ...S.btn, padding:'4px 10px', fontSize:11,
                        background:'transparent', border:'1px solid var(--gold)44', color:'var(--gold)',
                      }}>{t('group_info.promote')}</button>
                      <button onClick={() => handleKick(m)} style={{
                        ...S.btn, padding:'4px 10px', fontSize:11,
                        background:'transparent', border:'1px solid var(--red)44', color:'var(--red)',
                      }}>{t('group_info.kick')}</button>
                    </div>
                  )}
                </div>
                {/* Co-admin permission flags — only owner can toggle */}
                {isOwner && m.role === 'co-admin' && (
                  <div style={{ marginTop: 8, padding:'8px 10px', background:'var(--blu)0d',
                    border:'1px solid var(--blu)22', borderRadius:8 }}>
                    <div style={{ fontSize:10, color:'var(--dim)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>
                      {t('group_info_perms.title')}
                    </div>
                    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      {PERMS.map(perm => {
                        const checked = !!(m.permissions && m.permissions[perm]);
                        return (
                          <label key={perm} style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:12, cursor:'pointer', lineHeight:1.35 }}>
                            <input type="checkbox" checked={checked}
                              onChange={e => handleTogglePermission(m, perm, e.target.checked)}
                              style={{ accentColor:'var(--gold)', marginTop:2, flexShrink:0 }}/>
                            <span style={{flexShrink:0}}>{PERM_ICONS[perm]}</span>
                            <span style={{ color: checked ? 'var(--txt)' : 'var(--dim)', flex:1 }}>{t('group_info_perms.'+perm)}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Leave — non-owner only, not when sole member */}
            {!isOwner && members.length > 1 && (
              <button onClick={handleLeave} disabled={leaving} style={{
                ...S.btn, width:'100%', marginTop:24, padding:'12px',
                border:'1px solid var(--red)44', background:'transparent',
                color:'var(--red)', opacity: leaving ? 0.5 : 1,
              }}>{t('group_info.leave_btn')}</button>
            )}

            {/* Delete — owner only */}
            {isOwner && (
              <div style={{ marginTop:28, paddingTop:20, borderTop:'1px solid var(--red)22' }}>
                <button onClick={handleDelete} disabled={deleting} style={{
                  ...S.btn, width:'100%', padding:'12px',
                  border:'1px solid var(--red)44', background:'transparent',
                  color:'var(--red)', opacity: deleting ? 0.5 : 1,
                }}>
                  {deleting ? '...' : `🗑 ${t('group_info.delete_btn')}`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
