import React from 'react';
import { useLang } from '../../i18n.js';
import TrophiesSection from '../TrophiesSection.jsx';
import useEscClose from '../../hooks/useEscClose.js';
import useBodyScrollLock from '../../hooks/useBodyScrollLock.js';

export default function TrophiesModal({ onClose, betsTick = 0 }) {
  useEscClose(onClose);
  useBodyScrollLock();
  const { t } = useLang();
  return (
    <div onClick={onClose} style={{
      position:'fixed', inset:0, background:'rgba(15,11,35,.78)',
      backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center',
      zIndex:120, padding:'env(safe-area-inset-top, 16px) 16px env(safe-area-inset-bottom, 16px)',
    }}>
      <div className="bIn" onClick={e => e.stopPropagation()} style={{
        background:'var(--surf)',
        border:'1px solid var(--rule)',
        borderRadius:6,
        width:'100%',
        maxWidth:760,
        maxHeight:'92vh',
        display:'flex',
        flexDirection:'column',
        boxShadow:'0 30px 80px rgba(0,0,0,.55)',
      }}>
        {/* Editorial header */}
        <div style={{
          display:'flex', justifyContent:'space-between', alignItems:'flex-end',
          padding:'26px 28px 18px',
          borderBottom:'1px solid var(--rule)',
          flexShrink:0,
        }}>
          <div>
            <div className="bc-meta" style={{marginBottom:8}}>— Collezione</div>
            <div style={{fontFamily:"'Cormorant Garamond',serif", fontStyle:'italic', fontSize:28, fontWeight:600, lineHeight:1, color:'var(--txt)'}}>
              {t('trophies.title')}
            </div>
          </div>
          <button onClick={onClose} style={{
            background:'transparent', border:'none', cursor:'pointer',
            color:'var(--dim)', fontSize:18, padding:4,
          }}>✕</button>
        </div>

        {/* Scrollable body */}
        <div style={{padding:'24px 28px 28px', overflowY:'auto'}}>
          <TrophiesSection embedded={false} betsTick={betsTick} />
        </div>
      </div>
    </div>
  );
}
