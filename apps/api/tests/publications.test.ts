import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  cleanDatabase,
  createTestApp,
  failBusinessEventForTest,
  failTableWriteForTest,
  loginAs,
  TEST_PERSONAS,
  TEST_TYPES_DECHETS,
} from './helpers.js';
import { getDb } from '../src/db/index.js';
import { config } from '../src/config.js';

function multipartImage(boundary: string, contents: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="variante.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
    contents,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe('Publications modérées', () => {
  let app: FastifyInstance;
  let uploadDirectory: string;
  const originalUploadDirectory = config.uploadDir;

  beforeAll(async () => {
    uploadDirectory = await mkdtemp(path.join(tmpdir(), 'isieco-publication-tests-'));
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

  it('réserve la soumission au personnel, modère par DECISION et n’expose aucune donnée privée', async () => {
    const citizen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualification = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const staff = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const decision = await loginAs(app, TEST_PERSONAS.DECISION.email);

    const created = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citizen.headers,
      payload: {
        description: 'Adresse précise et nom du déclarant à ne jamais publier',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSignalement = created.json().idSignalement as string;

    await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/examiner`,
      headers: qualification.headers,
    });
    const qualified = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/qualifier`,
      headers: qualification.headers,
      payload: { motif: 'Catégorie vérifiée' },
    });
    expect(qualified.statusCode).toBe(200);

    const idPhoto = randomUUID();
    await getDb().execute(
      `INSERT INTO photo_signalement (
         id_photo_signalement, id_signalement, reference_photo, etat_publication,
         reference_photo_publique, floutage_confirme, variante_soumise_par,
         date_soumission_variante, approuve_par, date_approbation
       ) VALUES ($1, $2, $3, 'APPROUVEE', $4, TRUE, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP)`,
      [
        idPhoto,
        idSignalement,
        'private/original.jpg',
        'public/blurred.jpg',
        TEST_PERSONAS.QUALIFICATION.id,
        TEST_PERSONAS.ADMIN.id,
      ],
    );

    const payload = { photos: [{ idPhoto, role: 'OBSERVATION' }] };
    const citizenSubmission = await app.inject({
      method: 'POST',
      url: `/api/publications/signalements/${idSignalement}`,
      headers: citizen.headers,
      payload,
    });
    expect(citizenSubmission.statusCode).toBe(403);

    const submission = await app.inject({
      method: 'POST',
      url: `/api/publications/signalements/${idSignalement}`,
      headers: staff.headers,
      payload,
    });
    expect(submission.statusCode).toBe(201);
    const idPublication = submission.json().idPublication as string;

    const pending = await app.inject({
      method: 'GET',
      url: '/api/publications/moderation/en-attente',
      headers: decision.headers,
    });
    expect(pending.statusCode).toBe(200);
    expect(pending.json().data).toEqual([expect.objectContaining({ idPublication })]);

    const selfModerationWithNoDecisionRole = await app.inject({
      method: 'POST',
      url: `/api/publications/${idPublication}/decision`,
      headers: staff.headers,
      payload: { decision: 'APPROUVEE' },
    });
    expect(selfModerationWithNoDecisionRole.statusCode).toBe(403);

    await getDb().execute(
      `INSERT INTO utilisateur_role (id_utilisateur, id_role, attribue_par, motif)
       SELECT $1, id_role, $2, 'Attribution temporaire pour test de séparation des rôles'
       FROM role WHERE code_role = 'DECISION'`,
      [TEST_PERSONAS.TRAITEMENT.id, TEST_PERSONAS.ADMIN.id],
    );
    try {
      const creatorWithDecisionRole = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
      const selfModeration = await app.inject({
        method: 'POST',
        url: `/api/publications/${idPublication}/decision`,
        headers: creatorWithDecisionRole.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(selfModeration.statusCode).toBe(403);
    } finally {
      await getDb().execute(
        `DELETE FROM utilisateur_role
         WHERE id_utilisateur = $1
           AND id_role = (SELECT id_role FROM role WHERE code_role = 'DECISION')`,
        [TEST_PERSONAS.TRAITEMENT.id],
      );
    }

    const refusalWithoutReason = await app.inject({
      method: 'POST',
      url: `/api/publications/${idPublication}/decision`,
      headers: decision.headers,
      payload: { decision: 'REFUSEE' },
    });
    expect(refusalWithoutReason.statusCode).toBe(400);

    const removeApprovalFailure = await failTableWriteForTest('publication_flux');
    try {
      const failedApproval = await app.inject({
        method: 'POST',
        url: `/api/publications/${idPublication}/decision`,
        headers: decision.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(failedApproval.statusCode).toBe(500);
      const unchanged = await getDb().queryOne<{ etat_publication: string }>(
        'SELECT etat_publication FROM publication_flux WHERE id_publication = $1',
        [idPublication],
      );
      expect(unchanged?.etat_publication).toBe('EN_ATTENTE');
    } finally {
      await removeApprovalFailure();
    }

    const approved = await app.inject({
      method: 'POST',
      url: `/api/publications/${idPublication}/decision`,
      headers: decision.headers,
      payload: { decision: 'APPROUVEE' },
    });
    expect(approved.statusCode).toBe(200);

    const publicFeed = await app.inject({ method: 'GET', url: '/api/publications/public' });
    expect(publicFeed.statusCode).toBe(200);
    const serialized = JSON.stringify(publicFeed.json());
    expect(serialized).toContain(`/api/publications/public/photos/SIGNALEMENT/${idPhoto}`);
    expect(serialized).not.toContain('blurred.jpg');
    expect(serialized).not.toContain('private/original.jpg');
    expect(serialized).not.toContain('Adresse précise');
    expect(publicFeed.json().data[0]).not.toHaveProperty('idSignalement');
    expect(publicFeed.json().data[0]).not.toHaveProperty('idUtilisateur');
    expect(publicFeed.json().data[0]).not.toHaveProperty('latitude');
    expect(publicFeed.json().data[0]).not.toHaveProperty('longitude');

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/publications/signalements/${idSignalement}`,
      headers: staff.headers,
      payload,
    });
    expect(duplicate.statusCode).toBe(409);

    const removeMaskFailure = await failTableWriteForTest('publication_flux');
    try {
      const failedMask = await app.inject({
        method: 'POST',
        url: `/api/publications/${idPublication}/decision`,
        headers: decision.headers,
        payload: { decision: 'MASQUEE', motif: 'Échec transactionnel injecté.' },
      });
      expect(failedMask.statusCode).toBe(500);
      const unchanged = await getDb().queryOne<{ etat_publication: string }>(
        'SELECT etat_publication FROM publication_flux WHERE id_publication = $1',
        [idPublication],
      );
      expect(unchanged?.etat_publication).toBe('APPROUVEE');
    } finally {
      await removeMaskFailure();
    }

    const hidden = await app.inject({
      method: 'POST',
      url: `/api/publications/${idPublication}/decision`,
      headers: decision.headers,
      payload: { decision: 'MASQUEE', motif: 'Retrait demandé après modération' },
    });
    expect(hidden.statusCode).toBe(200);
    const hiddenFeed = await app.inject({ method: 'GET', url: '/api/publications/public' });
    expect(hiddenFeed.json().data).toHaveLength(0);
  });

  it('couvre chaque décision de publication depuis chacun de ses états', async () => {
    const citizen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualification = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const staff = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const decisionActor = await loginAs(app, TEST_PERSONAS.DECISION.email);
    const states = ['EN_ATTENTE', 'APPROUVEE', 'REFUSEE', 'MASQUEE'] as const;
    const decisions = ['APPROUVEE', 'REFUSEE', 'MASQUEE'] as const;

    for (const state of states) {
      for (const decision of decisions) {
        const report = await app.inject({
          method: 'POST',
          url: '/api/signalements',
          headers: citizen.headers,
          payload: {
            description: `Publication ${state}/${decision} ${randomUUID()}`,
            latitude: 14.671,
            longitude: -17.433,
            categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
          },
        });
        expect(report.statusCode).toBe(201);
        const idSignalement = report.json().idSignalement as string;
        const accepted = await app.inject({
          method: 'POST',
          url: `/api/qualification/signalements/${idSignalement}/qualifier`,
          headers: qualification.headers,
          payload: {},
        });
        expect(accepted.statusCode).toBe(200);

        const idPhoto = randomUUID();
        await getDb().execute(
          `INSERT INTO photo_signalement (
             id_photo_signalement, id_signalement, reference_photo, etat_publication,
             reference_photo_publique, floutage_confirme, variante_soumise_par,
             date_soumission_variante, approuve_par, date_approbation
           ) VALUES ($1, $2, $3, 'APPROUVEE', $4, TRUE, $5, CURRENT_TIMESTAMP, $6, CURRENT_TIMESTAMP)`,
          [
            idPhoto,
            idSignalement,
            `private/${idPhoto}.jpg`,
            `public/${idPhoto}.jpg`,
            TEST_PERSONAS.QUALIFICATION.id,
            TEST_PERSONAS.ADMIN.id,
          ],
        );
        const submitted = await app.inject({
          method: 'POST',
          url: `/api/publications/signalements/${idSignalement}`,
          headers: staff.headers,
          payload: { photos: [{ idPhoto, role: 'OBSERVATION' }] },
        });
        expect(submitted.statusCode).toBe(201);
        const idPublication = submitted.json().idPublication as string;

        const seedDecision = async (decision: 'APPROUVEE' | 'REFUSEE' | 'MASQUEE') => {
          const seeded = await app.inject({
            method: 'POST',
            url: `/api/publications/${idPublication}/decision`,
            headers: decisionActor.headers,
            payload: {
              decision,
              ...(decision === 'APPROUVEE'
                ? {}
                : { motif: `Établissement de l’état ${state} pour la matrice.` }),
            },
          });
          expect(seeded.statusCode).toBe(200);
        };
        if (state === 'APPROUVEE') await seedDecision('APPROUVEE');
        if (state === 'REFUSEE') await seedDecision('REFUSEE');
        if (state === 'MASQUEE') {
          await seedDecision('APPROUVEE');
          await seedDecision('MASQUEE');
        }

        const response = await app.inject({
          method: 'POST',
          url: `/api/publications/${idPublication}/decision`,
          headers: decisionActor.headers,
          payload: {
            decision,
            ...(decision === 'APPROUVEE'
              ? {}
              : { motif: `Motif de décision ${decision} dans la matrice complète.` }),
          },
        });
        const allowed =
          (state === 'EN_ATTENTE' && (decision === 'APPROUVEE' || decision === 'REFUSEE')) ||
          (state === 'APPROUVEE' && decision === 'MASQUEE');
        expect(
          response.statusCode,
          `décision ${decision} depuis ${state}: ${JSON.stringify(response.json())}`,
        ).toBe(allowed ? 200 : 409);

        const persisted = await getDb().queryOne<{ etat_publication: string }>(
          'SELECT etat_publication FROM publication_flux WHERE id_publication = $1',
          [idPublication],
        );
        expect(persisted?.etat_publication).toBe(allowed ? decision : state);
      }
    }
  });

  it('contrôle, publie puis retire une copie dérivée sans exposer l’original', async () => {
    const citizen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualification = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const staff = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const decision = await loginAs(app, TEST_PERSONAS.DECISION.email);

    await getDb().execute(
      `INSERT INTO utilisateur_role (id_utilisateur, id_role, attribue_par, motif)
       SELECT $1, id_role, $2, 'Validation indépendante temporaire pour test photo'
       FROM role WHERE code_role = 'DECISION'`,
      [TEST_PERSONAS.ADMIN.id, TEST_PERSONAS.ADMIN.id],
    );
    try {
      const distinctDecision = await loginAs(app, TEST_PERSONAS.ADMIN.email);
      const created = await app.inject({
        method: 'POST',
        url: '/api/signalements',
        headers: citizen.headers,
        payload: {
          description: 'Photo destinée au contrôle de publication publique',
          latitude: 14.671,
          longitude: -17.433,
          categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
        },
      });
      const idSignalement = created.json().idSignalement as string;
      await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${idSignalement}/examiner`,
        headers: qualification.headers,
      });
      await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${idSignalement}/qualifier`,
        headers: qualification.headers,
        payload: { motif: 'Photo et catégorie vérifiées' },
      });

      const original = await sharp({
        create: { width: 16, height: 16, channels: 3, background: '#64748b' },
      }).withMetadata({
        exif: { IFD0: { ImageDescription: 'metadata-ne-doit-pas-etre-publiee' } },
      }).jpeg().toBuffer();
      const originalBoundary = 'isieco-photo-original';
      const originalUpload = await app.inject({
        method: 'POST',
        url: `/api/signalements/${idSignalement}/photos/contenu`,
        headers: {
          ...citizen.headers,
          'content-type': `multipart/form-data; boundary=${originalBoundary}`,
        },
        payload: multipartImage(originalBoundary, original),
      });
      expect(originalUpload.statusCode).toBe(201);
      const idPhoto = originalUpload.json().idPhoto as string;

      const variantBoundary = 'isieco-photo-variant';
      const photoBeforeFailedSubmission = await getDb().queryOne<{
        etat_publication: string;
        reference_photo_publique: string | null;
      }>(
        `SELECT etat_publication, reference_photo_publique
         FROM photo_signalement WHERE id_photo_signalement = $1`,
        [idPhoto],
      );
      const publicationFilesBeforeFailure = (await readdir(uploadDirectory))
        .filter((name) => name.startsWith('publication-'))
        .sort();
      const removeVariantSubmissionFailure = await failBusinessEventForTest(
        'VARIANTE_PHOTO_SOUMISE',
      );
      try {
        const failedCandidateUpload = await app.inject({
          method: 'POST',
          url: `/api/publications/photos/SIGNALEMENT/${idPhoto}/variante`,
          headers: {
            ...staff.headers,
            'content-type': `multipart/form-data; boundary=${variantBoundary}`,
            'x-redaction-checks-confirmed': 'true',
          },
          payload: multipartImage(variantBoundary, original),
        });
        expect(failedCandidateUpload.statusCode).toBe(500);
      } finally {
        await removeVariantSubmissionFailure();
      }
      const photoAfterFailedSubmission = await getDb().queryOne<{
        etat_publication: string;
        reference_photo_publique: string | null;
      }>(
        `SELECT etat_publication, reference_photo_publique
         FROM photo_signalement WHERE id_photo_signalement = $1`,
        [idPhoto],
      );
      expect(photoAfterFailedSubmission).toEqual(photoBeforeFailedSubmission);
      expect(
        (await readdir(uploadDirectory))
          .filter((name) => name.startsWith('publication-'))
          .sort(),
      ).toEqual(publicationFilesBeforeFailure);

      const missingAttestation = await app.inject({
        method: 'POST',
        url: `/api/publications/photos/SIGNALEMENT/${idPhoto}/variante`,
        headers: {
          ...staff.headers,
          'content-type': `multipart/form-data; boundary=${variantBoundary}`,
        },
        payload: multipartImage(variantBoundary, original),
      });
      expect(missingAttestation.statusCode).toBe(400);

      const candidateUpload = await app.inject({
        method: 'POST',
        url: `/api/publications/photos/SIGNALEMENT/${idPhoto}/variante`,
        headers: {
          ...staff.headers,
          'content-type': `multipart/form-data; boundary=${variantBoundary}`,
          'x-redaction-checks-confirmed': 'true',
        },
        payload: multipartImage(variantBoundary, original),
      });
      expect(candidateUpload.statusCode).toBe(202);

      const queue = await app.inject({
        method: 'GET',
        url: '/api/publications/moderation/photos/en-attente',
        headers: decision.headers,
      });
      expect(queue.statusCode).toBe(200);
      expect(queue.json().data).toEqual([
        expect.objectContaining({
          source: 'SIGNALEMENT',
          photoId: idPhoto,
          submittedBy: TEST_PERSONAS.TRAITEMENT.id,
        }),
      ]);

      const pendingVariant = await app.inject({
        method: 'GET',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/variante`,
        headers: decision.headers,
      });
      expect(pendingVariant.statusCode).toBe(200);
      expect(pendingVariant.headers['cache-control']).toBe('private, no-store');
      expect((await sharp(pendingVariant.rawPayload).metadata()).exif).toBeUndefined();

      const originalForReview = await app.inject({
        method: 'GET',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/original`,
        headers: decision.headers,
      });
      expect(originalForReview.statusCode).toBe(200);
      expect(originalForReview.headers['cache-control']).toBe('private, no-store');

      const selfDecision = await app.inject({
        method: 'POST',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/decision`,
        headers: staff.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(selfDecision.statusCode).toBe(403);

      const refusalWithoutReason = await app.inject({
        method: 'POST',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/decision`,
        headers: decision.headers,
        payload: { decision: 'REFUSEE' },
      });
      expect(refusalWithoutReason.statusCode).toBe(400);

      const removeRefusalFailure = await failBusinessEventForTest(
        'VARIANTE_PHOTO_REFUSEE',
      );
      try {
        const failedRefusal = await app.inject({
          method: 'POST',
          url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/decision`,
          headers: decision.headers,
          payload: { decision: 'REFUSEE', motif: 'Échec injecté.' },
        });
        expect(failedRefusal.statusCode).toBe(500);
      } finally {
        await removeRefusalFailure();
      }
      const pendingAfterFailedRefusal = await getDb().queryOne<{
        etat_publication: string;
      }>(
        'SELECT etat_publication FROM photo_signalement WHERE id_photo_signalement = $1',
        [idPhoto],
      );
      expect(pendingAfterFailedRefusal?.etat_publication).toBe('EN_ATTENTE');

      const refusedVariant = await app.inject({
        method: 'POST',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/decision`,
        headers: decision.headers,
        payload: {
          decision: 'REFUSEE',
          motif: 'Un élément demeure identifiable dans la copie',
        },
      });
      expect(refusedVariant.statusCode).toBe(200);
      expect((await app.inject({
        method: 'GET',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/variante`,
        headers: decision.headers,
      })).statusCode).toBe(404);

      const replacementBoundary = 'isieco-photo-replacement';
      const replacementUpload = await app.inject({
        method: 'POST',
        url: `/api/publications/photos/SIGNALEMENT/${idPhoto}/variante`,
        headers: {
          ...staff.headers,
          'content-type': `multipart/form-data; boundary=${replacementBoundary}`,
          'x-redaction-checks-confirmed': 'true',
        },
        payload: multipartImage(replacementBoundary, original),
      });
      expect(replacementUpload.statusCode).toBe(202);

      const removeApprovalEventFailure = await failBusinessEventForTest(
        'VARIANTE_PHOTO_APPROUVEE',
      );
      try {
        const failedApproval = await app.inject({
          method: 'POST',
          url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/decision`,
          headers: decision.headers,
          payload: { decision: 'APPROUVEE' },
        });
        expect(failedApproval.statusCode).toBe(500);
      } finally {
        await removeApprovalEventFailure();
      }
      const pendingAfterFailedApproval = await getDb().queryOne<{
        etat_publication: string;
      }>(
        'SELECT etat_publication FROM photo_signalement WHERE id_photo_signalement = $1',
        [idPhoto],
      );
      expect(pendingAfterFailedApproval?.etat_publication).toBe('EN_ATTENTE');

      const approvedVariant = await app.inject({
        method: 'POST',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/decision`,
        headers: decision.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(approvedVariant.statusCode).toBe(200);

      const sameActorPublicationSubmission = await app.inject({
        method: 'POST',
        url: `/api/publications/signalements/${idSignalement}`,
        headers: decision.headers,
        payload: { photos: [{ idPhoto, role: 'OBSERVATION' }] },
      });
      expect(sameActorPublicationSubmission.statusCode).toBe(403);

      const removePublicationSubmitFailure = await failTableWriteForTest(
        'photo_publication',
      );
      try {
        const failedSubmission = await app.inject({
          method: 'POST',
          url: `/api/publications/signalements/${idSignalement}`,
          headers: staff.headers,
          payload: { photos: [{ idPhoto, role: 'OBSERVATION' }] },
        });
        expect(failedSubmission.statusCode).toBe(500);
      } finally {
        await removePublicationSubmitFailure();
      }
      const orphanedPublication = await getDb().queryOne<{ count: string }>(
        'SELECT count(*)::text AS count FROM publication_flux WHERE id_signalement = $1',
        [idSignalement],
      );
      expect(orphanedPublication?.count).toBe('0');

      const submission = await app.inject({
        method: 'POST',
        url: `/api/publications/signalements/${idSignalement}`,
        headers: staff.headers,
        payload: { photos: [{ idPhoto, role: 'OBSERVATION' }] },
      });
      expect(submission.statusCode).toBe(201);
      const idPublication = submission.json().idPublication as string;

      const sameActorPublicationDecision = await app.inject({
        method: 'POST',
        url: `/api/publications/${idPublication}/decision`,
        headers: decision.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(sameActorPublicationDecision.statusCode).toBe(403);

      const approvedPublication = await app.inject({
        method: 'POST',
        url: `/api/publications/${idPublication}/decision`,
        headers: distinctDecision.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(approvedPublication.statusCode).toBe(200);

      const feed = await app.inject({ method: 'GET', url: '/api/publications/public' });
      expect(feed.statusCode).toBe(200);
      const photoUrl = feed.json().data[0].photos[0].reference as string;
      expect(photoUrl).toBe(`/api/publications/public/photos/SIGNALEMENT/${idPhoto}`);

      const publicImage = await app.inject({ method: 'GET', url: photoUrl });
      expect(publicImage.statusCode).toBe(200);
      expect(publicImage.headers['cache-control']).toBe('no-store');

      const withdrawalRollbackFailure = await failBusinessEventForTest(
        'VARIANTE_PHOTO_RETIRE',
      );
      try {
        const failedWithdrawal = await app.inject({
          method: 'POST',
          url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/retrait`,
          headers: decision.headers,
          payload: { motif: 'Retrait avec événement en échec transactionnel.' },
        });
        expect(failedWithdrawal.statusCode).toBe(500);
      } finally {
        await withdrawalRollbackFailure();
      }
      const photoAfterFailedWithdrawal = await getDb().queryOne<{
        etat_publication: string;
      }>(
        'SELECT etat_publication FROM photo_signalement WHERE id_photo_signalement = $1',
        [idPhoto],
      );
      expect(photoAfterFailedWithdrawal?.etat_publication).toBe('APPROUVEE');

      const finalWithdrawal = await app.inject({
        method: 'POST',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/retrait`,
        headers: decision.headers,
        payload: { motif: 'Retrait préventif après contrôle métier' },
      });
      expect(finalWithdrawal.statusCode).toBe(200);
      expect(finalWithdrawal.json().accesPublic).toBe(false);
      expect((await app.inject({ method: 'GET', url: photoUrl })).statusCode).toBe(404);
      expect((await app.inject({ method: 'GET', url: '/api/publications/public' })).json().data).toHaveLength(0);

      const postWithdrawalBoundary = 'isieco-post-withdrawal';
      const requeueRollbackFailure = await failBusinessEventForTest(
        'PUBLICATION_REMISE_EN_MODERATION',
      );
      try {
        const failedRequeueUpload = await app.inject({
          method: 'POST',
          url: `/api/publications/photos/SIGNALEMENT/${idPhoto}/variante`,
          headers: {
            ...staff.headers,
            'content-type': `multipart/form-data; boundary=${postWithdrawalBoundary}`,
            'x-redaction-checks-confirmed': 'true',
          },
          payload: multipartImage(postWithdrawalBoundary, original),
        });
        expect(failedRequeueUpload.statusCode).toBe(500);
      } finally {
        await requeueRollbackFailure();
      }
      const afterFailedRequeue = await getDb().queryOne<{
        photo_state: string;
        publication_state: string;
      }>(
        `SELECT p.etat_publication AS photo_state, f.etat_publication AS publication_state
         FROM photo_signalement p
         JOIN photo_publication pp ON pp.id_photo_signalement = p.id_photo_signalement
         JOIN publication_flux f ON f.id_publication = pp.id_publication
         WHERE p.id_photo_signalement = $1`,
        [idPhoto],
      );
      expect(afterFailedRequeue).toEqual({
        photo_state: 'REFUSEE',
        publication_state: 'APPROUVEE',
      });

      const postWithdrawalUpload = await app.inject({
        method: 'POST',
        url: `/api/publications/photos/SIGNALEMENT/${idPhoto}/variante`,
        headers: {
          ...staff.headers,
          'content-type': `multipart/form-data; boundary=${postWithdrawalBoundary}`,
          'x-redaction-checks-confirmed': 'true',
        },
        payload: multipartImage(postWithdrawalBoundary, original),
      });
      expect(postWithdrawalUpload.statusCode).toBe(202);
      const resetPublication = await getDb().queryOne<{ etat_publication: string }>(
        'SELECT etat_publication FROM publication_flux WHERE id_publication = $1',
        [idPublication],
      );
      expect(resetPublication?.etat_publication).toBe('EN_ATTENTE');

      const postWithdrawalApproval = await app.inject({
        method: 'POST',
        url: `/api/publications/moderation/photos/SIGNALEMENT/${idPhoto}/decision`,
        headers: decision.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(postWithdrawalApproval.statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/publications/public' })).json().data).toHaveLength(0);

      const reapprovedPublication = await app.inject({
        method: 'POST',
        url: `/api/publications/${idPublication}/decision`,
        headers: distinctDecision.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(reapprovedPublication.statusCode).toBe(200);
      expect((await app.inject({ method: 'GET', url: '/api/publications/public' })).json().data).toHaveLength(1);

      const auditEvents = await getDb().query<{ type_evenement: string }>(
        `SELECT type_evenement FROM evenement_metier
         WHERE id_signalement_cible = $1
           AND type_evenement LIKE 'VARIANTE_PHOTO_%'
         ORDER BY date_enregistrement`,
        [idSignalement],
      );
      expect(auditEvents.map(({ type_evenement }) => type_evenement)).toEqual([
        'VARIANTE_PHOTO_SOUMISE',
        'VARIANTE_PHOTO_REFUSEE',
        'VARIANTE_PHOTO_SOUMISE',
        'VARIANTE_PHOTO_APPROUVEE',
        'VARIANTE_PHOTO_RETIRE',
        'VARIANTE_PHOTO_SOUMISE',
        'VARIANTE_PHOTO_APPROUVEE',
      ]);
      const requeueEvent = await getDb().queryOne<{ count: string }>(
        `SELECT count(*)::text AS count FROM evenement_metier
         WHERE id_signalement_cible = $1
           AND type_evenement = 'PUBLICATION_REMISE_EN_MODERATION'`,
        [idSignalement],
      );
      expect(requeueEvent?.count).toBe('1');
      const persisted = await getDb().queryOne<{
        etat_publication: string;
        reference_photo_publique: string;
        floutage_confirme: boolean;
      }>(
        `SELECT etat_publication, reference_photo_publique, floutage_confirme
         FROM photo_signalement WHERE id_photo_signalement = $1`,
        [idPhoto],
      );
      expect(persisted).toMatchObject({
        etat_publication: 'APPROUVEE',
        floutage_confirme: true,
      });
      expect(persisted?.reference_photo_publique).toMatch(/^publication-/);
    } finally {
      await getDb().execute(
        `DELETE FROM utilisateur_role
         WHERE id_utilisateur = $1
           AND id_role = (SELECT id_role FROM role WHERE code_role = 'DECISION')`,
        [TEST_PERSONAS.ADMIN.id],
      );
    }
  });
});
