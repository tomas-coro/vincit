import React, { useState } from 'react';
import { useLang } from '../../i18n.js';
import BetCard from '../BetCard.jsx';

const DEF_IDS=['intimo','serata','casa','cibo','gaming','altro'];

export default function BetsView({user,profiles,bets,cats,onResolve,onCounter,onFlame,isDesktop,reactions,onReaction,onDelete,onEdit,onAccept,onReject}){
  const { t } = useLang();
  const [fStatus, setFStatus] = useState('active');
  const [fCat,    setFCat]    = useState('all');
  const [fWho,    setFWho]    = useState('all');

  const visible = bets
    .filter(b => !b.isSecret)
    .filter(b => fStatus === 'all' || b.status === fStatus || (fStatus === 'active' && b.status === 'pending'))
    .filter(b => fCat    === 'all' || b.category === fCat)
    .filter(b => fWho    === 'all' || (fWho === 'mine' ? b.creator === user : b.creator !== user));

  const pill = active => ({
    padding:'5px 12px', borderRadius:20, flexShrink:0, cursor:'pointer', whiteSpace:'nowrap',
    fontFamily:"'Syne',sans-serif", fontSize:11, fontWeight:600,
    border:`1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
    background: active ? 'var(--gold)22' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--dim)',
  });
  const sep = <div style={{width:1, background:'var(--brd)', flexShrink:0, margin:'0 4px'}}/>;

  const total=bets.filter(b=>!b.isSecret&&b.status==='active').length;

  return(
    <div className="sUp">
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:4}}>{t('bets_view.title')}</div>
      <div style={{fontSize:13,color:"var(--dim)",marginBottom:12}}>{total===1?t('bets_view.sub_one'):t('bets_view.sub_many',{n:total})}</div>

      <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8,marginBottom:14,
        scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
        {['all','active','won','lost','expired'].map(s =>
          <button key={s} style={pill(fStatus===s)} onClick={()=>setFStatus(s)}>{t('bets_view.f_'+s)}</button>
        )}{sep}
        {['all','mine','theirs'].map(w =>
          <button key={w} style={pill(fWho===w)} onClick={()=>setFWho(w)}>{t('bets_view.f_'+w)}</button>
        )}{sep}
        {[{id:'all',e:'',label:t('bets_view.f_cats')}, ...cats].map(c =>
          <button key={c.id} style={pill(fCat===c.id)} onClick={()=>setFCat(c.id)}>
            {c.e ? `${c.e} ${DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label}` : c.label}
          </button>
        )}
      </div>

      {visible.length === 0
        ? <div style={{textAlign:'center',padding:'52px 0',color:'var(--dim)'}}>
            <div style={{fontSize:48,marginBottom:12}}>🎯</div>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:17}}>{t('bets_view.empty')}</div>
          </div>
        : <div style={isDesktop?{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,alignItems:'start'}:{}}>
            {visible.map(b => <BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats}
              onResolve={onResolve} onFlame={onFlame} onCounter={onCounter} onDelete={onDelete} onEdit={onEdit}
              isDesktop={isDesktop} reactions={reactions} onReaction={onReaction}
              onAccept={onAccept} onReject={onReject}/>)}
          </div>
      }
    </div>
  );
}
