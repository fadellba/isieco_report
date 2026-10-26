import type { MultipartFile } from '@fastify/multipart';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { BadRequestError } from './errors.js';
import { config } from '../config.js';

export const IMAGE_TYPES: Record<
  string,
  {
    extension: string;
    format: 'jpeg' | 'png' | 'webp';
    signatureMatches: (file: Buffer) => boolean;
  }
> = {
  'image/jpeg': {
    extension: 'jpg',
    format: 'jpeg',
    signatureMatches: (file) => file.length >= 3 && file[0] === 0xff && file[1] === 0xd8 && file[2] === 0xff,
  },
  'image/png': {
    extension: 'png',
    format: 'png',
    signatureMatches: (file) =>
      file.length >= 8 &&
      file.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  },
  'image/webp': {
    extension: 'webp',
    format: 'webp',
    signatureMatches: (file) =>
      file.length >= 12 &&
      file.toString('ascii', 0, 4) === 'RIFF' &&
      file.toString('ascii', 8, 12) === 'WEBP',
  },
};

export type PrivateImagePart = {
  mimetype: string;
  file: AsyncIterable<Uint8Array>;
};

export async function storePrivateImage(
  part: MultipartFile | PrivateImagePart,
  idPhoto: string
): Promise<{ filename: string; mimeType: string }> {
  const imageType = IMAGE_TYPES[part.mimetype];
  if (!imageType) {
    throw new BadRequestError('Seules les images JPEG, PNG et WebP sont acceptées.');
  }

  const chunks: Buffer[] = [];
  let fileSize = 0;
  for await (const chunk of part.file) {
    const buffer = Buffer.from(chunk);
    fileSize += buffer.length;
    chunks.push(buffer);
  }

  const truncated = 'truncated' in part.file && part.file.truncated;
  if (truncated || fileSize > config.maxFileSize) {
    throw new BadRequestError('La photo dépasse la taille maximale de 5 Mo.');
  }

  const image = Buffer.concat(chunks, fileSize);
  if (image.length === 0 || !imageType.signatureMatches(image)) {
    throw new BadRequestError('Le contenu du fichier ne correspond pas à son type d’image déclaré.');
  }

  let sanitizedImage: Buffer;
  try {
    const pipeline = sharp(image, { failOn: 'error', limitInputPixels: 25_000_000 }).rotate();
    const metadata = await pipeline.metadata();
    if (metadata.format !== imageType.format) {
      throw new BadRequestError('Le contenu du fichier ne correspond pas au type MIME déclaré.');
    }
    sanitizedImage = await pipeline.toFormat(imageType.format).toBuffer();
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    if (error instanceof Error) {
      throw new BadRequestError('Image illisible ou invalide. Vérifiez le fichier et réessayez.');
    }
    throw error;
  }

  if (sanitizedImage.length > config.maxFileSize) {
    throw new BadRequestError('La photo dépasse la taille maximale de 5 Mo après traitement.');
  }

  const filename = `${idPhoto}.${imageType.extension}`;
  const uploadDirectory = path.resolve(config.uploadDir);
  await mkdir(uploadDirectory, { recursive: true });
  await writeFile(path.join(uploadDirectory, filename), sanitizedImage, { flag: 'wx', mode: 0o600 });

  return { filename, mimeType: imageType.format === 'jpeg' ? 'image/jpeg' : `image/${imageType.format}` };
}
