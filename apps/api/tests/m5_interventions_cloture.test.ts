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
  EtatAffectation,
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
    await db.execute(
      `INSERT INTO appartenance_equipe (id_utilisateur, id_equipe, date_debut, fonction)
       VALUES ($1, $2, '2026-01-01 08:00:00+00', 'CHEF_EQUIPE')
       ON CONFLICT DO NOTHING`,
      [TEST_PERSONAS.OPERATIONS.id, TEST_EQUIPES.BIO_MEDINA.id]
    );
    await db.execute(
      `INSERT INTO delegation_decision_equipe (
         id_delegation, id_equipe, id_utilisateur_delegue, date_debut_appartenance,
         type_decision, delegue_par, motif
       ) VALUES (
         gen_random_uuid(), $1, $2, '2026-01-01 08:00:00+00',
         'SOUMISSION_COMPTE_RENDU', $3, 'Délégation utilisée par le scénario de test'
       ) ON CONFLICT DO NOTHING`,
      [TEST_EQUIPES.BIO_MEDINA.id, TEST_PERSONAS.TERRAIN.id, TEST_PERSONAS.OPERATIONS.id]
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

  it('couvre chaque état d’intervention pour les commandes de démarrage et de fin', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const now = new Date();

    for (const statut of Object.values(StatutIntervention)) {
      const { idIntervOrganique } = await setupDossierWithAffectations();
      const setInterventionState = async () => {
        if (statut === StatutIntervention.TERMINEE) {
          await getDb().execute(
            `UPDATE intervention
             SET statut_intervention = $1,
                 date_heure_debut = $2,
                 date_heure_fin = $2,
                 date_soumission_compte_rendu = $2,
                 resultat_intervention = 'SUCCES_TOTAL',
                 compte_rendu = 'Intervention terminée pour la matrice complète.',
                 motif_exception = NULL,
                 renseigne_par = $3
             WHERE id_intervention = $4`,
            [statut, now, TEST_PERSONAS.OPERATIONS.id, idIntervOrganique],
          );
          return;
        }

        await getDb().execute(
          `UPDATE intervention
           SET statut_intervention = $1::varchar,
               date_heure_debut = CASE
                 WHEN $1::varchar = 'EN_COURS' THEN $2::timestamptz
                 ELSE NULL::timestamptz
               END,
               date_heure_fin = NULL,
               date_soumission_compte_rendu = NULL,
               resultat_intervention = NULL,
               compte_rendu = NULL,
               motif_exception = NULL
           WHERE id_intervention = $3`,
          [statut, now, idIntervOrganique],
        );
      };

      await setInterventionState();
      const start = await app.inject({
        method: 'POST',
        url: `/api/interventions/${idIntervOrganique}/demarrer`,
        headers: terrain.headers,
      });
      expect(
        start.statusCode,
        `démarrage depuis ${statut}: ${JSON.stringify(start.json())}`,
      ).toBe(statut === StatutIntervention.PROGRAMMEE ? 200 : 400);

      const afterStart = await getDb().queryOne<{ statut_intervention: string }>(
        'SELECT statut_intervention FROM intervention WHERE id_intervention = $1',
        [idIntervOrganique],
      );
      expect(afterStart?.statut_intervention).toBe(
        statut === StatutIntervention.PROGRAMMEE ? StatutIntervention.EN_COURS : statut,
      );

      await setInterventionState();
      const finish = await app.inject({
        method: 'POST',
        url: `/api/interventions/${idIntervOrganique}/terminer`,
        headers: terrain.headers,
        payload: {
          resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
          compteRendu: 'Intervention terminée pour la matrice complète.',
        },
      });
      expect(
        finish.statusCode,
        `fin depuis ${statut}: ${JSON.stringify(finish.json())}`,
      ).toBe(statut === StatutIntervention.EN_COURS ? 200 : 400);

      const afterFinish = await getDb().queryOne<{ statut_intervention: string }>(
        'SELECT statut_intervention FROM intervention WHERE id_intervention = $1',
        [idIntervOrganique],
      );
      expect(afterFinish?.statut_intervention).toBe(
        statut === StatutIntervention.EN_COURS ? StatutIntervention.TERMINEE : statut,
      );
    }
  });

  it('annule les transitions de démarrage et de fin si leur dernière trace échoue', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);

    const startFixture = await setupDossierWithAffectations();
    const removeStartFailure = await failBusinessEventForTest('INTERVENTION_DEBUTEE');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/interventions/${startFixture.idIntervOrganique}/demarrer`,
        headers: terrain.headers,
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeStartFailure();
    }
    const startState = await getDb().queryOne<{
      statut_intervention: string;
      etat_affectation: string;
      etat_prise_en_charge: string;
      started_events: string;
    }>(
      `SELECT
         i.statut_intervention,
         a.etat_affectation,
         c.etat_prise_en_charge,
         (SELECT COUNT(*)::text FROM evenement_metier e
          WHERE e.id_intervention_cible = i.id_intervention
            AND e.type_evenement = 'INTERVENTION_DEBUTEE') AS started_events
       FROM intervention i
       JOIN affectation a ON a.id_affectation = i.id_affectation
       JOIN contenu_dossier c
         ON c.id_dossier = a.id_dossier AND c.id_type_dechet = a.id_type_dechet
       WHERE i.id_intervention = $1`,
      [startFixture.idIntervOrganique],
    );
    expect(startState).toEqual({
      statut_intervention: StatutIntervention.PROGRAMMEE,
      etat_affectation: EtatAffectation.ACTIVE,
      etat_prise_en_charge: 'AFFECTEE',
      started_events: '0',
    });

    const finishFixture = await setupDossierWithAffectations();
    await startIntervention(finishFixture.idIntervOrganique, terrain.headers);
    const removeFinishFailure = await failBusinessEventForTest('INTERVENTION_TERMINEE');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/interventions/${finishFixture.idIntervOrganique}/terminer`,
        headers: terrain.headers,
        payload: {
          resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
          compteRendu: 'Compte-rendu dont la trace de fin échouera.',
        },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeFinishFailure();
    }
    const finishState = await getDb().queryOne<{
      statut_intervention: string;
      etat_affectation: string;
      etat_prise_en_charge: string;
      finished_events: string;
    }>(
      `SELECT
         i.statut_intervention,
         a.etat_affectation,
         c.etat_prise_en_charge,
         (SELECT COUNT(*)::text FROM evenement_metier e
          WHERE e.id_intervention_cible = i.id_intervention
            AND e.type_evenement = 'INTERVENTION_TERMINEE') AS finished_events
       FROM intervention i
       JOIN affectation a ON a.id_affectation = i.id_affectation
       JOIN contenu_dossier c
         ON c.id_dossier = a.id_dossier AND c.id_type_dechet = a.id_type_dechet
       WHERE i.id_intervention = $1`,
      [finishFixture.idIntervOrganique],
    );
    expect(finishState).toEqual({
      statut_intervention: StatutIntervention.EN_COURS,
      etat_affectation: EtatAffectation.ACTIVE,
      etat_prise_en_charge: 'EN_COURS',
      finished_events: '0',
    });
  });

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

  it.each(Object.values(ResultatIntervention))(
    'accepte le résultat d’intervention canonique %s et exige son motif si nécessaire',
    async (resultatIntervention) => {
      const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
      const { idIntervPlastique } = await setupDossierWithAffectations();
      await startIntervention(idIntervPlastique, terrain.headers);

      const isTotalSuccess = resultatIntervention === ResultatIntervention.SUCCES_TOTAL;
      const response = await app.inject({
        method: 'POST',
        url: `/api/interventions/${idIntervPlastique}/terminer`,
        headers: terrain.headers,
        payload: {
          resultatIntervention,
          compteRendu: `Compte rendu métier pour ${resultatIntervention}`,
          ...(!isTotalSuccess
            ? { motifException: `Motif métier détaillé pour ${resultatIntervention}` }
            : {}),
        },
      });

      expect(response.statusCode).toBe(200);
      const saved = await getDb().queryOne<{ resultat_intervention: string; motif_exception: string | null }>(
        `SELECT resultat_intervention, motif_exception FROM intervention WHERE id_intervention = $1`,
        [idIntervPlastique],
      );
      expect(saved?.resultat_intervention).toBe(resultatIntervention);
      if (isTotalSuccess) {
        expect(saved?.motif_exception).toBeNull();
      } else {
        expect(saved?.motif_exception?.trim().length).toBeGreaterThanOrEqual(10);
      }
    },
  );

  it('refuse un résultat exceptionnel sans motif explicite', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const { idIntervPlastique } = await setupDossierWithAffectations();
    await startIntervention(idIntervPlastique, terrain.headers);

    const response = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.DEPOT_INTROUVABLE,
        compteRendu: 'Le dépôt signalé ne correspond à aucun lieu repérable.',
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('enregistre le chef comme auteur du compte-rendu et transmet le volet en vérification', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const { idDossier, idAffPlastique, idIntervPlastique } = await setupDossierWithAffectations();
    await startIntervention(idIntervPlastique, terrain.headers);

    const startedCategory = await getDb().queryOne<{
      etat_prise_en_charge: string;
      statut_dossier: string;
    }>(
      `SELECT contenu.etat_prise_en_charge, dossier.statut_dossier
       FROM contenu_dossier AS contenu
       JOIN dossier_traitement AS dossier USING (id_dossier)
       WHERE contenu.id_dossier = $1 AND contenu.id_type_dechet = $2`,
      [idDossier, TEST_TYPES_DECHETS.PLASTIQUE],
    );
    expect(startedCategory).toMatchObject({
      etat_prise_en_charge: 'EN_COURS',
      statut_dossier: StatutDossier.EN_COURS_DE_TRAITEMENT,
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Intervention terminée et zone nettoyée',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().etatAffectation).toBe('A_VERIFIER');

    const intervention = await getDb().queryOne<{
      statut_intervention: string;
      renseigne_par: string;
      date_soumission_compte_rendu: string | null;
    }>(
      `SELECT statut_intervention, renseigne_par, date_soumission_compte_rendu
       FROM intervention WHERE id_intervention = $1`,
      [idIntervPlastique]
    );
    expect(intervention).toMatchObject({
      statut_intervention: 'TERMINEE',
      renseigne_par: TEST_PERSONAS.TERRAIN.id,
    });
    expect(intervention?.date_soumission_compte_rendu).not.toBeNull();

    const pendingVerification = await getDb().queryOne<{
      etat_prise_en_charge: string;
      statut_dossier: string;
    }>(
      `SELECT contenu.etat_prise_en_charge, dossier.statut_dossier
       FROM contenu_dossier AS contenu
       JOIN dossier_traitement AS dossier USING (id_dossier)
       WHERE contenu.id_dossier = $1 AND contenu.id_type_dechet = $2`,
      [idDossier, TEST_TYPES_DECHETS.PLASTIQUE],
    );
    expect(pendingVerification).toMatchObject({
      etat_prise_en_charge: 'A_VERIFIER',
      statut_dossier: StatutDossier.EN_COURS_DE_TRAITEMENT,
    });
  });

  it('refuse le compte-rendu d’un membre non chef et non délégué', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const { idIntervOrganique } = await setupDossierWithAffectations();
    await startIntervention(idIntervOrganique, terrain.headers);
    await getDb().execute(
      `DELETE FROM delegation_decision_equipe
       WHERE id_equipe = $1
         AND id_utilisateur_delegue = $2
         AND type_decision = 'SOUMISSION_COMPTE_RENDU'`,
      [TEST_EQUIPES.BIO_MEDINA.id, TEST_PERSONAS.TERRAIN.id]
    );

    const response = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervOrganique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Intervention terminée et zone nettoyée',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json().error.message).toMatch(/chef d’équipe ou un membre délégué/i);
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
    const afterFirstVerification = await getDb().query<{
      id_type_dechet: string;
      etat_prise_en_charge: string;
    }>(
      `SELECT id_type_dechet, etat_prise_en_charge
       FROM contenu_dossier
       WHERE id_dossier = $1 AND etat_contenu_dossier = 'INCLUSE'`,
      [idDossier],
    );
    expect(afterFirstVerification).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id_type_dechet: TEST_TYPES_DECHETS.PLASTIQUE,
        etat_prise_en_charge: 'TERMINEE',
      }),
      expect.objectContaining({
        id_type_dechet: TEST_TYPES_DECHETS.ORGANIQUE,
        etat_prise_en_charge: 'A_VERIFIER',
      }),
    ]));
    const statusAfterFirstVerification = await getDb().queryOne<{ statut_dossier: string }>(
      'SELECT statut_dossier FROM dossier_traitement WHERE id_dossier = $1',
      [idDossier],
    );
    expect(statusAfterFirstVerification?.statut_dossier).toBe(StatutDossier.EN_ATTENTE_VERIFICATION);

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
    expect(verif2.statusCode, verif2.body).toBe(201);
    const readyForClosure = await getDb().queryOne<{ statut_dossier: string }>(
      'SELECT statut_dossier FROM dossier_traitement WHERE id_dossier = $1',
      [idDossier],
    );
    expect(readyForClosure?.statut_dossier).toBe(StatutDossier.EN_ATTENTE_VERIFICATION);

    // 5. Règle T14 : Maintenant que 100% des volets inclus sont vérifiés résolus, la clôture est acceptée
    const cloturesConcurrentes = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/verifications/dossiers/${idDossier}/cloturer`,
        headers: verification.headers,
        payload: { motif: 'Clôture finale : propreté 100% confirmée sur site' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/verifications/dossiers/${idDossier}/cloturer`,
        headers: verification.headers,
        payload: { motif: 'Deuxième tentative de clôture simultanée' },
      }),
    ]);
    expect(cloturesConcurrentes.map((response) => response.statusCode).sort()).toEqual([200, 400]);
    const clotureComplete = cloturesConcurrentes.find((response) => response.statusCode === 200)!;
    expect(clotureComplete.json().statutDossier).toBe(StatutDossier.CLOS_RESOLUTION_CONFIRMEE);

    // Vérification en base
    const db = getDb();
    const dossierClos = await db.queryOne<{ statut_dossier: string; date_cloture: string | null }>(
      `SELECT statut_dossier, date_cloture FROM dossier_traitement WHERE id_dossier = $1`,
      [idDossier]
    );
    expect(dossierClos!.statut_dossier).toBe(StatutDossier.CLOS_RESOLUTION_CONFIRMEE);
    expect(dossierClos!.date_cloture).not.toBeNull();

    const secondeCloture = await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${idDossier}/cloturer`,
      headers: verification.headers,
      payload: { motif: 'Tentative de clôture répétée' },
    });
    expect(secondeCloture.statusCode).toBe(400);
    expect(secondeCloture.json().error.message).toContain('en attente de vérification');

    const evenementsCloture = await db.queryOne<{ count: string | number }>(
      `SELECT count(*) FROM evenement_metier
       WHERE id_dossier_cible = $1 AND type_evenement = 'DOSSIER_CLOS'`,
      [idDossier]
    );
    expect(Number(evenementsCloture!.count)).toBe(1);
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

  it('remet en reprise une vérification A_REVOIR et impose un motif', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const { idAffPlastique, idIntervPlastique } = await setupDossierWithAffectations();
    await startIntervention(idIntervPlastique, terrain.headers);
    await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Intervention déclarée terminée pour contrôle indépendant',
      },
    });

    const missingReason = await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAffPlastique,
        resultatVerification: ResultatVerification.A_REVOIR,
      },
    });
    expect(missingReason.statusCode).toBe(400);

    const review = await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAffPlastique,
        resultatVerification: ResultatVerification.A_REVOIR,
        motif: 'Les éléments disponibles ne permettent pas de conclure.',
      },
    });
    expect(review.statusCode, JSON.stringify(review.json())).toBe(201);

    const assignment = await getDb().queryOne<{ etat_affectation: string }>(
      `SELECT etat_affectation FROM affectation WHERE id_affectation = $1`,
      [idAffPlastique],
    );
    const retry = await getDb().queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM intervention
       WHERE id_affectation = $1 AND statut_intervention = 'PROGRAMMEE'`,
      [idAffPlastique],
    );
    expect(assignment?.etat_affectation).toBe('ACTIVE');
    expect(Number(retry?.count)).toBe(1);
  });

  it.each(Object.values(ResultatVerification))(
    'applique la transition métier prévue pour le résultat de vérification %s',
    async (resultatVerification) => {
      const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
      const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
      const { idDossier, idAffPlastique, idIntervPlastique } = await setupDossierWithAffectations();

      await startIntervention(idIntervPlastique, terrain.headers);
      const finish = await app.inject({
        method: 'POST',
        url: `/api/interventions/${idIntervPlastique}/terminer`,
        headers: terrain.headers,
        payload: {
          resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
          compteRendu: 'Intervention exécutée avant chaque résultat de vérification.',
        },
      });
      expect(finish.statusCode).toBe(200);

      const response = await app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: verification.headers,
        payload: {
          idAffectation: idAffPlastique,
          resultatVerification,
          motif: 'Décision documentée pour ce cas de test.',
        },
      });
      expect(response.statusCode).toBe(201);

      const state = await getDb().queryOne<{
        resultat_verification: string;
        etat_affectation: string;
        etat_prise_en_charge: string;
        reprises_planifiees: string;
      }>(
        `SELECT
           v.resultat_verification,
           a.etat_affectation,
           c.etat_prise_en_charge,
           (SELECT COUNT(*)::text FROM intervention i
            WHERE i.id_affectation = a.id_affectation
              AND i.statut_intervention = 'PROGRAMMEE') AS reprises_planifiees
         FROM verification_resolution v
         JOIN affectation a ON a.id_affectation = v.id_affectation
         JOIN contenu_dossier c
           ON c.id_dossier = a.id_dossier AND c.id_type_dechet = a.id_type_dechet
         WHERE v.id_verification = $1`,
        [response.json().idVerification],
      );
      expect(state?.resultat_verification).toBe(resultatVerification);
      if (resultatVerification === ResultatVerification.CONFORME_RESOLU) {
        expect(state).toMatchObject({
          etat_affectation: 'TERMINEE',
          etat_prise_en_charge: 'TERMINEE',
          reprises_planifiees: '0',
        });
      } else {
        expect(state).toMatchObject({
          etat_affectation: 'ACTIVE',
          etat_prise_en_charge: 'AFFECTEE',
          reprises_planifiees: '1',
        });
      }

      const dossier = await getDb().queryOne<{ statut_dossier: string }>(
        'SELECT statut_dossier FROM dossier_traitement WHERE id_dossier = $1',
        [idDossier],
      );
      expect(dossier?.statut_dossier).toBe(StatutDossier.EN_COURS_DE_TRAITEMENT);
    },
    30000,
  );

  it('couvre chaque état d’affectation pour la commande de vérification', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);

    for (const etatAffectation of Object.values(EtatAffectation)) {
      const { idAffPlastique, idIntervPlastique } = await setupDossierWithAffectations();
      await startIntervention(idIntervPlastique, terrain.headers);
      const finish = await app.inject({
        method: 'POST',
        url: `/api/interventions/${idIntervPlastique}/terminer`,
        headers: terrain.headers,
        payload: {
          resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
          compteRendu: 'Intervention terminée avant la permutation d’état.',
        },
      });
      expect(finish.statusCode).toBe(200);

      const isCurrentPending = etatAffectation === EtatAffectation.A_VERIFIER;
      await getDb().execute(
        `UPDATE affectation
         SET etat_affectation = $1,
             date_fin_affectation = CASE
               WHEN $1::varchar IN ('REMPLACEE', 'ANNULEE', 'TERMINEE') THEN date_heure_affectation
               ELSE NULL
             END
         WHERE id_affectation = $2`,
        [etatAffectation, idAffPlastique],
      );
      const response = await app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: verification.headers,
        payload: {
          idAffectation: idAffPlastique,
          resultatVerification: ResultatVerification.CONFORME_RESOLU,
        },
      });
      expect(
        response.statusCode,
        `vérification avec l’affectation ${etatAffectation}: ${JSON.stringify(response.json())}`,
      ).toBe(isCurrentPending ? 201 : 400);

      const count = await getDb().queryOne<{ count: string }>(
        'SELECT COUNT(*)::text AS count FROM verification_resolution WHERE id_affectation = $1',
        [idAffPlastique],
      );
      expect(Number(count?.count)).toBe(isCurrentPending ? 1 : 0);
    }
  });

  it('couvre chaque état de dossier pour les commandes de clôture et de réouverture', async () => {
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const closedStatuses = [
      StatutDossier.CLOS_RESOLUTION_CONFIRMEE,
      StatutDossier.CLOS_SANS_SUITE,
    ];

    for (const statutDossier of Object.values(StatutDossier)) {
      const { idDossier } = await setupDossierWithAffectations();
      const isClosed = closedStatuses.includes(statutDossier);
      await getDb().execute(
        `UPDATE dossier_traitement
         SET statut_dossier = $1::varchar,
             date_cloture = CASE
               WHEN $1::varchar IN ('CLOS_RESOLUTION_CONFIRMEE', 'CLOS_SANS_SUITE')
                 THEN CURRENT_TIMESTAMP
               ELSE NULL
             END
         WHERE id_dossier = $2`,
        [statutDossier, idDossier],
      );

      const close = await app.inject({
        method: 'POST',
        url: `/api/verifications/dossiers/${idDossier}/cloturer`,
        headers: verification.headers,
        payload: {},
      });
      expect(
        close.statusCode,
        `clôture depuis ${statutDossier}: ${JSON.stringify(close.json())}`,
      ).toBe(400);

      const reopen = await app.inject({
        method: 'POST',
        url: `/api/verifications/dossiers/${idDossier}/reouvrir`,
        headers: verification.headers,
        payload: { motif: 'Réouverture motivée pour la matrice des états.' },
      });
      expect(
        reopen.statusCode,
        `réouverture depuis ${statutDossier}: ${JSON.stringify(reopen.json())}`,
      ).toBe(isClosed ? 200 : 400);
    }
  });

  it('sérialise deux décisions concurrentes sur la même affectation', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const { idAffPlastique, idIntervPlastique } = await setupDossierWithAffectations();
    await startIntervention(idIntervPlastique, terrain.headers);
    const finish = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Intervention prête pour les deux décisions simultanées.',
      },
    });
    expect(finish.statusCode).toBe(200);

    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: verification.headers,
        payload: {
          idAffectation: idAffPlastique,
          resultatVerification: ResultatVerification.CONFORME_RESOLU,
        },
      }),
      app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: verification.headers,
        payload: {
          idAffectation: idAffPlastique,
          resultatVerification: ResultatVerification.NON_CONFORME,
          motif: 'Décision concurrente de reprise documentée.',
        },
      }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 400]);
    const state = await getDb().queryOne<{ verifications: string; courantes: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM verification_resolution WHERE id_affectation = $1) AS verifications,
         (SELECT COUNT(*)::text FROM verification_resolution
          WHERE id_affectation = $1 AND etat_verification = 'COURANTE') AS courantes`,
      [idAffPlastique],
    );
    expect(state).toEqual({ verifications: '1', courantes: '1' });
  });

  it('annule une vérification, le statut et la reprise si sa trace échoue', async () => {
    const db = getDb();
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const { idAffPlastique, idIntervPlastique } = await setupDossierWithAffectations();
    await startIntervention(idIntervPlastique, terrain.headers);
    const finish = await app.inject({
      method: 'POST',
      url: `/api/interventions/${idIntervPlastique}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Intervention terminée avant le test de rollback.',
      },
    });
    expect(finish.statusCode).toBe(200);

    await db.execute(`
      CREATE FUNCTION test_fail_verification_event() RETURNS TRIGGER
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.type_evenement = 'VERIFICATION_ENREGISTREE' THEN
          RAISE EXCEPTION 'Échec injecté de journalisation pour le test transactionnel';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER test_fail_verification_event_trigger
      BEFORE INSERT ON evenement_metier
      FOR EACH ROW EXECUTE FUNCTION test_fail_verification_event();
    `);

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: verification.headers,
        payload: {
          idAffectation: idAffPlastique,
          resultatVerification: ResultatVerification.NON_CONFORME,
          motif: 'Échec de vérification injecté après écriture métier.',
        },
      });
      expect(response.statusCode).toBe(500);

      const state = await db.queryOne<{
        verifications: string;
        interventions_programmees: string;
        etat_affectation: string;
        etat_prise_en_charge: string;
        statut_dossier: string;
      }>(
        `SELECT
           (SELECT COUNT(*)::text FROM verification_resolution
            WHERE id_affectation = $1) AS verifications,
           (SELECT COUNT(*)::text FROM intervention
            WHERE id_affectation = $1 AND statut_intervention = 'PROGRAMMEE')
             AS interventions_programmees,
           a.etat_affectation,
           c.etat_prise_en_charge,
           d.statut_dossier
         FROM affectation a
         JOIN contenu_dossier c
           ON c.id_dossier = a.id_dossier AND c.id_type_dechet = a.id_type_dechet
         JOIN dossier_traitement d ON d.id_dossier = a.id_dossier
         WHERE a.id_affectation = $1`,
        [idAffPlastique],
      );
      expect(state).toEqual({
        verifications: '0',
        interventions_programmees: '0',
        etat_affectation: 'A_VERIFIER',
        etat_prise_en_charge: 'A_VERIFIER',
        statut_dossier: StatutDossier.EN_COURS_DE_TRAITEMENT,
      });
    } finally {
      await db.execute(`
        DROP TRIGGER test_fail_verification_event_trigger ON evenement_metier;
        DROP FUNCTION test_fail_verification_event();
      `);
    }
  });

  it('annule toutes les écritures de vérification pour les branches résolution et reprise', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const prepareVerification = async () => {
      const fixture = await setupDossierWithAffectations();
      await startIntervention(fixture.idIntervPlastique, terrain.headers);
      const finish = await app.inject({
        method: 'POST',
        url: `/api/interventions/${fixture.idIntervPlastique}/terminer`,
        headers: terrain.headers,
        payload: {
          resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
          compteRendu: 'Intervention terminée avant injection de panne.',
        },
      });
      expect(finish.statusCode).toBe(200);
      return fixture;
    };

    const resolutionFixture = await prepareVerification();
    const removeResolutionFailure = await failBusinessEventForTest('RESOLUTION_CONFIRMEE');
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: verification.headers,
        payload: {
          idAffectation: resolutionFixture.idAffPlastique,
          resultatVerification: ResultatVerification.CONFORME_RESOLU,
        },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeResolutionFailure();
    }
    const resolutionState = await getDb().queryOne<{
      verifications: string;
      etat_affectation: string;
      etat_prise_en_charge: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM verification_resolution
          WHERE id_affectation = a.id_affectation) AS verifications,
         a.etat_affectation,
         c.etat_prise_en_charge
       FROM affectation a
       JOIN contenu_dossier c
         ON c.id_dossier = a.id_dossier AND c.id_type_dechet = a.id_type_dechet
       WHERE a.id_affectation = $1`,
      [resolutionFixture.idAffPlastique],
    );
    expect(resolutionState).toEqual({
      verifications: '0',
      etat_affectation: EtatAffectation.A_VERIFIER,
      etat_prise_en_charge: 'A_VERIFIER',
    });

    const retryFixture = await prepareVerification();
    const removeRetryFailure = await failTableWriteForTest('intervention');
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: verification.headers,
        payload: {
          idAffectation: retryFixture.idAffPlastique,
          resultatVerification: ResultatVerification.NON_CONFORME,
          motif: 'Reprise nécessaire après constat non conforme.',
        },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeRetryFailure();
    }
    const retryState = await getDb().queryOne<{
      verifications: string;
      interventions: string;
      etat_affectation: string;
      etat_prise_en_charge: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM verification_resolution
          WHERE id_affectation = a.id_affectation) AS verifications,
         (SELECT COUNT(*)::text FROM intervention
          WHERE id_affectation = a.id_affectation) AS interventions,
         a.etat_affectation,
         c.etat_prise_en_charge
       FROM affectation a
       JOIN contenu_dossier c
         ON c.id_dossier = a.id_dossier AND c.id_type_dechet = a.id_type_dechet
       WHERE a.id_affectation = $1`,
      [retryFixture.idAffPlastique],
    );
    expect(retryState).toEqual({
      verifications: '0',
      interventions: '1',
      etat_affectation: EtatAffectation.A_VERIFIER,
      etat_prise_en_charge: 'A_VERIFIER',
    });
  });

  it('annule les clôtures et réouvertures si la trace métier échoue', async () => {
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const fixture = await setupDossierWithAffectations();

    for (const idIntervention of [fixture.idIntervPlastique, fixture.idIntervOrganique]) {
      await startIntervention(idIntervention, terrain.headers);
      const finish = await app.inject({
        method: 'POST',
        url: `/api/interventions/${idIntervention}/terminer`,
        headers: terrain.headers,
        payload: {
          resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
          compteRendu: 'Volet résolu avant test transactionnel de clôture.',
        },
      });
      expect(finish.statusCode).toBe(200);
    }
    for (const idAffectation of [fixture.idAffPlastique, fixture.idAffOrganique]) {
      const response = await app.inject({
        method: 'POST',
        url: '/api/verifications',
        headers: verification.headers,
        payload: {
          idAffectation,
          resultatVerification: ResultatVerification.CONFORME_RESOLU,
        },
      });
      expect(response.statusCode).toBe(201);
    }

    const removeCloseFailure = await failBusinessEventForTest('DOSSIER_CLOS');
    try {
      const close = await app.inject({
        method: 'POST',
        url: `/api/verifications/dossiers/${fixture.idDossier}/cloturer`,
        headers: verification.headers,
        payload: {},
      });
      expect(close.statusCode).toBe(500);
    } finally {
      await removeCloseFailure();
    }
    const afterFailedClose = await getDb().queryOne<{
      statut_dossier: string;
      close_events: string;
    }>(
      `SELECT
         statut_dossier,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_dossier_cible = $1 AND type_evenement = 'DOSSIER_CLOS') AS close_events
       FROM dossier_traitement WHERE id_dossier = $1`,
      [fixture.idDossier],
    );
    expect(afterFailedClose).toEqual({
      statut_dossier: StatutDossier.EN_ATTENTE_VERIFICATION,
      close_events: '0',
    });

    const close = await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${fixture.idDossier}/cloturer`,
      headers: verification.headers,
      payload: {},
    });
    expect(close.statusCode).toBe(200);

    const removeReopenFailure = await failBusinessEventForTest('DOSSIER_REOUVERT');
    try {
      const reopen = await app.inject({
        method: 'POST',
        url: `/api/verifications/dossiers/${fixture.idDossier}/reouvrir`,
        headers: verification.headers,
        payload: { motif: 'Réouverture dont la trace métier échouera.' },
      });
      expect(reopen.statusCode).toBe(500);
    } finally {
      await removeReopenFailure();
    }
    const afterFailedReopen = await getDb().queryOne<{
      statut_dossier: string;
      closed_date: boolean;
      reopened_events: string;
      completed_contents: string;
    }>(
      `SELECT
         statut_dossier,
         date_cloture IS NOT NULL AS closed_date,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_dossier_cible = $1 AND type_evenement = 'DOSSIER_REOUVERT') AS reopened_events,
         (SELECT COUNT(*)::text FROM contenu_dossier
          WHERE id_dossier = $1 AND etat_prise_en_charge = 'TERMINEE') AS completed_contents
       FROM dossier_traitement WHERE id_dossier = $1`,
      [fixture.idDossier],
    );
    expect(afterFailedReopen).toEqual({
      statut_dossier: StatutDossier.CLOS_RESOLUTION_CONFIRMEE,
      closed_date: true,
      reopened_events: '0',
      completed_contents: '2',
    });
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

    expect(reouvrirRes.statusCode, reouvrirRes.body).toBe(200);
    expect(reouvrirRes.json().success).toBe(true);
    expect(reouvrirRes.json().statutDossier).toBe(StatutDossier.EN_ATTENTE_AFFECTATION);
    const resetCategories = await getDb().query<{ etat_prise_en_charge: string }>(
      `SELECT etat_prise_en_charge
       FROM contenu_dossier
       WHERE id_dossier = $1 AND etat_contenu_dossier = 'INCLUSE'`,
      [idDossier],
    );
    expect(resetCategories).toHaveLength(2);
    expect(resetCategories.every(({ etat_prise_en_charge }) => etat_prise_en_charge === 'A_AFFECTER')).toBe(true);

    const reClotureHistoriqueRes = await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${idDossier}/cloturer`,
      headers: verification.headers,
      payload: { motif: 'Tentative de clôture basée uniquement sur les vérifications historiques' },
    });
    expect(reClotureHistoriqueRes.statusCode).toBe(400);
    expect(reClotureHistoriqueRes.json().error.message).toMatch(/dossier en attente de vérification/i);

    // 3. Règle T15 & T36 : Vérifier en base que les affectations et vérifications passées sont préservées intactes
    const db = getDb();
    const dossierApresTentative = await db.queryOne<{ statut_dossier: string }>(
      `SELECT statut_dossier FROM dossier_traitement WHERE id_dossier = $1`,
      [idDossier]
    );
    expect(dossierApresTentative!.statut_dossier).toBe(StatutDossier.EN_ATTENTE_AFFECTATION);

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
