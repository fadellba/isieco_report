import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestApp,
  cleanDatabase,
  failBusinessEventForTest,
  loginAs,
  failTableWriteForTest,
  TEST_EQUIPES,
  TEST_PERSONAS,
  TEST_TYPES_DECHETS,
} from './helpers.js';
import { StatutSignalement, StatutDossier } from '@isieco/shared';
import { getDb } from '../src/db/index.js';

describe('Jalon M3 (Tranche 2) — Qualification, Doublons & Dossier Opérationnel', () => {
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

  it('exige la réouverture avant l’ajout d’un volet à un dossier clôturé', async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier clôturé à compléter',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(created.statusCode).toBe(201);

    const idDossier = created.json().idDossier as string;
    const db = getDb();
    await db.execute(
      `UPDATE dossier_traitement
       SET statut_dossier = 'CLOS_SANS_SUITE', date_cloture = CURRENT_TIMESTAMP
       WHERE id_dossier = $1`,
      [idDossier],
    );

    const response = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/categories`,
      headers: traitement.headers,
      payload: {
        idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE,
        motifAjout: 'Nouvelle catégorie découverte après clôture.',
      },
    });

    expect(response.statusCode).toBe(409);
    const affectationResponse = await app.inject({
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
    expect(affectationResponse.statusCode).toBe(409);
    await expect(db.execute(
      'INSERT INTO contenu_dossier (id_dossier, id_type_dechet) VALUES ($1, $2)',
      [idDossier, TEST_TYPES_DECHETS.ORGANIQUE],
    )).rejects.toThrow('réouverture tracée');
    await expect(db.execute(
      `INSERT INTO affectation (
         id_dossier, id_type_dechet, id_equipe, id_competence_equipe, id_decideur
       ) VALUES ($1, $2, $3, $4, $5)`,
      [
        idDossier,
        TEST_TYPES_DECHETS.PLASTIQUE,
        TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
        affectation.user.idUtilisateur,
      ],
    )).rejects.toThrow('réouverture tracée');

    const categories = await db.query<{ id_type_dechet: string }>(
      'SELECT id_type_dechet FROM contenu_dossier WHERE id_dossier = $1',
      [idDossier],
    );
    expect(categories).toHaveLength(1);
    const assignments = await db.query<{ id_affectation: string }>(
      'SELECT id_affectation FROM affectation WHERE id_dossier = $1',
      [idDossier],
    );
    expect(assignments).toHaveLength(0);
    const events = await db.query<{ id_evenement: string }>(
      `SELECT id_evenement FROM evenement_metier
       WHERE id_dossier_contenu_cible = $1 AND type_evenement = 'VOLET_AJOUTE'`,
      [idDossier],
    );
    expect(events).toHaveLength(0);
  });

  it('repasse un dossier à qualifier lorsqu’il ne reste aucun volet inclus', async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier sans volet après correction',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(created.statusCode).toBe(201);
    const idDossier = created.json().idDossier as string;

    const removed = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/categories/${TEST_TYPES_DECHETS.PLASTIQUE}/retirer`,
      headers: traitement.headers,
      payload: { motif: 'Catégorie initiale invalidée après contrôle terrain.' },
    });
    expect(removed.statusCode).toBe(200);

    const dossier = await getDb().queryOne<{ statut_dossier: string }>(
      'SELECT statut_dossier FROM dossier_traitement WHERE id_dossier = $1',
      [idDossier],
    );
    const category = await getDb().queryOne<{ etat_contenu_dossier: string }>(
      'SELECT etat_contenu_dossier FROM contenu_dossier WHERE id_dossier = $1',
      [idDossier],
    );
    expect(dossier?.statut_dossier).toBe(StatutDossier.A_QUALIFIER);
    expect(category?.etat_contenu_dossier).toBe('RETIRE');
  });

  it('renvoie 404 si un signalement inexistant est pris en charge', async () => {
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const response = await app.inject({
      method: 'POST',
      url: '/api/qualification/signalements/00000000-0000-0000-0000-000000000000/examiner',
      headers: qualif.headers,
    });

    expect(response.statusCode).toBe(404);
    expect(response.json().error.code).toBe('NOT_FOUND');
  });

  it('n’autorise que les transitions valides et ne répète pas les effets de qualification', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Déchets plastiques près du marché',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });

    const idSignalement = created.json().idSignalement as string;

    const examen = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/examiner`,
      headers: qualif.headers,
    });
    expect(examen.statusCode).toBe(200);

    const secondExamen = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/examiner`,
      headers: qualif.headers,
    });
    expect(secondExamen.statusCode).toBe(409);

    const accepte = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Catégorie vérifiée' },
    });
    expect(accepte.statusCode).toBe(200);

    const secondeAcceptation = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Décision répétée' },
    });
    expect(secondeAcceptation.statusCode).toBe(409);

    const rejetApresAcceptation = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/rejeter`,
      headers: qualif.headers,
      payload: { motif: 'Tentative de transition contradictoire' },
    });
    expect(rejetApresAcceptation.statusCode).toBe(409);

    const db = getDb();
    const signalement = await db.queryOne<{ statut_signalement: string }>(
      'SELECT statut_signalement FROM signalement WHERE id_signalement = $1',
      [idSignalement],
    );
    const qualifications = await db.queryOne<{ count: string | number }>(
      'SELECT count(*) FROM qualification_signalement WHERE id_signalement = $1 AND etat_qualification = $2',
      [idSignalement, 'ACTIVE'],
    );
    const attributions = await db.queryOne<{ count: string | number }>(
      `SELECT count(*) FROM historique_points
       WHERE id_signalement = $1 AND type_mouvement = 'ATTRIBUTION'`,
      [idSignalement],
    );
    const decisions = await db.queryOne<{ count: string | number }>(
      `SELECT count(*) FROM evenement_metier
       WHERE id_signalement_cible = $1 AND type_evenement = 'SIGNALEMENT_ACCEPTE'`,
      [idSignalement],
    );
    expect(signalement?.statut_signalement).toBe(StatutSignalement.ACCEPTE_POUR_RATTACHEMENT);
    expect(Number(qualifications?.count)).toBe(1);
    expect(Number(attributions?.count)).toBe(1);
    expect(Number(decisions?.count)).toBe(1);
  });

  it('couvre chaque statut de signalement pour toutes les décisions de qualification', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const decisions = [
      {
        name: 'examiner',
        allowed: [StatutSignalement.SOUMIS],
        url: (id: string) => `/api/qualification/signalements/${id}/examiner`,
        payload: {},
      },
      {
        name: 'accepter',
        allowed: [StatutSignalement.SOUMIS, StatutSignalement.EN_COURS_DE_QUALIFICATION],
        url: (id: string) => `/api/qualification/signalements/${id}/qualifier`,
        payload: {},
      },
      {
        name: 'rejeter',
        allowed: [StatutSignalement.SOUMIS, StatutSignalement.EN_COURS_DE_QUALIFICATION],
        url: (id: string) => `/api/qualification/signalements/${id}/rejeter`,
        payload: { motif: 'Motif de décision assez détaillé pour ce test.' },
      },
      {
        name: 'demander un complément',
        allowed: [StatutSignalement.EN_COURS_DE_QUALIFICATION],
        url: (id: string) => `/api/qualification/signalements/${id}/complements`,
        payload: { motif: 'Informations complémentaires nécessaires pour qualifier.' },
      },
      {
        name: 'corriger une acceptation',
        allowed: [StatutSignalement.ACCEPTE_POUR_RATTACHEMENT],
        url: (id: string) => `/api/qualification/signalements/${id}/corriger-acceptation`,
        payload: { motif: 'Correction motivée après vérification du signalement.' },
      },
    ];

    for (const decision of decisions) {
      for (const statut of Object.values(StatutSignalement)) {
        const created = await app.inject({
          method: 'POST',
          url: '/api/signalements',
          headers: citoyen.headers,
          payload: {
            description: `Matrice statut ${statut}, décision ${decision.name}`,
            latitude: 14.671,
            longitude: -17.433,
            categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
          },
        });
        expect(created.statusCode, `${decision.name} / création ${statut}`).toBe(201);
        const idSignalement = created.json().idSignalement as string;
        await getDb().execute(
          'UPDATE signalement SET statut_signalement = $1 WHERE id_signalement = $2',
          [statut, idSignalement],
        );

        const response = await app.inject({
          method: 'POST',
          url: decision.url(idSignalement),
          headers: qualif.headers,
          payload: decision.payload,
        });
        const allowed = decision.allowed.includes(statut);
        expect(
          response.statusCode,
          `statut ${statut}, décision ${decision.name}: ${JSON.stringify(response.json())}`,
        ).toBe(allowed ? (decision.name === 'demander un complément' ? 201 : 200) : 409);
      }
    }
  });

  it('couvre chaque statut de signalement pour la réponse citoyenne à un complément', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);

    for (const statut of Object.values(StatutSignalement)) {
      const created = await app.inject({
        method: 'POST',
        url: '/api/signalements',
        headers: citoyen.headers,
        payload: {
          description: `Réponse au complément depuis le statut ${statut}.`,
          latitude: 14.671,
          longitude: -17.433,
          categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
        },
      });
      expect(created.statusCode).toBe(201);
      const idSignalement = created.json().idSignalement as string;
      const examination = await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${idSignalement}/examiner`,
        headers: qualif.headers,
      });
      expect(examination.statusCode).toBe(200);
      const request = await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${idSignalement}/complements`,
        headers: qualif.headers,
        payload: { motif: 'Un complément est requis avant la réponse citoyenne.' },
      });
      expect(request.statusCode).toBe(201);
      const demand = await getDb().queryOne<{ id_demande: string }>(
        'SELECT id_demande FROM demande_complement WHERE id_signalement = $1',
        [idSignalement],
      );
      await getDb().execute(
        'UPDATE signalement SET statut_signalement = $1 WHERE id_signalement = $2',
        [statut, idSignalement],
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/signalements/${idSignalement}/complements/${demand!.id_demande}/reponse`,
        headers: citoyen.headers,
        payload: { contenu: 'Réponse complète au complément demandé.' },
      });
      expect(
        response.statusCode,
        `réponse au complément depuis ${statut}: ${JSON.stringify(response.json())}`,
      ).toBe(statut === StatutSignalement.A_COMPLETER ? 200 : 409);
    }
  });

  it('annule toute l’acceptation si la notification échoue après décision, qualification, événement et points', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Signalement utilisé pour le rollback intégral de qualification.',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(created.statusCode).toBe(201);
    const idSignalement = created.json().idSignalement as string;
    const removeFailure = await failTableWriteForTest('notification');

    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${idSignalement}/qualifier`,
        headers: qualif.headers,
        payload: { motif: 'Acceptation dont la notification échouera.' },
      });
      expect(response.statusCode).toBe(500);

      const state = await getDb().queryOne<{
        statut_signalement: string;
        qualifications: string;
        attributions: string;
        decisions: string;
        notifications: string;
      }>(
        `SELECT
           s.statut_signalement,
           (SELECT COUNT(*)::text FROM qualification_signalement q
            WHERE q.id_signalement = s.id_signalement) AS qualifications,
           (SELECT COUNT(*)::text FROM historique_points h
            WHERE h.id_signalement = s.id_signalement) AS attributions,
           (SELECT COUNT(*)::text FROM evenement_metier e
            WHERE e.id_signalement_cible = s.id_signalement
              AND e.type_evenement = 'SIGNALEMENT_ACCEPTE') AS decisions,
           (SELECT COUNT(*)::text FROM notification n
            WHERE n.id_utilisateur = s.id_utilisateur
              AND n.titre = 'Signalement accepté (+10 points)') AS notifications
         FROM signalement s
         WHERE s.id_signalement = $1`,
        [idSignalement],
      );
      expect(state).toEqual({
        statut_signalement: StatutSignalement.SOUMIS,
        qualifications: '0',
        attributions: '0',
        decisions: '0',
        notifications: '0',
      });
    } finally {
      await removeFailure();
    }
  });

  it('annule chaque autre transaction de qualification aux dernières écritures', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const createReport = async (description: string) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/signalements',
        headers: citoyen.headers,
        payload: {
          description,
          latitude: 14.671,
          longitude: -17.433,
          categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
        },
      });
      expect(response.statusCode).toBe(201);
      return response.json().idSignalement as string;
    };

    const examinationId = await createReport('Rollback de la prise en charge de qualification.');
    const removeExaminationFailure = await failBusinessEventForTest('SIGNALEMENT_EN_QUALIFICATION');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${examinationId}/examiner`,
        headers: qualif.headers,
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeExaminationFailure();
    }
    const examinationState = await getDb().queryOne<{ statut_signalement: string }>(
      'SELECT statut_signalement FROM signalement WHERE id_signalement = $1',
      [examinationId],
    );
    expect(examinationState?.statut_signalement).toBe(StatutSignalement.SOUMIS);

    const rejectionId = await createReport('Rollback du rejet de qualification.');
    const removeRejectionFailure = await failTableWriteForTest('notification');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${rejectionId}/rejeter`,
        headers: qualif.headers,
        payload: { motif: 'Rejet avec motif pour injecter une panne tardive.' },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeRejectionFailure();
    }
    const rejectionState = await getDb().queryOne<{
      statut_signalement: string;
      events: string;
    }>(
      `SELECT
         statut_signalement,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_signalement_cible = $1 AND type_evenement = 'SIGNALEMENT_REJETE') AS events
       FROM signalement WHERE id_signalement = $1`,
      [rejectionId],
    );
    expect(rejectionState).toEqual({ statut_signalement: StatutSignalement.SOUMIS, events: '0' });

    const correctionId = await createReport('Rollback de la correction d’une acceptation.');
    const accepted = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${correctionId}/qualifier`,
      headers: qualif.headers,
      payload: {},
    });
    expect(accepted.statusCode).toBe(200);
    const removeCorrectionFailure = await failTableWriteForTest('notification');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${correctionId}/corriger-acceptation`,
        headers: qualif.headers,
        payload: { motif: 'Correction dont la notification doit échouer.' },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeCorrectionFailure();
    }
    const correctionState = await getDb().queryOne<{
      statut_signalement: string;
      attributions: string;
      compensations: string;
      corrections: string;
    }>(
      `SELECT
         s.statut_signalement,
         (SELECT COUNT(*)::text FROM historique_points
          WHERE id_signalement = s.id_signalement AND type_mouvement = 'ATTRIBUTION') AS attributions,
         (SELECT COUNT(*)::text FROM historique_points
          WHERE id_signalement = s.id_signalement AND type_mouvement = 'COMPENSATION') AS compensations,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_signalement_cible = s.id_signalement
            AND type_evenement = 'SIGNALEMENT_ACCEPTATION_CORRIGEE') AS corrections
       FROM signalement s WHERE s.id_signalement = $1`,
      [correctionId],
    );
    expect(correctionState).toEqual({
      statut_signalement: StatutSignalement.ACCEPTE_POUR_RATTACHEMENT,
      attributions: '1',
      compensations: '0',
      corrections: '0',
    });

    const complementId = await createReport('Rollback de la demande de complément.');
    const started = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${complementId}/examiner`,
      headers: qualif.headers,
    });
    expect(started.statusCode).toBe(200);
    const removeComplementFailure = await failTableWriteForTest('notification');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${complementId}/complements`,
        headers: qualif.headers,
        payload: { motif: 'Précision manquante à demander au déclarant.' },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeComplementFailure();
    }
    const complementState = await getDb().queryOne<{
      statut_signalement: string;
      demands: string;
      events: string;
    }>(
      `SELECT
         s.statut_signalement,
         (SELECT COUNT(*)::text FROM demande_complement
          WHERE id_signalement = s.id_signalement) AS demands,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_signalement_cible = s.id_signalement
            AND type_evenement = 'COMPLEMENT_DEMANDE') AS events
       FROM signalement s WHERE s.id_signalement = $1`,
      [complementId],
    );
    expect(complementState).toEqual({
      statut_signalement: StatutSignalement.EN_COURS_DE_QUALIFICATION,
      demands: '0',
      events: '0',
    });

    const responseId = await createReport('Rollback de la réponse au complément.');
    const responseExamination = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${responseId}/examiner`,
      headers: qualif.headers,
    });
    expect(responseExamination.statusCode).toBe(200);
    const requested = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${responseId}/complements`,
      headers: qualif.headers,
      payload: { motif: 'Complément demandé avant le test de réponse.' },
    });
    expect(requested.statusCode).toBe(201);
    const demand = await getDb().queryOne<{ id_demande: string }>(
      'SELECT id_demande FROM demande_complement WHERE id_signalement = $1',
      [responseId],
    );
    const removeResponseFailure = await failTableWriteForTest('notification');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/signalements/${responseId}/complements/${demand!.id_demande}/reponse`,
        headers: citoyen.headers,
        payload: { contenu: 'Voici la précision demandée par le service.' },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeResponseFailure();
    }
    const responseState = await getDb().queryOne<{
      statut_signalement: string;
      demand_state: string;
      responses: string;
      events: string;
    }>(
      `SELECT
         s.statut_signalement,
         d.etat_demande AS demand_state,
         (SELECT COUNT(*)::text FROM reponse_complement
          WHERE id_demande = d.id_demande) AS responses,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_signalement_cible = s.id_signalement
            AND type_evenement = 'COMPLEMENT_REPONSE') AS events
       FROM signalement s
       JOIN demande_complement d ON d.id_signalement = s.id_signalement
       WHERE s.id_signalement = $1`,
      [responseId],
    );
    expect(responseState).toEqual({
      statut_signalement: StatutSignalement.A_COMPLETER,
      demand_state: 'EN_ATTENTE',
      responses: '0',
      events: '0',
    });
  });

  it('annule la création, la priorité et la localisation si un écrit transactionnel échoue', async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const removeCreateFailure = await failTableWriteForTest('historique_priorite_dossier');
    try {
      const failedCreate = await app.inject({
        method: 'POST',
        url: '/api/dossiers',
        headers: traitement.headers,
        payload: {
          descriptionSynthese: 'Dossier dont la création transactionnelle échouera.',
          latitude: 14.671,
          longitude: -17.433,
          categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
        },
      });
      expect(failedCreate.statusCode).toBe(500);
    } finally {
      await removeCreateFailure();
    }
    const failedCreateCounts = await getDb().queryOne<{
      dossiers: string;
      categories: string;
      created_events: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM dossier_traitement
          WHERE description_synthese = 'Dossier dont la création transactionnelle échouera.') AS dossiers,
         (SELECT COUNT(*)::text FROM contenu_dossier c
          JOIN dossier_traitement d ON d.id_dossier = c.id_dossier
          WHERE d.description_synthese = 'Dossier dont la création transactionnelle échouera.') AS categories,
         (SELECT COUNT(*)::text FROM evenement_metier e
          JOIN dossier_traitement d ON d.id_dossier = e.id_dossier_cible
          WHERE d.description_synthese = 'Dossier dont la création transactionnelle échouera.'
            AND e.type_evenement = 'DOSSIER_CREE') AS created_events`,
    );
    expect(failedCreateCounts).toEqual({
      dossiers: '0',
      categories: '0',
      created_events: '0',
    });

    const created = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier utilisé pour les corrections transactionnelles.',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(created.statusCode).toBe(201);
    const idDossier = created.json().idDossier as string;

    const removePriorityFailure = await failBusinessEventForTest('DOSSIER_PRIORITE_MODIFIEE');
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/dossiers/${idDossier}/priorite`,
        headers: traitement.headers,
        payload: {
          priorite: 'ELEVEE',
          justification: 'Justification de test pour le rollback de priorité.',
        },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removePriorityFailure();
    }
    const priorityState = await getDb().queryOne<{
      priorite: string;
      history: string;
      changes: string;
    }>(
      `SELECT
         priorite,
         (SELECT COUNT(*)::text FROM historique_priorite_dossier
          WHERE id_dossier = $1) AS history,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_dossier_cible = $1
            AND type_evenement = 'DOSSIER_PRIORITE_MODIFIEE') AS changes
       FROM dossier_traitement WHERE id_dossier = $1`,
      [idDossier],
    );
    expect(priorityState).toEqual({ priorite: 'MOYENNE', history: '1', changes: '0' });

    const removeLocationFailure = await failBusinessEventForTest('DOSSIER_LOCALISATION_MODIFIEE');
    try {
      const response = await app.inject({
        method: 'PATCH',
        url: `/api/dossiers/${idDossier}/localisation`,
        headers: traitement.headers,
        payload: {
          latitude: 14.672,
          longitude: -17.434,
          descriptionLocalisation: 'Localisation corrigée pour le test.',
          motif: 'Correction motivée pour vérifier le rollback complet.',
        },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeLocationFailure();
    }
    const locationState = await getDb().queryOne<{
      latitude: string;
      longitude: string;
      description_localisation: string | null;
      history: string;
      changes: string;
    }>(
      `SELECT
         latitude::text,
         longitude::text,
         description_localisation,
         (SELECT COUNT(*)::text FROM historique_localisation_dossier
          WHERE id_dossier = $1) AS history,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_dossier_cible = $1
            AND type_evenement = 'DOSSIER_LOCALISATION_MODIFIEE') AS changes
       FROM dossier_traitement WHERE id_dossier = $1`,
      [idDossier],
    );
    expect(locationState).toMatchObject({
      latitude: '14.6710000',
      longitude: '-17.4330000',
      history: '1',
      changes: '0',
    });
  });

  it('annule ajout, retrait, rattachement et correction de rattachement après une panne de traçabilité', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const createReport = async (description: string) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/signalements',
        headers: citoyen.headers,
        payload: {
          description,
          latitude: 14.671,
          longitude: -17.433,
          categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
        },
      });
      expect(response.statusCode).toBe(201);
      const idSignalement = response.json().idSignalement as string;
      const accepted = await app.inject({
        method: 'POST',
        url: `/api/qualification/signalements/${idSignalement}/qualifier`,
        headers: qualif.headers,
        payload: {},
      });
      expect(accepted.statusCode).toBe(200);
      return idSignalement;
    };
    const createDossier = async (descriptionSynthese: string) => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/dossiers',
        headers: traitement.headers,
        payload: {
          descriptionSynthese,
          latitude: 14.671,
          longitude: -17.433,
          categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
        },
      });
      expect(response.statusCode).toBe(201);
      return response.json().idDossier as string;
    };

    const dossierId = await createDossier('Dossier pour matrice ajout et retrait.');
    const removeAddFailure = await failBusinessEventForTest('VOLET_AJOUTE');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/dossiers/${dossierId}/categories`,
        headers: traitement.headers,
        payload: {
          idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE,
          motifAjout: 'Ajout du volet pour test transactionnel.',
        },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeAddFailure();
    }
    const addedCategoryCount = await getDb().queryOne<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM contenu_dossier
       WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [dossierId, TEST_TYPES_DECHETS.ORGANIQUE],
    );
    expect(addedCategoryCount?.count).toBe('0');

    const removeRetireFailure = await failBusinessEventForTest('VOLET_RETIRE');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/dossiers/${dossierId}/categories/${TEST_TYPES_DECHETS.PLASTIQUE}/retirer`,
        headers: traitement.headers,
        payload: { motif: 'Retrait dont la trace transactionnelle échouera.' },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeRetireFailure();
    }
    const retainedCategory = await getDb().queryOne<{
      etat_contenu_dossier: string;
      date_retrait: Date | null;
    }>(
      `SELECT etat_contenu_dossier, date_retrait FROM contenu_dossier
       WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [dossierId, TEST_TYPES_DECHETS.PLASTIQUE],
    );
    expect(retainedCategory).toMatchObject({
      etat_contenu_dossier: 'INCLUSE',
      date_retrait: null,
    });

    const attachReportId = await createReport('Signalement pour rattachement en échec.');
    const attachDossierId = await createDossier('Dossier pour rattachement en échec.');
    const removeAttachFailure = await failBusinessEventForTest('SIGNALEMENT_RATTACHE');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/dossiers/${attachDossierId}/rattacher`,
        headers: traitement.headers,
        payload: { idSignalement: attachReportId },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeAttachFailure();
    }
    const failedAttachment = await getDb().queryOne<{
      statut_signalement: string;
      active_links: string;
      active_provenance: string;
    }>(
      `SELECT
         s.statut_signalement,
         (SELECT COUNT(*)::text FROM rattachement_signalement
          WHERE id_signalement = s.id_signalement AND date_fin_rattachement IS NULL) AS active_links,
         (SELECT COUNT(*)::text FROM provenance_contenu_dossier
          WHERE id_signalement = s.id_signalement AND date_fin IS NULL) AS active_provenance
       FROM signalement s WHERE s.id_signalement = $1`,
      [attachReportId],
    );
    expect(failedAttachment).toEqual({
      statut_signalement: StatutSignalement.ACCEPTE_POUR_RATTACHEMENT,
      active_links: '0',
      active_provenance: '0',
    });

    const correctionReportId = await createReport('Signalement pour correction de rattachement.');
    const oldDossierId = await createDossier('Dossier initial de correction de lien.');
    const newDossierId = await createDossier('Dossier cible de correction de lien.');
    const attached = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${oldDossierId}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement: correctionReportId },
    });
    expect(attached.statusCode).toBe(200);

    const removeCorrectionFailure = await failBusinessEventForTest('SIGNALEMENT_DERATTACHE');
    try {
      const response = await app.inject({
        method: 'POST',
        url: `/api/dossiers/${oldDossierId}/corriger-rattachement`,
        headers: traitement.headers,
        payload: {
          idSignalement: correctionReportId,
          nouveauIdDossier: newDossierId,
          motif: 'Correction du lien dont la trace échouera.',
        },
      });
      expect(response.statusCode).toBe(500);
    } finally {
      await removeCorrectionFailure();
    }
    const correctionState = await getDb().queryOne<{
      active_old_links: string;
      ended_old_links: string;
      active_new_links: string;
      detached_events: string;
      statut_signalement: string;
    }>(
      `SELECT
         (SELECT COUNT(*)::text FROM rattachement_signalement
          WHERE id_signalement = $1 AND id_dossier = $2
            AND date_fin_rattachement IS NULL) AS active_old_links,
         (SELECT COUNT(*)::text FROM rattachement_signalement
          WHERE id_signalement = $1 AND id_dossier = $2
            AND date_fin_rattachement IS NOT NULL) AS ended_old_links,
         (SELECT COUNT(*)::text FROM rattachement_signalement
          WHERE id_signalement = $1 AND id_dossier = $3
            AND date_fin_rattachement IS NULL) AS active_new_links,
         (SELECT COUNT(*)::text FROM evenement_metier
          WHERE id_rattachement_cible IN (
            SELECT id_rattachement FROM rattachement_signalement
            WHERE id_signalement = $1
          ) AND type_evenement = 'SIGNALEMENT_DERATTACHE') AS detached_events,
         statut_signalement
       FROM signalement WHERE id_signalement = $1`,
      [correctionReportId, oldDossierId, newDossierId],
    );
    expect(correctionState).toEqual({
      active_old_links: '1',
      ended_old_links: '0',
      active_new_links: '0',
      detached_events: '0',
      statut_signalement: StatutSignalement.RATTACHE,
    });
  });

  it('refuse le rejet répété et toute acceptation après rejet', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Déchets plastiques près du marché',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSignalement = created.json().idSignalement as string;

    const rejete = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/rejeter`,
      headers: qualif.headers,
      payload: { motif: 'Dépôt situé hors périmètre de prise en charge' },
    });
    expect(rejete.statusCode).toBe(200);

    const secondRejet = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/rejeter`,
      headers: qualif.headers,
      payload: { motif: 'Nouvelle tentative de rejet non autorisée' },
    });
    expect(secondRejet.statusCode).toBe(409);

    const acceptationApresRejet = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Tentative après rejet' },
    });
    expect(acceptationApresRejet.statusCode).toBe(409);

    const db = getDb();
    const signalement = await db.queryOne<{ statut_signalement: string }>(
      'SELECT statut_signalement FROM signalement WHERE id_signalement = $1',
      [idSignalement],
    );
    const attributions = await db.queryOne<{ count: string | number }>(
      `SELECT count(*) FROM historique_points
       WHERE id_signalement = $1 AND type_mouvement = 'ATTRIBUTION'`,
      [idSignalement],
    );
    expect(signalement?.statut_signalement).toBe(StatutSignalement.REJETE);
    expect(Number(attributions?.count)).toBe(0);
  });

  it('corrige une acceptation avant rattachement avec une compensation de points immuable', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Déchets plastiques près du marché',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSignalement = created.json().idSignalement as string;
    const accepted = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Signalement initialement recevable' },
    });
    expect(accepted.statusCode).toBe(200);

    const corrected = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/corriger-acceptation`,
      headers: qualif.headers,
      payload: { motif: 'Contrôle final : dépôt situé hors périmètre' },
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json().statut).toBe(StatutSignalement.REJETE);

    const repeatedCorrection = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/corriger-acceptation`,
      headers: qualif.headers,
      payload: { motif: 'Nouvelle tentative de correction' },
    });
    expect(repeatedCorrection.statusCode).toBe(409);

    const db = getDb();
    const movements = await db.query<{
      points: number;
      type_mouvement: string;
      id_point_origine: string | null;
      id_point: string;
    }>(
      `SELECT points, type_mouvement, id_point_origine, id_point
       FROM historique_points
       WHERE id_signalement = $1
       ORDER BY date_attribution ASC`,
      [idSignalement],
    );
    expect(movements).toHaveLength(2);
    expect(movements.map((movement) => movement.type_mouvement)).toEqual(['ATTRIBUTION', 'COMPENSATION']);
    expect(movements[0].points).toBe(10);
    expect(movements[1].points).toBe(-10);
    expect(movements[1].id_point_origine).toBe(movements[0].id_point);
  });

  it('refuse de rattacher un signalement avant son acceptation', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Déchets plastiques près du marché',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSignalement = created.json().idSignalement as string;
    const dossier = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier pour test de rattachement',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idDossier = dossier.json().idDossier as string;

    const rattachement = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement },
    });

    expect(rattachement.statusCode).toBe(409);
    const db = getDb();
    const signalement = await db.queryOne<{ statut_signalement: string }>(
      'SELECT statut_signalement FROM signalement WHERE id_signalement = $1',
      [idSignalement],
    );
    const liens = await db.queryOne<{ count: string | number }>(
      'SELECT count(*) FROM rattachement_signalement WHERE id_signalement = $1',
      [idSignalement],
    );
    expect(signalement?.statut_signalement).toBe(StatutSignalement.SOUMIS);
    expect(Number(liens?.count)).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T03 : Rapprochement de deux signalements d'un même dépôt
  // --------------------------------------------------------------------------
  it("T03: Deux signalements d'un même dépôt rattachés à un dossier commun sans suppression des auteurs", async () => {
    const citoyen1 = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const citoyen2 = await loginAs(app, TEST_PERSONAS.CITOYEN_2.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);

    // 1. Deux citoyens distincts signalent le même dépôt (coordonnées proches Dakar-Plateau)
    const sig1 = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen1.headers,
      payload: {
        description: 'Amas d ordures plastiques près du marché Kermel',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSig1 = sig1.json().idSignalement;

    const sig2 = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen2.headers,
      payload: {
        description: 'Gros tas de plastiques bloquant le caniveau Kermel',
        latitude: 14.6712,
        longitude: -17.4331,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSig2 = sig2.json().idSignalement;

    // 2. Détection de doublons par l'agent de qualification (UC03)
    const doublonsRes = await app.inject({
      method: 'GET',
      url: `/api/qualification/doublons-candidats/${idSig2}`,
      headers: qualif.headers,
    });
    expect(doublonsRes.statusCode).toBe(200);
    const doublons = doublonsRes.json();
    expect(doublons.count).toBeGreaterThanOrEqual(1);
    expect(doublons.candidates.some((d: any) => d.idSignalement === idSig1)).toBe(true);

    // 3. Qualification des deux signalements
    await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSig1}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Signalement initial valide' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSig2}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Doublon confirmé sur le même dépôt' },
    });

    // 4. Création d'un unique dossier commun par le responsable de traitement
    const dossierRes = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier Kermel - Déblaiement plastique',
        latitude: 14.6711,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(dossierRes.statusCode).toBe(201);
    const idDossier = dossierRes.json().idDossier;

    // 5. Rattachement des deux signalements au dossier commun
    const ratt1 = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement: idSig1, typeRattachement: 'PRINCIPAL' },
    });
    expect(ratt1.statusCode).toBe(200);

    const ratt2 = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/rattacher`,
      headers: traitement.headers,
      payload: {
        idSignalement: idSig2,
        typeRattachement: 'DOUBLON_CONFIRME',
        motif: 'Même dépôt confirmé par rapprochement terrain',
      },
    });
    expect(ratt2.statusCode).toBe(200);

    // 6. Vérification en base : les deux signalements conservent leurs auteurs originaux intacts
    const db = getDb();
    const rows = await db.query(
      `SELECT s.id_signalement, s.id_utilisateur, s.statut_signalement, rs.type_rattachement
       FROM signalement s
       JOIN rattachement_signalement rs ON s.id_signalement = rs.id_signalement
       WHERE rs.id_dossier = $1`,
      [idDossier]
    );

    expect(rows.length).toBe(2);
    expect(rows.map((r) => r.id_utilisateur)).toContain(TEST_PERSONAS.CITOYEN.id);
    expect(rows.map((r) => r.id_utilisateur)).toContain(TEST_PERSONAS.CITOYEN_2.id);
    expect(rows.every((r) => r.statut_signalement === StatutSignalement.RATTACHE)).toBe(true);

    const provenances = await db.query(
      `SELECT p.id_signalement, p.id_type_dechet, p.id_rattachement, p.ajoute_par,
              p.date_fin, q.qualifie_par
       FROM provenance_contenu_dossier p
       JOIN qualification_signalement q ON q.id_qualification = p.id_qualification
       WHERE p.id_dossier = $1`,
      [idDossier],
    );
    expect(provenances).toHaveLength(2);
    expect(provenances.map((provenance) => provenance.id_signalement)).toEqual(
      expect.arrayContaining([idSig1, idSig2]),
    );
    expect(provenances.every((provenance) => provenance.date_fin === null)).toBe(true);
    expect(provenances.every((provenance) => provenance.qualifie_par === TEST_PERSONAS.QUALIFICATION.id)).toBe(true);
    const pointsDuDoublon = await db.query<{ points: number; type_mouvement: string; id_point_origine: string | null }>(
      `SELECT hp.points, hp.type_mouvement, hp.id_point_origine
       FROM historique_points hp
       WHERE hp.id_signalement = $1
       ORDER BY hp.date_attribution ASC`,
      [idSig2],
    );
    expect(pointsDuDoublon.map((movement) => movement.points)).toEqual([10, -10]);
    expect(pointsDuDoublon.map((movement) => movement.type_mouvement)).toEqual(['ATTRIBUTION', 'COMPENSATION']);
    expect(pointsDuDoublon[1].id_point_origine).not.toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T04 : Machine d'état et correction sans suppression
  // --------------------------------------------------------------------------
  it("T04: Transition d'état rigoureuse et correction de rattachement avec conservation d'historique", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);

    // 1. Signalement créé (statut initial: SOUMIS)
    const sig = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Gravats de démolition Médina rue 6',
        latitude: 14.685,
        longitude: -17.442,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.GRAVATS }],
      },
    });
    const idSig = sig.json().idSignalement;
    expect(sig.json().statut).toBe(StatutSignalement.SOUMIS);

    // 2. Passage à ACCEPTE_POUR_RATTACHEMENT lors de la qualification
    const qualifRes = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSig}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Examen favorable' },
    });
    expect(qualifRes.json().statut).toBe(StatutSignalement.ACCEPTE_POUR_RATTACHEMENT);

    // 3. Création de deux dossiers
    const dos1 = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier 1 - Médina rue 6',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.GRAVATS }],
      },
    });
    const idDos1 = dos1.json().idDossier;

    const dos2 = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier 2 - Médina rue 8 (Cible rectifiée)',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.GRAVATS }],
      },
    });
    const idDos2 = dos2.json().idDossier;

    // 4. Rattachement initial au Dossier 1 -> Statut passe à RATTACHE
    await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos1}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement: idSig },
    });

    // 5. Correction du rattachement : transfert vers Dossier 2 avec motif obligatoire
    const corrigerRes = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos1}/corriger-rattachement`,
      headers: traitement.headers,
      payload: {
        idSignalement: idSig,
        nouveauIdDossier: idDos2,
        motif: 'Erreur d orientation initiale, le dépôt se situe au niveau de la rue 8',
      },
    });
    expect(corrigerRes.statusCode).toBe(200);

    // 6. Règle T04 : Conservation de l'historique sans suppression physique
    const db = getDb();
    const rattachements = await db.query(
      `SELECT id_rattachement, id_dossier, date_debut_rattachement, date_fin_rattachement, motif
       FROM rattachement_signalement
       WHERE id_signalement = $1
       ORDER BY date_debut_rattachement ASC`,
      [idSig]
    );

    // Deux enregistrements doivent être présents dans la table
    expect(rattachements.length).toBe(2);
    // Le premier rattachement est archivé (date_fin NOT NULL)
    expect(rattachements[0].id_dossier).toBe(idDos1);
    expect(rattachements[0].date_fin_rattachement).not.toBeNull();
    // Le second rattachement est actif (date_fin IS NULL)
    expect(rattachements[1].id_dossier).toBe(idDos2);
    expect(rattachements[1].date_fin_rattachement).toBeNull();

    const provenances = await db.query(
      `SELECT id_dossier, date_fin
       FROM provenance_contenu_dossier
       WHERE id_signalement = $1
       ORDER BY date_debut ASC`,
      [idSig],
    );
    expect(provenances).toHaveLength(2);
    expect(provenances[0].id_dossier).toBe(idDos1);
    expect(provenances[0].date_fin).not.toBeNull();
    expect(provenances[1].id_dossier).toBe(idDos2);
    expect(provenances[1].date_fin).toBeNull();
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T26 : Multi-catégories et unicité CONTENU_DOSSIER
  // --------------------------------------------------------------------------
  it("T26: Signalement multi-catégories rapproché d'un signalement partiel : unicité stricte CONTENU_DOSSIER", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);

    // Création d'un dossier avec Plastique et Gravats
    const dos = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier Multi-Types Boulevard de la République',
        priorite: 'FAIBLE',
        categories: [
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE, quantiteEstimee: '1 tonne' },
          { idTypeDechet: TEST_TYPES_DECHETS.GRAVATS, volumeEstime: '5 m3' },
        ],
      },
    });
    const idDos = dos.json().idDossier;

    // Signalement 1 contenant Plastique, Gravats et Métaux (3 types)
    const sig1 = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt mixte complexe',
        latitude: 14.675,
        longitude: -17.435,
        categories: [
          { idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE },
          { idTypeDechet: TEST_TYPES_DECHETS.GRAVATS },
          { idTypeDechet: TEST_TYPES_DECHETS.METAUX },
        ],
      },
    });
    const idSig1 = sig1.json().idSignalement;

    const qualification = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSig1}/qualifier`,
      headers: qualif.headers,
      payload: { motif: 'Catégories déclarées vérifiées' },
    });
    expect(qualification.statusCode).toBe(200);

    // Rapprochement du signalement au dossier
    const rattachement = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos}/rattacher`,
      headers: traitement.headers,
      payload: { idSignalement: idSig1 },
    });
    expect(rattachement.statusCode).toBe(200);

    const db = getDb();
    const inheritedLocation = await db.queryOne<{ latitude: number; longitude: number; priorite: string }>(
      `SELECT latitude, longitude, priorite FROM dossier_traitement WHERE id_dossier = $1`,
      [idDos]
    );
    expect(Number(inheritedLocation!.latitude)).toBeCloseTo(14.675);
    expect(Number(inheritedLocation!.longitude)).toBeCloseTo(-17.435);
    expect(inheritedLocation!.priorite).toBe('FAIBLE');

    // Ajout explicite du volet Métaux dans le dossier
    const missingReason = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos}/categories`,
      headers: traitement.headers,
      payload: {
        idTypeDechet: TEST_TYPES_DECHETS.METAUX,
        quantiteEstimee: '300 kg',
      },
    });
    expect(missingReason.statusCode).toBe(400);

    const addVolet = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos}/categories`,
      headers: traitement.headers,
      payload: {
        idTypeDechet: TEST_TYPES_DECHETS.METAUX,
        motifAjout: 'Nouvelle catégorie constatée lors du rapprochement du dossier.',
        quantiteEstimee: '300 kg',
      },
    });
    expect(addVolet.statusCode).toBe(201);
    const addedCategory = await db.queryOne<{ origine_ajout: string; motif_ajout: string }>(
      `SELECT origine_ajout, motif_ajout FROM contenu_dossier
       WHERE id_dossier = $1 AND id_type_dechet = $2`,
      [idDos, TEST_TYPES_DECHETS.METAUX],
    );
    expect(addedCategory?.origine_ajout).toBe('AJOUT_MANUEL');
    expect(addedCategory?.motif_ajout).toContain('catégorie constatée');

    // Tentative d'ajouter à nouveau la même catégorie Plastique -> 400 Bad Request
    const duplicateVolet = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDos}/categories`,
      headers: traitement.headers,
      payload: {
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
      },
    });
    expect(duplicateVolet.statusCode).toBe(400);

    // Vérification de l'unicité stricte des catégories dans CONTENU_DOSSIER
    const categoriesDossier = await db.query(
      `SELECT id_type_dechet, etat_contenu_dossier FROM contenu_dossier WHERE id_dossier = $1`,
      [idDos]
    );

    expect(categoriesDossier.length).toBe(3); // Plastique, Gravats, Métaux (exactement 1 ligne par couple)
    const ids = categoriesDossier.map((c) => c.id_type_dechet);
    expect(new Set(ids).size).toBe(3);
  });

  it("T43: La priorité du dossier respecte les valeurs canoniques partagées et SQL", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const valide = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier priorité faible',
        priorite: 'FAIBLE',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(valide.statusCode).toBe(201);

    const legacyValue = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier priorité obsolète',
        priorite: 'BASSE',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(legacyValue.statusCode).toBe(400);
  });

  it('historise les changements de priorité et de localisation avec contrôle d’accès', async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier avec historique géographique',
        priorite: 'MOYENNE',
        latitude: 14.671,
        longitude: -17.433,
        descriptionLocalisation: 'Marché de Dakar',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    expect(created.statusCode).toBe(201);
    const dossierId = created.json().idDossier as string;

    const initialDetails = await app.inject({
      method: 'GET',
      url: `/api/dossiers/${dossierId}`,
      headers: traitement.headers,
    });
    expect(initialDetails.json().data.historique_priorites).toHaveLength(1);
    expect(initialDetails.json().data.historique_localisations).toHaveLength(1);

    const forbiddenPriorityChange = await app.inject({
      method: 'PATCH',
      url: `/api/dossiers/${dossierId}/priorite`,
      headers: citoyen.headers,
      payload: { priorite: 'URGENTE', justification: 'Risque accru confirmé' },
    });
    expect(forbiddenPriorityChange.statusCode).toBe(403);

    const invalidPriorityChange = await app.inject({
      method: 'PATCH',
      url: `/api/dossiers/${dossierId}/priorite`,
      headers: traitement.headers,
      payload: { priorite: 'URGENTE', justification: 'urgent' },
    });
    expect(invalidPriorityChange.statusCode).toBe(400);

    const priorityChange = await app.inject({
      method: 'PATCH',
      url: `/api/dossiers/${dossierId}/priorite`,
      headers: traitement.headers,
      payload: { priorite: 'URGENTE', justification: 'Risque accru confirmé sur site' },
    });
    expect(priorityChange.statusCode).toBe(200);
    expect(priorityChange.json().changed).toBe(true);

    const repeatedPriority = await app.inject({
      method: 'PATCH',
      url: `/api/dossiers/${dossierId}/priorite`,
      headers: traitement.headers,
      payload: { priorite: 'URGENTE', justification: 'Même niveau maintenu' },
    });
    expect(repeatedPriority.statusCode).toBe(200);
    expect(repeatedPriority.json().changed).toBe(false);

    const invalidLocation = await app.inject({
      method: 'PATCH',
      url: `/api/dossiers/${dossierId}/localisation`,
      headers: affectation.headers,
      payload: {
        latitude: 91,
        longitude: -17.433,
        descriptionLocalisation: 'Site corrigé',
        motif: 'Coordonnées vérifiées sur le terrain',
      },
    });
    expect(invalidLocation.statusCode).toBe(400);

    const incompleteCoordinates = await app.inject({
      method: 'PATCH',
      url: `/api/dossiers/${dossierId}/localisation`,
      headers: affectation.headers,
      payload: {
        latitude: null,
        longitude: -17.434,
        descriptionLocalisation: 'Site corrigé',
        motif: 'Coordonnées vérifiées sur le terrain',
      },
    });
    expect(incompleteCoordinates.statusCode).toBe(400);

    const emptyLocation = await app.inject({
      method: 'PATCH',
      url: `/api/dossiers/${dossierId}/localisation`,
      headers: affectation.headers,
      payload: {
        latitude: null,
        longitude: null,
        descriptionLocalisation: null,
        motif: 'Suppression de localisation demandée',
      },
    });
    expect(emptyLocation.statusCode).toBe(400);

    const locationChange = await app.inject({
      method: 'PATCH',
      url: `/api/dossiers/${dossierId}/localisation`,
      headers: affectation.headers,
      payload: {
        latitude: 14.672,
        longitude: -17.434,
        descriptionLocalisation: 'Entrée nord du marché',
        motif: 'Coordonnées vérifiées sur le terrain',
      },
    });
    expect(locationChange.statusCode).toBe(200);
    expect(locationChange.json().changed).toBe(true);

    const updatedDetails = await app.inject({
      method: 'GET',
      url: `/api/dossiers/${dossierId}`,
      headers: traitement.headers,
    });
    expect(updatedDetails.json().data).toMatchObject({
      priorite: 'URGENTE',
      latitude: 14.672,
      longitude: -17.434,
      description_localisation: 'Entrée nord du marché',
    });
    expect(updatedDetails.json().data.historique_priorites).toHaveLength(2);
    expect(updatedDetails.json().data.historique_priorites[1]).toMatchObject({
      priorite: 'URGENTE',
      justification: 'Risque accru confirmé sur site',
      definiPar: traitement.user.idUtilisateur,
    });
    expect(updatedDetails.json().data.historique_localisations).toHaveLength(2);
    expect(updatedDetails.json().data.historique_localisations[1]).toMatchObject({
      latitude: 14.672,
      longitude: -17.434,
      descriptionLocalisation: 'Entrée nord du marché',
      motif: 'Coordonnées vérifiées sur le terrain',
      modifiePar: affectation.user.idUtilisateur,
    });
  });

  it('gère une demande et une réponse append-only de complément', async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const autreCitoyen = await loginAs(app, TEST_PERSONAS.CITOYEN_2.email);
    const agent = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const created = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt de gravats devant le bâtiment',
        latitude: 14.671,
        longitude: -17.433,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.GRAVATS }],
      },
    });
    expect(created.statusCode).toBe(201);
    const idSignalement = created.json().idSignalement as string;

    const examination = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/examiner`,
      headers: agent.headers,
    });
    expect(examination.statusCode).toBe(200);

    const citizenCannotRequest = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/complements`,
      headers: citoyen.headers,
      payload: { motif: 'Veuillez préciser le repère du site concerné.' },
    });
    expect(citizenCannotRequest.statusCode).toBe(403);

    const request = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/complements`,
      headers: agent.headers,
      payload: { motif: 'Veuillez préciser le repère exact du site concerné.' },
    });
    expect(request.statusCode).toBe(201);
    expect(request.json().statut).toBe(StatutSignalement.A_COMPLETER);

    const details = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement}`,
      headers: citoyen.headers,
    });
    const idDemande = details.json().data.complements[0].idDemande as string;
    expect(details.json().data.complements).toHaveLength(1);
    expect(details.json().data.complements[0].etatDemande).toBe('EN_ATTENTE');

    const duplicateRequest = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/complements`,
      headers: agent.headers,
      payload: { motif: 'Deuxième demande avant réponse' },
    });
    expect(duplicateRequest.statusCode).toBe(409);

    const cannotAcceptPending = await app.inject({
      method: 'POST',
      url: `/api/qualification/signalements/${idSignalement}/qualifier`,
      headers: agent.headers,
      payload: { motif: 'Tentative de décision avant réponse' },
    });
    expect(cannotAcceptPending.statusCode).toBe(409);

    const forbiddenResponse = await app.inject({
      method: 'POST',
      url: `/api/signalements/${idSignalement}/complements/${idDemande}/reponse`,
      headers: autreCitoyen.headers,
      payload: { contenu: 'Le dépôt se trouve derrière la pharmacie.' },
    });
    expect(forbiddenResponse.statusCode).toBe(404);

    const response = await app.inject({
      method: 'POST',
      url: `/api/signalements/${idSignalement}/complements/${idDemande}/reponse`,
      headers: citoyen.headers,
      payload: { contenu: '  Le dépôt se trouve derrière la pharmacie.  ' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().statut).toBe(StatutSignalement.EN_COURS_DE_QUALIFICATION);

    const repeatedResponse = await app.inject({
      method: 'POST',
      url: `/api/signalements/${idSignalement}/complements/${idDemande}/reponse`,
      headers: citoyen.headers,
      payload: { contenu: 'Réponse répétée non autorisée.' },
    });
    expect(repeatedResponse.statusCode).toBe(409);

    const finalDetails = await app.inject({
      method: 'GET',
      url: `/api/signalements/${idSignalement}`,
      headers: citoyen.headers,
    });
    expect(finalDetails.json().data.complements[0]).toMatchObject({
      etatDemande: 'REPONDUE',
      reponse: { contenu: 'Le dépôt se trouve derrière la pharmacie.' },
    });
  });
});
