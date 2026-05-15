# Vincit — Logo & Brand Redesign

**Data:** 2026-05-15  
**Stato:** Approvato

---

## Obiettivo

Rebuild completo del sistema logo Vincit. Problemi del design attuale:
- Le ₡ all'interno della V SVG sembrano fuori posto e casuali
- Il testo "incit" è troppo distante dalla V (gap eccessivo + margine interno SVG)
- Il logo non comunica l'identità di app di scommesse tra amici
- Manca coerenza tra icona app e wordmark in-app

---

## Design approvato

### 1. Wordmark — `VincitWordmark` component

Struttura puramente tipografica. Niente SVG custom.

```
[V — Cinzel 700]  +  [incit — Cormorant Garamond italic 500]
```

- **V**: font-family `'Cinzel', serif`, font-weight `700`, font-size = prop `size`
- **incit**: font-family `'Cormorant Garamond', serif`, font-style `italic`, font-weight `500`, font-size = `size × 0.64`
- **Spaziatura**: `alignItems: 'baseline'`, `margin-left = -(size × 0.107)` sull'"incit" → effetto parola unica "Vincit"
- **Colore**: `var(--gold)` (adattivo ai temi esistenti)
- **Prop `size`**: invariata rispetto all'attuale — i due punti di utilizzo (`size=22` header, `size=28` sidebar) non cambiano

### 2. Icona App — chip poker premium

Usata per: `vincit-icon.svg`, `vincit-logo.svg`, favicon, PWA manifest, icona Android.

**Struttura SVG (viewBox 0 0 512 512):**

| Layer | Elemento | Valore |
|---|---|---|
| Background | `<rect>` rx=108 | Gradiente radiale `#132817` → `#050f08` |
| Chip bordo | `<circle>` r=230 | 6 settori oro `#d4a830` alternati (stroke-dasharray) |
| Raggi deco | 8 `<line>` | Oro `#d4a830` opacity 0.14, stroke-width 1.2 |
| Anello interno | `<circle>` r=196 | Oro `#d4a830` opacity 0.22, stroke-width 2 |
| Fill centrale | `<circle>` r=192 | `#08160b` |
| Glow | `<circle>` r=140 | Oro opacity 0.07 |
| **V** | `<text>` SVG | font-family Cinzel, weight **900**, size 230, gradiente `#f8ec80` → `#d4a830` → `#8a5e08`, text-anchor middle, x=256 y=310 |

**Proporzioni chip:**
- `stroke-dasharray="60.21 24.08"` → 6 settori ampi + 6 gap stretti
- `stroke-dashoffset="12"` → settori centrati diagonalmente
- Opacità gap: usare strato di copertura stesso colore sfondo

### 3. Palette colori icona

| Token | Valore | Uso |
|---|---|---|
| Verde notte | `#091408` | Background principale icona |
| Verde profondo | `#132817` → `#050f08` | Gradiente radiale bg |
| Verde centrale | `#08160b` | Fill area centrale chip |
| Oro principale | `#d4a830` | Bordo chip, raggi, anello |
| Oro chiaro | `#f8ec80` | Top gradiente V |
| Oro scuro | `#8a5e08` | Bottom gradiente V |

> Nota: la palette dell'icona è indipendente dai temi in-app. Il wordmark usa `var(--gold)` per adattarsi a tutti i temi.

---

## File da modificare

### `frontend/index.html`
Aggiungere `Cinzel:wght@700;900` al Google Fonts link esistente:
```html
<!-- prima -->
family=Manrope:wght@...&family=Cormorant+Garamond:ital,...&family=Playfair+Display:...

<!-- dopo -->
family=Cinzel:wght@700;900&family=Manrope:wght@...&family=Cormorant+Garamond:ital,...&family=Playfair+Display:...
```

### `frontend/src/components/Atoms.jsx` — funzione `VincitWordmark`
Sostituire l'intera funzione (righe 167–188). Rimuovere l'SVG con polyline e ₡. Nuova implementazione tipografica pura.

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
      <span style={{
        fontFamily:"'Cormorant Garamond', serif",
        fontStyle: 'italic',
        fontWeight: 500,
        fontSize: Math.round(size * 0.64),
        color: 'var(--gold)',
        letterSpacing: '0.5px',
        marginLeft: -Math.round(size * 0.107),
        lineHeight: 1,
      }}>incit</span>
    </span>
  );
}
```

### `frontend/public/vincit-icon.svg`
Riscrivere con il design chip (512×512). Usato per PWA e Android.

### `frontend/public/vincit-logo.svg`
File non referenziato nel codice — aggiornare per coerenza (stesso SVG di vincit-icon.svg, 512×512 chip).

### `frontend/index.html` — favicon inline
La riga 10 contiene un favicon come data-URI SVG (non usa vincit-logo.svg). Va aggiornato con il chip semplificato in base64. Esempio struttura:
```
viewBox="0 0 512 512" → <rect rx="108"> + <circle> chip + <text> V Cinzel 900
```

---

## Comportamento a piccole dimensioni

| Dimensione | Comportamento |
|---|---|
| 512px, 192px | Chip completo: settori, raggi, anello, glow, V gradiente |
| 48px | Chip semplificato: settori (stroke più spesso), no raggi, V piatta `#d4a830` |
| 32px favicon | Chip minimo: solo bordo con settori + V |

I file SVG generati devono includere la variante a risoluzione piena. Le versioni semplificate vengono gestite dal font rendering del browser a piccole dimensioni o da PNG separati (già gestiti da `scripts/gen-icons.mjs`).

---

## Vincoli tecnici

- Il font Cinzel deve essere caricato **prima** che venga renderizzato il wordmark — già garantito da Google Fonts in `<head>`
- L'SVG dell'icona usa `<text>` con `font-family="'Cinzel', serif"` — il font deve essere embeddato o le icone PNG devono essere rigenerate dopo il cambio
- Le icone PNG (Android adaptive, PWA) vengono generate da `gen-icons.mjs` — va rieseguito dopo aver aggiornato `vincit-icon.svg`
- Il className `"shim"` sull'attuale span "incit" **va mantenuto**: è una CSS animation oro shimmer definita in `App.jsx:132` (gradient left-to-right animato su `-webkit-background-clip:text`). Va applicato anche al nuovo span "incit" nel VincitWordmark. La V Cinzel può usare `var(--gold)` statico o anch'essa `.shim` — preferibile statico per distinguere i due elementi visivamente.
