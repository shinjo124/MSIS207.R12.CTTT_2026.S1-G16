import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'node:stream';

export function isCloudinaryConfigured() {
  return Boolean(process.env.CLOUDINARY_CLOUD_NAME
    && process.env.CLOUDINARY_API_KEY
    && process.env.CLOUDINARY_API_SECRET);
}

export function uploadCloudinaryImage(buffer, folder) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream({
      resource_type: 'image',
      folder,
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 2400, height: 2400, crop: 'limit' }],
    }, (error, result) => {
      if (error) reject(error);
      else if (!result?.secure_url || !result.public_id) reject(new Error('Cloudinary returned an invalid upload result.'));
      else resolve(result);
    });
    Readable.from([buffer]).pipe(stream);
  });
}

export function deleteCloudinaryImage(publicId) {
  return cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
}
