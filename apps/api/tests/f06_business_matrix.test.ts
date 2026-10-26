import { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { EtatCompte, ResultatIntervention, ResultatVerification, RoleCode } from '@isieco/shared';
import { getDb } from '../src/db/index.js';
import {
  cleanDatabase,
  createTestApp,
  loginAs,
  TEST_PERSONAS,
} from './helpers.js';

const PERSONA_BY_ROLE: Record<RoleCode, (typeof TEST_PERSONAS)[keyof typeof TEST_PERSONAS]> = {
  [RoleCode.CITOYEN]: TEST_PERSONAS.CITOYEN,
  [RoleCode.QUALIFICATION]: TEST_PERSONAS.QUALIFICATION,
  [RoleCode.TRAITEMENT]: TEST_PERSONAS.TRAITEMENT,
  [RoleCode.AFFECTATION]: TEST_PERSONAS.AFFECTATION,
  [RoleCode.TERRAIN]: TEST_PERSONAS.TERRAIN,
  [RoleCode.VERIFICATION]: TEST_PERSONAS.VERIFICATION,
  [RoleCode.ADMIN]: TEST_PERSONAS.ADMIN,
  [RoleCode.DECISION]: TEST_PERSONAS.DECISION,
};

const resourceId = '00000000-0000-0000-0000-000000000000';
const BUSINESS_COMMANDS: Array<{
  name: string;
  allowedRoles: RoleCode[];
  method: 'POST' | 'PATCH';
  url: string;
  payload: Record<string, unknown>;
}> = [
  {
    name: 'examiner un signalement',
    allowedRoles: [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT],
    method: 'POST',
    url: `/api/qualification/signalements/${resourceId}/examiner`,
    payload: {},
  },
  {
    name: 'accepter un signalement',
    allowedRoles: [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT],
    method: 'POST',
    url: `/api/qualification/signalements/${resourceId}/qualifier`,
    payload: {},
  },
  {
    name: 'rejeter un signalement',
    allowedRoles: [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT],
    method: 'POST',
    url: `/api/qualification/signalements/${resourceId}/rejeter`,
    payload: { motif: 'Motif de rejet suffisamment détaillé.' },
  },
  {
    name: 'demander un complément',
    allowedRoles: [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT],
    method: 'POST',
    url: `/api/qualification/signalements/${resourceId}/complements`,
    payload: { motif: 'Informations complémentaires nécessaires au dossier.' },
  },
  {
    name: 'corriger une acceptation',
    allowedRoles: [RoleCode.QUALIFICATION, RoleCode.TRAITEMENT],
    method: 'POST',
    url: `/api/qualification/signalements/${resourceId}/corriger-acceptation`,
    payload: { motif: 'Correction motivée après vérification du signalement.' },
  },
  {
    name: 'répondre à une demande de complément',
    allowedRoles: [RoleCode.CITOYEN],
    method: 'POST',
    url: `/api/signalements/${resourceId}/complements/${resourceId}/reponse`,
    payload: { contenu: 'Réponse de test au complément demandé.' },
  },
  {
    name: 'créer un dossier',
    allowedRoles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
    method: 'POST',
    url: '/api/dossiers',
    payload: {
      descriptionSynthese: 'Dossier de vérification de la matrice F-06',
      categories: [{ idTypeDechet: '10000000-0000-0000-0000-000000000001' }],
    },
  },
  {
    name: 'modifier la priorité d’un dossier',
    allowedRoles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
    method: 'PATCH',
    url: `/api/dossiers/${resourceId}/priorite`,
    payload: { priorite: 'ELEVEE', justification: 'Justification suffisamment détaillée.' },
  },
  {
    name: 'modifier la localisation d’un dossier',
    allowedRoles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
    method: 'PATCH',
    url: `/api/dossiers/${resourceId}/localisation`,
    payload: {
      latitude: 14.671,
      longitude: -17.433,
      descriptionLocalisation: 'Localisation de test suffisamment précise.',
      motif: 'Correction de localisation motivée pour les tests.',
    },
  },
  {
    name: 'rattacher un signalement',
    allowedRoles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
    method: 'POST',
    url: `/api/dossiers/${resourceId}/rattacher`,
    payload: { idSignalement: resourceId },
  },
  {
    name: 'corriger un rattachement',
    allowedRoles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
    method: 'POST',
    url: `/api/dossiers/${resourceId}/corriger-rattachement`,
    payload: {
      idSignalement: resourceId,
      nouveauIdDossier: resourceId,
      motif: 'Correction motivée du rattachement à un dossier.',
    },
  },
  {
    name: 'ajouter un volet',
    allowedRoles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
    method: 'POST',
    url: `/api/dossiers/${resourceId}/categories`,
    payload: {
      idTypeDechet: '10000000-0000-0000-0000-000000000002',
      motifAjout: 'Ajout documenté du volet au dossier.',
    },
  },
  {
    name: 'retirer un volet',
    allowedRoles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
    method: 'POST',
    url: `/api/dossiers/${resourceId}/categories/10000000-0000-0000-0000-000000000001/retirer`,
    payload: { motif: 'Retrait motivé du volet de traitement.' },
  },
  {
    name: 'transférer hors périmètre',
    allowedRoles: [RoleCode.TRAITEMENT, RoleCode.AFFECTATION],
    method: 'POST',
    url: `/api/dossiers/${resourceId}/transfert-externe`,
    payload: {
      destinataireExterne: 'Service externe',
      motif: 'Transfert motivé vers un service compétent.',
    },
  },
  {
    name: 'créer une affectation',
    allowedRoles: [RoleCode.AFFECTATION],
    method: 'POST',
    url: '/api/affectations',
    payload: {
      idDossier: resourceId,
      idTypeDechet: resourceId,
      idEquipe: resourceId,
      idCompetenceEquipe: resourceId,
    },
  },
  {
    name: 'réaffecter un volet',
    allowedRoles: [RoleCode.AFFECTATION],
    method: 'POST',
    url: `/api/affectations/${resourceId}/reaffecter`,
    payload: {
      nouvelleEquipeId: resourceId,
      nouvelleCompetenceId: resourceId,
      motif: 'Réaffectation motivée pour test de permission.',
    },
  },
  {
    name: 'démarrer une intervention',
    allowedRoles: [RoleCode.TERRAIN],
    method: 'POST',
    url: `/api/interventions/${resourceId}/demarrer`,
    payload: {},
  },
  {
    name: 'terminer une intervention',
    allowedRoles: [RoleCode.TERRAIN],
    method: 'POST',
    url: `/api/interventions/${resourceId}/terminer`,
    payload: {
      resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
      compteRendu: 'Compte-rendu complet pour le contrôle des permissions.',
    },
  },
  {
    name: 'vérifier une affectation',
    allowedRoles: [RoleCode.VERIFICATION],
    method: 'POST',
    url: '/api/verifications',
    payload: {
      idAffectation: resourceId,
      resultatVerification: ResultatVerification.CONFORME_RESOLU,
    },
  },
  {
    name: 'clôturer un dossier',
    allowedRoles: [RoleCode.VERIFICATION],
    method: 'POST',
    url: `/api/verifications/dossiers/${resourceId}/cloturer`,
    payload: {},
  },
  {
    name: 'rouvrir un dossier',
    allowedRoles: [RoleCode.VERIFICATION],
    method: 'POST',
    url: `/api/verifications/dossiers/${resourceId}/reouvrir`,
    payload: { motif: 'Motif de réouverture suffisamment détaillé.' },
  },
  {
    name: 'approuver une publication',
    allowedRoles: [RoleCode.DECISION],
    method: 'POST',
    url: `/api/publications/${resourceId}/decision`,
    payload: { decision: 'APPROUVEE' },
  },
  {
    name: 'refuser une publication',
    allowedRoles: [RoleCode.DECISION],
    method: 'POST',
    url: `/api/publications/${resourceId}/decision`,
    payload: { decision: 'REFUSEE', motif: 'Motif de refus adapté au contrôle.' },
  },
  {
    name: 'masquer une publication',
    allowedRoles: [RoleCode.DECISION],
    method: 'POST',
    url: `/api/publications/${resourceId}/decision`,
    payload: { decision: 'MASQUEE', motif: 'Motif de masquage adapté au contrôle.' },
  },
  {
    name: 'approuver une variante photo',
    allowedRoles: [RoleCode.DECISION],
    method: 'POST',
    url: `/api/publications/moderation/photos/SIGNALEMENT/${resourceId}/decision`,
    payload: { decision: 'APPROUVEE' },
  },
  {
    name: 'refuser une variante photo',
    allowedRoles: [RoleCode.DECISION],
    method: 'POST',
    url: `/api/publications/moderation/photos/SIGNALEMENT/${resourceId}/decision`,
    payload: { decision: 'REFUSEE', motif: 'Motif de refus photo adapté au contrôle.' },
  },
  {
    name: 'retirer une variante photo de la diffusion',
    allowedRoles: [RoleCode.DECISION],
    method: 'POST',
    url: `/api/publications/moderation/photos/SIGNALEMENT/${resourceId}/retrait`,
    payload: { motif: 'Retrait public motivé pour le contrôle des rôles.' },
  },
];

describe('F-06 — matrice acteur/commande et état du compte', () => {
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

  it('applique les permissions définies à chaque rôle pour les commandes opérationnelles', async () => {
    const sessions = new Map<RoleCode, Awaited<ReturnType<typeof loginAs>>>();
    for (const role of Object.values(RoleCode)) {
      const persona = PERSONA_BY_ROLE[role];
      const session = await loginAs(app, persona.email, persona.password);
      expect(session.statusCode, `connexion du rôle ${role}`).toBe(200);
      sessions.set(role, session);
    }

    for (const command of BUSINESS_COMMANDS) {
      for (const role of Object.values(RoleCode)) {
        const session = sessions.get(role)!;
        const response = await app.inject({
          method: command.method,
          url: command.url,
          headers: session.headers,
          payload: command.payload,
        });
        const context = `${command.name}, rôle ${role}`;
        if (command.allowedRoles.includes(role)) {
          expect(response.statusCode, context).not.toBe(403);
        } else {
          expect(response.statusCode, context).toBe(403);
        }
      }
    }
  });

  it.each([EtatCompte.INACTIF, EtatCompte.SUSPENDU])(
    'refuse toutes les commandes aux comptes %s, quel que soit leur rôle',
    async (etatCompte) => {
      const sessions = new Map<RoleCode, Awaited<ReturnType<typeof loginAs>>>();
      for (const role of Object.values(RoleCode)) {
        const persona = PERSONA_BY_ROLE[role];
        const session = await loginAs(app, persona.email, persona.password);
        expect(session.statusCode, `connexion du rôle ${role}`).toBe(200);
        sessions.set(role, session);
      }

      const db = getDb();
      try {
        for (const role of Object.values(RoleCode)) {
          const persona = PERSONA_BY_ROLE[role];
          await db.execute(
            'UPDATE utilisateur SET etat_compte = $1 WHERE id_utilisateur = $2',
            [etatCompte, persona.id],
          );
          for (const command of BUSINESS_COMMANDS) {
            const response = await app.inject({
              method: command.method,
              url: command.url,
              headers: sessions.get(role)!.headers,
              payload: command.payload,
            });
            expect(
              response.statusCode,
              `${command.name}, rôle ${role}, compte ${etatCompte}`,
            ).toBe(401);
          }
          await db.execute(
            "UPDATE utilisateur SET etat_compte = 'ACTIF' WHERE id_utilisateur = $1",
            [persona.id],
          );
        }
      } finally {
        for (const persona of Object.values(PERSONA_BY_ROLE)) {
          await db.execute(
            "UPDATE utilisateur SET etat_compte = 'ACTIF' WHERE id_utilisateur = $1",
            [persona.id],
          );
        }
      }
    },
  );
});
