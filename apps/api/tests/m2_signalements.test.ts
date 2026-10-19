import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, cleanDatabase, loginAs, TEST_PERSONAS, TEST_TYPES_DECHETS } from './helpers.js';
import { StatutSignalement } from '@isieco/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { config } from '../src/config.js';
import sharp from 'sharp';

function multipartImage(boundary: string, mimeType: string, contents: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="preuve.png"\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    contents,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe('Jalon M2 (Tranche 1) — Soumission Citoyenne, GPS & Isolation IDOR', () => {
  let app: FastifyInstance;
  let uploadDirectory: string;
  const originalUploadDirectory = config.uploadDir;

  beforeAll(async () => {
    uploadDirectory = await mkdtemp(path.join(tmpdir(), 'isieco-photo-tests-'));
    config.uploadDir = uploadDirectory;
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    config.uploadDir = originalUploadDirectory;
    await rm(uploadDirectory, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T01 : Création avec coordonnées GPS valides (Dakar)
  // --------------------------------------------------------------------------
  it("T01: Création d'un signalement citoyen avec latitude/longitude valides", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);

    const res = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sauvage de bouteilles plastiques près du Port de Dakar',
        latitude: 14.6728,
        longitude: -17.4325,
        precisionLocalisation: 5.2,
        descriptionLocalisation: 'Angle Boulevard de la Libération',
        categories: [
          {
            idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
            quantiteEstimee: '15 sacs',
            volumeEstime: '3 m3',
            remarque: 'Accumulation récente',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.idSignalement).toBeDefined();
    expect(body.statut).toBe(StatutSignalement.SOUMIS);

    // Vérifier la présence dans "mes-signalements"
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/signalements/mes-signalements',
      headers: citoyen.headers,
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list.count).toBe(1);
    expect(list.data[0].idSignalement).toBe(body.idSignalement);
    expect(Number(list.data[0].latitude)).toBeCloseTo(14.6728, 4);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T02 : Création sans GPS avec repère textuel de secours
  // --------------------------------------------------------------------------
  it("T02: Création d'un signalement sans coordonnées GPS avec repère textuel valide (affectation différée)", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);

    const res = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Déchets de marché en décomposition sans géolocalisation',
        latitude: null,
        longitude: null,
        descriptionLocalisation: 'Marché Tilène, Médina, face à la grande pharmacie',
        categories: [
          {
            idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE,
            quantiteEstimee: 'Bacs débordants',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.idSignalement).toBeDefined();

    // Vérifier le détail
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/signalements/${body.idSignalement}`,
      headers: citoyen.headers,
    });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().data.latitude).toBeNull();
    expect(getRes.json().data.descriptionLocalisation).toBe('Marché Tilène, Médina, face à la grande pharmacie');
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T31 : Rejet si ni GPS ni repère, ou sans catégorie
  // --------------------------------------------------------------------------
  it('T31: Rejet serveur si absence conjointe de GPS et repère textuel, ou absence de catégorie', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);

    // 1. Ni GPS ni repère textuel (Rejet RG06 / RG07)
    const resNoLoc = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sans aucune localisation possible',
        latitude: null,
        longitude: null,
        descriptionLocalisation: null,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(resNoLoc.statusCode).toBe(400);
    expect(resNoLoc.json().error.message).toMatch(/coordonnées GPS valides ou un repère textuel/i);

    // 2. Sans catégorie de déchet
    const resNoCat = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sans catégorie spécifiée',
        latitude: 14.67,
        longitude: -17.43,
        categories: [],
      },
    });
    expect(resNoCat.statusCode).toBe(400);

    // 3. Catégorie en double dans le même signalement
    const resDuplicateCat = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt avec doublon de catégorie plastique',
        latitude: 14.67,
        longitude: -17.43,
        categories: [
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE },
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE },
        ],
      },
    });
    expect(resDuplicateCat.statusCode).toBe(400);
    expect(resDuplicateCat.json().error.message).toMatch(/deux fois/i);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T29 : Isolation stricte des données (IDOR)
  // --------------------------------------------------------------------------
  it("T29: Isolation stricte des données (IDOR) : un citoyen ne peut pas consulter le signalement d'un tiers", async () => {
    const citoyen1 = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const citoyen2 = await loginAs(app, TEST_PERSONAS.CITOYEN_2.email);

    // Citoyen 1 crée un signalement
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen1.headers,
      payload: {
        description: 'Dépôt personnel privé de Citoyen 1',
        latitude: 14.68,
        longitude: -17.44,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(createRes.statusCode).toBe(201);
    const idSignalement1 = createRes.json().idSignalement;

    // Citoyen 1 peut le consulter
    const getCitoyen1 = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement1}`,
      headers: citoyen1.headers,
    });
    expect(getCitoyen1.statusCode).toBe(200);

    // Citoyen 2 tente de consulter le signalement de Citoyen 1 -> 403 Forbidden
    const getCitoyen2 = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement1}`,
      headers: citoyen2.headers,
    });
    expect(getCitoyen2.statusCode).toBe(403);
    expect(getCitoyen2.json().error.message).toMatch(/tiers/i);

    // Citoyen 2 dans "mes-signalements" ne voit pas le signalement de Citoyen 1
    const listCitoyen2 = await app.inject({
      method: 'GET',
      url: '/api/signalements/mes-signalements',
      headers: citoyen2.headers,
    });
    expect(listCitoyen2.statusCode).toBe(200);
    expect(listCitoyen2.json().count).toBe(0);

    // Un agent qualificateur (rôle de gestion) peut consulter le signalement
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const getQualif = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement1}`,
      headers: qualif.headers,
    });
    expect(getQualif.statusCode).toBe(200);
    expect(getQualif.json().data.idSignalement).toBe(idSignalement1);
  });

  it('téléverse une image vérifiée et protège son accès par propriétaire', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const autreCitoyen = await loginAs(app, TEST_PERSONAS.CITOYEN_2.email);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sauvage près du marché',
        latitude: 14.67,
        longitude: -17.43,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSignalement = createRes.json().idSignalement as string;
    const boundary = 'isieco-image-boundary';
    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 4,
        background: '#16a34a',
      },
    })
      .png()
      .toBuffer();

    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/signalements/${idSignalement}/photos/contenu`,
      headers: {
        ...citoyen.headers,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartImage(boundary, 'image/png', png),
    });

    expect(uploadRes.statusCode).toBe(201);
    const { idPhoto } = uploadRes.json();

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement}/photos/${idPhoto}/contenu`,
      headers: citoyen.headers,
    });
    expect(downloadRes.statusCode).toBe(200);
    expect(downloadRes.headers['content-type']).toContain('image/png');
    expect((await sharp(downloadRes.rawPayload).metadata()).format).toBe('png');

    const forbiddenRes = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement}/photos/${idPhoto}/contenu`,
      headers: autreCitoyen.headers,
    });
    expect(forbiddenRes.statusCode).toBe(403);
  });

  it('rejette une photo dont le contenu ne correspond pas au MIME annoncé', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sauvage près du marché',
        latitude: 14.67,
        longitude: -17.43,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const boundary = 'isieco-invalid-image-boundary';
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/signalements/${createRes.json().idSignalement}/photos/contenu`,
      headers: {
        ...citoyen.headers,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartImage(boundary, 'image/png', Buffer.from('not an image')),
    });

    expect(uploadRes.statusCode).toBe(400);
    expect(uploadRes.json().error.message).toContain('contenu du fichier');
  });

  it('rejette une photo de plus de 5 Mo selon la taille réellement reçue', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sauvage près du marché',
        latitude: 14.67,
        longitude: -17.43,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const boundary = 'isieco-large-image-boundary';
    const oversizedImage = Buffer.alloc(5 * 1024 * 1024 + 1, 0x20);
    oversizedImage.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/signalements/${createRes.json().idSignalement}/photos/contenu`,
      headers: {
        ...citoyen.headers,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartImage(boundary, 'image/png', oversizedImage),
    });

    expect(uploadRes.statusCode).toBe(400);
    expect(uploadRes.json().error.message).toContain('5 Mo');
  });

  it('supprime les métadonnées EXIF avant de stocker la photo', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sauvage près du marché',
        latitude: 14.67,
        longitude: -17.43,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSignalement = createRes.json().idSignalement as string;
    const jpeg = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: '#16a34a',
      },
    })
      .withMetadata({ exif: { IFD0: { ImageDescription: 'private-location' } } })
      .jpeg()
      .toBuffer();
    const originalMetadata = await sharp(jpeg).metadata();
    expect(originalMetadata.exif).toBeDefined();

    const boundary = 'isieco-exif-boundary';
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/signalements/${idSignalement}/photos/contenu`,
      headers: {
        ...citoyen.headers,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartImage(boundary, 'image/jpeg', jpeg),
    });

    expect(uploadRes.statusCode).toBe(201);
    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement}/photos/${uploadRes.json().idPhoto}/contenu`,
      headers: citoyen.headers,
    });
    expect(downloadRes.statusCode).toBe(200);
    expect((await sharp(downloadRes.rawPayload).metadata()).exif).toBeUndefined();
  });
});
