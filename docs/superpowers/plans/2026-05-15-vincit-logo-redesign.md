# Vincit Logo Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sostituire il logo Vincit con un sistema coerente: wordmark tipografico (V Cinzel + incit Cormorant) e icona chip da poker premium su verde notte.

**Architecture:** Modifiche a 6 file esistenti — nessun nuovo file, nessuna nuova dipendenza runtime. Il wordmark diventa puramente CSS/tipografia (rimozione SVG), l'icona usa SVG con font web + pixel-drawing matematico per i PNG.

**Tech Stack:** React JSX, SVG, CSS custom properties, Node.js (gen-icons.mjs puro), Google Fonts (Cinzel:700;900 + Cormorant Garamond già caricato)

---

## File toccati

| File | Azione | Responsabilità |
|---|---|---|
| `frontend/index.html` | Modify | Aggiunge Cinzel a Google Fonts URL; aggiorna favicon data-URI |
| `frontend/src/components/Atoms.jsx` | Modify | Riscrive `VincitWordmark` — rimuove SVG, tipografia pura |
| `frontend/public/vincit-icon.svg` | Modify | Chip poker premium con V Cinzel 900 — usato da browser e generate-icons.js |
| `frontend/public/vincit-logo.svg` | Modify | Identico a vincit-icon.svg — aggiornato per coerenza |
| `frontend/scripts/gen-icons.mjs` | Modify | Aggiorna `drawIcon` per disegnare il chip con V geometrica |
| `frontend/public/icons/*.png` | Regenerate | PNG rigenerate dopo la modifica al gen-icons |

---

## Task 1: Cinzel font + favicon

**Files:**
- Modify: `frontend/index.html:9,10`

- [ ] **Step 1: Aggiungi Cinzel al Google Fonts URL (riga 9)**

```html
<!-- PRIMA -->
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,700&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />

<!-- DOPO -->
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Manrope:wght@400;500;600;700;800&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,700&family=Playfair+Display:wght@700;900&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Aggiorna favicon inline (riga 10)**

Sostituisci l'intera riga `<link rel="icon" .../>` con:

```html
<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns%3D'http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg' viewBox%3D'0 0 64 64'%3E%3Crect width%3D'64' height%3D'64' rx%3D'14' fill%3D'%23091408'%2F%3E%3Ccircle cx%3D'32' cy%3D'32' r%3D'29' fill%3D'none' stroke%3D'%23d4a830' stroke-width%3D'5' stroke-dasharray%3D'21.6 8.8' stroke-dashoffset%3D'2'%2F%3E%3Ccircle cx%3D'32' cy%3D'32' r%3D'29' fill%3D'none' stroke%3D'%23091408' stroke-width%3D'5.5' stroke-dasharray%3D'0 21.6 8.8 0' stroke-dashoffset%3D'-19.6'%2F%3E%3Ccircle cx%3D'32' cy%3D'32' r%3D'23' fill%3D'%2308160b'%2F%3E%3Cpolyline points%3D'16%2C18 32%2C46 48%2C18' fill%3D'none' stroke%3D'%23d4a830' stroke-width%3D'5.5' stroke-linecap%3D'round' stroke-linejoin%3D'round'%2F%3E%3C%2Fsvg%3E"/>
```

Il SVG equivalente (decodificato, per riferimento):
```svg
<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>
  <rect width='64' height='64' rx='14' fill='#091408'/>
  <!-- chip ring: 4 settori oro -->
  <circle cx='32' cy='32' r='29' fill='none' stroke='#d4a830'
    stroke-width='5' stroke-dasharray='21.6 8.8' stroke-dashoffset='2'/>
  <!-- copertura gap con colore sfondo -->
  <circle cx='32' cy='32' r='29' fill='none' stroke='#091408'
    stroke-width='5.5' stroke-dasharray='0 21.6 8.8 0' stroke-dashoffset='-19.6'/>
  <!-- area centrale -->
  <circle cx='32' cy='32' r='23' fill='#08160b'/>
  <!-- V geometrica -->
  <polyline points='16,18 32,46 48,18' fill='none' stroke='#d4a830'
    stroke-width='5.5' stroke-linecap='round' stroke-linejoin='round'/>
