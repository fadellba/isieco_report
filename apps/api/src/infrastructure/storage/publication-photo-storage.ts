import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { IMAGE_TYPES, storePrivateImage } from '../../core/private-image-storage.js';
import { PublicationPhotoStorage } from '../../application/ports/publications-repository.js';

export class LocalPublicationPhotoStorage implements PublicationPhotoStorage {
  async store(
    upload: { mimetype: string; file: AsyncIterable<Uint8Array> },
    id: string,
  ): Promise<string> {
    const { filename } = await storePrivateImage(upload, `publication-${id}`);
    return filename;
  }

  async read(reference: string): Promise<{ mimeType: string; content: Buffer } | null> {
    if (path.basename(reference) !== reference) return null;
    const extension = path.extname(reference).slice(1);
    const mimeType = Object.entries(IMAGE_TYPES).find(([, value]) => value.extension === extension)?.[0];
    if (!mimeType || !/^publication-[0-9a-f-]+\.(jpg|png|webp)$/i.test(reference)) return null;

    try {
      return {
        mimeType,
        content: await readFile(path.join(path.resolve(config.uploadDir), reference)),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async remove(reference: string): Promise<void> {
    if (
      path.basename(reference) !== reference ||
      !/^publication-[0-9a-f-]+\.(jpg|png|webp)$/i.test(reference)
    ) {
      throw new Error('Invalid public photo candidate reference');
    }
    try {
      await unlink(path.join(path.resolve(config.uploadDir), reference));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
