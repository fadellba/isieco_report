import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  cleanDatabase,
  createTestApp,
  failBusinessEventForTest,
  failTableWriteForTest,
  loginAs,
  TEST_EQUIPES,
  TEST_PERSONAS,
  TEST_TYPES_DECHETS,
} from './helpers.js';
import { getDb } from '../src/db/index.js';

describe('Référentiels et compétences d’équipe', () => {
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

  it('retourne les types actifs, équipes, membres et compétences avec les contrats attendus', async () => {
    const agent = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);

    const wasteTypes = await app.inject({
      method: 'GET',
      url: '/api/referentiels/types-dechets',
    });
    expect(wasteTypes.statusCode).toBe(200);
    expect(wasteTypes.json().count).toBeGreaterThan(0);
    expect(wasteTypes.json().data).toEqual(
      [...wasteTypes.json().data].sort((left: { libelle: string }, right: { libelle: string }) =>
        left.libelle.localeCompare(right.libelle),
      ),
    );
    expect(typeof wasteTypes.json().data[0].orientationSpecialisee).toBe('boolean');

    const teams = await app.inject({
      method: 'GET',
      url: '/api/referentiels/equipes',
      headers: agent.headers,
    });
    expect(teams.statusCode).toBe(200);
    expect(teams.json().data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
          membres: expect.arrayContaining([
            expect.objectContaining({ idUtilisateur: TEST_PERSONAS.TERRAIN.id }),
          ]),
          competences: expect.arrayContaining([
            expect.objectContaining({ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }),
          ]),
        }),
      ]),
    );

    const competences = await app.inject({
      method: 'GET',
      url: `/api/referentiels/competences?idTypeDechet=${TEST_TYPES_DECHETS.PLASTIQUE}`,
      headers: agent.headers,
    });
    expect(competences.statusCode).toBe(200);
    expect(competences.json().data).toEqual([
      expect.objectContaining({
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
      }),
    ]);
  });

  it('crée une compétence via Prisma et renvoie des erreurs explicites pour période ou références invalides', async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const dateDebut = '2099-01-01T00:00:00.000Z';
    const created = await app.inject({
      method: 'POST',
      url: '/api/referentiels/competences',
      headers: admin.headers,
      payload: {
        idEquipe: TEST_EQUIPES.BIO_MEDINA.id,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        dateDebut,
        dateFin: dateDebut,
        commentaire: 'Compétence de test',
      },
    });
    expect(created.statusCode).toBe(201);
    const idCompetenceEquipe = created.json().idCompetenceEquipe as string;

    try {
      const persisted = await getDb().queryOne<{ commentaire: string; validee_par: string }>(
        `SELECT commentaire, validee_par
         FROM competence_equipe WHERE id_competence_equipe = $1`,
        [idCompetenceEquipe],
      );
      expect(persisted).toMatchObject({
        commentaire: 'Compétence de test',
        validee_par: TEST_PERSONAS.ADMIN.id,
      });
    } finally {
      await getDb().execute(
        `DELETE FROM competence_equipe WHERE id_competence_equipe = $1`,
        [idCompetenceEquipe],
      );
    }

    const invalidPeriod = await app.inject({
      method: 'POST',
      url: '/api/referentiels/competences',
      headers: admin.headers,
      payload: {
        idEquipe: TEST_EQUIPES.BIO_MEDINA.id,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        dateDebut: '2099-06-01T00:00:00Z',
        dateFin: '2099-01-01T00:00:00Z',
      },
    });
    expect(invalidPeriod.statusCode).toBe(400);
    expect(invalidPeriod.json().error.message).toMatch(/date de fin de validité/i);

    const invalidTeam = await app.inject({
      method: 'POST',
      url: '/api/referentiels/competences',
      headers: admin.headers,
      payload: {
        idEquipe: '20000000-0000-0000-0000-000000000099',
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        dateDebut: '2099-01-01T00:00:00Z',
      },
    });
    expect(invalidTeam.statusCode).toBe(404);
    expect(invalidTeam.json().error.message).toMatch(/équipe.*introuvable/i);
  });

  it('administre les référentiels par archivage sans supprimer les données historiques', async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const citizen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const leader = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const unique = randomUUID().replaceAll('-', '').slice(0, 20).toUpperCase();

    const forbidden = await app.inject({
      method: 'POST',
      url: '/api/referentiels/equipes',
      headers: citizen.headers,
      payload: { nomEquipe: `Équipe ${unique}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const typeResponse = await app.inject({
      method: 'POST',
      url: '/api/referentiels/types-dechets',
      headers: admin.headers,
      payload: {
        codeType: `TEST_${unique}`,
        libelle: `Type de test ${unique}`,
        orientationSpecialisee: false,
      },
    });
    expect(typeResponse.statusCode).toBe(201);
    const idTypeDechet = typeResponse.json().idTypeDechet as string;

    const teamResponse = await app.inject({
      method: 'POST',
      url: '/api/referentiels/equipes',
      headers: admin.headers,
      payload: { nomEquipe: `Équipe ${unique}` },
    });
    expect(teamResponse.statusCode).toBe(201);
    const idEquipe = teamResponse.json().idEquipe as string;

    const membership = await app.inject({
      method: 'POST',
      url: `/api/referentiels/equipes/${idEquipe}/membres`,
      headers: admin.headers,
      payload: {
        idUtilisateur: TEST_PERSONAS.TERRAIN.id,
        fonction: 'CHEF_EQUIPE',
      },
    });
    expect(membership.statusCode).toBe(201);

    const dateDebut = '2026-01-02T00:00:00.000Z';
    const competence = await app.inject({
      method: 'POST',
      url: '/api/referentiels/competences',
      headers: admin.headers,
      payload: { idEquipe, idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE, dateDebut },
    });
    expect(competence.statusCode, JSON.stringify(competence.json())).toBe(201);

    const idCompetenceEquipe = competence.json().idCompetenceEquipe as string;
    const archivedCompetence = await app.inject({
      method: 'POST',
      url: `/api/referentiels/competences/${idCompetenceEquipe}/archiver`,
      headers: admin.headers,
    });
    expect(archivedCompetence.statusCode).toBe(200);

    const delegateMembershipStart = new Date(Date.now() - 60_000);
    await getDb().execute(
      `INSERT INTO appartenance_equipe (id_utilisateur, id_equipe, date_debut, fonction)
       VALUES ($1, $2, $3, 'AGENT_TERRAIN')`,
      [
        TEST_PERSONAS.CITOYEN_2.id,
        idEquipe,
        delegateMembershipStart.toISOString(),
      ],
    );
    const createdDelegation = await app.inject({
      method: 'POST',
      url: `/api/equipes/${idEquipe}/delegations`,
      headers: leader.headers,
      payload: {
        idUtilisateurDelegue: TEST_PERSONAS.CITOYEN_2.id,
        typeDecision: 'REPONSE_AFFECTATION',
      },
    });
    expect(createdDelegation.statusCode).toBe(201);
    const idDelegation = createdDelegation.json().data.id as string;

    const removeMemberArchiveFailure = await failTableWriteForTest(
      'appartenance_equipe',
    );
    try {
      const failedArchive = await app.inject({
        method: 'POST',
        url: `/api/referentiels/equipes/${idEquipe}/membres/${TEST_PERSONAS.CITOYEN_2.id}/archiver`,
        headers: admin.headers,
      });
      expect(failedArchive.statusCode).toBe(500);
    } finally {
      await removeMemberArchiveFailure();
    }
    const memberArchiveRollback = await getDb().queryOne<{
      membership_end: Date | null;
      delegation_end: Date | null;
    }>(
      `SELECT a.date_fin AS membership_end, d.date_fin AS delegation_end
       FROM appartenance_equipe a
       JOIN delegation_decision_equipe d
         ON d.id_equipe = a.id_equipe
        AND d.id_utilisateur_delegue = a.id_utilisateur
        AND d.date_debut_appartenance = a.date_debut
       WHERE a.id_utilisateur = $1 AND a.id_equipe = $2 AND d.id_delegation = $3`,
      [TEST_PERSONAS.CITOYEN_2.id, idEquipe, idDelegation],
    );
    expect(memberArchiveRollback).toEqual({
      membership_end: null,
      delegation_end: null,
    });

    const archivedMember = await app.inject({
      method: 'POST',
      url: `/api/referentiels/equipes/${idEquipe}/membres/${TEST_PERSONAS.CITOYEN_2.id}/archiver`,
      headers: admin.headers,
    });
    expect(archivedMember.statusCode).toBe(200);
    const delegationAfterMemberArchive = await getDb().queryOne<{
      date_fin: Date | null;
    }>(
      'SELECT date_fin FROM delegation_decision_equipe WHERE id_delegation = $1',
      [idDelegation],
    );
    expect(delegationAfterMemberArchive?.date_fin).not.toBeNull();

    const archivedType = await app.inject({
      method: 'POST',
      url: `/api/referentiels/types-dechets/${idTypeDechet}/archiver`,
      headers: admin.headers,
    });
    expect(archivedType.statusCode).toBe(200);

    const removeTeamArchiveFailure = await failTableWriteForTest('equipe');
    try {
      const failedArchive = await app.inject({
        method: 'POST',
        url: `/api/referentiels/equipes/${idEquipe}/archiver`,
        headers: admin.headers,
      });
      expect(failedArchive.statusCode).toBe(500);
    } finally {
      await removeTeamArchiveFailure();
    }
    const teamAfterFailedArchive = await getDb().queryOne<{
      etat_equipe: string;
      active_members: string;
    }>(
      `SELECT e.etat_equipe,
              (SELECT count(*)::text FROM appartenance_equipe
               WHERE id_equipe = e.id_equipe AND date_fin IS NULL) AS active_members
       FROM equipe e WHERE e.id_equipe = $1`,
      [idEquipe],
    );
    expect(teamAfterFailedArchive).toEqual({
      etat_equipe: 'ACTIVE',
      active_members: '1',
    });

    const archivedTeam = await app.inject({
      method: 'POST',
      url: `/api/referentiels/equipes/${idEquipe}/archiver`,
      headers: admin.headers,
    });
    expect(archivedTeam.statusCode).toBe(200);

    const persisted = await getDb().queryOne<{
      etat_equipe: string;
      date_fin_competence: Date | null;
      date_fin_membre: Date | null;
    }>(
      `SELECT e.etat_equipe, ce.date_fin AS date_fin_competence, a.date_fin AS date_fin_membre
       FROM equipe e
       JOIN competence_equipe ce ON ce.id_equipe = e.id_equipe
       JOIN appartenance_equipe a ON a.id_equipe = e.id_equipe
       WHERE e.id_equipe = $1 AND ce.id_competence_equipe = $2`,
      [idEquipe, idCompetenceEquipe],
    );
    const archivedTypeRecord = await getDb().queryOne<{ date_fin_validite: Date | null }>(
      'SELECT date_fin_validite FROM type_dechet WHERE id_type_dechet = $1',
      [idTypeDechet],
    );
    expect(persisted?.etat_equipe).toBe('DISSOUTE');
    expect(persisted?.date_fin_competence).not.toBeNull();
    expect(persisted?.date_fin_membre).not.toBeNull();
    expect(archivedTypeRecord?.date_fin_validite).not.toBeNull();

    const removeTypeReactivationFailure = await failBusinessEventForTest(
      'TYPE_DECHET_REACTIVE',
    );
    try {
      const failedReactivation = await app.inject({
        method: 'POST',
        url: `/api/referentiels/types-dechets/${idTypeDechet}/reactiver`,
        headers: admin.headers,
        payload: { motif: 'Échec injecté lors de la réactivation du type.' },
      });
      expect(failedReactivation.statusCode).toBe(500);
    } finally {
      await removeTypeReactivationFailure();
    }
    const typeAfterFailedReactivation = await getDb().queryOne<{
      date_fin_validite: Date | null;
    }>(
      'SELECT date_fin_validite FROM type_dechet WHERE id_type_dechet = $1',
      [idTypeDechet],
    );
    expect(typeAfterFailedReactivation?.date_fin_validite).not.toBeNull();

    const reactivatedType = await app.inject({
      method: 'POST',
      url: `/api/referentiels/types-dechets/${idTypeDechet}/reactiver`,
      headers: admin.headers,
      payload: { motif: 'Réactivation validée après revue du référentiel.' },
    });
    expect(reactivatedType.statusCode).toBe(200);

    const removeTeamReactivationFailure = await failBusinessEventForTest(
      'EQUIPE_REACTIVE',
    );
    try {
      const failedReactivation = await app.inject({
        method: 'POST',
        url: `/api/referentiels/equipes/${idEquipe}/reactiver`,
        headers: admin.headers,
        payload: { motif: 'La réactivation ne doit pas précéder l’archivage.' },
      });
      expect(failedReactivation.statusCode).toBe(500);
    } finally {
      await removeTeamReactivationFailure();
    }
    const teamAfterFailedReactivation = await getDb().queryOne<{
      etat_equipe: string;
    }>(
      'SELECT etat_equipe FROM equipe WHERE id_equipe = $1',
      [idEquipe],
    );
    expect(teamAfterFailedReactivation?.etat_equipe).toBe('DISSOUTE');

    const reactivatedTeam = await app.inject({
      method: 'POST',
      url: `/api/referentiels/equipes/${idEquipe}/reactiver`,
      headers: admin.headers,
      payload: { motif: 'Équipe réactivée après validation des moyens disponibles.' },
    });
    expect(reactivatedTeam.statusCode).toBe(200);

    const history = await getDb().query<{ type_evenement: string; motif: string }>(
      `SELECT type_evenement, motif FROM evenement_metier
       WHERE id_type_dechet_cible = $1 OR id_equipe_cible = $2
       ORDER BY date_enregistrement`,
      [idTypeDechet, idEquipe],
    );
    expect(history).toEqual(expect.arrayContaining([
      expect.objectContaining({
        type_evenement: 'TYPE_DECHET_REACTIVE',
        motif: 'Réactivation validée après revue du référentiel.',
      }),
      expect.objectContaining({
        type_evenement: 'EQUIPE_REACTIVE',
        motif: 'Équipe réactivée après validation des moyens disponibles.',
      }),
    ]));

    const duplicateReactivation = await app.inject({
      method: 'POST',
      url: `/api/referentiels/equipes/${idEquipe}/reactiver`,
      headers: admin.headers,
      payload: { motif: 'Deuxième réactivation invalide.' },
    });
    expect(duplicateReactivation.statusCode).toBe(409);

    const currentState = await getDb().queryOne<{
      etat_equipe: string;
      date_fin_validite: Date | null;
    }>(
      `SELECT e.etat_equipe, td.date_fin_validite
       FROM equipe e CROSS JOIN type_dechet td
       WHERE e.id_equipe = $1 AND td.id_type_dechet = $2`,
      [idEquipe, idTypeDechet],
    );
    expect(currentState).toEqual({ etat_equipe: 'ACTIVE', date_fin_validite: null });
  });
});
