import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestApp,
  cleanDatabase,
  failTableWriteForTest,
  loginAs,
  TEST_PERSONAS,
  TEST_TYPES_DECHETS,
  TEST_EQUIPES,
} from './helpers.js';
import { EtatAffectation } from '@isieco/shared';
import { getDb } from '../src/db/index.js';
import crypto from 'node:crypto';

describe('Jalon M4 (Tranche 3) — Référentiels, Compétences & Affectation par Volet', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  // Helper pour créer un dossier de test avec 2 volets (Plastique & Organique)
  async function createTestDossier(traitementHeaders: Record<string, string>) {
    const res = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitementHeaders,
      payload: {
        descriptionSynthese: 'Dossier Mixte Test Affectations Dakar-Plateau',
        latitude: 14.6711,
        longitude: -17.433,
        categories: [
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE, quantiteEstimee: '500 kg' },
          { idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE, quantiteEstimee: '1 tonne' },
        ],
      },
    });
    return res.json().idDossier;
  }

  // --------------------------------------------------------------------------
  // Test d'acceptation T05 : Rejet si catégorie absente de CONTENU_DOSSIER
  // --------------------------------------------------------------------------
  it("T05: Rejet si l'affectation vise une catégorie absente de CONTENU_DOSSIER", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);

    // Tentative d'affecter le volet GRAVATS (absent du dossier)
    const res = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.GRAVATS,
        idEquipe: TEST_EQUIPES.DEBLAIEMENT_LITTORAL.id,
        idCompetenceEquipe: TEST_EQUIPES.DEBLAIEMENT_LITTORAL.competenceGravats,
        motif: 'Tentative volet inexistant',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/absent du contenu de ce dossier/i);
  });

  it('annule intégralement une réaffectation si la nouvelle intervention ne peut pas être créée', async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);
    const initial = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        motif: 'Première affectation avant remplacement.',
      },
    });
    expect(initial.statusCode).toBe(201);
    const oldAssignmentId = initial.json().idAffectation as string;
    const removeFailure = await failTableWriteForTest('intervention');

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/affectations/${oldAssignmentId}/reaffecter`,
        headers: affectation.headers,
        payload: {
          nouvelleEquipeId: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
          nouvelleCompetenceId: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
          motif: 'Remplacement transactionnel dont la création échouera.',
        },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeFailure();
    }

    const state = await getDb().queryOne<{
      old_state: string;
      old_ended: boolean;
      assignments: string;
      interventions: string;
      replacement_events: string;
      content_state: string;
    }>(
      `SELECT
         a.etat_affectation AS old_state,
         a.date_fin_affectation IS NOT NULL AS old_ended,
         (SELECT COUNT(*)::text FROM affectation
          WHERE id_dossier = $1 AND id_type_dechet = $2) AS assignments,
         (SELECT COUNT(*)::text FROM intervention i
          JOIN affectation related ON related.id_affectation = i.id_affectation
          WHERE related.id_dossier = $1 AND related.id_type_dechet = $2) AS interventions,
         (SELECT COUNT(*)::text FROM evenement_metier e
          WHERE e.type_evenement = 'AFFECTATION_REMPLACEE'
            AND e.id_affectation_cible IN (
              SELECT id_affectation FROM affectation
              WHERE id_dossier = $1 AND id_type_dechet = $2
            )) AS replacement_events,
         c.etat_prise_en_charge AS content_state
       FROM affectation a
       JOIN contenu_dossier c
         ON c.id_dossier = a.id_dossier AND c.id_type_dechet = a.id_type_dechet
       WHERE a.id_affectation = $3`,
      [idDossier, TEST_TYPES_DECHETS.PLASTIQUE, oldAssignmentId],
    );
    expect(state).toEqual({
      old_state: EtatAffectation.ACTIVE,
      old_ended: false,
      assignments: '1',
      interventions: '1',
      replacement_events: '0',
      content_state: 'AFFECTEE',
    });
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T06 : Rejet si équipe sans la compétence requise
  // --------------------------------------------------------------------------
  it("T06: Rejet si l'équipe choisie ne possède pas la compétence requise pour ce type de déchet", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);

    // Tentative d'affecter l'équipe BIO_MEDINA sur le volet PLASTIQUE avec une fausse compétence
    const res = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.BIO_MEDINA.id,
        idCompetenceEquipe: TEST_EQUIPES.BIO_MEDINA.competenceOrganique, // Compétence Bio-déchets, pas plastique !
        motif: 'Affectation incompétente',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/ne possède pas la compétence requise/i);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T07 : Rejet si compétence expirée à la date d'affectation
  // --------------------------------------------------------------------------
  it("T07: Rejet si la compétence de l'équipe est expirée à la date de l'affectation", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);

    // Créer un dossier incluant ELECTRONIQUE
    const dos = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier D3E Électronique',
        latitude: 14.6711,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.ELECTRONIQUE }],
      },
    });
    const idDossier = dos.json().idDossier;

    // Équipe PLASTIQUE_PLATEAU a la compétence ELECTRONIQUE expirée fin 2025 (seed_systeme_dakar.sql)
    const res = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.ELECTRONIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competenceElectroniqueExpiree,
        motif: 'Tentative affectation compétence périmée',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/expiré à la date d'affectation/i);
  });

  it("T42: Rejet d'une affectation quand le dossier n'a pas de localisation exploitable", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const dossier = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier sans localisation exploitable',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier: dossier.json().idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.message).toMatch(/localisation exploitable/i);
  });

  it("T44: Rejet d'une affectation avant la date de début de validité de la compétence", async () => {
    const db = getDb();
    const competence = await db.queryOne<{ date_debut: string }>(
      `SELECT date_debut FROM competence_equipe WHERE id_competence_equipe = $1`,
      [TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique]
    );
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);

    await db.execute(
      `UPDATE competence_equipe
       SET date_debut = CURRENT_TIMESTAMP + INTERVAL '1 day'
       WHERE id_competence_equipe = $1`,
      [TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique]
    );
    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/affectations',
        headers: affectation.headers,
        payload: {
          idDossier,
          idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
          idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
          idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.message).toMatch(/pas encore valide/i);
    } finally {
      await db.execute(
        `UPDATE competence_equipe SET date_debut = $1 WHERE id_competence_equipe = $2`,
        [competence!.date_debut, TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique]
      );
    }
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T08 : Unicité de l'affectation active par volet
  // --------------------------------------------------------------------------
  it("T08: Rejet de création directe d'une deuxième affectation active pour le même volet", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);

    // 1. Première affectation réussie du volet Plastique
    const aff1 = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        motif: 'Première affectation valide',
      },
    });
    expect(aff1.statusCode).toBe(201);

    // 2. Deuxième tentative sur le même volet Plastique alors que la première est active -> 400 Bad Request
    const aff2 = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        motif: 'Deuxième affectation concurrente directe',
      },
    });
    expect(aff2.statusCode).toBe(400);
    expect(aff2.json().error.message).toMatch(/affectation active existe déjà/i);
  });

  it('sérialise deux affectations concurrentes du même volet sans créer de doublon', async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);
    const payload = {
      idDossier,
      idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
      idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
      idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
    };

    const responses = await Promise.all([
      app.inject({
        method: 'POST',
        url: '/api/affectations',
        headers: affectation.headers,
        payload: { ...payload, motif: 'Première requête simultanée' },
      }),
      app.inject({
        method: 'POST',
        url: '/api/affectations',
        headers: affectation.headers,
        payload: { ...payload, motif: 'Seconde requête simultanée' },
      }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([201, 400]);
    const persisted = await getDb().queryOne<{ affectations: string; interventions: string }>(
      `SELECT
         (SELECT COUNT(*)::text FROM affectation
          WHERE id_dossier = $1 AND id_type_dechet = $2 AND date_fin_affectation IS NULL) AS affectations,
         (SELECT COUNT(*)::text FROM intervention i
          JOIN affectation a ON a.id_affectation = i.id_affectation
          WHERE a.id_dossier = $1 AND a.id_type_dechet = $2) AS interventions`,
      [idDossier, TEST_TYPES_DECHETS.PLASTIQUE],
    );
    expect(persisted).toEqual({ affectations: '1', interventions: '1' });
  });

  it('rend idempotentes deux requêtes concurrentes portant la même référence', async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);
    const referenceOperationUnique = `OP-CONCURRENT-${crypto.randomUUID()}`;
    const payload = {
      idDossier,
      idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
      idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
      idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
      referenceOperationUnique,
    };

    const responses = await Promise.all([
      app.inject({ method: 'POST', url: '/api/affectations', headers: affectation.headers, payload }),
      app.inject({ method: 'POST', url: '/api/affectations', headers: affectation.headers, payload }),
    ]);

    expect(responses.map((response) => response.statusCode).sort()).toEqual([200, 201]);
    expect(responses.map((response) => response.json().idAffectation).filter(Boolean))
      .toEqual([responses[0].json().idAffectation, responses[0].json().idAffectation]);
    expect(responses.filter((response) => response.json().idempotent === true)).toHaveLength(1);
    const counts = await getDb().queryOne<{
      affectations: string;
      interventions: string;
      events: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM affectation
          WHERE reference_operation_unique = $1) AS affectations,
         (SELECT COUNT(*)::text FROM intervention i
          JOIN affectation a ON a.id_affectation = i.id_affectation
          WHERE a.reference_operation_unique = $1) AS interventions,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE reference_operation_unique = $1) AS events`,
      [referenceOperationUnique],
    );
    expect(counts).toEqual({ affectations: '1', interventions: '1', events: '1' });
  });

  it('annule toutes les écritures si la journalisation échoue après les premières écritures métier', async () => {
    const db = getDb();
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);

    await db.execute(`
      CREATE FUNCTION test_fail_affectation_event() RETURNS TRIGGER
      LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.type_evenement = 'AFFECTATION_CREEE' THEN
          RAISE EXCEPTION 'Échec injecté de journalisation pour le test transactionnel';
        END IF;
        RETURN NEW;
      END;
      $$;
      CREATE TRIGGER test_fail_affectation_event_trigger
      BEFORE INSERT ON evenement_metier
      FOR EACH ROW EXECUTE FUNCTION test_fail_affectation_event();
    `);

    try {
      const response = await app.inject({
        method: 'POST',
        url: '/api/affectations',
        headers: affectation.headers,
        payload: {
          idDossier,
          idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
          idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
          idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
          motif: 'Affectation dont la trace échouera',
        },
      });

      expect(response.statusCode).toBe(500);

      const state = await db.queryOne<{
        affectations: string;
        interventions: string;
        events: string;
        etat_prise_en_charge: string;
      }>(
        `SELECT
           (SELECT COUNT(*)::text FROM affectation WHERE id_dossier = $1) AS affectations,
           (SELECT COUNT(*)::text FROM intervention i
            JOIN affectation a ON a.id_affectation = i.id_affectation
            WHERE a.id_dossier = $1) AS interventions,
           (SELECT COUNT(*)::text FROM evenement_metier
            WHERE id_affectation_cible IN (
              SELECT id_affectation FROM affectation WHERE id_dossier = $1
            )) AS events,
           etat_prise_en_charge
         FROM contenu_dossier
         WHERE id_dossier = $1 AND id_type_dechet = $2`,
        [idDossier, TEST_TYPES_DECHETS.PLASTIQUE],
      );
      expect(state).toEqual({
        affectations: '0',
        interventions: '0',
        events: '0',
        etat_prise_en_charge: 'A_AFFECTER',
      });
    } finally {
      await db.execute(`
        DROP TRIGGER test_fail_affectation_event_trigger ON evenement_metier;
        DROP FUNCTION test_fail_affectation_event();
      `);
    }
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T09 & T10 : Deux équipes distinctes sur deux volets du même dossier
  // --------------------------------------------------------------------------
  it("T09 & T10: Deux équipes distinctes affectées à deux volets différents d'un même dossier", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);

    // Volet 1 (Plastique) -> Affecté à Équipe Plastique Dakar-Plateau
    const aff1 = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        motif: 'Mission Plastique Plateau',
      },
    });
    expect(aff1.statusCode).toBe(201);
    const idAff1 = aff1.json().idAffectation;

    // Volet 2 (Organique) -> Affecté à Équipe Bio-Déchets Médina
    const aff2 = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE,
        idEquipe: TEST_EQUIPES.BIO_MEDINA.id,
        idCompetenceEquipe: TEST_EQUIPES.BIO_MEDINA.competenceOrganique,
        motif: 'Mission Curage et Bio Médina',
      },
    });
    expect(aff2.statusCode).toBe(201);
    const idAff2 = aff2.json().idAffectation;

    // Vérification : les deux affectations actives coexistent en parallèle pour le même dossier
    const db = getDb();
    const rows = await db.query(
      `SELECT id_affectation, id_type_dechet, id_equipe, etat_affectation 
       FROM affectation 
       WHERE id_dossier = $1 AND date_fin_affectation IS NULL`,
      [idDossier]
    );

    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.id_affectation)).toContain(idAff1);
    expect(rows.map((r) => r.id_affectation)).toContain(idAff2);
    expect(rows.every((r) => r.etat_affectation === EtatAffectation.ACTIVE)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T22 : Rejet de période de compétence où dateFin < dateDebut
  // --------------------------------------------------------------------------
  it("T22: Rejet de toute période de compétence où dateFin < dateDebut", async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);

    const res = await app.inject({
      method: 'POST',
      url: '/api/referentiels/competences',
      headers: admin.headers,
      payload: {
        idEquipe: TEST_EQUIPES.BIO_MEDINA.id,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        dateDebut: '2026-06-01T00:00:00Z',
        dateFin: '2026-01-01T00:00:00Z', // dateFin antérieure à dateDebut !
        commentaire: 'Compétence temporelle incohérente',
      },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error.message).toMatch(/date de fin de validité doit être postérieure ou égale/i);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T23 : Retrait d'un volet passant à RETIRE avec motif obligatoire
  // --------------------------------------------------------------------------
  it("T23: Retrait d'un volet passant à RETIRE avec historisation et interdiction de nouvelle affectation", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const idDossier = await createTestDossier(traitement.headers);

    // 1. Retrait du volet Organique avec motif explicite obligatoire
    const retraitRes = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/categories/${TEST_TYPES_DECHETS.ORGANIQUE}/retirer`,
      headers: traitement.headers,
      payload: {
        motif: 'Erreur d inventaire : aucun déchet organique sur le site lors de l inspection',
      },
    });
    expect(retraitRes.statusCode).toBe(200);
    expect(retraitRes.json().etatContenuDossier).toBe('RETIRE');

    // 2. Vérification en base : la ligne CONTENU_DOSSIER est conservée à l'état RETIRE avec traceur
    const db = getDb();
    const row = await db.queryOne<{ etat_contenu_dossier: string; motif_retrait: string }>(
      `SELECT etat_contenu_dossier, motif_retrait FROM contenu_dossier 
       WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [idDossier, TEST_TYPES_DECHETS.ORGANIQUE]
    );
    expect(row).not.toBeNull();
    expect(row!.etat_contenu_dossier).toBe('RETIRE');
    expect(row!.motif_retrait).toMatch(/Erreur d inventaire/);

    // 3. Tentative d'affecter le volet retiré -> 400 Bad Request
    const affRetire = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE,
        idEquipe: TEST_EQUIPES.BIO_MEDINA.id,
        idCompetenceEquipe: TEST_EQUIPES.BIO_MEDINA.competenceOrganique,
        motif: 'Affectation sur volet retiré interdite',
      },
    });
    expect(affRetire.statusCode).toBe(400);
    expect(affRetire.json().error.message).toMatch(/catégorie retirée/i);
  });
});
