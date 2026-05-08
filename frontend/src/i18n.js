import React, { createContext, useContext, useState, useCallback } from 'react';

const lsGet = (k,fb) => { try { const v=localStorage.getItem(k); return v!==null?JSON.parse(v):fb; } catch { return fb; } };
const lsSet = (k,v) => { try { localStorage.setItem(k,JSON.stringify(v)); } catch {} };

const TRANSLATIONS = {
  it: {
    date:    { locale:'it-IT', expired:'SCADUTA', days:'g', hours:'h', minutes:'m' },
    cats:    { intimo:'Intimo', serata:'Serata', casa:'Casa', cibo:'Cibo', gaming:'Gaming', altro:'Altro' },
    qpre:    { q110:'👑 Quasi certo', q130:'🔥 Molto prob.', q150:'⚡ Probabile', q200:'🎲 Fifty-fifty', q350:'💀 Outsider', q600:'🌙 Miracolo' },
    welcome: { private:'Privato · Solo per voi', subtitle:'Il vostro gioco privato di scommesse', iam:'Sono io', footer:'Quote decimali europee · Dati salvati sul server' },
    app:     { welcome_back:'Bentornato', credits:'Crediti', switch:'Switch', new_bet:'+ Nuova Bet', new_bet_label:'Nuova', error_create:'Errore nella creazione della bet. Riprova.', error_cancel:"Errore durante l'annullamento. Riprova.", error_edit:'Errore durante la modifica. Riprova.' },
    nav:     { dashboard:'Home', bets:'Bets', vault:'Vault', stats:'Stats', settings:'Config' },
    create: {
      title:'Nuova Bet 🎲', secret_on_label:'🔒 Bet Segreta (Vault)', secret_off_label:'👁 Bet Condivisa',
      secret_on_desc:'Solo tu la vedi · Timestamp garantisce onestà', secret_off_desc:'Visibile a entrambi',
      counter_title:'⚡ Abilita Sfida Diretta', counter_desc:'può scommettere SÌ o NO',
      bet_label:'Scommessa', bet_placeholder_sec:"es. Stasera facciamo l'amore...", bet_placeholder_pub:'es. Giulia arriverà in ritardo sabato',
      quota_label:'Quota & Probabilità', prob_label:'Probabilità implicita', direct_quota:'Quota diretta:', no_label:'NO:',
      impossible:'Impossibile', certain:'Certissimo', stake_label:'Stake', stake_max:'Max', stake_placeholder:'Importo libero...',
      risks:'Rischi', net:'Netta', total:'Totale', category_label:'Categoria',
      forfeit_label:'Pegno (opzionale)', forfeit_placeholder:"es. Ti preparo la colazione · scelgo io il film...",
      expires_label:'Scadenza (opzionale)', submit_secret:'🔒 Sigilla nel Vault', submit_shared:'🎯 Crea Bet',
      err_title:'Inserisci una descrizione', err_stake:'Stake non valido (max {max} ₡)',
    },
    dashboard: {
      ranking:'Classifica', wins:'vittorie', win_rate:'Win Rate', credits:'Crediti', total_bets:'Bet tot.',
      vault_teaser:'Vault Segreto', vault_teaser_one:'{n} bet privata — vai nel Vault per rivelare', vault_teaser_many:'{n} bet private — vai nel Vault per rivelare',
      expiry:'⏱ {n} bet in scadenza entro 24h!', active:'Bets attive', no_active:'Nessuna bet attiva', no_active_sub:'Inizia a scommettere!',
      cta:'+ Nuova Bet', recent:'Ultime risolte', notif_one:'ha creato 1 nuova bet!', notif_many:'ha creato {n} nuove bet!', notif_sub:'Guarda le Bets Condivise',
      best_bet:'Bet più epica:', net_profit:'Profitto netto {name}:',
      expired_one:"⏱ 1 bet scaduta — dichiara l'esito!", expired_many:"⏱ {n} bet scadute — dichiara l'esito!",
      months:['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'],
    },
    bets_view: { title:'🎯 Bets Condivise', sub_one:'1 attiva in questo momento', sub_many:'{n} attive in questo momento', mine:'Le mie', theirs:'Di {name}', empty:'Nessuna bet condivisa attiva',
      f_all:'Tutte', f_active:'Attive', f_won:'Vinte', f_lost:'Perse', f_expired:'Scadute',
      f_mine:'Le mie', f_theirs:'Del partner', f_cats:'Cat.',
    },
    vault_view: {
      title:'🔒 Vault Segreto', subtitle:'Solo tu vedi queste bet',
      honesty:"✦ Il timestamp di creazione è la tua prova di onestà — non puoi creare una bet dopo che l'evento è già accaduto",
      locked_title:'Vault Protetto', locked_sub:'Inserisci il PIN per accedere alle tue bet segrete', unlock_btn:'Sblocca Vault',
      empty_title:'Vault vuoto', empty_sub:'Crea una bet segreta per iniziare',
      sealed:'🔒 Sigillata', reveal_btn:'🔓 Rivela Bet', resolved:'Risolte', stake:'Stake', win:'Win',
    },
    stats_view: {
      title:'📊 Statistiche', balance:'Saldo Attuale', net_pos:'▲ {n} ₡ netti', net_neg:'▼ {n} ₡ netti',
      won:'Vinte', lost:'Perse', win_rate:'Win Rate', streak:'Streak max', best:'🏆 Migliore Vittoria',
      by_cat:'Per Categoria', hof:'🔥 Hall of Fame', no_bets:'Nessuna bet risolta — inizia a giocare!',
    },
    settings: {
      title:'⚙️ Impostazioni', profiles:'Profili', my_profile:'Il tuo profilo', partner:'Partner',
      avatar_label:'Avatar', color_label:'Colore tema', lang_label:'Lingua', lang_desc:"Scegli la lingua dell'app",
      vault_pin:'Vault PIN (mio)', vault_active:'🔒 PIN attivo', vault_none:'🔓 Nessun PIN',
      vault_protected:'Il vault è protetto', vault_accessible:'Il vault è accessibile', vault_warning:'⚠ Il PIN si resetta al ricaricamento della pagina',
      pin_new:'Nuovo PIN (4 cifre):', pin_confirm:'Conferma PIN:', pin_set:'Imposta PIN', pin_change:'Cambia PIN',
      pin_remove:'Rimuovi', pin_save:'Salva', pin_cancel:'Annulla', pin_err_len:'Il PIN deve essere 4 cifre', pin_err_match:'I PIN non coincidono',
      acct_pin:'PIN Account (mio)', acct_pin_desc:"Protegge l'accesso al profilo su qualsiasi dispositivo",
      acct_current:'PIN attuale:', acct_new:'Nuovo PIN:', acct_confirm:'Conferma nuovo PIN:',
      acct_set:'Imposta PIN', acct_change:'Cambia PIN', acct_remove_btn:'Rimuovi PIN',
      acct_confirm_remove:'Conferma PIN attuale per rimuoverlo:', acct_remove_action:'Rimuovi',
      acct_err_wrong:'PIN attuale errato', acct_err_current:'Inserisci il PIN attuale', acct_err_generic:'Errore. Riprova.',
      theme:'Tema', theme_dark:'🌙 Modalità Scura', theme_light:'☀️ Modalità Chiara', theme_desc:"Cambia aspetto dell'app",
      custom_cats:'Categorie Personalizzate', cat_name_ph:'Nome categoria', cat_add:'+ Aggiungi',
      credits_section:'Crediti', balance:'Saldo:', amount_ph:'Importo', credits_add:'+ Aggiungi', credits_sub:'− Sottrai',
      credits_confirm_q:'Sottrarre {amount} ₡ da {name}?', credits_confirm:'Conferma', credits_cancel:'Annulla', credits_err:'Crediti insufficienti',
    },
    bet_card: {
      reveal:'🔓 Rivela', declare:'Dichiara esito', secret_label:'Bet Segreta', challenge:'Sfida diretta',
      stake:'Stake', win:'Win', yes:'SÌ', no:'NO', counter_cta:'⚡ Scommetti SÌ {qy}× o NO {qn}×',
      my_pos:'La tua posizione:', side_yes:'✅ SÌ', side_no:'❌ NO',
      cancel_btn:'Annulla Bet', cancel_confirm:'Annullare questa bet? Lo stake ti verrà rimborsato.', cancel_window:'{m}m rimasti',
      edit_btn:'Modifica', swipe_resolve:'scorri per dichiarare esito',
    },
    edit_modal: { title:'Modifica Bet ✏️', stake_note:'Stake fisso: {stake} ₡  •  Win:', submit:'✏️ Salva Modifiche' },
    reveal:   { title:'Rivelazione 🔓', created:'Creata:', tap:'Tocca per rivelare', happened:'È successa?', yes_btn:'✅ Sì! Ho vinto', no_btn:'❌ No, persa', cancel:'Annulla' },
    resolve:  { title:'Dichiara Esito', positions:'Posizioni in gioco', yes_btn:'✅ SÌ — È successa! (+{net} ₡)', no_btn:'❌ NO — Non è successa (−{stake} ₡)', overtime:'🎲 OVERTIME — Testa o Croce', cancel:'Annulla', quota:'Quota', stake:'Stake', win:'Win', yes:'SÌ', no:'NO' },
    overtime: { title:'🎲 OVERTIME', desc:'Decide il caso.', flip:'Lancia la moneta!', flipping:'La moneta gira...', winner:'vince!', fate:'Il caso ha deciso 🤝', accept:'Accetto ✓', close:'Chiudi' },
    counter:  { title:'⚡ Sfida Diretta', by:'di', yes_label:'SÌ succederà', no_label:'NO non succederà', stake_max:'Stake (max {max} ₡)', placeholder:'Importo libero...', risks:'Rischi', pot_win:'Vincita pot.', cancel:'Annulla', bet_yes:'Scommetti SÌ →', bet_no:'Scommetti NO →' },
    comment:  { won:'✅ Vinta!', lost:'❌ Persa', prompt:"Aggiungi un commento... es. \"te l'avevo detto! 😂\"", placeholder:'Scrivi un commento...', save:'Salva commento', skip:'Salta' },
    pin_modal:  { title:'PIN Vault', subtitle:'Inserisci il PIN a 4 cifre', placeholder:'● ● ● ●', unlock:'Sblocca', cancel:'Annulla', err_wrong:'PIN errato — riprova' },
    pin_login:  { subtitle:'Inserisci il PIN account', placeholder:'●●●●', forgot:'Hai dimenticato il PIN?', forgot_hint:'Chiedi al tuo partner 💬', back:'Indietro', err_wrong:'PIN errato', err_network:'Errore di rete' },
  },

  en: {
    date:    { locale:'en-US', expired:'EXPIRED', days:'d', hours:'h', minutes:'m' },
    cats:    { intimo:'Intimate', serata:'Night Out', casa:'Home', cibo:'Food', gaming:'Gaming', altro:'Other' },
    qpre:    { q110:'👑 Almost certain', q130:'🔥 Very likely', q150:'⚡ Probable', q200:'🎲 Fifty-fifty', q350:'💀 Outsider', q600:'🌙 Miracle' },
    welcome: { private:'Private · Just the two of you', subtitle:'Your personal couples betting game', iam:"That's me", footer:'European decimal odds · Data stored on server' },
    app:     { welcome_back:'Welcome back', credits:'Credits', switch:'Switch', new_bet:'+ New Bet', new_bet_label:'New', error_create:'Failed to create the bet. Please try again.', error_cancel:'Failed to cancel the bet. Please try again.', error_edit:'Failed to edit the bet. Please try again.' },
    nav:     { dashboard:'Home', bets:'Bets', vault:'Vault', stats:'Stats', settings:'Settings' },
    create: {
      title:'New Bet 🎲', secret_on_label:'🔒 Secret Bet (Vault)', secret_off_label:'👁 Shared Bet',
      secret_on_desc:'Only you can see it · Timestamp proves honesty', secret_off_desc:'Visible to both of you',
      counter_title:'⚡ Enable Direct Challenge', counter_desc:'can bet YES or NO',
      bet_label:'Bet', bet_placeholder_sec:"e.g. Tonight we'll make love...", bet_placeholder_pub:'e.g. Giulia will be late on Saturday',
      quota_label:'Odds & Probability', prob_label:'Implied probability', direct_quota:'Direct odds:', no_label:'NO:',
      impossible:'Impossible', certain:'Certain', stake_label:'Stake', stake_max:'Max', stake_placeholder:'Custom amount...',
      risks:'You risk', net:'Net', total:'Total', category_label:'Category',
      forfeit_label:'Forfeit (optional)', forfeit_placeholder:"e.g. I'll make you breakfast · you pick the movie...",
      expires_label:'Expiry (optional)', submit_secret:'🔒 Seal in Vault', submit_shared:'🎯 Place Bet',
      err_title:'Please enter a description', err_stake:'Invalid stake (max {max} ₡)',
    },
    dashboard: {
      ranking:'Leaderboard', wins:'wins', win_rate:'Win Rate', credits:'Credits', total_bets:'Total bets',
      vault_teaser:'Secret Vault', vault_teaser_one:'{n} private bet — go to Vault to reveal', vault_teaser_many:'{n} private bets — go to Vault to reveal',
      expiry:'⏱ {n} bet expiring within 24h!', active:'Active Bets', no_active:'No active bets', no_active_sub:'Start betting!',
      cta:'+ New Bet', recent:'Recently resolved', notif_one:'created 1 new bet!', notif_many:'created {n} new bets!', notif_sub:'Check out Shared Bets',
      best_bet:'Most epic bet:', net_profit:"{name}'s net profit:",
      expired_one:'⏱ 1 expired bet — declare the result!', expired_many:'⏱ {n} expired bets — declare the results!',
      months:['January','February','March','April','May','June','July','August','September','October','November','December'],
    },
    bets_view: { title:'🎯 Shared Bets', sub_one:'1 active right now', sub_many:'{n} active right now', mine:'Mine', theirs:"{name}'s", empty:'No active shared bets',
      f_all:'All', f_active:'Active', f_won:'Won', f_lost:'Lost', f_expired:'Expired',
      f_mine:'Mine', f_theirs:"Partner's", f_cats:'Cat.',
    },
    vault_view: {
      title:'🔒 Secret Vault', subtitle:'Only you can see these bets',
      honesty:'✦ The creation timestamp is your proof of honesty — you cannot create a bet after the event has already happened',
      locked_title:'Vault Locked', locked_sub:'Enter your PIN to access your secret bets', unlock_btn:'Unlock Vault',
      empty_title:'Vault is empty', empty_sub:'Create a secret bet to get started',
      sealed:'🔒 Sealed', reveal_btn:'🔓 Reveal Bet', resolved:'Resolved', stake:'Stake', win:'Win',
    },
    stats_view: {
      title:'📊 Statistics', balance:'Current Balance', net_pos:'▲ {n} ₡ net', net_neg:'▼ {n} ₡ net',
      won:'Won', lost:'Lost', win_rate:'Win Rate', streak:'Best streak', best:'🏆 Best Win',
      by_cat:'By Category', hof:'🔥 Hall of Fame', no_bets:'No resolved bets yet — start playing!',
    },
    settings: {
      title:'⚙️ Settings', profiles:'Profiles', my_profile:'Your profile', partner:'Partner',
      avatar_label:'Avatar', color_label:'Theme color', lang_label:'Language', lang_desc:'Choose the app language',
      vault_pin:'Vault PIN (mine)', vault_active:'🔒 PIN active', vault_none:'🔓 No PIN set',
      vault_protected:'The vault is protected', vault_accessible:'The vault is accessible', vault_warning:'⚠ PIN resets on page reload',
      pin_new:'New PIN (4 digits):', pin_confirm:'Confirm PIN:', pin_set:'Set PIN', pin_change:'Change PIN',
      pin_remove:'Remove', pin_save:'Save', pin_cancel:'Cancel', pin_err_len:'PIN must be 4 digits', pin_err_match:"PINs don't match",
      acct_pin:'Account PIN (mine)', acct_pin_desc:'Protects profile access on any device',
      acct_current:'Current PIN:', acct_new:'New PIN:', acct_confirm:'Confirm new PIN:',
      acct_set:'Set PIN', acct_change:'Change PIN', acct_remove_btn:'Remove PIN',
      acct_confirm_remove:'Enter current PIN to remove it:', acct_remove_action:'Remove',
      acct_err_wrong:'Current PIN is incorrect', acct_err_current:'Enter your current PIN', acct_err_generic:'Something went wrong. Try again.',
      theme:'Theme', theme_dark:'🌙 Dark Mode', theme_light:'☀️ Light Mode', theme_desc:'Change the app appearance',
      custom_cats:'Custom Categories', cat_name_ph:'Category name', cat_add:'+ Add',
      credits_section:'Credits', balance:'Balance:', amount_ph:'Amount', credits_add:'+ Add', credits_sub:'− Subtract',
      credits_confirm_q:'Subtract {amount} ₡ from {name}?', credits_confirm:'Confirm', credits_cancel:'Cancel', credits_err:'Insufficient credits',
    },
    bet_card: {
      reveal:'🔓 Reveal', declare:'Declare result', secret_label:'Secret Bet', challenge:'Direct challenge',
      stake:'Stake', win:'Win', yes:'YES', no:'NO', counter_cta:'⚡ Bet YES {qy}× or NO {qn}×',
      my_pos:'Your position:', side_yes:'✅ YES', side_no:'❌ NO',
      cancel_btn:'Cancel Bet', cancel_confirm:'Cancel this bet? Your stake will be refunded.', cancel_window:'{m}m left',
      edit_btn:'Edit', swipe_resolve:'swipe to declare result',
    },
    edit_modal: { title:'Edit Bet ✏️', stake_note:'Fixed stake: {stake} ₡  •  Win:', submit:'✏️ Save Changes' },
    reveal:   { title:'Reveal 🔓', created:'Created:', tap:'Tap to reveal', happened:'Did it happen?', yes_btn:'✅ Yes! I won', no_btn:'❌ No, lost', cancel:'Cancel' },
    resolve:  { title:'Declare Result', positions:'Positions at stake', yes_btn:'✅ YES — It happened! (+{net} ₡)', no_btn:"❌ NO — Didn't happen (−{stake} ₡)", overtime:'🎲 OVERTIME — Flip a Coin', cancel:'Cancel', quota:'Odds', stake:'Stake', win:'Win', yes:'YES', no:'NO' },
    overtime: { title:'🎲 OVERTIME', desc:'Let fate decide.', flip:'Flip the coin!', flipping:'The coin is spinning...', winner:'wins!', fate:'Fate has spoken 🤝', accept:'Accept ✓', close:'Close' },
    counter:  { title:'⚡ Direct Challenge', by:'by', yes_label:'YES it will happen', no_label:"NO it won't happen", stake_max:'Stake (max {max} ₡)', placeholder:'Custom amount...', risks:'You risk', pot_win:'Pot. win', cancel:'Cancel', bet_yes:'Bet YES →', bet_no:'Bet NO →' },
    comment:  { won:'✅ Won!', lost:'❌ Lost', prompt:'Add a comment... e.g. "told you so! 😂"', placeholder:'Write a comment...', save:'Save comment', skip:'Skip' },
    pin_modal:  { title:'Vault PIN', subtitle:'Enter your 4-digit PIN', placeholder:'● ● ● ●', unlock:'Unlock', cancel:'Cancel', err_wrong:'Wrong PIN — try again' },
    pin_login:  { subtitle:'Enter your account PIN', placeholder:'●●●●', forgot:'Forgot your PIN?', forgot_hint:'Ask your partner 💬', back:'Back', err_wrong:'Wrong PIN', err_network:'Network error' },
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => lsGet('bc_lang', 'it'));
  const setLang = useCallback(l => { lsSet('bc_lang', l); setLangState(l); }, []);
  const t = useCallback((key, vars = {}) => {
    const keys = key.split('.');
    let val = TRANSLATIONS[lang] ?? TRANSLATIONS.it;
    for (const k of keys) { val = val?.[k]; if (val === undefined) break; }
    if (val === undefined) { val = TRANSLATIONS.it; for (const k of keys) { val = val?.[k]; if (val === undefined) break; } }
    if (typeof val !== 'string') return key;
    return Object.entries(vars).reduce((s,[k,v]) => s.replaceAll(`{${k}}`,String(v)), val);
  }, [lang]);
  return React.createElement(LanguageContext.Provider, { value: { t, lang, setLang } }, children);
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be inside <LanguageProvider>');
  return ctx;
}

export { TRANSLATIONS };
