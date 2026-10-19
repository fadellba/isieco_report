import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { FastifyInstance } from 'fastify';
import {
  createTestApp,
  cleanDatabase,
  loginAs,
  TEST_PERSONAS,
  TEST_TYPES_DECHETS,
  TEST_EQUIPES,
} from './helpers.js';
import { ResultatIntervention, ResultatVerification, RoleCode } from '@isieco/shared';
import { getDb } from '../src/db/index.js';

describe('Jalon M7 (Tranche 6) — Cartographie Dakar, Indicateurs & Transfert Externe', () => {
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
  // Test d'acceptation T37 : Consultation Cartographique Dakar & Non-géolocalisés
  // --------------------------------------------------------------------------
  it("T37: Consultation cartographique Dakar avec filtrage d'accès et liste séparée des signalements sans coordonnées", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const qualif = await loginAs(app, TEST_PERSONAS.QUALIFICATION.email);
    const decision = await loginAs(app, TEST_PERSONAS.DECISION.email);

    // 1. Création d'un signalement géolocalisé (Port de Dakar)
    const sigGeo = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt géolocalisé Port',
        latitude: 14.672,
        longitude: -17.432,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idSigGeo = sigGeo.json().idSignalement;

    const demoSignalementIds = [
      '50000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002',
    ];
    for (const idSignalement of demoSignalementIds) {
      await getDb().execute(
        `INSERT INTO signalement (
          id_signalement, id_utilisateur, date_constat, description, latitude, longitude
        ) VALUES ($1, $2, CURRENT_TIMESTAMP, 'Signalement de test', 14.67, -17.43)`,
        [idSignalement, TEST_PERSONAS.CITOYEN.id]
      );
    }

    // 2. Création d'un signalement sans GPS avec repère textuel
    const sigText = await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Dépôt sans GPS Marché Kermel',
        latitude: null,
        longitude: null,
        descriptionLocalisation: 'Sous les arcades Kermel',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.ORGANIQUE }],
      },
    });
    const idSigText = sigText.json().idSignalement;

    // 3. Contrôle d'accès RBAC : Un citoyen simple ne peut pas accéder à la carte d'administration
    const citoyenAccess = await app.inject({
      method: 'GET',
      url: '/api/carte/points',
      headers: citoyen.headers,
    });
    expect(citoyenAccess.statusCode).toBe(403);

    // 4. L'élu / décideur territorial accède à la cartographie
    const carteRes = await app.inject({
      method: 'GET',
      url: '/api/carte/points',
      headers: decision.headers,
    });
    expect(carteRes.statusCode).toBe(200);
    const carte = carteRes.json();

    // Règle T37 : Objets géolocalisés sur la carte
    expect(carte.pointsGeolocalises.some((p: any) => p.id === idSigGeo)).toBe(true);
    const demoReferences = carte.pointsGeolocalises
      .filter((point: { id: string }) => demoSignalementIds.includes(point.id))
      .map((point: { reference: string }) => point.reference)
      .sort();
    expect(demoReferences).toEqual(['SIG-50000000-0001', 'SIG-50000000-0002']);

    // Règle T37 : Liste dédiée séparée des signalements sans coordonnées GPS
    expect(carte.sansCoordonnees.some((s: any) => s.idSignalement === idSigText)).toBe(true);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T38 : Indicateurs statistiques étanches (RG58 / RG59)
  // --------------------------------------------------------------------------
  it("T38: Comptage distinct et étanche des observations, dossiers, affectations, interventions et résolutions", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);
    const affectation = await loginAs(app, TEST_PERSONAS.AFFECTATION.email);
    const terrain = await loginAs(app, TEST_PERSONAS.TERRAIN.email);
    const verification = await loginAs(app, TEST_PERSONAS.VERIFICATION.email);
    const decision = await loginAs(app, TEST_PERSONAS.DECISION.email);

    // 1. Créer 2 signalements
    await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Signalement 1 Kermel',
        latitude: 14.67,
        longitude: -17.43,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    await app.inject({
      method: 'POST',
      url: '/api/signalements',
      headers: citoyen.headers,
      payload: {
        description: 'Signalement 2 Sandaga',
        latitude: 14.675,
        longitude: -17.435,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });

    // 2. Créer 1 dossier
    const dos = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Dossier Plateau',
        latitude: 14.67,
        longitude: -17.43,
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE }],
      },
    });
    const idDossier = dos.json().idDossier;

    // 3. Affecter le volet
    const aff = await app.inject({
      method: 'POST',
      url: '/api/affectations',
      headers: affectation.headers,
      payload: {
        idDossier,
        idTypeDechet: TEST_TYPES_DECHETS.PLASTIQUE,
        idEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.id,
        idCompetenceEquipe: TEST_EQUIPES.PLASTIQUE_PLATEAU.competencePlastique,
      },
    });
    const idAff = aff.json().idAffectation;

    const db = getDb();
    const interv = await db.queryOne<{ id_intervention: string; nom_equipe: string }>(
      `SELECT i.id_intervention, e.nom_equipe
       FROM intervention i
       JOIN affectation a ON a.id_affectation = i.id_affectation
       JOIN equipe e ON e.id_equipe = a.id_equipe
       WHERE i.id_affectation = $1`,
      [idAff]
    );

    // Les interventions sont cartographiées à partir du dossier auquel leur affectation est rattachée.
    const carteAvecMission = await app.inject({
      method: 'GET',
      url: '/api/carte/points',
      headers: decision.headers,
    });
    expect(carteAvecMission.statusCode).toBe(200);
    const missionMapPoint = carteAvecMission.json().pointsGeolocalises.find(
      (point: { id: string; typeObjet: string }) =>
        point.id === interv!.id_intervention && point.typeObjet === 'INTERVENTION'
    );
    expect(missionMapPoint).toMatchObject({
      idAffectation: idAff,
      referenceDossier: expect.any(String),
      nomEquipe: interv!.nom_equipe,
      statut: 'PROGRAMMEE',
      latitude: 14.67,
      longitude: -17.43,
    });

    // 4. Terminer l'intervention
    const startIntervention = await app.inject({
      method: 'POST',
      url: `/api/interventions/${interv!.id_intervention}/demarrer`,
      headers: terrain.headers,
    });
    expect(startIntervention.statusCode).toBe(200);

    await app.inject({
      method: 'POST',
      url: `/api/interventions/${interv!.id_intervention}/terminer`,
      headers: terrain.headers,
      payload: {
        resultatIntervention: ResultatIntervention.SUCCES_TOTAL,
        compteRendu: 'Nettoyage 100% effectué par l équipe',
      },
    });

    // 5. Vérification positive
    await app.inject({
      method: 'POST',
      url: '/api/verifications',
      headers: verification.headers,
      payload: {
        idAffectation: idAff,
        resultatVerification: ResultatVerification.CONFORME_RESOLU,
        motif: 'Tout est conforme',
      },
    });

    // 6. Clôturer le dossier
    await app.inject({
      method: 'POST',
      url: `/api/verifications/dossiers/${idDossier}/cloturer`,
      headers: verification.headers,
      payload: { motif: 'Clôture complète' },
    });

    // 7. Consulter les statistiques
    const statsRes = await app.inject({
      method: 'GET',
      url: '/api/statistiques/indicateurs',
      headers: decision.headers,
    });
    expect(statsRes.statusCode).toBe(200);
    const ind = statsRes.json().indicateurs;

    // Règle T38 : Les compteurs sont étanches et exacts
    expect(ind.observationsRecues).toBe(2);
    expect(ind.dossiersCrees).toBe(1);
    expect(ind.dossiersCloturesResolus).toBe(1);
    expect(ind.tauxResolutionGlobalPct).toBe(100);
    expect(ind.affectationsAttribuees).toBe(1);
    expect(ind.interventionsTerminees).toBe(1);
    expect(ind.resolutionsVerifieesConformes).toBe(1);
    expect(ind.reouverturesTracees).toBe(0);
  });

  // --------------------------------------------------------------------------
  // Test d'acceptation T27 : Transfert externe hors périmètre avec traçabilité
  // --------------------------------------------------------------------------
  it("T27: Transfert externe hors périmètre tracé dans EVENEMENT_METIER avec destinataire et motif", async () => {
    const traitement = await loginAs(app, TEST_PERSONAS.TRAITEMENT.email);

    // Création dossier
    const dos = await app.inject({
      method: 'POST',
      url: '/api/dossiers',
      headers: traitement.headers,
      payload: {
        descriptionSynthese: 'Déchets industriels hors compétence communale',
        categories: [{ idTypeDechet: TEST_TYPES_DECHETS.ELECTRONIQUE }],
      },
    });
    const idDossier = dos.json().idDossier;

    // Déclenchement du transfert externe (Test T27)
    const transfertRes = await app.inject({
      method: 'POST',
      url: `/api/dossiers/${idDossier}/transfert-externe`,
      headers: traitement.headers,
      payload: {
        destinataireExterne: 'Direction de l Environnement et des Établissements Classés (DEEC)',
        motif: 'Déchets dangereux nécessitant une filière spécialisée nationale agréée',
      },
    });

    expect(transfertRes.statusCode).toBe(200);
    expect(transfertRes.json().success).toBe(true);

    // Vérification de la traçabilité immuable dans EVENEMENT_METIER
    const db = getDb();
    const eventRow = await db.queryOne<{ type_evenement: string; destinataire_externe: string; motif: string }>(
      `SELECT type_evenement, destinataire_externe, motif FROM evenement_metier 
       WHERE id_dossier_cible = $1 AND type_evenement = 'TRANSFERT_EXTERNE'`,
      [idDossier]
    );

    expect(eventRow).not.toBeNull();
    expect(eventRow!.destinataire_externe).toBe('Direction de l Environnement et des Établissements Classés (DEEC)');
    expect(eventRow!.motif).toMatch(/filière spécialisée/);
  });

  // --------------------------------------------------------------------------
  // Extension Valorisation : Points et Notifications Internes
  // --------------------------------------------------------------------------
  it("Extensions : Consultation et attribution de points, et accusés de réception notifications", async () => {
    const citoyen = await loginAs(app, TEST_PERSONAS.CITOYEN.email);
    const admin = await loginAs(app, TEST_PERSONAS.ADMIN.email);

    // 1. Attribution manuelle de 50 points de bonus civique
    const pointRes = await app.inject({
      method: 'POST',
      url: '/api/points/attribuer',
      headers: admin.headers,
      payload: {
        idUtilisateur: TEST_PERSONAS.CITOYEN.id,
        points: 50,
        motif: 'Bonus civique Semaine de la Propreté Dakar',
      },
    });
    expect(pointRes.statusCode).toBe(201);

    // 2. Consultation du solde et historique de points par le citoyen
    const soldeRes = await app.inject({
      method: 'GET',
      url: '/api/points/mes-points',
      headers: citoyen.headers,
    });
    expect(soldeRes.statusCode).toBe(200);
    expect(soldeRes.json().soldeTotal).toBeGreaterThanOrEqual(50);

    // 3. Consultation des notifications citoyennes
    const notifRes = await app.inject({
      method: 'GET',
      url: '/api/notifications',
      headers: citoyen.headers,
    });
    expect(notifRes.statusCode).toBe(200);
    const notifications = notifRes.json().data;

    if (notifications.length > 0) {
      const idNotif = notifications[0].idNotification;
      const marquerLu = await app.inject({
        method: 'PATCH',
        url: `/api/notifications/${idNotif}/lu`,
        headers: citoyen.headers,
      });
      expect(marquerLu.statusCode).toBe(200);
      expect(marquerLu.json().lu).toBe(true);
    }
  });
});
