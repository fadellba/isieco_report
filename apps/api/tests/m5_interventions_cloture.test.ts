import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestApp,
  cleanDatabase,
  loginAs,
  TEST_PERSONAS,
  TEST_TYPES_DECHETS,
  TEST_EQUIPES,
} from './helpers.js';
import {
  ResultatIntervention,
  ResultatVerification,
  StatutDossier,
  StatutIntervention,
} from '@isieco/shared';
import { getDb } from '../src/db/index.js';
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

describe('Jalon M5 (Tranche 4) — Interventions Terrain, Vérification 100% & Réouverture', () => {
  let app: FastifyInstance;
  let uploadDirectory: string;
  const originalUploadDirectory = config.uploadDir;

  beforeAll(async () => {
    uploadDirectory = await mkdtemp(path.join(tmpdir(), 'isieco-intervention-photo-tests-'));
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

  // Helper pour initialiser un dossier avec 2 volets et 2 affectations actives
  async function setupDossierWithAffectations() {
    const db = getDb();
    await db.execute(
      `INSERT INTO appartenance_equipe (id_utilisateur, id_equipe, date_debut, fonction)
       VALUES ($1, $2, '2026-01-01 08:00:00+00', 'AGENT_TERRAIN')
       ON CONFLICT DO NOTHING`,
      [TEST_PERSONAS.TERRAIN.id, TEST_EQUIPES.BIO_MEDINA.id]
    );
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);

    // 1. Création dossier avec Plastique et Organique
    const dos = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier Multi-Volets Dakar-Plateau',
        latitude: 14.6711,
        longitude: -17.433,
        categories: [
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE, quantiteEstimee: '500 kg' },
          { idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE, quantiteEstimee: '1 tonne' },
        ],
      },
    });
    const idDossier = dos.json().idDossier;

    // 2. Affectation Plastique
    const aff1 = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        motif: 'Mission Plastique',
      },
    });
    const idAff1 = aff1.json().idAffectation;

    // 3. Affectation Organique
    const aff2 = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE,
        idEquipe: TEST_EQUIPES.BIO_MEDINA.id,
        idCompetenceEquipe: TEST_EQUIPES.BIO_MEDINA.competenceOrganique,
        motif: 'Mission Bio-déchets',
      },
    });
    const idAff2 = aff2.json().idAffectation;

    // Récupérer les identifiants d'interventions créées automatiquement
    const interv1 = await db.queryOne<{ id_intervention: string }>(
      `SELECT id_intervention FROM intervention WHERE id_affectation = $1`,
      [idAff1]
    );
    const interv2 = await db.queryOne<{ id_intervention: string }>(
      `SELECT id_intervention FROM intervention WHERE id_affectation = $1`,
      [idAff2]
    );

    return {
      idDossier,
      idAffPlastique: idAff1,
      idAffOrganique: idAff2,
      idIntervPlastique: interv1!.id_intervention,
      idIntervOrganique: interv2!.id_intervention,
    };
  }

  async function startIntervention(id: string, headers: Record<string, string>) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/interventions/${id}/demarrer`,
      headers,
    });
    expect(response.statusCode).toBe(200);
  }

  // --------------------------------------------------------------------------
  // Test d'acceptation T11 : Rejet fin d'intervention sans compte-rendu ni résultat
  // --------------------------------------------------------------------------
  it("T11: Rejet de fin d'intervention sans compte-rendu (>= 10 car.) ni résultat", async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const { idIntervPlastique } = await setupDossierWithAffectations();

    // 1. Tentative sans résultat d'intervention
    const resNoResult = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        compteRendu: 'Chantier nettoyé correctement',
      },
    });
    expect(resNoResult.statusCode).toBe(400);
    expect(resNoResult.json().error.message).toMatch(/résultat de l'intervention est obligatoire/i);

    // 2. Tentative avec compte-rendu trop court (< 10 caractères)
    const resShortCR = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Fini',
      },
    });
    expect(resShortCR.statusCode).toBe(400);
    expect(resShortCR.json().error.message).toMatch(/compte-rendu d'au moins 10 caractères/i);

    const unstarted = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Rapport envoyé sans démarrage',
      },
    });
    expect(unstarted.statusCode).toBe(400);
    expect(unstarted.json().error.message).toMatch(/doit être démarrée/i);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T21 : Photos d'intervention avec contexte
  // --------------------------------------------------------------------------
  it("T21: Association stricte de la photo d'intervention au contexte FIN_INTERVENTION", async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const { idIntervPlastique } = await setupDossierWithAffectations();

    const unsupportedContext = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/photos`,
      headers: terrain.headers,
      payload: {
        referencePhoto: 'photos/chantiers/interv_plastique_pendant.jpg',
        contextePhoto: 'COURS_INTERVENTION',
      },
    });
    expect(unsupportedContext.statusCode).toBe(400);

    const photoRes = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/photos`,
      headers: terrain.headers,
      payload: {
        referencePhoto: 'photos/chantiers/interv_plastique_apres.jpg',
        contextePhoto: 'FIN_INTERVENTION',
        description: 'Zone Kermel entièrement nettoyée après passage de la benne',
      },
    });

    expect(photoRes.statusCode).toBe(201);
    expect(photoRes.json().success).toBe(true);
    expect(photoRes.json().idPhoto).toBeDefined();

    // Vérifier l'insertion en base
    const db = getDb();
    const photoRow = await db.queryOne<{ reference_photo: string; contexte_photo: string }>(
      `SELECT reference_photo, contexte_photo FROM photo_intervention WHERE id_photo_intervention = $1`,
      [photoRes.json().idPhoto]
    );
    expect(photoRow).not.toBeNull();
    expect(photoRow!.contexte_photo).toBe('FIN_INTERVENTION');

    const png = await sharp({
      create: { width: 2, height: 2, channels: 4, background: '#16a34a' },
    })
      .png()
      .toBuffer();
    const boundary = 'isieco-intervention-photo-boundary';
    const uploadRes = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/photos/contenu`,
      headers: {
        ...terrain.headers,
        'content-type': `multipart/form-data; boundary=${boundary}`,
      },
      payload: multipartImage(boundary, 'image/png', png),
    });
    expect(uploadRes.statusCode).toBe(201);

    const downloadRes = await app.inject({
      method: 'GET',
      url: `/api/interventions/${idIntervPlastique}/photos/${uploadRes.json().idPhoto}/contenu`,
      headers: terrain.headers,
    });
    expect(downloadRes.statusCode).toBe(200);
    expect((await sharp(downloadRes.rawPayload).metadata()).format).toBe('png');
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T13 & T14 : Invariant de clôture 100% de résolution
  // --------------------------------------------------------------------------
  it("T13 & T14: Interdiction formelle de clôturer si < 100% résolu (T13), clôture autorisée dès 100% résolu (T14)", async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const { idDossier, idAffPlastique, idAffOrganique, idIntervPlastique, idIntervOrganique } =
      await setupDossierWithAffectations();

    // 1. Les deux interventions sont terminées sur le terrain
    await startIntervention(idIntervPlastique, terrain.headers);
    await startIntervention(idIntervOrganique, terrain.headers);
    await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Évacuation totale des déchets plastiques terminée',
      },
    });

    await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervOrganique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Curage et ramassage des bio-déchets achevé',
      },
    });

    // 2. Le vérificateur valide UNIQUEMENT le volet Plastique (Organique reste non vérifié)
    const verif1 = await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAffPlastique,
        resultatVerification: ResultatVerification.CONFORME_RESOLU,
        motif: 'Inspection terrain : sol propre et conforme',
      },
    });
    expect(verif1.statusCode).toBe(201);

    // 3. Règle T13 : Tentative de clôturer le dossier alors qu'il n'est vérifié qu'à 50% -> 400 Bad Request
    const clotureIncomplete = await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${idDossier}/cloturer`,
      headers: verification.headers,
      payload: { motif: 'Tentative de clôture prématurée' },
    });
    expect(clotureIncomplete.statusCode).toBe(400);
    expect(clotureIncomplete.json().error.message).toMatch(/100% des volets inclus doivent être résolus/i);

    // 4. Le vérificateur valide à présent le volet Organique
    const verif2 = await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAffOrganique,
        resultatVerification: ResultatVerification.CONFORME_RESOLU,
        motif: 'Inspection bio-déchets : zone assainie avec succès',
      },
    });
    expect(verif2.statusCode).toBe(201);

    // 5. Règle T14 : Maintenant que 100% des volets inclus sont vérifiés résolus, la clôture est acceptée
    const clotureComplete = await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${idDossier}/cloturer`,
      headers: verification.headers,
      payload: { motif: 'Clôture finale : propreté 100% confirmée sur site' },
    });
    expect(clotureComplete.statusCode).toBe(200);
    expect(clotureComplete.json().statutDossier).toBe(StatutDossier.CLOS_RESOLUTION_CONFIRMEE);

    // Vérification en base
    const db = getDb();
    const dossierClos = await db.queryOne<{ statut_dossier: string; date_cloture: string | null }>(
      `SELECT statut_dossier, date_cloture FROM dossier_traitement WHERE id_dossier = $1`,
      [idDossier]
    );
    expect(dossierClos!.statut_dossier).toBe(StatutDossier.CLOS_RESOLUTION_CONFIRMEE);
    expect(dossierClos!.date_cloture).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T12 & T25 : Vérification non conforme & Remplacement
  // --------------------------------------------------------------------------
  it("T12 & T25: Vérification non conforme réactivant l'intervention et gestion de l'état COURANTE/REMPLACEE", async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const { idAffPlastique, idIntervPlastique } = await setupDossierWithAffectations();

    // 1. Première fin d'intervention
    await startIntervention(idIntervPlastique, terrain.headers);
    await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Intervention terminée par l équipe',
      },
    });

    // 2. Première vérification : NON_CONFORME_REJETEE (Test T12)
    const verif1 = await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAffPlastique,
        resultatVerification: ResultatVerification.NON_CONFORME,
        motif: 'Plastiques encore présents derrière les kiosques',
      },
    });
    expect(verif1.statusCode).toBe(201);
    const idVerif1 = verif1.json().idVerification;

    // Règle T12 : L'affectation repasse à ACTIVE pour nouvelle intervention
    const db = getDb();
    const affApresRejet = await db.queryOne<{ etat_affectation: string }>(
      `SELECT etat_affectation FROM affectation WHERE id_affectation = $1`,
      [idAffPlastique]
    );
    expect(affApresRejet!.etat_affectation).toBe('ACTIVE');

    // 3. L'équipe réintervient et re-termine
    const interventionReprise = await db.queryOne<{ id_intervention: string }>(
      `SELECT id_intervention FROM intervention
       WHERE id_affectation = $1 AND statut_intervention = 'PROGRAMMEE'
         AND id_intervention <> $2`,
      [idAffPlastique, idIntervPlastique]
    );
    expect(interventionReprise).not.toBeNull();
    expect(interventionReprise!.id_intervention).not.toBe(idIntervPlastique);
    await startIntervention(interventionReprise!.id_intervention, terrain.headers);
    await app.inject({
      method: 'POST',
      url: `/api/interventions/${interventionReprise!.id_intervention}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Nettoyage approfondi derrière les kiosques effectué',
      },
    });

    // 4. Deuxième vérification : CONFORME_RESOLU (Test T25)
    const verif2 = await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAffPlastique,
        resultatVerification: ResultatVerification.CONFORME_RESOLU,
        motif: 'Contrôle parfait, tout est propre',
      },
    });
    expect(verif2.statusCode).toBe(201);
    const idVerif2 = verif2.json().idVerification;

    // Règle T25 : Exactement une vérification COURANTE, l'ancienne est passée à REMPLACEE
    const verifs = await db.query<{ id_verification: string; etat_verification: string }>(
      `SELECT id_verification, etat_verification FROM verification_resolution 
       WHERE id_affectation = $1 ORDER BY date_verification ASC`,
      [idAffPlastique]
    );

    expect(verifs.length).toBe(2);
    expect(verifs[0].id_verification).toBe(idVerif1);
    expect(verifs[0].etat_verification).toBe('REMPLACEE');

    expect(verifs[1].id_verification).toBe(idVerif2);
    expect(verifs[1].etat_verification).toBe('COURANTE');

    const visits = await db.query<{ id_intervention: string; compte_rendu: string }>(
      `SELECT id_intervention, compte_rendu FROM intervention
       WHERE id_affectation = $1`,
      [idAffPlastique]
    );
    expect(visits).toHaveLength(2);
    expect(visits.find((visit) => visit.id_intervention === idIntervPlastique)?.compte_rendu)
      .toBe('Intervention terminée par l équipe');
    expect(visits.find((visit) => visit.id_intervention === interventionReprise!.id_intervention)?.compte_rendu)
      .toBe('Nettoyage approfondi derrière les kiosques effectué');
  });

  it("T40: Un agent terrain ne peut pas démarrer une mission d'une autre équipe", async () => {
    const db = getDb();
    const teamRole = await db.queryOne<{ id_role: string }>(
      `SELECT id_role FROM role WHERE code_role = 'TERRAIN'`
    );
    await db.execute(
      `INSERT INTO utilisateur_role (id_utilisateur, id_role, date_debut)
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [TEST_PERSONAS.CITOYEN_2.id, teamRole!.id_role]
    );
    try {
      const outsider = await loginAs(app, TEST_PERSONAS.CITOYEN_2.email);
      const { idIntervPlastique } = await setupDossierWithAffectations();

      const response = await app.inject({
        method: 'POST',
        url: `/api/interventions/${idIntervPlastique}/demarrer`,
        headers: outsider.headers,
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    } finally {
      await db.execute(
        `DELETE FROM utilisateur_role WHERE id_utilisateur = $1 AND id_role = $2`,
        [TEST_PERSONAS.CITOYEN_2.id, teamRole!.id_role]
      );
    }
  });

  it("T41: L'agent ayant terminé l'intervention ne peut pas la vérifier", async () => {
    const db = getDb();
    const { idAffPlastique, idIntervPlastique } = await setupDossierWithAffectations();
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);

    await startIntervention(idIntervPlastique, terrain.headers);
    await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Intervention réalisée par agent terrain',
      },
    });

    const verificationRole = await db.queryOne<{ id_role: string }>(
      `SELECT id_role FROM role WHERE code_role = 'VERIFICATION'`
    );
    await db.execute(
      `INSERT INTO utilisateur_role (id_utilisateur, id_role, date_debut)
       VALUES ($1, $2, CURRENT_TIMESTAMP)`,
      [TEST_PERSONAS.TERRAIN.id, verificationRole!.id_role]
    );
    try {
      const dualRoleUser = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
      const response = await app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: dualRoleUser.headers,
        payload: {
          idAffectation: idAffPlastique,
          resultatVerification: ResultatVerification.CONFORME_RESOLU,
        },
      });

      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe('FORBIDDEN');
    } finally {
      await db.execute(
        `DELETE FROM utilisateur_role WHERE id_utilisateur = $1 AND id_role = $2`,
        [TEST_PERSONAS.TERRAIN.id, verificationRole!.id_role]
      );
    }
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T15 & T36 : Réouverture de dossier après clôture
  // --------------------------------------------------------------------------
  it("T15 & T36: Réouverture d'un dossier clos sans écraser les affectations et vérifications passées", async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const { idDossier, idAffPlastique, idAffOrganique, idIntervPlastique, idIntervOrganique } =
      await setupDossierWithAffectations();

    // 1. Clôturer intégralement le dossier à 100%
    await startIntervention(idIntervPlastique, terrain.headers);
    await startIntervention(idIntervOrganique, terrain.headers);
    await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Chantier plastique 100% évacué',
      },
    });
    await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervOrganique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Chantier organique 100% évacué',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAffPlastique,
        resultatVerification: ResultatVerification.CONFORME_RESOLU,
        motif: 'Plastique validé',
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAffOrganique,
        resultatVerification: ResultatVerification.CONFORME_RESOLU,
        motif: 'Organique validé',
      },
    });
    await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${idDossier}/cloturer`,
      headers: verification.headers,
      payload: { motif: 'Clôture initiale conforme' },
    });

    // 2. Réouverture suite à réapparition d'un dépôt (Test T15 / T36)
    const reouvrirRes = await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${idDossier}/reouvrir`,
      headers: verification.headers,
      payload: {
        motif: 'Réapparition constatée de nouveaux dépôts sauvages sur le site 48h après clôture',
      },
    });

    expect(reouvrirRes.statusCode).toBe(200);
    expect(reouvrirRes.json().success).toBe(true);
    expect(reouvrirRes.json().statutDossier).toBe(StatutDossier.A_QUALIFIER);

    // 3. Règle T15 & T36 : Vérifier en base que les affectations et vérifications passées sont préservées intactes
    const db = getDb();
    const verifsCount = await db.queryOne<{ count: string | number }>(
      `SELECT count(*) FROM verification_resolution vr
       JOIN affectation a ON vr.id_affectation = a.id_affectation
       WHERE a.id_dossier = $1`,
      [idDossier]
    );
    expect(Number(verifsCount!.count)).toBe(2);

    // Vérifier l'événement métier immuable DOSSIER_REOUVERT
    const auditEvt = await db.queryOne<{ type_evenement: string; motif: string }>(
      `SELECT type_evenement, motif FROM evenement_metier 
       WHERE id_dossier_cible = $1 AND type_evenement = 'DOSSIER_REOUVERT'`,
      [idDossier]
    );
    expect(auditEvt).not.toBeNull();
    expect(auditEvt!.motif).toMatch(/Réapparition constatée/);
  });
});
