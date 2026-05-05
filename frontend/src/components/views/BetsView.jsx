import React from 'react';
import { SecLabel, Avatar, COLORS, getC } from '../Atoms.jsx';
import BetCard from '../BetCard.jsx';

export default function BetsView({user,profiles,bets,cats,onResolve,onCounter,onFlame,isDesktop,reactions,onReaction}){
  const other=user==="tomas"?"giulia":"tomas";
  const mine=bets.filter(b=>b.creator===user&&!b.isSecret&&b.status==="active");
  const theirs=bets.filter(b=>b.creator===other&&!b.isSecret&&b.status==="active");
  return(
    <div className="sUp">
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,fontWeight:700,marginBottom:4}}>🎯 Bets Condivise</div>
      <div style={{fontSize:13,color:"var(--dim)",marginBottom:20}}>{mine.length+theirs.length} attive in questo momento</div>
      {mine.length>0&&<><SecLabel>Le mie</SecLabel>{mine.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onResolve={onResolve} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction}/>)}</>}
      {theirs.length>0&&<><SecLabel mt={14}>Di {profiles[other].name}</SecLabel>{theirs.map(b=><BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats} onFlame={onFlame} onCounter={onCounter} isDesktop={isDesktop} reactions={reactions} onReaction={onReaction}/>)}</>}
      {mine.length+theirs.length===0&&(
        <div style={{textAlign:"center",padding:"52px 0",color:"var(--dim)"}}>
          <div style={{fontSize:48,marginBottom:12}}>🎯</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:17}}>Nessuna bet condivisa attiva</div>
        </div>
      )}
    </div>
  );
}
