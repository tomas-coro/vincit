import React, { useState, useEffect } from 'react';
import { Btn, Inp, Toggle, SecLabel, COLORS, CAT_COLS, fmtQ } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';
import { useToast } from '../../Toast.jsx';
import { registerPush } from '../../App.jsx';

const isIOS = typeof navigator !== 'undefined' && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
);

// Read the live Notification.permission state. Returns one of the
// standard values or 'unsupported' on browsers that lack the API.
function readPushState() {
  if (typeof Notification === 'undefined') return 'unsupported';
  return Notification.permission; // 'default' | 'granted' | 'denied'
}

// Editorial section pattern: no card box, hairline separator, generous
// vertical breathing. Components that legitimately need a raised look
// (the credit-confirm popover, reset confirmation) still get card styling
// inline.
const S = {
  card: {padding:"22px 0", borderBottom:"1px solid var(--rule)"},
  inp: {background:"transparent",border:0,borderBottom:"1px solid var(--brd)",borderRadius:0,color:"var(--txt)",padding:"8px 2px",fontFamily:"'Manrope',sans-serif",fontSize:15,outline:"none",width:"100%"},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:8,padding:"10px 20px",borderRadius:999,border:"none",cursor:"pointer",fontFamily:"'Manrope',sans-serif",fontSize:12,fontWeight:600,letterSpacing:".06em",transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
  raised: {background:"var(--card)",border:"1px solid var(--rule)",borderRadius:14,padding:16},
};

