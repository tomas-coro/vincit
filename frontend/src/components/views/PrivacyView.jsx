import React from 'react';

// Informativa privacy minimale e onesta. Testo statico in italiano
// (pubblico italiano; il resto dell'app è bilingue ma un'informativa
// tradotta a metà è peggio di una sola, chiara).
const SEC = { marginBottom: 22 };
const H2  = { fontSize: 15, fontWeight: 700, color: 'var(--txt)', margin: '0 0 6px' };
const P   = { fontSize: 13, lineHeight: 1.6, color: 'var(--dim)', margin: 0 };

export default function PrivacyView({ onBack }) {
  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '24px 18px 60px' }}>
      <button onClick={onBack} aria-label="Indietro"
        style={{ background: 'transparent', border: '1px solid var(--brd)', color: 'var(--dim)',
          borderRadius: 10, padding: '8px 14px', fontSize: 13, cursor: 'pointer', marginBottom: 20 }}>
        ← Indietro
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--txt)', margin: '0 0 4px' }}>Privacy</h1>
      <p style={{ ...P, marginBottom: 26 }}>Ultimo aggiornamento: giugno 2026</p>

      <div style={SEC}>
        <h2 style={H2}>Cosa raccogliamo</h2>
        <p style={P}>Email, nickname, avatar (emoji o foto che carichi tu) e le scommesse
        che crei con il tuo gruppo: titolo, importi in crediti virtuali, esiti, reazioni e
        commenti. Niente dati di pagamento: i crediti di Vincit non sono denaro reale.</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Dove stanno i dati</h2>
        <p style={P}>L'app gira su Render, il database è PostgreSQL su Neon e le foto
        avatar sono su Cloudinary. La connessione è sempre cifrata (HTTPS).</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Cosa NON facciamo</h2>
        <p style={P}>Nessun tracker, nessuna analytics di terze parti, nessuna pubblicità,
        nessuna vendita o condivisione di dati. Le notifiche push sono opt-in e puoi
        disattivarle quando vuoi dalle impostazioni.</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Chi vede cosa</h2>
        <p style={P}>Le tue scommesse sono visibili solo ai membri del gruppo in cui le
        crei (quelle Vault solo a te). Le impostazioni di visibilità di trofei, statistiche
        e gruppi sono regolabili dal tuo profilo.</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Cancellare i dati</h2>
        <p style={P}>Dal tuo profilo → Elimina account: email, password, avatar e amicizie
        vengono cancellati subito e per sempre. Le scommesse condivise restano nel gruppo
        in forma anonima ("Utente eliminato"), perché lo storico appartiene anche a chi ci
        ha giocato con te.</p>
      </div>

      <div style={SEC}>
        <h2 style={H2}>Contatti</h2>
        <p style={P}>Per qualsiasi richiesta sui tuoi dati: <a href="mailto:amministrazione@74srl.it"
          style={{ color: 'var(--gold)' }}>amministrazione@74srl.it</a></p>
      </div>
    </div>
  );
}
