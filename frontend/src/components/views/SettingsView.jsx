import React, { useState, useEffect, useRef } from 'react';
import { Btn, Inp, Toggle, SecLabel, AVATARS, COLORS, CAT_COLS } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import * as api from '../../api.js';
import { fileToSquareDataUrl } from '../../imageUtils.js';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  inp: {background:"var(--inp)",border:"1px solid var(--brd)",color:"var(--txt)",borderRadius:10,padding:"10px 14px",fontFamily:"'Syne',sans-serif",fontSize:14,outline:"none",width:"100%"},
  btn: {display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,padding:"10px 18px",borderRadius:10,border:"none",cursor:"pointer",fontFamily:"'Syne',sans-serif",fontSize:13,fontWeight:600,transition:"all .18s",userSelect:"none",whiteSpace:"nowrap"},
};

export default function SettingsView({user,profiles,isDark,setIsDark,customCats,credits,bets,onUpdateProfile,onCreateCategory,onDeleteCategory,vaultPin,onSetVaultPin,isDesktop,onReset,onLogout,onProfileUpdate,isAdmin=false}){
  const { t, lang, setLang } = useLang();
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
  const [notifPrefs,setNotifPrefs]=useState({on_new_bet:true,on_resolved:true,on_expiry:true});
  const [profileName, setProfileName] = useState('');
  const [profileAvatar, setProfileAvatar] = useState('');
  const [profileColor, setProfileColor] = useState('');
  const [profileAvatarUrl, setProfileAvatarUrl] = useState(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const fileInputRef = useRef(null);

  const myProfile = profiles[user];

  useEffect(()=>{
    if (myProfile) {
      setProfileName(myProfile.name || '');
      setProfileAvatar(myProfile.avatar || '😊');
      setProfileColor(myProfile.colorKey || 'blue');
      setProfileAvatarUrl(myProfile.avatarUrl || null);
    }
  },[user, myProfile?.avatarUrl]);

  const handleAvatarFile = async e => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setAvatarBusy(true);
    try {
      const dataUrl = await fileToSquareDataUrl(f, 512, 0.85);
      const { avatar_url } = await api.uploadAvatar(dataUrl);
      setProfileAvatarUrl(avatar_url);
      onProfileUpdate?.({ avatarUrl: avatar_url });
    } catch (err) { console.error(err); }
    finally { setAvatarBusy(false); }
  };

  const handleRemoveAvatar = async () => {
    setAvatarBusy(true);
    try {
      await api.deleteAvatar();
      setProfileAvatarUrl(null);
      onProfileUpdate?.({ avatarUrl: null });
    } catch (err) { console.error(err); }
    finally { setAvatarBusy(false); }
  };

  useEffect(()=>{
    api.getNotifPrefs(user).then(setNotifPrefs).catch(console.error);
  },[user]);

  const saveProfile = async () => {
    try {
      await api.updateProfile({ name: profileName, avatar: profileAvatar, color_key: profileColor });
      onProfileUpdate?.({ name: profileName, avatar: profileAvatar, colorKey: profileColor });
    } catch (e) { console.error(e); }
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
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700}}>{t('settings.title')}</div>
        {onLogout && (
          <button onClick={onLogout} style={{...S.btn,padding:'7px 14px',background:'transparent',border:'1px solid var(--brd)',color:'var(--dim)',fontSize:12}}>
            {t('settings.logout')}
          </button>
        )}
      </div>

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

      {/* MY PROFILE */}
      <SecLabel>{t('settings.my_profile')}</SecLabel>
      {myProfile && (
        <div style={{...S.card,marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            {profileAvatarUrl
              ? <img src={profileAvatarUrl} alt="" style={{width:48,height:48,borderRadius:"50%",objectFit:"cover",border:"2px solid var(--gold)44"}}/>
              : <div style={{fontSize:32}}>{profileAvatar}</div>}
            <div style={{flex:1}}>
              <Inp value={profileName} onChange={e=>setProfileName(e.target.value.slice(0,16))} style={{fontWeight:600}}/>
            </div>
          </div>

          {/* Upload row */}
          <div style={{fontSize:11,color:"var(--dim)",marginBottom:8}}>Foto personalizzata</div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarFile} style={{display:"none"}} />
          <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
            <button onClick={()=>fileInputRef.current?.click()} disabled={avatarBusy} style={{...S.btn,padding:"8px 14px",fontSize:12,background:"var(--gold)22",border:"1px solid var(--gold)44",color:"var(--gold)",opacity:avatarBusy?.6:1}}>
              📷 {profileAvatarUrl ? "Cambia foto" : "Carica foto"}
            </button>
            {profileAvatarUrl && (
              <button onClick={handleRemoveAvatar} disabled={avatarBusy} style={{...S.btn,padding:"8px 14px",fontSize:12,background:"transparent",border:"1px solid var(--red)44",color:"var(--red)",opacity:avatarBusy?.6:1}}>
                ✕ Rimuovi foto
              </button>
            )}
            {avatarBusy && <span style={{fontSize:12,color:"var(--dim)",alignSelf:"center"}}>caricamento…</span>}
          </div>

          <div style={{fontSize:11,color:"var(--dim)",marginBottom:8}}>{t('settings.avatar_label')}{profileAvatarUrl ? " (fallback)" : ""}</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12, opacity: profileAvatarUrl ? .5 : 1}}>
            {AVATARS.map(a=>(
              <div key={a} onClick={()=>setProfileAvatar(a)} style={{width:36,height:36,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer",background:profileAvatar===a?"var(--gold)22":"var(--surf)",border:`1px solid ${profileAvatar===a?"var(--gold)":"var(--brd)"}`}}>{a}</div>
            ))}
          </div>
          <div style={{fontSize:11,color:"var(--dim)",marginBottom:8}}>{t('settings.color_label')}</div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:16}}>
            {Object.entries(COLORS).map(([k2,hex])=>(
              <div key={k2} onClick={()=>setProfileColor(k2)} style={{width:26,height:26,borderRadius:"50%",background:hex,cursor:"pointer",border:`3px solid ${profileColor===k2?"#fff":"transparent"}`,boxShadow:profileColor===k2?`0 0 8px ${hex}`:"none"}}/>
            ))}
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            <Btn variant="gold" sm onClick={saveProfile}>{t('settings.pin_save')}</Btn>
            <button onClick={()=>window.open(`/api/bets/export/${user}`,'_blank')} style={{...S.btn,padding:'7px 13px',fontSize:12,background:'transparent',border:'1px solid var(--brd)',color:'var(--dim)'}}>
              ⬇ {t('settings.export_btn')}
            </button>
          </div>
        </div>
      )}

      {/* PARTNER PROFILES (read-only) */}
      {Object.keys(profiles).filter(k => k !== user).length > 0 && (
        <>
          <SecLabel mt={16}>{t('settings.partner')}</SecLabel>
          {Object.keys(profiles).filter(k => k !== user).map(k => {
            const p = profiles[k];
            return (
              <div key={k} style={{...S.card,marginBottom:10,opacity:.65}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <div style={{fontSize:32}}>{p.avatar}</div>
                  <div style={{flex:1}}>
                    <div style={{fontWeight:600,fontSize:14}}>{p.name}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

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

      {/* THEME */}
      <SecLabel>{t('settings.theme')}</SecLabel>
      <div style={{...S.card,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:14,fontWeight:600}}>{isDark?t('settings.theme_dark'):t('settings.theme_light')}</div><div style={{fontSize:12,color:"var(--dim)"}}>{t('settings.theme_desc')}</div></div>
        <Toggle on={isDark} onToggle={()=>setIsDark(!isDark)}/>
      </div>

      {/* CUSTOM CATS */}
      <SecLabel>{t('settings.custom_cats')}</SecLabel>
      {isAdmin ? (
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

      {/* NOTIFICATIONS */}
      <SecLabel mt={16}>{t('settings.notif_title')}</SecLabel>
      <div style={{...S.card,marginBottom:12}}>
        {[
          {key:'on_new_bet',  label:t('settings.notif_new_bet')},
          {key:'on_resolved', label:t('settings.notif_resolved')},
          {key:'on_expiry',   label:t('settings.notif_expiry')},
        ].map(({key,label})=>(
          <div key={key} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:key!=='on_expiry'?'1px solid var(--brd)':'none'}}>
            <span style={{fontSize:13}}>{label}</span>
            <button onClick={()=>{
              const next={...notifPrefs,[key]:!notifPrefs[key]};
              setNotifPrefs(next);
              api.saveNotifPrefs(next).catch(console.error);
            }} style={{width:44,height:24,borderRadius:12,border:'none',cursor:'pointer',position:'relative',background:notifPrefs[key]?'var(--gold)':'var(--brd)',transition:'background .2s'}}>
              <div style={{position:'absolute',top:3,width:18,height:18,borderRadius:9,background:'#fff',left:notifPrefs[key]?23:3,transition:'left .2s'}}/>
            </button>
          </div>
        ))}
      </div>

      {/* CREDITS */}
      <SecLabel mt={16}>{t('settings.credits_section')}</SecLabel>
      {!isAdmin && (
        <div style={{...S.card,opacity:.5}}>
          <div style={{fontSize:13,color:'var(--dim)'}}>{t('settings.admin_only')}</div>
        </div>
      )}
      {isAdmin && (
        Object.keys(profiles).length === 0 ? (
          <div style={{...S.card,opacity:.6}}>
            <div style={{fontSize:13,color:'var(--dim)',textAlign:'center'}}>{t('settings.loading')}</div>
          </div>
        ) : (
          <div style={{...S.card}}>
            {Object.keys(profiles).map((k, i) => {
              const p=profiles[k]; const amt=parseFloat(creditAmounts[k])||0;
              const isMe = k === user;
              return(
                <div key={k} style={{marginBottom:i<Object.keys(profiles).length-1?14:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                    <div style={{fontSize:24}}>{p.avatar}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600}}>{p.name}{isMe ? ` · ${t('settings.you')}` : ''}</div>
                      <div style={{fontSize:12,color:"var(--gold)",fontWeight:700}}>{t('settings.balance')} {Math.round(credits[k]||0)} ₡</div>
                    </div>
                  </div>
                  {!isMe && creditErr[k]&&<div style={{fontSize:12,color:"var(--red)",marginBottom:6}}>{creditErr[k]}</div>}
                  {!isMe && (creditConfirm?.user===k?(
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
        )
      )}

      {/* DANGER ZONE */}
      <div style={{marginTop:32,paddingTop:24,borderTop:'1px solid var(--red)33'}}>
        <SecLabel style={{color:'var(--red)88'}}>{t('settings.danger_zone')}</SecLabel>
        {!isAdmin && (
          <div style={{...S.card,opacity:.5}}>
            <div style={{fontSize:13,color:'var(--dim)'}}>{t('settings.admin_only')}</div>
          </div>
        )}
        {isAdmin && (showResetConfirm ? (
          <div style={{...S.card,border:'1px solid var(--red)',background:'var(--red)0d'}}>
            <div style={{fontSize:14,fontWeight:700,color:'var(--red)',marginBottom:8}}>{t('settings.reset_confirm_title')}</div>
            <div style={{fontSize:12,color:'var(--dim)',marginBottom:16}}>{t('settings.reset_confirm_desc')}</div>
            <div style={{display:'flex',gap:10}}>
              <button onClick={()=>setShowResetConfirm(false)} style={{...S.btn,flex:1,background:'transparent',border:'1px solid var(--brd)',color:'var(--dim)'}}>{t('settings.reset_cancel')}</button>
              <button onClick={()=>{onReset();setShowResetConfirm(false);}} style={{...S.btn,flex:1,background:'var(--red)',border:'none',color:'#fff',fontWeight:700}}>{t('settings.reset_confirm_btn')}</button>
            </div>
          </div>
        ) : (
          <div style={{...S.card,border:'1px solid var(--red)33'}}>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{t('settings.reset_title')}</div>
            <div style={{fontSize:12,color:'var(--dim)',marginBottom:14}}>{t('settings.reset_desc',{count:(bets||[]).filter(b=>b.status==='active').length,total:(bets||[]).length})}</div>
            <button onClick={()=>setShowResetConfirm(true)} style={{...S.btn,width:'100%',background:'transparent',border:'1px solid var(--red)66',color:'var(--red)',fontSize:13}}>
              🏆 {t('settings.reset_btn')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