</svg>
```

Nota: nel favicon non si usa Cinzel (il data-URI non può caricare Google Fonts), quindi la V è un polyline geometrico. A 16-32px non si nota.

- [ ] **Step 3: Verifica**

```bash
cd frontend && npm run dev
```

Apri `http://localhost:5173`. Verifica nel tab del browser:
- Favicon = chip verde con V oro
- Network tab → Font → "Cinzel" presente nella lista

- [ ] **Step 4: Commit**

```bash
git add frontend/index.html
git commit -m "feat: Cinzel font + favicon chip verde"
```

---

## Task 2: Riscrive VincitWordmark

**Files:**
- Modify: `frontend/src/components/Atoms.jsx:167-188`

Il componente attuale (righe 167–188) usa un SVG con polyline (la V) e due testi ₡ interni. Va eliminato completamente e sostituito con pura tipografia.

- [ ] **Step 1: Sostituisci la funzione**

Trova e sostituisci l'intera funzione `VincitWordmark` (da `export function VincitWordmark` fino alla parentesi graffa di chiusura):

```jsx
export function VincitWordmark({ size = 28 }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'baseline', lineHeight:1 }}>
      <span style={{
        fontFamily:"'Cinzel', serif",
        fontWeight: 700,
        fontSize: size,
        color: 'var(--gold)',
        lineHeight: 1,
      }}>V</span>
      <span className="shim" style={{
        fontFamily:"'Cormorant Garamond', serif",
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: Math.round(size * 0.64),
        letterSpacing: '0.5px',
        marginLeft: -Math.round(size * 0.107),
        lineHeight: 1,
      }}>incit</span>
    </span>
  );
}
```

Nessun import aggiuntivo richiesto — `Math.round` è globale, `.shim` è già definita in `App.jsx:132`.

- [ ] **Step 2: Verifica visiva nell'app**

Con `npm run dev` attivo, apri `http://localhost:5173`:

1. **Header mobile** (viewport < 768px): deve mostrare `Vincit` come parola unica — la V Cinzel più grande, "incit" corsiva più piccola che si accosta senza gap visibile
2. **Sidebar desktop** (viewport ≥ 768px): stesso risultato a size=28
3. **Tutti i temi**: apri Settings → Theme, prova Dark, Light, Amber, Selva, Sakura, Pece — il wordmark deve adattarsi al colore `--gold` di ciascun tema
4. Controlla la console del browser — nessun errore

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Atoms.jsx
git commit -m "feat: VincitWordmark — V Cinzel 700 + incit Cormorant italic, margine negativo C3"
```

---

## Task 3: Riscrive vincit-icon.svg

**Files:**
- Modify: `frontend/public/vincit-icon.svg`

- [ ] **Step 1: Riscrivi il file**

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="40%" cy="36%" r="68%">
      <stop offset="0%" stop-color="#132817"/>
      <stop offset="100%" stop-color="#050f08"/>
    </radialGradient>
    <linearGradient id="vg" x1="5%" y1="5%" x2="95%" y2="95%">
      <stop offset="0%" stop-color="#f8ec80"/>
      <stop offset="40%" stop-color="#d4a830"/>
      <stop offset="100%" stop-color="#8a5e08"/>
    </linearGradient>
  </defs>

  <!-- sfondo -->
  <rect width="512" height="512" rx="108" fill="url(#bg)"/>

  <!-- chip: 6 settori oro alternati su bordo -->
  <circle cx="256" cy="256" r="230" fill="none" stroke="#d4a830"
    stroke-width="44" stroke-dasharray="60.21 24.08" stroke-dashoffset="12"/>
  <circle cx="256" cy="256" r="230" fill="none" stroke="#050f08"
    stroke-width="46" stroke-dasharray="0 60.21 24.08 0" stroke-dashoffset="-48"/>

  <!-- bordo esterno sottile -->
  <circle cx="256" cy="256" r="254" fill="none" stroke="#d4a830"
    stroke-width="3" opacity="0.35"/>

  <!-- raggi decorativi (8 direzioni) -->
  <g stroke="#d4a830" stroke-width="1.2" opacity="0.14">
    <line x1="256" y1="26"  x2="256" y2="70"/>
    <line x1="256" y1="442" x2="256" y2="486"/>
    <line x1="26"  y1="256" x2="70"  y2="256"/>
    <line x1="442" y1="256" x2="486" y2="256"/>
    <line x1="88"  y1="88"  x2="119" y2="119"/>
    <line x1="393" y1="88"  x2="424" y2="119"/>
    <line x1="88"  y1="424" x2="119" y2="393"/>
    <line x1="393" y1="424" x2="424" y2="393"/>
  </g>

  <!-- anello interno decorativo -->
  <circle cx="256" cy="256" r="196" fill="none" stroke="#d4a830"
    stroke-width="2" opacity="0.22"/>

  <!-- fill area centrale -->
  <circle cx="256" cy="256" r="192" fill="#08160b"/>

  <!-- glow ambrato -->
  <circle cx="256" cy="256" r="140" fill="#d4a830" opacity="0.07"/>

  <!-- V Cinzel 900 con gradiente oro -->
  <text x="256" y="310"
    font-family="'Cinzel', 'Georgia', serif"
    font-weight="900"
    font-size="230"
    text-anchor="middle"
    fill="url(#vg)">V</text>
</svg>
```

