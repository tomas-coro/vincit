import React, { useState } from 'react';
import { Btn } from '../Atoms.jsx';

export default function CommentModal({ bet, onSave, onSkip }) {
  const [comment, setComment] = useState('');

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:20}}>
      <div style={{background:"var(--card)",border:"1px solid var(--brd)",borderRadius:20,padding:24,width:"100%",maxWidth:380}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,fontWeight:700,marginBottom:4}}>
          {bet.status === 'won' ? '✅ Vinta!' : '❌ Persa'}
        </div>
        <div style={{fontSize:13,color:"var(--dim)",fontStyle:"italic",marginBottom:16,lineHeight:1.4}}>"{bet.title}"</div>
        <div style={{fontSize:13,color:"var(--dim)",marginBottom:8}}>Aggiungi un commento... es. "te l'avevo detto! 😂"</div>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value.slice(0, 280))}
          placeholder="Scrivi un commento..."
          rows={3}
          style={{
            width:"100%",
            background:"var(--inp)",
            border:"1px solid var(--brd)",
            color:"var(--txt)",
            borderRadius:10,
            padding:"10px 14px",
            fontFamily:"'Syne',sans-serif",
            fontSize:14,
            outline:"none",
            resize:"none",
            marginBottom:4,
            boxSizing:"border-box",
          }}
        />
        <div style={{fontSize:11,color:"var(--mut)",textAlign:"right",marginBottom:14}}>{comment.length}/280</div>
        <div style={{display:"flex",gap:8}}>
          <Btn variant="gold" sm onClick={() => onSave(bet.id, comment)} disabled={!comment.trim()}>Salva commento</Btn>
          <Btn variant="ghost" sm onClick={onSkip}>Salta</Btn>
        </div>
      </div>
    </div>
  );
}
