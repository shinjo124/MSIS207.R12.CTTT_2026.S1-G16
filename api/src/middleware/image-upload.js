import multer from 'multer';

// Accept one multipart image into memory. The route checks its actual file type before uploading it.
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024, files: 1 },
}).single('image');
