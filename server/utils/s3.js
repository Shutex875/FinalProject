import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import crypto from 'crypto';

const region = process.env.AWS_REGION || 'eu-west-3';
const bucketName = process.env.IMAGES_BUCKET_NAME || 'deck-market-development-images-394567896469';

// S3Client автоматически подхватывает IAM Role инстанса (Task Role / Instance Profile)
export const s3Client = new S3Client({ region });

/**
 * Загружает буфер изображения в бакет S3
 * @param {Express.Multer.File} file - Файл из multer (memoryStorage)
 * @param {string} folder - Префикс/директория внутри бакета
 * @returns {Promise<string>} Публичный URL загруженного изображения
 */
export async function uploadToS3(file, folder = 'products') {
  if (!bucketName) {
    throw new Error('IMAGES_BUCKET_NAME is not defined in environment variables');
  }

  const fileExt = path.extname(file.originalname).toLowerCase();
  const fileHash = crypto.randomBytes(16).toString('hex');
  const key = `${folder}/${Date.now()}-${fileHash}${fileExt}`;

  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  });

  await s3Client.send(command);

  return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
}