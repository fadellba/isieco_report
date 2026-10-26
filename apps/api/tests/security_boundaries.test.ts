import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import { createTestApp } from './helpers.js';

describe('Security boundaries', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('allows only configured browser origins', async () => {
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'POST',
      },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const rejected = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: {
        origin: 'https://localhost.attacker.example',
        'access-control-request-method': 'POST',
      },
    });
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('does not expose database failure details from the health endpoint', async () => {
    const healthCheck = app.dependencies.databaseHealthCheck;
    const originalPing = healthCheck.ping;
    healthCheck.ping = async () => {
      throw new Error('sensitive database connection detail');
    };

    try {
      const response = await app.inject({ method: 'GET', url: '/api/health' });
      expect(response.statusCode).toBe(503);
      expect(response.body).not.toContain('sensitive database connection detail');
      expect(response.json().message).toBe('Service temporairement indisponible.');
    } finally {
      healthCheck.ping = originalPing;
    }
  });
});
