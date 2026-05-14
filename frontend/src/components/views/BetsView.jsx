import React, { useState } from 'react';
import { useLang } from '../../i18n.js';
import BetCard from '../BetCard.jsx';
import { DEF_CAT_IDS as DEF_IDS } from '../Atoms.jsx';
import EmptyState from '../EmptyState.jsx';

export default function BetsView({user,profiles,bets,cats,onResolve,onCounter,onFlame,isDesktop,reactions,onReaction,onReactionPhoto,onDelete,onEdit,onAccept,onReject,can,onConfirmOutcome,onWithdrawResolve,onOvertime,onOpenCreate,initialStatus,hideTitle=false,pendingResolveIds}){
  const { t } = useLang();
  // `initialStatus` is honored only on mount — parent uses React `key` to
  // force a remount when it wants the filter to snap to a new default
  // (e.g. Dashboard "Vedi tutte" lands on 'all'). Default landing tab is
  // 'all' (Tutte) — users want the full list when they tap into Bets
  // from the nav, not just the currently-active ones.
  const [fStatus, setFStatus] = useState(initialStatus || 'all');
  const [fCat,    setFCat]    = useState('all');
  const [fWho,    setFWho]    = useState('all');
  const [query,   setQuery]   = useState('');
  // Collapses the category filter to the first ~6 items + a "+N più"
  // expander once the user (or the group) has accumulated more cats
  // than fit comfortably on one row. The active cat is always pinned
  // visible so the current filter is never hidden in the overflow.
  const [catsExpanded, setCatsExpanded] = useState(false);
  const CATS_VISIBLE = 6;

  const q = query.trim().toLowerCase();
  const visible = bets
    .filter(b => !b.isSecret)
    .filter(b => fStatus === 'all' || b.status === fStatus || (fStatus === 'active' && (b.status === 'pending' || b.status === 'disputed' || b.status === 'expired')))
    .filter(b => fCat    === 'all' || b.category === fCat)
    .filter(b => fWho    === 'all' || (fWho === 'mine' ? b.creator === user : b.creator !== user))
    .filter(b => !q || (b.title || '').toLowerCase().includes(q));

  const pill = active => ({
    padding:'5px 12px', borderRadius:20, flexShrink:0, cursor:'pointer', whiteSpace:'nowrap',
    fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:600,
    border:`1px solid ${active ? 'var(--gold)' : 'var(--brd)'}`,
    background: active ? 'var(--gold)22' : 'transparent',
    color: active ? 'var(--gold)' : 'var(--dim)',
  });
  const sep = <div style={{width:1, background:'var(--brd)', flexShrink:0, margin:'0 4px'}}/>;

  const total=bets.filter(b=>!b.isSecret&&b.status==='active').length;

  return(
    <div className="sUp">
      {!hideTitle && (
        <>
          <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:24,fontWeight:700,marginBottom:4}}>{t('bets_view.title')}</div>
          <div style={{fontSize:13,color:"var(--dim)",marginBottom:12}}>{total===1?t('bets_view.sub_one'):t('bets_view.sub_many',{n:total})}</div>
        </>
      )}

      {/* Search input — real-time filter by title. Stays out of the way
          when empty, expands into a proper editorial search row when typing. */}
      <div style={{
        display:'flex', alignItems:'center', gap:10,
        padding:'8px 4px', marginBottom:6,
        borderBottom: q ? '1px solid var(--gold)44' : '1px solid var(--brd)',
        transition: 'border-color .2s',
      }}>
        <span style={{ color: q ? 'var(--gold)' : 'var(--dim)', fontSize:14 }}>🔍</span>
        <input value={query} onChange={e=>setQuery(e.target.value)}
          placeholder={t('bets_view.search_ph')}
          style={{ flex:1, border:'none', outline:'none', background:'transparent',
            color:'var(--txt)', fontFamily:"'Manrope',sans-serif", fontSize:14, letterSpacing:'.01em' }}/>
        {q && (
          <button onClick={()=>setQuery('')} aria-label="Pulisci ricerca"
            style={{ background:'transparent', border:'none', cursor:'pointer',
              color:'var(--mut)', fontSize:16, padding:'2px 6px', lineHeight:1 }}>×</button>
        )}
      </div>

      {/* Status + author filter row — single horizontal scroll lane */}
      <div style={{display:'flex',gap:6,overflowX:'auto',paddingBottom:8,marginBottom:8,
        scrollbarWidth:'none',WebkitOverflowScrolling:'touch'}}>
        {['all','active','won','lost','expired'].map(s =>
          <button key={s} style={pill(fStatus===s)} onClick={()=>setFStatus(s)}>{t('bets_view.f_'+s)}</button>
        )}{sep}
        {['all','mine','theirs'].map(w =>
          <button key={w} style={pill(fWho===w)} onClick={()=>setFWho(w)}>{t('bets_view.f_'+w)}</button>
        )}
      </div>

      {/* Category row — wraps to multiple lines, collapses to first 6
          when there are too many to read at a glance. */}
      {(() => {
        const allCats = [{id:'all',e:'',label:t('bets_view.f_cats')}, ...cats];
        const overflow = Math.max(0, allCats.length - CATS_VISIBLE);
        // Always show: the first CATS_VISIBLE + the currently-selected
        // one (so the active filter never disappears behind the toggle).
        const shouldShow = (c, idx) => catsExpanded || idx < CATS_VISIBLE || c.id === fCat;
        return (
          <div style={{display:'flex', gap:6, flexWrap:'wrap', paddingBottom:8, marginBottom:14, alignItems:'center'}}>
            {allCats.map((c, idx) => shouldShow(c, idx) && (
              <button key={c.id} style={pill(fCat===c.id)} onClick={()=>setFCat(c.id)}>
                {c.e ? `${c.e} ${DEF_IDS.includes(c.id) ? t('cats.'+c.id) : c.label}` : c.label}
              </button>
            ))}
            {overflow > 0 && (
              <button onClick={() => setCatsExpanded(e => !e)}
                aria-expanded={catsExpanded}
                style={{
                  padding:'5px 12px', borderRadius:20, cursor:'pointer',
                  background:'transparent', border:'1px dashed var(--brd)',
                  color:'var(--dim)', fontFamily:"'Manrope',sans-serif",
                  fontSize:11, fontWeight:600, whiteSpace:'nowrap',
                  WebkitTapHighlightColor:'transparent', touchAction:'manipulation',
                }}>
                {catsExpanded ? '− Comprimi' : `+${overflow} più`}
              </button>
            )}
          </div>
        );
      })()}

      {visible.length === 0
        ? (() => {
            // Three different empty states depending on WHY the list is empty:
            //   - active search query → "nothing matches your search"
            //   - the group has at least one shared bet but filters hide all
            //     of them → "no bets match these filters" + reset link
            //   - genuinely no shared bets in the group → the onboarding
            //     "Crea la prima bet" card with tutorial
            const totalShared = bets.filter(b => !b.isSecret).length;
            if (q) {
              return (
                <div style={{textAlign:'center',padding:'52px 0',color:'var(--dim)'}}>
                  <div style={{fontSize:48,marginBottom:12}}>🎯</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17}}>
                    {t('bets_view.search_empty',{q:query.trim()})}
                  </div>
                </div>
              );
            }
            if (totalShared > 0) {
              return (
                <div style={{textAlign:'center',padding:'52px 0',color:'var(--dim)'}}>
                  <div style={{fontSize:48,marginBottom:12}}>🎯</div>
                  <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:17, marginBottom: 14}}>
                    {t('bets_view.filter_empty')}
                  </div>
                  <button onClick={() => { setFStatus('all'); setFCat('all'); setFWho('all'); setQuery(''); }}
                    style={{
                      padding:'8px 18px', borderRadius:999,
                      background:'var(--gold)1a', border:'1px solid var(--gold)55',
                      color:'var(--gold)', cursor:'pointer',
                      fontFamily:"'Manrope',sans-serif", fontSize:11, fontWeight:800,
                      letterSpacing:'.08em', textTransform:'uppercase',
                      WebkitTapHighlightColor:'transparent', touchAction:'manipulation',
                    }}>
                    {t('bets_view.filter_reset')}
                  </button>
                </div>
              );
            }
            return (
              <EmptyState
                emoji="🎯"
                title={t('empty.bets_title')}
                body={t('empty.bets_body')}
                cta={onOpenCreate ? { label: t('empty.bets_cta'), icon: '+', onClick: onOpenCreate } : null}
                tutorial={{ label: t('empty.how_label'), body: t('empty.bets_tutorial') }}
              />
            );
          })()
        : <div style={isDesktop?{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,alignItems:'start'}:{}}>
            {visible.map(b => <BetCard key={b.id} bet={b} user={user} profiles={profiles} cats={cats}
              onResolve={onResolve} onFlame={onFlame} onCounter={onCounter} onDelete={onDelete} onEdit={onEdit}
              isDesktop={isDesktop} reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto}
              onAccept={onAccept} onReject={onReject} can={can}
              onConfirmOutcome={onConfirmOutcome} onWithdrawResolve={onWithdrawResolve} onOvertime={onOvertime}
              pendingResolve={pendingResolveIds?.has(b.id)}/>)}
          </div>
      }
    </div>
  );
}
