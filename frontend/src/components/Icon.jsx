import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Set icone "Editorial Maximal" — stile A · Incise (hairline).
// Tratto sottile, spigoli netti: le icone fanno da contorno tipografico e
// lasciano i numeri Bodoni protagonisti. Glifi verificati in
// `mockups/08-icon-set-hairline.html`.
//
// Ogni glifo è il contenuto interno di un <svg viewBox="0 0 24 24"> che imposta
// fill:none + stroke:currentColor. I pochi tratti PIENI (centro del bersaglio,
// pallino del lucchetto, stella della medaglia, occhi del teschio) portano
// fill/stroke inline così non dipendono da CSS esterno.
// Il colore arriva da `currentColor`: neutro di default, oro per stato/azione,
// rosso caldo (#d9694a) per "urgente" — si imposta via `color` sul contenitore.
// ─────────────────────────────────────────────────────────────────────────────
const GLYPHS = {
  bell:      '<path d="M6.2 16.5c.8-1 1.5-2.1 1.5-6.3a4.3 4.3 0 0 1 8.6 0c0 4.2.7 5.3 1.5 6.3z"/><path d="M10.3 19a1.7 1.7 0 0 0 3.4 0"/><path d="M12 3.2v1.3"/>',
  trophy:    '<path d="M8 4.6h8V8a4 4 0 0 1-8 0z"/><path d="M8 5.6H5.7A1.8 1.8 0 0 0 7.6 9"/><path d="M16 5.6h2.3A1.8 1.8 0 0 1 16.4 9"/><path d="M12 12v2.6"/><path d="M9.6 18.4 10.2 15h3.6l.6 3.4z"/>',
  target:    '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.6"/><circle cx="12" cy="12" r=".9" fill="currentColor" stroke="none"/>',
  calendar:  '<rect x="5" y="6" width="14" height="14" rx="1.3"/><path d="M5 10h14"/><path d="M8.5 4.2v3.4"/><path d="M15.5 4.2v3.4"/>',
  clock:     '<circle cx="12" cy="12" r="8"/><path d="M12 7.6v4.7l3 1.8"/>',
  bolt:      '<path d="M13.2 3 5.6 13.4H10l-1 7.6 8-11H13z"/>',
  lock:      '<rect x="5.6" y="10.6" width="12.8" height="9.4" rx="1.4"/><path d="M8.6 10.6V8a3.4 3.4 0 0 1 6.8 0v2.6"/><circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none"/>',
  bars:      '<path d="M5 4v15.5h15"/><path d="M9 16.5v-4"/><path d="M13 16.5v-7"/><path d="M17 16.5v-10"/>',
  arrow:     '<path d="M4.5 12h13"/><path d="M12.5 6.8 17.7 12l-5.2 5.2"/>',
  medal:     '<path d="M8.6 3.4 11 8.6"/><path d="M15.4 3.4 13 8.6"/><circle cx="12" cy="15" r="5"/><path d="M12 12.4l.85 1.7 1.9.28-1.37 1.33.32 1.88L12 16.8l-1.7.9.32-1.88-1.37-1.33 1.9-.28z" fill="currentColor" stroke="none"/>',
  home:      '<path d="M4.3 11 12 4.4l7.7 6.6"/><path d="M6.4 9.6V19.2h11.2V9.6"/><path d="M10.4 19.2v-4.4h3.2v4.4"/>',
  user:      '<circle cx="12" cy="8.4" r="3.3"/><path d="M5.6 19.4a6.4 6.4 0 0 1 12.8 0"/>',
  skull:     '<path d="M5.2 11a6.8 6.8 0 0 1 13.6 0c0 2-1 3.4-2 4.1v2.1a1.3 1.3 0 0 1-1.3 1.3h-.4v-1.8h-1.5v1.8h-3.2v-1.8H8.9v1.8h-.4a1.3 1.3 0 0 1-1.3-1.3v-2.1c-1-.7-2-2.1-2-4.1z"/><circle cx="9.3" cy="11.4" r="1.5" fill="currentColor" stroke="none"/><circle cx="14.7" cy="11.4" r="1.5" fill="currentColor" stroke="none"/><path d="M12 13.6v1.8"/>',
  hourglass: '<path d="M7 4.2h10"/><path d="M7 19.8h10"/><path d="M7.6 4.2c0 3.8 4.4 4.9 4.4 7.8s-4.4 4-4.4 7.8"/><path d="M16.4 4.2c0 3.8-4.4 4.9-4.4 7.8s4.4 4 4.4 7.8"/>',
  x:         '<path d="M6.6 6.6 17.4 17.4"/><path d="M17.4 6.6 6.6 17.4"/>',
};

export const ICON_NAMES = Object.keys(GLYPHS);

// <Icon name="lock" size={22} title="Vault" />
//  - size: lato in px (default 22). strokeWidth: default 1.4 (leggibile fino a 16px).
//  - title: se presente, icona "parlante" per screen reader; altrimenti aria-hidden.
//  - il colore eredita da currentColor del contenitore (color: ...).
export default function Icon({ name, size = 22, strokeWidth = 1.4, title, style, className, ...rest }) {
  const glyph = GLYPHS[name];
  if (!glyph) {
    // Niente fallback silenzioso: segnaliamo il nome sbagliato in console.
    // (Tutti i nomi sono hardcoded nel codice → un typo si vede subito.)
    console.warn(`<Icon>: glifo sconosciuto "${name}". Nomi validi: ${ICON_NAMES.join(', ')}`);
    return null;
  }
  // `glyph` è una costante statica di questo file (nessun input utente) → safe.
  // Il nome accessibile passa per aria-label, non viene mai iniettato nell'HTML.
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="butt"
      strokeLinejoin="miter"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: glyph }}
      {...rest}
    />
  );
}
