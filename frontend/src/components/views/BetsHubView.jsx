import React from 'react';
import { useLang } from '../../i18n.js';
import BetsView  from './BetsView.jsx';
import VaultView from './VaultView.jsx';

// Bets + Vault under a single nav voice. The active tab is owned by App.jsx
// so external triggers (e.g. the dashboard \"Vault teaser\" CTA) can pre-open
// the Vault tab when switching into this view.
export default function BetsHubView({
  tab, setTab, user, profiles, bets, cats, isDesktop,
  // Bets-specific
  onResolve, onCounter, onFlame, reactions, onReaction, onReactionPhoto,
  onDelete, onEdit, onAccept, onReject, can,
  // Consensual-resolve
  onConfirmOutcome, onWithdrawResolve, onOvertime,
  // Vault-specific
  onReveal, vaultUnlocked, onPinRequest, vaultPin, onSetVaultPin,
  // Empty-state CTA (passed through to BetsView/VaultView)
  onOpenCreate,
  pendingResolveIds,
  // BetsView reset signal: when the parent bumps `betsViewKey` we
  // remount BetsView so its `useState(initialStatus || 'active')`
  // re-applies the new initial. Used by the Dashboard "Vedi tutte"
  // CTA to land on the "Tutte" filter regardless of prior state.
  betsViewKey = 0, initialStatus,
}) {
  const { t } = useLang();

  const openCount  = bets.filter(b => !b.isSecret && b.status === 'active').length;
  const vaultCount = bets.filter(b => b.creator === user && b.isSecret && b.status === 'active').length;

  const tabBtn = (id, label, icon, badge) => {
    const active = tab === id;
    return (
      <button onClick={() => setTab(id)} style={{
        flex: 1, position: 'relative', padding: '10px 14px',
        background: active ? 'var(--gold)18' : 'transparent',
        color: active ? 'var(--gold)' : 'var(--dim)',
        border: 'none', borderBottom: `2px solid ${active ? 'var(--gold)' : 'transparent'}`,
        cursor: 'pointer', fontFamily: "'Manrope',sans-serif",
        fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        transition: 'all .18s',
      }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span>{label}</span>
        {badge > 0 && (
          <span style={{
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: active ? 'var(--gold)' : 'var(--gold)33',
            color: active ? '#07060f' : 'var(--gold)',
            fontSize: 10, fontWeight: 800,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{badge}</span>
        )}
      </button>
    );
  };

  return (
    <div className="sUp">
      {/* Header (title only — sub-text comes from each child) */}
      <div style={{
        fontFamily: "'Cormorant Garamond',serif", fontSize: 24, fontWeight: 700,
        marginBottom: 12,
      }}>
        {tab === 'vault' ? t('vault_view.title') : t('bets_view.title')}
      </div>

      {/* Tab strip */}
      <div style={{
        display: 'flex',
        background: 'var(--card)',
        border: '1px solid var(--brd)',
        borderRadius: 12, overflow: 'hidden',
        marginBottom: 14,
      }}>
        {tabBtn('open',  t('bets_hub.tab_open'),  '🎯', openCount)}
        {tabBtn('vault', t('bets_hub.tab_vault'), '🔒', vaultCount)}
      </div>

      {tab === 'vault' ? (
        <VaultView
          hideTitle
          user={user} profiles={profiles} bets={bets} cats={cats}
          isDesktop={isDesktop}
          onReveal={onReveal} onFlame={onFlame}
          unlocked={vaultUnlocked} onPinRequest={onPinRequest} vaultPin={vaultPin} onSetVaultPin={onSetVaultPin}
          onDelete={onDelete} onEdit={onEdit}
          onOpenCreate={onOpenCreate}
        />
      ) : (
        <BetsView
          key={betsViewKey}
          initialStatus={initialStatus}
          hideTitle
          user={user} profiles={profiles} bets={bets} cats={cats}
          isDesktop={isDesktop}
          onResolve={onResolve} onCounter={onCounter} onFlame={onFlame}
          reactions={reactions} onReaction={onReaction} onReactionPhoto={onReactionPhoto}
          onDelete={onDelete} onEdit={onEdit}
          onAccept={onAccept} onReject={onReject} can={can}
          onConfirmOutcome={onConfirmOutcome} onWithdrawResolve={onWithdrawResolve} onOvertime={onOvertime}
          onOpenCreate={onOpenCreate}
          pendingResolveIds={pendingResolveIds}
        />
      )}
    </div>
  );
}
