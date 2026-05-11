'use strict';
const { v2: cloudinary } = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true,
});

const isConfigured = () =>
  !!(process.env.CLOUDINARY_CLOUD_NAME &&
     process.env.CLOUDINARY_API_KEY &&
     process.env.CLOUDINARY_API_SECRET);

async function uploadDataUrl(dataUrl, { folder, publicId, transformation }) {
  if (!isConfigured()) throw new Error('cloudinary_not_configured');
  return cloudinary.uploader.upload(dataUrl, {
    folder,
    public_id:        publicId,
    overwrite:        true,
    invalidate:       true,
    resource_type:    'image',
    transformation,
  });
}

async function destroyByPublicId(folder, publicId) {
  if (!isConfigured()) return;
  try { await cloudinary.uploader.destroy(`${folder}/${publicId}`, { invalidate: true }); }
  catch (e) { /* best-effort */ }
}

module.exports = { uploadDataUrl, destroyByPublicId, isConfigured };
