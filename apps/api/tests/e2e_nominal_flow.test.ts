import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestApp,
  cleanDatabase,
  failBusinessEventForTest,
  failTableWriteForTest,
  loginAs,
  TEST_PERSONAS,
  TEST_TYPES_DECHETS,
  TEST_EQUIPES,
} from './helpers.js';
import {
  ClientType,
  ResultatIntervention,
  ResultatVerification,
  StatutDossier,
  StatutSignalement,
} from '@isieco/shared';
import { getDb } from '../src/db/index.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { config } from '../src/config.js';

function multipartImage(boundary: string, contents: Buffer): Buffer {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="preuve.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`,
    ),
    contents,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
}

describe("Recette Finale — Test d'Acceptation T28 (Parcours Nominal Complet E2E)", () => {
  let app: FastifyInstance;
  let uploadDirectory: string;
  const originalUploadDirectory = config.uploadDir;

  beforeAll(async () => {
    uploadDirectory = await mkdtemp(path.join(tmpdir(), 'isieco-e2e-publication-tests-'));
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

  it("T28: Parcours nominal intégral de la déclaration citoyenne mobile jusqu'à la clôture vérifiée et notifiée", async () => {
    // ------------------------------------------------------------------------
    // Étape 1 : Connexion des Personas Dakar
    // ------------------------------------------------------------------------
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email, TEST_PERSONAS.CITOYEN.password, ClientType.MOBILE);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email, TEST_PERSONAS.TERRAIN.password, ClientType.MOBILE);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const decision = await loginAs(app, TEST_PERSONAS.DECISION.email);
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);

    expect(citoyen.statusCode).toBe(200);
    expect(qualif.statusCode).toBe(200);

    // ------------------------------------------------------------------------
    // Étape 2 : Déclaration Citoyenne Mobile (Dakar-Plateau)
    // ------------------------------------------------------------------------
    const createSig = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sauvage de sacs et bouteilles plastiques angle rue Carnot / Faidherbe',
        latitude: 14.6735,
        longitude: -17.4345,
        precisionLocalisation: 4.8,
        descriptionLocalisation: 'Angle Carnot et Faidherbe, trottoir est',
        categories: [
          {
            idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
            quantiteEstimee: 'Environ 400 kg',
            volumeEstime: '2.5 m3',
            remarque: 'Empêche le passage des piétons',
          },
        ],
      },
    });
    expect(createSig.statusCode).toBe(201);
    const idSignalement = createSig.json().idSignalement;
    expect(createSig.json().statut).toBe(StatutSignalement.SOUMIS);

    // Accusé de réception citoyen
    const notifApresSoumission = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: citoyen.headers,
    });
    expect(notifApresSoumission.json().data.length).toBeGreaterThanOrEqual(1);
    expect(notifApresSoumission.json().data[0].titre).toMatch(/Signalement enregistré/i);

    // ------------------------------------------------------------------------
    // Étape 3 : Examen et Qualification par l'Agent de Qualification
    // ------------------------------------------------------------------------
    // Boîte de réception
    const boite = await app.inject({
      method: 'GET',
      url: '/api/qualification/boite-reception',
      headers: qualif.headers,
    });
    expect(boite.json().data.some((s: any) => s.idSignalement === idSignalement)).toBe(true);

    // Prise en charge
    await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/examiner`,
      headers: qualif.headers,
    });

    // Acceptation pour rattachement
    const qualifAction = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Signalement recevable et géolocalisé avec précision' },
    });
    expect(qualifAction.json().statut).toBe(StatutSignalement.ACCEPTE_POUR_RATTACHEMENT);

    // Vérification : 10 points de valorisation attribués au citoyen
    const pointsCitoyen = await app.inject({
      method: 'GET',
      url: '/api/points/mes-points',
      headers: citoyen.headers,
    });
    expect(pointsCitoyen.json().soldeTotal).toBeGreaterThanOrEqual(10);

    // ------------------------------------------------------------------------
    // Étape 4 : Création du Dossier Opérationnel et Rattachement
    // ------------------------------------------------------------------------
    const dosRes = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Nettoyage Plastique Carnot-Faidherbe',
        priorite: 'MOYENNE',
        latitude: 14.6735,
        longitude: -17.4345,
        categories: [
          {
            idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
            quantiteEstimee: '400 kg',
          },
        ],
      },
    });
    expect(dosRes.statusCode).toBe(201);
    const idDossier = dosRes.json().idDossier;

    // Rattachement du signalement
    const rattRes = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement, typeRattachement: 'PRINCIPAL' },
    });
    expect(rattRes.statusCode).toBe(200);

    // Le statut du signalement est désormais RATTACHE
    const checkSig = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement}`,
      headers: qualif.headers,
    });
    expect(checkSig.json().data.statutSignalement).toBe(StatutSignalement.RATTACHE);

    // ------------------------------------------------------------------------
    // Étape 5 : Affectation Chirurgicale par Volet Technique
    // ------------------------------------------------------------------------
    const affRes = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        motif: 'Mission assignée à l équipe de Dakar-Plateau',
      },
    });
    expect(affRes.statusCode).toBe(201);
    const idAffectation = affRes.json().idAffectation;

    // Le dossier bascule automatiquement à EN_COURS_DE_TRAITEMENT
    const checkDos = await app.inject({
      method: 'GET',
      url: `/api/dossiers/${idDossier}`,
      headers: traitement.headers,
    });
    expect(checkDos.json().data.statut_dossier).toBe(StatutDossier.EN_COURS_DE_TRAITEMENT);

    // ------------------------------------------------------------------------
    // Étape 6 : Intervention Terrain (Application Mobile Agent)
    // ------------------------------------------------------------------------
    const db = getDb();
    const intervRow = await db.queryOne<{ id_intervention: string }>(
      `SELECT id_intervention FROM intervention WHERE id_affectation = $1`,
      [idAffectation]
    );
    const idIntervention = intervRow!.id_intervention;

    const startInterv = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervention}/demarrer`,
      headers: terrain.headers,
    });
    expect(startInterv.statusCode).toBe(200);

    const chantierPhoto = await sharp({
      create: { width: 16, height: 16, channels: 3, background: '#16a34a' },
    }).jpeg().toBuffer();
    const beforeBoundary = 'isieco-e2e-before-photo';
    const beforePhoto = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervention}/photos/contenu`,
      headers: {
        ...terrain.headers,
        'content-type': `multipart/form-data; boundary=${beforeBoundary}`,
      },
      payload: multipartImage(beforeBoundary, chantierPhoto),
    });
    expect(beforePhoto.statusCode).toBe(201);
    const afterBoundary = 'isieco-e2e-after-photo';
    const afterPhoto = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervention}/photos/contenu`,
      headers: {
        ...terrain.headers,
        'content-type': `multipart/form-data; boundary=${afterBoundary}`,
      },
      payload: multipartImage(afterBoundary, chantierPhoto),
    });
    expect(afterPhoto.statusCode).toBe(201);
    await getDb().execute(
      `UPDATE photo_intervention SET contexte_photo = 'CONSTAT_INITIAL'
       WHERE id_photo_intervention = $1`,
      [beforePhoto.json().idPhoto],
    );

    // Déclaration de fin d'intervention avec compte-rendu
    const endInterv = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervention}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Collecte sélective de 380 kg de plastiques achevée. Site rendu propre.',
      },
    });
    expect(endInterv.statusCode).toBe(200);

    // ------------------------------------------------------------------------
    // Étape 7 : Vérification Indépendante et Clôture Résolue 100%
    // ------------------------------------------------------------------------
    const verifAction = await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation,
        resultatVerification: ResultatVerification.CONFORME_RESOLU,
        motif: 'Inspection sur site confirmée : propreté totale et zéro résidu',
        referencePreuve: 'preuves/verif_carnot_conforme.jpg',
      },
    });
    expect(verifAction.statusCode).toBe(201);

    // Clôture du dossier
    const clotureRes = await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${idDossier}/cloturer`,
      headers: verification.headers,
      payload: { motif: 'Dossier 100% résolu et vérifié sur le terrain' },
    });
    expect(clotureRes.statusCode).toBe(200);
    expect(clotureRes.json().statutDossier).toBe(StatutDossier.CLOS_RESOLUTION_CONFIRMEE);

    await getDb().execute(
      `INSERT INTO utilisateur_role (id_utilisateur, id_role, attribue_par, motif)
       SELECT $1, id_role, $2, 'Validation indépendante temporaire pour test publication dossier'
       FROM role WHERE code_role = 'DECISION'`,
      [TEST_PERSONAS.ADMIN.id, TEST_PERSONAS.ADMIN.id],
    );
    try {
      const distinctDecision = await loginAs(app, TEST_PERSONAS.ADMIN.email);
      for (const photoId of [beforePhoto.json().idPhoto, afterPhoto.json().idPhoto] as string[]) {
        const boundary = `isieco-e2e-variant-${photoId}`;
        const removeSubmissionFailure = await failBusinessEventForTest(
          'VARIANTE_PHOTO_SOUMISE',
        );
        try {
          const failedVariant = await app.inject({
            method: 'POST',
            url: `/api/publications/photos/INTERVENTION/${photoId}/variante`,
            headers: {
              ...traitement.headers,
              'content-type': `multipart/form-data; boundary=${boundary}`,
              'x-redaction-checks-confirmed': 'true',
            },
            payload: multipartImage(boundary, chantierPhoto),
          });
          expect(failedVariant.statusCode).toBe(500);
        } finally {
          await removeSubmissionFailure();
        }
        const unchangedPhoto = await getDb().queryOne<{
          etat_publication: string;
          reference_photo_publique: string | null;
        }>(
          `SELECT etat_publication, reference_photo_publique
           FROM photo_intervention WHERE id_photo_intervention = $1`,
          [photoId],
        );
        expect(unchangedPhoto?.etat_publication).toBe('INTERNE');
        expect(unchangedPhoto?.reference_photo_publique).toBeNull();

        const variant = await app.inject({
          method: 'POST',
          url: `/api/publications/photos/INTERVENTION/${photoId}/variante`,
          headers: {
            ...traitement.headers,
            'content-type': `multipart/form-data; boundary=${boundary}`,
            'x-redaction-checks-confirmed': 'true',
          },
          payload: multipartImage(boundary, chantierPhoto),
        });
        expect(variant.statusCode).toBe(202);
        const removeApprovalFailure = await failBusinessEventForTest(
          'VARIANTE_PHOTO_APPROUVEE',
        );
        try {
          const failedApproval = await app.inject({
            method: 'POST',
            url: `/api/publications/moderation/photos/INTERVENTION/${photoId}/decision`,
            headers: decision.headers,
            payload: { decision: 'APPROUVEE' },
          });
          expect(failedApproval.statusCode).toBe(500);
        } finally {
          await removeApprovalFailure();
        }
        const pendingPhoto = await getDb().queryOne<{
          etat_publication: string;
        }>(
          'SELECT etat_publication FROM photo_intervention WHERE id_photo_intervention = $1',
          [photoId],
        );
        expect(pendingPhoto?.etat_publication).toBe('EN_ATTENTE');

        const variantApproval = await app.inject({
          method: 'POST',
          url: `/api/publications/moderation/photos/INTERVENTION/${photoId}/decision`,
          headers: decision.headers,
          payload: { decision: 'APPROUVEE' },
        });
        expect(variantApproval.statusCode).toBe(200);
      }

      const removePublicationFailure = await failTableWriteForTest(
        'photo_publication',
      );
      try {
        const failedPublication = await app.inject({
          method: 'POST',
          url: `/api/publications/dossiers/${idDossier}`,
          headers: traitement.headers,
          payload: {
            photos: [
              { idPhoto: beforePhoto.json().idPhoto, role: 'AVANT' },
              { idPhoto: afterPhoto.json().idPhoto, role: 'APRES' },
            ],
          },
        });
        expect(failedPublication.statusCode).toBe(500);
      } finally {
        await removePublicationFailure();
      }
      const orphanedPublication = await getDb().queryOne<{ count: string }>(
        'SELECT count(*)::text AS count FROM publication_flux WHERE id_dossier = $1',
        [idDossier],
      );
      expect(orphanedPublication?.count).toBe('0');

      const publication = await app.inject({
        method: 'POST',
        url: `/api/publications/dossiers/${idDossier}`,
        headers: traitement.headers,
        payload: {
          photos: [
            { idPhoto: beforePhoto.json().idPhoto, role: 'AVANT' },
            { idPhoto: afterPhoto.json().idPhoto, role: 'APRES' },
          ],
        },
      });
      expect(publication.statusCode).toBe(201);
      const idPublication = publication.json().idPublication as string;

      const sameModerator = await app.inject({
        method: 'POST',
        url: `/api/publications/${idPublication}/decision`,
        headers: decision.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(sameModerator.statusCode).toBe(403);

      const publicationApproval = await app.inject({
        method: 'POST',
        url: `/api/publications/${idPublication}/decision`,
        headers: distinctDecision.headers,
        payload: { decision: 'APPROUVEE' },
      });
      expect(publicationApproval.statusCode).toBe(200);
      const publicFeed = await app.inject({ method: 'GET', url: '/api/publications/public' });
      expect(publicFeed.statusCode).toBe(200);
      expect(publicFeed.json().data[0].photos).toHaveLength(2);
      for (const photo of publicFeed.json().data[0].photos as Array<{ reference: string }>) {
        expect((await app.inject({ method: 'GET', url: photo.reference })).statusCode).toBe(200);
      }
    } finally {
      await getDb().execute(
        `DELETE FROM utilisateur_role
         WHERE id_utilisateur = $1
           AND id_role = (SELECT id_role FROM role WHERE code_role = 'DECISION')`,
        [TEST_PERSONAS.ADMIN.id],
      );
    }

    // ------------------------------------------------------------------------
    // Étape 8 : Consultation Citoyenne de la Résolution & Notifications
    // ------------------------------------------------------------------------
    const notifFinale = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: citoyen.headers,
    });
    expect(notifFinale.json().data.some((n: any) => n.titre.includes('résolu'))).toBe(true);

    // ------------------------------------------------------------------------
    // Étape 9 : Cartographie Décideur & Audit Métier Immuable
    // ------------------------------------------------------------------------
    const statsRes = await app.inject({
      method: 'GET',
      url: '/api/statistiques/indicateurs',
      headers: decision.headers,
    });
    expect(statsRes.statusCode).toBe(200);
    expect(statsRes.json().indicateurs.dossiersCloturesResolus).toBeGreaterThanOrEqual(1);
    expect(statsRes.json().indicateurs.tauxResolutionGlobalPct).toBe(100);

    // Vérification du journal d'audit complet
    const auditRes = await app.inject({
      method: 'GET',
      url: '/api/evenements/audit-trail?limit=50',
      headers: admin.headers,
    });
    expect(auditRes.statusCode).toBe(200);
    const evts = auditRes.json().data;
    const types = evts.map((e: any) => e.typeEvenement);

    // La chaîne transactionnelle complète est tracée de bout en bout
    expect(types).toContain('SIGNALEMENT_RECU');
    expect(types).toContain('SIGNALEMENT_EN_QUALIFICATION');
    expect(types).toContain('SIGNALEMENT_ACCEPTE');
    expect(types).toContain('DOSSIER_CREE');
    expect(types).toContain('SIGNALEMENT_RATTACHE');
    expect(types).toContain('AFFECTATION_CREEE');
    expect(types).toContain('INTERVENTION_TERMINEE');
    expect(types).toContain('RESOLUTION_CONFIRMEE');
    expect(types).toContain('DOSSIER_CLOS');
  });
});