- [ ] **Step 2: Verifica nel browser**

Apri `http://localhost:5173/vincit-icon.svg` — il browser renderizza l'SVG inline con Cinzel caricato da Google Fonts.

Verifica:
- Chip verde con 6 settori oro
- V Cinzel grande al centro con gradiente
- Raggi decorativi e anello interno visibili

- [ ] **Step 3: Commit**

```bash
git add frontend/public/vincit-icon.svg
git commit -m "feat: vincit-icon.svg — chip poker premium, V Cinzel 900"
```

---

## Task 4: Aggiorna vincit-logo.svg

**Files:**
- Modify: `frontend/public/vincit-logo.svg`

Il file non è referenziato nel codice ma esiste nella repo — lo allineiamo al nuovo design per coerenza.

- [ ] **Step 1: Riscrivi il file**

Stesso contenuto esatto di `vincit-icon.svg` (Task 3, Step 1) — copia l'SVG identico.

- [ ] **Step 2: Commit**

```bash
git add frontend/public/vincit-logo.svg
git commit -m "feat: vincit-logo.svg — allineato a chip design"
```

---

## Task 5: Aggiorna gen-icons.mjs

**Files:**
- Modify: `frontend/scripts/gen-icons.mjs`

Il generatore usa pixel math pura senza renderer SVG — i font non sono disponibili. La V è un'approssimazione geometrica a due segmenti lineari con gradiente verticale. Non è identica alla Cinzel ma è visivamente coerente al chip a 192px e 512px.

- [ ] **Step 1: Sostituisci costanti e funzione drawIcon**

Trova le righe con `const BG`, `const GOLD`, e `function drawIcon(...)` e sostituiscile con:

