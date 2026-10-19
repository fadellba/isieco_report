import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('Documentation OpenAPI / Swagger UI', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('génère une spécification OpenAPI 3.0.3 valide sur /documentation/json', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/documentation/json',
    });

    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toBe('3.0.3');
    expect(spec.info.title).toContain('ISI-Eco Report');
    expect(spec.paths).toBeDefined();

    // Vérifier la présence des routes clés
    expect(spec.paths['/api/auth/login']).toBeDefined();
    expect(spec.paths['/api/signalements/']).toBeDefined();
    expect(spec.paths['/api/qualification/boite-reception']).toBeDefined();
    expect(spec.paths['/api/dossiers/']).toBeDefined();
    expect(spec.paths['/api/affectations/']).toBeDefined();
    expect(spec.paths['/api/interventions/mes-missions']).toBeDefined();
    expect(spec.paths['/api/verifications/']).toBeDefined();
    expect(spec.paths['/api/evenements/audit-trail']).toBeDefined();
    expect(spec.paths['/api/points/mes-points']).toBeDefined();
    expect(spec.paths['/api/notifications/']).toBeDefined();
    expect(spec.paths['/api/carte/points']).toBeDefined();
    expect(spec.paths['/api/utilisateurs/']).toBeDefined();
  });

  it('sert la page HTML Swagger UI sur /documentation et redirige /docs', async () => {
    const uiRes = await app.inject({
      method: 'GET',
      url: '/documentation',
    });
    expect([200, 302, 301]).toContain(uiRes.statusCode);

    const redirectRes = await app.inject({
      method: 'GET',
      url: '/docs',
    });
    expect(redirectRes.statusCode).toBe(302);
    expect(redirectRes.headers.location).toBe('/documentation');
  });
});
