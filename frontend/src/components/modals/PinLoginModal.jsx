import React, { useState, useRef, useEffect } from 'react';
import * as api from '../../api.js';

export default function PinLoginModal({ user, profile, onSuccess, onClose }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleChange = async e => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4);
    setPin(val);
    setError('');
    if (val.length === 4 && !loading) {
      setLoading(true);
      try {
        const res = await api.verifyAccountPin(user, val);
        if (res.valid) {
          onSuccess();
        } else {
          setShake(true);
          setError('PIN errato');
          setPin('');
          setTimeout(() => { setShake(false); inputRef.current?.focus(); }, 500);
        }
      } catch {
        setError('Errore di rete');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
      <div style={{background:"var(--card)",border:"1px solid var(--brd)",borderRadius:20,padding:32,width:"100%",maxWidth:340,textAlign:"center"}}>
        <div style={{fontSize:44,marginBottom:12}}>{profile.avatar}</div>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,fontWeight:700,marginBottom:4}}>{profile.name}</div>
        <div style={{fontSize:13,color:"var(--dim)",marginBottom:24}}>Inserisci il PIN account</div>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          value={pin}
          onChange={handleChange}
          disabled={loading}
          style={{
            background:"var(--inp)",
            border:`1px solid ${error ? "var(--red)" : "var(--brd)"}`,
            color:"var(--txt)",
            borderRadius:12,
            padding:"14px 20px",
            fontFamily:"'Syne',sans-serif",
            fontSize:28,
            letterSpacing:12,
            textAlign:"center",
            width:"100%",
            outline:"none",
            marginBottom:8,
            animation: shake ? "pinShake 0.4s ease" : "none",
          }}
          placeholder="●●●●"
        />
        {error && <div style={{fontSize:13,color:"var(--red)",marginBottom:8}}>{error}</div>}
        <div
          style={{fontSize:12,color:"var(--mut)",marginTop:8,cursor:"pointer"}}
          onClick={() => setError('Chiedi al tuo partner 💬')}>
          Hai dimenticato il PIN?
        </div>
        <button
          onClick={onClose}
          style={{marginTop:16,background:"transparent",border:"none",color:"var(--dim)",fontSize:12,cursor:"pointer",textDecoration:"underline"}}>
          Indietro
        </button>
      </div>
      <style>{`@keyframes pinShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-6px)}80%{transform:translateX(6px)}}`}</style>
    </div>
  );
}
