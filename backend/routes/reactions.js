'use strict';
const express = require('express');
const db = require('../db.js');
const { uploadDataUrl, destroyByPublicId, isConfigured: cldReady } = require('../cloudinary.js');
const { refreshAchievements } = require('../achievements.js');

const VALID_EMOJIS = ['🔥', '😂', '👀', '💀', '⚡'];
const REACTION_FOLDER = 'betcouple/reactions';

const publicIdFor = (betId, bettor) => `${betId}__${bettor}`;

module.exports = function(broadcastUpdate) {
  const router = express.Router();

  // Set the emoji reaction. Emoji and photo are now INDEPENDENT — adding/
  // changing an emoji never touches the user's photo (or vice versa). The
  // unique row per (bet, bettor) still holds, but both columns can be
  // populated at the same time, like leaving a sticker on top of a posted
  // image in a chat.
  router.post('/:id/reaction', async (req, res) => {
    try {
      const bettor = req.userId;
      const { emoji } = req.body;
      if (!VALID_EMOJIS.includes(emoji)) {
        return res.status(400).json({ error: 'Emoji non valida' });
      }
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });

      // Upsert: set emoji, LEAVE image_url alone. ON CONFLICT we explicitly
      // touch only the emoji column — the existing image_url survives.
      await db.query(
        `INSERT INTO reactions (bet_id, bettor, emoji, image_url)
         VALUES ($1, $2, $3, NULL)
         ON CONFLICT (bet_id, bettor) DO UPDATE SET emoji = EXCLUDED.emoji`,
        [req.params.id, bettor, emoji]
      );
      broadcastUpdate(req.activeRoomId);
      refreshAchievements(bettor); // first_react milestone
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Clear ONLY the emoji column (toggle-off). The photo, if any, stays.
  // Frontend `handleReaction` calls this when the user re-clicks their
  // current emoji — instead of the old DELETE that nuked the whole row.
  router.delete('/:id/reaction/emoji', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });
      // Set emoji NULL but keep image_url; if the row ends up empty
      // (no emoji + no photo), drop it entirely to keep the table clean.
      await db.query(
        `UPDATE reactions SET emoji = NULL WHERE bet_id = $1 AND bettor = $2`,
        [req.params.id, req.userId]
      );
      await db.query(
        `DELETE FROM reactions WHERE bet_id = $1 AND bettor = $2
           AND emoji IS NULL AND image_url IS NULL`,
        [req.params.id, req.userId]
      );
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Set/replace the photo reaction. Replacing a previous photo still drops
  // the old Cloudinary asset (publicId is deterministic so the new upload
  // overwrites the same file anyway, but the destroy ensures the row's
  // emoji column is preserved separately).
  router.post('/:id/reaction/photo', async (req, res) => {
    try {
      if (!cldReady()) return res.status(503).json({ error: 'image_upload_unavailable' });
      const bettor = req.userId;
      const { dataUrl } = req.body;
      if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,/i.test(dataUrl))
        return res.status(400).json({ error: 'invalid_image' });

      const approxBytes = Math.floor(dataUrl.length * 0.75);
      if (approxBytes > 5 * 1024 * 1024) return res.status(413).json({ error: 'image_too_large' });

      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });

      const result = await uploadDataUrl(dataUrl, {
        folder:   REACTION_FOLDER,
        publicId: publicIdFor(req.params.id, bettor),
        transformation: [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
      });

      // Set image_url, LEAVE emoji alone — symmetric with the emoji handler.
      await db.query(
        `INSERT INTO reactions (bet_id, bettor, emoji, image_url)
         VALUES ($1, $2, NULL, $3)
         ON CONFLICT (bet_id, bettor) DO UPDATE SET image_url = EXCLUDED.image_url`,
        [req.params.id, bettor, result.secure_url]
      );
      broadcastUpdate(req.activeRoomId);
      refreshAchievements(bettor); // paparazzo + reactor levels
      res.json({ image_url: result.secure_url });
    } catch (err) {
      console.error('reaction photo upload failed', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Clear ONLY the photo (drops Cloudinary asset). Emoji, if any, stays.
  router.delete('/:id/reaction/photo', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });
      const prev = await db.query('SELECT image_url FROM reactions WHERE bet_id=$1 AND bettor=$2', [req.params.id, req.userId]);
      if (prev.rows[0]?.image_url) {
        destroyByPublicId(REACTION_FOLDER, publicIdFor(req.params.id, req.userId)).catch(()=>{});
      }
      await db.query(
        `UPDATE reactions SET image_url = NULL WHERE bet_id = $1 AND bettor = $2`,
        [req.params.id, req.userId]
      );
      await db.query(
        `DELETE FROM reactions WHERE bet_id = $1 AND bettor = $2
           AND emoji IS NULL AND image_url IS NULL`,
        [req.params.id, req.userId]
      );
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Legacy "nuke everything for this user/bet" — kept for any older
  // client that still calls it. New UI uses the per-column endpoints above.
  router.delete('/:id/reaction/:bettor', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.activeRoomId) return res.status(403).json({ error: 'Forbidden' });
      const prev = await db.query('SELECT image_url FROM reactions WHERE bet_id=$1 AND bettor=$2', [req.params.id, req.userId]);
      if (prev.rows[0]?.image_url) {
        destroyByPublicId(REACTION_FOLDER, publicIdFor(req.params.id, req.userId)).catch(()=>{});
      }
      await db.query(
        'DELETE FROM reactions WHERE bet_id = $1 AND bettor = $2',
        [req.params.id, req.userId]
      );
      broadcastUpdate(req.activeRoomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
