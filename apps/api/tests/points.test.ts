import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  cleanDatabase,
  createTestApp,
  loginAs,
  TEST_PERSONAS,
} from './helpers.js';

describe('Points citoyens', () => {
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

  it('limite les mouvements aux attributions métier et expose le solde du citoyen', async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);

    const attributionLibre = await app.inject({
      method: 'POST',
      url: '/api/points/attribuer',
      headers: admin.headers,
      payload: {
        idUtilisateur: TEST_PERSONAS.CITOYEN.id,
        points: 25,
        motif: 'Attribution administrative',
      },
    });
    expect(attributionLibre.statusCode).toBe(404);

    const consultation = await app.inject({
      method: 'GET',
      url: '/api/points/mes-points',
      headers: citoyen.headers,
    });

    expect(consultation.statusCode).toBe(200);
    expect(consultation.json()).toMatchObject({
      idUtilisateur: TEST_PERSONAS.CITOYEN.id,
      soldeTotal: 0,
      historique: [],
    });
  });
});
