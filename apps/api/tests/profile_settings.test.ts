import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, cleanDatabase, loginAs, TEST_PERSONAS } from './helpers.js';
import { getDb } from '../src/db/index.js';

describe('Profil utilisateur et sécurité du compte', () => {
  let app: FastifyInstance;
  let originalAdmin!: {
    nom: string;
    prenom: string | null;
    telephone: string | null;
    mot_de_passe_hash: string;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const admin = await getDb().queryOne<typeof originalAdmin>(
      'SELECT nom, prenom, telephone, mot_de_passe_hash FROM utilisateur WHERE id_utilisateur = $1',
      [TEST_PERSONAS.ADMIN.id]
    );
    if (!admin) throw new Error('Compte ADMIN absent du jeu de test.');
    originalAdmin = admin;
  });

  afterEach(async () => {
    await cleanDatabase();
    await getDb().execute(
      `UPDATE utilisateur SET nom = $1, prenom = $2, telephone = $3, mot_de_passe_hash = $4
       WHERE id_utilisateur = $5`,
      [
        originalAdmin.nom,
        originalAdmin.prenom,
        originalAdmin.telephone,
        originalAdmin.mot_de_passe_hash,
        TEST_PERSONAS.ADMIN.id,
      ]
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it('met à jour les données personnelles uniquement pour la session connectée', async () => {
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      headers: admin.headers,
      payload: {
        nom: 'Ndiaye',
        prenom: 'Aminata',
        telephone: '+221770000099',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({
      nom: 'Ndiaye',
      prenom: 'Aminata',
      telephone: '+221770000099',
    });

    const currentProfile = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: admin.headers,
    });
    expect(currentProfile.statusCode).toBe(200);
    expect(currentProfile.json().user).toMatchObject({
      nom: 'Ndiaye',
      prenom: 'Aminata',
      telephone: '+221770000099',
    });
  });

  it('vérifie le mot de passe courant et ferme les autres sessions après le changement', async () => {
    const firstSession = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const otherSession = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const tooShort = await app.inject({
      method: 'PATCH',
      url: '/api/auth/password',
      headers: firstSession.headers,
      payload: { currentPassword: TEST_PERSONAS.ADMIN.password, newPassword: 'short' },
    });
    expect(tooShort.statusCode).toBe(400);

    const unchanged = await app.inject({
      method: 'PATCH',
      url: '/api/auth/password',
      headers: firstSession.headers,
      payload: {
        currentPassword: TEST_PERSONAS.ADMIN.password,
        newPassword: TEST_PERSONAS.ADMIN.password,
      },
    });
    expect(unchanged.statusCode).toBe(400);

    const rejected = await app.inject({
      method: 'PATCH',
      url: '/api/auth/password',
      headers: firstSession.headers,
      payload: { currentPassword: 'incorrect', newPassword: 'SecuriteNouveau2026!' },
    });
    expect(rejected.statusCode).toBe(401);

    const changed = await app.inject({
      method: 'PATCH',
      url: '/api/auth/password',
      headers: firstSession.headers,
      payload: { currentPassword: TEST_PERSONAS.ADMIN.password, newPassword: 'SecuriteNouveau2026!' },
    });
    expect(changed.statusCode).toBe(200);

    const oldSession = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: otherSession.headers,
    });
    expect(oldSession.statusCode).toBe(401);

    const newLogin = await loginAs(app, TEST_PERSONAS.ADMIN.email, 'SecuriteNouveau2026!');
    expect(newLogin.statusCode).toBe(200);
    expect(newLogin.user.email).toBe(TEST_PERSONAS.ADMIN.email);
  });

  it('refuse une mise à jour du profil sans authentification', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/auth/me',
      payload: { nom: 'Ndiaye', prenom: 'Aminata', telephone: null },
    });
    expect(response.statusCode).toBe(401);
  });
});
