require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { router: eventsRouter, broadcastUpdate } = require('./routes/events.js');
const db = require('./db.js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json());

app.use('/api/events',     eventsRouter);
app.use('/api/state',      require('./routes/state.js'));
app.use('/api/bets',       require('./routes/bets.js')(broadcastUpdate));
app.use('/api/profiles',   require('./routes/profiles.js')(broadcastUpdate));
app.use('/api/credits',    require('./routes/credits.js')(broadcastUpdate));
app.use('/api/categories', require('./routes/categories.js')(broadcastUpdate));
app.use('/api/bets',       require('./routes/reactions.js')(broadcastUpdate));

app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`BetCouple running on http://0.0.0.0:${PORT}`);
});

setInterval(async () => {
  try {
    const now = Date.now();
    const result = await db.query(
      "UPDATE bets SET status='expired' WHERE status='active' AND expires_at IS NOT NULL AND expires_at < $1",
      [now]
    );
    if (result.rowCount > 0) broadcastUpdate();
  } catch (err) {
    console.error('Expiry job error:', err);
  }
}, 5 * 60 * 1000);
