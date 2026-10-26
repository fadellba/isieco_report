import { unlink, readFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config.js';
import { IMAGE_TYPES, storePrivateImage } from '../../core/private-image-storage.js';
import { SignalementPhotoStorage, PrivateImageUpload } from '../../application/ports/signalements-repository.js';
import { SignalementRuleError } from '../../domain/signalements.js';

export class LocalSignalementPhotoStorage implements SignalementPhotoStorage {
  async store(upload: PrivateImageUpload, idPhoto: string): Promise<string> {
    const result = await storePrivateImage(
      { mimetype: upload.mimeType, file: upload.stream },
      idPhoto,
    );
    return result.filename;
  }

  async remove(referencePhoto: string): Promise<void> {
    if (
      path.basename(referencePhoto) !== referencePhoto ||
      !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(referencePhoto)
    ) {
      throw new Error('Invalid private photo reference');
    }
    try {
      await unlink(path.join(path.resolve(config.uploadDir), referencePhoto));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async read(referencePhoto: string): Promise<{ content: Buffer; mimeType: string }> {
    if (path.basename(referencePhoto) !== referencePhoto) {
      throw new SignalementRuleError('PHOTO_NOT_FOUND', 'Photo introuvable.');
    }
    const extension = path.extname(referencePhoto).slice(1);
    const imageType = Object.entries(IMAGE_TYPES).find(([, value]) => value.extension === extension);
    const expectedFilename = referencePhoto.replace(/\.[^.]+$/, '');
    if (!imageType || `${expectedFilename}.${extension}` !== referencePhoto) {
      throw new SignalementRuleError('PHOTO_NOT_FOUND', 'Photo introuvable.');
    }
    try {
      return {
        content: await readFile(path.join(path.resolve(config.uploadDir), referencePhoto)),
        mimeType: imageType[0],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new SignalementRuleError('PHOTO_NOT_FOUND', 'Fichier photo introuvable.');
      }
      throw error;
    }
  }
}
