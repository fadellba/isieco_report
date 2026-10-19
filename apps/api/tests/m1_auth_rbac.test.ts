import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp, cleanDatabase, loginAs, TEST_PERSONAS } from './helpers.js';
import { ClientType, RoleCode } from '@isieco/shared';

describe('Jalon M1 (Tranche 0) — Auth Dual-Client & RBAC Guard', () => {
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

  // --------------------------------------------------------------------------
  // Test d'acceptation T39 : Authentification & Contrôle d'état de compte
  // --------------------------------------------------------------------------
  it('T39: Connexion réussie pour compte actif, rejet mot de passe erroné (401), rejet compte inactif (401)', async () => {
    // 1. Connexion réussie pour un compte actif (Mobile avec Bearer)
    const loginMobile = await loginAs(app, TEST_PERSONAS.CITOYEN.email, TEST_PERSONAS.CITOYEN.password, ClientType.MOBILE);
    expect(loginMobile.statusCode).toBe(200);
    expect(loginMobile.body.success).toBe(true);
    expect(loginMobile.body.token).toBeDefined();
    expect(loginMobile.body.user.email).toBe(TEST_PERSONAS.CITOYEN.email);
    expect(loginMobile.body.user.roles).toContain(RoleCode.CITOYEN);

    // 2. Connexion réussie pour un compte actif (Web avec Cookie HttpOnly)
    const loginWeb = await loginAs(app, TEST_PERSONAS.CITOYEN.email, TEST_PERSONAS.CITOYEN.password, ClientType.WEB);
    expect(loginWeb.statusCode).toBe(200);
    expect(loginWeb.cookies['session_token']).toBeDefined();

    // 3. Rejet si mot de passe erroné (401)
    const badPassword = await loginAs(app, TEST_PERSONAS.CITOYEN.email, 'WrongPassword123');
    expect(badPassword.statusCode).toBe(401);
    expect(badPassword.body.error).toBeDefined();

    // 4. Rejet si utilisateur inexistant (401)
    const nonexistent = await loginAs(app, 'inconnu@isieco.sn', 'Password@123');
    expect(nonexistent.statusCode).toBe(401);

    // 5. Rejet si compte inactif / suspendu (401)
    const inactiveLogin = await loginAs(app, TEST_PERSONAS.INACTIF.email, TEST_PERSONAS.INACTIF.password);
    expect(inactiveLogin.statusCode).toBe(401);
    expect(inactiveLogin.body.error.message).toMatch(/inactif/i);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T20 : Rejet serveur sans rôle adéquat (403 Forbidden)
  // --------------------------------------------------------------------------
  it('T20: Rejet serveur de tout accès aux routes protégées sans rôle adéquat (403 Forbidden)', async () => {
    // Citoyen authentifié
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);

    // Tentative 1 : Citoyen essayant d'accéder à la boîte de réception de qualification (Réservé QUALIF / TRAITEMENT / ADMIN)
    const resQualif = await app.inject({
      method: 'GET',
      url: '/api/qualification/boite-reception',
      headers: citoyen.headers,
    });
    expect(resQualif.statusCode).toBe(403);
    expect(resQualif.json().error.code).toBe('FORBIDDEN');

    // Tentative 2 : Citoyen essayant de créer un dossier opérationnel (Réservé TRAITEMENT / AFFECTATION / ADMIN)
    const resDossier = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: citoyen.headers,
      payload: {
        descriptionSynthese: 'Dossier non autorisé',
        categories: [{ idTypeDechet: '10000000-0000-0000-0000-000000000001' }],
      },
    });
    expect(resDossier.statusCode).toBe(403);

    // Tentative 3 : Agent terrain essayant d'affecter une équipe (Réservé AFFECTATION / ADMIN)
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const resAffectation = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: terrain.headers,
      payload: {
        idDossier: '00000000-0000-0000-0000-000000000001',
        idTypeDechet: '10000000-0000-0000-0000-000000000001',
        idEquipe: '20000000-0000-0000-0000-000000000001',
        idCompetenceEquipe: '30000000-0000-0000-0000-000000000001',
      },
    });
    expect(resAffectation.statusCode).toBe(403);

    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);
    const adminDossier = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: admin.headers,
      payload: {
        descriptionSynthese: 'Dossier admin non autorisé',
        categories: [{ idTypeDechet: '10000000-0000-0000-0000-000000000001' }],
      },
    });
    expect(adminDossier.statusCode).toBe(403);

    const adminMission = await app.inject({
      method: 'POST',
      url: '/api/interventions/00000000-0000-0000-0000-000000000001/demarrer',
      headers: admin.headers,
    });
    expect(adminMission.statusCode).toBe(403);

    const adminVerification = await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: admin.headers,
      payload: {
        idAffectation: '00000000-0000-0000-0000-000000000001',
        resultatVerification: 'CONFORME_RESOLU',
      },
    });
    expect(adminVerification.statusCode).toBe(403);

    // Accès sans token d'authentification (401 Unauthorized)
    const resNoAuth = await app.inject({
      method: 'GET',
      url: '/api/qualification/boite-reception',
    });
    expect(resNoAuth.statusCode).toBe(401);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T30 : Rejet systématique des opérations pour compte inactif
  // --------------------------------------------------------------------------
  it('Protège les lectures des dossiers et autorise les gestionnaires et vérificateurs', async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const createDossier = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier de test des autorisations',
        categories: [{ idTypeDechet: '10000000-0000-0000-0000-000000000001' }],
      },
    });
    expect(createDossier.statusCode).toBe(201);
    const idDossier = createDossier.json().idDossier;

    for (const persona of [
      TEST_PERSONAS.TRAITEMENT,
      TEST_PERSONAS.AFFECTATION,
      TEST_PERSONAS.VERIFICATION,
    ]) {
      const user = await loginAs(app, persona.email);
      const list = await app.inject({
        method: 'GET',
        url: '/api/dossiers',
        headers: user.headers,
      });
      expect(list.statusCode).toBe(200);
      expect(list.json().data).toHaveLength(1);

      const detail = await app.inject({
        method: 'GET',
        url: `/api/dossiers/${idDossier}`,
        headers: user.headers,
      });
      expect(detail.statusCode).toBe(200);
      expect(detail.json().data.id_dossier).toBe(idDossier);
    }

    for (const persona of [
      TEST_PERSONAS.CITOYEN,
      TEST_PERSONAS.TERRAIN,
      TEST_PERSONAS.ADMIN,
    ]) {
      const user = await loginAs(app, persona.email);
      for (const url of ['/api/dossiers', `/api/dossiers/${idDossier}`]) {
        const response = await app.inject({
          method: 'GET',
          url,
          headers: user.headers,
        });
        expect(response.statusCode).toBe(403);
      }
    }

    for (const url of ['/api/dossiers', `/api/dossiers/${idDossier}`]) {
      const response = await app.inject({ method: 'GET', url });
      expect(response.statusCode).toBe(401);
    }
  });

  it('T30: Rejet systématique des opérations critiques par un compte inactif même avec token forgé', async () => {
    // Un compte inactif ne peut pas obtenir de session valide
    const loginRes = await loginAs(app, TEST_PERSONAS.INACTIF.email, TEST_PERSONAS.INACTIF.password);
    expect(loginRes.statusCode).toBe(401);

    // Si une fausse session ou un token expiré est utilisé
    const forgedRes = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: { authorization: 'Bearer token-fictif-invalide' },
      payload: {
        description: 'Dépôt sauvage interdit',
        latitude: 14.672,
        longitude: -17.432,
        categories: [{ idTypeDechet: '10000000-0000-0000-0000-000000000001' }],
      },
    });
    expect(forgedRes.statusCode).toBe(401);
  });

  // Déconnexion et profil /api/auth/me
  it('Auth Lifecycle: Consultation /api/auth/me et Déconnexion /api/auth/logout', async () => {
    const session = await loginAs(app, TEST_PERSONAS.CITOYEN.email);

    // 1. Consultation /api/auth/me
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: session.headers,
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().user.email).toBe(TEST_PERSONAS.CITOYEN.email);

    // 2. Déconnexion
    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: session.headers,
    });
    expect(logoutRes.statusCode).toBe(200);
    expect(logoutRes.json().success).toBe(true);

    // 3. Après déconnexion, le jeton est révoqué
    const afterLogout = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: session.headers,
    });
    expect(afterLogout.statusCode).toBe(401);
  });
});
