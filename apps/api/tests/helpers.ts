import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { buildApp } from '../src/app.js';
import { getDb } from '../src/db/index.js';
import { ClientType } from '@isieco/shared';

export const TEST_PERSONAS = {
  CITOYEN: { email: 'citoyen@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000001' },
  CITOYEN_2: { email: 'citoyen2@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000010' },
  INACTIF: { email: 'inactif@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000009' },
  QUALIFICATION: { email: 'qualif@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000002' },
  TRAITEMENT: { email: 'traitement@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000003' },
  AFFECTATION: { email: 'affectation@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000004' },
  TERRAIN: { email: 'terrain@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000005' },
  VERIFICATION: { email: 'verification@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000006' },
  ADMIN: { email: 'admin@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000007' },
  DECISION: { email: 'decision@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000008' },
  OPERATIONS: { email: 'operations@isieco.sn', password: 'Password@123', id: '00000000-0000-0000-0000-000000000011' },
};

export const TEST_TYPES_DECHETS = {
  PLASTIQUE: '10000000-0000-0000-0000-000000000001',
  ORGANIQUE: '10000000-0000-0000-0000-000000000002',
  ELECTRONIQUE: '10000000-0000-0000-0000-000000000003',
  GRAVATS: '10000000-0000-0000-0000-000000000004',
  METAUX: '10000000-0000-0000-0000-000000000005',
};

export const TEST_EQUIPES = {
  PLASTIQUE_PLATEAU: {
    id: '20000000-0000-0000-0000-000000000001',
    competencePlastique: '30000000-0000-0000-0000-000000000001',
    competenceElectroniqueExpiree: '30000000-0000-0000-0000-000000000099',
  },
  BIO_MEDINA: {
    id: '20000000-0000-0000-0000-000000000002',
    competenceOrganique: '30000000-0000-0000-0000-000000000002',
  },
  DEBLAIEMENT_LITTORAL: {
    id: '20000000-0000-0000-0000-000000000003',
    competenceGravats: '30000000-0000-0000-0000-000000000003',
    competenceMetaux: '30000000-0000-0000-0000-000000000004',
  },
};

export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}

export async function cleanDatabase(): Promise<void> {
  const db = getDb();
  await db.execute(`
    TRUNCATE TABLE 
      session, 
      photo_intervention, 
      intervention, 
      verification_resolution, 
      affectation, 
      contenu_dossier, 
      rattachement_signalement, 
      dossier_traitement, 
      contenu_signalement, 
      photo_signalement, 
      signalement, 
      evenement_metier, 
      historique_points, 
      notification 
    CASCADE
  `);
}

export interface LoginResult {
  token?: string;
  cookies: Record<string, string>;
  headers: Record<string, string>;
  user: any;
  statusCode: number;
  body: any;
}

export async function loginAs(
  app: FastifyInstance,
  email: string,
  password = 'Password@123',
  clientType: ClientType = ClientType.MOBILE
): Promise<LoginResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: {
      email,
      password,
      clientType,
    },
  });

  const body = res.json();
  const cookies: Record<string, string> = {};

  // Extract set-cookie headers
  const setCookie = res.headers['set-cookie'];
  if (setCookie) {
    const cookieHeaders = Array.isArray(setCookie) ? setCookie : [setCookie];
    for (const ch of cookieHeaders) {
      const match = ch.match(/^([^=]+)=([^;]+)/);
      if (match) {
        cookies[match[1]] = match[2];
      }
    }
  }

  const token = body.token || cookies['session_token'];
  const headers: Record<string, string> = {};
  if (token) {
    headers['authorization'] = `Bearer ${token}`;
  }

  return {
    token,
    cookies,
    headers,
    user: body.user,
    statusCode: res.statusCode,
    body,
  };
}

export async function failBusinessEventForTest(typeEvenement: string): Promise<() => Promise<void>> {
  if (!/^[A-Z_]+$/.test(typeEvenement)) {
    throw new Error(`Type d’événement de test invalide : ${typeEvenement}`);
  }
  const suffix = randomUUID().replaceAll('-', '');
  const functionName = `test_fail_event_${suffix}`;
  const triggerName = `test_fail_event_${suffix}`;
  const db = getDb();
  await db.execute(`
    CREATE FUNCTION ${functionName}() RETURNS TRIGGER
    LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.type_evenement = '${typeEvenement}' THEN
        RAISE EXCEPTION 'Échec injecté de journalisation pour le test transactionnel';
      END IF;
      RETURN NEW;
    END;
    $$;
    CREATE TRIGGER ${triggerName}
    BEFORE INSERT ON evenement_metier
    FOR EACH ROW EXECUTE FUNCTION ${functionName}();
  `);

  return async () => {
    await db.execute(`
      DROP TRIGGER ${triggerName} ON evenement_metier;
      DROP FUNCTION ${functionName}();
    `);
  };
}

export async function failTableWriteForTest(
  tableName:
    | 'notification'
    | 'historique_priorite_dossier'
    | 'intervention'
    | 'publication_flux'
    | 'photo_publication'
    | 'utilisateur'
    | 'session'
    | 'delegation_decision_equipe'
    | 'disponibilite_equipe'
    | 'type_dechet'
    | 'equipe'
    | 'appartenance_equipe',
): Promise<() => Promise<void>> {
  const suffix = randomUUID().replaceAll('-', '');
  const functionName = `test_fail_write_${suffix}`;
  const triggerName = `test_fail_write_${suffix}`;
  const db = getDb();
  await db.execute(`
    CREATE FUNCTION ${functionName}() RETURNS TRIGGER
    LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION 'Échec injecté sur ${tableName} pour le test transactionnel';
    END;
    $$;
    CREATE TRIGGER ${triggerName}
    BEFORE INSERT OR UPDATE OR DELETE ON ${tableName}
    FOR EACH ROW EXECUTE FUNCTION ${functionName}();
  `);

  return async () => {
    await db.execute(`
      DROP TRIGGER ${triggerName} ON ${tableName};
      DROP FUNCTION ${functionName}();
    `);
  };
}
