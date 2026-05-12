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

  // Set an emoji reaction (replaces previous reaction of any kind for that user/bet)
  router.post('/:id/reaction', async (req, res) => {
    try {
      const bettor = req.userId;
      const { emoji } = req.body;
      if (!VALID_EMOJIS.includes(emoji)) {
        return res.status(400).json({ error: 'Emoji non valida' });
      }
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });

      // If the previous reaction had a photo, drop it from Cloudinary
      const prev = await db.query('SELECT image_url FROM reactions WHERE bet_id=$1 AND bettor=$2', [req.params.id, bettor]);
      if (prev.rows[0]?.image_url) {
        destroyByPublicId(REACTION_FOLDER, publicIdFor(req.params.id, bettor)).catch(()=>{});
      }

      await db.query(
        `INSERT INTO reactions (bet_id, bettor, emoji, image_url)
         VALUES ($1, $2, $3, NULL)
         ON CONFLICT (bet_id, bettor) DO UPDATE SET emoji = EXCLUDED.emoji, image_url = NULL`,
        [req.params.id, bettor, emoji]
      );
      broadcastUpdate(req.roomId);
      refreshAchievements(bettor); // first_react milestone
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Set a photo reaction (replaces any previous emoji/photo for that user/bet)
  router.post('/:id/reaction/photo', async (req, res) => {
    try {
      if (!cldReady()) return res.status(503).json({ error: 'image_upload_unavailable' });
      const bettor = req.userId;
      const { dataUrl } = req.body;
      if (typeof dataUrl !== 'string' || !/^data:image\/(jpeg|png|webp|jpg);base64,/i.test(dataUrl))
        return res.status(400).json({ error: 'invalid_image' });

      const approxBytes = Math.floor(dataUrl.length * 0.75);
      if (approxBytes > 5 * 1024 * 1024) return res.status(413).json({ error: 'image_too_large' });

      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });

      const result = await uploadDataUrl(dataUrl, {
        folder:   REACTION_FOLDER,
        publicId: publicIdFor(req.params.id, bettor),
        transformation: [
          { width: 1080, height: 1080, crop: 'limit' },
          { quality: 'auto:good', fetch_format: 'auto' },
        ],
      });

      await db.query(
        `INSERT INTO reactions (bet_id, bettor, emoji, image_url)
         VALUES ($1, $2, NULL, $3)
         ON CONFLICT (bet_id, bettor) DO UPDATE SET emoji = NULL, image_url = EXCLUDED.image_url`,
        [req.params.id, bettor, result.secure_url]
      );
      broadcastUpdate(req.roomId);
      refreshAchievements(bettor); // first_photo + paparazzo levels
      res.json({ image_url: result.secure_url });
    } catch (err) {
      console.error('reaction photo upload failed', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete('/:id/reaction/:bettor', async (req, res) => {
    try {
      const { rows } = await db.query('SELECT room_id FROM bets WHERE id=$1', [req.params.id]);
      if (!rows[0] || rows[0].room_id !== req.roomId) return res.status(403).json({ error: 'Forbidden' });
      // Best-effort cleanup if was photo
      const prev = await db.query('SELECT image_url FROM reactions WHERE bet_id=$1 AND bettor=$2', [req.params.id, req.userId]);
      if (prev.rows[0]?.image_url) {
        destroyByPublicId(REACTION_FOLDER, publicIdFor(req.params.id, req.userId)).catch(()=>{});
      }
      await db.query(
        'DELETE FROM reactions WHERE bet_id = $1 AND bettor = $2',
        [req.params.id, req.userId]
      );
      broadcastUpdate(req.roomId);
      res.json({ ok: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};
