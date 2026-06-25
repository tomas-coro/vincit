import React from 'react';

const CSS = `
@keyframes streakHot   { 0%,100% { transform: scale(1);    filter: drop-shadow(0 0 6px #f97316aa) }
                         50%      { transform: scale(1.18); filter: drop-shadow(0 0 14px #f97316ee) } }
@keyframes streakBlaze { 0%,100% { transform: scale(1) rotate(-2deg);  filter: drop-shadow(0 0 10px #e8b84baa) drop-shadow(0 0 16px #f97316aa) }
                         50%      { transform: scale(1.22) rotate(2deg); filter: drop-shadow(0 0 18px #e8b84bee) drop-shadow(0 0 24px #f97316dd) } }
@keyframes streakCold  { 0%,100% { transform: scale(1);    filter: drop-shadow(0 0 6px #5b8af099) }
                         50%      { transform: scale(1.08); filter: drop-shadow(0 0 14px #5b8af0cc) } }
@keyframes streakDoom  { 0%,100% { transform: translateY(0);   filter: drop-shadow(0 0 4px #555); opacity:.85 }
                         50%      { transform: translateY(-1px); filter: drop-shadow(0 0 10px #888);  opacity:1 } }
.streak-hot   { animation: streakHot 1.1s ease-in-out infinite; }
.streak-blaze { animation: streakBlaze 1.2s ease-in-out infinite; }
.streak-cold  { animation: streakCold 1.6s ease-in-out infinite; }
.streak-doom  { animation: streakDoom 1.8s ease-in-out infinite; }
`;

// Decides which level of visual to apply
function classify(winStreak = 0, lossStreak = 0) {
  if (winStreak >= 10) return { kind: 'blaze',   icon: '🪙🔥', cls: 'streak-blaze', color: 'var(--gold)', label: 'WIN STREAK' };
  if (winStreak >= 7)  return { kind: 'hot+',    icon: '🔥🔥', cls: 'streak-blaze', color: '#f97316',     label: 'WIN STREAK' };
  if (winStreak >= 3)  return { kind: 'hot',     icon: '🔥',   cls: 'streak-hot',   color: '#f97316',     label: 'WIN STREAK' };
  if (lossStreak >= 7) return { kind: 'doom',    icon: '💀',   cls: 'streak-doom',  color: '#8a8a8a',     label: 'LOSS STREAK' };
  if (lossStreak >= 5) return { kind: 'frozen',  icon: '❄️',   cls: 'streak-cold',  color: '#5b8af0',     label: 'LOSS STREAK' };
  if (lossStreak >= 3) return { kind: 'cold',    icon: '🧊',   cls: 'streak-cold',  color: '#5b8af0',     label: 'LOSS STREAK' };
  if (winStreak  >= 1) return { kind: 'idle-w',  icon: '✨',   cls: '',             color: 'var(--txt)',  label: 'WIN STREAK' };
  if (lossStreak >= 1) return { kind: 'idle-l',  icon: '·',    cls: '',             color: 'var(--mut)',  label: 'LOSS STREAK' };
  return null;
}

// Compact inline form (just icon + number) — for tight rows like leaderboards
export function StreakInline({ winStreak = 0, lossStreak = 0, size = 18 }) {
  const c = classify(winStreak, lossStreak);
  if (!c) return null;
  const n = c.kind.startsWith('idle-l') || c.kind === 'cold' || c.kind === 'frozen' || c.kind === 'doom' ? lossStreak : winStreak;
  return (
    <span style={{display:'inline-flex', alignItems:'center', gap:3, color:c.color, fontWeight:700}}>
      <style>{CSS}</style>
      <span style={{fontSize:size}} className={c.cls}>{c.icon}</span>
      <span style={{fontSize:Math.round(size*0.75)}}>{n}</span>
    </span>
  );
}

// Full vertical badge — for stats grid / dashboard "streak" cells
export default function StreakBadge({ winStreak = 0, lossStreak = 0, label = 'Streak' }) {
  const c = classify(winStreak, lossStreak);
  const n = c ? (
    c.kind.startsWith('idle-l') || c.kind === 'cold' || c.kind === 'frozen' || c.kind === 'doom'
      ? lossStreak : winStreak
  ) : 0;
  return (
    <div style={{textAlign:'center'}}>
      <style>{CSS}</style>
      <div style={{fontSize:24, lineHeight:1, height:30, display:'flex', alignItems:'center', justifyContent:'center'}} className={c?.cls || ''}>
        {c?.icon ?? '—'}
      </div>
      <div style={{
        fontFamily:"'Bodoni Moda',serif", fontSize:22, fontWeight:900,
        color: c?.color ?? 'var(--mut)', lineHeight:1.1, marginTop:2,
      }}>{n}</div>
      <div style={{fontSize:10, color:'var(--dim)', letterSpacing:1}}>{label}</div>
    </div>
  );
}
