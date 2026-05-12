import React from 'react';
import { useLang } from '../../i18n.js';
import TrophiesSection from '../TrophiesSection.jsx';

export default function TrophiesView({ bets = [], isDesktop }) {
  const { t } = useLang();
  return (
    <div className="sUp">
      <div style={{
        fontFamily:"'Playfair Display',serif",
        fontSize: isDesktop ? 28 : 24,
        fontWeight: 700, marginBottom: 18,
      }}>{t('trophies.title')}</div>
      <TrophiesSection embedded={false} betsTick={bets.length} />
    </div>
  );
}
