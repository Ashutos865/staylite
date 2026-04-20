const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// Returns null client when env vars are missing (keys not set yet)
const makeClient = () => {
  if (!process.env.CF_R2_ACCOUNT_ID || !process.env.CF_R2_ACCESS_KEY_ID) return null;
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.CF_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.CF_R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.CF_R2_SECRET_ACCESS_KEY,
    },
  });
};

const isConfigured = () => !!(
  process.env.CF_R2_ACCOUNT_ID &&
  process.env.CF_R2_ACCESS_KEY_ID &&
  process.env.CF_R2_SECRET_ACCESS_KEY &&
  process.env.CF_R2_BUCKET_NAME &&
  process.env.CF_R2_PUBLIC_URL
);

/**
 * Upload a buffer to R2.
 * @returns {Promise<string>} public URL of the uploaded file
 */
const uploadToR2 = async (buffer, originalName, mimetype) => {
  const client = makeClient();
  if (!client) throw new Error('Cloudflare R2 is not configured. Add CF_R2_* keys to .env');

  const ext = path.extname(originalName).toLowerCase();
  const key = `properties/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: process.env.CF_R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: mimetype,
    CacheControl: 'public, max-age=31536000',
  }));

  return `${process.env.CF_R2_PUBLIC_URL}/${key}`;
};

/**
 * Delete a file from R2 by its public URL.
 */
const deleteFromR2 = async (url) => {
  const client = makeClient();
  if (!client) return; // silently skip if not configured

  const key = url.replace(`${process.env.CF_R2_PUBLIC_URL}/`, '');
  await client.send(new DeleteObjectCommand({
    Bucket: process.env.CF_R2_BUCKET_NAME,
    Key: key,
  }));
};

module.exports = { uploadToR2, deleteFromR2, isConfigured };
