import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { IMAGE_TYPES, storePrivateImage } from '../../core/private-image-storage.js';
import { InterventionPhotoStorage } from '../../application/ports/interventions-repository.js';

export class PrivateInterventionPhotoStorage implements InterventionPhotoStorage {
  async store(
    upload: { mimetype: string; file: AsyncIterable<Uint8Array> },
    idPhoto: string,
  ): Promise<{ filename: string }> {
    const { filename } = await storePrivateImage(upload, idPhoto);
    return { filename };
  }

  async remove(filename: string): Promise<void> {
    if (
      path.basename(filename) !== filename ||
      !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(filename)
    ) {
      throw new Error('Invalid private intervention photo reference');
    }
    try {
      await unlink(path.join(path.resolve(config.uploadDir), filename));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async read(
    filename: string,
    idPhoto: string,
  ): Promise<{ mimeType: string; content: Buffer } | null> {
    if (path.basename(filename) !== filename) return null;
    const extension = path.extname(filename).slice(1);
    const mimeType = Object.entries(IMAGE_TYPES).find(([, value]) => value.extension === extension)?.[0];
    if (!mimeType || filename !== `${idPhoto}.${extension}`) return null;

    try {
      return {
        mimeType,
        content: await readFile(path.join(path.resolve(config.uploadDir), filename)),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }
}
