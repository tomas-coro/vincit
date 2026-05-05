import React, { useState } from 'react';
import { Btn, Inp, Toggle, SecLabel, Avatar, AVATARS, COLORS, CAT_COLS, getC } from '../Atoms.jsx';
import * as api from '../../api.js';

const S = {
  card: {background:"var(--card)",border:"1px solid var(--brd)",borderRadius:16,padding:16},
  inp: {background:"var(--inp)",border:"1px solid var(--brd)",color:"var(--txt)",borderRadius:10,padding:"10px 14px",fontFamily:"'Syne',sans-serif",fontSize:14,outline:"none",width:"100%"},
};

export default function SettingsView({user,profiles,isDark,setIsDark,customCats,credits,onUpdateProfile,onResetCredits,onCreateCategory,onDeleteCategory,vaultPin,onSetVaultPin,pinProtected,isDesktop}){
  const [newE,setNewE]=useState("🎯");
  const [newLabel,setNewLabel]=useState("");
  const [newColor,setNewColor]=useState(CAT_COLS[0]);
  const [pinPhase,setPinPhase]=useState(null); // null|"set"|"remove-confirm"
  const [pin1,setPin1]=useState("");
  const [pin2,setPin2]=useState("");
  const [pinErr,setPinErr]=useState("");
  const [creditAmounts, setCreditAmounts] = useState({tomas:'', giulia:''});
  const [creditConfirm, setCreditConfirm] = useState(null); // null | { user, delta, amount }
  const [creditErr, setCreditErr] = useState({tomas:'', giulia:''});
  const [acctPinPhase,setAcctPinPhase]=useState(null); // null|"set"|"change"|"remove"
  const [acctPin0,setAcctPin0]=useState('');
  const [acctPin1,setAcctPin1]=useState('');
  const [acctPin2,setAcctPin2]=useState('');
  const [acctPinErr,setAcctPinErr]=useState('');
  const [acctPinLoading,setAcctPinLoading]=useState(false);

  const handleDeltaCredits = async (targetUser, delta) => {
    try {
      await api.deltaCredits(targetUser, delta);
      setCreditAmounts(a => ({...a, [targetUser]: ''}));
      setCreditConfirm(null);
      setCreditErr(e => ({...e, [targetUser]: ''}));
    } catch (err) {
      const msg = err.message?.includes('400') ? 'Crediti insufficienti' : 'Errore';
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
    if(pin1.length<4){setPinErr("Il PIN deve essere 4 cifre");return;}
    if(pin1!==pin2){setPinErr("I PIN non coincidono");return;}
    onSetVaultPin(pin1);
    setPinPhase(null);setPin1("");setPin2("");setPinErr("");
  };
  const saveAcctPin=async()=>{
    if(!/^\d{4}$/.test(acctPin1)){setAcctPinErr('Il PIN deve essere 4 cifre');return;}
    if(acctPin1!==acctPin2){setAcctPinErr('I PIN non coincidono');return;}
    if(acctPinPhase==='change'&&!acctPin0){setAcctPinErr('Inserisci il PIN attuale');return;}
    setAcctPinLoading(true);
    try{
      if(acctPinPhase==='change'){
        const v=await api.verifyAccountPin(user,acctPin0);
        if(!v.valid){setAcctPinErr('PIN attuale errato');setAcctPinLoading(false);return;}
      }
      await api.setAccountPin(user,acctPin1);
      setAcctPinPhase(null);setAcctPin0('');setAcctPin1('');setAcctPin2('');setAcctPinErr('');
    }catch{setAcctPinErr('Errore. Riprova.');}
    setAcctPinLoading(false);
  };
  const removeAcctPin=async()=>{
    if(!acctPin0){setAcctPinErr('Inserisci il PIN attuale');return;}
    setAcctPinLoading(true);
    try{
      await api.removeAccountPin(user,acctPin0);
      setAcctPinPhase(null);setAcctPin0('');setAcctPinErr('');
    }catch{setAcctPinErr('PIN errato');}
    setAcctPinLoading(false);
  };

  return(
    <div className="sUp">
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:20}}>⚙️ Impostazioni</div>

      {/* PROFILES */}
      <SecLabel>Profili</SecLabel>
      {["tomas","giulia"].map(k=>{
        const p=profiles[k]; const isMe=k===user;
        return(
          <div key={k} style={{...S.card,marginBottom:10,opacity:isMe?1:.65}}>
            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
              <div style={{fontSize:32}}>{p.avatar}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:11,color:"var(--dim)",marginBottom:4}}>{isMe?"Il tuo profilo":"Partner"}</div>
                <Inp value={p.name} disabled={!isMe} onChange={e=>onUpdateProfile(k,{...profiles[k],name:e.target.value.slice(0,16)})} style={{fontWeight:600}}/>
              </div>
            </div>
            {isMe&&<>
              <div style={{fontSize:11,color:"var(--dim)",marginBottom:8}}>Avatar</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:12}}>
                {AVATARS.map(a=>(
                  <div key={a} onClick={()=>onUpdateProfile(k,{...profiles[k],avatar:a})} style={{width:36,height:36,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,cursor:"pointer",background:p.avatar===a?"var(--gold)22":"var(--surf)",border:`1px solid ${p.avatar===a?"var(--gold)":"var(--brd)"}`}}>{a}</div>
                ))}
              </div>
              <div style={{fontSize:11,color:"var(--dim)",marginBottom:8}}>Colore tema</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {Object.entries(COLORS).map(([k2,hex])=>(
                  <div key={k2} onClick={()=>onUpdateProfile(k,{...profiles[k],colorKey:k2})} style={{width:26,height:26,borderRadius:"50%",background:hex,cursor:"pointer",border:`3px solid ${p.colorKey===k2?"#fff":"transparent"}`,boxShadow:p.colorKey===k2?`0 0 8px ${hex}`:"none"}}/>
                ))}
              </div>
            </>}
          </div>
        );
      })}

      {/* VAULT PIN */}
      <SecLabel mt={16}>Vault PIN (mio)</SecLabel>
      <div style={{...S.card,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <div>
            <div style={{fontSize:14,fontWeight:600}}>{vaultPin?"🔒 PIN attivo":"🔓 Nessun PIN"}</div>
            <div style={{fontSize:12,color:"var(--dim)",marginTop:2}}>Il vault è {vaultPin?"protetto":"accessibile"}</div>
            <div style={{fontSize:10,color:"var(--mut)",marginTop:4}}>⚠ Il PIN si resetta al ricaricamento della pagina</div>
          </div>
        </div>
        {pinErr&&<div style={{fontSize:12,color:"var(--red)",marginBottom:8}}>{pinErr}</div>}
        {pinPhase==="set"&&(
          <div style={{marginBottom:12}}>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>Nuovo PIN (4 cifre):</div>
            <Inp type="text" value={pin1} onChange={e=>setPin1(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:8}}/>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>Conferma PIN:</div>
            <Inp type="text" value={pin2} onChange={e=>setPin2(e.target.value.replace(/\D/g,"").slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="gold" sm onClick={savePin}>Salva</Btn>
              <Btn variant="ghost" sm onClick={()=>{setPinPhase(null);setPin1("");setPin2("");setPinErr("");}}>Annulla</Btn>
            </div>
          </div>
        )}
        {!pinPhase&&(
          <div style={{display:"flex",gap:8}}>
            <Btn variant="ghost" sm onClick={()=>setPinPhase("set")}>{vaultPin?"Cambia PIN":"Imposta PIN"}</Btn>
            {vaultPin&&<Btn variant="ghost" sm style={{color:"var(--red)",borderColor:"var(--red)22"}} onClick={()=>onSetVaultPin(null)}>Rimuovi</Btn>}
          </div>
        )}
      </div>

      {/* PIN ACCOUNT */}
      <SecLabel mt={16}>PIN Account (mio)</SecLabel>
      <div style={{...S.card,marginBottom:12}}>
        <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{pinProtected?.[user]?'🔒 PIN attivo':'🔓 Nessun PIN'}</div>
        <div style={{fontSize:12,color:"var(--dim)",marginBottom:10}}>Protegge l'accesso al profilo su qualsiasi dispositivo</div>
        {acctPinErr&&<div style={{fontSize:12,color:"var(--red)",marginBottom:8}}>{acctPinErr}</div>}
        {acctPinPhase==='set'&&(
          <div>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>Nuovo PIN (4 cifre):</div>
            <Inp type="text" value={acctPin1} onChange={e=>setAcctPin1(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:8}}/>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>Conferma PIN:</div>
            <Inp type="text" value={acctPin2} onChange={e=>setAcctPin2(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="gold" sm onClick={saveAcctPin} disabled={acctPinLoading}>Salva</Btn>
              <Btn variant="ghost" sm onClick={()=>{setAcctPinPhase(null);setAcctPin1('');setAcctPin2('');setAcctPinErr('');}}>Annulla</Btn>
            </div>
          </div>
        )}
        {acctPinPhase==='change'&&(
          <div>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>PIN attuale:</div>
            <Inp type="text" value={acctPin0} onChange={e=>setAcctPin0(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:8}}/>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>Nuovo PIN:</div>
            <Inp type="text" value={acctPin1} onChange={e=>setAcctPin1(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:8}}/>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>Conferma nuovo PIN:</div>
            <Inp type="text" value={acctPin2} onChange={e=>setAcctPin2(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="gold" sm onClick={saveAcctPin} disabled={acctPinLoading}>Salva</Btn>
              <Btn variant="ghost" sm onClick={()=>{setAcctPinPhase(null);setAcctPin0('');setAcctPin1('');setAcctPin2('');setAcctPinErr('');}}>Annulla</Btn>
            </div>
          </div>
        )}
        {acctPinPhase==='remove'&&(
          <div>
            <div style={{fontSize:12,color:"var(--dim)",marginBottom:6}}>Conferma PIN attuale per rimuoverlo:</div>
            <Inp type="text" value={acctPin0} onChange={e=>setAcctPin0(e.target.value.replace(/\D/g,'').slice(0,4))} placeholder="●●●●" style={{letterSpacing:8,fontSize:20,marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <Btn variant="red" sm onClick={removeAcctPin} disabled={acctPinLoading}>Rimuovi</Btn>
              <Btn variant="ghost" sm onClick={()=>{setAcctPinPhase(null);setAcctPin0('');setAcctPinErr('');}}>Annulla</Btn>
            </div>
          </div>
        )}
        {!acctPinPhase&&(
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {!pinProtected?.[user]&&<Btn variant="ghost" sm onClick={()=>setAcctPinPhase('set')}>Imposta PIN</Btn>}
            {pinProtected?.[user]&&<>
              <Btn variant="ghost" sm onClick={()=>setAcctPinPhase('change')}>Cambia PIN</Btn>
              <Btn variant="ghost" sm style={{color:"var(--red)",borderColor:"var(--red)22"}} onClick={()=>setAcctPinPhase('remove')}>Rimuovi PIN</Btn>
            </>}
          </div>
        )}
      </div>

      {/* THEME */}
      <SecLabel>Tema</SecLabel>
      <div style={{...S.card,marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div><div style={{fontSize:14,fontWeight:600}}>{isDark?"🌙 Modalità Scura":"☀️ Modalità Chiara"}</div><div style={{fontSize:12,color:"var(--dim)"}}>Cambia aspetto dell'app</div></div>
        <Toggle on={isDark} onToggle={()=>setIsDark(!isDark)}/>
      </div>

      {/* CUSTOM CATS */}
      <SecLabel>Categorie Personalizzate</SecLabel>
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
          <Inp value={newLabel} onChange={e=>setNewLabel(e.target.value)} style={{flex:1,minWidth:100}} placeholder="Nome categoria"/>
          <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {CAT_COLS.map(col=><div key={col} onClick={()=>setNewColor(col)} style={{width:20,height:20,borderRadius:"50%",background:col,cursor:"pointer",border:`2px solid ${newColor===col?"#fff":"transparent"}`}}/>)}
          </div>
          <Btn variant="gold" sm onClick={addCat}>+ Aggiungi</Btn>
        </div>
      </div>

      {/* CREDITI */}
      <SecLabel mt={16}>Crediti</SecLabel>
      <div style={{...S.card}}>
        {["tomas","giulia"].map(k=>{
          const p=profiles[k]; const amt=parseFloat(creditAmounts[k])||0;
          return(
            <div key={k} style={{marginBottom:k==="tomas"?14:0}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{fontSize:24}}>{p.avatar}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600}}>{p.name}</div>
                  <div style={{fontSize:12,color:"var(--gold)",fontWeight:700}}>Saldo: {Math.round(credits[k])} ₡</div>
                </div>
              </div>
              {creditErr[k]&&<div style={{fontSize:12,color:"var(--red)",marginBottom:6}}>{creditErr[k]}</div>}
              {creditConfirm?.user===k?(
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <div style={{fontSize:13,color:"var(--dim)",flex:1}}>
                    Sottrarre {creditConfirm.amount} ₡ da {p.name}?
                  </div>
                  <Btn variant="red" sm onClick={()=>handleDeltaCredits(k,-creditConfirm.amount)}>Conferma</Btn>
                  <Btn variant="ghost" sm onClick={()=>setCreditConfirm(null)}>Annulla</Btn>
                </div>
              ):(
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <Inp
                    type="number"
                    min={1}
                    max={9999}
                    value={creditAmounts[k]}
                    onChange={e=>setCreditAmounts(a=>({...a,[k]:e.target.value}))}
                    placeholder="Importo"
                    style={{width:90,padding:"6px 10px",fontSize:13}}
                  />
                  <Btn variant="grn" sm onClick={()=>{
                    if(!amt||amt<1)return;
                    handleDeltaCredits(k, Math.floor(amt));
                  }}>+ Aggiungi</Btn>
                  <Btn variant="ghost" sm style={{color:"var(--red)",borderColor:"var(--red)22"}} onClick={()=>{
                    if(!amt||amt<1)return;
                    setCreditConfirm({user:k, amount:Math.floor(amt)});
                    setCreditErr(e=>({...e,[k]:''}));
                  }}>− Sottrai</Btn>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