```javascript
const BG_OUTER = hexRgb('#091408');   // verde notte — sfondo
const BG_INNER = hexRgb('#08160b');   // verde centrale — area chip
const GOLD     = hexRgb('#d4a830');   // oro principale
const GOLD_LIT = hexRgb('#f0d060');   // oro chiaro — top gradiente V

function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function drawIcon(x, y, size) {
  const cx = size / 2, cy = size / 2;
  const rr  = size * 0.211;  // corner radius — 108/512

  // rounded-rect mask
  const inR1 = x >= rr && x < size - rr && y >= 0 && y < size;
  const inR2 = y >= rr && y < size - rr && x >= 0 && x < size;
  const corners = [[rr,rr],[size-rr,rr],[rr,size-rr],[size-rr,size-rr]];
  const inside  = inR1 || inR2 || corners.some(([cx2,cy2]) => Math.hypot(x-cx2, y-cy2) < rr);
  if (!inside) return BG_OUTER;

  const dx   = x - cx, dy = y - cy;
  const dist = Math.hypot(dx, dy);
  const outerR = size * 0.449;  // 230/512
  const innerR = size * 0.375;  // 192/512

  // chip ring: 6 settori oro
  if (dist >= innerR && dist <= outerR) {
    const angle      = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
    const sectorSpan = (2 * Math.PI) / 6;
    const goldWidth  = sectorSpan * 0.714;  // 60.21/(60.21+24.08)
    const offset     = 0.21;
    const relAngle   = (angle + offset) % sectorSpan;
    return relAngle < goldWidth ? GOLD : BG_OUTER;
  }

  if (dist > outerR) return BG_OUTER;

  // V geometrica — due segmenti con gradiente verticale
  const vStroke = size * 0.062;
  const p1x = size * 0.270, p1y = size * 0.293;  // top-left
  const p2x = size * 0.500, p2y = size * 0.715;  // bottom tip
  const p3x = size * 0.730, p3y = size * 0.293;  // top-right

  const dV = Math.min(
    distToSeg(x, y, p1x, p1y, p2x, p2y),
    distToSeg(x, y, p2x, p2y, p3x, p3y)
  );

  if (dV < vStroke) {
    const t = Math.max(0, Math.min(1, (y - p1y) / (p2y - p1y)));
    return [
      Math.round(GOLD_LIT[0] + (GOLD[0] - GOLD_LIT[0]) * t),
      Math.round(GOLD_LIT[1] + (GOLD[1] - GOLD_LIT[1]) * t),
      Math.round(GOLD_LIT[2] + (GOLD[2] - GOLD_LIT[2]) * t),
    ];
  }

  return BG_INNER;
}
```

- [ ] **Step 2: Verifica che il loop in fondo al file non sia cambiato**

```javascript
// Deve rimanere invariato:
mkdirSync('public/icons', { recursive: true });
for (const size of [192, 512, 180]) {
  const buf = png(size, drawIcon);
  const name = size === 180 ? 'public/icons/apple-touch-icon.png' : `public/icons/icon-${size}.png`;
  writeFileSync(name, buf);
  console.log(`Generated ${name} (${buf.length} bytes)`);
}
writeFileSync('public/icons/icon-180.png', png(180, drawIcon));
console.log('Done.');
```

- [ ] **Step 3: Commit**

```bash
git add frontend/scripts/gen-icons.mjs
git commit -m "feat: gen-icons — chip verde notte con V geometrica, palette aggiornata"
```

---

## Task 6: Rigenera PNG e verifica finale

**Files:**
- Output: `frontend/public/icons/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, `icon-180.png`

- [ ] **Step 1: Rigenera i PNG**

```bash
cd frontend && node scripts/gen-icons.mjs
```

Output atteso:
```
Generated public/icons/apple-touch-icon.png (NNN bytes)
Generated public/icons/icon-192.png (NNN bytes)
Generated public/icons/icon-512.png (NNN bytes)
Generated public/icons/icon-180.png (NNN bytes)
Done.
```

Se il comando fallisce, controlla:
- Di essere nella directory `frontend/` (non nella root del progetto)
- Che `public/icons/` esista già (il script fa `mkdirSync` quindi lo crea in automatico)

- [ ] **Step 2: Apri icon-512.png in preview**

Su macOS: `open frontend/public/icons/icon-512.png`

Verifica:
- Sfondo verde notte (non il viola attuale)
- Chip ring oro con settori alternati (almeno 4-6 settori visibili)
- V oro al centro con gradiente chiaro→scuro
- Angoli arrotondati

- [ ] **Step 3: Apri icon-192.png in preview**

```bash
open frontend/public/icons/icon-192.png
```

Verifica: chip leggibile, settori e V riconoscibili anche a 192px.

- [ ] **Step 4: Verifica PWA nell'app**

Con `npm run dev` attivo:
- Apri DevTools → Application → Manifest
- Clicca le icone nel manifest — devono mostrare il chip verde
- Se le icone sembrano in cache: DevTools → Application → Service Workers → "Update on reload" → ricarica

- [ ] **Step 5: Commit finale**

```bash
git add frontend/public/icons/
git commit -m "feat: PNG icons rigenerate — chip poker verde notte"
```