export default function SettingsView({user,profiles,groupMembers,isDark,setIsDark,theme,setTheme,customCats,credits,bets,onUpdateProfile,onCreateCategory,onDeleteCategory,vaultPin,onSetVaultPin,isDesktop,onReset,onTestReset,onLogout,onOpenProfileEdit,isAdmin=false,can}){
  const { t, lang, setLang } = useLang();
  // Two-step logout: first tap arms the button ("Conferma uscita" in red),
  // second tap actually fires onLogout. Auto-resets after 4s so a forgotten
  // arm doesn't leave a stale tap-to-log-out trap if the user wandered off.
  const [logoutArmed, setLogoutArmed] = useState(false);
  useEffect(() => {
    if (!logoutArmed) return;
    const t = setTimeout(() => setLogoutArmed(false), 4000);
    return () => clearTimeout(t);
  }, [logoutArmed]);
  // First-visit intro tip — points at the 4 main areas of the page so
  // users don't have to scroll-hunt for things like push toggles or
  // theme switcher. One-time, dismissible, persisted in LS.
  const [introDismissed, setIntroDismissed] = useState(() => {
    try { return !!localStorage.getItem('bc_settings_intro_seen'); } catch { return false; }
  });
  const dismissIntro = () => {
    try { localStorage.setItem('bc_settings_intro_seen', '1'); } catch {}
    setIntroDismissed(true);
  };
  // Privacy controls — fetched once, mutated optimistically on click.
  const [privacy, setPrivacyState] = useState(null);
  useEffect(() => {
    api.getPrivacy().then(setPrivacyState).catch(() => {});
  }, []);
  const updatePrivacy = async (key, value) => {
    const prev = privacy;
    // Optimistic update so the segmented control feels instant.
    setPrivacyState(p => ({ ...(p || {}), [key]: value }));
    try {
      const fresh = await api.setPrivacy({ [key]: value });
      setPrivacyState(fresh);
    } catch (e) {
      console.error('[privacy:set]', e);
      setPrivacyState(prev);
      toast.error('Errore — riprova');
    }
  };
  // Backward-compat: if `can` is missing, fall back to isAdmin gating
  const allow = perm => typeof can === 'function' ? can(perm) : !!isAdmin;
  const canCats     = allow('manage_categories');
  const canCredits  = allow('manage_credits');
  const canReset    = allow('reset_season');
  const [newE,setNewE]=useState("🎯");
  const [newLabel,setNewLabel]=useState("");
  const [newColor,setNewColor]=useState(CAT_COLS[0]);
  const [pinPhase,setPinPhase]=useState(null);
  const [pin1,setPin1]=useState("");
  const [pin2,setPin2]=useState("");
  const [pinErr,setPinErr]=useState("");
  const [creditAmounts, setCreditAmounts] = useState({});
  const [creditConfirm, setCreditConfirm] = useState(null);
  const [creditErr, setCreditErr] = useState({});
  const [showResetConfirm,setShowResetConfirm]=useState(false);
  const [showTestResetConfirm, setShowTestResetConfirm] = useState(false);
  const [notifPrefs,setNotifPrefs]=useState({
    on_group_bet:true, on_challenged:true, on_targeted:true,
    on_resolved:true, on_expiry:true, on_bet_message:true,
  });
  const [membersOpen, setMembersOpen] = useState(false);
  const [creditsOpen, setCreditsOpen] = useState(false);
  const myProfile = profiles[user];

  useEffect(()=>{
    api.getNotifPrefs(user).then(setNotifPrefs).catch(console.error);
  },[user]);

  // Saved bets — stored per-user in localStorage, updated via custom event
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`bc_saved_bets_${user}`) || '[]'); } catch { return []; }
  });
  const [savedOpen, setSavedOpen] = useState(false);
  useEffect(() => {
    const handler = () => {
      try { setSavedIds(JSON.parse(localStorage.getItem(`bc_saved_bets_${user}`) || '[]')); }
      catch { setSavedIds([]); }
    };
    window.addEventListener('bc_saved_change', handler);
    return () => window.removeEventListener('bc_saved_change', handler);
  }, [user]);

  // Templates management
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  useEffect(() => { api.listTemplates().then(setTemplates).catch(() => {}); }, []);
  const handleDeleteTemplate = async (tpl) => {
    if (!window.confirm(t('templates.delete_confirm'))) return;
    try {
      await api.deleteTemplate(tpl.id);
      setTemplates(ts => ts.filter(x => x.id !== tpl.id));
      toast.info(t('templates.deleted'));
    } catch { toast.error(t('app.error_cancel')); }
  };

  const handleDeltaCredits = async (targetUser, delta) => {
    try {
      await api.deltaCredits(targetUser, delta);
      setCreditAmounts(a => ({...a, [targetUser]: ''}));
      setCreditConfirm(null);
      setCreditErr(e => ({...e, [targetUser]: ''}));
    } catch (err) {
      const msg = err.message?.includes('400') ? t('settings.credits_err') : t('settings.acct_err_generic');
      setCreditErr(e => ({...e, [targetUser]: msg}));
      setCreditConfirm(null);
    }
  };

  const addCat=()=>{
    if(!newLabel.trim())return;
    onCreateCategory({id:`c${Date.now()}`,emoji:newE,label:newLabel.trim(),color:newColor});
    setNewLabel("");
  };
  const savePin=()=>{
    if(pin1.length<4){setPinErr(t('settings.pin_err_len'));return;}
    if(pin1!==pin2){setPinErr(t('settings.pin_err_match'));return;}
    onSetVaultPin(pin1);
    setPinPhase(null);setPin1("");setPin2("");setPinErr("");
  };

  return(
    <div className="sUp">
      <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:20,marginBottom:32,paddingTop:isDesktop?16:8}}>
        <div>
          <div className="bc-meta" style={{marginBottom:10}}>— Pannello</div>
          <div className="bc-hero" style={{fontSize:isDesktop?54:38}}>{t('settings.title')}</div>
        </div>
        {onLogout && (
          <button
            onClick={() => {
              if (!logoutArmed) { setLogoutArmed(true); return; }
              onLogout();
            }}
            style={{
              ...S.btn,
              background: logoutArmed ? 'var(--red)18' : 'transparent',
              color: logoutArmed ? 'var(--red)' : 'var(--dim)',
              border: logoutArmed ? '1px solid var(--red)55' : 'none',
              padding:'8px 16px', textTransform:'uppercase',
            }}
          >
            {logoutArmed ? `⚠ ${t('settings.profile_menu_logout_confirm')}` : t('settings.logout')}
          </button>
        )}
      </div>

      {/* First-visit intro — what lives in Settings, in 4 lines.
          One-shot: dismiss persists across sessions. Hidden after that. */}
      {!introDismissed && (
        <div style={{
          padding: '14px 16px', marginBottom: 18,
          background: 'var(--gold)0a',
          border: '1px solid var(--gold)44',
          borderRadius: 12,
          display: 'flex', alignItems: 'flex-start', gap: 12,
        }}>
          <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }} aria-hidden>💡</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic',
              fontSize: 16, fontWeight: 600, color: 'var(--gold)', marginBottom: 8,
            }}>{t('settings.intro_title')}</div>
            <ul style={{
              fontSize: 12, color: 'var(--dim)', lineHeight: 1.7,
              paddingLeft: 0, margin: 0, listStyle: 'none',
            }}>
              <li>🌐 <b style={{ color: 'var(--txt)' }}>{t('settings.intro_lang_label')}</b> — {t('settings.intro_lang_body')}</li>
              <li>🌗 <b style={{ color: 'var(--txt)' }}>{t('settings.intro_theme_label')}</b> — {t('settings.intro_theme_body')}</li>
              <li>👤 <b style={{ color: 'var(--txt)' }}>{t('settings.intro_profile_label')}</b> — {t('settings.intro_profile_body')}</li>
              <li>🔔 <b style={{ color: 'var(--txt)' }}>{t('settings.intro_push_label')}</b> — {t('settings.intro_push_body')}</li>
              <li>🔒 <b style={{ color: 'var(--txt)' }}>{t('settings.intro_privacy_label')}</b> — {t('settings.intro_privacy_body')}</li>
              <li>👥 <b style={{ color: 'var(--txt)' }}>{t('settings.intro_groups_label')}</b> — {t('settings.intro_groups_body')}</li>
              <li>🏷 <b style={{ color: 'var(--txt)' }}>{t('settings.intro_cats_label')}</b> — {t('settings.intro_cats_body')}</li>
              <li>🛡 <b style={{ color: 'var(--txt)' }}>{t('settings.intro_vault_label')}</b> — {t('settings.intro_vault_body')}</li>
            </ul>
            <button onClick={dismissIntro} style={{
              marginTop: 12, padding: '6px 14px', borderRadius: 999,
              background: 'var(--gold)', border: 'none', color: '#1a1530',
              fontFamily: "'Manrope',sans-serif", fontSize: 10, fontWeight: 800,
              letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
            }}>{t('settings.intro_dismiss')}</button>
          </div>
          <button onClick={dismissIntro} aria-label="Chiudi"
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--mut)', fontSize: 18, padding: '0 4px', lineHeight: 1,
              flexShrink: 0,
            }}>×</button>
        </div>
      )}

      {/* LANGUAGE */}
      <SecLabel>{t('settings.lang_label')}</SecLabel>
      <div style={{...S.card,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <div style={{fontSize:14,fontWeight:600}}>{t('settings.lang_label')}</div>
          <div style={{fontSize:12,color:"var(--dim)"}}>{t('settings.lang_desc')}</div>
        </div>
        <div style={{display:"flex",gap:6}}>
          <Btn variant={lang==='it'?'gold':'ghost'} sm onClick={()=>setLang('it')}>🇮🇹 IT</Btn>
          <Btn variant={lang==='en'?'gold':'ghost'} sm onClick={()=>setLang('en')}>🇬🇧 EN</Btn>
        </div>
      </div>

      {/* THEME — five-way selector. Persists to LS. */}
      <SecLabel>{t('settings.theme')}</SecLabel>
      <div style={{...S.card,marginBottom:12}}>
        <div style={{marginBottom:12}}>
          <div style={{fontSize:14,fontWeight:600}}>
            {{dark:t('settings.theme_dark'),light:t('settings.theme_light'),amber:t('settings.theme_amber'),selva:t('settings.theme_selva'),sakura:t('settings.theme_sakura'),pece:t('settings.theme_pece')}[theme] ?? t('settings.theme_dark')}
          </div>
          <div style={{fontSize:12,color:"var(--dim)"}}>{t('settings.theme_desc')}</div>
        </div>
        <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(100px, 1fr))', gap:8}}>
          {[
            {id:'dark',   label:t('settings.theme_dark'),   preview:['#1a1530','#c4a878']},
            {id:'light',  label:t('settings.theme_light'),  preview:['#ede8d8','#7a5e30']},
            {id:'amber',  label:t('settings.theme_amber'),  preview:['#1f1108','#e8b86a']},
            {id:'selva',  label:t('settings.theme_selva'),  preview:['#0d1b10','#c8a040']},
            {id:'sakura', label:t('settings.theme_sakura'), preview:['#1e1018','#e8b0b0']},
            {id:'pece',   label:t('settings.theme_pece'),   preview:['#0c0c0e','#c8b896']},
          ].map(opt => {
            const active = (theme || (isDark ? 'dark' : 'light')) === opt.id;
            return (
              <button key={opt.id} type="button"
                onClick={() => setTheme ? setTheme(opt.id) : setIsDark(opt.id === 'dark')}
                style={{
                  display:'flex', alignItems:'center', gap:8,
                  padding:'8px 12px', borderRadius:999,
                  border: `1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
                  background: active ? 'var(--gold)18' : 'transparent',
                  color: active ? 'var(--gold)' : 'var(--dim)',
                  fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:700,
                  letterSpacing:'.04em', cursor:'pointer',
                  transition:'all .18s',
                  WebkitTapHighlightColor:'transparent', touchAction:'manipulation',
                  whiteSpace:'nowrap',
                }}>
                <span style={{
                  width: 16, height: 16, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${opt.preview[0]} 50%, ${opt.preview[1]} 50%)`,
                  border: `1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
                  flexShrink: 0,
                }}/>
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* MY PROFILE — compact card → opens edit modal on click */}
      <SecLabel>{t('settings.my_profile')}</SecLabel>
      {myProfile && (() => {
        const c = COLORS[myProfile.colorKey] || '#5b8af0';
        return (
          <div onClick={() => onOpenProfileEdit?.()} className="card-hover"
            style={{...S.card, marginBottom:10, cursor:'pointer', display:'flex', alignItems:'center', gap:14}}>
            <div style={{
              width:54, height:54, borderRadius:'50%',
              background:`${c}33`, border:`2px solid ${c}66`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontSize:28, overflow:'hidden', flexShrink:0,
              boxShadow:`0 0 12px ${c}33`,
            }}>
              {myProfile.avatarUrl
                ? <img src={myProfile.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                : (myProfile.avatar || '🃏')}
            </div>
            <div style={{flex:1, minWidth:0}}>
              <div style={{fontFamily:"'Cormorant Garamond',serif", fontSize:17, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                {myProfile.name}
              </div>
              <div style={{fontSize:11, color:'var(--dim)', marginTop:2}}>
                {t('profile.tap_to_edit')}
              </div>
            </div>
            <div style={{
              fontSize:14, color:'var(--gold)', fontFamily:"'Manrope',sans-serif", fontWeight:700,
              padding:'6px 12px', borderRadius:20,
              border:'1px solid var(--gold)44', background:'var(--gold)0d',
              flexShrink:0,
            }}>✏️</div>
          </div>
        );
      })()}

      {myProfile && (
        <div style={{marginBottom:12}}>
          <button onClick={()=>window.open(`/api/bets/export/${user}`,'_blank')} style={{...S.btn,padding:'7px 13px',fontSize:12,background:'transparent',border:'1px solid var(--brd)',color:'var(--dim)'}}>
            ⬇ {t('settings.export_btn')}
          </button>
        </div>
      )}

      {/* PUSH STATUS — diagnostic + manual enable button */}
      <PushStatusPanel user={user} S={S} t={t} toast={toast}/>

      {/* NOTIFICATIONS */}
      <SecLabel mt={16}>{t('settings.notif_title')}</SecLabel>
      <div style={{...S.card,marginBottom:12}}>
        {[
          {key:'on_group_bet',   label:t('settings.notif_group_bet'),   desc:t('settings.notif_group_bet_desc')},
          {key:'on_challenged',  label:t('settings.notif_challenged'),  desc:t('settings.notif_challenged_desc')},
          {key:'on_targeted',    label:t('settings.notif_targeted'),    desc:t('settings.notif_targeted_desc')},
          {key:'on_resolved',    label:t('settings.notif_resolved'),    desc:t('settings.notif_resolved_desc')},
          {key:'on_expiry',      label:t('settings.notif_expiry'),      desc:t('settings.notif_expiry_desc')},
          {key:'on_bet_message', label:t('settings.notif_bet_message'), desc:t('settings.notif_bet_message_desc')},
        ].map(({key,label,desc},i,arr)=>(
          <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:i<arr.length-1?'1px solid var(--brd)':'none',gap:10}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:600}}>{label}</div>
              <div style={{fontSize:11,color:'var(--dim)',marginTop:2}}>{desc}</div>
            </div>
            <button onClick={()=>{
              const next={...notifPrefs,[key]:!notifPrefs[key]};
              setNotifPrefs(next);
              api.saveNotifPrefs(next).catch(console.error);
            }} style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',position:'relative',background:notifPrefs[key]?'var(--gold)':'var(--brd)',transition:'background .2s',flexShrink:0}}>
              <div style={{position:'absolute',top:3,width:18,height:18,borderRadius:9,background:'#fff',left:notifPrefs[key]?23:3,transition:'left .2s'}}/>
            </button>
          </div>
        ))}
      </div>

      {/* PRIVACY — single card with 3 segmented rows (trophies / stats /
          groups). Each row: Public / Friends / Private. The whole block
          lives under one SecLabel so it reads as ONE setting, not three.
          Updates fire on click; backend echoes canonical state back. */}
      {privacy && (() => {
        const SECTIONS = [
          { key: 'trophies', icon: '🏆', label: t('settings.privacy_trophies'),  body: t('settings.privacy_trophies_desc') },
          { key: 'stats',    icon: '📊', label: t('settings.privacy_stats'),     body: t('settings.privacy_stats_desc') },
          { key: 'groups',   icon: '👥', label: t('settings.privacy_groups'),    body: t('settings.privacy_groups_desc') },
        ];
        const LEVELS = [
          { value: 'public',  short: '🌍', label: t('settings.privacy_public') },
          { value: 'friends', short: '🤝', label: t('settings.privacy_friends') },
          { value: 'private', short: '🔒', label: t('settings.privacy_private') },
        ];
        return (
          <>
            <SecLabel mt={16}>{t('settings.privacy_title')}</SecLabel>
            <div style={{ ...S.card, marginBottom: 12 }}>
              {SECTIONS.map((s, i) => (
                <div key={s.key} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 0',
                  borderTop: i === 0 ? 'none' : '1px solid var(--rule)',
                  flexWrap: 'wrap',
                }}>
                  <span aria-hidden style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', lineHeight: 1.4, marginTop: 2 }}>{s.body}</div>
                  </div>
                  <div role="radiogroup" aria-label={s.label}
                    style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {LEVELS.map(lv => {
                      const active = privacy[s.key] === lv.value;
                      return (
                        <button key={lv.value}
                          onClick={() => !active && updatePrivacy(s.key, lv.value)}
                          aria-pressed={active}
                          title={lv.label}
                          style={{
                            padding: '6px 10px', borderRadius: 999, cursor: active ? 'default' : 'pointer',
                            border: `1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
                            background: active ? 'var(--gold)1a' : 'transparent',
                            color: active ? 'var(--gold)' : 'var(--dim)',
                            fontFamily: "'Manrope',sans-serif", fontSize: 10, fontWeight: 700,
                            letterSpacing: '.04em', whiteSpace: 'nowrap',
                            WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
                          }}>
                          <span aria-hidden style={{ marginRight: 4 }}>{lv.short}</span>{lv.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        );
      })()}

      {/* GROUP MEMBERS (collapsible — read-only) */}
      {(() => {
        const partnerIds = Object.keys(profiles).filter(k => k !== user);
        if (partnerIds.length === 0) return null;
        return (
          <>
            <SecLabel mt={16}>{t('settings.partner')}</SecLabel>
            <div style={{
              ...S.card, marginBottom: 12, padding: 0, overflow: 'hidden',
            }}>
              <button
                onClick={() => setMembersOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--txt)', textAlign: 'left',
                  fontFamily: "'Manrope',sans-serif",
                }}
              >
                <div style={{
                  display: 'flex', alignItems: 'center',
                }}>
                  {partnerIds.slice(0, 3).map((id, i) => {
                    const p = profiles[id];
                    const color = COLORS[p?.colorKey] || '#5b8af0';
                    return (
                      <div key={id} style={{
                        width: 26, height: 26, borderRadius: '50%',
                        background: `${color}33`,
                        border: '2px solid var(--card)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, overflow: 'hidden', flexShrink: 0,
                        marginLeft: i === 0 ? 0 : -8,
                        zIndex: 5 - i,
                      }}>
                        {p?.avatarUrl
                          ? <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                          : (p?.avatar || '😊')}
                      </div>
                    );
                  })}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>
                    {partnerIds.length === 1
                      ? t('settings.members_count_one')
                      : t('settings.members_count', { n: partnerIds.length })}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                    {membersOpen ? t('settings.members_hide') : t('settings.members_show')}
                  </div>
                </div>
                <span style={{
                  fontSize: 12, color: 'var(--dim)', flexShrink: 0,
                  transform: membersOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform .2s',
                }}>▾</span>
              </button>

              {membersOpen && (
                <div style={{ borderTop: '1px solid var(--brd)' }}>
                  {partnerIds.map(k => {
                    const p = profiles[k];
                    const color = COLORS[p?.colorKey] || '#5b8af0';
                    return (
                      <div key={k} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px',
                        borderTop: '1px solid var(--brd)33',
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: '50%',
                          background: `${color}33`, border: `2px solid ${color}66`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 14, overflow: 'hidden', flexShrink: 0,
                        }}>
                          {p?.avatarUrl
                            ? <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                            : (p?.avatar || '😊')}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 13,
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {p?.name}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        );
      })()}

      {/* CUSTOM CATS */}
      <SecLabel>{t('settings.custom_cats')}</SecLabel>
      {canCats ? (
        <div style={{...S.card,marginBottom:12}}>
          {customCats.map(c=>(
            <div key={c.id} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,paddingBottom:8,borderBottom:"1px solid var(--brd)"}}>
              <span style={{fontSize:18}}>{c.e||c.emoji}</span>
              <span style={{flex:1,fontSize:13}}>{c.label}</span>
              <div style={{width:12,height:12,borderRadius:"50%",background:c.color}}/>
              <Btn variant="ghost" sm style={{color:"var(--red)",borderColor:"var(--red)22",padding:"4px 8px"}} onClick={()=>onDeleteCategory(c.id)}>✕</Btn>
            </div>
          ))}
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",marginTop:4}}>
            <Inp value={newE} onChange={e=>setNewE(e.target.value)} style={{width:56,textAlign:"center",fontSize:20,padding:"6px 8px"}} placeholder="🎯"/>
            <Inp value={newLabel} onChange={e=>setNewLabel(e.target.value)} style={{flex:1,minWidth:100}} placeholder={t('settings.cat_name_ph')}/>
            <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
              {CAT_COLS.map(col=><div key={col} onClick={()=>setNewColor(col)} style={{width:20,height:20,borderRadius:"50%",background:col,cursor:"pointer",border:`2px solid ${newColor===col?"#fff":"transparent"}`}}/>)}
            </div>
            <Btn variant="gold" sm onClick={addCat}>{t('settings.cat_add')}</Btn>
          </div>
        </div>
      ) : (
        <div style={{...S.card,marginBottom:12,opacity:.5}}>
          <div style={{fontSize:13,color:'var(--dim)'}}>{t('settings.admin_only')}</div>
        </div>
      )}

      {/* TEMPLATES */}
      <SecLabel mt={16}>💾 {t('templates.title_settings')}</SecLabel>
      <div style={{...S.card, marginBottom:12}}>
        {templates.length === 0 ? (
          <div style={{fontSize:12, color:'var(--dim)', textAlign:'center', padding:'8px 0'}}>
            {t('templates.empty')}
          </div>
        ) : (
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {templates.map(tpl => (
              <div key={tpl.id} style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'8px 10px', borderRadius:8,
                border:'1px solid var(--brd)', background:'var(--surf)',
              }}>
                <div style={{fontSize:18, color:'var(--gold)'}}>💾</div>
                <div style={{flex:1, minWidth:0}}>
                  <div style={{fontSize:13, fontWeight:700, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                    {tpl.name}
                  </div>
                  <div style={{fontSize:11, color:'var(--dim)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', marginTop:1}}>
                    "{tpl.title}" · {fmtQ(tpl.quota)}× · {tpl.stake} ₡
                  </div>
                </div>
                <button onClick={() => handleDeleteTemplate(tpl)} style={{
                  ...S.btn, padding:'4px 10px', fontSize:11,
                  background:'transparent', border:'1px solid var(--red)44', color:'var(--red)',
                }}>{t('templates.delete_btn')}</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SAVED BETS */}
      <SecLabel mt={16}>★ Bet preferite</SecLabel>
      <div style={{...S.card, marginBottom:12}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div style={{fontSize:14, fontWeight:600}}>
              {savedIds.length === 0 ? 'Nessuna bet salvata' : `${savedIds.length} bet salvat${savedIds.length === 1 ? 'a' : 'e'}`}
            </div>
            <div style={{fontSize:12, color:'var(--dim)', marginTop:2}}>
              Usa ★ su ogni bet per aggiungerla qui
            </div>
          </div>
          {savedIds.length > 0 && (
            <button onClick={() => setSavedOpen(o => !o)} style={{
              ...S.btn, padding:'6px 14px', fontSize:11,
              background:'transparent', border:'1px solid var(--gold)44', color:'var(--gold)',
            }}>{savedOpen ? 'Nascondi' : 'Mostra'}</button>
          )}
        </div>
        {savedOpen && savedIds.length > 0 && (() => {
          const saved = (bets || []).filter(b => savedIds.includes(b.id));
          if (saved.length === 0) return (
            <div style={{fontSize:12, color:'var(--dim)', marginTop:12, fontStyle:'italic'}}>
              Le bet salvate non sono più disponibili in questo gruppo.
            </div>
          );
          return (
            <div style={{marginTop:12, display:'flex', flexDirection:'column', gap:8}}>
              {saved.map(b => {
                const isDone = ['won','lost','rejected'].includes(b.status);
                const statusColor = b.status==='won' ? 'var(--grn)' : b.status==='lost' ? 'var(--red)' : 'var(--dim)';
                return (
                  <div key={b.id} style={{
                    display:'flex', alignItems:'center', gap:10,
                    padding:'10px 12px', borderRadius:10,
                    border:'1px solid var(--brd)', background:'var(--surf)',
                  }}>
                    <span style={{fontSize:20, flexShrink:0, color:'var(--gold)'}}>★</span>
                    <div style={{flex:1, minWidth:0}}>
                      <div style={{
                        fontSize:13, fontWeight:700,
                        fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic',
                        whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis',
                      }}>{b.title}</div>
                      <div style={{fontSize:10, color:'var(--dim)', marginTop:2, letterSpacing:'.08em'}}>
                        {b.stake} ₡ · {b.potentialWin} ₡ win
                        {isDone && <span style={{marginLeft:6, color:statusColor, fontWeight:700}}>
                          {b.status==='won'?'✦ Vinta':b.status==='lost'?'✗ Persa':'✕ Annullata'}
                        </span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>

      {/* VAULT PIN */}
      <SecLabel mt={16}>{t('settings.vault_pin')}</SecLabel>
      <div style={{...S.card,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div>
            <div style={{fontSize:14,fontWeight:600}}>{vaultPin?t('settings.vault_active'):t('settings.vault_none')}</div>
            <div style={{fontSize:12,color:"var(--dim)",marginTop:2}}>{vaultPin?t('settings.vault_protected'):t('settings.vault_accessible')}</div>
            <div style={{fontSize:10,color:"var(--mut)",marginTop:4}}>{t('settings.vault_warning')}</div>
          </div>
        </div>
        {pinErr&&<div style={{fontSize:12,color:"var(--red)",marginBottom:8}}>{pinErr}</div>}
        {pinPhase==="set"&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>{t('settings.pin_new')}</div>
            <Inp type="text" value={pin1} onChange={e=>setPin1(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:8}}/>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>{t('settings.pin_confirm')}</div>
            <Inp type="text" value={pin2} onChange={e=>setPin2(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="gold" sm onClick={savePin}>{t('settings.pin_save')}</Btn>
              <Btn variant="ghost" sm onClick={()=>{setPinPhase(null);setPin1("");setPin2("");setPinErr("");}}>{t('settings.pin_cancel')}</Btn>
            </div>
          </div>
        )}
        {!pinPhase&&(
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" sm onClick={()=>setPinPhase("set")}>{vaultPin?t('settings.pin_change'):t('settings.pin_set')}</Btn>
            {vaultPin&&<Btn variant="ghost" sm style={{color:"var(--red)",borderColor:"var(--red)22"}} onClick={()=>onSetVaultPin(null)}>{t('settings.pin_remove')}</Btn>}
          </div>
        )}
      </div>

      {/* CREDITS */}
      <SecLabel mt={16}>{t('settings.credits_section')}</SecLabel>
      {!canCredits && (
        <div style={{...S.card,opacity:.5}}>
          <div style={{fontSize:13,color:'var(--dim)'}}>{t('settings.admin_only')}</div>
        </div>
      )}
      {canCredits && (
        Object.keys(profiles).length === 0 ? (
          <div style={{...S.card,opacity:.6}}>
            <div style={{fontSize:13,color:'var(--dim)',textAlign:'center'}}>{t('settings.loading')}</div>
          </div>
        ) : (
          (() => {
            // Order: me first, then group members in join order, then any
            // other profiles still in state.
            const ordered = (() => {
              const known = new Set();
              const out = [];
              if (profiles[user]) { out.push(user); known.add(user); }
              if (groupMembers?.length) {
                for (const m of groupMembers) {
                  if (!known.has(m.id) && profiles[m.id]) { out.push(m.id); known.add(m.id); }
                }
              }
              for (const k of Object.keys(profiles)) {
                if (!known.has(k)) { out.push(k); known.add(k); }
              }
              return out;
            })();
            // Mirror the collapsible used by the GROUP MEMBERS section
            // above — avatar stack + count + chevron, content tucked under.
            // Default collapsed so the page stays short on mobile (the user
            // explicitly asked to stop having to scroll to reach the bottom).
            return (
              <div style={{
                ...S.card, marginBottom: 12, padding: 0, overflow: 'hidden',
              }}>
                <button
                  onClick={() => setCreditsOpen(o => !o)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '12px 14px',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'var(--txt)', textAlign: 'left',
                    fontFamily: "'Manrope',sans-serif",
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {ordered.slice(0, 3).map((id, i) => {
                      const p = profiles[id];
                      const color = COLORS[p?.colorKey] || '#5b8af0';
                      return (
                        <div key={id} style={{
                          width: 26, height: 26, borderRadius: '50%',
                          background: `${color}33`,
                          border: '2px solid var(--card)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, overflow: 'hidden', flexShrink: 0,
                          marginLeft: i === 0 ? 0 : -8,
                          zIndex: 5 - i,
                        }}>
                          {p?.avatarUrl
                            ? <img src={p.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }}/>
                            : (p?.avatar || '😊')}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>
                      {ordered.length === 1
                        ? t('settings.members_count_one')
                        : t('settings.members_count', { n: ordered.length })}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 2 }}>
                      {creditsOpen ? t('settings.credits_hide') : t('settings.credits_show')}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, color: 'var(--dim)', flexShrink: 0,
                    transform: creditsOpen ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform .2s',
                  }}>▾</span>
                </button>

                {creditsOpen && (
                  <div style={{ borderTop: '1px solid var(--brd)', padding: 16 }}>
                    {ordered.map((k, i) => {
                      const p=profiles[k]; const amt=parseFloat(creditAmounts[k])||0;
                      const isMe = k === user;
                      return(
                        <div key={k} style={{
                          marginBottom: i < ordered.length - 1 ? 14 : 0,
                          paddingBottom: i < ordered.length - 1 ? 14 : 0,
                          borderBottom: i < ordered.length - 1 ? '1px solid var(--brd)33' : 'none',
                        }}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                            <div style={{fontSize:24}}>{p.avatar}</div>
                            <div style={{flex:1}}>
                              <div style={{fontSize:13,fontWeight:600}}>{p.name}{isMe ? ` · ${t('settings.you')}` : ''}</div>
                              <div style={{fontSize:12,color:"var(--gold)",fontWeight:700}}>{t('settings.balance')} {Math.round(credits[k]||0)} ₡</div>
                            </div>
                          </div>
                          {creditErr[k]&&<div style={{fontSize:12,color:"var(--red)",marginBottom:6}}>{creditErr[k]}</div>}
                          {(creditConfirm?.user===k?(
                            <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                              <div style={{fontSize:13,color:"var(--dim)",flex:1}}>
                                {t('settings.credits_confirm_q',{amount:creditConfirm.amount,name:p.name})}
                              </div>
                              <Btn variant="red" sm onClick={()=>handleDeltaCredits(k,-creditConfirm.amount)}>{t('settings.credits_confirm')}</Btn>
                              <Btn variant="ghost" sm onClick={()=>setCreditConfirm(null)}>{t('settings.credits_cancel')}</Btn>
                            </div>
                          ):(
                            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                              <Inp
                                type="number"
                                min={1}
                                max={9999}
                                value={creditAmounts[k]||''}
                                onChange={e=>setCreditAmounts(a=>({...a,[k]:e.target.value}))}
                                placeholder={t('settings.amount_ph')}
                                style={{width:90,padding:"6px 10px",fontSize:13}}
                              />
                              <Btn variant="grn" sm onClick={()=>{
                                if(!amt||amt<1)return;
                                handleDeltaCredits(k, Math.floor(amt));
                              }}>{t('settings.credits_add')}</Btn>
                              <Btn variant="ghost" sm style={{color:"var(--red)",borderColor:"var(--red)22"}} onClick={()=>{
                                if(!amt||amt<1)return;
                                setCreditConfirm({user:k, amount:Math.floor(amt)});
                                setCreditErr(e=>({...e,[k]:''}));
                              }}>{t('settings.credits_sub')}</Btn>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()
        )
      )}

      {/* DANGER ZONE */}
      <div style={{marginTop:32,paddingTop:24,borderTop:'1px solid var(--red)33'}}>
        <SecLabel style={{color:'var(--red)88'}}>{t('settings.danger_zone')}</SecLabel>
        {!canReset && (
          <div style={{...S.card,opacity:.5}}>
            <div style={{fontSize:13,color:'var(--dim)'}}>{t('settings.admin_only')}</div>
          </div>
        )}
        {canReset && (
          <>
            {/* Test reset — hidden in production. To enable in prod for one-off
                debugging: localStorage.setItem('bc_dev_tools','1') + reload.   */}
            {(import.meta.env.DEV || (typeof localStorage !== 'undefined' && localStorage.getItem('bc_dev_tools') === '1')) && (
              showTestResetConfirm ? (
                <div style={{...S.raised,border:'1px solid var(--red)',background:'var(--red)0d', marginBottom:10}}>
                  <div style={{fontSize:14,fontWeight:700,color:'var(--red)',marginBottom:8}}>{t('settings.test_reset_confirm_title')}</div>
                  <div style={{fontSize:12,color:'var(--dim)',marginBottom:16}}>{t('settings.test_reset_confirm_desc')}</div>
                  <div style={{display:'flex',gap:10}}>
                    <button onClick={()=>setShowTestResetConfirm(false)} style={{...S.btn,flex:1,background:'transparent',border:'1px solid var(--brd)',color:'var(--dim)'}}>{t('settings.reset_cancel')}</button>
                    <button onClick={()=>{onTestReset?.();setShowTestResetConfirm(false);}} style={{...S.btn,flex:1,background:'var(--red)',border:'none',color:'#fff',fontWeight:700}}>{t('settings.test_reset_confirm_btn')}</button>
                  </div>
                </div>
              ) : (
                <div style={{...S.raised,border:'1px dashed var(--red)44', marginBottom:10}}>
                  <div style={{fontSize:13,fontWeight:600,marginBottom:4}}>🧪 {t('settings.test_reset_title')}</div>
                  <div style={{fontSize:11,color:'var(--dim)',marginBottom:12}}>{t('settings.test_reset_desc')}</div>
                  <button onClick={()=>setShowTestResetConfirm(true)} style={{...S.btn,width:'100%',background:'transparent',border:'1px solid var(--red)44',color:'var(--red)',fontSize:12}}>
                    {t('settings.test_reset_btn')}
                  </button>
                </div>
              )
            )}

            {/* Full season reset (preserves trophies) */}
            {showResetConfirm ? (
              <div style={{...S.raised,border:'1px solid var(--red)',background:'var(--red)0d'}}>
                <div style={{fontSize:14,fontWeight:700,color:'var(--red)',marginBottom:8}}>{t('settings.reset_confirm_title')}</div>
                <div style={{fontSize:12,color:'var(--dim)',marginBottom:16}}>{t('settings.reset_confirm_desc')}</div>
                <div style={{display:'flex',gap:10}}>
                  <button onClick={()=>setShowResetConfirm(false)} style={{...S.btn,flex:1,background:'transparent',border:'1px solid var(--brd)',color:'var(--dim)'}}>{t('settings.reset_cancel')}</button>
                  <button onClick={()=>{onReset();setShowResetConfirm(false);}} style={{...S.btn,flex:1,background:'var(--red)',border:'none',color:'#fff',fontWeight:700}}>{t('settings.reset_confirm_btn')}</button>
                </div>
              </div>
            ) : (
              <div style={{...S.raised,border:'1px solid var(--red)33'}}>
                <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{t('settings.reset_title')}</div>
                <div style={{fontSize:12,color:'var(--dim)',marginBottom:14}}>{t('settings.reset_desc',{count:(bets||[]).filter(b=>b.status==='active').length,total:(bets||[]).length})}</div>
                <button onClick={()=>setShowResetConfirm(true)} style={{...S.btn,width:'100%',background:'transparent',border:'1px solid var(--red)66',color:'var(--red)',fontSize:13}}>
                  🏆 {t('settings.reset_btn')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Push status diagnostic panel ────────────────────────────────────
// Shows the live permission state, with a manual "Abilita" button when
// permission is still default (silent dismiss at first login is the
// #1 reason users miss push notifications). Denied state shows
// platform-specific recovery instructions, since the browser will not
// re-prompt programmatically.
function PushStatusPanel({ user, S, t, toast }) {
  const [state, setState] = React.useState(readPushState());
  const [busy, setBusy]   = React.useState(false);

  // Refresh state on focus so toggling permission in browser settings
  // reflects without a hard reload.
  React.useEffect(() => {
    const refresh = () => setState(readPushState());
    window.addEventListener(focus, refresh);
    return () => window.removeEventListener(focus, refresh);
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const result = await registerPush(user);
      setState(readPushState());
      if (result === "granted")      toast.success(t("settings.push_enabled_ok"));
      else if (result === "denied")  toast.error(t("settings.push_denied"));
      else if (result === "unsupported") toast.error(t("settings.push_unsupported"));
      else toast.info(t("settings.push_default"));
    } catch (e) {
      console.error(e);
      toast.error(t("settings.push_error"));
    } finally { setBusy(false); }
  };

  const statusColor =
      state === "granted" ? "var(--grn)"
    : state === "denied"  ? "var(--red)"
    :                       "var(--gold)";

  const statusLabel = t("settings.push_state_" + state) || state;

  return (
    <>
      <SecLabel mt={16}>{t("settings.push_title")}</SecLabel>
      <div style={{...S.card, marginBottom: 12}}>
        <div style={{display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, padding:"6px 0"}}>
          <div style={{flex:1, minWidth:0}}>
            <div style={{fontSize:13, fontWeight:600, color:"var(--txt)"}}>
              {t("settings.push_state_label")}
            </div>
            <div style={{fontSize:11, color: statusColor, marginTop:2, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase"}}>
              {statusLabel}
            </div>
          </div>
          {state !== "granted" && state !== "unsupported" && (
            <button onClick={enable} disabled={busy} style={{
              ...S.btn, background:"var(--gold)", color:"#1a1530",
              opacity: busy ? .5 : 1, cursor: busy ? "wait" : "pointer",
            }}>
              {state === "denied" ? t("settings.push_retry") : t("settings.push_enable")}
            </button>
          )}
        </div>
        {state === "denied" && (
          <div style={{fontSize:11.5, color:"var(--dim)", lineHeight:1.5, marginTop:10, paddingTop:10, borderTop:"1px solid var(--brd)"}}>
            {isIOS ? t("settings.push_hint_ios") : t("settings.push_hint_android")}
          </div>
        )}
        {state === "default" && (
          <div style={{fontSize:11.5, color:"var(--dim)", lineHeight:1.5, marginTop:10, paddingTop:10, borderTop:"1px solid var(--brd)"}}>
            {t("settings.push_hint_default")}
          </div>
        )}
        {state === "unsupported" && (
          <div style={{fontSize:11.5, color:"var(--dim)", lineHeight:1.5, marginTop:10, paddingTop:10, borderTop:"1px solid var(--brd)"}}>
            {t("settings.push_hint_unsupported")}
          </div>
        )}
      </div>
    </>
  );
}
