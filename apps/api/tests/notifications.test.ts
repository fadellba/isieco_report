import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  cleanDatabase,
  createTestApp,
  loginAs,
  TEST_PERSONAS,
} from './helpers.js';
import { getDb } from '../src/db/index.js';
import crypto from 'node:crypto';

describe('Notifications', () => {
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

  it('liste les 50 notifications récentes, conserve l’alias mobile et limite la lecture au propriétaire', async () => {
    const db = getDb();
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const notifications = [];

    for (let index = 0; index < 52; index += 1) {
      const notification = {
        id: crypto.randomUUID(),
        lu: index % 2 === 0,
      };
      notifications.push(notification);
      await db.execute(
        `INSERT INTO notification (
           id_notification, id_utilisateur, titre, message, lu, date_creation, lien_cible
         ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          notification.id,
          TEST_PERSONAS.CITOYEN.id,
          `Notification ${index}`,
          `Message ${index}`,
          notification.lu,
          new Date(Date.now() - index * 1000),
          index === 0 ? '/dossiers/1' : null,
        ],
      );
    }

    const notificationAutreUtilisateurId = crypto.randomUUID();
    await db.execute(
      `INSERT INTO notification (id_notification, id_utilisateur, titre, message)
       VALUES ($1, $2, 'Privée', 'Ne doit pas être modifiée')`,
      [notificationAutreUtilisateurId, TEST_PERSONAS.CITOYEN_2.id],
    );

    const response = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: citoyen.headers,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      count: 50,
      nonLues: 25,
    });
    expect(response.json().data).toHaveLength(50);
    expect(response.json().data[0]).toMatchObject({
      idNotification: notifications[0].id,
      titre: 'Notification 0',
      lu: true,
      lienCible: '/dossiers/1',
    });

    const mobileAlias = await app.inject({
      method: 'GET',
      url: '/api/notifications/mes-notifications',
      headers: citoyen.headers,
    });
    expect(mobileAlias.statusCode).toBe(200);
    expect(mobileAlias.json()).toEqual(response.json());

    const markAsRead = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${notifications[1].id}/lu`,
      headers: citoyen.headers,
    });
    expect(markAsRead.statusCode).toBe(200);
    expect(markAsRead.json().success).toBe(true);

    const foreignMarkAsRead = await app.inject({
      method: 'PATCH',
      url: `/api/notifications/${notificationAutreUtilisateurId}/lu`,
      headers: citoyen.headers,
    });
    expect(foreignMarkAsRead.statusCode).toBe(200);

    const foreignNotification = await db.queryOne<{ lu: boolean }>(
      `SELECT lu FROM notification WHERE id_notification = $1`,
      [notificationAutreUtilisateurId],
    );
    expect(foreignNotification?.lu).toBe(false);

    const updatedNotification = await db.queryOne<{ lu: boolean }>(
      `SELECT lu FROM notification WHERE id_notification = $1`,
      [notifications[1].id],
    );
    expect(updatedNotification?.lu).toBe(true);
  });
});
