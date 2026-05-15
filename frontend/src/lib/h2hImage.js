// Renders a BetCouple head-to-head summary as a 1080×1350 PNG suitable
// for sharing on Instagram stories / WhatsApp / etc. Pure canvas, no
// avatar URLs needed (we paint a color disc + first letter so there's
// nothing to load and no CORS surprises with Cloudinary).

const W = 1080;
const H = 1350;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function initial(name) {
  const s = (name || '?').trim();
  return s ? s[0].toUpperCase() : '?';
}

// Convert a hex like "#c8973f" to "rgba()" with alpha 0..1.
function withAlpha(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8)  & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

export async function renderH2HCard({
  myName, myColor, opponentName, opponentColor,
  myWins, theirWins, netMe, totalBets,
  streak = 0,            // signed: positive = my wins in a row, negative = theirs
  brand = 'Vincit',
}) {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas-unavailable');

  // ── Background: deep gradient + ambient gold smudges ─────────────
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f0d1f');
  bg.addColorStop(1, '#07060f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Two radial spotlights (gold + purple) for depth
  const spotA = ctx.createRadialGradient(180, 200, 0, 180, 200, 500);
  spotA.addColorStop(0, 'rgba(200,151,63,.18)');
  spotA.addColorStop(1, 'rgba(200,151,63,0)');
  ctx.fillStyle = spotA;
  ctx.fillRect(0, 0, W, H);

  const spotB = ctx.createRadialGradient(W - 180, H - 220, 0, W - 180, H - 220, 520);
  spotB.addColorStop(0, 'rgba(160,126,245,.16)');
  spotB.addColorStop(1, 'rgba(160,126,245,0)');
  ctx.fillStyle = spotB;
  ctx.fillRect(0, 0, W, H);

  // Hairline border
  ctx.strokeStyle = 'rgba(200,151,63,.4)';
  ctx.lineWidth = 2;
  roundRect(ctx, 20, 20, W - 40, H - 40, 28);
  ctx.stroke();

  // ── Top kicker ───────────────────────────────────────────────────
  ctx.fillStyle = '#c8973f';
  ctx.font = '700 30px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('⚔  HEAD-TO-HEAD', W / 2, 90);

  // ── Avatars VS row ───────────────────────────────────────────────
  const cy = 360;                  // avatar center Y
  const r  = 110;                  // avatar radius
  const xL = W * 0.27;             // left avatar center X
  const xR = W * 0.73;             // right avatar center X

  // Winner halo
  const winnerSide = myWins === theirWins ? null : (myWins > theirWins ? 'me' : 'them');
  const drawAvatar = (cx, color, name, isWinner) => {
    // Halo (gold) for the winner
    if (isWinner) {
      ctx.beginPath();
      ctx.arc(cx, cy, r + 18, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha('#c8973f', .18);
      ctx.fill();
    }
    // Ring
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = withAlpha(color, .33);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = isWinner ? '#c8973f' : withAlpha(color, .8);
    ctx.stroke();
    // Initial
    ctx.fillStyle = '#fff';
    ctx.font = 'italic 600 110px "Cormorant Garamond", "Georgia", serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(initial(name), cx, cy + 6);
    // Name under
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.font = '700 26px "Manrope", "Helvetica Neue", Arial, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText((name || '').toUpperCase(), cx, cy + r + 28);
  };

  drawAvatar(xL, myColor       || '#5b8af0', myName       || 'Tu',  winnerSide === 'me');
  drawAvatar(xR, opponentColor || '#a07ef5', opponentName || 'Lui', winnerSide === 'them');

  // VS pill in the middle
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  roundRect(ctx, W / 2 - 60, cy - 32, 120, 64, 32);
  ctx.fill();
  ctx.fillStyle = '#c8973f';
  ctx.font = '800 32px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', W / 2, cy);

  // ── Score: huge italic serif numbers ─────────────────────────────
  const scoreY = 660;
  ctx.font = 'italic 700 220px "Cormorant Garamond", "Georgia", serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = winnerSide === 'me' ? '#c8973f' : 'rgba(255,255,255,.92)';
  ctx.textAlign = 'right';
  ctx.fillText(String(myWins), W / 2 - 70, scoreY);

  ctx.fillStyle = 'rgba(255,255,255,.35)';
  ctx.font = '800 70px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('—', W / 2, scoreY);

  ctx.fillStyle = winnerSide === 'them' ? '#c8973f' : 'rgba(255,255,255,.92)';
  ctx.font = 'italic 700 220px "Cormorant Garamond", "Georgia", serif';
  ctx.textAlign = 'left';
  ctx.fillText(String(theirWins), W / 2 + 70, scoreY);

  // ── Net credits banner ───────────────────────────────────────────
  const netPositive = (netMe || 0) >= 0;
  const netTxt = `${netPositive ? '+' : ''}${netMe || 0} ₡`;
  ctx.font = '800 56px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.fillStyle = netPositive ? '#3cc18b' : '#e87171';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(netTxt, W / 2, 870);

  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = '600 24px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('BILANCIO PER ME', W / 2, 950);

  // ── Stats row: total bets + current streak ───────────────────────
  const pad = 80;
  const rowY = 1060;
  const rowH = 130;
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2, rowY); ctx.lineTo(W / 2, rowY + rowH);
  ctx.stroke();

  // Total bets
  ctx.fillStyle = '#c8973f';
  ctx.font = '800 56px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(String(totalBets || 0), W * 0.27, rowY + 10);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font = '600 20px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText('BET RISOLTE', W * 0.27, rowY + 84);

  // Streak (only if ≥2)
  const absStreak = Math.abs(streak || 0);
  ctx.fillStyle = streak >= 0 ? '#3cc18b' : '#e87171';
  ctx.font = '800 56px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(absStreak >= 2 ? `${streak >= 0 ? '🔥' : '❄️'} ${absStreak}` : '—', W * 0.73, rowY + 10);
  ctx.fillStyle = 'rgba(255,255,255,.45)';
  ctx.font = '600 20px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.fillText(absStreak >= 2 ? (streak >= 0 ? 'STREAK A MIO FAVORE' : 'STREAK CONTRO') : 'NESSUNA STREAK', W * 0.73, rowY + 84);

  // ── Footer brand ─────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(200,151,63,.55)';
  ctx.font = '700 22px "Manrope", "Helvetica Neue", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${brand.toUpperCase()}`, W / 2, H - 70);

  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob-failed')), 'image/png');
  });
}

// Convenience wrapper: render and either share via the Web Share API or
// fall back to downloading the PNG. Returns true if anything happened.
export async function shareH2HCard(params) {
  let blob;
  try { blob = await renderH2HCard(params); }
  catch (e) { console.error('[h2h-image]', e); return false; }

  const file = new File([blob], 'vincit-h2h.png', { type: 'image/png' });
  const shareData = {
    files: [file],
    title: 'Head-to-head',
    text: params?.opponentName
      ? `Io vs ${params.opponentName}: ${params.myWins ?? 0}-${params.theirWins ?? 0} · Vincit`
      : 'Vincit head-to-head',
  };

  try {
    if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare(shareData)) {
      await navigator.share(shareData);
      return true;
    }
  } catch { /* user cancelled — fall through to download */ }

  // Fallback: trigger a download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vincit-h2h.png';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
