import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { getDb } from '../src/db/index.js';
import {
  cleanDatabase,
  createTestApp,
  failBusinessEventForTest,
  loginAs,
  TEST_EQUIPES,
  TEST_PERSONAS,
} from './helpers.js';

describe('Disponibilité des équipes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('est mise à jour et consultée par le chef actif, sans effet bloquant sur les affectations', async () => {
    await cleanDatabase();
    const leader = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const citizen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const payload = {
      etatDisponibilite: 'INDISPONIBLE',
      valideJusqua: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      commentaire: 'Équipe temporairement mobilisée ailleurs',
    };

    const forbiddenUpdate = await app.inject({
      method: 'PUT',
      url: `/api/equipes/${TEST_EQUIPES.PLASTIQUE_PLATEAU.id}/disponibilite`,
      headers: citizen.headers,
      payload,
    });
    expect(forbiddenUpdate.statusCode).toBe(403);

    const update = await app.inject({
      method: 'PUT',
      url: `/api/equipes/${TEST_EQUIPES.PLASTIQUE_PLATEAU.id}/disponibilite`,
      headers: leader.headers,
      payload,
    });
    expect(update.statusCode, JSON.stringify(update.json())).toBe(200);
    expect(update.json().changed).toBe(true);
    const availabilityBeforeFailure = await getDb().queryOne<{
      etat_disponibilite: string;
      valide_jusqua: Date;
      commentaire: string | null;
    }>(
      `SELECT etat_disponibilite, valide_jusqua, commentaire
       FROM disponibilite_equipe WHERE id_equipe = $1`,
      [TEST_EQUIPES.PLASTIQUE_PLATEAU.id],
    );
    const removeAvailabilityFailure = await failBusinessEventForTest(
      'EQUIPE_DISPONIBILITE_MISE_A_JOUR',
    );
    try {
      const failedUpdate = await app.inject({
        method: 'PUT',
        url: `/api/equipes/${TEST_EQUIPES.PLASTIQUE_PLATEAU.id}/disponibilite`,
        headers: leader.headers,
        payload: {
          ...payload,
          etatDisponibilite: 'DISPONIBLE',
          commentaire: 'Cette mise à jour doit être annulée.',
        },
      });
      expect(failedUpdate.statusCode).toBe(500);
    } finally {
      await removeAvailabilityFailure();
    }
    const availabilityAfterFailure = await getDb().queryOne<{
      etat_disponibilite: string;
      valide_jusqua: Date;
      commentaire: string | null;
    }>(
      `SELECT etat_disponibilite, valide_jusqua, commentaire
       FROM disponibilite_equipe WHERE id_equipe = $1`,
      [TEST_EQUIPES.PLASTIQUE_PLATEAU.id],
    );
    expect(availabilityAfterFailure).toEqual(availabilityBeforeFailure);

    const historyBeforeNoOp = await getDb().queryOne<{ count: string | number }>(
      'SELECT count(*) FROM historique_disponibilite_equipe WHERE id_equipe = $1',
      [TEST_EQUIPES.PLASTIQUE_PLATEAU.id],
    );
    const repeatedUpdate = await app.inject({
      method: 'PUT',
      url: `/api/equipes/${TEST_EQUIPES.PLASTIQUE_PLATEAU.id}/disponibilite`,
      headers: leader.headers,
      payload,
    });
    expect(repeatedUpdate.statusCode).toBe(200);
    expect(repeatedUpdate.json().changed).toBe(false);
    const historyAfterNoOp = await getDb().queryOne<{ count: string | number }>(
      'SELECT count(*) FROM historique_disponibilite_equipe WHERE id_equipe = $1',
      [TEST_EQUIPES.PLASTIQUE_PLATEAU.id],
    );
    expect(Number(historyAfterNoOp?.count)).toBe(Number(historyBeforeNoOp?.count));

    const teams = await app.inject({
      method: 'GET',
      url: '/api/referentiels/equipes',
      headers: leader.headers,
    });
    const team = teams.json().data.find(
      (item: { idEquipe: string }) => item.idEquipe === TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
    );
    expect(team.disponibilite).toMatchObject({
      etat: 'INDISPONIBLE',
      commentaire: payload.commentaire,
    });

    const history = await app.inject({
      method: 'GET',
      url: `/api/equipes/${TEST_EQUIPES.PLASTIQUE_PLATEAU.id}/disponibilite/historique`,
      headers: leader.headers,
    });
    expect(history.statusCode).toBe(200);

    const forbiddenHistory = await app.inject({
      method: 'GET',
      url: `/api/equipes/${TEST_EQUIPES.PLASTIQUE_PLATEAU.id}/disponibilite/historique`,
      headers: citizen.headers,
    });
    expect(forbiddenHistory.statusCode).toBe(403);
  });

  it('autorise le membre auquel la mise à jour de disponibilité a été déléguée', async () => {
    await cleanDatabase();
    const leader = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const delegate = await loginAs(app, TEST_PERSONAS.CITOYEN_2.email);
    const teamId = TEST_EQUIPES.PLASTIQUE_PLATEAU.id;
    const membershipStart = new Date(Date.now() - 60_000);
    const db = getDb();
    await db.execute(
      `INSERT INTO appartenance_equipe (id_utilisateur, id_equipe, date_debut, fonction)
       VALUES ($1, $2, $3, 'AGENT_TERRAIN')`,
      [TEST_PERSONAS.CITOYEN_2.id, teamId, membershipStart.toISOString()],
    );

    try {
      const removeGrantFailure = await failBusinessEventForTest(
        'DELEGATION_EQUIPE_ACCORDEE',
      );
      try {
        const failedDelegation = await app.inject({
          method: 'POST',
          url: `/api/equipes/${teamId}/delegations`,
          headers: leader.headers,
          payload: {
            idUtilisateurDelegue: TEST_PERSONAS.CITOYEN_2.id,
            typeDecision: 'MISE_A_JOUR_DISPONIBILITE',
          },
        });
        expect(failedDelegation.statusCode).toBe(500);
      } finally {
        await removeGrantFailure();
      }
      const failedGrantCount = await db.queryOne<{ count: string }>(
        `SELECT count(*)::text AS count FROM delegation_decision_equipe
         WHERE id_equipe = $1 AND id_utilisateur_delegue = $2
           AND date_debut_appartenance = $3 AND date_fin IS NULL`,
        [teamId, TEST_PERSONAS.CITOYEN_2.id, membershipStart.toISOString()],
      );
      expect(failedGrantCount?.count).toBe('0');

      const delegation = await app.inject({
        method: 'POST',
        url: `/api/equipes/${teamId}/delegations`,
        headers: leader.headers,
        payload: {
          idUtilisateurDelegue: TEST_PERSONAS.CITOYEN_2.id,
          typeDecision: 'MISE_A_JOUR_DISPONIBILITE',
        },
      });
      expect(delegation.statusCode).toBe(201);
      const idDelegation = delegation.json().data.id as string;

      const removeRevokeFailure = await failBusinessEventForTest(
        'DELEGATION_EQUIPE_RETIREE',
      );
      try {
        const failedRevoke = await app.inject({
          method: 'DELETE',
          url: `/api/equipes/${teamId}/delegations/${idDelegation}`,
          headers: leader.headers,
        });
        expect(failedRevoke.statusCode).toBe(500);
      } finally {
        await removeRevokeFailure();
      }
      const delegationAfterFailedRevoke = await db.queryOne<{ date_fin: Date | null }>(
        'SELECT date_fin FROM delegation_decision_equipe WHERE id_delegation = $1',
        [idDelegation],
      );
      expect(delegationAfterFailedRevoke?.date_fin).toBeNull();

      const update = await app.inject({
        method: 'PUT',
        url: `/api/equipes/${teamId}/disponibilite`,
        headers: delegate.headers,
        payload: {
          etatDisponibilite: 'DISPONIBLE',
          valideJusqua: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          commentaire: 'Équipe à nouveau disponible',
        },
      });
      expect(update.statusCode, JSON.stringify(update.json())).toBe(200);

      const revoked = await app.inject({
        method: 'DELETE',
        url: `/api/equipes/${teamId}/delegations/${idDelegation}`,
        headers: leader.headers,
      });
      expect(revoked.statusCode).toBe(200);
    } finally {
      await db.execute(
        `DELETE FROM delegation_decision_equipe
         WHERE id_equipe = $1 AND id_utilisateur_delegue = $2
           AND date_debut_appartenance = $3`,
        [teamId, TEST_PERSONAS.CITOYEN_2.id, membershipStart.toISOString()],
      );
      await db.execute(
        `DELETE FROM appartenance_equipe
         WHERE id_equipe = $1 AND id_utilisateur = $2 AND date_debut = $3`,
        [teamId, TEST_PERSONAS.CITOYEN_2.id, membershipStart.toISOString()],
      );
    }
  });
});
