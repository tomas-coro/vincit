import React, { useState } from 'react';
import { Btn } from '../Atoms.jsx';
import { useLang } from '../../i18n.js';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

export default function CommentModal({ bet, onSave, onSkip }) {
  useEscClose(onSkip);
  useBodyScrollLock();
  const { t } = useLang();
  const [comment, setComment] = useState('');
  const isWin = bet.status === 'won';

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(15,11,35,.78)",backdropFilter:"blur(6px)",WebkitBackdropFilter:"blur(6px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:100,padding:24}} onClick={onSkip}>
      <div className="bIn" style={{background:"var(--surf)",border:"1px solid var(--rule)",borderRadius:6,padding:"32px 30px",width:"100%",maxWidth:400,boxShadow:"0 30px 80px rgba(0,0,0,.55)"}} onClick={e=>e.stopPropagation()}>
        <div className="bc-meta" style={{marginBottom:10, color: isWin ? 'var(--grn)' : 'var(--red)'}}>
          — {isWin ? t('comment.won') : t('comment.lost')}
        </div>
        <div style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:24,fontWeight:600,lineHeight:1.15,marginBottom:20,color:"var(--txt)"}}>
          “{bet.title}”
        </div>
        <div style={{fontSize:13,color:"var(--dim)",marginBottom:14,lineHeight:1.5}}>{t('comment.prompt')}</div>
        {/* No autoFocus — on mobile the popup is shown right after a
            resolve, and auto-focusing the textarea immediately pops the
            on-screen keyboard, which is jarring. User taps the field
            themselves when they actually want to type. */}
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value.slice(0, 280))}
          placeholder={t('comment.placeholder')}
          rows={4}
          style={{
            width:"100%",
            background:"transparent",
            border:0,
            borderBottom:"1px solid var(--brd)",
            color:"var(--txt)",
            borderRadius:0,
            padding:"10px 2px",
            fontFamily:"'Manrope',sans-serif",
            fontSize:15,
            outline:"none",
            resize:"none",
            boxSizing:"border-box",
            transition:"border-color .18s",
          }}
        />
        <div className="bc-meta" style={{textAlign:"right",marginTop:6,marginBottom:22,fontSize:8}}>{comment.length}/280</div>
        <div style={{display:"flex",gap:10}}>
          <Btn variant="gold" full onClick={() => onSave(bet.id, comment)} disabled={!comment.trim()}>{t('comment.save')}</Btn>
          <Btn variant="ghost" full onClick={onSkip}>{t('comment.skip')}</Btn>
        </div>
      </div>
    </div>
  );
}
